import React from 'react';
import moment from 'moment';

const RecentInvoices = ({ invoiceData }) => {
  const recent = [...invoiceData]
    .sort((a, b) => (b.createdAt?.toDate?.() || new Date(b.createdAt)) - (a.createdAt?.toDate?.() || new Date(a.createdAt)))
    .slice(0, 5);

  return (
    <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <h3 className="text-md font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">🧾 Recent Invoices</h3>
      <div className="max-h-[300px] overflow-y-auto pr-1">
        <ul className="space-y-2">
          {recent.map((invoice, idx) => {
            const createdAtDate = invoice.createdAt?.toDate?.() || new Date(invoice.createdAt);
            const mode = invoice.paymentMode?.toLowerCase?.();
            let paymentLabel = 'Unknown';
            if (mode === 'cash') paymentLabel = '💵 Cash';
            else if (mode === 'card') paymentLabel = '💳 Card';
            else if (mode === 'upi') paymentLabel = '📲 UPI';
            else if (mode === 'split') {
              const split = invoice.splitPayment || {};
              const cash = split.cash || 0;
              const upi = split.upi || 0;
              const card = split.card || 0;
              paymentLabel = `🔀 Split (💵 ${cash} / 📲 ${upi} / 💳 ${card})`;
            }
            else if (mode === 'credit') {
              if (invoice.isPaid) {
                const paidBy = invoice.paidVia?.toLowerCase?.();
                if (paidBy === 'cash') paymentLabel = '✅ Paid via 💵 Cash';
                else if (paidBy === 'upi') paymentLabel = '✅ Paid via 📲 UPI';
                else if (paidBy === 'card') paymentLabel = '✅ Paid via 💳 Card';
                else paymentLabel = '✅ Paid';
              } else {
                const dueDate =
                  invoice.settings?.creditDueDate ||
                  invoice.creditDueDate ||
                  null;
                const formattedDueDate = dueDate
                  ? moment(dueDate.toDate?.() || dueDate).local().format('DD MMM, YYYY')
                  : 'N/A';
                paymentLabel = `🕒 Credit • Due on ${formattedDueDate}`;
              }
            }
            return (
              <li key={idx} className="border-b border-white/10 pb-2 hover:bg-white/5 rounded">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-white">{invoice.customer?.name || 'Unknown Customer'}</span>
                  <span className="text-white/60">{moment(createdAtDate).local().format('DD MMM, hh:mm:ss A')}</span>
                </div>
                <div className="text-xs text-white/70">
                  ₹{invoice.totalAmount ?? invoice.total ?? 0} • {paymentLabel}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default RecentInvoices;
