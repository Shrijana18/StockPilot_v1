import React from 'react';
import moment from 'moment';

const RecentInvoices = ({ invoiceData }) => {
  const recent = [...invoiceData]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return (
    <div className="bg-white rounded shadow p-4 border">
      <h3 className="text-md font-semibold mb-2">🧾 Recent Invoices</h3>
      <ul className="space-y-2">
        {recent.map((invoice, idx) => (
          <li key={idx} className="border-b pb-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{invoice.customer?.name || 'Unknown Customer'}</span>
              <span className="text-gray-500">{moment(invoice.createdAt).local().format('DD MMM, hh:mm:ss A')}</span>
            </div>
            <div className="text-xs text-gray-600">
              ₹{invoice.totalAmount} • {invoice.paymentMode === 'Cash' ? '💵 Cash' : invoice.paymentMode === 'Card' ? '💳 Card' : invoice.paymentMode === 'UPI' ? '📲 UPI' : 'Unknown'}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecentInvoices;
