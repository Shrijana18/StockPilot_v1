import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../../../firebase/firebaseConfig";
import { collection, doc, getDocs, query, where, onSnapshot, addDoc, updateDoc, setDoc } from "firebase/firestore";
import CustomerForm from "../../billing/CustomerForm";
import { IconTokens, getIconSVG, getIconEmoji } from "./foodIcons";

/**
 * RestaurantPOSBilling - Complete Restaurant-Specific POS
 * Features:
 * - Table-specific ordering
 * - Real-time kitchen order status
 * - Menu items from CreateMenu
 * - Send orders to kitchen (with order consolidation)
 * - Table editing
 * - Multiple table management
 * - Direct checkout
 */

const getUid = () => auth.currentUser?.uid;

// Helper to normalize type
const normalizeType = (t = "veg") =>
  String(t).toLowerCase().replace(/\s+/g, "").replace("-", "") === "nonveg" ? "nonveg" : "veg";

// Icon component
const Icon = ({ token, fallback, className = "w-4 h-4" }) => {
  if (token) {
    const svg = getIconSVG(token);
    if (svg) {
      return (
        <span
          className={className}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      );
    }
    const emoji = getIconEmoji(token);
    if (emoji) return <span className={className} style={{display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{emoji}</span>;
  }
  return <span className={className} style={{display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{fallback || "🍽️"}</span>;
};

// Money formatter
const money = (n) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Status colors
const statusColors = {
  pending: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  preparing: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  ready: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  served: "bg-slate-500/20 text-slate-300 border-slate-500/50",
};

const statusLabels = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
};

// Modal component
function Modal({ open, onClose, children, size = "md" }) {
  if (!open) return null;
  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl"
  };
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl p-6 shadow-2xl ring-1 ring-white/5`} 
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default function RestaurantPOSBilling({ 
  table, 
  customer, 
  onBack, 
  onOrderSentToKitchen,
  billing,
  inventory,
  onTableUpdate // Callback to refresh table list
}) {
  const [categories, setCategories] = React.useState([]);
  const [items, setItems] = React.useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("");
  const [cart, setCart] = React.useState([]);
  const [kitchenOrders, setKitchenOrders] = React.useState([]); // Active orders for this table
  const [search, setSearch] = React.useState("");
  const [showCustomer, setShowCustomer] = React.useState(false);
  const [showEditTable, setShowEditTable] = React.useState(false);
  const [customerData, setCustomerData] = React.useState(customer || { name: "", phone: "", email: "" });
  const [saving, setSaving] = React.useState(false);
  const [tableData, setTableData] = React.useState(table || {});
  const [activeOrderId, setActiveOrderId] = React.useState(null); // Track current active order for consolidation
  const [statusExpanded, setStatusExpanded] = React.useState(false); // Track status section expand/collapse

  // Load categories and items (from CreateMenu)
  React.useEffect(() => {
    const uid = getUid();
    if (!uid) return;

    const loadData = async () => {
      try {
        // Load categories
        const categoriesRef = collection(db, "businesses", uid, "categories");
        const categoriesSnap = await getDocs(categoriesRef);
        const cats = [];
        categoriesSnap.forEach((docSnap) => {
          cats.push({ id: docSnap.id, ...docSnap.data() });
        });
        setCategories(cats);
        if (cats.length > 0) setSelectedCategoryId(cats[0].id);

        // Load items (only available)
        const itemsRef = collection(db, "businesses", uid, "items");
        const itemsSnap = await getDocs(itemsRef);
        const itemsList = [];
        itemsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.available !== false) {
            itemsList.push({ id: docSnap.id, ...data });
          }
        });
        setItems(itemsList);
      } catch (err) {
        console.error("Error loading menu data:", err);
      }
    };

    loadData();
  }, []);

  // Update tableData when table prop changes
  React.useEffect(() => {
    if (table) setTableData(table);
  }, [table]);

  // Load real-time kitchen orders for this table
  React.useEffect(() => {
    if (!table?.id) {
      setKitchenOrders([]);
      setActiveOrderId(null);
      return;
    }

    const uid = getUid();
    if (!uid) return;

    const ordersRef = collection(db, "businesses", uid, "kitchenOrders");
    
    // Try with composite query, fallback to simple query if index doesn't exist
    let q;
    try {
      q = query(ordersRef, where("tableId", "==", table.id), where("status", "!=", "completed"));
    } catch (e) {
      // Fallback: query by tableId only, filter status in client
      q = query(ordersRef, where("tableId", "==", table.id));
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      const orders = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        // Filter out completed orders in client if composite query failed
        if (data.status !== "completed" && data.status !== "served") {
          orders.push({ id: docSnap.id, ...data });
        }
      });
      // Sort by creation time
      orders.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setKitchenOrders(orders);
      
      // Set active order ID to the most recent pending/preparing/ready order
      const activeOrder = orders.find(o => ["pending", "preparing", "ready"].includes(o.status)) || orders[0];
      setActiveOrderId(activeOrder?.id || null);
    }, (error) => {
      console.error("Error loading kitchen orders:", error);
      // If composite query fails, try simple query
      if (error.code === 'failed-precondition') {
        const fallbackQ = query(ordersRef, where("tableId", "==", table.id));
        onSnapshot(fallbackQ, (snap) => {
          const orders = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status !== "completed" && data.status !== "served") {
              orders.push({ id: docSnap.id, ...data });
            }
          });
          orders.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          setKitchenOrders(orders);
          const activeOrder = orders.find(o => ["pending", "preparing", "ready"].includes(o.status)) || orders[0];
          setActiveOrderId(activeOrder?.id || null);
        });
      }
    });

    return () => unsubscribe();
  }, [table?.id]);

  // Filter items by category and search
  const filteredItems = React.useMemo(() => {
    let filtered = items;
    
    if (selectedCategoryId) {
      filtered = filtered.filter(item => item.categoryId === selectedCategoryId);
    }
    
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(item => 
        (item.name || "").toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [items, selectedCategoryId, search]);

  // Add to cart
  const addToCart = React.useCallback((item, qty = 1) => {
    setCart(prev => {
      const existing = prev.findIndex(line => line.product.id === item.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + qty };
        return updated;
      }
      return [...prev, { product: item, qty }];
    });
  }, []);

  // Remove from cart
  const removeFromCart = React.useCallback((itemId) => {
    setCart(prev => prev.filter(line => line.product.id !== itemId));
  }, []);

  // Update quantity
  const updateQty = React.useCallback((itemId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(prev => prev.map(line => 
      line.product.id === itemId ? { ...line, qty: newQty } : line
    ));
  }, [removeFromCart]);

  // Calculate totals
  const totals = React.useMemo(() => {
    let subTotal = 0;
    let tax = 0;

    cart.forEach(line => {
      const price = Number(line.product.price || 0);
      const qty = line.qty || 1;
      const taxRate = Number(line.product.tax || 0) / 100;
      const lineSubTotal = price * qty;
      const lineTax = lineSubTotal * taxRate;
      subTotal += lineSubTotal;
      tax += lineTax;
    });

    const grandTotal = subTotal + tax;
    return { subTotal: +subTotal.toFixed(2), tax: +tax.toFixed(2), grandTotal: +grandTotal.toFixed(2) };
  }, [cart]);

  // Save table changes
  const handleSaveTable = React.useCallback(async () => {
    if (!table?.id) return;
    
    const uid = getUid();
    if (!uid) return;

    setSaving(true);
    try {
      const tableRef = doc(db, "businesses", uid, "tables", table.id);
      await updateDoc(tableRef, {
        name: tableData.name || `Table ${tableData.number}`,
        capacity: Number(tableData.capacity) || 4,
        zone: tableData.zone || "main",
        updatedAt: Date.now(),
      });
      setShowEditTable(false);
      if (onTableUpdate) onTableUpdate();
    } catch (error) {
      console.error("Error updating table:", error);
      alert("Failed to update table");
    } finally {
      setSaving(false);
    }
  }, [table?.id, tableData, onTableUpdate]);

  // Send order to kitchen (with consolidation)
  const sendToKitchen = React.useCallback(async () => {
    if (cart.length === 0) {
      alert("Cart is empty");
      return;
    }

    const uid = getUid();
    if (!uid) {
      alert("Not authenticated");
      return;
    }

    setSaving(true);
    try {
      const kitchenOrdersRef = collection(db, "businesses", uid, "kitchenOrders");
      
      // Check if there's an active order we can add to
      if (activeOrderId) {
        const activeOrder = kitchenOrders.find(o => o.id === activeOrderId);
        if (activeOrder && ["pending", "preparing", "ready"].includes(activeOrder.status)) {
          // Add to existing order
          const existingItems = activeOrder.items || activeOrder.lines || [];
          const newItems = cart.map(line => ({
            product: line.product,
            qty: line.qty,
          }));
          
          // Merge items (combine quantities if same product)
          const mergedItems = [...existingItems];
          newItems.forEach(newItem => {
            const existingIndex = mergedItems.findIndex(
              item => item.product?.id === newItem.product?.id
            );
            if (existingIndex >= 0) {
              mergedItems[existingIndex] = {
                ...mergedItems[existingIndex],
                qty: (mergedItems[existingIndex].qty || 1) + (newItem.qty || 1),
              };
            } else {
              mergedItems.push(newItem);
            }
          });
          
          // Recalculate totals
          let newSubTotal = 0;
          let newTax = 0;
          mergedItems.forEach(line => {
            const price = Number(line.product?.price || 0);
            const qty = line.qty || 1;
            const taxRate = Number(line.product?.tax || 0) / 100;
            const lineSubTotal = price * qty;
            const lineTax = lineSubTotal * taxRate;
            newSubTotal += lineSubTotal;
            newTax += lineTax;
          });
          const newGrandTotal = newSubTotal + newTax;
          
          const orderRef = doc(kitchenOrdersRef, activeOrderId);
          await updateDoc(orderRef, {
            items: mergedItems,
            lines: mergedItems.map(item => ({ product: item.product, qty: item.qty })),
            totals: {
              subTotal: +newSubTotal.toFixed(2),
              tax: +newTax.toFixed(2),
              grandTotal: +newGrandTotal.toFixed(2),
            },
            updatedAt: Date.now(),
            lastAddedAt: Date.now(),
          });
          
          setCart([]);
          alert("Items added to existing order!");
          return;
        }
      }
      
      // Create new order if no active order exists
      const orderData = {
        items: cart.map(line => ({
          product: line.product,
          qty: line.qty,
        })),
        lines: cart,
        totals,
        tableId: table?.id || null,
        customerId: customerData?.id || null,
        customerName: customerData?.name || table?.name || "Walk-in",
        status: "pending",
        createdAt: Date.now(),
        sentAt: Date.now(),
      };

      await addDoc(kitchenOrdersRef, orderData);

      if (onOrderSentToKitchen) {
        await onOrderSentToKitchen(orderData);
      }

      // Clear cart after sending
      setCart([]);
      
      alert("Order sent to kitchen!");
    } catch (error) {
      console.error("Error sending order to kitchen:", error);
      alert("Failed to send order to kitchen");
    } finally {
      setSaving(false);
    }
  }, [cart, totals, table, customerData, onOrderSentToKitchen, activeOrderId, kitchenOrders]);

  // Close/Complete all orders for this table
  const handleCloseOrders = React.useCallback(async () => {
    if (!table?.id || kitchenOrders.length === 0) return;
    
    const uid = getUid();
    if (!uid) return;

    if (!confirm(`Close all orders for ${tableData.name || `Table ${tableData.number}`}?`)) {
      return;
    }

    setSaving(true);
    try {
      const updates = kitchenOrders.map(order => {
        const orderRef = doc(db, "businesses", uid, "kitchenOrders", order.id);
        return updateDoc(orderRef, {
          status: "completed",
          completedAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      
      await Promise.all(updates);
      
      // Update table status
      const tableRef = doc(db, "businesses", uid, "tables", table.id);
      await updateDoc(tableRef, {
        status: "available",
        updatedAt: Date.now(),
      });
      
      alert("All orders closed. Table is now available.");
      if (onBack) onBack();
    } catch (error) {
      console.error("Error closing orders:", error);
      alert("Failed to close orders");
    } finally {
      setSaving(false);
    }
  }, [table?.id, tableData, kitchenOrders, onBack]);

  // Checkout (create invoice and optionally send to kitchen)
  const handleCheckout = React.useCallback(async () => {
    if (cart.length === 0 && kitchenOrders.length === 0) {
      alert("No items to checkout");
      return;
    }

    if (!billing?.createInvoice) {
      alert("Billing service not available");
      return;
    }

    setSaving(true);
    try {
      // Combine cart items with all active kitchen orders for invoice
      const allItems = [...cart];
      kitchenOrders.forEach(order => {
        (order.items || order.lines || []).forEach(line => {
          const existing = allItems.findIndex(item => item.product?.id === line.product?.id);
          if (existing >= 0) {
            allItems[existing] = {
              ...allItems[existing],
              qty: (allItems[existing].qty || 1) + (line.qty || 1),
            };
          } else {
            allItems.push({
              product: line.product,
              qty: line.qty || 1,
            });
          }
        });
      });
      
      // Calculate totals for all items
      let subTotal = 0;
      let tax = 0;
      allItems.forEach(line => {
        const price = Number(line.product?.price || 0);
        const qty = line.qty || 1;
        const taxRate = Number(line.product?.tax || 0) / 100;
        const lineSubTotal = price * qty;
        const lineTax = lineSubTotal * taxRate;
        subTotal += lineSubTotal;
        tax += lineTax;
      });
      const grandTotal = subTotal + tax;

      const invoiceData = {
        lines: allItems,
        totals: {
          subTotal: +subTotal.toFixed(2),
          tax: +tax.toFixed(2),
          grandTotal: +grandTotal.toFixed(2),
        },
        customer: customerData,
        payments: [{ method: "Cash", amount: +grandTotal.toFixed(2) }],
        mode: "POS",
        meta: {
          source: "restaurant-pos",
          tableId: table?.id,
          tableName: tableData.name || table?.name,
          businessName: billing?.businessInfo?.name || "",
          businessAddress: billing?.businessInfo?.address || "",
          gstNumber: billing?.businessInfo?.gstNumber || "",
        }
      };

      const { id: invoiceId } = await billing.createInvoice(invoiceData);

      // Mark all kitchen orders as completed
      if (kitchenOrders.length > 0) {
        const uid = getUid();
        const updates = kitchenOrders.map(order => {
          const orderRef = doc(db, "businesses", uid, "kitchenOrders", order.id);
          return updateDoc(orderRef, {
            status: "completed",
            invoiceId,
            completedAt: Date.now(),
            updatedAt: Date.now(),
          });
        });
        await Promise.all(updates);
      }

      // Update table status to available
      if (table?.id) {
        const uid = getUid();
        const tableRef = doc(db, "businesses", uid, "tables", table.id);
        await updateDoc(tableRef, {
          status: "available",
          updatedAt: Date.now(),
        });
      }

      // Clear cart
      setCart([]);
      
      alert(`Invoice ${invoiceId} created successfully!`);
      if (onBack) onBack();
    } catch (error) {
      console.error("Error during checkout:", error);
      alert("Failed to create invoice");
    } finally {
      setSaving(false);
    }
  }, [cart, customerData, table, tableData, billing, onBack, kitchenOrders]);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const hasActiveOrders = kitchenOrders.length > 0;
  const activeOrder = kitchenOrders.find(o => o.id === activeOrderId);

  return (
    <div className="relative w-full min-h-screen bg-transparent">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.9]">
        <div className="absolute -top-1/3 -left-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-orange-500/20" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-red-500/20" />
      </div>

      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-sm border-b border-white/10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900 px-4 py-2 text-sm font-semibold shadow hover:shadow-lg transition"
          >
            ← Back to Tables
          </button>
          
          {/* Table Info */}
          {table && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-orange-500/20 border border-orange-500/50 group">
              <div className="w-10 h-10 rounded-full bg-orange-500/30 flex items-center justify-center text-orange-300 font-bold text-lg">
                {tableData.number || "T"}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  {tableData.name || `Table ${tableData.number}`}
                  <button
                    onClick={() => setShowEditTable(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-orange-300 hover:text-orange-200"
                    title="Edit table"
                  >
                    ✏️
                  </button>
                </div>
                <div className="text-xs text-white/70">Capacity: {tableData.capacity || 4} • Zone: {tableData.zone || "Main"}</div>
              </div>
              {hasActiveOrders && (
                <button
                  onClick={handleCloseOrders}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 transition"
                  title="Close all orders"
                >
                  Close Orders
                </button>
              )}
            </div>
          )}

          {customer && !table && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/50">
              <div className="text-sm font-semibold text-white">Walk-in Customer</div>
            </div>
          )}

          <div className="flex-1" />
          
          <button
            onClick={() => setShowCustomer(true)}
            className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm text-white/90 transition"
          >
            {customerData?.name ? customerData.name : "Customer"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex h-[calc(100vh-64px)]">
        {/* Left: Menu Items */}
        <div className="flex-1 flex flex-col border-r border-white/10 overflow-hidden">
          {/* Categories */}
          <div className="px-4 py-3 border-b border-white/10 bg-white/5 backdrop-blur-sm overflow-x-auto">
            <div className="flex gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 flex items-center gap-2 ${
                    selectedCategoryId === cat.id
                      ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg"
                      : "bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  <Icon token={cat.icon} fallback="🍽️" className="w-4 h-4" />
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu items..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none"
              />
            </div>
          </div>

          {/* Items Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredItems.map(item => {
                const inCart = cart.find(line => line.product.id === item.id);
                const qty = inCart?.qty || 0;
                const isVeg = normalizeType(item.type) === "veg";

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-3 hover:bg-white/10 transition-all group"
                  >
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-32 object-cover rounded-lg mb-2 border border-white/10"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      {isVeg ? (
                        <span className="w-3 h-3 bg-emerald-400 rounded-full border border-emerald-600" title="Veg" />
                      ) : (
                        <span className="w-3 h-3 bg-red-400 rounded-full border border-red-600" title="Non-Veg" />
                      )}
                      <div className="text-sm font-semibold text-white truncate flex-1">{item.name}</div>
                    </div>
                    <div className="text-lg font-bold text-white mb-2">₹{item.price}</div>
                    {item.tax > 0 && <div className="text-xs text-white/60 mb-2">Tax: {item.tax}%</div>}
                    
                    {qty > 0 ? (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQty(item.id, qty - 1)}
                          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition"
                        >
                          −
                        </button>
                        <span className="flex-1 text-center font-bold text-white">{qty}</span>
                        <button
                          onClick={() => updateQty(item.id, qty + 1)}
                          className="w-8 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center transition"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item, 1)}
                        className="w-full mt-2 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold transition shadow-lg"
                      >
                        Add
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-white/60">
                <div className="text-4xl mb-3">🍽️</div>
                <div>No items found</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart & Actions */}
        <div className="w-[420px] bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-xl border-l border-white/10 flex flex-col">
          {/* Status Section - Collapsible, compact */}
          {hasActiveOrders && (
            <div className="border-b border-white/10 bg-white/5">
              <button
                onClick={() => setStatusExpanded(prev => !prev)}
                className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-white">Order Status</div>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-300">
                    {kitchenOrders.length}
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-white/60 transition-transform ${statusExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <AnimatePresence>
                {statusExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-2 max-h-48 overflow-y-auto">
                      {kitchenOrders.map(order => (
                        <div
                          key={order.id}
                          className={`rounded-lg border p-2 ${statusColors[order.status] || statusColors.pending} ${
                            order.id === activeOrderId ? "ring-2 ring-orange-500/50" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold">{statusLabels[order.status] || "Pending"}</span>
                            {order.id === activeOrderId && (
                              <span className="text-[10px] text-orange-300 bg-orange-500/20 px-1.5 py-0.5 rounded">Active</span>
                            )}
                          </div>
                          <div className="text-xs opacity-80 mb-1">
                            {order.items?.length || order.lines?.length || 0} items
                          </div>
                          <div className="text-[10px] opacity-70">
                            {new Date(order.createdAt).toLocaleTimeString()}
                            {order.lastAddedAt && order.lastAddedAt !== order.createdAt && (
                              <span> • Updated {new Date(order.lastAddedAt).toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {activeOrder && (
                      <div className="px-3 pb-3 text-xs text-orange-300 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/30 mx-3 mb-3">
                        New items will be added to the active order
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Cart Header */}
          <div className="p-4 border-b border-white/10 bg-white/5">
            <div className="text-lg font-semibold text-white mb-1">Order Cart</div>
            <div className="text-sm text-white/60">{cart.length} items</div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.map(line => (
              <div
                key={line.product.id}
                className="rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{line.product.name}</div>
                    <div className="text-xs text-white/60 mt-1">₹{line.product.price} each</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(line.product.id, line.qty - 1)}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-bold text-white">{line.qty}</span>
                    <button
                      onClick={() => updateQty(line.product.id, line.qty + 1)}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">₹{(line.product.price * line.qty).toFixed(2)}</div>
                  </div>
                  <button
                    onClick={() => removeFromCart(line.product.id)}
                    className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold flex items-center justify-center transition"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="text-center py-12 text-white/60">
                <div className="text-4xl mb-3">🛒</div>
                <div>Cart is empty</div>
                <div className="text-xs mt-2">Add items from the menu</div>
              </div>
            )}
          </div>

          {/* Totals & Actions */}
          <div className="p-4 border-t border-white/10 bg-gradient-to-t from-slate-900/95 to-slate-800/95 backdrop-blur-xl space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-white/80">
                <span>Subtotal</span>
                <span>₹{money(totals.subTotal)}</span>
              </div>
              {totals.tax > 0 && (
                <div className="flex justify-between text-sm text-white/80">
                  <span>Tax</span>
                  <span>₹{money(totals.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-white/10">
                <span>Total</span>
                <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                  ₹{money(totals.grandTotal)}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={sendToKitchen}
                disabled={cart.length === 0 || saving}
                className="flex-1 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {saving ? "Sending..." : activeOrderId ? "Add to Order" : "Send to Kitchen"}
              </button>
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 && !hasActiveOrders || saving}
                className="flex-1 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {saving ? "Processing..." : "Checkout"}
              </button>
            </div>
            <button
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="w-full py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Clear Cart
            </button>
          </div>
        </div>
      </div>

      {/* Edit Table Modal */}
      <Modal open={showEditTable} onClose={() => setShowEditTable(false)} size="sm">
        <div className="text-lg font-bold text-white mb-4">Edit Table</div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Table Name</label>
            <input
              type="text"
              value={tableData.name || ""}
              onChange={(e) => setTableData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none"
              placeholder={`Table ${tableData.number || ""}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Capacity</label>
            <input
              type="number"
              value={tableData.capacity || 4}
              onChange={(e) => setTableData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 4 }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Zone</label>
            <select
              value={tableData.zone || "main"}
              onChange={(e) => setTableData(prev => ({ ...prev, zone: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none"
            >
              <option value="main">Main Dining</option>
              <option value="outdoor">Outdoor</option>
              <option value="vip">VIP Area</option>
              <option value="bar">Bar Area</option>
              <option value="private">Private Room</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={() => setShowEditTable(false)}
            className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white transition"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveTable}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold transition shadow-lg disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>

      {/* Customer Modal */}
      {showCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCustomer(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-white mb-4">Customer Information</h3>
            <CustomerForm customer={customerData} setCustomer={setCustomerData} />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowCustomer(false)}
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white transition"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
