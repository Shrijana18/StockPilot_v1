/**
 * GroceryListPanelV2.jsx
 * Simple, visual grocery list tool for Restaurant POS
 * Designed for all users - even those with limited education
 * Single-screen workflow: Menu Items → Forecast → Shopping List
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from "react-dom";
import {
  collection, getDocs, query, orderBy, limit,
  doc, setDoc, getDoc, onSnapshot, deleteDoc,
} from "firebase/firestore";
import { db, auth } from "../../../firebase/firebaseConfig";
import { usePOSTheme } from "../POSThemeContext";
import {
  estimateIngredients,
  estimationConfidence,
  INGREDIENT_CATEGORIES,
} from "../../../utils/ingredientEstimator";

const getUid = () => auth.currentUser?.uid;

// ─── Simple ingredient icons ──────────────────────────────────────────────────
const INGREDIENT_ICONS = {
  "Dairy & Beverages": "🥛",
  "Grains & Flour": "🌾",
  "Vegetables": "🥬",
  "Meat & Protein": "🍗",
  "Spices & Masala": "🌶️",
  "Oils & Condiments": "🫗",
  "Sweeteners": "🍯",
  "Packaging": "📦",
  "Other": "📦",
};

// ─── Toast Portal ─────────────────────────────────────────────────────────────
function ToastPortal({ children }) {
  return ReactDOM.createPortal(children, document.body);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GroceryListPanelV2() {
  const { tc } = usePOSTheme();
  
  // State
  const [uid, setUid] = useState(() => getUid() || null);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]); // All menu items from POS
  const [invoices, setInvoices] = useState([]);
  const [ingredientConfig, setIngredientConfig] = useState({}); // { itemName: [{name, unit, qtyPerUnit, category}] }
  const [forecast, setForecast] = useState({}); // { itemName: { willSell: number, keepExtra: number } }
  const [manualItems, setManualItems] = useState([]); // Manually added shopping items
  const [toasts, setToasts] = useState([]);
  const [expandedItem, setExpandedItem] = useState(null);
  const [searchMenu, setSearchMenu] = useState("");
  const [searchShop, setSearchShop] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const [savedLists, setSavedLists] = useState([]);
  const [listName, setListName] = useState("");
  const [saving, setSaving] = useState(false);

  // Image scan
  const [showScan, setShowScan] = useState(false);
  const [scanText, setScanText] = useState("");
  const [scanPreview, setScanPreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => auth.onAuthStateChanged(u => setUid(u?.uid || null)), []);

  const showToast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // ── Load menu items from POS ──
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      try {
        const snap = await getDocs(collection(db, "businesses", uid, "items"));
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(it => it.available !== false)
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setMenuItems(items);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [uid]);

  // ── Load past 30 days invoices for smart suggestions ──
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const snap = await getDocs(
          query(collection(db, "businesses", uid, "finalizedInvoices"),
            orderBy("createdAt", "desc"), limit(500))
        );
        const filtered = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(inv => (inv.createdAt || 0) >= cutoff && (inv.lines || inv.items || []).length > 0);
        setInvoices(filtered);
      } catch (e) { console.error(e); }
    })();
  }, [uid]);

  // ── Load ingredient config ──
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const docSnap = await getDoc(doc(db, "businesses", uid, "posConfig", "groceryIngredients"));
        if (docSnap.exists()) setIngredientConfig(docSnap.data() || {});
      } catch (e) { console.error(e); }
    })();
  }, [uid]);

  // ── Load saved lists ──
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      collection(db, "businesses", uid, "groceryLists"),
      snap => setSavedLists(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return unsub;
  }, [uid]);

  // ── Save ingredient config to Firestore ──
  const saveConfig = useCallback(async (cfg) => {
    if (!uid) return;
    try {
      await setDoc(doc(db, "businesses", uid, "posConfig", "groceryIngredients"), cfg);
    } catch (e) { console.error(e); }
  }, [uid]);

  // ── Calculate sales history per item (last 30 days) ──
  const salesHistory = useMemo(() => {
    const map = {};
    for (const inv of invoices) {
      const items = inv.lines || inv.items || inv.cart || [];
      for (const line of items) {
        const name = line.product?.name || line.name || "";
        if (!name) continue;
        const qty = Number(line.qty || line.quantity || 1);
        if (!map[name]) map[name] = { totalSold: 0, avgPerDay: 0 };
        map[name].totalSold += qty;
      }
    }
    const days = Math.max(1, Math.ceil((Date.now() - Math.min(...invoices.map(i => i.createdAt || Date.now()))) / (24 * 60 * 60 * 1000)));
    Object.keys(map).forEach(name => {
      map[name].avgPerDay = parseFloat((map[name].totalSold / days).toFixed(1));
    });
    return map;
  }, [invoices]);

  // ── Auto-fill AI estimates for items without config ──
  const autoFillIngredients = useCallback((itemName) => {
    const est = estimateIngredients(itemName);
    if (est.length > 0) {
      setIngredientConfig(prev => {
        const updated = { ...prev, [itemName]: est };
        saveConfig(updated);
        return updated;
      });
      showToast(`✨ Auto-filled ingredients for ${itemName}`);
    } else {
      showToast("No auto-estimate available. Add manually.", "error");
    }
  }, [saveConfig, showToast]);

  // ── Update ingredient for an item ──
  const updateIngredients = useCallback((itemName, ings) => {
    setIngredientConfig(prev => {
      const updated = { ...prev, [itemName]: ings };
      saveConfig(updated);
      return updated;
    });
  }, [saveConfig]);

  // ── Calculate shopping list ──
  const shoppingList = useMemo(() => {
    const map = {};
    
    // From menu items with forecast
    menuItems.forEach(item => {
      const ings = ingredientConfig[item.name] || [];
      const fc = forecast[item.name] || { willSell: 0, keepExtra: 0 };
      const totalQty = fc.willSell + fc.keepExtra;
      
      if (totalQty > 0 && ings.length > 0) {
        ings.forEach(ing => {
          const key = `${ing.name}_${ing.unit}`;
          const needed = ing.qtyPerUnit * totalQty;
          if (!map[key]) {
            map[key] = { name: ing.name, unit: ing.unit, qty: 0, category: ing.category || "Other" };
          }
          map[key].qty += needed;
        });
      }
    });

    // From manual items
    manualItems.forEach(it => {
      const key = `${it.name}_${it.unit}`;
      if (!map[key]) {
        map[key] = { name: it.name, unit: it.unit, qty: 0, category: it.category || "Other" };
      }
      map[key].qty += it.qty || 0;
    });

    return Object.values(map).map(it => ({ ...it, qty: parseFloat(it.qty.toFixed(2)) }));
  }, [menuItems, ingredientConfig, forecast, manualItems]);

  // ── Group shopping list by category ──
  const groupedShoppingList = useMemo(() => {
    const groups = {};
    shoppingList.forEach(it => {
      const cat = it.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(it);
    });
    return groups;
  }, [shoppingList]);

  // ── Save list ──
  const saveList = useCallback(async () => {
    if (!uid || shoppingList.length === 0) return;
    setSaving(true);
    try {
      const name = listName.trim() || `Grocery ${new Date().toLocaleDateString("en-IN")}`;
      await setDoc(doc(db, "businesses", uid, "groceryLists", `list_${Date.now()}`), {
        name,
        items: shoppingList,
        forecast,
        createdAt: Date.now(),
      });
      showToast(`💾 Saved "${name}"`);
      setListName("");
    } catch (e) {
      console.error(e);
      showToast("Failed to save list", "error");
    } finally {
      setSaving(false);
    }
  }, [uid, shoppingList, forecast, listName, showToast]);

  // ── Delete saved list ──
  const deleteList = useCallback(async (id) => {
    if (!uid) return;
    try {
      await deleteDoc(doc(db, "businesses", uid, "groceryLists", id));
      showToast("🗑️ List deleted");
    } catch (e) {
      console.error(e);
      showToast("Failed to delete", "error");
    }
  }, [uid, showToast]);

  // ── Print shopping list ──
  const printList = useCallback(() => {
    const html = `
      <html><head><title>Shopping List</title><style>
        body { font-family: Arial; padding: 20px; }
        h1 { font-size: 24px; margin-bottom: 10px; }
        .category { margin-top: 20px; }
        .category-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #000; }
        .item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #ddd; }
        .item-name { flex: 1; }
        .item-qty { font-weight: bold; }
      </style></head><body>
        <h1>🛒 Shopping List - ${new Date().toLocaleDateString("en-IN")}</h1>
        ${Object.entries(groupedShoppingList).map(([cat, items]) => `
          <div class="category">
            <div class="category-title">${INGREDIENT_ICONS[cat] || "📦"} ${cat}</div>
            ${items.map(it => `<div class="item"><span class="item-name">${it.name}</span><span class="item-qty">${it.qty} ${it.unit}</span></div>`).join("")}
          </div>
        `).join("")}
      </body></html>
    `;
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.print();
  }, [groupedShoppingList]);

  // ── Image scan parser ──
  const parseScanText = useCallback(() => {
    if (!scanText.trim()) return;
    const lines = scanText.split("\n").map(l => l.trim()).filter(Boolean);
    const parsed = lines.map((line, i) => {
      const patterns = [
        /^(.+?)\s*[-:]\s*([\d.]+)\s*([a-zA-Z]+)\s*$/i,
        /^(.+?)\s+([\d.]+)\s*([a-zA-Z]+)\s*$/i,
        /^([\d.]+)\s*([a-zA-Z]+)\s+(.+)$/i,
      ];
      for (const pat of patterns) {
        const m = line.match(pat);
        if (m) {
          const [, a, b, c] = m;
          const isQtyFirst = !isNaN(parseFloat(a));
          const name = isQtyFirst ? c.trim() : a.trim();
          const qty = parseFloat(isQtyFirst ? a : b);
          const unit = isQtyFirst ? b : c;
          if (!isNaN(qty) && qty > 0 && name) {
            return { id: Date.now() + i, name, qty, unit, category: "Other" };
          }
        }
      }
      return { id: Date.now() + i, name: line, qty: 1, unit: "pcs", category: "Other" };
    });
    setManualItems(prev => [...prev, ...parsed]);
    setScanText("");
    setScanPreview(null);
    setShowScan(false);
    showToast(`Added ${parsed.length} items from scan!`);
  }, [scanText, showToast]);

  const handleImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setScanPreview(ev.target.result);
    reader.readAsDataURL(file);
  }, []);

  // ── Filtered menu items ──
  const filteredMenu = useMemo(() => {
    if (!searchMenu.trim()) return menuItems;
    const q = searchMenu.toLowerCase();
    return menuItems.filter(it => (it.name || "").toLowerCase().includes(q));
  }, [menuItems, searchMenu]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={tc.bg}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/40 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
          <p className={`text-sm ${tc.textSub}`}>Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={tc.bg}>
      <ToastPortal>
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {toasts.map(t => (
              <motion.div key={t.id}
                initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
                className={`px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold pointer-events-auto ${
                  t.type === "error" ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
                }`}
              >{t.msg}</motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ToastPortal>

      {/* Header */}
      <div className={`px-5 py-4 border-b ${tc.borderSoft}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/25 flex items-center justify-center text-2xl">🛒</div>
            <div>
              <h1 className={`text-lg font-black ${tc.textPrimary}`}>Shopping List</h1>
              <p className={`text-[11px] ${tc.textMuted}`}>Simple tool to plan your grocery shopping</p>
            </div>
          </div>
          <button onClick={() => setShowSaved(!showSaved)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${tc.borderSoft} ${tc.textMuted} hover:bg-white/8`}
          >💾 Saved Lists ({savedLists.length})</button>
        </div>

        {/* Simple instructions */}
        <div className={`p-3 rounded-xl border ${tc.borderSoft} bg-emerald-500/5`}>
          <p className="text-xs text-emerald-300 font-semibold">
            📝 <strong>How it works:</strong> Choose your menu items → Tell us how many you'll sell → We calculate what to buy
          </p>
        </div>
      </div>

      {showSaved ? (
        /* ══════ SAVED LISTS VIEW ══════ */
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-black ${tc.textSub}`}>💾 Saved Shopping Lists</h2>
            <button onClick={() => setShowSaved(false)}
              className={`text-xs ${tc.textMuted} hover:text-white transition`}
            >← Back to Shopping</button>
          </div>

          {savedLists.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-48 gap-2 rounded-2xl border ${tc.borderSoft} bg-white/[0.02]`}>
              <div className="text-4xl opacity-15">💾</div>
              <p className={`text-sm font-semibold ${tc.textSub}`}>No saved lists yet</p>
              <p className={`text-xs ${tc.textMuted}`}>Create a shopping list and save it for later</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedLists.map(list => (
                <div key={list.id} className={`rounded-2xl border overflow-hidden ${tc.borderSoft} bg-white/[0.02]`}>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-lg shrink-0">🛒</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${tc.textPrimary}`}>{list.name}</p>
                      <p className={`text-[10px] ${tc.textMuted}`}>
                        {new Date(list.createdAt).toLocaleDateString("en-IN")} · {list.items?.length || 0} items
                      </p>
                    </div>
                    <button onClick={() => deleteList(list.id)}
                      className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 text-red-400 text-xs flex items-center justify-center transition shrink-0"
                    >🗑️</button>
                  </div>
                  <div className={`border-t ${tc.borderSoft} px-4 py-3`}>
                    <div className="flex flex-wrap gap-1.5">
                      {(list.items || []).slice(0, 6).map((it, i) => (
                        <span key={i} className={`px-2 py-0.5 rounded-full text-[9px] font-bold border bg-white/5 ${tc.borderSoft} ${tc.textMuted}`}>
                          {it.name} · {it.qty}{it.unit}
                        </span>
                      ))}
                      {(list.items || []).length > 6 && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] border ${tc.borderSoft} ${tc.textMuted}`}>
                          +{list.items.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ══════ MAIN 3-COLUMN LAYOUT ══════ */
        <div className="flex-1 overflow-hidden flex gap-4 p-5">
          
          {/* ═══ LEFT: MENU ITEMS ═══ */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-sm font-black ${tc.textSub}`}>📋 Your Menu Items</h2>
              <input
                value={searchMenu}
                onChange={e => setSearchMenu(e.target.value)}
                placeholder="Search menu..."
                className={`px-3 py-1.5 rounded-xl text-xs border outline-none ${tc.borderSoft}`}
                style={{ background: "rgba(255,255,255,0.05)", color: "white", width: "180px" }}
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredMenu.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-40 rounded-2xl border ${tc.borderSoft} bg-white/[0.02]`}>
                  <p className={`text-sm ${tc.textSub}`}>No menu items found</p>
                </div>
              ) : (
                filteredMenu.map(item => {
                  const ings = ingredientConfig[item.name] || [];
                  const fc = forecast[item.name] || { willSell: 0, keepExtra: 0 };
                  const history = salesHistory[item.name];
                  const isExpanded = expandedItem === item.name;
                  const conf = estimationConfidence(item.name);

                  return (
                    <div key={item.id} className={`rounded-xl border overflow-hidden transition ${tc.borderSoft} ${ings.length > 0 ? "bg-white/[0.03]" : "bg-white/[0.01]"}`}>
                      <div className="px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1">
                            <p className={`text-sm font-bold ${tc.textPrimary}`}>{item.name}</p>
                            {history && (
                              <p className={`text-[10px] ${tc.textMuted}`}>
                                📊 Sold <span className="text-emerald-300 font-bold">{history.totalSold}</span> in last 30 days
                                ({history.avgPerDay}/day avg)
                              </p>
                            )}
                          </div>
                          {ings.length === 0 && conf !== "none" && (
                            <button onClick={() => autoFillIngredients(item.name)}
                              className="px-2 py-1 rounded-lg text-[9px] font-black bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/25 transition shrink-0"
                            >✨ Auto-fill</button>
                          )}
                          <button onClick={() => setExpandedItem(isExpanded ? null : item.name)}
                            className={`text-xs ${tc.textMuted} hover:text-white transition`}
                          >{isExpanded ? "▼" : "▶"}</button>
                        </div>

                        {/* Forecast inputs */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className={`text-[9px] font-bold mb-0.5 block ${tc.textMuted}`}>How many will sell?</label>
                            <input
                              type="number" min="0"
                              value={fc.willSell || ""}
                              onChange={e => setForecast(prev => ({ ...prev, [item.name]: { ...fc, willSell: parseInt(e.target.value) || 0 } }))}
                              placeholder={history ? `${Math.ceil(history.avgPerDay * 7)}` : "0"}
                              className="w-full px-2 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white text-center focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                            />
                          </div>
                          <div className="flex-1">
                            <label className={`text-[9px] font-bold mb-0.5 block ${tc.textMuted}`}>Keep extra stock?</label>
                            <input
                              type="number" min="0"
                              value={fc.keepExtra || ""}
                              onChange={e => setForecast(prev => ({ ...prev, [item.name]: { ...fc, keepExtra: parseInt(e.target.value) || 0 } }))}
                              placeholder="0"
                              className="w-full px-2 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white text-center focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                            />
                          </div>
                        </div>

                        {ings.length > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-300">
                            ✓ {ings.length} ingredient{ings.length > 1 ? "s" : ""} configured
                          </div>
                        )}
                      </div>

                      {/* Expanded: Ingredient config */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`border-t ${tc.borderSoft} overflow-hidden`}
                          >
                            <div className="px-3 py-3 space-y-2">
                              <p className={`text-[10px] font-bold ${tc.textMuted} mb-2`}>Ingredients per 1 {item.name}:</p>
                              
                              {ings.map((ing, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <input
                                    value={ing.name}
                                    onChange={e => {
                                      const updated = [...ings];
                                      updated[idx] = { ...ing, name: e.target.value };
                                      updateIngredients(item.name, updated);
                                    }}
                                    placeholder="Ingredient name"
                                    className="flex-1 px-2 py-1 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white focus:outline-none"
                                  />
                                  <input
                                    type="number" min="0" step="0.01"
                                    value={ing.qtyPerUnit}
                                    onChange={e => {
                                      const updated = [...ings];
                                      updated[idx] = { ...ing, qtyPerUnit: parseFloat(e.target.value) || 0 };
                                      updateIngredients(item.name, updated);
                                    }}
                                    className="w-16 px-2 py-1 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white text-right focus:outline-none"
                                  />
                                  <select
                                    value={ing.unit}
                                    onChange={e => {
                                      const updated = [...ings];
                                      updated[idx] = { ...ing, unit: e.target.value };
                                      updateIngredients(item.name, updated);
                                    }}
                                    className="w-14 px-1 py-1 rounded-lg text-[10px] bg-white/5 border border-white/10 text-white focus:outline-none"
                                  >
                                    {["g","kg","ml","L","pcs","tsp","tbsp"].map(u => <option key={u}>{u}</option>)}
                                  </select>
                                  <button
                                    onClick={() => {
                                      const updated = ings.filter((_, i) => i !== idx);
                                      updateIngredients(item.name, updated);
                                    }}
                                    className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] flex items-center justify-center transition"
                                  >✕</button>
                                </div>
                              ))}

                              <button
                                onClick={() => updateIngredients(item.name, [...ings, { name: "", unit: "g", qtyPerUnit: 0, category: "Other" }])}
                                className={`w-full py-1.5 rounded-lg text-[10px] font-bold border ${tc.borderSoft} ${tc.textMuted} hover:bg-white/8 transition`}
                              >+ Add Ingredient</button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ═══ RIGHT: SHOPPING LIST ═══ */}
          <div className="w-96 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-sm font-black ${tc.textSub}`}>🛒 Shopping List</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowScan(!showScan)}
                  className="px-2 py-1 rounded-lg text-[9px] font-bold bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/25 transition"
                >📷 Scan</button>
                <button onClick={printList}
                  className={`px-2 py-1 rounded-lg text-[9px] font-bold border ${tc.borderSoft} ${tc.textMuted} hover:bg-white/8 transition`}
                >🖨️ Print</button>
              </div>
            </div>

            {/* Image scan */}
            <AnimatePresence>
              {showScan && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`mb-3 rounded-xl border overflow-hidden ${tc.borderSoft} bg-violet-500/5`}
                >
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-violet-300">📷 Scan List</p>
                      <button onClick={() => { setShowScan(false); setScanText(""); setScanPreview(null); }}
                        className={`text-[10px] ${tc.textMuted} hover:text-white`}
                      >✕</button>
                    </div>
                    
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-1 py-4 border-2 border-dashed border-violet-500/30 rounded-lg cursor-pointer hover:border-violet-500/50 transition"
                    >
                      {scanPreview ? (
                        <img src={scanPreview} alt="scan" className="max-h-24 rounded-lg object-contain" />
                      ) : (
                        <>
                          <span className="text-2xl opacity-40">🖼️</span>
                          <p className={`text-[10px] ${tc.textMuted}`}>Click to upload photo</p>
                        </>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

                    <textarea
                      rows={3}
                      value={scanText}
                      onChange={e => setScanText(e.target.value)}
                      placeholder="Type items from photo:\nSugar 2 kg\nMilk 3 L\nOnion 500 g"
                      className="w-full px-2 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none resize-none"
                    />
                    <button onClick={parseScanText}
                      className="w-full py-1.5 rounded-lg text-[10px] font-black bg-violet-500/20 border border-violet-500/30 text-violet-200 hover:bg-violet-500/30 transition"
                    >✨ Add Items</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Shopping list */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {shoppingList.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-40 rounded-xl border ${tc.borderSoft} bg-white/[0.02]`}>
                  <div className="text-3xl opacity-15 mb-2">🛒</div>
                  <p className={`text-xs ${tc.textSub}`}>No items yet</p>
                  <p className={`text-[10px] ${tc.textMuted}`}>Add forecast quantities to menu items</p>
                </div>
              ) : (
                Object.entries(groupedShoppingList).map(([cat, items]) => (
                  <div key={cat} className={`rounded-xl border overflow-hidden ${tc.borderSoft}`}>
                    <div className={`px-3 py-2 border-b ${tc.borderSoft} bg-white/[0.02] flex items-center gap-2`}>
                      <span className="text-sm">{INGREDIENT_ICONS[cat]}</span>
                      <span className={`text-xs font-bold ${tc.textSub}`}>{cat}</span>
                      <span className={`text-[9px] ${tc.textMuted} ml-auto`}>{items.length}</span>
                    </div>
                    {items.map((it, i) => (
                      <div key={i} className={`flex items-center gap-2 px-3 py-2 border-b last:border-0 ${tc.borderSoft}`}>
                        <span className={`flex-1 text-xs font-medium ${tc.textPrimary}`}>{it.name}</span>
                        <span className="text-sm font-black text-emerald-300">{it.qty}</span>
                        <span className={`text-[10px] ${tc.textMuted}`}>{it.unit}</span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Save footer */}
            {shoppingList.length > 0 && (
              <div className="mt-3 space-y-2">
                <input
                  value={listName}
                  onChange={e => setListName(e.target.value)}
                  placeholder="List name (optional)"
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${tc.borderSoft}`}
                  style={{ background: "rgba(255,255,255,0.05)", color: "white" }}
                />
                <button onClick={saveList} disabled={saving}
                  className="w-full py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-white transition shadow-lg disabled:opacity-60"
                >{saving ? "Saving..." : "💾 Save Shopping List"}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
