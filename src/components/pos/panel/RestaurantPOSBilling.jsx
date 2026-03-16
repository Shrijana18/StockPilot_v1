import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../../../firebase/firebaseConfig";
import { collection, doc, getDocs, getDoc, query, where, onSnapshot, addDoc, updateDoc, setDoc } from "firebase/firestore";
import CustomerForm from "../../billing/CustomerForm";
import { IconTokens, getIconSVG, getIconEmoji } from "./foodIcons";
import { usePOSTheme } from "../POSThemeContext";

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
const ALL_CATEGORY_ID = "__all__";

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
  pending:   "bg-blue-500/20 text-blue-300 border-blue-500/50",
  accepted:  "bg-green-500/20 text-green-300 border-green-500/50",
  preparing: "bg-amber-500/20 text-amber-300 border-amber-500/50",
  ready:     "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  served:    "bg-slate-500/20 text-slate-300 border-slate-500/50",
};

const statusLabels = {
  pending:   "Pending",
  accepted:  "Accepted",
  preparing: "Preparing",
  ready:     "Ready",
  served:    "Served",
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
  const { tc } = usePOSTheme();
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
  const [toasts, setToasts] = React.useState([]);
  const [showConfirmClose, setShowConfirmClose] = React.useState(false);
  const [showPreCheckout, setShowPreCheckout] = React.useState(false);
  const [showReceipt, setShowReceipt] = React.useState(false);
  const [receiptData, setReceiptData] = React.useState(null);
  // Checkout form state
  const [coPayment, setCoPayment]         = React.useState("cash"); // cash|card|upi|other
  const [coCustomer, setCoCustomer]       = React.useState({ name: "", phone: "" });
  const [coTaxMode, setCoTaxMode]         = React.useState("auto"); // auto|manual
  const [coTaxPct, setCoTaxPct]           = React.useState("5");    // manual GST %
  const [coExtraLabel, setCoExtraLabel]   = React.useState("Service Charge");
  const [coExtraAmt, setCoExtraAmt]       = React.useState("");
  const [coDiscount, setCoDiscount]       = React.useState("");
  const [coStaff, setCoStaff]             = React.useState(null);   // { id, name, role }
  const [posStaff, setPosStaff]           = React.useState([]);     // staff list for picker
  const [posSettings, setPosSettings]     = React.useState(null);   // posConfig/restaurantSettings

  const [collapsedRounds, setCollapsedRounds] = React.useState(new Set());
  const [footerMinimized, setFooterMinimized] = React.useState(false);
  const [itemNotes, setItemNotes] = React.useState({});
  const [showNoteFor, setShowNoteFor] = React.useState(null);
  const [rushMode, setRushMode] = React.useState(false);
  const [posNow, setPosNow] = React.useState(Date.now());

  const showToast = React.useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const [menuLoading, setMenuLoading] = React.useState(true);
  const [menuError, setMenuError] = React.useState(null);

  // Load categories and items (from CreateMenu) with error handling
  React.useEffect(() => {
    const uid = getUid();
    if (!uid) {
      setMenuError("User not authenticated");
      setMenuLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setMenuLoading(true);
        setMenuError(null);
        
        // Load categories
        const categoriesRef = collection(db, "businesses", uid, "categories");
        const categoriesSnap = await getDocs(categoriesRef);
        const cats = [];
        categoriesSnap.forEach((docSnap) => {
          cats.push({ id: docSnap.id, ...docSnap.data() });
        });
        setCategories(cats);
        // Default to "All" so operators can browse full menu quickly
        setSelectedCategoryId(ALL_CATEGORY_ID);

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
        
        if (itemsList.length === 0) {
          setMenuError("No menu items available. Please add items in Menu Builder.");
        }
      } catch (err) {
        console.error("Error loading menu data:", err);
        if (err.code === "permission-denied") {
          setMenuError("Access denied. Please check your permissions for menu data.");
        } else if (err.code === "unavailable") {
          setMenuError("Network error. Please check your connection and try again.");
        } else {
          setMenuError("Failed to load menu. Please try refreshing the page.");
        }
      } finally {
        setMenuLoading(false);
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
    // Single-field query only — no composite index needed; status filtered client-side
    const q = query(ordersRef, where("tableId", "==", table.id));

    const unsubscribe = onSnapshot(q, (snap) => {
      const orders = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status !== "completed") {
          orders.push({ id: docSnap.id, ...data });
        }
      });
      orders.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setKitchenOrders(orders);
      const activeOrder = orders.find(o => ["pending", "preparing", "ready"].includes(o.status)) || orders[0];
      setActiveOrderId(activeOrder?.id || null);
    }, (error) => {
      console.error("Error loading kitchen orders:", error);
    });

    return () => unsubscribe();
  }, [table?.id]);

  // Load active staff for checkout picker
  React.useEffect(() => {
    const uid = getUid();
    if (!uid) return;
    const unsub = onSnapshot(collection(db, "businesses", uid, "pos-staff"), snap => {
      setPosStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.active !== false));
    });
    return unsub;
  }, []);

  // Load POS settings for invoice meta (GST, FSSAI, business info)
  React.useEffect(() => {
    const uid = getUid();
    if (!uid) return;
    getDoc(doc(db, "businesses", uid, "posConfig", "restaurantSettings"))
      .then(snap => { if (snap.exists()) setPosSettings(snap.data()); })
      .catch(() => {});
  }, []);

  // Live 30-second clock for table occupation timer
  React.useEffect(() => {
    const t = setInterval(() => setPosNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Filter items by category and search
  const filteredItems = React.useMemo(() => {
    let filtered = items;
    
    if (selectedCategoryId && selectedCategoryId !== ALL_CATEGORY_ID) {
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

  // Toggle collapse for a round in the right panel
  const toggleRoundCollapse = React.useCallback((orderId) => {
    setCollapsedRounds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  }, []);

  // Repeat last round — add all items from latest kitchen order back to cart
  const repeatLastRound = React.useCallback(() => {
    if (kitchenOrders.length === 0) return;
    const lastOrder = kitchenOrders[kitchenOrders.length - 1];
    const lastItems = lastOrder.items || lastOrder.lines || [];
    lastItems.forEach(line => {
      if (line.product) addToCart(line.product, line.qty || 1);
    });
    showToast("🔁 Last round added to cart!");
  }, [kitchenOrders, showToast, addToCart]);

  // Table occupation timer
  const tableOccupiedSince = kitchenOrders.length > 0 ? kitchenOrders[0].createdAt : null;
  const tableElapsedMins = tableOccupiedSince ? Math.floor((posNow - tableOccupiedSince) / 60000) : 0;
  const tableElapsedStr = tableElapsedMins < 60
    ? `${tableElapsedMins}m`
    : `${Math.floor(tableElapsedMins / 60)}h ${tableElapsedMins % 60}m`;

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
    let subTotal = 0, tax = 0;
    cart.forEach(line => {
      const price = Number(line.product.price || 0);
      const qty = line.qty || 1;
      const taxRate = Number(line.product.tax || 0) / 100;
      const lineSubTotal = price * qty;
      subTotal += lineSubTotal;
      tax += lineSubTotal * taxRate;
    });
    return { subTotal: +subTotal.toFixed(2), tax: +tax.toFixed(2), grandTotal: +(subTotal + tax).toFixed(2) };
  }, [cart]);

  // Total from already-sent kitchen orders
  const kitchenOrdersTotals = React.useMemo(() => {
    let subTotal = 0, tax = 0;
    kitchenOrders.forEach(order => {
      (order.items || order.lines || []).forEach(line => {
        const price = Number(line.product?.price || 0);
        const qty = line.qty || 1;
        const taxRate = Number(line.product?.tax || 0) / 100;
        const lineSubTotal = price * qty;
        subTotal += lineSubTotal;
        tax += lineSubTotal * taxRate;
      });
    });
    return { subTotal: +subTotal.toFixed(2), tax: +tax.toFixed(2), grandTotal: +(subTotal + tax).toFixed(2) };
  }, [kitchenOrders]);

  // Combined total: cart new items + kitchen orders already placed
  const checkoutTotal = React.useMemo(() => {
    const sub = totals.subTotal + kitchenOrdersTotals.subTotal;
    const tx  = totals.tax     + kitchenOrdersTotals.tax;
    return { subTotal: +sub.toFixed(2), tax: +tx.toFixed(2), grandTotal: +(sub + tx).toFixed(2) };
  }, [totals, kitchenOrdersTotals]);

  // Final tax (auto from items or manual override) — must be before executeCheckout
  const finalTax = React.useMemo(() => {
    if (coTaxMode === "manual") {
      const pct = Number(coTaxPct);
      return isNaN(pct) ? checkoutTotal.tax : +(checkoutTotal.subTotal * pct / 100).toFixed(2);
    }
    return checkoutTotal.tax;
  }, [coTaxMode, coTaxPct, checkoutTotal]);

  const finalExtra    = Number(coExtraAmt) || 0;
  const finalDiscount = Number(coDiscount) || 0;
  const finalGrand    = +(checkoutTotal.subTotal + finalTax + finalExtra - finalDiscount).toFixed(2);

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
      showToast("Failed to update table", "error");
    } finally {
      setSaving(false);
    }
  }, [table?.id, tableData, onTableUpdate]);

  // Send order to kitchen — always creates a new order document (new round/batch)
  const sendToKitchen = React.useCallback(async () => {
    if (cart.length === 0) {
      showToast("Cart is empty", "error");
      return;
    }

    const uid = getUid();
    if (!uid) {
      showToast("Not authenticated", "error");
      return;
    }

    setSaving(true);
    try {
      const kitchenOrdersRef = collection(db, "businesses", uid, "kitchenOrders");

      // Always create a new order document so each send is a distinct round
      const roundNumber = kitchenOrders.length + 1;
      const orderData = {
        items: cart.map(line => ({
          product: line.product,
          qty: line.qty,
          note: itemNotes[line.product.id] || "",
        })),
        lines: cart,
        totals,
        tableId: table?.id || null,
        tableName: table?.name || (table?.number ? `Table ${table.number}` : null),
        tableZone: table?.zone || null,
        customerId: customerData?.id || null,
        customerName: customerData?.name || table?.name || "Walk-in",
        status: "pending",
        roundNumber,
        isRush: rushMode,
        createdAt: Date.now(),
        sentAt: Date.now(),
      };

      await addDoc(kitchenOrdersRef, orderData);

      if (onOrderSentToKitchen) {
        await onOrderSentToKitchen(orderData);
      }

      setCart([]);
      setItemNotes({});
      setShowNoteFor(null);
      setRushMode(false);
      showToast(rushMode ? `🚨 RUSH Round ${roundNumber} sent!` : `🍳 Round ${roundNumber} sent to kitchen!`);
    } catch (error) {
      console.error("Error sending order to kitchen:", error);
      showToast("Failed to send order to kitchen", "error");
    } finally {
      setSaving(false);
    }
  }, [cart, totals, table, customerData, onOrderSentToKitchen, kitchenOrders, itemNotes, rushMode]);

  // Close/Complete all orders for this table
  const handleCloseOrders = React.useCallback(() => {
    if (!table?.id || kitchenOrders.length === 0) return;
    setShowConfirmClose(true);
  }, [table?.id, kitchenOrders.length]);

  const executeCloseOrders = React.useCallback(async () => {
    setShowConfirmClose(false);
    const uid = getUid();
    if (!uid) return;

    // Capture items before clearing
    const closedItems = [];
    kitchenOrders.forEach(order => {
      (order.items || order.lines || []).forEach(line => {
        const id = line.product?.id || line.name;
        const existing = closedItems.findIndex(i => (i.product?.id || i.name) === id);
        if (existing >= 0) closedItems[existing].qty = (closedItems[existing].qty || 1) + (line.qty || 1);
        else closedItems.push({ ...line });
      });
    });

    setSaving(true);
    try {
      await Promise.all(kitchenOrders.map(order =>
        updateDoc(doc(db, "businesses", uid, "kitchenOrders", order.id), {
          status: "completed", completedAt: Date.now(), updatedAt: Date.now(),
        })
      ));
      await updateDoc(doc(db, "businesses", uid, "tables", table.id), {
        status: "available", updatedAt: Date.now(),
      });

      setReceiptData({
        invoiceId: null,
        tableName: tableData.name || `Table ${tableData.number}`,
        tableZone: tableData.zone || "Main",
        tableCapacity: tableData.capacity || 4,
        customerName: customerData?.name || "Walk-in",
        items: closedItems,
        totals: kitchenOrdersTotals,
        timestamp: Date.now(),
        type: "close",
      });
      setShowReceipt(true);
    } catch (error) {
      console.error("Error closing orders:", error);
      showToast("Failed to close orders", "error");
      if (onBack) onBack();
    } finally {
      setSaving(false);
    }
  }, [table?.id, tableData, customerData, kitchenOrders, kitchenOrdersTotals, onBack, showToast]);

  // Open pre-checkout summary
  const handleCheckout = React.useCallback(() => {
    if (cart.length === 0 && kitchenOrders.length === 0) {
      showToast("No items to checkout", "error");
      return;
    }
    setShowPreCheckout(true);
  }, [cart.length, kitchenOrders.length, showToast]);

  // Actually create the invoice
  const executeCheckout = React.useCallback(async () => {
    setShowPreCheckout(false);
    if (!billing?.createInvoice) {
      showToast("Billing service not available", "error");
      return;
    }

    setSaving(true);
    try {
      // Merge cart + kitchen order items
      const allItems = [...cart];
      kitchenOrders.forEach(order => {
        (order.items || order.lines || []).forEach(line => {
          const existing = allItems.findIndex(i => i.product?.id === line.product?.id);
          if (existing >= 0) {
            allItems[existing] = { ...allItems[existing], qty: (allItems[existing].qty || 1) + (line.qty || 1) };
          } else {
            allItems.push({ product: line.product, qty: line.qty || 1 });
          }
        });
      });

      const payMethodLabel = { cash: "Cash", card: "Card / POS", upi: "UPI", other: "Other" }[coPayment] || "Cash";
      const mergedCustomer = coCustomer.name || coCustomer.phone
        ? { name: coCustomer.name || customerData?.name || "Guest", phone: coCustomer.phone || customerData?.phone || "" }
        : customerData || { name: "Guest" };

      const invoiceData = {
        lines: allItems,
        totals: {
          subTotal: checkoutTotal.subTotal,
          tax: finalTax,
          extraCharge: finalExtra,
          discount: finalDiscount,
          grandTotal: finalGrand,
        },
        customer: mergedCustomer,
        payments: [{ method: payMethodLabel, amount: finalGrand }],
        mode: "POS",
        meta: {
          source: "restaurant-pos",
          tableId: table?.id,
          tableName: tableData.name || `Table ${tableData.number}`,
          tableZone: tableData.zone || "Main",
          tableCapacity: tableData.capacity,
          paymentMethod: payMethodLabel,
          businessName: posSettings?.business?.name || billing?.businessInfo?.name || "",
          businessAddress: posSettings?.business?.address || billing?.businessInfo?.address || "",
          gstNumber: posSettings?.business?.gstNumber || billing?.businessInfo?.gstNumber || "",
          fssaiNumber: posSettings?.business?.fssaiNumber || "",
          panNumber: posSettings?.business?.panNumber || "",
          invoicePrefix: posSettings?.invoice?.prefix || "INV",
          servedBy: coStaff ? { id: coStaff.id, name: coStaff.name, role: coStaff.role } : null,
        }
      };

      const { id: invoiceId } = await billing.createInvoice(invoiceData);

      // Mark all kitchen orders completed
      const uid = getUid();
      if (kitchenOrders.length > 0) {
        await Promise.all(kitchenOrders.map(order =>
          updateDoc(doc(db, "businesses", uid, "kitchenOrders", order.id), {
            status: "completed", invoiceId, completedAt: Date.now(), updatedAt: Date.now(),
          })
        ));
      }

      // Free the table
      if (table?.id) {
        await updateDoc(doc(db, "businesses", uid, "tables", table.id), {
          status: "available", updatedAt: Date.now(),
        });
      }

      setCart([]);

      // Show receipt
      const payMethodLabel2 = { cash: "Cash", card: "Card / POS", upi: "UPI", other: "Other" }[coPayment] || "Cash";
      setReceiptData({
        invoiceId,
        tableName: tableData.name || `Table ${tableData.number}`,
        tableZone: tableData.zone || "Main",
        tableCapacity: tableData.capacity || 4,
        customerName: (coCustomer.name || customerData?.name) || "Guest",
        customerPhone: coCustomer.phone || customerData?.phone || "",
        paymentMethod: payMethodLabel2,
        items: allItems,
        totals: { subTotal: checkoutTotal.subTotal, tax: finalTax, extraCharge: finalExtra, discount: finalDiscount, grandTotal: finalGrand },
        timestamp: Date.now(),
        type: "checkout",
      });
      setShowReceipt(true);
    } catch (error) {
      console.error("Error during checkout:", error);
      showToast("Failed to create invoice", "error");
    } finally {
      setSaving(false);
    }
  }, [cart, customerData, table, tableData, billing, kitchenOrders, checkoutTotal, finalTax, finalExtra, finalDiscount, finalGrand, coPayment, coCustomer, showToast]);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const hasActiveOrders = kitchenOrders.length > 0;
  const activeOrder = kitchenOrders.find(o => o.id === activeOrderId);

  // Compile all items ordered across all kitchen orders for the summary
  const allOrderedItems = React.useMemo(() => {
    const map = {};
    kitchenOrders.forEach(order => {
      (order.items || order.lines || []).forEach(line => {
        const id = line.product?.id || line.name || line.product?.name;
        const name = line.product?.name || line.product?.productName || line.name || "Item";
        const price = Number(line.product?.price || 0);
        const qty = line.qty || line.quantity || 1;
        if (map[id]) {
          map[id].qty += qty;
        } else {
          map[id] = { name, price, qty };
        }
      });
    });
    return Object.values(map);
  }, [kitchenOrders]);

  const orderSummaryTotal = allOrderedItems.reduce((sum, it) => sum + it.price * it.qty, 0);

  // Build combined item list for pre-checkout preview
  const preCheckoutItems = React.useMemo(() => {
    const map = {};
    kitchenOrders.forEach(order => {
      (order.items || order.lines || []).forEach(line => {
        const id = line.product?.id || line.name;
        const name = line.product?.name || line.product?.productName || line.name || "Item";
        const price = Number(line.product?.price || 0);
        const qty = line.qty || 1;
        if (map[id]) map[id].qty += qty;
        else map[id] = { name, price, qty, source: "kitchen" };
      });
    });
    cart.forEach(line => {
      const id = line.product?.id;
      const name = line.product?.name;
      const price = Number(line.product?.price || 0);
      const qty = line.qty || 1;
      if (map[id]) map[id].qty += qty;
      else map[id] = { name, price, qty, source: "cart" };
    });
    return Object.values(map);
  }, [kitchenOrders, cart]);

  // Show loading state for menu data
  if (menuLoading) {
    return (
      <div className="relative w-full h-full flex items-center justify-center" style={tc.bg}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-16 w-[60%] h-[60%] rounded-full blur-[110px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob1} 0%, transparent 65%)` }} />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center"
        >
          <div className="w-16 h-16 border-4 border-emerald-500/40 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <div className={`text-sm font-semibold ${tc.textPrimary}`}>Loading Menu...</div>
          <div className={`text-xs mt-2 ${tc.textMuted}`}>Fetching items and categories</div>
        </motion.div>
      </div>
    );
  }

  // Show error state for menu data
  if (menuError) {
    return (
      <div className="relative w-full h-full flex items-center justify-center p-5" style={tc.bg}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-16 w-[60%] h-[60%] rounded-full blur-[110px]" style={{ background: `radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 65%)` }} />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-3xl mx-auto mb-4">
            📋
          </div>
          <div className={`text-base font-bold mb-2 ${tc.textPrimary}`}>Menu Loading Error</div>
          <div className={`text-sm mb-6 ${tc.textSub}`}>{menuError}</div>
          <div className="flex gap-3 justify-center">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => window.location.reload()}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${tc.primaryBtn}`}
            >
              Refresh Page
            </motion.button>
            {onBack && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onBack}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${tc.outlineBtn}`}
              >
                Go Back
              </motion.button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" style={tc.bg}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-16 w-[60%] h-[60%] rounded-full blur-[110px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob1} 0%, transparent 65%)` }} />
        <div className="absolute -bottom-32 -right-16 w-[55%] h-[55%] rounded-full blur-[110px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob2} 0%, transparent 65%)` }} />
      </div>

      {/* Top Bar */}
      <div className={`shrink-0 z-30 ${tc.headerBg}`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${tc.backBtn}`}
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
                <div className={`text-sm font-semibold flex items-center gap-2 ${tc.textPrimary}`}>
                  {tableData.name || `Table ${tableData.number}`}
                  <button
                    onClick={() => setShowEditTable(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-orange-300 hover:text-orange-200"
                    title="Edit table"
                  >
                    ✏️
                  </button>
                </div>
                <div className={`text-xs flex items-center gap-2 ${tc.textSub}`}>
                  Capacity: {tableData.capacity || 4} • Zone: {tableData.zone || "Main"}
                  {tableOccupiedSince && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      tableElapsedMins >= 60 ? "bg-red-500/20 text-red-300" :
                      tableElapsedMins >= 30 ? "bg-amber-500/20 text-amber-300" :
                      "bg-emerald-500/20 text-emerald-300"
                    }`}>
                      ⏱ {tableElapsedStr}
                    </span>
                  )}
                </div>
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
            className={`rounded-lg px-4 py-2 text-sm transition ${tc.outlineBtn}`}
          >
            {customerData?.name ? customerData.name : "Customer"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Menu Items */}
        <div className={`flex-1 flex flex-col overflow-hidden border-r ${tc.borderSoft}`}>
          {/* Categories */}
          <div className={`px-4 py-3 border-b backdrop-blur-sm overflow-x-auto ${tc.borderSoft}`}>
            <div className="flex gap-2">
              <button
                type="button"
                key={ALL_CATEGORY_ID}
                onClick={() => setSelectedCategoryId(ALL_CATEGORY_ID)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 flex items-center gap-2 ${
                  selectedCategoryId === ALL_CATEGORY_ID
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg"
                    : `${tc.mutedBg} ${tc.textSub} hover:bg-white/10`
                }`}
                title="Show all items"
              >
                <span className="w-4 h-4 inline-flex items-center justify-center">🍽️</span>
                <span>All</span>
              </button>
              {categories.map(cat => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 flex items-center gap-2 ${
                    selectedCategoryId === cat.id
                      ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg"
                      : `${tc.mutedBg} ${tc.textSub} hover:bg-white/10`
                  }`}
                >
                  <Icon token={cat.icon} fallback="🍽️" className="w-4 h-4" />
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className={`px-4 py-3 border-b ${tc.borderSoft}`}>
            <div className="relative">
              <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${tc.textMuted}`}>🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu items..."
                className={`w-full pl-10 pr-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-orange-500/50 ${tc.inputBg}`}
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
                    className={`relative rounded-xl border p-3 transition-all group hover:bg-white/10 ${tc.cardBg}`}
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
                      <div className={`text-sm font-semibold truncate flex-1 ${tc.textPrimary}`}>{item.name}</div>
                    </div>
                    <div className={`text-lg font-bold mb-2 ${tc.textPrimary}`}>₹{item.price}</div>
                    {item.tax > 0 && <div className={`text-xs mb-2 ${tc.textMuted}`}>Tax: {item.tax}%</div>}
                    
                    {qty > 0 ? (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQty(item.id, qty - 1)}
                          className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center transition ${tc.mutedBg} ${tc.textPrimary} hover:bg-white/20`}
                        >
                          −
                        </button>
                        <span className={`flex-1 text-center font-bold ${tc.textPrimary}`}>{qty}</span>
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
              <div className={`text-center py-12 ${tc.textMuted}`}>
                <div className="text-4xl mb-3">🍽️</div>
                <div>No items found</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Active Orders + New Cart + Actions */}
        <div className={`w-[360px] flex-none flex flex-col backdrop-blur-xl overflow-hidden border-l ${tc.borderSoft}`} style={tc.bg}>

          {/* ── ORDER READY banner ────────────────────────────────── */}
          <AnimatePresence>
            {kitchenOrders.some(o => o.status === "ready") && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mx-3 mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center gap-2.5 shrink-0"
              >
                <span className="text-lg animate-bounce">🔔</span>
                <div>
                  <div className="text-xs font-bold text-emerald-300">Order Ready to Serve!</div>
                  <div className="text-[10px] text-emerald-400/70">Kitchen has completed an order</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Active kitchen orders ── */}
          {hasActiveOrders && (
            <div className={`shrink-0 border-b ${tc.borderSoft}`}>
              <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-widest ${tc.textMuted}`}>Orders on Table</span>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-300 font-bold">{kitchenOrders.length}</span>
                {kitchenOrders.length > 1 && (
                  <button
                    onClick={repeatLastRound}
                    className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 transition"
                    title="Add last round's items to cart again"
                  >
                    🔁 Repeat last
                  </button>
                )}
              </div>
              <div className="px-3 pb-3 space-y-1.5 max-h-[220px] overflow-y-auto">
                {kitchenOrders.map((order, rIdx) => {
                  const orderItems = order.items || order.lines || [];
                  const isCollapsed = collapsedRounds.has(order.id);
                  const statusColor = {
                    pending:   "border-amber-500/40 bg-amber-500/10 text-amber-300",
                    accepted:  "border-green-500/40 bg-green-500/10 text-green-300",
                    preparing: "border-blue-500/40 bg-blue-500/10 text-blue-300",
                    ready:     "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
                    served:    "border-purple-500/30 bg-purple-500/10 text-purple-300",
                  }[order.status] || "border-white/10 bg-white/5 text-white/60";
                  return (
                    <div key={order.id} className={`rounded-xl border ${statusColor}`}>
                      <div
                        className="flex items-center justify-between px-2.5 py-2 cursor-pointer select-none"
                        onClick={() => toggleRoundCollapse(order.id)}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wide">Round {rIdx + 1}</span>
                          {order.isRush && <span className="text-[9px] font-black bg-red-500 text-white px-1 rounded animate-pulse">🚨 RUSH</span>}
                          <span className={`text-[10px] opacity-60 ${tc.textMuted}`}>{new Date(order.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold opacity-80">{statusLabels[order.status] || order.status}</span>
                          <span className={`text-[9px] ${tc.textMuted}`} style={{ display:"inline-block", transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)" }}>▼</span>
                        </div>
                      </div>
                      {!isCollapsed && orderItems.length > 0 && (
                        <div className={`px-2.5 pb-2 space-y-0.5 border-t ${tc.borderSoft}`}>
                          {orderItems.map((line, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] py-0.5">
                              <span className={`opacity-80 truncate flex-1 ${tc.textSub}`}>{line.product?.name || line.name || "Item"}</span>
                              {line.note && <span className="text-orange-300/70 italic text-[10px] mx-1 truncate max-w-[60px]">{line.note}</span>}
                              <span className="opacity-60 ml-2 flex-none">×{line.qty || 1}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Cart header ── */}
          <div className="px-3 pt-2.5 pb-1 shrink-0 flex items-center gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-widest ${tc.textMuted}`}>
              {hasActiveOrders ? "Add More Items" : "Order Cart"}
            </span>
            {cart.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-orange-500/25 text-orange-300 font-bold">{cart.length}</span>
            )}
            {hasActiveOrders && cart.length > 0 && (
              <span className="text-[10px] text-orange-300/70 ml-auto">New round</span>
            )}
          </div>

          {/* ── Cart items with inline notes ── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2 space-y-2">
            {cart.map(line => (
              <div key={line.product.id} className={`rounded-xl border px-3 py-2 ${tc.cardBg}`}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold truncate ${tc.textPrimary}`}>{line.product.name}</div>
                    <div className={`text-[11px] ${tc.textMuted}`}>₹{line.product.price} × {line.qty} = ₹{(line.product.price * line.qty).toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-none">
                    <button
                      onClick={() => setShowNoteFor(n => n === line.product.id ? null : line.product.id)}
                      className={`w-6 h-6 rounded-md text-[11px] flex items-center justify-center transition ${
                        itemNotes[line.product.id] ? "bg-orange-500/25 text-orange-300" : "bg-white/10 hover:bg-white/20 text-white/40 hover:text-white/70"
                      }`}
                      title="Add note"
                    >📝</button>
                    <button onClick={() => updateQty(line.product.id, line.qty - 1)}
                      className={`w-6 h-6 rounded-md text-sm font-bold flex items-center justify-center transition ${tc.mutedBg} ${tc.textPrimary} hover:bg-white/20`}>−</button>
                    <span className={`w-6 text-center text-sm font-bold ${tc.textPrimary}`}>{line.qty}</span>
                    <button onClick={() => updateQty(line.product.id, line.qty + 1)}
                      className={`w-6 h-6 rounded-md text-sm font-bold flex items-center justify-center transition ${tc.mutedBg} ${tc.textPrimary} hover:bg-white/20`}>+</button>
                    <button onClick={() => removeFromCart(line.product.id)}
                      className="w-6 h-6 rounded-md bg-red-500/20 hover:bg-red-500/35 text-red-400 text-sm font-bold flex items-center justify-center transition ml-0.5">×</button>
                  </div>
                </div>
                {showNoteFor === line.product.id && (
                  <input
                    autoFocus
                    value={itemNotes[line.product.id] || ""}
                    onChange={e => setItemNotes(n => ({ ...n, [line.product.id]: e.target.value }))}
                    placeholder="e.g. No onion, extra spicy..."
                    className="mt-1.5 w-full px-2 py-1 rounded-lg border border-orange-500/30 bg-orange-500/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                    onKeyDown={e => e.key === "Enter" && setShowNoteFor(null)}
                  />
                )}
                {itemNotes[line.product.id] && showNoteFor !== line.product.id && (
                  <div className="mt-1 text-[10px] text-orange-300/80 italic pl-1">📝 {itemNotes[line.product.id]}</div>
                )}
              </div>
            ))}
            {cart.length === 0 && (
              <div className={`flex flex-col items-center justify-center py-10 ${tc.textMuted}`}>
                <div className="text-3xl mb-2">🛒</div>
                <div className="text-xs">Tap an item to add</div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className={`shrink-0 border-t backdrop-blur-xl ${tc.borderSoft} ${tc.headerBg}`}>
            {/* Minimize/maximize toggle row */}
            <div className={`flex items-center justify-between px-3 py-1.5 border-b ${tc.borderSoft}`}>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${tc.textMuted}`}>Checkout Total</span>
                <span className="text-sm font-bold text-emerald-400">₹{money(checkoutTotal.grandTotal)}</span>
              </div>
              <button
                onClick={() => setFooterMinimized(m => !m)}
                className={`text-[10px] px-2 py-0.5 rounded transition hover:bg-white/20 ${tc.mutedBg} ${tc.textMuted} hover:${tc.textPrimary}`}
              >{footerMinimized ? "▲ Expand" : "▼ Collapse"}</button>
            </div>

            {/* Expandable breakdown */}
            {!footerMinimized && (
              <div className="px-3 pt-2 pb-1 space-y-0.5">
                {kitchenOrdersTotals.grandTotal > 0 && (
                  <div className={`flex justify-between text-xs ${tc.textSub}`}><span>Orders placed</span><span>₹{money(kitchenOrdersTotals.grandTotal)}</span></div>
                )}
                {totals.grandTotal > 0 && (
                  <div className={`flex justify-between text-xs ${tc.textSub}`}><span>New items</span><span>₹{money(totals.grandTotal)}</span></div>
                )}
                {checkoutTotal.tax > 0 && (
                  <div className={`flex justify-between text-xs ${tc.textSub}`}><span>Tax</span><span>₹{money(checkoutTotal.tax)}</span></div>
                )}
              </div>
            )}

            {/* Rush toggle + action row */}
            <div className="px-3 py-2 space-y-2">
              <div className="flex gap-2">
                {/* Rush toggle */}
                <button
                  onClick={() => setRushMode(r => !r)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition ${
                    rushMode
                      ? "bg-red-500/25 border-red-500/50 text-red-300"
                      : `${tc.outlineBtn}`
                  }`}
                  title="Mark order as Rush/Priority"
                >
                  🚨
                </button>
                <button
                  onClick={sendToKitchen}
                  disabled={cart.length === 0 || saving}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition ${
                    rushMode
                      ? "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white"
                      : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white"
                  }`}
                >
                  {saving ? "⏳" : rushMode ? "🚨 RUSH" : hasActiveOrders ? "➕ New Round" : "🍳 Send to Kitchen"}
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={(cart.length === 0 && !hasActiveOrders) || saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {saving ? "⏳" : "💳 Checkout"}
                </button>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => { setCart([]); setItemNotes({}); setShowNoteFor(null); }}
                  className={`w-full py-1.5 rounded-lg text-xs transition ${tc.outlineBtn}`}
                >Clear cart</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Table Modal */}
      <Modal open={showEditTable} onClose={() => setShowEditTable(false)} size="sm">
        <div className={`text-lg font-bold mb-4 ${tc.textPrimary}`}>Edit Table</div>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${tc.textSub}`}>Table Name</label>
            <input
              type="text"
              value={tableData.name || ""}
              onChange={(e) => setTableData(prev => ({ ...prev, name: e.target.value }))}
              className={`w-full rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500/50 ${tc.inputBg}`}
              placeholder={`Table ${tableData.number || ""}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${tc.textSub}`}>Capacity</label>
            <input
              type="number"
              value={tableData.capacity || 4}
              onChange={(e) => setTableData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 4 }))}
              className={`w-full rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500/50 ${tc.inputBg}`}
              min="1"
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${tc.textSub}`}>Zone</label>
            <select
              value={tableData.zone || "main"}
              onChange={(e) => setTableData(prev => ({ ...prev, zone: e.target.value }))}
              className={`w-full rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500/50 ${tc.inputBg}`}
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
            className={`px-4 py-2 rounded-lg transition ${tc.outlineBtn}`}
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
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl backdrop-blur-xl ${tc.modalBg}`}
          >
            <h3 className={`text-lg font-bold mb-4 ${tc.textPrimary}`}>Customer Information</h3>
            <CustomerForm customer={customerData} setCustomer={setCustomerData} />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowCustomer(false)}
                className={`px-4 py-2 rounded-lg transition ${tc.outlineBtn}`}
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Smart Checkout Sheet ── */}
      {showPreCheckout && (
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border shadow-2xl flex flex-col max-h-[92vh] backdrop-blur-xl ${tc.modalBg}`}
          >
            {/* ── Header ── */}
            <div className={`px-5 py-4 border-b flex items-center justify-between shrink-0 ${tc.borderSoft}`}>
              <div>
                <div className={`text-sm font-bold ${tc.textPrimary}`}>Checkout — {tableData.name || (tableData.number ? `Table ${tableData.number}` : "Walk-in Order")}</div>
                <div className={`text-xs mt-0.5 ${tc.textMuted}`}>Zone: {tableData.zone || "Main"} · {preCheckoutItems.length} item{preCheckoutItems.length !== 1 ? "s" : ""}</div>
              </div>
              <button onClick={() => setShowPreCheckout(false)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${tc.editBtn}`}>✕</button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">

              {/* ── Customer ── */}
              <div className={`px-5 py-3 border-b ${tc.borderSoft}`}>
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${tc.textMuted}`}>Customer</div>
                <div className="flex gap-2 items-center">
                  <input
                    value={coCustomer.name}
                    onChange={e => setCoCustomer(p => ({ ...p, name: e.target.value }))}
                    placeholder="Name (optional)"
                    className={`flex-1 px-3 py-2 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${tc.inputBg}`}
                  />
                  <input
                    value={coCustomer.phone}
                    onChange={e => setCoCustomer(p => ({ ...p, phone: e.target.value }))}
                    placeholder="Phone (optional)"
                    type="tel"
                    className={`flex-1 px-3 py-2 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${tc.inputBg}`}
                  />
                  <button
                    onClick={() => setCoCustomer({ name: "Guest", phone: "" })}
                    className={`px-3 py-2 rounded-lg text-xs transition whitespace-nowrap ${tc.outlineBtn}`}
                  >👤 Guest</button>
                </div>
              </div>

              {/* ── Items delivered ── */}
              <div className={`px-5 py-3 border-b ${tc.borderSoft}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-[10px] font-bold uppercase tracking-widest ${tc.textMuted}`}>Items</div>
                  <div className={`text-[10px] font-semibold ${tc.textMuted}`}>{preCheckoutItems.length} item{preCheckoutItems.length !== 1 ? "s" : ""}</div>
                </div>
                <div className="space-y-2">
                  {preCheckoutItems.map((item, idx) => (
                    <div key={idx} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${tc.mutedBg}`}>
                      <div className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center flex-none border ${tc.borderSoft} ${tc.textPrimary}`}>{item.qty}</div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold truncate ${tc.textPrimary}`}>{item.name}</div>
                        <div className={`text-[10px] ${tc.textMuted}`}>₹{item.price} × {item.qty}</div>
                      </div>
                      <div className={`text-xs font-bold flex-none ${tc.textSub}`}>₹{(item.price * item.qty).toFixed(2)}</div>
                    </div>
                  ))}
                  {preCheckoutItems.length === 0 && (
                    <div className={`text-xs text-center py-4 ${tc.textMuted}`}>No items in order</div>
                  )}
                </div>
              </div>

              {/* ── Tax / GST — redesigned ── */}
              <div className={`px-5 py-3 border-b ${tc.borderSoft}`}>
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${tc.textMuted}`}>Tax / GST</div>
                {/* Mode toggle pills */}
                <div className={`flex gap-2 mb-3 p-1 rounded-xl ${tc.mutedBg} border ${tc.borderSoft}`}>
                  <button
                    onClick={() => setCoTaxMode("auto")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      coTaxMode === "auto"
                        ? "bg-emerald-500/25 text-emerald-300 shadow-sm ring-1 ring-inset ring-emerald-400/30"
                        : `${tc.textMuted} hover:bg-white/[0.05]`
                    }`}
                  >
                    <span>⚡</span> Auto (from menu)
                  </button>
                  <button
                    onClick={() => setCoTaxMode("manual")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      coTaxMode === "manual"
                        ? "bg-amber-500/25 text-amber-300 shadow-sm ring-1 ring-inset ring-amber-400/30"
                        : `${tc.textMuted} hover:bg-white/[0.05]`
                    }`}
                  >
                    <span>✏️</span> Manual
                  </button>
                </div>
                {/* Manual rate input */}
                <AnimatePresence>
                  {coTaxMode === "manual" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden mb-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            value={coTaxPct}
                            onChange={e => setCoTaxPct(e.target.value.replace(/[^0-9.]/g, ""))}
                            type="text" inputMode="decimal" placeholder="0"
                            className={`w-full px-3 py-2.5 rounded-xl text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500/40 border border-amber-500/30 bg-amber-500/10 text-amber-200 placeholder:text-white/30`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">%</span>
                        </div>
                        <div className="flex gap-1">
                          {["0","5","12","18","28"].map(v => (
                            <button key={v} onClick={() => setCoTaxPct(v)}
                              className={`px-2.5 py-2 rounded-lg text-[10px] font-bold transition ${
                                coTaxPct === v ? "bg-amber-500 text-white shadow-sm" : `${tc.mutedBg} ${tc.textMuted} hover:bg-white/10`
                              }`}
                            >{v}%</button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex justify-between items-center">
                  <span className={`text-xs ${tc.textMuted}`}>
                    {coTaxMode === "auto" ? "Calculated from menu item rates" : `GST @ ${coTaxPct || 0}% on ₹${money(checkoutTotal.subTotal)}`}
                  </span>
                  <span className={`text-sm font-bold text-emerald-400`}>₹{money(finalTax)}</span>
                </div>
              </div>

              {/* ── Extra Charge & Discount ── */}
              <div className={`px-5 py-3 border-b ${tc.borderSoft}`}>
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${tc.textMuted}`}>Adjustments (optional)</div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className={`text-[10px] mb-1 ${tc.textMuted}`}>Extra charge label</div>
                    <input
                      value={coExtraLabel}
                      onChange={e => setCoExtraLabel(e.target.value)}
                      placeholder="Service Charge"
                      className={`w-full px-3 py-2 rounded-lg text-xs focus:outline-none ${tc.inputBg}`}
                    />
                  </div>
                  <div className="w-24">
                    <div className={`text-[10px] mb-1 ${tc.textMuted}`}>Amount (₹)</div>
                    <input
                      value={coExtraAmt}
                      onChange={e => setCoExtraAmt(e.target.value)}
                      type="number"
                      min="0"
                      placeholder="0"
                      className={`w-full px-3 py-2 rounded-lg text-xs focus:outline-none ${tc.inputBg}`}
                    />
                  </div>
                  <div className="w-24">
                    <div className={`text-[10px] mb-1 ${tc.textMuted}`}>Discount (₹)</div>
                    <input
                      value={coDiscount}
                      onChange={e => setCoDiscount(e.target.value)}
                      type="number"
                      min="0"
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-300 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                    />
                  </div>
                </div>
              </div>

              {/* ── Served By (Staff Picker) ── */}
              {posStaff.length > 0 && (
                <div className={`px-5 py-3 border-b ${tc.borderSoft}`}>
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${tc.textMuted}`}>Served By</div>
                  <div className="flex gap-2 flex-wrap">
                    {posStaff.map(s => {
                      const isSelected = coStaff?.id === s.id;
                      const initials = (s.name || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                      return (
                        <motion.button
                          key={s.id}
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={() => setCoStaff(isSelected ? null : { id: s.id, name: s.name, role: s.role })}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                            isSelected
                              ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200 shadow-sm"
                              : `${tc.cardBg} ${tc.borderSoft} ${tc.textSub} hover:bg-white/[0.07]`
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white flex-none ${
                            isSelected ? "bg-emerald-500" : "bg-gradient-to-br from-slate-500 to-gray-600"
                          }`}>{initials}</div>
                          <div className="text-left">
                            <div className="text-xs font-semibold leading-tight">{s.name}</div>
                            <div className={`text-[10px] capitalize leading-none ${isSelected ? "text-emerald-400/70" : tc.textMuted}`}>{s.role}</div>
                          </div>
                          {isSelected && <span className="text-emerald-400 text-xs ml-1">✓</span>}
                        </motion.button>
                      );
                    })}
                  </div>
                  {!coStaff && (
                    <p className={`text-[10px] mt-2 ${tc.textMuted}`}>Optional — tap to assign this bill to a staff member</p>
                  )}
                </div>
              )}

              {/* ── Payment method ── */}
              <div className={`px-5 py-3 border-b ${tc.borderSoft}`}>
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${tc.textMuted}`}>Payment Method</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: "cash", icon: "💵", label: "Cash" },
                    { key: "card", icon: "💳", label: "Card / POS" },
                    { key: "upi",  icon: "📲", label: "UPI" },
                    { key: "other",icon: "🔄", label: "Other" },
                  ].map(pm => (
                    <button
                      key={pm.key}
                      onClick={() => setCoPayment(pm.key)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-center transition ${
                        coPayment === pm.key
                          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                          : `${tc.cardBg} ${tc.textMuted} hover:bg-white/[0.07]`
                      }`}
                    >
                      <span className="text-lg">{pm.icon}</span>
                      <span className="text-[10px] font-semibold">{pm.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Bill summary ── */}
              <div className="px-5 py-3">
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${tc.textMuted}`}>Bill Summary</div>
                <div className="space-y-1">
                  <div className={`flex justify-between text-xs ${tc.textSub}`}><span>Subtotal</span><span>₹{money(checkoutTotal.subTotal)}</span></div>
                  <div className={`flex justify-between text-xs ${tc.textSub}`}><span>Tax / GST</span><span>₹{money(finalTax)}</span></div>
                  {finalExtra > 0 && <div className={`flex justify-between text-xs ${tc.textSub}`}><span>{coExtraLabel || "Extra"}</span><span>₹{money(finalExtra)}</span></div>}
                  {finalDiscount > 0 && <div className="flex justify-between text-xs text-red-400/70"><span>Discount</span><span>−₹{money(finalDiscount)}</span></div>}
                  <div className={`flex justify-between text-sm font-bold pt-2 border-t mt-1 ${tc.textPrimary} ${tc.borderSoft}`}>
                    <span>Grand Total</span>
                    <span className="text-emerald-400 text-base">₹{money(finalGrand)}</span>
                  </div>
                  <div className={`flex justify-between text-[10px] mt-1 ${tc.textMuted}`}>
                    <span>Paying via</span>
                    <span>{{ cash: "Cash", card: "Card / POS", upi: "UPI", other: "Other" }[coPayment]}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Confirm ── */}
            <div className={`px-5 py-4 border-t flex gap-3 shrink-0 ${tc.borderSoft}`}>
              <button
                onClick={() => setShowPreCheckout(false)}
                className={`flex-1 py-3 rounded-xl text-sm transition ${tc.outlineBtn}`}
                disabled={saving}
              >Cancel</button>
              <button
                onClick={executeCheckout}
                className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-bold shadow-lg transition disabled:opacity-50"
                disabled={saving}
              >{saving ? "⏳ Processing..." : `💳 Confirm — ₹${money(finalGrand)}`}</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Receipt Modal (after checkout) ── */}
      {showReceipt && receiptData && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-lg flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/98 via-slate-800/95 to-slate-900/98 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden"
          >
            {/* Receipt header */}
            <div className={`px-6 py-6 text-center border-b border-white/10 ${receiptData.type === "checkout" ? "bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-transparent" : "bg-gradient-to-br from-blue-500/10 to-transparent"}`}>
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }} 
                transition={{ type: "spring", stiffness: 500, damping: 25, delay: 0.1 }}
                className="text-3xl mb-2"
              >
                {receiptData.type === "checkout" ? "✅" : "🪑"}
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-lg font-bold text-white"
              >
                {receiptData.type === "checkout" ? "Invoice Created" : "Table Freed"}
              </motion.div>
              {receiptData.invoiceId ? (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-sm text-emerald-400 mt-1.5 font-mono bg-emerald-500/10 px-3 py-1 rounded-full inline-block"
                ># {receiptData.invoiceId}</motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-xs text-white/40 mt-1.5"
                >Orders closed · No invoice</motion.div>
              )}
            </div>
            {/* Table + Customer + Payment */}
            <div className="px-5 py-3 border-b border-white/[0.07] bg-white/[0.02] space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Table</div>
                  <div className="text-xs font-semibold text-white">{receiptData.tableName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Zone</div>
                  <div className="text-xs font-semibold text-white">{receiptData.tableZone}</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Time</div>
                  <div className="text-xs font-semibold text-white">{new Date(receiptData.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              </div>
              {(receiptData.customerName || receiptData.customerPhone) && (
                <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                  <div className="text-[10px] text-white/40">Customer</div>
                  <div className="text-xs text-white/70 text-right">
                    {receiptData.customerName || "Guest"}
                    {receiptData.customerPhone && <span className="ml-2 text-white/40">{receiptData.customerPhone}</span>}
                  </div>
                </div>
              )}
              {receiptData.paymentMethod && (
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-white/40">Payment</div>
                  <div className="text-xs font-semibold text-emerald-400">{receiptData.paymentMethod}</div>
                </div>
              )}
            </div>
            {/* Items */}
            <div className="px-6 py-4 max-h-72 overflow-y-auto space-y-2" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.2) transparent" }}>
              <AnimatePresence>
                {receiptData.items.map((item, idx) => {
                  const name  = item.product?.name || item.name;
                  const price = Number(item.product?.price || item.price || 0);
                  const qty   = item.qty || 1;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.05, type: "spring", stiffness: 300, damping: 24 }}
                      whileHover={{ x: 4, backgroundColor: "rgba(255,255,255,0.08)" }}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <motion.div 
                          initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                          className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/20 text-[11px] font-bold text-emerald-300 flex items-center justify-center flex-none"
                        >{qty}</motion.div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white/90 truncate">{name}</div>
                          <div className="text-[11px] text-white/40">₹{price} × {qty}</div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-emerald-400 flex-none ml-3">₹{(price * qty).toFixed(2)}</div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            {/* Bill breakdown */}
            <div className="px-5 py-3 border-t border-white/[0.07] bg-white/[0.02] space-y-1">
              <div className="flex justify-between text-xs text-white/40"><span>Subtotal</span><span>₹{money(receiptData.totals.subTotal)}</span></div>
              {receiptData.totals.tax > 0 && <div className="flex justify-between text-xs text-white/40"><span>Tax / GST</span><span>₹{money(receiptData.totals.tax)}</span></div>}
              {receiptData.totals.extraCharge > 0 && <div className="flex justify-between text-xs text-white/40"><span>Extra charge</span><span>₹{money(receiptData.totals.extraCharge)}</span></div>}
              {receiptData.totals.discount > 0 && <div className="flex justify-between text-xs text-red-400/60"><span>Discount</span><span>−₹{money(receiptData.totals.discount)}</span></div>}
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-white/10 mt-1">
                <span>Total Charged</span>
                <span className="text-emerald-400">₹{money(receiptData.totals.grandTotal)}</span>
              </div>
            </div>
            {/* Done */}
            <div className="px-6 py-5">
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setShowReceipt(false); if (onBack) onBack(); }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 bg-[length:200%_100%] hover:bg-[position:100%_0] text-white text-sm font-bold transition-all duration-300 shadow-lg shadow-emerald-500/25"
              >Done — Back to Tables</motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirm Close Orders — Full Order Summary */}
      {showConfirmClose && (
        <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/98 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/10 bg-white/[0.03]">
              <div className="text-base font-bold text-white">Close Orders — {tableData.name || `Table ${tableData.number}`}</div>
              <div className="text-xs text-white/50 mt-0.5">
                {kitchenOrders.length} order batch · {allOrderedItems.length} item type{allOrderedItems.length !== 1 ? "s" : ""} delivered
              </div>
            </div>

            {/* Order summary */}
            <div className="px-5 py-3 max-h-64 overflow-y-auto">
              {allOrderedItems.length === 0 ? (
                <div className="text-sm text-white/40 py-4 text-center">No items in orders</div>
              ) : (
                <div className="space-y-2">
                  {allOrderedItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-xs font-bold text-white/70 flex-none">
                          {item.qty}
                        </span>
                        <span className="text-sm text-white/80 truncate">{item.name}</span>
                      </div>
                      <span className="text-sm text-white/60 flex-none">₹{(item.price * item.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total */}
            {allOrderedItems.length > 0 && (
              <div className="px-5 py-3 border-t border-white/[0.07] bg-white/[0.02] flex items-center justify-between">
                <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">Total Delivered</span>
                <span className="text-base font-bold text-white">₹{orderSummaryTotal.toFixed(2)}</span>
              </div>
            )}

            {/* Warning */}
            <div className="px-5 py-3 bg-red-500/10 border-t border-red-500/20">
              <p className="text-xs text-red-300/80">
                ⚠️ Closing orders will free the table without generating an invoice. Use <strong>Checkout</strong> instead to create a bill.
              </p>
            </div>

            {/* Actions */}
            <div className="px-5 py-4 flex gap-3 border-t border-white/10">
              <button
                onClick={() => setShowConfirmClose(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm transition"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={executeCloseOrders}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition disabled:opacity-50"
                disabled={saving}
              >
                {saving ? "Closing..." : "Close & Free Table"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className={`px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium pointer-events-auto max-w-xs ${
                toast.type === 'error' ? 'bg-red-600/95 border-red-500 text-white' :
                'bg-emerald-600/95 border-emerald-500 text-white'
              }`}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
