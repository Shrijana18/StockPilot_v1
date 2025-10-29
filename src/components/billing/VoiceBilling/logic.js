/**
 * logic.js — pure helpers for Voice Billing
 * Keep these functions side‑effect free so they’re easy to test and reuse.
 */

// ------------------------- Sanitizers -------------------------
export function stripUndefinedDeep(input) {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (Array.isArray(input)) {
    const arr = input
      .map((v) => stripUndefinedDeep(v))
      .filter((v) => v !== undefined);
    return arr;
  }
  if (typeof input === "object") {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      const cleaned = stripUndefinedDeep(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return input;
}

export function findUndefinedPaths(obj, base = "") {
  const paths = [];
  const walk = (val, path) => {
    if (val === undefined) paths.push(path || "<root>");
    else if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        val.forEach((v, i) => walk(v, `${path}[${i}]`));
      } else {
        for (const [k, v] of Object.entries(val)) walk(v, path ? `${path}.${k}` : k);
      }
    }
  };
  walk(obj, base);
  return paths;
}

// ------------------------- Similarity -------------------------
/** Token-set similarity using intersection / min(|A|,|B|) — better for short queries like "milk". */
export function similarity(a = "", b = "") {
  if (!a || !b) return 0;
  const tok = (s) => new Set(String(s).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const A = tok(a), B = tok(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

// ------------------------- Phone helpers -------------------------
export function normalizePhone(p = "") {
  return String(p).replace(/[^\d]+/g, "");
}

export function samePhone(a = "", b = "") {
  const A = normalizePhone(a);
  const B = normalizePhone(b);
  return A && B && (A === B || (A.length >= 10 && B.length >= 10 && A.slice(-10) === B.slice(-10)));
}

/** Extract best-effort phone digits from free text (returns only the phone string). */
export function extractPhoneFromUtterance(raw = "") {
  const s = String(raw);
  const groups = s.match(/(\+?\d[\d\s\-]{6,18}\d)/g) || [];
  const digits = groups
    .map((g) => g.replace(/[^\d]/g, ""))
    .filter((d) => d.length >= 7 && d.length <= 13)
    .sort((a, b) => b.length - a.length);
  if (digits.length) return digits[0];
  const allDigits = s.replace(/[^\d]/g, "");
  if (allDigits.length >= 7 && allDigits.length <= 13) return allDigits;
  return "";
}

// ------------------------- Intent parsing -------------------------
/**
 * parseLocalIntent(rawText)
 * Deterministic parser for common cashiering intents.
 * Returns the **old FastBilling shape** for compatibility: { intent, entities }
 */
export function parseLocalIntent(rawText = "") {
  const t = String(rawText).toLowerCase().trim();

  // Enhanced PAYMENT MODE with Indian accent support
  if (/\b(payment|pay|mode|paise|पैसे|payment\s+mode|payment\s+kar|payment\s+karne|payment\s+karo)\b/.test(t)) {
    if (/\bupi|gpay|phonepe|google pay|yupi|यूपीआई|यूपीआई\s+payment\b/.test(t)) return { intent: "set_payment", entities: { mode: "upi" } };
    if (/\bcash|cash\s+payment|cash\b|nagad|नकद|नकद\s+payment|cash\s+kar|cash\s+karne|cash\s+karo\b/.test(t)) return { intent: "set_payment", entities: { mode: "cash" } };
    if (/\b(card|debit|credit\s+card|debit\s+card|कार्ड|card\s+kar|card\s+karne|card\s+karo)\b/.test(t)) return { intent: "set_payment", entities: { mode: "card" } };
  }
  if (/^(payment|pay|mode|paise|पैसे)\s+(upi|cash|card|yupi|nagad|कार्ड)$/.test(t)) {
    const mode = t.split(/\s+/)[1];
    // Normalize mode names
    const normalizedMode = mode === 'yupi' ? 'upi' : mode === 'nagad' ? 'cash' : mode === 'कार्ड' ? 'card' : mode;
    return { intent: "set_payment", entities: { mode: normalizedMode } };
  }

  // SPLIT payment: e.g., "payment split 800 cash 500 upi 200 card"
  if (/\b(payment|pay|mode)\b/.test(t) && /\bsplit\b/.test(t)) {
    const pairs = [...t.matchAll(/\b(\d+(?:\.\d+)?)\s*(cash|upi|card)\b/g)];
    const split = { cash: 0, upi: 0, card: 0 };
    for (const m of pairs) {
      const amt = parseFloat(m[1]);
      const kind = m[2];
      if (Number.isFinite(amt)) {
        if (kind === "cash") split.cash += amt;
        if (kind === "upi") split.upi += amt;
        if (kind === "card") split.card += amt;
      }
    }
    return { intent: "set_payment", entities: { mode: "split", paymentMode: "split", splitPayment: split } };
  }

  // CREDIT payment
  if (/\b(payment|pay|mode)\b/.test(t) && /\bcredit\b/.test(t)) {
    let days;
    const mDays = t.match(/\b(\d{1,3})\s*days?\b/);
    if (mDays) days = Math.max(0, parseInt(mDays[1], 10));
    let dueDate;
    const mDate = t.match(/\bon\s+([0-9]{1,2}[\/\-\s][0-9]{1,2}(?:[\/\-\s][0-9]{2,4})?|\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{2,4})?)\b/);
    if (mDate) dueDate = mDate[1];
    return {
      intent: "set_payment",
      entities: { mode: "credit", paymentMode: "credit", creditDueDays: days, creditDueDate: dueDate },
    };
  }

  // ADVANCE payment
  if (/\b(payment|pay|mode)\b/.test(t) && /\badvance\b/.test(t)) {
    const mAmt = t.match(/\badvance\s+(\d+(?:\.\d+)?)\b/);
    const adv = mAmt ? parseFloat(mAmt[1]) : undefined;
    let dueDate;
    const mDate = t.match(/\bdue\s+on\s+([0-9]{1,2}[\/\-\s][0-9]{1,2}(?:[\/\-\s][0-9]{2,4})?|\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{2,4})?)\b/);
    if (mDate) dueDate = mDate[1];
    return {
      intent: "set_payment",
      entities: { mode: "advance", paymentMode: "advance", advancePaid: Number.isFinite(adv) ? adv : undefined, advanceDueDate: dueDate },
    };
  }

  // INVOICE TYPE
  if (/\b(invoice|bill)\s*(type)?\b/.test(t) || /^type\s+/.test(t)) {
    if (/\bretail\b/.test(t)) return { intent: "set_invoice_type", entities: { type: "Retail" } };
    if (/\btax\b/.test(t)) return { intent: "set_invoice_type", entities: { type: "Tax" } };
    if (/\bproforma\b/.test(t)) return { intent: "set_invoice_type", entities: { type: "Proforma" } };
    if (/\bestimate\b/.test(t)) return { intent: "set_invoice_type", entities: { type: "Estimate" } };
    if (/\bquote\b/.test(t)) return { intent: "set_invoice_type", entities: { type: "Quote" } };
  }

  // Simple invoice type detection (without "invoice" keyword)
  if (/^retail\b/.test(t)) return { intent: "set_invoice_type", entities: { type: "Retail" } };
  if (/^tax\b/.test(t)) return { intent: "set_invoice_type", entities: { type: "Tax" } };
  if (/^proforma\b/.test(t)) return { intent: "set_invoice_type", entities: { type: "Proforma" } };

  // Enhanced CUSTOMER detection with Indian accent support
  if (/\b(customer|client|buyer|ग्राहक|customer\s+kar|customer\s+karne|customer\s+karo|client\s+kar|client\s+karne|client\s+karo)\b/.test(t)) {
    const phoneMatch = t.match(/(\d{10,})/);
    const nameMatch = t.match(/(?:customer|client|buyer|ग्राहक|customer\s+kar|customer\s+karne|customer\s+karo|client\s+kar|client\s+karne|client\s+karo)\s+(\w+)/);
    return { 
      intent: "set_customer", 
      entities: { 
        phone: phoneMatch ? phoneMatch[1] : undefined,
        name: nameMatch ? nameMatch[1] : undefined
      } 
    };
  }

  // Enhanced PRODUCT addition detection with Indian accent support
  if (/\b(add|put|include|dal|डाल|जोड़|add\s+kar|add\s+karne|add\s+karo)\b/.test(t) || 
      (!/\b(payment|invoice|customer|mode|type|gst|payment|pay|mode|invoice|bill|customer|client|buyer)\b/.test(t) && t.length > 2)) {
    const qtyMatch = t.match(/\b(\d+(?:\.\d+)?)\b/);
    const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 1;
    
    // Enhanced product name extraction with Indian accent support
    const productName = t
      .replace(/\b(add|put|include|the|a|an|some|please|plz|dal|डाल|जोड़|add\s+kar|add\s+karne|add\s+karo|kar|karne|karo)\b/g, '')
      .replace(/\b\d+(?:\.\d+)?\b/g, '')
      .replace(/\b(g|kg|ml|l|pcs|piece|pieces|gram|grams|kilo|kilogram|liter|litre|pcs|pieces|units|nos|number|numbers)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (productName && productName.length > 1) {
      return { 
        intent: "add_item", 
        entities: { 
          name: productName,
          productName: productName,
          qty: qty
        } 
      };
    }
  }

  // GST FLAGS & RATE  (emit keys that CreateInvoice/settings expect)
  if (/\bgst\b/.test(t) || /\bcgst|sgst|igst\b/.test(t)) {
    // “enable/include/apply/add/on” -> true, “disable/remove/exclude/off” -> false, else leave undefined
    const wantsOn  = /\b(enable|include|apply|add|on)\b/.test(t);
    const wantsOff = /\b(disable|remove|exclude|off)\b/.test(t);
    const includeFlag = wantsOn ? true : (wantsOff ? false : undefined);

    const hasIGST = /\bigst\b/.test(t);
    const hasCGST = /\bcgst\b/.test(t);
    const hasSGST = /\bsgst\b/.test(t);
    const hasGST  = /\bgst\b/.test(t);

    const getRate = (label) => {
      const m = t.match(new RegExp(`\\b${label}\\b\\s*(\\d{1,3})(?:\\s*%|\\s*percent)?`));
      return m ? Math.max(0, Math.min(100, parseInt(m[1], 10))) : undefined;
    };

    const gstRate  = getRate("gst");
    const cgstRate = getRate("cgst");
    const sgstRate = getRate("sgst");
    const igstRate = getRate("igst");

    const entities = {};

    // IGST path (mutually exclusive with GST/CGST/SGST)
    if (hasIGST) {
      entities.includeIGST = includeFlag !== undefined ? includeFlag : true;
      if (igstRate !== undefined) entities.igstRate = igstRate;
      entities.includeGST   = false;
      entities.includeCGST  = false;
      entities.includeSGST  = false;
    }

    // CGST/SGST path (mutually exclusive with GST/IGST)
    if (hasCGST || hasSGST) {
      const val = includeFlag !== undefined ? includeFlag : true;
      if (hasCGST) entities.includeCGST = val;
      if (hasSGST) entities.includeSGST = val;

      if (cgstRate !== undefined) entities.cgstRate = cgstRate;
      if (sgstRate !== undefined) entities.sgstRate = sgstRate;

      // If user said “GST 18” while talking about CGST/SGST, split it 50/50 as a sensible default
      if ((hasCGST || hasSGST) && cgstRate === undefined && sgstRate === undefined && gstRate !== undefined) {
        const half = Math.round(gstRate / 2);
        if (hasCGST) entities.cgstRate = half;
        if (hasSGST) entities.sgstRate = gstRate - half;
      }

      entities.includeGST  = false;
      entities.includeIGST = false;
    }

    // Plain GST path (mutually exclusive with IGST/CGST/SGST)
    if (!hasIGST && !hasCGST && !hasSGST && hasGST) {
      entities.includeGST = includeFlag !== undefined ? includeFlag : true;
      if (gstRate !== undefined) entities.gstRate = gstRate;
      if (entities.includeGST) {
        entities.includeIGST = false;
        entities.includeCGST = false;
        entities.includeSGST = false;
      }
    }

    // “no gst” / “without gst”
    if (/\b(no|without)\s+gst\b/.test(t)) {
      entities.includeGST  = false;
      entities.includeIGST = false;
      entities.includeCGST = false;
      entities.includeSGST = false;
    }

    // --- Normalize keys for CreateInvoice.mapGstEntitiesToSettings ---
    // expose generic 'rate' when a single rate can be inferred
    if (typeof entities.rate === "undefined") {
      if (typeof entities.gstRate === "number") entities.rate = entities.gstRate;
      else if (typeof entities.igstRate === "number") entities.rate = entities.igstRate;
      else if (typeof entities.cgstRate === "number" && typeof entities.sgstRate === "number") {
        entities.rate = entities.cgstRate + entities.sgstRate;
      }
    }
    // expose booleans igst/cgst/sgst alongside include* flags
    if (typeof entities.includeIGST === "boolean") entities.igst = entities.includeIGST;
    if (typeof entities.includeCGST === "boolean") entities.cgst = entities.includeCGST;
    if (typeof entities.includeSGST === "boolean") entities.sgst = entities.includeSGST;

    return { intent: "set_gst", entities };
  }

  return null;
}
