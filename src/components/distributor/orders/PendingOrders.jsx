import React, { useEffect, useState } from 'react';
import { getFirestore, collection, onSnapshot, doc, getDoc, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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

        // For each item, if productId exists, fetch its inventory stockAvailable, price, sku, unit
        const itemsWithStock = await Promise.all((data.items || []).map(async (item) => {
          if (item.productId) {
            try {
              const productRef = doc(db, 'products', item.productId);
              const productSnap = await getDoc(productRef);
              if (productSnap.exists()) {
                const productData = productSnap.data();
                return {
                  ...item,
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
          return item;
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

  return (
    <div className="p-4 space-y-4">
      {pendingOrders.map((order) => (
        <div key={order.id} className="bg-white p-4 rounded shadow border">
          <div className="flex justify-between">
            <h3 className="font-semibold text-lg">Retailer: {order.retailerName}</h3>
            <p className="text-sm text-gray-500">Order ID: {order.id}</p>
            <span className={`text-sm font-bold ${order.status === 'Accepted' ? 'text-green-600' : 'text-yellow-600'}`}>
              {order.status}
            </span>
          </div>
          <p>Email: {order.retailerEmail}</p>
          {order.status === 'Modified' ? (
            <label className="block">
              Payment Mode:
              <select
                value={order.paymentMode || ''}
                onChange={(e) => handlePaymentModeChange(order.id, e.target.value)}
                className="border rounded px-2 py-1 ml-2"
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
            <p><strong>Payment Mode:</strong> {order.paymentMode || 'N/A'}</p>
          )}
          <p>Requested On: {new Date(order.timestamp?.seconds * 1000).toLocaleString()}</p>
          <div className="mt-2 border border-gray-400 rounded-md overflow-hidden">
            <div className="grid grid-cols-8 font-semibold bg-gray-100 border-b border-gray-400 px-3 py-2">
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
                <div key={i} className="grid grid-cols-8 border-t border-gray-200 px-3 py-2 text-sm items-center">
                  {order.status === 'Modified' ? (
                    <>
                      <input
                        className="border px-1"
                        type="text"
                        value={item.productName}
                        onChange={(e) => handleItemEdit(order.id, i, 'productName', e.target.value)}
                      />
                      <input
                        className="border px-1"
                        type="text"
                        value={item.brand || ''}
                        onChange={(e) => handleItemEdit(order.id, i, 'brand', e.target.value)}
                      />
                      <input
                        className="border px-1"
                        type="text"
                        value={item.category || ''}
                        onChange={(e) => handleItemEdit(order.id, i, 'category', e.target.value)}
                      />
                      <div className="flex flex-col">
                        <input
                          className={`border px-1 ${isOverstock ? 'border-red-600' : ''}`}
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemEdit(order.id, i, 'quantity', parseInt(e.target.value))}
                        />
                        {isOverstock && (
                          <span className="text-xs text-red-600">{message}</span>
                        )}
                      </div>
                      <input
                        className="border px-1"
                        type="text"
                        value={item.unit || ''}
                        onChange={(e) => handleItemEdit(order.id, i, 'unit', e.target.value)}
                      />
                      <button
                        onClick={() => handleDeleteItem(order.id, i)}
                        className="text-red-600 font-bold hover:text-red-800"
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
                          <span className="text-red-600 text-xs ml-1">Out of Stock</span>
                        )}
                      </div>
                      <div>{item.unit || 'N/A'}</div>
                      <div></div>
                      <div>₹{item.price?.toFixed(2) || '0.00'}</div>
                      <div>₹{(item.quantity * item.price)?.toFixed(2) || '0.00'}</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 space-y-2">
            <label className="block">
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
                className="border rounded px-2 py-1 ml-2"
              />
            </label>
            {order.deliveryDateError && (
              <p className="text-red-600 text-sm mt-1">Please select a valid delivery date.</p>
            )}

            <label className="block">
              Delivery Mode:
              <select
                value={order.deliveryMode || ''}
                onChange={(e) => {
                  handleDeliveryModeChange(order.id, e.target.value);
                  setPendingOrders(prev =>
                    prev.map(o => o.id === order.id ? { ...o, deliveryMode: e.target.value } : o)
                  );
                }}
                className="border rounded px-2 py-1 ml-2"
              >
                <option value="">Select</option>
                <option value="By Distributor">By Distributor</option>
                <option value="Shiprocket">Shiprocket</option>
                <option value="Delhivery">Delhivery</option>
                <option value="Other">Other</option>
              </select>
            </label>
            {order.deliveryModeError && (
              <p className="text-red-600 text-sm mt-1">Please select a delivery mode.</p>
            )}

            {order.status === 'Modified' && (
              <button
                onClick={() => saveModifiedOrder(order.id)}
                className="mt-2 bg-yellow-500 text-white px-4 py-1 rounded hover:bg-yellow-600"
              >
                Save Changes
              </button>
            )}

            <button
              onClick={() => markAsShipped(order.id)}
              className="mt-2 bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
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