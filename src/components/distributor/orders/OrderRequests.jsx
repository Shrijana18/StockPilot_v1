import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getFirestore, collection, getDocs, onSnapshot, doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';

const OrderRequests = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState('none');
  const [expandedOrderIds, setExpandedOrderIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  // New state for connected retailers
  const [connectedRetailers, setConnectedRetailers] = useState([]);
  // Remove fetching all retailers; use only connectedRetailers for dropdown
  const [selectedRetailerId, setSelectedRetailerId] = useState('all');

  // --- Reject modal state ---
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOrderId, setRejectOrderId] = useState(null);

  // ---- price & totals helpers (handle strings like "₹150.00" and various field names) ----
  const n = (v) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    if (typeof v === 'string') {
      const cleaned = v.replace(/[^\d.-]/g, '');
      const num = Number(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const getQty = (item) => n(item.quantity ?? item.qty);
  const getUnitPrice = (item) => n(
    item.price ?? item.unitPrice ?? item.sellingPrice ?? item.rate ?? item.unit_price
  );
  const lineSubtotal = (item) => getQty(item) * getUnitPrice(item);
  const orderTotal = (items = []) => items.reduce((sum, it) => sum + lineSubtotal(it), 0);

  // --- Date formatting helpers ---
  const formatDateTime = (d) => {
    try {
      return new Date(d).toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch { return 'N/A'; }
  };
  const formatDate = (d) => {
    try {
      return new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    } catch { return 'N/A'; }
  };

  // --- Reject modal helpers ---
  const openRejectModal = (orderId) => {
    setRejectOrderId(orderId);
    setRejectReason('');
    setShowRejectModal(true);
  };
  const closeRejectModal = () => {
    setShowRejectModal(false);
    setRejectReason('');
    setRejectOrderId(null);
  };
  const confirmReject = async () => {
    const reason = rejectReason.trim();
    if (!reason) return; // simple guard; UI disables button anyway
    await handleStatusUpdate(rejectOrderId, 'Rejected', reason);
    closeRejectModal();
  };

  const toggleOrder = (id) => {
    setExpandedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Build filtered orders list (used by UI and export handlers)
  const getFilteredOrders = () => {
    const term = (searchTerm || '').toLowerCase();
    return (orders || []).filter(order => {
      const matchesSearch =
        (order.id || '').toLowerCase().includes(term) ||
        (order.retailerName || '').toLowerCase().includes(term) ||
        (order.retailerEmail || '').toLowerCase().includes(term) ||
        (order.retailerPhone || '').toLowerCase().includes(term) ||
        (order.retailerCity || '').toLowerCase().includes(term) ||
        (order.retailerAddress || '').toLowerCase().includes(term);

      const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
      const matchesRetailer = selectedRetailerId === 'all' || order.retailerId === selectedRetailerId;
      return matchesSearch && matchesStatus && matchesRetailer;
    });
  };

  // Export all visible orders (CSV)
  const handleExportAllCSV = () => {
    const visible = getFilteredOrders();
    if (!visible.length) {
      alert('No orders to export.');
      return;
    }
    const rows = [['Order ID','Retailer','Email','Phone','City','Status','Payment','Requested On','Total']];
    visible.forEach(order => {
      rows.push([
        order.id || '',
        order.retailerName || 'N/A',
        order.retailerEmail || 'N/A',
        order.retailerPhone || 'N/A',
        order.retailerCity || 'N/A',
        order.status || 'N/A',
        order.paymentMode || 'N/A',
        order.timestamp?.seconds ? formatDateTime(order.timestamp.seconds * 1000) : '',
        order.items ? orderTotal(order.items).toFixed(2) : '0.00'
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `order_requests_${Date.now()}.csv`;
    a.click();
  };

  // Export all visible orders (Excel)
  const handleExportAllExcel = () => {
    const visible = getFilteredOrders();
    if (!visible.length) {
      alert('No orders to export.');
      return;
    }
    const rows = visible.map(order => ({
      'Order ID': order.id || '',
      'Retailer': order.retailerName || 'N/A',
      'Email': order.retailerEmail || 'N/A',
      'Phone': order.retailerPhone || 'N/A',
      'City': order.retailerCity || 'N/A',
      'Status': order.status || 'N/A',
      'Payment': order.paymentMode || 'N/A',
      'Requested On': order.timestamp?.seconds ? formatDateTime(order.timestamp.seconds * 1000) : '',
      'Total': order.items ? orderTotal(order.items).toFixed(2) : '0.00',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, `order_requests_${Date.now()}.xlsx`);
  };

  const db = getFirestore();
  const auth = getAuth();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Helper to enrich each order with retailer info and stock for each item
    const enrichOrderWithRetailerAndStock = async (order) => {
      const retailerRef = doc(db, 'businesses', order.retailerId);
      let retailerInfo = {};
      try {
        const snap = await getDoc(retailerRef);
        if (snap.exists()) {
          const data = snap.data();
          retailerInfo = {
            retailerName: data.businessName || data.ownerName || 'N/A',
            retailerEmail: data.email || 'N/A',
            retailerPhone: data.phone || 'N/A',
            retailerCity: data.city || 'N/A',
            retailerState: data.state || 'N/A',
            retailerAddress: data.address || 'N/A',
          };
        }
      } catch (err) {
        console.warn('Retailer fetch failed:', err);
      }

      const enrichedItems = await Promise.all(
        (order.items || []).map(async (item) => {
          if (!item.distributorProductId) return { ...item };
          try {
            const prodSnap = await getDoc(doc(db, 'businesses', auth.currentUser.uid, 'products', item.distributorProductId));
            if (prodSnap.exists()) {
              const stock = prodSnap.data().quantity;
              return { ...item, availableStock: stock };
            }
          } catch (err) {
            console.warn('Stock lookup failed:', err);
          }
          return { ...item };
        })
      );

      return {
        ...order,
        ...retailerInfo,
        items: enrichedItems
      };
    };

    const ordersRef = collection(db, 'businesses', user.uid, 'orderRequests');
    const unsubscribe = onSnapshot(ordersRef, (snapshot) => {
      const dataPromises = snapshot.docs.map(doc => enrichOrderWithRetailerAndStock({ id: doc.id, ...doc.data() }));
      Promise.all(dataPromises).then(sortedData => {
        sortedData.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds);
        setOrders(sortedData);
        setLoading(false);
      });
    });

    // Fetch connected retailers once on mount
    const fetchConnectedRetailers = async () => {
      const connectedRetailersSnapshot = await getDocs(
        collection(db, "businesses", user.uid, "connectedRetailers")
      );
      const retailers = connectedRetailersSnapshot.docs.map((doc) => doc.data());
      setConnectedRetailers(retailers);
    };
    fetchConnectedRetailers();

    return () => {
      unsubscribe();
    };
  }, []);

  // Build retailerOptions for dropdown from connectedRetailers state
  const retailerOptions = connectedRetailers.map((retailer) => ({
    value: retailer.retailerId,
    label: `${retailer.retailerName || retailer.businessName || retailer.ownerName || 'Unnamed'} — ${retailer.city || retailer.address?.city || ''} — ${retailer.retailerEmail || retailer.email || 'N/A'} (ID: ${(retailer.retailerId || '').substring(0, 6)}...)`,
  }));

  const handleStatusUpdate = async (orderId, newStatus, providedReason) => {
    try {
      const snapshot = await getDoc(doc(db, 'businesses', auth.currentUser.uid, 'orderRequests', orderId));
      const order = snapshot.data();
      const orderDocRef = doc(db, 'businesses', order.distributorId || auth.currentUser.uid, 'orderRequests', orderId);
      const retailerOrderRef = doc(db, 'businesses', order.retailerId, 'sentOrders', orderId);
      const retailerOrderSnap = await getDoc(retailerOrderRef);

      if (newStatus === 'Accepted') {
        const enrichedItems = [];

        for (let item of order.items || []) {
          let updatedItem = { ...item };

          if (item.distributorProductId) {
            const productRef = doc(db, 'businesses', auth.currentUser.uid, 'products', item.distributorProductId);
            const prodSnap = await getDoc(productRef);
            if (prodSnap.exists()) {
              const data = prodSnap.data();
              const currentQty = data.quantity || 0;
              const newQty = Math.max(currentQty - Number(item.quantity || 0), 0);

              await updateDoc(productRef, { quantity: newQty });

              updatedItem = {
                ...updatedItem,
                price: data.sellingPrice || data.price || 0,
                subtotal: (data.sellingPrice || data.price || 0) * Number(item.quantity || 0),
                sku: data.sku || '',
                category: data.category || '',
                brand: data.brand || '',
              };
            }
          }

          enrichedItems.push(updatedItem);
        }

        const baseData = {
          status: newStatus,
          items: enrichedItems,
          distributorId: auth.currentUser.uid,
          retailerId: order.retailerId, // ✅ Added this line for Firestore rule match
          timestamp: order.timestamp,
          notes: order.notes || '',
          paymentMode: order.paymentMode || 'N/A',
          creditDays: order.creditDays || null,
          splitPayment: order.splitPayment || null,
        };

        // Update orderDocRef with status, items, and acceptedAt timestamp
        await updateDoc(orderDocRef, {
          status: newStatus,
          items: enrichedItems,
          statusTimestamps: {
            acceptedAt: serverTimestamp(),
          },
        });

        if (!retailerOrderSnap.exists()) {
          await setDoc(retailerOrderRef, {
            ...baseData,
            statusTimestamps: {
              requestedAt: order.timestamp,
            },
          });
        } else {
          await updateDoc(retailerOrderRef, {
            ...baseData,
            status: newStatus,
            statusTimestamps: {
              acceptedAt: serverTimestamp(),
            },
          });
        }

        return;
      }

      const baseData = {
        status: newStatus,
        items: order.items,
        distributorId: auth.currentUser.uid,
        retailerId: order.retailerId, // ✅ Added this line for Firestore rule match
        timestamp: order.timestamp,
        notes: order.notes || '',
        paymentMode: order.paymentMode || 'N/A',
        creditDays: order.creditDays || null,
        splitPayment: order.splitPayment || null,
      };

      if (newStatus === 'Rejected') {
        const reason = (providedReason || '').trim();
        if (!reason) return;
        await updateDoc(orderDocRef, {
          status: newStatus,
          rejectionNote: reason,
          statusTimestamps: {
            rejectedAt: serverTimestamp(),
          },
        });

        if (!retailerOrderSnap.exists()) {
          await setDoc(retailerOrderRef, {
            ...baseData,
            rejectionNote: reason,
            statusTimestamps: {
              requestedAt: order.timestamp,
            },
          });
        } else {
          await updateDoc(retailerOrderRef, {
            status: newStatus,
            rejectionNote: reason,
            statusTimestamps: {
              rejectedAt: serverTimestamp(),
            },
          });
        }

        return;
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleExportCSV = (order) => {
    const csv = [
      ['Retailer', 'Email', 'Date', 'Payment', 'Status'],
      [
        order.retailerName,
        order.retailerEmail,
        order.timestamp?.seconds ? formatDate(order.timestamp.seconds * 1000) : '',
        order.paymentMode,
        order.status,
      ],
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `order_${order.id}.csv`;
    a.click();
  };

  const handleExportExcel = (order) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      {
        Retailer: order.retailerName,
        Email: order.retailerEmail,
        Date: order.timestamp?.seconds ? formatDate(order.timestamp.seconds * 1000) : '',
        Payment: order.paymentMode,
        Status: order.status,
      }
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Order');
    XLSX.writeFile(wb, `order_${order.id}.xlsx`);
  };

  const handleExportPDF = (order) => {
    const content = document.getElementById(`order-card-${order.id}`);
    html2pdf().from(content).save(`order_${order.id}.pdf`);
  };

  if (loading) {
    return <div className="p-4">Loading order requests...</div>;
  }

  if (orders.length === 0) {
    return <div className="p-4 text-gray-500">No order requests yet.</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Export buttons */}
      <div className="flex justify-end mb-4">
        <div className="flex gap-2">
          <button
            onClick={handleExportAllCSV}
            className="px-3 py-1 border border-gray-200 rounded-md text-sm bg-white hover:bg-gray-50 transition shadow-sm"
          >
            Export CSV (visible)
          </button>
          <button
            onClick={handleExportAllExcel}
            className="px-3 py-1 border border-gray-200 rounded-md text-sm bg-white hover:bg-gray-50 transition shadow-sm"
          >
            Export Excel (visible)
          </button>
        </div>
      </div>

      {/* Filters container */}
      <div className="bg-white shadow-md rounded-lg p-4 mb-4 flex flex-col md:flex-row md:items-center md:gap-4 gap-3">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by Order ID, Retailer Name, Email, Phone, City, or Address"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        {/* Status Segmented Control */}
        <div className="flex items-center gap-2">
          {['All', 'Requested', 'Accepted', 'Rejected'].map((status) => {
            let color =
              status === 'Requested'
                ? 'bg-blue-100 text-blue-700'
                : status === 'Accepted'
                ? 'bg-green-100 text-green-700'
                : status === 'Rejected'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-700';
            let active =
              statusFilter === status
                ? `${color} font-semibold shadow`
                : 'bg-white text-gray-500 border hover:bg-gray-50';
            return (
              <button
                key={status}
                type="button"
                className={`px-4 py-1 rounded-full text-xs border border-gray-200 transition ${active}`}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            );
          })}
        </div>
        {/* Retailer dropdown */}
        <div className="min-w-[200px]">
          <Select
            value={selectedRetailerId || 'all'}
            onChange={(e) => setSelectedRetailerId(e.target.value)}
            displayEmpty
            size="small"
            sx={{
              backgroundColor: 'white',
              borderRadius: '0.375rem',
              fontSize: 14,
              boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.03)',
              '.MuiOutlinedInput-notchedOutline': { borderColor: '#d1d5db' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2563eb' },
              minWidth: '180px',
              height: '36px',
            }}
            inputProps={{
              className: 'px-3 py-2 text-sm',
            }}
          >
            <MenuItem value="all">
              <span className="text-sm text-gray-700">All Retailers</span>
            </MenuItem>
            {connectedRetailers
              .filter(r => r.status === 'accepted')
              .map((retailer) => {
                const mainTitle = retailer.businessName || retailer.retailerName || retailer.ownerName || 'N/A';
                const owner = retailer.ownerName || retailer.retailerName || 'N/A';
                const address = retailer.address || 'N/A';
                const city = retailer.city || 'N/A';
                const state = retailer.state || 'N/A';
                return (
                  <MenuItem key={retailer.retailerId} value={retailer.retailerId}>
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900">{mainTitle}</span>
                      <span className="text-xs text-gray-500">
                        Owner: {owner}
                      </span>
                      <span className="text-xs text-gray-500">
                        {(address !== 'N/A' ? address : '')}
                        {(address !== 'N/A' && (city !== 'N/A' || state !== 'N/A')) ? ', ' : ''}
                        {(city !== 'N/A' || state !== 'N/A') ? [city !== 'N/A' ? city : '', state !== 'N/A' ? state : ''].filter(Boolean).join(', ') : ''}
                      </span>
                    </div>
                  </MenuItem>
                );
              })}
          </Select>
        </div>
      </div>

      {/* Order List */}
      <div id="order-requests-content">
        {getFilteredOrders().map((order, idx) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03, duration: 0.28, type: 'spring', damping: 20 }}
            className="bg-white shadow-md rounded-lg overflow-hidden mb-4"
          >
            {/* Header row: retailer name, status badge */}
            <div
              className="flex items-center justify-between px-5 py-3 cursor-pointer select-none"
              onClick={() => toggleOrder(order.id)}
            >
              <div>
                <div className="font-bold text-lg text-gray-900">{order.retailerName || 'N/A'}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {order.retailerCity || 'N/A'}
                  {order.retailerState ? `, ${order.retailerState}` : ''}
                  {order.retailerAddress ? ` — ${order.retailerAddress}` : ''}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-400">
                  <span>
                    {order.timestamp?.seconds
                      ? `Requested on: ${formatDateTime(order.timestamp.seconds * 1000)}`
                      : 'Requested on: N/A'}
                  </span>
                  <span>
                    Items: {order.items?.length || 0}
                  </span>
                  <span>
                    Total: <span className="font-semibold text-gray-600">₹{orderTotal(order.items).toFixed(2)}</span>
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={
                  `px-2 py-1 rounded-full text-xs font-medium
                  ${
                    order.status === 'Requested'
                      ? 'bg-blue-100 text-blue-800'
                      : order.status === 'Accepted'
                      ? 'bg-green-100 text-green-800'
                      : order.status === 'Rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-700'
                  }
                  `
                }>
                  {order.status}
                </span>
                <button className="text-xs text-blue-600 underline focus:outline-none">
                  {expandedOrderIds.includes(order.id) ? 'Hide Details' : 'Show Details'}
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {expandedOrderIds.includes(order.id) && (
              <div id={`order-card-${order.id}`} className="bg-gray-50 px-5 pb-5 pt-3">
                <div className="relative">
                  <div className="absolute top-0 right-0 text-sm font-bold">
                    {order.status === 'Accepted' && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold">✔ Accepted</span>
                    )}
                    {order.status === 'Rejected' && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-bold">✖ Rejected</span>
                    )}
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-gray-700">Order ID:</span>
                    <span className="ml-2 text-gray-900">{order.id}</span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-gray-700">Retailer Email:</span>
                    <span className="ml-2 text-gray-900">{order.retailerEmail || 'N/A'}</span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-gray-700">Phone:</span>
                    <span className="ml-2 text-gray-900">{order.retailerPhone || 'N/A'}</span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-gray-700">Address:</span>
                    <span className="ml-2 text-gray-900">{order.retailerAddress || 'N/A'}</span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-gray-700">City:</span>
                    <span className="ml-2 text-gray-900">{order.retailerCity || 'N/A'}</span>
                    <span className="ml-4 font-medium text-gray-700">State:</span>
                    <span className="ml-2 text-gray-900">{order.retailerState || 'N/A'}</span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-gray-700">Requested On:</span>
                    <span className="ml-2 text-gray-900">
                      {order.timestamp?.seconds
                        ? formatDateTime(order.timestamp.seconds * 1000)
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-gray-700">Order Note:</span>
                    <span className="ml-2 text-gray-900">{order.notes || '—'}</span>
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-gray-700">Status:</span>
                    <span className={
                      `ml-2 px-2 py-1 rounded-full font-semibold text-xs
                        ${
                          order.status === 'Requested'
                            ? 'bg-blue-100 text-blue-800'
                            : order.status === 'Accepted'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'Rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-700'
                        }`
                    }>
                      {order.status}
                    </span>
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-gray-700">Payment Mode:</span>
                    {order.paymentMode === 'Credit Cycle' ? (
                      <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-800 font-medium text-xs">
                        Credit Cycle
                      </span>
                    ) : order.paymentMode === 'Split Payment' ? (
                      <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 font-medium text-xs">
                        Split Payment
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium text-xs">
                        {order.paymentMode || 'N/A'}
                      </span>
                    )}
                  </div>
                  {order.paymentMode === 'Credit Cycle' && order.timestamp?.seconds && order.creditDays && (
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-medium text-gray-700">Due Date:</span>
                      <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-800 font-medium text-xs">
                        {formatDate(order.timestamp.seconds * 1000 + order.creditDays * 86400000)}
                      </span>
                    </div>
                  )}
                  {order.paymentMode === 'Split Payment' && order.splitPayment && (
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-medium text-gray-700">Split Payment:</span>
                      <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 font-medium text-xs">
                        Advance {order.splitPayment.advance}% / Balance {order.splitPayment.balance}%
                      </span>
                    </div>
                  )}
                </div>
                {/* Items grid */}
                <div className="mt-4">
                  <h4 className="font-medium mb-1">Items:</h4>
                  <div className="mt-2 border border-gray-200 rounded-md overflow-hidden">
                    <div className="grid grid-cols-6 font-semibold bg-gray-100 border-b border-gray-200 px-3 py-2 text-xs">
                      <div>Name</div>
                      <div>Brand</div>
                      <div>Category</div>
                      <div>Qty</div>
                      <div>Unit</div>
                      <div>Stock</div>
                    </div>
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-6 border-t border-gray-100 px-3 py-2 text-sm hover:bg-gray-50 transition"
                      >
                        <div>{item.productName}</div>
                        <div>{item.brand || '—'}</div>
                        <div>{item.category || '—'}</div>
                        <div>{item.quantity}</div>
                        <div>{item.unit}</div>
                        <div className={`font-medium ${
                          item.availableStock === undefined ? 'text-gray-400' :
                          item.availableStock >= item.quantity ? 'text-green-600' :
                          item.availableStock > 0 ? 'text-yellow-500' : 'text-red-600'
                        }`}>
                          {item.availableStock === undefined
                            ? 'N/A'
                            : item.availableStock >= item.quantity
                            ? `${item.availableStock} In Stock`
                            : item.availableStock > 0
                            ? `${item.availableStock} Low`
                            : 'Out of Stock'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <div className="text-sm font-semibold">Total: ₹{orderTotal(order.items).toFixed(2)}</div>
                </div>
                {/* Export buttons */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleExportCSV(order)}
                    className="px-3 py-1 border border-gray-200 text-xs rounded-md bg-white hover:bg-gray-100 transition"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportExcel(order)}
                    className="px-3 py-1 border border-gray-200 text-xs rounded-md bg-white hover:bg-gray-100 transition"
                  >
                    Excel
                  </button>
                  <button
                    onClick={() => handleExportPDF(order)}
                    className="px-3 py-1 border border-gray-200 text-xs rounded-md bg-white hover:bg-gray-100 transition"
                  >
                    PDF
                  </button>
                </div>
                {/* Accept/Reject Buttons */}
                <div className="mt-4 flex gap-2">
                  <button
                    disabled={order.status !== 'Requested'}
                    onClick={() => handleStatusUpdate(order.id, 'Accepted')}
                    className={`rounded-full px-4 py-1 font-medium text-sm transition ${
                      order.status !== 'Requested'
                        ? 'bg-green-200 text-white cursor-not-allowed'
                        : 'bg-green-500 hover:bg-green-600 text-white shadow'
                    }`}
                  >
                    Accept
                  </button>
                  <button
                    disabled={order.status !== 'Requested'}
                    onClick={() => openRejectModal(order.id)}
                    className={`rounded-full px-4 py-1 font-medium text-sm transition ${
                      order.status !== 'Requested'
                        ? 'bg-red-200 text-white cursor-not-allowed'
                        : 'bg-red-500 hover:bg-red-600 text-white shadow'
                    }`}
                  >
                    Reject
                  </button>
                </div>
                {order.rejectionNote && (
                  <p className="text-sm mt-2 text-red-600"><strong>Reason:</strong> {order.rejectionNote}</p>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeRejectModal} />
          <div className="relative bg-white w-full max-w-lg mx-4 rounded-lg shadow-xl border">
            <div className="px-5 py-4 border-b">
              <h3 className="text-lg font-semibold">Reject Order</h3>
              <p className="text-sm text-gray-500">Please provide a reason for rejection. This will be visible to the retailer.</p>
            </div>
            <div className="px-5 py-4">
              <div className="mb-2 text-xs text-gray-600">Quick reasons:</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {['Out of stock','Incorrect pricing','Address mismatch','Credit overdue','Not serviceable','Duplicate request'].map((r) => (
                  <button key={r} type="button" onClick={() => setRejectReason(r)} className="px-2.5 py-1 rounded-full border text-xs hover:bg-gray-50">
                    {r}
                  </button>
                ))}
              </div>
              <label className="block text-sm font-medium mb-1">Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Write the rejection reason..."
              />
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2 bg-gray-50 rounded-b-lg">
              <button onClick={closeRejectModal} className="px-4 py-2 text-sm rounded border">Cancel</button>
              <button onClick={confirmReject} disabled={!rejectReason.trim()} className={`px-4 py-2 text-sm rounded text-white ${rejectReason.trim() ? 'bg-red-600 hover:bg-red-700' : 'bg-red-300 cursor-not-allowed'}`}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderRequests;