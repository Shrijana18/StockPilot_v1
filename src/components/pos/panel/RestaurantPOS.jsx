import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../../../firebase/firebaseConfig";
import { usePOSTheme } from "../POSThemeContext";
import { collection, doc, getDocs, setDoc, query, orderBy, updateDoc, onSnapshot, limit, deleteDoc } from "firebase/firestore";
import RestaurantPOSBilling from "./RestaurantPOSBilling";
import TableManager from "./TableManager";

const getUid = () => auth.currentUser?.uid;

/**
 * RestaurantPOS - Complete Restaurant/Cafe/Hotel POS System
 * Features:
 * - Table/Customer selection with real-time status
 * - Menu item selection from CreateMenu
 * - Send orders to kitchen
 * - Real-time order tracking per table
 */
export default function RestaurantPOS({ onBack, onOpenMenuBuilder }) {
  const { tc } = usePOSTheme();
  const [mode, setMode] = React.useState("select"); // 'select' | 'billing' | 'tables'
  const [selectedTable, setSelectedTable] = React.useState(null);
  const [selectedCustomer, setSelectedCustomer] = React.useState(null);
  const [tables, setTables] = React.useState([]);
  const [kitchenOrders, setKitchenOrders] = React.useState([]);
  const [isTableManagerOpen, setIsTableManagerOpen] = React.useState(false);
  const [editingTable, setEditingTable] = React.useState(null);
  const [filterZone, setFilterZone] = React.useState("all"); // all | main | outdoor | vip | bar
  const [tableMenuOpen, setTableMenuOpen] = React.useState(null); // table.id or null
  const [deleteConfirmFor, setDeleteConfirmFor] = React.useState(null); // table.id or null
  const [deletingTable, setDeletingTable] = React.useState(false);

  const [uid, setUid] = React.useState(() => auth.currentUser?.uid || null);
  const [authError, setAuthError] = React.useState(null);
  const [dataLoading, setDataLoading] = React.useState(true);

  // Track auth reactively — covers race where component mounts before IndexedDB restores
  React.useEffect(() => {
    return auth.onAuthStateChanged((user) => {
      setUid(user?.uid || null);
      if (!user) { setAuthError("Please login to access POS system"); setDataLoading(false); }
      else setAuthError(null);
    });
  }, []);

  // Load tables — re-attaches whenever uid becomes available
  React.useEffect(() => {
    if (!uid) {
      setTables([]);
      return;
    }

    setDataLoading(true);
    const tablesRef = collection(db, "businesses", uid, "tables");
    const unsubscribe = onSnapshot(tablesRef, 
      (snap) => {
        try {
          const tableList = [];
          snap.forEach((docSnap) => {
            tableList.push({ id: docSnap.id, ...docSnap.data() });
          });
          setTables(tableList.sort((a, b) => (a.number || 0) - (b.number || 0)));
          setAuthError(null);
        } catch (error) {
          console.error("Error processing tables data:", error);
          setAuthError("Failed to load tables data");
        } finally {
          setDataLoading(false);
        }
      },
      (error) => {
        console.error("Error fetching tables:", error);
        if (error.code === "permission-denied") {
          setAuthError("Access denied. Please check your permissions.");
        } else {
          setAuthError("Failed to load tables. Please try again.");
        }
        setDataLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  // Load kitchen orders — re-attaches whenever uid becomes available
  React.useEffect(() => {
    if (!uid) return;

    const ordersRef = collection(db, "businesses", uid, "kitchenOrders");
    // IMPORTANT: Avoid composite-index requirements by not using "!=" + orderBy.
    // We pull the latest N kitchenOrders and filter out completed client-side.
    let activeUnsub = null;
    let switchedToFallback = false;

    const attachListener = (q) => onSnapshot(
      q,
      (snap) => {
        try {
          const orders = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status !== "completed") orders.push({ id: docSnap.id, ...data });
          });
          setKitchenOrders(orders);
        } catch (error) {
          console.error("Error processing kitchen orders:", error);
        }
      },
      (error) => {
        console.error("Error fetching kitchen orders:", error);
        if (switchedToFallback) return;
        switchedToFallback = true;
        try { activeUnsub?.(); } catch (_) {}
        // Fallback: same query but without any other constraints, keep it bounded.
        try {
          const fallbackQ = query(ordersRef, orderBy("createdAt", "desc"), limit(250));
          activeUnsub = attachListener(fallbackQ);
        } catch (fallbackError) {
          console.error("Fallback query also failed:", fallbackError);
        }
      }
    );

    const primaryQ = query(ordersRef, orderBy("createdAt", "desc"), limit(250));
    activeUnsub = attachListener(primaryQ);

    return () => { try { activeUnsub?.(); } catch (_) {} };
  }, [uid]);

  // Get table status based on orders — show most urgent status
  const getTableStatus = (tableId) => {
    const tableOrders = kitchenOrders.filter(o => o.tableId === tableId);
    if (tableOrders.length === 0) return { status: "available", orderCount: 0, latestOrder: null };

    const statusPriority = { pending: 0, preparing: 1, ready: 2, served: 3 };
    const mostUrgent = tableOrders.reduce((best, order) =>
      (statusPriority[order.status] ?? 99) < (statusPriority[best.status] ?? 99) ? order : best,
      tableOrders[0]
    );

    return {
      status: "occupied",
      orderCount: tableOrders.length,
      latestOrder: mostUrgent,
      orderStatus: mostUrgent.status, // pending | preparing | ready | served
    };
  };

    const handleTableSelect = (table) => {
      setSelectedTable(table);
      setSelectedCustomer(null);
      setMode("billing");
    };

    const handleEditTable = (e, table) => {
      e.stopPropagation();
      setTableMenuOpen(null);
      setDeleteConfirmFor(null);
      setEditingTable(table);
      setIsTableManagerOpen(true);
    };

    const handleDeleteTable = async (e, table) => {
      e.stopPropagation();
      if (!uid) return;
      setDeletingTable(true);
      try {
        await deleteDoc(doc(db, "businesses", uid, "tables", table.id));
      } catch (err) {
        console.error("Failed to delete table:", err);
      } finally {
        setDeletingTable(false);
        setDeleteConfirmFor(null);
        setTableMenuOpen(null);
      }
    };

    const handleCustomerSelect = () => {
    setSelectedTable(null);
    setSelectedCustomer({ name: "", phone: "", email: "" });
    setMode("billing");
  };

  // Get inventory helper for POSBilling (reads from items collection for restaurant menu)
  // Only shows available items (available !== false)
  const inventory = React.useMemo(() => {
    const listAll = async () => {
      const uid = getUid();
      if (!uid) return [];
      const itemsRef = collection(db, "businesses", uid, "items");
      try {
        const snap = await getDocs(itemsRef);
        return snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(item => item.available !== false); // Only available items
      } catch {
        return [];
      }
    };
    
    return {
      listAll,
      searchProducts: async (qText) => {
        const uid = getUid();
        if (!uid) return [];
        const itemsRef = collection(db, "businesses", uid, "items");
        if (!qText || !qText.trim()) {
          return await listAll();
        }
        try {
          const snap = await getDocs(itemsRef);
          const all = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(item => item.available !== false); // Only available items
          return all.filter(item => 
            (item.name || "").toLowerCase().includes(qText.toLowerCase())
          );
        } catch {
          return [];
        }
      },
      listCategories: async () => {
        const uid = getUid();
        if (!uid) return [];
        const categoriesRef = collection(db, "businesses", uid, "categories");
        try {
          const snap = await getDocs(categoriesRef);
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {
          return [];
        }
      },
      listByCategory: async (categoryId) => {
        const uid = getUid();
        if (!uid) return [];
        const itemsRef = collection(db, "businesses", uid, "items");
        try {
          const snap = await getDocs(itemsRef);
          return snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(item => item.categoryId === categoryId && item.available !== false);
        } catch {
          return [];
        }
      },
    };
  }, []);

  // Billing helper for POSBilling (creates invoices in finalizedInvoices)
  const billing = React.useMemo(() => {
    return {
      createInvoice: async (invoiceData) => {
        const uid = getUid();
        if (!uid) throw new Error("User not authenticated");
        
        const invoicesRef = collection(db, "businesses", uid, "finalizedInvoices");
        const invoiceId = `INV-${Date.now()}`;
        const invoiceDoc = doc(invoicesRef, invoiceId);
        
        await setDoc(invoiceDoc, {
          ...invoiceData,
          invoiceId,
          createdAt: Date.now(),
          issuedAt: Date.now(),
        });
        
        return { id: invoiceId };
      },
    };
  }, []);

  // ── Zone grouping (must be before any early return — Rules of Hooks) ──────
  const ZONE_DISPLAY = { main: "Main Dining", outdoor: "Outdoor", vip: "VIP", bar: "Bar", private: "Private Room", terrace: "Terrace", rooftop: "Rooftop", garden: "Garden" };
  const getZoneLabel = (z) => ZONE_DISPLAY[z?.toLowerCase()] || (z ? z.charAt(0).toUpperCase() + z.slice(1) : "Main");
  const ZONE_ORDER = ["main", "outdoor", "vip", "bar", "private", "terrace", "rooftop", "garden"];

  const zoneGroups = React.useMemo(() => {
    const groups = {};
    tables.forEach(t => {
      const z = (t.zone || "main").toLowerCase();
      if (!groups[z]) groups[z] = [];
      groups[z].push(t);
    });
    return groups;
  }, [tables]);

  // ── Status helpers ────────────────────────────────────────────────────────
  const getStatusMeta = (tableStatus, isOccupied, isReserved, isCleaning) => {
    if (isCleaning) return {
      bar: null,
      badge: "bg-white/[0.08] text-white/50 border border-white/[0.1]",
      label: "Cleaning",
      cardClass: tc.tableCleaning,
    };
    if (isReserved) return {
      bar: tc.statusBar(false, true),
      badge: tc.statusReserved,
      label: "Reserved",
      cardClass: tc.tableReserved,
    };
    if (!isOccupied) return {
      bar: null,
      badge: null,
      label: "Available",
      cardClass: tc.tableAvailable,
    };
    const s = tableStatus.orderStatus;
    const sub = s === "ready"     ? { badge: tc.statusReady,     label: "🔔 Ready" }
              : s === "served"    ? { badge: tc.statusServed,    label: "Served" }
              : s === "preparing" ? { badge: tc.statusPreparing, label: "Preparing" }
              :                     { badge: tc.statusOccupied,  label: "Occupied" };
    return {
      bar: tc.statusBar(true, false),
      badge: sub.badge,
      label: sub.label,
      cardClass: tc.tableOccupied,
    };
  };

  const renderTableCard = (table) => {
    const tableStatus = getTableStatus(table.id);
    const isOccupied = tableStatus.status === "occupied";
    const isReserved = table.status === "reserved";
    const isCleaning = table.status === "cleaning";
    const meta = getStatusMeta(tableStatus, isOccupied, isReserved, isCleaning);

    return (
      <motion.div
        key={table.id}
        initial={{ opacity: 0, scale: 0.88, y: 12, rotateY: 5 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateY: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: -12 }}
        whileHover={!isCleaning ? { 
          y: -6, 
          scale: 1.03, 
          rotateY: -2,
          boxShadow: "0 20px 40px -12px rgba(0,0,0,0.4)"
        } : {}}
        whileTap={!isCleaning ? { scale: 0.96, y: -2 } : {}}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        role="button"
        tabIndex={isCleaning ? -1 : 0}
        aria-disabled={isCleaning}
        onClick={() => !isCleaning && handleTableSelect(table)}
        onKeyDown={(e) => {
          if (isCleaning) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleTableSelect(table);
          }
        }}
        className={`relative group rounded-2xl border p-4 text-left transition-all duration-300 transform-gpu preserve-3d ${meta.cardClass}`}
      >
        {meta.bar && (
          <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl ${meta.bar}`} />
        )}
        <div className="flex items-start justify-between mb-2">
          <div className={`text-sm font-bold leading-tight flex-1 mr-1 ${tc.tableNameColor(isOccupied, isReserved)}`}>
            {table.name || `Table ${table.number}`}
          </div>

          {/* ⋮ options menu */}
          <div className="relative flex-none" onClick={e => e.stopPropagation()}>
            <motion.button
              type="button"
              whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
              onClick={e => {
                e.stopPropagation();
                setDeleteConfirmFor(null);
                setTableMenuOpen(tableMenuOpen === table.id ? null : table.id);
              }}
              className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black transition-all ${
                tableMenuOpen === table.id
                  ? `${tc.editBtn} opacity-100`
                  : `opacity-0 group-hover:opacity-100 ${tc.editBtn}`
              }`}
              title="Table options"
            >⋮</motion.button>

            <AnimatePresence>
              {tableMenuOpen === table.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className={`absolute right-0 top-7 z-50 min-w-[140px] rounded-xl shadow-2xl border overflow-hidden ${tc.modalBg} ${tc.borderSoft}`}
                >
                  {deleteConfirmFor === table.id ? (
                    <div className="p-3">
                      <p className="text-[11px] font-bold text-red-400 mb-1">Delete table?</p>
                      <p className="text-[10px] text-white/40 mb-2.5">This cannot be undone.</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteConfirmFor(null); }}
                          className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg transition ${tc.outlineBtn}`}
                        >Cancel</button>
                        <button
                          onClick={e => handleDeleteTable(e, table)}
                          disabled={deletingTable}
                          className="flex-1 py-1.5 text-[10px] font-black rounded-lg bg-red-500 hover:bg-red-400 text-white transition disabled:opacity-50"
                        >{deletingTable ? "…" : "Delete"}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={e => handleEditTable(e, table)}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold transition hover:bg-white/6 ${tc.textSub}`}
                      >
                        <span className="text-sm">✏️</span> Edit Table
                      </button>
                      <div className={`h-px mx-2 ${tc.borderSoft}`} />
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirmFor(table.id); }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
                      >
                        <span className="text-sm">🗑</span> Delete Table
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {(isOccupied || isReserved || isCleaning) && meta.label !== "Available" && (
          <AnimatePresence mode="wait">
            <motion.div
              key={meta.label}
              initial={{ opacity: 0, scale: 0.8, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className="mb-2"
            >
              {meta.label === "🔔 Ready" ? (
                <div className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 shadow-sm shadow-emerald-500/20">
                  <motion.span
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ repeat: Infinity, duration: 0.9, ease: "easeInOut" }}
                  >🔔</motion.span>
                  <span>Ready!</span>
                  <motion.span
                    className="absolute -inset-0.5 rounded-xl border border-emerald-400/50"
                    animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.08, 1] }}
                    transition={{ repeat: Infinity, duration: 1.4 }}
                  />
                </div>
              ) : meta.label === "Preparing" ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="inline-block"
                  >⚙️</motion.span>
                  <span>Preparing</span>
                </div>
              ) : meta.label === "Served" ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-400/25">
                  <span>✓</span><span>Served</span>
                </div>
              ) : meta.label === "Reserved" ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-400/25">
                  <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.8 }}>📅</motion.span>
                  <span>Reserved</span>
                </div>
              ) : meta.label === "Cleaning" ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-semibold bg-white/[0.08] text-white/50 border border-white/[0.1]">
                  <motion.span animate={{ rotate: [0, 15, -15, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>🧹</motion.span>
                  <span>Cleaning</span>
                </div>
              ) : meta.badge ? (
                <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold ${meta.badge}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 flex-none" />
                  <span>{meta.label}</span>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        )}
        <div className={`flex items-center gap-2 text-[11px] mt-1 ${tc.capacityText}`}>
          <motion.span 
            whileHover={{ scale: 1.2, rotate: 5 }}
            className="inline-block"
          >🪑 {table.capacity || 4}</motion.span>
          {isOccupied && tableStatus.orderCount > 0 && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              className="opacity-60"
            >· {tableStatus.orderCount} order{tableStatus.orderCount > 1 ? "s" : ""}</motion.span>
          )}
        </div>
      </motion.div>
    );
  };

  if (mode === "billing") {
    return (
      <RestaurantPOSBilling
        mode="restaurant"
        inventory={inventory}
        billing={billing}
        onBack={() => {
          setMode("select");
          setSelectedTable(null);
          setSelectedCustomer(null);
        }}
        onTableUpdate={() => {
          // Tables will be automatically refreshed via onSnapshot
        }}
        table={selectedTable}
        customer={selectedCustomer}
        onOrderSentToKitchen={async () => {
          // RestaurantPOSBilling already created the kitchenOrder doc.
          // Only update the table status here.
          if (!selectedTable?.id) return;
          const uid = getUid();
          if (!uid) return;
          try {
            const tableRef = doc(db, "businesses", uid, "tables", selectedTable.id);
            await updateDoc(tableRef, {
              status: "occupied",
              lastOrderAt: Date.now(),
            });
          } catch (e) {
            console.error("Error updating table status:", e);
          }
        }}
      />
    );
  }

  const zones = ["all", ...new Set(tables.map(t => (t.zone || "main").toLowerCase()).filter(Boolean))];
  const filteredTables = filterZone === "all"
    ? tables
    : tables.filter(t => (t.zone || "main").toLowerCase() === filterZone);

  const availableCount = tables.filter(t => getTableStatus(t.id).status === "available").length;
  const occupiedCount  = tables.filter(t => getTableStatus(t.id).status === "occupied").length;

  const sortedZones = Object.keys(zoneGroups).sort((a, b) => {
    const ai = ZONE_ORDER.indexOf(a), bi = ZONE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // Show loading state
  if (dataLoading) {
    return (
      <div className="relative flex flex-col w-full h-full items-center justify-center" style={tc.bg}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-16 w-[60%] h-[60%] rounded-full blur-[110px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob1} 0%, transparent 65%)` }} />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center"
        >
          <div className="w-16 h-16 border-4 border-emerald-500/40 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <div className={`text-sm font-semibold ${tc.textPrimary}`}>Loading Restaurant POS...</div>
          <div className={`text-xs mt-2 ${tc.textMuted}`}>Setting up your workspace</div>
        </motion.div>
      </div>
    );
  }

  // Show error state
  if (authError) {
    return (
      <div className="relative flex flex-col w-full h-full items-center justify-center p-5" style={tc.bg}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-16 w-[60%] h-[60%] rounded-full blur-[110px]" style={{ background: `radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 65%)` }} />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-3xl mx-auto mb-4">
            ⚠️
          </div>
          <div className={`text-base font-bold mb-2 ${tc.textPrimary}`}>Authentication Required</div>
          <div className={`text-sm mb-6 ${tc.textSub}`}>{authError}</div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.location.reload()}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${tc.primaryBtn}`}
          >
            Refresh Page
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col w-full h-full overflow-y-auto" style={tc.bg}
      onClick={() => { if (tableMenuOpen) { setTableMenuOpen(null); setDeleteConfirmFor(null); } }}
    >
      {/* Aurora blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-16 w-[60%] h-[60%] rounded-full blur-[110px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob1} 0%, transparent 65%)` }} />
        <div className="absolute -bottom-32 -left-16 w-[55%] h-[55%] rounded-full blur-[110px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob2} 0%, transparent 65%)` }} />
      </div>

      {/* ── Top bar */}
      <div className={`sticky top-0 z-20 ${tc.headerBg}`}>
        <div className="px-5 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-bold ${tc.textPrimary}`}>Tables & Orders</div>
            <div className="flex items-center gap-4 mt-0.5">
              <span className={`text-[11px] flex items-center gap-1.5 ${tc.textSub}`}>
                <span className={`w-2 h-2 rounded-full inline-block ${tc.statusAvailableDot}`} />
                {availableCount} Available
              </span>
              <span className={`text-[11px] flex items-center gap-1.5 ${tc.textSub}`}>
                <span className={`w-2 h-2 rounded-full inline-block ${tc.statusOccupiedDot}`} />
                {occupiedCount} Occupied
              </span>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => onOpenMenuBuilder && onOpenMenuBuilder()}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${tc.outlineBtn}`}
          >
            📜 Menu Builder
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            onClick={() => setIsTableManagerOpen(true)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${tc.primaryBtn}`}
          >
            + Add Table
          </motion.button>
        </div>
      </div>

      {/* ── Content */}
      <div className="relative z-10 flex-1 p-5">
        {/* Walk-in Customer */}
        <motion.button
          whileHover={{ y: -2, scale: 1.005 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleCustomerSelect}
          className={`w-full mb-5 group relative text-left rounded-2xl border p-4 transition-all duration-200 shadow-sm ${tc.walkinCard}`}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-transparent opacity-0 group-hover:opacity-80 transition-opacity" />
          <div className="flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-none shadow-sm border ${tc.cardBg}`}>
              👤
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${tc.textPrimary}`}>Walk-in Customer</div>
              <div className={`text-[11px] mt-0.5 ${tc.textMuted}`}>No table — start an order immediately</div>
            </div>
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center text-sm transition-all flex-none ${tc.cardBg} ${tc.textSub}`}>
              →
            </div>
          </div>
        </motion.button>

        {/* Zone filter pills */}
        {zones.length > 2 && (
          <div className="flex gap-2 mb-5 flex-wrap">
            {zones.map((zone, idx) => (
              <motion.button
                key={zone}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, type: "spring", stiffness: 400, damping: 26 }}
                whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}
                onClick={() => setFilterZone(zone)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filterZone === zone ? tc.zonePillActive : tc.zonePillInactive
                }`}
              >
                {zone === "all" ? "All Zones" : getZoneLabel(zone)}
              </motion.button>
            ))}
          </div>
        )}

        {/* Tables grid */}
        {tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-5 shadow-sm ${tc.emptyIcon}`}>🪑</div>
            <div className={`text-sm font-semibold mb-1 ${tc.textSub}`}>No tables yet</div>
            <div className={`text-xs mb-5 ${tc.textMuted}`}>Add your first table to start taking orders</div>
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => setIsTableManagerOpen(true)}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-all ${tc.primaryBtn}`}
            >
              + Create First Table
            </motion.button>
          </div>
        ) : filterZone !== "all" ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-[11px] ${tc.sectionLabel}`}>{getZoneLabel(filterZone)}</span>
              <div className={`flex-1 h-px ${tc.sectionBar}`} />
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${tc.sectionCount}`}>{filteredTables.length} table{filteredTables.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <AnimatePresence>
                {filteredTables.map((table) => renderTableCard(table))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedZones.map((zone, zoneIdx) => (
              <motion.div
                key={zone}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: zoneIdx * 0.1, type: "spring", stiffness: 380, damping: 30 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: zoneIdx * 0.1 + 0.05 }}
                    className={`text-[11px] ${tc.sectionLabel}`}
                  >{getZoneLabel(zone)}</motion.span>
                  <motion.div 
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: zoneIdx * 0.1 + 0.1, type: "spring", stiffness: 300, damping: 30 }}
                    className={`flex-1 h-px ${tc.sectionBar}`}
                    style={{ originX: 0 }}
                  />
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: zoneIdx * 0.1 + 0.15, type: "spring", stiffness: 400 }}
                    className={`text-[10px] px-2 py-0.5 rounded-full ${tc.sectionCount}`}
                  >{zoneGroups[zone].length} table{zoneGroups[zone].length !== 1 ? "s" : ""}</motion.span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  <AnimatePresence>
                    {zoneGroups[zone].map((table, tableIdx) => renderTableCard(table))}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Table Manager Modal */}
      <TableManager
        open={isTableManagerOpen}
        onClose={() => { setIsTableManagerOpen(false); setEditingTable(null); }}
        editingTable={editingTable}
        existingTables={tables}
        onTableCreated={() => { setIsTableManagerOpen(false); setEditingTable(null); }}
      />
    </div>
  );
}
