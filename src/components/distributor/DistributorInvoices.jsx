import React, { useEffect, useState } from "react";
import { db } from "../../firebase/firebaseConfig";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { splitFromMrp } from "../../utils/pricing";

const DistributorInvoices = () => {
  const auth = getAuth();
  const [distributorId, setDistributorId] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setDistributorId(user.uid);
      } else {
        setDistributorId(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!distributorId) {
      setLoading(false);
      return;
    }

    console.log('[DistributorInvoices] Fetching invoices for distributorId:', distributorId);
    const invoicesCol = collection(db, `businesses/${distributorId}/invoices`);

    const unsubscribe = onSnapshot(
      invoicesCol,
      (snapshot) => {
        console.log('[DistributorInvoices] Snapshot received, size:', snapshot.size);
        const data = [];
        snapshot.forEach((doc) => {
          const invoiceData = { id: doc.id, ...doc.data() };
          console.log('[DistributorInvoices] Invoice found:', doc.id, invoiceData);
          data.push(invoiceData);
        });
        // Sort by issuedAt descending (newest first), with invoices without issuedAt at the end
        data.sort((a, b) => {
          const aDate = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
          const bDate = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
          return bDate - aDate; // descending order
        });
        console.log('[DistributorInvoices] Setting invoices, count:', data.length);
        setInvoices(data);
        setLoading(false);
      },
      (err) => {
        console.error("[DistributorInvoices] Error loading invoices:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [distributorId]);

  const handleViewInvoice = async (invoice) => {
    setSelectedInvoice(invoice);
    setLoadingOrder(true);
    setOrderData(null);

    // Fetch order data if orderId exists
    if (invoice.orderId && distributorId) {
      try {
        const orderRef = doc(db, `businesses/${distributorId}/orderRequests`, invoice.orderId);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
          setOrderData({ id: orderSnap.id, ...orderSnap.data() });
        }
      } catch (err) {
        console.error("Error fetching order data:", err);
      } finally {
        setLoadingOrder(false);
      }
    } else {
      setLoadingOrder(false);
    }
  };

  const closeInvoiceModal = () => {
    setSelectedInvoice(null);
    setOrderData(null);
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

  // Get the calculated base/unit price for display based on pricing mode
  const getDisplayBasePrice = (order, idx, item) => {
    const pricingMode = item.pricingMode || "LEGACY";
    const basePrice = Number(item.basePrice || 0);
    const mrp = Number(item.mrp || 0);
    const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
    const baseGstRate = Number(item.gstRate || item.taxRate || 0);

    // Get proforma line if available
    const pLine = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
    const lineGstRate = pLine?.gstRate !== undefined ? Number(pLine.gstRate) : baseGstRate;

    if (pricingMode === "MRP_INCLUSIVE") {
      // MRP is final, calculate base from MRP
      if (mrp > 0 && lineGstRate > 0) {
        const split = splitFromMrp(mrp, lineGstRate);
        return split.base;
      }
      return mrp || sellingPrice;
    } else if (pricingMode === "SELLING_PRICE") {
      // Selling price is final (GST included), calculate base from it
      if (sellingPrice > 0 && lineGstRate > 0) {
        const split = splitFromMrp(sellingPrice, lineGstRate);
        return split.base;
      }
      return sellingPrice;
    } else if (pricingMode === "BASE_PLUS_TAX") {
      // Base price is explicit
      if (basePrice > 0) {
        return basePrice;
      }
      // Fallback: calculate from selling price if base is missing
      if (sellingPrice > 0 && lineGstRate > 0) {
        const split = splitFromMrp(sellingPrice, lineGstRate);
        return split.base;
      }
      return sellingPrice;
    } else {
      // LEGACY: use basePrice if available, otherwise sellingPrice
      return basePrice || sellingPrice;
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-gray-700 text-lg font-medium">
        Loading invoices...
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Distributor Invoices</h1>

      {invoices.length === 0 ? (
        <div className="text-gray-600 text-md">No invoices found.</div>
      ) : (
        <div className="overflow-x-auto mt-4 border rounded-lg shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-2 text-left">Invoice No</th>
                <th className="px-4 py-2 text-left">Retailer</th>
                <th className="px-4 py-2 text-left">Amount</th>
                <th className="px-4 py-2 text-left">Issued At</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{inv.invoiceNumber || inv.id}</td>
                  <td className="px-4 py-2">{inv.buyer?.businessName || "N/A"}</td>
                  <td className="px-4 py-2">
                    ₹{inv.totals?.grandTotal?.toLocaleString("en-IN") || 0}
                  </td>
                  <td className="px-4 py-2">
                    {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : "--"}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={() => handleViewInvoice(inv)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice View Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 text-slate-100 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
            {/* Header */}
            <div className="sticky top-0 bg-slate-900 border-b border-white/10 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-100">Invoice Details</h2>
              <button
                onClick={closeInvoiceModal}
                className="text-slate-400 hover:text-slate-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Invoice Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-300">Invoice Number</p>
                  <p className="font-semibold text-lg text-slate-100">
                    {selectedInvoice.invoiceNumber || selectedInvoice.id}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-300">Issued Date</p>
                  <p className="font-semibold text-slate-100">
                    {selectedInvoice.issuedAt
                      ? new Date(selectedInvoice.issuedAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Buyer and Seller Info */}
              <div className="grid grid-cols-2 gap-6 border-t pt-4">
                <div>
                  <h3 className="font-semibold text-slate-100 mb-2">Bill To (Buyer)</h3>
                  <div className="text-sm text-slate-300 space-y-1">
                    <p className="font-medium text-slate-100">
                      {selectedInvoice.buyer?.businessName || "N/A"}
                    </p>
                    {selectedInvoice.buyer?.email && <p>Email: {selectedInvoice.buyer.email}</p>}
                    {selectedInvoice.buyer?.phone && <p>Phone: {selectedInvoice.buyer.phone}</p>}
                    {(selectedInvoice.buyer?.city || selectedInvoice.buyer?.state) && (
                      <p>
                        {[selectedInvoice.buyer.city, selectedInvoice.buyer.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100 mb-2">Sold By (Seller)</h3>
                  <div className="text-sm text-slate-300 space-y-1">
                    <p className="font-medium text-slate-100">
                      {selectedInvoice.seller?.businessName || "N/A"}
                    </p>
                    {selectedInvoice.seller?.email && <p>Email: {selectedInvoice.seller.email}</p>}
                    {selectedInvoice.seller?.phone && <p>Phone: {selectedInvoice.seller.phone}</p>}
                    {selectedInvoice.seller?.gstNumber && <p>GST: {selectedInvoice.seller.gstNumber}</p>}
                    {(selectedInvoice.seller?.city || selectedInvoice.seller?.state) && (
                      <p>
                        {[selectedInvoice.seller.city, selectedInvoice.seller.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Items */}
              {loadingOrder ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">Loading order items...</p>
                </div>
              ) : orderData ? (
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-slate-100 mb-4">Order Items</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-800">
                        <tr>
                          <th className="px-4 py-2 text-left text-slate-200">Product Details</th>
                          <th className="px-4 py-2 text-left text-slate-200">SKU</th>
                          <th className="px-4 py-2 text-left text-slate-200">Brand</th>
                          <th className="px-4 py-2 text-left text-slate-200">Category</th>
                          <th className="px-4 py-2 text-right text-slate-200">Unit</th>
                          <th className="px-4 py-2 text-right text-slate-200">Base Price</th>
                          <th className="px-4 py-2 text-right text-slate-200">MRP</th>
                          <th className="px-4 py-2 text-right text-slate-200">GST %</th>
                          <th className="px-4 py-2 text-right text-slate-200">Selling Price</th>
                          <th className="px-4 py-2 text-center text-slate-200">Qty</th>
                          <th className="px-4 py-2 text-right text-slate-200">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(orderData.items || []).map((item, idx) => {
                          const qty = Number(item.quantity || item.qty || 0);
                          const price = Number(item.sellingPrice || item.price || item.unitPrice || 0);
                          const total = qty * price;
                          return (
                            <tr key={idx} className="border-b">
                              <td className="px-4 py-2">
                                <div className="font-medium">{item.productName || item.name || "N/A"}</div>
                                {item.hsnCode && (
                                  <div className="text-xs text-slate-400 mt-0.5">HSN: {item.hsnCode}</div>
                                )}
                              </td>
                              <td className="px-4 py-2">{item.sku || "—"}</td>
                              <td className="px-4 py-2">{item.brand || "—"}</td>
                              <td className="px-4 py-2">{item.category || "—"}</td>
                              <td className="px-4 py-2 text-right">{item.unit || "—"}</td>
                              <td className="px-4 py-2 text-right">
                                {(() => {
                                  const basePrice = getDisplayBasePrice(orderData, idx, item);
                                  return basePrice > 0 ? `₹${basePrice.toFixed(2)}` : "—";
                                })()}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : "—"}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {(() => {
                                  const gstRate = Number(item.gstRate || item.taxRate || 0);
                                  const pLine = Array.isArray(orderData?.proforma?.lines) ? orderData.proforma.lines[idx] : undefined;
                                  const displayGstRate = pLine?.gstRate !== undefined ? Number(pLine.gstRate) : gstRate;
                                  return displayGstRate > 0 ? `${displayGstRate}%` : "—";
                                })()}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <span className="font-semibold text-emerald-400">₹{price.toFixed(2)}</span>
                              </td>
                              <td className="px-4 py-2 text-center">{qty}</td>
                              <td className="px-4 py-2 text-right">
                                <span className="font-semibold">₹{total.toFixed(2)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="border-t pt-4">
                  <p className="text-slate-300 text-sm">
                    {selectedInvoice.orderId
                      ? "Order data not available"
                      : "No order ID associated with this invoice"}
                  </p>
                </div>
              )}

              {/* Payment and Totals */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Payment Method:</span>
                  <span className="font-semibold">
                    {getPaymentModeLabel(selectedInvoice)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Payment Status:</span>
                  <span
                    className={`font-semibold ${
                      selectedInvoice.payment?.isPaid ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {selectedInvoice.payment?.isPaid ? "Paid" : "Pending"}
                  </span>
                </div>

                {/* Full Breakdown */}
                {selectedInvoice.totals && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3 text-slate-100">Invoice Breakdown</h4>
                    <div className="space-y-1 text-sm text-slate-300">
                      {selectedInvoice.totals.grossItems !== undefined && (
                        <div className="flex justify-between"><span>Unit Price Total</span><span>₹{Number(selectedInvoice.totals.grossItems || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.lineDiscountTotal !== undefined && (
                        <div className="flex justify-between"><span>− Line Discounts</span><span>₹{Number(selectedInvoice.totals.lineDiscountTotal || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.itemsSubTotal !== undefined && (
                        <div className="flex justify-between"><span>Items Sub‑Total</span><span>₹{Number(selectedInvoice.totals.itemsSubTotal || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.delivery > 0 && (
                        <div className="flex justify-between"><span>+ Delivery</span><span>₹{Number(selectedInvoice.totals.delivery || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.packing > 0 && (
                        <div className="flex justify-between"><span>+ Packing</span><span>₹{Number(selectedInvoice.totals.packing || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.insurance > 0 && (
                        <div className="flex justify-between"><span>+ Insurance</span><span>₹{Number(selectedInvoice.totals.insurance || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.other > 0 && (
                        <div className="flex justify-between"><span>+ Other</span><span>₹{Number(selectedInvoice.totals.other || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.discountTotal > 0 && (
                        <div className="flex justify-between"><span>− Order Discount</span><span>₹{Number(selectedInvoice.totals.discountTotal || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.taxableBase !== undefined && (
                        <div className="flex justify-between font-semibold"><span>Taxable Base</span><span>₹{Number(selectedInvoice.totals.taxableBase || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.taxType && (
                        <div className="flex justify-between">
                          <span>Tax Type</span>
                          <span className="text-xs">
                            {selectedInvoice.totals.taxType === 'IGST'
                              ? `IGST (Interstate)`
                              : `CGST + SGST (Intrastate)`}
                          </span>
                        </div>
                      )}
                      {selectedInvoice.totals.taxType === 'IGST' && selectedInvoice.totals.taxBreakup?.igst !== undefined && (
                        <div className="flex justify-between"><span>IGST</span><span>₹{Number(selectedInvoice.totals.taxBreakup.igst || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.taxType !== 'IGST' && (
                        <>
                          {selectedInvoice.totals.taxBreakup?.cgst !== undefined && (
                            <div className="flex justify-between"><span>CGST</span><span>₹{Number(selectedInvoice.totals.taxBreakup.cgst || 0).toFixed(2)}</span></div>
                          )}
                          {selectedInvoice.totals.taxBreakup?.sgst !== undefined && (
                            <div className="flex justify-between"><span>SGST</span><span>₹{Number(selectedInvoice.totals.taxBreakup.sgst || 0).toFixed(2)}</span></div>
                          )}
                        </>
                      )}
                      {selectedInvoice.totals.roundOff !== undefined && selectedInvoice.totals.roundOff !== 0 && (
                        <div className="flex justify-between"><span>Round Off</span><span>₹{Number(selectedInvoice.totals.roundOff || 0).toFixed(2)}</span></div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-lg font-semibold text-slate-100">Grand Total:</span>
                  <span className="text-2xl font-bold text-slate-100">
                    ₹{Number(selectedInvoice.totals?.grandTotal || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Order ID if available */}
              {selectedInvoice.orderId && (
                <div className="border-t pt-4">
                  <p className="text-sm text-slate-300">
                    <span className="font-medium">Order ID:</span> {selectedInvoice.orderId}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributorInvoices;