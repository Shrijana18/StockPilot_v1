import React, { useEffect, useState } from 'react';
import { getFirestore, collection, onSnapshot, doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';

const OrderRequests = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState('none');
  const [expandedOrderIds, setExpandedOrderIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const toggleOrder = (id) => {
    setExpandedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

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
      const snapshot = await getDoc(doc(db, 'businesses', auth.currentUser.uid, 'orderRequests', orderId));
      const order = snapshot.data();
      const orderDocRef = doc(db, 'businesses', order.distributorId || auth.currentUser.uid, 'orderRequests', orderId);
      const retailerOrderRef = doc(db, 'businesses', order.retailerId, 'sentOrders', orderId);
      const retailerOrderSnap = await getDoc(retailerOrderRef);

      if (newStatus === 'Accepted') {
        const enrichedItems = [];

        for (let item of order.items || []) {
          let updatedItem = { ...item };

          if (item.distributorProductId) {
            const productRef = doc(db, 'businesses', auth.currentUser.uid, 'products', item.distributorProductId);
            const prodSnap = await getDoc(productRef);
            if (prodSnap.exists()) {
              const data = prodSnap.data();
              const currentQty = data.quantity || 0;
              const newQty = Math.max(currentQty - Number(item.quantity || 0), 0);

              await updateDoc(productRef, { quantity: newQty });

              updatedItem = {
                ...updatedItem,
                price: data.sellingPrice || data.price || 0,
                subtotal: (data.sellingPrice || data.price || 0) * Number(item.quantity || 0),
                sku: data.sku || '',
                category: data.category || '',
                brand: data.brand || '',
              };
            }
          }

          enrichedItems.push(updatedItem);
        }

        const baseData = {
          status: newStatus,
          items: enrichedItems,
          distributorId: auth.currentUser.uid,
          retailerId: order.retailerId, // ✅ Added this line for Firestore rule match
          timestamp: order.timestamp,
          notes: order.notes || '',
          paymentMode: order.paymentMode || 'N/A',
          creditDays: order.creditDays || null,
          splitPayment: order.splitPayment || null,
        };

        // Update orderDocRef with status, items, and acceptedAt timestamp
        await updateDoc(orderDocRef, {
          status: newStatus,
          items: enrichedItems,
          statusTimestamps: {
            acceptedAt: serverTimestamp(),
          },
        });

        if (!retailerOrderSnap.exists()) {
          await setDoc(retailerOrderRef, {
            ...baseData,
            statusTimestamps: {
              requestedAt: order.timestamp,
            },
          });
        } else {
          await updateDoc(retailerOrderRef, {
            ...baseData,
            status: newStatus,
            statusTimestamps: {
              acceptedAt: serverTimestamp(),
            },
          });
        }

        return;
      }

      const baseData = {
        status: newStatus,
        items: order.items,
        distributorId: auth.currentUser.uid,
        retailerId: order.retailerId, // ✅ Added this line for Firestore rule match
        timestamp: order.timestamp,
        notes: order.notes || '',
        paymentMode: order.paymentMode || 'N/A',
        creditDays: order.creditDays || null,
        splitPayment: order.splitPayment || null,
      };

      if (newStatus === 'Rejected') {
        const reason = prompt('Enter reason for rejection:');
        if (!reason) return;

        // Update orderDocRef with status, rejectionNote, and rejectedAt timestamp
        await updateDoc(orderDocRef, {
          status: newStatus,
          rejectionNote: reason,
          statusTimestamps: {
            rejectedAt: serverTimestamp(),
          },
        });

        if (!retailerOrderSnap.exists()) {
          await setDoc(retailerOrderRef, {
            ...baseData,
            rejectionNote: reason,
            statusTimestamps: {
              requestedAt: order.timestamp,
            },
          });
        } else {
          await updateDoc(retailerOrderRef, {
            status: newStatus,
            rejectionNote: reason,
            statusTimestamps: {
              rejectedAt: serverTimestamp(),
            },
          });
        }

        return;
      }

      if (newStatus === 'Modified') {
        // Update orderDocRef with status and modifiedAt timestamp
        await updateDoc(orderDocRef, {
          status: newStatus,
          statusTimestamps: {
            modifiedAt: serverTimestamp(),
          },
        });

        if (!retailerOrderSnap.exists()) {
          await setDoc(retailerOrderRef, {
            ...baseData,
            statusTimestamps: {
              requestedAt: order.timestamp,
            },
          });
        } else {
          await updateDoc(retailerOrderRef, {
            status: newStatus,
            statusTimestamps: {
              modifiedAt: serverTimestamp(),
            },
          });
        }

        return;
      }

    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleExportCSV = (order) => {
    const csv = [
      ['Retailer', 'Email', 'Date', 'Payment', 'Status'],
      [
        order.retailerName,
        order.retailerEmail,
        order.timestamp?.seconds ? new Date(order.timestamp.seconds * 1000).toLocaleDateString() : '',
        order.paymentMode,
        order.status,
      ],
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `order_${order.id}.csv`;
    a.click();
  };

  const handleExportExcel = (order) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      {
        Retailer: order.retailerName,
        Email: order.retailerEmail,
        Date: order.timestamp?.seconds ? new Date(order.timestamp.seconds * 1000).toLocaleDateString() : '',
        Payment: order.paymentMode,
        Status: order.status,
      }
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Order');
    XLSX.writeFile(wb, `order_${order.id}.xlsx`);
  };

  const handleExportPDF = (order) => {
    const content = document.getElementById(`order-card-${order.id}`);
    html2pdf().from(content).save(`order_${order.id}.pdf`);
  };

  if (loading) {
    return <div className="p-4">Loading order requests...</div>;
  }

  if (orders.length === 0) {
    return <div className="p-4 text-gray-500">No order requests yet.</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="space-x-2">
          <label className="text-sm font-medium">Group by:</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="none">None</option>
            <option value="retailer">Retailer</option>
            <option value="date">Date</option>
          </select>
        </div>

        <div className="space-x-2">
          <button onClick={handleExportCSV} className="px-3 py-1 border text-sm rounded bg-white hover:bg-gray-100">Export CSV</button>
          <button onClick={handleExportExcel} className="px-3 py-1 border text-sm rounded bg-white hover:bg-gray-100">Export Excel</button>
          <button onClick={handleExportPDF} className="px-3 py-1 border text-sm rounded bg-white hover:bg-gray-100">Export PDF</button>
        </div>
      </div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by Order ID, Retailer Name, Email, Phone, City, or Address"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
          className="w-full px-3 py-2 border rounded shadow-sm text-sm"
        />
      </div>
      <div id="order-requests-content">
        {orders.filter(order => {
          const term = searchTerm.toLowerCase();
          return (
            order.id?.toLowerCase().includes(term) ||
            order.retailerName?.toLowerCase().includes(term) ||
            order.retailerEmail?.toLowerCase().includes(term) ||
            order.retailerPhone?.toLowerCase().includes(term) ||
            order.retailerCity?.toLowerCase().includes(term) ||
            order.retailerAddress?.toLowerCase().includes(term)
          );
        }).map((order) => (
          <div key={order.id} className="border border-gray-300 rounded-md shadow-sm">
            <div className="flex items-center justify-between bg-gray-50 px-4 py-2 cursor-pointer" onClick={() => toggleOrder(order.id)}>
              <div>
                <p className="font-semibold text-gray-800">Retailer: {order.retailerName || 'N/A'}</p>
                <p className="text-sm text-gray-600">
                  {order.retailerCity || 'N/A'}, {order.retailerState || 'N/A'} — {order.retailerAddress || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  Requested on: {order.timestamp?.seconds ? new Date(order.timestamp.seconds * 1000).toLocaleString() : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  Items: {order.items?.length || 0} | Total: ₹
                  {order.items?.reduce((acc, item) => acc + (item.quantity * (item.price || 0)), 0).toFixed(2) || '0.00'}
                </p>
                <p className="text-sm">
                  Status: <span className="font-semibold text-blue-600">{order.status}</span>
                </p>
              </div>
              <button className="text-blue-600 underline text-sm">
                {expandedOrderIds.includes(order.id) ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {expandedOrderIds.includes(order.id) && (
              <div id={`order-card-${order.id}`} className="bg-white p-4">
                <div className="relative bg-white shadow-md rounded-md p-4 border border-gray-200">
                  <div className="absolute top-2 right-4 text-sm font-bold">
                    {order.status === 'Accepted' && <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md font-bold">✔ Accepted</span>}
                    {order.status === 'Rejected' && <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md font-bold">✖ Rejected</span>}
                    {order.status === 'Modified' && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md font-bold">✎ Modified</span>}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Retailer: {order.retailerName || 'N/A'}</h3>
                  <p><strong>Order ID:</strong> {order.id}</p>
                  <p><strong>Retailer Email:</strong> {order.retailerEmail || 'N/A'}</p>
                  <p><strong>Phone:</strong> {order.retailerPhone || 'N/A'}</p>
                  <p><strong>Address:</strong> {order.retailerAddress || 'N/A'}</p>
                  <p><strong>City:</strong> {order.retailerCity || 'N/A'}, <strong>State:</strong> {order.retailerState || 'N/A'}</p>
                  <p><strong>Requested On:</strong> {order.timestamp?.seconds ? new Date(order.timestamp.seconds * 1000).toLocaleString() : 'N/A'}</p>
                  <p><strong>Order Note:</strong> {order.notes || '—'}</p>
                  <p><strong>Status:</strong> <span className="ml-2 px-2 py-1 bg-gray-100 text-black font-bold rounded">{order.status}</span></p>
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
                    <div className="mt-2 border border-gray-400 rounded-md overflow-hidden">
                      <div className="grid grid-cols-6 font-semibold bg-gray-100 border-b border-gray-400 px-3 py-2">
                        <div>Name</div>
                        <div>Brand</div>
                        <div>Category</div>
                        <div>Qty</div>
                        <div>Unit</div>
                        <div>Stock</div>
                      </div>
                      {order.items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-6 border-t border-gray-200 px-3 py-2 text-sm">
                          <div>{item.productName}</div>
                          <div>{item.brand || '—'}</div>
                          <div>{item.category || '—'}</div>
                          <div>{item.quantity}</div>
                          <div>{item.unit}</div>
                          <div className={`font-medium ${
                            item.availableStock === undefined ? 'text-gray-400' :
                            item.availableStock >= item.quantity ? 'text-green-600' :
                            item.availableStock > 0 ? 'text-yellow-500' : 'text-red-600'
                          }`}>
                            {item.availableStock === undefined
                              ? 'N/A'
                              : item.availableStock >= item.quantity
                              ? `${item.availableStock} In Stock`
                              : item.availableStock > 0
                              ? `${item.availableStock} Low`
                              : 'Out of Stock'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleExportCSV(order)}
                      className="px-3 py-1 border text-xs rounded bg-white hover:bg-gray-100"
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => handleExportExcel(order)}
                      className="px-3 py-1 border text-xs rounded bg-white hover:bg-gray-100"
                    >
                      Excel
                    </button>
                    <button
                      onClick={() => handleExportPDF(order)}
                      className="px-3 py-1 border text-xs rounded bg-white hover:bg-gray-100"
                    >
                      PDF
                    </button>
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
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderRequests;