import React from 'react';
import moment from 'moment';

const formatINR = (n) => {
  const num = Number(n ?? 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const PaymentPill = ({ mode, isPaid, split, paidVia, dueDate }) => {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border';
  const icon = (i) => <span className="opacity-90">{i}</span>;

  const paidText = (label) => (
    <span className="whitespace-nowrap">{icon('✅')} Paid via {label}</span>
  );

  if (mode === 'credit') {
    if (isPaid) {
      const v = (paidVia || '').toLowerCase();
      if (v === 'cash') return <span className={`${base} border-emerald-400/25 bg-emerald-500/15 text-emerald-200`}>{paidText('Cash')}</span>;
      if (v === 'upi') return <span className={`${base} border-emerald-400/25 bg-emerald-500/15 text-emerald-200`}>{paidText('UPI')}</span>;
      if (v === 'card') return <span className={`${base} border-emerald-400/25 bg-emerald-500/15 text-emerald-200`}>{paidText('Card')}</span>;
      return <span className={`${base} border-emerald-400/25 bg-emerald-500/15 text-emerald-200`}>{paidText('')}</span>;
    }
    const formattedDueDate = dueDate
      ? moment(dueDate.toDate?.() || dueDate).local().format('DD MMM, YYYY')
      : 'N/A';
    return (
      <span className={`${base} border-amber-400/25 bg-amber-500/15 text-amber-200`}>
        <span className="opacity-90">🕒</span>
        <span className="whitespace-nowrap">Credit • Due on {formattedDueDate}</span>
      </span>
    );
  }

  const m = (mode || '').toLowerCase();
  if (m === 'cash') return <span className={`${base} border-white/15 bg-white/10 text-white/90`}>{icon('💵')} Cash</span>;
  if (m === 'card') return <span className={`${base} border-white/15 bg-white/10 text-white/90`}>{icon('💳')} Card</span>;
  if (m === 'upi') return <span className={`${base} border-white/15 bg-white/10 text-white/90`}>{icon('📲')} UPI</span>;
  if (m === 'split') {
    const c = split?.cash || 0;
    const u = split?.upi || 0;
    const cd = split?.card || 0;
    return (
      <span className={`${base} border-white/15 bg-white/10 text-white/90`}>
        {icon('🔀')} Split ({formatINR(c)} / {formatINR(u)} / {formatINR(cd)})
      </span>
    );
  }
  return <span className={`${base} border-white/15 bg-white/10 text-white/80`}>{icon('❔')} Unknown</span>;
};

const RecentInvoices = ({ invoiceData }) => {
  const recent = [...invoiceData]
    .sort((a, b) => (b.createdAt?.toDate?.() || new Date(b.createdAt)) - (a.createdAt?.toDate?.() || new Date(a.createdAt)))
    .slice(0, 5);

  return (
    <div className="relative rounded-2xl text-white w-full">
      {/* soft aurora wash to match dashboard */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-400/7 via-fuchsia-400/6 to-emerald-400/7 pointer-events-none" />

      <div className="relative p-5 rounded-[16px] bg-white/5 backdrop-blur-xl border border-white/10 ring-1 ring-white/5 shadow-[0_12px_40px_rgba(2,6,23,0.45)]">
        {/* header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/10 border border-white/10 ring-1 ring-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
              {/* receipt icon */}
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-200" aria-hidden="true">
                <path fill="currentColor" d="M6 2a1 1 0 00-1 1v18l2-1 2 1 2-1 2 1 2-1 2 1V3a1 1 0 00-1-1H6zm3 5h6a1 1 0 110 2H9a1 1 0 110-2zm0 4h6a1 1 0 110 2H9a1 1 0 110-2z"/>
              </svg>
            </span>
            <h3 className="text-[18px] md:text-[19px] font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">
              Recent Invoices
            </h3>
          </div>
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[13px] leading-none backdrop-blur">
            Last {recent.length} records
          </span>
        </div>

        {/* list */}
        <div className="max-h-[300px] overflow-y-auto pr-1">
          <ul className="space-y-2">
            {recent.map((invoice, idx) => {
              const createdAtDate = invoice.createdAt?.toDate?.() || new Date(invoice.createdAt);
              const mode = invoice.paymentMode?.toLowerCase?.();
              const dueDate = invoice.settings?.creditDueDate || invoice.creditDueDate || null;
              const total = invoice.totalAmount ?? invoice.total ?? 0;

              return (
                <li key={idx} className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 transition-all p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-200 to-sky-300 truncate">
                          {invoice.customer?.name || 'Unknown Customer'}
                        </span>
                      </div>
                      <div className="text-[11px] text-white/70 mt-0.5 truncate">
                        #{invoice.invoiceId || invoice.id || '—'} • {moment(createdAtDate).local().format('DD MMM, hh:mm A')}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <PaymentPill
                        mode={mode}
                        isPaid={invoice.isPaid}
                        split={invoice.splitPayment}
                        paidVia={invoice.paidVia}
                        dueDate={dueDate}
                      />
                      <div className="text-[15px] font-bold text-white tabular-nums">{formatINR(total)}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RecentInvoices;
