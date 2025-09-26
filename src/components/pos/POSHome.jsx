import React, { useCallback } from "react";
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

  const handleBack = useCallback(() => {
    // Always go to dashboard to avoid inconsistent history stacks in WebView
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  return (
    <div className="w-full h-full">
      <POSView onBack={handleBack} />
    </div>
  );
}