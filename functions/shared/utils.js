

/**
 * Shared utility helpers for FLYP Cloud Functions
 */
const { GST_RATES, PRICING_MODES, REGEX } = require("./constants");

/** -------------------------
 * Text & String utilities
 * ------------------------- */
function titleCase(str = "") {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
}

function cleanTitle(str = "") {
  if (!str) return "";
  let x = String(str || "")
    .replace(/&amp;/gi, "&")
    .replace(/[™®©]/g, "")
    // Kill common medical-page phrases (1mg/PharmEasy etc.)
    .replace(/\b(View\s*)?(Uses?|Side\s*Effects?|Price\s*(And)?\s*Substitutes?|Substitutes?)\b.*$/gi, "")
    // Drop everything after " | ... "
    .replace(/\s*\|\s*.*$/g, "")
    // Kill classic marketing suffixes after dash or en/em dash
    .replace(/\s*[-–—]\s*(Buy\s*Online|Buy|Shop\s*Online|Shop|Online|Best\s*Price|Price\s*in\s*India|With.*|at.*|Offers?.*|Deals?.*|Reviews?|Ratings?)\b.*$/gi, "")
    // Remove trailing marketing suffixes even without dash
    .replace(/\b(Online|at\s+\w+.*|Price\s*in\s*India|Best\s*Price|With\s+.*|Offers?.*|Deals?.*|Reviews?|Ratings?)\b.*$/gi, "")
    // Remove leading "Order/Buy/Shop"
    .replace(/^\s*(Order|Buy|Shop)\s+/i, "")
    // Remove marketplace/site mentions and any tail after them
    .replace(/\b(Amazon(\.in)?|Flipkart|JioMart|Meesho|BigBasket|Nykaa|Pharm?easy|1mg|Dmart|Reliance\s*Smart|Spencers)\b.*$/ig, "")
    // Collapse spaces
    .replace(/\s+/g, " ")
    .trim();

  // Smart Title Case but keep short acronyms fully uppercased
  const keepCaps = (w) => w.length <= 4 && /^[A-Z0-9]+$/.test(w);
  x = x
    .split(" ")
    .map(w => keepCaps(w) ? w : (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");

  // Prefer trimming right after a complete size phrase (drops SEO tails we missed)
  const sizeCut = x.match(/(.+?\b\d+(?:\.\d+)?\s?(?:ml|l|g|kg|pcs|tablets?|capsules?)\b(?:\s*(?:bottle|jar|tube|strip|sachet|box|pouch|can|carton|pack))?)/i);
  if (sizeCut) x = sizeCut[1].trim();

  // As a last resort, cut at dash/pipe/bullet if still very long
  if (x.length > 90) x = x.split(/[-–—|•]/)[0].trim();

  return x;
}

function canonicalizeName(a = "", b) {
  // Dual signature:
  // - canonicalizeName("Some Product Title")  -> legacy normalize-only
  // - canonicalizeName(brand, title)          -> brand-aware canonicalization
  if (typeof b === "undefined") {
    // Legacy mode: normalize a single title string
    return String(a)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const brand = String(a || "").trim();
  let title = String(b || "").trim();

  if (brand) {
    const reBrand = new RegExp("^" + brand.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&") + "\\s+", "i");
    title = title.replace(reBrand, "");
  }

  title = title.replace(/\s+/g, " ").trim();

  let out = (brand ? `${titleCase(brand)} ` : "") + title;

  // If a size phrase exists, trim after it
  const m = out.match(/(.+?\b\d+(?:\.\d+)?\s?(?:ml|l|g|kg|pcs|tablets?|capsules?)\b(?:\s*(?:bottle|jar|tube|strip|sachet|box|pouch|can|carton|pack))?)/i);
  if (m) out = m[1].trim();

  // Final fallback shorten
  if (out.length > 90) out = out.split(/[-–—|•]/)[0].trim();

  return out;
}

function parseCanonicalUnit(text = "") {
  const s = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();

  // Multi-pack like "2x200ml", "3 x 75 g"
  const multi = s.match(/\b(\d{1,2})\s*[xX]\s*(\d+(?:\.\d+)?)\s*(ml|l|g|kg|pcs|tablets?|capsules?)\b/i);
  if (multi) {
    const count = multi[1];
    const qty = multi[2];
    let u = multi[3].toLowerCase();
    if (u === "l") u = "L";
    return `${count} x ${qty} ${u}`;
  }

  // Single qty + unit like "250 ml", "1 kg", "10 tablets"
  const single = s.match(/\b(\d+(?:\.\d+)?)\s*(ml|l|g|kg|pcs|tablets?|capsules?)\b/i);
  let qtyPart = "";
  if (single) {
    let n = single[1];
    let u = single[2].toLowerCase();
    if (u === "l") u = "L";
    qtyPart = `${n} ${u}`;
  }

  // Container detection
  const containers = ["bottle","jar","pack","packet","sachet","box","tin","can","pouch","tube","carton","bag","strip"];
  const container = (s.match(new RegExp(`\\b(${containers.join("|")})s?\\b`, "i"))?.[1] || "").toLowerCase();

  return [qtyPart, container].filter(Boolean).join(" ").trim();
}
function biasQuery(q = "") {
  const allow = [
    "site:1mg.com","site:pharmeasy.in","site:netmeds.com","site:bigbasket.com","site:blinkit.com",
    "site:amazon.in","site:flipkart.com","site:dmart.in"
  ].join(" OR ");
  const s = String(q || "").trim();
  if (!s) return allow;
  return `${s} (${allow})`;
}

/** -------------------------
 * Numbers, Money, GST
 * ------------------------- */
function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function clampGstRate(rate) {
  const n = toNum(rate) ?? 0;
  if (GST_RATES.includes(n)) return n;
  // snap to nearest allowed
  let best = GST_RATES[0];
  let d = Infinity;
  for (const r of GST_RATES) {
    const dd = Math.abs(r - n);
    if (dd < d) { d = dd; best = r; }
  }
  return best;
}

/**
 * computeMrpAndBase
 * Normalizes (basePrice, mrp) pair from pricing mode + GST.
 * Returns { pricingMode, gstRate, basePrice, mrp, taxAmount }
 */
function computeMrpAndBase({ pricingMode, gstRate, basePrice, mrp }) {
  const mode = pricingMode === PRICING_MODES.BASE_PLUS_GST ? PRICING_MODES.BASE_PLUS_GST : PRICING_MODES.MRP_INCLUSIVE;
  const g = clampGstRate(gstRate);
  let base = toNum(basePrice);
  let m = toNum(mrp);

  if (mode === PRICING_MODES.MRP_INCLUSIVE) {
    if (m != null && base == null) base = +(m / (1 + g / 100)).toFixed(2);
    else if (m == null && base != null) m = +(base * (1 + g / 100)).toFixed(2);
  } else {
    if (base != null && m == null) m = +(base * (1 + g / 100)).toFixed(2);
    else if (base == null && m != null) base = +(m / (1 + g / 100)).toFixed(2);
  }

  const taxAmount = (m != null && base != null) ? +(m - base).toFixed(2) : null;
  return { pricingMode: mode, gstRate: g, basePrice: base ?? null, mrp: m ?? null, taxAmount };
}

function rupee(n) {
  const val = toNum(n);
  if (val == null) return "₹0.00";
  return "₹" + val.toFixed(2);
}

/** -------------------------
 * Validation helpers
 * ------------------------- */
function isValidGstin(v = "") {
  return REGEX.GSTIN.test(String(v).trim());
}
function isValidEmail(v = "") {
  return REGEX.EMAIL.test(String(v).trim());
}
function isValidPhoneIN(v = "") {
  const s = String(v).replace(/\D/g, "");
  return REGEX.PHONE.test(s);
}

/** -------------------------
 * Lightweight HSN / GST quick hints
 * (best-effort mapping for common categories)
 * ------------------------- */
const QUICK_HSN_GST = [
  { match: /milk|curd|butter|ghee|paneer/i, hsn: "0401", gst: 5 },
  { match: /rice|wheat|atta|flour/i, hsn: "1006", gst: 0 },
  { match: /sugar/i, hsn: "1701", gst: 5 },
  { match: /tea/i, hsn: "0902", gst: 5 },
  { match: /coffee/i, hsn: "0901", gst: 5 },
  { match: /soap|shampoo|detergent/i, hsn: "3401", gst: 18 },
  { match: /cosmetic|cream|lotion/i, hsn: "3304", gst: 18 },
  { match: /soft drink|aerated/i, hsn: "2202", gst: 28 },
];

function quickHsnGstHint(name = "", category = "") {
  const s = `${name} ${category}`.trim();
  for (const row of QUICK_HSN_GST) {
    if (row.match.test(s)) return { hsnCode: row.hsn, gstRate: row.gst };
  }
  return { hsnCode: "", gstRate: 0 };
}

/** -------------------------
 * Misc
 * ------------------------- */
function shortId(prefix = "ID") {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${n}`;
}

module.exports = {
  // text
  titleCase,
  cleanTitle,
  canonicalizeName,
  parseCanonicalUnit,

  // numbers & gst
  toNum,
  clampGstRate,
  computeMrpAndBase,
  rupee,

  // validation
  isValidGstin,
  isValidEmail,
  isValidPhoneIN,

  // quick hints
  quickHsnGstHint,

  // misc
  shortId,
  biasQuery,
};