import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { toast } from 'react-toastify';
import AddDeliveredItemsToInventory from "../../inventory/AddDeliveredItemsToInventory";
import ProformaSummary from "../ProformaSummary";
import AcceptProformaButton from "../AcceptProformaButton";

const TrackOrderTab = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const auth = getAuth();
  const db = getFirestore();

  // ----- Helpers for DIRECT vs PROFORMA and charges snapshot -----
  const isDirect = (o) => o?.statusCode === 'DIRECT';
  const isProformaPending = (o) => {
    const statusCode = o?.statusCode;
    const status = o?.status;
    
    // Check both statusCode and status fields for maximum compatibility
    return (
      statusCode === 'PROFORMA_SENT' ||
      statusCode === 'QUOTED' ||
      status === 'Quoted' ||
      status === 'PROFORMA_SENT' ||
      // Also check for proforma data presence
      (o?.proforma && (statusCode === 'QUOTED' || status === 'Quoted')) ||
      (o?.chargesSnapshot && (statusCode === 'QUOTED' || status === 'Quoted'))
    );
  };
  const getBreakdown = (o) => {
    const b = o?.chargesSnapshot?.breakdown || o?.proforma || {};
    const tb = b?.taxBreakup || {};
    return {
      ...b,
      cgst: b.cgst ?? tb.cgst ?? 0,
      sgst: b.sgst ?? tb.sgst ?? 0,
      igst: b.igst ?? tb.igst ?? 0,
    };
  };
  const getDefaultsUsed = (o) => o?.chargesSnapshot?.defaultsUsed || {};
  const deriveRate = (explicit, amount, taxableBase) => {
    if (typeof explicit === 'number') return explicit;
    const amt = Number(amount ?? 0);
    if (taxableBase > 0 && amt > 0) return Number(((amt / taxableBase) * 100).toFixed(2));
    return undefined;
  };

  // Format ETA (supports Firestore Timestamp, Date, YYYY-MM-DD, or plain string)
  const formatETA = (val) => {
    if (!val) return "Not specified";
    // Firestore Timestamp
    if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString();
    // Native Date
    if (val instanceof Date) return val.toLocaleDateString();
    // String formats
    if (typeof val === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        const d = new Date(val + "T00:00:00");
        return isNaN(d.getTime()) ? val : d.toLocaleDateString();
      }
      return val;
    }
    // Fallback attempt
    try {
      const d = new Date(val);
      return isNaN(d.getTime()) ? "Not specified" : d.toLocaleDateString();
    } catch {
      return "Not specified";
    }
  };

  const handleAddToInventory = async (order) => {
    try {
      const user = auth.currentUser;
      const orderRef = doc(db, "businesses", user.uid, "sentOrders", order.id);

      await updateDoc(orderRef, {
        inventorySynced: true,
        'statusTimestamps.inventorySyncedAt': serverTimestamp(),
      });

      setOrders((prevOrders) =>
        prevOrders.map((o) =>
          o.id === order.id ? { ...o, inventorySynced: true } : o
        )
      );

      toast.success(`Order ${order.id} added to inventory!`);
    } catch (error) {
      console.error("Failed to mark order as inventory synced:", error);
      toast.error("Failed to update order status. Try again.");
    }
  };

  useEffect(() => {
    const fetchOrders = () => {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "businesses", user.uid, "sentOrders")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
        setOrders(fetched);
        setLoading(false);
      });

      return () => unsubscribe();
    };

    fetchOrders();
  }, [auth]);

  const filteredOrders = filter === "All" ? orders : orders.filter((order) => {
    const orderStatus = order.status;
    const orderStatusCode = order.statusCode;
    
    // Handle different status representations
    if (filter === 'Quoted') {
      return orderStatus === 'Quoted' || orderStatusCode === 'QUOTED' || orderStatusCode === 'PROFORMA_SENT';
    }
    if (filter === 'Requested') {
      return orderStatus === 'Requested' || orderStatusCode === 'REQUESTED';
    }
    if (filter === 'Accepted') {
      return orderStatus === 'Accepted' || orderStatusCode === 'ACCEPTED';
    }
    if (filter === 'Rejected') {
      return orderStatus === 'Rejected' || orderStatusCode === 'REJECTED';
    }
    if (filter === 'Modified') {
      return orderStatus === 'Modified' || orderStatusCode === 'MODIFIED';
    }
    
    // Fallback to exact match
    return orderStatus === filter;
  });

  const progressSteps = ['Requested', 'Quoted', 'Accepted', 'Modified', 'Shipped', 'Delivered'];

  return (
    <div className="p-3 sm:p-4 lg:p-6 text-white">
      <div className="mb-3 sm:mb-4">
        <label className="mr-2 font-semibold text-white/80 text-sm sm:text-base">Filter by Status:</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-sm sm:text-base"
        >
          <option>All</option>
          <option>Requested</option>
          <option>Quoted</option>
          <option>Accepted</option>
          <option>Rejected</option>
          <option>Pending</option>
          <option>Modified</option>
          <option>Delivered</option>
        </select>
      </div>

      {loading ? (
        <p className="text-white/80 text-sm sm:text-base">Loading orders...</p>
      ) : filteredOrders.length === 0 ? (
        <p className="text-white/70 text-sm sm:text-base">No orders found for this filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-auto rounded-xl overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 min-w-[800px]">
            <thead>
              <tr className="bg-white/10 text-white/80">
                <th className="px-2 sm:px-3 py-2 border border-white/10 min-w-[120px]">Distributor</th>
                <th className="px-2 sm:px-3 py-2 border border-white/10 min-w-[120px]">Order Date</th>
                <th className="px-2 sm:px-3 py-2 border border-white/10 min-w-[80px]">Items</th>
                <th className="px-2 sm:px-3 py-2 border border-white/10 min-w-[100px]">Status</th>
                <th className="px-2 sm:px-3 py-2 border border-white/10 min-w-[120px]">Delivery ETA</th>
                <th className="px-2 sm:px-3 py-2 border border-white/10 min-w-[200px]">Progress</th>
              </tr>
            </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <React.Fragment key={order.id}>
                <tr
                  onClick={() =>
                    setExpandedOrderId((prevId) => (prevId === order.id ? null : order.id))
                  }
                  className="cursor-pointer hover:bg-white/10"
                >
                  <td className="px-2 sm:px-3 py-2 border border-white/10 text-xs sm:text-sm">{order.distributorName || "N/A"}</td>
                  <td className="px-2 sm:px-3 py-2 border border-white/10 text-xs sm:text-sm">
                    {order.timestamp?.toDate().toLocaleString() || "N/A"}
                  </td>
                  <td className="px-2 sm:px-3 py-2 border border-white/10 text-xs sm:text-sm text-center">{order.items?.length || 0}</td>
                  <td className="px-2 sm:px-3 py-2 border border-white/10 font-medium text-xs sm:text-sm">
                    {order.status || order.statusCode || 'Unknown'}
                    {(order.status === "Rejected" || order.statusCode === "REJECTED") && order.rejectionNote && (
                      <div className="text-xs text-rose-300 mt-1">Reason: {order.rejectionNote}</div>
                    )}
                  </td>
                  <td className="px-2 sm:px-3 py-2 border border-white/10 text-xs sm:text-sm">{formatETA(order.expectedDeliveryDate || order.eta)}</td>
                  <td className="px-2 sm:px-3 py-2 border border-white/10 text-xs sm:text-sm">
                    {(order.status === "Rejected" || order.statusCode === "REJECTED") ? (
                      <div className="flex gap-1 text-xs">
                        <span className="text-emerald-400 font-semibold">Requested</span>
                        <span>→</span>
                        <span className="text-rose-400 font-semibold">Rejected</span>
                      </div>
                    ) : (
                      <div className="flex gap-1 text-xs">
                        {progressSteps.map((step, idx) => {
                          // Map status to progress step index
                          const getCurrentIndex = () => {
                            const status = order.status || order.statusCode || '';
                            if (status === 'Requested' || status === 'REQUESTED') return 0;
                            if (status === 'Quoted' || status === 'QUOTED' || status === 'PROFORMA_SENT') return 1;
                            if (status === 'Accepted' || status === 'ACCEPTED') return 2;
                            if (status === 'Modified' || status === 'MODIFIED') return 3;
                            if (status === 'Shipped' || status === 'SHIPPED') return 4;
                            if (status === 'Delivered' || status === 'DELIVERED') return 5;
                            return 0;
                          };
                          
                          const currentIndex = getCurrentIndex();
                          return (
                            <React.Fragment key={idx}>
                              <span
                                className={
                                  currentIndex === idx
                                    ? 'text-emerald-300 font-semibold'
                                    : currentIndex > idx
                                    ? 'text-emerald-400 font-semibold'
                                    : 'text-white/40'
                                }
                              >
                                {step}
                              </span>
                              {idx !== progressSteps.length - 1 && <span>→</span>}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
                {expandedOrderId === order.id && (
                  <tr>
                    <td colSpan="6" className="p-4 bg-white/5">
                      <div className="text-sm text-white/80">
                        <p><strong>Order ID:</strong> {order.id}</p>
                        <p><strong>Distributor Name:</strong> {order.distributorName || "N/A"}</p>
                        <p><strong>Distributor Email:</strong> {order.distributorEmail || "N/A"}</p>
                        <p><strong>Distributor Phone:</strong> {order.distributorPhone || "N/A"}</p>
                        <p><strong>Distributor Address:</strong> {order.distributorAddress || "N/A"}</p>
                        <p><strong>Payment Mode:</strong> {order.paymentMode || "N/A"}</p>
                        <p><strong>Note:</strong> {order.note || "—"}</p>
                        <p><strong>Delivery ETA:</strong> {formatETA(order.expectedDeliveryDate || order.eta)}</p>

                        <p><strong>Status:</strong> {order.status}</p>
                        {order.statusTimestamps && (
                          <div className="mt-2 space-y-1 text-sm text-white/80">
                            {order.statusTimestamps.requestedAt && (
                              <p><strong>Requested At:</strong> {new Date(order.statusTimestamps.requestedAt.seconds * 1000).toLocaleString()}</p>
                            )}
                            {order.statusTimestamps.quotedAt && (
                              <p><strong>Quoted At:</strong> {new Date(order.statusTimestamps.quotedAt.seconds * 1000).toLocaleString()}</p>
                            )}
                            {order.statusTimestamps.acceptedAt && (
                              <p><strong>Accepted At:</strong> {new Date(order.statusTimestamps.acceptedAt.seconds * 1000).toLocaleString()}</p>
                            )}
                            {order.statusTimestamps.modifiedAt && (
                              <p><strong>Modified At:</strong> {new Date(order.statusTimestamps.modifiedAt.seconds * 1000).toLocaleString()}</p>
                            )}
                            {order.statusTimestamps.shippedAt && (
                              <p><strong>Shipped At:</strong> {new Date(order.statusTimestamps.shippedAt.seconds * 1000).toLocaleString()}</p>
                            )}
                            {order.statusTimestamps.deliveredAt && (
                              <p><strong>Delivered At:</strong> {new Date(order.statusTimestamps.deliveredAt.seconds * 1000).toLocaleString()}</p>
                            )}
                          </div>
                        )}

                        {/* Charges / Proforma Summary (supports DIRECT + legacy proforma) */}
                        {(() => {
                          const breakdown = getBreakdown(order);
                          const defaultsUsed = getDefaultsUsed(order);
                          const taxType = breakdown?.taxType || (breakdown?.igst > 0 ? 'IGST' : 'CGST_SGST');
                          const taxableBase = Number(breakdown?.taxableBase ?? 0);
                          const cgstRate = deriveRate(defaultsUsed.cgstRate, breakdown.cgst, taxableBase);
                          const sgstRate = deriveRate(defaultsUsed.sgstRate, breakdown.sgst, taxableBase);
                          const igstRate = deriveRate(defaultsUsed.igstRate ?? defaultsUsed.gstRate, breakdown.igst, taxableBase);
                          const row = (label, value) => (
                            <div className="flex justify-between py-0.5"><span>{label}</span><span>₹{Number(value || 0).toFixed(2)}</span></div>
                          );
                          const rowPct = (label, value) => (
                            <div className="flex justify-between py-0.5"><span>{label}</span><span>{Number(value || 0).toFixed(2)}%</span></div>
                          );

                          // Show only if we have any totals/charges info (chargesSnapshot or legacy proforma)
                          if (!breakdown || Object.keys(breakdown).length === 0) return null;

                          return (
                            <div className="mb-4 mt-3 p-3 rounded-lg border border-white/10 bg-white/5">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold">{isDirect(order) ? 'Order Charges (Direct)' : 'Proforma Summary'}</h4>
                                {isDirect(order) && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">Direct</span>
                                )}
                              </div>
                              <div className="text-sm text-white/85">
                                {row('Sub‑Total (pre‑charges)', breakdown.subTotal || breakdown.itemsSubTotal)}
                                {row('Delivery', breakdown.delivery)}
                                {row('Packing', breakdown.packing)}
                                {row('Insurance', breakdown.insurance)}
                                {row('Other', breakdown.other)}
                                {rowPct('Discount %', breakdown.discountPct)}
                                {row('Discount ₹', breakdown.discountAmt)}
                                {row('Round Off', breakdown.roundOff)}
                                <div className="flex justify-between py-0.5">
                                  <span>Tax Type</span>
                                  <span>{taxType === 'IGST' ? 'IGST' : 'CGST + SGST'}</span>
                                </div>
                                {taxType === 'IGST' ? (
                                  <div className="flex justify-between py-0.5">
                                    <span>{`IGST${igstRate !== undefined ? ` (${igstRate}%)` : ''}`}</span>
                                    <span>₹{Number(breakdown.igst || 0).toFixed(2)}</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex justify-between py-0.5">
                                      <span>{`CGST${cgstRate !== undefined ? ` (${cgstRate}%)` : ''}`}</span>
                                      <span>₹{Number(breakdown.cgst || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                      <span>{`SGST${sgstRate !== undefined ? ` (${sgstRate}%)` : ''}`}</span>
                                      <span>₹{Number(breakdown.sgst || 0).toFixed(2)}</span>
                                    </div>
                                  </>
                                )}
                                <div className="flex justify-between py-0.5 font-semibold">
                                  <span>Grand Total</span>
                                  <span>₹{Number(breakdown.grandTotal || 0).toFixed(2)}</span>
                                </div>
                              </div>

                              {/* Retailer action buttons for proforma flow only */}
                              {isProformaPending(order) && (
                                <div className="flex gap-2 mt-3">
                                  <AcceptProformaButton
                                    distributorId={order.distributorId}
                                    retailerId={auth.currentUser?.uid}
                                    orderId={order.id}
                                    hasProforma={true}
                                  />
                                </div>
                              )}

                              {isDirect(order) && (
                                <div className="text-xs text-emerald-300 mt-2">Direct order — no proforma acceptance needed.</div>
                              )}
                            </div>
                          );
                        })()}

                        <div className="mt-3">
                          <strong>Products:</strong>
                          <table className="w-full mt-2 text-sm rounded-lg overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl">
                            <thead className="bg-white/10">
                              <tr>
                                <th className="px-3 py-1 text-left border border-white/10">Product Name</th>
                                <th className="px-3 py-1 text-left border border-white/10">Brand</th>
                                <th className="px-3 py-1 text-left border border-white/10">Category</th>
                                <th className="px-3 py-1 text-left border border-white/10">Quantity</th>
                                <th className="px-3 py-1 text-left border border-white/10">Unit</th>
                                <th className="px-3 py-1 text-left border border-white/10">Price</th>
                                <th className="px-3 py-1 text-left border border-white/10">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(order.items || []).map((item, idx) => (
                                <tr key={idx}>
                                  <td className="px-3 py-1 border border-white/10">{item.name || item.productName || "—"}</td>
                                  <td className="px-3 py-1 border border-white/10">{item.brand || "—"}</td>
                                  <td className="px-3 py-1 border border-white/10">{item.category || "—"}</td>
                                  <td className="px-3 py-1 border border-white/10">{item.quantity ?? item.qty ?? 0}</td>
                                  <td className="px-3 py-1 border border-white/10">{item.unit}</td>
                                  <td className="px-3 py-1 border border-white/10">
                                    ₹{parseFloat(item.price || item.unitPrice || item.sellingPrice || 0).toFixed(2)}
                                  </td>
                                  <td className="px-3 py-1 border border-white/10">
                                    ₹{(parseFloat(item.price || item.unitPrice || item.sellingPrice || 0) * parseFloat(item.quantity ?? item.qty ?? 0)).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-3 font-semibold text-white">
                          Total Price: ₹
                          {(order.items || []).reduce((total, item) => {
                            const price = parseFloat(item.price || item.unitPrice || item.sellingPrice || 0);
                            const qty = parseFloat(item.quantity ?? item.qty ?? 0);
                            return total + price * qty;
                          }, 0).toFixed(2)}
                        </div>

                        {order.status === "Delivered" && (
                          order.inventorySynced ? (
                            <button className="mt-3 px-4 py-2 rounded-xl bg-white/20 text-white/80 cursor-not-allowed" disabled>
                              ✅ Added to Inventory
                            </button>
                          ) : (
                            <button
                              className="mt-3 px-4 py-2 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
                              onClick={() => setSelectedOrder(order)}
                            >
                              Add Items to Inventory
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          </table>
        </div>
      )}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="rounded-xl w-11/12 max-w-3xl p-4 overflow-y-auto max-h-[90vh] border border-white/10 bg-[#0B0F14]/90 backdrop-blur-xl text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
            <AddDeliveredItemsToInventory
              order={selectedOrder}
              onClose={() => setSelectedOrder(null)}
              onSuccess={() => {
                toast.success("Items successfully added to inventory!");
                setSelectedOrder(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackOrderTab;