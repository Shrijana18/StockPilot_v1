import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function RetailerDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    // fetch data or other side effects
  }, []);

  const navigate = useNavigate();

  return (
    <div className="dashboard-shell">
      <header className="top-bar">
        <button
          type="button"
          onClick={() => navigate("/dashboard", { replace: true })}
          aria-label="Back to Dashboard"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-900 shadow hover:bg-emerald-400 active:scale-[.98] transition z-50 pointer-events-auto"
        >
          Back to Dashboard
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.clear();
            navigate("/dashboard", { replace: true });
          }}
          aria-label="Logout"
          className="ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white shadow hover:bg-red-400 active:scale-[.98] transition z-50 pointer-events-auto"
        >
          Logout
        </button>
      </header>
      {/* rest of the dashboard content */}
    </div>
  );
}