/**
 * GroceryListPanelV3.jsx — Advanced Grocery / Procurement List
 * 3-Mode System: Menu-Based | AI Smart List (with sales reasoning) | Quick Add
 *
 * Key upgrades:
 *  - Menu Mode: always-visible "+ Add Ingredient" button per item
 *  - AI Mode: shows WHY each item was generated (sales data, calc breakdown)
 *              configurable forecast days + analysis window + buffer %
 *  - Quick Add: fixed text colors, category/priority/note fields, common-item chips
 *  - Shopping List: inline qty edit, source breakdown tooltip, per-category counts
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

// ─── Category meta ────────────────────────────────────────────────────────────
const CAT_META = {
  "Dairy & Beverages":  { icon: "🥛", color: "text-blue-300",    bg: "bg-blue-500/10",    border: "border-blue-500/20"   },
  "Grains & Flour":     { icon: "🌾", color: "text-amber-300",   bg: "bg-amber-500/10",   border: "border-amber-500/20"  },
  "Vegetables":         { icon: "🥬", color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/20"},
  "Meat & Protein":     { icon: "🍗", color: "text-red-300",     bg: "bg-red-500/10",     border: "border-red-500/20"    },
  "Spices & Masala":    { icon: "🌶️", color: "text-orange-300",  bg: "bg-orange-500/10",  border: "border-orange-500/20" },
  "Oils & Condiments":  { icon: "🫗", color: "text-yellow-300",  bg: "bg-yellow-500/10",  border: "border-yellow-500/20" },
  "Sweeteners":         { icon: "🍯", color: "text-pink-300",    bg: "bg-pink-500/10",    border: "border-pink-500/20"   },
  "Packaging":          { icon: "📦", color: "text-slate-300",   bg: "bg-slate-500/10",   border: "border-slate-500/20"  },
  "Other":              { icon: "📦", color: "text-white/50",    bg: "bg-white/5",        border: "border-white/10"      },
};
const catMeta = (cat) => CAT_META[cat] || CAT_META["Other"];

// Common quick-add suggestions
const QUICK_SUGGESTIONS = [
  { name: "Tomatoes",     unit: "kg",  qty: 5,   category: "Vegetables"       },
  { name: "Onions",       unit: "kg",  qty: 10,  category: "Vegetables"       },
  { name: "Potatoes",     unit: "kg",  qty: 5,   category: "Vegetables"       },
  { name: "Milk",         unit: "L",   qty: 10,  category: "Dairy & Beverages"},
  { name: "Butter",       unit: "kg",  qty: 1,   category: "Dairy & Beverages"},
  { name: "Maida",        unit: "kg",  qty: 5,   category: "Grains & Flour"   },
  { name: "Rice",         unit: "kg",  qty: 10,  category: "Grains & Flour"   },
  { name: "Cooking Oil",  unit: "L",   qty: 5,   category: "Oils & Condiments"},
  { name: "Sugar",        unit: "kg",  qty: 5,   category: "Sweeteners"       },
  { name: "Paneer",       unit: "kg",  qty: 2,   category: "Dairy & Beverages"},
  { name: "Chicken",      unit: "kg",  qty: 5,   category: "Meat & Protein"   },
  { name: "Cumin Seeds",  unit: "g",   qty: 200, category: "Spices & Masala"  },
];

const UNITS = ["g","kg","ml","L","pcs","dozen","tsp","tbsp","cup","box","bag"];
const PRIORITIES = [
  { value: "high",   label: "High",   color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20"    },
  { value: "medium", label: "Medium", color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20"},
  { value: "low",    label: "Low",    color: "text-slate-400",  bg: "bg-slate-500/10 border-slate-500/20"},
];

// ─── Toast Portal ─────────────────────────────────────────────────────────────
function ToastPortal({ children }) {
  return ReactDOM.createPortal(children, document.body);
}

// ─── Inline select with fixed dark styling ───────────────────────────────────
function DarkSelect({ value, onChange, options, className = "" }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.12)" }}
      className={`rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${className}`}
    >
      {options.map(o =>
        typeof o === "string"
          ? <option key={o} value={o} style={{ background: "#1e293b", color: "#e2e8f0" }}>{o}</option>
          : <option key={o.value} value={o.value} style={{ background: "#1e293b", color: "#e2e8f0" }}>{o.label}</option>
      )}
    </select>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GroceryListPanelV3() {
  const { tc } = usePOSTheme();

  const [uid, setUid] = useState(() => getUid() || null);
  const [mode, setMode] = useState("menu"); // menu | ai | quick
  const [loading, setLoading] = useState(true);

  // Data
  const [menuItems, setMenuItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [ingredientConfig, setIngredientConfig] = useState({});
  const [forecast, setForecast] = useState({});
  const [quickItems, setQuickItems] = useState([]);
  const [aiItems, setAiItems] = useState([]);
  const [savedLists, setSavedLists] = useState([]);

  // AI settings
  const [forecastDays, setForecastDays] = useState(7);
  const [analysisDays, setAnalysisDays] = useState(30);
  const [bufferPct, setBufferPct] = useState(15);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiExpandedReason, setAiExpandedReason] = useState(null); // ingredient id with open reasoning

  // UI state
  const [toasts, setToasts] = useState([]);
  const [expandedItem, setExpandedItem] = useState(null);
  const [searchMenu, setSearchMenu] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const [listName, setListName] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedListItem, setExpandedListItem] = useState(null); // shopping list source expand
  const [removedListKeys, setRemovedListKeys] = useState([]); // keys manually deleted from shopping list
  const [servingQtyInput, setServingQtyInput] = useState({}); // { [itemName]: qty string } for Add to List input

  // Quick add state
  const [quickName, setQuickName] = useState("");
  const [quickQty, setQuickQty] = useState("");
  const [quickUnit, setQuickUnit] = useState("kg");
  const [quickCategory, setQuickCategory] = useState("Other");
  const [quickNote, setQuickNote] = useState("");
  const [quickPriority, setQuickPriority] = useState("medium");
  const quickInputRef = useRef(null);

  // Editing state for shopping list
  const [editingListItem, setEditingListItem] = useState(null);
  const [editQty, setEditQty] = useState("");

  useEffect(() => auth.onAuthStateChanged(u => setUid(u?.uid || null)), []);

  const showToast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Load menu items ──
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

  // ── Load invoices (configurable window) ──
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const cutoff = Date.now() - analysisDays * 24 * 60 * 60 * 1000;
        const snap = await getDocs(
          query(collection(db, "businesses", uid, "finalizedInvoices"),
            orderBy("createdAt", "desc"), limit(1000))
        );
        const filtered = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(inv => (inv.createdAt || 0) >= cutoff && (inv.lines || inv.items || []).length > 0);
        setInvoices(filtered);
      } catch (e) { console.error(e); }
    })();
  }, [uid, analysisDays]);

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

  // ── Save ingredient config ──
  const saveConfig = useCallback(async (cfg) => {
    if (!uid) return;
    try {
      await setDoc(doc(db, "businesses", uid, "posConfig", "groceryIngredients"), cfg);
    } catch (e) { console.error(e); }
  }, [uid]);

  // ── Sales history (rich data) ──
  const salesHistory = useMemo(() => {
    const map = {};
    const dayMs = 24 * 60 * 60 * 1000;
    let minTs = Date.now();

    for (const inv of invoices) {
      const ts = inv.createdAt || Date.now();
      if (ts < minTs) minTs = ts;
      const items = inv.lines || inv.items || inv.cart || [];
      for (const line of items) {
        const name = line.product?.name || line.name || "";
        if (!name) continue;
        const qty = Number(line.qty || line.quantity || 1);
        if (!map[name]) map[name] = { totalSold: 0, invoiceCount: 0, revenue: 0 };
        map[name].totalSold += qty;
        map[name].invoiceCount += 1;
        map[name].revenue += (line.price || line.rate || 0) * qty;
      }
    }

    const activeDays = Math.max(1, Math.ceil((Date.now() - minTs) / dayMs));
    Object.keys(map).forEach(name => {
      map[name].avgPerDay = parseFloat((map[name].totalSold / activeDays).toFixed(2));
      map[name].activeDays = activeDays;
    });
    return map;
  }, [invoices]);

  // ── Ranked top sellers ──
  const topSellers = useMemo(() =>
    Object.entries(salesHistory)
      .sort((a, b) => b[1].totalSold - a[1].totalSold)
      .slice(0, 15)
      .map(([name, stats], rank) => ({ name, ...stats, rank: rank + 1 })),
    [salesHistory]
  );

  // ── Auto-fill ingredients ──
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
      showToast("No auto-estimate available for this item", "error");
    }
  }, [saveConfig, showToast]);

  const updateIngredients = useCallback((itemName, ings) => {
    setIngredientConfig(prev => {
      const updated = { ...prev, [itemName]: ings };
      saveConfig(updated);
      return updated;
    });
  }, [saveConfig]);

  // ── Generate AI list with detailed reasoning ──
  const generateAIList = useCallback(() => {
    setAiGenerating(true);
    setTimeout(() => {
      const generated = [];
      const buffer = 1 + bufferPct / 100;

      topSellers.forEach(({ name, avgPerDay, totalSold, rank }) => {
        const forecastUnits = Math.ceil(avgPerDay * forecastDays * buffer);
        if (forecastUnits <= 0) return;

        const ings = ingredientConfig[name] || estimateIngredients(name);
        const isAutoEstimated = !ingredientConfig[name] && ings.length > 0;

        ings.forEach(ing => {
          const rawQty = ing.qtyPerUnit * forecastUnits;
          const finalQty = parseFloat(rawQty.toFixed(2));
          const key = `ai_${name}_${ing.name}_${ing.unit}`;

          // Check if already in generated list (merge)
          const existing = generated.find(g => g.mergeKey === `${ing.name}_${ing.unit}`);
          if (existing) {
            existing.qty = parseFloat((existing.qty + finalQty).toFixed(2));
            existing.reasons.push({
              menuItem: name,
              rank,
              avgPerDay,
              totalSold,
              forecastUnits,
              ingQtyPerUnit: ing.qtyPerUnit,
              ingUnit: ing.unit,
              contribution: finalQty,
              isAutoEstimated,
            });
          } else {
            generated.push({
              id: key,
              mergeKey: `${ing.name}_${ing.unit}`,
              name: ing.name,
              qty: finalQty,
              unit: ing.unit,
              category: ing.category || "Other",
              reasons: [{
                menuItem: name,
                rank,
                avgPerDay,
                totalSold,
                forecastUnits,
                ingQtyPerUnit: ing.qtyPerUnit,
                ingUnit: ing.unit,
                contribution: finalQty,
                isAutoEstimated,
              }],
            });
          }
        });
      });

      setAiItems(generated);
      setAiGenerating(false);
      showToast(`🤖 Generated list · ${forecastDays}-day forecast · ${bufferPct}% buffer · ${topSellers.length} items analysed`);
    }, 600);
  }, [salesHistory, topSellers, ingredientConfig, forecastDays, bufferPct, showToast]);

  // ── Quick add item ──
  const addQuickItem = useCallback(() => {
    if (!quickName.trim()) { quickInputRef.current?.focus(); return; }
    const qty = parseFloat(quickQty) || 1;
    setQuickItems(prev => [...prev, {
      id: Date.now(),
      name: quickName.trim(),
      qty,
      unit: quickUnit,
      category: quickCategory,
      note: quickNote.trim(),
      priority: quickPriority,
    }]);
    setQuickName("");
    setQuickQty("");
    setQuickNote("");
    setQuickUnit("kg");
    setQuickCategory("Other");
    setQuickPriority("medium");
    quickInputRef.current?.focus();
    showToast(`Added ${quickName.trim()}`);
  }, [quickName, quickQty, quickUnit, quickCategory, quickNote, quickPriority, showToast]);

  const applyQuickSuggestion = useCallback((sug) => {
    setQuickName(sug.name);
    setQuickQty(String(sug.qty));
    setQuickUnit(sug.unit);
    setQuickCategory(sug.category);
    quickInputRef.current?.focus();
  }, []);

  // ── Unified shopping list ──
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
          const needed = parseFloat((ing.qtyPerUnit * totalQty).toFixed(2));
          if (!map[key]) map[key] = { name: ing.name, unit: ing.unit, qty: 0, category: ing.category || "Other", sources: [] };
          map[key].qty += needed;
          map[key].sources.push({ label: `${item.name}`, detail: `${totalQty} units × ${ing.qtyPerUnit}${ing.unit} = ${needed}${ing.unit}`, type: "menu" });
        });
      }
    });

    // From AI items
    aiItems.forEach(it => {
      const key = `${it.name}_${it.unit}`;
      if (!map[key]) map[key] = { name: it.name, unit: it.unit, qty: 0, category: it.category, sources: [] };
      map[key].qty += it.qty;
      it.reasons?.forEach(r => {
        map[key].sources.push({
          label: `${r.menuItem} #${r.rank}`,
          detail: `Sells ${r.avgPerDay}/day → ${r.forecastUnits} in ${forecastDays}d → ${r.contribution}${it.unit}`,
          type: "ai",
        });
      });
    });

    // From quick items
    quickItems.forEach(it => {
      const key = `${it.name}_${it.unit}`;
      if (!map[key]) map[key] = { name: it.name, unit: it.unit, qty: 0, category: it.category, sources: [], note: it.note, priority: it.priority };
      map[key].qty += it.qty;
      map[key].sources.push({ label: "Quick Add", detail: it.note || `${it.qty} ${it.unit}`, type: "quick" });
    });

    const removedSet = new Set(removedListKeys);
    return Object.entries(map)
      .map(([key, it]) => ({ key, ...it, qty: parseFloat(it.qty.toFixed(2)) }))
      .filter(it => !removedSet.has(it.key));
  }, [menuItems, ingredientConfig, forecast, aiItems, quickItems, forecastDays, removedListKeys]);

  const groupedList = useMemo(() => {
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
        quickItems,
        aiItems,
        forecastDays,
        analysisDays,
        bufferPct,
        createdAt: Date.now(),
      });
      showToast(`💾 Saved "${name}"`);
      setListName("");
    } catch (e) {
      showToast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }, [uid, shoppingList, forecast, quickItems, aiItems, forecastDays, analysisDays, bufferPct, listName, showToast]);

  const deleteList = useCallback(async (id) => {
    if (!uid) return;
    try {
      await deleteDoc(doc(db, "businesses", uid, "groceryLists", id));
      showToast("🗑️ Deleted");
    } catch (e) { showToast("Failed to delete", "error"); }
  }, [uid, showToast]);

  // ── Print ──
  const printList = useCallback(() => {
    const html = `<html><head><title>Grocery List</title><style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a1a; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      .sub { color: #666; font-size: 12px; margin-bottom: 20px; }
      .cat { margin-top: 18px; }
      .cat-title { font-size: 15px; font-weight: bold; border-bottom: 2px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
      .item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
      .item-name { font-size: 14px; }
      .item-qty { font-weight: bold; font-size: 14px; color: #16a34a; }
      .item-source { font-size: 10px; color: #999; margin-top: 1px; }
      .checkbox { width: 16px; height: 16px; border: 2px solid #ccc; border-radius: 4px; margin-right: 10px; display: inline-block; }
    </style></head><body>
      <h1>🛒 Grocery List</h1>
      <div class="sub">Generated ${new Date().toLocaleDateString("en-IN")} · ${shoppingList.length} items · ${forecastDays}-day forecast</div>
      ${Object.entries(groupedList).map(([cat, items]) => `
        <div class="cat">
          <div class="cat-title">${catMeta(cat).icon} ${cat} (${items.length})</div>
          ${items.map(it => `
            <div class="item">
              <div><span class="checkbox"></span><span class="item-name">${it.name}</span>
              ${it.sources?.length ? `<div class="item-source">${it.sources.map(s => s.label).join(", ")}</div>` : ""}</div>
              <span class="item-qty">${it.qty} ${it.unit}</span>
            </div>`).join("")}
        </div>`).join("")}
    </body></html>`;
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.print();
  }, [groupedList, shoppingList, forecastDays]);

  // ── Download CSV ──
  const downloadCSV = useCallback(() => {
    const rows = [["Item", "Qty", "Unit", "Category", "Source"]];
    shoppingList.forEach(it => {
      rows.push([
        `"${it.name}"`,
        it.qty,
        it.unit,
        `"${it.category || "Other"}"`,
        `"${(it.sources || []).map(s => s.label).join("; ")}"`,
      ]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grocery-list-${new Date().toLocaleDateString("en-IN").replace(/\//g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [shoppingList]);

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
          <p className={`text-sm ${tc.textSub}`}>Loading grocery data…</p>
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
                initial={{ opacity: 0, x: 50, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.92 }}
                className={`px-4 py-2.5 rounded-xl shadow-xl text-sm font-semibold pointer-events-auto ${
                  t.type === "error" ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
                }`}
              >{t.msg}</motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ToastPortal>

      {/* ── Header ── */}
      <div className={`px-5 py-3 border-b ${tc.borderSoft} shrink-0`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/25 flex items-center justify-center text-xl shrink-0">🛒</div>
            <div>
              <h1 className={`text-base font-black ${tc.textPrimary}`}>Smart Grocery List</h1>
              <p className={`text-[10px] ${tc.textMuted}`}>
                {invoices.length} invoices · {menuItems.length} menu items · {shoppingList.length} items in list
              </p>
            </div>
          </div>
          <button onClick={() => setShowSaved(!showSaved)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${tc.borderSoft} ${tc.textMuted} hover:bg-white/8`}
          >💾 Saved ({savedLists.length})</button>
        </div>

        {/* Mode tabs */}
        <div className="flex items-center gap-2">
          {[
            { key: "menu",  label: "📋 Menu Items",    active: "bg-emerald-500 text-white shadow-lg" },
            { key: "ai",    label: "🤖 AI Smart List", active: "bg-violet-500 text-white shadow-lg"  },
            { key: "quick", label: "✍️ Quick Add",     active: "bg-blue-500 text-white shadow-lg"    },
          ].map(tab => (
            <button key={tab.key} onClick={() => setMode(tab.key)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                mode === tab.key ? tab.active : `border ${tc.borderSoft} ${tc.textMuted} hover:bg-white/8`
              }`}
            >{tab.label}</button>
          ))}
        </div>
      </div>

      {/* ══ SAVED LISTS VIEW ══ */}
      {showSaved ? (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-black ${tc.textSub}`}>💾 Saved Lists</h2>
            <button onClick={() => setShowSaved(false)} className={`text-xs ${tc.textMuted} hover:text-white transition`}>← Back</button>
          </div>

          {savedLists.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-48 gap-2 rounded-2xl border ${tc.borderSoft} bg-white/[0.02]`}>
              <div className="text-4xl opacity-15">💾</div>
              <p className={`text-sm font-semibold ${tc.textSub}`}>No saved lists yet</p>
              <p className={`text-[10px] ${tc.textMuted}`}>Build a list and tap Save</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedLists.sort((a,b) => b.createdAt - a.createdAt).map(list => (
                <div key={list.id} className={`rounded-2xl border overflow-hidden ${tc.borderSoft} bg-white/[0.02]`}>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-lg shrink-0">🛒</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${tc.textPrimary} truncate`}>{list.name}</p>
                      <p className={`text-[10px] ${tc.textMuted}`}>
                        {new Date(list.createdAt).toLocaleDateString("en-IN")} · {list.items?.length || 0} items
                        {list.forecastDays ? ` · ${list.forecastDays}-day forecast` : ""}
                      </p>
                    </div>
                    <button onClick={() => deleteList(list.id)}
                      className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 text-red-400 text-xs flex items-center justify-center transition shrink-0"
                    >🗑️</button>
                  </div>
                  <div className={`border-t ${tc.borderSoft} px-4 py-2.5`}>
                    <div className="flex flex-wrap gap-1.5">
                      {(list.items || []).slice(0, 8).map((it, i) => (
                        <span key={i} className={`px-2 py-0.5 rounded-full text-[9px] font-bold border bg-white/5 ${tc.borderSoft} ${tc.textMuted}`}>
                          {it.name} · {it.qty}{it.unit}
                        </span>
                      ))}
                      {(list.items || []).length > 8 && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] border ${tc.borderSoft} ${tc.textMuted}`}>
                          +{list.items.length - 8} more
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
        /* ══ MAIN 2-COLUMN LAYOUT ══ */
        <div className="flex-1 overflow-hidden flex gap-0 min-h-0">

          {/* LEFT: Mode content */}
          <div className="flex-1 flex flex-col overflow-hidden border-r" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* ═══ MENU MODE ═══ */}
              {mode === "menu" && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      value={searchMenu}
                      onChange={e => setSearchMenu(e.target.value)}
                      placeholder="Search menu items…"
                      style={{ background: "rgba(255,255,255,0.06)", color: "white" }}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs border outline-none placeholder:text-white/30 ${tc.borderSoft}`}
                    />
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${tc.borderSoft} ${tc.textMuted} whitespace-nowrap`}>
                      {filteredMenu.length} items
                    </span>
                  </div>

                  {filteredMenu.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center h-40 rounded-xl border ${tc.borderSoft} bg-white/[0.02]`}>
                      <p className={`text-xs ${tc.textSub}`}>No menu items found</p>
                    </div>
                  ) : filteredMenu.map(item => {
                    const ings = ingredientConfig[item.name] || [];
                    const fc = forecast[item.name] || { willSell: 0, keepExtra: 0 };
                    const history = salesHistory[item.name];
                    const conf = estimationConfidence(item.name);
                    const suggestedQty = history ? Math.ceil(history.avgPerDay * 7) : 1;
                    const totalFc = (fc.willSell || 0) + (fc.keepExtra || 0);
                    const isInList = totalFc > 0 && ings.length > 0;
                    const qtyVal = servingQtyInput[item.name] ?? String(suggestedQty);

                    return (
                      <div key={item.id} className={`rounded-2xl border overflow-hidden transition-all ${
                        isInList ? "border-emerald-500/40 bg-emerald-500/[0.03]" : `${tc.borderSoft} bg-white/[0.02]`
                      }`}>

                        {/* ── Card header ── */}
                        <div className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-bold ${tc.textPrimary}`}>{item.name}</p>
                              {ings.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                                  {ings.length} ing
                                </span>
                              )}
                              {isInList && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-white">
                                  ✓ In List · {totalFc} servings
                                </span>
                              )}
                            </div>
                            <p className={`text-[10px] ${tc.textMuted} mt-0.5`}>
                              {history
                                ? `📊 ${history.totalSold} sold in ${analysisDays}d · ${history.avgPerDay}/day · 7d suggest: ${suggestedQty}`
                                : "No sales data"}
                            </p>
                          </div>
                          <button
                            onClick={() => setExpandedItem(expandedItem === item.name ? null : item.name)}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] border transition ${tc.borderSoft} ${tc.textMuted} hover:bg-white/10 shrink-0`}
                          >{expandedItem === item.name ? "▲" : "▼"}</button>
                        </div>

                        {/* ── Ingredient Board (collapsible) ── */}
                        <AnimatePresence>
                          {(expandedItem === item.name || ings.length === 0) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18 }}
                              className={`border-t ${tc.borderSoft} overflow-hidden`}
                            >
                              <div className="px-4 py-3 space-y-2">
                                {ings.length === 0 ? (
                                  <div className="py-3 flex flex-col items-center gap-3 text-center">
                                    <div className="text-3xl opacity-20">🧪</div>
                                    <p className={`text-xs font-semibold ${tc.textSub}`}>No ingredients configured</p>
                                    <p className={`text-[10px] ${tc.textMuted} max-w-xs`}>Add ingredients manually or let AI generate a standard recipe</p>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => { updateIngredients(item.name, [{ name: "", unit: "g", qtyPerUnit: 0, category: "Other" }]); setExpandedItem(item.name); }}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border ${tc.borderSoft} ${tc.textMuted} hover:bg-white/10 transition`}
                                      >+ Add Manually</button>
                                      {conf !== "none" && (
                                        <button
                                          onClick={() => autoFillIngredients(item.name)}
                                          className="px-3 py-1.5 rounded-xl text-[11px] font-black bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition"
                                        >✨ AI Generate</button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <p className={`text-[9px] font-black ${tc.textMuted} uppercase tracking-wide`}>Ingredients per 1 serving</p>
                                      {conf !== "none" && (
                                        <button onClick={() => autoFillIngredients(item.name)} className="text-[9px] font-black text-violet-400 hover:text-violet-300 transition">✨ AI Regenerate</button>
                                      )}
                                    </div>
                                    {ings.map((ing, idx) => (
                                      <div key={idx} className="flex gap-1.5 items-center">
                                        <input
                                          value={ing.name}
                                          onChange={e => { const u = [...ings]; u[idx] = { ...ing, name: e.target.value }; updateIngredients(item.name, u); }}
                                          placeholder="Ingredient name"
                                          style={{ background: "rgba(255,255,255,0.05)", color: "white" }}
                                          className="flex-1 px-2 py-1.5 rounded-lg text-[11px] border border-white/10 focus:outline-none focus:ring-1 focus:ring-white/20 min-w-0"
                                        />
                                        <input
                                          type="number" min="0" step="0.01"
                                          value={ing.qtyPerUnit}
                                          onChange={e => { const u = [...ings]; u[idx] = { ...ing, qtyPerUnit: parseFloat(e.target.value) || 0 }; updateIngredients(item.name, u); }}
                                          style={{ background: "rgba(255,255,255,0.05)", color: "white" }}
                                          className="w-14 px-1.5 py-1.5 rounded-lg text-[11px] border border-white/10 text-right focus:outline-none"
                                        />
                                        <DarkSelect value={ing.unit} onChange={e => { const u = [...ings]; u[idx] = { ...ing, unit: e.target.value }; updateIngredients(item.name, u); }} options={UNITS} className="w-14 px-1 py-1.5 text-[10px]" />
                                        <DarkSelect value={ing.category || "Other"} onChange={e => { const u = [...ings]; u[idx] = { ...ing, category: e.target.value }; updateIngredients(item.name, u); }} options={INGREDIENT_CATEGORIES} className="w-24 px-1 py-1.5 text-[10px]" />
                                        <button
                                          onClick={() => updateIngredients(item.name, ings.filter((_, i) => i !== idx))}
                                          className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs flex items-center justify-center shrink-0 transition"
                                        >✕</button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => updateIngredients(item.name, [...ings, { name: "", unit: "g", qtyPerUnit: 0, category: "Other" }])}
                                      className={`w-full py-1.5 rounded-lg text-[10px] font-bold border border-dashed ${tc.borderSoft} ${tc.textMuted} hover:bg-white/5 transition`}
                                    >+ Add Ingredient Row</button>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* ── Add to List footer ── */}
                        {ings.length > 0 && (
                          <div className={`px-4 py-2.5 border-t flex items-center gap-2 ${isInList ? "border-emerald-500/20 bg-emerald-500/[0.04]" : tc.borderSoft}`}>
                            {isInList ? (
                              <>
                                <span className="text-emerald-400 text-xs font-black flex-1">✓ {totalFc} servings added</span>
                                <input
                                  type="number" min="1"
                                  value={fc.willSell || ""}
                                  onChange={e => setForecast(prev => ({ ...prev, [item.name]: { ...fc, willSell: parseInt(e.target.value) || 0 } }))}
                                  style={{ background: "rgba(255,255,255,0.07)", color: "white" }}
                                  className="w-14 px-2 py-1 rounded-lg text-xs border border-emerald-500/30 text-center focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                                  title="Edit serving qty"
                                />
                                <button
                                  onClick={() => setForecast(prev => ({ ...prev, [item.name]: { willSell: 0, keepExtra: 0 } }))}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-red-500/25 text-red-400 hover:bg-red-500/10 transition"
                                >Remove</button>
                              </>
                            ) : (
                              <>
                                <span className={`text-[10px] ${tc.textMuted} shrink-0`}>Servings:</span>
                                <input
                                  type="number" min="1"
                                  value={qtyVal}
                                  onChange={e => setServingQtyInput(prev => ({ ...prev, [item.name]: e.target.value }))}
                                  style={{ background: "rgba(255,255,255,0.05)", color: "white" }}
                                  className="w-16 px-2 py-1 rounded-lg text-xs border border-white/15 text-center focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                                />
                                <button
                                  onClick={() => {
                                    const qty = parseInt(qtyVal) || suggestedQty;
                                    setForecast(prev => ({ ...prev, [item.name]: { willSell: qty, keepExtra: 0 } }));
                                    setRemovedListKeys(prev => prev.filter(k => !ings.some(ing => `${ing.name}_${ing.unit}` === k)));
                                  }}
                                  className="flex-1 py-1.5 rounded-xl text-[11px] font-black bg-emerald-500 text-white hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
                                >+ Add to List →</button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* ═══ AI SMART LIST MODE ═══ */}
              {mode === "ai" && (
                <>
                  {/* Settings panel */}
                  <div className={`p-4 rounded-2xl border ${tc.borderSoft} bg-violet-500/5 space-y-4`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">🤖</span>
                      <h2 className={`text-sm font-black ${tc.textSub}`}>AI Smart List Settings</h2>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={`text-[9px] font-black uppercase tracking-wide ${tc.textMuted} block mb-1`}>Forecast Days</label>
                        <div className="flex gap-1 flex-wrap">
                          {[3, 7, 14, 30].map(d => (
                            <button key={d} onClick={() => setForecastDays(d)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                                forecastDays === d ? "bg-violet-500 text-white border-violet-400" : `${tc.borderSoft} ${tc.textMuted} hover:bg-white/8`
                              }`}
                            >{d}d</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className={`text-[9px] font-black uppercase tracking-wide ${tc.textMuted} block mb-1`}>Analysis Window</label>
                        <div className="flex gap-1 flex-wrap">
                          {[7, 14, 30, 60].map(d => (
                            <button key={d} onClick={() => setAnalysisDays(d)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                                analysisDays === d ? "bg-violet-500 text-white border-violet-400" : `${tc.borderSoft} ${tc.textMuted} hover:bg-white/8`
                              }`}
                            >{d}d</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className={`text-[9px] font-black uppercase tracking-wide ${tc.textMuted} block mb-1`}>Safety Buffer</label>
                        <div className="flex gap-1 flex-wrap">
                          {[0, 10, 15, 20, 25].map(p => (
                            <button key={p} onClick={() => setBufferPct(p)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                                bufferPct === p ? "bg-violet-500 text-white border-violet-400" : `${tc.borderSoft} ${tc.textMuted} hover:bg-white/8`
                              }`}
                            >+{p}%</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={generateAIList}
                      disabled={aiGenerating || topSellers.length === 0}
                      className={`w-full py-2.5 rounded-xl text-sm font-black transition shadow-lg flex items-center justify-center gap-2 ${
                        aiGenerating || topSellers.length === 0
                          ? "bg-violet-500/40 text-white/60 cursor-not-allowed"
                          : "bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:opacity-90"
                      }`}
                    >
                      {aiGenerating ? (
                        <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Analysing sales…</>
                      ) : (
                        <>✨ Generate AI List · {forecastDays}-day · +{bufferPct}% buffer</>
                      )}
                    </button>
                  </div>

                  {/* Sales Insights */}
                  {topSellers.length > 0 && (
                    <div className={`rounded-xl border ${tc.borderSoft} overflow-hidden`}>
                      <div className={`px-3 py-2 border-b ${tc.borderSoft} bg-white/[0.02] flex items-center justify-between`}>
                        <span className={`text-[10px] font-black ${tc.textSub} uppercase tracking-wide`}>📊 Sales Insights ({analysisDays}d history)</span>
                        <span className={`text-[9px] ${tc.textMuted}`}>{invoices.length} orders</span>
                      </div>
                      <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                        {topSellers.slice(0, 8).map((seller, i) => {
                          const hasIng = !!(ingredientConfig[seller.name]?.length);
                          const autoConf = estimationConfidence(seller.name);
                          return (
                            <div key={seller.name} className="flex items-center gap-2 px-3 py-2">
                              <span className={`text-[10px] font-black w-5 text-center ${i < 3 ? "text-amber-300" : tc.textMuted}`}>#{i+1}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold ${tc.textPrimary} truncate`}>{seller.name}</p>
                                <p className={`text-[9px] ${tc.textMuted}`}>
                                  {seller.totalSold} sold · {seller.avgPerDay}/day avg
                                  {" · forecast: "}<span className="text-violet-300 font-bold">{Math.ceil(seller.avgPerDay * forecastDays * (1 + bufferPct/100))}</span> in {forecastDays}d
                                </p>
                              </div>
                              {hasIng ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-bold shrink-0">✓ Configured</span>
                              ) : autoConf !== "none" ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20 font-bold shrink-0">✨ AI Est.</span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/10 font-bold shrink-0">No data</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Generated items with reasoning */}
                  {aiItems.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-[10px] font-black uppercase tracking-wide ${tc.textSub}`}>Generated: {aiItems.length} ingredients</p>
                        <button onClick={() => setAiItems([])}
                          className={`text-[9px] text-red-400 hover:text-red-300 font-bold transition`}
                        >Clear all</button>
                      </div>
                      <div className="space-y-1.5">
                        {aiItems.map(it => {
                          const meta = catMeta(it.category);
                          const isOpen = aiExpandedReason === it.id;
                          return (
                            <div key={it.id} className={`rounded-xl border ${tc.borderSoft} overflow-hidden`}>
                              <div className="flex items-center gap-2 px-3 py-2">
                                <span className="text-base shrink-0">{meta.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold ${tc.textPrimary}`}>{it.name}</p>
                                  <button
                                    onClick={() => setAiExpandedReason(isOpen ? null : it.id)}
                                    className={`text-[9px] ${tc.textMuted} hover:text-violet-300 transition underline underline-offset-2`}
                                  >
                                    {isOpen ? "Hide reasoning ▲" : `Why? · ${it.reasons?.length || 0} source${it.reasons?.length !== 1 ? "s" : ""} ▼`}
                                  </button>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-sm font-black text-violet-300">{it.qty}</span>
                                  <span className={`text-[10px] ml-1 ${tc.textMuted}`}>{it.unit}</span>
                                </div>
                                <button
                                  onClick={() => setAiItems(prev => prev.filter(i => i.id !== it.id))}
                                  className="w-5 h-5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[9px] flex items-center justify-center shrink-0"
                                >✕</button>
                              </div>

                              {/* Reasoning breakdown */}
                              <AnimatePresence>
                                {isOpen && it.reasons && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className={`border-t overflow-hidden`}
                                    style={{ borderColor: "rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.04)" }}
                                  >
                                    <div className="px-3 py-2.5 space-y-1.5">
                                      <p className={`text-[9px] font-black uppercase tracking-wide text-violet-400 mb-1`}>Why this was generated:</p>
                                      {it.reasons.map((r, ri) => (
                                        <div key={ri} className="flex items-start gap-2 text-[10px]">
                                          <span className={`font-black ${ri === 0 ? "text-amber-300" : tc.textMuted}`}>#{r.rank}</span>
                                          <div className="flex-1">
                                            <span className={`font-bold ${tc.textSub}`}>{r.menuItem}</span>
                                            <span className={` ${tc.textMuted}`}> sells </span>
                                            <span className="text-teal-300 font-bold">{r.avgPerDay}/day</span>
                                            <span className={` ${tc.textMuted}`}> → </span>
                                            <span className="text-violet-300 font-bold">{r.forecastUnits} in {forecastDays}d</span>
                                            <span className={` ${tc.textMuted}`}> × {r.ingQtyPerUnit}{r.ingUnit} = </span>
                                            <span className="text-emerald-300 font-black">{r.contribution}{it.unit}</span>
                                            {r.isAutoEstimated && (
                                              <span className="ml-1 px-1 py-0.5 rounded text-[8px] bg-amber-500/15 text-amber-300 border border-amber-500/20">AI est.</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {aiItems.length === 0 && !aiGenerating && topSellers.length === 0 && (
                    <div className={`flex flex-col items-center justify-center h-32 rounded-xl border ${tc.borderSoft} bg-white/[0.02]`}>
                      <div className="text-3xl opacity-15 mb-2">📊</div>
                      <p className={`text-xs ${tc.textSub}`}>No sales data found</p>
                      <p className={`text-[10px] ${tc.textMuted}`}>Record some orders first</p>
                    </div>
                  )}
                </>
              )}

              {/* ═══ QUICK ADD MODE ═══ */}
              {mode === "quick" && (
                <>
                  {/* Add form */}
                  <div className={`p-4 rounded-2xl border ${tc.borderSoft} bg-blue-500/5 space-y-3`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">✍️</span>
                      <h2 className={`text-sm font-black ${tc.textSub}`}>Quick Add Item</h2>
                    </div>

                    {/* Item name */}
                    <input
                      ref={quickInputRef}
                      value={quickName}
                      onChange={e => setQuickName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addQuickItem()}
                      placeholder="Item name (e.g. Tomatoes, Cooking Oil, Rice…)"
                      style={{ background: "rgba(255,255,255,0.07)", color: "white" }}
                      className="w-full px-3 py-2.5 rounded-xl text-sm border border-white/12 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                      autoFocus
                    />

                    {/* Qty + Unit + Category */}
                    <div className="flex gap-2">
                      <input
                        type="number" min="0.01" step="any"
                        value={quickQty}
                        onChange={e => setQuickQty(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addQuickItem()}
                        placeholder="Qty"
                        style={{ background: "rgba(255,255,255,0.07)", color: "white" }}
                        className="w-20 px-3 py-2 rounded-xl text-sm border border-white/12 text-center focus:outline-none focus:ring-2 focus:ring-blue-400/50 placeholder:text-white/30"
                      />
                      <DarkSelect
                        value={quickUnit}
                        onChange={e => setQuickUnit(e.target.value)}
                        options={UNITS}
                        className="flex-1 px-2 py-2"
                      />
                      <DarkSelect
                        value={quickCategory}
                        onChange={e => setQuickCategory(e.target.value)}
                        options={INGREDIENT_CATEGORIES}
                        className="flex-1 px-2 py-2"
                      />
                    </div>

                    {/* Priority + Note */}
                    <div className="flex gap-2">
                      <div className="flex gap-1.5 items-center">
                        <span className={`text-[9px] font-black uppercase tracking-wide ${tc.textMuted} shrink-0`}>Priority:</span>
                        {PRIORITIES.map(p => (
                          <button key={p.value} onClick={() => setQuickPriority(p.value)}
                            className={`px-2 py-1 rounded-lg text-[9px] font-black border transition ${
                              quickPriority === p.value ? `${p.bg} ${p.color}` : `${tc.borderSoft} ${tc.textMuted} hover:bg-white/8`
                            }`}
                          >{p.label}</button>
                        ))}
                      </div>
                      <input
                        value={quickNote}
                        onChange={e => setQuickNote(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addQuickItem()}
                        placeholder="Note (optional)"
                        style={{ background: "rgba(255,255,255,0.07)", color: "white" }}
                        className="flex-1 px-3 py-2 rounded-xl text-xs border border-white/12 focus:outline-none focus:ring-1 focus:ring-blue-400/40 placeholder:text-white/30"
                      />
                    </div>

                    <button onClick={addQuickItem}
                      className="w-full py-2.5 rounded-xl text-sm font-black bg-blue-500 hover:bg-blue-400 text-white transition shadow-lg"
                    >+ Add to List →</button>
                  </div>

                  {/* Quick suggestions */}
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-wide ${tc.textMuted} mb-2`}>Common items — tap to prefill:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_SUGGESTIONS.map(sug => {
                        const meta = catMeta(sug.category);
                        return (
                          <button key={sug.name} onClick={() => applyQuickSuggestion(sug)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition hover:scale-105 ${meta.bg} ${meta.border} ${meta.color}`}
                          >
                            <span>{meta.icon}</span> {sug.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Added items list */}
                  {quickItems.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className={`text-[10px] font-black uppercase tracking-wide ${tc.textSub}`}>Added ({quickItems.length})</p>
                        <button onClick={() => setQuickItems([])}
                          className="text-[9px] text-red-400 hover:text-red-300 font-bold"
                        >Clear all</button>
                      </div>
                      {quickItems.map(it => {
                        const meta = catMeta(it.category);
                        const pMeta = PRIORITIES.find(p => p.value === it.priority);
                        return (
                          <div key={it.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${tc.borderSoft} bg-white/[0.02]`}>
                            <span className="text-sm shrink-0">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${tc.textPrimary} truncate`}>{it.name}</p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${meta.bg} ${meta.border} ${meta.color}`}>{it.category}</span>
                                {pMeta && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${pMeta.bg} ${pMeta.color}`}>{pMeta.label}</span>
                                )}
                                {it.note && <span className={`text-[9px] ${tc.textMuted} italic truncate`}>{it.note}</span>}
                              </div>
                            </div>
                            <span className="text-sm font-black text-blue-300 shrink-0">{it.qty}</span>
                            <span className={`text-[10px] ${tc.textMuted} shrink-0`}>{it.unit}</span>
                            <button
                              onClick={() => setQuickItems(prev => prev.filter(i => i.id !== it.id))}
                              className="w-5 h-5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[9px] flex items-center justify-center shrink-0"
                            >✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* RIGHT: Unified Shopping List */}
          <div className="w-80 shrink-0 flex flex-col overflow-hidden">
            <div className={`px-4 py-3 border-b ${tc.borderSoft} flex items-center justify-between shrink-0`}>
              <div>
                <h2 className={`text-sm font-black ${tc.textSub}`}>🛒 Shopping List</h2>
                <p className={`text-[9px] ${tc.textMuted}`}>{shoppingList.length} items · {Object.keys(groupedList).length} categories</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={downloadCSV} disabled={shoppingList.length === 0}
                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold border ${tc.borderSoft} ${tc.textMuted} hover:bg-white/8 transition disabled:opacity-30`}
                  title="Download CSV"
                >⬇️ CSV</button>
                <button onClick={printList} disabled={shoppingList.length === 0}
                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold border ${tc.borderSoft} ${tc.textMuted} hover:bg-white/8 transition disabled:opacity-30`}
                >🖨️ Print</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
              {shoppingList.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-52 rounded-xl border ${tc.borderSoft} bg-white/[0.02]`}>
                  <div className="text-3xl opacity-15 mb-2">🛒</div>
                  <p className={`text-xs font-semibold ${tc.textSub}`}>Empty list</p>
                  <p className={`text-[10px] ${tc.textMuted} text-center mt-1 px-4`}>Use Menu Items, AI Smart List, or Quick Add to populate</p>
                </div>
              ) : (
                Object.entries(groupedList).map(([cat, items]) => {
                  const meta = catMeta(cat);
                  return (
                    <div key={cat} className={`rounded-xl border overflow-hidden ${tc.borderSoft}`}>
                      <div className={`px-3 py-1.5 flex items-center gap-2 ${meta.bg} border-b ${meta.border}`}>
                        <span className="text-sm">{meta.icon}</span>
                        <span className={`text-[10px] font-black ${meta.color}`}>{cat}</span>
                        <span className={`text-[9px] ${tc.textMuted} ml-auto`}>{items.length}</span>
                      </div>
                      {items.map((it, i) => {
                        const isEditing = editingListItem === it.key;
                        const isSourceOpen = expandedListItem === it.key;
                        return (
                          <div key={i} className={`border-b last:border-0 ${tc.borderSoft}`}>
                            <div className="flex items-center gap-2 px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold ${tc.textPrimary} truncate`}>{it.name}</p>
                                {it.sources?.length > 0 && (
                                  <button
                                    onClick={() => setExpandedListItem(isSourceOpen ? null : it.key)}
                                    className={`text-[8px] ${tc.textMuted} hover:text-violet-300 transition underline underline-offset-1`}
                                  >
                                    {it.sources.map(s => s.label).slice(0,2).join(", ")}{it.sources.length > 2 ? ` +${it.sources.length-2}` : ""} {isSourceOpen ? "▲" : "▼"}
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number" min="0" step="any"
                                      value={editQty}
                                      onChange={e => setEditQty(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === "Enter") setEditingListItem(null);
                                        if (e.key === "Escape") setEditingListItem(null);
                                      }}
                                      autoFocus
                                      style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
                                      className="w-14 px-1.5 py-1 rounded-lg text-xs border border-emerald-400/40 text-right focus:outline-none"
                                    />
                                    <span className={`text-[9px] ${tc.textMuted}`}>{it.unit}</span>
                                    <button onClick={() => setEditingListItem(null)} className="text-[9px] text-emerald-400">✓</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setEditingListItem(it.key); setEditQty(String(it.qty)); }}
                                    className="flex items-center gap-1 hover:opacity-80 transition"
                                    title="Click to edit qty"
                                  >
                                    <span className="text-sm font-black text-emerald-300">{it.qty}</span>
                                    <span className={`text-[9px] ${tc.textMuted}`}>{it.unit}</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => setRemovedListKeys(prev => [...prev, it.key])}
                                  className="w-5 h-5 rounded-md bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[9px] flex items-center justify-center transition"
                                  title="Remove from list"
                                >✕</button>
                              </div>
                            </div>
                            {/* Source breakdown */}
                            <AnimatePresence>
                              {isSourceOpen && it.sources?.length > 0 && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-3 pb-2 space-y-0.5" style={{ background: "rgba(255,255,255,0.02)" }}>
                                    {it.sources.map((s, si) => (
                                      <div key={si} className="flex items-start gap-1.5 text-[9px]">
                                        <span className={`shrink-0 px-1 py-0.5 rounded font-bold ${
                                          s.type === "ai" ? "bg-violet-500/15 text-violet-300" :
                                          s.type === "menu" ? "bg-emerald-500/15 text-emerald-300" :
                                          "bg-blue-500/15 text-blue-300"
                                        }`}>{s.type === "ai" ? "🤖" : s.type === "menu" ? "📋" : "✍️"} {s.label}</span>
                                        <span className={tc.textMuted}>{s.detail}</span>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Save bar */}
            {shoppingList.length > 0 && (
              <div className={`px-3 py-3 border-t ${tc.borderSoft} space-y-2 shrink-0`}>
                <input
                  value={listName}
                  onChange={e => setListName(e.target.value)}
                  placeholder="List name (optional)…"
                  style={{ background: "rgba(255,255,255,0.06)", color: "white" }}
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none placeholder:text-white/30 ${tc.borderSoft}`}
                />
                <button onClick={saveList} disabled={saving}
                  className="w-full py-2.5 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-white transition shadow-lg disabled:opacity-60"
                >{saving ? "Saving…" : "💾 Save List"}</button>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
