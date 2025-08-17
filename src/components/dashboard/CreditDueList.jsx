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

const CreditDueList = ({ creditInvoices = [], dueToday = [], dueTomorrow = [], totalDue = 0, businessName = "Your Business", businessAddress = "", layout = "vertical" }) => {

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

  // Prepare arrays for horizontal layout
  const overdueItems = grouped['Overdue'];
  const dueTodayItems = grouped['Due Today'];
  const dueTomorrowItems = grouped['Due Tomorrow'];
  const upcomingItems = grouped['Upcoming'];

  const renderHorizontalItem = (inv, type) => {
    const dueDateStr = inv.creditDueDate || inv.settings?.creditDueDate;
    const due = parseDate(dueDateStr);
    const amount = parseFloat(inv.splitPayment?.totalAmount || inv.totalAmount || inv.settings?.totalAmount || 0).toFixed(2);
    let bgClass = '';
    if (type === 'Overdue') bgClass = 'bg-red-50';
    else if (type === 'Due Today') bgClass = 'bg-emerald-50';
    else if (type === 'Due Tomorrow') bgClass = 'bg-amber-50';
    else bgClass = 'bg-gray-50';

    return (
      <div key={inv.invoiceId || inv.id} className={`${bgClass} rounded p-2 flex flex-col gap-1`}>
        <div className="font-semibold text-xs">{inv.invoiceId || inv.id}</div>
        <div className="text-xs text-gray-600">{due ? due.toLocaleDateString() : 'Invalid Date'}</div>
        <div className="text-xs font-semibold">₹{amount}</div>
        {!inv.isPaid && (
          <button
            onClick={() => handleSendReminder(inv)}
            className="bg-green-500 text-white text-xs px-2 py-1 rounded"
          >
            Send Reminder
          </button>
        )}
      </div>
    );
  };

  if (layout === "horizontal") {
    return (
      <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">📅 Credit Dues</h3>
          {hasDues && (
            <button
              onClick={handleSendAllReminders}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white px-3 py-2 rounded-lg text-sm shadow hover:opacity-95 active:opacity-90"
            >
              ✉️ Send All Reminders
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Overdue</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {overdueItems.length > 0 ? overdueItems.map(inv => renderHorizontalItem(inv, 'Overdue')) : <div className="text-xs text-gray-500">No items</div>}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Due Today</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {dueTodayItems.length > 0 ? dueTodayItems.map(inv => renderHorizontalItem(inv, 'Due Today')) : <div className="text-xs text-gray-500">No items</div>}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Due Tomorrow</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {dueTomorrowItems.length > 0 ? dueTomorrowItems.map(inv => renderHorizontalItem(inv, 'Due Tomorrow')) : <div className="text-xs text-gray-500">No items</div>}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Upcoming</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {upcomingItems.length > 0 ? upcomingItems.map(inv => renderHorizontalItem(inv, 'Upcoming')) : <div className="text-xs text-gray-500">No items</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl">
      <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 pointer-events-none" />
      <div className="relative rounded-[14px] bg-white p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">📅 Credit Dues</h3>
          {hasDues && (
            <button
              onClick={handleSendAllReminders}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white px-3 py-2 rounded-lg text-sm shadow hover:opacity-95 active:opacity-90"
            >
              ✉️ Send All Reminders
            </button>
          )}
        </div>

        {/* Totals as chips */}
        <div className="flex flex-wrap gap-2 text-sm mb-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <span className="text-slate-500">Total Due Pending</span>
            <span className="font-semibold text-slate-900">₹{creditInvoices.reduce((acc, inv) => acc + parseFloat(inv.splitPayment?.totalAmount || inv.totalAmount || inv.settings?.totalAmount || 0), 0).toFixed(2)}</span>
            <span className="text-slate-500">/{creditInvoices.length} invoice(s)</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
            <span className="text-emerald-700">Due Today</span>
            <span className="font-semibold text-slate-900">₹{dueToday.reduce((acc, inv) => acc + parseFloat(inv.splitPayment?.totalAmount || inv.totalAmount || inv.settings?.totalAmount || 0), 0).toFixed(2)}</span>
            <span className="text-slate-500">/{dueToday.length}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
            <span className="text-amber-700">Due Tomorrow</span>
            <span className="font-semibold text-slate-900">₹{dueTomorrow.reduce((acc, inv) => acc + parseFloat(inv.splitPayment?.totalAmount || inv.totalAmount || inv.settings?.totalAmount || 0), 0).toFixed(2)}</span>
            <span className="text-slate-500">/{dueTomorrow.length}</span>
          </span>
        </div>

        {/* Lists */}
        <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1">
          {renderSection('Overdue', grouped['Overdue'], 'bg-red-50')}
          {renderSection('Due Today', grouped['Due Today'], 'bg-emerald-50')}
          {renderSection('Due Tomorrow', grouped['Due Tomorrow'], 'bg-amber-50')}
          {renderSection('Upcoming', grouped['Upcoming'])}
        </div>
      </div>
    </div>
  );
};

export default CreditDueList;