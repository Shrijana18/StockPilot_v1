import React, { useState, useEffect } from "react";
import { getFirestore, collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "react-toastify";
import { exportOrderCSV } from "../../../lib/exporters/csv";
import { downloadOrderExcel } from "../../../lib/exporters/excel";
import { downloadOrderPDF } from "../../../lib/exporters/pdf";
import * as XLSX from "xlsx";

// Component for item receive input
const ItemReceiveInput = ({ orderId, itemIndex, orderedQty, receivedQty, onUpdate }) => {
  const [showInput, setShowInput] = useState(false);
  const [qtyInput, setQtyInput] = useState(receivedQty.toString());

  const handleSave = () => {
    const qty = parseFloat(qtyInput) || 0;
    if (qty < 0 || qty > orderedQty) {
      toast.error(`Quantity must be between 0 and ${orderedQty}`);
      return;
    }
    onUpdate(orderId, itemIndex, qty);
    setShowInput(false);
  };

  if (showInput) {
    return (
      <div className="flex items-center gap-2 justify-center">
        <input
          type="number"
          min="0"
          max={orderedQty}
          value={qtyInput}
          onChange={(e) => setQtyInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSave()}
          className="w-24 px-3 py-1.5 rounded-lg bg-white/10 border-2 border-emerald-400/50 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400 transition-all"
          autoFocus
        />
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium shadow-md hover:shadow-lg transition-all"
          title="Save"
        >
          ✓
        </button>
        <button
          onClick={() => {
            setShowInput(false);
            setQtyInput(receivedQty.toString());
          }}
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all"
          title="Cancel"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-2">
        <span className={`text-base font-bold ${
          receivedQty === orderedQty 
            ? "text-emerald-400" 
            : receivedQty > 0 
            ? "text-blue-400" 
            : "text-amber-400"
        }`}>
          {receivedQty}
        </span>
        <span className="text-white/40">/</span>
        <span className="text-white/70 font-semibold">{orderedQty}</span>
      </div>
      {receivedQty < orderedQty && (
        <button
          onClick={() => setShowInput(true)}
          className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs transition-all border border-white/20 hover:border-white/30"
          title="Update received quantity"
        >
          ✏️ Edit
        </button>
      )}
    </div>
  );
};

const RestockOrderHistory = ({ userId, onClose, embedded = false }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  const db = getFirestore();

  useEffect(() => {
    if (!userId) return;

    const ordersRef = collection(db, "businesses", userId, "restockOrders");
    const q = query(ordersRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ordersList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(ordersList);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching restock orders:", error);
        toast.error("Failed to load restock orders");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, db]);

  // Filter orders based on search
  const filteredOrders = orders.filter((order) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      order.orderName?.toLowerCase().includes(term) ||
      order.orderId?.toLowerCase().includes(term) ||
      order.notes?.toLowerCase().includes(term) ||
      order.items?.some((item) =>
        item.productName?.toLowerCase().includes(term) ||
        item.sku?.toLowerCase().includes(term) ||
        item.brand?.toLowerCase().includes(term)
      )
    );
  });

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "N/A";
    }
  };

  // Calculate total for an order
  const calculateOrderTotal = (order) => {
    if (order.itemsSubTotal) return order.itemsSubTotal;
    return (order.items || []).reduce(
      (sum, item) => sum + (parseFloat(item.costPrice) || 0) * (item.quantity || item.qty || 0),
      0
    );
  };

  // Calculate order status summary
  const getOrderStatusSummary = (order) => {
    const items = order.items || [];
    const total = items.length;
    const received = items.filter(item => item.status === "received").length;
    const partial = items.filter(item => item.status === "partial").length;
    const pending = items.filter(item => item.status === "pending" || !item.status).length;
    
    return { total, received, partial, pending };
  };

  // Get overall order status
  const getOverallOrderStatus = (order) => {
    const summary = getOrderStatusSummary(order);
    if (summary.received === summary.total) return { label: "Completed", color: "emerald", bg: "emerald-500/20" };
    if (summary.received > 0 || summary.partial > 0) return { label: "In Progress", color: "blue", bg: "blue-500/20" };
    if (order.status === "Cancelled") return { label: "Cancelled", color: "gray", bg: "gray-500/20" };
    return { label: "Draft", color: "amber", bg: "amber-500/20" };
  };

  // Mark item as received
  const handleMarkItemReceived = async (orderId, itemIndex, receivedQty) => {
    try {
      const orderRef = doc(db, "businesses", userId, "restockOrders", orderId);
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const items = [...(order.items || [])];
      const item = items[itemIndex];
      const orderedQty = item.orderedQty || item.quantity || item.qty || 0;
      const newReceivedQty = parseFloat(receivedQty) || 0;

      // Determine status
      let newStatus = "pending";
      if (newReceivedQty >= orderedQty) {
        newStatus = "received";
      } else if (newReceivedQty > 0) {
        newStatus = "partial";
      }

      items[itemIndex] = {
        ...item,
        receivedQty: newReceivedQty,
        status: newStatus,
        receivedAt: newStatus === "received" ? serverTimestamp() : item.receivedAt,
      };

      // Update order status summary
      const summary = getOrderStatusSummary({ items });
      const itemsStatus = {
        total: summary.total,
        received: summary.received,
        partial: summary.partial,
        pending: summary.pending,
      };

      // Update overall order status
      let overallStatus = order.status || "Draft";
      if (summary.received === summary.total) {
        overallStatus = "Completed";
      } else if (summary.received > 0 || summary.partial > 0) {
        overallStatus = "In Progress";
      }

      await updateDoc(orderRef, {
        items,
        itemsStatus,
        status: overallStatus,
        updatedAt: serverTimestamp(),
      });

      toast.success("Item status updated successfully");
    } catch (error) {
      console.error("Error updating item status:", error);
      toast.error("Failed to update item status");
    }
  };

  // Delete order
  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to delete this restock order?")) {
      return;
    }

    try {
      const orderRef = doc(db, "businesses", userId, "restockOrders", orderId);
      await deleteDoc(orderRef);
      toast.success("Order deleted successfully");
    } catch (error) {
      console.error("Error deleting order:", error);
      toast.error("Failed to delete order");
    }
  };

  // Export functions
  const handleExportCSV = (order) => {
    const headers = ["Product Name", "Brand", "SKU", "Category", "Restock Qty", "Unit", "Cost Price", "Total Cost", "Notes"];
    const rows = (order.items || []).map((item) => {
      const totalCost = (parseFloat(item.costPrice) || 0) * (item.quantity || item.qty || 0);
      return [
        item.productName || "",
        item.brand || "",
        item.sku || "",
        item.category || "",
        item.quantity || item.qty || 0,
        item.unit || "",
        parseFloat(item.costPrice || 0).toFixed(2),
        totalCost.toFixed(2),
        item.notes || "",
      ];
    });

    const totalRow = ["", "", "", "", "", "", "TOTAL", calculateOrderTotal(order).toFixed(2), ""];
    const csvContent = [
      [`Restock Order: ${order.orderName || order.orderId}`],
      [`Created: ${formatDate(order.createdAt || order.timestamp)}`],
      [`Notes: ${order.notes || "N/A"}`],
      [""],
      headers,
      ...rows,
      totalRow,
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `restock-order-${order.orderId || order.id}-${Date.now()}.csv`;
    link.click();
    toast.success("CSV exported successfully");
  };

  const handleExportExcel = (order) => {
    const wsData = [
      ["Restock Order", order.orderName || order.orderId],
      ["Created", formatDate(order.createdAt || order.timestamp)],
      ["Notes", order.notes || "N/A"],
      [""],
      ["Product Name", "Brand", "SKU", "Category", "Restock Qty", "Unit", "Cost Price", "Total Cost", "Notes"],
      ...(order.items || []).map((item) => {
        const totalCost = (parseFloat(item.costPrice) || 0) * (item.quantity || item.qty || 0);
        return [
          item.productName || "",
          item.brand || "",
          item.sku || "",
          item.category || "",
          item.quantity || item.qty || 0,
          item.unit || "",
          parseFloat(item.costPrice || 0),
          totalCost,
          item.notes || "",
        ];
      }),
      ["", "", "", "", "", "", "TOTAL", calculateOrderTotal(order), ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Restock Order");
    XLSX.writeFile(wb, `restock-order-${order.orderId || order.id}-${Date.now()}.xlsx`);
    toast.success("Excel file exported successfully");
  };

  const handleExportPDF = (order) => {
    const pdfOrder = {
      id: order.orderId || order.id,
      orderName: order.orderName || `Restock Order - ${formatDate(order.createdAt || order.timestamp)}`,
      items: (order.items || []).map((item) => ({
        productName: item.productName || "Unknown",
        brand: item.brand || "",
        sku: item.sku || "",
        quantity: item.quantity || item.qty || 0,
        qty: item.quantity || item.qty || 0,
        price: parseFloat(item.costPrice) || 0,
        unit: item.unit || "",
      })),
      proforma: {
        grandTotal: calculateOrderTotal(order),
      },
    };

    downloadOrderPDF(pdfOrder, `restock-order-${order.orderId || order.id}-${Date.now()}.pdf`);
    toast.success("PDF exported successfully");
  };

  const openOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  if (loading) {
    return (
      <div className={embedded ? "text-white text-lg py-8" : "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"}>
        <div className="text-white text-lg">Loading restock orders...</div>
      </div>
    );
  }

  // Render order details modal (works for both embedded and non-embedded)
  const renderOrderDetailsModal = () => {
    if (!showOrderDetails || !selectedOrder) return null;

    const orderSummary = getOrderStatusSummary(selectedOrder);
    const overallStatus = getOverallOrderStatus(selectedOrder);

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="absolute inset-0" onClick={() => setShowOrderDetails(false)} />
        <div className="relative w-full max-w-5xl max-h-[95vh] bg-gradient-to-br from-[#0B0F14] via-[#0f1419] to-[#0B0F14] rounded-2xl border border-white/20 shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl">
          {/* Enhanced Header */}
          <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-emerald-500/10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-white">
                    {selectedOrder.orderName || `Restock Order ${selectedOrder.orderId || selectedOrder.id}`}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${overallStatus.bg} text-${overallStatus.color}-300 border border-${overallStatus.color}-400/30`}>
                    {overallStatus.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-white/70">
                  <span className="flex items-center gap-1.5">
                    <span className="text-white/50">📅</span>
                    {formatDate(selectedOrder.createdAt || selectedOrder.timestamp)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-white/50">🆔</span>
                    {selectedOrder.orderId || selectedOrder.id}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-white/50">💰</span>
                    ₹{calculateOrderTotal(selectedOrder).toFixed(2)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowOrderDetails(false)}
                className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition-all hover:scale-110"
              >
                ✕
              </button>
            </div>

            {/* Progress Summary Bar */}
            <div className="flex items-center gap-4 pt-3 border-t border-white/10">
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Progress</span>
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                  style={{ width: `${(orderSummary.received / orderSummary.total) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-3">
                {orderSummary.received > 0 && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    ✅ {orderSummary.received} Received
                  </span>
                )}
                {orderSummary.partial > 0 && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    ⏳ {orderSummary.partial} Partial
                  </span>
                )}
                {orderSummary.pending > 0 && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    ⏸️ {orderSummary.pending} Pending
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {selectedOrder.notes && (
              <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-400/20 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <span className="text-lg">📝</span>
                  <div>
                    <p className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1">Order Notes</p>
                    <p className="text-sm text-white/90 leading-relaxed">{selectedOrder.notes}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Items Table */}
            <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-white/15 via-white/10 to-white/15 border-b-2 border-white/20">
                    <tr>
                      <th className="px-4 py-4 text-left text-white font-bold text-xs uppercase tracking-wider">Product</th>
                      <th className="px-4 py-4 text-left text-white font-bold text-xs uppercase tracking-wider">Brand</th>
                      <th className="px-4 py-4 text-left text-white font-bold text-xs uppercase tracking-wider">SKU</th>
                      <th className="px-4 py-4 text-center text-white font-bold text-xs uppercase tracking-wider">Ordered</th>
                      <th className="px-4 py-4 text-center text-white font-bold text-xs uppercase tracking-wider">Received</th>
                      <th className="px-4 py-4 text-center text-white font-bold text-xs uppercase tracking-wider">Status</th>
                      <th className="px-4 py-4 text-right text-white font-bold text-xs uppercase tracking-wider">Unit</th>
                      <th className="px-4 py-4 text-right text-white font-bold text-xs uppercase tracking-wider">Cost</th>
                      <th className="px-4 py-4 text-right text-white font-bold text-xs uppercase tracking-wider">Total</th>
                      <th className="px-4 py-4 text-center text-white font-bold text-xs uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(selectedOrder.items || []).map((item, index) => {
                      const orderedQty = item.orderedQty || item.quantity || item.qty || 0;
                      const receivedQty = item.receivedQty || 0;
                      const total = (parseFloat(item.costPrice) || 0) * orderedQty;
                      const itemStatus = item.status || "pending";
                      const progressPercent = orderedQty > 0 ? (receivedQty / orderedQty) * 100 : 0;
                      const statusConfig = {
                        received: { label: "Received", icon: "✅", color: "emerald", bg: "emerald-500/20", border: "emerald-400/50" },
                        partial: { label: "Partial", icon: "⏳", color: "blue", bg: "blue-500/20", border: "blue-400/50" },
                        pending: { label: "Pending", icon: "⏸️", color: "amber", bg: "amber-500/20", border: "amber-400/50" },
                      };
                      const status = statusConfig[itemStatus] || statusConfig.pending;
                      return (
                        <tr 
                          key={index} 
                          className={`group transition-all duration-200 ${
                            itemStatus === "received" 
                              ? "bg-emerald-500/5 hover:bg-emerald-500/10" 
                              : itemStatus === "partial"
                              ? "bg-blue-500/5 hover:bg-blue-500/10"
                              : "hover:bg-white/5"
                          }`}
                        >
                          <td className="px-4 py-4">
                            <div className="font-semibold text-white group-hover:text-emerald-300 transition-colors">
                              {item.productName || "Unknown"}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-white/70">{item.brand || "-"}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-xs font-mono text-white/60 bg-white/5 px-2 py-1 rounded border border-white/10">
                              {item.sku || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="text-white font-bold">{orderedQty}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center">
                              <ItemReceiveInput
                                orderId={selectedOrder.id}
                                itemIndex={index}
                                orderedQty={orderedQty}
                                receivedQty={receivedQty}
                                onUpdate={handleMarkItemReceived}
                              />
                            </div>
                            {/* Progress bar for received quantity */}
                            {orderedQty > 0 && (
                              <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-300 ${
                                    progressPercent === 100 
                                      ? "bg-emerald-500" 
                                      : progressPercent > 0 
                                      ? "bg-blue-500" 
                                      : "bg-amber-500"
                                  }`}
                                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                                />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-${status.bg} text-${status.color}-300 border border-${status.border} shadow-sm`}>
                              <span>{status.icon}</span>
                              <span>{status.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-sm text-white/70">{item.unit || "-"}</span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-sm text-white/80">₹{parseFloat(item.costPrice || 0).toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-base font-bold text-emerald-400">₹{total.toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {itemStatus !== "received" && (
                              <button
                                onClick={() => handleMarkItemReceived(selectedOrder.id, index, orderedQty)}
                                className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                                title="Mark as fully received"
                              >
                                ✓ Done
                              </button>
                            )}
                            {itemStatus === "received" && item.receivedAt && (
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-emerald-400 font-medium">✓ Received</span>
                                <span className="text-xs text-white/40 mt-0.5">
                                  {formatDate(item.receivedAt)}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Footer */}
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-emerald-500/10 border border-emerald-400/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wide mb-1">Total Items</p>
                    <p className="text-lg font-bold text-white">{orderSummary.total}</p>
                  </div>
                  <div className="h-12 w-px bg-white/20" />
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wide mb-1">Completed</p>
                    <p className="text-lg font-bold text-emerald-400">{orderSummary.received} / {orderSummary.total}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/60 uppercase tracking-wide mb-1">Grand Total</p>
                  <p className="text-2xl font-bold text-emerald-400">₹{calculateOrderTotal(selectedOrder).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Footer Actions */}
          <div className="px-6 py-5 border-t border-white/10 bg-gradient-to-r from-white/5 to-white/0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportCSV(selectedOrder)}
                className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium border border-white/20 transition-all hover:scale-105"
                title="Export as CSV"
              >
                📄 CSV
              </button>
              <button
                onClick={() => handleExportExcel(selectedOrder)}
                className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium border border-white/20 transition-all hover:scale-105"
                title="Export as Excel"
              >
                📊 Excel
              </button>
              <button
                onClick={() => handleExportPDF(selectedOrder)}
                className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium border border-white/20 transition-all hover:scale-105"
                title="Export as PDF"
              >
                📑 PDF
              </button>
            </div>
            <button
              onClick={() => setShowOrderDetails(false)}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (embedded) {
    // Embedded version for tab view
    return (
      <>
        <div className="space-y-4">
          {/* Search for embedded mode */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search orders by name, ID, or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </div>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-white/60 bg-white/5 rounded-lg border border-white/10">
              <p className="text-lg mb-2">No restock orders found</p>
              <p className="text-sm">Create your first restock order using the button above</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white truncate">
                          {order.orderName || `Restock Order ${order.orderId || order.id}`}
                        </h3>
                        {(() => {
                          const statusInfo = getOverallOrderStatus(order);
                          return (
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${statusInfo.bg} text-${statusInfo.color}-300 border border-${statusInfo.color}-400/30`}>
                              {statusInfo.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-sm text-white/60 space-y-1">
                        <div>Order ID: {order.orderId || order.id}</div>
                        <div>Created: {formatDate(order.createdAt || order.timestamp)}</div>
                        <div>
                          Items: {order.totalItems || order.items?.length || 0} | Total: ₹
                          {calculateOrderTotal(order).toFixed(2)}
                        </div>
                        {(() => {
                          const summary = getOrderStatusSummary(order);
                          return (
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-white/50">Progress:</span>
                              {summary.received > 0 && (
                                <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-300">
                                  ✅ {summary.received} received
                                </span>
                              )}
                              {summary.partial > 0 && (
                                <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300">
                                  ⏳ {summary.partial} partial
                                </span>
                              )}
                              {summary.pending > 0 && (
                                <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300">
                                  ⏸️ {summary.pending} pending
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        {order.notes && (
                          <div className="text-white/70 italic mt-2">Notes: {order.notes}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openOrderDetails(order)}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleExportCSV(order)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium"
                        title="Export CSV"
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => handleExportExcel(order)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium"
                        title="Export Excel"
                      >
                        Excel
                      </button>
                      <button
                        onClick={() => handleExportPDF(order)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium"
                        title="Export PDF"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-sm font-medium"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Render modal for embedded mode */}
        {renderOrderDetailsModal()}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-[95%] max-w-6xl h-[90vh] bg-[#0B0F14] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10">
          <div>
            <h2 className="text-2xl font-bold text-white">Restock Order History</h2>
            <p className="text-sm text-white/60 mt-1">
              {orders.length} saved order{orders.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-white/10">
          <input
            type="text"
            placeholder="Search orders by name, ID, or product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-white/60">
              <p className="text-lg mb-2">
                {orders.length === 0 ? "No restock orders found" : "No orders match your search"}
              </p>
              <p className="text-sm">
                {orders.length === 0
                  ? "Create your first restock order using Smart Order Creator"
                  : "Try adjusting your search terms"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white truncate">
                          {order.orderName || `Restock Order ${order.orderId || order.id}`}
                        </h3>
                        {(() => {
                          const statusInfo = getOverallOrderStatus(order);
                          return (
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${statusInfo.bg} text-${statusInfo.color}-300 border border-${statusInfo.color}-400/30`}>
                              {statusInfo.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-sm text-white/60 space-y-1">
                        <div>Order ID: {order.orderId || order.id}</div>
                        <div>Created: {formatDate(order.createdAt || order.timestamp)}</div>
                        <div>
                          Items: {order.totalItems || order.items?.length || 0} | Total: ₹
                          {calculateOrderTotal(order).toFixed(2)}
                        </div>
                        {(() => {
                          const summary = getOrderStatusSummary(order);
                          return (
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-white/50">Progress:</span>
                              {summary.received > 0 && (
                                <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-300">
                                  ✅ {summary.received} received
                                </span>
                              )}
                              {summary.partial > 0 && (
                                <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300">
                                  ⏳ {summary.partial} partial
                                </span>
                              )}
                              {summary.pending > 0 && (
                                <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300">
                                  ⏸️ {summary.pending} pending
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        {order.notes && (
                          <div className="text-white/70 italic mt-2">Notes: {order.notes}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openOrderDetails(order)}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleExportCSV(order)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium"
                        title="Export CSV"
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => handleExportExcel(order)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium"
                        title="Export Excel"
                      >
                        Excel
                      </button>
                      <button
                        onClick={() => handleExportPDF(order)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium"
                        title="Export PDF"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-sm font-medium"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Render modal for both embedded and non-embedded modes */}
        {renderOrderDetailsModal()}
      </div>
    </div>
  );
};

export default RestockOrderHistory;

