import React from "react";
import moment from "moment";
import { db, auth } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

const FLYPLogo = "/assets/flyp-logo.png";

const PreviewStyles = () => (
  <style>{`
    /* On-screen: Tabular numbers for perfect column alignment */
    #invoice-content .num { font-variant-numeric: tabular-nums; }

    /* On-screen: tighten table look */
    #invoice-content table th { letter-spacing: .02em; font-weight: 600; }
    #invoice-content table td, #invoice-content table th { vertical-align: middle; }

    /* Signature line helper */
    .sig-line { height:1px; background: currentColor; opacity:.25; }

    /* Non-print helpers */
    .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
  `}</style>
);

/* ---------- Amount in words (Indian system) ---------- */
function amountInWordsIndian(num) {
  try {
    const n = Math.round(Number(num || 0));
    if (!isFinite(n)) return "Zero";
    const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"]; 
    const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"]; 
    const u = (s) => s? s+" ":"";
    const two = (num) => num < 20 ? a[num] : (b[Math.floor(num/10)] + (num%10?" "+a[num%10]:""));
    const three = (num) => {
      const h = Math.floor(num/100), rest = num%100;
      return (h? a[h] + " Hundred" + (rest?" ":"") : "") + (rest? two(rest):"");
    }
    let str = "";
    let crore = Math.floor(n/10000000); let rem = n%10000000;
    let lakh = Math.floor(rem/100000); rem = rem%100000;
    let thousand = Math.floor(rem/1000); rem = rem%1000;
    let hundred = rem;
    if (crore) str += u(three(crore)) + "Crore ";
    if (lakh) str += u(three(lakh)) + "Lakh ";
    if (thousand) str += u(three(thousand)) + "Thousand ";
    if (hundred) str += three(hundred);
    return (str.trim() || "Zero");
  } catch { return "Zero"; }
}


