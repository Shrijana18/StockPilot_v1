import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { db, empAuth, functions } from '../../../firebase/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { getDistributorEmployeeSession, clearDistributorEmployeeSession, isDistributorEmployeeRedirect, clearDistributorEmployeeRedirect } from '../../../utils/distributorEmployeeSession';

// Import distributor components
import AddRetailerModal from '../AddRetailerModal';
import PassiveOrders from '../orders/PassiveOrders';
import OrderRequests from '../orders/OrderRequests';
import PendingOrders from '../orders/PendingOrders';
import TrackOrders from '../orders/TrackOrders';
import BusinessAnalytics from '../../dashboard/businessAnalytics/BusinessAnalytics';

const DistributorEmployeeDashboard = () => {
  const [employee, setEmployee] = useState(null);
  const [now, setNow] = useState(new Date());
  const sess = getDistributorEmployeeSession();
  const distributorId = sess?.distributorId || '';
  const employeeId = sess?.employeeId || '';

  const [sections, setSections] = useState([]);
  const [activeTab, setActiveTab] = useState('');
  const [hasNavigated, setHasNavigated] = useState(false);
  const [addRetailerOpen, setAddRetailerOpen] = useState(false);
  const [activity, setActivity] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    try {
      if (isDistributorEmployeeRedirect()) {
        clearDistributorEmployeeRedirect();
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const s = getDistributorEmployeeSession();
      const did = s?.distributorId || '';
      const eid = s?.employeeId || '';

      if (!s || !did || !eid) {
        clearDistributorEmployeeSession();
        if (!hasNavigated) {
          setHasNavigated(true);
          navigate('/distributor-employee-login', { replace: true });
        }
        return;
      }

      // Check if user is properly authenticated with Employee Auth
      if (!empAuth.currentUser) {
        clearDistributorEmployeeSession();
        if (!hasNavigated) {
          setHasNavigated(true);
          navigate('/distributor-employee-login', { replace: true });
        }
        return;
      }

      (async () => {
        try {
          // Use the Employee Auth UID as the document ID (set in the custom token)
          const empRef = doc(db, 'businesses', did, 'distributorEmployees', empAuth.currentUser.uid);
          const empSnap = await getDoc(empRef);
          if (!empSnap.exists()) {
            if (!hasNavigated) {
              setHasNavigated(true);
              navigate('/distributor-employee-login', { replace: true });
            }
            return;
          }
          const data = empSnap.data();
          setEmployee({ id: eid, ...data });
          try {
            await setDoc(empRef, { lastSeen: serverTimestamp(), online: true }, { merge: true });
          } catch (e) {
            console.warn('Presence update failed (non-fatal):', e);
          }
        } catch (e) {
          console.error('Failed to load employee (redirecting to login):', e);
          if (!hasNavigated) {
            setHasNavigated(true);
            navigate('/distributor-employee-login', { replace: true });
          }
        }
      })();
    }, 400);

    return () => clearTimeout(timer);
  }, [hasNavigated, navigate]);

  useEffect(() => {
    if (!employee?.id || !distributorId) return;
    const empRef = doc(db, 'businesses', distributorId, 'distributorEmployees', employee.id);
    const unsub = onSnapshot(empRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const access = data.accessSections || {};
        const mapped = Object.entries(access)
          .filter(([_, allowed]) => allowed)
          .map(([key]) => ({ 
            key, 
            label: key === 'addRetailers' ? 'Add Retailers' :
                   key === 'createOrders' ? 'Create Orders' :
                   key === 'manageOrders' ? 'Manage Orders' :
                   key === 'trackOrders' ? 'Track Orders' :
                   key === 'analytics' ? 'Analytics' :
                   key.charAt(0).toUpperCase() + key.slice(1)
          }));
        setSections(mapped);
      }
    });
    return () => unsub();
  }, [employee, distributorId]);

  // Live activity feed (latest 20)
  useEffect(() => {
    if (!distributorId) return;
    const col = collection(db, 'businesses', distributorId, 'employeeActivity');
    const q = query(col, orderBy('createdAt', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      setActivity(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [distributorId]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (sections.length && !activeTab) setActiveTab(sections[0].key);
  }, [sections, activeTab]);

  // Open the AddRetailer modal when switching into the tab; allow closing via onClose
  useEffect(() => {
    if (activeTab === 'addRetailers') {
      setAddRetailerOpen(true);
    } else {
      setAddRetailerOpen(false);
    }
  }, [activeTab]);

  const handleLogout = async () => {
    if (distributorId && flypEmployeeId) {
      try {
        await setDoc(
          doc(db, 'businesses', distributorId, 'distributorEmployees', flypEmployeeId),
          { online: false, lastSeen: serverTimestamp() },
          { merge: true }
        );
      } catch (e) {
        console.warn('Presence clear failed (non-fatal):', e);
      }
    }
    clearDistributorEmployeeSession();
    navigate('/distributor-employee-login', { replace: true });
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp?.toDate) return '-';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return date.toLocaleTimeString();
    return date.toLocaleDateString();
  };

  const Icon = {
    addRetailers: (cls='w-5 h-5') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    createOrders: (cls='w-5 h-5') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10,9 9,9 8,9" />
      </svg>
    ),
    manageOrders: (cls='w-5 h-5') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="6" rx="1" />
        <path d="M5 10v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        <path d="M9 14h6" />
      </svg>
    ),
    trackOrders: (cls='w-5 h-5') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v5l5-5-5-5z" />
        <path d="M3 8v5l5-5-5-5z" />
        <path d="M3 13v5l5-5-5-5z" />
        <path d="M3 18v5l5-5-5-5z" />
        <path d="M8 3h5l-5 5-5-5z" />
        <path d="M8 8h5l-5 5-5-5z" />
        <path d="M8 13h5l-5 5-5-5z" />
        <path d="M8 18h5l-5 5-5-5z" />
      </svg>
    ),
    analytics: (cls='w-5 h-5') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 19V5" />
        <path d="M10 19V9" />
        <path d="M16 19V3" />
        <path d="M22 19V12" />
      </svg>
    ),
    check: (cls='w-4 h-4') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
    ),
  };

  const renderActiveSection = () => {
    const Panel = ({ title, icon, children }) => (
      <div className="rounded-xl border border-white/10 bg-white/70 backdrop-blur shadow-sm p-4 dark:bg-white/5">
        <div className="flex items-center gap-2 mb-2 text-slate-800 dark:text-slate-100">
          {icon}
          <h3 className="font-semibold text-sm tracking-wide">{title}</h3>
        </div>
        <div className="text-sm text-slate-700/90 dark:text-slate-300">{children}</div>
      </div>
    );

    if (activeTab === 'addRetailers') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300 text-xs">
              {Icon.addRetailers('w-4 h-4')} <span>Add Retailers</span>
            </div>
          </div>
          <div className="text-sm text-slate-300">
            You can add new retailers to the distributor network.
          </div>
          <AddRetailerModal
            open={addRetailerOpen}
            onClose={() => setAddRetailerOpen(false)}
            distributorId={distributorId}
            createdBy={{ type: 'employee', id: employeeId, name: employee?.name || '', flypEmployeeId: employee?.flypEmployeeId || '' }}
            onCreated={async (payload) => {
              try {
                const logFn = httpsCallable(functions, 'logDistributorActivity');
                await logFn({
                  distributorId,
                  employeeId: employeeId,
                  type: 'addRetailer',
                  targetId: payload?.retailerId || null,
                  meta: { name: payload?.businessName || payload?.name || '' }
                });
              } catch (e) {
                console.warn('Activity log failed:', e?.message || e);
              }
            }}
            useCloudFunction={true}
            toast={(opts) => {
              if (opts.type === 'success') {
                console.log('Success:', opts.message);
              } else if (opts.type === 'error') {
                console.error('Error:', opts.message);
              }
            }}
            uiVariant="embedded"
            autofocus={false}
          />
        </div>
      );
    }

    if (activeTab === 'createOrders') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300 text-xs">
              {Icon.createOrders('w-4 h-4')} <span>Create Orders</span>
            </div>
          </div>
          <div className="text-sm text-slate-300">
            Create passive orders for retailers in the network.
          </div>
          <PassiveOrders />
        </div>
      );
    }

    if (activeTab === 'manageOrders') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300 text-xs">
              {Icon.manageOrders('w-4 h-4')} <span>Manage Orders</span>
            </div>
          </div>
          <div className="text-sm text-slate-300">
            Manage order requests and pending orders.
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Order Requests" icon={Icon.manageOrders('w-4 h-4')}>
              Handle incoming order requests from retailers.
            </Panel>
            <Panel title="Pending Orders" icon={Icon.manageOrders('w-4 h-4')}>
              Manage orders that are being processed.
            </Panel>
          </div>
          <OrderRequests />
        </div>
      );
    }

    if (activeTab === 'trackOrders') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300 text-xs">
              {Icon.trackOrders('w-4 h-4')} <span>Track Orders</span>
            </div>
          </div>
          <div className="text-sm text-slate-300">
            Track and monitor order status and delivery.
          </div>
          <TrackOrders />
        </div>
      );
    }

    if (activeTab === 'analytics') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300 text-xs">
              {Icon.analytics('w-4 h-4')} <span>Analytics</span>
            </div>
          </div>
          <div className="text-sm text-slate-300">
            View business analytics and performance reports.
          </div>
          <BusinessAnalytics />
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-dashed border-slate-300/40 dark:border-white/10 p-6 text-center text-slate-600 dark:text-slate-300">
        No sections assigned yet. Ask your manager to grant permissions.
      </div>
    );
  };

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-2 text-gray-700">
        <div className="animate-spin h-8 w-8 border-4 border-blue-400 border-t-transparent rounded-full"></div>
        <p>Fetching your workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/70 backdrop-blur px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">{Icon.check('w-5 h-5')}</div>
            <div>
              <h1 className="text-lg md:text-xl font-semibold">Welcome, {employee.name || 'Employee'}</h1>
              <p className="text-xs text-slate-400">FLYP ID: {employee.flypEmployeeId || employee.id || '-'} • Role: {employee.role || 'Employee'}</p>
            </div>
          </div>
          <div className="text-xs md:text-sm text-slate-300">Current time: {now.toLocaleString()}</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 md:py-8 space-y-6">
        {/* Quick info cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-slate-400 mb-1">Status</div>
            <div className="font-semibold text-emerald-400">{employee.online ? 'Online' : 'Offline'}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-slate-400 mb-1">Distributor ID</div>
            <div className="font-medium break-all">{distributorId}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-slate-400 mb-1">Last Seen</div>
            <div className="font-medium">{formatLastSeen(employee.lastSeen)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-slate-400 mb-1">Sections</div>
            <div className="font-medium">{sections.map(s => s.label).join(', ') || 'None'}</div>
          </div>
        </section>

        {/* Tabs */}
        <section className="rounded-2xl border border-white/10 bg-white/5">
          <div className="flex gap-2 px-3 pt-3">
            {sections.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveTab(s.key)}
                className={`group inline-flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm transition ${activeTab === s.key ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-200 hover:bg-white/10'}`}
              >
                {s.key === 'addRetailers' && Icon.addRetailers('w-4 h-4')}
                {s.key === 'createOrders' && Icon.createOrders('w-4 h-4')}
                {s.key === 'manageOrders' && Icon.manageOrders('w-4 h-4')}
                {s.key === 'trackOrders' && Icon.trackOrders('w-4 h-4')}
                {s.key === 'analytics' && Icon.analytics('w-4 h-4')}
                <span>{s.label}</span>
              </button>
            ))}
            {!sections.length && (
              <span className="text-xs text-slate-400 px-3 py-2">No Sections</span>
            )}
          </div>
          <div className="p-4 md:p-6">
            {renderActiveSection()}
          </div>
        </section>

      {/* Activity feed */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="font-semibold text-sm mb-2">Recent Activity</div>
        {activity.length === 0 ? (
          <div className="text-xs text-slate-400">No activity yet.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {activity.map(a => (
              <li key={a.id} className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <div>
                  <span className="font-medium capitalize">{a.type}</span>
                  {a.meta?.name ? <span className="ml-2 text-slate-300">{a.meta.name}</span> : null}
                  {a.employeeId ? <span className="ml-2 text-xs text-slate-400">by {a.employeeId}</span> : null}
                </div>
                <div className="text-xs text-slate-400">{a.createdAt?.toDate?.().toLocaleString?.() || ''}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

        {/* Contact/Help & Logout */}
        <section className="flex items-center justify-between">
          <p className="text-xs text-slate-400">Need access to more sections? Ask your manager to update your permissions.</p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
          >
            Logout
          </button>
        </section>
      </main>
    </div>
  );
};

export default DistributorEmployeeDashboard;
