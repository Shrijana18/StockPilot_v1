import React, { useEffect, useState } from 'react';
import { getFirestore, collection, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const OrderRequests = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const db = getFirestore();
  const auth = getAuth();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Helper to enrich each order with retailer info and stock for each item
    const enrichOrderWithRetailerAndStock = async (order) => {
      const retailerRef = doc(db, 'businesses', order.retailerId);
      let retailerInfo = {};
      try {
        const snap = await getDoc(retailerRef);
        if (snap.exists()) {
          const data = snap.data();
          retailerInfo = {
            retailerName: data.businessName || data.ownerName || 'N/A',
            retailerEmail: data.email || 'N/A',
            retailerPhone: data.phone || 'N/A',
            retailerCity: data.city || 'N/A',
            retailerState: data.state || 'N/A',
            retailerAddress: data.address || 'N/A',
          };
        }
      } catch (err) {
        console.warn('Retailer fetch failed:', err);
      }

      const enrichedItems = await Promise.all(
        (order.items || []).map(async (item) => {
          if (!item.distributorProductId) return { ...item };
          try {
            const prodSnap = await getDoc(doc(db, 'businesses', auth.currentUser.uid, 'products', item.distributorProductId));
            if (prodSnap.exists()) {
              const stock = prodSnap.data().quantity;
              return { ...item, availableStock: stock };
            }
          } catch (err) {
            console.warn('Stock lookup failed:', err);
          }
          return { ...item };
        })
      );

      return {
        ...order,
        ...retailerInfo,
        items: enrichedItems
      };
    };

    const ordersRef = collection(db, 'businesses', user.uid, 'orderRequests');
    const unsubscribe = onSnapshot(ordersRef, (snapshot) => {
      const dataPromises = snapshot.docs.map(doc => enrichOrderWithRetailerAndStock({ id: doc.id, ...doc.data() }));
      Promise.all(dataPromises).then(sortedData => {
        sortedData.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
        setOrders(sortedData);
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, []);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const orderDocRef = doc(db, 'businesses', auth.currentUser.uid, 'orderRequests', orderId);

      if (newStatus === 'Rejected') {
        const reason = prompt('Enter reason for rejection:');
        if (!reason) return;
        await updateDoc(orderDocRef, { status: newStatus, rejectionNote: reason });
        return;
      }

      if (newStatus === 'Accepted') {
        const snapshot = await getDoc(orderDocRef);
        const order = snapshot.data();
        for (let item of order.items || []) {
          if (item.distributorProductId) {
            const productRef = doc(db, 'businesses', auth.currentUser.uid, 'products', item.distributorProductId);
            const prodSnap = await getDoc(productRef);
            if (prodSnap.exists()) {
              const currentQty = prodSnap.data().quantity || 0;
              const newQty = Math.max(currentQty - Number(item.quantity || 0), 0);
              await updateDoc(productRef, { quantity: newQty });
            }
          }
        }
        await updateDoc(orderDocRef, { status: newStatus });
        return;
      }

      if (newStatus === 'Modified') {
        await updateDoc(orderDocRef, { status: newStatus });
        return;
      }

    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  if (loading) {
    return <div className="p-4">Loading order requests...</div>;
  }

  if (orders.length === 0) {
    return <div className="p-4 text-gray-500">No order requests yet.</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {orders.map((order) => (
        <div
          key={order.id}
          className="relative bg-white shadow-md rounded-md p-4 border border-gray-200"
        >
          <div className="absolute top-2 right-4 text-sm font-bold">
            {order.status === 'Accepted' && <span className="text-green-600">✔ Accepted</span>}
            {order.status === 'Rejected' && <span className="text-red-600">✖ Rejected</span>}
            {order.status === 'Modified' && <span className="text-yellow-600">✎ Modified</span>}
          </div>
          <h3 className="font-semibold text-lg mb-2">Retailer: {order.retailerName || 'N/A'}</h3>
          <p><strong>Retailer Email:</strong> {order.retailerEmail || 'N/A'}</p>
          <p><strong>Phone:</strong> {order.retailerPhone || 'N/A'}</p>
          <p><strong>Address:</strong> {order.retailerAddress || 'N/A'}</p>
          <p><strong>City:</strong> {order.retailerCity || 'N/A'}, <strong>State:</strong> {order.retailerState || 'N/A'}</p>
          <p><strong>Requested On:</strong> {order.timestamp?.seconds ? new Date(order.timestamp.seconds * 1000).toLocaleString() : 'N/A'}</p>
          <p><strong>Order Note:</strong> {order.notes || '—'}</p>
          <p><strong>Status:</strong> {order.status}</p>
          <p><strong>Payment Mode:</strong> {order.paymentMode || 'N/A'}</p>
          {order.paymentMode === 'Credit Cycle' && order.timestamp?.seconds && order.creditDays && (
            <p>
              <strong>Due Date:</strong>{' '}
              {new Date(order.timestamp.seconds * 1000 + order.creditDays * 86400000).toLocaleDateString()}
            </p>
          )}
          {order.paymentMode === 'Split Payment' && order.splitPayment && (
            <p>
              <strong>Split Payment:</strong> Advance {order.splitPayment.advance}% / Balance {order.splitPayment.balance}%
            </p>
          )}
          <div className="mt-3">
            <h4 className="font-medium mb-1">Items:</h4>
            {order.items?.length > 0 ? (
              <ul className="list-disc list-inside space-y-1">
                {order.items.map((item, idx) => (
                  <li key={idx}>
                    <strong>{item.productName}</strong> — {item.brand || '—'}, {item.category || '—'} — Qty: {item.quantity}, Unit: {item.unit}
                    <span className={`ml-2 text-sm font-semibold ${
                      item.availableStock === undefined ? 'text-gray-400' :
                      item.availableStock >= item.quantity ? 'text-green-600' :
                      item.availableStock > 0 ? 'text-yellow-500' : 'text-red-600'
                    }`}>
                      {item.availableStock === undefined
                        ? '(Stock info N/A)'
                        : item.availableStock >= item.quantity
                        ? `(In Stock – ${item.availableStock} available)`
                        : item.availableStock > 0
                        ? `(Low Stock – ${item.availableStock} available)`
                        : '(Out of Stock)'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No items listed.</p>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button disabled={order.status !== 'Requested'} onClick={() => handleStatusUpdate(order.id, 'Accepted')} className="px-4 py-1 bg-green-500 text-white rounded">Accept</button>
            <button disabled={order.status !== 'Requested'} onClick={() => handleStatusUpdate(order.id, 'Rejected')} className="px-4 py-1 bg-red-500 text-white rounded">Reject</button>
            <button disabled={order.status !== 'Requested'} onClick={() => handleStatusUpdate(order.id, 'Modified')} className="px-4 py-1 bg-yellow-500 text-white rounded">Modify</button>
          </div>
          {order.rejectionNote && (
            <p className="text-sm mt-2 text-red-600"><strong>Reason:</strong> {order.rejectionNote}</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default OrderRequests;