import React, { useEffect, useState } from 'react';
import { getFirestore, collection, onSnapshot, doc, getDoc, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import ProformaSummary from "../../retailer/ProformaSummary";

const PendingOrders = () => {
  const [pendingOrders, setPendingOrders] = useState([]);
  const db = getFirestore();
  const auth = getAuth();

  const handleDateChange = async (orderId, newDate) => {
    const user = auth.currentUser;
    if (!user) return;
    const orderRef = doc(db, 'businesses', user.uid, 'orderRequests', orderId);
    await updateDoc(orderRef, { expectedDeliveryDate: newDate });
  };

  const handleDeliveryModeChange = async (orderId, mode) => {
    const user = auth.currentUser;
    if (!user) return;
    const orderRef = doc(db, 'businesses', user.uid, 'orderRequests', orderId);
    await updateDoc(orderRef, { deliveryMode: mode });
  };

  const handlePaymentModeChange = async (orderId, newMode) => {
    const user = auth.currentUser;
    if (!user) return;
    const orderRef = doc(db, 'businesses', user.uid, 'orderRequests', orderId);
    await updateDoc(orderRef, { paymentMode: newMode });
  };

  const markAsShipped = async (orderId) => {
    const user = auth.currentUser;
    if (!user) return;

    const order = pendingOrders.find(o => o.id === orderId);
    if (!order) return;

    setPendingOrders(prev =>
      prev.map(o => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          deliveryDateError: !o.expectedDeliveryDate,
          deliveryModeError: !o.deliveryMode,
        };
      })
    );

    if (!order.expectedDeliveryDate || !order.deliveryMode) return;

    const orderRef = doc(db, 'businesses', user.uid, 'orderRequests', orderId);
    const retailerOrderRef = doc(db, 'businesses', order.retailerId, 'sentOrders', orderId);

    const updateData = {
      status: 'Shipped',
      retailerName: order.retailerName || order.retailer?.name || 'N/A',
      retailerEmail: order.retailerEmail || order.retailer?.email || 'N/A',
      retailerPhone: order.retailerPhone || order.retailer?.phone || 'N/A',
      paymentMethod: order.paymentMode || 'N/A',
      createdAt: order.timestamp?.seconds
        ? new Date(order.timestamp.seconds * 1000).toISOString()
        : new Date().toISOString(),
      expectedDeliveryDate: order.expectedDeliveryDate,
      deliveryMode: order.deliveryMode,
      statusTimestamps: {
        shippedAt: serverTimestamp()
      }
    };

    await updateDoc(orderRef, updateData);
    const retailerUpdateData = {
      status: 'Shipped',
      expectedDeliveryDate: order.expectedDeliveryDate,
      deliveryMode: order.deliveryMode,
      shippedAt: new Date().toISOString(),
      statusTimestamps: {
        shippedAt: serverTimestamp()
      }
    };
    await updateDoc(retailerOrderRef, retailerUpdateData);
  };

  const handleItemEdit = (orderId, index, field, value) => {
    setPendingOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        const updatedItems = [...order.items];
        updatedItems[index] = { ...updatedItems[index], [field]: value };
        return { ...order, items: updatedItems };
      })
    );
  };

  const handleDeleteItem = (orderId, index) => {
    setPendingOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        const updatedItems = order.items.filter((_, i) => i !== index);
        return { ...order, items: updatedItems };
      })
    );
  };

  const saveModifiedOrder = async (orderId) => {
    const user = auth.currentUser;
    if (!user) return;
    const updatedOrder = pendingOrders.find((o) => o.id === orderId);
    const orderRef = doc(db, 'businesses', user.uid, 'orderRequests', orderId);
    await updateDoc(orderRef, {
      items: updatedOrder.items,
      paymentMode: updatedOrder.paymentMode,
      deliveryMode: updatedOrder.deliveryMode || '',
      expectedDeliveryDate: updatedOrder.expectedDeliveryDate || '',
    });
  };

  const checkStockAvailability = (item) => {
    if (item.stockAvailable === undefined || item.stockAvailable === null) return { isOverstock: false, message: '' };
    if (item.quantity > item.stockAvailable) {
      return { isOverstock: true, message: `Only ${item.stockAvailable} in stock` };
    }
    return { isOverstock: false, message: '' };
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ordersRef = collection(db, 'businesses', user.uid, 'orderRequests');
    const q = query(ordersRef, where('status', 'in', ['Accepted', 'Modified']));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const enriched = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const retailerRef = doc(db, 'businesses', data.retailerId);
        const retailerSnap = await getDoc(retailerRef);
        const retailerData = retailerSnap.exists() ? retailerSnap.data() : {};

        // For each item, prefer proforma locked values if available, else fetch product info
        const itemsWithStock = await Promise.all((data.items || []).map(async (item, idx) => {
          // If a Proforma exists, prefer its locked values (price, gross per line)
          const pLine = Array.isArray(data.proforma?.lines) ? data.proforma.lines[idx] : undefined;
          // Start from original item
          let enriched = { ...item };

          // If product info is needed AND no proforma (to avoid overriding locked values)
          if (!pLine && item.productId) {
            try {
              const productRef = doc(db, 'products', item.productId);
              const productSnap = await getDoc(productRef);
              if (productSnap.exists()) {
                const productData = productSnap.data();
                enriched = {
                  ...enriched,
                  stockAvailable: productData.stockAvailable,
                  price: productData.sellingPrice || 0,
                  sku: productData.sku || '',
                  unit: productData.unit || ''
                };
              }
            } catch {
              // fail silently, keep item as is
            }
          }

          // Apply proforma-locked numbers when available
          if (pLine) {
            enriched = {
              ...enriched,
              price: Number(pLine.price ?? enriched.price ?? 0),
              proformaGross: Number(pLine.gross ?? 0),
              gstRate: Number(pLine.gstRate ?? enriched.gstRate ?? 0),
            };
          }

          return enriched;
        }));

        return {
          id: docSnap.id,
          ...data,
          items: itemsWithStock,
          retailerName: retailerData.businessName || retailerData.ownerName || 'N/A',
          retailerEmail: retailerData.email || 'N/A',
        };
      }));
      setPendingOrders(enriched);
    });

    return () => unsubscribe();
  }, []);

  // Status filter state and filteredOrders calculation
  const [statusFilter, setStatusFilter] = useState('All');
  const filteredOrders = pendingOrders.filter((order) => statusFilter === 'All' || order.status === statusFilter);

  // Helper functions for Indian date formatting
  const formatDateTime = (d) => {
    try {
      return new Date(d).toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch { return 'N/A'; }
  };
  const formatDate = (d) => {
    try {
      return new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    } catch { return 'N/A'; }
  };

  // Helpers to read prices from proforma snapshot when present
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

return (
    <div className="p-6 space-y-6 text-white">
      {/* Segmented control for status filter */}
      <div className="mb-4 sticky top-[72px] z-30 backdrop-blur-xl bg-[#0B0F14]/60 border border-white/10 rounded-xl px-3 py-2">
        <div className="flex gap-2 flex-wrap">
          {['All', 'Accepted', 'Modified'].map((status) => {
            const active = statusFilter === status;
            const base = 'px-4 py-1 rounded-full text-sm border transition backdrop-blur-xl';
            const on = 'bg-emerald-500 text-slate-900 border-transparent shadow-[0_8px_24px_rgba(16,185,129,0.35)]';
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

      {filteredOrders.map((order) => (
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
                  order.status === 'Accepted'
                    ? 'bg-emerald-400/15 text-emerald-300'
                    : order.status === 'Modified'
                    ? 'bg-amber-400/15 text-amber-300'
                    : 'bg-white/10 text-white/80'
                }`}
              >
                {order.status}
              </span>
            </div>
          </div>
          <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <p className="text-white/70">Email: {order.retailerEmail}</p>
            {order.status === 'Modified' ? (
              <label className="flex items-center gap-2">
                <span className="font-medium text-white/80">Payment Mode:</span>
                <select
                  value={order.paymentMode || ''}
                  onChange={(e) => handlePaymentModeChange(order.id, e.target.value)}
                  className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                >
                  <option value="">Select</option>
                  <option value="COD">Cash on Delivery (COD)</option>
                  <option value="Split Payment">Split Payment (50/50 or custom %)</option>
                  <option value="Advance Payment">Advance Payment</option>
                  <option value="End of Month">End of Month</option>
                  <option value="Credit Cycle">Credit Cycle (15/30 days)</option>
                  <option value="UPI">UPI</option>
                  <option value="Net Banking">Net Banking</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            ) : (
              <p className="text-white/70"><span className="font-medium">Payment Mode:</span> {order.paymentMode || 'N/A'}</p>
            )}
          </div>
          <p className="mt-1 text-white/60 text-sm">
            Requested On: {order.timestamp?.seconds ? formatDateTime(order.timestamp.seconds * 1000) : 'N/A'}
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
            {order.items.map((item, i) => {
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
                          className={`rounded px-2 py-1 bg-white/10 border ${isOverstock ? 'border-rose-500' : 'border-white/20'} text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition`}
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemEdit(order.id, i, 'quantity', parseInt(e.target.value))}
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
                        {(item.stockAvailable !== undefined && item.quantity > item.stockAvailable) && (
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
                  setPendingOrders(prev =>
                    prev.map(o => o.id === order.id ? { ...o, expectedDeliveryDate: e.target.value } : o)
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
                  setPendingOrders(prev =>
                    prev.map(o => o.id === order.id ? { ...o, deliveryMode: e.target.value } : o)
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
              className="px-4 py-2 rounded-full font-medium text-sm text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] transition"
            >
              Mark as Shipped
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingOrders;