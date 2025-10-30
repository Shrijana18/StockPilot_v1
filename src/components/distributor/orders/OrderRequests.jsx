import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getFirestore, collection, getDocs, onSnapshot, doc, updateDoc, getDoc, setDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import ChargesTaxesEditor from "../ChargesTaxesEditor";
import PassiveOrderRequests from './PassiveOrderRequests';

const OrderRequests = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState('none');
  const [expandedOrderIds, setExpandedOrderIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  // Debounced search term for smoother filtering on large lists
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // New state for connected retailers
  const [connectedRetailers, setConnectedRetailers] = useState([]);
  // Remove fetching all retailers; use only connectedRetailers for dropdown
  const [selectedRetailerId, setSelectedRetailerId] = useState('all');
  const [editChargesMap, setEditChargesMap] = useState({});   // { [orderId]: bool }
  const [chargesDraftMap, setChargesDraftMap] = useState({}); // { [orderId]: breakdown }
  const [mode, setMode] = useState('active');
  const renderModeTabs = () => (
    <div className="p-4 pt-0">
      <div className="mb-3 inline-flex rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow">
        <button
          type="button"
          onClick={() => setMode('active')}
          className={`px-4 py-2 text-sm rounded-l-xl transition ${
            mode === 'active'
              ? 'bg-emerald-500 text-slate-900 font-semibold'
              : 'bg-transparent text-white hover:bg-white/10'
          }`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => setMode('passive')}
          className={`px-4 py-2 text-sm rounded-r-xl transition border-l border-white/10 ${
            mode === 'passive'
              ? 'bg-emerald-500 text-slate-900 font-semibold'
              : 'bg-transparent text-white hover:bg-white/10'
          }`}
        >
          Passive
        </button>
      </div>
    </div>
  );


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
  // Grand total helper: prefer DIRECT snapshot, fallback to computed
  const orderGrandTotal = (order) => {
    const g = order?.chargesSnapshot?.breakdown?.grandTotal;
    if (typeof g === 'number' && !Number.isNaN(g)) return g;
    return orderTotal(order?.items || []);
  };

  const isDirect = (order) => (order?.statusCode === 'DIRECT' || order?.status === 'Placed (Direct)');
  const getSnapshot = (order) => {
    const b = order?.chargesSnapshot?.breakdown || {};
    const tb = b?.taxBreakup || {};
    // Flatten taxBreakup for UI convenience while keeping originals
    return {
      ...b,
      cgst: b.cgst ?? tb.cgst ?? 0,
      sgst: b.sgst ?? tb.sgst ?? 0,
      igst: b.igst ?? tb.igst ?? 0,
    };
  };
  const previewGrandTotal = (order, editChargesMap, chargesDraftMap) => {
    if (isDirect(order)) {
      const draft = chargesDraftMap[order.id];
      if (editChargesMap[order.id] && typeof draft?.grandTotal === 'number') return draft.grandTotal;
      const snap = getSnapshot(order);
      if (typeof snap?.grandTotal === 'number') return snap.grandTotal;
    }
    return orderGrandTotal(order);
  };

  // --- Date formatting helpers ---
  const formatDateTime = (d) => {
    try {
      return new Date(d).toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch { return 'N/A'; }
  };
  // Prefer server-set timestamp; fallback to createdAt; final fallback to now for UI only
  const getOrderTimestampMs = (order) => {
    try {
      if (order?.timestamp?.seconds) return order.timestamp.seconds * 1000;
      if (order?.createdAt?.seconds) return order.createdAt.seconds * 1000;
      if (typeof order?.createdAt === 'string') {
        const t = Date.parse(order.createdAt);
        if (!Number.isNaN(t)) return t;
      }
    } catch {}
    return 0;
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

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch((searchTerm || '').toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // Build filtered orders list (used by UI and export handlers)
  const filteredOrders = useMemo(() => {
    const term = debouncedSearch;
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
  }, [orders, debouncedSearch, statusFilter, selectedRetailerId]);

  // Export all visible orders (CSV)
  const handleExportAllCSV = () => {
    const visible = filteredOrders;
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
        orderGrandTotal(order).toFixed(2)
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
    const visible = filteredOrders;
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
      'Total': orderGrandTotal(order).toFixed(2),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, `order_requests_${Date.now()}.xlsx`);
  };

  const db = getFirestore();
  const auth = getAuth();

  useEffect(() => {
    let unsubOrders = null;
    let unsubAuth = null;

    const subscribeForUser = (user) => {
      // Cleanup any previous orders listener
      if (unsubOrders) {
        try { unsubOrders(); } catch {}
        unsubOrders = null;
      }

      if (!user) {
        // No signed-in user → clear and stop loading
        setOrders([]);
        setConnectedRetailers([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Helper to enrich each order with retailer info and stock for each item
      const enrichOrderWithRetailerAndStock = async (order) => {
        let retailerInfo = {};
        if (order?.retailerId && typeof order.retailerId === 'string') {
          try {
            const retailerRef = doc(db, 'businesses', order.retailerId);
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
        }

        const enrichedItems = await Promise.all(
          (order.items || []).map(async (item) => {
            if (!item?.distributorProductId || typeof item.distributorProductId !== 'string') {
              return { ...item };
            }
            try {
              const prodSnap = await getDoc(
                doc(db, 'businesses', user.uid, 'products', item.distributorProductId)
              );
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

      // Keep distributor orderRequests/<orderId> in sync with retailer sentOrders/<orderId>
      const ensureMirrorStatusSync = async (distOrder) => {
        try {
          if (!distOrder?.id || !distOrder?.retailerId) return;
          if (distOrder.status === 'Accepted' || distOrder.statusCode === 'ACCEPTED') return;

          // Read retailer mirror; may be blocked by rules (handled quietly)
          const retailerRef = doc(db, 'businesses', distOrder.retailerId, 'sentOrders', distOrder.id);
          const retailerSnap = await getDoc(retailerRef);
          if (!retailerSnap.exists()) return;
          const r = retailerSnap.data();

          // Sync status changes from retailer to distributor
          if (r?.status === 'Accepted' || r?.statusCode === 'ACCEPTED') {
            const distRef = doc(db, 'businesses', user.uid, 'orderRequests', distOrder.id);
            await updateDoc(distRef, {
              status: 'Accepted',
              statusCode: 'ACCEPTED',
              statusTimestamps: { acceptedAt: serverTimestamp() },
              updatedAt: serverTimestamp(),
              proformaLocked: true,
              acceptedBy: distOrder.retailerId,
              acceptedSource: "RETAILER",
              promotionReady: true,
            });
            distOrder.status = 'Accepted';
            distOrder.statusCode = 'ACCEPTED';
          }
          
          // Sync proforma data from distributor to retailer if needed
          if ((distOrder.status === 'Quoted' || distOrder.statusCode === 'QUOTED') && 
              (distOrder.proforma || distOrder.chargesSnapshot) && 
              (!r?.proforma && !r?.chargesSnapshot)) {
            const retailerUpdateRef = doc(db, 'businesses', distOrder.retailerId, 'sentOrders', distOrder.id);
            await updateDoc(retailerUpdateRef, {
              status: 'Quoted',
              statusCode: 'QUOTED',
              proforma: distOrder.proforma,
              chargesSnapshot: distOrder.chargesSnapshot,
              statusTimestamps: { quotedAt: serverTimestamp() },
              updatedAt: serverTimestamp(),
            });
          }
        } catch (e) {
          if (e?.code === 'permission-denied') return;
          console.debug('Mirror sync skipped:', e?.message || e);
        }
      };

      // Real-time subscription to this distributor's order requests
      const ordersRef = collection(db, 'businesses', user.uid, 'orderRequests');
      unsubOrders = onSnapshot(
        ordersRef,
        (snapshot) => {
          const dataPromises = snapshot.docs.map(d => enrichOrderWithRetailerAndStock({ id: d.id, ...d.data() }));
          Promise.all(dataPromises).then(async (enriched) => {
            // Attempt mirror sync only for those not yet accepted
            await Promise.all(
              enriched
                .filter(o => o?.status !== 'Accepted' && o?.statusCode !== 'ACCEPTED')
                .map(o => ensureMirrorStatusSync(o))
            );
            enriched.sort((a, b) => getOrderTimestampMs(b) - getOrderTimestampMs(a));
            setOrders(enriched);
            setLoading(false);
            setChargesDraftMap((prev) => {
              const next = { ...prev };
              enriched.forEach((o) => {
                if (isDirect(o) && !next[o.id]) next[o.id] = getSnapshot(o);
              });
              return next;
            });
          });
        },
        (error) => {
          console.error('orderRequests onSnapshot error:', error);
          setLoading(false);
        }
      );

      // Fetch connected retailers once for this user
      const fetchConnectedRetailers = async (uid) => {
        try {
          const connectedRetailersSnapshot = await getDocs(
            collection(db, "businesses", uid, "connectedRetailers")
          );
          const retailers = connectedRetailersSnapshot.docs.map((doc) => ({ retailerId: doc.id, ...doc.data() }));
          setConnectedRetailers(retailers);
        } catch (e) {
          console.warn('fetchConnectedRetailers failed:', e?.message || e);
        }
      };
      fetchConnectedRetailers(user.uid);
    };

    // Listen for auth changes and subscribe accordingly
    unsubAuth = onAuthStateChanged(auth, (user) => {
      subscribeForUser(user);
    });

    // Cleanup
    return () => {
      if (unsubOrders) {
        try { unsubOrders(); } catch {}
      }
      if (unsubAuth) {
        try { unsubAuth(); } catch {}
      }
    };
  }, [auth, db]);


  // Build retailerOptions for dropdown from connectedRetailers state
  const retailerOptions = connectedRetailers.map((retailer) => ({
    value: retailer.retailerId,
    label: `${retailer.retailerName || retailer.businessName || retailer.ownerName || 'Unnamed'} — ${retailer.city || retailer.address?.city || ''} — ${retailer.retailerEmail || retailer.email || 'N/A'} (ID: ${(retailer.retailerId || '').substring(0, 6)}...)`,
  }));

  const handleStatusUpdate = async (orderId, newStatus, providedReason, isDirectFlag = false, directChargesDraft = null) => {
    try {
      const snapshot = await getDoc(doc(db, 'businesses', auth.currentUser.uid, 'orderRequests', orderId));
      const order = snapshot.data();
      const orderDocRef = doc(db, 'businesses', order.distributorId || auth.currentUser.uid, 'orderRequests', orderId);
      const retailerOrderRef = doc(db, 'businesses', order.retailerId, 'sentOrders', orderId);
      const retailerOrderSnap = await getDoc(retailerOrderRef);
      // Canonical order document reference under /orders
      const canonicalOrderRef = doc(db, 'businesses', auth.currentUser.uid, 'orders', orderId);

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

        // --- Structure-preserving merge for chargesSnapshot with taxBreakup normalization ---
        const existingCharges = order?.chargesSnapshot || {};
        const existingBreakdown = existingCharges?.breakdown || {};
        const existingTaxBreakup = existingBreakdown?.taxBreakup || {};

        const draft = isDirectFlag ? (directChargesDraft || {}) : {};
        const mergedBreakdown = {
          ...existingBreakdown,
          ...draft,
        };
        // Ensure taxBreakup map is updated using flat cgst/sgst/igst if present in draft
        const nextTaxBreakup = {
          ...existingTaxBreakup,
          ...(draft && (draft.cgst !== undefined || draft.sgst !== undefined || draft.igst !== undefined)
            ? {
                cgst: draft.cgst ?? existingTaxBreakup.cgst ?? existingBreakdown.cgst ?? 0,
                sgst: draft.sgst ?? existingTaxBreakup.sgst ?? existingBreakdown.sgst ?? 0,
                igst: draft.igst ?? existingTaxBreakup.igst ?? existingBreakdown.igst ?? 0,
              }
            : existingTaxBreakup),
        };
        mergedBreakdown.taxBreakup = nextTaxBreakup;

        const finalCharges = {
          ...existingCharges,
          breakdown: mergedBreakdown,
        };

        // Create/overwrite canonical order with full payload + enriched items
        await setDoc(canonicalOrderRef, {
          ...order,
          items: enrichedItems,
          status: newStatus,
          statusCode: 'ACCEPTED',
          distributorId: auth.currentUser.uid,
          retailerId: order.retailerId,
          statusTimestamps: { ...(order.statusTimestamps || {}), acceptedAt: serverTimestamp() },
          createdBy: order.createdBy || { type: 'distributor', uid: auth.currentUser.uid },
          handledBy: { ...(order.handledBy || {}), acceptedBy: { uid: auth.currentUser.uid, type: 'distributor' } },
          auditTrail: arrayUnion({ at: new Date().toISOString(), event: 'acceptOrder', by: { uid: auth.currentUser.uid, type: 'distributor' } }),
          chargesSnapshot: finalCharges,
        }, { merge: true });

        // Update orderDocRef with status, items, and acceptedAt timestamp
        await updateDoc(orderDocRef, {
          status: newStatus,
          items: enrichedItems,
          statusTimestamps: {
            acceptedAt: serverTimestamp(),
          },
          createdBy: order.createdBy || { type: 'distributor', uid: auth.currentUser.uid },
          handledBy: { ...(order.handledBy || {}), acceptedBy: { uid: auth.currentUser.uid, type: 'distributor' } },
          auditTrail: arrayUnion({ at: new Date().toISOString(), event: 'acceptOrder', by: { uid: auth.currentUser.uid, type: 'distributor' } }),
          chargesSnapshot: finalCharges,
        });

        if (!retailerOrderSnap.exists()) {
          await setDoc(retailerOrderRef, {
            ...order,
            items: enrichedItems,
            status: newStatus,
            distributorId: auth.currentUser.uid,
            retailerId: order.retailerId,
            statusTimestamps: {
              requestedAt: order.timestamp,
            },
            chargesSnapshot: finalCharges,
          });
        } else {
          await updateDoc(retailerOrderRef, {
            ...order,
            items: enrichedItems,
            status: newStatus,
            distributorId: auth.currentUser.uid,
            retailerId: order.retailerId,
            statusTimestamps: {
              acceptedAt: serverTimestamp(),
            },
            chargesSnapshot: finalCharges,
          });
        }

        return;
      }

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
        // Update canonical order (rejected)
        try {
          await setDoc(canonicalOrderRef, {
            ...order,
            status: newStatus,
            statusCode: 'REJECTED',
            distributorId: auth.currentUser.uid,
            retailerId: order.retailerId,
            rejectionNote: reason,
            statusTimestamps: { ...(order.statusTimestamps || {}), rejectedAt: serverTimestamp() },
          }, { merge: true });
        } catch (e) {
          console.warn('Canonical order set (reject) skipped:', e?.message || e);
        }

        if (!retailerOrderSnap.exists()) {
          await setDoc(retailerOrderRef, {
            ...order,
            status: newStatus,
            distributorId: auth.currentUser.uid,
            retailerId: order.retailerId,
            rejectionNote: reason,
            statusTimestamps: {
              requestedAt: order.timestamp,
            },
          });
        } else {
          await updateDoc(retailerOrderRef, {
            ...order,
            status: newStatus,
            distributorId: auth.currentUser.uid,
            retailerId: order.retailerId,
            rejectionNote: reason,
            statusTimestamps: {
              rejectedAt: serverTimestamp(),
            },
          });
        }

        return;
      }
      // For other statuses, no canonical update needed as of now.
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

if (mode !== 'passive' && loading) {
  return (
    <div className="p-4 text-white">
      <div className="space-y-3">
        {[0,1,2].map(i => (
          <div key={i} className="rounded-xl overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 animate-pulse shadow-xl">
            <div className="px-5 py-3 flex items-center justify-between">
              <div className="space-y-2 w-full">
                <div className="h-4 bg-white/10 rounded w-1/3" />
                <div className="flex gap-3">
                  <div className="h-3 bg-white/10 rounded w-1/5" />
                  <div className="h-3 bg-white/10 rounded w-1/6" />
                  <div className="h-3 bg-white/10 rounded w-1/6" />
                </div>
              </div>
              <div className="h-6 w-20 bg-white/10 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

if (mode !== 'passive' && !loading && orders.length === 0) {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl text-white p-6 text-center shadow-xl">
        <div className="text-2xl">🧺</div>
        <p className="mt-2 font-medium">No order requests yet</p>
        <p className="text-white/70 text-sm">New orders from retailers will appear here.</p>
      </div>
    </div>
  );
}

  return (
    <div className="p-0 space-y-4 text-white">
      {/* Ensure all child elements are properly nested and closed */}
      {renderModeTabs()}
      {mode === 'passive' ? (
        <div className="px-4">
          <PassiveOrderRequests pageSize={25} />
        </div>
      ) : (
      <div className="p-4 space-y-4">
      {/* Export buttons */}
      <div className="flex justify-end mb-4">
        <div className="flex gap-2">
          <button
            onClick={handleExportAllCSV}
            className="px-3 py-1 rounded-lg text-sm bg-white/10 border border-white/15 hover:bg-white/15 transition shadow-sm backdrop-blur-xl"
            aria-label="Export visible orders as CSV"
          >
            Export CSV (visible)
          </button>
          <button
            onClick={handleExportAllExcel}
            className="px-3 py-1 rounded-lg text-sm bg-white/10 border border-white/15 hover:bg-white/15 transition shadow-sm backdrop-blur-xl"
            aria-label="Export visible orders as Excel"
          >
            Export Excel (visible)
          </button>
      </div>
      </div>

      {/* Filters container */}
      <div className="sticky top-[72px] z-40 rounded-xl p-3 sm:p-4 mb-4 flex flex-col lg:flex-row lg:items-center lg:gap-4 gap-3 border border-white/10 bg-[#0B0F14]/90 supports-[backdrop-filter]:bg-[#0B0F14]/70 backdrop-blur-xl shadow-lg">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by Order ID, Retailer Name, Email, Phone, City, or Address"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
            className="w-full px-3 py-2 rounded-lg text-sm bg-white/10 border border-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </div>
        {/* Status Segmented Control */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
          {['All', 'Requested', 'Quoted', 'Accepted', 'Rejected'].map((status) => {
            const active = statusFilter === status;
            const base = 'px-2 sm:px-4 py-1 rounded-full text-xs border transition whitespace-nowrap';
            const on = 'bg-emerald-500 text-slate-900 border-transparent shadow-[0_8px_24px_rgba(16,185,129,0.35)]';
            const off = 'bg-white/10 text-white border-white/20 hover:bg-white/15';
            return (
              <button
                key={status}
                type="button"
                className={`${base} ${active ? on : off}`}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            );
          })}
        </div>
        {/* Retailer dropdown */}
        <div className="w-full sm:min-w-[200px]">
          <Select
            value={selectedRetailerId || 'all'}
            onChange={(e) => setSelectedRetailerId(e.target.value)}
            displayEmpty
            size="small"
            sx={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              color: '#fff',
              borderRadius: '0.75rem',
              fontSize: 14,
              boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.10)',
              '.MuiSvgIcon-root': { color: '#fff' },
              '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(16,185,129,0.6)' },
              minWidth: '180px',
              height: '36px',
              width: '100%',
            }}
            inputProps={{
              className: 'px-3 py-2 text-sm',
            }}
            MenuProps={{ PaperProps: { sx: { bgcolor: 'rgba(15,23,42,0.98)', color: '#fff' } } }}
          >
            <MenuItem value="all">
              <span className="text-sm text-white">All Retailers</span>
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
                      <span className="font-semibold text-white">{mainTitle}</span>
                      <span className="text-xs text-white/70">
                        Owner: {owner}
                      </span>
                      <span className="text-xs text-white/70">
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
        {filteredOrders.map((order, idx) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03, duration: 0.28, type: 'spring', damping: 20 }}
            className="rounded-xl overflow-hidden mb-4 bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl"
          >
            {/* Header row: retailer name, status badge */}
            <div
              className="flex items-center justify-between px-5 py-3 cursor-pointer select-none hover:bg-white/5 transition"
              onClick={() => toggleOrder(order.id)}
            >
              <div>
                <div className="font-bold text-lg text-white">{order.retailerName || 'N/A'}</div>
                <div className="text-xs text-white/60 mt-1">
                  {order.retailerCity || 'N/A'}
                  {order.retailerState ? `, ${order.retailerState}` : ''}
                  {order.retailerAddress ? ` — ${order.retailerAddress}` : ''}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-white/50">
                  <span>
                  {(() => { const ms = getOrderTimestampMs(order); return ms ? `Requested on: ${formatDateTime(ms)}` : 'Requested on: N/A'; })()}
                  </span>
                  <span>
                    Items: {order.items?.length || 0}
                  </span>
                  <span>
                    Total: <span className="font-semibold text-emerald-300">₹{orderGrandTotal(order).toFixed(2)}</span>
                  </span>
                  {/* Aging/SLA badge */}
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                    {(() => {
                      const ts = order?.timestamp?.seconds ? order.timestamp.seconds * 1000 : null;
                      if (!ts) return 'Age: N/A';
                      const ms = Date.now() - ts;
                      const m = Math.floor(ms / 60000);
                      if (m < 60) return `Age: ${m}m`;
                      const h = Math.floor(m / 60);
                      if (h < 48) return `Age: ${h}h`;
                      const d = Math.floor(h / 24);
                      return `Age: ${d}d`;
                    })()}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={
                  `px-2 py-1 rounded-full text-xs font-medium
                  ${
                    order.status === 'Requested'
                      ? 'bg-sky-400/15 text-sky-300'
                      : order.status === 'Accepted'
                      ? 'bg-emerald-400/15 text-emerald-300'
                      : order.status === 'Rejected'
                      ? 'bg-rose-400/15 text-rose-300'
                      : 'bg-white/10 text-white/80'
                  }
                  `
                }>
                  {order.status === 'Requested' && '📝 '}
                  {order.status === 'Accepted' && '✔ '}
                  {order.status === 'Rejected' && '✖ '}
                  {order.status}
                </span>
                {isDirect(order) && (
                  <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">Direct</span>
                )}
                {/* Quick actions in header */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (order.status === 'Requested') handleStatusUpdate(order.id, 'Accepted', null, isDirect(order), chargesDraftMap[order.id]); }}
                    disabled={order.status !== 'Requested'}
                    className={`rounded-full px-3 py-0.5 text-xs font-medium transition ${
                      order.status !== 'Requested'
                        ? 'bg-white/10 text-white/40 cursor-not-allowed'
                        : 'bg-emerald-500/90 text-slate-900 hover:bg-emerald-400'
                    }`}
                    aria-label="Quick accept order"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (order.status === 'Requested') openRejectModal(order.id); }}
                    disabled={order.status !== 'Requested'}
                    className={`rounded-full px-3 py-0.5 text-xs font-medium transition ${
                      order.status !== 'Requested'
                        ? 'bg-white/10 text-white/40 cursor-not-allowed'
                        : 'bg-rose-600 text-white hover:bg-rose-700'
                    }`}
                    aria-label="Quick reject order"
                  >
                    Reject
                  </button>
                </div>
                <button
                  className="text-xs text-emerald-300 underline focus:outline-none"
                  aria-expanded={expandedOrderIds.includes(order.id)}
                  onClick={() => toggleOrder(order.id)}
                >
                  <span className="inline-flex items-center gap-1">
                    <span>{expandedOrderIds.includes(order.id) ? 'Hide Details' : 'Show Details'}</span>
                    <span className={`transition-transform ${expandedOrderIds.includes(order.id) ? 'rotate-180' : ''}`}>▾</span>
                  </span>
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {expandedOrderIds.includes(order.id) && (
              <motion.div
                id={`order-card-${order.id}`}
                className="bg-white/5 px-5 pb-5 pt-3"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="relative">
                  <div className="absolute top-0 right-0 text-sm font-bold">
                    {order.status === 'Accepted' && (
                      <span className="px-2 py-1 bg-emerald-400/15 text-emerald-300 rounded-full font-bold">✔ Accepted</span>
                    )}
                    {order.status === 'Rejected' && (
                      <span className="px-2 py-1 bg-rose-400/15 text-rose-300 rounded-full font-bold">✖ Rejected</span>
                    )}
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-white/70">Order ID:</span>
                    <span className="ml-2 text-white">{order.id}</span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-white/70">Retailer Email:</span>
                    <span className="ml-2 text-white">{order.retailerEmail || 'N/A'}</span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-white/70">Phone:</span>
                    <span className="ml-2 text-white">{order.retailerPhone || 'N/A'}</span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-white/70">Address:</span>
                    <span className="ml-2 text-white">{order.retailerAddress || 'N/A'}</span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-white/70">City:</span>
                    <span className="ml-2 text-white">{order.retailerCity || 'N/A'}</span>
                    <span className="ml-4 font-medium text-white/70">State:</span>
                    <span className="ml-2 text-white">{order.retailerState || 'N/A'}</span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-white/70">Requested On:</span>
                    <span className="ml-2 text-white">
                      {order.timestamp?.seconds
                        ? formatDateTime(order.timestamp.seconds * 1000)
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="mb-1">
                    <span className="font-medium text-white/70">Order Note:</span>
                    <span className="ml-2 text-white">{order.notes || '—'}</span>
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-white/70">Status:</span>
                    <span className={
                      `ml-2 px-2 py-1 rounded-full font-semibold text-xs
                        ${
                          order.status === 'Requested'
                            ? 'bg-sky-400/15 text-sky-300'
                            : order.status === 'Accepted'
                            ? 'bg-emerald-400/15 text-emerald-300'
                            : order.status === 'Rejected'
                            ? 'bg-rose-400/15 text-rose-300'
                            : 'bg-white/10 text-white/80'
                        }`
                    }>
                      {order.status}
                    </span>
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-white/70">Payment Mode:</span>
                    {order.paymentMode === 'Credit Cycle' ? (
                      <span className="px-2 py-1 rounded-full bg-orange-400/15 text-orange-300 font-medium text-xs">
                        Credit Cycle
                      </span>
                    ) : order.paymentMode === 'Split Payment' ? (
                      <span className="px-2 py-1 rounded-full bg-fuchsia-400/15 text-fuchsia-300 font-medium text-xs">
                        Split Payment
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full bg-white/10 text-white/80 font-medium text-xs">
                        {order.paymentMode || 'N/A'}
                      </span>
                    )}
                  </div>
                  {order.paymentMode === 'Credit Cycle' && order.timestamp?.seconds && order.creditDays && (
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-medium text-white/70">Due Date:</span>
                      <span className="px-2 py-1 rounded-full bg-orange-400/15 text-orange-300 font-medium text-xs">
                        {formatDate(order.timestamp.seconds * 1000 + order.creditDays * 86400000)}
                      </span>
                    </div>
                  )}
                  {order.paymentMode === 'Split Payment' && order.splitPayment && (
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-medium text-white/70">Split Payment:</span>
                      <span className="px-2 py-1 rounded-full bg-fuchsia-400/15 text-fuchsia-300 font-medium text-xs">
                        Advance {order.splitPayment.advance}% / Balance {order.splitPayment.balance}%
                      </span>
                    </div>
                  )}
                </div>
                {/* Items grid */}
                <div className="mt-4">
                  <h4 className="font-medium mb-1">Items:</h4>
                  <div className="mt-2 border border-white/10 rounded-md overflow-hidden">
                    <div className="grid grid-cols-6 font-semibold bg-white/10 border-b border-white/10 px-3 py-2 text-xs">
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
                        className="grid grid-cols-6 border-t border-white/10 px-3 py-2 text-sm hover:bg-white/5 transition"
                      >
                        <div>{item.productName}</div>
                        <div>{item.brand || '—'}</div>
                        <div>{item.category || '—'}</div>
                        <div>{item.quantity}</div>
                        <div>{item.unit}</div>
                        <div className={`font-medium ${
                          item.availableStock === undefined ? 'text-white/50' :
                          item.availableStock >= item.quantity ? 'text-emerald-300' :
                          item.availableStock > 0 ? 'text-amber-300' : 'text-rose-300'
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
                <div className="mt-3 flex justify-end text-emerald-300 text-sm font-semibold">Total: ₹{previewGrandTotal(order, editChargesMap, chargesDraftMap).toFixed(2)}</div>
                {/* Proforma / Taxes & Charges Editor */}
                {order.status === 'Requested' && (
                  <div className="mt-5">
                    <h4 className="font-medium mb-2">Proforma / Taxes & Charges</h4>

                    {isDirect(order) ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-xs text-white/70">Using retailer’s default charges snapshot</div>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={!!editChargesMap[order.id]}
                              onChange={() => setEditChargesMap((m) => ({ ...m, [order.id]: !m[order.id] }))}
                            />
                            Edit charges
                          </label>
                        </div>

                        {(() => {
                          const snap = chargesDraftMap[order.id] || getSnapshot(order);
                          const setField = (k, v) => setChargesDraftMap((prev) => ({
                            ...prev,
                            [order.id]: { ...(prev[order.id] || getSnapshot(order)), [k]: v }
                          }));
                          const disabled = !editChargesMap[order.id];
                          const num = (x) => (x === '' || x === null || x === undefined ? '' : Number(x));

                          // --- Compute display rates for CGST/SGST/IGST ---
                          const defaultsUsed = order?.chargesSnapshot?.defaultsUsed || {};
                          const taxBreakup = snap?.taxBreakup || {};
                          const taxableBase = Number(snap?.taxableBase ?? 0);
                          const deriveRate = (explicit, amount) => {
                            if (typeof explicit === 'number') return explicit;
                            const amt = Number(amount ?? 0);
                            if (taxableBase > 0 && amt > 0) return Number(((amt / taxableBase) * 100).toFixed(2));
                            return undefined;
                          };
                          const cgstRate = deriveRate(defaultsUsed.cgstRate, taxBreakup.cgst ?? snap.cgst);
                          const sgstRate = deriveRate(defaultsUsed.sgstRate, taxBreakup.sgst ?? snap.sgst);
                          const igstRate = deriveRate(defaultsUsed.igstRate ?? defaultsUsed.gstRate, taxBreakup.igst ?? snap.igst);

                          const Row = ({ label, keyName }) => (
                            <div className="flex items-center justify-between py-1 border-b border-white/10">
                              <span className="text-sm text-white/80">{label}</span>
                              <input
                                type="number"
                                className={`w-32 px-2 py-1 rounded bg-white/10 border border-white/20 text-right ${disabled ? 'opacity-60' : ''}`}
                                value={num(snap?.[keyName] ?? 0)}
                                onChange={(e) => setField(keyName, Number(e.target.value || 0))}
                                disabled={disabled}
                              />
                            </div>
                          );
                          return (
                            <div className="space-y-1">
                              <Row label="Delivery" keyName="delivery" />
                              <Row label="Packing" keyName="packing" />
                              <Row label="Insurance" keyName="insurance" />
                              <Row label="Other" keyName="other" />
                              <Row label="Discount %" keyName="discountPct" />
                              <Row label="Discount ₹" keyName="discountAmt" />
                              <Row label="Round Off" keyName="roundOff" />
                              <Row label={`CGST${cgstRate !== undefined ? ` (${cgstRate}%)` : ''}`} keyName="cgst" />
                              <Row label={`SGST${sgstRate !== undefined ? ` (${sgstRate}%)` : ''}`} keyName="sgst" />
                              <Row label={`IGST${igstRate !== undefined ? ` (${igstRate}%)` : ''}`} keyName="igst" />
                              <Row label="Taxable Base" keyName="taxableBase" />
                              <Row label="Grand Total" keyName="grandTotal" />
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <ChargesTaxesEditor
                        orderId={order.id}
                        distributorId={auth.currentUser?.uid}
                        retailerId={order.retailerId}
                        order={order}
                        distributorState={order.distributorState}
                        retailerState={order.retailerState}
                        onSaved={() => {}}
                      />
                    )}
                  </div>
                )}

                {/* If Proforma already exists, show a compact read-only summary */}
                {order.status !== 'Requested' && order.proforma && (
                  <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                    <h4 className="font-semibold mb-3">Proforma Summary</h4>
                    <div className="text-sm text-white/80 space-y-1">
                      <div className="flex justify-between"><span>Taxable Base</span><span>₹{Number(order.proforma.taxableBase || 0).toFixed(2)}</span></div>
                      {order.proforma.taxType === 'IGST' ? (
                        <div className="flex justify-between"><span>IGST</span><span>₹{Number(order.proforma.taxBreakup?.igst || 0).toFixed(2)}</span></div>
                      ) : (
                        <>
                          <div className="flex justify-between"><span>CGST</span><span>₹{Number(order.proforma.taxBreakup?.cgst || 0).toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>SGST</span><span>₹{Number(order.proforma.taxBreakup?.sgst || 0).toFixed(2)}</span></div>
                        </>
                      )}
                      <div className="flex justify-between"><span>Round Off</span><span>₹{Number(order.proforma.roundOff || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between font-semibold text-white">
                        <span>Grand Total</span><span>₹{Number(order.proforma.grandTotal || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
                {/* Export buttons */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleExportCSV(order)}
                    className="px-3 py-1 text-xs rounded-lg bg-white/10 border border-white/15 hover:bg-white/15 transition"
                    title="Export this order as CSV"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportExcel(order)}
                    className="px-3 py-1 text-xs rounded-lg bg-white/10 border border-white/15 hover:bg-white/15 transition"
                    title="Export this order as Excel"
                  >
                    Excel
                  </button>
                  <button
                    onClick={() => handleExportPDF(order)}
                    className="px-3 py-1 text-xs rounded-lg bg-white/10 border border-white/15 hover:bg-white/15 transition"
                    title="Export this order as PDF"
                  >
                    PDF
                  </button>
                </div>
                {/* Accept/Reject Buttons */}
                <div className="mt-4 flex gap-2">
                  <button
                    disabled={order.status !== 'Requested'}
                    onClick={() => handleStatusUpdate(order.id, 'Accepted', null, isDirect(order), chargesDraftMap[order.id])}
                    className={`rounded-full px-4 py-1 font-medium text-sm transition ${
                      order.status !== 'Requested'
                        ? 'bg-white/10 text-white/40 cursor-not-allowed'
                        : 'text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]'
                    }`}
                  >
                    Accept
                  </button>
                  <button
                    disabled={order.status !== 'Requested'}
                    onClick={() => openRejectModal(order.id)}
                    className={`rounded-full px-4 py-1 font-medium text-sm transition ${
                      order.status !== 'Requested'
                        ? 'bg-white/10 text-white/40 cursor-not-allowed'
                        : 'bg-rose-600 hover:bg-rose-700 text-white shadow'
                    }`}
                  >
                    Reject
                  </button>
                </div>
                {order.rejectionNote && (
                  <p className="text-sm mt-2 text-rose-300"><strong>Reason:</strong> {order.rejectionNote}</p>
                )}
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeRejectModal} />
          <div className="relative w-full max-w-lg mx-4 rounded-xl border border-white/10 bg-[#0B0F14]/90 backdrop-blur-2xl text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold">Reject Order</h3>
              <p className="text-sm text-white/70">Please provide a reason for rejection. This will be visible to the retailer.</p>
            </div>
            <div className="px-5 py-4">
              <div className="mb-2 text-xs text-white/70">Quick reasons:</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {['Out of stock','Incorrect pricing','Address mismatch','Credit overdue','Not serviceable','Duplicate request'].map((r) => (
                  <button key={r} type="button" onClick={() => setRejectReason(r)} className="px-2.5 py-1 rounded-full border text-xs bg-white/10 border-white/20 hover:bg-white/15">
                    {r}
                  </button>
                ))}
              </div>
              <label className="block text-sm font-medium mb-1">Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="w-full rounded-md px-3 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                placeholder="Write the rejection reason..."
              />
            </div>
            <div className="px-5 py-3 border-t border-white/10 flex justify-end gap-2 bg-white/5 rounded-b-xl">
              <button onClick={closeRejectModal} className="px-4 py-2 text-sm rounded border bg-white/10 border-white/20 hover:bg-white/15">Cancel</button>
              <button onClick={confirmReject} disabled={!rejectReason.trim()} className={`px-4 py-2 text-sm rounded ${rejectReason.trim() ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
};

export default OrderRequests;