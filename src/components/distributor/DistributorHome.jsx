import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebase/firebaseConfig";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import DistributorCreditDue from "./DistributorCreditDue";

const DistributorHome = () => {
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    dueCreditTotal: 0,
    inventoryCount: 0,
    lowStockCount: 0,
    yetToShip: 0,
    outForDelivery: 0,
  });

  const [creditBuckets, setCreditBuckets] = useState({
    overdue: [],
    today: [],
    tomorrow: [],
    upcoming: [],
    totals: { overdue: 0, today: 0, tomorrow: 0, upcoming: 0, allDue: 0 },
  });

  const [filters, setFilters] = useState({ bucket: 'ALL', sort: 'dueDate', dir: 'asc', query: '' });
  const [expanded, setExpanded] = useState({}); // orderId -> boolean

  const toggleRow = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const tsToDate = (ts) => {
    if (!ts) return null;
    // Firestore Timestamp or ISO string/date
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  };

  const computeDueDate = (docData) => {
    // Prefer explicit creditDueDate; else deliveredAt + creditDays
    const cd = tsToDate(docData.creditDueDate || docData.dueDate);
    if (cd) return cd;
    const delivered = tsToDate(docData.deliveredAt);
    const days = Number(docData.creditDays || 0);
    if (!delivered || !days) return null;
    const due = new Date(delivered);
    due.setDate(due.getDate() + days);
    return due;
  };

  const daysFromToday = (target) => {
    if (!target) return null;
    const start = new Date();
    start.setHours(0,0,0,0);
    const end = new Date(target);
    end.setHours(0,0,0,0);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000*60*60*24));
    return diff; // negative = overdue
  };

  useEffect(() => {
    const fetchStats = async () => {
      const distributorId = auth.currentUser?.uid;
      if (!distributorId) return;

      try {
        const orderSnap = await getDocs(
          collection(db, `businesses/${distributorId}/orderRequests`)
        );

        let total = 0,
          completed = 0,
          revenue = 0,
          dueCreditTotal = 0,
          yetToShip = 0,
          outForDelivery = 0;

        const dueOverdue = [];
        const dueToday = [];
        const dueTomorrow = [];
        const dueUpcoming = [];

        orderSnap.forEach((doc) => {
          const d = doc.data();
          total++;

          // Pending buckets
          if (d.status === "Accepted" || d.status === "Modified") yetToShip++;
          if (d.status === "Shipped" || d.status === "Out for Delivery") outForDelivery++;

          // Completed & money + due classification
          if (d.status === "Delivered") {
            completed++;
            if (d.isPaid === true) {
              revenue += Number(d.totalAmount || 0);
            } else if (d.isPaid === false) {
              const amt = Number(d.totalAmount || 0);
              dueCreditTotal += amt;
              const due = computeDueDate(d);
              const delta = daysFromToday(due);
              const row = {
                id: doc.id,
                retailerId: d.retailerId,
                retailer: d.retailerBusinessName || d.retailerName || "N/A",
                amount: amt,
                dueDate: due,
                daysLeft: delta,
                deliveredAt: tsToDate(d.deliveredAt),
                creditDays: Number(d.creditDays || 0),
                paymentMode: d.paymentMode || d.paymentMethod || 'Credit Cycle',
              };
              if (delta === 0) dueToday.push(row);
              else if (delta === 1) dueTomorrow.push(row);
              else if (delta < 0) dueOverdue.push(row);
              else dueUpcoming.push(row);
            }
          }
        });

        const productSnap = await getDocs(
          collection(db, `businesses/${distributorId}/products`)
        );

        let inventoryCount = 0,
          lowStockCount = 0;

        productSnap.forEach((doc) => {
          const d = doc.data();
          inventoryCount++;
          if (d.quantity < 5) lowStockCount++;
        });

        setStats({
          totalOrders: total,
          pendingOrders: yetToShip + outForDelivery,
          completedOrders: completed,
          totalRevenue: revenue,
          dueCreditTotal,
          inventoryCount,
          lowStockCount,
          yetToShip,
          outForDelivery,
        });

        // Sort buckets by due date ascending
        const byDate = (a,b) => (a.dueDate?.getTime?.() || 0) - (b.dueDate?.getTime?.() || 0);
        dueOverdue.sort(byDate);
        dueToday.sort(byDate);
        dueTomorrow.sort(byDate);
        dueUpcoming.sort(byDate);
        setCreditBuckets({
          overdue: dueOverdue,
          today: dueToday,
          tomorrow: dueTomorrow,
          upcoming: dueUpcoming,
          totals: {
            overdue: dueOverdue.reduce((s,x)=>s+x.amount,0),
            today: dueToday.reduce((s,x)=>s+x.amount,0),
            tomorrow: dueTomorrow.reduce((s,x)=>s+x.amount,0),
            upcoming: dueUpcoming.reduce((s,x)=>s+x.amount,0),
            allDue: dueOverdue.concat(dueToday,dueTomorrow,dueUpcoming).reduce((s,x)=>s+x.amount,0),
          }
        });

      // --- helpers for UI rows, actions ---
      } catch (err) {
        console.error("Error loading distributor stats:", err);
      }
    };

    fetchStats();
  }, []);

  // Build filtered + sorted rows from buckets
  const buildCreditRows = () => {
    let rows = [
      ...creditBuckets.overdue,
      ...creditBuckets.today,
      ...creditBuckets.tomorrow,
      ...creditBuckets.upcoming,
    ];

    // Filter by bucket
    if (filters.bucket !== 'ALL') {
      const map = {
        OVERDUE: creditBuckets.overdue,
        TODAY: creditBuckets.today,
        TOMORROW: creditBuckets.tomorrow,
        UPCOMING: creditBuckets.upcoming,
      };
      rows = map[filters.bucket] || rows;
    }

    // Search
    const q = (filters.query || '').toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        (r.retailer || '').toLowerCase().includes(q) || (r.id || '').toLowerCase().includes(q)
      );
    }

    // Sort
    const dir = filters.dir === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      if (filters.sort === 'amount') return (Number(a.amount) - Number(b.amount)) * dir;
      if (filters.sort === 'retailer') return (a.retailer || '').localeCompare(b.retailer || '') * dir;
      // default dueDate
      const at = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const bt = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return (at - bt) * dir;
    });

    return rows;
  };

  // Optimistically remove a row from local state after marking paid
  const removeRowFromBuckets = (id) => {
    setCreditBuckets((prev) => {
      const prune = (arr) => arr.filter((x) => x.id !== id);
      const newOver = prune(prev.overdue);
      const newToday = prune(prev.today);
      const newTom = prune(prev.tomorrow);
      const newUp = prune(prev.upcoming);
      const sum = (arr) => arr.reduce((s, x) => s + Number(x.amount || 0), 0);
      return {
        overdue: newOver,
        today: newToday,
        tomorrow: newTom,
        upcoming: newUp,
        totals: {
          overdue: sum(newOver),
          today: sum(newToday),
          tomorrow: sum(newTom),
          upcoming: sum(newUp),
          allDue: sum(newOver) + sum(newToday) + sum(newTom) + sum(newUp),
        },
      };
    });
  };

  // Action: mark credit as paid (updates both copies)
  const markCreditPaid = async (row) => {
    try {
      const distributorId = auth.currentUser?.uid; if (!distributorId) return;
      const distRef = doc(db, `businesses/${distributorId}/orderRequests/${row.id}`);
      const retailRef = row.retailerId ? doc(db, `businesses/${row.retailerId}/sentOrders/${row.id}`) : null;
      const payload = { isPaid: true, paymentStatus: 'Paid', paidAt: new Date().toISOString() };
      await updateDoc(distRef, payload);
      if (retailRef) await updateDoc(retailRef, payload);
      removeRowFromBuckets(row.id);
    } catch (e) {
      console.error('Failed to mark paid:', e);
      alert('Failed to mark paid. Please try again.');
    }
  };

  // Action: extend/update credit days (recomputes due date)
  const extendCredit = async (row) => {
    try {
      const currentDays = Number(row.creditDays || 15);
      const input = window.prompt('Set new total credit days for this order', String(currentDays));
      if (input === null) return; // cancelled
      const days = Number(input);
      if (!Number.isFinite(days) || days <= 0) {
        alert('Invalid number of days');
        return;
      }
      // compute new due date based on deliveredAt (fallback: today)
      const base = row.deliveredAt ? new Date(row.deliveredAt) : new Date();
      const due = new Date(base);
      due.setDate(due.getDate() + days);

      const distributorId = auth.currentUser?.uid; if (!distributorId) return;
      const distRef = doc(db, `businesses/${distributorId}/orderRequests/${row.id}`);
      const retailRef = row.retailerId ? doc(db, `businesses/${row.retailerId}/sentOrders/${row.id}`) : null;
      const payload = { creditDays: days, creditDueDate: due.toISOString() };
      await updateDoc(distRef, payload);
      if (retailRef) await updateDoc(retailRef, payload);

      // optimistic UI update
      setCreditBuckets((prev) => {
        const patch = (arr) => arr.map((x) => (x.id === row.id ? { ...x, creditDays: days, dueDate: due, daysLeft: daysFromToday(due) } : x));
        const newOver = patch(prev.overdue);
        const newToday = patch(prev.today);
        const newTom = patch(prev.tomorrow);
        const newUp = patch(prev.upcoming);
        const sum = (arr) => arr.reduce((s, x) => s + Number(x.amount || 0), 0);
        return {
          overdue: newOver,
          today: newToday,
          tomorrow: newTom,
          upcoming: newUp,
          totals: {
            overdue: sum(newOver),
            today: sum(newToday),
            tomorrow: sum(newTom),
            upcoming: sum(newUp),
            allDue: sum(newOver) + sum(newToday) + sum(newTom) + sum(newUp),
          },
        };
      });
    } catch (e) {
      console.error('Failed to extend credit:', e);
      alert('Failed to update credit days.');
    }
  };

  // Helper for deep-link navigation to Track Orders → Payment Due
  const goToPaymentDue = () => {
    try {
      const base = '#/distributor-dashboard';
      const current = window.location.hash || base;
      const [path] = current.split('?');
      const params = new URLSearchParams();
      params.set('tab', 'track-orders');
      params.set('sub', 'payment-due');
      window.location.hash = `${path}?${params.toString()}`;
    } catch {
      window.location.hash = '#/distributor-dashboard?tab=track-orders&sub=payment-due';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="p-6 space-y-6"
    >
      <h2 className="text-3xl font-bold">📦 Distributor Business Snapshot</h2>

      {/* Top KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white shadow-md rounded-lg p-4"
        >
          <p className="text-gray-500 text-sm">Total Orders</p>
          <p className="text-2xl font-bold">{stats.totalOrders}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white shadow-md rounded-lg p-4"
        >
          <p className="text-gray-500 text-sm">Pending Orders</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pendingOrders}</p>
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            <div className="flex items-center justify-between"><span>• Yet to ship</span><span className="font-semibold text-gray-700">{stats.yetToShip}</span></div>
            <div className="flex items-center justify-between"><span>• Out for delivery</span><span className="font-semibold text-gray-700">{stats.outForDelivery}</span></div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-white shadow-md rounded-lg p-4"
        >
          <p className="text-gray-500 text-sm">Completed Orders</p>
          <p className="text-2xl font-bold text-green-600">{stats.completedOrders}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="bg-white shadow-md rounded-lg p-4"
        >
          <p className="text-gray-500 text-sm">Total Revenue (Paid)</p>
          <p className="text-2xl font-bold text-blue-600">₹{stats.totalRevenue.toFixed(2)}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="bg-white shadow-md rounded-lg p-4"
        >
          <p className="text-gray-500 text-sm">Due Credit Total</p>
          <p className="text-2xl font-bold text-purple-600">₹{stats.dueCreditTotal.toFixed(2)}</p>
        </motion.div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-5 mt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-lg">🧾 Credit Due Snapshot</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold">Overdue: ₹{creditBuckets.totals.overdue.toLocaleString()}</span>
            <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold">Today: ₹{creditBuckets.totals.today.toLocaleString()}</span>
            <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">Tomorrow: ₹{creditBuckets.totals.tomorrow.toLocaleString()}</span>
            <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">Upcoming: ₹{creditBuckets.totals.upcoming.toLocaleString()}</span>
            <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold">Total: ₹{creditBuckets.totals.allDue.toLocaleString()}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
          <select
            className="border rounded px-2 py-1"
            value={filters.bucket}
            onChange={(e) => setFilters((p) => ({ ...p, bucket: e.target.value }))}
            aria-label="Filter bucket"
          >
            <option value="ALL">All</option>
            <option value="OVERDUE">Overdue</option>
            <option value="TODAY">Due Today</option>
            <option value="TOMORROW">Due Tomorrow</option>
            <option value="UPCOMING">Upcoming</option>
          </select>
          <select
            className="border rounded px-2 py-1"
            value={filters.sort}
            onChange={(e) => setFilters((p) => ({ ...p, sort: e.target.value }))}
            aria-label="Sort by"
          >
            <option value="dueDate">Sort: Due date</option>
            <option value="amount">Sort: Amount</option>
            <option value="retailer">Sort: Retailer</option>
          </select>
          <select
            className="border rounded px-2 py-1"
            value={filters.dir}
            onChange={(e) => setFilters((p) => ({ ...p, dir: e.target.value }))}
            aria-label="Sort direction"
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
          <input
            type="text"
            className="border rounded px-2 py-1 flex-1 min-w-[160px]"
            placeholder="Search retailer or order ID"
            value={filters.query}
            onChange={(e) => setFilters((p) => ({ ...p, query: e.target.value }))}
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Retailer</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Due Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows = buildCreditRows().slice(0, 12);
                if (rows.length === 0) {
                  return (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-gray-500">No credit dues found.</td>
                    </tr>
                  );
                }
                return rows.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm font-medium text-gray-800">
                        <button onClick={() => toggleRow(r.id)} className="text-blue-600 hover:underline mr-2">
                          {expanded[r.id] ? 'Hide' : 'Show'}
                        </button>
                        {r.retailer}
                        <div className="text-[11px] text-gray-500">#{r.id.slice(0,8)}</div>
                      </td>
                      <td className="px-3 py-2 text-sm text-right">₹{Number(r.amount||0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-sm">{r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-GB') : '—'}</td>
                      <td className="px-3 py-2 text-sm">
                        {r.daysLeft < 0 && (
                          <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">{Math.abs(r.daysLeft)} day(s) overdue</span>
                        )}
                        {r.daysLeft === 0 && (
                          <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">Due today</span>
                        )}
                        {r.daysLeft === 1 && (
                          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">Due tomorrow</span>
                        )}
                        {r.daysLeft > 1 && (
                          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">{r.daysLeft} days left</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-right">
                        <div className="inline-flex gap-2">
                          <button onClick={() => markCreditPaid(r)} className="px-2 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700">Mark Paid</button>
                          <button onClick={() => extendCredit(r)} className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700">Extend</button>
                        </div>
                      </td>
                    </tr>
                    {expanded[r.id] && (
                      <tr className="border-t bg-gray-50">
                        <td colSpan={5} className="px-4 py-3 text-sm">
                          <div className="flex flex-wrap gap-6">
                            <div>
                              <div className="text-gray-600 text-xs">Delivered</div>
                              <div className="font-medium">{r.deliveredAt ? new Date(r.deliveredAt).toLocaleDateString('en-GB') : '—'}</div>
                            </div>
                            <div>
                              <div className="text-gray-600 text-xs">Credit Days</div>
                              <div className="font-medium">{r.creditDays || '—'}</div>
                            </div>
                            <div>
                              <div className="text-gray-600 text-xs">Payment Mode</div>
                              <div className="font-medium">{r.paymentMode}</div>
                            </div>
                            <div>
                              <button onClick={goToPaymentDue} className="text-blue-600 hover:underline">Open in Track Orders</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ));
              })()}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-right text-sm">
          <button onClick={goToPaymentDue} className="text-blue-600 hover:underline">Go to Track Orders → Payment Due</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white shadow-md rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-2">📊 Order Trends</h3>
          <div className="h-40 bg-gray-100 rounded animate-pulse flex items-center justify-center text-gray-400">
            Loading chart...
          </div>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-2">💸 Revenue Insights</h3>
          <div className="h-40 bg-gray-100 rounded animate-pulse flex items-center justify-center text-gray-400">
            Loading chart...
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-4 mt-6 hover:shadow-lg transition duration-300">
        <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
          📅 Today’s Collection Schedule
        </h3>
        <p className="text-sm text-gray-600">
          Data will list retailers with dues today (future enhancement)
        </p>
      </div>
    </motion.div>
  );
};

export default DistributorHome;