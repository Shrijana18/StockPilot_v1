import React, { useEffect, useState, useRef } from "react";
import useEnhancedVoiceCapture from "../../../hooks/useEnhancedVoiceCapture";
import { db } from "../../../firebase/firebaseConfig";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { toast } from "react-toastify";

import InvoicePreview from "../InvoicePreview";
import InvoiceSettings from "../InvoiceSettings";

// New split files
import VoiceHUD from "./VoiceHUD";
import CartView from "./CartView";
import { SuggestionPanel, CustomerCard, SplitPaymentModal, CreditTermsModal } from "./Panels";
import {
  parseLocalIntent,
  similarity,
  normalizePhone,
  extractPhoneFromUtterance,
  samePhone,
  stripUndefinedDeep,
  findUndefinedPaths,
} from "./logic";
import { enhancedProductMatcher } from "../../../utils/enhancedProductMatcher";
import { VoiceErrorHandler, ERROR_TYPES } from "../../../utils/voiceErrorHandler";

// Local-only tiny helpers

const fmtNow = () => new Date().toISOString();
const genCustId = () => `CUST-${(Date.now() % 100000).toString().padStart(4, "0")}`;

// Helper: Coerce a value to a finite number or fallback
function coerceNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Helper: Normalize GST entities to mutually exclusive flags and rates
function normalizeGstEntities(entities, current) {
  // Accepts loose shapes: {type:"igst", rate:18}, {igst:true, rate:18}, {rate:18}, etc.
  const e = entities || {};
  const c = current || {};
  // Read type/flags
  let type =
    (typeof e.type === "string" ? e.type : undefined) ||
    (e.igst ? "igst" : e.cgst || e.sgst ? "cgst_sgst" : e.gst ? "gst" : undefined);
  if (!type) {
    // Try from current
    if (c.includeIGST) type = "igst";
    else if (c.includeCGST || c.includeSGST) type = "cgst_sgst";
    else if (c.includeGST) type = "gst";
  }
  type = String(type || "").toLowerCase();
  // Determine active mode
  let mode;
  if (type === "igst" || e.igst || e.includeIGST) mode = "igst";
  else if (type === "cgst_sgst" || e.cgst || e.sgst || e.includeCGST || e.includeSGST) mode = "cgst_sgst";
  else mode = "gst";

  // Find rate
  let rate = undefined;
  if (typeof e.rate !== "undefined") rate = e.rate;
  else if (mode === "igst" && typeof e.igstRate !== "undefined") rate = e.igstRate;
  else if (mode === "cgst_sgst" && typeof e.cgstRate !== "undefined") rate = e.cgstRate;
  else if (mode === "gst" && typeof e.gstRate !== "undefined") rate = e.gstRate;
  else if (mode === "igst" && typeof c.igstRate !== "undefined") rate = c.igstRate;
  else if (mode === "cgst_sgst" && typeof c.cgstRate !== "undefined") rate = c.cgstRate;
  else if (mode === "gst" && typeof c.gstRate !== "undefined") rate = c.gstRate;
  // Fallback: if only rate is given, use current mode if any
  if (typeof rate === "undefined" && typeof e.rate !== "undefined") rate = e.rate;
  // Coerce to [0, 100]
  rate = coerceNumber(rate, undefined);
  if (!(rate >= 0 && rate <= 100)) rate = undefined;

  // Compose output
  if (mode === "igst") {
    return {
      includeIGST: true,
      includeCGST: false,
      includeSGST: false,
      includeGST: false,
      igstRate: rate != null ? rate : 18,
      gstRate: 9,
      cgstRate: 9,
      sgstRate: 9,
      mode: "igst",
      rate: rate != null ? rate : 18,
    };
  }
  if (mode === "cgst_sgst") {
    return {
      includeIGST: false,
      includeCGST: true,
      includeSGST: true,
      includeGST: false,
      igstRate: 18,
      gstRate: 9,
      cgstRate: rate != null ? rate : 9,
      sgstRate: rate != null ? rate : 9,
      mode: "cgst_sgst",
      rate: rate != null ? rate : 9,
    };
  }
  // Generic GST
  return {
    includeIGST: false,
    includeCGST: false,
    includeSGST: false,
    includeGST: true,
    igstRate: 18,
    gstRate: rate != null ? rate : 9,
    cgstRate: 9,
    sgstRate: 9,
    mode: "gst",
    rate: rate != null ? rate : 9,
  };

}

// Helper: Coerce value to GST rate (extract number from string, allow number, else NaN)
function toRate(v) {
  if (v == null) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : NaN;
}

// Helper to extract GST rate from a row with robust fallbacks
function extractGstRate(row = {}) {
  const fromTags = () => {
    const txt = Array.isArray(row.tags) ? row.tags.join(" ") : String(row.tags || "");
    return toRate(txt);
  };
  const candidates = [
    row.gstRate,
    row.inlineGstRate,
    row.normalized?.effectiveRate,
    row.normalized?.gstRate,
    row.product?.gstRate,
    row.product?.gst,
    row.meta?.gstRate,
    row.meta?.gst,
    fromTags()
  ];
  for (const c of candidates) {
    const r = toRate(c);
    if (Number.isFinite(r) && r >= 0 && r <= 100) return r;
  }
  return 0;
}

// Ensure each cart line we save has a stable, human-friendly description
// by enriching with inventory data when the host cart only includes SKU.
function enrichCartLine(row, inventory) {
  const r = row || {};
  const inv = Array.isArray(inventory) ? inventory : [];

  // Try to resolve a display name using multiple fallbacks
  let name =
    r.displayName ||
    r.productName ||
    r.name ||
    (r.product && (r.product.productName || r.product.name)) ||
    r.title ||
    r.itemName ||
    r.label ||
    "";

  if (!name && r.sku) {
    const hit = inv.find(
      (p) => String(p.sku || "").toLowerCase() === String(r.sku).toLowerCase()
    );
    if (hit) name = hit.productName || hit.name || name;
  }

  const qty = Number(r.qty ?? r.quantity ?? r.q ?? 1) || 1;
  const price = Number(r.unitPrice ?? r.price ?? r.rate ?? r.mrp ?? 0) || 0;

  let discountPercent = r.discountPct ?? r.discount_percent;
  let discountAmount = r.discountAmount ?? r.discount_value ?? r.discountInRs;
  if (discountPercent == null && discountAmount == null) {
    if (r.discountType === "percent") {
      discountPercent = r.discount;
    } else if (r.discountType === "amount") {
      discountAmount = r.discount;
    } else if (r.discount != null) {
      const d = Number(r.discount);
      if (Number.isFinite(d)) {
        if (d >= 0 && d <= 100) discountPercent = d; else discountAmount = d;
      }
    }
  }

  let subtotal = Number(r.subtotal ?? r.total);
  if (!Number.isFinite(subtotal)) {
    const base = qty * price;
    if (Number.isFinite(Number(discountAmount)) && Number(discountAmount) > 0) {
      subtotal = Math.max(0, base - Number(discountAmount));
    } else if (Number.isFinite(Number(discountPercent)) && Number(discountPercent) > 0) {
      subtotal = Math.max(0, base * (1 - Number(discountPercent) / 100));
    } else {
      subtotal = base;
    }
  }

  // --- GST context passthrough (parity with Manual Billing) ---
  const gstRate = extractGstRate(r);
  const pricingMode = r.pricingMode || (r.mode && String(r.mode).toUpperCase().includes("MRP") ? "MRP_INCLUSIVE" : undefined) || "BASE_PLUS_GST";

  return {
    // keep any host identifiers intact
    cartLineId: r.cartLineId,
    id: r.id,
    sku: r.sku || "",

    // enriched presentation fields used by ViewInvoice / CreateInvoice
    name: name || "—",
    productName: name || r.productName || r.name || undefined,
    brand: r.brand || (r.product && r.product.brand) || undefined,
    category: r.category || r.cat || (r.product && r.product.category) || undefined,
    unit: r.unit || r.packSize || (r.product && r.product.unit) || undefined,

    // numeric fields
    qty,
    unitPrice: price,
    price, // keep both for compatibility
    discountPct: Number.isFinite(Number(discountPercent)) ? Number(discountPercent) : undefined,
    discountAmount: Number.isFinite(Number(discountAmount)) ? Number(discountAmount) : undefined,
    subtotal,
    // common aliases used by manual billing / viewers
    quantity: qty,
    total: subtotal,
    // GST passthrough fields
    gstRate,
    pricingMode,
    // Full GST context (match manual billing)
    includeGST: true,
    includeCGST: true,
    includeSGST: true,
    includeIGST: false,
    cgstRate: Math.round(gstRate/2),
    sgstRate: Math.floor(gstRate/2),
    igstRate: gstRate,
    // --- Add tax fields for InvoicePreview compatibility ---
    taxAmount: gstRate ? Math.round((subtotal * gstRate) / 100) : 0,
    cgst: gstRate ? Math.round((subtotal * (gstRate/2)) / 100) : 0,
    sgst: gstRate ? Math.round((subtotal * (gstRate/2)) / 100) : 0,
    igst: 0,
  };
}

