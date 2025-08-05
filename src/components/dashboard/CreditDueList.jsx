import React from 'react';

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  let date = new Date(`${dateStr}T00:00:00`);
  if (isNaN(date.getTime())) {
    const [dd, mm, yyyy] = dateStr.split('-');
    if (dd && mm && yyyy) {
      date = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    }
  }
  return isNaN(date.getTime()) ? null : date;
};

const CreditDueList = ({ creditInvoices = [], dueToday = [], dueTomorrow = [], totalDue = 0, businessName = "Your Business", businessAddress = "" }) => {

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const categorize = (inv) => {
    const dueDateStr = inv.creditDueDate || inv.settings?.creditDueDate;
    const dueDate = parseDate(dueDateStr);
    if (!dueDate) return 'Invalid';
    dueDate.setHours(0, 0, 0, 0);
    const diff = (dueDate - today) / (1000 * 60 * 60 * 24);
    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Due Today';
    if (diff === 1) return 'Due Tomorrow';
    return 'Upcoming';
  };

  const grouped = {
    'Overdue': [],
    'Due Today': [],
    'Due Tomorrow': [],
    'Upcoming': []
  };

creditInvoices.forEach(inv => {
  if (inv.isPaid) return; // Skip paid invoices
  const dueDateStr = inv.creditDueDate || inv.settings?.creditDueDate;
  const dueDate = parseDate(dueDateStr);
  if (!dueDate) return;
  const category = categorize(inv);
  grouped[category].push(inv);
});

  const renderSection = (title, list, rowClass = '') => (
    list.length > 0 && (
      <div className="mb-4">
        <h4 className="font-semibold text-sm text-gray-700 mb-1">{title}</h4>
        <table className="min-w-full text-sm mb-2">
          <tbody>
            {list.map((inv, idx) => {
              const dueDateStr = inv.creditDueDate || inv.settings?.creditDueDate;
              const due = parseDate(dueDateStr);
              const amount = parseFloat(inv.splitPayment?.totalAmount || inv.totalAmount || inv.settings?.totalAmount || 0).toFixed(2);

              if (title === 'Upcoming') {
                return (
                  <tr key={idx} className={`border-b hover:bg-gray-50 ${rowClass}`}>
                    <td className="px-2 py-1">{inv.name || inv.customer?.name || 'N/A'}</td>
                    <td className="px-2 py-1">₹{amount}</td>
                    <td className="px-2 py-1">{due ? due.toLocaleDateString() : 'Invalid Date'}</td>
                  </tr>
                );
              }

              const daysLeft = due ? Math.ceil((due - today) / (1000 * 60 * 60 * 24)) : null;
              const dueText = title === 'Overdue'
                ? `Overdue by ${Math.abs(daysLeft)} days`
                : title;

              return (
                <tr key={idx} className={`border-b hover:bg-gray-50 ${rowClass}`}>
                  <td className="px-2 py-1">{inv.name || inv.customer?.name || 'N/A'}</td>
                  <td className="px-2 py-1">{inv.invoiceId || inv.id}</td>
                  <td className="px-2 py-1">{due ? due.toLocaleDateString() : 'Invalid Date'}</td>
                  <td className="px-2 py-1">₹{amount}</td>
                  <td className="px-2 py-1">
                    {inv.isPaid ? (
                      `Paid via ${inv.paidVia || 'N/A'} on ${new Date(inv.paidOn).toLocaleDateString()}`
                    ) : (
                      <>
                        {dueText}
                        {daysLeft !== null && daysLeft <= 1 && (
                          <button
                            onClick={() => handleSendReminder(inv)}
                            className="ml-2 bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                          >
                            Send Reminder
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )
  );

  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const hasDues = Object.values(grouped).some(arr => arr.length > 0);

  const handleSendReminder = (inv) => {
    const phone = inv.customer?.phone?.replace('+91', '').trim();
    if (!phone) return alert('Phone number missing');

    const rawDueDate = inv.creditDueDate || inv.settings?.creditDueDate || '';
    const dueDateObj = parseDate(rawDueDate);
    const dueDate = dueDateObj ? dueDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

    const total = parseFloat(inv.splitPayment?.totalAmount || inv.totalAmount || inv.settings?.totalAmount || 0).toFixed(2);
    const name = inv.customer?.name || inv.name || 'Customer';
    const invoiceId = inv.invoiceId || inv.id || 'N/A';
    const purchaseDate = inv.createdAt?.toDate?.() || new Date(inv.createdAt);
    const formattedDate = purchaseDate ? purchaseDate.toLocaleDateString() : 'N/A';

    const itemList = inv.items?.map(item => {
      const qty = item.quantity || 1;
      const price = item.price || 0;
      return `• ${item.productName || item.name} (${qty} x ₹${price})`;
    }).join('\n') || 'No items listed.';

    const message = `Hello *${name}*, 👋

This is a kind reminder regarding your purchase from *${businessName}*.

🧾 *Invoice ID:* ${invoiceId}
📅 *Date of Purchase:* ${formattedDate}
🛍️ *Items Purchased:*
${itemList}

💰 *Total Due:* ₹${total}
📆 *Due Date:* ${dueDate}

💳 *How to Pay:*
- Visit our store & pay by Cash or Card
- UPI: upi_id@bank

Thank you for shopping with us!
We appreciate your timely payment. 🙏

– ${businessName}
${businessAddress ? businessAddress + '\n' : ''}_Powered by FLYP_`;

    const whatsappURL = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappURL, '_blank');
  };

  const handleSendAllReminders = () => {
    const allInvoices = [...grouped['Overdue'], ...grouped['Due Today'], ...grouped['Due Tomorrow']];
    allInvoices.forEach(inv => handleSendReminder(inv));
  };

  return (
    <div className="bg-white shadow-md p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-1">📅 Credit Dues</h3>
      <div className="text-sm text-gray-600 mb-3">
        <p>🟣 Total Due Pending: ₹{creditInvoices.reduce((acc, inv) => acc + parseFloat(inv.splitPayment?.totalAmount || inv.totalAmount || inv.settings?.totalAmount || 0), 0).toFixed(2)} from {creditInvoices.length} invoice(s)</p>
        <p>🟡 Due Today: ₹{dueToday.reduce((acc, inv) => acc + parseFloat(inv.splitPayment?.totalAmount || inv.totalAmount || inv.settings?.totalAmount || 0), 0).toFixed(2)} from {dueToday.length} invoice(s)</p>
        <p>🔵 Due Tomorrow: ₹{dueTomorrow.reduce((acc, inv) => acc + parseFloat(inv.splitPayment?.totalAmount || inv.totalAmount || inv.settings?.totalAmount || 0), 0).toFixed(2)} from {dueTomorrow.length} invoice(s)</p>
      </div>
      {hasDues && (
        <div className="mb-3">
          <button
            onClick={handleSendAllReminders}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm"
          >
            Send All Reminders
          </button>
        </div>
      )}
      <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1">
        {renderSection('Overdue', grouped['Overdue'], 'bg-red-100')}
        {renderSection('Due Today', grouped['Due Today'], 'bg-yellow-100')}
        {renderSection('Due Tomorrow', grouped['Due Tomorrow'], 'bg-blue-50')}
        {renderSection('Upcoming', grouped['Upcoming'])}
      </div>
    </div>
  );
};

export default CreditDueList;