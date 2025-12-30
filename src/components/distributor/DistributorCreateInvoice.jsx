import moment from "moment";
import React, { useState, useEffect } from "react";
import CustomerForm from "../billing/CustomerForm";
import BillingCart from "../billing/BillingCart";
import InvoiceSettings from "../billing/InvoiceSettings";
import ProductSearch from "../billing/ProductSearch";
import InvoicePreview from "../billing/InvoicePreview";
import PaymentLinkSender from "../payment/PaymentLinkSender";
import { normalizeUnit } from "../billing/pricingUtils";
import { auth, db } from "../../firebase/firebaseConfig";
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";

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

/* ---------- Stock updater for distributor inventory ---------- */
const updateInventoryStock = async (distributorId, cartItems) => {
  for (const item of cartItems) {
    try {
      console.log("Updating distributor stock for:", item.name, "ID:", item.id, "Qty:", item.quantity);
      const productRef = doc(db, "businesses", distributorId, "products", item.id);
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        const currentStock = parseFloat(productSnap.data().quantity) || 0;
        const newStock = currentStock - item.quantity;
        const finalStock = newStock < 0 ? 0 : newStock;
        await updateDoc(productRef, { quantity: finalStock });
        console.log("Distributor stock updated to:", finalStock);
      } else {
        console.warn("Product not found in distributor inventory for ID:", item.id);
      }
    } catch (error) {
      console.error("Error updating distributor stock for product ID:", item.id, error.message);
    }
  }
};