export default function FastBillingMode({
  onExit,
  actions, // see integration notes in earlier iterations
  fallbackToWhisper, // kept for compat
  whisperEndpoint, // kept for compat
}) {
  // Chips & activity
  const [chips, setChips] = useState([]); // [{id,text,type,action?}]
  const [actionLog, setActionLog] = useState([]); // [{id, text, type, ts}]

  // Inventory & transcript history
  const [inventoryData, setInventoryData] = useState([]);
  const [history, setHistory] = useState([]);

  // Suggestions (modal)
  const [suggestions, setSuggestions] = useState([]); // [{key,displayName,unit,brand,sku,price,qty,add}]
  const [suggestTitle, setSuggestTitle] = useState("Did you mean…?");

  // Customers
  const [customers, setCustomers] = useState([]);
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [pendingCustomerDraft, setPendingCustomerDraft] = useState(null);

  // Enhanced voice capture with error handling
  const errorHandler = useRef(new VoiceErrorHandler({
    onError: (errorLog) => {
      console.error('Voice Error:', errorLog);
      toast.error(`Voice error: ${errorLog.message}`);
    },
    onRecovery: (errorType, retryCount, config) => {
      console.log(`Recovering from ${errorType}, attempt ${retryCount}`);
      toast.info(`Retrying... (${retryCount}/${config.maxRetries})`);
    },
    onFallback: (fallbackType) => {
      console.log(`Switching to ${fallbackType}`);
      toast.info(`Switching to ${fallbackType}...`);
    },
  }));

  const speech = useEnhancedVoiceCapture({
    autoStopSilenceMs: 2000,
    onFinalize: (text) => {
      console.log('Voice final transcript:', text);
      applyTranscript(text);
    },
    onPartial: () => {},
    onError: (error) => {
      const errorResult = errorHandler.current.handleError(error, { context: 'voice_capture' });
      if (errorResult.recovery === 'USER_INTERVENTION') {
        toast.error(errorResult.message);
      }
    },
    onStatusChange: (status) => {
      console.log('Voice status changed:', status);
    },
    enableWebSocket: true,
    enableWebSpeech: true,
    language: 'en-IN',
  });

  const pausedHook = !!speech?.isPaused;
  const listeningHook = speech?.isListening && !pausedHook;

  // Auto-stop UX
  const wasListeningRef = useRef(false);
  const [autoStopped, setAutoStopped] = useState(false);
  useEffect(() => {
    if (listeningHook) {
      wasListeningRef.current = true;
      setAutoStopped(false);
    } else {
      if (wasListeningRef.current && !pausedHook) setAutoStopped(true);
      wasListeningRef.current = false;
    }
  }, [listeningHook, pausedHook]);
  useEffect(() => {
    if (autoStopped) pushChip("Auto-stopped (silence)", "info");
  }, [autoStopped]);

  // Totals animation
  const [animatedTotal, setAnimatedTotal] = useState(0);
  const animationRef = useRef();

  // Preview & settings toggles
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Quick help (voice commands)
  const [showHelp, setShowHelp] = useState(false);

  // Payment/invoice local mirrors from voice
  const [voicePaymentMode, setVoicePaymentMode] = useState("");
  const [voiceInvoiceType, setVoiceInvoiceType] = useState("");
  const [voicePaymentExtras, setVoicePaymentExtras] = useState({});
  // Parser health – simple circuit breaker to avoid noisy 400s and keep UX smooth
  const parserFailuresRef = useRef(0);
  const parserDisabledUntilRef = useRef(0);
  const parserLastNoticeRef = useRef(0);

  // 👉 Local mirror for tax flags/rates so preview updates instantly
  const [localSettings, setLocalSettings] = useState({});
  function applyGstBoth(flags) {
    // push changes to host and keep a local mirror
    try {
      safe.setGSTFlags?.(flags);
    } catch {}
    setLocalSettings((prev) => ({ ...prev, ...(flags || {}) }));
  }

  // Split/Credit modals
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitDraft, setSplitDraft] = useState({ cash: 0, upi: 0, card: 0 });
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditDraft, setCreditDraft] = useState({ days: "", date: "" });

  // Cart line local UI state
  const [discountModes, setDiscountModes] = useState({}); // { [rowKey]: 'pct' | 'amt' }
  const [discountDrafts, setDiscountDrafts] = useState({}); // { [rowKey]: string }
  const [shadowQtys, setShadowQtys] = useState({}); // { [rowKey]: number }

  // Derived config
  const derivedPaymentMode =
    voicePaymentMode ||
    actions?.invoiceConfig?.paymentMode ||
    actions?.totals?.paymentMode ||
    "";

  const canonicalInvoiceType = (t = "") => {
    const s = String(t).trim().toLowerCase();
    if (s === "retail") return "Retail";
    if (s === "tax") return "Tax";
    if (s === "proforma") return "Proforma";
    if (s === "estimate") return "Estimate";
    if (s === "quote") return "Quote";
    return t || "";
  };
  const derivedInvoiceType = canonicalInvoiceType(
    voiceInvoiceType ||
      actions?.invoiceConfig?.invoiceType ||
      actions?.totals?.invoiceConfig?.invoiceType ||
      ""
  );

  // Guarded host actions
  const safe = {
    addItemByQuery: (p) => actions?.addItemByQuery?.(p),
    updateQty: (p) => actions?.updateQty?.(p),
    removeItemByName: (n) => actions?.removeItemByName?.(n),
    setCustomerByText: (p) => actions?.setCustomerByText?.(p),
    setCharge: (k, a) => actions?.setCharge?.(k, a),
    setInvoiceType: (t) => actions?.setInvoiceType?.(t),
    setGSTFlags: (p) => actions?.setGSTFlags?.(p),
    setPayment: (p) => actions?.setPayment?.(p),
    saveInvoice: (p) => actions?.saveInvoice?.(p),
    undo: () => actions?.undo?.(),
    canUndo: !!actions?.canUndo,
    cart: actions?.cart || [],
    totals: actions?.totals || { grandTotal: 0 },
  };

  // --- Resolve host settings (GST flags & rates, invoice type & payment mode) ---
  function getHostSettings() {
    const s1 = actions?.invoiceConfig || {};
    const s2 = actions?.totals?.invoiceConfig || {};
    const s3 = actions?.settings || {};
    const s4 = typeof actions?.getSettings === "function" ? (actions.getSettings() || {}) : {};
    return { ...s1, ...s2, ...s3, ...s4 };
  }

  // Load products once
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const userId = getAuth()?.currentUser?.uid;
        if (!userId) return;
        const snapshot = await getDocs(collection(db, "businesses", userId, "products"));
        const items = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            name: data.productName?.toLowerCase?.() || "",
            tags: [data.productName, data.brand, data.sku, data.category]
              .filter(Boolean)
              .map((x) => String(x).toLowerCase()),
          };
        });
        setInventoryData(items);
        try {
          pushChip(`Inventory loaded (${items.length})`, "info");
        } catch {}
      } catch (err) {
        console.error("Failed to load inventory:", err);
      }
    };
    fetchInventory();
  }, []);

  // Load customers once
  useEffect(() => {
    (async () => {
      try {
        const uid = getAuth()?.currentUser?.uid;
        if (!uid) return;
        const snap = await getDocs(collection(db, "businesses", uid, "customers"));
        const rows = snap.docs.map((d) => {
          const c = d.data();
          return {
            id: String(c.id || d.id || "").trim(),
            custId: String(c.custId || d.id || "").trim(),
            name: String(c.name || "").trim(),
            phone: String(c.phone || "").trim(),
            email: String(c.email || "").trim(),
            address: String(c.address || "").trim(),
            createdAt: String(c.createdAt || "").trim(),
            updatedAt: String(c.updatedAt || "").trim(),
            _needle: `${c.name || ""} ${c.phone || ""} ${c.email || ""} ${c.address || ""}`.toLowerCase(),
          };
        });
        setCustomers(rows);
      } catch (e) {
        console.error("Failed to load customers:", e);
      }
    })();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        speech?.stop?.();
      } catch {}
      try {
        speech?.clearSegments?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop mic on external event
  useEffect(() => {
    const handler = () => {
      try {
        speech?.stop?.();
      } catch {}
      try {
        speech?.clearFinalTranscript?.();
        speech?.clearSegments?.();
      } catch {}
    };
    window.addEventListener("fastBilling:stopMic", handler);
    return () => window.removeEventListener("fastBilling:stopMic", handler);
  }, [speech]);

  // Process final transcript
  useEffect(() => {
    if (pausedHook) return;
    if (!speech?.finalTranscript) return;
    applyTranscript(speech.finalTranscript);
  }, [speech?.finalTranscript, pausedHook]); // cleared inside applyTranscript

  // Voice-product resolved event
  useEffect(() => {
    const handler = (e) => {
      const resolved = e.detail;
      if (!resolved) return;
      const { name, sku, qty } = resolved;
      if (name && qty) {
        safe.addItemByQuery?.({ name, sku, qty });
        pushChip(`+ ${qty} × ${name}`, "ok");
      } else {
        pushChip("Didn't find product", "warn");
      }
    };
    window.addEventListener("voice-product-resolved", handler);
    return () => window.removeEventListener("voice-product-resolved", handler);
  }, []);

  // Keyboard picks for suggestions
  useEffect(() => {
    const onKey = (e) => {
      if (!suggestions.length) return;
      if (e.key === "Escape") {
        e.preventDefault();
        clearSuggestions();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handlePick(0);
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < suggestions.length) {
          e.preventDefault();
          handlePick(idx);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [suggestions]);

  function pushChip(text, type = "info", action = null) {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}-${text}`;
    const entry = { id, text, type, action, ts: Date.now() };
    setChips((prev) => [entry, ...prev].slice(0, 10));
    setActionLog((prev) => [entry, ...prev].slice(0, 30));
  }

  function clearSuggestions() {
    setSuggestions([]);
    setSuggestTitle("Did you mean…?");
  }

  function showSuggestions(title, items, qty) {
    const mapped = items.map((opt, i) => ({
      key: `${opt.sku || "nosku"}-${opt.id || i}`,
      displayName: opt.productName || opt.name || "—",
      unit: opt.unit || opt.packSize || "",
      brand: opt.brand || "",
      sku: opt.sku || "",
      price:
        typeof opt.price === "number"
          ? opt.price
          : typeof opt.mrp === "number"
          ? opt.mrp
          : undefined,
      qty,
      add: () => {
        clearSuggestions();
        const q = Number.isFinite(Number(qty)) ? Number(qty) : 1;
        safe.addItemByQuery?.({
          productName: opt.productName || opt.name,
          name: opt.name,
          sku: opt.sku,
          qty: q,
        });
        pushChip(`+ ${q} × ${(opt.productName || opt.name)}${opt.unit ? ` (${opt.unit})` : ""}`, "ok");
      },
    }));
    setSuggestTitle(title || "Did you mean…?");
    setSuggestions(mapped);
  }

  function showCustomerSuggestions(title, list) {
    const mapped = list.map((item, i) => ({
      key: `${item.id || item.custId || i}`,
      displayName: item.name || item.phone || "—",
      unit: item.phone || "",
      brand: item.email || "",
      sku: item.id || item.custId || "",
      price: undefined,
      qty: 1,
      add: () => {
        clearSuggestions();
        const chosen = { id: item.id || item.custId, ...item };
        setCurrentCustomer(chosen);
        setPendingCustomerDraft(null);
        safe.setCustomerByText?.(chosen);
        pushChip(`Customer: ${item.name || item.phone}`, "ok");
      },
    }));
    setSuggestTitle(title || "Select customer");
    setSuggestions(mapped);
  }

  function handlePick(sel) {
    const s = typeof sel === "number" ? suggestions[sel] : sel;
    if (!s) return;
    if (typeof s.add === "function") return s.add();
    return s.onPick ? s.onPick(s) : null;
  }

  async function applyTranscript(text) {
    if (pausedHook) return;
    if (!text || !text.trim()) return;

    // Instant local intents (no server)
    const quick = parseLocalIntent(text);
    if (quick && quick.intent) {
      // Already in legacy FastBilling shape { intent, entities }
      routeIntent(quick, text);
      setHistory((prev) => [{ text, ts: Date.now() }, ...prev].slice(0, 20));
      try {
        speech?.clearFinalTranscript?.();
      } catch {}
      return;
    }

    // Server parse for complex utterances
    const userId = getAuth()?.currentUser?.uid;
    if (!userId) {
      pushChip("Not logged in", "warn");
      return;
    }

    // If parser is temporarily disabled, go straight to local resolver (customer-aware)
    if (Date.now() < parserDisabledUntilRef.current) {
      const rawLower = String(text || "").toLowerCase();
      const saysCustomer = /\b(customer|client|buyer|customer details?)\b/.test(rawLower);
      if (saysCustomer) {
        const phoneStr = extractPhoneFromUtterance(text);
        const emailMatch = rawLower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
        const nameMatch = rawLower.match(/(?:name|named|call(?:ed)?|customer)\s*[:\-\s]*([a-zA-Z ]{2,})/);
        const quickEnt = {};
        if (phoneStr) quickEnt.phone = phoneStr;
        if (emailMatch && emailMatch[0]) quickEnt.email = emailMatch[0];
        if (nameMatch && nameMatch[1] && nameMatch[1] !== "customer") quickEnt.name = nameMatch[1].trim();
        clearSuggestions();
        routeIntent({ intent: "set_customer", entities: quickEnt }, text);
      } else {
        clearSuggestions();
        routeIntent({ intent: "" }, text); // local fuzzy product resolver
      }
      setHistory((p) => [{ text, ts: Date.now() }, ...p].slice(0, 20));
      try { speech?.clearFinalTranscript?.(); } catch {}
      return;
    }

    try {
      let res = await fetch("https://us-central1-stockpilotv1.cloudfunctions.net/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: String(text).slice(0, 200),
          userId,
          locale: "en-IN",
          intentHints: ["add_product","set_customer","set_payment","set_gst","set_invoice_type"],
        }),
      });
      if (!res.ok) {
        const errTxt = await res.text().catch(() => "");
        console.error("Parse API non-OK", res.status, errTxt);
        // Circuit breaker: after 3 consecutive failures, pause parser calls for 2 minutes
        parserFailuresRef.current += 1;
        if (parserFailuresRef.current >= 3) {
          parserDisabledUntilRef.current = Date.now() + 2 * 60 * 1000;
          if (Date.now() - parserLastNoticeRef.current > 60000) {
            pushChip("Parser offline. Using local matching for a bit…", "info");
            parserLastNoticeRef.current = Date.now();
          }
        }
        // Smart fallback: if this was a customer utterance, route to set_customer; otherwise use product resolver
        const rawLower = String(text || "").toLowerCase();
        const saysCustomer = /\b(customer|client|buyer|customer details?)\b/.test(rawLower);
        if (saysCustomer) {
          const phoneStr = extractPhoneFromUtterance(text);
          const emailMatch = rawLower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
          const nameMatch = rawLower.match(/(?:name|named|call(?:ed)?|customer)\s*[:\-\s]*([a-zA-Z ]{2,})/);
          const quickEnt = {};
          if (phoneStr) quickEnt.phone = phoneStr;
          if (emailMatch && emailMatch[0]) quickEnt.email = emailMatch[0];
          if (nameMatch && nameMatch[1] && nameMatch[1] !== "customer") quickEnt.name = nameMatch[1].trim();
          clearSuggestions();
          routeIntent({ intent: "set_customer", entities: quickEnt }, text);
        } else {
          // Fallback to local fuzzy product resolver
          clearSuggestions();
          routeIntent({ intent: "" }, text);
        }
        setHistory((p) => [{ text, ts: Date.now() }, ...p].slice(0, 20));
        try {
          speech?.clearFinalTranscript?.();
        } catch {}
        return;
      }
      res = await res.json();
      parserFailuresRef.current = 0; // restore parser health on success

      const normalized = {
        intent: String(res.intent || res.action || "").toLowerCase().replace(/\s+/g, "_"),
        entities: res.entities || res.slots || {},
      };

      // If the raw text clearly indicates customer flow, force that
      try {
        const rawLower = String(text || "").toLowerCase();
        const saysCustomer = /\b(customer|client|buyer|customer details?)\b/.test(rawLower);
        if (saysCustomer) {
          normalized.intent = "set_customer";
          const phoneStr = extractPhoneFromUtterance(text);
          const emailMatch = rawLower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
          const nameMatch = rawLower.match(/(?:name|named|call(?:ed)?|customer)\s*[:\-\s]*([a-zA-Z ]{2,})/);
          const quickEnt = { ...(normalized.entities || {}) };
          if (phoneStr) quickEnt.phone = phoneStr;
          if (emailMatch && emailMatch[0]) quickEnt.email = emailMatch[0];
          if (nameMatch && nameMatch[1] && nameMatch[1] !== "customer") quickEnt.name = nameMatch[1].trim();
          normalized.entities = quickEnt;
        }
      } catch {}

      if (!normalized.intent) {
        const rawLower = String(text || "").toLowerCase();
        const saysCustomer = /\b(customer|client|buyer|customer details?)\b/.test(rawLower);
        if (saysCustomer) {
          const phoneStr = extractPhoneFromUtterance(text);
          const emailMatch = rawLower.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
          const nameMatch = rawLower.match(/(?:name|named|call(?:ed)?|customer)\s*[:\-\s]*([a-zA-Z ]{2,})/);
          const quickEnt = {};
          if (phoneStr) quickEnt.phone = phoneStr;
          if (emailMatch && emailMatch[0]) quickEnt.email = emailMatch[0];
          if (nameMatch && nameMatch[1] && nameMatch[1] !== "customer") quickEnt.name = nameMatch[1].trim();
          clearSuggestions();
          routeIntent({ intent: "set_customer", entities: quickEnt }, text);
        } else {
          // No remote intent → use local fuzzy product resolver
          clearSuggestions();
          routeIntent({ intent: "" }, text);
        }
        setHistory((p) => [{ text, ts: Date.now() }, ...p].slice(0, 20));
        try {
          speech?.clearFinalTranscript?.();
        } catch {}
        return;
      }

      document.dispatchEvent(new CustomEvent("fastBilling:intent", { detail: { ...res, raw: text } }));
      clearSuggestions();
      routeIntent(normalized, text);
      setHistory((p) => [{ text, ts: Date.now() }, ...p].slice(0, 20));
      try {
        speech?.clearFinalTranscript?.();
      } catch {}
    } catch (e) {
      console.error("❌ Parse API Error", e);
      
          // Enhanced fallback to local parsing when Cloud Function fails
      console.log("Falling back to local parsing for:", text);
      const localResult = parseLocalIntent(text);
      console.log("Local parse result:", localResult);
      
      if (localResult.intent && localResult.intent !== "unknown") {
        pushChip("Using local parser (Cloud Function unavailable)", "info");
        routeIntent(localResult, text);
        setHistory((p) => [{ text, ts: Date.now() }, ...p].slice(0, 20));
        try { speech?.clearFinalTranscript?.(); } catch {}
        return;
      } else {
        pushChip("Could not understand command", "warn");
        setHistory((p) => [{ text, ts: Date.now() }, ...p].slice(0, 20));
        try { speech?.clearFinalTranscript?.(); } catch {}
      }
    }
  }

  function viewInvoiceById(id) {
    if (!id) return;
    if (actions?.viewInvoice) return actions.viewInvoice(id);
    if (actions?.openInvoice) return actions.openInvoice(id);
    if (actions?.goToInvoice) return actions.goToInvoice(id);
    document.dispatchEvent(new CustomEvent("fastBilling:viewInvoice", { detail: { invoiceId: id } }));
  }

  async function doSave() {
    try {
      const grand = Number(safe.totals?.grandTotal || 0);
      const hasLines = Array.isArray(safe.cart) && safe.cart.length > 0;
      if (!hasLines || !(grand > 0)) {
        pushChip("Add at least one item before saving", "warn");
        return;
      }

      const uid = getAuth()?.currentUser?.uid;

      // Create staged draft customer (if any) before save
      if (pendingCustomerDraft && uid) {
        const payload = stripUndefinedDeep({ ...pendingCustomerDraft });
        delete payload.isDraft;
        await setDoc(doc(db, "businesses", uid, "customers", payload.id), payload, { merge: true });
        setCustomers((prev) => [
          {
            ...payload,
            _needle: `${payload.name || ""} ${payload.phone || ""} ${payload.email || ""} ${
              payload.address || ""
            }`.toLowerCase(),
          },
          ...prev,
        ]);
        setPendingCustomerDraft(null);
        pushChip(`Customer created: ${payload.name || payload.phone}`, "ok");
      }

      // Normalize voice extras
      const normalizedExtras = (() => {
        const ex = { ...(voicePaymentExtras || {}) };
        if (
          (voicePaymentMode ||
            actions?.invoiceConfig?.paymentMode ||
            actions?.totals?.invoiceConfig?.paymentMode) === "split"
        ) {
          const sp = ex.splitPayment || {};
          ex.splitPayment = {
            cash: Math.max(0, Number(sp.cash) || 0),
            upi: Math.max(0, Number(sp.upi) || 0),
            card: Math.max(0, Number(sp.card) || 0),
          };
        }
        if (
          (voicePaymentMode ||
            actions?.invoiceConfig?.paymentMode ||
            actions?.totals?.invoiceConfig?.paymentMode) === "credit"
        ) {
          if (ex.creditDueDays != null) ex.creditDueDays = Math.max(0, parseInt(ex.creditDueDays, 10) || 0);
          if (ex.creditDueDate != null && typeof ex.creditDueDate !== "string")
            ex.creditDueDate = String(ex.creditDueDate);
        }
        return ex;
      })();

      const rawConfig = {
        ...(actions?.invoiceConfig || actions?.totals?.invoiceConfig || {}),
        paymentMode:
          actions?.invoiceConfig?.paymentMode ||
          actions?.totals?.invoiceConfig?.paymentMode ||
          derivedPaymentMode ||
          "",
        invoiceType:
          actions?.invoiceConfig?.invoiceType ||
          actions?.totals?.invoiceConfig?.invoiceType ||
          derivedInvoiceType ||
          "",
        ...normalizedExtras,
      };
      const invoiceConfig = stripUndefinedDeep(rawConfig);

      const cartOverride = stripUndefinedDeep(
        (safe.cart || []).map((row) => enrichCartLine(row, inventoryData))
      );
      const totalsOverride = stripUndefinedDeep(safe.totals);

      const customerOverride = currentCustomer
        ? stripUndefinedDeep({
            id: currentCustomer.id || currentCustomer.custId,
            name: currentCustomer.name || "",
            phone: currentCustomer.phone || "",
            email: currentCustomer.email || "",
            address: currentCustomer.address || "",
          })
        : undefined;

      const mode = String(invoiceConfig.paymentMode || "").toLowerCase();
      const extras = voicePaymentExtras || {};
      const split = extras.splitPayment || {};
      const adv = Number(extras.advancePaid || 0) || 0;

      let creditDueDays =
        extras.creditDueDays != null ? Math.max(0, parseInt(extras.creditDueDays, 10) || 0) : undefined;
      let creditDueDate =
        extras.creditDueDate != null && String(extras.creditDueDate).trim()
          ? String(extras.creditDueDate).trim()
          : undefined;

      if (!creditDueDate && creditDueDays != null) {
        const d = new Date();
        d.setDate(d.getDate() + creditDueDays);
        creditDueDate = d.toISOString().slice(0, 10);
      }

      const paymentFlags = {
        isCredit: mode === "credit",
        isSplit: mode === "split",
        isAdvance: mode === "advance",
      };

      const paymentSummary = {
        mode,
        splitPayment: {
          cash: Math.max(0, Number(split.cash) || 0),
          upi: Math.max(0, Number(split.upi) || 0),
          card: Math.max(0, Number(split.card) || 0),
        },
        advancePaid: adv,
        creditDueDays,
        creditDueDate,
        status: mode === "credit" ? "pending" : "paid",
      };

      const topLevelMirrors = {
        paymentMode: mode,
        creditDueDate: creditDueDate || null,
        isPaid: mode === "credit" ? false : true,
      };

      const payloadForStore = stripUndefinedDeep({
        mode: "fast",
        invoiceConfig,
        // Primary canonical cart we save from Fast Billing
        cartOverride,
        // ✅ Compatibility aliases so downstream save/view code that expects different keys keeps working
        cartItems: cartOverride,
        itemsOverride: cartOverride,
        totalsOverride,
        customerOverride,
        paymentFlags,
        paymentSummary,
        ...topLevelMirrors,
        meta: { source: "fastBilling", publishedAt: new Date().toISOString() },
      });

      const undefinedReport = [
        ...findUndefinedPaths({ invoiceConfig }),
        ...findUndefinedPaths({ cartOverride }),
        ...findUndefinedPaths({ totalsOverride }),
        ...findUndefinedPaths({ customerOverride }),
      ].filter(Boolean);
      if (undefinedReport.length) {
        console.warn("[FastBilling] Preflight: found undefined at:", undefinedReport);
      }

      const id = await safe.saveInvoice?.(payloadForStore);
      try {
        toast.success(id ? `Invoice published (#${id})` : "Invoice published");
      } catch {}
      pushChip(id ? `Invoice saved #${id}` : "Invoice saved", "ok", id ? () => viewInvoiceById(id) : null);
      document.dispatchEvent(
        new CustomEvent("fastBilling:published", { detail: { invoiceId: id || null, source: "fast" } })
      );
      try {
        speech?.clearSegments?.();
      } catch {}
    } catch (e) {
      console.error("Publish failed:", e);
      const msg = String(e?.message || "");
      if (/Unsupported field value: undefined/i.test(msg)) {
        const report = [
          ...findUndefinedPaths({ invoiceConfig: actions?.invoiceConfig }),
          ...findUndefinedPaths({ totals: actions?.totals }),
          ...findUndefinedPaths({ cart: actions?.cart }),
        ].filter(Boolean);
        console.error("[FastBilling] Host state has undefined at:", report);
        pushChip("Publish failed: some fields are undefined. Check console for paths.", "warn");
      } else {
        pushChip("Save failed", "warn");
      }
    }
  }

  async function routeIntent(res, raw) {
    const rawIntent = String(res?.intent || "").toLowerCase().replace(/\s+/g, "_");
    const entities = res?.entities || {};
    const rawText = String(raw || "");

    // treat many aliases as "add item"
    const isAddIntent = [
      "add_item",
      "add_to_cart",
      "addproduct",
      "add_product",
      "add",
      "additem",
      "insert_item",
      "insert_to_cart",
    ].includes(rawIntent);

    if (isAddIntent) {
      const qty = Number(entities.qty ?? 1) || 1;
      const hasStrongIdentifier =
        !!(
          entities.sku ||
          entities.productId ||
          entities.exact === true ||
          (typeof entities.confidence === "number" && entities.confidence >= 0.96)
        );

      const nameOnly = String(entities.productName || entities.name || "").trim();
      const isGenericName = nameOnly.length <= 2 || nameOnly.split(/\s+/).length === 1;

      if (hasStrongIdentifier) {
        clearSuggestions();
        safe.addItemByQuery?.({
          productName: entities.productName || entities.name,
          name: entities.name,
          sku: entities.sku,
          qty,
          ...entities,
        });
        pushChip(`+ ${qty} × ${entities.productName || entities.name || entities.sku || "item"}`, "ok");
        return;
      }

      // generic name → fall through to resolver
    }

    switch (rawIntent) {
      case "change_qty":
      case "update_qty": {
        safe.updateQty?.(entities); // { name, qty }
        pushChip(`Qty ${entities.name} → ${entities.qty}`, "ok");
        return;
      }
      case "set_qty": {
        // alias for change_qty
        safe.updateQty?.(entities); // { name, qty }
        pushChip(`Qty ${entities.name} → ${entities.qty}`, "ok");
        return;
      }
      case "remove_item":
      case "delete_item": {
        safe.removeItemByName?.(entities.name);
        pushChip(`Removed ${entities.name}`, "ok");
        return;
      }
      case "set_customer": {
        const ent = entities || {};
        const uid = getAuth()?.currentUser?.uid;
        if (!uid) {
          pushChip("Not logged in", "warn");
          return;
        }

        // parse from utterance
        const phoneDigits = extractPhoneFromUtterance(rawText);
        const qPhone = normalizePhone(ent.phone || phoneDigits || "");
        const qEmail = String(ent.email || "").toLowerCase().trim();
        let qName = String(ent.name || "").trim();
        if (qName.toLowerCase() === "customer") qName = "";
        const qNeedle = (qPhone || qEmail || qName).toLowerCase();

        // 1) by phone
        if (qPhone) {
          const phoneMatch = customers.find((c) => samePhone(c.phone, qPhone));
          if (phoneMatch) {
            clearSuggestions();
            const chosen = { id: phoneMatch.id, ...phoneMatch };
            setCurrentCustomer(chosen);
            setPendingCustomerDraft(null);
            safe.setCustomerByText?.(chosen);
            pushChip(
              `Customer: ${phoneMatch.name || phoneMatch.phone}${
                phoneMatch.address ? ` • ${phoneMatch.address}` : ""
              }`,
              "ok"
            );
            return;
          }
        }

        // 2) by email
        if (qEmail) {
          const emailMatch = customers.find((c) => (c.email || "").toLowerCase() === qEmail);
          if (emailMatch) {
            clearSuggestions();
            const chosen = { id: emailMatch.id, ...emailMatch };
            setCurrentCustomer(chosen);
            setPendingCustomerDraft(null);
            safe.setCustomerByText?.(chosen);
            pushChip(
              `Customer: ${emailMatch.name || emailMatch.phone}${
                emailMatch.address ? ` • ${emailMatch.address}` : ""
              }`,
              "ok"
            );
            return;
          }
        }

        // 3) unique name
        if (qName && customers.length) {
          const sameName = customers.filter((c) => (c.name || "").toLowerCase() === qName.toLowerCase());
          if (sameName.length === 1) {
            clearSuggestions();
            const chosen = { id: sameName[0].id, ...sameName[0] };
            setCurrentCustomer(chosen);
            setPendingCustomerDraft(null);
            safe.setCustomerByText?.(chosen);
            pushChip(
              `Customer: ${sameName[0].name || sameName[0].phone}${
                sameName[0].address ? ` • ${sameName[0].address}` : ""
              }`,
              "ok"
            );
            return;
          }
        }

        // 4) fuzzy
        if (qNeedle) {
          const scored = customers
            .map((c) => ({ c, score: similarity(qNeedle, c._needle || "") }))
            .filter((x) => x.score > 0.48)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

          if (scored.length >= 2) {
            showCustomerSuggestions("Which customer did you mean?", scored.map((s) => s.c));
            return;
          }
          if (scored.length === 1 && scored[0].score >= 0.92) {
            const hit = scored[0].c;
            clearSuggestions();
            const chosen = { id: hit.id, ...hit };
            setCurrentCustomer(chosen);
            setPendingCustomerDraft(null);
            safe.setCustomerByText?.(chosen);
            pushChip(
              `Customer: ${hit.name || hit.phone}${hit.address ? ` • ${hit.address}` : ""}`,
              "ok"
            );
            return;
          }
        }

        // 5) stage a draft (create on save)
        const canCreate = qName || qPhone || qEmail || ent.address;
        if (canCreate) {
          const custId = genCustId();
          const now = fmtNow();
          const payload = {
            id: custId,
            custId,
            name: qName || "",
            phone: qPhone || "",
            email: qEmail || "",
            address: String(ent.address || "").trim(),
            createdAt: now,
            updatedAt: now,
            isDraft: true,
          };
          const chosen = { id: custId, ...payload };
          setCurrentCustomer(chosen);
          setPendingCustomerDraft(payload);
          safe.setCustomerByText?.(chosen);
          pushChip("New customer will be created on Save", "ok");
          return;
        }

        // 6) If only "customer" was spoken with no details, assume a walk-in and stage a blank draft
        {
          const custId = genCustId();
          const now = fmtNow();
          const payload = {
            id: custId,
            custId,
            name: "Walk-in",
            phone: "",
            email: "",
            address: "",
            createdAt: now,
            updatedAt: now,
            isDraft: true,
          };
          const chosen = { id: custId, ...payload };
          setCurrentCustomer(chosen);
          setPendingCustomerDraft(payload);
          safe.setCustomerByText?.(chosen);
          pushChip("Walk-in customer selected (will be created on Save)", "ok");
          return;
        }
      }
      case "set_charge": {
        safe.setCharge?.(entities.key, entities.amount);
        pushChip(`Charge: ${entities.key} ₹${entities.amount}`, "ok");
        return;
      }
      case "set_invoice_type": {
        safe.setInvoiceType?.(entities.type);
        setVoiceInvoiceType(String(entities.type || ""));
        pushChip(`Type: ${entities.type}`, "ok");
        return;
      }
      case "set_gst": {
        const current = getHostSettings();
        // Accept common shapes: {type:"igst", rate:18} or {igst:true, rate:18} or just {rate:18}
        const normalized = normalizeGstEntities(entities || {}, current);

        // If the user didn't provide a rate, prompt with common choices and defer setting until they pick.
        const noRate =
          !(normalized && Number.isFinite(Number(normalized.rate)) && Number(normalized.rate) >= 0);
        if (noRate) {
          const mode = normalized.mode || "gst";
          const title = `Select ${mode.toUpperCase()} rate`;
          const options = [0, 5, 12, 18].map((r) => ({
            key: `${mode}-${r}`,
            displayName: `${r}%`,
            unit: "",
            brand: "",
            sku: "",
            price: undefined,
            qty: 1,
            onPick: () => {
              const chosen = normalizeGstEntities({ ...entities, rate: r, type: mode }, current);
              applyGstBoth(chosen);
              pushChip(`${mode.toUpperCase()} ${r}% applied`, "ok");
            },
          }));
          showSuggestions(title, options, 1);
          pushChip("GST updated (choose a rate)", "info");
          return;
        }

        // Apply immediately when a rate was provided
        applyGstBoth(normalized);
        const modeLabel = (normalized.mode || "GST").toUpperCase();
        pushChip(`${modeLabel} ${normalized.rate}% applied`, "ok");
        return;
      }
      case "set_payment": {
        const { mode, paymentMode, ...rest } = entities || {};
        const cleanedExtras = stripUndefinedDeep(rest || {});
        setVoicePaymentExtras(cleanedExtras);
        safe.setPayment?.({ mode: mode || paymentMode, paymentMode: paymentMode || mode, ...cleanedExtras });
        setVoicePaymentMode(String(mode || paymentMode || "").toLowerCase());
        pushChip(`Payment: ${mode || paymentMode}`, "ok");

        // show split / credit modals when needed
        if (mode === "split" || paymentMode === "split") {
          const sp = entities.splitPayment || {};
          const hasAny = Number(sp.cash) || Number(sp.upi) || Number(sp.card);
          if (!hasAny) {
            setSplitDraft({ cash: 0, upi: 0, card: 0 });
            setShowSplitModal(true);
          }
        }
        if (mode === "credit" || paymentMode === "credit") {
          const has =
            (entities.creditDueDays != null && entities.creditDueDays !== "") ||
            (entities.creditDueDate && String(entities.creditDueDate).trim());
          if (!has) {
            setCreditDraft({ days: "", date: "" });
            setShowCreditModal(true);
          }
        }
        return;
      }
      case "set_discount": {
        const { name, pct, amt } = entities || {};
        if (typeof actions?.setLineDiscount === "function") {
          actions.setLineDiscount({ name, pct, amt });
          pushChip(`Discount ${pct != null ? pct + "%" : "₹" + amt}${name ? ` on ${name}` : ""}`, "ok");
          return;
        }
        if (typeof actions?.applyDiscount === "function") {
          actions.applyDiscount({ name, pct, amt });
          pushChip(`Discount ${pct != null ? pct + "%" : "₹" + amt}${name ? ` on ${name}` : ""}`, "ok");
          return;
        }
        pushChip("Discount action not wired to host. Implement actions.setLineDiscount/applyDiscount.", "warn");
        return;
      }
      case "finalize": {
        doSave();
        return;
      }
    }

    // ---------- Enhanced product resolver with learning and brand support ----------
    const rawLower = rawText.toLowerCase();
    const qtyMatch = rawLower.match(/\b\d+(?:\.\d+)?\b/);
    const qty = qtyMatch
      ? qtyMatch[0].includes(".")
        ? parseFloat(qtyMatch[0])
        : parseInt(qtyMatch[0])
      : Number(entities.qty ?? 1) || 1;

    // Check if this is a brand-only match that needs product selection
    const { shouldShowBrandSelection } = await import('../../../utils/enhancedProductMatcher');
    const brandSelection = shouldShowBrandSelection(rawText, inventoryData, {
      minScore: 0.6,
    });

    if (brandSelection.shouldShow) {
      const brandProducts = brandSelection.products.map(product => ({
        key: product.id || product.sku,
        displayName: product.productName || product.name,
        unit: product.unit || product.packSize,
        brand: product.brand,
        sku: product.sku,
        price: product.sellingPrice || product.price || product.mrp,
        add: () => {
          clearSuggestions();
          safe.addItemByQuery?.({
            productName: product.productName || product.name,
            name: product.name,
            sku: product.sku,
            qty,
            ...product,
          });
          pushChip(`+ ${qty} × ${product.productName || product.name}`, "ok");
        },
      }));

      showSuggestions(brandSelection.message, brandProducts, qty);
      return;
    }

    // Use enhanced product matcher with learning
    const suggestions = enhancedProductMatcher(rawText, inventoryData, {
      maxResults: 7,
      minScore: 0.3,
      includeLearning: true,
    });

    if (suggestions.length === 0) {
      pushChip("No products found. Try a different name or check spelling.", "warn");
      return;
    }

    // Group by base product name to show variants
    const variantsByBase = new Map();
    for (const suggestion of suggestions) {
      const product = suggestion.product;
      const baseName = (product.productName || product.name || "").toLowerCase()
        .replace(/\b(ml|ltr|liter|litre|gm|g|kg|pcs|piece|bag|box|bottle|pack|tube|jar|can|sachet|\d+\s*(ml|g|kg|ltr))\b/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      
      if (!baseName) continue;
      
      const arr = variantsByBase.get(baseName) || [];
      arr.push({
        ...suggestion,
        score: suggestion.confidence / 100, // Convert confidence to score
      });
      variantsByBase.set(baseName, arr);
    }

    // Show suggestions for variants or single best match
    for (const [, arr] of variantsByBase.entries()) {
      if (arr.length >= 2) {
        const topPicks = arr.sort((a, b) => b.score - a.score).slice(0, 5);
        showSuggestions("Which one did you mean?", topPicks, qty);
        return;
      }
    }

    // Single best match - add directly
    const bestMatch = suggestions[0];
    if (bestMatch && bestMatch.confidence >= 80) {
      clearSuggestions();
      safe.addItemByQuery?.({
        productName: bestMatch.product.productName || bestMatch.product.name,
        name: bestMatch.product.name,
        sku: bestMatch.product.sku,
        qty,
        ...bestMatch.product,
      });
      pushChip(`+ ${qty} × ${bestMatch.product.productName || bestMatch.product.name}`, "ok");
      
      // Learn from this successful match
      if (bestMatch.isLearned) {
        // This was a learned suggestion, so it's already in learning data
      } else {
        // This was a new match, add to learning data
        try {
          const { learnFromCorrection } = await import('../../../utils/enhancedProductMatcher');
          learnFromCorrection(rawText, bestMatch.product, inventoryData);
        } catch (e) {
          console.warn('Failed to save learning data:', e);
        }
      }
      return;
    }

    // Show suggestions for manual selection
    showSuggestions("Select product", suggestions, qty);

  }

  // Totals animation
  useEffect(() => {
    const newTotal = Number(safe.totals?.grandTotal || 0);
    const raf =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (fn) => setTimeout(() => fn(Date.now()), 16);
    const caf = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : clearTimeout;

    let start = animatedTotal;
    let startTime;
    const duration = 400;

    if (animationRef.current != null) {
      try {
        caf(animationRef.current);
      } catch {}
      animationRef.current = null;
    }

    function animate(ts) {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const progress = Math.min(1, elapsed / duration);
      const val = start + (newTotal - start) * progress;
      setAnimatedTotal(val);
      if (progress < 1) {
        animationRef.current = raf(animate);
      } else {
        setAnimatedTotal(newTotal);
        animationRef.current = null;
      }
    }

    if (start !== newTotal) {
      animationRef.current = raf(animate);
    } else {
      setAnimatedTotal(newTotal);
    }

    return () => {
      if (animationRef.current != null) {
        try {
          caf(animationRef.current);
        } catch {}
        animationRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safe.totals?.grandTotal]);

  // Keep shadowQtys aligned with cart lines
  useEffect(() => {
    const keys = new Set(
      (safe.cart || []).map(
        (row, idx) => row.cartLineId || row.id || `${row.sku || row.name || "row"}-${idx}`
      )
    );
    setShadowQtys((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (!keys.has(k)) delete next[k];
      });
      return next;
    });
  }, [safe.cart]);

  const wsState = speech?.connectionState || "unknown";

  return (
    <>
      <div
        className={
          "relative grid gap-4 " + (showPreview ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1")
        }
      >
        <div className="w-full space-y-4">
          {/* Header / Status */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-neutral-900/80 via-neutral-900/60 to-neutral-800/60 p-4 flex items-center gap-3">
            <div className="text-lg font-semibold tracking-wide">
              Fast Billing
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className={"px-2 py-0.5 text-xs rounded-full border " + (listeningHook ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/20 text-white/70")}>
                {listeningHook ? "Listening" : "Paused"}
              </span>
              <span className={"px-2 py-0.5 text-xs rounded-full border " + (wsState === "open" ? "border-sky-400/40 bg-sky-400/10 text-sky-300" : "border-white/20 text-white/70")}>
                WS: {wsState}
              </span>
              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className="px-2.5 py-1 rounded-lg text-xs border border-white/15 hover:border-white/30 hover:backdrop-blur-md transition-colors"
                aria-label="Open voice help"
              >
                ?
              </button>
            </div>
          </div>

          {/* Voice HUD */}
          <VoiceHUD
            listening={listeningHook}
            paused={pausedHook}
            autoStopped={autoStopped}
            wsState={speech?.connectionState || 'closed'}
            vu={speech?.audioLevel || 0}
            lastPartial={speech?.lastPartial || ""}
            onToggleMic={() => {
              if (!speech) return;
              const isRunning = speech.isListening && !speech.isPaused;
              if (isRunning) {
                try {
                  speech.stop?.();
                } catch {}
                try {
                  speech.clearSegments?.();
                } catch {}
                setAutoStopped(false);
                pushChip("Paused", "info");
              } else {
                try {
                  speech.start?.();
                } catch {}
                setAutoStopped(false);
                pushChip("Listening…", "info");
              }
            }}
            onClearTranscripts={() => {
              try {
                speech?.clearSegments?.();
              } catch {}
              pushChip("Cleared", "info");
            }}
            activity={actionLog}
            chips={chips}
          />

          {/* Customer (compact) */}
          {currentCustomer && (
            <CustomerCard
              customer={currentCustomer}
              onClear={() => {
                setCurrentCustomer(null);
                setPendingCustomerDraft(null);
              }}
            />
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <SuggestionPanel
              title={suggestTitle}
              suggestions={suggestions}
              onPick={handlePick}
              onDismiss={clearSuggestions}
            />
          )}

          {/* Controls */}
          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <button
              disabled={!safe.canUndo}
              onClick={safe.undo}
              className="px-3 py-1.5 rounded-xl border border-white/15 disabled:opacity-50 hover:border-white/30 hover:bg-white/5 transition-colors"
              title="Undo last action"
            >
              ↩︎ Undo
            </button>
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="px-3 py-1.5 rounded-xl border border-white/15 hover:border-white/30 hover:bg-white/5 transition-colors text-white/85"
              aria-pressed={showPreview}
              title="Toggle live invoice preview"
            >
              {showPreview ? "Hide Preview" : "Show Preview"}
            </button>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="px-3 py-1.5 rounded-xl border border-white/15 hover:border-white/30 hover:bg-white/5 transition-colors text-white/85"
              aria-pressed={showSettings}
              title="Quick settings"
            >
              {showSettings ? "Hide Settings" : "Show Settings"}
            </button>
            <div className="ml-auto hidden md:flex items-center gap-2 text-xs text-white/60">
              <span className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5">Space</span>
              to start/stop mic
            </div>
            <button
              onClick={onExit}
              className="ml-auto md:ml-0 px-3 py-1.5 rounded-xl border border-red-400/30 text-red-200/90 hover:border-red-400/60 hover:bg-red-500/10 transition-colors"
              title="Exit fast billing"
            >
              ✕ Exit
            </button>
          </div>

          {/* Settings (collapsible) */}
          {showSettings && (
            <div className="w-full mb-2">
              <div className="rounded-2xl border border-white/10 bg-neutral-900/80 p-4 mb-2 shadow">
                <InvoiceSettings
                  settings={getHostSettings()}
                  onChange={(next) => {
                    // Mutual exclusivity: IGST vs CGST/SGST vs GST
                    const norm = normalizeGstEntities(
                      {
                        type: next.includeIGST
                          ? "igst"
                          : next.includeCGST || next.includeSGST
                          ? "cgst_sgst"
                          : "gst",
                        rate: next.includeIGST
                          ? next.igstRate
                          : next.includeCGST
                          ? next.cgstRate
                          : next.gstRate,
                        igst: !!next.includeIGST,
                        cgst: !!next.includeCGST,
                        sgst: !!next.includeSGST,
                        gst: !!next.includeGST,
                      },
                      next
                    );
                    safe.setInvoiceType?.(next.invoiceType);
                    safe.setPayment?.({ mode: next.paymentMode, ...next });
                    // push to host + mirror locally so preview shows it immediately
                    applyGstBoth(norm);
                  }}
                />
              </div>
            </div>
          )}

          {/* Cart */}
          <div className="w-full">
            <CartView
              cart={safe.cart}
              inventory={inventoryData}
              shadowQtys={shadowQtys}
              setShadowQtys={setShadowQtys}
              discountModes={discountModes}
              setDiscountModes={setDiscountModes}
              discountDrafts={discountDrafts}
              setDiscountDrafts={setDiscountDrafts}
              onQtyChange={({ lineKey, cartLineId, id, sku, name, qty }) =>
                safe.updateQty?.({ lineKey, cartLineId, id, sku, name, qty })
              }
              onSetDiscount={(p) => {
                const payload = {
                  lineKey: p.lineKey,
                  cartLineId: p.cartLineId,
                  id: p.id,
                  sku: p.sku,
                  name: p.name,
                  discountPct: p.discountPct,
                  discountAmt: p.discountAmt,
                  ...(p.discount != null ? { discount: p.discount } : {}),
                };

                if (typeof actions?.setLineDiscount === 'function') {
                  actions.setLineDiscount(payload);
                } else if (typeof actions?.applyDiscount === 'function') {
                  actions.applyDiscount(payload);
                } else {
                  safe.updateQty?.(payload);
                }
              }}
              onRemoveLine={(row) => {
                if (typeof actions?.removeItem === 'function') return actions.removeItem(row);
                return safe.removeItemByName?.(row?.name);
              }}
            />
          </div>
        </div>

        {/* Live Preview (optional column) */}
        {showPreview && (
          <div className="w-full space-y-4">
            <div className="rounded-2xl border border-white/10 bg-neutral-900/80 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm opacity-75 select-none">Invoice Preview</div>
                <div className="text-xs text-white/60">
                  Live with GST &amp; discounts
                </div>
              </div>
              {(() => {
                const previewItems = (safe.cart || []).map((row, idx) => {
                  // Stable per-line key (kept for future use; not used to override)
                  const lineKey =
                    row.cartLineId || row.id || `${row.sku || row.name || "row"}-${idx}`;

                  // Resolve display name similar to manual billing
                  let name =
                    row.displayName ||
                    row.productName ||
                    row.name ||
                    (row.product && (row.product.productName || row.product.name)) ||
                    row.title ||
                    row.itemName ||
                    row.label ||
                    "";

                  // Optional fallback via inventory by SKU
                  if (!name && row.sku && Array.isArray(inventoryData) && inventoryData.length) {
                    const invHit = inventoryData.find(
                      (p) => (p.sku || "").toLowerCase() === String(row.sku).toLowerCase()
                    );
                    if (invHit) name = invHit.productName || invHit.name || name;
                  }

                  // Use only host cart fields (single source of truth)
                  const qty = Number(row.qty ?? row.quantity ?? row.q ?? 1) || 1;

                  const price = Number(row.unitPrice ?? row.price ?? row.rate ?? row.mrp ?? 0) || 0;

                  // Derive discount fields with robust fallbacks
                  let discountPercent = row.discountPct ?? row.discount_percent;
                  let discountAmount = row.discountAmount ?? row.discount_value ?? row.discountInRs;

                  if (discountPercent == null && discountAmount == null) {
                    if (row.discountType === "percent") {
                      discountPercent = row.discount;
                    } else if (row.discountType === "amount") {
                      discountAmount = row.discount;
                    } else if (row.discount != null) {
                      const d = Number(row.discount);
                      if (Number.isFinite(d)) {
                        if (d >= 0 && d <= 100) {
                          discountPercent = d;
                        } else {
                          discountAmount = d;
                        }
                      }
                    }
                  }

                  // Prefer host-provided subtotal/total; otherwise compute from above
                  let subtotal = Number(row.subtotal ?? row.total);
                  if (!Number.isFinite(subtotal)) {
                    const base = qty * price;
                    if (Number.isFinite(Number(discountAmount)) && Number(discountAmount) > 0) {
                      subtotal = Math.max(0, base - Number(discountAmount));
                    } else if (Number.isFinite(Number(discountPercent)) && Number(discountPercent) > 0) {
                      subtotal = Math.max(0, base * (1 - Number(discountPercent) / 100));
                    } else {
                      subtotal = base;
                    }
                  }

                // Compute gstRate once for reuse
                const gstRate = extractGstRate(row);

                  return {
                    name: name || "—",
                    brand: row.brand || (row.product && row.product.brand) || "",
                    category: row.category || row.cat || (row.product && row.product.category) || "",
                    unit: row.unit || row.packSize || (row.product && row.product.unit) || "",
                    qty,
                    price,
                    sku: row.sku || "",
                    discountPercent: Number.isFinite(Number(discountPercent))
                      ? Number(discountPercent)
                      : undefined,
                    discountAmount: Number.isFinite(Number(discountAmount))
                      ? Number(discountAmount)
                      : undefined,
                    subtotal,
                    gstRate,
                    pricingMode: row.pricingMode || (row.mode && String(row.mode).toUpperCase().includes("MRP") ? "MRP_INCLUSIVE" : undefined) || "BASE_PLUS_GST",
                    // GST inclusion flags (manual billing defaults)
                    includeGST: true,
                    includeCGST: true,
                    includeSGST: true,
                    includeIGST: false,
                    cgstRate: Math.round(gstRate / 2),
                    sgstRate: Math.floor(gstRate / 2),
                    igstRate: gstRate,
                    // --- Add tax fields for InvoicePreview compatibility ---
                    taxAmount: gstRate ? Math.round((subtotal * gstRate) / 100) : 0,
                    cgst: gstRate ? Math.round((subtotal * (gstRate/2)) / 100) : 0,
                    sgst: gstRate ? Math.round((subtotal * (gstRate/2)) / 100) : 0,
                    igst: 0,
                  };
                });

                // Merge latest GST/tax settings with payment/invoice type
                const mergedSettings = {
                  ...getHostSettings(),
                  ...localSettings, // 👈 ensure live mirror is shown in preview
                  includeGST: localSettings.includeGST ?? true,
                  includeCGST: localSettings.includeCGST ?? true,
                  includeSGST: localSettings.includeSGST ?? true,
                  includeIGST: localSettings.includeIGST ?? false,
                  gstRate: localSettings.gstRate ?? 18,
                  cgstRate: localSettings.cgstRate ?? 9,
                  sgstRate: localSettings.sgstRate ?? 9,
                  igstRate: localSettings.igstRate ?? 18,
                  paymentMode: derivedPaymentMode,
                  invoiceType: derivedInvoiceType,
                  ...(voicePaymentExtras || {}),
                };
                return (
                  <InvoicePreview
                    cart={previewItems}
                    items={previewItems}
                    totals={safe.totals}
                    customer={currentCustomer}
                    settings={mergedSettings}
                    paymentMode={derivedPaymentMode}
                    invoiceType={derivedInvoiceType}
                    invoiceConfig={mergedSettings}
                  />
                );
              })()}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={doSave}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Finalize & Save
                </button>
                <div className="ml-auto text-sm opacity-70">
                  Grand Total: ₹{Number(animatedTotal || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment modals */}
      <SplitPaymentModal
        open={showSplitModal}
        total={safe?.totals?.grandTotal || 0}
        initial={splitDraft}
        onApply={(vals) => {
          setSplitDraft(vals);
          setShowSplitModal(false);
          setVoicePaymentExtras((e) => ({ ...(e || {}), splitPayment: vals }));
        }}
        onClose={() => setShowSplitModal(false)}
      />
      <CreditTermsModal
        open={showCreditModal}
        initial={creditDraft}
        onApply={(vals) => {
          setCreditDraft(vals);
          setShowCreditModal(false);
          setVoicePaymentExtras((e) => ({
            ...(e || {}),
            creditDueDays: vals.days,
            creditDueDate: vals.date,
          }));
        }}
        onClose={() => setShowCreditModal(false)}
      />
      {/* Quick Help Drawer */}
      {showHelp && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHelp(false)} />
          <div className="relative w-full sm:w-[580px] max-h-[85vh] overflow-auto rounded-2xl border border-white/10 bg-neutral-900/95 shadow-2xl p-4 m-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-base font-semibold">Voice commands</div>
              <button
                className="ml-auto px-2 py-1 rounded-lg border border-white/15 hover:border-white/30"
                onClick={() => setShowHelp(false)}
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-white/70 mb-3">Try speaking any of these, naturally:</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">“Add 2 Dove soap”</li>
              <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">“Set quantity 5 for Parle G”</li>
              <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">“Remove Surf Excel”</li>
              <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">“Customer 9876543210”</li>
              <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">“GST eighteen percent”</li>
              <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">“IGST 12%” / “CGST SGST 9%”</li>
              <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">“Split payment cash 200 upi 300”</li>
              <li className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">“Finalize invoice”</li>
            </ul>
            <div className="mt-4 text-xs text-white/60">
              Tip: press <span className="px-1 py-0.5 rounded border border-white/15 bg-white/5">Space</span> to toggle mic.
            </div>
          </div>
        </div>
      )}
    </>
  );
}