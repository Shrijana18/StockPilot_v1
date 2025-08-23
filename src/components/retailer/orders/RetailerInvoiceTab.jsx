import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../../../firebase/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import InvoicePreviewModal from "./InvoicePreviewModal";

// --- Helpers: INR + dd/mm/yyyy + safe date ---
const formatINR = (amt = 0) => {
  const n = Number(amt || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
};

const toJSDate = (val) => {
  if (!val) return null;
  if (typeof val?.toDate === "function") return val.toDate();
  if (typeof val?.seconds === "number") return new Date(val.seconds * 1000);
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d) ? null : d;
};

const formatDate = (val) => {
  const d = toJSDate(val);
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
};

const SkeletonCard = () => (
  <div className="bg-white/5 border border-white/10 p-4 rounded-lg shadow animate-pulse">
    <div className="h-5 w-1/2 bg-white/10 rounded mb-3" />
    <div className="h-3 w-2/3 bg-white/10 rounded mb-2" />
    <div className="h-3 w-1/3 bg-white/10 rounded mb-2" />
    <div className="h-4 w-1/4 bg-white/10 rounded" />
  </div>
);

const RetailerInvoiceTab = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // UI controls
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest | amountHigh | amountLow | name

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, "businesses", user.uid, "sentOrders"),
          where("status", "==", "Delivered")
        );
        const snapshot = await getDocs(q);
        const filtered = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((order) => !!order?.proforma);
        setInvoices(filtered);
      } catch (e) {
        console.error("Failed to load invoices", e);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub && unsub();
  }, []);

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = [...invoices];

    if (term) {
      list = list.filter((inv) => {
        const distributor = (inv.distributorName || "Distributor").toLowerCase();
        const orderId = String(inv.id || "").toLowerCase();
        return distributor.includes(term) || orderId.includes(term);
      });
    }

    list.sort((a, b) => {
      const aDate = toJSDate(a?.proforma?.date)?.getTime() || 0;
      const bDate = toJSDate(b?.proforma?.date)?.getTime() || 0;
      const aAmt = Number(a?.proforma?.grandTotal || 0);
      const bAmt = Number(b?.proforma?.grandTotal || 0);
      const aName = (a.distributorName || "").toLowerCase();
      const bName = (b.distributorName || "").toLowerCase();
      switch (sortBy) {
        case "amountHigh":
          return bAmt - aAmt;
        case "amountLow":
          return aAmt - bAmt;
        case "name":
          return aName.localeCompare(bName);
        case "newest":
        default:
          return bDate - aDate;
      }
    });

    return list;
  }, [invoices, search, sortBy]);

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.warn("Clipboard not available");
    }
  };

  return (
    <div className="p-4 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">My Invoices</h2>
          <div className="flex items-center gap-3 text-sm">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search distributor or order id…"
              className="px-3 py-2 rounded bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded bg-white/5 border border-white/10 focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="amountHigh">Amount: High → Low</option>
              <option value="amountLow">Amount: Low → High</option>
              <option value="name">Distributor A → Z</option>
            </select>
            <span className="text-xs text-white/70">{filteredInvoices.length} invoice{filteredInvoices.length!==1?"s":""}</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="mt-10 flex items-center justify-center">
            <div className="text-center text-white/80">
              <div className="text-3xl mb-2">🧾</div>
              <div className="font-medium">No invoices found</div>
              <div className="text-sm text-white/60">Delivered orders will automatically appear here.</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInvoices.map((inv) => {
              const dateStr = formatDate(inv?.proforma?.date);
              const totalStr = formatINR(inv?.proforma?.grandTotal || 0);
              const distributor = inv.distributorName || "Distributor";
              const orderId = inv.id;
              return (
                <div
                  key={orderId}
                  className="relative bg-white/5 border border-white/10 p-4 rounded-lg shadow transition hover:border-cyan-400/40 hover:shadow-cyan-500/10"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-lg leading-tight">{distributor}</div>
                      <div className="mt-1 text-xs text-white/60 flex items-center gap-2">
                        <span>Order ID:</span>
                        <span className="font-mono text-white/80">{orderId}</span>
                        <button
                          onClick={() => copyText(orderId)}
                          className="px-1.5 py-0.5 text-[10px] rounded bg-white/10 hover:bg-white/15 border border-white/10"
                          title="Copy Order ID"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/30 text-emerald-200">
                      Delivered
                    </span>
                  </div>

                  <div className="mt-3 text-sm text-white/80">
                    <div>Date: {dateStr}</div>
                  </div>

                  <div className="mt-2 text-sm">
                    <span className="text-white/70">Grand Total:</span>{" "}
                    <span className="font-semibold">{totalStr}</span>
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-sm">
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="px-3 py-1.5 rounded bg-cyan-500/20 border border-cyan-400/30 hover:bg-cyan-500/25 text-cyan-100"
                    >
                      View Invoice
                    </button>
                    {/* Placeholders for future actions */}
                    <button
                      disabled
                      className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-white/40 cursor-not-allowed"
                      title="Coming soon"
                    >
                      Download PDF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedInvoice && (
          <InvoicePreviewModal
            invoice={selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
          />
        )}
      </div>
    </div>
  );
};

export default RetailerInvoiceTab;
