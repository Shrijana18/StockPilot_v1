import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../../../firebase/firebaseConfig";
import { collection, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { usePOSTheme } from "../POSThemeContext";

/**
 * TableManager - Quick table creation and management modal
 */
export default function TableManager({ open, onClose, onTableCreated, editingTable = null, existingTables = [] }) {
  const { tc } = usePOSTheme();
  const [tableNumber, setTableNumber] = React.useState("");
  const [tableName, setTableName] = React.useState("");
  const [capacity, setCapacity] = React.useState(4);
  const [zone, setZone] = React.useState("main");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

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
    setError("");
    if (!editingTable && !tableNumber.trim()) return;

    const normalizedZone = (zone || "main").trim().toLowerCase();

    // Duplicate check: same number + same zone (skip when editing the same table)
    if (!editingTable) {
      const dup = existingTables.some(
        t => parseInt(t.number) === parseInt(tableNumber) &&
             (t.zone || "main").toLowerCase() === normalizedZone
      );
      if (dup) {
        setError(`Table ${tableNumber} already exists in "${zone || "main"}" zone.`);
        return;
      }
    }

    const uid = getUid();
    if (!uid) return;

    setLoading(true);
    try {
      if (editingTable) {
        const tableRef = doc(db, "businesses", uid, "tables", editingTable.id);
        await updateDoc(tableRef, {
          name: tableName.trim() || `Table ${editingTable.number}`,
          capacity: parseInt(capacity, 10) || 4,
          zone: zone.trim() || "main",
          updatedAt: Date.now(),
        });
      } else {
        const tablesRef = collection(db, "businesses", uid, "tables");
        await addDoc(tablesRef, {
          number: parseInt(tableNumber, 10),
          name: tableName.trim() || `Table ${tableNumber}`,
          capacity: parseInt(capacity, 10) || 4,
          status: "available",
          zone: zone.trim() || "main",
          createdAt: Date.now(),
        });
      }

      if (onTableCreated) onTableCreated();
      onClose();
      setTableNumber(""); setTableName(""); setCapacity(4); setZone("main"); setError("");
    } catch (err) {
      console.error(`Error ${editingTable ? 'updating' : 'creating'} table:`, err);
      setError(`Failed to ${editingTable ? 'update' : 'create'} table: ${err.message || err.code}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const uid = getUid();
    if (!uid || !editingTable) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "businesses", uid, "tables", editingTable.id));
      if (onTableCreated) onTableCreated();
      onClose();
      setShowDeleteConfirm(false);
    } catch (err) {
      setError(`Failed to delete table: ${err.message || err.code}`);
    } finally {
      setLoading(false);
    }
  };

  // Derive unique zone names from existing tables for datalist suggestions
  const suggestedZones = [
    "Main", "Outdoor", "VIP", "Bar", "Private", "Terrace", "Rooftop", "Garden",
    ...Array.from(new Set(existingTables.map(t => t.zone).filter(Boolean)))
      .map(z => z.charAt(0).toUpperCase() + z.slice(1))
  ].filter((v, i, a) => a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i);

  return (
    <AnimatePresence>
      {open && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${tc.overlayBg}`} onClick={() => { onClose(); setShowDeleteConfirm(false); setError(""); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl backdrop-blur-xl ${tc.modalBg}`}
          >
            {/* Header */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className={`text-lg font-bold ${tc.textPrimary}`}>{editingTable ? "Edit Table" : "Add New Table"}</h2>
                <p className={`text-xs mt-0.5 ${tc.textMuted}`}>{editingTable ? `Table ${editingTable.number} · ${editingTable.zone || "main"}` : "Quick setup for your restaurant"}</p>
              </div>
              {editingTable && (
                <button type="button" onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 text-xs font-semibold border border-red-500/20 transition"
                >
                  🗑 Delete
                </button>
              )}
            </div>

            {/* Delete confirmation inline */}
            {showDeleteConfirm && (
              <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10">
                <div className="text-sm font-semibold text-red-400 mb-1">Delete this table?</div>
                <div className="text-xs text-red-400/70 mb-3">This cannot be undone. Active orders won't be deleted.</div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowDeleteConfirm(false)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs transition ${tc.outlineBtn}`}
                    disabled={loading}
                  >Cancel</button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex-1 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition disabled:opacity-50"
                    disabled={loading}
                  >{loading ? "Deleting..." : "Yes, Delete"}</button>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-400">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {!editingTable ? (
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${tc.textSub}`}>Table Number *</label>
                  <input type="number" value={tableNumber}
                    onChange={(e) => { setTableNumber(e.target.value); setError(""); }}
                    placeholder="e.g., 1" required autoFocus
                    className={`w-full rounded-lg px-4 py-2.5 text-sm transition ${tc.inputBg}`}
                  />
                </div>
              ) : (
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${tc.textSub}`}>Table Number</label>
                  <div className={`w-full rounded-lg px-4 py-2.5 text-sm border ${tc.mutedBg} ${tc.textMuted} ${tc.borderSoft}`}>
                    {editingTable.number}
                  </div>
                </div>
              )}

              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${tc.textSub}`}>Table Name <span className={`font-normal ${tc.textMuted}`}>(optional)</span></label>
                <input type="text" value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="Auto-generated if empty"
                  className={`w-full rounded-lg px-4 py-2.5 text-sm transition ${tc.inputBg}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${tc.textSub}`}>Capacity</label>
                  <input type="number" value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    min="1" max="30"
                    className={`w-full rounded-lg px-4 py-2.5 text-sm transition ${tc.inputBg}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${tc.textSub}`}>Zone</label>
                  <input type="text" list="zone-suggestions" value={zone}
                    onChange={(e) => { setZone(e.target.value); setError(""); }}
                    placeholder="e.g. Main"
                    className={`w-full rounded-lg px-4 py-2.5 text-sm transition ${tc.inputBg}`}
                  />
                  <datalist id="zone-suggestions">
                    {suggestedZones.map(z => <option key={z} value={z} />)}
                  </datalist>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm transition ${tc.outlineBtn}`}
                >Cancel</button>
                <button type="submit"
                  disabled={loading || (!editingTable && !tableNumber.trim())}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition ${tc.primaryBtn}`}
                >
                  {loading ? (editingTable ? "Saving..." : "Creating...") : (editingTable ? "Save Changes" : "Create Table")}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

