import moment from "moment";
import React, { useState, useEffect } from "react";
import CustomerForm from "./CustomerForm";
import BillingCart from "./BillingCart";
import InvoiceSettings from "./InvoiceSettings";
import ProductSearch from "./ProductSearch";
import InvoicePreview from "./InvoicePreview";
import { auth, db } from "../../firebase/firebaseConfig";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import FastBillingMode from "./VoiceBilling/FastBillingMode";
import { collection, query, where, getDocs } from "firebase/firestore";

/* ---------- Firestore safety + line id helpers ---------- */
function stripUndefinedDeep(input) {
  if (input === undefined) return undefined;
  if (input === null || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(stripUndefinedDeep).filter(v => v !== undefined);
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    const cleaned = stripUndefinedDeep(v);
    if (cleaned !== undefined) out[k] = cleaned;
  }
  return out;
}
function findUndefinedPaths(obj, base = "$") {
  const hits = [];
  const walk = (v, p) => {
    if (v === undefined) { hits.push(p); return; }
    if (v && typeof v === "object") {
      if (Array.isArray(v)) v.forEach((iv, i) => walk(iv, `${p}[${i}]`));
      else Object.entries(v).forEach(([k, val]) => walk(val, `${p}.${k}`));
    }
  };
  walk(obj, base);
  return hits;
}
const genCartLineId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

// Map logic.js/voice GST entities into our settings shape
function mapGstEntitiesToSettings(prev, flags = {}) {
  const next = { ...prev };

  // Explicit include toggle if provided
  if (typeof flags.includeGST === "boolean") next.includeGST = flags.includeGST;

  // Choose IGST vs CGST/SGST, and make them mutually exclusive with includeGST
  if (flags.igst === true) {
    next.includeIGST = true;
    next.includeCGST = false;
    next.includeSGST = false;
    next.includeGST = false; // avoid double-count with generic GST
  } else if (flags.cgst === true || flags.sgst === true) {
    next.includeIGST = false;
    next.includeCGST = true;
    next.includeSGST = true;
    next.includeGST = false; // avoid double-count with generic GST
  }
  if (flags.igst === false) next.includeIGST = false;
  if (flags.cgst === false) next.includeCGST = false;
  if (flags.sgst === false) next.includeSGST = false;

  // Apply a single spoken 'rate'
  if (Number.isFinite(flags.rate)) {
    const r = Math.max(0, Math.min(100, Number(flags.rate)));
    next.gstRate = r;

    if (next.includeIGST) {
      // IGST uses the full rate
      next.igstRate = r;
    } else if (next.includeCGST || next.includeSGST) {
      // Split evenly across CGST/SGST
      const half = r / 2;
      next.cgstRate = half;
      next.sgstRate = half;
    } else {
      // When no IGST/CGST/SGST explicitly selected, treat as generic GST
      next.includeGST = true;
      next.includeIGST = false;
      next.includeCGST = false;
      next.includeSGST = false;
    }
  }

  return next;
}

/* ---------- Stock updater ---------- */
const updateInventoryStock = async (userId, cartItems) => {
  for (const item of cartItems) {
    try {
      console.log("Updating stock for:", item.name, "ID:", item.id, "Qty:", item.quantity, "Brand:", item.brand, "Category:", item.category);
      const productRef = doc(db, "businesses", userId, "products", item.id);
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        const currentStock = parseFloat(productSnap.data().quantity) || 0;
        const newStock = currentStock - item.quantity;
        const finalStock = newStock < 0 ? 0 : newStock;
        await updateDoc(productRef, { quantity: finalStock });
        console.log("Stock updated to:", finalStock);
      } else {
        console.warn("Product not found for ID:", item.id);
      }
    } catch (error) {
      console.error("Error updating stock for product ID:", item.id, error.message);
    }
  }
};

