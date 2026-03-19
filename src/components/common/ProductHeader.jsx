import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ProductSwitcher } from "../../pages/POSLandingPage";

/**
 * Shared header for Supply Chain and POS landing pages.
 *
 * Layout:
 *   Row 1 — sticky nav bar: [logo + nav links]  ·····  [CTA buttons]
 *   Row 2 — switcher zone:  centered pill that fades into the page below
 *
 * Props:
 *   active      "supplychain" | "pos"
 *   shrink      bool — compact mode when scrolled
 *   navLinks    [{ label, href }]
 *   scTo / posTo  navigation targets for each tab
 *   cta         ReactNode — right-side buttons
 */
export default function ProductHeader({
  active = "supplychain",
  shrink = false,
  navLinks = [],
  scTo = "/",
  posTo = "/pos-landing",
  cta,
}) {
  return (
    <div className="sticky top-0 z-50 w-full">
      {/* ── Row 1: Nav bar ───────────────────────────────── */}
      <div
        className={`w-full bg-[#020617f2] backdrop-blur-xl border-b border-white/10 transition-all duration-300 ${
          shrink ? "py-2.5 px-5 md:px-10" : "py-3.5 px-5 md:px-10"
        }`}
      >
        <div className="max-w-[1400px] mx-auto flex items-center gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-none select-none group">
            <img
              src="/assets/flyp_logo.png"
              alt="FLYP"
              className={`object-contain transition-all duration-300 ${shrink ? "h-6 w-6" : "h-7 w-7"}`}
              onError={e => { e.target.style.display = "none"; }}
            />
            <span className={`font-black tracking-widest uppercase transition-all duration-300 ${shrink ? "text-[11px]" : "text-xs"} text-white/90 group-hover:text-white`}>
              FLYP
            </span>
          </Link>

          {/* Nav links */}
          {navLinks.length > 0 && (
            <nav className={`hidden lg:flex items-center gap-3 flex-1 transition-all duration-300 ${shrink ? "text-[11px]" : "text-sm"}`}>
              {navLinks.map((link, i) => (
                <React.Fragment key={link.label}>
                  {i > 0 && <span className="text-white/15">•</span>}
                  <a href={link.href} className="text-white/45 hover:text-white transition-colors whitespace-nowrap">
                    {link.label}
                  </a>
                </React.Fragment>
              ))}
            </nav>
          )}
          {!navLinks.length && <div className="flex-1" />}

          {/* CTA */}
          <div className="flex items-center gap-2 ml-auto">{cta}</div>
        </div>
      </div>

      {/* ── Row 2: Switcher bar — fades into page below ──── */}
      <div
        className="w-full flex justify-center"
        style={{
          background: "linear-gradient(to bottom, #020617f2 0%, #020617a0 40%, transparent 100%)",
          paddingTop: shrink ? "8px" : "12px",
          paddingBottom: shrink ? "14px" : "20px",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      >
        <ProductSwitcher active={active} scTo={scTo} posTo={posTo} />
      </div>
    </div>
  );
}
