import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const OrderStatusTab = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [currentUser, setCurrentUser] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchOrders(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchOrders = async (uid) => {
    const ref = collection(db, `businesses/${uid}/sentOrders`);
    const snapshot = await getDocs(ref);
    const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setOrders(list);
    setFilteredOrders(list);
  };

  useEffect(() => {
    let result = orders;

    if (statusFilter !== 'All') {
      result = result.filter((order) => order.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((order) =>
        (order.distributorId?.toLowerCase() || '').includes(term) ||
        (order.id?.toLowerCase() || '').includes(term) ||
        (order.distributorName?.toLowerCase() || '').includes(term) ||
        (order.distributorCity?.toLowerCase() || '').includes(term) ||
        (order.distributorState?.toLowerCase() || '').includes(term) ||
        (order.distributorEmail?.toLowerCase() || '').includes(term)
      );
    }

    if (dateFilter === 'Today') {
      const today = new Date();
      result = result.filter((order) => {
        const ts = order.timestamp?.toDate?.();
        return ts &&
          ts.getDate() === today.getDate() &&
          ts.getMonth() === today.getMonth() &&
          ts.getFullYear() === today.getFullYear();
      });
    } else if (dateFilter === 'This Week') {
      const now = new Date();
      const firstDayOfWeek = new Date(now);
      firstDayOfWeek.setDate(now.getDate() - now.getDay());
      result = result.filter((order) => {
        const ts = order.timestamp?.toDate?.();
        return ts && ts >= firstDayOfWeek && ts <= now;
      });
    } else if (dateFilter === 'Custom Range' && customFromDate && customToDate) {
      const from = new Date(customFromDate);
      const to = new Date(customToDate);
      result = result.filter((order) => {
        const ts = order.timestamp?.toDate?.();
        return ts && ts >= from && ts <= to;
      });
    }

    result = result.sort((a, b) => {
      const aDate = a.timestamp?.toDate?.();
      const bDate = b.timestamp?.toDate?.();
      return bDate - aDate; // Always latest first
    });

    setFilteredOrders(result);
  }, [statusFilter, searchTerm, orders, dateFilter, customFromDate, customToDate]);

  const toggleRow = (orderId) => {
    setExpandedRow(expandedRow === orderId ? null : orderId);
  };

  const handleExportCSV = () => {
    const headers = ['Order ID', 'Distributor', 'Status', 'Amount', 'Date'];
    const rows = filteredOrders.map((o) => [
      o.id,
      o.distributorName,
      o.status,
      o.totalAmount,
      o.timestamp?.toDate?.().toLocaleString() || '-'
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'order-history.csv';
    a.click();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const headers = [['Order ID', 'Distributor', 'Status', 'Amount', 'Date']];
    const rows = filteredOrders.map((o) => [
      o.id,
      o.distributorName,
      o.status,
      `₹${o.totalAmount}`,
      o.timestamp?.toDate?.().toLocaleString() || '-'
    ]);
    doc.text('Order History', 14, 16);
    autoTable(doc, {
      startY: 20,
      head: headers,
      body: rows,
      styles: { fontSize: 8 }
    });
    doc.save('order-history.pdf');
  };

  const handleExportSingleOrder = (order, type) => {
    const headers = ['Product', 'Brand', 'SKU', 'Qty', 'Unit', 'Price'];
    const rows = (order.items || []).map((item) => [
      item.productName || item.name || '—',
      item.brand || '—',
      item.sku,
      item.quantity,
      item.unit,
      `₹${(item.price !== undefined && item.price !== null) ? item.price : (item.unitPrice || 0)}`
    ]);

    if (type === 'pdf') {
      const doc = new jsPDF();

      const formatLine = (label, value) => `${label}: ${value || '—'}`;
      const orderDate = order.timestamp?.toDate?.().toLocaleString() || '-';

      doc.setFontSize(12);
      doc.text(`Order ID: ${order.id}`, 14, 14);
      doc.text(formatLine('Date', orderDate), 14, 22);
      doc.text(formatLine('Status', order.status), 14, 30);
      doc.text(formatLine('Payment Mode', order.paymentMode), 14, 38);
      doc.text(formatLine('Order Note', order.note), 14, 46);

      doc.text(formatLine('Distributor', order.distributorName), 14, 58);
      doc.text(formatLine('Distributor Location', `${order.distributorCity || '—'}, ${order.distributorState || '—'}`), 14, 66);
      doc.text(formatLine('Distributor Phone', order.distributorPhone), 14, 74);
      doc.text(formatLine('Distributor Email', order.distributorEmail), 14, 82);

      doc.text(formatLine('Retailer ID', currentUser?.uid), 14, 94);

      autoTable(doc, {
        startY: 102,
        head: [['Product', 'Brand', 'SKU', 'Qty', 'Unit', 'Price']],
        body: (order.items || []).map((item) => [
          item.productName || item.name || '—',
          item.brand || '—',
          item.sku,
          item.quantity,
          item.unit,
          `₹${(item.price !== undefined && item.price !== null) ? item.price : (item.unitPrice || 0)}`
        ]),
        styles: { fontSize: 8 },
      });

      doc.save(`order-${order.id}.pdf`);
    } else if (type === 'csv' || type === 'excel') {
      const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-${order.id}.${type === 'excel' ? 'xls' : 'csv'}`;
      a.click();
    }
  };

  return (
    <div className="text-white">
      <div className="flex gap-4 mb-4 justify-between items-center">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search by distributor or order ID"
            className="px-3 py-2 rounded-xl w-1/3 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>All</option>
            <option>Requested</option>
            <option>Accepted</option>
            <option>Rejected</option>
            <option>Modified</option>
          </select>
          <select
            className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option>All Time</option>
            <option>Today</option>
            <option>This Week</option>
            <option>Custom Range</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl text-sm font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
          >
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3 py-2 rounded-xl text-sm font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
          >
            Export PDF
          </button>
        </div>
      </div>
      {dateFilter === 'Custom Range' && (
        <div className="flex gap-2 items-center mb-4">
          <label>From:</label>
          <input type="date" value={customFromDate} onChange={(e) => setCustomFromDate(e.target.value)} className="px-2 py-1 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50" />
          <label>To:</label>
          <input type="date" value={customToDate} onChange={(e) => setCustomToDate(e.target.value)} className="px-2 py-1 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50" />
        </div>
      )}

      <table className="min-w-full rounded-xl overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 text-sm">
        <thead>
          <tr className="bg-white/10 text-left text-white/80">
            <th className="p-2 border border-white/10">Order ID</th>
            <th className="p-2 border border-white/10">Distributor (Name)</th>
            <th className="p-2 border border-white/10">Status</th>
            <th className="p-2 border border-white/10">Amount</th>
            <th className="p-2 border border-white/10">Date</th>
          </tr>
        </thead>
        <tbody>
          {filteredOrders.map((order) => (
            <React.Fragment key={order.id}>
              <tr onClick={() => toggleRow(order.id)} className="cursor-pointer hover:bg-white/10">
                <td className="p-2 border border-white/10">{order.id}</td>
                <td className="p-2 border border-white/10">
                  <div>{order.distributorName || '—'}</div>
                  <div className="text-xs text-white/60">
                    {order.distributorCity || '—'}, {order.distributorState || '—'}
                  </div>
                  <div className="text-xs text-white/40">{order.distributorId}</div>
                </td>
                <td className="p-2 border border-white/10">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    order.status === 'Accepted' ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-300/30' :
                    order.status === 'Rejected' ? 'bg-rose-400/20 text-rose-300 border border-rose-300/30' :
                    order.status === 'Modified' ? 'bg-amber-400/20 text-amber-300 border border-amber-300/30' :
                    'bg-white/10 text-white/70 border border-white/15'
                  }`}>
                    {order.status}
                  </span>
                  {order.status === 'Rejected' && order.rejectionNote && (
                    <div className="text-xs text-rose-300 mt-1">Reason: {order.rejectionNote}</div>
                  )}
                </td>
                <td className="p-2 border border-white/10">₹{order.totalAmount || 0}</td>
                <td className="p-2 border border-white/10">{order.timestamp?.toDate?.().toLocaleString() || '-'}</td>
              </tr>
              {expandedRow === order.id && (
                <tr className="bg-white/5">
                  <td colSpan="5" className="p-4 border border-white/10">
                    <div className="text-sm mb-2 text-white/80">
                      <strong>Order Note:</strong> {order.note || '—'}<br />
                      <strong>Payment Mode:</strong> {order.paymentMode || '—'}<br />
                      {order.status === 'Rejected' && order.rejectionNote && (
                        <>
                          <strong>Rejection Reason:</strong> {order.rejectionNote}<br />
                        </>
                      )}
                      <strong>Items:</strong><br />
                      <strong>Distributor Info:</strong> {order.distributorCity || 'N/A'}, {order.distributorState || 'N/A'}<br />
                      <strong>Phone:</strong> {order.distributorPhone || '—'}<br />
                      <strong>Email:</strong> {order.distributorEmail || '—'}<br />
                    </div>
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => handleExportSingleOrder(order, 'pdf')}
                        className="px-3 py-1 rounded-lg text-sm font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_6px_20px_rgba(16,185,129,0.35)]"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => handleExportSingleOrder(order, 'csv')}
                        className="px-3 py-1 rounded-lg text-sm font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_6px_20px_rgba(16,185,129,0.35)]"
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => handleExportSingleOrder(order, 'excel')}
                        className="px-3 py-1 rounded-lg text-sm font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_6px_20px_rgba(16,185,129,0.35)]"
                      >
                        Excel
                      </button>
                    </div>
                    <table className="w-full text-sm border">
                      <thead className="bg-white/10">
                        <tr>
                          <th className="p-1 border">Product</th>
                          <th className="p-1 border">Brand</th>
                          <th className="p-1 border">SKU</th>
                          <th className="p-1 border">Qty</th>
                          <th className="p-1 border">Unit</th>
                          <th className="p-1 border">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(order.items || []).map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-1 border">{item.productName || item.name || '—'}</td>
                            <td className="p-1 border">{item.brand || '—'}</td>
                            <td className="p-1 border">{item.sku}</td>
                            <td className="p-1 border">{item.quantity}</td>
                            <td className="p-1 border">{item.unit}</td>
                            <td className="p-1 border">₹{(item.price !== undefined && item.price !== null) ? item.price : (item.unitPrice || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OrderStatusTab;