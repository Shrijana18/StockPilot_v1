import React, { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const TrackOrders = () => {
  const [orders, setOrders] = useState([]);
  const [expandedOrderIds, setExpandedOrderIds] = useState([]);
  const [activeTab, setActiveTab] = useState('Shipped');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const db = getFirestore();
  const auth = getAuth();

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

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      const q = query(
        collection(db, 'businesses', user.uid, 'orderRequests'),
        where('status', 'in', ['Shipped', 'Delivered'])
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
      statusTimestamps: {
        deliveredAt: serverTimestamp()
      }
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

  const filteredOrders = orders.filter(order => {
    const matchesTab =
      activeTab === 'Shipped'
        ? order.status === 'Shipped' || order.status === 'Out for Delivery'
        : order.status === 'Delivered';

    const searchText = searchQuery.toLowerCase();
    const matchesSearch =
      order.id?.toLowerCase().includes(searchText) ||
      order.retailerName?.toLowerCase().includes(searchText) ||
      order.retailerEmail?.toLowerCase().includes(searchText) ||
      order.retailerPhone?.toLowerCase().includes(searchText) ||
      order.retailerAddress?.toLowerCase().includes(searchText) ||
      order.city?.toLowerCase().includes(searchText);

    const matchesDate = filterDate
      ? order.expectedDeliveryDate?.slice(0, 10) === filterDate
      : true;

    return matchesTab && matchesSearch && matchesDate;
  });

  return (
    <div className="p-4">
      <ToastContainer />
      <h2 className="text-xl font-semibold mb-4">Track Orders</h2>
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="Search by order ID, retailer, phone, email, etc."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 border rounded w-full md:w-1/2"
        />
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-2 border rounded"
        />
      </div>
      <div className="flex gap-4 mb-4">
        <button
          className={`px-4 py-1 rounded ${activeTab === 'Shipped' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('Shipped')}
        >
          Shipped
        </button>
        <button
          className={`px-4 py-1 rounded ${activeTab === 'Delivered' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('Delivered')}
        >
          Delivered
        </button>
      </div>
      {filteredOrders.length === 0 ? (
        <p>No orders to track yet.</p>
      ) : (
        filteredOrders.map((order) => (
          <div key={order.id} className="border rounded mb-6 shadow">
            {/* Summary Header */}
            <div className="bg-gray-50 px-4 py-2 flex flex-col md:flex-row justify-between items-start md:items-center border-b">
              <div>
                <p className="font-semibold text-gray-800">{order.retailerName || order.retailer?.name || 'N/A'}</p>
                <p className="text-sm text-gray-600">{order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}</p>
              </div>
              <div className="flex flex-wrap gap-4 mt-2 md:mt-0 text-sm">
                <span><strong>Items:</strong> {order.items?.length || 0}</span>
                <span><strong>Status:</strong> {order.status}</span>
                <span><strong>ETA:</strong> {order.expectedDeliveryDate || 'Not specified'}</span>
              </div>
              <div className="mt-2 md:mt-0 text-sm">
                <div className="flex gap-1">
                  {['Requested', 'Accepted', 'Modified', 'Shipped', 'Delivered'].map((step, idx, arr) => {
                    const currentIndex = arr.indexOf(order.status);
                    return (
                      <React.Fragment key={idx}>
                        <span className={
                          currentIndex === idx
                            ? 'text-blue-600 font-semibold'
                            : currentIndex > idx
                            ? 'text-green-600 font-semibold'
                            : 'text-gray-400'
                        }>
                          {step}
                        </span>
                        {idx !== arr.length - 1 && <span>→</span>}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => toggleOrder(order.id)}
                className="text-sm text-blue-600 underline ml-4"
              >
                {expandedOrderIds.includes(order.id) ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {/* Detail Block */}
            {expandedOrderIds.includes(order.id) && (
              <div className="p-4 space-y-2 text-sm">
                <p><strong>Order ID:</strong> {order.id}</p>
                <p><strong>Retailer Email:</strong> {order.retailerEmail || order.retailer?.email || 'N/A'}</p>
                <p><strong>Retailer Phone:</strong> {order.retailerPhone || order.retailer?.phone || 'N/A'}</p>
                <p><strong>Payment Method:</strong> {order.paymentMethod || 'N/A'}</p>
                <p><strong>Delivery Mode:</strong> {order.deliveryMode || 'N/A'}</p>
                {order.deliveredAt && (
                  <p><strong>Delivered On:</strong> {new Date(order.deliveredAt).toLocaleString()}</p>
                )}
                
                {/* Export Buttons */}
                <div className="flex gap-2 mb-2">
                  <button
                    className="px-3 py-1 bg-blue-500 text-white rounded text-xs"
                    onClick={() => exportCSV(order)}
                  >
                    Export CSV
                  </button>
                  <button
                    className="px-3 py-1 bg-green-600 text-white rounded text-xs"
                    onClick={() => exportExcel(order)}
                  >
                    Export Excel
                  </button>
                  <button
                    className="px-3 py-1 bg-red-500 text-white rounded text-xs"
                    onClick={() => exportPDF(order)}
                  >
                    Export PDF
                  </button>
                </div>

                {/* Items Table */}
                <div className="mt-4 border rounded-lg p-3 bg-white">
                  <h4 className="font-semibold mb-2">Items Ordered:</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-auto border">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border px-2 py-1 text-left">Product Name</th>
                          <th className="border px-2 py-1 text-left">Brand</th>
                          <th className="border px-2 py-1 text-left">SKU</th>
                          <th className="border px-2 py-1 text-center">Qty</th>
                          <th className="border px-2 py-1 text-right">Price</th>
                          <th className="border px-2 py-1 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(order.items || []).map((item, idx) => (
                          <tr key={idx}>
                            <td className="border px-2 py-1">{item.productName || 'N/A'}</td>
                            <td className="border px-2 py-1">{item.brand || '—'}</td>
                            <td className="border px-2 py-1">{item.sku || '—'}</td>
                            <td className="border px-2 py-1 text-center">{item.quantity}</td>
                            <td className="border px-2 py-1 text-right">₹{Number(item.price || 0).toFixed(2)}</td>
                            <td className="border px-2 py-1 text-right">₹{(Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="text-right font-semibold mt-2">
                      Total: ₹{order.items?.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.price || 0)), 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {(order.status === 'Shipped' || order.status === 'Out for Delivery') && (
                  <div className="mt-4 flex flex-col md:flex-row gap-2">
                    {/* If COD and not paid, show only Confirm Payment Received (COD) button */}
                    {order.paymentMethod === 'COD' && !order.isPaid ? (
                      <button
                        onClick={async () => {
                          const user = auth.currentUser;
                          if (!user) return;

                          const distributorOrderRef = doc(db, 'businesses', user.uid, 'orderRequests', order.id);
                          const retailerOrderRef = doc(db, 'businesses', order.retailerId, 'sentOrders', order.id);

                          const paymentPayload = {
                            isPaid: true,
                            paymentStatus: 'Paid',
                            paidAt: new Date().toISOString()
                          };

                          await updateDoc(distributorOrderRef, paymentPayload);
                          await updateDoc(retailerOrderRef, paymentPayload);
                          toast.success("💰 Payment received for COD order!", {
                            position: "top-right",
                            autoClose: 3000,
                            icon: "✅"
                          });
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                      >
                        Confirm Payment Received (COD)
                      </button>
                    ) : null}

                    {/* Credit Cycle confirmation for Credit Cycle payment method and not yet paid */}
                    {order.paymentMethod === 'Credit Cycle' && order.isPaid !== true && (
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">Confirm Credit Cycle (in days):</label>
                        <input
                          type="number"
                          min={1}
                          defaultValue={order.creditDays || 15}
                          onChange={(e) => order.confirmedCreditDays = e.target.value}
                          className="border rounded px-2 py-1 w-32"
                        />
                        <button
                          onClick={async () => {
                            const user = auth.currentUser;
                            if (!user || !order.confirmedCreditDays) return;

                            const distributorOrderRef = doc(db, 'businesses', user.uid, 'orderRequests', order.id);
                            const retailerOrderRef = doc(db, 'businesses', order.retailerId, 'sentOrders', order.id);

                            const days = Number(order.confirmedCreditDays);
                            const now = new Date();
                            const creditDueDate = new Date(now.setDate(now.getDate() + days)).toISOString();

                            const payload = {
                              creditDays: days,
                              creditDueDate,
                              isPaid: false
                            };

                            await updateDoc(distributorOrderRef, payload);
                            await updateDoc(retailerOrderRef, payload);
                            toast.success("✅ Credit cycle confirmed!", {
                              position: "top-right",
                              autoClose: 3000,
                              icon: "📅"
                            });
                          }}
                          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                          Confirm Credit Days
                        </button>
                        {/* Show the credit due date if present */}
                        {order.creditDueDate && (
                          <p className="text-sm text-gray-700">
                            Credit Due Date: <strong>{new Date(order.creditDueDate).toLocaleDateString()}</strong>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Show Mark as Paid button for unpaid Credit Cycle orders with a creditDueDate */}
                    {(order.status === 'Shipped' || order.status === 'Delivered') &&
                      order.paymentMethod === 'Credit Cycle' &&
                      order.isPaid !== true &&
                      order.creditDueDate && (
                      <button
                        onClick={async () => {
                          const user = auth.currentUser;
                          if (!user) return;

                          const distributorOrderRef = doc(db, 'businesses', user.uid, 'orderRequests', order.id);
                          const retailerOrderRef = doc(db, 'businesses', order.retailerId, 'sentOrders', order.id);

                          const paymentPayload = {
                            isPaid: true,
                            paymentStatus: 'Paid',
                            paidAt: new Date().toISOString()
                          };

                          await updateDoc(distributorOrderRef, paymentPayload);
                          await updateDoc(retailerOrderRef, paymentPayload);

                          toast.success("💰 Credit payment marked as received!", {
                            position: "top-right",
                            autoClose: 3000,
                            icon: "✅"
                          });
                        }}
                        className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 mt-2"
                      >
                        Mark Credit as Paid
                      </button>
                    )}

                    {/* Otherwise, show Mark as Delivered only if paid or (Credit Cycle with creditDueDate) */}
                    {(order.paymentMethod !== 'Credit Cycle' ||
                      (order.paymentMethod === 'Credit Cycle' && order.creditDueDate)) && (
                        (order.isPaid === true || (order.paymentMethod === 'Credit Cycle' && order.creditDueDate)) && (
                          <button
                            onClick={() => markAsDelivered(order.id)}
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                          >
                            Mark as Delivered
                          </button>
                        )
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default TrackOrders;
