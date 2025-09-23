import React, { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

/**
 * AddColumnInventory (Unified "Manage Columns" panel)
 *
 * Props (all optional; falls back to custom-fields-only mode if not provided):
 *  - availableColumns: Array<{ id: string, label: string }>
 *  - hiddenCols: Set<string> | string[]  (column ids that are hidden)
 *  - onToggle(id: string): void         (toggle visibility)
 *  - onReset(): void                    (reset visibility to defaults)
 *  - onClose(): void                    (close the modal/panel)
 */
const AddColumnInventory = ({
  availableColumns = [],
  hiddenCols = new Set(),
  onToggle = () => {},
  onReset = () => {},
  onClose = () => {},
}) => {
  const auth = getAuth();
  const user = auth.currentUser;

  // normalize hidden set
  const hiddenSet = useMemo(() => {
    if (hiddenCols instanceof Set) return hiddenCols;
    return new Set(Array.isArray(hiddenCols) ? hiddenCols : []);
  }, [hiddenCols]);

  // --- Custom columns state ---
  const [customCols, setCustomCols] = useState([]);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState("text");
  const [newColDesc, setNewColDesc] = useState("");
  const [activeTab, setActiveTab] = useState(
    availableColumns?.length ? "columns" : "custom"
  );

  // Columns tab UX state
  const [density, setDensity] = useState("comfortable"); // comfortable | compact
  const [query, setQuery] = useState("");

  // ESC to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && typeof onClose === "function") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // live load custom columns
  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, "businesses", user.uid, "customColumns");
    const unsub = onSnapshot(colRef, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCustomCols(items);
    });
    return () => unsub();
  }, [user]);

  const toSafeKey = (name = "") =>
    String(name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  // add custom column
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!user) return;
    const name = newColName.trim();
    if (!name) return;
    const key = toSafeKey(name);
    try {
      await setDoc(
        doc(db, "businesses", user.uid, "customColumns", key),
        { name, type: newColType, description: newColDesc, key, updatedAt: Date.now() },
        { merge: true }
      );
      setNewColName("");
      setNewColType("text");
      setNewColDesc("");
    } catch (err) {
      console.error("Error adding custom column:", err);
    }
  };

  // delete custom column
  const handleDelete = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "businesses", user.uid, "customColumns", id));
    } catch (err) {
      console.error("Error deleting column:", err);
    }
  };

  // Filtered columns for the Columns tab
  const filteredColumns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableColumns;
    return availableColumns.filter((c) =>
      (c.label || c.id).toLowerCase().includes(q)
    );
  }, [availableColumns, query]);

  // Bulk operations
  const selectAll = () => {
    // toggle any currently hidden to become visible
    filteredColumns.forEach((c) => {
      if (hiddenSet.has(c.id)) onToggle(c.id);
    });
  };
  const deselectAll = () => {
    // toggle any currently visible to become hidden
    filteredColumns.forEach((c) => {
      if (!hiddenSet.has(c.id)) onToggle(c.id);
    });
  };

  // Styles
  const rowPad = density === "compact" ? "py-1.5" : "py-2.5";

  return (
    <div className="text-white">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Manage Columns</h2>
        <div className="flex items-center gap-2">
          {onReset && availableColumns?.length > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-2 rounded-md border border-slate-600 bg-slate-800 hover:bg-slate-700"
            >
              Reset
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-md bg-emerald-500 text-slate-900 hover:bg-emerald-400"
            >
              Done
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {availableColumns?.length > 0 && (
          <button
            type="button"
            className={`px-3 py-2 rounded border ${
              activeTab === "columns"
                ? "bg-slate-800 border-slate-600"
                : "bg-slate-900 border-slate-800 hover:bg-slate-800"
            }`}
            onClick={() => setActiveTab("columns")}
          >
            Columns
          </button>
        )}
        <button
          type="button"
          className={`px-3 py-2 rounded border ${
            activeTab === "custom"
              ? "bg-slate-800 border-slate-600"
              : "bg-slate-900 border-slate-800 hover:bg-slate-800"
          }`}
          onClick={() => setActiveTab("custom")}
        >
          Custom Fields
        </button>
      </div>

      {/* Panels */}
      {activeTab === "columns" && availableColumns?.length > 0 && (
        <div className="rounded-lg border border-slate-700 p-4 bg-slate-800 mb-6">
          {/* Tools row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="px-3 py-1.5 rounded-md border border-slate-600 bg-slate-900 hover:bg-slate-800"
                title="Show all filtered"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="px-3 py-1.5 rounded-md border border-slate-600 bg-slate-900 hover:bg-slate-800"
                title="Hide all filtered"
              >
                Deselect all
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/60">Density</label>
              <select
                className="px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700"
                value={density}
                onChange={(e) => setDensity(e.target.value)}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search columns…"
                className="px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 w-56"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredColumns.map((c) => (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 rounded-md bg-slate-900/60 px-3 ${rowPad} border border-slate-700 hover:border-slate-500`}
                >
                  <input
                    type="checkbox"
                    className="accent-emerald-500"
                    checked={!hiddenSet.has(c.id)}
                    onChange={() => onToggle(c.id)}
                  />
                  <span className="truncate">{c.label || c.id}</span>
                </label>
              ))}
              {filteredColumns.length === 0 && (
                <div className="text-sm text-white/60">No columns match your search.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "custom" && (
        <div className="space-y-6">
          {/* Add form */}
          <form onSubmit={handleAdd} className="rounded-lg border border-slate-700 p-4 bg-slate-800">
            <h3 className="font-medium mb-3">Add a Custom Field</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Field name (e.g., IMEI, Batch No.)"
                className="px-3 py-2 rounded-md bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                required
              />
              <select
                className="px-3 py-2 rounded-md bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                value={newColType}
                onChange={(e) => setNewColType(e.target.value)}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
              </select>
              <input
                type="text"
                placeholder="Description (optional)"
                className="px-3 py-2 rounded-md bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                value={newColDesc}
                onChange={(e) => setNewColDesc(e.target.value)}
              />
            </div>
            <div className="flex justify-end pt-3">
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-emerald-500 text-slate-900 hover:bg-emerald-400"
              >
                Add Field
              </button>
            </div>
          </form>

          {/* List existing custom fields */}
          <div className="rounded-lg border border-slate-700 p-4 bg-slate-800">
            <h3 className="font-medium mb-3">Custom Fields</h3>
            {customCols.length === 0 ? (
              <p className="text-white/60">No custom fields yet.</p>
            ) : (
              <ul className="divide-y divide-slate-700">
                {customCols.map((col) => (
                  <li
                    key={col.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {col.name} <span className="text-xs text-white/50">({col.type})</span>
                      </div>
                      {col.description && (
                        <div className="text-xs text-white/60 truncate">
                          {col.description}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(col.id)}
                      className="px-3 py-1.5 rounded-md bg-rose-500 hover:bg-rose-600"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddColumnInventory;