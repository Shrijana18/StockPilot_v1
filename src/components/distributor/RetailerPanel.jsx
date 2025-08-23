import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../../firebase/firebaseConfig";
import RetailerRequests from "./RetailerRequests";
import ManageRetailer from "./ManageRetailers";

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
  const distributorId = auth?.currentUser?.uid || null;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-white">Retailers</h1>
          <p className="mt-1 text-sm text-gray-300">
            Review incoming requests and manage your accepted retailers.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-2">
        <TabButton
          active={tab === "retailer-requests"}
          onClick={() => setTab("retailer-requests")}
        >
          Retailer Requests
        </TabButton>
        <TabButton
          active={tab === "manage-retailers"}
          onClick={() => setTab("manage-retailers")}
        >
          Manage Retailer
        </TabButton>
      </div>

      {/* Panels */}
      {tab === "retailer-requests" ? (
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <RetailerRequests distributorId={distributorId} />
        </section>
      ) : null}

      {tab === "manage-retailers" ? (
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <ManageRetailer distributorId={distributorId} />
        </section>
      ) : null}
    </div>
  );
}