/**
 * GroceryListPanel.jsx
 * Smart AI-powered grocery / procurement list generator for Restaurant POS.
 * - Analyses past sales (finalizedInvoices) to calculate item velocity
 * - Predicts raw material requirements for N forecast days
 * - Smart ingredient estimation per menu item (keyword-based AI)
 * - Fully editable list with manual additions
 * - Save / print grocery lists
 */
import React, {
  useState, useEffect, useMemo, useCallback, useRef,
} from "react";
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

// ─── Day presets ────────────────────────────────────────────────────────────
const DAY_PRESETS = [2, 3, 7, 14, 30];
const ANALYSIS_PRESETS = [7, 14, 30, 60, 90];

// ─── Smart text parser (for image scan) ──────────────────────────────────────
const UNIT_MAP = {
  kg:'kg', kgs:'kg', kilogram:'kg', kilograms:'kg',
  g:'g', gm:'g', gms:'g', gram:'g', grams:'g',
  ml:'ml', milliliter:'ml', milliliters:'ml',
  l:'L', liter:'L', liters:'L', litre:'L', litres:'L',
  pcs:'pcs', pc:'pcs', piece:'pcs', pieces:'pcs', nos:'pcs', no:'pcs', number:'pcs',
  dozen:'dozen', doz:'dozen',
  bottle:'pcs', bottles:'pcs',
  pack:'pcs', packet:'pcs', packets:'pcs',
  tsp:'tsp', tbsp:'tbsp', cup:'cup', cups:'cup',
};
function normUnit(u) { return UNIT_MAP[u?.toLowerCase()] || u || 'pcs'; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function parseTextToItems(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map((line, i) => {
    const pats = [
      /^(.+?)\s*[-:]\s*([\d.]+)\s*([a-zA-Z]+)\s*$/i,
      /^(.+?)\s+([\d.]+)\s*([a-zA-Z]+)\s*$/i,
      /^([\d.]+)\s*([a-zA-Z]+)\s+(.+)$/i,
      /^(.+?)\s*\(([\d.]+)\s*([a-zA-Z]+)\)\s*$/i,
    ];
    for (let pi = 0; pi < pats.length; pi++) {
      const m = line.match(pats[pi]);
      if (m) {
        let name, qty, unit;
        if (pi === 2) { qty = parseFloat(m[1]); unit = normUnit(m[2]); name = cap(m[3].trim()); }
        else { name = cap(m[1].trim()); qty = parseFloat(m[2]); unit = normUnit(m[3]); }
        if (!isNaN(qty) && qty > 0 && name)
          return { id: `scan_${Date.now()}_${i}`, name, qty, unit, category: 'Other', fromScan: true };
      }
    }
    return { id: `scan_${Date.now()}_${i}`, name: cap(line), qty: 1, unit: 'pcs', category: 'Other', fromScan: true };
  });
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function unitBadge(unit) {
  const colors = {
    g: "bg-blue-500/15 text-blue-300 border-blue-500/20",
    ml: "bg-teal-500/15 text-teal-300 border-teal-500/20",
    pcs: "bg-violet-500/15 text-violet-300 border-violet-500/20",
    kg: "bg-orange-500/15 text-orange-300 border-orange-500/20",
    l: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
  };
  return colors[unit?.toLowerCase()] || "bg-white/8 text-white/50 border-white/10";
}

function catColor(cat) {
  const m = {
    "Dairy & Beverages":  "text-blue-300 bg-blue-500/10 border-blue-500/15",
    "Grains & Flour":     "text-amber-300 bg-amber-500/10 border-amber-500/15",
    "Vegetables":         "text-emerald-300 bg-emerald-500/10 border-emerald-500/15",
    "Meat & Protein":     "text-red-300 bg-red-500/10 border-red-500/15",
    "Spices & Masala":    "text-orange-300 bg-orange-500/10 border-orange-500/15",
    "Oils & Condiments":  "text-yellow-300 bg-yellow-500/10 border-yellow-500/15",
    "Sweeteners":         "text-pink-300 bg-pink-500/10 border-pink-500/15",
    "Packaging":          "text-slate-300 bg-slate-500/10 border-slate-500/15",
    "Other":              "bg-white/8 text-white/50 border-white/10",
  };
  return m[cat] || m["Other"];
}

function catIcon(cat) {
  const m = {
    "Dairy & Beverages":  "🥛",
    "Grains & Flour":     "🌾",
    "Vegetables":         "🥕",
    "Meat & Protein":     "🍗",
    "Spices & Masala":    "🌶️",
    "Oils & Condiments":  "🫙",
    "Sweeteners":         "🍬",
    "Packaging":          "📦",
    "Other":              "📦",
  };
  return m[cat] || "📦";
}

// ─── Toast (local, portaled) ──────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2800);
  }, []);
  const Portal = () => ReactDOM.createPortal(
    <div className="fixed top-4 right-4 z-[999999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, x: 40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className={`px-4 py-3 rounded-2xl border text-sm font-bold flex items-center gap-2 shadow-2xl pointer-events-auto max-w-xs ${
              t.type === "error"
                ? "bg-red-600 border-red-500/50 text-white"
                : "bg-emerald-600 border-emerald-500/50 text-white"
            }`}
          >
            {t.type === "error" ? "⚠️" : "✅"} {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
  return { show, Portal };
}

// ─── Ingredient Row ───────────────────────────────────────────────────────────
function IngredientRow({ ing, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <input
        value={ing.name}
        onChange={e => onChange({ ...ing, name: e.target.value })}
        placeholder="Ingredient name"
        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs bg-white/5 border border-white/8 text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
        style={{ WebkitTextFillColor: "white" }}
      />
      <input
        type="number"
        min="0"
        value={ing.qtyPerUnit}
        onChange={e => onChange({ ...ing, qtyPerUnit: parseFloat(e.target.value) || 0 })}
        className="w-16 px-2 py-1.5 rounded-lg text-xs bg-white/5 border border-white/8 text-white text-right focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
        style={{ WebkitTextFillColor: "white" }}
      />
      <select
        value={ing.unit}
        onChange={e => onChange({ ...ing, unit: e.target.value })}
        className="w-14 px-1.5 py-1.5 rounded-lg text-[10px] bg-white/5 border border-white/8 text-white focus:outline-none"
        style={{ WebkitTextFillColor: "white" }}
      >
        {["g","ml","pcs","kg","L","tsp","tbsp"].map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <select
        value={ing.category}
        onChange={e => onChange({ ...ing, category: e.target.value })}
        className="w-28 px-1.5 py-1.5 rounded-lg text-[10px] bg-white/5 border border-white/8 text-white focus:outline-none hidden sm:block"
        style={{ WebkitTextFillColor: "white" }}
      >
        {INGREDIENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <button
        onClick={onRemove}
        className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shrink-0"
      >✕</button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GroceryListPanel() {
  const { tc } = usePOSTheme();
  const { show: showToast, Portal: ToastPortal } = useToast();

  // ── Core state ──
  const [tab, setTab]                       = useState("forecast"); // forecast | ingredients | list | saved
  const [forecastDays, setForecastDays]     = useState(7);
  const [customDays, setCustomDays]         = useState("");
  const [analysisDays, setAnalysisDays]     = useState(30);
  const [invoices, setInvoices]             = useState([]);
  const [loadingInv, setLoadingInv]         = useState(true);
  const [ingredientConfig, setIngredientConfig] = useState({}); // {itemName: [{name, unit, qtyPerUnit, category}]}
  const [configLoaded, setConfigLoaded]     = useState(false);
  const [expandedItem, setExpandedItem]     = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [savedLists, setSavedLists]         = useState([]);
  const [listName, setListName]             = useState("");
  const [manualItems, setManualItems]       = useState([]);
  const [checkedItems, setCheckedItems]     = useState(new Set());
  const [grocerySearch, setGrocerySearch]   = useState("");
  const [sortBy, setSortBy]                 = useState("category"); // category | qty | name
  const [expandedCat, setExpandedCat]       = useState(null);

  // image-scan state
  const [scanText, setScanText]             = useState("");
  const [scanPreview, setScanPreview]       = useState(null);  // data-URL
  const [scanParsed, setScanParsed]         = useState([]);    // parsed items
  const [showScan, setShowScan]             = useState(false);
  const fileInputRef = useRef(null);

  const [uid, setUid] = useState(() => getUid() || null);
  useEffect(() => auth.onAuthStateChanged(u => setUid(u?.uid || null)), []);

  // ── effectiveForecastDays must be computed BEFORE topItems ──
  const effectiveForecastDays = useMemo(
    () => (customDays ? parseInt(customDays) || forecastDays : forecastDays),
    [customDays, forecastDays]
  );

  // ── Load invoices ──
  useEffect(() => {
    if (!uid) { setLoadingInv(false); return; }
    setLoadingInv(true);
    const cutoff = Date.now() - analysisDays * 24 * 60 * 60 * 1000;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "businesses", uid, "finalizedInvoices"),
            orderBy("createdAt", "desc"), limit(1000))
        );
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Accept restaurant-pos invoices; fall back to any invoice that has lines/items
        const filtered = all.filter(inv => {
          const withinPeriod = (inv.createdAt || 0) >= cutoff;
          const isRestaurant = !inv.meta?.source || inv.meta?.source === "restaurant-pos";
          const hasItems = (inv.lines || inv.items || inv.cart || []).length > 0;
          return withinPeriod && isRestaurant && hasItems;
        });
        setInvoices(filtered);
      } catch (e) { console.error(e); }
      finally { setLoadingInv(false); }
    })();
  }, [uid, analysisDays]);

  // ── Load saved ingredient config from Firestore ──
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "businesses", uid, "posConfig", "groceryIngredients"));
        if (snap.exists()) setIngredientConfig(snap.data() || {});
      } catch (_) {}
      setConfigLoaded(true);
    })();
  }, [uid]);

  // ── Load saved grocery lists ──
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      query(collection(db, "businesses", uid, "groceryLists"), orderBy("createdAt", "desc"), limit(20)),
      snap => setSavedLists(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return unsub;
  }, [uid]);

  // ── Compute top items from invoices ──
  const topItems = useMemo(() => {
    const map = {};
    for (const inv of invoices) {
      // invoices from RestaurantPOSBilling save items under `lines`
      const items = inv.lines || inv.items || inv.cart || [];
      for (const line of items) {
        const name = line.product?.name || line.product?.productName ||
                     line.name || line.productName || "";
        if (!name || name === "Item") continue;
        const qty = Number(line.qty || line.quantity || 1);
        const price = Number(line.product?.price || line.price || line.rate || 0);
        if (!map[name]) map[name] = { name, totalSold: 0, revenue: 0 };
        map[name].totalSold += qty;
        map[name].revenue += qty * price;
      }
    }
    return Object.values(map)
      .map(it => ({
        ...it,
        dailyRate: parseFloat((it.totalSold / analysisDays).toFixed(2)),
        forecastQty: Math.ceil((it.totalSold / analysisDays) * effectiveForecastDays),
      }))
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 40);
  }, [invoices, analysisDays, effectiveForecastDays]);

  // ── Auto-populate ingredient config with AI estimates for new items ──
  useEffect(() => {
    if (!configLoaded) return;
    const updates = {};
    for (const item of topItems) {
      if (!ingredientConfig[item.name]) {
        const est = estimateIngredients(item.name);
        if (est.length > 0) updates[item.name] = est;
      }
    }
    if (Object.keys(updates).length > 0) {
      setIngredientConfig(prev => ({ ...prev, ...updates }));
    }
  }, [topItems, configLoaded]);

  // ── Save config to Firestore ──
  const saveConfig = useCallback(async (config) => {
    if (!uid) return;
    try {
      await setDoc(doc(db, "businesses", uid, "posConfig", "groceryIngredients"), config, { merge: true });
    } catch (e) { console.error(e); }
  }, [uid]);

  const updateIngredients = useCallback((itemName, ings) => {
    setIngredientConfig(prev => {
      const updated = { ...prev, [itemName]: ings };
      saveConfig(updated);
      return updated;
    });
  }, [saveConfig]);

  const applyAIEstimate = useCallback((itemName) => {
    const est = estimateIngredients(itemName);
    if (est.length === 0) {
      showToast("No AI estimate available for this item. Add ingredients manually.", "error");
      return;
    }
    updateIngredients(itemName, est);
    showToast(`Applied AI estimate for "${itemName}"`);
  }, [updateIngredients, showToast]);

  // ── Compute grocery list ──
  const groceryList = useMemo(() => {
    const map = {};
    for (const item of topItems) {
      if (item.forecastQty <= 0) continue;
      const ings = ingredientConfig[item.name] || [];
      for (const ing of ings) {
        const key = `${ing.name}__${ing.unit}`;
        if (!map[key]) {
          map[key] = {
            name: ing.name,
            unit: ing.unit,
            category: ing.category || "Other",
            totalQty: 0,
            sources: [],
          };
        }
        const qty = ing.qtyPerUnit * item.forecastQty;
        map[key].totalQty += qty;
        map[key].sources.push({ item: item.name, qty: parseFloat(qty.toFixed(2)) });
      }
    }

    // Add manual items
    for (const m of manualItems) {
      const key = `${m.name}__${m.unit}__manual`;
      map[key] = {
        name: m.name,
        unit: m.unit || "pcs",
        category: m.category || "Other",
        totalQty: m.qty || 1,
        sources: [{ item: "Manual", qty: m.qty || 1 }],
        manual: true,
        manualId: m.id,
      };
    }

    return Object.values(map).map(it => ({
      ...it,
      totalQty: parseFloat(it.totalQty.toFixed(2)),
    }));
  }, [topItems, ingredientConfig, manualItems]);

  // ── Filtered + sorted grocery list ──
  const displayList = useMemo(() => {
    let list = groceryList;
    if (grocerySearch.trim()) {
      const q = grocerySearch.toLowerCase();
      list = list.filter(it =>
        it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q)
      );
    }
    if (sortBy === "category") return [...list].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    if (sortBy === "qty") return [...list].sort((a, b) => b.totalQty - a.totalQty);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [groceryList, grocerySearch, sortBy]);

  // ── Group by category ──
  const groupedList = useMemo(() => {
    const groups = {};
    for (const item of displayList) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [displayList]);

  // ── Save grocery list ──
  const saveList = useCallback(async () => {
    if (!uid || groceryList.length === 0) return;
    setSaving(true);
    try {
      const listId = `list_${Date.now()}`;
      await setDoc(doc(db, "businesses", uid, "groceryLists", listId), {
        name: listName.trim() || `Grocery List — ${forecastDays}-day forecast`,
        items: groceryList.map(it => ({
          name: it.name, unit: it.unit, totalQty: it.totalQty, category: it.category,
        })),
        forecastDays,
        analysisDays,
        itemCount: topItems.length,
        createdAt: Date.now(),
      });
      setListName("");
      showToast("Grocery list saved!");
      setTab("saved");
    } catch (e) {
      showToast("Failed to save list", "error");
    } finally {
      setSaving(false);
    }
  }, [uid, groceryList, listName, forecastDays, analysisDays, topItems, showToast]);

  // ── Delete saved list ──
  const deleteList = useCallback(async (id) => {
    if (!uid) return;
    try {
      await deleteDoc(doc(db, "businesses", uid, "groceryLists", id));
      showToast("List deleted");
    } catch (_) { showToast("Failed to delete", "error"); }
  }, [uid, showToast]);

  // ── Print grocery list ──
  const printList = useCallback(() => {
    const rows = displayList.map(it =>
      `<tr style="border-bottom:1px solid #eee">
        <td style="padding:6px 8px">${it.name}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:bold">${it.totalQty}</td>
        <td style="padding:6px 8px;color:#666">${it.unit}</td>
        <td style="padding:6px 8px;color:#888;font-size:11px">${it.category}</td>
        <td style="padding:6px 8px;text-align:center">☐</td>
      </tr>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><title>Grocery List</title>
      <style>body{font-family:sans-serif;padding:20px}h2{color:#111}table{width:100%;border-collapse:collapse}th{background:#f3f4f6;padding:8px;text-align:left;font-size:12px}@media print{button{display:none}}</style>
      </head><body>
        <h2>🛒 Grocery List — ${forecastDays}-day Forecast</h2>
        <p style="color:#666;font-size:12px">Generated: ${new Date().toLocaleDateString("en-IN")} · Based on last ${analysisDays} days sales</p>
        <table><thead><tr><th>Ingredient</th><th>Qty</th><th>Unit</th><th>Category</th><th>✓</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <p style="margin-top:20px;font-size:11px;color:#aaa">Powered by FLYP POS</p>
      </body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    w.print();
  }, [displayList, forecastDays, analysisDays]);

  // ── Add manual item ──
  const addManualItem = useCallback(() => {
    setManualItems(prev => [...prev, { id: Date.now(), name: "", unit: "g", qty: 1, category: "Other" }]);
  }, []);
  const updateManualItem = useCallback((id, field, val) => {
    setManualItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it));
  }, []);
  const removeManualItem = useCallback((id) => {
    setManualItems(prev => prev.filter(it => it.id !== id));
  }, []);

  // effectiveForecastDays is now a useMemo above — kept as alias
  const _efd = effectiveForecastDays;
  const unconfiguredItems = topItems.filter(it => !ingredientConfig[it.name] || ingredientConfig[it.name].length === 0);
  const configuredItems   = topItems.filter(it => ingredientConfig[it.name]?.length > 0);

  // ── Image scan helpers ──
  const handleImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setScanPreview(ev.target.result);
    reader.readAsDataURL(file);
  }, []);

  const parseScanText = useCallback(() => {
    if (!scanText.trim()) return;
    setScanParsed(parseTextToItems(scanText));
  }, [scanText]);

  const addScanItemsToList = useCallback(() => {
    const valid = scanParsed.filter(it => it.name.trim());
    setManualItems(prev => [...prev, ...valid]);
    setScanText(""); setScanParsed([]); setScanPreview(null); setShowScan(false);
    showToast(`Added ${valid.length} items from scan!`);
  }, [scanParsed, showToast]);

  // ── Add manual item inline ──
  const [addForm, setAddForm] = useState({ name: "", qty: "", unit: "g", category: "Other" });
  const [showAddForm, setShowAddForm] = useState(false);
  const submitAddForm = useCallback(() => {
    if (!addForm.name.trim()) return;
    setManualItems(prev => [...prev, { id: Date.now(), ...addForm, qty: parseFloat(addForm.qty) || 1 }]);
    setAddForm({ name: "", qty: "", unit: "g", category: "Other" });
    setShowAddForm(false);
  }, [addForm]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={tc.bg}>
      <ToastPortal />

      {/* ── Header ── */}
      <div className={`shrink-0 px-5 pt-5 pb-0 border-b ${tc.borderSoft}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/25 flex items-center justify-center text-xl">🛒</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-base font-black ${tc.textPrimary}`}>Smart Grocery List</h1>
                <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-violet-500/15 text-violet-300 border border-violet-500/25 uppercase tracking-wider">AI Powered</span>
              </div>
              <p className={`text-[10px] ${tc.textMuted}`}>Predicts raw material needs from your sales data</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center">
              <p className={`text-lg font-black ${tc.textPrimary}`}>{topItems.length}</p>
              <p className={`text-[9px] ${tc.textMuted}`}>items tracked</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-emerald-300">{groceryList.length}</p>
              <p className={`text-[9px] ${tc.textMuted}`}>ingredients</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {[
            ["forecast",    "📊 Sales & Forecast"],
            ["ingredients", `🧪 Ingredients${unconfiguredItems.length > 0 ? ` (${unconfiguredItems.length} pending)` : ""}`],
            ["list",        `🛒 Grocery List${groceryList.length > 0 ? ` (${groceryList.length})` : ""}`],
            ["saved",       `💾 Saved${savedLists.length > 0 ? ` (${savedLists.length})` : ""}`],
          ].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                tab === k
                  ? "border-emerald-400 text-emerald-300"
                  : `border-transparent ${tc.textMuted} hover:text-white/70`
              }`}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ════════ TAB: SALES & FORECAST ════════ */}
          {tab === "forecast" && (
            <motion.div key="forecast"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="px-5 py-5 space-y-5"
            >
              {/* Forecast + Analysis controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Forecast days */}
                <div className={`rounded-2xl border p-4 ${tc.borderSoft} bg-white/[0.02]`}>
                  <p className={`text-xs font-bold mb-3 ${tc.textSub}`}>📅 Forecast Period</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {DAY_PRESETS.map(d => (
                      <button key={d} onClick={() => { setForecastDays(d); setCustomDays(""); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                          forecastDays === d && !customDays
                            ? "bg-emerald-500/25 border-emerald-500/50 text-emerald-200"
                            : `border-white/10 bg-white/4 ${tc.textMuted} hover:bg-white/8`
                        }`}
                      >{d}d</button>
                    ))}
                    <div className="flex items-center gap-1.5 border border-white/10 rounded-xl overflow-hidden">
                      <input
                        type="number" min="1" max="365"
                        value={customDays}
                        onChange={e => setCustomDays(e.target.value)}
                        placeholder="Custom"
                        className="w-16 px-2 py-1.5 bg-transparent text-xs focus:outline-none"
                        style={{ color: "white", WebkitTextFillColor: "white" }}
                      />
                      <span className={`pr-2 text-[10px] ${tc.textMuted}`}>days</span>
                    </div>
                  </div>
                  <p className={`text-[10px] mt-3 ${tc.textMuted}`}>
                    Forecasting requirements for <strong className="text-emerald-300">{customDays || forecastDays} days</strong>
                  </p>
                </div>

                {/* Analysis period */}
                <div className={`rounded-2xl border p-4 ${tc.borderSoft} bg-white/[0.02]`}>
                  <p className={`text-xs font-bold mb-3 ${tc.textSub}`}>📈 Sales Analysis Basis</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ANALYSIS_PRESETS.map(d => (
                      <button key={d} onClick={() => setAnalysisDays(d)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                          analysisDays === d
                            ? "bg-violet-500/25 border-violet-500/50 text-violet-200"
                            : `border-white/10 bg-white/4 ${tc.textMuted} hover:bg-white/8`
                        }`}
                      >{d}d</button>
                    ))}
                  </div>
                  <p className={`text-[10px] mt-3 ${tc.textMuted}`}>
                    Analysing last <strong className="text-violet-300">{analysisDays} days</strong> · {invoices.length} invoices found
                  </p>
                </div>
              </div>

              {/* Prediction model explainer */}
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-blue-500/6 border border-blue-500/12">
                <span className="text-lg shrink-0">🤖</span>
                <div>
                  <p className="text-xs font-bold text-blue-200 mb-0.5">How the Prediction Works</p>
                  <p className="text-[11px] text-blue-300/60 leading-relaxed">
                    Your sales data → daily velocity per item → × forecast days = expected servings →
                    × ingredient quantities = raw material needed. AI estimates ingredients for unconfigured items using item name recognition.
                  </p>
                </div>
              </div>

              {/* Top items table */}
              {loadingInv ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-7 h-7 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full" />
                  <p className={`text-xs ${tc.textMuted}`}>Analysing invoices…</p>
                </div>
              ) : topItems.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-40 gap-2 text-center rounded-2xl border ${tc.borderSoft} bg-white/[0.02]`}>
                  <div className="text-4xl opacity-15">📊</div>
                  <p className={`text-sm font-semibold ${tc.textSub}`}>No sales data found</p>
                  <p className={`text-xs max-w-xs ${tc.textMuted}`}>Create invoices first. The grocery list predicts based on past sales velocity.</p>
                </div>
              ) : (
                <div className={`rounded-2xl border overflow-hidden ${tc.borderSoft}`}>
                  <div className={`px-4 py-3 border-b ${tc.borderSoft} flex items-center justify-between`}>
                    <p className={`text-xs font-bold ${tc.textSub}`}>Top Selling Items · Forecast</p>
                    <span className={`text-[10px] ${tc.textMuted}`}>{customDays || forecastDays}-day prediction</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className={`border-b ${tc.borderSoft}`}>
                          {["Item", "Sold (period)", "Daily Rate", `Est. ${customDays || forecastDays}d`, "Ingredients", ""].map((h, i) => (
                            <th key={i} className={`px-4 py-2.5 text-left font-semibold ${tc.textMuted} ${i >= 4 ? "text-center" : ""}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {topItems.map((item, idx) => {
                          const hasConfig = (ingredientConfig[item.name]?.length || 0) > 0;
                          const conf = estimationConfidence(item.name);
                          return (
                            <tr key={item.name} className={`border-b last:border-0 ${tc.borderSoft} hover:bg-white/3 transition`}>
                              <td className="px-4 py-2.5">
                                <span className={`font-semibold ${tc.textPrimary}`}>{item.name}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`font-bold ${tc.textPrimary}`}>{item.totalSold}</span>
                                <span className={`ml-1 ${tc.textMuted}`}>units</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-violet-300 font-bold">{item.dailyRate}</span>
                                <span className={`ml-1 ${tc.textMuted}`}>/day</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-emerald-300 font-black">{item.forecastQty}</span>
                                <span className={`ml-1 ${tc.textMuted}`}>units</span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {hasConfig ? (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                                    ✓ {ingredientConfig[item.name].length} items
                                  </span>
                                ) : (
                                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                    conf !== "none"
                                      ? "bg-amber-500/15 text-amber-300 border-amber-500/25"
                                      : "bg-white/6 text-white/35 border-white/10"
                                  }`}>
                                    {conf !== "none" ? "AI ready" : "Not set"}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <button onClick={() => { setTab("ingredients"); setExpandedItem(item.name); }}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${tc.borderSoft} ${tc.textMuted} hover:bg-white/8`}
                                >Configure</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* CTA to generate list */}
              {groceryList.length > 0 && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setTab("list")}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-black text-sm shadow-[0_4px_24px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
                >
                  🛒 View Generated Grocery List ({groceryList.length} ingredients)
                </motion.button>
              )}
            </motion.div>
          )}

          {/* ════════ TAB: INGREDIENTS CONFIG ════════ */}
          {tab === "ingredients" && (
            <motion.div key="ingredients"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="px-5 py-5 space-y-3"
            >
              {/* Unconfigured warning */}
              {unconfiguredItems.length > 0 && (
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/8 border border-amber-500/20 mb-4">
                  <span className="text-lg shrink-0">⚠️</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-amber-200 mb-0.5">{unconfiguredItems.length} items without ingredients</p>
                    <p className="text-[11px] text-amber-300/60">These items won't be included in the grocery list. Click "AI Estimate" to auto-populate, or add manually.</p>
                  </div>
                  <button
                    onClick={() => {
                      const updates = {};
                      for (const item of unconfiguredItems) {
                        const est = estimateIngredients(item.name);
                        if (est.length > 0) updates[item.name] = est;
                      }
                      if (Object.keys(updates).length > 0) {
                        setIngredientConfig(prev => {
                          const updated = { ...prev, ...updates };
                          saveConfig(updated);
                          return updated;
                        });
                        showToast(`AI estimated ${Object.keys(updates).length} items!`);
                      } else {
                        showToast("No AI estimates available. Add manually.", "error");
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-amber-500/20 border border-amber-500/30 text-amber-200 hover:bg-amber-500/30 transition shrink-0"
                  >✨ Estimate All</button>
                </div>
              )}

              {topItems.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-40 gap-2 text-center rounded-2xl border ${tc.borderSoft} bg-white/[0.02]`}>
                  <div className="text-4xl opacity-15">🧪</div>
                  <p className={`text-sm font-semibold ${tc.textSub}`}>No items to configure</p>
                  <p className={`text-xs ${tc.textMuted}`}>Go to Sales & Forecast tab first to analyse your sales data</p>
                </div>
              ) : (
                topItems.map(item => {
                  const ings = ingredientConfig[item.name] || [];
                  const conf = estimationConfidence(item.name);
                  const isExpanded = expandedItem === item.name;

                  return (
                    <div key={item.name}
                      className={`rounded-2xl border overflow-hidden transition-all ${tc.borderSoft} ${
                        ings.length > 0 ? "bg-white/[0.03]" : "bg-white/[0.015]"
                      }`}
                    >
                      {/* Item header */}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                        onClick={() => setExpandedItem(isExpanded ? null : item.name)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${tc.textPrimary}`}>{item.name}</p>
                          <p className={`text-[10px] ${tc.textMuted}`}>
                            Forecast: <span className="text-emerald-300 font-bold">{item.forecastQty}</span> units ·{" "}
                            {ings.length > 0
                              ? <span className="text-emerald-300">{ings.length} ingredients configured</span>
                              : <span className="text-amber-300/70">No ingredients set</span>
                            }
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {conf !== "none" && ings.length === 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black border ${
                              conf === "high"
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                                : "bg-amber-500/15 text-amber-300 border-amber-500/25"
                            }`}>
                              {conf === "high" ? "✨ AI ready" : "AI partial"}
                            </span>
                          )}
                          <span className={`text-xs transition-transform ${isExpanded ? "rotate-90" : ""} ${tc.textMuted}`}>▶</span>
                        </div>
                      </button>

                      {/* Expanded config */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`border-t ${tc.borderSoft} overflow-hidden`}
                          >
                            <div className="px-4 pt-3 pb-4 space-y-2">
                              {/* Column headers */}
                              {ings.length > 0 && (
                                <div className="flex items-center gap-2 pb-1">
                                  <span className={`flex-1 text-[9px] font-bold uppercase tracking-wider ${tc.textMuted}`}>Ingredient</span>
                                  <span className={`w-16 text-[9px] font-bold uppercase tracking-wider text-right ${tc.textMuted}`}>Qty/Unit</span>
                                  <span className={`w-14 text-[9px] font-bold uppercase tracking-wider ${tc.textMuted}`}>Unit</span>
                                  <span className={`w-28 hidden sm:block text-[9px] font-bold uppercase tracking-wider ${tc.textMuted}`}>Category</span>
                                  <span className="w-6" />
                                </div>
                              )}

                              {ings.map((ing, idx) => (
                                <IngredientRow
                                  key={idx}
                                  ing={ing}
                                  onChange={updated => {
                                    const newIngs = [...ings];
                                    newIngs[idx] = updated;
                                    updateIngredients(item.name, newIngs);
                                  }}
                                  onRemove={() => {
                                    const newIngs = ings.filter((_, i) => i !== idx);
                                    updateIngredients(item.name, newIngs);
                                  }}
                                />
                              ))}

                              {/* Actions */}
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={() => updateIngredients(item.name, [...ings, { name: "", unit: "g", qtyPerUnit: 0, category: "Other" }])}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border ${tc.borderSoft} ${tc.textMuted} hover:bg-white/8 transition`}
                                >+ Add Ingredient</button>

                                {conf !== "none" && (
                                  <button
                                    onClick={() => applyAIEstimate(item.name)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/25 transition"
                                  >✨ AI Estimate</button>
                                )}

                                {ings.length > 0 && (
                                  <button
                                    onClick={() => updateIngredients(item.name, [])}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-red-500/10 border border-red-500/15 text-red-400 hover:bg-red-500/20 transition ml-auto"
                                  >Clear All</button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* ════════ TAB: GROCERY LIST ════════ */}
          {tab === "list" && (
            <motion.div key="list"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="flex flex-col h-full"
            >
              {/* Toolbar */}
              <div className={`px-5 py-3 border-b ${tc.borderSoft} flex items-center gap-3 shrink-0`}>
                {/* Search */}
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>🔍</span>
                  <input value={grocerySearch} onChange={e => setGrocerySearch(e.target.value)}
                    placeholder="Search ingredients…" autoComplete="off"
                    className={`w-full pl-7 pr-3 py-2 rounded-xl text-xs border outline-none focus:ring-1 focus:ring-emerald-400/40 ${tc.borderSoft}`}
                    style={{ background: "rgba(255,255,255,0.05)", color: "white", WebkitTextFillColor: "white" }}
                  />
                </div>

                {/* Sort */}
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className={`px-2.5 py-2 rounded-xl text-xs border outline-none ${tc.borderSoft} shrink-0`}
                  style={{ background: "rgba(255,255,255,0.05)", color: "white" }}
                >
                  <option value="category">By Category</option>
                  <option value="qty">By Quantity</option>
                  <option value="name">By Name</option>
                </select>

                {/* Actions */}
                <button onClick={printList}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition shrink-0 ${tc.borderSoft} ${tc.textMuted} hover:bg-white/8`}
                >🖨️ Print</button>
              </div>

              {/* Info + Action bar */}
              <div className={`px-5 py-2.5 border-b ${tc.borderSoft} shrink-0 flex items-center gap-3 flex-wrap`}>
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-300/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {effectiveForecastDays}-day forecast · {analysisDays}-day analysis
                </span>
                <span className={`text-[10px] ${tc.textMuted}`}>{configuredItems.length}/{topItems.length} configured · {groceryList.length} ingredients</span>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={() => setShowScan(true)}
                    className="px-3 py-1 rounded-xl text-[10px] font-bold bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/25 transition flex items-center gap-1"
                  >📷 Scan Image</button>
                  <button onClick={() => { setShowAddForm(true); }}
                    className="px-3 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 transition"
                  >+ Add Item</button>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

                {groceryList.length === 0 && manualItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                    <div className="text-5xl opacity-15">🛒</div>
                    <p className={`text-sm font-semibold ${tc.textSub}`}>No grocery items yet</p>
                    <p className={`text-xs max-w-xs ${tc.textMuted}`}>
                      Configure ingredients for your top-selling items in the Ingredients tab, then come back here.
                    </p>
                    <button onClick={() => setTab("ingredients")}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition"
                    >Configure Ingredients →</button>
                  </div>
                ) : sortBy === "category" ? (
                  // Grouped by category
                  Object.entries(groupedList).map(([cat, items]) => (
                    <div key={cat} className={`rounded-2xl border overflow-hidden ${tc.borderSoft}`}>
                      <button
                        className={`w-full flex items-center gap-3 px-4 py-3 border-b ${tc.borderSoft} bg-white/[0.02] hover:bg-white/[0.04] transition`}
                        onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
                      >
                        <span className="text-base">{catIcon(cat)}</span>
                        <span className={`text-xs font-bold flex-1 text-left ${tc.textSub}`}>{cat}</span>
                        <span className={`text-[10px] ${tc.textMuted}`}>{items.length} items</span>
                        <span className={`text-xs transition-transform ${expandedCat === cat ? "" : "-rotate-90"} ${tc.textMuted}`}>▾</span>
                      </button>

                      <AnimatePresence>
                        {expandedCat !== cat && (
                          <motion.div
                            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            {items.map((it, i) => (
                              <div key={it.name + i} className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-0 ${tc.borderSoft} group`}>
                                <button
                                  onClick={() => setCheckedItems(prev => {
                                    const next = new Set(prev);
                                    const key = it.name + it.unit;
                                    next.has(key) ? next.delete(key) : next.add(key);
                                    return next;
                                  })}
                                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${
                                    checkedItems.has(it.name + it.unit)
                                      ? "bg-emerald-500 border-emerald-400"
                                      : "border-white/25 hover:border-white/50"
                                  }`}
                                >
                                  {checkedItems.has(it.name + it.unit) && <span className="text-white text-[8px]">✓</span>}
                                </button>
                                <span className={`flex-1 text-xs font-medium truncate ${
                                  checkedItems.has(it.name + it.unit) ? "line-through opacity-40" : tc.textPrimary
                                }`}>{it.name}</span>
                                <span className={`text-sm font-black ${tc.textPrimary}`}>{it.totalQty}</span>
                                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${unitBadge(it.unit)}`}>{it.unit}</span>
                                {it.manual && (
                                  <button onClick={() => removeManualItem(it.manualId)}
                                    className="w-5 h-5 rounded-lg bg-red-500/10 text-red-400 text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                  >✕</button>
                                )}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                ) : (
                  // Flat list (sort by qty or name)
                  <div className={`rounded-2xl border overflow-hidden ${tc.borderSoft}`}>
                    {displayList.map((it, i) => (
                      <div key={it.name + i} className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-0 ${tc.borderSoft} group`}>
                        <button
                          onClick={() => setCheckedItems(prev => {
                            const next = new Set(prev);
                            const key = it.name + it.unit;
                            next.has(key) ? next.delete(key) : next.add(key);
                            return next;
                          })}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${
                            checkedItems.has(it.name + it.unit)
                              ? "bg-emerald-500 border-emerald-400"
                              : "border-white/25 hover:border-white/50"
                          }`}
                        >
                          {checkedItems.has(it.name + it.unit) && <span className="text-white text-[8px]">✓</span>}
                        </button>
                        <span className={`flex-1 text-xs font-medium truncate ${
                          checkedItems.has(it.name + it.unit) ? "line-through opacity-40" : tc.textPrimary
                        }`}>{it.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border mr-1 ${catColor(it.category)}`}>{it.category}</span>
                        <span className={`text-sm font-black ${tc.textPrimary}`}>{it.totalQty}</span>
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${unitBadge(it.unit)}`}>{it.unit}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Add Item inline form ── */}
                <AnimatePresence>
                  {showAddForm && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className={`rounded-2xl border p-4 space-y-3 ${tc.borderSoft} bg-emerald-500/5`}
                    >
                      <p className="text-xs font-black text-emerald-300">➕ Add Item Manually</p>
                      <input
                        autoFocus
                        value={addForm.name}
                        onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && submitAddForm()}
                        placeholder="Item name  (e.g. Tomatoes, Basmati Rice, Oil…)"
                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/6 border border-white/10 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 placeholder:text-white/25"
                        style={{ color: "white", WebkitTextFillColor: "white" }}
                      />
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 flex-1">
                          <label className={`text-[10px] font-bold shrink-0 ${tc.textMuted}`}>Qty</label>
                          <input
                            type="number" min="0.01" step="0.01"
                            value={addForm.qty}
                            onChange={e => setAddForm(f => ({ ...f, qty: e.target.value }))}
                            placeholder="1"
                            className="flex-1 px-2.5 py-2 rounded-xl text-xs bg-white/6 border border-white/10 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 text-right"
                            style={{ color: "white", WebkitTextFillColor: "white" }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 flex-1">
                          <label className={`text-[10px] font-bold shrink-0 ${tc.textMuted}`}>Unit</label>
                          <select value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))}
                            className="flex-1 px-2 py-2 rounded-xl text-xs bg-white/6 border border-white/10 focus:outline-none"
                            style={{ color: "white", WebkitTextFillColor: "white" }}
                          >
                            {["g","kg","ml","L","pcs","dozen","tsp","tbsp","cup"].map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1">
                          <label className={`text-[10px] font-bold shrink-0 ${tc.textMuted}`}>Category</label>
                          <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                            className="flex-1 px-2 py-2 rounded-xl text-xs bg-white/6 border border-white/10 focus:outline-none"
                            style={{ color: "white", WebkitTextFillColor: "white" }}
                          >
                            {INGREDIENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setShowAddForm(false); setAddForm({ name: "", qty: "", unit: "g", category: "Other" }); }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border ${tc.borderSoft} ${tc.textMuted} hover:bg-white/8 transition`}
                        >Cancel</button>
                        <button onClick={submitAddForm} disabled={!addForm.name.trim()}
                          className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-white transition disabled:opacity-40"
                        >Add to List →</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Existing manual items — pill display ── */}
                {manualItems.length > 0 && (
                  <div className={`rounded-2xl border overflow-hidden ${tc.borderSoft} bg-white/[0.02]`}>
                    <div className={`px-4 py-2.5 border-b ${tc.borderSoft} flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📝</span>
                        <span className={`text-xs font-bold ${tc.textSub}`}>Added Manually</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-white/8 ${tc.textMuted}`}>{manualItems.length}</span>
                      </div>
                    </div>
                    <div className="px-4 py-3 flex flex-wrap gap-2">
                      {manualItems.map(item => (
                        <div key={item.id}
                          className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-xl border ${tc.borderSoft} bg-white/4 group`}
                        >
                          <span className={`text-xs font-semibold ${tc.textPrimary}`}>{item.name || "(no name)"}</span>
                          <span className={`text-[10px] ${tc.textMuted}`}>·</span>
                          <span className="text-xs font-bold text-emerald-300">{item.qty}</span>
                          <span className={`text-[10px] ${tc.textMuted}`}>{item.unit}</span>
                          <button onClick={() => removeManualItem(item.id)}
                            className="ml-1 w-4 h-4 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[8px] flex items-center justify-center transition"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Image scan drawer ── */}
                <AnimatePresence>
                  {showScan && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.18 }}
                      className={`rounded-2xl border overflow-hidden ${tc.borderSoft} bg-violet-500/5`}
                    >
                      <div className={`px-4 py-3 border-b ${tc.borderSoft} flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                          <span className="text-base">📷</span>
                          <span className="text-xs font-black text-violet-300">Scan Grocery List from Image</span>
                        </div>
                        <button onClick={() => { setShowScan(false); setScanPreview(null); setScanText(""); setScanParsed([]); }}
                          className={`text-xs ${tc.textMuted} hover:text-white transition`}
                        >✕ Close</button>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Upload area */}
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-violet-500/30 rounded-xl cursor-pointer hover:border-violet-500/50 hover:bg-violet-500/5 transition"
                        >
                          {scanPreview ? (
                            <img src={scanPreview} alt="scan" className="max-h-40 rounded-xl object-contain" />
                          ) : (
                            <>
                              <span className="text-3xl opacity-40">🖼️</span>
                              <p className={`text-xs ${tc.textMuted}`}>Click to upload photo of your grocery list</p>
                              <p className={`text-[10px] ${tc.textMuted} opacity-60`}>Works with handwritten or printed lists</p>
                            </>
                          )}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

                        {/* Text area */}
                        <div>
                          <p className={`text-[10px] font-bold mb-1.5 ${tc.textMuted}`}>
                            Type items from your image — one per line
                          </p>
                          <p className={`text-[9px] mb-2 ${tc.textMuted} opacity-60`}>
                            Formats: &quot;Sugar 2 kg&quot; · &quot;Milk - 3 litres&quot; · &quot;50 g Cardamom&quot; · just &quot;Tomatoes&quot;
                          </p>
                          <textarea
                            rows={5}
                            value={scanText}
                            onChange={e => setScanText(e.target.value)}
                            placeholder={"Sugar 2 kg\nMilk 3 litres\nOnion 500 g\nCooking Oil 1 L\nCardamom"}
                            className="w-full px-3 py-2.5 rounded-xl text-xs bg-white/6 border border-white/10 focus:outline-none focus:ring-1 focus:ring-violet-400/50 placeholder:text-white/20 resize-none"
                            style={{ color: "white", WebkitTextFillColor: "white" }}
                          />
                          <button onClick={parseScanText}
                            className="mt-2 px-4 py-2 rounded-xl text-xs font-black bg-violet-500/20 border border-violet-500/30 text-violet-200 hover:bg-violet-500/30 transition"
                          >✨ Parse Items</button>
                        </div>

                        {/* Parsed preview */}
                        {scanParsed.length > 0 && (
                          <div>
                            <p className={`text-[10px] font-bold mb-2 ${tc.textMuted}`}>Parsed {scanParsed.length} items — review before adding:</p>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {scanParsed.map((it, i) => (
                                <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-xl bg-violet-500/15 border border-violet-500/25 text-xs text-violet-200">
                                  <span className="font-semibold">{it.name}</span>
                                  <span className="opacity-60">·</span>
                                  <span className="font-black text-violet-100">{it.qty}{it.unit}</span>
                                  <button onClick={() => setScanParsed(prev => prev.filter((_, pi) => pi !== i))}
                                    className="ml-0.5 text-[8px] text-violet-400 hover:text-red-300 transition"
                                  >✕</button>
                                </span>
                              ))}
                            </div>
                            <button onClick={addScanItemsToList}
                              className="w-full py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/20 hover:opacity-90 transition"
                            >Add {scanParsed.length} Items to Grocery List →</button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Save footer */}
              {groceryList.length > 0 && (
                <div className={`shrink-0 px-5 py-3 border-t ${tc.borderSoft} flex items-center gap-3`}>
                  <input value={listName} onChange={e => setListName(e.target.value)}
                    placeholder={`List name (e.g. "Week 3 Grocery")`}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs border outline-none focus:ring-1 focus:ring-emerald-400/40 ${tc.borderSoft}`}
                    style={{ background: "rgba(255,255,255,0.05)", color: "white", WebkitTextFillColor: "white" }}
                  />
                  <motion.button whileTap={{ scale: 0.96 }} onClick={saveList} disabled={saving}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-white transition shadow-lg shadow-emerald-500/25 disabled:opacity-60 shrink-0"
                  >{saving ? "Saving…" : "💾 Save List"}</motion.button>
                </div>
              )}
            </motion.div>
          )}

          {/* ════════ TAB: SAVED LISTS ════════ */}
          {tab === "saved" && (
            <motion.div key="saved"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="px-5 py-5 space-y-3"
            >
              {savedLists.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-48 gap-2 text-center rounded-2xl border ${tc.borderSoft} bg-white/[0.02]`}>
                  <div className="text-4xl opacity-15">💾</div>
                  <p className={`text-sm font-semibold ${tc.textSub}`}>No saved lists yet</p>
                  <p className={`text-xs ${tc.textMuted}`}>Generate and save a grocery list to access it here anytime</p>
                </div>
              ) : (
                savedLists.map(list => (
                  <div key={list.id} className={`rounded-2xl border overflow-hidden ${tc.borderSoft} bg-white/[0.02]`}>
                    <div className="px-4 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-base shrink-0">🛒</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${tc.textPrimary}`}>{list.name}</p>
                        <p className={`text-[10px] ${tc.textMuted}`}>
                          {new Date(list.createdAt).toLocaleDateString("en-IN")} ·{" "}
                          {list.items?.length || 0} ingredients · {list.forecastDays}-day forecast
                        </p>
                      </div>
                      <button onClick={() => deleteList(list.id)}
                        className="w-7 h-7 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 text-red-400 text-xs flex items-center justify-center transition shrink-0"
                      >🗑️</button>
                    </div>

                    {/* Items preview */}
                    <div className={`border-t ${tc.borderSoft} px-4 py-3`}>
                      <div className="flex flex-wrap gap-1.5">
                        {(list.items || []).slice(0, 8).map((it, i) => (
                          <span key={i} className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${catColor(it.category)}`}>
                            {it.name} · {it.totalQty}{it.unit}
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
                ))
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
