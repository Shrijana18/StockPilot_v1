import React from 'react';
import moment from 'moment';

const RecentInvoices = ({ invoiceData }) => {
  const recent = [...invoiceData]
    .sort((a, b) => (b.createdAt?.toDate?.() || new Date(b.createdAt)) - (a.createdAt?.toDate?.() || new Date(a.createdAt)))
    .slice(0, 5);

  return (
    <div className="bg-white rounded shadow p-4 border">
      <h3 className="text-md font-semibold mb-2">🧾 Recent Invoices</h3>
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
              <li key={idx} className="border-b pb-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{invoice.customer?.name || 'Unknown Customer'}</span>
                  <span className="text-gray-500">{moment(createdAtDate).local().format('DD MMM, hh:mm:ss A')}</span>
                </div>
                <div className="text-xs text-gray-600">
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
