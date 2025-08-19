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
    <div className="p-4 text-white">
      <div className="mb-4">
        <label className="mr-2 font-semibold text-white/80">Filter by Status:</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-2 py-1 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
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
        <p className="text-white/80">Loading orders...</p>
      ) : filteredOrders.length === 0 ? (
        <p className="text-white/70">No orders found for this filter.</p>
      ) : (
        <table className="w-full table-auto rounded-xl overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10">
          <thead>
            <tr className="bg-white/10 text-white/80">
              <th className="px-3 py-2 border border-white/10">Distributor</th>
              <th className="px-3 py-2 border border-white/10">Order Date</th>
              <th className="px-3 py-2 border border-white/10">Items</th>
              <th className="px-3 py-2 border border-white/10">Status</th>
              <th className="px-3 py-2 border border-white/10">Delivery ETA</th>
              <th className="px-3 py-2 border border-white/10">Progress</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <React.Fragment key={order.id}>
                <tr
                  onClick={() =>
                    setExpandedOrderId((prevId) => (prevId === order.id ? null : order.id))
                  }
                  className="cursor-pointer hover:bg-white/10"
                >
                  <td className="px-3 py-2 border border-white/10">{order.distributorName || "N/A"}</td>
                  <td className="px-3 py-2 border border-white/10">
                    {order.timestamp?.toDate().toLocaleString() || "N/A"}
                  </td>
                  <td className="px-3 py-2 border border-white/10">{order.items?.length || 0}</td>
                  <td className="px-3 py-2 border border-white/10 font-medium">
                    {order.status}
                    {order.status === "Rejected" && order.rejectionNote && (
                      <div className="text-xs text-rose-300 mt-1">Reason: {order.rejectionNote}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 border border-white/10">{order.eta || "Not specified"}</td>
                  <td className="px-3 py-2 border border-white/10">
                    {order.status === "Rejected" ? (
                      <div className="flex gap-1 text-xs">
                        <span className="text-emerald-400 font-semibold">Requested</span>
                        <span>→</span>
                        <span className="text-rose-400 font-semibold">Rejected</span>
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
                                    ? 'text-emerald-300 font-semibold'
                                    : currentIndex > idx
                                    ? 'text-emerald-400 font-semibold'
                                    : 'text-white/40'
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
                    <td colSpan="6" className="p-4 bg-white/5">
                      <div className="text-sm text-white/80">
                        <p><strong>Order ID:</strong> {order.id}</p>
                        <p><strong>Distributor Name:</strong> {order.distributorName || "N/A"}</p>
                        <p><strong>Distributor Email:</strong> {order.distributorEmail || "N/A"}</p>
                        <p><strong>Distributor Phone:</strong> {order.distributorPhone || "N/A"}</p>
                        <p><strong>Distributor Address:</strong> {order.distributorAddress || "N/A"}</p>
                        <p><strong>Payment Mode:</strong> {order.paymentMode || "N/A"}</p>
                        <p><strong>Note:</strong> {order.note || "—"}</p>

                        <p><strong>Status:</strong> {order.status}</p>
                        {order.statusTimestamps && (
                          <div className="mt-2 space-y-1 text-sm text-white/80">
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
                          <table className="w-full mt-2 text-sm rounded-lg overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl">
                            <thead className="bg-white/10">
                              <tr>
                                <th className="px-3 py-1 text-left border border-white/10">Product Name</th>
                                <th className="px-3 py-1 text-left border border-white/10">Brand</th>
                                <th className="px-3 py-1 text-left border border-white/10">Category</th>
                                <th className="px-3 py-1 text-left border border-white/10">Quantity</th>
                                <th className="px-3 py-1 text-left border border-white/10">Unit</th>
                                <th className="px-3 py-1 text-left border border-white/10">Price</th>
                                <th className="px-3 py-1 text-left border border-white/10">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(order.items || []).map((item, idx) => (
                                <tr key={idx}>
                                  <td className="px-3 py-1 border border-white/10">{item.name || item.productName || "—"}</td>
                                  <td className="px-3 py-1 border border-white/10">{item.brand || "—"}</td>
                                  <td className="px-3 py-1 border border-white/10">{item.category || "—"}</td>
                                  <td className="px-3 py-1 border border-white/10">{item.quantity}</td>
                                  <td className="px-3 py-1 border border-white/10">{item.unit}</td>
                                  <td className="px-3 py-1 border border-white/10">₹{item.price !== undefined ? parseFloat(item.price).toFixed(2) : item.sellingPrice !== undefined ? parseFloat(item.sellingPrice).toFixed(2) : "0.00"}</td>
                                  <td className="px-3 py-1 border border-white/10">
                                    ₹{((item.price !== undefined ? parseFloat(item.price) : item.sellingPrice !== undefined ? parseFloat(item.sellingPrice) : 0) * (item.quantity || 0)).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-3 font-semibold text-white">
                          Total Price: ₹
                          {(order.items || []).reduce((total, item) => {
                            const price = item.price !== undefined ? parseFloat(item.price) : item.sellingPrice !== undefined ? parseFloat(item.sellingPrice) : 0;
                            const qty = item.quantity || 0;
                            return total + price * qty;
                          }, 0).toFixed(2)}
                        </div>

                        {order.status === "Delivered" && (
                          order.inventorySynced ? (
                            <button className="mt-3 px-4 py-2 rounded-xl bg-white/20 text-white/80 cursor-not-allowed" disabled>
                              ✅ Added to Inventory
                            </button>
                          ) : (
                            <button
                              className="mt-3 px-4 py-2 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
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
          <div className="rounded-xl w-11/12 max-w-3xl p-4 overflow-y-auto max-h-[90vh] border border-white/10 bg-[#0B0F14]/90 backdrop-blur-xl text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
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