import React from "react";
import { useNavigate } from "react-router-dom";
import POSView from "./POSView";

/**
 * POSHome
 * Shell/landing for POS mode. Owns:
 *  - Page header (title + controls)
 *  - Panel open/close state (query param aware: ?posPanel=1)
 *  - Back navigation (to dashboard or previous page)
 *  - Renders POSView (main workspace)
 *  - Renders POSPanel (overlay container)
 *
 * NOTE: POSView is kept clean and does not control the panel.
 */
export default function POSHome() {
  const navigate = useNavigate();

  const handleBack = () => {
    // Prefer going back if possible; fallback to retailer dashboard
    if (window.history.length > 1) navigate(-1);
    else navigate("/dashboard");
  };

  return (
    <div className="w-full h-full">
      <POSView onBack={handleBack} />
    </div>
  );
}