const CreateInvoice = () => {
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [cartItems, setCartItems] = useState([]);
  const [settings, setSettings] = useState({
    includeGST: false,
    includeCGST: false,
    includeSGST: false,
    includeIGST: false,
    gstRate: 9,
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 18,
    invoiceType: "",
    paymentMode: "",
    deliveryCharge: 0,
    packingCharge: 0,
    otherCharge: 0,
  });
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showPreview, setShowPreview] = useState({ visible: false, issuedAt: null });
  const [userInfo, setUserInfo] = useState(null);
  const [invoiceId, setInvoiceId] = useState("");
  const [invoiceData, setInvoiceData] = useState(null);
  const [splitPayment, setSplitPayment] = useState({ cash: 0, upi: 0, card: 0 });
  const [fastMode, setFastMode] = useState(false);

  // stop Fast Billing mic when leaving fast mode or page
  useEffect(() => {
    if (!fastMode) window.dispatchEvent(new Event("fastBilling:stopMic"));
  }, [fastMode]);
  useEffect(() => () => { window.dispatchEvent(new Event("fastBilling:stopMic")); }, []);

  useEffect(() => {
    const fetchUserInfo = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "businesses", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setUserInfo({ ...docSnap.data(), uid: user.uid });
      }
    };
    fetchUserInfo();
  }, []);

  /* ---------- Fast Billing: action handlers ---------- */
  const addSuggestedProductToCart = (product, quantity = 1) => {
    if (!product) return;
    const resolvedName =
      product.productName ||
      product.name ||
      product.title ||
      product.label ||
      "";
    const newLine = {
      cartLineId: genCartLineId(),
      id: product.id,
      name: resolvedName,
      sku: product.sku || "",
      brand: product.brand || "",
      category: product.category || "",
      quantity: Math.max(1, parseFloat(quantity) || 1),
      price: parseFloat(
        (product.sellingPrice ?? product.price ?? product.mrp ?? 0)
      ),
      discount: 0, // percent
      unit: product.unit || product.packSize || "",
    };
    setSelectedProducts((prev) => {
      const exists = prev.find((p) => p.id === newLine.id);
      return exists
        ? prev
        : [
            ...prev,
            { id: newLine.id, name: resolvedName },
          ];
    });
    setCartItems((prev) => [...prev, newLine]);
  };

  const addItemFromVoice = async (slots = {}) => {
    if (!userInfo) return;
    const { sku, name, qty } = slots;
    let found = null;
    let candidates = [];
    try {
      if (sku) {
        const q1 = query(
          collection(db, "businesses", userInfo.uid, "products"),
          where("sku", "==", sku)
        );
        const r1 = await getDocs(q1);
        r1.forEach((d) => {
          if (!found) found = { id: d.id, ...d.data() };
        });
      }
      if (!found && name) {
        const q2 = query(
          collection(db, "businesses", userInfo.uid, "products"),
          where("name", "==", name)
        );
        const r2 = await getDocs(q2);
        r2.forEach((d) => {
          if (!found) found = { id: d.id, ...d.data() };
        });
      }
      // Try productName field as well
      if (!found && name) {
        const q3 = query(
          collection(db, "businesses", userInfo.uid, "products"),
          where("productName", "==", name)
        );
        const r3 = await getDocs(q3);
        r3.forEach((d) => {
          if (!found) found = { id: d.id, ...d.data() };
        });
      }
      if (!found && name) {
        const allSnap = await getDocs(
          collection(db, "businesses", userInfo.uid, "products")
        );
        const queryLower = String(name).toLowerCase();
        const tokens = queryLower.split(/\s+/).filter(Boolean);
        allSnap.forEach((d) => {
          const data = d.data();
          const resolvedDataName = data.productName || data.name || "";
          const fullName = resolvedDataName.toLowerCase();
          const brand = (data.brand || "").toLowerCase();
          const skuVal = (data.sku || "").toLowerCase();
          let score = 0;
          if (
            fullName.includes(queryLower) ||
            brand.includes(queryLower) ||
            skuVal.includes(queryLower)
          )
            score += 2;
          tokens.forEach((t) => {
            if (
              t.length >= 3 &&
              (fullName.includes(t) ||
                brand.includes(t) ||
                skuVal.includes(t))
            )
              score += 1;
          });
          if (score > 0)
            candidates.push({ id: d.id, ...data, __score: score });
        });
        candidates.sort((a, b) => (b.__score || 0) - (a.__score || 0));
      }
    } catch (e) {
      console.warn("Product lookup failed:", e.message);
    }
    const quantityNum = Math.max(1, parseFloat(qty || 1) || 1);
    if (found) {
      addSuggestedProductToCart(found, quantityNum);
      return;
    }
    const top = (candidates || []).slice(0, 1);
    if (top.length) addSuggestedProductToCart(top[0], quantityNum);
    else
      alert(
        `Didn't find a matching product for "${name}". Try again or type to search.`
      );
  };

  const setCustomerFromVoice = async (slots = {}) => {
    if (!userInfo) return;
    const { phone, name, email } = slots;
    try {
      if (phone) {
        const q = query(collection(db, "businesses", userInfo.uid, "customers"), where("phone", "==", String(phone)));
        const snap = await getDocs(q);
        let matched = null;
        snap.forEach(d => { if (!matched) matched = { custId: d.id, ...d.data() }; });
        if (matched) { setCustomer(matched); return; }
      }
    } catch (e) {
      console.warn("Customer lookup failed:", e.message);
    }
    setCustomer(prev => ({ ...prev, ...(name && { name }), ...(phone && { phone: String(phone) }), ...(email && { email }) }));
  };

  const setPaymentModeFromVoice = (mode) => {
    if (!mode) return;
    const m = String(mode).toLowerCase();
    const normalized = m === "upi" ? "UPI" : m === "card" ? "Card" : m === "credit" ? "Credit" : "Cash";
    setSettings(prev => ({ ...prev, paymentMode: normalized }));
  };

  const applyOrderCharge = ({ type, amount }) => {
    const amt = parseFloat(amount) || 0;
    const key = (String(type || "").toLowerCase());
    setSettings(prev => ({
      ...prev,
      deliveryCharge: key.includes("deliver") ? amt : prev.deliveryCharge,
      packingCharge: key.includes("pack") ? amt : prev.packingCharge,
      otherCharge: (!key.includes("deliver") && !key.includes("pack")) ? amt : prev.otherCharge,
    }));
  };

  // Compute tax breakdown once, in a mutually-exclusive order:
  // 1) IGST, else 2) CGST/SGST, else 3) generic GST.
  function calcTaxBreakdown(subtotal, s) {
    const safe = (v) => Math.max(0, parseFloat(v) || 0);
    let gstAmount = 0, cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

    if (s.includeIGST) {
      igstAmount = subtotal * (safe(s.igstRate) / 100);
    } else if (s.includeCGST || s.includeSGST) {
      cgstAmount = subtotal * (safe(s.cgstRate) / 100);
      sgstAmount = subtotal * (safe(s.sgstRate) / 100);
    } else if (s.includeGST) {
      gstAmount = subtotal * (safe(s.gstRate) / 100);
    }
    return { gstAmount, cgstAmount, sgstAmount, igstAmount };
  }

  /* ---------- Pricing helpers (row-wise, synced with BillingCart) ---------- */
  const computeLineBreakdown = (it) => {
    const qty = Math.max(0, parseFloat(it.quantity) || 0);
    const discPct = Math.max(0, Math.min(100, parseFloat(it.discount) || 0));

    // Normalized snapshot from BillingCart for MRP/Base+GST
    if (it?.normalized && (it.pricingMode === "MRP_INCLUSIVE" || it.pricingMode === "BASE_PLUS_GST")) {
      const unitNet = Math.max(0, parseFloat(it.normalized.unitPriceNet) || 0);
      const unitTax = Math.max(0, parseFloat(it.normalized.taxPerUnit) || 0);
      const r = unitNet > 0 ? unitTax / unitNet : 0;

      const unitNetAfterDisc = unitNet * (1 - discPct / 100);
      const unitGrossAfterDisc = unitNetAfterDisc * (1 + r);
      const unitTaxAfterDisc = unitGrossAfterDisc - unitNetAfterDisc;

      return {
        unitNet,
        unitTax,
        unitGross: unitNet * (1 + r),
        unitNetAfterDisc,
        unitTaxAfterDisc,
        unitGrossAfterDisc,
        lineNetAfterDisc: unitNetAfterDisc * qty,
        lineTaxAfterDisc: unitTaxAfterDisc * qty,
        lineGrossAfterDisc: unitGrossAfterDisc * qty,
      };
    }

    // SELLING_SIMPLE / LEGACY: price is NET; add inline GST on top
    if (it.pricingMode === "SELLING_SIMPLE" || it.pricingMode === "LEGACY") {
      const unitNet = Math.max(0, parseFloat(it.price) || 0);
      const rate = Math.max(0, parseFloat(it.inlineGstRate ?? it.gstRate ?? 0)) / 100;
      const unitNetAfterDisc = unitNet * (1 - discPct / 100);
      const unitGrossAfterDisc = unitNetAfterDisc * (1 + rate);
      const unitTaxAfterDisc = unitGrossAfterDisc - unitNetAfterDisc;

      return {
        unitNet,
        unitTax: unitNet * rate,
        unitGross: unitNet * (1 + rate),
        unitNetAfterDisc,
        unitTaxAfterDisc,
        unitGrossAfterDisc,
        lineNetAfterDisc: unitNetAfterDisc * qty,
        lineTaxAfterDisc: unitTaxAfterDisc * qty,
        lineGrossAfterDisc: unitGrossAfterDisc * qty,
      };
    }

    // Fallback: treat item.price as gross, apply discount only
    const unitGross = Math.max(0, parseFloat(it.price) || 0);
    const unitGrossAfterDisc = unitGross * (1 - discPct / 100);
    return {
      unitNet: unitGrossAfterDisc,
      unitTax: 0,
      unitGross,
      unitNetAfterDisc: unitGrossAfterDisc,
      unitTaxAfterDisc: 0,
      unitGrossAfterDisc,
      lineNetAfterDisc: unitGrossAfterDisc * qty,
      lineTaxAfterDisc: 0,
      lineGrossAfterDisc: unitGrossAfterDisc * qty,
    };
  };

  const enrichCartItems = (items) => {
    return (items || []).map((it) => {
      const b = computeLineBreakdown(it);
      return {
        ...it,
        unitPriceNet: b.unitNet,
        unitPriceGross: b.unitGross,
        unitPriceNetAfterDiscount: b.unitNetAfterDisc,
        unitTaxAfterDiscount: b.unitTaxAfterDisc,
        unitPriceGrossAfterDiscount: b.unitGrossAfterDisc,
        lineNetAfterDiscount: b.lineNetAfterDisc,
        lineTaxAfterDiscount: b.lineTaxAfterDisc,
        lineGrossAfterDiscount: b.lineGrossAfterDisc,
      };
    });
  };

  /* ---------- Totals ---------- */
  const computeTotals = () => {
    const enriched = enrichCartItems(cartItems);

    const rowSubtotal = enriched.reduce((s, it) => s + (parseFloat(it.lineNetAfterDiscount) || 0), 0);
    const rowTax = enriched.reduce((s, it) => s + (parseFloat(it.lineTaxAfterDiscount) || 0), 0);

    // By default, we DO NOT apply cart-level GST again to avoid double-tax when row GST is present.
    // If you want a manual override later, add a flag like settings.applyCartLevelTax === true.
    const gstAmount = 0, cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

    const charges =
      (parseFloat(settings.deliveryCharge) || 0) +
      (parseFloat(settings.packingCharge) || 0) +
      (parseFloat(settings.otherCharge) || 0);

    const grandTotal = parseFloat((rowSubtotal + rowTax + charges).toFixed(2));
    return { subtotal: rowSubtotal, gstAmount, cgstAmount, sgstAmount, igstAmount, rowTax, charges, grandTotal, enriched };
  };

  /* ---------- Fast Billing Actions (used by FastBillingMode) ---------- */
  const fastActions = {
    addItemByQuery: (entities) => addItemFromVoice(entities),

    updateQty: ({ lineKey, cartLineId, id, sku, name, qty }) => {
      const nextQty = Math.max(1, parseFloat(qty) || 1);
      setCartItems(prev => prev.map((it, idx) => {
        const key = it.cartLineId || it.id || `${it.sku || it.name}-${idx}`;
        if ((cartLineId && it.cartLineId === cartLineId) ||
            (id && it.id === id) ||
            (lineKey && key === lineKey) ||
            (!cartLineId && !id && name && it.name === name) ||
            (!cartLineId && !id && sku && it.sku === sku)) {
          return { ...it, quantity: nextQty };
        }
        return it;
      }));
    },

    setLineDiscount: ({ lineKey, cartLineId, id, discountPct, discountAmt }) => {
      setCartItems(prev => prev.map((it, idx) => {
        const key = it.cartLineId || it.id || `${it.sku || it.name}-${idx}`;
        const match = (cartLineId && it.cartLineId === cartLineId) || (id && it.id === id) || (lineKey && key === lineKey);
        if (!match) return it;
        let pct = discountPct;
        if (pct === undefined && discountAmt !== undefined) {
          const base = (parseFloat(it.quantity) || 0) * (parseFloat(it.price) || 0);
          pct = base > 0 ? (Number(discountAmt) / base) * 100 : 0;
        }
        const safePct = Math.max(0, Math.min(100, parseFloat(pct) || 0));
        return { ...it, discount: safePct };
      }));
    },

    removeItem: ({ lineKey, cartLineId, id }) => {
      setCartItems(prev => prev.filter((it, idx) => {
        const key = it.cartLineId || it.id || `${it.sku || it.name}-${idx}`;
        if (cartLineId && it.cartLineId === cartLineId) return false;
        if (id && it.id === id) return false;
        if (lineKey && key === lineKey) return false;
        return true;
      }));
      if (id) setSelectedProducts(prev => prev.filter(p => p.id !== id));
    },

    removeItemByName: (name) => {
      setCartItems(prev => prev.filter(it => it.name !== name));
      setSelectedProducts(prev => prev.filter(p => p.name !== name));
    },

    setCustomerByText: (payload) => setCustomerFromVoice(payload),
    setCharge: (key, amount) => applyOrderCharge({ type: key, amount }),
    setInvoiceType: (type) => setSettings(prev => ({ ...prev, invoiceType: type })),
    setGSTFlags: (flags) => { setSettings(prev => mapGstEntitiesToSettings(prev, flags)); },
    setPayment: (p) => setPaymentModeFromVoice(p.mode),

    saveInvoice: async ({ mode }) => {
      if (!userInfo) throw new Error("Missing user");
      if (cartItems.length === 0) throw new Error("Empty cart");
      const issuedAt = moment().format("YYYY-MM-DDTHH:mm:ss.SSSZ");
      const newInvoiceId = "INV-" + Math.random().toString(36).substr(2, 9).toUpperCase();
      const totals = computeTotals();

      let isPaid = false, paidOn = null, creditDueDate = null;
      if ((settings.paymentMode || "").toLowerCase() === "credit") {
        creditDueDate = settings.creditDueDate || moment().add(7, "days").format("YYYY-MM-DD");
      } else { isPaid = true; paidOn = issuedAt; }

      const cleanedSettings = { ...settings };
      delete cleanedSettings.splitCash;
      delete cleanedSettings.splitUPI;
      delete cleanedSettings.splitCard;
      delete cleanedSettings.splitPayment;

      const syncedSplitPaymentSrc = settings.splitPayment || splitPayment || {};
      const syncedSplitPayment = {
        cash: Number(syncedSplitPaymentSrc.cash) || 0,
        upi:  Number(syncedSplitPaymentSrc.upi)  || 0,
        card: Number(syncedSplitPaymentSrc.card) || 0,
      };

      const payload = {
        customer,
        custId: customer && customer.custId ? customer.custId : undefined,
        cartItems: totals.enriched,
        settings: cleanedSettings,
        paymentMode: settings.paymentMode,
        invoiceType: settings.invoiceType,
        issuedAt,
        invoiceId: newInvoiceId,
        totalAmount: totals.grandTotal,
        splitPayment: syncedSplitPayment,
        creditDueDate,
        isPaid,
        paidOn,
        chargesSnapshot: {
          delivery: parseFloat(settings.deliveryCharge) || 0,
          packing: parseFloat(settings.packingCharge) || 0,
          other: parseFloat(settings.otherCharge) || 0,
        },
        taxSnapshot: {
          rowTax: totals.rowTax,
          cartLevel: { gst: totals.gstAmount, cgst: totals.cgstAmount, sgst: totals.sgstAmount, igst: totals.igstAmount },
        },
        mode: mode || "fast",
      };

      const invoiceRef = doc(db, "businesses", userInfo.uid, "finalizedInvoices", newInvoiceId);
      const toWrite = stripUndefinedDeep({ ...payload, createdAt: issuedAt });
      const bad = findUndefinedPaths(toWrite);
      if (bad.length) console.warn("[CreateInvoice fast save] undefined at:", bad);
      await setDoc(invoiceRef, toWrite);
      await updateInventoryStock(userInfo.uid, cartItems);
      setInvoiceId(newInvoiceId);
      setInvoiceData(payload);
      return newInvoiceId;
    },

    undo: undefined,
    canUndo: false,
    get cart() { return cartItems; },
    get totals() { return computeTotals(); },
  };

  const handleCustomerChange = (updated) => setCustomer(updated);

  const handleSubmitInvoice = async () => {
    if (!userInfo) { alert("User not authenticated or user info missing."); return; }
    if (cartItems.length === 0) { alert("Cart is empty. Please add products to generate invoice."); return; }

    const issuedAt = moment().format("YYYY-MM-DDTHH:mm:ss.SSSZ");
    const newInvoiceId = "INV-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    setInvoiceId(newInvoiceId);

    try {
      if (customer && customer.custId) {
        const customerRef = doc(db, "businesses", userInfo.uid, "customers", customer.custId);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          const existingData = customerSnap.data();
          const mergedCustomer = { ...existingData, ...customer, updatedAt: issuedAt };
          await updateDoc(customerRef, mergedCustomer);
        } else {
          await setDoc(customerRef, { ...customer, createdAt: issuedAt });
        }
      }
    } catch (err) {
      console.error("Error saving/updating customer:", err);
      alert("Failed to save customer info. Please try again.");
      return;
    }

    const totals = computeTotals();
    const totalAmount = totals.grandTotal;

    if (settings.paymentMode === "Split") {
      const totalSplit = (Number(splitPayment.cash)||0) + (Number(splitPayment.upi)||0) + (Number(splitPayment.card)||0);
      if (totalSplit !== totalAmount) {
        alert(`Split payment does not match invoice total. Total: ₹${totalAmount}, Split: ₹${totalSplit}`);
        return;
      }
    }

    let isPaid = false, paidOn = null, creditDueDate = null;
    if (settings.paymentMode?.toLowerCase() === "credit") {
      creditDueDate = settings.creditDueDate || moment().add(7, "days").format("YYYY-MM-DD");
    } else { isPaid = true; paidOn = issuedAt; }

    const cleanedSettings = { ...settings };
    delete cleanedSettings.splitCash;
    delete cleanedSettings.splitUPI;
    delete cleanedSettings.splitCard;
    delete cleanedSettings.splitPayment;

    const syncedSplitPayment = settings.splitPayment || splitPayment;

    const newInvoiceData = {
      customer,
      custId: customer && customer.custId ? customer.custId : undefined,
      cartItems: totals.enriched,
      settings: cleanedSettings,
      paymentMode: settings.paymentMode,
      invoiceType: settings.invoiceType,
      issuedAt,
      invoiceId: newInvoiceId,
      totalAmount,
      splitPayment: syncedSplitPayment,
      creditDueDate,
      isPaid,
      paidOn,
      chargesSnapshot: {
        delivery: parseFloat(settings.deliveryCharge) || 0,
        packing: parseFloat(settings.packingCharge) || 0,
        other: parseFloat(settings.otherCharge) || 0,
      },
      taxSnapshot: {
        rowTax: totals.rowTax,
        cartLevel: { gst: totals.gstAmount, cgst: totals.cgstAmount, sgst: totals.sgstAmount, igst: totals.igstAmount },
      },
    };
    setInvoiceData(newInvoiceData);
    setShowPreview({ visible: true, issuedAt });
  };

  const handleCancelPreview = () => setShowPreview({ visible: false, issuedAt: null });

  if (showPreview.visible && userInfo && invoiceData) {
    return (
      <InvoicePreview
        customer={customer}
        cartItems={cartItems}
        settings={settings}
        paymentMode={settings.paymentMode}
        invoiceType={settings.invoiceType}
        issuedAt={showPreview.issuedAt}
        invoiceId={invoiceId}
        onCancel={handleCancelPreview}
        onConfirm={async () => {
          try {
            const invoiceRef = doc(db, "businesses", userInfo.uid, "finalizedInvoices", invoiceId);
            const toWrite = stripUndefinedDeep({
              ...invoiceData,
              createdAt: invoiceData.issuedAt,
              isPaid: invoiceData.isPaid,
              paidOn: invoiceData.paidOn,
              creditDueDate: invoiceData.creditDueDate
            });
            const bad = findUndefinedPaths(toWrite);
            if (bad.length) console.warn("[CreateInvoice preview confirm] undefined at:", bad);
            await setDoc(invoiceRef, toWrite);
            console.log("Invoice saved to Firestore:", invoiceId);
            await updateInventoryStock(userInfo.uid, cartItems);
          } catch (error) {
            console.error("Error saving invoice:", error.message);
            alert("Failed to save invoice. Please try again.");
            return;
          }
          setShowPreview({ visible: false, issuedAt: null });
        }}
        taxRates={{
          gst: settings.gstRate,
          cgst: settings.cgstRate,
          sgst: settings.sgstRate,
          igst: settings.igstRate
        }}
        userInfo={{
          businessName: userInfo.businessName || "N/A",
          ownerName: userInfo.ownerName || "N/A",
          address: userInfo.address || "N/A",
          phone: userInfo.phone || "N/A",
          email: userInfo.email || "N/A",
          gstin: userInfo.gstin || "N/A",
          pan: userInfo.pan || "N/A"
        }}
      />
    );
  }

  /* ---------- Page ---------- */
  return (
    <div className="space-y-6 px-4 md:px-6 pb-32 pt-[env(safe-area-inset-top)] text-white">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Billing</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/70">Mode:</span>
          <button className={`px-3 py-1 rounded-xl border ${!fastMode ? "bg-white/10" : ""}`} onClick={() => setFastMode(false)}>Classic</button>
          <button className={`px-3 py-1 rounded-xl border ${fastMode ? "bg-white/10" : ""}`} onClick={() => setFastMode(true)}>Fast Billing</button>
        </div>
      </div>

      {fastMode ? (
        (() => {
          const handleVoiceCommand = (text) => { console.log("Final Voice Command:", text); };
          return (
            <div className="space-y-4 px-4 md:px-6 pb-24 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Fast Billing</h2>
                <button onClick={() => setFastMode(false)} className="px-3 py-1 rounded-xl border border-white/20">Exit</button>
              </div>
              <FastBillingMode
                onExit={() => setFastMode(false)}
                actions={fastActions}
                onVoiceCommand={handleVoiceCommand}
                fallbackToWhisper={true}
                whisperFallbackApi="/api/voice/fallback"
                inventory={selectedProducts}
                settings={settings}
              />
            </div>
          );
        })()
      ) : (
        <>
          {/* Customer Info */}
          <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
            <h2 className="text-lg font-semibold mb-2 text-white">Customer Information</h2>
            {userInfo && (
              <CustomerForm customer={customer} onChange={handleCustomerChange} userId={userInfo.uid} />
            )}
          </div>

          {/* Product Search */}
          <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-white">Add Product</h2>
            </div>
            <ProductSearch
              onSelect={(product) => {
                if (!product) return;
                const resolvedName =
                  product.productName || product.name || product.title || product.label || "";

                // Build a full product payload for BillingCart to normalize correctly
                const fullProduct = {
                  id: product.id,
                  ...product,
                  productName: resolvedName,
                  // ensure expected fields exist
                  pricingMode:
                    product.pricingMode || (product.mrp ? "MRP_INCLUSIVE" : "SELLING_SIMPLE"),
                  gstRate: product.gstRate ?? product.taxRate ?? 0,
                  sellingIncludesGst:
                    product.sellingIncludesGst ?? (product.pricingMode !== "BASE_PLUS_GST"),
                };

                // Dedupe by id
                const alreadyExists = selectedProducts.find((p) => p.id === fullProduct.id);
                if (!alreadyExists) {
                  setSelectedProducts((prev) => [...prev, fullProduct]);
                }
                // IMPORTANT: Do NOT push to cartItems here. BillingCart listens to selectedProducts
                // and will add a single normalized line with correct breakdown.
              }}
            />
          </div>

          {/* Invoice Settings */}
          <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
            <InvoiceSettings settings={settings} onChange={setSettings} />
            {settings.paymentMode === "Split" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">Cash Amount</label>
                  <input
                    type="number"
                    value={splitPayment.cash}
                    onChange={(e) => setSplitPayment(prev => ({ ...prev, cash: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">UPI Amount</label>
                  <input
                    type="number"
                    value={splitPayment.upi}
                    onChange={(e) => setSplitPayment(prev => ({ ...prev, upi: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">Card Amount</label>
                  <input
                    type="number"
                    value={splitPayment.card}
                    onChange={(e) => setSplitPayment(prev => ({ ...prev, card: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
              </div>
            )}
            {settings.paymentMode === "Credit" && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-white/80 mb-1">Credit Due Date (Default: 7 days from today)</label>
                <input
                  type="date"
                  className="w-full rounded px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  value={settings.creditDueDate || ""}
                  onChange={(e) => setSettings(prev => ({ ...prev, creditDueDate: e.target.value }))}
                />
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
            <h2 className="text-lg font-semibold mb-2 text-white">Product Cart</h2>
            <BillingCart
              selectedProducts={selectedProducts}
              cartItems={cartItems}
              onUpdateCart={setCartItems}
              settings={settings}
            />
          </div>

          {/* Submit Button */}
          <div className="hidden md:flex justify-end">
            <button
              onClick={handleSubmitInvoice}
              className="px-6 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] transition"
            >
              Create Bill
            </button>
          </div>
          {/* Mobile Floating Button */}
          <div className="fixed bottom-4 inset-x-4 z-50 md:hidden">
            <button
              onClick={handleSubmitInvoice}
              className="w-full text-slate-900 py-3 rounded-xl shadow-lg text-lg font-semibold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)]"
            >
              Create Bill
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CreateInvoice;