import React, { useEffect, useState, useMemo } from 'react';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  getDoc,
  query,
  where,
  updateDoc,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { toast } from 'react-toastify';
import ProformaSummary from '../../retailer/ProformaSummary';
import { codeOf } from '../../../constants/orderStatus';
import * as orderPolicy from '../../../lib/orders/orderPolicy';

const PendingOrders = () => {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [shippingIds, setShippingIds] = useState(new Set());

  const db = getFirestore();
  const auth = getAuth();

  // ---------- Helpers ----------
  const formatDateTime = (d) => {
    try {
      return new Date(d).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const checkStockAvailability = (item) => {
    if (item.stockAvailable === undefined || item.stockAvailable === null) {
      return { isOverstock: false, message: '' };
    }
    if (Number(item.quantity) > Number(item.stockAvailable)) {
      return { isOverstock: true, message: `Only ${item.stockAvailable} in stock` };
    }
    return { isOverstock: false, message: '' };
  };

  const getDisplayPrice = (order, idx, item) => {
    if (Array.isArray(order?.proforma?.lines)) {
      const ln = order.proforma.lines[idx];
      if (ln && ln.price != null) return Number(ln.price) || 0;
    }
    return Number(item?.price) || 0;
  };

  const getDisplaySubtotal = (order, idx, item) => {
    if (Array.isArray(order?.proforma?.lines)) {
      const ln = order.proforma.lines[idx];
      if (ln && ln.gross != null) return Number(ln.gross) || 0;
    }
    const qty = Number(item?.quantity) || 0;
    const price = Number(item?.price) || 0;
    return qty * price;
  };

  // ---------- Inline editors ----------
  const handleDateChange = async (orderId, newDate) => {
    const user = auth.currentUser;
    if (!user) return;
    const orderRef = doc(db, 'businesses', user.uid, 'orderRequests', orderId);
    await updateDoc(orderRef, { expectedDeliveryDate: newDate || '' });
  };

  const handleDeliveryModeChange = async (orderId, mode) => {
    const user = auth.currentUser;
    if (!user) return;
    const orderRef = doc(db, 'businesses', user.uid, 'orderRequests', orderId);
    await updateDoc(orderRef, { deliveryMode: mode || '' });
  };


  const handleItemEdit = (orderId, index, field, value) => {
    setPendingOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        const updated = [...(order.items || [])];
        updated[index] = { ...updated[index], [field]: value };
        return { ...order, items: updated };
      }),
    );
  };

  const handleDeleteItem = (orderId, index) => {
    setPendingOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        const updated = (order.items || []).filter((_, i) => i !== index);
        return { ...order, items: updated };
      }),
    );
  };

  const saveModifiedOrder = async (orderId) => {
    const user = auth.currentUser;
    if (!user) return;
    const updatedOrder = pendingOrders.find((o) => o.id === orderId);
    if (!updatedOrder) return;
    await orderPolicy.updateLines({
      db,
      auth,
      distributorId: user.uid,
      orderId,
      items: updatedOrder.items,
      deliveryMode: updatedOrder.deliveryMode,
      expectedDeliveryDate: updatedOrder.expectedDeliveryDate,
      paymentMode: updatedOrder.payment || updatedOrder.paymentMode,
    });
    if (typeof toast === 'function') toast.success('Changes saved');
  };

  // ---------- Ship flow ----------
  const markAsShipped = async (orderId) => {
    const user = auth.currentUser;
    if (!user) return;

    const order = pendingOrders.find((o) => o.id === orderId);
    if (!order) return;

    // UI validation and loading guard
    setPendingOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, deliveryDateError: !o.expectedDeliveryDate, deliveryModeError: !o.deliveryMode }
          : o,
      ),
    );
    if (!order.expectedDeliveryDate || !order.deliveryMode) return;

    // Disable the button instantly (optimistic)
    setShippingIds((prev) => new Set(prev).add(orderId));

    try {
      await orderPolicy.shipOrder({
        db,
        auth,
        distributorId: user.uid,
        orderId,
        expectedDeliveryDate: order.expectedDeliveryDate,
        deliveryMode: order.deliveryMode,
        courier: order.courier || null,
        awb: order.awb || null,
      });

      // Optimistic UI update
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (typeof toast === 'function') toast.success('Order marked as Shipped → Track Orders');
    } catch (err) {
      console.error('shipOrder failed:', err);
      if (typeof toast === 'function') toast.error(err.message || 'Failed to mark as Shipped.');
    } finally {
      setShippingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // ---------- Live data ----------
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ordersRef = collection(db, 'businesses', user.uid, 'orderRequests');

    // Primary: canonical statusCode
    const q1 = query(ordersRef, where('statusCode', 'in', ['ACCEPTED', 'MODIFIED', 'PACKED']));
    // Fallback: legacy status (when accept wrote only `status: 'Accepted'`)
    const q2 = query(ordersRef, where('status', 'in', ['Accepted', 'Modified', 'Packed']));

    // aggregator by id (dedupe between q1 & q2)
    const byId = new Map();

    const enrich = async (docSnap) => {
      const data = docSnap.data() || {};
      const retailerId =
        typeof data.retailerId === 'string' && data.retailerId.trim().length
          ? data.retailerId.trim()
          : null;

      // Retailer profile (guard for passive/provisional without retailerId)
      let retailerData = {};
      if (retailerId) {
        try {
          const retailerRef = doc(db, 'businesses', retailerId);
          const retailerSnap = await getDoc(retailerRef);
          if (retailerSnap.exists()) retailerData = retailerSnap.data() || {};
        } catch {
          /* keep empty retailerData */
        }
      } else if (data.retailerInfo) {
        // passive snapshot written at accept time
        retailerData = {
          businessName: data.retailerInfo.name || data.retailerInfo.businessName,
          ownerName: data.retailerInfo.ownerName || null,
          email: data.retailerInfo.email || null,
          phone: data.retailerInfo.phone || null,
          city: data.retailerInfo.city || null,
          state: data.retailerInfo.state || null,
          address: data.retailerInfo.address || null,
        };
      }

      // Items enrichment: prefer proforma line values
      const itemsSrc = Array.isArray(data.items) ? data.items : [];
      const itemsWithStock = await Promise.all(
        itemsSrc.map(async (item, idx) => {
          const pLine = Array.isArray(data.proforma?.lines) ? data.proforma.lines[idx] : undefined;
          let enriched = { ...item };

          // prefer distributorProductId, fall back to productId
          const prodId =
            (typeof item.distributorProductId === 'string' && item.distributorProductId.trim()) ||
            (typeof item.productId === 'string' && item.productId.trim()) ||
            null;

          if (!pLine && prodId) {
            try {
              const productRef = doc(db, 'businesses', user.uid, 'products', prodId);
              const productSnap = await getDoc(productRef);
              if (productSnap.exists()) {
                const p = productSnap.data() || {};
                enriched = {
                  ...enriched,
                  stockAvailable: p.quantity ?? p.stockAvailable,
                  price: p.sellingPrice || p.price || enriched.price || 0,
                  sku: p.sku || enriched.sku || '',
                  unit: p.unit || enriched.unit || '',
                };
              }
            } catch {
              /* ignore product enrichment failure */
            }
          }

          if (pLine) {
            enriched = {
              ...enriched,
              price: Number(pLine.price ?? enriched.price ?? 0),
              proformaGross: Number(pLine.gross ?? 0),
              gstRate: Number(pLine.gstRate ?? enriched.gstRate ?? 0),
            };
          }

          return enriched;
        }),
      );

      return {
        id: docSnap.id,
        ...data,
        items: itemsWithStock,
        retailerName:
          retailerData.businessName ||
          retailerData.ownerName ||
          data.retailerName ||
          'N/A',
        retailerEmail:
          retailerData.email ||
          data.retailerEmail ||
          data.retailerInfo?.email ||
          'N/A',
      };
    };

    const unsub1 = onSnapshot(q1, async (snap) => {
      const rows = await Promise.all(snap.docs.map(enrich));
      rows.forEach((r) => byId.set(r.id, r));
      setPendingOrders(Array.from(byId.values()));
    });

    const unsub2 = onSnapshot(q2, async (snap) => {
      const rows = await Promise.all(snap.docs.map(enrich));
      rows.forEach((r) => byId.set(r.id, r));
      setPendingOrders(Array.from(byId.values()));
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  // Filter (supports legacy status, too)
  const filteredOrders = useMemo(() => {
    return pendingOrders.filter((order) => {
      if (statusFilter === 'All') return true;
      if (statusFilter === 'Modified') return order.status === 'Modified';
      const orderCode = codeOf(order.statusCode || order.status);
      const filterCode = codeOf(statusFilter);
      return orderCode && filterCode && orderCode === filterCode;
    });
  }, [pendingOrders, statusFilter]);

  return (
    <div className="p-6 space-y-6 text-white">
      {/* Segmented control for status filter */}
      <div className="mb-4 sticky top-[72px] z-30 backdrop-blur-xl bg-[#0B0F14]/60 border border-white/10 rounded-xl px-3 py-2">
        <div className="flex gap-2 flex-wrap">
          {['All', 'Accepted', 'Packed', 'Modified'].map((status) => {
            const active = statusFilter === status;
            const base = 'px-4 py-1 rounded-full text-sm border transition backdrop-blur-xl';
            const on =
              'bg-emerald-500 text-slate-900 border-transparent shadow-[0_8px_24px_rgba(16,185,129,0.35)]';
            const off = 'bg-white/10 text-white border-white/15 hover:bg-white/15';
            return (
              <button
                key={status}
                type="button"
                className={`${base} ${active ? on : off}`}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            );
          })}
        </div>
      </div>

      {filteredOrders.map((order) => {
        const displayStatus =
          order.status ||
          (order.statusCode
            ? order.statusCode.charAt(0) + order.statusCode.slice(1).toLowerCase()
            : 'N/A');
        const paymentLabel = orderPolicy.formatPaymentLabel(order.paymentMode || order.payment);

        return (
          <div
            key={order.id}
            className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl hover:shadow-emerald-400/10 transition p-6"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-lg text-white">Retailer: {order.retailerName}</h3>
                <p className="text-sm text-white/60">Order ID: {order.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    order.statusCode === 'ACCEPTED'
                      ? 'bg-emerald-400/15 text-emerald-300'
                      : order.statusCode === 'MODIFIED'
                      ? 'bg-amber-400/15 text-amber-300'
                      : order.statusCode === 'PACKED'
                      ? 'bg-sky-400/15 text-sky-300'
                      : 'bg-white/10 text-white/80'
                  }`}
                >
                  {displayStatus}
                </span>
              </div>
            </div>

            <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <p className="text-white/70">Email: {order.retailerEmail}</p>
              {order.status === 'Modified' ? (
                <label className="flex items-center gap-2">
                  <span className="font-medium text-white/80">Payment Mode:</span>
                  <select
                    value={orderPolicy.extractPaymentCode(order.payment || order.paymentMode) || ''}
                    onChange={(e) =>
                      setPendingOrders(prev =>
                        prev.map(o =>
                          o.id === order.id ? { ...o, paymentMode: e.target.value } : o
                        )
                      )
                    }
                    className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                  >
                    <option value="">Select</option>
                    <option value="COD">Cash on Delivery (COD)</option>
                    <option value="SPLIT">Split Payment (50/50 or custom %)</option>
                    <option value="ADVANCE">Advance Payment</option>
                    <option value="END_OF_MONTH">End of Month</option>
                    <option value="CREDIT_CYCLE">Credit Cycle (15/30 days)</option>
                    <option value="UPI">UPI</option>
                    <option value="NET_BANKING">Net Banking</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
              ) : (
                <p className="text-white/70">
                  <span className="font-medium">Payment Mode:</span> {paymentLabel}
                </p>
              )}
            </div>

            <p className="mt-1 text-white/60 text-sm">
              Requested On:{' '}
              {order.timestamp?.seconds ? formatDateTime(order.timestamp.seconds * 1000) : 'N/A'}
            </p>

            {order?.proforma && (
              <div className="mt-4">
                <ProformaSummary
                  proforma={order.proforma}
                  distributorState={order.distributorState}
                  retailerState={order.retailerState}
                />
              </div>
            )}

            <div className="mt-4 border border-white/10 rounded-lg overflow-hidden">
              <div className="grid grid-cols-8 font-semibold bg-white/5 border-b border-white/10 px-4 py-2 text-white">
                <div>Name</div>
                <div>Brand</div>
                <div>Category</div>
                <div>Qty</div>
                <div>Unit</div>
                <div>Actions</div>
                <div>Price</div>
                <div>Subtotal</div>
              </div>

              {(order.items || []).map((item, i) => {
                const { isOverstock, message } = checkStockAvailability(item);
                return (
                  <div
                    key={i}
                    className="grid grid-cols-8 border-t border-white/10 px-4 py-2 text-sm items-center gap-2 hover:bg-white/5 transition"
                  >
                    {order.status === 'Modified' ? (
                      <>
                        <input
                          className="rounded px-2 py-1 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                          type="text"
                          value={item.productName}
                          onChange={(e) => handleItemEdit(order.id, i, 'productName', e.target.value)}
                        />
                        <input
                          className="rounded px-2 py-1 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                          type="text"
                          value={item.brand || ''}
                          onChange={(e) => handleItemEdit(order.id, i, 'brand', e.target.value)}
                        />
                        <input
                          className="rounded px-2 py-1 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                          type="text"
                          value={item.category || ''}
                          onChange={(e) => handleItemEdit(order.id, i, 'category', e.target.value)}
                        />
                        <div className="flex flex-col gap-1">
                          <input
                            className={`rounded px-2 py-1 bg-white/10 border ${
                              isOverstock ? 'border-rose-500' : 'border-white/20'
                            } text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition`}
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemEdit(order.id, i, 'quantity', parseInt(e.target.value))
                            }
                          />
                          {isOverstock && (
                            <span className="text-xs text-rose-300">{message}</span>
                          )}
                        </div>
                        <input
                          className="rounded px-2 py-1 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                          type="text"
                          value={item.unit || ''}
                          onChange={(e) => handleItemEdit(order.id, i, 'unit', e.target.value)}
                        />
                        <button
                          onClick={() => handleDeleteItem(order.id, i)}
                          className="text-rose-300 font-semibold px-2 py-1 rounded hover:bg-white/10 transition"
                          title="Delete Item"
                          type="button"
                        >
                          Delete
                        </button>
                        <div></div>
                        <div></div>
                      </>
                    ) : (
                      <>
                        <div>{item.productName}</div>
                        <div>{item.brand || 'N/A'}</div>
                        <div>{item.category || 'N/A'}</div>
                        <div>
                          {item.quantity}
                          {item.stockAvailable !== undefined &&
                            Number(item.quantity) > Number(item.stockAvailable) && (
                              <span className="text-rose-300 text-xs ml-1">Out of Stock</span>
                            )}
                        </div>
                        <div>{item.unit || 'N/A'}</div>
                        <div></div>
                        <div>₹{getDisplayPrice(order, i, item).toFixed(2)}</div>
                        <div>₹{getDisplaySubtotal(order, i, item).toFixed(2)}</div>
                      </>
                    )}
                  </div>
                );
              })}

              {order?.proforma?.grandTotal != null && (
                <div className="flex justify-end px-4 py-2 border-t border-white/10 text-sm font-semibold">
                  <span className="mr-2 text-white/80">Grand Total:</span>
                  <span>₹{Number(order.proforma.grandTotal || 0).toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col md:flex-row md:items-center md:gap-6 gap-3">
              <label className="flex items-center gap-2 font-medium text-white/80">
                Expected Delivery Date:
                <input
                  type="date"
                  value={order.expectedDeliveryDate || ''}
                  onChange={(e) => {
                    handleDateChange(order.id, e.target.value);
                    setPendingOrders((prev) =>
                      prev.map((o) =>
                        o.id === order.id ? { ...o, expectedDeliveryDate: e.target.value } : o,
                      ),
                    );
                  }}
                  className="rounded-lg px-3 py-2 ml-1 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                />
              </label>
              {order.deliveryDateError && (
                <p className="text-rose-300 text-sm mt-1">Please select a valid delivery date.</p>
              )}

              <label className="flex items-center gap-2 font-medium text-white/80">
                Delivery Mode:
                <select
                  value={order.deliveryMode || ''}
                  onChange={(e) => {
                    handleDeliveryModeChange(order.id, e.target.value);
                    setPendingOrders((prev) =>
                      prev.map((o) =>
                        o.id === order.id ? { ...o, deliveryMode: e.target.value } : o,
                      ),
                    );
                  }}
                  className="rounded-lg px-3 py-2 ml-1 bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                >
                  <option value="">Select</option>
                  <option value="By Distributor">By Distributor</option>
                  <option value="Shiprocket">Shiprocket</option>
                  <option value="Delhivery">Delhivery</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              {order.deliveryModeError && (
                <p className="text-rose-300 text-sm mt-1">Please select a delivery mode.</p>
              )}
            </div>

            <div className="mt-4 flex gap-3 flex-wrap">
              {order.status === 'Modified' && (
                <button
                  onClick={() => saveModifiedOrder(order.id)}
                  className="px-4 py-2 rounded-full font-medium text-sm text-slate-900 bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-300 hover:shadow-[0_8px_24px_rgba(251,191,36,0.35)] transition"
                >
                  Save Changes
                </button>
              )}
              <button
                onClick={() => markAsShipped(order.id)}
                disabled={shippingIds.has(order.id)}
                className={`px-4 py-2 rounded-full font-medium text-sm text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] transition ${shippingIds.has(order.id) ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {shippingIds.has(order.id) ? 'Shipping…' : 'Mark as Shipped'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PendingOrders;