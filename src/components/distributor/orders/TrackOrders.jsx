import React, { useEffect, useState, useRef } from 'react';
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { exportOrderCSV } from "../../../lib/exporters/csv";
import { downloadOrderExcel } from "../../../lib/exporters/excel";
import { downloadOrderPDF } from "../../../lib/exporters/pdf";
import ProformaSummary from "../../retailer/ProformaSummary";

const TrackOrders = () => {
  const [orders, setOrders] = useState([]);
  const [expandedOrderIds, setExpandedOrderIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [activeSection, setActiveSection] = useState('Out for Delivery');
  // --- Deep link support for ?tab=&sub= in the hash ---
  useEffect(() => {
    const applyFromHash = () => {
      const hash = window.location.hash || '';
      const qIndex = hash.indexOf('?');
      if (qIndex !== -1) {
        const params = new URLSearchParams(hash.substring(qIndex + 1));
        const sub = (params.get('sub') || '').toLowerCase();
        if (sub === 'payment-due') setActiveSection('Payment Due');
        else if (sub === 'out-for-delivery') setActiveSection('Out for Delivery');
        else if (sub === 'paid' || sub === 'paid-orders') setActiveSection('Paid Orders');
      }
    };
    applyFromHash();
    window.addEventListener('hashchange', applyFromHash);
    return () => window.removeEventListener('hashchange', applyFromHash);
  }, []);

  const setSectionAndHash = (name) => {
    setActiveSection(name);
    try {
      const hash = window.location.hash || '#/distributor-dashboard';
      const [path, query = ''] = hash.split('?');
      const params = new URLSearchParams(query);
      params.set('tab', 'track-orders');
      if (name === 'Payment Due') params.set('sub', 'payment-due');
      else if (name === 'Out for Delivery') params.set('sub', 'out-for-delivery');
      else if (name === 'Paid Orders') params.set('sub', 'paid');
      else params.delete('sub');
      const newHash = `${path}?${params.toString()}`;
      if (newHash !== hash) window.history.replaceState(null, '', newHash);
    } catch {}
  };
  const db = getFirestore();
  const auth = getAuth();
  const [currentRetailers, setCurrentRetailers] = useState({}); // live profile by retailerId
  const [connectedRetailerMap, setConnectedRetailerMap] = useState({}); // keyed by retailerId
  const [creditDaysEdit, setCreditDaysEdit] = useState({}); // orderId -> edited credit days
  const retailerSubsRef = useRef({}); // keep onSnapshot unsubscribers per retailerId

  const toggleOrder = (id) => {
    setExpandedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const safeName = (s) => (s || "order").toString().replace(/[^a-z0-9_-]+/gi, "_");
  const exportCSV = (order) => {
    const base = `${safeName(order.retailerBusinessName || order.retailerName)}_${order.id}`;
    exportOrderCSV(order, `${base}.csv`);
  };
  const exportExcel = (order) => {
    const base = `${safeName(order.retailerBusinessName || order.retailerName)}_${order.id}`;
    downloadOrderExcel(order, `${base}.xlsx`);
  };
  const exportPDF = (order) => {
    const base = `${safeName(order.retailerBusinessName || order.retailerName)}_${order.id}`;
    downloadOrderPDF(order, `${base}.pdf`);
  };

  const getEditedCreditDays = (order) => {
    const v = creditDaysEdit[order.id];
    return (typeof v === 'number' && v > 0) ? v : Number(order.creditDays || 15);
  };
  const duePreviewFromDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + Number(days || 0));
    return d;
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      const q = query(
        collection(db, 'businesses', user.uid, 'orderRequests'),
        where('status', 'in', ['Shipped', 'Out for Delivery', 'Delivered'])
      );

      const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        const orderData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const aDelivered = a.status === 'Delivered';
            const bDelivered = b.status === 'Delivered';

            if (aDelivered !== bDelivered) {
              return aDelivered ? 1 : -1;
            }

            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
          });
        setOrders(orderData);
      });

      // Cleanup Firestore subscription on unmount
      return () => unsubscribeFirestore();
    });

    // Cleanup Auth listener on unmount
    return () => unsubscribeAuth();
  }, []);

  // Subscribe to retailer profile docs for any retailerIds in orders
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    const ids = Array.from(new Set(orders.map(o => o.retailerId).filter(Boolean)));

    ids.forEach((id) => {
      if (retailerSubsRef.current[id]) return; // already subscribed
      const retailerRef = doc(db, 'businesses', id);
      const unsub = onSnapshot(retailerRef, (snap) => {
        if (snap.exists()) {
          setCurrentRetailers((prev) => ({ ...prev, [id]: snap.data() }));
        }
      });
      retailerSubsRef.current[id] = unsub;
    });
  }, [orders]);

  // Subscribe to connectedRetailers collection for the distributor
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const connCol = collection(db, 'businesses', user.uid, 'connectedRetailers');
      const unsubConn = onSnapshot(connCol, (snap) => {
        const m = {};
        snap.forEach((d) => {
          const data = d.data();
          if (data?.retailerId) {
            m[data.retailerId] = data; // includes retailerPhone, retailerEmail, address, city, state
          }
        });
        setConnectedRetailerMap(m);
      });
      return () => unsubConn();
    });
    return () => unsubAuth();
  }, []);

  const markAsDelivered = async (orderId) => {
    const user = auth.currentUser;
    if (!user) return;
    
    const distributorOrderRef = doc(db, 'businesses', user.uid, 'orderRequests', orderId);
    const distributorOrderSnap = await getDoc(distributorOrderRef);
    const orderData = distributorOrderSnap.data();
    if (!orderData || !orderData.retailerId) return;

    const retailerOrderRef = doc(db, 'businesses', orderData.retailerId, 'sentOrders', orderId);

    const now = new Date();
    let updatePayload = {
      status: 'Delivered',
      deliveredAt: now.toISOString(),
      'statusTimestamps.deliveredAt': serverTimestamp()
    };

    // Handle Credit Cycle logic
    if (orderData.paymentMethod === 'Credit Cycle' && orderData.creditDays) {
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + Number(orderData.creditDays));
      updatePayload.creditDueDate = dueDate.toISOString();
      updatePayload.isPaid = false;
    }

    await updateDoc(distributorOrderRef, updatePayload);
    await updateDoc(retailerOrderRef, updatePayload);
    toast.success("📦 Order marked as Delivered!", {
      position: "top-right",
      autoClose: 3000,
      icon: "🚚"
    });
  };

  // Confirm COD payment (writes to both distributor & retailer copies)
  const confirmCODPayment = async (order) => {
    const user = auth.currentUser;
    if (!user) return;
    const distributorOrderRef = doc(db, 'businesses', user.uid, 'orderRequests', order.id);
    const retailerOrderRef = doc(db, 'businesses', order.retailerId, 'sentOrders', order.id);
    const payload = {
      isPaid: true,
      paymentStatus: 'Paid',
      paidAt: new Date().toISOString()
    };
    await updateDoc(distributorOrderRef, payload);
    await updateDoc(retailerOrderRef, payload);
    toast.success('💰 Payment received marked (COD)');
  };

  // Guarded deliver action respecting payment mode rules
  const guardedMarkDelivered = async (order) => {
    // COD requires payment first
    if (order.paymentMethod === 'COD' && !order.isPaid) {
      toast.info("For COD, please confirm 'Payment Received' first.");
      return;
    }

    // For Credit Cycle, persist (possibly edited) creditDays to both docs before delivering
    if (order.paymentMethod === 'Credit Cycle') {
      const days = Number(getEditedCreditDays(order));
      if (!Number.isFinite(days) || days <= 0) {
        toast.error('Invalid credit days');
        return;
      }
      const user = auth.currentUser; if (!user) return;
      const distributorOrderRef = doc(db, 'businesses', user.uid, 'orderRequests', order.id);
      const retailerOrderRef = doc(db, 'businesses', order.retailerId, 'sentOrders', order.id);
      await updateDoc(distributorOrderRef, { creditDays: days });
      await updateDoc(retailerOrderRef, { creditDays: days });
    }

    await markAsDelivered(order.id);
  };

  // Split orders into Payment Due and Paid Orders, apply search & date filter to each section
  const searchText = searchQuery.toLowerCase();
  const matchesSearch = (order) =>
    order.id?.toLowerCase().includes(searchText) ||
    order.retailerName?.toLowerCase().includes(searchText) ||
    order.retailerEmail?.toLowerCase().includes(searchText) ||
    order.retailerPhone?.toLowerCase().includes(searchText) ||
    order.retailerAddress?.toLowerCase().includes(searchText) ||
    order.city?.toLowerCase().includes(searchText);
  const matchesDate = (order) =>
    filterDate
      ? order.expectedDeliveryDate?.slice(0, 10) === filterDate
      : true;

  // Helper: Compute credit due date for an order
  const computeCreditDueDate = (order) => {
    if (order?.creditDueDate) return new Date(order.creditDueDate);
    if (order?.deliveredAt && (order?.creditDays || order?.creditDays === 0)) {
      const d = new Date(order.deliveredAt);
      d.setDate(d.getDate() + Number(order.creditDays || 0));
      return d;
    }
    return null;
  };

  // Out for Delivery: orders that are shipped or out for delivery
  const outForDeliveryOrders = orders.filter((order) =>
    (order.status === 'Shipped' || order.status === 'Out for Delivery') &&
    matchesSearch(order) && matchesDate(order)
  );

  // Payment Due: Credit Cycle, not paid, compute/fallback due date
  let paymentDueOrders = orders.filter((order) => {
    if (order.paymentMethod !== 'Credit Cycle') return false;
    if (order.isPaid === true || order.paymentStatus === 'Paid') return false;
    const due = computeCreditDueDate(order);
    return !!due && matchesSearch(order) && matchesDate(order);
  });
  paymentDueOrders = paymentDueOrders
    .map((o) => ({ ...o, __dueDate: computeCreditDueDate(o) }))
    .sort((a, b) => a.__dueDate - b.__dueDate);

  // Paid Orders: isPaid === true OR paymentStatus === 'Paid'
  let paidOrders = orders.filter(
    (order) => (order.isPaid === true || order.paymentStatus === 'Paid') &&
               matchesSearch(order) &&
               matchesDate(order)
  );

  // Proforma-aware helpers
  const getDisplayPrice = (order, idx, item) => {
    const ln = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
    if (ln && ln.price != null) return Number(ln.price) || 0;
    return Number(item?.price) || 0;
  };
  const getDisplaySubtotal = (order, idx, item) => {
    const ln = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
    if (ln && ln.gross != null) return Number(ln.gross) || 0;
    const qty = Number(item?.quantity) || 0;
    const price = Number(item?.price) || 0;
    return qty * price;
  };
  // Prefer proforma grandTotal for header totals
  const sumOrderTotal = (order) => {
    if (order?.proforma?.grandTotal != null) return Number(order.proforma.grandTotal) || 0;
    return (order.items || []).reduce((acc, item, idx) => acc + getDisplaySubtotal(order, idx, item), 0);
  };
  const paymentDueTotal = paymentDueOrders.reduce((acc, o) => acc + sumOrderTotal(o), 0);
  const paidOrdersTotal = paidOrders.reduce((acc, o) => acc + sumOrderTotal(o), 0);

  // Date formatting helpers
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

  return (
    <div className="p-4 text-white">
      <ToastContainer />
      <h2 className="text-2xl font-bold mb-4">Track Orders</h2>
      {/* Filter/Search Controls */}
      <div className="sticky top-[72px] z-30 backdrop-blur-xl bg-[#0B0F14]/60 supports-[backdrop-filter]:bg-[#0B0F14]/50 border border-white/15 rounded-xl p-4 mb-4 flex flex-col md:flex-row md:items-center gap-4">
        <input
          type="text"
          placeholder="Search by order ID, retailer, phone, email, etc."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 rounded-lg w-full md:w-1/2 bg-white/10 border border-white/15 placeholder-white/50 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
        />
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="px-4 py-2 rounded-lg bg-white/10 border border-white/15 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
        />
      </div>
      {/* Section Toggle Segmented Control */}
      <div className="inline-flex rounded-full bg-white/5 border border-white/15 overflow-hidden mb-4 backdrop-blur-xl">
        <button
          onClick={() => setSectionAndHash('Out for Delivery')}
          className={
            "px-4 py-2 font-medium text-sm transition focus:outline-none " +
            (activeSection === 'Out for Delivery'
              ? "bg-emerald-500/20 text-emerald-200"
              : "text-white/70 hover:bg-white/5")
          }
        >
          Out for Delivery ({outForDeliveryOrders.length})
        </button>
        <button
          onClick={() => setSectionAndHash('Payment Due')}
          className={
            "px-4 py-2 font-medium text-sm transition focus:outline-none border-l border-white/10 " +
            (activeSection === 'Payment Due'
              ? "bg-amber-500/20 text-amber-200"
              : "text-white/70 hover:bg-white/5")
          }
        >
          Payment Due ({paymentDueOrders.length})
        </button>
        <button
          onClick={() => setSectionAndHash('Paid Orders')}
          className={
            "px-4 py-2 font-medium text-sm transition focus:outline-none border-l border-white/10 " +
            (activeSection === 'Paid Orders'
              ? "bg-sky-500/20 text-sky-200"
              : "text-white/70 hover:bg-white/5")
          }
        >
          Paid Orders ({paidOrders.length})
        </button>
      </div>
      {paymentDueOrders.length === 0 && paidOrders.length === 0 ? (
        <p className="text-white/60 mt-8 text-center">No orders to track yet.</p>
      ) : (
        <>
          {activeSection === 'Out for Delivery' && (
            <div>
              <h3 className="text-lg font-semibold text-emerald-200 mb-2">🚚 Out for Delivery</h3>
              {outForDeliveryOrders.length === 0 ? (
                <div className="text-white/60 mb-6">No orders are currently out for delivery.</div>
              ) : (
                outForDeliveryOrders.map((order) => (
                  <div key={order.id} className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl overflow-hidden mb-4 transition hover:bg-white/10">
                    {/* --- header --- */}
                    <div className="flex justify-between items-center px-4 pt-4 pb-2">
                      <div>
                        <span className="font-bold text-lg text-white">
                          {order.retailerBusinessName || order.retailerName || order.retailer?.name || 'N/A'}
                        </span>
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-sky-500/15 text-sky-200">{order.status}</span>
                    </div>
                    {/* subheader */}
                    <div className="flex flex-wrap gap-6 items-center text-sm text-white/60 px-4 pb-2">
                      <span><span className="font-medium text-white/80">Total:</span> ₹{sumOrderTotal(order).toFixed(2)}</span>
                      <span className="px-2 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium">Payment: {order.paymentMethod || 'N/A'}</span>
                      {order.paymentMethod === 'Credit Cycle' && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-white/70 font-medium">Credit Days:</label>
                          <input
                            type="number"
                            min={1}
                            max={180}
                            className="w-16 px-2 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={getEditedCreditDays(order)}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setCreditDaysEdit((prev) => ({ ...prev, [order.id]: Number.isFinite(val) ? val : '' }));
                            }}
                          />
                          <span className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-200 text-[11px] font-medium">
                            Due if delivered today: {formatDate(duePreviewFromDays(getEditedCreditDays(order)))}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* action buttons */}
                    <div className="px-4 pb-2 flex flex-col md:flex-row gap-2">
                      {order.paymentMethod === 'COD' && !order.isPaid && (
                        <button onClick={() => confirmCODPayment(order)} className="rounded-lg px-4 py-2 font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-500 transition">
                          Confirm Payment Received
                        </button>
                      )}
                      <button
                        onClick={() => guardedMarkDelivered(order)}
                        className={`rounded-lg px-4 py-2 font-medium text-white transition ${order.paymentMethod === 'COD' && !order.isPaid ? 'bg-white/10 cursor-not-allowed' : 'bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-500'}`}
                        disabled={order.paymentMethod === 'COD' && !order.isPaid}
                      >
                        Mark Delivered
                      </button>
                    </div>

                    {/* expand/collapse */}
                    <div className="flex justify-end px-4 pb-2">
                      <button onClick={() => toggleOrder(order.id)} className="text-sm text-blue-600 hover:underline focus:outline-none">
                        {expandedOrderIds.includes(order.id) ? 'Hide Details' : 'Show Details'}
                      </button>
                    </div>

                    {/* details (same reusable layout as other tabs) */}
                    {expandedOrderIds.includes(order.id) && (
                      <div className="p-4 space-y-2 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold mb-1">At time of order</div>
                            <div className="font-medium text-white">{order.retailerBusinessName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-white/70">Owner: {order.ownerName || order.retailerOwnerName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-white/70">
                              {(() => {
                                const snapAddr = [order.retailerAddress, order.city, order.state].filter(Boolean).join(', ');
                                const current = currentRetailers[order.retailerId] || {};
                                const currAddr = [current.address, current.city, current.state].filter(Boolean).join(', ');
                                const conn = connectedRetailerMap[order.retailerId] || {};
                                const connAddr = [conn.address, conn.city, conn.state].filter(Boolean).join(', ');
                                return snapAddr || currAddr || connAddr || '—';
                              })()}
                            </div>
                          </div>
                          <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold mb-1">Current profile</div>
                            {(() => {
                              const current = currentRetailers[order.retailerId] || {};
                              const currentTitle = current.businessName || current.retailerName || current.ownerName || '—';
                              const currentOwner = current.ownerName || '—';
                              const currentAddress = [current.address, current.city, current.state].filter(Boolean).join(', ') || '—';
                              return (
                                <>
                                  <div className="font-medium text-white">{currentTitle}</div>
                                  <div className="text-sm text-white/70">Owner: {currentOwner}</div>
                                  <div className="text-sm text-white/70">{currentAddress}</div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <p><strong>Order ID:</strong> {order.id}</p>
                        <p><strong>Retailer Email:</strong> {order.retailerEmail || order.retailer?.email || currentRetailers[order.retailerId]?.email || connectedRetailerMap[order.retailerId]?.retailerEmail || 'N/A'}</p>
                        <p><strong>Retailer Phone:</strong> {order.retailerPhone || order.retailer?.phone || currentRetailers[order.retailerId]?.phone || connectedRetailerMap[order.retailerId]?.retailerPhone || 'N/A'}</p>
                        <p><strong>Payment Method:</strong> {order.paymentMethod || 'N/A'}</p>
                        <p><strong>Delivery Mode:</strong> {order.deliveryMode || 'N/A'}</p>
                        {/* Proforma Summary Card (if proforma exists) */}
                        {order?.proforma && (
                          <div className="mt-4">
                            <ProformaSummary
                              proforma={order.proforma}
                              distributorState={order.distributorState}
                              retailerState={order.retailerState || order.state}
                            />
                          </div>
                        )}
                        {/* Items Table (same as other tabs) */}
                        <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-3">
                          <h4 className="font-semibold mb-2">Items Ordered:</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full table-auto">
                              <thead className="bg-white/5">
                                <tr>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Product Name</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Brand</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">SKU</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-white/70">Qty</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Price</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(order.items || []).map((item, idx) => (
                                  <tr key={idx} className="hover:bg-white/5 transition">
                                    <td className="px-2 py-2">{item.productName || 'N/A'}</td>
                                    <td className="px-2 py-2">{item.brand || '—'}</td>
                                    <td className="px-2 py-2">{item.sku || '—'}</td>
                                    <td className="px-2 py-2 text-center">{item.quantity}</td>
                                    <td className="px-2 py-2 text-right">₹{getDisplayPrice(order, idx, item).toFixed(2)}</td>
                                    <td className="px-2 py-2 text-right">₹{getDisplaySubtotal(order, idx, item).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="text-right font-semibold mt-2">Total: ₹{sumOrderTotal(order).toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          {activeSection === 'Payment Due' && (
            <div>
              <h3 className="text-lg font-semibold text-amber-200 mb-2">📅 Payment Due</h3>
              {paymentDueOrders.length === 0 ? (
                <div className="text-white/60 mb-6">No payment due orders.</div>
              ) : (
                paymentDueOrders.map((order) => (
                  <div key={order.id} className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl overflow-hidden mb-4 transition hover:bg-white/10">
                    <div className="flex justify-between items-center px-4 pt-4 pb-2">
                      <div>
                        <span className="font-bold text-lg text-white">{order.retailerBusinessName || order.retailerName || order.retailer?.name || 'N/A'}</span>
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-200">{order.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-6 items-center text-sm text-white/60 px-4 pb-2">
                      {order.deliveredAt && (
                        <span><span className="font-medium text-white/80">Delivered:</span> {formatDate(order.deliveredAt)}</span>
                      )}
                      {(order.creditDueDate || order.__dueDate) && (
                        <span className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-200 text-xs font-medium">
                          Credit Due Date: <span className="font-semibold">{formatDate(order.creditDueDate || order.__dueDate)}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex justify-end px-4 pb-2">
                      <button onClick={() => toggleOrder(order.id)} className="text-sm text-blue-600 hover:underline focus:outline-none">
                        {expandedOrderIds.includes(order.id) ? 'Hide Details' : 'Show Details'}
                      </button>
                    </div>
                    {expandedOrderIds.includes(order.id) && (
                      <div className="p-4 space-y-3 text-sm">
                        {/* Credit info header */}
                        <div className="flex flex-wrap items-center gap-3">
                          {order.deliveredAt && (
                            <span><span className="font-medium text-white/80">Delivered:</span> {formatDate(order.deliveredAt)}</span>
                          )}
                          {(order.creditDueDate || order.__dueDate) && (
                            <span className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-200 text-xs font-medium">
                              Credit Due Date: <span className="font-semibold">{formatDate(order.creditDueDate || order.__dueDate)}</span>
                            </span>
                          )}
                        </div>

                        {/* Retailer info: historical vs current */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          {/* Historical snapshot at time of order */}
                          <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold mb-1">At time of order</div>
                            <div className="font-medium text-white">{order.retailerBusinessName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-white/70">Owner: {order.ownerName || order.retailerOwnerName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-white/70">
                              {(() => {
                                const snapAddr = [order.retailerAddress, order.city, order.state].filter(Boolean).join(', ');
                                const current = currentRetailers[order.retailerId] || {};
                                const currAddr = [current.address, current.city, current.state].filter(Boolean).join(', ');
                                const conn = connectedRetailerMap[order.retailerId] || {};
                                const connAddr = [conn.address, conn.city, conn.state].filter(Boolean).join(', ');
                                return snapAddr || currAddr || connAddr || '—';
                              })()}
                            </div>
                          </div>
                          {/* Current live profile */}
                          <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold mb-1">Current profile</div>
                            {(() => {
                              const current = currentRetailers[order.retailerId] || {};
                              const currentTitle = current.businessName || current.retailerName || current.ownerName || '—';
                              const currentOwner = current.ownerName || '—';
                              const currentAddress = [current.address, current.city, current.state].filter(Boolean).join(', ') || '—';
                              return (
                                <>
                                  <div className="font-medium text-white">{currentTitle}</div>
                                  <div className="text-sm text-white/70">Owner: {currentOwner}</div>
                                  <div className="text-sm text-white/70">{currentAddress}</div>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Order meta */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <p><strong>Order ID:</strong> {order.id}</p>
                          <p><strong>Payment Method:</strong> {order.paymentMethod || 'N/A'}</p>
                          <p><strong>Retailer Email:</strong> {order.retailerEmail || order.retailer?.email || currentRetailers[order.retailerId]?.email || connectedRetailerMap[order.retailerId]?.retailerEmail || 'N/A'}</p>
                          <p><strong>Retailer Phone:</strong> {order.retailerPhone || order.retailer?.phone || currentRetailers[order.retailerId]?.phone || connectedRetailerMap[order.retailerId]?.retailerPhone || 'N/A'}</p>
                          <p><strong>Delivery Mode:</strong> {order.deliveryMode || 'N/A'}</p>
                          {order.deliveredAt && (
                            <p><strong>Delivered On:</strong> {formatDateTime(order.deliveredAt)}</p>
                          )}
                        </div>

                        {/* Proforma Summary Card (if proforma exists) */}
                        {order?.proforma && (
                          <div className="mt-4">
                            <ProformaSummary
                              proforma={order.proforma}
                              distributorState={order.distributorState}
                              retailerState={order.retailerState || order.state}
                            />
                          </div>
                        )}
                        {/* Items Table */}
                        <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-3">
                          <h4 className="font-semibold mb-2">Items Ordered:</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full table-auto">
                              <thead className="bg-white/5">
                                <tr>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Product Name</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Brand</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">SKU</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-white/70">Qty</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Price</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(order.items || []).map((item, idx) => (
                                  <tr key={idx} className="hover:bg-white/5 transition">
                                    <td className="px-2 py-2">{item.productName || 'N/A'}</td>
                                    <td className="px-2 py-2">{item.brand || '—'}</td>
                                    <td className="px-2 py-2">{item.sku || '—'}</td>
                                    <td className="px-2 py-2 text-center">{item.quantity}</td>
                                    <td className="px-2 py-2 text-right">₹{getDisplayPrice(order, idx, item).toFixed(2)}</td>
                                    <td className="px-2 py-2 text-right">₹{getDisplaySubtotal(order, idx, item).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="text-right font-semibold mt-2">Total: ₹{sumOrderTotal(order).toFixed(2)}</div>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={
                            "px-2 py-1 rounded-full text-xs font-medium " +
                            (order.paymentMethod === 'Credit Cycle' ? 'bg-amber-500/15 text-amber-200' : 'bg-white/10 text-white/80')
                          }>
                            Payment: {order.paymentMethod || 'N/A'}
                          </span>
                          <span className={
                            "px-2 py-1 rounded-full text-xs font-medium " +
                            (order.deliveryMode === 'Self Pickup' ? 'bg-emerald-500/15 text-emerald-200' : order.deliveryMode === 'Courier' ? 'bg-sky-500/15 text-sky-200' : 'bg-white/10 text-white/80')
                          }>
                            Delivery: {order.deliveryMode || 'N/A'}
                          </span>
                        </div>

                        {/* Action */}
                        <div className="mt-4 flex flex-col md:flex-row gap-2 items-center">
                          <button
                            onClick={async () => {
                              const user = auth.currentUser; if (!user) return;
                              const distributorOrderRef = doc(db, 'businesses', user.uid, 'orderRequests', order.id);
                              const retailerOrderRef = doc(db, 'businesses', order.retailerId, 'sentOrders', order.id);
                              const paymentPayload = { isPaid: true, paymentStatus: 'Paid', paidAt: new Date().toISOString() };
                              await updateDoc(distributorOrderRef, paymentPayload);
                              await updateDoc(retailerOrderRef, paymentPayload);
                              toast.success('✅ Credit payment marked as received!');
                            }}
                            className="rounded-lg px-4 py-2 font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-500 transition"
                          >
                            Mark Credit as Paid
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          {activeSection === 'Paid Orders' && (
            <div>
              <h3 className="text-lg font-semibold text-emerald-200 mb-2">✅ Paid Orders</h3>
              {paidOrders.length === 0 ? (
                <div className="text-white/60 mb-6">No paid orders.</div>
              ) : (
                paidOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl overflow-hidden mb-4 transition hover:bg-white/10"
                  >
                    {/* --- Card header --- */}
                    <div className="flex justify-between items-center px-4 pt-4 pb-2">
                      <div>
                        <span className="font-bold text-lg text-white">
                          {order.retailerBusinessName || order.retailerName || order.retailer?.name || 'N/A'}
                        </span>
                      </div>
                      <span
                        className={
                          "px-2 py-1 rounded-full text-xs font-medium " +
                          (order.status === 'Delivered'
                            ? "bg-emerald-500/15 text-emerald-200"
                            : order.status === 'Shipped'
                            ? "bg-sky-500/15 text-sky-200"
                            : order.status === 'Accepted'
                            ? "bg-amber-500/15 text-amber-200"
                            : order.status === 'Requested'
                            ? "bg-white/10 text-white/80"
                            : "bg-white/10 text-white/80")
                        }
                      >
                        {order.status}
                      </span>
                    </div>
                    {/* --- Subheader info --- */}
                    <div className="flex flex-wrap gap-6 items-center text-sm text-white/60 px-4 pb-2">
                      <span>
                        <span className="font-medium text-white/80">City:</span>{" "}
                        {order.city || connectedRetailerMap[order.retailerId]?.city || currentRetailers[order.retailerId]?.city || "—"}
                      </span>
                      {order.deliveredAt && (
                        <span>
                          <span className="font-medium text-white/80">Delivered:</span>{" "}
                          {formatDate(order.deliveredAt)}
                        </span>
                      )}
                      <span>
                        <span className="font-medium text-white/80">Total:</span>{" "}
                        ₹{sumOrderTotal(order).toFixed(2)}
                      </span>
                    </div>
                    {/* --- Order Progress --- */}
                    <div className="px-4 pb-2">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const steps = ['Requested', 'Accepted', 'Shipped', 'Delivered', 'Paid'];
                          const baseStatuses = ['Requested', 'Accepted', 'Shipped', 'Delivered'];
                          let statusIndex = baseStatuses.indexOf(order.status);
                          if (order.isPaid || order.paymentStatus === 'Paid') {
                            statusIndex = 4;
                          }
                          return steps.map((step, index) => {
                            const isCompleted = index < statusIndex;
                            const isActive = index === statusIndex;
                            return (
                              <div key={step} className={`flex items-center gap-1 ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-600' : isCompleted ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                                <span className="text-xs">{step}</span>
                                {index !== 4 && <div className="w-6 h-px bg-gray-200"></div>}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                    {/* --- Expand/collapse button --- */}
                    <div className="flex justify-end px-4 pb-2">
                      <button
                        onClick={() => toggleOrder(order.id)}
                        className="text-sm text-blue-600 hover:underline focus:outline-none"
                      >
                        {expandedOrderIds.includes(order.id) ? 'Hide Details' : 'Show Details'}
                      </button>
                    </div>
                    {/* --- Details --- */}
                    {expandedOrderIds.includes(order.id) && (
                      <div className="p-4 space-y-2 text-sm">
                        {/* Retailer info: historical vs current */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          {/* Historical snapshot at time of order */}
                          <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold mb-1">At time of order</div>
                            <div className="font-medium text-white">
                              {order.retailerBusinessName || order.retailerName || 'N/A'}
                            </div>
                            <div className="text-sm text-white/70">
                              Owner: {order.ownerName || order.retailerOwnerName || order.retailerName || 'N/A'}
                            </div>
                            <div className="text-sm text-white/70">
                              {(() => {
                                const snapAddr = [order.retailerAddress, order.city, order.state].filter(Boolean).join(', ');
                                const current = currentRetailers[order.retailerId] || {};
                                const currAddr = [current.address, current.city, current.state].filter(Boolean).join(', ');
                                const conn = connectedRetailerMap[order.retailerId] || {};
                                const connAddr = [conn.address, conn.city, conn.state].filter(Boolean).join(', ');
                                return snapAddr || currAddr || connAddr || '—';
                              })()}
                            </div>
                          </div>
                          {/* Current live profile */}
                          <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold mb-1">Current profile</div>
                            {(() => {
                              const current = currentRetailers[order.retailerId] || {};
                              const currentTitle = current.businessName || current.retailerName || current.ownerName || '—';
                              const currentOwner = current.ownerName || '—';
                              const currentAddress = [current.address, current.city, current.state].filter(Boolean).join(', ') || '—';
                              return (
                                <>
                                  <div className="font-medium text-white">{currentTitle}</div>
                                  <div className="text-sm text-white/70">Owner: {currentOwner}</div>
                                  <div className="text-sm text-white/70">{currentAddress}</div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <p><strong>Order ID:</strong> {order.id}</p>
                        <p><strong>Retailer Email:</strong> {order.retailerEmail || order.retailer?.email || currentRetailers[order.retailerId]?.email || connectedRetailerMap[order.retailerId]?.retailerEmail || 'N/A'}</p>
                        <p><strong>Retailer Phone:</strong> {order.retailerPhone || order.retailer?.phone || currentRetailers[order.retailerId]?.phone || connectedRetailerMap[order.retailerId]?.retailerPhone || 'N/A'}</p>
                        <p><strong>Payment Method:</strong> {order.paymentMethod || 'N/A'}</p>
                        <p><strong>Delivery Mode:</strong> {order.deliveryMode || 'N/A'}</p>
                        {order.deliveredAt && (
                          <p><strong>Delivered On:</strong> {formatDateTime(order.deliveredAt)}</p>
                        )}
                        {/* Export Buttons */}
                        <div className="flex gap-2 mb-2">
                          <button
                            className="rounded-lg px-4 py-2 font-medium bg-blue-600 text-white text-xs hover:bg-blue-700 transition"
                            onClick={() => exportCSV(order)}
                          >
                            Export CSV
                          </button>
                          <button
                            className="rounded-lg px-4 py-2 font-medium bg-green-600 text-white text-xs hover:bg-green-700 transition"
                            onClick={() => exportExcel(order)}
                          >
                            Export Excel
                          </button>
                          <button
                            className="rounded-lg px-4 py-2 font-medium bg-red-500 text-white text-xs hover:bg-red-600 transition"
                            onClick={() => exportPDF(order)}
                          >
                            Export PDF
                          </button>
                        </div>
                        {/* Proforma Summary Card (if proforma exists) */}
                        {order?.proforma && (
                          <div className="mt-4">
                            <ProformaSummary
                              proforma={order.proforma}
                              distributorState={order.distributorState}
                              retailerState={order.retailerState || order.state}
                            />
                          </div>
                        )}
                        {/* Items Table */}
                        <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-3">
                          <h4 className="font-semibold mb-2">Items Ordered:</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full table-auto">
                              <thead className="bg-white/5">
                                <tr>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Product Name</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Brand</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">SKU</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-white/70">Qty</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Price</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(order.items || []).map((item, idx) => (
                                  <tr
                                    key={idx}
                                    className="hover:bg-white/5 transition"
                                  >
                                    <td className="px-2 py-2">{item.productName || 'N/A'}</td>
                                    <td className="px-2 py-2">{item.brand || '—'}</td>
                                    <td className="px-2 py-2">{item.sku || '—'}</td>
                                    <td className="px-2 py-2 text-center">{item.quantity}</td>
                                    <td className="px-2 py-2 text-right">₹{getDisplayPrice(order, idx, item).toFixed(2)}</td>
                                    <td className="px-2 py-2 text-right">₹{getDisplaySubtotal(order, idx, item).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="text-right font-semibold mt-2">
                              Total: ₹{sumOrderTotal(order).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        {/* Payment/Delivery Info Badges */}
                        <div className="flex flex-wrap gap-2 mt-4">
                          <span className={
                            "px-2 py-1 rounded-full text-xs font-medium " +
                            (order.paymentMethod === 'Credit Cycle'
                              ? "bg-amber-500/15 text-amber-200"
                              : order.paymentMethod === 'Online'
                              ? "bg-sky-500/15 text-sky-200"
                              : "bg-white/10 text-white/80")
                          }>
                            Payment: {order.paymentMethod || 'N/A'}
                          </span>
                          <span className={
                            "px-2 py-1 rounded-full text-xs font-medium " +
                            (order.deliveryMode === 'Self Pickup'
                              ? "bg-emerald-500/15 text-emerald-200"
                              : order.deliveryMode === 'Courier'
                              ? "bg-sky-500/15 text-sky-200"
                              : "bg-white/10 text-white/80")
                          }>
                            Delivery: {order.deliveryMode || 'N/A'}
                          </span>
                        </div>
                        {/* No payment action buttons in Paid Orders section */}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  // Cleanup all retailer profile listeners on unmount
  useEffect(() => {
    return () => {
      Object.values(retailerSubsRef.current).forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);
};

export default TrackOrders;
