import React, { useMemo, useState, useRef, useEffect } from 'react';

// --- utils ---
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();

  // If already a Date
  if (raw instanceof Date && !isNaN(raw)) return raw;

  // If Firestore timestamp-like object
  if (typeof dateStr === 'object' && dateStr?.seconds) {
    const d = new Date(dateStr.seconds * 1000);
    return isNaN(d) ? null : d;
  }

  // Normalize separators
  const sep = raw.includes('/') ? '/' : (raw.includes('-') ? '-' : '');
  const parts = sep ? raw.split(sep).map(p => p.trim()) : [];

  // Helper to build Date safely
  const build = (y, m, d) => {
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(dt) ? null : dt;
  };

  // 1) India-first with separators: dd/mm/yyyy or dd-mm-yyyy
  if (parts.length === 3) {
    let [p1, p2, p3] = parts;
    // Detect which is year
    if (p3.length === 4) {
      // Prefer dd/mm/yyyy
      let d = Number(p1), m = Number(p2), y = Number(p3);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const dt = build(y, m, d);
        if (dt) return dt;
      }
      // Fallback: mm/dd/yyyy
      d = Number(p2); m = Number(p1); y = Number(p3);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const dt = build(y, m, d);
        if (dt) return dt;
      }
    } else if (p1.length === 4) {
      // yyyy/mm/dd
      const y = Number(p1), m = Number(p2), d = Number(p3);
      const dt = build(y, m, d);
      if (dt) return dt;
    }
  }

  // 2) 8-digit compact – assume Indian ddmmyyyy first
  if (!sep && /^\d{8}$/.test(raw)) {
    let d = Number(raw.slice(0, 2));
    let m = Number(raw.slice(2, 4));
    let y = Number(raw.slice(4));
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dt = build(y, m, d);
      if (dt) return dt;
    }
    // Fallback: mmddyyyy
    m = Number(raw.slice(0, 2));
    d = Number(raw.slice(2, 4));
    y = Number(raw.slice(4));
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dt = build(y, m, d);
      if (dt) return dt;
    }
  }

  // 3) ISO or native parseable
  const isoTry = new Date(raw);
  return isNaN(isoTry) ? null : isoTry;
};

const formatINR = (n) => `₹${Number(n || 0).toFixed(2)}`;
const getAmount = (inv) => parseFloat(inv?.splitPayment?.totalAmount || inv?.totalAmount || inv?.settings?.totalAmount || 0) || 0;

