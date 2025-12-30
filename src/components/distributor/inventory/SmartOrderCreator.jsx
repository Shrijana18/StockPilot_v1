import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { exportOrderCSV } from "../../../lib/exporters/csv";
import { downloadOrderExcel } from "../../../lib/exporters/excel";
import { downloadOrderPDF } from "../../../lib/exporters/pdf";
import * as XLSX from "xlsx";

const SmartOrderCreator = ({ userId, products, onClose, preSelectLowStock = false }) => {
  const [restockItems, setRestockItems] = useState([]); // [{productId, product, restockQty, notes}]
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(preSelectLowStock ? "low" : "all"); // all, low, out
  const [showLowStockOnly, setShowLowStockOnly] = useState(preSelectLowStock);
  const [orderName, setOrderName] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  const db = getFirestore();

  // Filter products based on search and status
  const filteredProducts = useMemo(() => {
    let filtered = products || [];
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.productName?.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term) ||
          p.brand?.toLowerCase().includes(term) ||
          p.category?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter === "low") {
      filtered = filtered.filter((p) => {
        const qty = parseInt(p.quantity) || 0;
        return qty > 0 && qty <= 5;
      });
    } else if (statusFilter === "out") {
      filtered = filtered.filter((p) => {
        const qty = parseInt(p.quantity) || 0;
        return qty === 0;
      });
    }

    // Low stock only toggle
    if (showLowStockOnly) {
      filtered = filtered.filter((p) => {
        const qty = parseInt(p.quantity) || 0;
        return qty <= 5;
      });
    }

    return filtered;
  }, [products, searchTerm, statusFilter, showLowStockOnly]);

  // Get stock status
  const getStockStatus = (qty) => {
    const q = parseInt(qty) || 0;
    if (q === 0) return { label: "Out of Stock", color: "text-rose-400", bg: "bg-rose-500/20" };
    if (q <= 5) return { label: "Low Stock", color: "text-amber-400", bg: "bg-amber-500/20" };
    return { label: "In Stock", color: "text-emerald-400", bg: "bg-emerald-500/20" };
  };

  // Add item to restock list
  const addToRestock = (product) => {
    const exists = restockItems.find((item) => item.productId === product.id);
    if (exists) {
      toast.info("Product already in restock list");
      return;
    }
    setRestockItems([
      ...restockItems,
      {
        productId: product.id,
        product,
        restockQty: 1,
        notes: "",
      },
    ]);
    toast.success("Added to restock list");
  };

  // Remove from restock list
  const removeFromRestock = (productId) => {
    setRestockItems(restockItems.filter((item) => item.productId !== productId));
  };

  // Update restock quantity
  const updateRestockQty = (productId, qty) => {
    setRestockItems(
      restockItems.map((item) =>
        item.productId === productId ? { ...item, restockQty: Math.max(1, parseInt(qty) || 1) } : item
      )
    );
  };

  // Update notes
  const updateNotes = (productId, notes) => {
    setRestockItems(
      restockItems.map((item) => (item.productId === productId ? { ...item, notes } : item))
    );
  };

  // Quick add all low stock items
  const addAllLowStock = () => {
    const lowStock = filteredProducts.filter((p) => {
      const qty = parseInt(p.quantity) || 0;
      return qty <= 5;
    });
    const newItems = lowStock
      .filter((p) => !restockItems.find((item) => item.productId === p.id))
      .map((p) => {
        const currentQty = parseInt(p.quantity) || 0;
        // Smart restock quantity: if stock is 0, suggest 20; if low (1-5), suggest 15
        const suggestedQty = currentQty === 0 ? 20 : Math.max(15, currentQty + 10);
        return {
          productId: p.id,
          product: p,
          restockQty: suggestedQty,
          notes: "",
        };
      });
    if (newItems.length === 0) {
      toast.info("No new low stock items to add");
      return;
    }
    setRestockItems([...restockItems, ...newItems]);
    toast.success(`Added ${newItems.length} low stock items`);
  };

  // Auto-add low stock items on mount if preSelectLowStock is true
  useEffect(() => {
    if (preSelectLowStock && restockItems.length === 0 && products && products.length > 0) {
      // Small delay to ensure products are loaded
      const timer = setTimeout(() => {
        const lowStock = products.filter((p) => {
          const qty = parseInt(p.quantity) || 0;
          return qty <= 5;
        });
        const newItems = lowStock.map((p) => {
          const currentQty = parseInt(p.quantity) || 0;
          const suggestedQty = currentQty === 0 ? 20 : Math.max(15, currentQty + 10);
          return {
            productId: p.id,
            product: p,
            restockQty: suggestedQty,
            notes: "",
          };
        });
        if (newItems.length > 0) {
          setRestockItems(newItems);
          toast.success(`Auto-added ${newItems.length} low stock items`);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [preSelectLowStock, products?.length]);

  // Calculate total estimated cost
  const calculateTotal = () => {
    return restockItems.reduce((sum, item) => {
      const costPrice = parseFloat(item.product.costPrice) || 0;
      return sum + costPrice * item.restockQty;
    }, 0);
  };

  // Create order object for export
  const createOrderObject = () => {
    const orderId = `RESTOCK-${Date.now()}`;
    const items = restockItems.map((item) => ({
      productName: item.product.productName || item.product.name || "Unknown",
      brand: item.product.brand || "",
      sku: item.product.sku || "",
      category: item.product.category || "",
      quantity: item.restockQty,
      qty: item.restockQty,
      unit: item.product.unit || "",
      costPrice: parseFloat(item.product.costPrice) || 0,
      sellingPrice: parseFloat(item.product.sellingPrice) || 0,
      mrp: parseFloat(item.product.mrp) || 0,
      hsnCode: item.product.hsnCode || "",
      gstRate: parseFloat(item.product.gstRate || item.product.taxRate) || 0,
      price: parseFloat(item.product.costPrice) || 0,
      notes: item.notes || "",
    }));

    return {
      id: orderId,
      orderName: orderName || `Restock Order - ${new Date().toLocaleDateString()}`,
      notes: orderNotes,
      distributorId: userId,
      distributorName: "Distributor",
      items,
      itemsSubTotal: calculateTotal(),
      createdAt: new Date(),
      timestamp: { seconds: Math.floor(Date.now() / 1000) },
      type: "restock",
      status: "Draft",
    };
  };

  // Export as CSV
  const handleExportCSV = () => {
    if (restockItems.length === 0) {
      toast.error("No items in restock list");
      return;
    }
    const order = createOrderObject();
    
    // Custom CSV for restock order
    const headers = ["Product Name", "Brand", "SKU", "Category", "Current Stock", "Restock Qty", "Unit", "Cost Price", "Total Cost", "Notes"];
    const rows = restockItems.map((item) => {
      const currentQty = parseInt(item.product.quantity) || 0;
      const costPrice = parseFloat(item.product.costPrice) || 0;
      const totalCost = costPrice * item.restockQty;
      return [
        item.product.productName || item.product.name || "",
        item.product.brand || "",
        item.product.sku || "",
        item.product.category || "",
        currentQty,
        item.restockQty,
        item.product.unit || "",
        costPrice.toFixed(2),
        totalCost.toFixed(2),
        item.notes || "",
      ];
    });

    const totalRow = ["", "", "", "", "", "", "", "TOTAL", calculateTotal().toFixed(2), ""];
    const csvContent = [
      [`Restock Order: ${order.orderName}`],
      [`Created: ${new Date().toLocaleString()}`],
      [`Notes: ${orderNotes || "N/A"}`],
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
    link.download = `restock-order-${Date.now()}.csv`;
    link.click();
    toast.success("CSV exported successfully");
  };

  // Export as Excel
  const handleExportExcel = () => {
    if (restockItems.length === 0) {
      toast.error("No items in restock list");
      return;
    }

    const order = createOrderObject();
    const wsData = [
      ["Restock Order", order.orderName],
      ["Created", new Date().toLocaleString()],
      ["Notes", orderNotes || "N/A"],
      [""],
      ["Product Name", "Brand", "SKU", "Category", "Current Stock", "Restock Qty", "Unit", "Cost Price", "Total Cost", "Notes"],
      ...restockItems.map((item) => {
        const currentQty = parseInt(item.product.quantity) || 0;
        const costPrice = parseFloat(item.product.costPrice) || 0;
        const totalCost = costPrice * item.restockQty;
        return [
          item.product.productName || item.product.name || "",
          item.product.brand || "",
          item.product.sku || "",
          item.product.category || "",
          currentQty,
          item.restockQty,
          item.product.unit || "",
          costPrice,
          totalCost,
          item.notes || "",
        ];
      }),
      ["", "", "", "", "", "", "", "TOTAL", calculateTotal(), ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Restock Order");
    XLSX.writeFile(wb, `restock-order-${Date.now()}.xlsx`);
    toast.success("Excel file exported successfully");
  };

  // Export as PDF
  const handleExportPDF = () => {
    if (restockItems.length === 0) {
      toast.error("No items in restock list");
      return;
    }
    const order = createOrderObject();
    
    // Create a simplified PDF-friendly order structure
    const pdfOrder = {
      ...order,
      items: restockItems.map((item) => ({
        productName: item.product.productName || item.product.name || "Unknown",
        brand: item.product.brand || "",
        sku: item.product.sku || "",
        quantity: item.restockQty,
        qty: item.restockQty,
        price: parseFloat(item.product.costPrice) || 0,
        unit: item.product.unit || "",
      })),
    };

    downloadOrderPDF(pdfOrder, `restock-order-${Date.now()}.pdf`);
    toast.success("PDF exported successfully");
  };

  // Save order to Firestore
  const handleSaveOrder = async () => {
    if (restockItems.length === 0) {
      toast.error("No items in restock list");
      return;
    }

    try {
      const order = createOrderObject();
      const orderRef = collection(db, "businesses", userId, "restockOrders");
      
      // Prepare order data for Firestore
      const orderData = {
        orderId: order.id,
        orderName: order.orderName,
        notes: orderNotes || "",
        distributorId: userId,
        items: order.items.map(item => ({
          productName: item.productName,
          brand: item.brand || "",
          sku: item.sku || "",
          category: item.category || "",
          quantity: item.quantity,
          qty: item.qty,
          orderedQty: item.qty, // Store original ordered quantity
          receivedQty: 0, // Track received quantity
          unit: item.unit || "",
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
          mrp: item.mrp,
          hsnCode: item.hsnCode || "",
          gstRate: item.gstRate,
          price: item.price,
          notes: item.notes || "",
          status: "pending", // pending, partial, received
          receivedAt: null,
          // Store product ID for reference
          productId: restockItems.find(ri => 
            ri.product.sku === item.sku || 
            ri.product.productName === item.productName
          )?.productId || null,
        })),
        itemsSubTotal: order.itemsSubTotal,
        totalItems: restockItems.length,
        type: "restock",
        status: "Draft", // Draft, In Progress, Completed, Cancelled
        itemsStatus: {
          total: restockItems.length,
          pending: restockItems.length,
          partial: 0,
          received: 0,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Store timestamp for sorting
        timestamp: serverTimestamp(),
      };

      await addDoc(orderRef, orderData);
      toast.success("Restock order saved successfully!");
      // Reset form after save
      setRestockItems([]);
      setOrderName("");
      setOrderNotes("");
      onClose();
    } catch (error) {
      console.error("Error saving order:", error);
      toast.error("Failed to save order: " + (error.message || "Unknown error"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-[95%] max-w-7xl h-[90vh] bg-[#0B0F14] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10">
          <div>
            <h2 className="text-2xl font-bold text-white">Smart Order Creator</h2>
            <p className="text-sm text-white/60 mt-1">Create restock orders from your inventory</p>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Product Selection */}
          <div className="w-1/2 border-r border-white/10 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/10 space-y-3">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                >
                  <option value="all">All Products</option>
                  <option value="low">Low Stock (≤5)</option>
                  <option value="out">Out of Stock</option>
                </select>
                <label className="flex items-center gap-2 text-white/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLowStockOnly}
                    onChange={(e) => setShowLowStockOnly(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Show Low Stock Only</span>
                </label>
                <button
                  onClick={addAllLowStock}
                  className="ml-auto px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-white font-medium text-sm"
                >
                  Add All Low Stock
                </button>
              </div>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-white/60">
                  <p>No products found</p>
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product.quantity);
                  const isInRestock = restockItems.some((item) => item.productId === product.id);
                  return (
                    <div
                      key={product.id}
                      className={`p-3 rounded-lg border ${
                        isInRestock
                          ? "bg-emerald-500/20 border-emerald-400/50"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      } transition-all`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-white truncate">
                              {product.productName || product.name || "Unknown"}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}
                            >
                              {stockStatus.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-white/60 flex-wrap">
                            <span>SKU: {product.sku || "N/A"}</span>
                            <span>Brand: {product.brand || "N/A"}</span>
                            <span className="font-semibold text-white/80">
                              Stock: {product.quantity || 0} {product.unit || ""}
                            </span>
                            {product.costPrice && (
                              <span>Cost: ₹{parseFloat(product.costPrice).toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                        {!isInRestock ? (
                          <button
                            onClick={() => addToRestock(product)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium whitespace-nowrap"
                          >
                            Add
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/30 text-emerald-300 text-sm font-medium whitespace-nowrap">
                            Added
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel - Restock List */}
          <div className="w-1/2 flex flex-col overflow-hidden bg-white/5">
            <div className="p-4 border-b border-white/10 space-y-3">
              <input
                type="text"
                placeholder="Order Name (optional)"
                value={orderName}
                onChange={(e) => setOrderName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
              <textarea
                placeholder="Order Notes (optional)"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 resize-none"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/80">
                  {restockItems.length} item{restockItems.length !== 1 ? "s" : ""} in restock list
                </span>
                <span className="text-emerald-400 font-semibold">
                  Est. Total: ₹{calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>

            {/* Restock Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {restockItems.length === 0 ? (
                <div className="text-center py-12 text-white/60">
                  <p className="text-lg mb-2">No items in restock list</p>
                  <p className="text-sm">Add products from the left panel to create your order</p>
                </div>
              ) : (
                restockItems.map((item) => {
                  const currentQty = parseInt(item.product.quantity) || 0;
                  const costPrice = parseFloat(item.product.costPrice) || 0;
                  const lineTotal = costPrice * item.restockQty;
                  return (
                    <div
                      key={item.productId}
                      className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white mb-1 truncate">
                            {item.product.productName || item.product.name || "Unknown"}
                          </h3>
                          <div className="text-xs text-white/60 space-y-0.5">
                            <div>SKU: {item.product.sku || "N/A"}</div>
                            <div>Current Stock: {currentQty} {item.product.unit || ""}</div>
                            <div>Cost: ₹{costPrice.toFixed(2)} per {item.product.unit || "unit"}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromRestock(item.productId)}
                          className="text-rose-400 hover:text-rose-300 text-xl"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-white/80 w-24">Restock Qty:</label>
                          <input
                            type="number"
                            min="1"
                            value={item.restockQty}
                            onChange={(e) => updateRestockQty(item.productId, e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                          />
                          <span className="text-sm text-white/60">{item.product.unit || "units"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-white/80 w-24">Notes:</label>
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(e) => updateNotes(item.productId, e.target.value)}
                            placeholder="Optional notes..."
                            className="flex-1 px-3 py-1.5 rounded bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                          />
                        </div>
                        <div className="text-right text-sm">
                          <span className="text-white/60">Line Total: </span>
                          <span className="text-emerald-400 font-semibold">₹{lineTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-gradient-to-r from-white/5 to-white/0 flex items-center justify-between gap-3">
          <div className="text-sm text-white/60">
            Total Items: {restockItems.length} | Estimated Cost: ₹{calculateTotal().toFixed(2)}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={restockItems.length === 0}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              📄 CSV
            </button>
            <button
              onClick={handleExportExcel}
              disabled={restockItems.length === 0}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              📊 Excel
            </button>
            <button
              onClick={handleExportPDF}
              disabled={restockItems.length === 0}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              📑 PDF
            </button>
            <button
              onClick={handleSaveOrder}
              disabled={restockItems.length === 0}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              💾 Save Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartOrderCreator;

