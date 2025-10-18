import React, { useEffect, useState, useCallback, useMemo } from "react";
import { db } from "../../firebase/firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import OrderSettings from "./OrderSettings";

// Helper badge for status
function StatusBadge({ status }) {
  const color =
    status === "accepted"
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  return (
    <span
      className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${color}`}
    >
      {status?.charAt(0)?.toUpperCase() + (status?.slice(1) || "")}
    </span>
  );
}

/**
 * ManageRetailers component
 * Props:
 *   distributorId (string): The current distributor's ID
 */
const ManageRetailers = ({ distributorId }) => {
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // List controls
  const [queryText, setQueryText] = useState("");
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
    let active = true;

    const run = async () => {
      if (!distributorId) return;
      setLoading(true);
      setError(null);
      try {
        // Read from Firestore: /businesses/{distributorId}/connectedRetailers where status == "accepted"
        const collRef = collection(
          db,
          "businesses",
          distributorId,
          "connectedRetailers"
        );
        const q = query(collRef, where("status", "==", "accepted"));
        const snap = await getDocs(q);

        const rows = [];
        for (const d of snap.docs) {
          const data = d.data() || {};
          const retailerId = data.retailerId || d.id; // use linked retailerId if claimed, else fallback to doc id

          // Hydrate from retailer business profile for nicer cards
          let profile = {};
          try {
            const profSnap = await getDoc(doc(db, "businesses", retailerId));
            if (profSnap.exists()) profile = profSnap.data() || {};
          } catch {}

          rows.push({
            id: retailerId,
            status: data.status || "accepted",
            businessName:
              data.retailerName || profile.businessName || profile.name || "Retailer",
            email: data.retailerEmail || profile.email || "",
            city: data.city || profile.city || "",
            phone: data.retailerPhone || profile.phone || "",
            connectedAt: data.connectedAt || null,
          });
        }
        if (active) setRetailers(rows);
      } catch (e) {
        console.error("Failed to fetch connectedRetailers:", e);
        if (active) setError("Failed to fetch retailers.");
      } finally {
        if (active) setLoading(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [distributorId]);

  // Derive options and filtered list
  const cityOptions = useMemo(() => {
    const set = new Set();
    retailers.forEach(r => {
      if (r.city) set.add(r.city);
    });
    return ["all", ...Array.from(set).sort((a,b)=>a.localeCompare(b))];
  }, [retailers]);

  const normalized = (s="") => s.toString().toLowerCase().trim();
  const filtered = useMemo(() => {
    const q = normalized(queryText);
    return retailers.filter(r => {
      const inCity = cityFilter === "all" || normalized(r.city) === normalized(cityFilter);
      const hay = `${r.businessName} ${r.email} ${r.phone} ${r.city}`.toLowerCase();
      const inQuery = q === "" || hay.includes(q);
      return inCity && inQuery;
    });
  }, [retailers, queryText, cityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  // Compact tile for grid/list (prevents inline settings UI from expanding)
  function CompactRetailerTile({ retailer, onManage }) {
    const initials = (retailer.businessName || retailer.name || "R").split(" ").slice(0,2).map(s => s[0]?.toUpperCase()).join("");
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-sm font-bold">{initials || "R"}</div>
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{retailer.businessName || retailer.name || "Retailer"}</div>
            <div className="text-xs text-white/60 truncate">{retailer.city || "—"} • {retailer.email || retailer.phone || "—"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={retailer.status || "accepted"} />
          <button
            onClick={onManage}
            className="rounded-md px-2.5 py-1.5 text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 shadow"
          >
            Manage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="sticky top-0 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3 mb-4 bg-[#0B0F14]/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur-xl border-b border-white/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Connected Retailers</h2>
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
                className={`px-3 py-2 rounded-l-lg text-sm border ${viewMode==="grid" ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/10 text-white border-white/20 hover:bg-white/15"}`}
                title="Grid view"
              >
                ⬛⬛
              </button>
              <button
                onClick={()=>setViewMode("list")}
                className={`px-3 py-2 rounded-r-lg text-sm border ${viewMode==="list" ? "bg-emerald-500 text-black border-emerald-500" : "bg-white/10 text-white border-white/20 hover:bg-white/15"}`}
                title="List view"
              >
                ☰
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-emerald-400"></div>
          <span className="ml-4 text-white/80">Loading...</span>
        </div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-white/60 text-center py-10">No retailers match your filters.</div>
      ) : (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginated.map((retailer) => (
                <div key={retailer.id} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-emerald-400/40 transition">
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
          <div className="mt-4 flex items-center justify-between text-sm text-white/70">
            <div>Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={()=> setPage(p => Math.max(1, p-1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 disabled:opacity-50 hover:bg-white/15"
              >
                Prev
              </button>
              <span>Page {currentPage}/{totalPages}</span>
              <button
                onClick={()=> setPage(p => Math.min(totalPages, p+1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 disabled:opacity-50 hover:bg-white/15"
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
                    <div className="text-white/60 text-xs">Status: <span className="uppercase">{activeRetailer.status || "accepted"}</span></div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm text-white/60 mb-2">Quick Actions</div>
                    <div className="flex flex-wrap gap-2">
                      <button className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm">Create Order</button>
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
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10" onKeyDown={handleKeyDown} tabIndex={-1}>
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowOrderSettings(false)} />
          <div className="relative w-[95%] max-w-6xl rounded-2xl border border-white/10 bg-[#0B0F14]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div className="text-white font-semibold">Order Settings — Global & Bulk</div>
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