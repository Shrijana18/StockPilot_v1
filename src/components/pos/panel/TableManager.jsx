import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../../../firebase/firebaseConfig";
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot } from "firebase/firestore";

/**
 * TableManager - Quick table creation and management modal
 */
export default function TableManager({ open, onClose, onTableCreated, editingTable = null }) {
  const [tableNumber, setTableNumber] = React.useState("");
  const [tableName, setTableName] = React.useState("");
  const [capacity, setCapacity] = React.useState(4);
  const [zone, setZone] = React.useState("main");
  const [loading, setLoading] = React.useState(false);

  const getUid = () => auth.currentUser?.uid;

  // Populate form when editing
  React.useEffect(() => {
    if (open) {
      if (editingTable) {
        setTableNumber(editingTable.number?.toString() || "");
        setTableName(editingTable.name || "");
        setCapacity(editingTable.capacity || 4);
        setZone(editingTable.zone || "main");
      } else {
        setTableNumber("");
        setTableName("");
        setCapacity(4);
        setZone("main");
      }
    }
  }, [open, editingTable]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingTable && !tableNumber.trim()) return;

    const uid = getUid();
    if (!uid) return;

    setLoading(true);
    try {
      if (editingTable) {
        // Update existing table
        const tableRef = doc(db, "businesses", uid, "tables", editingTable.id);
        await updateDoc(tableRef, {
          name: tableName.trim() || `Table ${editingTable.number}`,
          capacity: parseInt(capacity, 10) || 4,
          zone: zone || "main",
          updatedAt: Date.now(),
        });
      } else {
        // Create new table
        const tablesRef = collection(db, "businesses", uid, "tables");
        await addDoc(tablesRef, {
          number: parseInt(tableNumber, 10),
          name: tableName.trim() || `Table ${tableNumber}`,
          capacity: parseInt(capacity, 10) || 4,
          status: "available",
          zone: zone || "main",
          createdAt: Date.now(),
        });
      }

      if (onTableCreated) onTableCreated();
      onClose();
      // Reset form
      setTableNumber("");
      setTableName("");
      setCapacity(4);
      setZone("main");
    } catch (e) {
      console.error(`Error ${editingTable ? 'updating' : 'creating'} table:`, e);
      const errorMessage = e.message || e.code || "Unknown error";
      alert(`Failed to ${editingTable ? 'update' : 'create'} table: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-6 shadow-2xl"
      >
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white">{editingTable ? "Edit Table" : "Add New Table"}</h2>
          <p className="text-sm text-white/60 mt-1">{editingTable ? "Update table details" : "Quick setup for your restaurant"}</p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {!editingTable && (
            <div>
              <label className="block text-sm font-medium text-white/90 mb-1.5">Table Number *</label>
              <input
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g., 1"
                required
                autoFocus
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition"
              />
            </div>
          )}
          {editingTable && (
            <div>
              <label className="block text-sm font-medium text-white/90 mb-1.5">Table Number</label>
              <div className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white/60">
                {editingTable.number}
              </div>
              <p className="text-xs text-white/50 mt-1">Table number cannot be changed</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/90 mb-1.5">Table Name (Optional)</label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Auto-generated if empty"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-1.5">Capacity</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                min="1"
                max="20"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-1.5">Zone</label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition"
              >
                <option value="main">Main</option>
                <option value="outdoor">Outdoor</option>
                <option value="vip">VIP</option>
                <option value="bar">Bar</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!editingTable && !tableNumber.trim())}
              className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 font-semibold text-white shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? (editingTable ? "Updating..." : "Creating...") : (editingTable ? "Update Table" : "Create Table")}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