const DistributorCreateInvoice = () => {
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "", city: "", state: "" });
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
    extras: {
      deliveryFee: 0,
      packagingFee: 0,
      insuranceType: 'none',
      insuranceValue: 0,
    },
    driver: {
      name: "",
      phone: "",
      vehicle: "",
      tracking: "",
    },
  });
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showPreview, setShowPreview] = useState({ visible: false, issuedAt: null });
  const [userInfo, setUserInfo] = useState(null);
  const [invoiceId, setInvoiceId] = useState("");
  const [invoiceData, setInvoiceData] = useState(null);
  const [splitPayment, setSplitPayment] = useState({ cash: 0, upi: 0, card: 0 });
  const [isCreating, setIsCreating] = useState(false);
  const [showPaymentLinkSender, setShowPaymentLinkSender] = useState(false);
  const [billingSettings, setBillingSettings] = useState({
    branding: { logoUrl: "", signatureUrl: "", stampUrl: "" },
    bank: { bankName: "", branch: "", accountNumber: "", ifsc: "", accountName: "" },
    payment: { upiId: "", upiQrUrl: "" },
    terms: "",
  });

  // Totals from BillingCart
  const [cartTotals, setCartTotals] = useState({
    subtotal: 0,
    taxBreakdown: {},
    extras: {},
    finalTotal: 0,
    grandTotal: 0,
  });

  const handleCartUpdate = (nextItems, totals) => {
    if (Array.isArray(nextItems)) setCartItems(nextItems);
    if (totals && typeof totals === 'object') {
      setCartTotals((prev) => ({ ...prev, ...totals, grandTotal: totals.grandTotal ?? totals.finalTotal ?? prev.grandTotal }));
    }
  };

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

  // Load billing settings
  useEffect(() => {
    const loadBillingSettings = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      try {
        const prefRef = doc(db, "businesses", uid, "preferences", "billing");
        const snap = await getDoc(prefRef);
        if (snap.exists()) {
          const d = snap.data();
          const bankIn = d.bank || {};
          const bank = {
            bankName: bankIn.bankName || bankIn.name || "",
            branch: bankIn.branch || "",
            accountNumber: bankIn.accountNumber || bankIn.account || "",
            ifsc: bankIn.ifsc || "",
            accountName: bankIn.accountName || "",
          };
          setBillingSettings({
            branding: {
              logoUrl: d.branding?.logoUrl || "",
              signatureUrl: d.branding?.signatureUrl || "",
              stampUrl: d.branding?.stampUrl || "",
            },
            bank,
            payment: {
              upiId: d.payment?.upiId || "",
              upiQrUrl: d.payment?.upiQrUrl || "",
            },
            terms: d.terms || "",
          });
        }
      } catch (e) {
        console.warn("Failed to load billing settings:", e);
      }
    };
    loadBillingSettings();
  }, []);

  // Add product to cart
  const addProductToCart = (product) => {
    if (!product) return;
    const resolvedName = product.productName || product.name || product.title || product.label || "";

    const mode = product.pricingMode
      ? product.pricingMode
      : (product.mrp ? "MRP_INCLUSIVE" : (product.basePrice ? "BASE_PLUS_GST" : "SELLING_SIMPLE"));

    const inlineRate = Number(
      product.gstRate ?? product.taxRate ?? (settings?.gstRate ?? 0)
    );

    const unitNorm = normalizeUnit({
      pricingMode: mode,
      gstRate: inlineRate,
      hsnCode: product.hsnCode,
      sellingPrice: product.sellingPrice ?? product.price ?? undefined,
      sellingIncludesGst: (mode === "SELLING_SIMPLE" || mode === "BASE_PLUS_GST") ? false : true,
      mrp: product.mrp,
      basePrice: product.basePrice,
    });

    const newLine = {
      cartLineId: genCartLineId(),
      id: product.id,
      name: resolvedName,
      sku: product.sku || "",
      brand: product.brand || "",
      category: product.category || "",
      quantity: 1,
      price: Number(unitNorm.unitPriceNet ?? 0),
      discount: 0,
      unit: product.unit || product.packSize || "",
      pricingMode: mode,
      gstRate: inlineRate,
      inlineGstRate: inlineRate,
      hsnCode: product.hsnCode || "",
      mrp: product.mrp ?? undefined,
      basePrice: product.basePrice ?? undefined,
      normalized: {
        unitPriceNet: Number(unitNorm.unitPriceNet ?? 0),
        taxPerUnit: Number(unitNorm.taxPerUnit ?? 0),
        unitPriceGross: Number(unitNorm.unitPriceGross ?? 0),
        effectiveRate: Number(unitNorm.effectiveRate ?? inlineRate),
      },
    };

    setSelectedProducts((prev) => {
      const exists = prev.find((p) => p.id === newLine.id);
      return exists ? prev : [...prev, { id: newLine.id, name: resolvedName }];
    });
    setCartItems((prev) => [...prev, newLine]);
  };

  // Compute line breakdown
  const computeLineBreakdown = (it) => {
    const qty = Math.max(0, parseFloat(it.quantity) || 0);
    const discPct = Math.max(0, Math.min(100, parseFloat(it.discount) || 0));

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

  function computeExtrasCharges(subtotal, currentSettings) {
    const s = currentSettings || {};
    const ex = s.extras || {};

    const legacyDelivery = parseFloat(s.deliveryCharge) || 0;
    const legacyPacking = parseFloat(s.packingCharge) || 0;
    const legacyOther = parseFloat(s.otherCharge) || 0;

    const deliveryFee = parseFloat(ex.deliveryFee) || 0;
    const packagingFee = parseFloat(ex.packagingFee) || 0;

    let insuranceAmt = 0;
    const type = ex.insuranceType || 'none';
    const val = parseFloat(ex.insuranceValue) || 0;
    if (type === 'flat') insuranceAmt = val;
    else if (type === 'percent') insuranceAmt = subtotal * (val / 100);

    return {
      delivery: legacyDelivery + deliveryFee,
      packaging: legacyPacking + packagingFee,
      insurance: Math.max(0, insuranceAmt),
      other: legacyOther,
      total: (legacyDelivery + deliveryFee) + (legacyPacking + packagingFee) + Math.max(0, insuranceAmt) + legacyOther,
      meta: { type, val }
    };
  }

  const computeTotals = () => {
    const enriched = enrichCartItems(cartItems);

    const rowSubtotal = enriched.reduce((s, it) => s + (parseFloat(it.lineNetAfterDiscount) || 0), 0);
    const rowTax = enriched.reduce((s, it) => s + (parseFloat(it.lineTaxAfterDiscount) || 0), 0);

    const gstAmount = 0, cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

    const extras = computeExtrasCharges(rowSubtotal, settings);

    const charges = extras.total;

    const grandTotal = parseFloat((rowSubtotal + rowTax + charges).toFixed(2));
    return { subtotal: rowSubtotal, gstAmount, cgstAmount, sgstAmount, igstAmount, rowTax, charges, grandTotal, enriched, extras };
  };

  const handleCustomerChange = (updated) => setCustomer(updated);

  const handleSubmitInvoice = async () => {
    if (!userInfo) { alert("User not authenticated or user info missing."); return; }
    if (cartItems.length === 0) { alert("Cart is empty. Please add products to generate invoice."); return; }
    setIsCreating(true);

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
      setIsCreating(false);
      return;
    }

    const totals = computeTotals();
    const totalAmount = totals.grandTotal;

    if (settings.paymentMode === "Split") {
      const sp = settings.splitPayment || splitPayment || {};
      const totalSplit = (Number(sp.cash)||0) + (Number(sp.upi)||0) + (Number(sp.card)||0);
      if (Number(totalSplit.toFixed(2)) !== Number(totalAmount.toFixed(2))) {
        alert(`Split payment does not match invoice total. Total: ₹${totalAmount}, Split: ₹${totalSplit}`);
        setIsCreating(false);
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

    // Generate invoice number
    const invoiceNumber = `INV-${moment().format("YYYYMMDD")}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const newInvoiceData = {
      invoiceNumber,
      buyer: {
        businessName: customer.name || customer.businessName || "N/A",
        name: customer.name || "N/A",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
      },
      seller: {
        businessName: (userInfo.businessName || userInfo.distributorName || "").trim() || "N/A",
        ownerName: (userInfo.ownerName || userInfo.name || userInfo.userName || "").trim() || "N/A",
        email: (userInfo.email || "").trim() || "",
        phone: (userInfo.phone || "").trim() || "",
        address: (userInfo.address || "").trim() || "",
        city: (userInfo.city || "").trim() || "",
        state: (userInfo.state || "").trim() || "",
        gstNumber: (userInfo.gstin || userInfo.gstNumber || "").trim() || "",
        pan: (userInfo.pan || "").trim() || "",
      },
      items: totals.enriched.map(item => ({
        productName: item.name,
        name: item.name,
        sku: item.sku,
        brand: item.brand,
        category: item.category,
        quantity: item.quantity,
        qty: item.quantity,
        unit: item.unit,
        sellingPrice: item.unitPriceGrossAfterDiscount,
        price: item.unitPriceGrossAfterDiscount,
        unitPrice: item.unitPriceGrossAfterDiscount,
        mrp: item.mrp,
        basePrice: item.basePrice,
        gstRate: item.gstRate,
        hsnCode: item.hsnCode,
        pricingMode: item.pricingMode,
      })),
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
      payment: {
        mode: settings.paymentMode || "",
        isPaid,
        paidOn,
        status: isPaid ? "Paid" : "Pending",
      },
      chargesSnapshot: {
        delivery: totals.extras?.delivery || 0,
        packing: totals.extras?.packaging || 0,
        insurance: totals.extras?.insurance || 0,
        other: totals.extras?.other || 0,
        insuranceType: settings?.extras?.insuranceType || 'none',
        insuranceValue: settings?.extras?.insuranceValue || 0,
      },
      taxSnapshot: {
        rowTax: totals.rowTax,
        cartLevel: { gst: totals.gstAmount, cgst: totals.cgstAmount, sgst: totals.sgstAmount, igst: totals.igstAmount },
      },
      totals: {
        grossItems: totals.subtotal,
        itemsSubTotal: totals.subtotal,
        subTotal: totals.subtotal,
        delivery: totals.extras?.delivery || 0,
        packing: totals.extras?.packaging || 0,
        insurance: totals.extras?.insurance || 0,
        other: totals.extras?.other || 0,
        taxableBase: totals.subtotal + totals.extras?.total,
        taxBreakup: {
          gst: totals.gstAmount,
          cgst: totals.cgstAmount,
          sgst: totals.sgstAmount,
          igst: totals.igstAmount,
        },
        grandTotal: totals.grandTotal,
      },
    };
    setInvoiceData(newInvoiceData);
    setIsCreating(false);
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
            // Save to distributor's invoices collection
            const invoiceRef = doc(db, "businesses", userInfo.uid, "invoices", invoiceId);
            const toWrite = stripUndefinedDeep({
              ...invoiceData,
              createdAt: invoiceData.issuedAt,
              isPaid: invoiceData.isPaid,
              paidOn: invoiceData.paidOn,
              creditDueDate: invoiceData.creditDueDate
            });
            const bad = findUndefinedPaths(toWrite);
            if (bad.length) console.warn("[DistributorCreateInvoice preview confirm] undefined at:", bad);
            await setDoc(invoiceRef, toWrite);
            console.log("Distributor invoice saved to Firestore:", invoiceId);
            await updateInventoryStock(userInfo.uid, cartItems);
            
            // Check if we should show payment link sender
            const paymentMode = (settings.paymentMode || "").toLowerCase();
            const shouldShowPaymentLink = (paymentMode === "upi" || paymentMode === "card" || (paymentMode === "credit" && !invoiceData.isPaid));
            
            if (shouldShowPaymentLink && customer?.phone) {
              // Show payment link sender after successful save
              setShowPaymentLinkSender(true);
            } else {
              alert("Invoice created successfully!");
              // Reset form
              setCustomer({ name: "", phone: "", email: "", address: "", city: "", state: "" });
              setCartItems([]);
              setSelectedProducts([]);
              setShowPreview({ visible: false, issuedAt: null });
            }
          } catch (error) {
            console.error("Error saving invoice:", error.message);
            alert("Failed to save invoice. Please try again.");
            return;
          }
        }}
        taxRates={{
          gst: settings.gstRate,
          cgst: settings.cgstRate,
          sgst: settings.sgstRate,
          igst: settings.igstRate
        }}
        userInfo={{
          businessName: (userInfo.businessName || userInfo.distributorName || "").trim() || "N/A",
          ownerName: (userInfo.ownerName || userInfo.name || userInfo.userName || "").trim() || "N/A",
          address: (userInfo.address || "").trim() || "N/A",
          city: (userInfo.city || "").trim() || "N/A",
          state: (userInfo.state || "").trim() || "N/A",
          phone: (userInfo.phone || "").trim() || "N/A",
          email: (userInfo.email || "").trim() || "N/A",
          gstin: (userInfo.gstin || userInfo.gstNumber || "").trim() || "N/A",
          pan: (userInfo.pan || "").trim() || "N/A"
        }}
        branding={billingSettings.branding}
        bank={billingSettings.bank}
        payment={billingSettings.payment}
        terms={billingSettings.terms}
      />
    );
  }

  // Payment Link Sender Modal (shown after invoice creation)
  if (showPaymentLinkSender && invoiceData) {
    return (
      <>
        <PaymentLinkSender
          isOpen={showPaymentLinkSender}
          onClose={() => {
            setShowPaymentLinkSender(false);
            // Reset form after closing payment link sender
            setCustomer({ name: "", phone: "", email: "", address: "", city: "", state: "" });
            setCartItems([]);
            setSelectedProducts([]);
            setShowPreview({ visible: false, issuedAt: null });
            alert("Invoice created successfully!");
          }}
          invoice={invoiceData}
          customer={customer}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6 px-2 sm:px-4 md:px-6 pb-32 pt-[env(safe-area-inset-top)] text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <h2 className="text-lg sm:text-xl font-semibold">Create Invoice</h2>
          <p className="text-xs sm:text-sm text-white/70">Sell products and generate invoices</p>
        </div>

        {/* Customer Info */}
        <div className="p-3 sm:p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
          <h2 className="text-base sm:text-lg font-semibold mb-2 text-white">Customer Information</h2>
          {userInfo && (
            <CustomerForm customer={customer} onChange={handleCustomerChange} userId={userInfo.uid} />
          )}
        </div>

        {/* Product Search */}
        <div className="p-3 sm:p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base sm:text-lg font-semibold text-white">Add Product</h2>
          </div>
          <ProductSearch
            onSelect={(product) => {
              if (!product) return;
              const resolvedName =
                product.productName || product.name || product.title || product.label || "";

              const fullProduct = {
                id: product.id,
                ...product,
                productName: resolvedName,
                pricingMode:
                  product.pricingMode || (product.mrp ? "MRP_INCLUSIVE" : "SELLING_SIMPLE"),
                gstRate: product.gstRate ?? product.taxRate ?? 0,
                sellingIncludesGst:
                  product.sellingIncludesGst ?? (product.pricingMode !== "BASE_PLUS_GST"),
              };

              const alreadyExists = selectedProducts.find((p) => p.id === fullProduct.id);
              if (!alreadyExists) {
                setSelectedProducts((prev) => [...prev, fullProduct]);
                addProductToCart(fullProduct);
              }
            }}
          />
        </div>

        {/* Invoice Settings */}
        <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
          <InvoiceSettings
            settings={settings}
            onChange={setSettings}
            grandTotal={cartTotals.grandTotal || cartTotals.finalTotal || 0}
          />
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
        <div className="p-3 sm:p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
          <h2 className="text-base sm:text-lg font-semibold mb-2 text-white">Product Cart</h2>
          <BillingCart
            selectedProducts={selectedProducts}
            cartItems={cartItems}
            onUpdateCart={handleCartUpdate}
            settings={settings}
          />
        </div>

        {/* Submit Button */}
        <div className="hidden md:flex justify-end">
          <button
            onClick={handleSubmitInvoice}
            className="px-6 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] transition"
          >
            Create Invoice
          </button>
        </div>
        {/* Mobile Floating Button */}
        <div className="fixed bottom-3 sm:bottom-4 inset-x-3 sm:inset-x-4 z-50 md:hidden">
          <button
            onClick={handleSubmitInvoice}
            className="w-full text-slate-900 py-3 rounded-xl shadow-lg text-base sm:text-lg font-semibold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)]"
          >
            Create Invoice
          </button>
        </div>
      </div>
      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="relative p-4 sm:p-6 rounded-2xl border border-white/10 bg-white/10 shadow-2xl text-white w-[min(90vw,420px)]">
            <div className="mx-auto mb-3 h-8 w-8 sm:h-10 sm:w-10 rounded-full border-4 border-white/30 border-t-emerald-300 animate-spin" />
            <div className="text-center">
              <div className="text-base sm:text-lg font-semibold">Creating invoice…</div>
              <div className="text-xs sm:text-sm text-white/80 mt-1">Preparing preview and totals</div>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-[shimmer_1.6s_linear_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </div>
            <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
          </div>
        </div>
      )}
    </>
  );
};

export default DistributorCreateInvoice;

