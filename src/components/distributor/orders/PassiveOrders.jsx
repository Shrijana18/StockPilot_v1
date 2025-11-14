import React, { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, serverTimestamp, getDocs, getDoc, doc, query, where } from "firebase/firestore";
import { db, empDB, empAuth, auth } from "../../../firebase/firebaseConfig";
import { getDistributorEmployeeSession } from "../../../utils/distributorEmployeeSession";
import { toast } from "react-toastify";
import { ORDER_STATUSES } from "../../../constants/orderStatus";
import * as orderPolicy from "../../../lib/orders/orderPolicy";
import { calculateProforma } from "../../../lib/calcProforma";
import { splitFromMrp } from "../../../utils/pricing";

/**
 * PassiveOrders.jsx
 * Distributor → (Provisional/Connected) Retailer
 * Step-by-step flow (Retailer → Products → Review) in a single file.
 * Tailwind-only, clean dark UI. Works with your existing Firestore schema.
 */

// ---------- Helpers ----------
const money = (n) => {
  const x = Number(n || 0);
  return x.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
const norm = (s) => (s || "").toLowerCase().trim();


// Normalize cart items to schema expected by downstream screens
const normalizeCartItems = (cart) =>
  (cart || []).map((i) => ({
    productName: i.productName || i.name || 'Item',
    name: i.name || i.productName || 'Item',
    sku: i.sku || null,
    brand: i.brand || null,
    category: i.category || null,
    unit: i.unit || null,
    quantity: Number(i.qty || 0),
    qty: Number(i.qty || 0),
    // Pricing fields - use selected price based on pricing mode
    price: Number(i.sellingPrice || i.price || 0), // preferred by TrackOrders
    unitPrice: Number(i.sellingPrice || i.price || 0), // compatibility
    sellingPrice: Number(i.sellingPrice || i.price || 0),
    mrp: Number(i.mrp || 0),
    basePrice: Number(i.basePrice || 0),
    costPrice: Number(i.costPrice || 0),
    // Tax fields
    gstRate: Number(i.gstRate || i.taxRate || 0),
    taxRate: Number(i.taxRate || i.gstRate || 0),
    // Other fields
    hsnCode: i.hsnCode || null,
    pricingMode: i.pricingMode || "LEGACY", // CRITICAL: Preserve pricing mode for GST calculation
    // Calculated
    lineTotal: Number(i.qty || 0) * Number(i.sellingPrice || i.price || 0),
  }));

const PAYMENT_MODES = [
  { label: "Cash", value: "Cash" },
  { label: "Credit", value: "Credit" },
  { label: "Cash on Delivery", value: "COD" },
  { label: "Advance", value: "Advance" },
];

// Quick picks placeholder (replace with your inventory feed)
const QUICK_PICKS = [
  { id: "SKU-001", name: "Parle-G 100g", sku: "PG100", brand: "Parle", unit: "pkt", price: 8 },
  { id: "SKU-002", name: "Amul Butter 100g", sku: "AB100", brand: "Amul", unit: "pkt", price: 55 },
  { id: "SKU-003", name: "Marie 250g", sku: "BM250", brand: "Britannia", unit: "pkt", price: 30 },
];

const DEBUG = true; // Enable debug logging to troubleshoot retailer type detection

// ---------- Component ----------
export default function PassiveOrders() {
  const [step, setStep] = useState(1); // 1 Retailer, 2 Products, 3 Review
  const [distributorId, setDistributorId] = useState(null);

  // Step 1: Retailer
  const [retailerQuery, setRetailerQuery] = useState("");
  const [retailerOpen, setRetailerOpen] = useState(false); // harmless now; kept for future focus UX
  const [selectedRetailer, setSelectedRetailer] = useState(null); // {id, displayName, phone, email, type: "provisional"|"connected"}
  const [retailerResults, setRetailerResults] = useState([]);
  const [retailerLoading, setRetailerLoading] = useState(false);

  // Step 2: Products
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [cart, setCart] = useState([]); // {key,name,sku,brand,unit,qty,price}
  // Derived totals
  const cartTotal = useMemo(
    () => cart.reduce((sum, i) => sum + Number(i.qty || 0) * Number(i.price || 0), 0),
    [cart]
  );

  // Step 3: Review & Meta
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentMode, setPaymentMode] = useState(PAYMENT_MODES[0].value);
  const [creditDays, setCreditDays] = useState(15);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const searchInputRef = useRef(null);

  // Resolve distributorId from session (for employees) or auth (for distributor owner)
  useEffect(() => {
    // Priority: Check session first (for distributor employees)
    const session = getDistributorEmployeeSession();
    if (session?.distributorId) {
      setDistributorId(session.distributorId);
      return;
    }

    // Fallback: Check main auth (for distributor owner)
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setDistributorId(u.uid);
    });
    // Also set immediately if already available
    if (auth.currentUser) {
      setDistributorId(auth.currentUser.uid);
    }
    return () => unsub();
  }, []);

  // --- Firestore Retailer Search (Live) ---
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!distributorId) { setRetailerResults([]); return; }
      setRetailerLoading(true);

      let connected = [];
      let provisional = [];

      // Use empDB ONLY if employee is logged in AND has valid empAuth
      // For distributor owners, must use db so Security Rules see primary auth
      const session = getDistributorEmployeeSession();
      const hasEmployeeAuth = session && empAuth.currentUser;
      const firestore = hasEmployeeAuth ? empDB : db;

      // Read connectedRetailers (allowed by rules for owner)
      try {
        const conRef = collection(firestore, "businesses", distributorId, "connectedRetailers");
        const conSnap = await getDocs(conRef);
        connected = conSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}), __src: "connected" }));
        if (DEBUG) console.log("[Retailers] connectedRetailers size:", conSnap.size);
      } catch (e) {
        if (DEBUG) console.warn("[Retailers] connectedRetailers read blocked by rules or missing path:", e);
      }

      // Read provisionalRetailers (may be blocked by global rule; do not fail overall)
      try {
        const provRef = collection(firestore, "businesses", distributorId, "provisionalRetailers");
        const provSnap = await getDocs(provRef);
        provisional = provSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}), __src: "provisional" }));
        if (DEBUG) console.log("[Retailers] provisionalRetailers size:", provSnap.size);
      } catch (e) {
        if (DEBUG) console.warn("[Retailers] provisionalRetailers read blocked by rules or missing path:", e);
      }

      // Also read global provisionalRetailers collection to cross-reference
      // This helps identify retailers in connectedRetailers that have a provisionalId
      let globalProvisionalIds = new Set();
      try {
        const globalProvRef = collection(firestore, "provisionalRetailers");
        const globalProvSnap = await getDocs(globalProvRef);
        globalProvisionalIds = new Set(globalProvSnap.docs.map(d => d.id));
        if (DEBUG) console.log("[Retailers] Global provisionalRetailers size:", globalProvSnap.size);
      } catch (e) {
        if (DEBUG) console.warn("[Retailers] Global provisionalRetailers read blocked by rules:", e);
      }

      const all = [...connected, ...provisional]
        .map((r) => {
          // Determine if retailer is provisional
          // Check multiple indicators: source collection, source field, status, and provisionalId
          const hasProvisionalId = r.provisionalId && 
            (typeof r.provisionalId === 'string' ? r.provisionalId.trim().length > 0 : true);
          
          // Check if provisionalId exists in global provisionalRetailers collection
          const hasValidProvisionalId = hasProvisionalId && globalProvisionalIds.has(r.provisionalId);
          
          const isProvisional = 
            r.__src === "provisional" ||
            (typeof r.source === "string" && r.source.toLowerCase().startsWith("provisioned")) ||
            (typeof r.status === "string" && r.status.toLowerCase().startsWith("provisioned")) ||
            hasValidProvisionalId ||
            hasProvisionalId; // Fallback: if provisionalId exists but we couldn't verify, still mark as provisional
          
          // DEBUG: Log retailer data for troubleshooting
          if (DEBUG) {
            console.log('[PassiveOrders] Retailer data:', {
              id: r.retailerId || r.id,
              displayName: r.retailerName || r.name || r.displayName || r.shopName,
              __src: r.__src,
              source: r.source,
              status: r.status,
              provisionalId: r.provisionalId,
              isProvisional,
              rawData: r
            });
          }
          
          return {
            id: r.retailerId || r.id,
            displayName: r.retailerName || r.name || r.displayName || r.shopName || "Retailer",
            phone: r.retailerPhone || r.phone || "",
            email: r.retailerEmail || r.email || "",
            city: r.retailerCity || r.city || "",
            state: r.retailerState || r.state || "",
            address: r.retailerAddress || r.address || "",
            type: isProvisional ? "provisional" : "connected",
            provisionalId: r.provisionalId || (r.__src === "provisional" ? r.id : null),
            status: r.status || "",
            source: r.source || "", // Preserve source field (important for provisional detection)
            // Preserve raw data for verification
            rawData: r
          };
        })
        .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

      const qtxt = norm(retailerQuery);
      const filtered = qtxt
        ? all.filter(
            (r) =>
              norm(r.displayName).includes(qtxt) ||
              norm(r.email).includes(qtxt) ||
              norm(r.phone).includes(qtxt)
          )
        : all;

      if (alive) {
        setRetailerResults(filtered.slice(0, 50));
        setRetailerLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [retailerQuery, distributorId]);

  // --- Firestore Product/Inventory Search (Live) ---
  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!distributorId) return;

      let items = [];

      // Use empDB ONLY if employee is logged in AND has valid empAuth
      // For distributor owners, must use db so Security Rules see primary auth
      const session = getDistributorEmployeeSession();
      const hasEmployeeAuth = session && empAuth.currentUser;
      const firestore = hasEmployeeAuth ? empDB : db;

      // 1) Try /inventory
      try {
        const invRef = collection(firestore, "businesses", distributorId, "inventory");
        const invSnap = await getDocs(invRef);
        if (invSnap.size > 0) {
          items = invSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
          if (DEBUG) console.log("[Inventory] Using /inventory:", invSnap.size);
        }
      } catch (e) {
        if (DEBUG) console.warn("[Inventory] /inventory blocked by rules or missing:", e);
      }

      // 2) Fallback to /products
      if (!items.length) {
        try {
          const prodRef = collection(firestore, "businesses", distributorId, "products");
          const prodSnap = await getDocs(prodRef);
          if (prodSnap.size > 0) {
            items = prodSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
            if (DEBUG) console.log("[Inventory] Using /products:", prodSnap.size);
          }
        } catch (e) {
          if (DEBUG) console.warn("[Inventory] /products blocked by rules or missing:", e);
        }
      }

      // 3) Fallback to /items (POS)
      if (!items.length) {
        try {
          const posRef = collection(firestore, "businesses", distributorId, "items");
          const posSnap = await getDocs(posRef);
          if (posSnap.size > 0) {
            items = posSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
            if (DEBUG) console.log("[Inventory] Using /items:", posSnap.size);
          }
        } catch (e) {
          if (DEBUG) console.warn("[Inventory] /items blocked by rules or missing:", e);
        }
      }

      const normalized = items.map((it) => ({
        id: it.id,
        name: it.name || it.productName || it.title || "Unnamed",
        productName: it.productName || it.name || it.title || "Unnamed",
        sku: it.sku || it.SKU || it.code || "",
        brand: it.brand || it.Brand || "",
        category: it.category || it.Category || "",
        unit: it.unit || it.Unit || it.measure || "",
        // Pricing fields
        sellingPrice: Number(it.sellingPrice ?? it.selling_price ?? it.price ?? 0),
        mrp: Number(it.mrp ?? it.MRP ?? 0),
        basePrice: Number(it.basePrice ?? it.base_price ?? 0),
        costPrice: Number(it.costPrice ?? it.cost_price ?? 0),
        // Tax fields
        gstRate: Number(it.gstRate ?? it.taxRate ?? it.gst ?? it.tax ?? 0),
        taxRate: Number(it.taxRate ?? it.gstRate ?? it.tax ?? it.gst ?? 0),
        // Other fields
        hsnCode: it.hsnCode || it.hsn || "",
        pricingMode: it.pricingMode || it.pricing_mode || "LEGACY",
        // Fallback price for display
        price: Number(it.sellingPrice ?? it.selling_price ?? it.price ?? it.mrp ?? 0),
      }));

      if (alive) setCatalog(normalized);
    };

    load();
    return () => {
      alive = false;
    };
  }, [distributorId]);

  // Suggestions from catalog (live filter)
  useEffect(() => {
    const q = norm(search);
    if (!q) return setSuggestions([]);
    const list = catalog.filter(
      (p) => norm(p.name).includes(q) || norm(p.sku).includes(q) || norm(p.brand).includes(q)
    );
    setSuggestions(list.slice(0, 20));
  }, [search, catalog]);

  // ---------- Product Handlers ----------
  const addItem = (p, qty = 1, selectedPricingMode = null) => {
    setCart((prev) => {
      const key = p.id || `${p.sku}-${p.name}`;
      const idx = prev.findIndex((i) => i.key === key);
      
      // Determine pricing mode and price based on selection
      // If pricingMode is provided, use it; otherwise default based on available prices
      let pricingMode = selectedPricingMode || p.pricingMode || "LEGACY";
      let selectedPrice = 0;
      
      if (selectedPricingMode === "MRP_INCLUSIVE" && p.mrp > 0) {
        selectedPrice = p.mrp;
        pricingMode = "MRP_INCLUSIVE";
      } else if (selectedPricingMode === "BASE_PLUS_TAX" && p.basePrice > 0) {
        selectedPrice = p.basePrice;
        pricingMode = "BASE_PLUS_TAX";
      } else if (selectedPricingMode === "SELLING_PRICE" || p.sellingPrice > 0) {
        selectedPrice = p.sellingPrice || p.price || 0;
        pricingMode = selectedPricingMode || "SELLING_PRICE";
      } else {
        // Fallback: use whatever price is available
        selectedPrice = p.sellingPrice || p.price || p.mrp || p.basePrice || 0;
        pricingMode = "LEGACY";
      }
      
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = { ...clone[idx], qty: Number(clone[idx].qty) + Number(qty) };
        return clone;
      }
      return [
        ...prev,
        {
          key,
          // Basic info
          name: p.name || p.productName || "Unnamed",
          productName: p.productName || p.name || "Unnamed",
          sku: p.sku || null,
          brand: p.brand || null,
          category: p.category || null,
          unit: p.unit || null,
          // Pricing - use selected price based on pricing mode
          sellingPrice: selectedPrice,
          mrp: Number(p.mrp ?? 0),
          basePrice: Number(p.basePrice ?? 0),
          costPrice: Number(p.costPrice ?? 0),
          // Tax
          gstRate: Number(p.gstRate ?? p.taxRate ?? 0),
          taxRate: Number(p.taxRate ?? p.gstRate ?? 0),
          // Other
          hsnCode: p.hsnCode || null,
          pricingMode: pricingMode, // Store the selected pricing mode
          // Quantity & calculated
          qty: Number(qty),
          price: selectedPrice, // Use selected price
        },
      ];
    });
  };
  
  // Update pricing mode for a cart item
  const updateCartItemPricingMode = (key, pricingMode) => {
    setCart((prev) => prev.map((item) => {
      if (item.key === key) {
        let newPrice = item.sellingPrice;
        // Update price based on new pricing mode
        if (pricingMode === "MRP_INCLUSIVE" && item.mrp > 0) {
          newPrice = item.mrp;
        } else if (pricingMode === "BASE_PLUS_TAX" && item.basePrice > 0) {
          newPrice = item.basePrice;
        } else if (pricingMode === "SELLING_PRICE") {
          // Keep current selling price or use original
          newPrice = item.sellingPrice || item.price || 0;
        }
        return {
          ...item,
          pricingMode,
          sellingPrice: newPrice,
          price: newPrice,
        };
      }
      return item;
    }));
  };

  const removeItem = (key) => setCart((prev) => prev.filter((i) => i.key !== key));
  const inc = (key) => setCart((prev) => prev.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i)));
  const dec = (key) =>
    setCart((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, qty: Math.max(0, i.qty - 1) } : i))
        .filter((i) => i.qty > 0)
    );
  const setQty = (key, val) =>
    setCart((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, qty: Math.max(0, Number.isInteger(+val) ? +val : i.qty) } : i))
        .filter((i) => i.qty > 0)
    );

  const onPickSuggestion = (p) => {
    addItem(p, 1);
    setSearch("");
    setSuggestions([]);
    setActiveIndex(-1);
    searchInputRef.current?.focus();
  };

  const onSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      const val = search.trim();
      if (activeIndex >= 0 && suggestions[activeIndex]) return onPickSuggestion(suggestions[activeIndex]);
      if (val) {
        const exact =
          catalog.find((p) => norm(p.sku) === norm(val)) || catalog.find((p) => norm(p.name) === norm(val));
        if (exact) return onPickSuggestion(exact);
      }
      if (suggestions.length) return onPickSuggestion(suggestions[0]);
    } else if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  };

  // ---------- Review / Submit ----------
  const validate = () => {
    if (!selectedRetailer) return "Select a retailer";
    if (cart.length === 0) return "Add at least one product";
    if (!deliveryDate) return "Select a delivery date";
    if (paymentMode === "Credit" && (!creditDays || Number(creditDays) <= 0)) return "Credit days must be > 0";
    if (paymentMode === "Advance" && (!advanceAmount || Number(advanceAmount) <= 0)) return "Advance amount must be > 0";
    return "";
  };

  const resetForm = () => {
    setStep(1);
    setRetailerQuery("");
    setRetailerOpen(false);
    setSelectedRetailer(null);
    setSearch("");
    setSuggestions([]);
    setActiveIndex(-1);
    setCart([]);
    setDeliveryDate("");
    setPaymentMode(PAYMENT_MODES[0].value);
    setCreditDays(15);
    setAdvanceAmount(0);
    setNotes("");
  };

  const handleCreateOrder = async () => {
    const err = validate();
    if (err) return toast.error(err);
    
    if (!distributorId) {
      return toast.error("Distributor ID not found. Please refresh and try again.");
    }

    try {
      setSubmitting(true);
      const safeRetailerName = (selectedRetailer?.displayName || "").trim();

      // Get employee session if available (for distributor employees)
      const session = getDistributorEmployeeSession();
      const isEmployee = !!session;
      const ownerAuth = auth.currentUser; // Use imported auth directly
      const employeeAuth = empAuth.currentUser;

      // Determine creator info
      let creatorUid = null;
      let creatorEmail = null;
      let createdByInfo = null;

      if (isEmployee && employeeAuth) {
        // Distributor employee creating order
        creatorUid = employeeAuth.uid; // Employee auth UID (from custom token)
        createdByInfo = {
          type: 'employee',
          uid: employeeAuth.uid,
          employeeId: session.employeeId, // Employee document ID
          name: session.name || null,
          flypEmployeeId: null // Can be added if available in session
        };
      } else if (ownerAuth) {
        // Distributor owner creating order
        creatorUid = ownerAuth.uid;
        creatorEmail = ownerAuth.email || null;
        createdByInfo = {
          type: 'distributor',
          uid: ownerAuth.uid,
          name: ownerAuth.displayName || null
        };
      } else {
        return toast.error("Please login to create order.");
      }

      // CRITICAL: Always use db (primary app) for distributor owners
      // Only use empDB if employee is logged in AND has valid empAuth
      // For distributor owners, must use db so Security Rules see primary auth
      const firestore = (isEmployee && employeeAuth) ? empDB : db;

      // CRITICAL VALIDATION: For distributor owners, ensure distributorId matches ownerAuth.uid
      if (!isEmployee && ownerAuth && distributorId !== ownerAuth.uid) {
        console.error('[PassiveOrders] MISMATCH: distributorId does not match owner UID', {
          distributorId,
          ownerUid: ownerAuth.uid
        });
        return toast.error("Distributor ID mismatch. Please refresh and try again.");
      }

      // CRITICAL: Validate selectedRetailer type before creating order
      // Double-check the retailer type by checking its data in Firestore
      let isProvisionalRetailer = selectedRetailer.type === "provisional";
      
      // Additional validation: Re-check retailer data if type seems wrong
      if (
        !isProvisionalRetailer && (
          selectedRetailer.provisionalId ||
          (typeof selectedRetailer.status === "string" && selectedRetailer.status.toLowerCase().startsWith("provisioned")) ||
          (typeof selectedRetailer.source === "string" && selectedRetailer.source.toLowerCase().startsWith("provisioned"))
        )
      ) {
        console.warn('[PassiveOrders] Retailer type mismatch detected! Retailer has provisional indicators but type is "connected". Re-checking...', {
          selectedRetailer,
          provisionalId: selectedRetailer.provisionalId,
          status: selectedRetailer.status,
          source: selectedRetailer.source
        });
        // Force provisional if we have clear indicators
        isProvisionalRetailer = true;
      }

      // CRITICAL: Final verification by checking Firestore directly
      // This ensures we have the most up-to-date retailer information
      // We need to check multiple ways because provisional retailers can be stored differently
      try {
        let verifiedIsProvisional = false;
        let verificationSource = null;
        let verificationData = null;

        // Method 1: Check provisionalRetailers collection by provisionalId (most reliable)
        if (selectedRetailer.provisionalId) {
          try {
            const provisionalRetailerRef = doc(firestore, "provisionalRetailers", selectedRetailer.provisionalId);
            const provisionalRetailerSnap = await getDoc(provisionalRetailerRef);
            if (provisionalRetailerSnap.exists()) {
              const provData = provisionalRetailerSnap.data();
              verifiedIsProvisional = true;
              verificationSource = "provisionalRetailers";
              verificationData = provData;
              console.log('[PassiveOrders] Firestore verification: Retailer is PROVISIONAL (found in provisionalRetailers collection)', {
                provisionalId: selectedRetailer.provisionalId,
                status: provData.status
              });
            }
          } catch (provError) {
            console.warn('[PassiveOrders] Failed to check provisionalRetailers:', provError);
          }
        }

        // Method 2: Search connectedRetailers by provisionalId (if not already verified)
        if (!verifiedIsProvisional && selectedRetailer.provisionalId) {
          try {
            const connectedRetailersRef = collection(firestore, "businesses", distributorId, "connectedRetailers");
            const q = query(connectedRetailersRef, where("provisionalId", "==", selectedRetailer.provisionalId));
            const querySnap = await getDocs(q);
            if (!querySnap.empty) {
              const connectedData = querySnap.docs[0].data();
              // Check if this connected retailer is actually provisional
              // NOTE: Cloud function sets status to "accepted" but source is "provisioned" for provisional retailers
              if (
                connectedData.provisionalId ||
                (typeof connectedData.source === "string" && connectedData.source.toLowerCase().startsWith("provisioned")) ||
                (typeof connectedData.status === "string" && connectedData.status.toLowerCase().startsWith("provisioned")) ||
                connectedData.status === "provisional" ||
                (connectedData.status === "accepted" && typeof connectedData.source === "string" && connectedData.source.toLowerCase().startsWith("provisioned"))
              ) {
                verifiedIsProvisional = true;
                verificationSource = "connectedRetailers (by provisionalId)";
                verificationData = connectedData;
                console.log('[PassiveOrders] Firestore verification: Retailer is PROVISIONAL (found in connectedRetailers by provisionalId)', {
                  provisionalId: selectedRetailer.provisionalId,
                  source: connectedData.source,
                  status: connectedData.status
                });
              }
            }
          } catch (queryError) {
            console.warn('[PassiveOrders] Failed to query connectedRetailers by provisionalId:', queryError);
          }
        }

        // Method 3: Check connectedRetailers by document ID (fallback)
        if (!verifiedIsProvisional) {
          try {
            const connectedRetailerRef = doc(firestore, "businesses", distributorId, "connectedRetailers", selectedRetailer.id);
            const connectedRetailerSnap = await getDoc(connectedRetailerRef);
            
            if (connectedRetailerSnap.exists()) {
              const connectedData = connectedRetailerSnap.data();
              // Check if this connected retailer is actually provisional
              // NOTE: Cloud function sets status to "accepted" but source is "provisioned"
              if (
                connectedData.provisionalId ||
                (typeof connectedData.source === "string" && connectedData.source.toLowerCase().startsWith("provisioned")) ||
                (typeof connectedData.status === "string" && connectedData.status.toLowerCase().startsWith("provisioned")) ||
                connectedData.status === "provisional"
              ) {
                verifiedIsProvisional = true;
                verificationSource = "connectedRetailers (by document ID)";
                verificationData = connectedData;
                console.log('[PassiveOrders] Firestore verification: Retailer is PROVISIONAL (found in connectedRetailers by document ID)', {
                  retailerId: selectedRetailer.id,
                  provisionalId: connectedData.provisionalId,
                  source: connectedData.source,
                  status: connectedData.status
                });
              }
            }
          } catch (docError) {
            console.warn('[PassiveOrders] Failed to check connectedRetailers by document ID:', docError);
          }
        }

        // Use verified result if we got one
        if (verifiedIsProvisional) {
          isProvisionalRetailer = true;
          console.log('[PassiveOrders] Final verification result: PROVISIONAL', {
            verificationSource,
            verificationData
          });
        } else {
          console.log('[PassiveOrders] Firestore verification: No provisional indicators found, using fallback logic', {
            selectedRetailerType: selectedRetailer.type,
            selectedRetailerProvisionalId: selectedRetailer.provisionalId,
            selectedRetailerStatus: selectedRetailer.status
          });
        }
      } catch (firestoreError) {
        console.error('[PassiveOrders] Firestore verification failed (using fallback logic):', firestoreError);
        // If Firestore check fails, rely on the existing logic
        // Don't change isProvisionalRetailer if verification fails
      }
      
      console.log('[PassiveOrders] Creating order:', {
        isEmployee,
        hasEmployeeAuth: !!employeeAuth,
        hasOwnerAuth: !!ownerAuth,
        ownerUid: ownerAuth?.uid,
        creatorUid,
        distributorId,
        distributorIdMatchesOwner: !isEmployee ? (distributorId === ownerAuth?.uid) : 'N/A',
        usingFirestore: firestore === empDB ? 'empDB' : 'db',
        selectedRetailer: {
          id: selectedRetailer.id,
          displayName: selectedRetailer.displayName,
          type: selectedRetailer.type,
          provisionalId: selectedRetailer.provisionalId,
          status: selectedRetailer.status
        },
        isProvisionalRetailer,
        retailerMode: isProvisionalRetailer ? "passive" : "active",
        finalDecision: isProvisionalRetailer ? "PASSIVE ORDER" : "ACTIVE ORDER"
      });

      // Debug log for provisional decision
      console.log("[PassiveOrders] ✅ FINAL PROVISIONAL DECISION", {
        retailerName: safeRetailerName,
        isProvisionalRetailer,
        selectedRetailer,
      });

      const _isProv = (
        isProvisionalRetailer ||
        selectedRetailer?.type === "provisional" ||
        (typeof selectedRetailer?.source === "string" && selectedRetailer.source.toLowerCase().startsWith("provisioned")) ||
        (typeof selectedRetailer?.status === "string" && selectedRetailer.status.toLowerCase().startsWith("provisioned")) ||
        !!selectedRetailer?.provisionalId
      );

      // Canonical fields expected by other modules
      const normalizedItems = normalizeCartItems(cart);
      const retailerDisplay = (selectedRetailer?.displayName || '').trim();
      const retailerPhone = selectedRetailer?.phone || '';
      const retailerEmail = selectedRetailer?.email || '';
      const retailerCity = selectedRetailer?.city || '';
      const retailerState = selectedRetailer?.state || '';
      const retailerAddress = selectedRetailer?.address || '';
      // Normalize payment via shared policy
      const normalizedPayment = orderPolicy.normalizePaymentMode(paymentMode);
      const paymentFlags = {
        isCredit: !!normalizedPayment.isCredit,
        isAdvance: !!normalizedPayment.isAdvance,
        isSplit: !!normalizedPayment.isSplit,
        isCOD: !!normalizedPayment.isCOD,
        isUPI: !!normalizedPayment.isUPI,
        isNetBanking: !!normalizedPayment.isNetBanking,
        isCheque: !!normalizedPayment.isCheque,
      };
      const paymentModeLabel = normalizedPayment.label || (typeof paymentMode === 'string' ? paymentMode : '');

      // Calculate initial chargesSnapshot for passive orders
      // Fetch distributor profile for state info
      let distributorState = '';
      try {
        const distributorProfileRef = doc(firestore, 'businesses', distributorId);
        const distributorProfileSnap = await getDoc(distributorProfileRef);
        if (distributorProfileSnap.exists()) {
          const profile = distributorProfileSnap.data();
          distributorState = profile.state || '';
        }
      } catch (e) {
        console.warn('[PassiveOrders] Failed to fetch distributor profile:', e);
      }
      
      // Use retailer state from selected retailer, fallback to distributor state
      const finalRetailerState = retailerState || distributorState || 'Maharashtra';

      // Build lines for calculateProforma
      // NOTE: Selling prices are already final - GST% is informational only
      // We set gstRate to 0 initially so no GST is calculated on top of selling prices
      // User can add charges/taxes later in OrderRequests if needed
      const proformaLines = normalizedItems.map(item => ({
        qty: Number(item.quantity || item.qty || 0),
        price: Number(item.sellingPrice || item.price || 0),
        gstRate: 0, // Set to 0 initially - selling prices are already final
        itemDiscountPct: 0, // Can be edited later in OrderRequests
        itemDiscountAmt: 0,
      }));

      // Calculate initial proforma with zero charges and zero GST
      // This ensures grandTotal = sum of selling prices (no GST added on top)
      const initialProforma = calculateProforma({
        lines: proformaLines,
        orderCharges: {
          delivery: 0,
          packing: 0,
          insurance: 0,
          other: 0,
          discountPct: 0,
          discountAmt: 0,
        },
        distributorState: distributorState || 'Maharashtra', // fallback
        retailerState: finalRetailerState, // Use retailer state from selected retailer
        roundingEnabled: false,
      });

      // Build initial chargesSnapshot structure
      // Ensure all values are numbers (not undefined) to avoid Firestore errors
      const initialChargesSnapshot = {
        breakdown: {
          grossItems: Number(initialProforma.grossItems || 0),
          lineDiscountTotal: Number(initialProforma.lineDiscountTotal || 0),
          itemsSubTotal: Number(initialProforma.itemsSubTotal || initialProforma.subTotal || 0),
          subTotal: Number(initialProforma.subTotal || 0),
          delivery: 0,
          packing: 0,
          insurance: 0,
          other: 0,
          discountPct: 0,
          discountAmt: 0,
          discountTotal: Number(initialProforma.discountTotal || 0),
          taxableBase: Number(initialProforma.taxableBase || 0),
          taxBreakup: {
            cgst: Number(initialProforma.taxBreakup?.cgst || 0),
            sgst: Number(initialProforma.taxBreakup?.sgst || 0),
            igst: Number(initialProforma.taxBreakup?.igst || 0),
          },
          roundOff: Number(initialProforma.roundOff || 0),
          grandTotal: Number(initialProforma.grandTotal || 0),
        },
        defaultsUsed: {
          cgstRate: null,
          sgstRate: null,
          igstRate: null,
          roundEnabled: false,
        },
        directFlow: true,
      };

      await addDoc(collection(firestore, 'businesses', distributorId, 'orderRequests'), {
        // Who
        createdBy: 'distributor',
        creatorUid: creatorUid,
        creatorEmail: creatorEmail,
        ...(createdByInfo ? { creatorDetails: createdByInfo } : {}),

        // Ids
        distributorId,
        retailerId: _isProv ? null : selectedRetailer.id,

        // Retailer snapshot (top-level for UI parity)
        retailerMode: _isProv ? 'passive' : 'active',
        mode: _isProv ? 'passive' : 'active',
        isProvisional: _isProv,
        provisionalRetailerId: _isProv ? (selectedRetailer?.provisionalId || selectedRetailer?.id) : null,
        retailerBusinessName: retailerDisplay,
        retailerName: retailerDisplay,
        retailerPhone: retailerPhone,
        retailerEmail: retailerEmail,
        retailerCity: retailerCity, // Save city for order display
        retailerState: finalRetailerState, // Save state for order display
        retailerAddress: retailerAddress, // Save address for order display
        retailerInfo: {
          name: retailerDisplay,
          phone: retailerPhone,
          email: retailerEmail,
          city: retailerCity,
          state: finalRetailerState,
          address: retailerAddress,
          type: selectedRetailer.type,
          provisionalId: selectedRetailer.type === 'provisional' ? (selectedRetailer.provisionalId || selectedRetailer.id) : null,
        },

        // Status
        status: 'Requested',
        statusCode: ORDER_STATUSES.REQUESTED,
        timestamp: serverTimestamp(), // Main timestamp for display
        statusTimestamps: { requestedAt: serverTimestamp() },

        // Items
        items: normalizedItems,
        itemsSubTotal: normalizedItems.reduce((s, it) => s + Number(it.lineTotal || 0), 0),

        // Initial chargesSnapshot for passive orders (can be edited in OrderRequests)
        chargesSnapshot: initialChargesSnapshot,
        distributorState: distributorState || 'Maharashtra',
        retailerState: finalRetailerState,

        // Dates & delivery
        createdAt: serverTimestamp(),
        deliveryDate: new Date(`${deliveryDate}T00:00:00`),
        deliveryMode: 'Courier', // default; can be edited later

        // Payment (normalized + detailed)
        paymentMethod: normalizedPayment.code || null,    // e.g., "COD" | "SPLIT" | "ADVANCE" | "CREDIT_CYCLE"
        paymentMode: paymentModeLabel,                    // UI-safe label
        paymentFlags,
        payment: {
          type: paymentModeLabel,
          creditDays: paymentFlags.isCredit ? Number(creditDays) || 0 : null,
          advanceAmount: paymentFlags.isAdvance ? Number(advanceAmount) || 0 : null,
        },
        policyVersion: orderPolicy.VERSION || 1,

        // Notes
        notes: (notes || '').trim(),
      });

      toast.success("Order created");
      resetForm();
    } catch (e) {
      console.error(e);
      toast.error("Failed to create order.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- UI ----------
  return (
    <div className="w-full text-slate-200">
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-100 mb-1">Create Order</h1>
        <p className="text-sm text-emerald-500 mb-6">Step flow — Retailer → Products → Review (Passive / Provisional Flow)</p>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs">
            {[1, 2, 3].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`h-7 w-7 rounded-full grid place-items-center border transition-all duration-150 ${
                    step === s
                      ? "bg-emerald-500 text-slate-900 border-emerald-400"
                      : "bg-[#161b22] text-slate-400 border-slate-700/70"
                  }`}
                >
                  {s}
                </div>
                {i < 2 && <div className="w-10 h-[2px] bg-slate-700" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Retailer */}
        <section className={`mb-8 ${step !== 1 ? "opacity-70 pointer-events-none" : ""}`}>
          <header className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <h2 className="text-base text-slate-100 font-semibold">1️⃣ Retailer Details</h2>
            </div>
            {selectedRetailer ? (
              <button className="text-emerald-400 text-sm hover:underline" onClick={() => setSelectedRetailer(null)}>Change</button>
            ) : null}
          </header>

          {!selectedRetailer ? (
            <div>
              <label className="block text-sm mb-2 text-slate-400">Search retailer by name / phone / email</label>
              <div className="relative">
                <input
                  value={retailerQuery}
                  onChange={(e) => setRetailerQuery(e.target.value)}
                  onFocus={() => setRetailerOpen(true)}
                  placeholder="e.g., Om Sai Kirana, 98xxxxxx10"
                  className="w-full px-4 py-3 rounded-xl border border-slate-600/50 bg-[#1d2633] text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {retailerQuery && (
                  <button
                    type="button"
                    onClick={() => { setRetailerQuery(""); setRetailerOpen(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    title="Clear"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="mt-2 rounded-xl border border-slate-700/50 bg-[#1d2633] max-h-60 overflow-auto shadow">
                {retailerLoading ? (
                  <div className="px-3 py-2 text-sm text-slate-500">Loading retailers…</div>
                ) : retailerResults.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">No retailers found.</div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {retailerResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedRetailer(r);
                          setRetailerOpen(false);
                          setStep(2);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors"
                      >
                        <div className="text-sm font-medium flex items-center gap-2">
                          {r.displayName}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              r.type === "provisional"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            {r.type}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">{r.phone} • {r.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-slate-700/40 bg-[#273244] p-3 shadow-sm">
              <div>
                <div className="font-semibold text-slate-100">{selectedRetailer.displayName}</div>
                <div className="text-xs text-slate-400">{selectedRetailer.phone} • {selectedRetailer.email} • {selectedRetailer.type}</div>
              </div>
              <button onClick={() => setStep(2)} className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-900 font-semibold hover:brightness-110 transform transition-transform duration-150 hover:-translate-y-0.5">Continue</button>
            </div>
          )}
        </section>

        {/* Step 2: Products */}
        <section className={`mb-8 ${step < 2 ? "opacity-40 pointer-events-none" : step > 2 ? "opacity-70 pointer-events-none" : ""}`}>
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-base text-slate-100 font-semibold">2️⃣ Products</h2>
            {step === 2 && (
              <button className="text-sm bg-slate-700 text-slate-300 px-3 py-1 rounded-lg hover:bg-slate-600 border border-slate-600 shadow-sm transition" onClick={() => setStep(3)} disabled={cart.length === 0}>Review</button>
            )}
          </header>

          {/* Search */}
          <div className="mb-3">
            <label className="block text-sm mb-2 text-slate-400">Scan / Search</label>
            <div className="relative">
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Scan barcode or type: sku:ABC123, brand:amul, name:atta"
                className="w-full px-4 py-3 rounded-xl border border-slate-600/50 bg-[#1d2633] text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSuggestions([]);
                    setActiveIndex(-1);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  title="Clear"
                >
                  ×
                </button>
              )}
            </div>
            {!!suggestions.length && (
              <div className="mt-2 rounded-xl border border-slate-700/50 bg-[#1d2633] divide-y divide-slate-600/40 max-h-56 overflow-auto shadow">
                {suggestions.map((r, idx) => (
                  <button
                    key={r.id ?? r.sku ?? idx}
                    onClick={() => onPickSuggestion(r)}
                    className={`w-full text-left px-3 py-2 hover:bg-[#2f3a4d] ${idx === activeIndex ? "bg-[#2f3a4d]" : ""}`}
                  >
                    <div className="text-sm font-medium text-slate-200">{r.name}</div>
                    <div className="text-xs text-slate-400">SKU: {r.sku || "-"} • {r.brand || "-"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Picks */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-3">
            {(catalog.length ? catalog.slice(0, 8) : QUICK_PICKS).map((q) => (
              <button
                key={q.id}
                onClick={() => addItem(q)}
                className="rounded-xl border border-slate-700/40 bg-[#273244] p-3 text-left hover:bg-white/5 transition-all duration-150 ease-out shadow-sm hover:shadow-md"
              >
                <div className="font-medium text-sm truncate text-slate-100">{q.name}</div>
                <div className="text-xs text-slate-400 truncate">{q.brand} • {q.sku}</div>
                <div className="mt-2 text-sm text-emerald-400">₹{money(q.price)}</div>
              </button>
            ))}
          </div>

          {/* Cart */}
          {cart.length === 0 ? (
            <div className="text-sm text-slate-400 p-5 border border-dashed border-slate-700/50 rounded-xl bg-[#1d2633]/60">
              Start by <span className="text-emerald-400">scanning</span> or <span className="text-emerald-400">searching</span> items, or use <span className="text-emerald-400">Quick Picks</span>.
            </div>
          ) : (
            <div className="overflow-auto rounded-xl border border-slate-700/50 bg-[#1d2633]/40">
              <table className="min-w-full text-sm">
                <thead className="text-xs uppercase text-slate-300 bg-white/5 sticky top-0">
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-3 px-3 min-w-[200px]">Product Details</th>
                    <th className="text-left py-3 px-3 min-w-[100px]">SKU</th>
                    <th className="text-left py-3 px-3 min-w-[100px]">Brand</th>
                    <th className="text-left py-3 px-3 min-w-[100px]">Category</th>
                    <th className="text-right py-3 px-3 min-w-[80px]">Unit</th>
                    <th className="text-right py-3 px-3 min-w-[90px]">Base Price</th>
                    <th className="text-right py-3 px-3 min-w-[90px]">MRP</th>
                    <th className="text-right py-3 px-3 min-w-[80px]">GST %</th>
                    <th className="text-right py-3 px-3 min-w-[120px]">Price Mode</th>
                    <th className="text-right py-3 px-3 min-w-[90px]">Selling Price</th>
                    <th className="text-right py-3 px-3 min-w-[100px]">Qty</th>
                    <th className="text-right py-3 px-3 min-w-[100px]">Subtotal</th>
                    <th className="py-3 px-3 text-center w-20">&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((r) => {
                    const unitPrice = Number(r.sellingPrice || r.price || 0);
                    const subtotal = Number(r.qty) * unitPrice;
                    return (
                      <tr key={r.key} className="border-b border-slate-700/30 hover:bg-[#2f3a4d]/50 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-100">{r.productName || r.name}</div>
                          {r.hsnCode && (
                            <div className="text-xs text-slate-400 mt-0.5">HSN: {r.hsnCode}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-300">{r.sku || "-"}</td>
                        <td className="py-3 px-3 text-slate-300">{r.brand || "-"}</td>
                        <td className="py-3 px-3 text-slate-300">{r.category || "-"}</td>
                        <td className="py-3 px-3 text-right text-slate-300">{r.unit || "-"}</td>
                        <td className="py-3 px-3 text-right">
                          {(() => {
                            // Smart base price calculation:
                            // If MRP_INCLUSIVE mode and basePrice not available, calculate it from MRP
                            let displayBasePrice = r.basePrice;
                            if (!displayBasePrice && r.pricingMode === "MRP_INCLUSIVE" && r.mrp > 0 && (r.gstRate || r.taxRate) > 0) {
                              const split = splitFromMrp(r.mrp, r.gstRate || r.taxRate);
                              displayBasePrice = split.base;
                            }
                            
                            if (displayBasePrice > 0) {
                              return <span className="text-slate-200">₹{money(displayBasePrice)}</span>;
                            } else {
                              return <span className="text-slate-500">-</span>;
                            }
                          })()}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {r.mrp > 0 ? (
                            <span className="text-slate-200">₹{money(r.mrp)}</span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {(r.gstRate || r.taxRate) > 0 ? (
                            <span className="text-slate-200">{(r.gstRate || r.taxRate)}%</span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <select
                            value={r.pricingMode || "LEGACY"}
                            onChange={(e) => updateCartItemPricingMode(r.key, e.target.value)}
                            className="text-xs rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100 px-2 py-1 min-w-[100px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            {r.mrp > 0 && (
                              <option value="MRP_INCLUSIVE">MRP (GST Included)</option>
                            )}
                            {r.sellingPrice > 0 && (
                              <option value="SELLING_PRICE">Selling Price</option>
                            )}
                            {r.basePrice > 0 && (
                              <option value="BASE_PLUS_TAX">Base + Tax</option>
                            )}
                            {!r.mrp && !r.sellingPrice && !r.basePrice && (
                              <option value="LEGACY">Legacy</option>
                            )}
                          </select>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-semibold text-emerald-400">₹{money(unitPrice)}</span>
                        </td>
                        <td className="py-3 px-3 text-right min-w-[100px]">
                          <div className="inline-flex items-center gap-1">
                            <button 
                              onClick={() => dec(r.key)} 
                              className="h-7 w-7 rounded-lg border border-slate-600/50 bg-[#243041] hover:bg-[#2c3a4f] transition text-slate-300"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={r.qty}
                              onChange={(e) => setQty(r.key, e.target.value)}
                              className="w-16 text-center rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100 px-2 py-1"
                            />
                            <button 
                              onClick={() => inc(r.key)} 
                              className="h-7 w-7 rounded-lg border border-slate-600/50 bg-[#243041] hover:bg-[#2c3a4f] transition text-slate-300"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-semibold text-slate-100">₹{money(subtotal)}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button 
                            onClick={() => removeItem(r.key)} 
                            className="px-2 py-1 rounded-lg border border-red-500/30 text-xs hover:bg-red-500/20 text-red-400 transition"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {step === 2 && (
            <div className="mt-3 flex items-center justify-end">
              <button
                className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-900 font-semibold hover:brightness-110 disabled:opacity-60 transform transition-transform duration-150 hover:-translate-y-0.5"
                disabled={cart.length === 0}
                onClick={() => setStep(3)}
              >
                Review & Continue
              </button>
            </div>
          )}
        </section>

        {/* Step 3: Review & Create */}
        <section className={`${step < 3 ? "opacity-40 pointer-events-none" : ""}`}>
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-base text-slate-100 font-semibold">3️⃣ Review & Create</h2>
            <div className="text-sm text-slate-400">
              Total: <span className="text-slate-100 font-semibold">₹{money(cartTotal)}</span> ({cart.length} item{cart.length !== 1 ? "s" : ""})
            </div>
          </header>

          {/* Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-700/50 bg-[#1d2633]/60 p-3">
              <div className="text-xs text-slate-400 mb-1">Retailer</div>
              {selectedRetailer ? (
                <div>
                  <div className="font-semibold text-slate-100">{selectedRetailer.displayName}</div>
                  <div className="text-xs text-slate-400">{selectedRetailer.phone} • {selectedRetailer.email} • {selectedRetailer.type}</div>
                </div>
              ) : (
                <div className="text-xs text-slate-400">—</div>
              )}
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-[#1d2633]/60 p-3">
              <div className="text-xs text-slate-400 mb-1">Items</div>
              <div className="text-sm text-slate-100">{cart.length} line(s)</div>
              <div className="text-xs text-slate-400">Subtotal: ₹{money(cartTotal)}</div>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-[#1d2633]/60 p-3 space-y-2">
              <div className="text-xs text-slate-400">Delivery & Payment</div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100"
                />
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m.value} value={m.value} className="bg-[#1d2633]">
                      {m.label}
                    </option>
                  ))}
                </select>
                {paymentMode === "Credit" && (
                  <input
                    type="number"
                    min="1"
                    value={creditDays}
                    onChange={(e) => setCreditDays(Number(e.target.value) || 0)}
                    className="w-24 text-right px-3 py-2 rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100"
                    placeholder="Days"
                  />
                )}
                {paymentMode === "Advance" && (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(Number(e.target.value) || 0)}
                    className="w-28 text-right px-3 py-2 rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100"
                    placeholder="₹"
                  />
                )}
              </div>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-600/50 bg-[#1d2633] text-slate-100 placeholder-slate-500"
                placeholder="Notes / instructions (optional)"
              />
            </div>
          </div>

          {/* Review table */}
          <div className="mt-4 overflow-auto rounded-xl border border-slate-700/50 bg-[#1d2633]/40">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-slate-300 bg-white/5 sticky top-0">
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-3 px-3 min-w-[200px]">Product Details</th>
                  <th className="text-left py-3 px-3 min-w-[100px]">SKU</th>
                  <th className="text-left py-3 px-3 min-w-[100px]">Brand</th>
                  <th className="text-left py-3 px-3 min-w-[100px]">Category</th>
                  <th className="text-right py-3 px-3 min-w-[80px]">Unit</th>
                  <th className="text-right py-3 px-3 min-w-[90px]">Base Price</th>
                  <th className="text-right py-3 px-3 min-w-[90px]">MRP</th>
                  <th className="text-right py-3 px-3 min-w-[80px]">GST %</th>
                  <th className="text-right py-3 px-3 min-w-[90px]">Selling Price</th>
                  <th className="text-right py-3 px-3 min-w-[80px]">Qty</th>
                  <th className="text-right py-3 px-3 min-w-[100px]">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((r) => {
                  const unitPrice = Number(r.sellingPrice || r.price || 0);
                  const subtotal = Number(r.qty) * unitPrice;
                  return (
                    <tr key={r.key} className="border-t border-slate-700/30 hover:bg-[#2f3a4d]/30">
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-100">{r.productName || r.name}</div>
                        {r.hsnCode && (
                          <div className="text-xs text-slate-400 mt-0.5">HSN: {r.hsnCode}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300">{r.sku || "-"}</td>
                      <td className="py-3 px-3 text-slate-300">{r.brand || "-"}</td>
                      <td className="py-3 px-3 text-slate-300">{r.category || "-"}</td>
                      <td className="py-3 px-3 text-right text-slate-300">{r.unit || "-"}</td>
                      <td className="py-3 px-3 text-right">
                        {r.basePrice > 0 ? (
                          <span className="text-slate-200">₹{money(r.basePrice)}</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {r.mrp > 0 ? (
                          <span className="text-slate-200">₹{money(r.mrp)}</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {(r.gstRate || r.taxRate) > 0 ? (
                          <span className="text-slate-200">{(r.gstRate || r.taxRate)}%</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-semibold text-emerald-400">₹{money(unitPrice)}</span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-200">{r.qty}</td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-semibold text-slate-100">₹{money(subtotal)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-xl bg-[#243041] text-slate-300 hover:bg-[#2c3a4f] border border-slate-600/50 shadow-sm transition"
            >
              Cancel / Reset
            </button>
            <button
              onClick={handleCreateOrder}
              disabled={submitting}
              className={`px-6 py-3 rounded-xl font-semibold bg-emerald-500 text-slate-900 hover:brightness-110 transform transition-transform duration-150 hover:-translate-y-0.5 ${
                submitting ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                  Creating…
                </span>
              ) : (
                "Create Order"
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}