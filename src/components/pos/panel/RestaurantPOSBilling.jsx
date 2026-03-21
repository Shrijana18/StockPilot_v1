import React from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../../../firebase/firebaseConfig";
import { collection, doc, getDocs, getDoc, query, where, onSnapshot, addDoc, updateDoc, setDoc } from "firebase/firestore";
import CustomerForm from "../../billing/CustomerForm";
import { IconTokens, getIconSVG, getIconEmoji } from "./foodIcons";
import { usePOSTheme } from "../POSThemeContext";
import { usePOSData } from "../POSDataContext";
import { usePOSBusiness } from "../POSBusinessContext";
import { generateKOT, generateInvoice, printThermalContent } from "../../../utils/thermalPrinter";

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

function AddonPickerModal({ item, onConfirm, onClose, tc }) {
  const [selections, setSelections] = React.useState({});
  const groups = item?.addonGroups || [];

  const toggle = (groupId, optionId, isMulti) => {
    setSelections(prev => {
      if (isMulti) {
        const curr = prev[groupId] || [];
        const exists = curr.includes(optionId);
        return { ...prev, [groupId]: exists ? curr.filter(id => id !== optionId) : [...curr, optionId] };
      }
      return { ...prev, [groupId]: [optionId] };
    });
  };

  const canConfirm = groups.every(g => !g.required || (selections[g.id] || []).length > 0);

  const handleConfirm = () => {
    const addons = [];
    let addonTotal = 0;
    groups.forEach(g => {
      (selections[g.id] || []).forEach(optId => {
        const opt = (g.options || []).find(o => o.id === optId);
        if (opt) { addons.push({ groupId: g.id, groupName: g.name, optionId: opt.id, name: opt.name, price: Number(opt.price) || 0 }); addonTotal += Number(opt.price) || 0; }
      });
    });
    const optionIds = addons.map(a => a.optionId).sort().join(",");
    const cartKey = optionIds ? `${item.id}::${optionIds}` : item.id;
    onConfirm({ addons, addonTotal, cartKey });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className={`w-full max-w-sm rounded-2xl border border-white/10 backdrop-blur-xl p-5 shadow-2xl max-h-[80vh] overflow-y-auto ${tc.modalBg}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className={`text-base font-bold ${tc.textPrimary}`}>{item.name}</h3>
            <p className={`text-xs mt-0.5 ${tc.textMuted}`}>Customize your order</p>
          </div>
          <button onClick={onClose} className={`w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition ${tc.textMuted}`}>✕</button>
        </div>
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.id}>
              <div className="flex items-center gap-2 mb-2">
                <p className={`text-xs font-bold uppercase tracking-wide ${tc.textSub}`}>{group.name}</p>
                {group.required && <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-500/20 text-red-400 border border-red-500/30">Required</span>}
                {!group.required && <span className={`text-[10px] ${tc.textMuted}`}>Optional</span>}
              </div>
              <div className="space-y-1.5">
                {(group.options || []).map(opt => {
                  const isSelected = (selections[group.id] || []).includes(opt.id);
                  return (
                    <button key={opt.id} type="button"
                      onClick={() => toggle(group.id, opt.id, group.multiSelect !== false)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition ${
                        isSelected ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : `${tc.mutedBg} border-white/8 ${tc.textSub} hover:bg-white/8`
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? "border-emerald-400 bg-emerald-400" : "border-white/25"
                        }`}>{isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}</span>
                        <span className="text-xs font-medium">{opt.name}</span>
                      </div>
                      {Number(opt.price) > 0 && <span className={`text-xs font-bold ${isSelected ? "text-emerald-300" : tc.textMuted}`}>+₹{Number(opt.price).toFixed(0)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {groups.length === 0 && <p className={`text-sm text-center py-4 ${tc.textMuted}`}>No add-on options configured.</p>}
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className={`flex-1 py-2.5 rounded-xl text-sm transition ${tc.outlineBtn}`}>Cancel</button>
          <button onClick={handleConfirm} disabled={!canConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white disabled:opacity-40 transition"
          >Add to Order</button>
        </div>
      </motion.div>
    </div>
  );
}

function QuickCustomizeModal({ cartLine, onSave, onClose, tc }) {
  const item = cartLine.product;
  const groups = item?.addonGroups || [];
  const configuredOptIds = new Set(groups.flatMap(g => (g.options || []).map(o => o.id)));

  const [selections, setSelections] = React.useState(() => {
    const map = {};
    (cartLine.addons || []).forEach(a => {
      if (a.optionId && configuredOptIds.has(a.optionId)) {
        if (!map[a.groupId]) map[a.groupId] = [];
        map[a.groupId].push(a.optionId);
      }
    });
    return map;
  });
  const [customAddons, setCustomAddons] = React.useState(() =>
    (cartLine.addons || []).filter(a => !a.optionId || !configuredOptIds.has(a.optionId))
  );
  const [newName, setNewName] = React.useState("");
  const [newPrice, setNewPrice] = React.useState("");

  const toggle = (groupId, optId, isMulti) => {
    setSelections(prev => {
      if (isMulti) {
        const curr = prev[groupId] || [];
        return { ...prev, [groupId]: curr.includes(optId) ? curr.filter(x => x !== optId) : [...curr, optId] };
      }
      const curr = prev[groupId] || [];
      return { ...prev, [groupId]: curr.includes(optId) ? [] : [optId] };
    });
  };

  const addCustom = () => {
    if (!newName.trim()) return;
    setCustomAddons(prev => [...prev, { name: newName.trim(), price: parseFloat(newPrice) || 0, source: "custom" }]);
    setNewName(""); setNewPrice("");
  };

  const addonRunningTotal = React.useMemo(() => {
    let t = 0;
    groups.forEach(g => { (selections[g.id] || []).forEach(optId => { const opt = (g.options || []).find(o => o.id === optId); if (opt) t += Number(opt.price) || 0; }); });
    customAddons.forEach(a => { t += Number(a.price) || 0; });
    return t;
  }, [selections, customAddons, groups]);

  const handleSave = () => {
    const addons = []; let total = 0;
    groups.forEach(g => {
      (selections[g.id] || []).forEach(optId => {
        const opt = (g.options || []).find(o => o.id === optId);
        if (opt) { addons.push({ groupId: g.id, groupName: g.name, optionId: opt.id, name: opt.name, price: Number(opt.price) || 0 }); total += Number(opt.price) || 0; }
      });
    });
    customAddons.forEach(a => { addons.push({ name: a.name, price: Number(a.price) || 0, source: "custom" }); total += Number(a.price) || 0; });
    onSave(addons, total);
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center sm:p-4 bg-black/65 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className={`w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col ${tc.modalBg}`}
        style={{ maxHeight: "88vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-start justify-between px-5 pt-4 pb-3 border-b shrink-0 ${tc.borderSoft}`}>
          <div>
            <div className="flex items-center gap-2">
              <span>🎛️</span>
              <span className={`text-sm font-bold ${tc.textPrimary}`}>{item?.name}</span>
            </div>
            <p className={`text-xs mt-0.5 ${tc.textMuted}`}>Add mods — free or paid, links to KDS & invoice</p>
          </div>
          <button onClick={onClose} className={`w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition shrink-0 ${tc.textMuted}`}>✕</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
          {groups.map(group => (
            <div key={group.id}>
              <div className="flex items-center gap-2 mb-2">
                <p className={`text-xs font-bold uppercase tracking-wide ${tc.textSub}`}>{group.name}</p>
                {group.required && <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-500/20 text-red-400 border border-red-500/30">Required</span>}
                {!group.required && <span className={`text-[10px] ${tc.textMuted}`}>Optional</span>}
              </div>
              <div className="space-y-1.5">
                {(group.options || []).map(opt => {
                  const isSelected = (selections[group.id] || []).includes(opt.id);
                  return (
                    <button key={opt.id} type="button"
                      onClick={() => toggle(group.id, opt.id, group.multiSelect !== false)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left transition text-xs ${
                        isSelected ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : `${tc.mutedBg} border-white/8 ${tc.textSub} hover:bg-white/8`
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-emerald-400 bg-emerald-400" : "border-white/25"}`}>
                          {isSelected && <span className="w-1 h-1 rounded-full bg-white" />}
                        </span>
                        {opt.name}
                      </div>
                      {Number(opt.price) > 0 ? <span className={`font-bold ${isSelected ? "text-emerald-300" : tc.textMuted}`}>+₹{Number(opt.price).toFixed(0)}</span> : <span className={`text-[10px] ${tc.textMuted}`}>Free</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs font-bold uppercase tracking-wide ${tc.textSub}`}>{groups.length > 0 ? "Quick Mods" : "Custom Modifications"}</p>
              <span className={`text-[10px] ${tc.textMuted}`}>₹0 = free</span>
            </div>
            {customAddons.length > 0 && (
              <div className="space-y-1 mb-2">
                {customAddons.map((a, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl ${tc.mutedBg} border border-white/8 text-xs`}>
                    <span className={tc.textSub}>{a.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${Number(a.price) > 0 ? "text-orange-300" : tc.textMuted}`}>
                        {Number(a.price) > 0 ? `+₹${Number(a.price).toFixed(0)}` : "Free"}
                      </span>
                      <button onClick={() => setCustomAddons(prev => prev.filter((_, idx) => idx !== i))}
                        className="w-4 h-4 rounded-full bg-red-500/20 text-red-400 text-[10px] flex items-center justify-center hover:bg-red-500/35 transition">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1.5 items-center">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustom())}
                placeholder="e.g. No Onion, Extra Spicy…"
                className={`flex-1 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-400/40 ${tc.inputBg}`}
              />
              <div className="relative shrink-0">
                <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs ${tc.textMuted}`}>₹</span>
                <input type="number" min="0" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustom())}
                  placeholder="0"
                  className={`pl-5 pr-2 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-400/40 ${tc.inputBg}`}
                  style={{ width: "70px" }}
                />
              </div>
              <button type="button" onClick={addCustom} disabled={!newName.trim()}
                className="px-3 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-xs font-bold disabled:opacity-40 transition border border-orange-500/25 shrink-0"
              >+</button>
            </div>
            <p className={`text-[10px] mt-1.5 ${tc.textMuted}`}>Type a mod name + price (₹0 for free requests like “no onion”)</p>
          </div>
        </div>

        <div className={`px-5 py-4 border-t shrink-0 ${tc.borderSoft} ${tc.headerBg}`}>
          {addonRunningTotal > 0 && (
            <div className={`flex justify-between text-xs mb-3 ${tc.textSub}`}>
              <span>Add-on total</span>
              <span className="font-bold text-orange-300">+₹{addonRunningTotal.toFixed(0)}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => onSave([], 0)} className={`px-3 py-2.5 rounded-xl text-xs transition ${tc.outlineBtn}`}>Clear All</button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white transition shadow-lg shadow-orange-500/20">
              ✓ Apply Changes
            </motion.button>
          </div>
        </div>
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
  const posData = usePOSData(); // Cached: categories, items, posStaff, posSettings, loading, error
  const bizData = usePOSBusiness();
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("");
  const [cart, setCart] = React.useState([]);
  const [kitchenOrders, setKitchenOrders] = React.useState([]); // Non-completed orders (used for checkout calc)
  const [allTableOrders, setAllTableOrders] = React.useState([]); // All orders incl. completed (for display)
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
  const [coPayment, setCoPayment]         = React.useState("cash"); // cash|card|upi|other|split|credit
  const [splitRows, setSplitRows]         = React.useState([{ method: "cash", amount: "" }, { method: "upi", amount: "" }]);
  const [creditAdvance, setCreditAdvance] = React.useState("");
  const [creditDueDate, setCreditDueDate] = React.useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [coCustomer, setCoCustomer]       = React.useState({ name: "", phone: "" });
  const [coTaxMode, setCoTaxMode]         = React.useState("auto"); // auto|manual
  const [coTaxPct, setCoTaxPct]           = React.useState("5");    // manual GST %
  const [coExtraLabel, setCoExtraLabel]   = React.useState("Service Charge");
  const [coExtraAmt, setCoExtraAmt]       = React.useState("");
  const [coDiscount, setCoDiscount]       = React.useState("");
  const [coDiscountLabel, setCoDiscountLabel] = React.useState("Discount");
  const [coAdhocLines, setCoAdhocLines]   = React.useState([]); // [{ name, price, qty }]
  const [coAdhocInput, setCoAdhocInput]   = React.useState({ name: "", price: "" });
  const [coStaff, setCoStaff]             = React.useState(null);   // { id, name, role }

  const [collapsedRounds, setCollapsedRounds] = React.useState(new Set());
  const [footerMinimized, setFooterMinimized] = React.useState(false);
  const [itemNotes, setItemNotes] = React.useState({});
  const [showNoteFor, setShowNoteFor] = React.useState(null);
  const [rushMode, setRushMode] = React.useState(false);
  const [posNow, setPosNow] = React.useState(Date.now());
  const [showAddonModal, setShowAddonModal] = React.useState(false);
  const [addonModalItem, setAddonModalItem] = React.useState(null);
  const [customizeCartKey, setCustomizeCartKey] = React.useState(null);

  const showToast = React.useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // Default to "All" category so operators can browse full menu quickly
  React.useEffect(() => {
    if (!selectedCategoryId && posData.categories.length > 0) setSelectedCategoryId(ALL_CATEGORY_ID);
  }, [selectedCategoryId, posData.categories]);


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
      const all = [];
      const active = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const order = { id: docSnap.id, ...data };
        all.push(order);
        if (data.status !== "completed") active.push(order);
      });
      all.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      active.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setAllTableOrders(all);
      setKitchenOrders(active);
      const activeOrder = active.find(o => ["pending", "preparing", "ready"].includes(o.status)) || active[0];
      setActiveOrderId(activeOrder?.id || null);
    }, (error) => {
      console.error("Error loading kitchen orders:", error);
    });

    return () => unsubscribe();
  }, [table?.id]);


  // Live 30-second clock for table occupation timer
  React.useEffect(() => {
    const t = setInterval(() => setPosNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Filter items by category and search
  const filteredItems = React.useMemo(() => {
    let filtered = posData.items;
    
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
  }, [posData.items, selectedCategoryId, search]);

  // Add to cart
  const addToCart = React.useCallback((item, qty = 1, addons = [], addonTotal = 0, cartKey = null) => {
    const key = cartKey || item.id;
    setCart(prev => {
      const existing = prev.findIndex(line => line.cartKey === key);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + qty };
        return updated;
      }
      return [...prev, { cartKey: key, product: item, qty, addons, addonTotal }];
    });
  }, []);

  // Remove from cart
  const removeFromCart = React.useCallback((cartKey) => {
    setCart(prev => prev.filter(line => line.cartKey !== cartKey));
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

  const updateCartLineAddons = React.useCallback((cartKey, newAddons, newAddonTotal) => {
    setCart(prev => prev.map(l => l.cartKey === cartKey ? { ...l, addons: newAddons, addonTotal: newAddonTotal } : l));
  }, []);

  // Update quantity
  const updateQty = React.useCallback((cartKey, newQty) => {
    if (newQty <= 0) {
      removeFromCart(cartKey);
      return;
    }
    setCart(prev => prev.map(line =>
      line.cartKey === cartKey ? { ...line, qty: newQty } : line
    ));
  }, [removeFromCart]);

  // Calculate totals
  const totals = React.useMemo(() => {
    let subTotal = 0, tax = 0;
    cart.forEach(line => {
      const basePrice = Number(line.product.price || 0);
      const addonPrice = Number(line.addonTotal || 0);
      const qty = line.qty || 1;
      const taxRate = Number(line.product.tax || 0) / 100;
      const lineSubTotal = (basePrice + addonPrice) * qty;
      subTotal += lineSubTotal;
      tax += lineSubTotal * taxRate;
    });
    return { subTotal: +subTotal.toFixed(2), tax: +tax.toFixed(2), grandTotal: +(subTotal + tax).toFixed(2) };
  }, [cart]);

  // Total from already-sent kitchen orders (excluding voided items)
  const kitchenOrdersTotals = React.useMemo(() => {
    let subTotal = 0, tax = 0;
    kitchenOrders.forEach(order => {
      (order.items || order.lines || []).forEach(line => {
        if (line.cancelled) return;
        const basePrice = Number(line.product?.price || 0);
        const addonPrice = Number(line.addonTotal || 0);
        const qty = line.qty || 1;
        const taxRate = Number(line.product?.tax || 0) / 100;
        const lineSubTotal = (basePrice + addonPrice) * qty;
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

  const adhocSubTotal = coAdhocLines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty) || 1), 0);
  const finalExtra    = Number(coExtraAmt) || 0;
  const finalDiscount = Number(coDiscount) || 0;
  const finalGrand    = +(checkoutTotal.subTotal + adhocSubTotal + finalTax + finalExtra - finalDiscount).toFixed(2);

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

  // Print KOT before sending to kitchen
  const printKOT = React.useCallback(() => {
    if (cart.length === 0) {
      showToast("Cart is empty", "error");
      return;
    }

    const roundNumber = kitchenOrders.length + 1;
    const orderData = {
      items: cart.map(line => ({
        product: line.product,
        qty: line.qty,
        note: itemNotes[line.product.id] || "",
      })),
      tableName: table?.name || (table?.number ? `Table ${table.number}` : "Walk-in"),
      tableZone: table?.zone || null,
      roundNumber,
      isRush: rushMode,
      timestamp: Date.now(),
    };

    printThermalContent(generateKOT(orderData), "Kitchen Order Ticket");
    showToast("🖨️ KOT sent to printer");
  }, [cart, table, kitchenOrders, itemNotes, rushMode, showToast]);

  // Print current table order summary (for kitchen/server physical record)
  const printOrderSummary = React.useCallback(() => {
    if (kitchenOrders.length === 0 && cart.length === 0) {
      showToast("No orders to print", "error");
      return;
    }

    const tName = table?.name || (table?.number ? `Table ${table.number}` : "Walk-in");
    const allItems = [];
    kitchenOrders.forEach(order => {
      (order.items || order.lines || []).forEach(line => {
        const id = line.product?.id || line.name;
        const idx = allItems.findIndex(i => (i.product?.id || i.name) === id);
        if (idx >= 0) allItems[idx].qty = (allItems[idx].qty || 1) + (line.qty || 1);
        else allItems.push({ ...line });
      });
    });
    cart.forEach(line => {
      const idx = allItems.findIndex(i => i.product?.id === line.product?.id);
      if (idx >= 0) allItems[idx].qty = (allItems[idx].qty || 1) + (line.qty || 1);
      else allItems.push({ ...line, _fromCart: true });
    });

    const subTotal = allItems.reduce((s, it) => s + Number(it.product?.price || it.price || 0) * (it.qty || 1), 0);

    const html = generateKOT({
      items: allItems,
      tableName: tName,
      tableZone: table?.zone || null,
      roundNumber: `${kitchenOrders.length} round${kitchenOrders.length !== 1 ? "s" : ""}`,
      isRush: false,
      timestamp: Date.now(),
      isOrderSummary: true,
      subTotal,
    });

    printThermalContent(html, `Order Summary — ${tName}`);
    showToast("�️ Order summary sent to printer");
  }, [kitchenOrders, cart, table, showToast]);

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
          addons: line.addons || [],
          addonTotal: line.addonTotal || 0,
          cartKey: line.cartKey,
          note: itemNotes[line.cartKey] || itemNotes[line.product.id] || "",
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
  }, [cart, totals, table, customerData, onOrderSentToKitchen, kitchenOrders, itemNotes, rushMode, showToast]);

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
  const executeCheckout = React.useCallback(async (withPrint = false) => {
    setShowPreCheckout(false);
    if (!billing?.createInvoice) {
      showToast("Billing service not available", "error");
      return;
    }

    setSaving(true);
    try {
      // Merge cart + kitchen order items (skip voided items)
      const allItems = [...cart];
      kitchenOrders.forEach(order => {
        (order.items || order.lines || []).forEach(line => {
          if (line.cancelled) return;
          const lineKey = line.cartKey || line.product?.id;
          const existing = allItems.findIndex(i => (i.cartKey || i.product?.id) === lineKey);
          if (existing >= 0) {
            allItems[existing] = { ...allItems[existing], qty: (allItems[existing].qty || 1) + (line.qty || 1) };
          } else {
            allItems.push({ cartKey: lineKey, product: line.product, qty: line.qty || 1, addons: line.addons || [], addonTotal: line.addonTotal || 0, note: line.note || "" });
          }
        });
      });

      // Build payments array based on mode
      let paymentsArr;
      let paymentStatus = "paid";
      let dueAmount = 0;

      if (coPayment === "split") {
        paymentsArr = splitRows
          .filter(r => r.amount && Number(r.amount) > 0)
          .map(r => ({
            method: { cash: "Cash", card: "Card / POS", upi: "UPI", other: "Other" }[r.method] || r.method,
            amount: Number(r.amount),
          }));
      } else if (coPayment === "credit") {
        const adv = Number(creditAdvance) || 0;
        dueAmount = finalGrand - adv;
        paymentStatus = dueAmount > 0 ? "credit" : "paid";
        paymentsArr = [];
        if (adv > 0)       paymentsArr.push({ method: "Advance", amount: adv });
        if (dueAmount > 0) paymentsArr.push({ method: "Credit",  amount: dueAmount, dueDate: creditDueDate || null });
      } else {
        const payMethodLabel = { cash: "Cash", card: "Card / POS", upi: "UPI", other: "Other" }[coPayment] || "Cash";
        paymentsArr = [{ method: payMethodLabel, amount: finalGrand }];
      }

      const payDisplayLabel = coPayment === "split" ? "Split" : coPayment === "credit" ? "Credit" :
        ({ cash: "Cash", card: "Card / POS", upi: "UPI", other: "Other" }[coPayment] || "Cash");

      const mergedCustomer = coCustomer.name || coCustomer.phone
        ? { name: coCustomer.name || customerData?.name || "Guest", phone: coCustomer.phone || customerData?.phone || "" }
        : customerData || { name: "Guest" };

      // Append ad-hoc lines
      coAdhocLines.forEach((l, i) => {
        if (!l.name || !Number(l.price)) return;
        allItems.push({ cartKey: `adhoc_${i}_${l.name}`, product: { name: l.name, price: Number(l.price) }, qty: Number(l.qty) || 1, addons: [], addonTotal: 0 });
      });

      const invoiceLines = allItems.map(line => ({
        name: line.product?.name || line.name || "Item",
        price: Number(line.product?.price || 0) + Number(line.addonTotal || 0),
        basePrice: Number(line.product?.price || 0),
        addonTotal: Number(line.addonTotal || 0),
        addons: line.addons || [],
        qty: line.qty || 1,
        quantity: line.qty || 1,
        tax: Number(line.product?.tax || 0),
        cartKey: line.cartKey,
        productId: line.product?.id,
        notes: itemNotes[line.cartKey] || line.note || "",
      }));

      const invoiceData = {
        lines: invoiceLines,
        totals: {
          subTotal: +(checkoutTotal.subTotal + adhocSubTotal).toFixed(2),
          tax: finalTax,
          extraCharge: finalExtra,
          extraLabel: coExtraLabel || "Service Charge",
          discount: finalDiscount,
          discountLabel: coDiscountLabel || "Discount",
          grandTotal: finalGrand,
        },
        customer: mergedCustomer,
        payments: paymentsArr,
        paymentStatus,
        dueAmount: dueAmount > 0 ? dueAmount : 0,
        mode: "POS",
        meta: {
          source: "restaurant-pos",
          tableId: table?.id,
          tableName: tableData.name || `Table ${tableData.number}`,
          tableZone: tableData.zone || "Main",
          tableCapacity: tableData.capacity,
          paymentMethod: payDisplayLabel,
          businessName: bizData.bizName || posData.posSettings?.business?.name || billing?.businessInfo?.name || "",
          businessAddress: [bizData.bizAddress, bizData.bizCity].filter(Boolean).join(", ") || posData.posSettings?.business?.address || "",
          gstNumber: bizData.bizGST || posData.posSettings?.business?.gstNumber || "",
          fssaiNumber: bizData.bizFSSAI || posData.posSettings?.business?.fssaiNumber || "",
          panNumber: bizData.bizPAN || posData.posSettings?.business?.panNumber || "",
          invoicePrefix: posData.posSettings?.invoice?.prefix || "INV",
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

      // Free the table (even for credit — table is free, payment is due)
      if (table?.id) {
        await updateDoc(doc(db, "businesses", uid, "tables", table.id), {
          status: "available", updatedAt: Date.now(),
        });
      }

      setCart([]);

      setReceiptData({
        invoiceId,
        tableName: tableData.name || `Table ${tableData.number}`,
        tableZone: tableData.zone || "Main",
        tableCapacity: tableData.capacity || 4,
        customerName: (coCustomer.name || customerData?.name) || "Guest",
        customerPhone: coCustomer.phone || customerData?.phone || "",
        paymentMethod: payDisplayLabel,
        payments: paymentsArr,
        paymentStatus,
        dueAmount,
        servedBy: coStaff ? `${coStaff.name} (${coStaff.role})` : null,
        items: allItems,
        totals: { subTotal: +(checkoutTotal.subTotal + adhocSubTotal).toFixed(2), tax: finalTax, extraCharge: finalExtra, extraLabel: coExtraLabel || "Service Charge", discount: finalDiscount, discountLabel: coDiscountLabel || "Discount", grandTotal: finalGrand },
        timestamp: Date.now(),
        type: "checkout",
      });
      setShowReceipt(true);
      if (withPrint) {
        const printHtml = generateInvoice({
          invoiceId,
          items: invoiceLines.map(l => ({ name: l.name, price: l.price, qty: l.qty, addons: l.addons, notes: l.notes, product: { name: l.name, price: l.price } })),
          totals: invoiceData.totals,
          customer: mergedCustomer,
          tableName: tableData.name || `Table ${tableData.number}`,
          tableZone: tableData.zone || "Main",
          paymentMethod: payDisplayLabel,
          businessName: bizData.bizName || invoiceData.meta.businessName,
          businessAddress: [bizData.bizAddress, bizData.bizCity].filter(Boolean).join(", ") || invoiceData.meta.businessAddress,
          gstNumber: bizData.bizGST || invoiceData.meta.gstNumber,
          fssaiNumber: bizData.bizFSSAI || invoiceData.meta.fssaiNumber,
          logoUrl: bizData.bizLogo || "",
          servedBy: coStaff ? `${coStaff.name} (${coStaff.role})` : null,
          timestamp: Date.now(),
        });
        printThermalContent(printHtml, `Invoice ${invoiceId}`);
      }
    } catch (error) {
      console.error("Error during checkout:", error);
      showToast("Failed to create invoice", "error");
    } finally {
      setSaving(false);
    }
  }, [cart, customerData, table, tableData, billing, kitchenOrders, checkoutTotal, adhocSubTotal, finalTax, finalExtra, finalDiscount, finalGrand, coPayment, splitRows, creditAdvance, coCustomer, coStaff, coAdhocLines, coExtraLabel, coDiscountLabel, coDiscount, bizData, itemNotes, showToast]);

  const selectedCategory = posData.categories.find(c => c.id === selectedCategoryId);
  const hasActiveOrders = kitchenOrders.length > 0;
  const activeOrder = kitchenOrders.find(o => o.id === activeOrderId);

  // Compile all items ordered across all kitchen orders for the summary (excluding voided)
  const allOrderedItems = React.useMemo(() => {
    const map = {};
    kitchenOrders.forEach(order => {
      (order.items || order.lines || []).forEach(line => {
        if (line.cancelled) return;
        const id = line.cartKey || line.product?.id || line.name || line.product?.name;
        const name = line.product?.name || line.product?.productName || line.name || "Item";
        const price = Number(line.product?.price || 0) + Number(line.addonTotal || 0);
        const qty = line.qty || line.quantity || 1;
        if (map[id]) { map[id].qty += qty; }
        else { map[id] = { name, price, qty, addons: line.addons || [] }; }
      });
    });
    return Object.values(map);
  }, [kitchenOrders]);

  const orderSummaryTotal = allOrderedItems.reduce((sum, it) => sum + it.price * it.qty, 0);

  // Build combined item list for pre-checkout preview (excluding voided)
  const preCheckoutItems = React.useMemo(() => {
    const items = [];
    const addLine = (cartKey, name, price, qty, addons, addonTotal, note) => {
      const key = cartKey || name;
      const idx = items.findIndex(i => i.cartKey === key);
      if (idx >= 0) { items[idx].qty += qty; }
      else items.push({ cartKey: key, name, price, addonTotal: Number(addonTotal) || 0, addons: addons || [], qty, note: note || "" });
    };
    kitchenOrders.forEach(order => {
      (order.items || order.lines || []).forEach(line => {
        if (line.cancelled) return;
        addLine(
          line.cartKey || line.product?.id || line.name,
          line.product?.name || line.name || "Item",
          Number(line.product?.price || 0),
          line.qty || 1,
          line.addons || [],
          line.addonTotal || 0,
          line.note || ""
        );
      });
    });
    cart.forEach(line => {
      addLine(
        line.cartKey || line.product?.id,
        line.product?.name || "Item",
        Number(line.product?.price || 0),
        line.qty || 1,
        line.addons || [],
        line.addonTotal || 0,
        ""
      );
    });
    return items;
  }, [kitchenOrders, cart]);

  // Show loading state for menu data
  if (posData.loading) {
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
  if (posData.error) {
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
          <div className={`text-sm mb-6 ${tc.textSub}`}>{posData.error}</div>
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
              {posData.categories.map(cat => (
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
                const cartLines = cart.filter(line => line.product.id === item.id);
                const qty = cartLines.reduce((sum, l) => sum + l.qty, 0);
                const isVeg = normalizeType(item.type) === "veg";

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.18 }}
                    whileHover={{ y: -1 }}
                    className={`relative rounded-2xl border overflow-hidden cursor-pointer transition-all group ${tc.cardBg} ${
                      qty > 0
                        ? "border-orange-500/30 shadow-[0_0_0_1px_rgba(249,115,22,0.15)]"
                        : "hover:border-white/15"
                    }`}
                  >
                    {/* Image */}
                    {item.image ? (
                      <div className="relative w-full h-28 overflow-hidden">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => (e.currentTarget.parentElement.style.display = "none")}
                        />
                        {/* Veg/NonVeg on image */}
                        <div className="absolute top-2 left-2">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center bg-black/50 backdrop-blur-sm ${
                            isVeg ? "border-emerald-400" : "border-red-400"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? "bg-emerald-400" : "bg-red-400"}`} />
                          </div>
                        </div>
                        {qty > 0 && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg">
                            {qty}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-16 flex items-center justify-between px-3 bg-white/[0.02] relative">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                          isVeg ? "border-emerald-500 bg-emerald-900/20" : "border-red-500 bg-red-900/20"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? "bg-emerald-400" : "bg-red-400"}`} />
                        </div>
                        <span className="text-3xl opacity-10">🍽️</span>
                        {qty > 0 && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg">
                            {qty}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-3">
                      {/* Name */}
                      <p className={`text-[12px] font-bold leading-tight mb-1 line-clamp-2 ${tc.textPrimary}`}>{item.name}</p>
                      {(item.addonGroups || []).length > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/25 text-purple-300 text-[8px] font-bold mb-1">🧩 Customizable</span>
                      )}

                      {/* Price + Tax */}
                      <div className="flex items-end justify-between mb-2.5">
                        <span className={`text-base font-black ${tc.textPrimary}`}>₹{item.price}</span>
                        {item.tax > 0 && (
                          <span className={`text-[9px] ${tc.textMuted}`}>+{item.tax}% GST</span>
                        )}
                      </div>

                      {/* Add / Qty control */}
                      {qty > 0 ? (
                        <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/25 rounded-xl px-1.5 py-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); const entries = cart.filter(l => l.product.id === item.id); if (entries.length > 0) { const last = entries[entries.length - 1]; updateQty(last.cartKey, last.qty - 1); } }}
                            className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-black flex items-center justify-center transition"
                          >−</button>
                          <span className={`flex-1 text-center text-sm font-black text-orange-300`}>{qty}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); if ((item.addonGroups || []).length > 0) { setAddonModalItem(item); setShowAddonModal(true); } else { const entry = cart.find(l => l.cartKey === item.id); if (entry) updateQty(item.id, entry.qty + 1); else addToCart(item, 1); } }}
                            className="w-6 h-6 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-black flex items-center justify-center transition shadow-sm shadow-orange-500/30"
                          >+</button>
                        </div>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { if ((item.addonGroups || []).length > 0) { setAddonModalItem(item); setShowAddonModal(true); } else { addToCart(item, 1); } }}
                          className="w-full py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold text-xs transition shadow-md shadow-orange-500/20 flex items-center justify-center gap-1"
                        >
                          <span className="text-sm leading-none">+</span> Add
                        </motion.button>
                      )}
                    </div>
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
          {kitchenOrders.length > 0 && (
            <div className={`shrink-0 border-b ${tc.borderSoft}`}>
              <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-widest ${tc.textMuted}`}>Orders on Table</span>
                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-500/20 text-red-300 font-bold">{kitchenOrders.length}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={printOrderSummary}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition"
                    title="Print order summary for kitchen/server"
                  >
                    🖨️ Print
                  </button>
                  {kitchenOrders.length > 1 && (
                    <button
                      onClick={repeatLastRound}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 transition"
                      title="Add last round's items to cart again"
                    >
                      🔁 Repeat
                    </button>
                  )}
                </div>
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
                          <span className="text-[10px] opacity-40">{new Date(order.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold opacity-60">{statusLabels[order.status] || order.status}</span>
                          <span className="text-[9px] opacity-40" style={{ display:"inline-block", transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)" }}>▼</span>
                        </div>
                      </div>
                      {!isCollapsed && orderItems.length > 0 && (
                        <div className={`px-2.5 pb-2 space-y-0.5 border-t ${tc.borderSoft}`}>
                          {orderItems.map((line, idx) => (
                            <div key={idx} className={`flex items-center justify-between text-[11px] py-0.5 ${line.cancelled ? "opacity-40" : ""}`}>
                              <span className={`truncate flex-1 ${tc.textSub} ${line.cancelled ? "line-through" : "opacity-80"}`}>{line.product?.name || line.name || "Item"}</span>
                              {line.cancelled && <span className="text-[8px] text-red-400/60 font-bold mx-1">VOID</span>}
                              {!line.cancelled && line.note && <span className="text-orange-300/70 italic text-[10px] mx-1 truncate max-w-[60px]">{line.note}</span>}
                              <span className={`ml-2 flex-none ${line.cancelled ? "line-through" : "opacity-60"}`}>×{line.qty || 1}</span>
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
            {cart.map(line => {
              const lineTotal = (Number(line.product.price || 0) + Number(line.addonTotal || 0)) * line.qty;
              return (
              <div key={line.cartKey} className={`rounded-xl border px-3 py-2.5 ${tc.cardBg}`}>
                {/* Row 1: Name + delete */}
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-xs font-semibold leading-snug ${tc.textPrimary}`}>{line.product.name}</p>
                  <button onClick={() => removeFromCart(line.cartKey)}
                    className="w-5 h-5 rounded-md bg-red-500/20 hover:bg-red-500/35 text-red-400 text-xs font-bold flex items-center justify-center transition shrink-0 mt-0.5">×</button>
                </div>
                {/* Addon badges */}
                {(line.addons || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {line.addons.map((a, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/25 text-orange-300 text-[9px] font-medium">
                        +{a.name}{Number(a.price) > 0 ? ` ₹${Number(a.price).toFixed(0)}` : ""}
                      </span>
                    ))}
                  </div>
                )}
                {/* Row 2: Price + qty controls */}
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <span className={`text-[11px] ${tc.textMuted}`}>₹{(Number(line.product.price || 0) + Number(line.addonTotal || 0)).toFixed(0)} × {line.qty} = ₹{lineTotal.toFixed(0)}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setCustomizeCartKey(line.cartKey)}
                      className="w-6 h-6 rounded-md text-[10px] flex items-center justify-center transition bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/20 text-purple-300"
                      title="Customize"
                    >🎛️</button>
                    <button
                      onClick={() => setShowNoteFor(n => n === line.cartKey ? null : line.cartKey)}
                      className={`w-6 h-6 rounded-md text-[10px] flex items-center justify-center transition ${
                        itemNotes[line.cartKey] ? "bg-orange-500/25 text-orange-300" : "bg-white/8 hover:bg-white/15 text-white/35 hover:text-white/60"
                      }`}
                      title="Note"
                    >📝</button>
                    <div className={`flex items-center rounded-lg border ${tc.borderSoft} overflow-hidden`}>
                      <button onClick={() => updateQty(line.cartKey, line.qty - 1)}
                        className={`w-6 h-6 text-sm font-bold flex items-center justify-center transition hover:bg-white/15 ${tc.textPrimary}`}>−</button>
                      <span className={`w-6 text-center text-xs font-black ${tc.textPrimary}`}>{line.qty}</span>
                      <button onClick={() => updateQty(line.cartKey, line.qty + 1)}
                        className={`w-6 h-6 text-sm font-bold flex items-center justify-center transition hover:bg-white/15 ${tc.textPrimary}`}>+</button>
                    </div>
                  </div>
                </div>
                {showNoteFor === line.cartKey && (
                  <input
                    autoFocus
                    value={itemNotes[line.cartKey] || ""}
                    onChange={e => setItemNotes(n => ({ ...n, [line.cartKey]: e.target.value }))}
                    placeholder="e.g. No onion, extra spicy..."
                    className="mt-1.5 w-full px-2 py-1 rounded-lg border border-orange-500/30 bg-orange-500/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                    onKeyDown={e => e.key === "Enter" && setShowNoteFor(null)}
                  />
                )}
                {itemNotes[line.cartKey] && showNoteFor !== line.cartKey && (
                  <div className="mt-1 text-[10px] text-orange-300/80 italic pl-1">📝 {itemNotes[line.cartKey]}</div>
                )}
              </div>
              );
            })}
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
                <div className="flex gap-2">
                  <button
                    onClick={printKOT}
                    disabled={cart.length === 0}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${tc.outlineBtn} disabled:opacity-40`}
                    title="Print KOT before sending to kitchen"
                  >🖨️ Print KOT</button>
                  <button
                    onClick={() => { setCart([]); setItemNotes({}); setShowNoteFor(null); }}
                    className={`flex-1 py-1.5 rounded-lg text-xs transition ${tc.outlineBtn}`}
                  >Clear cart</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Addon Picker Modal */}
      <AnimatePresence>
        {showAddonModal && addonModalItem && (
          <AddonPickerModal
            item={addonModalItem}
            tc={tc}
            onClose={() => { setShowAddonModal(false); setAddonModalItem(null); }}
            onConfirm={({ addons, addonTotal, cartKey }) => {
              addToCart(addonModalItem, 1, addons, addonTotal, cartKey);
              setShowAddonModal(false);
              setAddonModalItem(null);
              showToast(`🧩 ${addonModalItem.name} added with add-ons!`);
            }}
          />
        )}
      </AnimatePresence>

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
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className={`w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col max-h-[88vh] backdrop-blur-xl overflow-hidden ${tc.modalBg}`}
          >
            {/* ── Header ── */}
            <div className={`px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${tc.borderSoft}`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-500/25 flex items-center justify-center text-base">🧾</div>
                <div>
                  <div className={`text-sm font-bold leading-tight ${tc.textPrimary}`}>
                    Checkout — {tableData.name || (tableData.number ? `Table ${tableData.number}` : "Walk-in Order")}
                  </div>
                  <div className={`text-[10px] ${tc.textMuted}`}>
                    {tableData.zone || "Main"} · {preCheckoutItems.length} item{preCheckoutItems.length !== 1 ? "s" : ""} · ₹{money(finalGrand)} due
                  </div>
                </div>
              </div>
              <button onClick={() => setShowPreCheckout(false)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${tc.editBtn}`}>✕</button>
            </div>

            {/* ── 2-column body ── */}
            <div className="flex-1 min-h-0 flex overflow-hidden">

              {/* ═══ LEFT COLUMN — order summary ═══ */}
              <div className={`w-[42%] flex flex-col border-r ${tc.borderSoft} min-h-0`}>
                {/* Items scrollable */}
                <div className={`px-4 pt-3 pb-1 flex items-center justify-between shrink-0`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${tc.textMuted}`}>Order</span>
                  <span className={`text-[10px] font-semibold ${tc.textMuted}`}>{preCheckoutItems.length} items</span>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1.5 min-h-0">
                  {preCheckoutItems.map((item, idx) => {
                    const unitPrice = item.price + (item.addonTotal || 0);
                    const lineTotal = unitPrice * item.qty;
                    return (
                    <div key={idx} className={`px-2.5 py-2 rounded-xl ${tc.mutedBg}`}>
                      <div className="flex items-start gap-2">
                        <div className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center flex-none border shrink-0 mt-0.5 ${tc.borderSoft} ${tc.textPrimary}`}>{item.qty}</div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-semibold leading-snug ${tc.textPrimary}`}>{item.name}</div>
                          {(item.addons || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {item.addons.map((a, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/25 text-orange-300 text-[8px] font-medium">
                                  +{a.name}{Number(a.price) > 0 ? ` ₹${Number(a.price).toFixed(0)}` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.note && <p className="text-[9px] italic text-amber-300/60 mt-0.5 leading-tight">📝 {item.note}</p>}
                          <div className={`text-[10px] mt-0.5 ${tc.textMuted}`}>₹{unitPrice.toFixed(0)} × {item.qty}</div>
                        </div>
                        <div className={`text-xs font-bold flex-none shrink-0 ${tc.textSub}`}>₹{lineTotal.toFixed(0)}</div>
                      </div>
                    </div>
                    );
                  })}
                  {preCheckoutItems.length === 0 && (
                    <div className={`text-xs text-center py-6 ${tc.textMuted}`}>No items</div>
                  )}
                </div>

                {/* ── Quick-Add section ── */}
                <div className={`px-3 pb-2 border-t shrink-0 ${tc.borderSoft}`}>
                  <div className={`text-[9px] font-bold uppercase tracking-widest mt-2 mb-1.5 ${tc.textMuted}`}>Quick Add</div>
                  {coAdhocLines.map((l, i) => (
                    <div key={i} className="flex items-center gap-1.5 mb-1">
                      <div className="flex-1 min-w-0">
                        <span className={`text-[11px] font-semibold ${tc.textPrimary}`}>{l.name}</span>
                        <span className={`text-[10px] ml-1 ${tc.textMuted}`}>₹{l.price} ×{l.qty}</span>
                      </div>
                      <span className="text-[11px] font-bold text-amber-300">₹{(l.price * l.qty).toFixed(0)}</span>
                      <button onClick={() => setCoAdhocLines(p => p.filter((_, j) => j !== i))}
                        className="w-4 h-4 rounded bg-red-500/20 text-red-400 text-[8px] flex items-center justify-center shrink-0 hover:bg-red-500/40 transition">✕</button>
                    </div>
                  ))}
                  <div className="flex gap-1">
                    <input value={coAdhocInput.name} onChange={e => setCoAdhocInput(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Water Bottle" onKeyDown={e => { if (e.key === 'Enter') e.target.nextSibling?.focus(); }}
                      className={`flex-1 min-w-0 px-2 py-1 rounded-lg text-[10px] focus:outline-none ${tc.inputBg}`} />
                    <input value={coAdhocInput.price} onChange={e => setCoAdhocInput(p => ({ ...p, price: e.target.value }))}
                      type="number" placeholder="₹" min="0"
                      onKeyDown={e => { if (e.key === 'Enter') { if (coAdhocInput.name.trim() && Number(coAdhocInput.price) > 0) { setCoAdhocLines(p => [...p, { name: coAdhocInput.name.trim(), price: Number(coAdhocInput.price), qty: 1 }]); setCoAdhocInput({ name: '', price: '' }); } }}}
                      className={`w-16 px-2 py-1 rounded-lg text-[10px] focus:outline-none ${tc.inputBg}`} />
                    <button onClick={() => { if (!coAdhocInput.name.trim() || !Number(coAdhocInput.price)) return; setCoAdhocLines(p => [...p, { name: coAdhocInput.name.trim(), price: Number(coAdhocInput.price), qty: 1 }]); setCoAdhocInput({ name: '', price: '' }); }}
                      className="px-2 py-1 rounded-lg text-[9px] font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 transition whitespace-nowrap">+Add</button>
                  </div>
                </div>

                {/* Bill summary pinned to bottom of left col */}
                <div className={`px-4 py-3 border-t space-y-1 shrink-0 ${tc.borderSoft}`}>
                  <div className={`flex justify-between text-[11px] ${tc.textSub}`}><span>Subtotal</span><span>₹{money(checkoutTotal.subTotal + adhocSubTotal)}</span></div>
                  <div className={`flex justify-between text-[11px] ${tc.textSub}`}><span>Tax / GST</span><span>₹{money(finalTax)}</span></div>
                  {finalExtra > 0 && <div className={`flex justify-between text-[11px] ${tc.textSub}`}><span>{coExtraLabel || "Extra"}</span><span>₹{money(finalExtra)}</span></div>}
                  {finalDiscount > 0 && <div className="flex justify-between text-[11px] text-red-400/70"><span>{coDiscountLabel || "Discount"}</span><span>−₹{money(finalDiscount)}</span></div>}
                  <div className={`flex justify-between font-bold pt-1.5 mt-0.5 border-t ${tc.borderSoft}`}>
                    <span className={`text-sm ${tc.textPrimary}`}>Total</span>
                    <span className="text-emerald-400 text-base">₹{money(finalGrand)}</span>
                  </div>
                  <div className={`flex justify-between text-[10px] ${tc.textMuted}`}>
                    <span>Via</span>
                    <span className={coPayment === "credit" ? "text-red-400 font-bold" : coPayment === "split" ? "text-amber-400 font-bold" : ""}>
                      {{ cash: "Cash", card: "Card / POS", upi: "UPI", other: "Other", split: "Split", credit: "Credit (Due)" }[coPayment]}
                    </span>
                  </div>
                  {coPayment === "credit" && (() => { const due = finalGrand - (Number(creditAdvance)||0); return due > 0 ? (
                    <div className="flex justify-between text-[10px]">
                      <span className={tc.textMuted}>Due</span>
                      <span className="text-red-400 font-bold">₹{money(due)}</span>
                    </div>
                  ) : null; })()}
                </div>
              </div>

              {/* ═══ RIGHT COLUMN — config ═══ */}
              <div className="flex-1 flex flex-col overflow-y-auto min-h-0">

                {/* Customer */}
                <div className={`px-4 py-3 border-b ${tc.borderSoft}`}>
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${tc.textMuted}`}>Customer</div>
                  <input value={coCustomer.name} onChange={e => setCoCustomer(p => ({ ...p, name: e.target.value }))}
                    placeholder="Name (optional)" className={`w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/40 mb-1.5 ${tc.inputBg}`} />
                  <div className="flex gap-1.5">
                    <input value={coCustomer.phone} onChange={e => setCoCustomer(p => ({ ...p, phone: e.target.value }))}
                      type="tel" placeholder="Phone" className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/40 ${tc.inputBg}`} />
                    <button onClick={() => setCoCustomer({ name: "Guest", phone: "" })}
                      className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] transition ${tc.outlineBtn}`}>Guest</button>
                  </div>
                </div>

                {/* Tax / Adjustments */}
                <div className={`px-4 py-3 border-b ${tc.borderSoft}`}>
                  {/* Row 1: toggle + tax amount */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`flex p-0.5 rounded-lg gap-0.5 ${tc.mutedBg}`}>
                      <button onClick={() => setCoTaxMode("auto")}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${coTaxMode === "auto" ? "bg-emerald-500/30 text-emerald-300" : tc.textMuted}`}>⚡ Auto</button>
                      <button onClick={() => setCoTaxMode("manual")}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition ${coTaxMode === "manual" ? "bg-amber-500/30 text-amber-300" : tc.textMuted}`}>✏️ Manual</button>
                    </div>
                    <span className="ml-auto text-xs font-bold text-emerald-400">₹{money(finalTax)}</span>
                  </div>
                  {/* Row 2 (manual only): input + preset buttons */}
                  {coTaxMode === "manual" && (
                    <div className="flex items-center gap-1.5">
                      <div className="relative w-16 shrink-0">
                        <input value={coTaxPct} onChange={e => setCoTaxPct(e.target.value.replace(/[^0-9.]/g, ""))}
                          type="text" inputMode="decimal" placeholder="0"
                          className="w-full px-2 py-1 pr-5 rounded-lg text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 focus:outline-none" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-amber-400">%</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {["0","5","12","18","28"].map(v => (
                          <button key={v} onClick={() => setCoTaxPct(v)}
                            className={`px-2 py-1 rounded-md text-[9px] font-bold transition ${coTaxPct === v ? "bg-amber-500 text-white" : `${tc.mutedBg} ${tc.textMuted} hover:bg-white/10`}`}>{v}%</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Service Charge row */}
                  <div className="flex gap-1.5 mt-2">
                    <input value={coExtraLabel} onChange={e => setCoExtraLabel(e.target.value)} placeholder="Service Charge"
                      className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-[11px] focus:outline-none ${tc.inputBg}`} />
                    <div className="relative w-20 shrink-0">
                      <input value={coExtraAmt} onChange={e => setCoExtraAmt(e.target.value)} type="number" min="0" placeholder="0"
                        className={`w-full px-2.5 py-1.5 pr-5 rounded-lg text-[11px] focus:outline-none ${tc.inputBg}`} />
                      <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[9px] ${tc.textMuted}`}>+₹</span>
                    </div>
                  </div>
                  {/* Discount row */}
                  <div className="flex gap-1.5 mt-1.5">
                    <input value={coDiscountLabel} onChange={e => setCoDiscountLabel(e.target.value)} placeholder="Discount reason"
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-[11px] text-red-300 bg-red-500/[0.06] border border-red-500/15 focus:outline-none focus:border-red-500/30" />
                    <div className="relative w-20 shrink-0">
                      <input value={coDiscount} onChange={e => setCoDiscount(e.target.value)} type="number" min="0" placeholder="0"
                        className="w-full px-2.5 py-1.5 pr-5 rounded-lg text-[11px] text-red-300 bg-red-500/8 border border-red-500/20 focus:outline-none" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-red-400">−₹</span>
                    </div>
                  </div>
                </div>

                {/* Staff picker (compact) */}
                {posData.posStaff.length > 0 && (
                  <div className={`px-4 py-2.5 border-b ${tc.borderSoft}`}>
                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${tc.textMuted}`}>Served by</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {posData.posStaff.map(s => {
                        const isSelected = coStaff?.id === s.id;
                        const initials = (s.name || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                        return (
                          <button key={s.id} onClick={() => setCoStaff(isSelected ? null : { id: s.id, name: s.name, role: s.role })}
                            className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-lg border text-xs transition ${
                              isSelected ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200" : `${tc.cardBg} ${tc.borderSoft} ${tc.textSub} hover:bg-white/[0.06]`
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black text-white flex-none ${isSelected ? "bg-emerald-500" : "bg-gradient-to-br from-slate-500 to-gray-600"}`}>{initials}</div>
                            <span className="text-[10px] font-semibold">{s.name.split(" ")[0]}</span>
                            {isSelected && <span className="text-emerald-400 text-[9px]">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Payment method */}
                <div className={`px-4 py-3 border-b ${tc.borderSoft}`}>
                  <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${tc.textMuted}`}>Payment</div>
                  {/* 6 pills in 2 rows of 3 */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: "cash",   icon: "💵", label: "Cash" },
                      { key: "card",   icon: "💳", label: "Card" },
                      { key: "upi",    icon: "📲", label: "UPI" },
                      { key: "other",  icon: "🔄", label: "Other" },
                      { key: "split",  icon: "✂️", label: "Split" },
                      { key: "credit", icon: "📋", label: "Credit" },
                    ].map(pm => (
                      <button key={pm.key} onClick={() => setCoPayment(pm.key)}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-center transition ${
                          coPayment === pm.key
                            ? pm.key === "credit" ? "border-red-500/60 bg-red-500/15 text-red-300"
                            : pm.key === "split"  ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                            :                       "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                            : `${tc.cardBg} ${tc.borderSoft} ${tc.textMuted} hover:bg-white/[0.07]`
                        }`}
                      >
                        <span className="text-sm">{pm.icon}</span>
                        <span className="text-[10px] font-semibold">{pm.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Split rows */}
                  {coPayment === "split" && (
                    <div className="mt-2.5 space-y-1.5">
                      <div className={`text-[10px] ${tc.textMuted}`}>Split ₹{money(finalGrand)} across modes</div>
                      {splitRows.map((row, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <select value={row.method}
                            onChange={e => setSplitRows(prev => prev.map((r, j) => j === i ? { ...r, method: e.target.value } : r))}
                            className={`flex-none w-24 px-2 py-1.5 rounded-lg text-[11px] focus:outline-none ${tc.inputBg}`}>
                            <option value="cash">Cash</option>
                            <option value="card">Card/POS</option>
                            <option value="upi">UPI</option>
                            <option value="other">Other</option>
                          </select>
                          <input type="number" min="0" placeholder="₹ Amount" value={row.amount}
                            onChange={e => setSplitRows(prev => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] focus:outline-none ${tc.inputBg}`} />
                          {splitRows.length > 2 && (
                            <button onClick={() => setSplitRows(prev => prev.filter((_, j) => j !== i))}
                              className="w-5 h-5 rounded-md bg-red-500/15 text-red-400 text-[9px] flex items-center justify-center shrink-0">✕</button>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-0.5">
                        <button onClick={() => setSplitRows(prev => [...prev, { method: "cash", amount: "" }])}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${tc.mutedBg} ${tc.textMuted} hover:bg-white/10 transition`}>+ Mode</button>
                        {(() => { const tot = splitRows.reduce((s,r) => s + (Number(r.amount)||0), 0); const diff = finalGrand - tot;
                          return diff !== 0 ? <span className="text-[10px] text-amber-400">₹{money(Math.abs(diff))} {diff > 0 ? "under" : "over"}</span> : <span className="text-[10px] text-emerald-400">✓ Balanced</span>; })()}
                      </div>
                    </div>
                  )}

                  {/* Credit panel */}
                  {coPayment === "credit" && (
                    <div className={`mt-2.5 rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-2`}>
                      <div className="flex items-center gap-1.5 text-red-400">
                        <span className="text-sm">📋</span>
                        <span className="text-[10px] font-bold">Invoice marked as Credit / Due</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className={`text-[9px] mb-1 ${tc.textMuted}`}>Advance paid (optional)</div>
                          <input type="number" min="0" max={finalGrand} placeholder="₹ 0" value={creditAdvance}
                            onChange={e => setCreditAdvance(e.target.value)}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] focus:outline-none ${tc.inputBg}`} />
                        </div>
                        <div>
                          <div className={`text-[9px] mb-1 ${tc.textMuted}`}>Due date</div>
                          <input type="date" value={creditDueDate} onChange={e => setCreditDueDate(e.target.value)}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] focus:outline-none ${tc.inputBg}`} />
                        </div>
                      </div>
                      {(finalGrand - (Number(creditAdvance)||0)) > 0 && (
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={tc.textMuted}>Due amount</span>
                          <span className="text-red-400 font-bold">₹{money(finalGrand - (Number(creditAdvance)||0))}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Confirm ── */}
            <div className={`px-5 py-3.5 border-t flex gap-2 shrink-0 ${tc.borderSoft}`}>
              <button onClick={() => setShowPreCheckout(false)} disabled={saving}
                className={`flex-none px-4 py-2.5 rounded-xl text-sm transition ${tc.outlineBtn}`}>Cancel</button>
              <button
                onClick={() => executeCheckout(true)}
                disabled={saving}
                title="Checkout and immediately print receipt"
                className="flex-none px-4 py-2.5 rounded-xl text-sm font-bold border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? "⏳" : "🖨️"} Print
              </button>
              <button onClick={() => executeCheckout(false)} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-bold shadow-lg transition disabled:opacity-50">
                {saving ? "⏳ Processing…" : `💳 Confirm — ₹${money(finalGrand)}`}
              </button>
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
              {receiptData.servedBy && (
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-white/40">Served By</div>
                  <div className="text-xs font-semibold text-sky-300">{receiptData.servedBy}</div>
                </div>
              )}
            </div>
            {/* Items */}
            <div className="px-6 py-4 max-h-72 overflow-y-auto space-y-2" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.2) transparent" }}>
              <AnimatePresence>
                {receiptData.items.map((item, idx) => {
                  const name  = item.product?.name || item.name;
                  const basePrice = Number(item.product?.price || item.price || 0);
                  const addonTotal = Number(item.addonTotal || 0);
                  const unitPrice = basePrice + addonTotal;
                  const qty = item.qty || 1;
                  const addons = item.addons || [];
                  const notes = item.notes || "";
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.05, type: "spring", stiffness: 300, damping: 24 }}
                      className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <motion.div
                            initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                            className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/20 text-[11px] font-bold text-emerald-300 flex items-center justify-center flex-none mt-0.5"
                          >{qty}</motion.div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-white/90">{name}</div>
                            {addons.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {addons.map((a, i) => (
                                  <span key={i} className="px-1.5 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/20 text-orange-300 text-[9px] font-medium">
                                    +{a.name}{Number(a.price) > 0 ? ` ₹${Number(a.price).toFixed(0)}` : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                            {notes && (
                              <div className="text-[10px] text-amber-300/70 italic mt-0.5">📝 {notes}</div>
                            )}
                            <div className="text-[11px] text-white/40 mt-0.5">₹{unitPrice.toFixed(0)} × {qty}</div>
                          </div>
                        </div>
                        <div className="text-sm font-bold text-emerald-400 flex-none">₹{(unitPrice * qty).toFixed(2)}</div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            {/* Bill breakdown */}
            <div className="px-5 py-3 border-t border-white/[0.07] bg-white/[0.02] space-y-1">
              <div className="flex justify-between text-xs text-white/40"><span>Subtotal</span><span>₹{money(receiptData.totals.subTotal)}</span></div>
              {receiptData.totals.tax > 0 && <div className="flex justify-between text-xs text-white/40"><span>Tax / GST</span><span>₹{money(receiptData.totals.tax)}</span></div>}
              {receiptData.totals.extraCharge > 0 && <div className="flex justify-between text-xs text-white/40"><span>{receiptData.totals.extraLabel || "Service Charge"}</span><span>₹{money(receiptData.totals.extraCharge)}</span></div>}
              {receiptData.totals.discount > 0 && <div className="flex justify-between text-xs text-red-400/60"><span>{receiptData.totals.discountLabel || "Discount"}</span><span>−₹{money(receiptData.totals.discount)}</span></div>}
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

      {/* Quick Customize Modal */}
      <AnimatePresence>
        {customizeCartKey && (() => {
          const line = cart.find(l => l.cartKey === customizeCartKey);
          return line ? (
            <QuickCustomizeModal
              cartLine={line}
              tc={tc}
              onClose={() => setCustomizeCartKey(null)}
              onSave={(addons, addonTotal) => {
                updateCartLineAddons(customizeCartKey, addons, addonTotal);
                setCustomizeCartKey(null);
                showToast("🎛️ Customization applied!");
              }}
            />
          ) : null;
        })()}
      </AnimatePresence>

      {/* Toast Notifications — portaled to body to escape stacking context */}
      {ReactDOM.createPortal(
        <div className="fixed top-4 right-4 z-[999999] flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {toasts.map(toast => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                className={`px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold pointer-events-auto max-w-xs flex items-center gap-2.5 ${
                  toast.type === 'error'
                    ? 'bg-red-600 border-red-500/50 text-white shadow-red-500/25'
                    : 'bg-emerald-600 border-emerald-500/50 text-white shadow-emerald-500/25'
                }`}
              >
                <span className="text-base shrink-0">{toast.type === 'error' ? '⚠️' : '✅'}</span>
                {toast.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </div>
  );
}
