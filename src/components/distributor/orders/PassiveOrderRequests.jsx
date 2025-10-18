import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";

// ---------- helpers ----------
const money = (n) => {
  const x = Number(n || 0);
  return x.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
};
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "object" && typeof v.seconds === "number") return new Date(v.seconds * 1000);
  try { return new Date(v); } catch { return null; }
};
const fmtDate = (v) => {
  const d = toDate(v);
  if (!d || isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const cx = (...arr) => arr.filter(Boolean).join(" ");

// allowed statuses used in UI
const STATUSES = ["All", "Requested", "Confirmed", "Packed", "Dispatched", "Delivered", "Cancelled"];

function Drawer({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative h-full w-full max-w-xl bg-[#0B1220] text-slate-100 shadow-xl border-l border-slate-700/50 overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-[#0B1220]">
          <h3 className="text-base font-semibold">{title}</h3>
          <button className="px-2 py-1 rounded-lg border border-slate-600/50 hover:bg-white/5" onClick={onClose}>Close</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ---------- query builder (primary) ----------
function buildPassiveOrdersQuery(distributorId, { status, pageSize = 25, cursor, dateFrom, dateTo }) {
  const base = collection(db, "businesses", distributorId, "orderRequests");
  const parts = [where("retailerMode", "==", "passive")];

  if (status && status !== "All") parts.push(where("status", "==", status));
  if (dateFrom) parts.push(where("createdAt", ">=", dateFrom));
  if (dateTo) parts.push(where("createdAt", "<", dateTo));

  // This combination may require a composite index:
  // retailerMode (==) + createdAt (orderBy)
  parts.push(orderBy("createdAt", "desc"));

  const baseQuery = query(base, ...parts, limit(pageSize));
  if (cursor) {
    return query(base, ...parts, startAfter(cursor), limit(pageSize));
  }
  return baseQuery;
}

// ---------- component ----------
export default function PassiveOrderRequests({ pageSize = 25, defaultStatus = "All" }) {
  const [distributorId, setDistributorId] = useState(null);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(defaultStatus);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [exhausted, setExhausted] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  // If Firestore requires an index, we switch to fallback mode (no server orderBy, JS sorts)
  const [fallbackMode, setFallbackMode] = useState(false);

  // resolve distributor uid
  useEffect(() => {
    const auth = getAuth();
    const unsub = auth.onAuthStateChanged((u) => setDistributorId(u?.uid || null));
    setDistributorId(auth.currentUser?.uid || null);
    return () => unsub();
  }, []);

  // --- core fetcher with automatic index fallback ---
  const fetchPage = useCallback(
    async ({ reset = false } = {}) => {
      if (!distributorId) return;
      setLoading(true);

      try {
        if (fallbackMode) {
          // Fallback: remove orderBy; Firestore will return in default order; we sort in JS
          const base = collection(db, "businesses", distributorId, "orderRequests");
          const parts = [where("retailerMode", "==", "passive")];
          if (status && status !== "All") parts.push(where("status", "==", status));

          const snap = await getDocs(query(base, ...parts, limit(pageSize)));
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

          // sort client-side by createdAt desc
          docs.sort((a, b) => {
            const da = toDate(a.createdAt)?.getTime() ?? 0;
            const dbt = toDate(b.createdAt)?.getTime() ?? 0;
            return dbt - da;
          });

          if (reset) {
            setRows(docs);
          } else {
            setRows((prev) => [...prev, ...docs]);
          }
          // Pagination in fallback is unreliable (no server orderBy), so mark as exhausted.
          setCursor(null);
          setExhausted(true);
          setLoading(false);
          return;
        }

        // Normal (indexed) path
        const q = buildPassiveOrdersQuery(distributorId, {
          status,
          pageSize,
          cursor: reset ? null : cursor,
        });

        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (reset) {
          setRows(docs);
        } else {
          setRows((prev) => [...prev, ...docs]);
        }

        setCursor(snap.docs[snap.docs.length - 1] || null);
        setExhausted(snap.empty || snap.docs.length < pageSize);
        setLoading(false);
      } catch (err) {
        // Firestore “index required” error => code: 'failed-precondition'
        const code = err?.code || err?.message || "";
        const needsIndex =
          code === "failed-precondition" ||
          (typeof code === "string" && code.toLowerCase().includes("failed-precondition"));

        if (needsIndex) {
          // Switch to fallback once, then fetch again in fallback mode
          setFallbackMode(true);
          setLoading(false);
          // immediate refetch in fallback path
          fetchPage({ reset });
          return;
        }

        // Log once but keep UI clean
        if (process && process.env && process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn("[PassiveOrderRequests] load failed", err);
        }
        if (reset) setRows([]);
        setCursor(null);
        setExhausted(true);
        setLoading(false);
      }
    },
    [distributorId, status, pageSize, cursor, fallbackMode]
  );

  const reload = useCallback(() => fetchPage({ reset: true }), [fetchPage]);
  const loadMore = useCallback(() => {
    if (!exhausted) fetchPage({ reset: false });
  }, [fetchPage, exhausted]);

  // Reload on mount and whenever distributor/status changes
  useEffect(() => {
    // reset fallback mode when status changes (we'll detect again)
    setFallbackMode(false);
    setCursor(null);
    setExhausted(false);
    reload();
  }, [reload]);

  // local client-side search on the hydrated page (name/phone/email)
  const filtered = useMemo(() => {
    const q = (search || "").toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (r?.retailerInfo?.name || "").toLowerCase();
      const phone = (r?.retailerInfo?.phone || "").toLowerCase();
      const email = (r?.retailerInfo?.email || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Mode label */}
        <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
          Passive
        </span>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setCursor(null);
                setExhausted(false);
                setFallbackMode(false);
              }}
              className={cx(
                "px-3 py-1 rounded-lg border text-sm",
                status === s
                  ? "bg-emerald-500 text-slate-900 border-emerald-400"
                  : "bg-[#243041] text-slate-300 border-slate-600/50 hover:bg-[#2c3a4f]"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="ml-auto w-full sm:w-72">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search retailer name / phone / email"
            className="w-full px-3 py-2 rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-slate-700/40">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase text-slate-300 bg-white/5">
            <tr>
              <th className="text-left px-3 py-2">Retailer</th>
              <th className="text-left px-3 py-2">Items</th>
              <th className="text-left px-3 py-2">Subtotal</th>
              <th className="text-left px-3 py-2">Delivery</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-slate-700/50 hover:bg-[#2f3a4d]">
                <td className="px-3 py-3">
                  <div className="font-medium text-slate-100 flex items-center gap-2">
                    {r?.retailerInfo?.name || "Retailer"}
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-50/10 text-amber-300 border-amber-500/30">
                      passive
                    </span>
                    {r?.isProvisional ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/30">
                        provisional
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-400">
                    {(r?.retailerInfo?.phone || "-")} • {(r?.retailerInfo?.email || "-")}
                  </div>
                </td>
                <td className="px-3 py-3">{(r.items || []).length}</td>
                <td className="px-3 py-3">₹{money(r.itemsSubTotal)}</td>
                <td className="px-3 py-3">{fmtDate(r.deliveryDate)}</td>
                <td className="px-3 py-3">
                  <span
                    className={cx(
                      "text-xs px-2 py-0.5 rounded-full border",
                      r.status === "Requested"
                        ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                        : r.status === "Confirmed"
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                        : r.status === "Packed"
                        ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
                        : r.status === "Dispatched"
                        ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                        : r.status === "Delivered"
                        ? "bg-emerald-600/10 text-emerald-300 border-emerald-600/30"
                        : r.status === "Cancelled"
                        ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                        : "bg-white/5 text-slate-300 border-slate-600/40"
                    )}
                  >
                    {r.status || "Requested"}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-900 font-medium hover:brightness-110"
                    onClick={() => {
                      setSelected(r);
                      setDetailOpen(true);
                    }}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {loading && (
              <tr>
                <td className="px-3 py-6 text-slate-400 text-center" colSpan={6}>Loading…</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-slate-400 text-center" colSpan={6}>
                  No passive orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400">
          {exhausted && (fallbackMode
            ? "Showing first page (client-sorted). Create the composite index for full pagination."
            : "All caught up")}
        </div>
        {!exhausted && (
          <button
            onClick={loadMore}
            className="px-3 py-1.5 rounded-lg bg-[#243041] text-slate-300 hover:bg-[#2c3a4f] border border-slate-600/50"
          >
            Load more
          </button>
        )}
      </div>

      <Drawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selected ? `Order • ${selected.retailerInfo?.name || "Retailer"}` : "Order"}
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-lg border border-slate-700/50 p-3">
                <div className="text-xs text-slate-400 mb-1">Retailer</div>
                <div className="font-semibold">{selected.retailerInfo?.name || "Retailer"}</div>
                <div className="text-xs text-slate-400">{selected.retailerInfo?.phone || "-"} • {selected.retailerInfo?.email || "-"}</div>
                <div className="text-xs text-slate-400 mt-1">Mode: passive{selected.isProvisional ? " • provisional" : ""}</div>
              </div>

              <div className="rounded-lg border border-slate-700/50 p-3">
                <div className="text-xs text-slate-400 mb-1">Delivery & Payment</div>
                <div className="text-sm">Delivery: {fmtDate(selected.deliveryDate)}</div>
                <div className="text-sm">Payment: {selected.paymentMode || selected.payment?.type || "-"}</div>
                {selected.payment?.creditDays ? (
                  <div className="text-sm">Credit days: {selected.payment.creditDays}</div>
                ) : null}
                {selected.payment?.advanceAmount ? (
                  <div className="text-sm">Advance: ₹{money(selected.payment.advanceAmount)}</div>
                ) : null}
              </div>

              <div className="rounded-lg border border-slate-700/50 p-3 overflow-hidden">
                <div className="text-xs text-slate-400 mb-2">Items ({(selected.items || []).length})</div>
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase text-slate-300 bg-white/5">
                    <tr>
                      <th className="text-left px-2 py-1">Item</th>
                      <th className="text-left px-2 py-1">SKU</th>
                      <th className="text-right px-2 py-1">Qty</th>
                      <th className="text-right px-2 py-1">MRP</th>
                      <th className="text-right px-2 py-1">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.items || []).map((it, idx) => (
                      <tr key={idx} className="border-t border-slate-800/60">
                        <td className="px-2 py-1">{it.name}</td>
                        <td className="px-2 py-1">{it.sku || "-"}</td>
                        <td className="px-2 py-1 text-right">{it.qty}</td>
                        <td className="px-2 py-1 text-right">₹{money(it.mrp)}</td>
                        <td className="px-2 py-1 text-right">₹{money(Number(it.qty) * Number(it.mrp))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 text-right text-sm">Subtotal: <span className="font-semibold">₹{money(selected.itemsSubTotal)}</span></div>
              </div>

              {selected.notes ? (
                <div className="rounded-lg border border-slate-700/50 p-3">
                  <div className="text-xs text-slate-400 mb-1">Notes</div>
                  <div className="text-sm whitespace-pre-wrap">{selected.notes}</div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}