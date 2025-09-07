import React from "react";
import moment from "moment";
import { db, auth } from "../../firebase/firebaseConfig";
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import html2pdf from "html2pdf.js";
const FLYPLogo = "/assets/flyp-logo.png";

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
  } = props;

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

  const calculateSubtotal = (item) => {
    // Prefer a host-provided subtotal/total if present and valid
    const provided = Number(item.subtotal ?? item.lineTotal ?? item.total);
    if (Number.isFinite(provided) && provided >= 0) return provided;

    const qty = getQty(item);
    const price = getPrice(item);
    const base = qty * price;

    // If a fixed discount amount is present, it takes precedence
    const amt = getDiscountAmt(item);
    if (amt > 0) return Math.max(0, base - amt);

    // Otherwise fall back to percentage discount
    const pct = getDiscountPct(item);
    return Math.max(0, base * (1 - pct / 100));
  };

  const subtotal = items.reduce((sum, item) => sum + calculateSubtotal(item), 0);

  const gstAmount = normalizedSettings.includeGST
    ? (subtotal * (normalizedSettings.gstRate || 0)) / 100
    : 0;
  const cgstAmount = normalizedSettings.includeCGST
    ? (subtotal * (normalizedSettings.cgstRate || 0)) / 100
    : 0;
  const sgstAmount = normalizedSettings.includeSGST
    ? (subtotal * (normalizedSettings.sgstRate || 0)) / 100
    : 0;
  const igstAmount = normalizedSettings.includeIGST
    ? (subtotal * (normalizedSettings.igstRate || 0)) / 100
    : 0;

  // Optional order-level charges (used by both Classic and Fast flows)
  const deliveryCharge = Number(normalizedSettings.deliveryCharge) || 0;
  const packingCharge  = Number(normalizedSettings.packingCharge)  || 0;
  const otherCharge    = Number(normalizedSettings.otherCharge)    || 0;
  const chargesTotal   = deliveryCharge + packingCharge + otherCharge;

  const total = subtotal + gstAmount + cgstAmount + sgstAmount + igstAmount + chargesTotal;

  const handleDownloadPDF = () => {
    const element = document.getElementById("invoice-content");
    html2pdf()
      .from(element)
      .save(`Invoice-FLYP-${issuedAt ? new Date(issuedAt).getTime() : Date.now()}.pdf`);
  };

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
      <div className="text-right mb-2 max-w-4xl mx-auto mt-4">
        <button
          onClick={handleDownloadPDF}
          className="px-4 py-1 rounded-lg font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] mr-2"
        >
          Download PDF
        </button>
      </div>
      <div
        id="invoice-content"
        className="p-4 md:p-6 rounded-xl max-w-4xl mx-auto mt-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] space-y-6 text-white bg-white/10 backdrop-blur-2xl border border-white/10 shadow-[0_12px_50px_rgba(0,0,0,0.45)]"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Invoice Preview</h2>
          <button className="text-rose-300 hover:text-rose-200 underline" onClick={onCancel}>
            Cancel
          </button>
        </div>

        <div className="flex justify-between mb-6 border-b border-white/10 pb-4">
          {/* Customer Info */}
          <div className="w-1/2 pr-6 border-r border-white/10">
            <h3 className="font-semibold text-lg mb-2 border-b border-white/10 pb-1 text-white">Customer Information</h3>
            <p>
              <strong>Name:</strong> {customer?.name || "—"}
            </p>
            <p>
              <strong>Phone:</strong> {customer?.phone || "—"}
            </p>
            <p>
              <strong>Email:</strong> {customer?.email || "—"}
            </p>
            <p>
              <strong>Address:</strong> {customer?.address || "—"}
            </p>
          </div>

          {/* Business Info */}
          <div className="w-1/2 pl-6 text-right">
            <h3 className="font-semibold text-lg mb-2 border-b border-white/10 pb-1 text-white">Retailer Information</h3>
            <p>
              <strong>Business Name:</strong> {retailerData?.businessName || "Retailer"}
            </p>
            <p>
              <strong>Owner:</strong> {retailerData?.ownerName}
            </p>
            <p>
              <strong>Phone:</strong> {retailerData?.phone}
            </p>
            <p>
              <strong>Email:</strong> {retailerData?.email}
            </p>
            <p>
              <strong>Address:</strong> {retailerData?.address}
            </p>
            <p>
              <strong>GSTIN:</strong> {retailerData?.gstNumber || "N/A"}
            </p>
            <p>
              <strong>PAN:</strong> {retailerData?.pan || "N/A"}
            </p>
            <p>
              <strong>Invoice ID:</strong> FLYP-
              {issuedAt ? new Date(issuedAt).getTime() : Date.now()}
            </p>
            <p>
              <strong>Invoice Issued On:</strong>{" "}
              {issuedAt ? moment(issuedAt).local().format("DD MMM YYYY, hh:mm A") : "N/A"}
            </p>
            <p>
              <strong>Current Issue Date &amp; Time:</strong>{" "}
              {moment().local().format("DD MMM YYYY, hh:mm A")}
            </p>
          </div>
        </div>

        <h2 className="text-center font-extrabold text-2xl mb-6 uppercase tracking-widest font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
          {heading}
        </h2>

        {/* Products */}
        <div className="mb-4">
          <h3 className="text-center font-bold text-lg mt-6 uppercase">Products</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-white/10 bg-white/5 rounded-xl overflow-hidden">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-2 py-1 md:px-3 md:py-2 text-white/80 border-b border-white/10">Name</th>
                  <th className="px-2 py-1 md:px-3 md:py-2 text-white/80 border-b border-white/10">Brand</th>
                  <th className="px-2 py-1 md:px-3 md:py-2 text-white/80 border-b border-white/10">Category</th>
                  <th className="px-2 py-1 md:px-3 md:py-2 text-white/80 border-b border-white/10">Unit</th>
                  <th className="px-2 py-1 md:px-3 md:py-2 text-white/80 border-b border-white/10">Qty</th>
                  <th className="px-2 py-1 md:px-3 md:py-2 text-white/80 border-b border-white/10">Price</th>
                  <th className="px-2 py-1 md:px-3 md:py-2 text-white/80 border-b border-white/10">Discount</th>
                  <th className="px-2 py-1 md:px-3 md:py-2 text-white/80 border-b border-white/10">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/5">
                    <td className="px-2 py-1 md:px-3 md:py-2 border-t border-white/10">
                      {(() => {
                        const display =
                          item.displayName ||
                          item.productName ||
                          item.name ||
                          (item.product && (item.product.productName || item.product.name)) ||
                          item.title ||
                          item.itemName ||
                          item.label ||
                          "—";
                        return String(display);
                      })()}
                    </td>
                    <td className="px-2 py-1 md:px-3 md:py-2 border-t border-white/10">{item.brand || (item.product && item.product.brand) || "-"}</td>
                    <td className="px-2 py-1 md:px-3 md:py-2 border-t border-white/10">{item.category || (item.product && item.product.category) || "-"}</td>
                    <td className="px-2 py-1 md:px-3 md:py-2 border-t border-white/10">{item.unit || item.packSize || (item.product && (item.product.unit || item.product.packSize)) || "-"}</td>
                    <td className="px-2 py-1 md:px-3 md:py-2 border-t border-white/10">{getQty(item)}</td>
                    <td className="px-2 py-1 md:px-3 md:py-2 border-t border-white/10">₹{getPrice(item).toFixed(2)}</td>
                    <td className="px-2 py-1 md:px-3 md:py-2 border-t border-white/10">
                      {(() => {
                        const amt = getDiscountAmt(item);
                        if (amt > 0) return `₹${amt.toFixed(2)}`;
                        return `${getDiscountPct(item)}%`;
                      })()}
                    </td>
                    <td className="px-2 py-1 md:px-3 md:py-2 border-t border-white/10">₹{calculateSubtotal(item).toFixed(2)}</td>
                  </tr>
                ))} 
              </tbody>
            </table>
          </div>
        </div>

        {/* Tax Summary */}
        <div className="mb-4 text-right">
          <h3 className="font-semibold text-lg mb-2 text-white">Tax Summary</h3>
          <p className="text-white/70 text-sm mb-2">
            Applied Taxes:&nbsp;
            {normalizedSettings.includeIGST ? `IGST ${normalizedSettings.igstRate || 0}%` : null}
            {normalizedSettings.includeIGST && (normalizedSettings.includeCGST || normalizedSettings.includeSGST) ? ' · ' : ''}
            {normalizedSettings.includeCGST ? `CGST ${normalizedSettings.cgstRate || 0}%` : null}
            {normalizedSettings.includeCGST && normalizedSettings.includeSGST ? ' + ' : ''}
            {normalizedSettings.includeSGST ? `SGST ${normalizedSettings.sgstRate || 0}%` : null}
            {!normalizedSettings.includeIGST && !normalizedSettings.includeCGST && !normalizedSettings.includeSGST && normalizedSettings.includeGST ? `GST ${normalizedSettings.gstRate || 0}%` : null}
            {!normalizedSettings.includeIGST && !normalizedSettings.includeCGST && !normalizedSettings.includeSGST && !normalizedSettings.includeGST ? 'None' : ''}
          </p>
          {normalizedSettings.includeGST && (
            <p className="flex justify-end gap-4">
              <span className="w-24 text-left">GST ({normalizedSettings.gstRate || 0}%):</span> ₹{gstAmount.toFixed(2)}
            </p>
          )}
          {normalizedSettings.includeCGST && (
            <p className="flex justify-end gap-4">
              <span className="w-24 text-left">CGST ({normalizedSettings.cgstRate || 0}%):</span> ₹{cgstAmount.toFixed(2)}
            </p>
          )}
          {normalizedSettings.includeSGST && (
            <p className="flex justify-end gap-4">
              <span className="w-24 text-left">SGST ({normalizedSettings.sgstRate || 0}%):</span> ₹{sgstAmount.toFixed(2)}
            </p>
          )}
          {normalizedSettings.includeIGST && (
            <p className="flex justify-end gap-4">
              <span className="w-24 text-left">IGST ({normalizedSettings.igstRate || 0}%):</span> ₹{igstAmount.toFixed(2)}
            </p>
          )}
          {chargesTotal > 0 && (
            <>
              {deliveryCharge > 0 && (
                <p className="flex justify-end gap-4">
                  <span className="w-24 text-left">Delivery:</span> ₹{deliveryCharge.toFixed(2)}
                </p>
              )}
              {packingCharge > 0 && (
                <p className="flex justify-end gap-4">
                  <span className="w-24 text-left">Packing:</span> ₹{packingCharge.toFixed(2)}
                </p>
              )}
              {otherCharge > 0 && (
                <p className="flex justify-end gap-4">
                  <span className="w-24 text-left">Other:</span> ₹{otherCharge.toFixed(2)}
                </p>
              )}
            </>
          )}
          <p className="mt-3 font-bold text-xl">Grand Total: ₹{total.toFixed(2)}</p>
          <p className="text-sm text-white/70 mt-1">
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

        <div className="text-center">
          <div className="flex justify-between items-center mt-8">
            <div className="text-left">
              <img src={FLYPLogo} alt="FLYP Logo" className="w-24 opacity-70" />
            </div>
            <div className="text-right text-sm text-white/70 italic">
              Thank you for your business!
            </div>
          </div>

          <button
            className="mt-6 px-6 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)]"
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
        </div>
      </div>
    </>
  );
};

export default InvoicePreview;