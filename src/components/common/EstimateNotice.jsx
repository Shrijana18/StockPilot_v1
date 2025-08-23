import React from "react";

/**
 * EstimateNotice
 * A small reusable banner to inform users that current totals are estimates
 * (pre-tax, pre-charges). Pure UI; no data writes.
 *
 * Props:
 * - className (optional): extra Tailwind classes for outer wrapper.
 */
export default function EstimateNotice({ className = "" }) {
  return (
    <div
      className={
        "rounded-xl border border-amber-300/40 bg-amber-50/70 text-amber-900 p-3 md:p-4 text-sm md:text-[15px] " +
        className
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5 mt-0.5 opacity-80"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M10.29 3.86a2.25 2.25 0 0 1 3.42 0l7.133 8.4c1.24 1.46.187 3.74-1.71 3.74H4.867c-1.897 0-2.95-2.28-1.71-3.74l7.133-8.4zM12 9.75a.75.75 0 0 0-.75.75v4.5a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75zm0 8.25a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <div className="font-medium">Estimate shown (pre‑tax & pre‑charges)</div>
          <p className="opacity-80 leading-relaxed">
            Distributor may add <b>GST</b>, <b>delivery</b>, <b>packing</b>, <b>insurance</b>, or
            <b> discounts</b> in the <b>Proforma</b>. You’ll receive a final amount to review and
            approve before dispatch.
          </p>
        </div>
      </div>
    </div>
  );
}
