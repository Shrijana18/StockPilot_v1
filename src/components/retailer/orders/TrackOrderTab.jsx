import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { toast } from 'react-toastify';
import AddDeliveredItemsToInventory from "../../inventory/AddDeliveredItemsToInventory";

const TrackOrderTab = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const auth = getAuth();
  const db = getFirestore();

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

  const filteredOrders =
    filter === "All" ? orders : orders.filter((order) => order.status === filter);

  const progressSteps = ['Requested', 'Accepted', 'Modified', 'Shipped', 'Delivered'];

  return (
    <div className="p-4">
      <div className="mb-4">
        <label className="mr-2 font-semibold">Filter by Status:</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          <option>All</option>
          <option>Accepted</option>
          <option>Rejected</option>
          <option>Pending</option>
          <option>Modified</option>
          <option>Delivered</option>
        </select>
      </div>

      {loading ? (
        <p>Loading orders...</p>
      ) : filteredOrders.length === 0 ? (
        <p>No orders found for this filter.</p>
      ) : (
        <table className="w-full table-auto border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-3 py-2">Distributor</th>
              <th className="border px-3 py-2">Order Date</th>
              <th className="border px-3 py-2">Items</th>
              <th className="border px-3 py-2">Status</th>
              <th className="border px-3 py-2">Delivery ETA</th>
              <th className="border px-3 py-2">Progress</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <React.Fragment key={order.id}>
                <tr
                  onClick={() =>
                    setExpandedOrderId((prevId) => (prevId === order.id ? null : order.id))
                  }
                  className="cursor-pointer hover:bg-gray-100"
                >
                  <td className="border px-3 py-2">{order.distributorName || "N/A"}</td>
                  <td className="border px-3 py-2">
                    {order.timestamp?.toDate().toLocaleString() || "N/A"}
                  </td>
                  <td className="border px-3 py-2">{order.items?.length || 0}</td>
                  <td className="border px-3 py-2 font-medium">
                    {order.status}
                    {order.status === "Rejected" && order.rejectionNote && (
                      <div className="text-xs text-red-500 mt-1">Reason: {order.rejectionNote}</div>
                    )}
                  </td>
                  <td className="border px-3 py-2">{order.eta || "Not specified"}</td>
                  <td className="border px-3 py-2">
                    {order.status === "Rejected" ? (
                      <div className="flex gap-1 text-xs">
                        <span className="text-green-600 font-semibold">Requested</span>
                        <span>→</span>
                        <span className="text-red-600 font-semibold">Rejected</span>
                      </div>
                    ) : (
                      <div className="flex gap-1 text-xs">
                        {progressSteps.map((step, idx) => {
                          const currentIndex = progressSteps.indexOf(order.status);
                          return (
                            <React.Fragment key={idx}>
                              <span
                                className={
                                  currentIndex === idx
                                    ? 'text-blue-600 font-semibold'
                                    : currentIndex > idx
                                    ? 'text-green-600 font-semibold'
                                    : 'text-gray-400'
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
                    <td colSpan="6" className="p-4 bg-gray-50">
                      <div className="text-sm">
                        <p><strong>Order ID:</strong> {order.id}</p>
                        <p><strong>Distributor Name:</strong> {order.distributorName || "N/A"}</p>
                        <p><strong>Distributor Email:</strong> {order.distributorEmail || "N/A"}</p>
                        <p><strong>Distributor Phone:</strong> {order.distributorPhone || "N/A"}</p>
                        <p><strong>Distributor Address:</strong> {order.distributorAddress || "N/A"}</p>
                        <p><strong>Payment Mode:</strong> {order.paymentMode || "N/A"}</p>
                        <p><strong>Note:</strong> {order.note || "—"}</p>

                        <p><strong>Status:</strong> {order.status}</p>
                        {order.statusTimestamps && (
                          <div className="mt-2 space-y-1 text-sm text-gray-700">
                            {order.statusTimestamps.requestedAt && (
                              <p><strong>Requested At:</strong> {new Date(order.statusTimestamps.requestedAt.seconds * 1000).toLocaleString()}</p>
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

                        <div className="mt-3">
                          <strong>Products:</strong>
                          <table className="w-full mt-2 text-sm border border-gray-300">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="border px-3 py-1 text-left">Product Name</th>
                                <th className="border px-3 py-1 text-left">Brand</th>
                                <th className="border px-3 py-1 text-left">Category</th>
                                <th className="border px-3 py-1 text-left">Quantity</th>
                                <th className="border px-3 py-1 text-left">Unit</th>
                                <th className="border px-3 py-1 text-left">Price</th>
                                <th className="border px-3 py-1 text-left">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(order.items || []).map((item, idx) => (
                                <tr key={idx}>
                                  <td className="border px-3 py-1">{item.name || item.productName || "—"}</td>
                                  <td className="border px-3 py-1">{item.brand || "—"}</td>
                                  <td className="border px-3 py-1">{item.category || "—"}</td>
                                  <td className="border px-3 py-1">{item.quantity}</td>
                                  <td className="border px-3 py-1">{item.unit}</td>
                                  <td className="border px-3 py-1">₹{item.price !== undefined ? parseFloat(item.price).toFixed(2) : item.sellingPrice !== undefined ? parseFloat(item.sellingPrice).toFixed(2) : "0.00"}</td>
                                  <td className="border px-3 py-1">
                                    ₹{((item.price !== undefined ? parseFloat(item.price) : item.sellingPrice !== undefined ? parseFloat(item.sellingPrice) : 0) * (item.quantity || 0)).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-3 font-semibold">
                          Total Price: ₹
                          {(order.items || []).reduce((total, item) => {
                            const price = item.price !== undefined ? parseFloat(item.price) : item.sellingPrice !== undefined ? parseFloat(item.sellingPrice) : 0;
                            const qty = item.quantity || 0;
                            return total + price * qty;
                          }, 0).toFixed(2)}
                        </div>

                        {order.status === "Delivered" && (
                          order.inventorySynced ? (
                            <button className="mt-3 px-4 py-2 bg-gray-400 text-white rounded" disabled>
                              ✅ Added to Inventory
                            </button>
                          ) : (
                            <button
                              className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
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
      )}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-md w-11/12 max-w-3xl p-4 overflow-y-auto max-h-[90vh]">
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