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
        setLoading(false);
        return;
      }

      try {
        const invoiceRef = doc(db, `businesses/${distributorId}/invoices`, invoiceId);
        const invoiceSnap = await getDoc(invoiceRef);
        
        if (!invoiceSnap.exists()) {
          setLoading(false);
          return;
        }

        const invoiceData = { id: invoiceSnap.id, ...invoiceSnap.data() };
        setInvoice(invoiceData);

        // Fetch order data if available
        if (invoiceData.orderId) {
          try {
            const orderRef = doc(db, `businesses/${distributorId}/orderRequests`, invoiceData.orderId);
            const orderSnap = await getDoc(orderRef);
            if (orderSnap.exists()) {
              setOrderData({ id: orderSnap.id, ...orderSnap.data() });
            }
          } catch (err) {
            console.error("Error fetching order data:", err);
          }
        }
      } catch (err) {
        console.error("Error fetching invoice:", err);
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
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 md:p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-6 border-b">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Invoice</p>
            <h1 className="text-3xl font-bold text-slate-900">
              {invoice.invoiceNumber || invoice.id}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Issued on {formatDate(invoice.issuedAt)}
            </p>
          </div>
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              downloadingPdf
                ? "bg-slate-400 text-white cursor-not-allowed"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {downloadingPdf ? "Preparing PDF..." : "Download PDF"}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-xs uppercase text-emerald-600 mb-1">Grand Total</p>
            <p className="text-2xl font-bold text-emerald-700">
              {formatCurrency(invoice.totals?.grandTotal || 0)}
            </p>
          </div>
          <div className={`border rounded-lg p-4 ${
            paymentStatus.isPaid
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            <p className="text-xs uppercase mb-1 text-slate-600">Payment Status</p>
            <p className={`text-lg font-semibold ${
              paymentStatus.isPaid ? "text-emerald-700" : "text-amber-700"
            }`}>
              {paymentStatus.label}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-xs uppercase text-slate-600 mb-1">Payment Method</p>
            <p className="text-lg font-semibold text-slate-900">
              {getPaymentModeLabel(invoice)}
            </p>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-xs uppercase text-slate-500 mb-2">Bill To</p>
            <p className="font-semibold text-lg text-slate-900">
              {invoice.buyer?.businessName || "N/A"}
            </p>
            <div className="text-sm text-slate-600 mt-2 space-y-1">
              {invoice.buyer?.email && <p>{invoice.buyer.email}</p>}
              {invoice.buyer?.phone && <p>{invoice.buyer.phone}</p>}
              {(invoice.buyer?.city || invoice.buyer?.state) && (
                <p>{[invoice.buyer?.city, invoice.buyer?.state].filter(Boolean).join(", ")}</p>
              )}
            </div>
          </div>
          <div className="border border-slate-200 rounded-lg p-4">
            <p className="text-xs uppercase text-slate-500 mb-2">Sold By</p>
            <p className="font-semibold text-lg text-slate-900">
              {invoice.seller?.businessName || "N/A"}
            </p>
            <div className="text-sm text-slate-600 mt-2 space-y-1">
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
        {orderData && orderData.items && (
          <div className="mb-6">
            <h3 className="font-semibold text-lg text-slate-900 mb-4">Order Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Brand</th>
                    <th className="px-3 py-2 text-right">Unit</th>
                    <th className="px-3 py-2 text-right">Base Price</th>
                    <th className="px-3 py-2 text-right">MRP</th>
                    <th className="px-3 py-2 text-right">GST %</th>
                    <th className="px-3 py-2 text-right">Selling Price</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orderData.items.map((item, idx) => {
                    const qty = Number(item.quantity || item.qty || 0);
                    const price = Number(item.sellingPrice || item.price || item.unitPrice || 0);
                    const total = qty * price;
                    const basePrice = getDisplayBasePrice(orderData, idx, item);
                    const gstRate =
                      (Array.isArray(orderData?.proforma?.lines) &&
                        orderData.proforma.lines[idx]?.gstRate) ||
                      item.gstRate ||
                      item.taxRate ||
                      0;
                    return (
                      <tr key={idx} className="border-t border-slate-200">
                        <td className="px-3 py-2">
                          <p className="font-semibold">{item.productName || item.name || "N/A"}</p>
                          {item.hsnCode && <p className="text-xs text-slate-500">HSN: {item.hsnCode}</p>}
                        </td>
                        <td className="px-3 py-2">{item.sku || "—"}</td>
                        <td className="px-3 py-2">{item.brand || "—"}</td>
                        <td className="px-3 py-2 text-right">{item.unit || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          {basePrice > 0 ? formatCurrency(basePrice) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {item.mrp > 0 ? formatCurrency(item.mrp) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">{gstRate ? `${gstRate}%` : "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                          {formatCurrency(price)}
                        </td>
                        <td className="px-3 py-2 text-center">{qty}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {formatCurrency(total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Breakdown */}
        {invoice.totals && (
          <div className="border border-slate-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-base text-slate-900 mb-3">Invoice Breakdown</h3>
            <div className="space-y-1 text-sm">
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
              <div className="flex justify-between text-lg font-semibold text-slate-900 pt-3 border-t">
                <span>Grand Total</span>
                <span>{formatCurrency(invoice.totals.grandTotal || 0)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 pt-4 border-t">
          <p>Powered by FLYP — Smart Business Invoicing</p>
        </div>
      </div>
    </div>
  );
};

export default PublicInvoiceView;

