// src/components/inventory/AddColumnInventory.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 * AddColumnInventory (right-side drawer "Manage Columns")
 *
 * Props (all optional; falls back to custom-fields-only mode if not provided):
 *  - availableColumns: Array<{ id: string, label: string }>
 *  - hiddenCols: Set<string> | string[]
 *  - onToggle(id: string): void
 *  - onReset(): void
 *  - onClose(): void
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

  // drawer show/hide (for slide animation)
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef(null);

  useEffect(() => {
    // open with animation on mount
    setIsOpen(true);
    // lock page scroll
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev || "";
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    // wait for animation to finish
    setTimeout(() => onClose?.(), 250);
  };

  // focus the drawer for accessibility
  useEffect(() => {
    drawerRef.current?.focus();
  }, []);

  // Ensure 'QR' column exists & is visible by default
  const mergedAvailableColumns = useMemo(() => {
    const hasQR = availableColumns.some((c) => c.id === "qr");
    return hasQR ? availableColumns : [...availableColumns, { id: "qr", label: "QR" }];
  }, [availableColumns]);

  const hiddenSet = useMemo(() => {
    let hidden =
      hiddenCols instanceof Set
        ? new Set(hiddenCols)
        : new Set(Array.isArray(hiddenCols) ? hiddenCols : []);
    if (mergedAvailableColumns.some((c) => c.id === "qr") && hidden.has("qr")) {
      hidden.delete("qr");
    }
    return hidden;
  }, [hiddenCols, mergedAvailableColumns]);

  // --- Custom columns state ---
  const [customCols, setCustomCols] = useState([]);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState("text");
  const [newColDesc, setNewColDesc] = useState("");
  const [activeTab, setActiveTab] = useState(
    mergedAvailableColumns?.length ? "columns" : "custom"
  );

  // Columns tab UX state
  const [density, setDensity] = useState("comfortable"); // comfortable | compact
  const [query, setQuery] = useState("");

  // Escape closes
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live load custom columns
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
    String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!user) return;
    const name = newColName.trim();
    if (!name) return;
    const key = toSafeKey(name);
    try {
      await setDoc(
        doc(db, "businesses", user.uid, "customColumns", key),
        {
          name,
          type: newColType,
          description: newColDesc,
          key,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      setNewColName("");
      setNewColType("text");
      setNewColDesc("");
    } catch (err) {
      console.error("Error adding custom column:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "businesses", user.uid, "customColumns", id));
    } catch (err) {
      console.error("Error deleting column:", err);
    }
  };

  const filteredColumns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mergedAvailableColumns;
    return mergedAvailableColumns.filter((c) =>
      (c.label || c.id).toLowerCase().includes(q)
    );
  }, [mergedAvailableColumns, query]);

  const selectAll = () => {
    filteredColumns.forEach((c) => {
      if (hiddenSet.has(c.id)) onToggle(c.id);
    });
  };
  const deselectAll = () => {
    filteredColumns.forEach((c) => {
      if (!hiddenSet.has(c.id)) onToggle(c.id);
    });
  };

  const rowPad = density === "compact" ? "py-1.5" : "py-2.5";

  // ---- Drawer UI via portal ----