const InvoicePreview = (props) => {
  const {
    // manual flow props
    customer,
    cartItems,
    settings,
    paymentMode,
    invoiceType,
    issuedAt,
    userInfo,
    onCancel,
    onConfirm,
    // voice flow props (from FastBillingMode)
    cart,
    invoiceConfig,
    totals,
    // NEW: settings-driven UI props
    previewMode = false,
    branding = { logoUrl: "", signatureUrl: "" },
    bank = { name: "", branch: "", account: "", ifsc: "" },
    payment = { upiId: "", upiQrUrl: "" },
    terms = "",
    billingPrefsOverride = undefined,
  } = props;

  // Merge Billing Settings override (branding, bank, payment, terms only; no theme/template)
  const [billingPrefs, setBillingPrefs] = React.useState(null);
  const prefs = billingPrefsOverride || billingPrefs || {};
  const effectiveBranding = { ...(branding || {}), ...(prefs.branding || {}) };
  const effectiveBank = { ...(bank || {}), ...(prefs.bank || {}) };
  const effectivePayment = { ...(payment || {}), ...(prefs.payment || {}) };
  const effectiveTerms = typeof prefs.terms === 'string' ? prefs.terms : terms;

  // Fixed table density and header tone (no template/theme logic)
  const densityRow = "py-2";
  const headerTone = "from-white via-white to-emerald-200";

  const [retailerData, setRetailerData] = React.useState(null);

  React.useEffect(() => {
    const fetchRetailerInfo = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const docSnap = await getDoc(doc(db, "businesses", user.uid));
      if (docSnap.exists()) {
        setRetailerData(docSnap.data());
      }
    };
    fetchRetailerInfo();
  }, []);

  React.useEffect(() => {
    const fetchBillingPrefs = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "businesses", user.uid, "preferences", "billing"));
        if (snap.exists()) setBillingPrefs(snap.data());
      } catch (e) {
        console.error("Failed to load billing prefs", e);
      }
    };
    fetchBillingPrefs();
  }, []);

  // ✅ Normalize props so both Manual & Voice flows work without crashing
  const normalizedSettings = settings ?? invoiceConfig ?? totals?.invoiceConfig ?? {
    includeGST: false,
    includeCGST: false,
    includeSGST: false,
    includeIGST: false,
    gstRate: 0,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
    deliveryCharge: 0,
    packingCharge: 0,
    otherCharge: 0,
    dueDate: null,
    invoiceType: "",
  };
  const items = Array.isArray(cartItems)
    ? cartItems
    : Array.isArray(cart)
    ? cart
    : [];

  const normalizedPaymentMode =
    typeof paymentMode !== "undefined" && paymentMode !== null
      ? paymentMode
      : (normalizedSettings?.paymentMode || totals?.paymentMode || "");

  const normalizedInvoiceType =
    typeof invoiceType !== "undefined" && invoiceType !== null
      ? invoiceType
      : normalizedSettings.invoiceType || "";

  // Helpers to normalize item fields across Manual & Voice carts
  const getQty = (it) => {
    const q = Number(it.quantity ?? it.qty ?? it.count ?? 1);
    return Number.isFinite(q) && q > 0 ? q : 1;
  };
  const getPrice = (it) => {
    const p = Number(it.price ?? it.unitPrice ?? it.rate ?? 0);
    return Number.isFinite(p) && p >= 0 ? p : 0;
  };
  const getDiscountPct = (it) => {
    let d = Number(
      it.discount ?? it.discountPct ?? it.discountPercent ?? it.disc ?? it.off ?? 0
    );
    if (!Number.isFinite(d)) d = 0;
    d = Math.max(0, Math.min(100, d));
    return d;
  };

  const getDiscountAmt = (it) => {
    let a = Number(
      it.discountAmount ??
      it.discount_value ??
      it.discountInRs ??
      it.discountAmt ??
      0
    );
    if (!Number.isFinite(a)) a = 0;
    return Math.max(0, a);
  };

  const normalizedPaymentModeLC = String(normalizedPaymentMode || "").toLowerCase();

  // Canonicalize invoice type to a single heading used in the UI
  const canonicalTypeToHeading = (t = "") => {
    const s = String(t).trim().toLowerCase();
    if (s === "tax") return "TAX INVOICE";
    if (s === "proforma") return "PROFORMA INVOICE";
    if (s === "estimate" || s === "estimation") return "ESTIMATE INVOICE";
    if (s === "quote" || s === "quotation") return "QUOTATION";
    if (s === "retail") return "RETAIL INVOICE";
    // Default fallback
    return "TAX INVOICE";
  };
  const heading = canonicalTypeToHeading(normalizedInvoiceType);

  // ---------- Tax split helpers (CGST/SGST vs IGST) ----------
  const getItemGstRate = (it) => {
    if (it?.normalized && (it.pricingMode === "MRP_INCLUSIVE" || it.pricingMode === "BASE_PLUS_GST")) {
      const net = Number(it.normalized.unitPriceNet || 0);
      const tax = Number(it.normalized.taxPerUnit || 0);
      return net > 0 ? (tax / net) * 100 : 0;
    }
    return Number(it.inlineGstRate ?? it.gstRate ?? normalizedSettings.gstRate ?? 0) || 0;
  };
  const getGSTStateFromNumber = (gstin) => {
    const m = String(gstin || '').match(/^(\d{2})/);
    return m ? m[1] : null;
  };
  const determineIGST = (customerObj, retailerObj) => {
    const sellerState = getGSTStateFromNumber(retailerObj?.gstNumber);
    const buyerState = getGSTStateFromNumber(customerObj?.gstNumber || customerObj?.gstin);
    if (sellerState && buyerState) return sellerState !== buyerState; // inter-state => IGST
    // If customer GSTIN unknown, default to intra-state split (CGST+SGST) for B2C display
    return false;
  };
  const computeTaxSplit = (ratePct, taxAmount, useIGST) => {
    const r = Number(ratePct) || 0;
    const t = Number(taxAmount) || 0;
    if (useIGST) {
      return { igstPct: r, igstAmt: t, cgstPct: 0, sgstPct: 0, cgstAmt: 0, sgstAmt: 0 };
    }
    return { igstPct: 0, igstAmt: 0, cgstPct: r / 2, sgstPct: r / 2, cgstAmt: t / 2, sgstAmt: t / 2 };
  };

  // ---------- Row-wise breakdown synced with BillingCart/CreateInvoice ----------
  const computeLineBreakdown = (it) => {
    const qty = Number(it.quantity ?? it.qty ?? 1);
    const discPct = Math.max(0, Math.min(100, Number(it.discount ?? it.discountPct ?? 0)));

    if (it?.normalized && (it.pricingMode === "MRP_INCLUSIVE" || it.pricingMode === "BASE_PLUS_GST")) {
      const unitNet = Number(it.normalized.unitPriceNet || 0);
      const unitTax = Number(it.normalized.taxPerUnit || 0);
      const r = unitNet > 0 ? unitTax / unitNet : 0;
      const unitNetAfterDisc = unitNet * (1 - discPct / 100);
      const unitGrossAfterDisc = unitNetAfterDisc * (1 + r);
      const unitTaxAfterDisc = unitGrossAfterDisc - unitNetAfterDisc;
      return {
        lineGrossAfterDisc: unitGrossAfterDisc * qty,
        lineTaxAfterDisc: unitTaxAfterDisc * qty,
      };
    }

    if (it.pricingMode === "SELLING_SIMPLE" || it.pricingMode === "LEGACY") {
      const unitNet = Number(it.price || 0);
      const rate = Number(it.inlineGstRate ?? it.gstRate ?? 0) / 100;
      const unitNetAfterDisc = unitNet * (1 - discPct / 100);
      const unitGrossAfterDisc = unitNetAfterDisc * (1 + rate);
      const unitTaxAfterDisc = unitGrossAfterDisc - unitNetAfterDisc;
      return {
        lineGrossAfterDisc: unitGrossAfterDisc * qty,
        lineTaxAfterDisc: unitTaxAfterDisc * qty,
      };
    }

    const unitGross = Number(it.price || 0);
    const unitGrossAfterDisc = unitGross * (1 - discPct / 100);
    return { lineGrossAfterDisc: unitGrossAfterDisc * qty, lineTaxAfterDisc: 0 };
  };

  const rowTotals = items.reduce(
    (acc, it) => {
      const b = computeLineBreakdown(it);
      acc.subtotal += (b.lineGrossAfterDisc - b.lineTaxAfterDisc);
      acc.rowTax += b.lineTaxAfterDisc;
      return acc;
    },
    { subtotal: 0, rowTax: 0 }
  );

  const subtotal = rowTotals.subtotal;
  const rowTax = rowTotals.rowTax;

  // Do not apply cart-level GST again
  const gstAmount = 0, cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

  // Optional order-level charges (used by both Classic and Fast flows)
  const deliveryCharge = Number(normalizedSettings.deliveryCharge) || 0;
  const packingCharge  = Number(normalizedSettings.packingCharge)  || 0;
  const otherCharge    = Number(normalizedSettings.otherCharge)    || 0;
  const chargesTotal   = deliveryCharge + packingCharge + otherCharge;

  const total = subtotal + rowTax + chargesTotal;

  // Invoice-level split (based on seller vs buyer state)
  const useIGST = determineIGST(customer || {}, retailerData || {});
  let cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
  (items || []).forEach((it) => {
    const ratePct = getItemGstRate(it);
    const b = computeLineBreakdown(it);
    const split = computeTaxSplit(ratePct, b.lineTaxAfterDisc || 0, useIGST);
    cgstTotal += split.cgstAmt || 0;
    sgstTotal += split.sgstAmt || 0;
    igstTotal += split.igstAmt || 0;
  });

  const handleWhatsAppShare = async () => {
    const phone = customer?.phone?.replace(/\D/g, "");
    if (phone) {
      const message = encodeURIComponent(
        `Hi ${customer?.name || "Customer"}, your invoice of ₹${total.toFixed(
          2
        )} has been created via FLYP.\nThank you for your business!`
      );
      window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
    }
  };

  return (
    <>
      <PreviewStyles />

      <div
        id="invoice-content"
        className={`p-4 md:p-6 rounded-xl max-w-5xl w-full mx-auto mt-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] space-y-6 text-white bg-white/10 backdrop-blur-2xl border border-white/10 shadow-[0_12px_50px_rgba(0,0,0,0.45)] overflow-visible print:bg-white print:text-black`}
      >
        <div className="pdf-hide flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Invoice Preview</h2>
          <button className="no-print text-rose-300 hover:text-rose-200 underline" onClick={onCancel}>
            Cancel
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {effectiveBranding?.logoUrl ? (
              <img src={effectiveBranding.logoUrl} alt="Logo" className="w-10 h-10 object-contain" />
            ) : (
              <img src={FLYPLogo} alt="FLYP" className="w-10 h-10 rounded-md opacity-80" />
            )}
              <div>
                <div className="text-xs uppercase tracking-widest text-white/60">{heading}</div>
                <div className="text-base font-semibold">Invoice Preview</div>
              </div>
            </div>
            <div className="text-right text-sm">
              <div><span className="text-white/60">Invoice ID:</span> FLYP-{issuedAt ? new Date(issuedAt).getTime() : Date.now()}</div>
              <div><span className="text-white/60">Issued On:</span> {issuedAt ? moment(issuedAt).local().format("DD MMM YYYY, hh:mm A") : "N/A"}</div>
              <div><span className="text-white/60">Now:</span> {moment().local().format("DD MMM YYYY, hh:mm A")}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <h3 className="font-semibold">Customer</h3>
              <div className="text-sm"><span className="text-white/60">Name:</span> {customer?.name || "—"}</div>
              <div className="text-sm"><span className="text-white/60">Phone:</span> {customer?.phone || "—"}</div>
              <div className="text-sm"><span className="text-white/60">Email:</span> {customer?.email || "—"}</div>
              <div className="text-sm"><span className="text-white/60">Address:</span> {customer?.address || "—"}</div>
            </div>
            <div className="space-y-1 md:text-right">
              <h3 className="font-semibold">Retailer</h3>
              <div className="text-sm"><span className="text-white/60">Business:</span> {retailerData?.businessName || "Retailer"}</div>
              <div className="text-sm"><span className="text-white/60">Owner:</span> {retailerData?.ownerName || "—"}</div>
              <div className="text-sm"><span className="text-white/60">Phone:</span> {retailerData?.phone || "—"}</div>
              <div className="text-sm"><span className="text-white/60">Email:</span> {retailerData?.email || "—"}</div>
              <div className="text-sm"><span className="text-white/60">Address:</span> {retailerData?.address || "—"}</div>
              <div className="text-sm"><span className="text-white/60">GSTIN:</span> {retailerData?.gstNumber || "N/A"}  <span className="ml-4 text-white/60">PAN:</span> {retailerData?.pan || "N/A"}</div>
            </div>
          </div>
        </div>

        <div className="relative">
          <h2 className={`text-center font-extrabold text-2xl mb-6 uppercase tracking-widest font-bold bg-clip-text text-transparent bg-gradient-to-r ${headerTone}`}>
            {heading}
          </h2>
          {/* Watermark — hidden in print via .pdf-hide */}
          <div className="pdf-hide pointer-events-none select-none absolute inset-0 flex items-center justify-center opacity-[0.06] text-6xl font-extrabold uppercase tracking-[0.3em]">
            {normalizedInvoiceType ? String(normalizedInvoiceType).toUpperCase() : 'INVOICE'}
          </div>
        </div>

        {/* Divider (decorative) — hidden in print */}
        <div className="pdf-hide h-[1px] w-full bg-white/10 print:bg-black/20 my-4" />

        {/* Products */}
        <div className="mb-4 products-section pb-4">
          <h3 className="text-center font-bold text-lg mt-6 uppercase">Products</h3>
          <div className="overflow-x-auto w-full avoid-break">
            <table className="min-w-full table-fixed text-[13px] border border-white/10 bg-white/5 rounded-xl overflow-hidden">
              <colgroup>
                <col style={{ width: "28%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "6%" }} />
              </colgroup>
              <thead className="bg-white/10">
                <tr>
                  <th className="px-2 py-2 text-white/80 border-b border-white/10 text-left whitespace-nowrap">Name</th>
                  <th className="px-2 py-2 text-white/80 border-b border-white/10 text-left whitespace-nowrap">Unit</th>
                  <th className="px-2 py-2 text-white/80 border-b border-white/10 text-right whitespace-nowrap">Qty</th>
                  <th className="px-2 py-2 text-white/80 border-b border-white/10 text-right whitespace-nowrap">Unit (Net)</th>
                  <th className="px-2 py-2 text-white/80 border-b border-white/10 text-right whitespace-nowrap">Discount</th>
                  <th className="px-2 py-2 text-white/80 border-b border-white/10 text-right whitespace-nowrap">Net</th>
                  <th className="px-2 py-2 text-white/80 border-b border-white/10 text-right whitespace-nowrap">GST %</th>
                  <th className="px-2 py-2 text-white/80 border-b border-white/10 text-right whitespace-nowrap">Tax</th>
                  <th className="px-2 py-2 text-white/80 border-b border-white/10 text-right whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  // Per-line breakdown
                  const qty = getQty(item);
                  const price = getPrice(item);
                  const discPct = getDiscountPct(item);
                  const discAmt = getDiscountAmt(item);
                  // Use discount amount if present, else percent
                  let unitNet = price;
                  let gstRate = Number(item.inlineGstRate ?? item.gstRate ?? normalizedSettings.gstRate ?? 0);
                  let unitDiscount = 0;
                  let netSubtotal = 0;
                  let taxPercent = gstRate;
                  let taxAmt = 0;
                  let lineTotal = 0;

                  if (item?.normalized && (item.pricingMode === "MRP_INCLUSIVE" || item.pricingMode === "BASE_PLUS_GST")) {
                    unitNet = Number(item.normalized.unitPriceNet || 0);
                    gstRate = Number(item.inlineGstRate ?? item.gstRate ?? normalizedSettings.gstRate ?? 0);
                    // Discount: percent only (amount not supported in this mode)
                    unitDiscount = unitNet * (discPct / 100);
                    netSubtotal = (unitNet - unitDiscount) * qty;
                    taxPercent = gstRate;
                    // Tax is on post-discount amount
                    taxAmt = ((unitNet - unitDiscount) * (gstRate / 100)) * qty;
                    lineTotal = ((unitNet - unitDiscount) * (1 + gstRate / 100)) * qty;
                  } else if (item.pricingMode === "SELLING_SIMPLE" || item.pricingMode === "LEGACY") {
                    unitNet = price;
                    gstRate = Number(item.inlineGstRate ?? item.gstRate ?? normalizedSettings.gstRate ?? 0);
                    // Discount percent only (amount not supported)
                    unitDiscount = unitNet * (discPct / 100);
                    netSubtotal = (unitNet - unitDiscount) * qty;
                    taxPercent = gstRate;
                    taxAmt = ((unitNet - unitDiscount) * (gstRate / 100)) * qty;
                    lineTotal = ((unitNet - unitDiscount) * (1 + gstRate / 100)) * qty;
                  } else {
                    // Legacy flat price (no GST)
                    unitNet = price;
                    taxPercent = 0;
                    if (discAmt > 0) {
                      unitDiscount = discAmt / qty;
                      netSubtotal = (unitNet * qty) - discAmt;
                    } else {
                      unitDiscount = unitNet * (discPct / 100);
                      netSubtotal = (unitNet - unitDiscount) * qty;
                    }
                    taxAmt = 0;
                    lineTotal = netSubtotal;
                  }
                  const useIGST = determineIGST(customer || {}, retailerData || {});
                  const split = computeTaxSplit(taxPercent, taxAmt, useIGST);
                  return (
                    <React.Fragment key={idx}>
                      <tr className="hover:bg-white/5 odd:bg-white/[0.03]">
                        <td className={`px-2 ${densityRow} md:px-3 border-t border-white/10`}>
                          {(() => {
                            const display =
                              item.displayName ||
                              item.productName ||
                              item.name ||
                              (item.product && (item.product.productName || item.product.name)) ||
                              item.title ||
                              item.itemName ||
                              item.label ||
                              '—';
                            return String(display);
                          })()}
                        </td>
                        <td className={`px-2 ${densityRow} md:px-3 border-t border-white/10`}>{item.unit || item.packSize || (item.product && (item.product.unit || item.product.packSize)) || '-'}</td>
                        <td className={`px-2 ${densityRow} md:px-3 border-t border-white/10 text-right num`}>{qty}</td>
                        <td className={`px-2 ${densityRow} md:px-3 border-t border-white/10 text-right num`}>₹{unitNet.toFixed(2)}</td>
                        <td className={`px-2 ${densityRow} md:px-3 border-t border-white/10 text-right num`}>
                          {discAmt > 0 ? `₹${discAmt.toFixed(2)}` : (discPct > 0 ? `${discPct}%` : '—')}
                        </td>
                        <td className={`px-2 ${densityRow} md:px-3 border-t border-white/10 text-right num`}>₹{netSubtotal.toFixed(2)}</td>
                        <td className={`px-2 ${densityRow} md:px-3 border-t border-white/10 text-right num`}>{taxPercent > 0 ? `${taxPercent}%` : '—'}</td>
                        <td className={`px-2 ${densityRow} md:px-3 border-t border-white/10 text-right num`}>₹{taxAmt.toFixed(2)}</td>
                        <td className={`px-2 ${densityRow} md:px-3 border-t border-white/10 text-right num`}>₹{lineTotal.toFixed(2)}</td>
                      </tr>
                      {/* Detail row */}
                      <tr className="text-[11px] text-white/60">
                        <td className="px-2 pb-2 md:px-3 border-b border-white/10" colSpan={5}>
                          <div className="flex flex-wrap items-center gap-3">
                            {(item.batch || item.lot || item.serial || item.imei || item.expiryDate) && (
                              <span className="text-white/50">
                                {[item.batch || item.lot, item.serial || item.imei, item.expiryDate].filter(Boolean).join(" • ")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className="px-2 pb-2 md:px-3 border-b border-white/10 text-right"
                          colSpan={4}
                        >
                          {split.igstPct > 0 ? (
                            <span>IGST {split.igstPct}% = ₹{split.igstAmt.toFixed(2)}</span>
                          ) : (
                            <span>CGST {split.cgstPct}% = ₹{split.cgstAmt.toFixed(2)} &nbsp;•&nbsp; SGST {split.sgstPct}% = ₹{split.sgstAmt.toFixed(2)}</span>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tax Summary */}
        <div id="tax-summary" className="mb-4 text-right">
          <h3 className="font-semibold text-lg mb-2 text-white">Tax Summary</h3>
          <div className="grid grid-cols-2 gap-y-1 gap-x-4 items-center w-full max-w-md ml-auto text-sm">
            <span className="text-white/70">Net Subtotal:</span><span className="text-right">₹{subtotal.toFixed(2)}</span>
            <span className="text-white/70">Total Discount:</span><span className="text-right">₹{(() => {
              let totalDiscount = 0;
              items.forEach((item) => {
                const qty = getQty(item);
                const price = getPrice(item);
                const discPct = getDiscountPct(item);
                const discAmt = getDiscountAmt(item);
                totalDiscount += discAmt > 0 ? discAmt : price * qty * (discPct / 100);
              });
              return totalDiscount.toFixed(2);
            })()}</span>
            <span className="text-white/70">Total Tax:</span><span className="text-right">₹{rowTax.toFixed(2)}</span>
            {cgstTotal > 0 && (<><span className="text-white/70">CGST:</span><span className="text-right">₹{cgstTotal.toFixed(2)}</span></>)}
            {sgstTotal > 0 && (<><span className="text-white/70">SGST:</span><span className="text-right">₹{sgstTotal.toFixed(2)}</span></>)}
            {igstTotal > 0 && (<><span className="text-white/70">IGST:</span><span className="text-right">₹{igstTotal.toFixed(2)}</span></>)}
            {deliveryCharge > 0 && (<><span className="text-white/70">Delivery:</span><span className="text-right">₹{deliveryCharge.toFixed(2)}</span></>)}
            {packingCharge > 0 && (<><span className="text-white/70">Packing:</span><span className="text-right">₹{packingCharge.toFixed(2)}</span></>)}
            {otherCharge > 0 && (<><span className="text-white/70">Other:</span><span className="text-right">₹{otherCharge.toFixed(2)}</span></>)}
            <span className="col-span-2 h-[1px] bg-white/10 my-1"></span>
            <span className="font-semibold">Grand Total:</span><span className="text-right font-bold text-lg">₹{total.toFixed(2)}</span>
          </div>
          <p className="text-sm text-white/70 mt-3">
            Payment Mode: {normalizedPaymentMode || "N/A"} | Invoice Type: {normalizedInvoiceType && normalizedInvoiceType.length > 0 ? normalizedInvoiceType.charAt(0).toUpperCase() + normalizedInvoiceType.slice(1) : "N/A"}
          </p>
          {normalizedPaymentModeLC === "credit" && (normalizedSettings.creditDueDate || normalizedSettings.dueDate) && (
            <p className="text-sm text-rose-300 mt-1">
              Due Date: {moment(normalizedSettings.creditDueDate || normalizedSettings.dueDate).format("DD MMM YYYY")}
            </p>
          )}
          {normalizedSettings.isPaid && normalizedSettings.paidOn && (
            <p className="text-sm text-emerald-300 mt-1">
              ✅ Paid on: {moment(normalizedSettings.paidOn.toDate?.() || normalizedSettings.paidOn).format("DD MMM YYYY")} via {normalizedSettings.paidVia?.toUpperCase()}
            </p>
          )}
          {normalizedPaymentModeLC === "split" && (
            (() => {
              const sp = normalizedSettings.splitPayment || {};
              const cash = sp.cash ?? normalizedSettings.splitCash ?? 0;
              const upi  = sp.upi  ?? normalizedSettings.splitUPI  ?? 0;
              const card = sp.card ?? normalizedSettings.splitCard ?? 0;
              return (
                <div className="text-sm text-white/70 mt-1 space-y-1">
                  <p>Split Breakdown:</p>
                  <p>- ₹{Number(cash).toFixed(2)} by Cash</p>
                  <p>- ₹{Number(upi).toFixed(2)} by UPI</p>
                  <p>- ₹{Number(card).toFixed(2)} by Card</p>
                </div>
              );
            })()
          )}
        </div>

        {/* Bank + UPI */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 avoid-break">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
            <h4 className="font-semibold mb-2">Bank Details</h4>
            <p>{effectiveBank?.bankName || 'Bank'}{effectiveBank?.branch ? ` — ${effectiveBank.branch}` : ''}</p>
            {effectiveBank?.accountNumber ? <p>Account: {effectiveBank.accountNumber}</p> : null}
            {effectiveBank?.ifsc ? <p>IFSC: {effectiveBank.ifsc}</p> : null}
            {effectiveBank?.accountName ? <p>Name: {effectiveBank.accountName}</p> : null}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
            <h4 className="font-semibold mb-2">UPI</h4>
            <p>{effectivePayment?.upiId || '—'}</p>
            {effectivePayment?.upiQrUrl ? (
              <img src={effectivePayment.upiQrUrl} alt="UPI QR" className="h-24 mt-2 object-contain" />
            ) : null}
          </div>
        </div>

        {/* Amount in Words + Signature */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 avoid-break">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-white/70 mb-1">Amount in Words</div>
            <div className="font-medium">Rupees {amountInWordsIndian(total)} Only</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-white/70 mb-4">Authorized Signatory</div>
            {effectiveBranding?.signatureUrl && (
              <img src={effectiveBranding.signatureUrl} alt="Signature" className="h-12 mb-2 object-contain" />
            )}
            <div className="sig-line"></div>
            <div className="mt-2 text-sm text-white/60">Seal &amp; Signature</div>
          </div>
        </div>

        {(effectiveTerms || normalizedSettings?.terms || normalizedSettings?.notes) && (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <div className="font-semibold mb-1">Terms &amp; Conditions</div>
            <div className="whitespace-pre-wrap">{effectiveTerms || normalizedSettings.terms || normalizedSettings.notes}</div>
          </div>
        )}

        <div className="mt-8 avoid-break">
          <div className="flex items-center justify-between">
            <img src={FLYPLogo} alt="FLYP Logo" className="w-20 opacity-70" />
            <div className="text-right text-sm text-white/70 italic">Thank you for your business!</div>
          </div>
        </div>
      </div>

      <div className="text-center mt-6">
        {(!props.viewOnly && !previewMode) && (
          <button
            className="no-print px-6 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)]"
            onClick={(e) => {
              if (typeof props.onPublish === "function") {
                e.preventDefault?.();
                props.onPublish();
              } else if (typeof onConfirm === "function") {
                onConfirm();
              }
            }}
          >
            Publish Invoice
          </button>
        )}
      </div>
    </>
  );
};

export default InvoicePreview;