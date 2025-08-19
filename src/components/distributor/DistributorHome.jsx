import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebase/firebaseConfig";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";

import DistributorCreditDue from "./DistributorCreditDue";

// --- UI-ONLY helpers (no logic changed) ---
const GlassCard = ({ className = "", children }) => (
  <div className={`rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl hover:shadow-emerald-400/10 hover:scale-[1.005] transition duration-300 vignette ${className}`}>
    {children}
  </div>
);

const StatCard = ({ label, value, note, tone = "default" }) => {
  const toneMap = {
    default: "text-white",
    yellow: "text-amber-300",
    green: "text-emerald-300",
    blue: "text-cyan-300",
    purple: "text-fuchsia-300",
  };
  return (
    <GlassCard className="p-4">
      <p className="text-xs uppercase tracking-wide text-white/70">{label}</p>
      <div className={`mt-1 text-2xl font-semibold ${toneMap[tone] || toneMap.default}`}>{value}</div>
      {note && <div className="mt-2 text-[11px] text-white/70 space-y-1">{note}</div>}
    </GlassCard>
  );
};

const Pill = ({ children, tone = "neutral" }) => {
  const toneCls = {
    danger: "bg-red-400/15 text-red-300",
    warning: "bg-orange-400/15 text-orange-300",
    amber: "bg-amber-400/15 text-amber-300",
    info: "bg-sky-400/15 text-sky-300",
    purple: "bg-fuchsia-400/15 text-fuchsia-300",
    neutral: "bg-white/10 text-white/90",
  }[tone];
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${toneCls}`}>{children}</span>;
};

const SectionHeader = ({ title, icon }) => (
  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
    <span className="text-xl">{icon}</span>
    <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">{title}</span>
  </h3>
);

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
      className="p-6 space-y-6 text-white"
    >
      <div className="relative">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">📦 Distributor Business Snapshot</h2>
        <div className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" />
      </div>

      {/* Top KPI Stats (glass) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Orders" value={stats.totalOrders} />
        <StatCard
          label="Pending Orders"
          value={stats.pendingOrders}
          tone="yellow"
          note={(
            <>
              <div className="flex items-center justify-between"><span>• Yet to ship</span><span className="font-semibold text-white">{stats.yetToShip}</span></div>
              <div className="flex items-center justify-between"><span>• Out for delivery</span><span className="font-semibold text-white">{stats.outForDelivery}</span></div>
            </>
          )}
        />
        <StatCard label="Completed Orders" value={stats.completedOrders} tone="green" />
        <StatCard label="Total Revenue (Paid)" value={`₹${stats.totalRevenue.toFixed(2)}`} tone="blue" />
        <StatCard label="Due Credit Total" value={`₹${stats.dueCreditTotal.toFixed(2)}`} tone="purple" />
      </div>

      <GlassCard className="p-5 mt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-lg">🧾 Credit Due Snapshot</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <Pill tone="danger">Overdue: ₹{creditBuckets.totals.overdue.toLocaleString()}</Pill>
            <Pill tone="warning">Today: ₹{creditBuckets.totals.today.toLocaleString()}</Pill>
            <Pill tone="amber">Tomorrow: ₹{creditBuckets.totals.tomorrow.toLocaleString()}</Pill>
            <Pill tone="info">Upcoming: ₹{creditBuckets.totals.upcoming.toLocaleString()}</Pill>
            <Pill tone="purple">Total: ₹{creditBuckets.totals.allDue.toLocaleString()}</Pill>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
          <select
            className="rounded-lg bg-white/10 border border-white/20 text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            value={filters.bucket}
            onChange={(e) => setFilters((p) => ({ ...p, bucket: e.target.value }))}
            aria-label="Filter bucket"
          >
            <option className="text-slate-900" value="ALL">All</option>
            <option className="text-slate-900" value="OVERDUE">Overdue</option>
            <option className="text-slate-900" value="TODAY">Due Today</option>
            <option className="text-slate-900" value="TOMORROW">Due Tomorrow</option>
            <option className="text-slate-900" value="UPCOMING">Upcoming</option>
          </select>
          <select
            className="rounded-lg bg-white/10 border border-white/20 text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            value={filters.sort}
            onChange={(e) => setFilters((p) => ({ ...p, sort: e.target.value }))}
            aria-label="Sort by"
          >
            <option className="text-slate-900" value="dueDate">Sort: Due date</option>
            <option className="text-slate-900" value="amount">Sort: Amount</option>
            <option className="text-slate-900" value="retailer">Sort: Retailer</option>
          </select>
          <select
            className="rounded-lg bg-white/10 border border-white/20 text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            value={filters.dir}
            onChange={(e) => setFilters((p) => ({ ...p, dir: e.target.value }))}
            aria-label="Sort direction"
          >
            <option className="text-slate-900" value="asc">Asc</option>
            <option className="text-slate-900" value="desc">Desc</option>
          </select>
          <input
            type="text"
            className="rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 px-2 py-1 flex-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            placeholder="Search retailer or order ID"
            value={filters.query}
            onChange={(e) => setFilters((p) => ({ ...p, query: e.target.value }))}
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-white/10 rounded-lg">
          <table className="min-w-full table-auto">
            <thead className="bg-white/10">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white/80">Retailer</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-white/80">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white/80">Due Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-white/80">Status</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-white/80">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows = buildCreditRows().slice(0, 12);
                if (rows.length === 0) {
                  return (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-white/60">No credit dues found.</td>
                    </tr>
                  );
                }
                return rows.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-3 py-2 text-sm font-medium text-white">
                        <button onClick={() => toggleRow(r.id)} className="text-emerald-300 hover:underline mr-2">
                          {expanded[r.id] ? 'Hide' : 'Show'}
                        </button>
                        {r.retailer}
                        <div className="text-[11px] text-white/60">#{r.id.slice(0,8)}</div>
                      </td>
                      <td className="px-3 py-2 text-sm text-right">₹{Number(r.amount||0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-sm">{r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-GB') : '—'}</td>
                      <td className="px-3 py-2 text-sm">
                        {r.daysLeft < 0 && (
                          <span className="px-2 py-1 rounded-full bg-red-400/15 text-red-300 text-xs font-semibold">{Math.abs(r.daysLeft)} day(s) overdue</span>
                        )}
                        {r.daysLeft === 0 && (
                          <span className="px-2 py-1 rounded-full bg-orange-400/15 text-orange-300 text-xs font-semibold">Due today</span>
                        )}
                        {r.daysLeft === 1 && (
                          <span className="px-2 py-1 rounded-full bg-amber-400/15 text-amber-300 text-xs font-semibold">Due tomorrow</span>
                        )}
                        {r.daysLeft > 1 && (
                          <span className="px-2 py-1 rounded-full bg-sky-400/15 text-sky-300 text-xs font-semibold">{r.daysLeft} days left</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-right">
                        <div className="inline-flex gap-2">
                          <button onClick={() => markCreditPaid(r)} className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60">Mark Paid</button>
                          <button onClick={() => extendCredit(r)} className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-900 bg-gradient-to-r from-sky-400 to-indigo-500 hover:shadow-[0_8px_24px_rgba(56,189,248,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60">Extend</button>
                        </div>
                      </td>
                    </tr>
                    {expanded[r.id] && (
                      <tr className="border-t border-white/10 bg-white/5">
                        <td colSpan={5} className="px-4 py-3 text-sm">
                          <div className="flex flex-wrap gap-6">
                            <div>
                              <div className="text-white/70 text-xs">Delivered</div>
                              <div className="font-medium">{r.deliveredAt ? new Date(r.deliveredAt).toLocaleDateString('en-GB') : '—'}</div>
                            </div>
                            <div>
                              <div className="text-white/70 text-xs">Credit Days</div>
                              <div className="font-medium">{r.creditDays || '—'}</div>
                            </div>
                            <div>
                              <div className="text-white/70 text-xs">Payment Mode</div>
                              <div className="font-medium">{r.paymentMode}</div>
                            </div>
                            <div>
                              <button onClick={goToPaymentDue} className="text-emerald-300 hover:underline">Open in Track Orders</button>
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
          <button onClick={goToPaymentDue} className="text-emerald-300 hover:underline">Go to Track Orders → Payment Due</button>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <GlassCard className="p-4">
          <SectionHeader title="Order Trends" icon={<span>📊</span>} />
          <div className="h-40 rounded bg-white/5 animate-pulse flex items-center justify-center text-white/50">
            Loading chart...
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <SectionHeader title="Revenue Insights" icon={<span>💸</span>} />
          <div className="h-40 rounded bg-white/5 animate-pulse flex items-center justify-center text-white/50">
            Loading chart...
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4 mt-6 hover:shadow-emerald-400/10">
        <SectionHeader title="Today’s Collection Schedule" icon={<span>📅</span>} />
        <p className="text-sm text-white/70">Data will list retailers with dues today (future enhancement)</p>
      </GlassCard>
    </motion.div>
  );
};

export default DistributorHome;