return createPortal(
    <div className="fixed inset-0 z-[2000]" role="dialog" aria-modal="true">
      <style>{`
        /* Cinematic drawer/backdrop */
        .sp-backdrop {
          transition: opacity 280ms cubic-bezier(.2,.7,.3,1);
          opacity: 0;
          backdrop-filter: blur(6px);
        }
        .sp-backdrop[data-open="true"] { opacity: 1; }

        .sp-drawer {
          --spDur: 340ms;
          transform: translateX(100%) scale(.98);
          opacity: .6;
          box-shadow:
            0 20px 60px rgba(0,0,0,.55),
            0 0 0 1px rgba(148,163,184,.15),
            0 0 80px 20px rgba(34,197,94,.06) inset;
          transition:
            transform var(--spDur) cubic-bezier(.2,.8,.2,1),
            opacity var(--spDur) cubic-bezier(.2,.8,.2,1);
        }
        .sp-drawer[data-open="true"] {
          transform: translateX(0) scale(1);
          opacity: 1;
        }

        /* Staggered content entrance */
        .sp-stagger > * { 
          opacity: 0; 
          transform: translateY(6px);
          animation: spFadeUp .38s cubic-bezier(.2,.7,.2,1) forwards;
        }
        .sp-stagger > *:nth-child(1) { animation-delay: 80ms; }
        .sp-stagger > *:nth-child(2) { animation-delay: 120ms; }
        .sp-stagger > *:nth-child(3) { animation-delay: 160ms; }
        .sp-stagger > *:nth-child(4) { animation-delay: 200ms; }
        .sp-stagger > *:nth-child(5) { animation-delay: 240ms; }
        @keyframes spFadeUp {
          to { opacity: 1; transform: translateY(0); }
        }

        /* Chip hover glow */
        .sp-chip {
          transition: border-color .2s ease, box-shadow .25s ease, background-color .2s ease;
        }
        .sp-chip:hover {
          border-color: rgba(203,213,225,.55);
          box-shadow: 0 0 0 2px rgba(34,197,94,.25) inset, 0 6px 20px rgba(16,185,129,.12);
          background: rgba(15,23,42,.75);
        }
      `}</style>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 sp-backdrop transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
        data-open={isOpen}
        onClick={handleClose}
      />
      {/* Drawer panel */}
      <aside
        ref={drawerRef}
        tabIndex={-1}
        data-open={isOpen}
        className={`absolute right-0 top-0 h-full w-full max-w-[560px] text-slate-100 bg-gradient-to-b from-slate-900 to-slate-950 border-l border-slate-800 shadow-[0_20px_60px_rgba(0,0,0,0.6)] outline-none sp-drawer transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-slate-900/90 backdrop-blur border-b border-slate-800 text-slate-100 [box-shadow:inset_0_-1px_0_rgba(148,163,184,0.12)]">
          <h2 className="text-lg font-semibold">Manage Columns</h2>
          <div className="flex items-center gap-2">
            {onReset && mergedAvailableColumns?.length > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="px-3 py-1.5 rounded-md border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-100"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 rounded-md bg-emerald-400 text-slate-900 hover:bg-emerald-300 font-semibold shadow-sm"
            >
              Done
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="ml-1 px-2 h-9 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="h-[calc(100%-60px)] overflow-y-auto px-6 pb-8 pt-4 text-slate-100 scroll-smooth sp-stagger">
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {mergedAvailableColumns?.length > 0 && (
              <button
                type="button"
                className={`px-3 py-2 rounded border text-slate-100 ${
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
              className={`px-3 py-2 rounded border text-slate-100 ${
                activeTab === "custom"
                  ? "bg-slate-800 border-slate-600"
                  : "bg-slate-900 border-slate-800 hover:bg-slate-800"
              }`}
              onClick={() => setActiveTab("custom")}
            >
              Custom Fields
            </button>
          </div>

          {/* Columns panel */}
          {activeTab === "columns" && mergedAvailableColumns?.length > 0 && (
            <div className="rounded-lg border border-slate-700 p-4 bg-slate-800 mb-6 text-slate-100">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="px-3 py-1.5 rounded-md border border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100"
                    title="Show all filtered"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="px-3 py-1.5 rounded-md border border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100"
                    title="Hide all filtered"
                  >
                    Deselect all
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-white/60">Density</label>
                  <select
                    className="px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-slate-100"
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
                    className="px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 w-56 text-slate-100 placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="max-h-[360px] overflow-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredColumns.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 rounded-md bg-slate-900/60 px-3 ${rowPad} border border-slate-700 text-slate-100 sp-chip`}
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
                    <div className="text-sm text-white/60">
                      No columns match your search.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Custom fields panel */}
          {activeTab === "custom" && (
            <div className="space-y-6">
              <form
                onSubmit={handleAdd}
                className="rounded-lg border border-slate-700 p-4 bg-slate-800"
              >
                <h3 className="font-medium mb-3">Add a Custom Field</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Field name (e.g., IMEI, Batch No.)"
                    className="px-3 py-2 rounded-md bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 text-slate-100 placeholder-slate-400"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    required
                  />
                  <select
                    className="px-3 py-2 rounded-md bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 text-slate-100 placeholder-slate-400"
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
                    className="px-3 py-2 rounded-md bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 text-slate-100 placeholder-slate-400"
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

              <div className="rounded-lg border border-slate-700 p-4 bg-slate-800">
                <h3 className="font-medium mb-3">Custom Fields</h3>
                {customCols.length === 0 ? (
                  <p className="text-white/60">No custom fields yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-700">
                    {customCols.map((col) => (
                      <li key={col.id} className="flex items-center justify-between py-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {col.name}{" "}
                            <span className="text-xs text-white/50">({col.type})</span>
                          </div>
                          {col.description && (
                            <div className="text-xs text-white/60 truncate">
                              {col.description}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(col.id)}
                          className="px-3 py-1.5 rounded-md bg-rose-500 hover:bg-rose-600 text-white"
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
      </aside>
    </div>,
    document.body
  );
};

export default AddColumnInventory;