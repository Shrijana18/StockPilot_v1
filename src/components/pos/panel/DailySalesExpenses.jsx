import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db, auth } from "../../../firebase/firebaseConfig";
import { usePOSTheme } from "../POSThemeContext";

const getUid = () => auth.currentUser?.uid;
const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DailySalesExpenses() {
  const { tc } = usePOSTheme();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form state
  const [formType, setFormType] = useState("sale"); // sale | expense
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPaymentMode, setFormPaymentMode] = useState("cash");
  const [saving, setSaving] = useState(false);

  // Reactive uid — covers auth race when component mounts before IndexedDB restores
  const [uid, setUid] = useState(() => getUid() || null);
  useEffect(() => auth.onAuthStateChanged(u => setUid(u?.uid || null)), []);

  // Load entries from Firestore
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const entriesRef = collection(db, "businesses", uid, "dailyEntries");
    const q = query(entriesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          if (b.date !== a.date) return (b.date || "").localeCompare(a.date || "");
          return (b.createdAt || 0) - (a.createdAt || 0);
        });
      setEntries(data);
      setLoading(false);
    }, (error) => {
      console.warn("Error loading entries:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  // Filter entries by selected date
  const filteredEntries = useMemo(() => {
    return entries.filter(e => e.date === selectedDate);
  }, [entries, selectedDate]);

  // Calculate totals for selected date
  const dayTotals = useMemo(() => {
    const sales = filteredEntries.filter(e => e.type === "sale").reduce((s, e) => s + Number(e.amount || 0), 0);
    const expenses = filteredEntries.filter(e => e.type === "expense").reduce((s, e) => s + Number(e.amount || 0), 0);
    const netProfit = sales - expenses;
    return { sales, expenses, netProfit };
  }, [filteredEntries]);

  // Calculate week totals
  const weekTotals = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    
    const weekEntries = entries.filter(e => e.date >= weekAgoStr);
    const sales = weekEntries.filter(e => e.type === "sale").reduce((s, e) => s + Number(e.amount || 0), 0);
    const expenses = weekEntries.filter(e => e.type === "expense").reduce((s, e) => s + Number(e.amount || 0), 0);
    return { sales, expenses, netProfit: sales - expenses };
  }, [entries]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const categories = {};
    filteredEntries.forEach(e => {
      const cat = e.category || "Other";
      if (!categories[cat]) categories[cat] = { sales: 0, expenses: 0 };
      if (e.type === "sale") categories[cat].sales += Number(e.amount || 0);
      else categories[cat].expenses += Number(e.amount || 0);
    });
    return Object.entries(categories).map(([name, data]) => ({
      name,
      sales: data.sales,
      expenses: data.expenses,
      net: data.sales - data.expenses
    })).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [filteredEntries]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormType("sale");
    setFormAmount("");
    setFormCategory("");
    setFormDescription("");
    setFormPaymentMode("cash");
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setFormType(entry.type);
    setFormAmount(String(entry.amount));
    setFormCategory(entry.category || "");
    setFormDescription(entry.description || "");
    setFormPaymentMode(entry.paymentMode || "cash");
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    const uid = getUid();
    if (!uid) return;
    
    try {
      await deleteDoc(doc(db, "businesses", uid, "dailyEntries", id));
    } catch (error) {
      console.error("Error deleting entry:", error);
      alert("Failed to delete entry");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const uid = getUid();
    if (!uid) return;

    const amount = Number(formAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      const entryData = {
        type: formType,
        amount,
        category: formCategory.trim() || (formType === "sale" ? "Sales" : "General"),
        description: formDescription.trim(),
        paymentMode: formPaymentMode,
        date: selectedDate,
        updatedAt: Date.now(),
      };

      if (editingId) {
        await updateDoc(doc(db, "businesses", uid, "dailyEntries", editingId), entryData);
      } else {
        await addDoc(collection(db, "businesses", uid, "dailyEntries"), {
          ...entryData,
          createdAt: Date.now(),
        });
      }

      resetForm();
    } catch (error) {
      console.error("Error saving entry:", error);
      alert("Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={tc.bg}>
      {/* Header */}
      <div className={`px-6 pt-5 pb-4 shrink-0 border-b ${tc.borderSoft}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl">📊</span>
              <h1 className={`text-xl font-black tracking-tight ${tc.textPrimary}`}>Daily Sales & Expenses</h1>
            </div>
            <p className={`text-[11px] ${tc.textMuted}`}>Track daily revenue and expenses manually</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-bold shadow-lg transition"
          >
            + Add Entry
          </button>
        </div>

        {/* Date selector */}
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={`px-3 py-2 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400/40 ${tc.inputBg}`}
          />
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${tc.outlineBtn}`}
          >
            Today
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="px-6 py-4 shrink-0 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💰</span>
            <p className={`text-[10px] uppercase tracking-wider font-bold ${tc.textMuted}`}>Sales</p>
          </div>
          <p className="text-2xl font-black text-emerald-300">{fmt(dayTotals.sales)}</p>
          <p className={`text-[9px] mt-1 ${tc.textMuted}`}>7-day: {fmt(weekTotals.sales)}</p>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">💸</span>
            <p className={`text-[10px] uppercase tracking-wider font-bold ${tc.textMuted}`}>Expenses</p>
          </div>
          <p className="text-2xl font-black text-red-300">{fmt(dayTotals.expenses)}</p>
          <p className={`text-[9px] mt-1 ${tc.textMuted}`}>7-day: {fmt(weekTotals.expenses)}</p>
        </div>

        <div className={`rounded-2xl border p-4 ${dayTotals.netProfit >= 0 ? "border-blue-500/20 bg-blue-500/10" : "border-orange-500/20 bg-orange-500/10"}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{dayTotals.netProfit >= 0 ? "📈" : "📉"}</span>
            <p className={`text-[10px] uppercase tracking-wider font-bold ${tc.textMuted}`}>Net Profit</p>
          </div>
          <p className={`text-2xl font-black ${dayTotals.netProfit >= 0 ? "text-blue-300" : "text-orange-300"}`}>
            {fmt(dayTotals.netProfit)}
          </p>
          <p className={`text-[9px] mt-1 ${tc.textMuted}`}>7-day: {fmt(weekTotals.netProfit)}</p>
        </div>
      </div>

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <div className={`mx-6 mb-4 rounded-2xl border p-4 ${tc.cardBg}`}>
          <h3 className={`text-sm font-bold mb-3 ${tc.textSub}`}>Category Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {categoryBreakdown.map((cat, i) => (
              <div key={i} className={`rounded-xl border p-2 ${tc.borderSoft}`}>
                <p className={`text-xs font-semibold truncate ${tc.textSub}`}>{cat.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-emerald-300">+{fmt(cat.sales)}</span>
                  <span className="text-[10px] text-red-300">-{fmt(cat.expenses)}</span>
                </div>
                <p className={`text-xs font-bold mt-0.5 ${cat.net >= 0 ? "text-blue-300" : "text-orange-300"}`}>
                  {fmt(cat.net)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-5xl mb-3 opacity-10">📝</div>
            <p className={`text-sm ${tc.textMuted}`}>No entries for {new Date(selectedDate).toLocaleDateString()}</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 transition underline"
            >
              Add your first entry
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEntries.map((entry, idx) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`rounded-xl border p-3 hover:shadow-md transition ${tc.cardBg}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        entry.type === "sale" 
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}>
                        {entry.type === "sale" ? "💰 Sale" : "💸 Expense"}
                      </span>
                      <span className={`text-xs font-semibold ${tc.textSub}`}>{entry.category}</span>
                    </div>
                    {entry.description && (
                      <p className={`text-xs mb-1 ${tc.textMuted}`}>{entry.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className={tc.textMuted}>
                        {entry.paymentMode === "cash" ? "💵 Cash" : 
                         entry.paymentMode === "upi" ? "📲 UPI" :
                         entry.paymentMode === "card" ? "💳 Card" : "🔄 Other"}
                      </span>
                      <span className={tc.textMuted}>
                        {new Date(entry.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-none">
                    <p className={`text-lg font-black ${entry.type === "sale" ? "text-emerald-300" : "text-red-300"}`}>
                      {entry.type === "sale" ? "+" : "-"}{fmt(entry.amount)}
                    </p>
                    <button
                      onClick={() => handleEdit(entry)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${tc.editBtn}`}
                      title="Edit"
                    >✏️</button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 flex items-center justify-center transition text-sm"
                      title="Delete"
                    >🗑️</button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${tc.overlayBg}`}
            onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden backdrop-blur-2xl ${tc.modalBg}`}
            >
              <div className={`px-6 py-4 border-b flex items-center justify-between ${tc.borderSoft}`}>
                <h3 className={`text-base font-black ${tc.textPrimary}`}>
                  {editingId ? "Edit Entry" : "Add Entry"}
                </h3>
                <button
                  onClick={resetForm}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${tc.editBtn}`}
                >✕</button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Type selector */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${tc.textMuted}`}>Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormType("sale")}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition ${
                        formType === "sale"
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                          : `${tc.outlineBtn}`
                      }`}
                    >💰 Sale</button>
                    <button
                      type="button"
                      onClick={() => setFormType("expense")}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition ${
                        formType === "expense"
                          ? "bg-red-500/20 border-red-500/50 text-red-300"
                          : `${tc.outlineBtn}`
                      }`}
                    >💸 Expense</button>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${tc.textMuted}`}>Amount (₹)</label>
                  <input
                    type="number"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                    className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400/40 ${tc.inputBg}`}
                  />
                </div>

                {/* Category */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${tc.textMuted}`}>Category</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder={formType === "sale" ? "e.g. Food, Beverages" : "e.g. Rent, Utilities, Groceries"}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 ${tc.inputBg}`}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${tc.textMuted}`}>Description (Optional)</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Add notes..."
                    rows={2}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 resize-none ${tc.inputBg}`}
                  />
                </div>

                {/* Payment Mode */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${tc.textMuted}`}>Payment Mode</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: "cash", icon: "💵", label: "Cash" },
                      { key: "upi", icon: "📲", label: "UPI" },
                      { key: "card", icon: "💳", label: "Card" },
                      { key: "other", icon: "🔄", label: "Other" },
                    ].map(pm => (
                      <button
                        key={pm.key}
                        type="button"
                        onClick={() => setFormPaymentMode(pm.key)}
                        className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-center transition ${
                          formPaymentMode === pm.key
                            ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                            : `${tc.cardBg} ${tc.textMuted} hover:bg-white/[0.07]`
                        }`}
                      >
                        <span className="text-base">{pm.icon}</span>
                        <span className="text-[9px] font-semibold">{pm.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className={`flex-1 py-2.5 rounded-xl text-sm transition ${tc.outlineBtn}`}
                    disabled={saving}
                  >Cancel</button>
                  <button
                    type="submit"
                    className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-bold shadow-lg transition disabled:opacity-50"
                    disabled={saving}
                  >
                    {saving ? "⏳ Saving..." : editingId ? "💾 Update" : "➕ Add Entry"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
