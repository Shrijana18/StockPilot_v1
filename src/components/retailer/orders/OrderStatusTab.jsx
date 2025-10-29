import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ProformaSummary from "../ProformaSummary";
import AcceptProformaButton from "../AcceptProformaButton";

// --- Helpers: INR money + Indian date (dd/mm/yyyy) ---
const formatINR = (amt = 0) => {
  const n = Number(amt || 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
};

const formatDate = (ts) => {
  let d = null;
  if (!ts) return '-';
  if (typeof ts?.toDate === 'function') d = ts.toDate();
  else if (ts instanceof Date) d = ts;
  if (!d) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(d);
};

// Normalize any date-like field to a JS Date (supports Firestore Timestamp, ms, seconds, ISO)
const asDate = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000);
  if (typeof v === 'number') return new Date(v);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Resolve the best available order date
const getOrderDate = (order) =>
  asDate(order?.timestamp) ||
  asDate(order?.createdAt) ||
  asDate(order?.created_at) ||
  asDate(order?.updatedAt) ||
  asDate(order?.date) ||
  asDate(order?.proforma?.date) ||
  null;

// Compute a clean order total breakdown with graceful fallbacks (chargesSnapshot preferred)
const computeBreakdown = (order) => {
  const cs = order?.chargesSnapshot?.breakdown || null; // canonical
  const p = cs || order?.proforma || {};                 // prefer cs, else legacy proforma

  const itemsFromRows = Array.isArray(order?.items)
    ? order.items.reduce((s, it) => {
        const price = (it.price !== undefined && it.price !== null) ? Number(it.price) : Number(it.unitPrice || 0);
        const qty = Number((it.quantity ?? it.qty) || 0);
        return s + price * qty;
      }, 0)
    : 0;

  const itemsTotal = [p.subtotal, p.subTotal, p.itemsTotal].find(v => v !== undefined && v !== null) ?? itemsFromRows;

  const discount = [p.discountAmount, p.discountTotal, p.totalDiscount, p.discountAmt]
    .find(v => v !== undefined && v !== null) ?? 0;

  // taxes
  const taxBreakup = p.taxBreakup || {};
  const cgst = [p.cgst, p.cgstAmount, taxBreakup.cgst].find(v => v !== undefined && v !== null) ?? 0;
  const sgst = [p.sgst, p.sgstAmount, taxBreakup.sgst].find(v => v !== undefined && v !== null) ?? 0;
  const igst = [p.igst, p.igstAmount, taxBreakup.igst].find(v => v !== undefined && v !== null) ?? 0;

  let taxTotal = [p.taxTotal, p.totalTax].find(v => v !== undefined && v !== null) ?? (Number(cgst) + Number(sgst) + Number(igst));

  // charges / fees
  const orderCharges = p.orderCharges || {};
  const delivery = [p.delivery, orderCharges.delivery].find(v => v !== undefined && v !== null) ?? 0;
  const packing = [p.packing, orderCharges.packing].find(v => v !== undefined && v !== null) ?? 0;
  const insurance = [p.insurance, orderCharges.insurance].find(v => v !== undefined && v !== null) ?? 0;
  const other = [p.other, p.otherCharges, p.additionalCharges, orderCharges.other].find(v => v !== undefined && v !== null) ?? 0;
  const rounding = [p.rounding, p.roundOff, orderCharges.roundOff].find(v => v !== undefined && v !== null) ?? 0;

  // When chargesSnapshot is present, prefer its explicit fields
  const shippingFromCS = cs ? Number(cs.delivery || 0) + Number(cs.packing || 0) + Number(cs.insurance || 0) + Number(cs.other || 0) : null;
  const shipping = (shippingFromCS !== null) ? shippingFromCS : (Number(delivery) + Number(packing) + Number(insurance) + Number(other));

  // grand total
  let grand = [p.grandTotal, p.totalAmount, order?.totalAmount].find(v => v !== undefined && v !== null);
  if (grand === undefined || grand === null) {
    grand = (Number(itemsTotal) - Number(discount)) + Number(taxTotal) + Number(shipping) + Number(rounding);
  }

  // If tax not provided but grand available, infer remaining as tax/adjustment
  if ((taxTotal === undefined || taxTotal === null || Number.isNaN(Number(taxTotal))) && grand !== undefined) {
    const base = (Number(itemsTotal) - Number(discount)) + Number(shipping) + Number(rounding);
    taxTotal = Math.max(0, Number(grand) - base);
  }

  return {
    itemsTotal: Number(itemsTotal || 0),
    discount: Number(discount || 0),
    cgst: Number(cgst || 0),
    sgst: Number(sgst || 0),
    igst: Number(igst || 0),
    taxTotal: Number(taxTotal || 0),
    shipping: Number(shipping || 0),
    other: 0, // merged into shipping above for display parity
    rounding: Number(rounding || 0),
    grand: Number(grand || 0),
  };
};

