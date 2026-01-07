import React from "react";

/**
 * WebShell (Desktop/Web shell)
 * Minimal wrapper: no extra header, no extra paddings.
 * Lets pages control their own layout to avoid clashes.
 */
export default function WebShell({ children, className = "", headerContent = null }) {
  return (
    <div className={`min-h-[100dvh] w-full text-white bg-gradient-to-b from-[#020617] via-[#050a18] to-[#020617] overflow-x-hidden ${className}`}>
      {children}
    </div>
  );
}