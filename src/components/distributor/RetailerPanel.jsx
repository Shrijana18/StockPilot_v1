import React, { useMemo, useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../../firebase/firebaseConfig";
import RetailerRequests from "./RetailerRequests";
import ManageRetailer from "./ManageRetailers";
import AddRetailerModal from "./AddRetailerModal";
import { useAuth } from "../../context/AuthContext";

/**
 * RetailerPanel.jsx (clean container)
 * --------------------------------------------------------------
 * Purpose: Host exactly two tabs for distributor side
 *   1) Retailer Requests (pending/accepted actions)
 *   2) Manage Retailer (accepted list + future controls)
 *
 * Notes:
 *  - No proforma UI here. That will live inside ManageRetailer later.
 *  - Tabs are synced to URL query param `?tab=` for deep-linking.
 */

function useQueryParamTab(defaultTab = "retailer-requests") {
  const location = useLocation();
  const navigate = useNavigate();

  const currentTab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const t = params.get("tab");
    return t || defaultTab;
  }, [location.search, defaultTab]);

  const setTab = (t) => {
    const params = new URLSearchParams(location.search);
    params.set("tab", t);
    navigate({ search: params.toString() }, { replace: true });
  };

  return [currentTab, setTab];
}

export default function RetailerPanel() {
  const [tab, setTab] = useQueryParamTab("retailer-requests");
  const [openAddRetailer, setOpenAddRetailer] = useState(false);
  const { user, initialized } = useAuth ? useAuth() : { user: null, initialized: true };
  const distributorUid = user?.uid || auth?.currentUser?.uid || null;

  const lastScrollYRef = useRef(0);
  const setTabSafe = (t) => {
    lastScrollYRef.current = window.scrollY || 0;
    setTab(t);
  };
  useLayoutEffect(() => {
    // restore scroll before paint to avoid visible jump
    window.scrollTo({ top: lastScrollYRef.current, left: 0, behavior: "auto" });
  }, [tab]);

  // Open Add Retailer with Cmd/Ctrl + N
  const handleKeyOpen = useCallback((e) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && (e.key === "n" || e.key === "N")) {
      e.preventDefault();
      setOpenAddRetailer(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyOpen);
    return () => window.removeEventListener("keydown", handleKeyOpen);
  }, [handleKeyOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (openAddRetailer) document.body.style.overflow = "hidden";
    else document.body.style.overflow = prev || "";
    return () => { document.body.style.overflow = prev || ""; };
  }, [openAddRetailer]);

  return (
    <div className="p-4 md:p-6 lg:p-8 mx-auto max-w-7xl">
      <style>{`
        .no-scrollbar::-webkit-scrollbar{display:none}
        .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}
      `}</style>
      {/* Header with responsive tabs */}
      <header className="mb-4 md:mb-6 bg-[#0B0F14]/60 backdrop-blur rounded-xl border border-white/10">
        <div className="px-3 py-3 md:px-4 md:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold text-white">Retailers</h1>
            <p className="mt-0.5 text-xs md:text-sm text-gray-300 truncate">Review incoming requests and manage connected retailers.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Retailer panel tabs">
            <button
              id="tab-retailer-requests"
              role="tab"
              aria-selected={tab === "retailer-requests"}
              aria-controls="tab-panel-requests"
              onClick={() => setTabSafe("retailer-requests")}
              className={`px-3 md:px-4 py-2 text-sm rounded-lg border transition ${
                tab === "retailer-requests" ? "bg-emerald-500 text-black border-emerald-400" : "bg-white/5 text-white border-white/10 hover:bg-white/10"
              }`}
            >
              Retailer Requests
            </button>
            <button
              id="tab-manage-retailers"
              role="tab"
              aria-selected={tab === "manage-retailers"}
              aria-controls="tab-panel-manage"
              onClick={() => setTabSafe("manage-retailers")}
              className={`px-3 md:px-4 py-2 text-sm rounded-lg border transition ${
                tab === "manage-retailers" ? "bg-emerald-500 text-black border-emerald-400" : "bg-white/5 text-white border-white/10 hover:bg-white/10"
              }`}
            >
              Manage Retailers
            </button>
          </div>
        </div>
      </header>

      {/* Panels */}
      {tab === "retailer-requests" ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6" role="tabpanel" id="tab-panel-requests">
          <RetailerRequests distributorId={distributorUid} />
        </section>
      ) : null}

      {tab === "manage-retailers" ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6" role="tabpanel" id="tab-panel-manage">
          <ManageRetailer distributorId={distributorUid} />
        </section>
      ) : null}

      {/* Floating Add Retailer button (avoids sticky overlap) */}
      <button
        onClick={() => setOpenAddRetailer(true)}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 md:right-6 h-12 w-12 md:h-14 md:w-14 rounded-full shadow-xl bg-emerald-500 text-black hover:bg-emerald-400 ring-1 ring-emerald-400/40 transition focus:outline-none focus:ring-2 focus:ring-emerald-300"
        aria-label="Add retailer (Cmd/Ctrl + N)"
        title="Add retailer (Cmd/Ctrl + N)"
        aria-haspopup="dialog"
        style={{ zIndex: 60 }}
      >
        <span className="text-xl md:text-2xl leading-none">＋</span>
      </button>

      <AddRetailerModal
        open={openAddRetailer}
        onClose={() => setOpenAddRetailer(false)}
        distributorId={distributorUid}
        useCloudFunction={true}
        uiVariant="centered"
        autofocus
        onCreated={() => {
          // Close modal, then switch tab so the new entry is visible
          setOpenAddRetailer(false);
          setTabSafe("manage-retailers");
        }}
      />
    </div>
  );
}