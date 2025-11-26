import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import DistributorInvoicePdf from "../components/distributor/DistributorInvoicePdf";
import { splitFromMrp } from "../utils/pricing";

const PublicInvoiceView = () => {
  const { distributorId, invoiceId } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!distributorId || !invoiceId) {
        console.error("[PublicInvoiceView] Missing distributorId or invoiceId", { distributorId, invoiceId });
        setLoading(false);
        return;
      }

      console.log("[PublicInvoiceView] Fetching invoice:", { distributorId, invoiceId });

      try {
        const invoiceRef = doc(db, `businesses/${distributorId}/invoices`, invoiceId);
        const invoiceSnap = await getDoc(invoiceRef);
        
        if (!invoiceSnap.exists()) {
          console.warn("[PublicInvoiceView] Invoice not found:", invoiceId);
          setLoading(false);
          return;
        }

        const invoiceData = { id: invoiceSnap.id, ...invoiceSnap.data() };
        console.log("[PublicInvoiceView] Invoice loaded:", invoiceData);
        setInvoice(invoiceData);

        // Fetch order data if available
        if (invoiceData.orderId) {
          try {
            console.log("[PublicInvoiceView] Fetching order data:", invoiceData.orderId);
            const orderRef = doc(db, `businesses/${distributorId}/orderRequests`, invoiceData.orderId);
            const orderSnap = await getDoc(orderRef);
            if (orderSnap.exists()) {
              const orderData = { id: orderSnap.id, ...orderSnap.data() };
              console.log("[PublicInvoiceView] Order data loaded:", orderData);
              setOrderData(orderData);
            } else {
              console.warn("[PublicInvoiceView] Order not found:", invoiceData.orderId);
            }
          } catch (err) {
            console.error("[PublicInvoiceView] Error fetching order data:", err);
          }
        } else {
          console.log("[PublicInvoiceView] No orderId in invoice");
        }
      } catch (err) {
        console.error("[PublicInvoiceView] Error fetching invoice:", err);
        alert("Failed to load invoice. Please check the URL and try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [distributorId, invoiceId]);

  const formatDate = (value) => {
    if (!value) return "N/A";
    const d = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const getDisplayBasePrice = (order, idx, item) => {
    const pricingMode = item.pricingMode || "LEGACY";
    const basePrice = Number(item.basePrice || 0);
    const mrp = Number(item.mrp || 0);
    const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
    const baseGstRate = Number(item.gstRate || item.taxRate || 0);
    const pLine = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
    const lineGstRate = pLine?.gstRate !== undefined ? Number(pLine.gstRate) : baseGstRate;

    if (pricingMode === "MRP_INCLUSIVE") {
      if (mrp > 0 && lineGstRate > 0) {
        const split = splitFromMrp(mrp, lineGstRate);
        return split.base;
      }
      return mrp || sellingPrice;
    }
    if (pricingMode === "SELLING_PRICE") {
      if (sellingPrice > 0 && lineGstRate > 0) {
        const split = splitFromMrp(sellingPrice, lineGstRate);
        return split.base;
      }
      return sellingPrice;
    }
    if (pricingMode === "BASE_PLUS_TAX") {
      if (basePrice > 0) return basePrice;
      if (sellingPrice > 0 && lineGstRate > 0) {
        const split = splitFromMrp(sellingPrice, lineGstRate);
        return split.base;
      }
      return sellingPrice;
    }
    return basePrice || sellingPrice;
  };

  const getPaymentModeLabel = (invoice) => {
    if (!invoice) return "N/A";
    const p = invoice.payment || {};
    return (
      p.mode ||
      p.normalized?.label ||
      p.normalized?.mode ||
      invoice.paymentMode ||
      invoice.paymentUi ||
      "N/A"
    );
  };

  const getPaymentStatus = () => {
    if (!invoice) return { label: "Pending", isPaid: false };
    if (orderData) {
      const orderIsPaid =
        orderData.isPaid === true ||
        orderData.paymentStatus === 'Paid' ||
        orderData.payment?.isPaid === true;
      if (orderIsPaid) return { label: "Paid", isPaid: true };
    }
    const paymentObj = invoice.payment || {};
    if (typeof paymentObj.isPaid === "boolean") {
      return { label: paymentObj.isPaid ? "Paid" : "Pending", isPaid: paymentObj.isPaid };
    }
    const raw = paymentObj.status || invoice.paymentStatus || "";
    const normalized = raw.toString().trim().toLowerCase();
    if (["paid", "complete", "completed"].includes(normalized)) {
      return { label: "Paid", isPaid: true };
    }
    return { label: "Pending", isPaid: false };
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      setDownloadingPdf(true);
      const doc = <DistributorInvoicePdf invoice={invoice} order={orderData} />;
      const blob = await pdf(doc).toBlob();
      const fileName = `${invoice.invoiceNumber || invoice.id}-${formatDate(invoice.issuedAt).replace(/\s+/g, "-")}.pdf`;
      saveAs(blob, fileName);
    } catch (err) {
      console.error("Failed to generate PDF", err);
      alert("Failed to download PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading invoice...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Invoice Not Found</h1>
          <p className="text-slate-600">The invoice you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const paymentStatus = getPaymentStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 py-6 px-4 print:py-0 print:px-0">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 md:p-6 print:p-4 print:shadow-none print:border-0 print:rounded-none print:max-w-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-4 pb-4 border-b-2 border-slate-200 print:mb-2 print:pb-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1 font-semibold">Tax Invoice</p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 print:text-xl">
              {invoice.invoiceNumber || invoice.id}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 print:text-[10px]">
              Issued on {formatDate(invoice.issuedAt)}
            </p>
          </div>
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition print:hidden ${
              downloadingPdf
                ? "bg-slate-400 text-white cursor-not-allowed"
                : "bg-gradient-to-r from-slate-900 to-slate-800 text-white hover:from-slate-800 hover:to-slate-700 shadow-md"
            }`}
          >
            {downloadingPdf ? "Preparing..." : "Download PDF"}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 print:grid-cols-3 print:gap-2">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300 rounded-xl p-3 print:border print:p-2">
            <p className="text-[10px] uppercase text-emerald-700 mb-0.5 font-semibold tracking-wide">Grand Total</p>
            <p className="text-xl md:text-2xl font-bold text-emerald-800 print:text-lg">
              {formatCurrency(invoice.totals?.grandTotal || 0)}
            </p>
          </div>
          <div className={`border-2 rounded-xl p-3 print:border print:p-2 ${
            paymentStatus.isPaid
              ? "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300"
              : "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300"
          }`}>
            <p className="text-[10px] uppercase mb-0.5 font-semibold tracking-wide text-slate-700">Payment Status</p>
            <p className={`text-lg md:text-xl font-bold print:text-base ${
              paymentStatus.isPaid ? "text-emerald-800" : "text-amber-800"
            }`}>
              {paymentStatus.label}
            </p>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-300 rounded-xl p-3 print:border print:p-2">
            <p className="text-[10px] uppercase text-slate-700 mb-0.5 font-semibold tracking-wide">Payment Method</p>
            <p className="text-lg md:text-xl font-bold text-slate-900 print:text-base">
              {getPaymentModeLabel(invoice)}
            </p>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 print:grid-cols-2 print:gap-3">
          <div className="border-2 border-slate-200 rounded-xl p-3 bg-slate-50/50 print:border print:p-2">
            <p className="text-[10px] uppercase text-slate-600 mb-1.5 font-semibold tracking-wide">Bill To (Buyer)</p>
            <p className="font-bold text-base text-slate-900 print:text-sm">
              {invoice.buyer?.businessName || "N/A"}
            </p>
            <div className="text-xs text-slate-600 mt-1.5 space-y-0.5 print:text-[10px]">
              {invoice.buyer?.email && <p>{invoice.buyer.email}</p>}
              {invoice.buyer?.phone && <p>{invoice.buyer.phone}</p>}
              {(invoice.buyer?.city || invoice.buyer?.state) && (
                <p>{[invoice.buyer?.city, invoice.buyer?.state].filter(Boolean).join(", ")}</p>
              )}
            </div>
          </div>
          <div className="border-2 border-slate-200 rounded-xl p-3 bg-slate-50/50 print:border print:p-2">
            <p className="text-[10px] uppercase text-slate-600 mb-1.5 font-semibold tracking-wide">Sold By (Seller)</p>
            <p className="font-bold text-base text-slate-900 print:text-sm">
              {invoice.seller?.businessName || "N/A"}
            </p>
            <div className="text-xs text-slate-600 mt-1.5 space-y-0.5 print:text-[10px]">
              {invoice.seller?.email && <p>{invoice.seller.email}</p>}
              {invoice.seller?.phone && <p>{invoice.seller.phone}</p>}
              {invoice.seller?.gstNumber && <p>GSTIN: {invoice.seller.gstNumber}</p>}
              {(invoice.seller?.city || invoice.seller?.state) && (
                <p>{[invoice.seller?.city, invoice.seller?.state].filter(Boolean).join(", ")}</p>
              )}
            </div>
          </div>
        </div>

        {/* Items Table */}
        {(() => {
          // Get items from orderData or invoice, with fallback
          const items = (orderData?.items || invoice?.items || []);
          if (!items || items.length === 0) return null;
          
          return (
            <div className="mb-4 print:mb-2">
              <h3 className="font-bold text-sm text-slate-900 mb-2 print:text-xs print:mb-1">Order Items</h3>
              <div className="overflow-x-auto -mx-4 px-4 print:mx-0 print:px-0">
                <div className="inline-block min-w-full align-middle">
                  <table className="min-w-full text-[10px] border-collapse print:text-[9px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-700 text-[10px]">Product</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-700 text-[10px]">SKU</th>
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-700 text-[10px]">Brand</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-700 text-[10px]">Unit</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-700 text-[10px]">Base Price</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-700 text-[10px]">MRP</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-700 text-[10px]">GST %</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-700 text-[10px]">Selling</th>
                        <th className="px-2 py-1.5 text-center font-semibold text-slate-700 text-[10px]">Qty</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-700 text-[10px]">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => {
                    const qty = Number(item.quantity || item.qty || 0);
                    const price = Number(item.sellingPrice || item.price || item.unitPrice || 0);
                    const total = qty * price;
                        const basePrice = getDisplayBasePrice(orderData || invoice, idx, item);
                        const gstRate =
                          (Array.isArray(orderData?.proforma?.lines) &&
                            orderData.proforma.lines[idx]?.gstRate) ||
                          (Array.isArray(invoice?.proforma?.lines) &&
                            invoice.proforma.lines[idx]?.gstRate) ||
                          item.gstRate ||
                          item.taxRate ||
                          0;
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-2 py-1.5 align-top">
                              <p className="font-semibold text-slate-900 leading-tight">{item.productName || item.name || "N/A"}</p>
                              {item.hsnCode && <p className="text-[9px] text-slate-400 mt-0.5">HSN: {item.hsnCode}</p>}
                            </td>
                            <td className="px-2 py-1.5 text-slate-600 text-[10px]">{item.sku || "—"}</td>
                            <td className="px-2 py-1.5 text-slate-600 text-[10px]">{item.brand || "—"}</td>
                            <td className="px-2 py-1.5 text-right text-slate-600 text-[10px]">{item.unit || "—"}</td>
                            <td className="px-2 py-1.5 text-right text-slate-700 text-[10px]">
                              {basePrice > 0 ? formatCurrency(basePrice) : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right text-slate-700 text-[10px]">
                              {item.mrp > 0 ? formatCurrency(item.mrp) : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right text-slate-700 text-[10px]">{gstRate ? `${gstRate}%` : "—"}</td>
                            <td className="px-2 py-1.5 text-right font-semibold text-emerald-600 text-[10px]">
                              {formatCurrency(price)}
                            </td>
                            <td className="px-2 py-1.5 text-center text-slate-700 text-[10px] font-medium">{qty}</td>
                            <td className="px-2 py-1.5 text-right font-semibold text-slate-900 text-[10px]">
                              {formatCurrency(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Breakdown */}
        {invoice.totals && (
          <div className="border-2 border-slate-200 rounded-xl p-3 mb-4 bg-slate-50/30 print:border print:p-2">
            <h3 className="font-bold text-sm text-slate-900 mb-2 print:text-xs">Invoice Breakdown</h3>
            <div className="space-y-0.5 text-xs print:text-[10px]">
              {invoice.totals.grossItems !== undefined && (
                <div className="flex justify-between">
                  <span>Unit Price Total</span>
                  <span>{formatCurrency(invoice.totals.grossItems)}</span>
                </div>
              )}
              {invoice.totals.lineDiscountTotal !== undefined && (
                <div className="flex justify-between">
                  <span>− Line Discounts</span>
                  <span>{formatCurrency(invoice.totals.lineDiscountTotal)}</span>
                </div>
              )}
              {invoice.totals.itemsSubTotal !== undefined && (
                <div className="flex justify-between">
                  <span>Items Sub‑Total</span>
                  <span>{formatCurrency(invoice.totals.itemsSubTotal)}</span>
                </div>
              )}
              {invoice.totals.delivery > 0 && (
                <div className="flex justify-between">
                  <span>+ Delivery</span>
                  <span>{formatCurrency(invoice.totals.delivery)}</span>
                </div>
              )}
              {invoice.totals.packing > 0 && (
                <div className="flex justify-between">
                  <span>+ Packing</span>
                  <span>{formatCurrency(invoice.totals.packing)}</span>
                </div>
              )}
              {invoice.totals.insurance > 0 && (
                <div className="flex justify-between">
                  <span>+ Insurance</span>
                  <span>{formatCurrency(invoice.totals.insurance)}</span>
                </div>
              )}
              {invoice.totals.other > 0 && (
                <div className="flex justify-between">
                  <span>+ Other</span>
                  <span>{formatCurrency(invoice.totals.other)}</span>
                </div>
              )}
              {invoice.totals.discountTotal > 0 && (
                <div className="flex justify-between">
                  <span>− Order Discount</span>
                  <span>{formatCurrency(invoice.totals.discountTotal)}</span>
                </div>
              )}
              {invoice.totals.taxableBase !== undefined && (
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Taxable Base</span>
                  <span>{formatCurrency(invoice.totals.taxableBase)}</span>
                </div>
              )}
              {invoice.totals.taxType === 'IGST' && invoice.totals.taxBreakup?.igst !== undefined && (
                <div className="flex justify-between">
                  <span>IGST</span>
                  <span>{formatCurrency(invoice.totals.taxBreakup.igst)}</span>
                </div>
              )}
              {invoice.totals.taxType !== 'IGST' && (
                <>
                  {invoice.totals.taxBreakup?.cgst !== undefined && (
                    <div className="flex justify-between">
                      <span>CGST</span>
                      <span>{formatCurrency(invoice.totals.taxBreakup.cgst)}</span>
                    </div>
                  )}
                  {invoice.totals.taxBreakup?.sgst !== undefined && (
                    <div className="flex justify-between">
                      <span>SGST</span>
                      <span>{formatCurrency(invoice.totals.taxBreakup.sgst)}</span>
                    </div>
                  )}
                </>
              )}
              {invoice.totals.roundOff !== undefined && invoice.totals.roundOff !== 0 && (
                <div className="flex justify-between">
                  <span>Round Off</span>
                  <span>{formatCurrency(invoice.totals.roundOff)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 mt-2 border-t-2 border-slate-300 print:text-sm print:pt-1 print:mt-1">
                <span>Grand Total</span>
                <span>{formatCurrency(invoice.totals.grandTotal || 0)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-400 pt-3 border-t border-slate-200 print:text-[9px] print:pt-2">
          <p>Powered by FLYP — Smart Business Invoicing</p>
        </div>
      </div>
    </div>
  );
};

export default PublicInvoiceView;

