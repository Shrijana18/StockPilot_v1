import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getFirestore, collection, getDocs, onSnapshot, doc, updateDoc, getDoc, setDoc, serverTimestamp, arrayUnion, runTransaction } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import ChargesTaxesEditor from "../ChargesTaxesEditor";
import { ORDER_STATUSES, codeOf } from "../../../constants/orderStatus";
import * as orderPolicy from "../../../lib/orders/orderPolicy";
import { calculateProforma } from "../../../lib/calcProforma";
import { splitFromMrp } from "../../../utils/pricing";

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
  const [chargeInputValues, setChargeInputValues] = useState({}); // { [orderId]: { [fieldName]: string } } - tracks raw input strings
  const [lineEditsMap, setLineEditsMap] = useState({}); // { [orderId]: { [lineIndex]: { itemDiscountPct, gstRate, ... } } }
  const [mode, setMode] = useState('all'); // 'all' | 'active' | 'passive'
  const renderModeTabs = () => (
    <div className="p-4 pt-0">
      <div className="mb-3 inline-flex rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow">
        {['all','active','passive'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-4 py-2 text-sm first:rounded-l-xl last:rounded-r-xl transition ${
              mode === m
                ? 'bg-emerald-500 text-slate-900 font-semibold'
                : 'bg-transparent text-white hover:bg-white/10'
            }`}
          >
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
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

  const isDirect = (order) => {
    const passive =
      order?.retailerMode === 'passive' ||
      order?.mode === 'passive' ||
      order?.isProvisional === true ||
      !!order?.provisionalRetailerId ||
      order?.provisional === true;
    const directMarkers =
      order?.statusCode === 'DIRECT' ||
      order?.status === 'Placed (Direct)' ||
      order?.directFlow === true ||
      order?.chargesSnapshot?.directFlow === true ||
      order?.chargesSnapshot?.defaultsUsed?.skipProforma === true;
    return passive || directMarkers;
  };
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
  // Recalculate charges using calculateProforma for accurate totals
  const recalculateCharges = (order, draftCharges = {}, lineEdits = {}) => {
    if (!order || !order.items || order.items.length === 0) {
      return { grandTotal: 0, breakdown: {} };
    }

    // Build lines from order items
    // NOTE: Selling prices are already final - GST% should be 0 by default
    // GST is only applied if user explicitly edits the GST % on a line item
    const lines = (order.items || []).map((item, idx) => {
      // Check if there are proforma lines with discounts
      const proformaLine = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : null;
      // Get line edits if any
      const lineEdit = lineEdits[idx] || {};
      
      // Get pricing mode from item
      const pricingMode = item.pricingMode || "LEGACY";
      
      // Base GST rate from item
      const baseGstRate = Number(item.gstRate || item.taxRate || proformaLine?.gstRate || 0);
      
      // Get the selling price/MRP from item
      const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
      const mrp = Number(item.mrp || 0);
      const basePrice = Number(item.basePrice || 0);
      
      // Calculate base price and GST rate based on pricing mode:
      let calculatedBasePrice = 0;
      let gstRate = 0;
      
      if (pricingMode === "MRP_INCLUSIVE") {
        // MRP includes GST - calculate base price from MRP
        // Formula: base = MRP / (1 + GST/100)
        if (mrp > 0 && baseGstRate > 0) {
          const split = splitFromMrp(mrp, baseGstRate);
          calculatedBasePrice = split.base;
          // Use the GST rate for calculation (GST will be added on top of base)
          gstRate = baseGstRate;
        } else if (sellingPrice > 0 && baseGstRate > 0) {
          // Fallback: if MRP not available but selling price is, treat as MRP (GST included)
          const split = splitFromMrp(sellingPrice, baseGstRate);
          calculatedBasePrice = split.base;
          gstRate = baseGstRate;
        } else {
          // No GST info - use price as-is (no GST to add)
          calculatedBasePrice = sellingPrice || mrp;
          gstRate = 0;
        }
      } else if (pricingMode === "BASE_PLUS_TAX") {
        // Base price mode - use base price directly, add GST on top
        if (basePrice > 0) {
          calculatedBasePrice = basePrice;
        } else if (sellingPrice > 0 && baseGstRate > 0) {
          // If base price missing but selling price and GST exist, calculate base
          // This handles case where product has GST but no explicit base price
          const split = splitFromMrp(sellingPrice, baseGstRate);
          calculatedBasePrice = split.base;
        } else {
          calculatedBasePrice = sellingPrice;
        }
        // Use GST rate from item or user edit
        if (lineEdit.gstRate !== undefined) {
          gstRate = Number(lineEdit.gstRate) || 0;
        } else {
          gstRate = baseGstRate;
        }
      } else if (pricingMode === "SELLING_PRICE") {
        // Selling price is FINAL (GST included) - treat like MRP_INCLUSIVE
        // Calculate base price from selling price for breakdown display
        // But we still need to apply GST on the base for proper breakdown
        if (sellingPrice > 0 && baseGstRate > 0) {
          // Calculate base price from selling price (GST included)
          const split = splitFromMrp(sellingPrice, baseGstRate);
          calculatedBasePrice = split.base;
          // Use GST rate for calculation (will be applied on base + charges - discounts)
          gstRate = baseGstRate;
        } else if (sellingPrice > 0) {
          // No GST info - use selling price as base, no GST to add
          calculatedBasePrice = sellingPrice;
          gstRate = 0;
        } else {
          calculatedBasePrice = basePrice || 0;
          gstRate = 0;
        }
        // If user edits GST rate, recalculate base and use new GST rate
        if (lineEdit.gstRate !== undefined && Number(lineEdit.gstRate) > 0) {
          const split = splitFromMrp(sellingPrice, Number(lineEdit.gstRate));
          calculatedBasePrice = split.base;
          gstRate = Number(lineEdit.gstRate);
        }
      } else {
        // LEGACY mode - try to calculate base if GST exists, otherwise use selling price
        if (!basePrice && sellingPrice > 0 && baseGstRate > 0) {
          // If GST exists but no base price, calculate it (assume selling price includes GST)
          const split = splitFromMrp(sellingPrice, baseGstRate);
          calculatedBasePrice = split.base;
        } else {
          calculatedBasePrice = sellingPrice;
        }
        if (lineEdit.gstRate !== undefined) {
          gstRate = Number(lineEdit.gstRate) || 0;
        } else {
          gstRate = baseGstRate;
        }
      }
      
      // Allow user to override GST rate if explicitly edited (except MRP_INCLUSIVE and SELLING_PRICE which are fixed)
      // For SELLING_PRICE, GST edit only affects base calculation, not the final GST applied
      if (lineEdit.gstRate !== undefined && pricingMode !== "MRP_INCLUSIVE" && pricingMode !== "SELLING_PRICE") {
        gstRate = Number(lineEdit.gstRate) || 0;
        // If user sets GST to 0 or different value, recalculate base if needed
        if (pricingMode === "LEGACY") {
          if (sellingPrice > 0 && gstRate > 0 && !basePrice) {
            const split = splitFromMrp(sellingPrice, gstRate);
            calculatedBasePrice = split.base;
          }
        }
      }
      
      // Item discount: use edited value if available
      const itemDiscountPct = lineEdit.itemDiscountPct !== undefined 
        ? Number(lineEdit.itemDiscountPct) 
        : Number(proformaLine?.itemDiscountPct || item.itemDiscountPct || 0);
      const itemDiscountAmt = lineEdit.itemDiscountAmt !== undefined
        ? Number(lineEdit.itemDiscountAmt)
        : Number(proformaLine?.discountAmount || item.itemDiscountAmt || 0);
      const itemDiscountChangedBy = lineEdit.itemDiscountChangedBy || proformaLine?.itemDiscountChangedBy || item.itemDiscountChangedBy || 'pct';
      
      return {
        qty: Number(item.quantity || item.qty || 0),
        price: calculatedBasePrice, // Use calculated base price for calculation
        gstRate, // GST rate to apply on top of base
        itemDiscountPct,
        itemDiscountAmt,
        itemDiscountChangedBy,
      };
    });

    // Get order-level charges from draft or existing snapshot
    const existingBreakdown = order?.chargesSnapshot?.breakdown || {};
    // Determine discountChangedBy: prefer draft, then check which discount field has value
    let discountChangedBy = draftCharges.discountChangedBy || existingBreakdown.discountChangedBy;
    if (!discountChangedBy) {
      const draftAmt = Number(draftCharges.discountAmt ?? existingBreakdown.discountAmt ?? 0);
      const draftPct = Number(draftCharges.discountPct ?? existingBreakdown.discountPct ?? 0);
      discountChangedBy = draftAmt > 0 ? 'amt' : 'pct';
    }
    const orderCharges = {
      delivery: Number(draftCharges.delivery ?? existingBreakdown.delivery ?? 0),
      packing: Number(draftCharges.packing ?? existingBreakdown.packing ?? 0),
      insurance: Number(draftCharges.insurance ?? existingBreakdown.insurance ?? 0),
      other: Number(draftCharges.other ?? existingBreakdown.other ?? 0),
      discountPct: Number(draftCharges.discountPct ?? existingBreakdown.discountPct ?? 0),
      discountAmt: Number(draftCharges.discountAmt ?? existingBreakdown.discountAmt ?? 0),
      discountChangedBy,
    };

    // Get states for tax calculation
    const distributorState = order.distributorState || 'Maharashtra';
    const retailerState = order.retailerState || order.state || distributorState;

    // Calculate proforma
    const proforma = calculateProforma({
      lines,
      orderCharges,
      distributorState,
      retailerState,
      roundingEnabled: order?.chargesSnapshot?.defaultsUsed?.roundEnabled || false,
      rounding: (order?.chargesSnapshot?.defaultsUsed?.roundRule || 'nearest').toUpperCase(),
    });

    return {
      grandTotal: proforma.grandTotal,
      breakdown: {
        ...proforma,
        orderCharges: proforma.orderCharges || orderCharges,
        taxBreakup: proforma.taxBreakup || {},
        // Ensure all breakdown fields are included from calculateProforma
        grossItems: proforma.grossItems || 0,
        lineDiscountTotal: proforma.lineDiscountTotal || 0,
        itemsSubTotal: proforma.itemsSubTotal || proforma.subTotal || 0,
        subTotal: proforma.subTotal || 0,
        discountTotal: proforma.discountTotal || 0,
        taxableBase: proforma.taxableBase || 0,
        taxType: proforma.taxType || 'CGST_SGST',
        roundOff: proforma.roundOff || 0,
      },
    };
  };

  // Helper to get line edits for an order
  const getLineEdits = (orderId) => {
    return lineEditsMap[orderId] || {};
  };

  const previewGrandTotal = (order, editChargesMap, chargesDraftMap) => {
    if (isDirect(order)) {
      const draft = chargesDraftMap[order.id];
      const lineEdits = getLineEdits(order.id);
      if (editChargesMap[order.id] && draft) {
        // Recalculate if editing
        const recalculated = recalculateCharges(order, draft, lineEdits);
        return recalculated.grandTotal;
      }
      const snap = getSnapshot(order);
      if (typeof snap?.grandTotal === 'number') return snap.grandTotal;
      // Fallback: recalculate from current state
      const recalculated = recalculateCharges(order, {}, lineEdits);
      return recalculated.grandTotal;
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

  // --- Payment label normalizer (defensive against legacy object shapes) ---
  const paymentLabelOf = (pm) => {
    if (!pm) return 'N/A';
    if (typeof pm === 'string') return pm;

    // object-based legacy payloads
    if (typeof pm === 'object') {
      if (typeof pm.label === 'string' && pm.label.trim()) return pm.label.trim();

      // Known codes
      const code = (pm.code || pm.type || '').toString().toLowerCase();
      if (code) {
        if (code.includes('split')) return 'Split Payment';
        if (code === 'credit' || code.includes('credit_cycle') || code.includes('creditcycle')) return 'Credit Cycle';
        if (code === 'cod' || code.includes('cash_on_delivery')) return 'COD';
        if (code === 'upi') return 'UPI';
        if (code.includes('net')) return 'Net Banking';
        if (code.includes('cheque') || code.includes('check')) return 'Cheque';
        if (code.includes('advance')) return 'Advance Payment';
      }

      // Boolean flags
      if (pm.isSplit) return 'Split Payment';
      if (pm.isCredit) return 'Credit Cycle';
      if (pm.isCOD) return 'COD';
      if (pm.isUPI) return 'UPI';
      if (pm.isNetBanking) return 'Net Banking';
      if (pm.isCheque) return 'Cheque';
      if (pm.isAdvance) return 'Advance Payment';

      // last resort
      if (typeof pm.raw === 'string' && pm.raw.trim()) return pm.raw.trim();
    }
    return 'N/A';
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
      // Normalize passive detection once
      const isPassiveOrder =
        order.retailerMode === 'passive' ||
        order.mode === 'passive' ||
        order.isProvisional === true ||
        !!order.provisionalRetailerId;

      // Mode filter
      if (mode === 'active' && isPassiveOrder) {
        return false;
      }
      if (mode === 'passive' && !isPassiveOrder) {
        return false;
      }

      const matchesSearch =
        (order.id || '').toLowerCase().includes(term) ||
        (order.retailerName || '').toLowerCase().includes(term) ||
        (order.retailerEmail || '').toLowerCase().includes(term) ||
        (order.retailerPhone || '').toLowerCase().includes(term) ||
        (order.retailerCity || '').toLowerCase().includes(term) ||
        (order.retailerAddress || '').toLowerCase().includes(term);

      const orderCode = codeOf(order.statusCode || order.status);
      const filterCode = statusFilter === 'All' ? null : codeOf(statusFilter);
      const matchesStatus = !filterCode || orderCode === filterCode;
      const matchesRetailer = selectedRetailerId === 'all' || order.retailerId === selectedRetailerId;
      return matchesSearch && matchesStatus && matchesRetailer;
    });
  }, [orders, debouncedSearch, statusFilter, selectedRetailerId, mode]);

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
        paymentLabelOf(order.paymentMode),
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
      'Payment': paymentLabelOf(order.paymentMode),
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
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      // Normalize next status string/code defensively
      const next = (newStatus || '').toString().toUpperCase();
      const nextCode = codeOf(newStatus);

      // Load distributor-side order
      const distRef = doc(db, 'businesses', uid, 'orderRequests', orderId);
      const distSnap = await getDoc(distRef);
      if (!distSnap.exists()) {
        console.warn('handleStatusUpdate: order not found', orderId);
        return;
      }
      const order = distSnap.data();

      // Build references safely (retailerId may be missing for passive orders)
      const hasRetailer = !!order?.retailerId;
      const retailerRef = hasRetailer
        ? doc(db, 'businesses', order.retailerId, 'sentOrders', orderId)
        : null;
      const retailerSnap = retailerRef ? await getDoc(retailerRef) : null;

      // Canonical order doc (/orders) for distributor account
      const canonicalRef = doc(db, 'businesses', uid, 'orders', orderId);

      // -------- FAST-ACCEPT for passive/direct orders --------
      // Distributor can accept immediately with (optional) edited charges; no retailer confirmation.
      if (isDirectFlag && (nextCode === ORDER_STATUSES.ACCEPTED)) {
        const sourceItems = Array.isArray(order.items) ? order.items : [];
        let enrichedItems = sourceItems.map((item) => ({ ...item }));
        const needsStockUpdate = sourceItems.some((item) => item?.distributorProductId);

        if (needsStockUpdate) {
          try {
            enrichedItems = await runTransaction(db, async (tx) => {
              const result = [];
              for (const item of sourceItems) {
                if (item?.distributorProductId) {
                  const productRef = doc(db, 'businesses', uid, 'products', item.distributorProductId);
                  const productSnap = await tx.get(productRef);
                  if (productSnap.exists()) {
                    const product = productSnap.data();
                    const orderedQty = Number(item.quantity || 0);
                    const currentQty = Number(product.quantity || 0);
                    const newQty = Math.max(currentQty - orderedQty, 0);
                    tx.update(productRef, { quantity: newQty });
                    result.push({
                      ...item,
                      price: product.sellingPrice ?? product.price ?? item.price ?? 0,
                      subtotal: (product.sellingPrice ?? product.price ?? item.price ?? 0) * orderedQty,
                      sku: product.sku || item.sku || '',
                      category: product.category || item.category || '',
                      brand: product.brand || item.brand || '',
                    });
                    continue;
                  }
                }
                result.push({ ...item });
              }
              return result;
            });
          } catch (transactionError) {
            console.error('Failed to update inventory transactionally:', transactionError);
            enrichedItems = sourceItems.map((item) => ({ ...item }));
          }
        }

        // Recalculate chargesSnapshot using calculateProforma for accuracy
        const draft = directChargesDraft || {};
        const lineEdits = getLineEdits(order.id);
        const recalculated = recalculateCharges(order, draft, lineEdits);
        
        // Build proper chargesSnapshot structure
        const existingCharges = order?.chargesSnapshot || {};
        const existingDefaults = existingCharges?.defaultsUsed || {};
        
        // Determine discountChangedBy
        let discountChangedBy = draft.discountChangedBy || existingCharges?.breakdown?.discountChangedBy;
        if (!discountChangedBy) {
          const draftAmt = Number(draft.discountAmt ?? existingCharges?.breakdown?.discountAmt ?? 0);
          const draftPct = Number(draft.discountPct ?? existingCharges?.breakdown?.discountPct ?? 0);
          discountChangedBy = draftAmt > 0 ? 'amt' : 'pct';
        }
        
        const finalBreakdown = {
          ...recalculated.breakdown,
          delivery: Number(draft.delivery ?? existingCharges?.breakdown?.delivery ?? 0),
          packing: Number(draft.packing ?? existingCharges?.breakdown?.packing ?? 0),
          insurance: Number(draft.insurance ?? existingCharges?.breakdown?.insurance ?? 0),
          other: Number(draft.other ?? existingCharges?.breakdown?.other ?? 0),
          discountPct: Number(draft.discountPct ?? existingCharges?.breakdown?.discountPct ?? 0),
          discountAmt: Number(draft.discountAmt ?? existingCharges?.breakdown?.discountAmt ?? 0),
          discountChangedBy,
          discountTotal: recalculated.breakdown.discountTotal,
          grossItems: recalculated.breakdown.grossItems,
          lineDiscountTotal: recalculated.breakdown.lineDiscountTotal,
          itemsSubTotal: recalculated.breakdown.itemsSubTotal,
          subTotal: recalculated.breakdown.subTotal,
          taxableBase: recalculated.breakdown.taxableBase,
          taxBreakup: recalculated.breakdown.taxBreakup,
          roundOff: recalculated.breakdown.roundOff,
          grandTotal: recalculated.grandTotal,
        };
        
        if (isDirectFlag) {
          finalBreakdown.directFlow = true;
        }
        
        const finalCharges = {
          ...existingCharges,
          breakdown: finalBreakdown,
          defaultsUsed: existingDefaults,
        };
        
        if (isDirectFlag) {
          finalCharges.directFlow = true;
        }

        const baseMode = order.retailerMode || (order.provisionalRetailerId ? 'passive' : 'active');
        // --- Payment mode normalization ---
        const normalizedPaymentMode = (orderPolicy && orderPolicy.normalizePaymentMode ? orderPolicy.normalizePaymentMode(order.paymentMode || order.payment_method || order.payment) : (order.paymentMode || order.payment_method || order.payment || 'Cash'));

        const timelineEntry = {
          status: 'ACCEPTED',
          by: { uid, type: 'distributor' },
          at: new Date().toISOString(),
          ...(baseMode ? { mode: baseMode } : {}),
        };
        const auditEntry = {
          at: new Date().toISOString(),
          event: 'acceptOrder',
          by: { uid, type: 'distributor' },
          meta: { fastAccept: true },
        };
        const acceptanceBase = {
          status: 'Accepted',
          statusCode: 'ACCEPTED',
          distributorId: uid,
          // If this is a passive/provisional order, keep retailerId if present, otherwise carry the provisionalRetailerId.
          retailerId: (order.retailerId ?? (order.provisionalRetailerId || null)),
          retailerMode: baseMode,
          provisionalRetailerId: order.provisionalRetailerId || null,
          proformaLocked: true,
          promotionReady: true,
          directFlow: true,
          items: enrichedItems,
          chargesSnapshot: finalCharges,
          paymentMode: normalizedPaymentMode,
          paymentMethod: order.paymentMethod || order.payment_method || undefined,
        };

        // 1) Update distributor-side source doc first so PendingOrders sees ACCEPTED instantly
        await updateDoc(distRef, {
          ...acceptanceBase,
          'statusTimestamps.acceptedAt': serverTimestamp(),
          'handledBy.acceptedBy': { uid, type: 'distributor' },
          updatedAt: serverTimestamp(),
          timeline: arrayUnion(timelineEntry),
          auditTrail: arrayUnion(auditEntry),
        });

        // 2) Ensure canonical /orders document exists and is updated
        await setDoc(canonicalRef, acceptanceBase, { merge: true });
        await updateDoc(canonicalRef, {
          'statusTimestamps.acceptedAt': serverTimestamp(),
          'handledBy.acceptedBy': { uid, type: 'distributor' },
          updatedAt: serverTimestamp(),
          timeline: arrayUnion(timelineEntry),
          auditTrail: arrayUnion(auditEntry),
        });

        // Mirror to retailer doc only if it exists/allowed
        if (hasRetailer) {
          try {
            await setDoc(retailerRef, {
              status: 'Accepted',
              statusCode: 'ACCEPTED',
              distributorId: uid,
              retailerId: order.retailerId,
              items: enrichedItems,
              chargesSnapshot: finalCharges,
              proformaLocked: true,
              directFlow: true,
              paymentMode: normalizedPaymentMode,
            }, { merge: true });
            await updateDoc(retailerRef, {
              'statusTimestamps.acceptedAt': serverTimestamp(),
              directFlow: true,
              timeline: arrayUnion(timelineEntry),
            });
          } catch (e) {
            if (e?.code !== 'permission-denied') console.warn('retailer accept mirror skipped:', e?.message || e);
          }
        }
        return; // fast-accept done
      }

      // -------- Standard branches (Requested → Accepted / Rejected) --------
      if (nextCode === ORDER_STATUSES.ACCEPTED) {
        // Reuse fast-accept pathway with flag=false: still enrich and write safely
        return await handleStatusUpdate(orderId, 'Accepted', providedReason, true, directChargesDraft);
      }

      if (nextCode === ORDER_STATUSES.REJECTED) {
        const reason = (providedReason || '').trim();
        if (!reason) return;

        const rejectedTimeline = {
          status: 'REJECTED',
          by: { uid, type: 'distributor' },
          at: new Date().toISOString(),
        };
        const rejectedAudit = {
          at: new Date().toISOString(),
          event: 'rejectOrder',
          by: { uid, type: 'distributor' },
          meta: { reason },
        };
        const rejectionBase = {
          status: 'Rejected',
          statusCode: 'REJECTED',
          distributorId: uid,
          retailerId: order.retailerId ?? null,
          rejectionNote: reason,
          items: order.items || [],
          chargesSnapshot: order.chargesSnapshot || null,
          paymentMode: (orderPolicy && orderPolicy.normalizePaymentMode ? orderPolicy.normalizePaymentMode(order.paymentMode || order.payment_method || order.payment) : (order.paymentMode || order.payment_method || order.payment || undefined)),
        };

        await setDoc(canonicalRef, rejectionBase, { merge: true });
        await updateDoc(canonicalRef, {
          'statusTimestamps.rejectedAt': serverTimestamp(),
          timeline: arrayUnion(rejectedTimeline),
          auditTrail: arrayUnion(rejectedAudit),
          updatedAt: serverTimestamp(),
        });

        await updateDoc(distRef, {
          ...rejectionBase,
          'statusTimestamps.rejectedAt': serverTimestamp(),
          timeline: arrayUnion(rejectedTimeline),
          auditTrail: arrayUnion(rejectedAudit),
          updatedAt: serverTimestamp(),
        });

        if (hasRetailer) {
          try {
            await setDoc(retailerRef, {
              status: 'Rejected',
              statusCode: 'REJECTED',
              distributorId: uid,
              retailerId: order.retailerId,
              rejectionNote: reason,
              items: order.items || [],
              chargesSnapshot: order.chargesSnapshot || null,
            }, { merge: true });
            await updateDoc(retailerRef, {
              'statusTimestamps.rejectedAt': serverTimestamp(),
              timeline: arrayUnion(rejectedTimeline),
            });
          } catch (e) {
            if (e?.code !== 'permission-denied') console.warn('retailer reject mirror skipped:', e?.message || e);
          }
        }
        return;
      }

      // Other statuses not handled here
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
        paymentLabelOf(order.paymentMode),
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
        Payment: paymentLabelOf(order.paymentMode),
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

if (!loading && orders.length === 0) {
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
      <div className="rounded-xl p-3 sm:p-4 mb-4 flex flex-col gap-3 border border-white/10 bg-[#0B0F14]/90 supports-[backdrop-filter]:bg-[#0B0F14]/70 backdrop-blur-xl shadow-lg">
        {/* First row: Search and Retailer dropdown */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
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
        
        {/* Second row: Status filter buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-white/70 font-medium mr-1">Status:</span>
          {['All', 'Requested', 'Quoted', 'Accepted', 'Rejected'].map((status) => {
            const active = statusFilter === status;
            const base = 'px-4 py-1.5 rounded-lg text-sm font-medium border transition whitespace-nowrap';
            const on = 'bg-emerald-500 text-slate-900 border-transparent shadow-[0_4px_12px_rgba(16,185,129,0.3)]';
            const off = 'bg-white/10 text-white border-white/20 hover:bg-white/15 hover:border-white/30';
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
                <div className="font-bold text-lg text-white">
                  {order.retailerName || 'N/A'}
                  {(order.retailerMode === 'passive' || order.mode === 'passive' || order.isProvisional || order.provisionalRetailerId) && (
                    <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      passive
                    </span>
                  )}
                </div>
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
                    (order.status === 'Requested' || order.statusCode === 'REQUESTED')
                      ? 'bg-sky-400/15 text-sky-300'
                      : (order.status === 'Accepted' || order.statusCode === 'ACCEPTED')
                      ? 'bg-emerald-400/15 text-emerald-300'
                      : (order.status === 'Rejected' || order.statusCode === 'REJECTED')
                      ? 'bg-rose-400/15 text-rose-300'
                      : 'bg-white/10 text-white/80'
                  }
                  `
                }>
                  {(order.status === 'Requested' || order.statusCode === 'REQUESTED') && '📝 '}
                  {(order.status === 'Accepted'  || order.statusCode === 'ACCEPTED')  && '✔ '}
                  {(order.status === 'Rejected'  || order.statusCode === 'REJECTED')  && '✖ '}
                  {order.status || (order.statusCode ? order.statusCode.charAt(0) + order.statusCode.slice(1).toLowerCase() : '')}
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
                      {(() => {
                        const ms = getOrderTimestampMs(order);
                        return ms ? formatDateTime(ms) : 'N/A';
                      })()}
                    </span>
                  </div>
                  {/* Show status timestamps if available */}
                  {order.statusTimestamps && (
                    <div className="mb-1 space-y-0.5 text-xs text-white/60">
                      {order.statusTimestamps.requestedAt?.seconds && (
                        <div>Requested: {formatDateTime(order.statusTimestamps.requestedAt.seconds * 1000)}</div>
                      )}
                      {order.statusTimestamps.quotedAt?.seconds && (
                        <div>Quoted: {formatDateTime(order.statusTimestamps.quotedAt.seconds * 1000)}</div>
                      )}
                      {order.statusTimestamps.acceptedAt?.seconds && (
                        <div>Accepted: {formatDateTime(order.statusTimestamps.acceptedAt.seconds * 1000)}</div>
                      )}
                      {order.statusTimestamps.shippedAt?.seconds && (
                        <div>Shipped: {formatDateTime(order.statusTimestamps.shippedAt.seconds * 1000)}</div>
                      )}
                      {order.statusTimestamps.deliveredAt?.seconds && (
                        <div>Delivered: {formatDateTime(order.statusTimestamps.deliveredAt.seconds * 1000)}</div>
                      )}
                      {order.statusTimestamps.rejectedAt?.seconds && (
                        <div>Rejected: {formatDateTime(order.statusTimestamps.rejectedAt.seconds * 1000)}</div>
                      )}
                    </div>
                  )}
                  <div className="mb-1">
                    <span className="font-medium text-white/70">Order Note:</span>
                    <span className="ml-2 text-white">{order.notes || '—'}</span>
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-white/70">Status:</span>
                    <span className={
                      `ml-2 px-2 py-1 rounded-full font-semibold text-xs
                        ${
                          (order.status === 'Requested' || order.statusCode === 'REQUESTED')
                            ? 'bg-sky-400/15 text-sky-300'
                            : (order.status === 'Accepted' || order.statusCode === 'ACCEPTED')
                            ? 'bg-emerald-400/15 text-emerald-300'
                            : (order.status === 'Rejected' || order.statusCode === 'REJECTED')
                            ? 'bg-rose-400/15 text-rose-300'
                            : 'bg-white/10 text-white/80'
                        }`
                    }>
                      {(order.status === 'Requested' || order.statusCode === 'REQUESTED') && '📝 '}
                      {(order.status === 'Accepted'  || order.statusCode === 'ACCEPTED')  && '✔ '}
                      {(order.status === 'Rejected'  || order.statusCode === 'REJECTED')  && '✖ '}
                      {order.status || (order.statusCode ? order.statusCode.charAt(0) + order.statusCode.slice(1).toLowerCase() : '')}
                    </span>
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-white/70">Payment Mode:</span>
                    {(() => {
                      const label = paymentLabelOf(order.paymentMode);
                      if (label === 'Credit Cycle') {
                        return (
                          <span className="px-2 py-1 rounded-full bg-orange-400/15 text-orange-300 font-medium text-xs">
                            Credit Cycle
                          </span>
                        );
                      }
                      if (label === 'Split Payment') {
                        return (
                          <span className="px-2 py-1 rounded-full bg-fuchsia-400/15 text-fuchsia-300 font-medium text-xs">
                            Split Payment
                          </span>
                        );
                      }
                      return (
                        <span className="px-2 py-1 rounded-full bg-white/10 text-white/80 font-medium text-xs">
                          {label}
                        </span>
                      );
                    })()}
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
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="font-semibold bg-white/10 border-b border-white/10">
                          <tr>
                            <th className="px-3 py-2 text-left">Product Details</th>
                            <th className="px-3 py-2 text-left">SKU</th>
                            <th className="px-3 py-2 text-left">Brand</th>
                            <th className="px-3 py-2 text-left">Category</th>
                            <th className="px-3 py-2 text-right">Unit</th>
                            <th className="px-3 py-2 text-right">Base Price</th>
                            <th className="px-3 py-2 text-right">MRP</th>
                            <th className="px-3 py-2 text-right">GST %</th>
                            <th className="px-3 py-2 text-right">Selling Price</th>
                            <th className="px-3 py-2 text-center">Qty</th>
                            <th className="px-3 py-2 text-right">Subtotal</th>
                            <th className="px-3 py-2 text-center">Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item, idx) => {
                            const unitPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
                            const qty = Number(item.quantity || item.qty || 0);
                            const subtotal = qty * unitPrice;
                            return (
                              <tr key={idx} className="border-t border-white/10 hover:bg-white/5 transition">
                                <td className="px-3 py-2">
                                  <div className="font-medium">{item.productName || item.name || 'N/A'}</div>
                                  {item.hsnCode && (
                                    <div className="text-xs text-white/60 mt-0.5">HSN: {item.hsnCode}</div>
                                  )}
                                </td>
                                <td className="px-3 py-2">{item.sku || '—'}</td>
                                <td className="px-3 py-2">{item.brand || '—'}</td>
                                <td className="px-3 py-2">{item.category || '—'}</td>
                                <td className="px-3 py-2 text-right">{item.unit || '—'}</td>
                                <td className="px-3 py-2 text-right">
                                  {item.basePrice > 0 ? `₹${item.basePrice.toFixed(2)}` : '—'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : '—'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {(item.gstRate || item.taxRate) > 0 ? `${item.gstRate || item.taxRate}%` : '—'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span className="font-semibold text-emerald-400">₹{unitPrice.toFixed(2)}</span>
                                </td>
                                <td className="px-3 py-2 text-center">{qty}</td>
                                <td className="px-3 py-2 text-right">
                                  <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
                                </td>
                                <td className={`px-3 py-2 text-center font-medium ${
                          item.availableStock === undefined ? 'text-white/50' :
                                  item.availableStock >= qty ? 'text-emerald-300' :
                          item.availableStock > 0 ? 'text-amber-300' : 'text-rose-300'
                        }`}>
                          {item.availableStock === undefined
                            ? 'N/A'
                                    : item.availableStock >= qty
                            ? `${item.availableStock} In Stock`
                            : item.availableStock > 0
                            ? `${item.availableStock} Low`
                            : 'Out of Stock'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                        </div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end text-emerald-300 text-sm font-semibold">Total: ₹{previewGrandTotal(order, editChargesMap, chargesDraftMap).toFixed(2)}</div>
                {/* Proforma / Taxes & Charges Editor */}
                {order.status === 'Requested' && (
                  <div className="mt-5">
                    <h4 className="font-medium mb-2">Proforma / Taxes & Charges</h4>

                    {isDirect(order) ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-white/70">Using retailer's default charges snapshot</div>
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
                          const baseSnap = getSnapshot(order);
                          const draft = chargesDraftMap[order.id] || {};
                          const currentSnap = { ...baseSnap, ...draft };
                          const lineEdits = getLineEdits(order.id);
                          const disabled = !editChargesMap[order.id];
                          
                          // Get or initialize input values for this order
                          let inputValues = chargeInputValues[order.id];
                          if (!inputValues && editChargesMap[order.id]) {
                            // Initialize with current values (empty string for 0)
                            inputValues = {};
                            ['delivery', 'packing', 'insurance', 'other', 'discountPct', 'discountAmt'].forEach(key => {
                              const val = currentSnap?.[key] ?? 0;
                              inputValues[key] = val === 0 || val === '' ? '' : String(val);
                            });
                            // Set it in state (async, but we use local copy for this render)
                            setChargeInputValues(prev => ({ ...prev, [order.id]: inputValues }));
                          }
                          inputValues = inputValues || {};
                          
                          const setField = (k, v) => {
                            // Store the raw input value as string (for clean editing)
                            setChargeInputValues(prev => ({
                            ...prev,
                              [order.id]: { ...(prev[order.id] || {}), [k]: v }
                            }));
                            
                            // Convert to number for calculation (empty string = 0)
                            const numValue = v === '' || v === null || v === undefined ? 0 : Number(v);
                            const newDraft = { ...(chargesDraftMap[order.id] || baseSnap), [k]: numValue };
                            
                            // Handle discountChangedBy and two-way sync for discount
                            if (k === 'discountPct') {
                              newDraft.discountChangedBy = 'pct';
                              // Calculate discount amount from percentage
                              // First, get the base before discount (items + charges, without discount)
                              const tempDraft = { ...newDraft, discountPct: 0, discountAmt: 0 };
                              const tempCalc = recalculateCharges(order, tempDraft, lineEdits);
                              // Base before discount = itemsSubTotal + charges (delivery, packing, etc.)
                              const itemsSubTotal = tempCalc.breakdown.itemsSubTotal || tempCalc.breakdown.subTotal || 0;
                              const charges = (tempDraft.delivery || 0) + (tempDraft.packing || 0) + 
                                            (tempDraft.insurance || 0) + (tempDraft.other || 0);
                              const baseBeforeDiscount = itemsSubTotal + charges;
                              
                              if (baseBeforeDiscount > 0 && numValue > 0) {
                                const calculatedAmt = (baseBeforeDiscount * numValue) / 100;
                                newDraft.discountAmt = Math.round(calculatedAmt * 100) / 100;
                                // Update input value for discountAmt to show calculated value
                                setChargeInputValues(prev => ({
                                  ...prev,
                                  [order.id]: { ...(prev[order.id] || {}), discountAmt: calculatedAmt === 0 ? '' : String(calculatedAmt.toFixed(2)) }
                                }));
                              } else {
                                newDraft.discountAmt = 0;
                                setChargeInputValues(prev => ({
                                  ...prev,
                                  [order.id]: { ...(prev[order.id] || {}), discountAmt: '' }
                                }));
                              }
                            } else if (k === 'discountAmt') {
                              newDraft.discountChangedBy = 'amt';
                              // Calculate discount percentage from amount
                              // First, get the base before discount (items + charges, without discount)
                              const tempDraft = { ...newDraft, discountPct: 0, discountAmt: 0 };
                              const tempCalc = recalculateCharges(order, tempDraft, lineEdits);
                              // Base before discount = itemsSubTotal + charges (delivery, packing, etc.)
                              const itemsSubTotal = tempCalc.breakdown.itemsSubTotal || tempCalc.breakdown.subTotal || 0;
                              const charges = (tempDraft.delivery || 0) + (tempDraft.packing || 0) + 
                                            (tempDraft.insurance || 0) + (tempDraft.other || 0);
                              const baseBeforeDiscount = itemsSubTotal + charges;
                              
                              if (baseBeforeDiscount > 0 && numValue > 0) {
                                const calculatedPct = (numValue / baseBeforeDiscount) * 100;
                                newDraft.discountPct = Math.min(100, Math.round(calculatedPct * 100) / 100);
                                // Update input value for discountPct to show calculated value
                                setChargeInputValues(prev => ({
                                  ...prev,
                                  [order.id]: { ...(prev[order.id] || {}), discountPct: calculatedPct === 0 ? '' : String(calculatedPct.toFixed(2)) }
                                }));
                              } else {
                                newDraft.discountPct = 0;
                                setChargeInputValues(prev => ({
                                  ...prev,
                                  [order.id]: { ...(prev[order.id] || {}), discountPct: '' }
                                }));
                              }
                            }
                            
                            // Recalculate totals when any field changes
                            const recalculated = recalculateCharges(order, newDraft, lineEdits);
                            setChargesDraftMap((prev) => ({
                              ...prev,
                              [order.id]: { ...newDraft, ...recalculated.breakdown, grandTotal: recalculated.grandTotal }
                            }));
                          };

                          const updateLineField = (lineIdx, field, value) => {
                            const numValue = value === '' || value === null || value === undefined ? 0 : Number(value);
                            setLineEditsMap(prev => {
                              const orderEdits = prev[order.id] || {};
                              const lineEdit = orderEdits[lineIdx] || {};
                              const newLineEdit = { ...lineEdit, [field]: numValue };
                              if (field === 'itemDiscountAmt' && numValue > 0) {
                                newLineEdit.itemDiscountChangedBy = 'amt';
                              } else if (field === 'itemDiscountPct' && numValue > 0) {
                                newLineEdit.itemDiscountChangedBy = 'pct';
                              }
                              return {
                                ...prev,
                                [order.id]: { ...orderEdits, [lineIdx]: newLineEdit }
                              };
                            });
                            
                            // Recalculate with updated line edits
                            const updatedLineEdits = { ...lineEdits, [lineIdx]: { ...lineEdits[lineIdx], [field]: numValue } };
                            const recalculated = recalculateCharges(order, draft, updatedLineEdits);
                            setChargesDraftMap((prev) => ({
                              ...prev,
                              [order.id]: { ...draft, ...recalculated.breakdown, grandTotal: recalculated.grandTotal }
                            }));
                          };

                          // Get recalculated values for display
                          const displayValues = editChargesMap[order.id] && chargesDraftMap[order.id]
                            ? recalculateCharges(order, chargesDraftMap[order.id], lineEdits)
                            : recalculateCharges(order, {}, lineEdits);
                          const displayBreakdown = displayValues.breakdown;
                          // Use the full proforma result for preview (it has all the breakdown fields)
                          const preview = displayValues.breakdown || displayValues;
                          
                          // Two-way sync for discount: calculate derived values for display
                          // Get base before discount (taxable base + discount total)
                          const discountTotal = Number(preview?.discountTotal || 0);
                          const taxableBase = Number(preview?.taxableBase || 0);
                          const baseBeforeDiscount = taxableBase + discountTotal;
                          
                          // Determine which discount field was last edited
                          const discountChangedBy = draft.discountChangedBy || currentSnap?.discountChangedBy || 'pct';
                          
                          // Calculate derived discount percentage from amount
                          const derivedDiscountPct = baseBeforeDiscount > 0 
                            ? ((discountTotal / baseBeforeDiscount) * 100) 
                            : 0;
                          
                          // What to show in inputs: use edited value if that field was edited, otherwise show derived value
                          const shownDiscountPct = discountChangedBy === 'pct'
                            ? (inputValues.discountPct !== undefined ? inputValues.discountPct : (currentSnap?.discountPct === 0 ? '' : String(currentSnap?.discountPct || '')))
                            : (derivedDiscountPct > 0 ? String(Math.round(derivedDiscountPct * 100) / 100) : '');
                          
                          const shownDiscountAmt = discountChangedBy === 'amt'
                            ? (inputValues.discountAmt !== undefined ? inputValues.discountAmt : (currentSnap?.discountAmt === 0 ? '' : String(currentSnap?.discountAmt || '')))
                            : (discountTotal > 0 ? String(discountTotal.toFixed(2)) : '');

                          // Get states for tax type display
                          const distributorState = order.distributorState || 'Maharashtra';
                          const retailerState = order.retailerState || order.state || distributorState;
                          const taxTypeLabel = preview?.taxType === 'IGST'
                            ? `IGST (Interstate: ${distributorState} → ${retailerState})`
                            : `CGST + SGST (Intrastate: ${distributorState} → ${retailerState})`;

                          return (
                            <>
                              {/* Line Items Editor */}
                              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                <h3 className="text-white font-semibold mb-3">Line Items (Distributor View)</h3>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-sm">
                                    <thead>
                                      <tr className="text-white/80">
                                        <th className="text-left p-2">Item</th>
                                        <th className="text-right p-2">Qty</th>
                                        <th className="text-right p-2">Price</th>
                                        <th className="text-right p-2">Disc %</th>
                                        <th className="text-right p-2">GST %</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(order.items || []).map((item, idx) => {
                                        const lineEdit = lineEdits[idx] || {};
                                        const itemDiscountPct = lineEdit.itemDiscountPct !== undefined 
                                          ? lineEdit.itemDiscountPct 
                                          : (item.itemDiscountPct || 0);
                                        // Display GST rate: use edited value, or item's GST rate, or empty string
                                        const baseGstRate = Number(item.gstRate || item.taxRate || 0);
                                        const gstRate = lineEdit.gstRate !== undefined 
                                          ? (lineEdit.gstRate === 0 ? '' : String(lineEdit.gstRate))
                                          : (baseGstRate > 0 ? String(baseGstRate) : '');
                                        
                                        return (
                                          <tr key={idx} className="border-t border-white/10">
                                            <td className="p-2 text-white/90">
                                              <div className="font-medium">{item.productName || item.name || 'Item'}</div>
                                              <div className="text-xs text-white/60">
                                                {item.sku || ''} {item.hsnCode || item.hsn ? `• HSN ${item.hsnCode || item.hsn}` : ''}
                                              </div>
                                            </td>
                                            <td className="p-2 text-right text-white/90">
                                              {item.quantity || item.qty || 0}
                                            </td>
                                            <td className="p-2 text-right text-white/90">
                                              {(() => {
                                                // Calculate and display base/unit price
                                                // For SELLING_PRICE and MRP_INCLUSIVE, show the final price (selling price/MRP)
                                                // For BASE_PLUS_TAX, show base price
                                                const pricingMode = item.pricingMode || "LEGACY";
                                                const basePrice = Number(item.basePrice || 0);
                                                const mrp = Number(item.mrp || 0);
                                                const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
                                                const gstRate = Number(item.gstRate || item.taxRate || 0);
                                                
                                                let displayPrice = basePrice;
                                                
                                                // For SELLING_PRICE and MRP_INCLUSIVE, show BASE/UNIT price (calculated from final price)
                                                // This is for breakdown clarity: unit price → charges → discounts → GST → total
                                                if (pricingMode === "SELLING_PRICE") {
                                                  // Calculate base price from selling price (GST included)
                                                  if (sellingPrice > 0 && gstRate > 0) {
                                                    const split = splitFromMrp(sellingPrice, gstRate);
                                                    displayPrice = split.base;
                                                  } else {
                                                    displayPrice = sellingPrice; // Fallback if no GST
                                                  }
                                                } else if (pricingMode === "MRP_INCLUSIVE") {
                                                  // Calculate base price from MRP (GST included)
                                                  const finalPrice = mrp > 0 ? mrp : sellingPrice;
                                                  if (finalPrice > 0 && gstRate > 0) {
                                                    const split = splitFromMrp(finalPrice, gstRate);
                                                    displayPrice = split.base;
                                                  } else {
                                                    displayPrice = finalPrice; // Fallback if no GST
                                                  }
                                                } else if (!displayPrice) {
                                                  // For other modes, calculate base if needed
                                                  if (pricingMode === "BASE_PLUS_TAX") {
                                                    displayPrice = basePrice || sellingPrice;
                                                  } else {
                                                    // LEGACY: try to calculate base if GST exists
                                                    if (sellingPrice > 0 && gstRate > 0) {
                                                      const split = splitFromMrp(sellingPrice, gstRate);
                                                      displayPrice = split.base;
                                                    } else {
                                                      displayPrice = sellingPrice;
                                                    }
                                                  }
                                                }
                                                
                                                return `₹${displayPrice.toFixed(2)}`;
                                              })()}
                                            </td>
                                            <td className="p-2 text-right">
                              <input
                                type="number"
                                                className="w-24 rounded bg-white/10 text-white px-2 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                value={itemDiscountPct === 0 ? '' : String(itemDiscountPct)}
                                                onChange={(e) => updateLineField(idx, 'itemDiscountPct', e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                                placeholder="0"
                                                min="0"
                                                max="100"
                                disabled={disabled}
                              />
                                            </td>
                                            <td className="p-2 text-right">
                                              <input
                                                type="number"
                                                className="w-24 rounded bg-white/10 text-white px-2 py-1 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                value={gstRate}
                                                onChange={(e) => updateLineField(idx, 'gstRate', e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                                placeholder="0"
                                                min="0"
                                                max="28"
                                                disabled={disabled}
                                              />
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                            </div>
                              </div>

                              {/* Order-level Charges & Preview */}
                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                  <h3 className="text-white font-semibold mb-3">Order-level Charges & Discount</h3>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-white/90 text-sm mb-1">Delivery</label>
                                      <input
                                        type="number"
                                        className="w-full rounded bg-white/10 text-white px-2 py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={inputValues.delivery !== undefined ? inputValues.delivery : (currentSnap?.delivery === 0 ? '' : String(currentSnap?.delivery || ''))}
                                        onChange={(e) => setField('delivery', e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="0"
                                        min="0"
                                        disabled={disabled}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-white/90 text-sm mb-1">Packing</label>
                                      <input
                                        type="number"
                                        className="w-full rounded bg-white/10 text-white px-2 py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={inputValues.packing !== undefined ? inputValues.packing : (currentSnap?.packing === 0 ? '' : String(currentSnap?.packing || ''))}
                                        onChange={(e) => setField('packing', e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="0"
                                        min="0"
                                        disabled={disabled}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-white/90 text-sm mb-1">Insurance</label>
                                      <input
                                        type="number"
                                        className="w-full rounded bg-white/10 text-white px-2 py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={inputValues.insurance !== undefined ? inputValues.insurance : (currentSnap?.insurance === 0 ? '' : String(currentSnap?.insurance || ''))}
                                        onChange={(e) => setField('insurance', e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="0"
                                        min="0"
                                        disabled={disabled}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-white/90 text-sm mb-1">Other</label>
                                      <input
                                        type="number"
                                        className="w-full rounded bg-white/10 text-white px-2 py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={inputValues.other !== undefined ? inputValues.other : (currentSnap?.other === 0 ? '' : String(currentSnap?.other || ''))}
                                        onChange={(e) => setField('other', e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="0"
                                        min="0"
                                        disabled={disabled}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-white/90 text-sm mb-1">Discount %</label>
                                      <input
                                        type="number"
                                        className="w-full rounded bg-white/10 text-white px-2 py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={shownDiscountPct}
                                        onChange={(e) => setField('discountPct', e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="0"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        disabled={disabled}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-white/90 text-sm mb-1">Discount ₹</label>
                                      <input
                                        type="number"
                                        className="w-full rounded bg-white/10 text-white px-2 py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={shownDiscountAmt}
                                        onChange={(e) => setField('discountAmt', e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="0"
                                        min="0"
                                        step="0.01"
                                        disabled={disabled}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                  <h3 className="text-white font-semibold mb-3">Proforma Preview</h3>
                                  <div className="text-sm text-white/80 space-y-1">
                                    <div className="flex justify-between"><span>Unit Price Total</span><span>₹{Number(preview?.grossItems || 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>− Line Discounts</span><span>₹{Number(preview?.lineDiscountTotal || 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>Items Sub‑Total</span><span>₹{Number(preview?.itemsSubTotal || preview?.subTotal || 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>+ Delivery</span><span>₹{Number((draft?.delivery !== undefined ? draft.delivery : preview?.orderCharges?.delivery) || 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>+ Packing</span><span>₹{Number((draft?.packing !== undefined ? draft.packing : preview?.orderCharges?.packing) || 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>+ Insurance</span><span>₹{Number((draft?.insurance !== undefined ? draft.insurance : preview?.orderCharges?.insurance) || 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>+ Other</span><span>₹{Number((draft?.other !== undefined ? draft.other : preview?.orderCharges?.other) || 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>− Order Discount</span><span>₹{Number(preview?.discountTotal || 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between font-semibold"><span>Taxable Base</span><span>₹{Number(preview?.taxableBase || 0).toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>Tax Type</span><span>{taxTypeLabel}</span></div>
                                    {preview?.taxType === 'IGST' ? (
                                      <div className="flex justify-between"><span>IGST</span><span>₹{Number(preview?.taxBreakup?.igst || 0).toFixed(2)}</span></div>
                                    ) : (
                                      <>
                                        <div className="flex justify-between"><span>CGST</span><span>₹{Number(preview?.taxBreakup?.cgst || 0).toFixed(2)}</span></div>
                                        <div className="flex justify-between"><span>SGST</span><span>₹{Number(preview?.taxBreakup?.sgst || 0).toFixed(2)}</span></div>
                                      </>
                                    )}
                                    {(preview?.roundOff && Number(preview.roundOff) !== 0) && (
                                      <div className="flex justify-between"><span>Round Off</span><span>₹{Number(preview.roundOff).toFixed(2)}</span></div>
                                    )}
                                    <div className="flex justify-between font-semibold text-white"><span>Grand Total</span><span>₹{Number(preview?.grandTotal || 0).toFixed(2)}</span></div>
                                  </div>
                                </div>
                              </div>
                            </>
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
    </div>
  );
};

export default OrderRequests;