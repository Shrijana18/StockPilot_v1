// src/components/pos/panel/foodIcons.js
// Lightweight built‑in food icon set (SVG strings) + emoji fallbacks.
// You can expand this list anytime without touching the CreateMenu UI.

export const IconTokens = [
  "veg",
  "nonveg",
  "thali",
  "chaat",
  "biryani",
  "pizza",
  "burger",
  "sandwich",
  "fries",
  "tea",
  "coffee",
  "rice",
  "dosa",
  "idli",
  "tandoor",
  "wraps",
  "salads",
  "mains",
  "desserts",
  "drinks",
  "cocktail",
  "mocktail",
  "wings",
  "nachos",
  "noodles",
  "cake",
  "pastry"
];

// Minimal, solid SVGs that inherit currentColor. ViewBox 24 for easy sizing.
export const ICON_SVGS = {
  veg: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>`,
  nonveg: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>`,
  thali: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="12" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/></svg>`,
  chaat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 14h16l-2 4H6l-2-4z"/><path d="M8 10a4 4 0 018 0"/></svg>`,
  biryani: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 12h16"/><path d="M6 16h12"/><path d="M8 8h8"/></svg>`,
  pizza: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l9 18H3L12 3z"/><circle cx="10" cy="14" r="1.2" fill="currentColor"/><circle cx="13.5" cy="11" r="1.2" fill="currentColor"/></svg>`,
  burger: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="7" width="16" height="4" rx="2" fill="currentColor"/><rect x="4" y="13" width="16" height="4" rx="2"/></svg>`,
  sandwich: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 8l8-3 8 3v8l-8 3-8-3z"/><path d="M6 10h12M6 14h12"/></svg>`,
  fries: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 5l1 4M12 4l0 5M16 5l-1 4"/><path d="M5 9h14l-2 10H7L5 9z"/></svg>`,
  tea: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="8" width="12" height="8" rx="3"/><path d="M16 10h2a2 2 0 010 4h-2"/></svg>`,
  coffee: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 8h11v6a4 4 0 01-4 4H9a4 4 0 01-4-4V8z"/><path d="M16 10h2a2 2 0 010 4h-2"/></svg>`,
  rice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 15h16l-2 4H6l-2-4z"/><path d="M8 12a4 4 0 018 0"/></svg>`,
  dosa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12h18"/><path d="M6 12a6 6 0 0012 0"/></svg>`,
  idli: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="6"/></svg>`,
  tandoor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 19a6 6 0 1112 0H6z"/><path d="M12 5v4"/></svg>`,
  wraps: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="6"/></svg>`,
  salads: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="12" r="3"/><circle cx="15" cy="12" r="3"/></svg>`,
  mains: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 8h16v8H4z"/><path d="M4 12h16"/></svg>`,
  desserts: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 14h12l-2 5H8l-2-5z"/></svg>`,
  drinks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 4h12l-2 6H8L6 4z"/><path d="M9 10v8a3 3 0 006 0v-8"/></svg>`,
  cocktail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16l-8 7-8-7z"/><path d="M12 11v7"/></svg>`,
  mocktail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 5h10l-5 6-5-6z"/><path d="M12 11v7"/></svg>`,
  wings: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 12c3-5 11-5 14 0-3 5-11 5-14 0z"/></svg>`,
  nachos: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4l8 14H4L12 4z"/></svg>`,
  noodles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 10h16M6 14h12"/><path d="M8 7v3M12 7v3M16 7v3"/></svg>`,
  cake: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 12h12v6H6z"/><path d="M12 6v3"/></svg>`,
  pastry: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="8" width="14" height="8" rx="2"/></svg>`,
};

export const ICON_EMOJIS = {
  veg: "🥗",
  nonveg: "🍗",
  thali: "🍽️",
  chaat: "🥙",
  biryani: "🍛",
  pizza: "🍕",
  burger: "🍔",
  sandwich: "🥪",
  fries: "🍟",
  tea: "🫖",
  coffee: "☕",
  rice: "🍚",
  dosa: "🥞",
  idli: "🍘",
  tandoor: "🔥",
  wraps: "🌯",
  salads: "🥗",
  mains: "🍽️",
  desserts: "🍰",
  drinks: "🥤",
  cocktail: "🍸",
  mocktail: "🍹",
  wings: "🍗",
  nachos: "🧀",
  noodles: "🍜",
  cake: "🎂",
  pastry: "🧁",
};

export function getIconSVG(token) {
  return ICON_SVGS[token] || "";
}

export function getIconEmoji(token) {
  return ICON_EMOJIS[token] || "❖";
}