// --- component ---
const CreditDueList = ({
  creditInvoices = [],
  dueToday = [], // not used in new compute (kept for backward compatibility)
  dueTomorrow = [], // not used in new compute (kept for backward compatibility)
  totalDue = 0,
  businessName = 'Your Business',
  businessAddress = '',
  layout = 'horizontal', // kept but we now also allow switching in-UI
  onOpenInvoice, // optional: open invoice preview
}) => {
  // view state
  const [view, setView] = useState('lanes'); // 'lanes' | 'table'
  const [query, setQuery] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [sortBy, setSortBy] = useState('dueAsc'); // 'dueAsc' | 'dueDesc' | 'amountDesc' | 'amountAsc'
  const [hideEmpty, setHideEmpty] = useState(true);
  const [minAmount, setMinAmount] = useState('');

  // keep focus stable on the search input while typing (fixes focus loss on re-renders)
  const searchRef = useRef(null);
  const [searchHasFocus, setSearchHasFocus] = useState(false);
  useEffect(() => {
    if (searchHasFocus && searchRef.current) {
      searchRef.current.focus({ preventScroll: true });
    }
  }, [searchHasFocus, query]);

  // today helpers
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // normalize + enrich
  const enriched = useMemo(() => {
    return (creditInvoices || [])
      .filter((inv) => !inv.isPaid)
      .map((inv) => {
        const dueDateStr = inv.creditDueDate || inv.settings?.creditDueDate;
        const due = parseDate(dueDateStr);
        const amount = getAmount(inv);
        let status = 'Upcoming';
        if (due) {
          const diffDays = Math.floor((due - today) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) status = 'Overdue';
          else if (diffDays === 0) status = 'Due Today';
          else if (diffDays === 1) status = 'Due Tomorrow';
          else status = 'Upcoming';
        } else {
          status = 'Invalid';
        }
        return {
          raw: inv,
          id: inv.invoiceId || inv.id || 'N/A',
          name: inv.customer?.name || inv.name || 'Customer',
          phone: inv.customer?.phone || '',
          amount,
          due,
          status,
        };
      })
      .filter((x) => (query ? (x.name?.toLowerCase().includes(query.toLowerCase()) || String(x.id).toLowerCase().includes(query.toLowerCase())) : true))
      .filter((x) => (minAmount !== '' ? x.amount >= parseFloat(minAmount || 0) : true))
      .filter((x) => (onlyOverdue ? x.status === 'Overdue' : true));
  }, [creditInvoices, query, onlyOverdue, today, minAmount]);

  // sort
  const sorted = useMemo(() => {
    const arr = [...enriched];
    if (sortBy === 'dueAsc') arr.sort((a, b) => (a.due?.getTime?.() || 0) - (b.due?.getTime?.() || 0));
    if (sortBy === 'dueDesc') arr.sort((a, b) => (b.due?.getTime?.() || 0) - (a.due?.getTime?.() || 0));
    if (sortBy === 'amountDesc') arr.sort((a, b) => b.amount - a.amount);
    if (sortBy === 'amountAsc') arr.sort((a, b) => a.amount - b.amount);
    return arr;
  }, [enriched, sortBy]);

  // group by status (for lanes view)
  const groups = useMemo(() => {
    const g = { Overdue: [], 'Due Today': [], 'Due Tomorrow': [], Upcoming: [] };
    sorted.forEach((x) => { if (g[x.status]) g[x.status].push(x); });
    return g;
  }, [sorted]);

  const totals = useMemo(() => {
    const sum = (arr) => arr.reduce((acc, x) => acc + x.amount, 0);
    return {
      all: sum(sorted),
      overdue: sum(groups['Overdue']),
      today: sum(groups['Due Today']),
      tomorrow: sum(groups['Due Tomorrow']),
      upcoming: sum(groups['Upcoming']),
    };
  }, [sorted, groups]);

  const hasDues = sorted.length > 0;

  const handleSendReminder = (invObj) => {
    const inv = invObj.raw || invObj;
    const phone = inv.customer?.phone?.replace('+91', '').trim();
    if (!phone) return alert('Phone number missing');

    const dueDateObj = parseDate(inv.creditDueDate || inv.settings?.creditDueDate || '');
    const dueDate = dueDateObj ? dueDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

    const total = getAmount(inv).toFixed(2);
    const name = inv.customer?.name || inv.name || 'Customer';
    const invoiceId = inv.invoiceId || inv.id || 'N/A';
    const purchaseDate = inv.createdAt?.toDate?.() || new Date(inv.createdAt);
    const formattedDate = purchaseDate ? purchaseDate.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }) : 'N/A';

    const itemList = inv.items?.map((item) => `• ${item.productName || item.name} (${item.quantity || 1} x ₹${item.price || 0})`).join('\n') || 'No items listed.';

    const message = `Hello *${name}*, 👋\n\nThis is a kind reminder regarding your purchase from *${businessName}*.\n\n🧾 *Invoice ID:* ${invoiceId}\n📅 *Date of Purchase:* ${formattedDate}\n🛍️ *Items Purchased:*\n${itemList}\n\n💰 *Total Due:* ₹${total}\n📆 *Due Date:* ${dueDate}\n\n💳 *How to Pay:*\n- Visit our store & pay by Cash or Card\n- UPI: upi_id@bank\n\nThank you for shopping with us!\nWe appreciate your timely payment. 🙏\n\n– ${businessName}\n${businessAddress ? businessAddress + '\n' : ''}_Powered by FLYP_`;

    const whatsappURL = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappURL, '_blank');
  };

  const handleSendAllReminders = () => {
    sorted.forEach((x) => handleSendReminder(x.raw));
  };

  // ---- UI helpers ----
  const StatusPill = ({ status }) => {
    const map = {
      Overdue: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
      'Due Today': 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
      'Due Tomorrow': 'bg-amber-500/20 text-amber-200 border-amber-400/30',
      Upcoming: 'bg-sky-500/20 text-sky-200 border-sky-400/30',
    };
    return <span className={`text-[11px] px-2 py-0.5 rounded-full border ${map[status] || 'bg-white/10 text-white/70 border-white/20'}`}>{status}</span>;
  };

  // ---- Header ----
  const Header = () => (
    <div className="flex flex-col gap-3 mb-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 border border-white/10 ring-1 ring-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-200">
              <path fill="currentColor" d="M19 4h-1V3a1 1 0 10-2 0v1H8V3a1 1 0 10-2 0v1H5a3 3 0 00-3 3v10a3 3 0 003 3h14a3 3 0 003-3V7a3 3 0 00-3-3zm1 13a1 1 0 01-1 1H5a1 1 0 01-1-1V10h16v7zm0-9H4V7a1 1 0 011-1h1v1a1 1 0 102 0V6h8v1a1 1 0 102 0V6h1a1 1 0 011 1v1z"/>
            </svg>
          </span>
          <h3 className="text-[18px] md:text-[19px] font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Credit Dues</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] leading-none backdrop-blur">
            <span className="text-white/70">Total Due Pending</span>
            <span className="font-semibold text-white">{formatINR(totals.all)}</span>
            <span className="text-white/70">/{sorted.length} invoice(s)</span>
          </span>
          {hasDues && (
            <button onClick={handleSendAllReminders} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white/90 bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/15">
              ✉️ Send All Reminders
            </button>
          )}
        </div>
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={searchRef}
          onFocus={() => setSearchHasFocus(true)}
          onBlur={() => setSearchHasFocus(false)}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer or invoice ID..."
          className="w-full sm:w-64 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-emerald-300/30 placeholder:text-white/50"
        />
        <input
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="Min ₹"
          className="w-28 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-emerald-300/30 placeholder:text-white/50"
        />
        <label className="inline-flex items-center gap-2 text-sm text-white/80 bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
          <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
          Only Overdue
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-white/80 bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
          Hide Empty Lanes
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-emerald-300/30"
        >
          <option value="dueAsc">Sort: Due ↑</option>
          <option value="dueDesc">Sort: Due ↓</option>
          <option value="amountDesc">Sort: Amount ↓</option>
          <option value="amountAsc">Sort: Amount ↑</option>
        </select>
        <div className="ml-auto flex gap-2">
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
            <button onClick={() => setView('lanes')} className={`px-3.5 py-1.5 text-sm rounded ${view === 'lanes' ? 'bg-white/10' : ''}`}>Lanes</button>
            <button onClick={() => setView('table')} className={`px-3.5 py-1.5 text-sm rounded ${view === 'table' ? 'bg-white/10' : ''}`}>Table</button>
          </div>
          <button
            onClick={() => {
              const rows = [['Customer','Invoice','Due Date','Status','Amount']].concat(sorted.map(x => [x.name, x.id, x.due ? x.due.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }) : 'Invalid Date', x.status, x.amount]));
              const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'credit-dues.csv'; a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-white/10 border border-white/10 hover:bg-white/15"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* status chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/15 px-2.5 py-1 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
          <span>Overdue</span>
          <span className="font-semibold">{formatINR(totals.overdue)}</span>
          <span className="opacity-70">/{groups['Overdue'].length}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/15 px-2.5 py-1 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
          <span>Due Today</span>
          <span className="font-semibold">{formatINR(totals.today)}</span>
          <span className="opacity-70">/{groups['Due Today'].length}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/15 px-2.5 py-1 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
          <span>Due Tomorrow</span>
          <span className="font-semibold">{formatINR(totals.tomorrow)}</span>
          <span className="opacity-70">/{groups['Due Tomorrow'].length}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/15 px-2.5 py-1 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
          <span>Upcoming</span>
          <span className="font-semibold">{formatINR(totals.upcoming)}</span>
          <span className="opacity-70">/{groups['Upcoming'].length}</span>
        </span>
      </div>
    </div>
  );

  // ---- lanes view ----
  const Lanes = () => (
    <div className="overflow-x-auto pb-2 w-full min-w-0">
      <div className="grid auto-cols-[minmax(260px,340px)] grid-flow-col gap-4 snap-x snap-mandatory min-w-full">
        {[
          { key: 'Overdue', color: 'from-rose-500/15 to-rose-400/15', countColor: 'text-rose-300' },
          { key: 'Due Today', color: 'from-emerald-500/15 to-teal-400/15', countColor: 'text-emerald-300' },
          { key: 'Due Tomorrow', color: 'from-amber-500/15 to-yellow-400/15', countColor: 'text-amber-300' },
          { key: 'Upcoming', color: 'from-sky-500/15 to-indigo-400/15', countColor: 'text-sky-300' },
        ]
          .filter(lane => !hideEmpty || (groups[lane.key] && groups[lane.key].length > 0))
          .map((lane) => (
            <section key={lane.key} className="snap-start rounded-xl border border-white/10 ring-1 ring-white/10 bg-white/5 backdrop-blur p-3 transition-transform hover:-translate-y-[1px]">
              <div className="sticky top-0 z-10 -mt-px mb-2">
                <div className={`flex items-center justify-between rounded-t-xl border border-white/10 bg-white/5 px-3 py-2 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]`}>
                  <div className="relative pl-3">
                    <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-gradient-to-b ${lane.color}`} />
                    <h4 className="font-semibold text-[13px] text-white/95 tracking-tight">{lane.key}</h4>
                  </div>
                  <div className="text-[11px] font-medium flex items-center gap-2">
                    <span className={`${lane.countColor}`}>{groups[lane.key].length}</span>
                    <span className="text-white/70">{formatINR(groups[lane.key].reduce((a, x) => a + x.amount, 0))}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                {groups[lane.key].length ? (
                  groups[lane.key].map((x) => (
                    <div key={x.id} className="rounded-xl p-3 bg-white/5 backdrop-blur border border-white/10 ring-1 ring-white/5 hover:bg-white/10 transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-200 to-sky-300 truncate">{x.name}</div>
                        <StatusPill status={x.status} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-white/80 mt-0.5">
                        <span>{x.id}</span>
                        <span>{x.due ? x.due.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }) : 'Invalid Date'}</span>
                      </div>
                      <div className="text-[15px] font-bold text-white mt-1">{formatINR(x.amount)}</div>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => handleSendReminder(x.raw)} className="text-xs px-2 py-1 rounded font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_6px_20px_rgba(16,185,129,0.35)]">Send Reminder</button>
                        {onOpenInvoice && (
                          <button onClick={() => onOpenInvoice(x.raw)} className="text-xs px-2 py-1 rounded border border-white/15 text-white/90 hover:bg-white/10">Open</button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-white/50">No items</div>
                )}
              </div>
            </section>
          ))}
      </div>
    </div>
  );

  // ---- table view ----
  const Table = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border border-white/10 bg-white/5 rounded-xl overflow-hidden">
        <thead className="bg-white/10">
          <tr className="text-left">
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Invoice</th>
            <th className="px-3 py-2">Due Date</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Amount</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((x) => (
            <tr key={x.id} className="border-t border-white/10 hover:bg-white/5">
              <td className="px-3 py-2 text-white/90">
                <div className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-200 to-sky-300 truncate">{x.name}</div>
              </td>
              <td className="px-3 py-2 text-white/70">{x.id}</td>
              <td className="px-3 py-2 text-white/70">{x.due ? x.due.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }) : 'Invalid Date'}</td>
              <td className="px-3 py-2"><StatusPill status={x.status} /></td>
              <td className="px-3 py-2 font-semibold text-white">
                <div className="text-[15px] font-bold text-white mt-1">{formatINR(x.amount)}</div>
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  <button onClick={() => handleSendReminder(x.raw)} className="text-xs px-2 py-1 rounded font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_6px_20px_rgba(16,185,129,0.35)]">Reminder</button>
                  {onOpenInvoice && (
                    <button onClick={() => onOpenInvoice(x.raw)} className="text-xs px-2 py-1 rounded border border-white/15 text-white/90 hover:bg-white/10">Open</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="relative rounded-2xl text-white w-full">
      {/* Aurora wash */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-400/7 via-fuchsia-400/6 to-sky-400/7 opacity-90 pointer-events-none" />
      <div className="relative rounded-[16px] bg-white/5 backdrop-blur-xl border border-white/10 ring-1 ring-white/5 shadow-[0_12px_40px_rgba(2,6,23,0.45)] p-5 min-w-0">
        <Header />
        {view === 'lanes' ? <Lanes /> : <Table />}
      </div>
    </div>
  );
};

export default CreditDueList;