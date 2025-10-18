import React, { useEffect, useMemo, useState } from 'react';
import POSBilling from '../pos/panel/POSBilling.jsx';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { empDB as db } from '../../firebase/firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { getEmployeeSession, clearEmployeeSession, isEmployeeRedirect, clearEmployeeRedirect } from '../../utils/employeeSession';

const EmployeeDashboard = () => {
  const [employee, setEmployee] = useState(null);
  const [now, setNow] = useState(new Date());
  const sess = getEmployeeSession();
  const retailerId = sess?.retailerId || '';
  const flypEmployeeId = (sess?.employeeId || '').toUpperCase();

  const [sections, setSections] = useState([]);

  useEffect(() => {
    if (!employee?.id || !retailerId) return;
    const empRef = doc(db, 'businesses', retailerId, 'employees', employee.id);
    const unsub = onSnapshot(empRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const access = data.accessSections || {};
        const mapped = Object.entries(access)
          .filter(([_, allowed]) => allowed)
          .map(([key]) => ({ key, label: key.charAt(0).toUpperCase() + key.slice(1) }));
        setSections(mapped);
      }
    });
    return () => unsub();
  }, [employee, retailerId]);
  const [activeTab, setActiveTab] = useState('');
  const [hasNavigated, setHasNavigated] = useState(false);
  const [posFullscreen, setPosFullscreen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    try {
      if (isEmployeeRedirect()) {
        clearEmployeeRedirect();
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    // Debounce guard to allow employeeSession to persist before we decide to redirect
    const timer = setTimeout(() => {
      const s = getEmployeeSession();
      const rid = s?.retailerId || '';
      const eid = (s?.employeeId || '').toUpperCase();

      // Guard: require employee session (navigate only once)
      if (!s || !rid || !eid) {
        clearEmployeeSession();
        if (!hasNavigated) {
          setHasNavigated(true);
          navigate('/employee-login', { replace: true });
        }
        return;
      }

      // Fetch employee doc and mark presence (best-effort)
      (async () => {
        try {
          const empRef = doc(db, 'businesses', rid, 'employees', eid);
          const empSnap = await getDoc(empRef);
          if (!empSnap.exists()) {
            if (!hasNavigated) {
              setHasNavigated(true);
              navigate('/employee-login', { replace: true });
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
            navigate('/employee-login', { replace: true });
          }
        }
      })();
    }, 400); // wait 400ms to avoid race on first mount

    return () => clearTimeout(timer);
  }, [hasNavigated, navigate]);

  useEffect(() => {
    // live clock
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // choose first available section as default when employee loads
    if (sections.length && !activeTab) setActiveTab(sections[0].key);
  }, [sections, activeTab]);

  const handleLogout = async () => {
    if (retailerId && flypEmployeeId) {
      try {
        await setDoc(
          doc(db, 'businesses', retailerId, 'employees', flypEmployeeId),
          { online: false, lastSeen: serverTimestamp() },
          { merge: true }
        );
      } catch (e) {
        console.warn('Presence clear failed (non-fatal):', e);
      }
    }
    clearEmployeeSession();
    navigate('/employee-login', { replace: true });
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

  // --- Tiny SVG icon helpers (no external deps) ---
  const Icon = {
    inventory: (cls='w-5 h-5') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="6" rx="1" className="" />
        <path d="M5 10v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        <path d="M9 14h6" />
      </svg>
    ),
    billing: (cls='w-5 h-5') => (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18" />
        <path d="M7 13h4M7 17h6" />
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

    if (activeTab === 'inventory') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Update Stock" icon={Icon.inventory('w-4 h-4')}>
            Quickly adjust quantities, record wastage, and scan barcodes to update items.
          </Panel>
          <Panel title="Low-stock Alerts" icon={Icon.inventory('w-4 h-4')}>
            View items below threshold and notify your manager for purchase.
          </Panel>
        </div>
      );
    }
    if (activeTab === 'billing') {
      const emp = getEmployeeSession();
      return (
        <div className="space-y-4">
          {/* Section header chip */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300 text-xs">
              {Icon.billing('w-4 h-4')} <span>Billing</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPosFullscreen((v) => !v)}
                className="text-xs rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10"
                aria-label={posFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {posFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
            </div>
          </div>

          <div className="text-sm text-slate-300">
            You have access to create and manage invoices for this business.
          </div>

          {/* Embed the real POSBilling system with responsive container */}
          <div
            className={
              posFullscreen
                ? 'fixed inset-0 z-50 bg-slate-950/95 backdrop-blur px-2 sm:px-4 py-2 sm:py-4'
                : 'rounded-2xl border border-white/10 bg-white/5 p-2 sm:p-4 shadow-sm'
            }
          >
            {posFullscreen && (
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="inline-flex items-center gap-2 text-slate-200 text-sm">
                  {Icon.billing('w-4 h-4')} <span className="font-medium">Billing POS</span>
                </div>
                <button
                  onClick={() => setPosFullscreen(false)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            )}
            <div className={posFullscreen ? 'h-[calc(100vh-4.5rem)] sm:h-[calc(100vh-5.5rem)] overflow-auto rounded-xl' : 'rounded-xl'}>
              <POSBilling
                retailerId={emp?.retailerId}
                employeeId={emp?.employeeId}
                employeeName={employee?.name || 'Employee'}
                role={employee?.role || 'Staff'}
              />
            </div>
          </div>
        </div>
      );
    }
    if (activeTab === 'analytics') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Today’s Sales" icon={Icon.analytics('w-4 h-4')}>
            Snapshot of revenue, items sold, and average order value.
          </Panel>
          <Panel title="Top Items" icon={Icon.analytics('w-4 h-4')}>
            See the best performers for quick restock or promotion.
          </Panel>
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
            <div className="text-xs text-slate-400 mb-1">Retailer ID</div>
            <div className="font-medium break-all">{retailerId}</div>
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
                {s.key === 'inventory' && Icon.inventory('w-4 h-4')}
                {s.key === 'billing' && Icon.billing('w-4 h-4')}
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

export default EmployeeDashboard;