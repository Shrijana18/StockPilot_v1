import React from "react";

/**
 * WebShell (Desktop/Web shell)
 * Minimal wrapper: no extra header, no extra paddings.
 * Lets pages control their own layout to avoid clashes.
 */
export default function WebShell({ children, className = "", headerContent = null }) {
  return (
    <div className={`min-h-[100dvh] w-full text-white bg-gradient-to-br from-[#0B0F14] via-[#0D1117] to-[#0B0F14] overflow-x-hidden ${className}`}>
      {children}
    </div>
  );
}