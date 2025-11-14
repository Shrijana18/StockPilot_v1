import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { db, functions } from "../../firebase/firebaseConfig";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  doc,
  getDoc,
  orderBy,
  limit,
  updateDoc
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import OrderSettings from "./OrderSettings";

// Pretty helpers
const toTitleCase = (s = "") =>
  s.toString().trim().toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
const prettyStatus = (s = "") =>
  s.toString().replace(/[-_]/g, " ").replace(/\b([a-z])/gi, (m) => m.toUpperCase()).trim();

// Helper badge for status (accepted / provisioned / provisioned-local / others)
function StatusBadge({ status }) {
  const st = (status || "").toString().toLowerCase();
  let color = "bg-white/5 text-white/70 border border-white/15";
  if (st === "accepted" || st === "active" || st === "approved") {
    color = "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30";
  } else if (st === "provisioned" || st === "provisioned-local" || st === "pending" || st === "invited") {
    color = "bg-amber-500/15 text-amber-300 border border-amber-400/30";
  } else if (st === "rejected" || st === "blocked" || st === "disabled") {
    color = "bg-rose-500/15 text-rose-300 border border-rose-400/30";
  }
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${color}`}
      title={prettyStatus(status) || "—"}
      aria-label={`Status: ${prettyStatus(status) || "Unknown"}`}
    >
      {prettyStatus(status) || "—"}
    </span>
  );
}

// String normalization utility
const norm = (s = "") => s.toString().toLowerCase().trim();
// Removed duplicate declaration of toTitleCase

/**
 * ManageRetailers component
 * Props:
 *   distributorId (string): The current distributor's ID
 */
const ManageRetailers = ({ distributorId }) => {
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employeeCache, setEmployeeCache] = useState({}); // { empUid: { name, flypEmployeeId } }

  // List controls
  const [queryText, setQueryText] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchRef = useRef(null);
  const [cityFilter, setCityFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
  const [itemsPerPage, setItemsPerPage] = useState(18);
  const [page, setPage] = useState(1);
  // UI state for global/bulk Order Settings hub
  const [showOrderSettings, setShowOrderSettings] = useState(false);
  // Retailer Defaults on-demand preview
  const [showDefaultsPreview, setShowDefaultsPreview] = useState(false);


  // Right-side drawer for per-retailer management (clean UI; no inline expansions)
  const [activeRetailer, setActiveRetailer] = useState(null); // object from list
  const [drawerTab, setDrawerTab] = useState("overview"); // 'overview' | 'defaults' | 'orders' | 'assistant'

  const openDrawerFor = (r) => {
    setActiveRetailer(r);
    setDrawerTab("overview");
    document.body.style.overflow = "hidden";
  };
  const closeDrawer = () => {
    setActiveRetailer(null);
    document.body.style.overflow = "";
  };

  // Lock body scroll when any modal/drawer is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    const anyOpen = showOrderSettings || !!activeRetailer || showDefaultsPreview;
    if (anyOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = prev || "";
    }
    return () => { document.body.style.overflow = prev || ""; };
  }, [showOrderSettings, activeRetailer, showDefaultsPreview]);

  // Close on ESC
  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      searchRef.current?.focus();
      return;
    }
    if (e.key === 'Escape') {
      if (showOrderSettings) setShowOrderSettings(false);
      if (activeRetailer) closeDrawer();
      if (showDefaultsPreview) setShowDefaultsPreview(false);
    }
  }, [showOrderSettings, activeRetailer, showDefaultsPreview]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!distributorId) return;
    setLoading(true);
    setError(null);
    const collRef = collection(db, "businesses", distributorId, "connectedRetailers");
    const qRef = query(collRef, where("status", "in", ["accepted", "provisioned", "provisioned-local"]));
    const unsub = onSnapshot(qRef, async (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() || {};
        const retailerId = data.retailerId || d.id;
        return {
          id: retailerId,
          status: data.status || "provisioned",
          businessName: data.retailerName || "Retailer",
          email: data.retailerEmail || "",
          city: data.retailerCity || data.city || "", // Check both retailerCity and city for compatibility
          state: data.retailerState || data.state || "", // Also include state
          address: data.retailerAddress || data.address || "", // Also include address
          phone: data.retailerPhone || "",
          connectedAt: data.connectedAt || null,
          provisionalId: data.provisionalId || null,
          addedBy: data.addedBy || null,
          createdAt: data.createdAt || null,
        };
      });
      setRetailers(rows);
      setLoading(false);
    }, (e) => {
      console.error('connectedRetailers live query failed', e);
      setError('Failed to fetch retailers.');
      setLoading(false);
    });
    return () => unsub();
  }, [distributorId]);

  // Warm employee cache when retailers change (prevents resubscribing the live query)
  useEffect(() => {
    if (!distributorId || !retailers.length) return;
    const missingEmpIds = Array.from(new Set(
      retailers
        .map(r => r.addedBy?.type === 'employee' ? r.addedBy.id : null)
        .filter(Boolean)
        .filter(empId => !employeeCache[empId])
    ));
    if (!missingEmpIds.length) return;
    (async () => {
      const updates = {};
      for (const eid of missingEmpIds) {
        try {
          const ref = doc(db, 'businesses', distributorId, 'distributorEmployees', eid);
          const esnap = await getDoc(ref);
          if (esnap.exists()) {
            const ed = esnap.data() || {};
            updates[eid] = { name: ed.name || '', flypEmployeeId: ed.flypEmployeeId || '' };
          }
        } catch {}
      }
      if (Object.keys(updates).length) setEmployeeCache(prev => ({ ...prev, ...updates }));
    })();
  }, [distributorId, retailers, employeeCache]);

  // Debounce the search input so long lists don't re-filter on each keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(queryText), 250);
    return () => clearTimeout(t);
  }, [queryText]);

  // Derive options and filtered list
  const cityOptions = useMemo(() => {
    const set = new Set();
    retailers.forEach(r => {
      if (r.city) set.add(r.city);
    });
    return ["all", ...Array.from(set).sort((a,b)=>a.localeCompare(b))];
  }, [retailers]);

  const filtered = useMemo(() => {
    const q = norm(debouncedQuery);
    return retailers.filter(r => {
      const inCity = cityFilter === "all" || norm(r.city) === norm(cityFilter);
      const hay = `${r.businessName} ${r.email} ${r.phone} ${r.city}`.toLowerCase();
      const inQuery = q === "" || hay.includes(q);
      return inCity && inQuery;
    });
  }, [retailers, debouncedQuery, cityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  // Compact tile for grid/list (prevents inline settings UI from expanding)
  function CompactRetailerTile({ retailer, onManage }) {
    const initials = ((retailer.businessName || retailer.name || "R")
      .split(" ")
      .filter(Boolean)
      .slice(0,2)
      .map(s => s[0]?.toUpperCase())
      .join("")) || "R";
    const [showAct, setShowAct] = useState(false);
    const [actItems, setActItems] = useState([]);
    const [actLoading, setActLoading] = useState(false);

    const loadActivity = useCallback(async () => {
      if (!distributorId) return;
      setActLoading(true);
      try {
        const actCol = collection(db, "businesses", distributorId, "employeeActivity");
        const q = query(actCol, where("targetId", "==", retailer.id), orderBy("createdAt", "desc"), limit(5));
        const snap = await getDocs(q);
        setActItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setActItems([]);
      } finally {
        setActLoading(false);
      }
    }, [distributorId, retailer?.id]);

    const toggleAct = () => {
      const next = !showAct;
      setShowAct(next);
      if (next && actItems.length === 0) loadActivity();
    };
    return (
        <div className="flex items-start justify-between gap-3 relative min-h-[6.5rem]">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-sm font-bold"
            aria-label={`Retailer avatar ${retailer.businessName || retailer.name || 'Retailer'}`}
            role="img"
          >
            {initials || "R"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="text-white font-semibold truncate"
                title={retailer.businessName || retailer.name || "Retailer"}
              >
                {toTitleCase(retailer.businessName || retailer.name || "Retailer")}
              </div>
              <StatusBadge status={retailer.status || "provisioned"} />
            </div>
            <div
              className="text-xs text-white/70 truncate"
              title={`${toTitleCase(retailer.city || "—")} • ${(retailer.email || retailer.phone || "—")}`}
            >
              {toTitleCase(retailer.city || "—")} • {retailer.email || retailer.phone || "—"}
            </div>
            {retailer.addedBy?.type === 'employee' && (
              <div className="text-[11px] text-white/50 truncate mt-0.5">
                Added by: {retailer.addedBy.name || employeeCache[retailer.addedBy.id]?.name || 'Employee'}
                { (retailer.addedBy.flypEmployeeId || employeeCache[retailer.addedBy.id]?.flypEmployeeId) &&
                  ` (${retailer.addedBy.flypEmployeeId || employeeCache[retailer.addedBy.id]?.flypEmployeeId})`}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end max-w-[45%]">
          {/* StatusBadge removed here */}
          {(/^provisioned/.test(retailer.status || '')) && (
            <button
              onClick={async () => {
                try {
                  const createFn = httpsCallable(functions, 'createProvisionalRetailer');
                  const res = await createFn({
                    distributorId,
                    payload: {
                      businessName: retailer.businessName,
                      email: retailer.email || null,
                      phone: retailer.phone || null,
                    },
                  });
                  const { provisionalId, inviteUrl } = res?.data || {};
                  if (provisionalId) {
                    await updateDoc(doc(db, 'businesses', distributorId, 'connectedRetailers', retailer.id), {
                      provisionalId,
                      status: 'provisioned',
                    });
                    try { await navigator.clipboard.writeText(inviteUrl); } catch (_) {}
                    alert('Invite link created and copied to clipboard');
                  }
                } catch (e) {
                  console.error('Invite create failed', e);
                  alert('Failed to create invite');
                }
              }}
              className="rounded-md px-2.5 py-1 text-xs bg-amber-400/90 text-black hover:bg-amber-300 border border-amber-500/40 transition"
              title="Send invite"
            >
              Send Invite
            </button>
          )}
          <button
            onClick={toggleAct}
            title="Recent activity"
            className="rounded-md px-2 py-1 text-xs bg-white/10 hover:bg-white/15 border border-white/15 text-white"
            aria-label="View recent activity"
          >
            ⓘ
          </button>
          <button
            onClick={onManage}
            className="rounded-md px-2.5 py-1.5 text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 shadow"
            aria-label="Manage retailer"
          >
            Manage
          </button>
        </div>

        {showAct && (
          <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-white/10 bg-[#0B0F14] shadow-xl z-10">
            <div className="px-3 py-2 border-b border-white/10 text-xs text-white/70">Recent activity</div>
            <div className="max-h-60 overflow-y-auto" aria-live="polite">
              {actLoading ? (
                <div className="p-3 text-xs text-white/60">Loading…</div>
              ) : actItems.length === 0 ? (
                <div className="p-3 text-xs text-white/60">No activity yet.</div>
              ) : (
                <ul className="p-2 space-y-1">
                  {actItems.map(a => (
                    <li key={a.id} className="text-xs text-white/80 flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-white/5">
                      <span className="truncate"><span className="capitalize font-medium">{a.type}</span>{a.meta?.name ? ` – ${a.meta.name}` : ''}</span>
                      <span className="text-white/50">{a.createdAt?.toDate?.().toLocaleDateString?.() || ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 border-b border-white/10 pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Connected Retailers</h2>
            <p className="text-xs text-white/60 mt-0.5">
              {filtered.length} of {retailers.length} retailers • Page {currentPage}/{totalPages}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  value={queryText}
                  onChange={(e)=>{ setQueryText(e.target.value); setPage(1); }}
                  placeholder="Search name, email, phone, city"
                  className="w-64 max-w-[70vw] rounded-lg bg-white/10 border border-white/20 px-3 py-2 pr-8 text-sm text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-emerald-400/40"
                  ref={searchRef}
                  aria-label="Search retailers"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 text-sm">⌘K</span>
              </div>
              <select
                value={cityFilter}
                onChange={(e)=>{ setCityFilter(e.target.value); setPage(1); }}
                className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                {cityOptions.map(opt => (
                  <option key={opt} value={opt}>{opt === "all" ? "All Cities" : opt}</option>
                ))}
              </select>
              <select
                value={itemsPerPage}
                onChange={(e)=>{ setItemsPerPage(Number(e.target.value)); setPage(1); }}
                className="rounded-lg bg-white/10 border border-white/20 px-2 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                {[12,18,24,36].map(n => <option key={n} value={n}>{n}/page</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1 self-start sm:self-auto">
              <button
                onClick={()=>setViewMode("grid")}
                className={`px-3 py-2 rounded-l-lg text-sm border transition-all ${viewMode==="grid" ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/10 text-white border-white/20 hover:bg-white/15"}`}
                title="Grid view"
                aria-pressed={viewMode==="grid"}
              >
                ⬛⬛
              </button>
              <button
                onClick={()=>setViewMode("list")}
                className={`px-3 py-2 rounded-r-lg text-sm border transition-all ${viewMode==="list" ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/10 text-white border-white/20 hover:bg-white/15"}`}
                title="List view"
                aria-pressed={viewMode==="list"}
              >
                ☰
              </button>
            </div>
            <button
              onClick={() => setShowOrderSettings(true)}
              className="px-3 py-2 rounded-lg text-sm border bg-white/10 text-white border-white/20 hover:bg-white/15 flex items-center gap-2 transition-all"
              title="Open global/bulk order settings"
              aria-label="Open global and bulk order settings"
            >
              ⚙️ <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-40 text-white/70">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-emerald-400 mb-3"></div>
          <span>Loading retailers...</span>
        </div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-white/60 text-center py-16 border border-dashed border-white/10 rounded-xl">
          <p className="text-lg mb-1">No retailers found</p>
          <p className="text-sm text-white/40">Try adjusting filters or adding new retailers.</p>
        </div>
      ) : (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginated.map((retailer) => (
                <div key={retailer.id} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-emerald-400/50 hover:bg-white/10 transition transform hover:-translate-y-[2px]">
                  <CompactRetailerTile retailer={retailer} onManage={() => openDrawerFor(retailer)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/5">
              {paginated.map((retailer) => (
                <div key={retailer.id} className="p-4 hover:bg-white/5 transition">
                  <CompactRetailerTile retailer={retailer} onManage={() => openDrawerFor(retailer)} />
                </div>
              ))}
            </div>
          )}
          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between text-sm text-white/70 border-t border-white/10 pt-4">
            <div>Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={()=> setPage(p => Math.max(1, p-1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 disabled:opacity-50 hover:bg-white/15"
                aria-label="Previous page"
              >
                Prev
              </button>
              <span>Page {currentPage}/{totalPages}</span>
              <button
                onClick={()=> setPage(p => Math.min(totalPages, p+1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 disabled:opacity-50 hover:bg-white/15"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* Centered Manage Panel (Front Modal) */}
      {activeRetailer && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10" role="dialog" aria-modal="true" aria-labelledby="retailer-manage-title">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeDrawer} />

          {/* Panel */}
          <div className="relative w-[96%] max-w-6xl rounded-2xl border border-white/10 bg-gradient-to-b from-[#0B0F14]/95 to-[#0F1319]/95 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden animate-[fadeIn_.18s_ease-out]">
            <style>{`
              @keyframes fadeIn { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: scale(1) } }
            `}</style>
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#0E1319]/90 backdrop-blur">
              <div>
                <div className="text-xs text-white/60 uppercase tracking-wide mb-0.5">Retailer</div>
                <h2 id="retailer-manage-title" className="text-xl font-semibold text-white">{activeRetailer.businessName || "Retailer"}</h2>
                <div className="text-xs text-white/60">{activeRetailer.email || "—"} • {activeRetailer.phone || "—"}</div>
              </div>
              <button
                aria-label="Close retailer panel"
                onClick={closeDrawer}
                className="rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2 text-sm text-white font-medium transition-all"
              >
                ✕ Close
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 py-3 border-b border-white/10 bg-[#0E1319]/60 backdrop-blur-md">
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                {["overview","orders","defaults","assistant"].map(t => (
                  <button
                    key={t}
                    onClick={() => setDrawerTab(t)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      drawerTab===t
                        ? "bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                        : "bg-white/10 text-white border border-white/10 hover:bg-white/15"
                    }`}
                  >
                    {t === "overview" ? "Retailer Overview" : t === "orders" ? "Orders" : t === "defaults" ? "Set Defaults" : "Assistant"}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[78vh] overflow-y-auto px-6 py-6 space-y-6">
              {drawerTab === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm text-white/60 mb-1">Contact</div>
                    <div className="text-white">{activeRetailer.businessName}</div>
                    <div className="text-white/80 text-sm">{activeRetailer.email || "—"}</div>
                    <div className="text-white/80 text-sm">{activeRetailer.phone || "—"}</div>
                    <div className="text-white/60 text-xs mt-2">City: {activeRetailer.city || "—"}</div>
                    {activeRetailer.state && (
                      <div className="text-white/60 text-xs">State: {activeRetailer.state}</div>
                    )}
                    {activeRetailer.address && (
                      <div className="text-white/60 text-xs">Address: {activeRetailer.address}</div>
                    )}
                    <div className="text-white/60 text-xs">Status: <span className="uppercase">{activeRetailer.status || "provisioned"}</span></div>
                    <div className="text-white/60 text-xs mt-1">Added: {activeRetailer.createdAt?.toDate?.().toLocaleString?.() || "—"}</div>
                    <div className="text-white/60 text-xs">
                      Added by: {activeRetailer.addedBy?.type || '—'}
                      {activeRetailer.addedBy?.name ? ` ${activeRetailer.addedBy.name}` : ''}
                      {activeRetailer.addedBy?.flypEmployeeId ? ` (${activeRetailer.addedBy.flypEmployeeId})` : (activeRetailer.addedBy?.id ? ` (${activeRetailer.addedBy.id})` : '')}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm text-white/60 mb-2">Quick Actions</div>
                    <div className="flex flex-wrap gap-2">
                      <button className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm">Create Order</button>
                      {(/^provisioned/.test(activeRetailer.status || '')) && (
                        <button
                          className="px-3 py-1.5 rounded-md bg-emerald-500 text-black hover:bg-emerald-400 text-sm"
                          onClick={async () => {
                            try {
                              const createFn = httpsCallable(functions, 'createProvisionalRetailer');
                              const res = await createFn({
                                distributorId,
                                payload: {
                                  businessName: activeRetailer.businessName,
                                  email: activeRetailer.email || null,
                                  phone: activeRetailer.phone || null,
                                },
                              });
                              const { provisionalId, inviteUrl } = res?.data || {};
                              if (provisionalId) {
                                await updateDoc(doc(db, 'businesses', distributorId, 'connectedRetailers', activeRetailer.id), {
                                  provisionalId,
                                  status: 'provisioned',
                                });
                                try { await navigator.clipboard.writeText(inviteUrl); } catch (_) {}
                                alert('Invite link created and copied');
                              }
                            } catch (e) {
                              alert('Failed to create invite');
                            }
                          }}
                        >
                          Send Invite
                        </button>
                      )}
                      <button className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm">Send Reminder</button>
                      <button className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm">View Payments</button>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === "orders" && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-white/60 mb-2">Recent Orders</div>
                  <div className="text-white/60 text-sm">Coming soon: list distributor → retailer orders with statuses.</div>
                </div>
              )}

              {drawerTab === "defaults" && (
                <div className="p-0">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-base font-semibold text-white">Retailer Defaults</div>
                        <div className="text-xs text-white/60">
                          These settings apply <span className="text-white font-medium">only to this retailer</span> and override your global defaults.
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowDefaultsPreview(true)}
                          className="px-3 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/15 border border-white/15 text-white transition"
                        >
                          Preview
                        </button>
                        <span className="px-3 py-1.5 text-xs rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">Retailer Specific</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <OrderSettings
                        scope="retailer"
                        distributorId={distributorId}
                        retailerId={activeRetailer.id}
                        hideGlobalCtas
                      />
                    </div>
                  </div>
                  {/* Sticky info footer */}
                  <div className="sticky bottom-0 mt-4 -mx-6 px-6 py-3 bg-[#0B0F14]/85 backdrop-blur border-t border-white/10 flex items-center justify-end gap-2">
                    <span className="text-xs text-white/50 mr-auto">Changes here affect this retailer only.</span>
                    <button onClick={() => setDrawerTab("overview")} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm">Done</button>
                  </div>
                </div>
              )}

              {drawerTab === "assistant" && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-white/60 mb-2">Assistant</div>
                  <div className="text-white/60 text-sm">Chat and quick actions for this retailer (placeholder).</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Retailer Defaults Preview Modal */}
      {showDefaultsPreview && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-10" role="dialog" aria-modal="true" aria-labelledby="retailer-defaults-preview-title">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDefaultsPreview(false)} />
          <div className="relative w-[96%] max-w-4xl rounded-2xl border border-white/10 bg-gradient-to-b from-[#0B0F14]/95 to-[#0F1319]/95 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden animate-[fadeIn_.18s_ease-out]">
            <style>{`@keyframes fadeIn { from { opacity:0; transform: scale(.98) } to { opacity:1; transform: scale(1) } }`}</style>
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#0E1319]/90">
              <div>
                <div className="text-xs text-white/60 uppercase tracking-wide">Preview</div>
                <h3 id="retailer-defaults-preview-title" className="text-lg font-semibold text-white">Invoice / Proforma preview</h3>
              </div>
              <button
                aria-label="Close preview"
                onClick={() => setShowDefaultsPreview(false)}
                className="rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2 text-sm text-white"
              >
                ✕ Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              {/* Replace this placeholder with the actual preview render when available */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white/70 text-sm">
                Preview placeholder — this will render a mini proforma/invoice using the current defaults for this retailer.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global/Bulk Order Settings Modal */}
      {showOrderSettings && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10" onKeyDown={handleKeyDown} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="order-settings-title">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowOrderSettings(false)} />
          <div className="relative w-[95%] max-w-6xl rounded-2xl border border-white/10 bg-[#0B0F14]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div id="order-settings-title" className="text-white font-semibold">Order Settings — Global & Bulk</div>
              <button
                onClick={() => setShowOrderSettings(false)}
                className="rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-1.5 text-sm text-white"
              >
                Close
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto p-4 glass-scroll">
              <OrderSettings scope="global" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageRetailers;