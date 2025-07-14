import React, { useEffect, useState } from 'react';
import { getFirestore, collection, onSnapshot, doc, getDoc, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const PendingOrders = () => {
  const [pendingOrders, setPendingOrders] = useState([]);
  const db = getFirestore();
  const auth = getAuth();

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
        return {
          id: docSnap.id,
          ...data,
          retailerName: retailerData.businessName || retailerData.ownerName || 'N/A',
          retailerEmail: retailerData.email || 'N/A',
        };
      }));
      setPendingOrders(enriched);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="p-4 space-y-4">
      {pendingOrders.map((order) => (
        <div key={order.id} className="bg-white p-4 rounded shadow border">
          <div className="flex justify-between">
            <h3 className="font-semibold text-lg">Retailer: {order.retailerName}</h3>
            <span className={`text-sm font-bold ${order.status === 'Accepted' ? 'text-green-600' : 'text-yellow-600'}`}>
              {order.status}
            </span>
          </div>
          <p>Email: {order.retailerEmail}</p>
          <p>Payment Mode: {order.paymentMode}</p>
          <p>Requested On: {new Date(order.timestamp?.seconds * 1000).toLocaleString()}</p>
          <ul className="list-disc ml-6 mt-2">
            {order.items.map((item, i) => (
              <li key={i}>{item.productName} – Qty: {item.quantity}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default PendingOrders;