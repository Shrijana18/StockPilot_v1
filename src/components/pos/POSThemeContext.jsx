import React from "react";

// ─── 2 Themes: Light + FLYP (POSBilling signature dark) ──────────────────────
export const THEMES = {
  flyp: {
    id: "flyp",
    label: "FLYP",
    icon: "⚡",
    bg: { background: "linear-gradient(160deg, #071a2b 0%, #0b2944 50%, #071a2b 100%)" },
    auroraBlob1: "rgba(56,189,248,0.18)",
    auroraBlob2: "rgba(16,185,129,0.16)",
    headerBg: "bg-[#071e30]/95 backdrop-blur-2xl border-b border-white/[0.08] shadow-lg shadow-black/20",
    sidebarBg: "bg-[#061728]/90 backdrop-blur-xl border-r border-white/[0.07]",
    contentBg: "bg-transparent",
    cardBg: "bg-white/[0.06] border border-white/[0.1] backdrop-blur-sm shadow-sm",
    textPrimary: "text-white",
    textSub: "text-white/60",
    textMuted: "text-white/40",
    borderSoft: "border-white/[0.09]",
    inputBg: "bg-white/[0.07] border border-white/[0.13] text-white placeholder:text-white/35 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 focus:outline-none",
    navActive: (accent) => ({
      orange:  "bg-gradient-to-r from-orange-500/[0.18] to-amber-500/[0.08] ring-1 ring-inset ring-orange-400/30 text-orange-200 shadow-sm",
      emerald: "bg-gradient-to-r from-emerald-500/[0.18] to-teal-500/[0.08] ring-1 ring-inset ring-emerald-400/30 text-emerald-200 shadow-sm",
      blue:    "bg-gradient-to-r from-blue-500/[0.18] to-cyan-500/[0.08] ring-1 ring-inset ring-blue-400/30 text-blue-200 shadow-sm",
      purple:  "bg-gradient-to-r from-purple-500/[0.18] to-violet-500/[0.08] ring-1 ring-inset ring-purple-400/30 text-purple-200 shadow-sm",
      violet:  "bg-gradient-to-r from-violet-500/[0.18] to-purple-500/[0.08] ring-1 ring-inset ring-violet-400/30 text-violet-200 shadow-sm",
    }[accent] || "bg-gradient-to-r from-emerald-500/[0.18] to-teal-500/[0.08] ring-1 ring-inset ring-emerald-400/30 text-emerald-200"),
    navActiveDot: (accent) => ({
      orange: "bg-orange-400", emerald: "bg-emerald-400", blue: "bg-blue-400",
      purple: "bg-purple-400", violet: "bg-violet-400",
    }[accent] || "bg-emerald-400"),
    navInactive: "text-white/55 hover:text-white/85 hover:bg-white/[0.06]",
    navHover: (accent) => ({
      orange:  "hover:bg-orange-500/[0.08] hover:text-orange-200",
      emerald: "hover:bg-emerald-500/[0.08] hover:text-emerald-200",
      blue:    "hover:bg-blue-500/[0.08] hover:text-blue-200",
      purple:  "hover:bg-purple-500/[0.08] hover:text-purple-200",
      violet:  "hover:bg-violet-500/[0.08] hover:text-violet-200",
    }[accent] || ""),
    tableAvailable: "border-white/[0.1] bg-white/[0.05] hover:bg-emerald-500/[0.08] hover:border-emerald-400/30 shadow-sm hover:shadow-emerald-900/20 transition-all duration-200",
    tableOccupied:  "border-red-400/40 bg-gradient-to-br from-red-500/[0.1] to-orange-500/[0.05] hover:border-red-400/60 hover:from-red-500/[0.14] shadow-sm shadow-red-900/20 transition-all duration-200",
    tableReserved:  "border-amber-400/35 bg-gradient-to-br from-amber-500/[0.09] to-yellow-500/[0.05] hover:border-amber-400/55 hover:from-amber-500/[0.13] shadow-sm shadow-amber-900/15 transition-all duration-200",
    tableCleaning:  "border-white/[0.05] bg-white/[0.02] opacity-40",
    tableNameColor: (isOccupied, isReserved) => isReserved ? "text-amber-300" : isOccupied ? "text-red-300" : "text-white",
    sectionLabel: "text-sky-300/70 uppercase tracking-widest font-bold text-[10px]",
    sectionBar: "bg-gradient-to-r from-sky-400/20 to-transparent",
    sectionCount: "text-white/40 bg-white/[0.06]",
    zonePillActive:   "bg-gradient-to-r from-emerald-500/25 to-teal-500/15 text-emerald-300 border border-emerald-400/35 shadow-sm",
    zonePillInactive: "text-white/50 hover:text-white/80 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.16] transition-all duration-150",
    statusOccupied:  "bg-red-500/15 text-red-300 border border-red-400/25",
    statusPreparing: "bg-blue-500/15 text-blue-300 border border-blue-400/25",
    statusReady:     "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 animate-pulse",
    statusServed:    "bg-purple-500/15 text-purple-300 border border-purple-400/25",
    statusReserved:  "bg-amber-500/15 text-amber-300 border border-amber-400/25",
    statusBar: (isOccupied, isReserved) => isReserved
      ? "bg-gradient-to-r from-amber-400 to-yellow-500"
      : isOccupied ? "bg-gradient-to-r from-red-500 to-rose-400" : null,
    capacityText: "text-white/45",
    walkinCard: "border-white/[0.1] bg-white/[0.05] hover:from-emerald-500/[0.09] hover:to-teal-500/[0.05] hover:border-emerald-400/35 transition-all duration-200",
    emptyIcon: "bg-white/[0.06] border border-white/[0.1]",
    primaryBtn: "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25 transition-all duration-150",
    outlineBtn: "border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/[0.22] text-white/70 hover:text-white transition-all duration-150",
    themeBtn: "bg-white/[0.07] border border-white/[0.12]",
    themeBtnActive: "bg-white/[0.18] shadow-sm",
    themeBtnText: "text-white/55 hover:text-white",
    iconBoxBg: "bg-gradient-to-br from-emerald-500/20 to-teal-400/10 border border-emerald-400/20",
    backBtn: "bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] hover:border-white/[0.2] text-white/60 hover:text-white transition-all duration-150",
    divider: "bg-white/[0.09]",
    statusAvailableDot: "bg-emerald-400 shadow-sm shadow-emerald-400/50",
    statusOccupiedDot:  "bg-red-400 shadow-sm shadow-red-400/50",
    editBtn: "bg-white/[0.08] hover:bg-white/[0.15] text-white/55 transition-all duration-150",
    footerBrand: "text-white/50 tracking-widest uppercase",
    landingCardHover: "border-white/[0.1] bg-white/[0.05] hover:border-emerald-400/35 hover:bg-emerald-500/[0.07]",
    landingCardHoverRest: "border-white/[0.1] bg-white/[0.05] hover:border-teal-400/35 hover:bg-teal-500/[0.07]",
    // Modal / overlay styles (used by sub-panels)
    modalBg: "bg-[#071e30]/97 border border-white/[0.12] backdrop-blur-xl",
    overlayBg: "bg-black/55 backdrop-blur-md",
    kitchenCardNew: "border-blue-400/30 bg-gradient-to-br from-blue-500/[0.09] to-cyan-400/[0.04]",
    kitchenCardPrep: "border-amber-400/30 bg-gradient-to-br from-amber-500/[0.09] to-orange-400/[0.04]",
    kitchenCardReady: "border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.09] to-teal-400/[0.04]",
    tagBg: "bg-white/[0.08] text-white/65",
    mutedBg: "bg-white/[0.05]",
  },

  light: {
    id: "light",
    label: "Light",
    icon: "☀️",
    bg: { background: "#f1f5f9" },
    auroraBlob1: "rgba(251,146,60,0.04)",
    auroraBlob2: "rgba(16,185,129,0.04)",
    headerBg: "bg-white/97 backdrop-blur-2xl border-b border-gray-200 shadow-sm",
    sidebarBg: "bg-white border-r border-gray-200",
    contentBg: "bg-transparent",
    cardBg: "bg-white border border-gray-200 shadow-sm",
    textPrimary: "text-gray-900",
    textSub: "text-gray-500",
    textMuted: "text-gray-400",
    borderSoft: "border-gray-200",
    inputBg: "bg-gray-50 border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none",
    navActive: (accent) => ({
      orange:  "bg-orange-50 border-l-2 border-orange-500 text-orange-700 shadow-sm",
      emerald: "bg-emerald-50 border-l-2 border-emerald-500 text-emerald-700 shadow-sm",
      blue:    "bg-blue-50 border-l-2 border-blue-500 text-blue-700 shadow-sm",
      purple:  "bg-purple-50 border-l-2 border-purple-500 text-purple-700 shadow-sm",
      violet:  "bg-violet-50 border-l-2 border-violet-500 text-violet-700 shadow-sm",
    }[accent] || "bg-orange-50 border-l-2 border-orange-500 text-orange-700"),
    navActiveDot: (accent) => ({
      orange: "bg-orange-500", emerald: "bg-emerald-500", blue: "bg-blue-500",
      purple: "bg-purple-500", violet: "bg-violet-500",
    }[accent] || "bg-orange-500"),
    navInactive: "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
    navHover: () => "",
    tableAvailable: "border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 shadow-sm hover:shadow-emerald-100",
    tableOccupied:  "border-red-200 bg-red-50 hover:border-red-300 shadow-sm shadow-red-100",
    tableReserved:  "border-amber-200 bg-amber-50 hover:border-amber-300 shadow-sm shadow-amber-100",
    tableCleaning:  "border-gray-200 bg-gray-100 opacity-60",
    tableNameColor: (isOccupied, isReserved) => isReserved ? "text-amber-700" : isOccupied ? "text-red-700" : "text-gray-900",
    sectionLabel: "text-gray-500 uppercase tracking-widest font-bold",
    sectionBar: "bg-gradient-to-r from-gray-300 to-transparent",
    sectionCount: "text-gray-500 bg-gray-100",
    zonePillActive:   "bg-orange-100 text-orange-700 border border-orange-300 shadow-sm",
    zonePillInactive: "text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-200",
    statusOccupied:  "bg-orange-100 text-orange-700 border border-orange-200",
    statusPreparing: "bg-blue-100 text-blue-700 border border-blue-200",
    statusReady:     "bg-emerald-100 text-emerald-700 border border-emerald-200 animate-pulse",
    statusServed:    "bg-purple-100 text-purple-700 border border-purple-200",
    statusReserved:  "bg-amber-100 text-amber-700 border border-amber-200",
    statusBar: (isOccupied, isReserved) => isReserved
      ? "bg-gradient-to-r from-amber-400 to-yellow-500"
      : isOccupied ? "bg-gradient-to-r from-red-400 to-orange-400" : null,
    capacityText: "text-gray-500",
    walkinCard: "border-gray-200 bg-white hover:bg-orange-50 hover:border-orange-300 shadow-sm",
    emptyIcon: "bg-gray-100 border border-gray-200",
    primaryBtn: "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-sm shadow-emerald-200",
    outlineBtn: "border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 hover:border-gray-400",
    themeBtn: "bg-gray-100 border border-gray-200",
    themeBtnActive: "bg-white border-gray-400 shadow-sm",
    themeBtnText: "text-gray-500 hover:text-gray-900",
    iconBoxBg: "bg-gradient-to-br from-orange-100 to-amber-50 border border-orange-200",
    backBtn: "bg-gray-100 hover:bg-gray-200 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900",
    divider: "bg-gray-200",
    statusAvailableDot: "bg-emerald-500",
    statusOccupiedDot:  "bg-red-500",
    editBtn: "bg-gray-100 hover:bg-gray-200 text-gray-500",
    footerBrand: "text-gray-500 tracking-widest uppercase",
    landingCardHover: "border-gray-200 bg-white hover:border-emerald-400 hover:bg-emerald-50",
    landingCardHoverRest: "border-gray-200 bg-white hover:border-orange-400 hover:bg-orange-50",
    // Modal / overlay styles
    modalBg: "bg-white border border-gray-200",
    overlayBg: "bg-black/40 backdrop-blur-sm",
    kitchenCardNew: "border-blue-200 bg-blue-50",
    kitchenCardPrep: "border-amber-200 bg-amber-50",
    kitchenCardReady: "border-emerald-200 bg-emerald-50",
    tagBg: "bg-gray-100 text-gray-600",
    mutedBg: "bg-gray-50",
  },
};

export const POSThemeContext = React.createContext({ theme: "flyp", setTheme: () => {}, tc: THEMES.flyp });

export function POSThemeProvider({ children }) {
  const [theme, setThemeState] = React.useState(() => {
    try {
      const saved = localStorage.getItem("posTheme");
      return (saved === "light" || saved === "flyp") ? saved : "flyp";
    } catch { return "flyp"; }
  });
  const setTheme = (t) => {
    setThemeState(t);
    try { localStorage.setItem("posTheme", t); } catch {}
  };
  return (
    <POSThemeContext.Provider value={{ theme, setTheme, tc: THEMES[theme] || THEMES.flyp }}>
      {children}
    </POSThemeContext.Provider>
  );
}

export const usePOSTheme = () => React.useContext(POSThemeContext);
