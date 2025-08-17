import React, { useEffect, useState, useRef } from 'react';
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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

  const exportCSV = (order) => {
    console.log('Exporting CSV:', order);
  };
  const exportExcel = (order) => {
    console.log('Exporting Excel:', order);
  };
  const exportPDF = (order) => {
    console.log('Exporting PDF:', order);
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

  // For summary header
  const sumOrderTotal = (order) =>
    (order.items || []).reduce(
      (acc, item) =>
        acc + (Number(item.quantity || 0) * Number(item.price || 0)),
      0
    );
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
    <div className="p-4">
      <ToastContainer />
      <h2 className="text-2xl font-bold mb-4">Track Orders</h2>
      {/* Filter/Search Controls */}
      <div className="bg-white shadow-md rounded-lg p-4 mb-4 flex flex-col md:flex-row md:items-center gap-4">
        <input
          type="text"
          placeholder="Search by order ID, retailer, phone, email, etc."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 border rounded-lg w-full md:w-1/2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {/* Section Toggle Segmented Control */}
      <div className="inline-flex rounded-md border border-gray-200 shadow-sm overflow-hidden mb-4 group">
        <button
          onClick={() => setSectionAndHash('Out for Delivery')}
          className={
            "px-4 py-2 font-medium text-sm focus:outline-none transition " +
            (activeSection === 'Out for Delivery'
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50")
          }
        >
          Out for Delivery ({outForDeliveryOrders.length})
        </button>
        <button
          onClick={() => setSectionAndHash('Payment Due')}
          className={
            "px-4 py-2 font-medium text-sm focus:outline-none transition border-l border-gray-200 " +
            (activeSection === 'Payment Due'
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50")
          }
        >
          Payment Due ({paymentDueOrders.length})
        </button>
        <button
          onClick={() => setSectionAndHash('Paid Orders')}
          className={
            "px-4 py-2 font-medium text-sm focus:outline-none transition border-l border-gray-200 " +
            (activeSection === 'Paid Orders'
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50")
          }
        >
          Paid Orders ({paidOrders.length})
        </button>
      </div>
      {paymentDueOrders.length === 0 && paidOrders.length === 0 ? (
        <p className="text-gray-500 mt-8 text-center">No orders to track yet.</p>
      ) : (
        <>
          {activeSection === 'Out for Delivery' && (
            <div>
              <h3 className="text-lg font-semibold text-blue-700 mb-2">🚚 Out for Delivery</h3>
              {outForDeliveryOrders.length === 0 ? (
                <div className="text-gray-500 mb-6">No orders are currently out for delivery.</div>
              ) : (
                outForDeliveryOrders.map((order) => (
                  <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden mb-4 transition hover:shadow-lg">
                    {/* --- header --- */}
                    <div className="flex justify-between items-center px-4 pt-4 pb-2">
                      <div>
                        <span className="font-bold text-lg text-gray-900">
                          {order.retailerBusinessName || order.retailerName || order.retailer?.name || 'N/A'}
                        </span>
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{order.status}</span>
                    </div>
                    {/* subheader */}
                    <div className="flex flex-wrap gap-6 items-center text-sm text-gray-500 px-4 pb-2">
                      <span><span className="font-medium text-gray-700">Total:</span> ₹{sumOrderTotal(order).toFixed(2)}</span>
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-medium">Payment: {order.paymentMethod || 'N/A'}</span>
                      {order.paymentMethod === 'Credit Cycle' && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600 font-medium">Credit Days:</label>
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
                          <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-[11px] font-medium">
                            Due if delivered today: {formatDate(duePreviewFromDays(getEditedCreditDays(order)))}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* action buttons */}
                    <div className="px-4 pb-2 flex flex-col md:flex-row gap-2">
                      {order.paymentMethod === 'COD' && !order.isPaid && (
                        <button onClick={() => confirmCODPayment(order)} className="rounded-lg px-4 py-2 font-medium bg-green-700 text-white hover:bg-green-800 transition">
                          Confirm Payment Received
                        </button>
                      )}
                      <button
                        onClick={() => guardedMarkDelivered(order)}
                        className={`rounded-lg px-4 py-2 font-medium text-white transition ${order.paymentMethod === 'COD' && !order.isPaid ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
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
                          <div className="border rounded p-3 bg-gray-50">
                            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">At time of order</div>
                            <div className="font-medium text-gray-900">{order.retailerBusinessName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-gray-600">Owner: {order.ownerName || order.retailerOwnerName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-gray-600">
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
                          <div className="border rounded p-3 bg-white">
                            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Current profile</div>
                            {(() => {
                              const current = currentRetailers[order.retailerId] || {};
                              const currentTitle = current.businessName || current.retailerName || current.ownerName || '—';
                              const currentOwner = current.ownerName || '—';
                              const currentAddress = [current.address, current.city, current.state].filter(Boolean).join(', ') || '—';
                              return (
                                <>
                                  <div className="font-medium text-gray-900">{currentTitle}</div>
                                  <div className="text-sm text-gray-600">Owner: {currentOwner}</div>
                                  <div className="text-sm text-gray-600">{currentAddress}</div>
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
                        {/* Items Table (same as other tabs) */}
                        <div className="mt-4 rounded-lg bg-white border p-3">
                          <h4 className="font-semibold mb-2">Items Ordered:</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full table-auto">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Product Name</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Brand</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">SKU</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600">Qty</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Price</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(order.items || []).map((item, idx) => (
                                  <tr key={idx} className="hover:bg-blue-50 transition">
                                    <td className="px-2 py-2">{item.productName || 'N/A'}</td>
                                    <td className="px-2 py-2">{item.brand || '—'}</td>
                                    <td className="px-2 py-2">{item.sku || '—'}</td>
                                    <td className="px-2 py-2 text-center">{item.quantity}</td>
                                    <td className="px-2 py-2 text-right">₹{Number(item.price || 0).toFixed(2)}</td>
                                    <td className="px-2 py-2 text-right">₹{(Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)}</td>
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
              <h3 className="text-lg font-semibold text-yellow-700 mb-2">📅 Payment Due</h3>
              {paymentDueOrders.length === 0 ? (
                <div className="text-gray-500 mb-6">No payment due orders.</div>
              ) : (
                paymentDueOrders.map((order) => (
                  <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden mb-4 transition hover:shadow-lg">
                    <div className="flex justify-between items-center px-4 pt-4 pb-2">
                      <div>
                        <span className="font-bold text-lg text-gray-900">{order.retailerBusinessName || order.retailerName || order.retailer?.name || 'N/A'}</span>
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">{order.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-6 items-center text-sm text-gray-500 px-4 pb-2">
                      {order.deliveredAt && (
                        <span><span className="font-medium text-gray-700">Delivered:</span> {formatDate(order.deliveredAt)}</span>
                      )}
                      {(order.creditDueDate || order.__dueDate) && (
                        <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
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
                            <span><span className="font-medium text-gray-700">Delivered:</span> {formatDate(order.deliveredAt)}</span>
                          )}
                          {(order.creditDueDate || order.__dueDate) && (
                            <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
                              Credit Due Date: <span className="font-semibold">{formatDate(order.creditDueDate || order.__dueDate)}</span>
                            </span>
                          )}
                        </div>

                        {/* Retailer info: historical vs current */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          {/* Historical snapshot at time of order */}
                          <div className="border rounded p-3 bg-gray-50">
                            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">At time of order</div>
                            <div className="font-medium text-gray-900">{order.retailerBusinessName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-gray-600">Owner: {order.ownerName || order.retailerOwnerName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-gray-600">
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
                          <div className="border rounded p-3 bg-white">
                            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Current profile</div>
                            {(() => {
                              const current = currentRetailers[order.retailerId] || {};
                              const currentTitle = current.businessName || current.retailerName || current.ownerName || '—';
                              const currentOwner = current.ownerName || '—';
                              const currentAddress = [current.address, current.city, current.state].filter(Boolean).join(', ') || '—';
                              return (
                                <>
                                  <div className="font-medium text-gray-900">{currentTitle}</div>
                                  <div className="text-sm text-gray-600">Owner: {currentOwner}</div>
                                  <div className="text-sm text-gray-600">{currentAddress}</div>
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

                        {/* Items Table */}
                        <div className="mt-2 rounded-lg bg-white border p-3">
                          <h4 className="font-semibold mb-2">Items Ordered:</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full table-auto">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Product Name</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Brand</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">SKU</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600">Qty</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Price</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(order.items || []).map((item, idx) => (
                                  <tr key={idx} className="hover:bg-blue-50 transition">
                                    <td className="px-2 py-2">{item.productName || 'N/A'}</td>
                                    <td className="px-2 py-2">{item.brand || '—'}</td>
                                    <td className="px-2 py-2">{item.sku || '—'}</td>
                                    <td className="px-2 py-2 text-center">{item.quantity}</td>
                                    <td className="px-2 py-2 text-right">₹{Number(item.price || 0).toFixed(2)}</td>
                                    <td className="px-2 py-2 text-right">₹{(Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)}</td>
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
                            (order.paymentMethod === 'Credit Cycle' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700')
                          }>
                            Payment: {order.paymentMethod || 'N/A'}
                          </span>
                          <span className={
                            "px-2 py-1 rounded-full text-xs font-medium " +
                            (order.deliveryMode === 'Self Pickup' ? 'bg-green-100 text-green-800' : order.deliveryMode === 'Courier' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700')
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
                            className="rounded-lg px-4 py-2 font-medium bg-green-700 text-white hover:bg-green-800 transition"
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
              <h3 className="text-lg font-semibold text-green-700 mb-2">✅ Paid Orders</h3>
              {paidOrders.length === 0 ? (
                <div className="text-gray-500 mb-6">No paid orders.</div>
              ) : (
                paidOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-lg shadow-md overflow-hidden mb-4 transition hover:shadow-lg"
                  >
                    {/* --- Card header --- */}
                    <div className="flex justify-between items-center px-4 pt-4 pb-2">
                      <div>
                        <span className="font-bold text-lg text-gray-900">
                          {order.retailerBusinessName || order.retailerName || order.retailer?.name || 'N/A'}
                        </span>
                      </div>
                      <span
                        className={
                          "px-2 py-1 rounded-full text-xs font-medium " +
                          (order.status === 'Delivered'
                            ? "bg-green-100 text-green-800"
                            : order.status === 'Shipped'
                            ? "bg-blue-100 text-blue-800"
                            : order.status === 'Accepted'
                            ? "bg-yellow-100 text-yellow-800"
                            : order.status === 'Requested'
                            ? "bg-gray-100 text-gray-700"
                            : "bg-gray-100 text-gray-700")
                        }
                      >
                        {order.status}
                      </span>
                    </div>
                    {/* --- Subheader info --- */}
                    <div className="flex flex-wrap gap-6 items-center text-sm text-gray-500 px-4 pb-2">
                      <span>
                        <span className="font-medium text-gray-700">City:</span>{" "}
                        {order.city || connectedRetailerMap[order.retailerId]?.city || currentRetailers[order.retailerId]?.city || "—"}
                      </span>
                      {order.deliveredAt && (
                        <span>
                          <span className="font-medium text-gray-700">Delivered:</span>{" "}
                          {formatDate(order.deliveredAt)}
                        </span>
                      )}
                      <span>
                        <span className="font-medium text-gray-700">Total:</span>{" "}
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
                          <div className="border rounded p-3 bg-gray-50">
                            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">At time of order</div>
                            <div className="font-medium text-gray-900">
                              {order.retailerBusinessName || order.retailerName || 'N/A'}
                            </div>
                            <div className="text-sm text-gray-600">
                              Owner: {order.ownerName || order.retailerOwnerName || order.retailerName || 'N/A'}
                            </div>
                            <div className="text-sm text-gray-600">
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
                          <div className="border rounded p-3 bg-white">
                            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Current profile</div>
                            {(() => {
                              const current = currentRetailers[order.retailerId] || {};
                              const currentTitle = current.businessName || current.retailerName || current.ownerName || '—';
                              const currentOwner = current.ownerName || '—';
                              const currentAddress = [current.address, current.city, current.state].filter(Boolean).join(', ') || '—';
                              return (
                                <>
                                  <div className="font-medium text-gray-900">{currentTitle}</div>
                                  <div className="text-sm text-gray-600">Owner: {currentOwner}</div>
                                  <div className="text-sm text-gray-600">{currentAddress}</div>
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
                        {/* Items Table */}
                        <div className="mt-4 rounded-lg bg-white border p-3">
                          <h4 className="font-semibold mb-2">Items Ordered:</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full table-auto">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Product Name</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Brand</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">SKU</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-600">Qty</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Price</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(order.items || []).map((item, idx) => (
                                  <tr
                                    key={idx}
                                    className="hover:bg-blue-50 transition"
                                  >
                                    <td className="px-2 py-2">{item.productName || 'N/A'}</td>
                                    <td className="px-2 py-2">{item.brand || '—'}</td>
                                    <td className="px-2 py-2">{item.sku || '—'}</td>
                                    <td className="px-2 py-2 text-center">{item.quantity}</td>
                                    <td className="px-2 py-2 text-right">₹{Number(item.price || 0).toFixed(2)}</td>
                                    <td className="px-2 py-2 text-right">₹{(Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="text-right font-semibold mt-2">
                              Total: ₹{order.items?.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.price || 0)), 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        {/* Payment/Delivery Info Badges */}
                        <div className="flex flex-wrap gap-2 mt-4">
                          <span className={
                            "px-2 py-1 rounded-full text-xs font-medium " +
                            (order.paymentMethod === 'Credit Cycle'
                              ? "bg-yellow-100 text-yellow-800"
                              : order.paymentMethod === 'Online'
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-700")
                          }>
                            Payment: {order.paymentMethod || 'N/A'}
                          </span>
                          <span className={
                            "px-2 py-1 rounded-full text-xs font-medium " +
                            (order.deliveryMode === 'Self Pickup'
                              ? "bg-green-100 text-green-800"
                              : order.deliveryMode === 'Courier'
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-700")
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
