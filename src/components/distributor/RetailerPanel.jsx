import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../../firebase/firebaseConfig";
import RetailerRequests from "./RetailerRequests";
import ManageRetailer from "./ManageRetailers";
import AddRetailerModal from "./AddRetailerModal";

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

const TabButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
      active
        ? "bg-indigo-600 text-white shadow"
        : "bg-white/5 text-gray-200 hover:bg-white/10"
    }`}
  >
    {children}
  </button>
);

export default function RetailerPanel() {
  const [tab, setTab] = useQueryParamTab("retailer-requests");
  const [openAddRetailer, setOpenAddRetailer] = useState(false);
  const distributorId = auth?.currentUser?.uid || null;

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
      <div className="sticky top-[56px] z-10 bg-transparent">
        <header className="mb-3 flex items-center justify-between bg-[#0B0F14]/60 backdrop-blur px-3 py-3 rounded-xl border border-white/10">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-white">Retailers</h1>
            <p className="mt-0.5 text-sm text-gray-300">Review incoming requests and manage accepted retailers.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpenAddRetailer(true)}
              className="rounded-lg px-3 py-2 text-sm font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition shadow"
              aria-label="Add retailer (Cmd/Ctrl + N)"
              title="Add retailer (Cmd/Ctrl + N)"
            >
              + Add Retailer
            </button>
          </div>
        </header>

        {/* Tabs: segmented control */}
        <div className="mb-5">
          <div className="inline-flex rounded-lg border border-white/10 bg-white/5 overflow-hidden">
            <button
              onClick={() => setTab("retailer-requests")}
              className={`px-4 py-2 text-sm font-medium transition ${
                tab === "retailer-requests"
                  ? "bg-emerald-500 text-black"
                  : "text-white hover:bg-white/10"
              }`}
            >
              Retailer Requests
            </button>
            <button
              onClick={() => setTab("manage-retailers")}
              className={`px-4 py-2 text-sm font-medium transition border-l border-white/10 ${
                tab === "manage-retailers"
                  ? "bg-emerald-500 text-black"
                  : "text-white hover:bg-white/10"
              }`}
            >
              Manage Retailer
            </button>
          </div>
        </div>
      </div>


      {/* Panels */}
      {tab === "retailer-requests" ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6">
          <RetailerRequests distributorId={distributorId} />
        </section>
      ) : null}

      {tab === "manage-retailers" ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6">
          <ManageRetailer distributorId={distributorId} />
        </section>
      ) : null}

      <AddRetailerModal
        open={openAddRetailer}
        onClose={() => setOpenAddRetailer(false)}
        distributorId={distributorId}
        useCloudFunction={true}
        uiVariant="centered"
        autofocus
        onCreated={() => {
          // Close modal, then switch tab so the new entry is visible
          setOpenAddRetailer(false);
          setTab("manage-retailers");
        }}
      />
    </div>
  );
}