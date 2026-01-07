import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db, auth } from "../../../firebase/firebaseConfig";
import { collection, doc, getDocs, setDoc, query, where, orderBy, addDoc, updateDoc, onSnapshot } from "firebase/firestore";
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
export default function RestaurantPOS({ onBack }) {
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
        if (data.status !== "completed" && data.status !== "served") {
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
          if (data.status !== "completed" && data.status !== "served") {
            orders.push({ id: docSnap.id, ...data });
          }
        });
        setKitchenOrders(orders);
      });
    });

    return () => unsubscribe();
  }, []);

  // Get table status based on orders
  const getTableStatus = (tableId) => {
    const tableOrders = kitchenOrders.filter(o => o.tableId === tableId);
    if (tableOrders.length === 0) return { status: "available", orderCount: 0, latestOrder: null };
    
    const latestOrder = tableOrders[0];
    return {
      status: "occupied",
      orderCount: tableOrders.length,
      latestOrder,
      orderStatus: latestOrder.status, // pending | preparing | ready
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
        onOrderSentToKitchen={async (orderData) => {
          // Send order to kitchen
          const uid = getUid();
          if (!uid) return;

          try {
            const kitchenOrdersRef = collection(db, "businesses", uid, "kitchenOrders");
            await addDoc(kitchenOrdersRef, {
              invoiceId: orderData.invoiceId || null,
              items: orderData.lines || orderData.items || [],
              lines: orderData.lines || [],
              totals: orderData.totals || {},
              tableId: selectedTable?.id || null,
              customerId: selectedCustomer?.id || null,
              customerName: selectedCustomer?.name || selectedTable?.name || "Walk-in",
              status: "pending", // pending | preparing | ready | served | completed
              createdAt: Date.now(),
              sentAt: Date.now(),
            });

            // Update table status to occupied if it's a table order
            if (selectedTable?.id) {
              const tableRef = doc(db, "businesses", uid, "tables", selectedTable.id);
              await updateDoc(tableRef, {
                status: "occupied",
                lastOrderAt: Date.now(),
              });
            }
          } catch (e) {
            console.error("Error sending order to kitchen:", e);
            alert("Failed to send order to kitchen");
          }
        }}
      />
    );
  }

  const zones = ["all", ...new Set(tables.map(t => t.zone).filter(Boolean))];
  const filteredTables = filterZone === "all" 
    ? tables 
    : tables.filter(t => t.zone === filterZone);

  const availableCount = filteredTables.filter(t => getTableStatus(t.id).status === "available").length;
  const occupiedCount = filteredTables.filter(t => getTableStatus(t.id).status === "occupied").length;

  return (
    <div className="relative w-full min-h-screen bg-transparent">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.9]">
        <div className="absolute -top-1/3 -left-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-emerald-500/20" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[70%] h-[70%] rounded-full blur-3xl bg-cyan-500/20" />
      </div>

      {/* Top Bar */}
      <div className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
        <div className="px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-lg bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 text-slate-900 px-4 py-2 text-sm font-semibold shadow hover:shadow-lg transition"
            >
              ← Back
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white/90">Restaurant POS</h1>
            <p className="text-xs text-white/60">Select table or customer to start</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-white/80">{availableCount} Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <span className="text-white/80">{occupiedCount} Occupied</span>
              </div>
            </div>
            <button
              onClick={() => {
                // Open Menu Builder by navigating to KDS menu mode
                // This will be handled by the parent POSView component
                if (window.location.href.includes('dashboard')) {
                  window.location.href = window.location.href.split('?')[0] + '?mode=pos&view=kds&tab=menu';
                } else {
                  // Fallback: could use a callback prop if needed
                  alert('Menu Builder: Navigate to POS > Kitchen Display > Menu Builder');
                }
              }}
              className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium text-white/90 transition"
              title="Open Menu Builder to create/edit menu items"
            >
              📜 Menu Builder
            </button>
            <button
              onClick={() => setIsTableManagerOpen(true)}
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-emerald-500/25 transition"
            >
              + Add Table
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-[calc(100vh-128px)] p-6">
        <div className="max-w-7xl mx-auto">
          {/* Walk-in Customer Card */}
          <motion.button
            whileHover={{ scale: 1.01, y: -2 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleCustomerSelect}
            className="w-full mb-6 group relative text-left rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-xl p-6 shadow-lg hover:shadow-emerald-500/30 transition"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-400/10 via-cyan-400/10 to-transparent opacity-0 group-hover:opacity-100 blur-xl transition" />
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-3xl">
                👤
              </div>
              <div className="flex-1">
                <div className="text-xl font-semibold text-white">Walk-in Customer</div>
                <div className="text-sm text-white/70 mt-1">Start order for a walk-in customer</div>
              </div>
              <span className="text-2xl text-emerald-300">→</span>
            </div>
          </motion.button>

          {/* Zone Filters */}
          {zones.length > 2 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {zones.map((zone) => (
                <button
                  key={zone}
                  onClick={() => setFilterZone(zone)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    filterZone === zone
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                      : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/10"
                  }`}
                >
                  {zone === "all" ? "All Zones" : zone.charAt(0).toUpperCase() + zone.slice(1)}
                </button>
              ))}
            </div>
          )}

          {/* Tables Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Tables</h2>
              <div className="text-sm text-white/60">{filteredTables.length} tables</div>
            </div>
            {filteredTables.length === 0 ? (
              <div className="text-center py-12 text-white/60">
                <div className="text-4xl mb-3">🪑</div>
                <div>No tables created yet</div>
                <button
                  onClick={() => setIsTableManagerOpen(true)}
                  className="mt-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm text-white transition"
                >
                  Create First Table
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                <AnimatePresence>
                  {filteredTables.map((table) => {
                    const tableStatus = getTableStatus(table.id);
                    const isOccupied = tableStatus.status === "occupied";
                    const isReserved = table.status === "reserved";
                    const isCleaning = table.status === "cleaning";
                    
                    return (
                      <motion.button
                        key={table.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleTableSelect(table)}
                        disabled={isCleaning}
                        className={`relative rounded-xl border p-4 text-left transition-all ${
                          isOccupied
                            ? "border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 shadow-lg shadow-orange-500/10"
                            : isReserved
                            ? "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20"
                            : isCleaning
                            ? "border-slate-500/50 bg-slate-500/10 opacity-50 cursor-not-allowed"
                            : "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                        }`}
                      >
                        {/* Status Badge */}
                        {isOccupied && (
                          <div className="absolute top-2 right-2">
                            <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              tableStatus.orderStatus === "pending" 
                                ? "bg-amber-500/20 text-amber-300"
                                : tableStatus.orderStatus === "preparing"
                                ? "bg-blue-500/20 text-blue-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}>
                              {tableStatus.orderStatus === "pending" ? "Pending" :
                               tableStatus.orderStatus === "preparing" ? "Preparing" :
                               tableStatus.orderStatus === "ready" ? "Ready" : "Active"}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between mb-2 group">
                          <div className={`text-lg font-bold ${
                            isOccupied ? "text-orange-300" : 
                            isReserved ? "text-amber-300" : 
                            "text-emerald-300"
                          }`}>
                            {table.name || `Table ${table.number}`}
                          </div>
                          <button
                            onClick={(e) => handleEditTable(e, table)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white text-xs"
                            title="Edit table"
                          >
                            ✏️
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm text-white/60 mb-2">
                          <div className="flex items-center gap-1">
                            <span>👥</span>
                            <span>{table.capacity || 4}</span>
                          </div>
                          {isOccupied && tableStatus.orderCount > 0 && (
                            <div className="flex items-center gap-1">
                              <span>📋</span>
                              <span>{tableStatus.orderCount}</span>
                            </div>
                          )}
                        </div>

                        {table.zone && (
                          <div className="text-xs text-white/40 mt-1">Zone: {table.zone}</div>
                        )}

                        {/* Status Indicator */}
                        <div className="absolute bottom-2 right-2">
                          <div className={`w-2 h-2 rounded-full ${
                            isOccupied ? "bg-orange-500" :
                            isReserved ? "bg-amber-500" :
                            isCleaning ? "bg-slate-500" :
                            "bg-emerald-500"
                          }`}></div>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table Manager Modal */}
      <TableManager
        open={isTableManagerOpen}
        onClose={() => {
          setIsTableManagerOpen(false);
          setEditingTable(null);
        }}
        editingTable={editingTable}
        onTableCreated={() => {
          setIsTableManagerOpen(false);
          setEditingTable(null);
        }}
      />
    </div>
  );
}