// Predicate for pending proforma actions (quoted or proforma sent)
const isProformaPending = (order) => {
  const statusCode = order?.statusCode;
  const status = order?.status;
  
  // Check both statusCode and status fields for maximum compatibility
  return (
    statusCode === 'PROFORMA_SENT' ||
    statusCode === 'QUOTED' ||
    status === 'Quoted' ||
    status === 'PROFORMA_SENT' ||
    // Also check for proforma data presence
    (order?.proforma && (statusCode === 'QUOTED' || status === 'Quoted')) ||
    (order?.chargesSnapshot && (statusCode === 'QUOTED' || status === 'Quoted'))
  );
};

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
    let unsubAuth = null;
    let unsubOrders = null;

    unsubAuth = onAuthStateChanged(auth, (user) => {
      // Cleanup previous orders listener when user changes
      if (unsubOrders) {
        try { unsubOrders(); } catch {}
        unsubOrders = null;
      }

      if (user) {
        setCurrentUser(user);
        const ref = collection(db, `businesses/${user.uid}/sentOrders`);
        unsubOrders = onSnapshot(ref, (snapshot) => {
          const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setOrders(list);
          setFilteredOrders(list);
        });
      } else {
        setCurrentUser(null);
        setOrders([]);
        setFilteredOrders([]);
      }
    });

    return () => {
      if (unsubOrders) {
        try { unsubOrders(); } catch {}
      }
      if (unsubAuth) {
        try { unsubAuth(); } catch {}
      }
    };
  }, []);

  useEffect(() => {
    let result = orders;

    if (statusFilter !== 'All') {
      result = result.filter((order) => {
        // Check both status and statusCode for maximum compatibility
        const orderStatus = order.status;
        const orderStatusCode = order.statusCode;
        
        // Handle different status representations
        if (statusFilter === 'Quoted') {
          return orderStatus === 'Quoted' || orderStatusCode === 'QUOTED' || orderStatusCode === 'PROFORMA_SENT';
        }
        if (statusFilter === 'Requested') {
          return orderStatus === 'Requested' || orderStatusCode === 'REQUESTED';
        }
        if (statusFilter === 'Accepted') {
          return orderStatus === 'Accepted' || orderStatusCode === 'ACCEPTED';
        }
        if (statusFilter === 'Rejected') {
          return orderStatus === 'Rejected' || orderStatusCode === 'REJECTED';
        }
        if (statusFilter === 'Modified') {
          return orderStatus === 'Modified' || orderStatusCode === 'MODIFIED';
        }
        
        // Fallback to exact match
        return orderStatus === statusFilter;
      });
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
        const ts = getOrderDate(order);
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
        const ts = getOrderDate(order);
        return ts && ts >= firstDayOfWeek && ts <= now;
      });
    } else if (dateFilter === 'Custom Range' && customFromDate && customToDate) {
      const from = new Date(customFromDate);
      const to = new Date(customToDate);
      result = result.filter((order) => {
        const ts = getOrderDate(order);
        return ts && ts >= from && ts <= to;
      });
    }

    result = result.sort((a, b) => {
      const aDate = getOrderDate(a);
      const bDate = getOrderDate(b);
      const aTime = aDate ? aDate.getTime() : 0;
      const bTime = bDate ? bDate.getTime() : 0;
      return bTime - aTime; // newest first, robust to missing dates
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
      formatINR(displayAmount(o)),
      formatDate(getOrderDate(o))
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
      formatINR(displayAmount(o)),
      formatDate(getOrderDate(o))
    ]);
    doc.text('Order History (Retailer)', 14, 16);
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
      (item.quantity ?? item.qty),
      item.unit,
      `₹${(item.price !== undefined && item.price !== null) ? item.price : (item.unitPrice || 0)}`
    ]);

    if (type === 'pdf') {
      const doc = new jsPDF();

      const formatLine = (label, value) => `${label}: ${value || '—'}`;
      const orderDate = formatDate(getOrderDate(order));

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

      // Compact total breakdown card
      const b = computeBreakdown(order);
      doc.setFontSize(11);
      doc.text('Amount Breakdown', 120, 58);
      autoTable(doc, {
        startY: 62,
        margin: { left: 120 },
        head: [['Label', 'Amount']],
        body: [
          ['Items Total', formatINR(b.itemsTotal)],
          ['Discount', formatINR(-b.discount)],
          ['CGST', formatINR(b.cgst)],
          ['SGST', formatINR(b.sgst)],
          ['IGST', formatINR(b.igst)],
          ['Other/Shipping', formatINR(b.shipping + b.other)],
          ['Rounding', formatINR(b.rounding)],
          ['Grand Total', formatINR(b.grand)],
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [240, 240, 240], textColor: 20 },
      });

      autoTable(doc, {
        startY: doc.lastAutoTable ? (doc.lastAutoTable.finalY + 6) : 102,
        head: [['Product', 'Brand', 'SKU', 'Qty', 'Unit', 'Price']],
        body: (order.items || []).map((item) => [
          item.productName || item.name || '—',
          item.brand || '—',
          item.sku,
          (item.quantity ?? item.qty),
          item.unit,
          `₹${(item.price !== undefined && item.price !== null) ? item.price : (item.unitPrice || 0)}`
        ]),
        styles: { fontSize: 8 },
      });

      doc.save(`order-${order.id}.pdf`);
    } else if (type === 'csv' || type === 'excel') {
      const b = computeBreakdown(order);
      const breakdown = [
        [],
        ['Amount Breakdown'],
        ['Items Total', b.itemsTotal],
        ['Discount', -b.discount],
        ['CGST', b.cgst],
        ['SGST', b.sgst],
        ['IGST', b.igst],
        ['Other/Shipping', (b.shipping + b.other)],
        ['Rounding', b.rounding],
        ['Grand Total', b.grand],
      ];
      const csvContent = [headers, ...rows, ...breakdown].map(e => Array.isArray(e) ? e.join(',') : e).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-${order.id}.${type === 'excel' ? 'xls' : 'csv'}`;
      a.click();
    }
  };

  const displayAmount = (order) => {
    const csGrand = order?.chargesSnapshot?.breakdown?.grandTotal;
    if (typeof csGrand === 'number' && !Number.isNaN(csGrand)) return csGrand;
    const { grand } = computeBreakdown(order);
    return grand;
  };

  return (
    <div className="text-white">
      {/* Mobile-first responsive filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-4">
        {/* Search and filters - mobile stacked, desktop inline */}
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <input
            type="text"
            placeholder="Search by distributor or order ID"
            className="px-3 py-2 rounded-xl w-full sm:w-1/2 lg:w-1/3 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex gap-2 sm:gap-3">
            <select
              className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-sm flex-1 sm:flex-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>All</option>
              <option>Requested</option>
              <option>Quoted</option>
              <option>Accepted</option>
              <option>Rejected</option>
              <option>Modified</option>
            </select>
            <select
              className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-sm flex-1 sm:flex-none"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option>All Time</option>
              <option>Today</option>
              <option>This Week</option>
              <option>Custom Range</option>
            </select>
          </div>
        </div>
        {/* Export buttons - responsive */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] whitespace-nowrap"
          >
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] whitespace-nowrap"
          >
            <span className="hidden sm:inline">Export PDF</span>
            <span className="sm:hidden">PDF</span>
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

      {/* Responsive table container */}
      <div className="overflow-x-auto">
        <table className="min-w-full rounded-xl overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 text-sm">
          <thead>
            <tr className="bg-white/10 text-left text-white/80">
              <th className="p-2 border border-white/10 min-w-[120px]">Order ID</th>
              <th className="p-2 border border-white/10 min-w-[200px]">Distributor (Name)</th>
              <th className="p-2 border border-white/10 min-w-[100px]">Status</th>
              <th className="p-2 border border-white/10 min-w-[100px]">Amount</th>
              <th className="p-2 border border-white/10 min-w-[120px]">Date</th>
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
                    (order.status === 'Accepted' || order.statusCode === 'ACCEPTED') ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-300/30' :
                    (order.status === 'Rejected' || order.statusCode === 'REJECTED') ? 'bg-rose-400/20 text-rose-300 border border-rose-300/30' :
                    (order.status === 'Modified' || order.statusCode === 'MODIFIED') ? 'bg-amber-400/20 text-amber-300 border border-amber-300/30' :
                    (order.status === 'Quoted' || order.statusCode === 'QUOTED' || order.statusCode === 'PROFORMA_SENT') ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-300/30' :
                    'bg-white/10 text-white/70 border border-white/15'
                  }`}>
                    {order.status || order.statusCode || 'Unknown'}
                  </span>
                  {order.status === 'Rejected' && order.rejectionNote && (
                    <div className="text-xs text-rose-300 mt-1">Reason: {order.rejectionNote}</div>
                  )}
                </td>
                <td className="p-2 border border-white/10">{formatINR(displayAmount(order))}</td>
                <td className="p-2 border border-white/10">{formatDate(getOrderDate(order))}</td>
              </tr>
              {expandedRow === order.id && (
                <tr className="bg-white/5">
                  <td colSpan="5" className="p-4 border border-white/10">
                    {isProformaPending(order) && (
                      <div className="mb-4 space-y-3">
                        {order.proforma ? (
                          <ProformaSummary
                            proforma={order.proforma}
                            distributorState={order.distributorState}
                            retailerState={order.retailerState}
                          />
                        ) : (
                          (() => {
                            // Compact fallback summary from chargesSnapshot
                            const b = computeBreakdown(order);
                            return (
                              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                                <div className="text-white/80 font-semibold mb-2">Proforma Summary</div>
                                <div className="space-y-1">
                                  <div className="flex justify-between"><span>Items Total</span><span>{formatINR(b.itemsTotal)}</span></div>
                                  <div className="flex justify-between"><span>Discount</span><span>-{formatINR(b.discount)}</span></div>
                                  <div className="flex justify-between"><span>CGST</span><span>{formatINR(b.cgst)}</span></div>
                                  <div className="flex justify-between"><span>SGST</span><span>{formatINR(b.sgst)}</span></div>
                                  <div className="flex justify-between"><span>IGST</span><span>{formatINR(b.igst)}</span></div>
                                  <div className="flex justify-between"><span>Other/Shipping</span><span>{formatINR(b.shipping)}</span></div>
                                  <div className="flex justify-between"><span>Rounding</span><span>{formatINR(b.rounding)}</span></div>
                                  <div className="h-px bg-white/10 my-2" />
                                  <div className="flex justify-between font-semibold text-emerald-300"><span>Grand Total</span><span>{formatINR(b.grand)}</span></div>
                                </div>
                              </div>
                            );
                          })()
                        )}
                        <div className="flex gap-2">
                          <AcceptProformaButton
                            distributorId={order.distributorId}
                            retailerId={currentUser?.uid}
                            orderId={order.id}
                            hasProforma={!!order.proforma}
                          />
                        </div>
                      </div>
                    )}
                    {/* Compact Amount Breakdown (India format) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="text-white/80 text-sm mb-2 font-semibold">Amount Breakdown</div>
                        {(() => {
                          const b = computeBreakdown(order);
                          return (
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between"><span>Items Total</span><span>{formatINR(b.itemsTotal)}</span></div>
                              <div className="flex justify-between"><span>Discount</span><span>-{formatINR(b.discount)}</span></div>
                              <div className="flex justify-between"><span>CGST</span><span>{formatINR(b.cgst)}</span></div>
                              <div className="flex justify-between"><span>SGST</span><span>{formatINR(b.sgst)}</span></div>
                              <div className="flex justify-between"><span>IGST</span><span>{formatINR(b.igst)}</span></div>
                              <div className="flex justify-between font-medium text-white/90"><span>Tax Total</span><span>{formatINR(b.taxTotal || (b.cgst + b.sgst + b.igst))}</span></div>
                              <div className="flex justify-between"><span>Other/Shipping</span><span>{formatINR(b.shipping + b.other)}</span></div>
                              <div className="flex justify-between"><span>Rounding</span><span>{formatINR(b.rounding)}</span></div>
                              <div className="h-px bg-white/10 my-2" />
                              <div className="flex justify-between font-semibold text-emerald-300"><span>Grand Total</span><span>{formatINR(b.grand)}</span></div>
                              <div className="text-[11px] text-white/50 mt-1">
                                Formula: Items Total - Discount + CGST + SGST + IGST + Other/Shipping + Rounding = Grand Total
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
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
                            <td className="p-1 border">{item.quantity ?? item.qty}</td>
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
    </div>
  );
};

export default OrderStatusTab;