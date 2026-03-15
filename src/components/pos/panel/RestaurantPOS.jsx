import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../../../firebase/firebaseConfig";
import { collection, doc, getDocs, setDoc, query, where, orderBy, updateDoc, onSnapshot } from "firebase/firestore";
import RestaurantPOSBilling from "./RestaurantPOSBilling";
import TableManager from "./TableManager";

/**
 * RestaurantPOS - Complete Restaurant/Cafe/Hotel POS System
 * Features:
 * - Table/Customer selection with real-time status
 * - Menu item selection from CreateMenu
 * - Send orders to kitchen
 * - Real-time order tracking per table
 */
export default function RestaurantPOS({ onBack, onOpenMenuBuilder }) {
  const [mode, setMode] = React.useState("select"); // 'select' | 'billing' | 'tables'
  const [selectedTable, setSelectedTable] = React.useState(null);
  const [selectedCustomer, setSelectedCustomer] = React.useState(null);
  const [tables, setTables] = React.useState([]);
  const [kitchenOrders, setKitchenOrders] = React.useState([]);
  const [isTableManagerOpen, setIsTableManagerOpen] = React.useState(false);
  const [editingTable, setEditingTable] = React.useState(null);
  const [filterZone, setFilterZone] = React.useState("all"); // all | main | outdoor | vip | bar

  const getUid = () => auth.currentUser?.uid;

  // Load tables on mount
  React.useEffect(() => {
    const uid = getUid();
    if (!uid) return;

    const tablesRef = collection(db, "businesses", uid, "tables");
    const unsubscribe = onSnapshot(tablesRef, (snap) => {
      const tableList = [];
      snap.forEach((docSnap) => {
        tableList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setTables(tableList.sort((a, b) => (a.number || 0) - (b.number || 0)));
    });

    return () => unsubscribe();
  }, []);

  // Load kitchen orders to determine table status
  React.useEffect(() => {
    const uid = getUid();
    if (!uid) return;

    const ordersRef = collection(db, "businesses", uid, "kitchenOrders");
    const q = query(ordersRef, where("status", "!=", "completed"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snap) => {
      const orders = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status !== "completed") {
          orders.push({ id: docSnap.id, ...data });
        }
      });
      setKitchenOrders(orders);
    }, (error) => {
      console.error("Error fetching kitchen orders:", error);
      // Fallback query without status filter
      const fallbackQ = query(ordersRef, orderBy("createdAt", "desc"));
      onSnapshot(fallbackQ, (snap) => {
        const orders = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status !== "completed") {
            orders.push({ id: docSnap.id, ...data });
          }
        });
        setKitchenOrders(orders);
      });
    });

    return () => unsubscribe();
  }, []);

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
      e.stopPropagation(); // Prevent table selection
      setEditingTable(table);
      setIsTableManagerOpen(true);
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
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1; if (bi === -1) return -1;
    return ai - bi;
  });

  // ── Status helpers ──────────────────────────────────────────────────────
  const getStatusMeta = (tableStatus, isOccupied, isReserved, isCleaning) => {
    if (isCleaning)  return { bar: "bg-slate-500",  badge: "bg-slate-500/20 text-slate-400", label: "Cleaning",  cardBorder: "border-slate-600/30 bg-slate-500/[0.04] opacity-50" };
    if (isReserved)  return { bar: "bg-amber-400",  badge: "bg-amber-500/20 text-amber-300", label: "Reserved",  cardBorder: "border-amber-500/25 bg-amber-500/[0.05] hover:border-amber-400/40" };
    if (!isOccupied) return { bar: null,             badge: null,                              label: "Available", cardBorder: "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.14]" };
    // All occupied states → RED card; sub-status in badge
    const s = tableStatus.orderStatus;
    const sub = s === "ready"     ? { b: "bg-emerald-500/25 text-emerald-300 animate-pulse", t: "🔔 Ready" }
              : s === "served"    ? { b: "bg-purple-500/20 text-purple-300",                 t: "Served" }
              : s === "preparing" ? { b: "bg-blue-500/20 text-blue-300",                     t: "Preparing" }
              :                     { b: "bg-red-500/20 text-red-300",                        t: "Occupied" };
    return { bar: "bg-red-500", badge: sub.b, label: sub.t, cardBorder: "border-red-500/40 bg-red-500/[0.06] hover:bg-red-500/[0.11]" };
  };

  const nameColor = (tableStatus, isOccupied, isReserved) => {
    if (!isOccupied && !isReserved) return "text-white";
    if (isReserved) return "text-amber-300";
    return "text-red-300";
  };

  const renderTableCard = (table) => {
    const tableStatus = getTableStatus(table.id);
    const isOccupied = tableStatus.status === "occupied";
    const isReserved = table.status === "reserved";
    const isCleaning = table.status === "cleaning";
    const meta = getStatusMeta(tableStatus, isOccupied, isReserved, isCleaning);

    return (
      <motion.button
        key={table.id}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        whileHover={!isCleaning ? { y: -3 } : {}}
        whileTap={!isCleaning ? { scale: 0.97 } : {}}
        onClick={() => !isCleaning && handleTableSelect(table)}
        disabled={isCleaning}
        className={`relative group rounded-2xl border p-4 text-left transition-all duration-200 ${meta.cardBorder}`}
      >
        {/* Red occupied top bar */}
        {meta.bar && (
          <div className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl ${meta.bar}`} />
        )}

        {/* Name + edit */}
        <div className="flex items-start justify-between mb-2.5">
          <div className={`text-sm font-bold leading-tight ${nameColor(tableStatus, isOccupied, isReserved)}`}>
            {table.name || `Table ${table.number}`}
          </div>
          <button
            onClick={(e) => handleEditTable(e, table)}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-[10px] text-white/60 transition-all flex-none ml-1"
            title="Edit / Delete table"
          >
            ✏️
          </button>
        </div>

        {/* Status badge */}
        {(isOccupied || isReserved) && meta.badge && (
          <div className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold mb-2.5 ${meta.badge}`}>
            {meta.label}
          </div>
        )}

        {/* Capacity + order count */}
        <div className="flex items-center gap-2 text-[11px] text-white/35">
          <span>🪑 {table.capacity || 4}</span>
          {isOccupied && tableStatus.orderCount > 0 && (
            <span>· {tableStatus.orderCount} order{tableStatus.orderCount > 1 ? "s" : ""}</span>
          )}
        </div>
      </motion.button>
    );
  };

  return (
    <div className="relative flex flex-col w-full h-full overflow-y-auto bg-slate-900">
      {/* Original aurora blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/3 -left-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-emerald-500/15" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-cyan-500/15" />
      </div>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-slate-900/85 backdrop-blur-sm border-b border-white/10">
        <div className="px-5 py-3.5 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white">Tables & Orders</div>
            <div className="flex items-center gap-4 mt-0.5">
              <span className="text-[11px] text-white/40 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                {availableCount} Available
              </span>
              <span className="text-[11px] text-white/40 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                {occupiedCount} Occupied
              </span>
            </div>
          </div>
          <button
            onClick={() => onOpenMenuBuilder && onOpenMenuBuilder()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-white/65 hover:text-white text-xs font-medium transition"
          >
            📜 <span>Menu Builder</span>
          </button>
          <button
            onClick={() => setIsTableManagerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition shadow-lg shadow-emerald-500/20"
          >
            + Add Table
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 p-5">
        {/* Walk-in Customer */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleCustomerSelect}
          className="w-full mb-5 group relative text-left rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:border-white/[0.14] hover:bg-white/[0.045] p-4 transition-all duration-200"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-emerald-500 to-teal-400 opacity-0 group-hover:opacity-80 transition-opacity" />
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center text-lg flex-none">
              👤
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">Walk-in Customer</div>
              <div className="text-[11px] text-white/35 mt-0.5">No table — start an order immediately</div>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] group-hover:bg-white/[0.08] flex items-center justify-center text-white/35 group-hover:text-white/70 text-sm transition flex-none">
              →
            </div>
          </div>
        </motion.button>

        {/* Zone filter pills — compact, single row */}
        {zones.length > 2 && (
          <div className="flex gap-1.5 mb-5 flex-wrap">
            {zones.map((zone) => (
              <button
                key={zone}
                onClick={() => setFilterZone(zone)}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                  filterZone === zone
                    ? "bg-white/15 text-white"
                    : "text-white/35 hover:text-white/60 hover:bg-white/[0.06]"
                }`}
              >
                {zone === "all" ? "All Zones" : getZoneLabel(zone)}
              </button>
            ))}
          </div>
        )}

        {/* Tables — grouped by zone when showing all, single section when filtered */}
        {tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4 opacity-30">🪑</div>
            <div className="text-sm text-white/40 mb-4">No tables yet</div>
            <button
              onClick={() => setIsTableManagerOpen(true)}
              className="px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/60 hover:text-white transition"
            >
              Create First Table
            </button>
          </div>
        ) : filterZone !== "all" ? (
          // Single zone view
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">{getZoneLabel(filterZone)}</span>
              <div className="flex-1 h-px bg-white/[0.07]" />
              <span className="text-[10px] text-white/25">{filteredTables.length} table{filteredTables.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <AnimatePresence>
                {filteredTables.map((table) => renderTableCard(table))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          // All zones — grouped sections
          <div className="space-y-6">
            {sortedZones.map((zone) => (
              <div key={zone}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">{getZoneLabel(zone)}</span>
                  <div className="flex-1 h-px bg-white/[0.07]" />
                  <span className="text-[10px] text-white/25">{zoneGroups[zone].length} table{zoneGroups[zone].length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  <AnimatePresence>
                    {zoneGroups[zone].map((table) => renderTableCard(table))}
                  </AnimatePresence>
                </div>
              </div>
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
