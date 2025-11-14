import React, { useEffect, useState, useRef } from 'react';
import { getFirestore, collection, onSnapshot, doc, updateDoc, getDoc, setDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { exportOrderCSV } from "../../../lib/exporters/csv";
import { downloadOrderExcel } from "../../../lib/exporters/excel";
import { downloadOrderPDF } from "../../../lib/exporters/pdf";
import ProformaSummary from "../../retailer/ProformaSummary";
import { calculateProforma } from "../../../lib/calcProforma"; // ✅ ensure consistent math
import { ORDER_STATUSES, codeOf } from "../../../constants/orderStatus"; // ✅ canonical statuses
import * as orderPolicy from '../../../lib/orders/orderPolicy';
import { splitFromMrp } from '../../../utils/pricing';

// ---- Compatibility shim for orderPolicy exports (handles older names) ----
const normalizePaymentMode =
  orderPolicy.normalizePaymentMode ||
  ((raw, extra = {}) => {
    const txt = (raw ?? '').toString().trim();
    const up = txt.toUpperCase();
    return {
      code: up || null,
      label: txt || 'N/A',
      isCredit: /CREDIT/.test(up),
      isCOD: up === 'COD',
      isUPI: up === 'UPI',
      isNetBanking: /NET.?BANK/i.test(txt),
      isCheque: /CHEQUE|CHECK/i.test(txt),
      isSplit: !!extra.split,
      creditDays: extra.creditDays ?? undefined,
      advanceAmount: extra.advanceAmount ?? undefined,
    };
  });
const ORDER_POLICY_VERSION =
  orderPolicy.ORDER_POLICY_VERSION ||
  orderPolicy.VERSION ||
  orderPolicy.POLICY_VERSION ||
  'v1';

// ---- Order Policy helpers (UI + date/timestamp guards) ----
const toMillis = (v) => {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
  const d = new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

const paymentUi = (order) => {
  try {
    if (!order) {
      return { label: 'N/A', normalized: null, flags: {} };
    }

    const existingFlags = order.paymentFlags || {};
    const existingNormalized = order.paymentNormalized || {};
    const fallbackAdvance =
      order?.advanceAmount ??
      order?.payment?.advanceAmount ??
      order?.paymentSummary?.advanceAmount ??
      undefined;
    const fallbackSplit =
      order?.splitPayment ??
      order?.payment?.splitPayment ??
      order?.paymentSummary?.splitPayment ??
      undefined;
    const fallbackCreditDays =
      order?.creditDays ??
      order?.payment?.creditDays ??
      order?.paymentSummary?.creditDueDays ??
      order?.payment?.creditDueDays ??
      undefined;

    const rawInput =
      existingNormalized?.code && existingNormalized.code.trim()
        ? existingNormalized.code
        : order?.paymentMethod && typeof order.paymentMethod === 'string' && order.paymentMethod.trim()
        ? order.paymentMethod
        : order?.payment?.code && order.payment.code.trim()
        ? order.payment.code
        : order?.payment?.type && order.payment.type.trim()
        ? order.payment.type
        : order?.paymentMode && order.paymentMode.trim()
        ? order.paymentMode
        : order?.paymentSummary?.mode && order.paymentSummary.mode.trim()
        ? order.paymentSummary.mode
        : typeof order?.payment === 'string' && order.payment.trim()
        ? order.payment
        : null;

    const norm = normalizePaymentMode(rawInput, {
      creditDays: fallbackCreditDays,
      advanceAmount: fallbackAdvance,
      split: fallbackSplit,
    });
    return {
      label:
        (norm.label && norm.label.trim()) ||
        order?.paymentMode ||
        order?.payment?.type ||
        order?.payment?.label ||
        order?.paymentSummary?.mode ||
        order?.paymentMethod ||
        existingNormalized?.label ||
        'N/A',
      normalized: norm,
      flags: {
        isCredit:
          existingFlags.isCredit ??
          !!norm.isCredit,
        isAdvance:
          existingFlags.isAdvance ??
          !!norm.isAdvance,
        isSplit:
          existingFlags.isSplit ??
          !!norm.isSplit,
        isCOD:
          existingFlags.isCOD ??
          !!norm.isCOD,
        isUPI:
          existingFlags.isUPI ??
          !!norm.isUPI,
        isNetBanking:
          existingFlags.isNetBanking ??
          !!norm.isNetBanking,
        isCheque:
          existingFlags.isCheque ??
          !!norm.isCheque,
      },
    };
  } catch {
    const fallbackLabel =
      order?.paymentMode ||
      order?.payment?.type ||
      order?.paymentSummary?.mode ||
      order?.paymentMethod ||
      'N/A';
    return { label: fallbackLabel, normalized: order?.paymentNormalized || null, flags: order?.paymentFlags || {} };
  }
};


// ✅ Always return a safe string label for React (avoid rendering objects)
const getPaymentLabel = (order) => {
  try {
    const ui = paymentUi(order);
    const lbl = ui && ui.label;
    if (typeof lbl === 'string') return lbl;
    if (lbl && typeof lbl === 'object' && typeof lbl.label === 'string') return lbl.label;
    return (
      order?.paymentMode ||
      order?.payment?.type ||
      order?.paymentSummary?.mode ||
      order?.paymentMethod ||
      'N/A'
    );
  } catch {
    return 'N/A';
  }
};

// Helper: robustly detect credit orders (active + passive + legacy)
const isCreditOrder = (order) => {
  try {
    const ui = paymentUi(order);
    return !!(
      ui?.flags?.isCredit ||
      (ui?.normalized?.code === 'CREDIT_CYCLE') ||
      /credit/i.test(ui?.label || '') ||
      /credit/i.test(order?.paymentMethod || '') ||
      (order?.paymentFlags?.isCredit === true)
    );
  } catch {
    return false;
  }
};

const TrackOrders = () => {
  const [orders, setOrders] = useState([]);
  const [expandedOrderIds, setExpandedOrderIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [activeSection, setActiveSection] = useState('Out for Delivery');
  const [mode, setMode] = useState('all'); // 'all' | 'active' | 'passive'
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [orderDataForInvoice, setOrderDataForInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // --- Deep link support for ?tab=&sub= in the hash ---
  useEffect(() => {
    const applyFromHash = () => {
      const hash = window.location.hash || '';
      const qIndex = hash.indexOf('?');
      if (qIndex !== -1) {
        const params = new URLSearchParams(hash.substring(qIndex + 1));
        const sub = (params.get('sub') || '').toLowerCase();
        if (sub === 'payment-due') setActiveSection('Payment Due');
        else if (sub === 'out-for-delivery') setActiveSection('Out for Delivery');
        else if (sub === 'paid' || sub === 'paid-orders') setActiveSection('Paid Orders');
        else if (sub === 'quoted') setActiveSection('Quoted');
      }
    };
    applyFromHash();
    window.addEventListener('hashchange', applyFromHash);
    return () => window.removeEventListener('hashchange', applyFromHash);
  }, []);

  const setSectionAndHash = (name) => {
    setActiveSection(name);
    try {
      const hash = window.location.hash || '#/distributor-dashboard';
      const [path, query = ''] = hash.split('?');
      const params = new URLSearchParams(query);
      params.set('tab', 'track-orders');
      if (name === 'Payment Due') params.set('sub', 'payment-due');
      else if (name === 'Out for Delivery') params.set('sub', 'out-for-delivery');
      else if (name === 'Paid Orders') params.set('sub', 'paid');
      else if (name === 'Quoted') params.set('sub', 'quoted');
      else params.delete('sub');
      const newHash = `${path}?${params.toString()}`;
      if (newHash !== hash) window.history.replaceState(null, '', newHash);
    } catch {}
  };

  // Navigate to Distributor Invoices tab in the dashboard
  const goToInvoicesTab = () => {
    try {
      const hash = window.location.hash || '#/distributor-dashboard';
      const [path, query = ''] = hash.split('?');
      const params = new URLSearchParams(query);
      params.set('tab', 'invoices');
      const newHash = `${path}?${params.toString()}`;
      if (newHash !== hash) {
        window.history.replaceState(null, '', newHash);
      }
    } catch {}
  };

  // View invoice for a specific order
  const handleViewInvoice = async (order) => {
    const user = auth.currentUser;
    if (!user || !order?.id) return;

    setLoadingInvoice(true);
    setSelectedInvoice(null);
    setOrderDataForInvoice(null);

    try {
      // Fetch invoice from invoices collection using orderId
      const invoiceRef = doc(db, 'businesses', user.uid, 'invoices', order.id);
      const invoiceSnap = await getDoc(invoiceRef);
      
      if (invoiceSnap.exists()) {
        const invoiceData = { id: invoiceSnap.id, ...invoiceSnap.data() };
        setSelectedInvoice(invoiceData);
        // Use the order data we already have
        setOrderDataForInvoice(order);
      } else {
        toast.info('Invoice not found for this order. It will be created when the order is marked as delivered.');
      }
    } catch (err) {
      console.error('[TrackOrders] Error fetching invoice:', err);
      toast.error('Failed to load invoice');
    } finally {
      setLoadingInvoice(false);
    }
  };

  const closeInvoiceModal = () => {
    setSelectedInvoice(null);
    setOrderDataForInvoice(null);
  };

  const db = getFirestore();
  const auth = getAuth();
  const [currentRetailers, setCurrentRetailers] = useState({}); // live profile by retailerId
  const [connectedRetailerMap, setConnectedRetailerMap] = useState({}); // keyed by retailerId
  const [creditDaysEdit, setCreditDaysEdit] = useState({}); // orderId -> edited credit days
  const retailerSubsRef = useRef({}); // keep onSnapshot unsubscribers per retailerId

  const toggleOrder = (id) => {
    setExpandedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const safeName = (s) => (s || "order").toString().replace(/[^a-z0-9_-]+/gi, "_");
  const exportCSV = (order) => {
    const base = `${safeName(order.retailerBusinessName || order.retailerName)}_${order.id}`;
    exportOrderCSV(order, `${base}.csv`);
  };
  const exportExcel = (order) => {
    const base = `${safeName(order.retailerBusinessName || order.retailerName)}_${order.id}`;
    downloadOrderExcel(order, `${base}.xlsx`);
  };
  const exportPDF = (order) => {
    const base = `${safeName(order.retailerBusinessName || order.retailerName)}_${order.id}`;
    downloadOrderPDF(order, `${base}.pdf`);
  };

  // Passive/Active detector (shared across modules)
  const isPassiveOrder = (order) =>
    order?.retailerMode === 'passive' ||
    order?.mode === 'passive' ||
    order?.isProvisional === true ||
    !!order?.provisionalRetailerId ||
    order?.provisional === true;

  // Mode filter helper
  const matchesMode = (order) => {
    if (mode === 'all') return true;
    const passive = isPassiveOrder(order);
    if (mode === 'active') return !passive;
    if (mode === 'passive') return passive;
    return true;
  };

  // Removed duplicate declaration of getEditedCreditDays
  const duePreviewFromDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + Number(days || 0));
    return d;
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      const col = collection(db, 'businesses', user.uid, 'orderRequests');

      const unsubscribeFirestore = onSnapshot(col, (snapshot) => {
        const orderData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const aDelivered = (a.status === 'Delivered') || (a.statusCode === 'DELIVERED');
            const bDelivered = (b.status === 'Delivered') || (b.statusCode === 'DELIVERED');
            if (aDelivered !== bDelivered) return aDelivered ? 1 : -1;
            return toMillis(b.createdAt) - toMillis(a.createdAt);
          });
        setOrders(orderData);
      });

      // Cleanup Firestore subscription on unmount
      return () => unsubscribeFirestore();
    });

    // Cleanup Auth listener on unmount
    return () => unsubscribeAuth();
  }, []);

  // Subscribe to retailer profile docs for any retailerIds in orders
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    const ids = Array.from(new Set(orders.map(o => o.retailerId).filter(Boolean)));

    ids.forEach((id) => {
      if (retailerSubsRef.current[id]) return; // already subscribed
      const retailerRef = doc(db, 'businesses', id);
      const unsub = onSnapshot(retailerRef, (snap) => {
        if (snap.exists()) {
          setCurrentRetailers((prev) => ({ ...prev, [id]: snap.data() }));
        }
      });
      retailerSubsRef.current[id] = unsub;
    });
  }, [orders]);

  // Subscribe to connectedRetailers collection for the distributor
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const connCol = collection(db, 'businesses', user.uid, 'connectedRetailers');
      const unsubConn = onSnapshot(connCol, (snap) => {
        const m = {};
        snap.forEach((d) => {
          const data = d.data();
          if (data?.retailerId) {
            m[data.retailerId] = data; // includes retailerPhone, retailerEmail, address, city, state
          }
        });
        setConnectedRetailerMap(m);
      });
      return () => unsubConn();
    });
    return () => unsubAuth();
  }, []);

  const markAsDelivered = async (orderId) => {
    const user = auth.currentUser;
    if (!user) return;

    const distributorId = user.uid;
    const distributorOrderRef = doc(db, 'businesses', distributorId, 'orderRequests', orderId);
    const distributorOrderSnap = await getDoc(distributorOrderRef);
    if (!distributorOrderSnap.exists()) {
      console.warn('[TrackOrders] markAsDelivered: order not found', orderId);
      return;
    }
    const orderData = distributorOrderSnap.data();

    const hasRetailer = !!(orderData && orderData.retailerId);
    const retailerOrderRef = hasRetailer
      ? doc(db, 'businesses', orderData.retailerId, 'sentOrders', orderId)
      : null;

    const now = new Date();
    const nowIso = now.toISOString();
    const paymentInfo = paymentUi(orderData);
    const paymentFlags = paymentInfo?.flags || {};
    const normalizedPayment = paymentInfo?.normalized || {};
    const rawCreditDays =
      normalizedPayment?.creditDays ??
      orderData?.creditDays ??
      orderData?.payment?.creditDays ??
      orderData?.paymentSummary?.creditDueDays ??
      orderData?.payment?.creditDueDays ??
      0;
    const creditDaysValue = Number(rawCreditDays || 0);
    const isCredit =
      !!paymentFlags.isCredit ||
      normalizedPayment?.isCredit ||
      (typeof orderData?.paymentMethod === 'string' &&
        orderData.paymentMethod.toUpperCase().includes('CREDIT')) ||
      (orderData?.paymentFlags && orderData.paymentFlags.isCredit === true);

    const mergedFlags = {
      ...(orderData?.paymentFlags || {}),
      ...Object.fromEntries(
        Object.entries(paymentFlags).filter(([, v]) => typeof v === 'boolean')
      ),
    };

    const normalizedToStore =
      normalizedPayment && normalizedPayment.code
        ? { ...(orderData?.paymentNormalized || {}), ...normalizedPayment }
        : orderData?.paymentNormalized || null;

    const paymentLabel =
      paymentInfo?.label && paymentInfo.label !== 'N/A'
        ? (typeof paymentInfo.label === 'string'
            ? paymentInfo.label
            : paymentInfo.label.label || 'N/A')
        : orderData?.paymentMode ||
          orderData?.payment?.type ||
          orderData?.paymentSummary?.mode ||
          orderData?.paymentMethod ||
          'N/A';

    const paymentMethodCode =
      (normalizedPayment && normalizedPayment.code) ||
      orderData?.paymentMethod ||
      orderData?.paymentNormalized?.code ||
      null;

    let updatePayload = {
      status: 'Delivered',
      statusCode: 'DELIVERED',
      deliveredAt: nowIso,
      'statusTimestamps.deliveredAt': serverTimestamp(),
      timeline: arrayUnion({
        status: 'DELIVERED',
        by: { uid: distributorId, type: 'distributor' },
        at: nowIso,
      }),
      handledBy: {
        ...(orderData?.handledBy || {}),
        deliveredBy: { uid: distributorId, type: 'distributor' },
      },
      auditTrail: arrayUnion({
        at: nowIso,
        event: 'deliverOrder',
        by: { uid: distributorId, type: 'distributor' },
      }),
      policyVersion: ORDER_POLICY_VERSION,
      paymentUi: paymentLabel,
      paymentMode: paymentLabel,
      paymentNormalized: normalizedToStore,
      paymentFlags: mergedFlags,
    };

    if (paymentMethodCode) {
      updatePayload.paymentMethod = paymentMethodCode;
    }

    // Handle Credit Cycle / creditDueDate
    if (isCredit && Number.isFinite(creditDaysValue) && creditDaysValue > 0) {
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + creditDaysValue);
      updatePayload.creditDueDate = dueDate.toISOString();
      updatePayload.creditDays = creditDaysValue;
      updatePayload.isPaid = false;
      if (!updatePayload.paymentStatus) {
        updatePayload.paymentStatus = 'Payment Due';
      }
    }

    await updateDoc(distributorOrderRef, updatePayload);
    if (hasRetailer && retailerOrderRef) {
      await updateDoc(retailerOrderRef, updatePayload);
    }

    // ---------- Auto-create Distributor Invoice ----------
    try {
      const invoicesCol = collection(db, 'businesses', distributorId, 'invoices');
      const invoiceRef = doc(invoicesCol, orderId);
      const existingInvoiceSnap = await getDoc(invoiceRef);

      if (!existingInvoiceSnap.exists()) {
        // Fetch distributor profile for header info
        const distributorProfileSnap = await getDoc(doc(db, 'businesses', distributorId));
        const distributorProfile = distributorProfileSnap.exists()
          ? distributorProfileSnap.data()
          : {};

        const retailerInfo = {
          businessId: orderData.retailerId || null,
          businessName:
            orderData.retailerBusinessName ||
            orderData.retailerName ||
            (orderData.retailer && orderData.retailer.name) ||
            null,
          email:
            orderData.retailerEmail ||
            (orderData.retailer && orderData.retailer.email) ||
            null,
          phone:
            orderData.retailerPhone ||
            (orderData.retailer && orderData.retailer.phone) ||
            null,
          city: orderData.city || orderData.retailerCity || null,
          state: orderData.state || orderData.retailerState || null,
        };

        const distributorInfo = {
          businessId: distributorId,
          businessName:
            distributorProfile.businessName ||
            distributorProfile.ownerName ||
            distributorProfile.name ||
            null,
          email: distributorProfile.email || null,
          phone: distributorProfile.phone || null,
          city: distributorProfile.city || null,
          state: distributorProfile.state || null,
          gstNumber: distributorProfile.gstNumber || distributorProfile.gstin || null,
        };

        // Get full breakdown from chargesSnapshot or calculate it
        const breakdown = orderData?.chargesSnapshot?.breakdown;
        let invoiceTotals = {
          grandTotal: breakdown?.grandTotal 
            ? Number(breakdown.grandTotal)
            : sumOrderTotal(orderData),
        };

        // If we have a full breakdown, include all details
        if (breakdown) {
          invoiceTotals = {
            grossItems: Number(breakdown.grossItems || 0),
            lineDiscountTotal: Number(breakdown.lineDiscountTotal || 0),
            itemsSubTotal: Number(breakdown.itemsSubTotal || breakdown.subTotal || 0),
            delivery: Number(breakdown.delivery || 0),
            packing: Number(breakdown.packing || 0),
            insurance: Number(breakdown.insurance || 0),
            other: Number(breakdown.other || 0),
            discountTotal: Number(breakdown.discountTotal || 0),
            taxableBase: Number(breakdown.taxableBase || 0),
            taxType: breakdown.taxType || 'CGST_SGST',
            taxBreakup: breakdown.taxBreakup || {},
            roundOff: Number(breakdown.roundOff || 0),
            grandTotal: Number(breakdown.grandTotal || 0),
          };
        } else {
          // Calculate breakdown if not available
          const calculatedBreakdown = proformaPreviewFromOrder(orderData);
          invoiceTotals = {
            grossItems: calculatedBreakdown.grossItems,
            lineDiscountTotal: calculatedBreakdown.lineDiscountTotal,
            itemsSubTotal: calculatedBreakdown.itemsSubTotal,
            delivery: calculatedBreakdown.orderCharges.delivery,
            packing: calculatedBreakdown.orderCharges.packing,
            insurance: calculatedBreakdown.orderCharges.insurance,
            other: calculatedBreakdown.orderCharges.other,
            discountTotal: calculatedBreakdown.discountTotal,
            taxableBase: calculatedBreakdown.taxableBase,
            taxType: calculatedBreakdown.taxType,
            taxBreakup: calculatedBreakdown.taxBreakup,
            roundOff: calculatedBreakdown.roundOff,
            grandTotal: calculatedBreakdown.grandTotal,
          };
        }

        const invoiceNumber =
          orderData.invoiceNumber ||
          `INV-${(orderId || '').slice(-6).toUpperCase()}`;

        const invoiceDoc = {
          orderId,
          invoiceNumber,
          distributorId,
          retailerId: orderData.retailerId || null,
          buyer: retailerInfo,
          seller: distributorInfo,
          totals: invoiceTotals,
          payment: {
            mode: paymentLabel,
            flags: mergedFlags,
            normalized: normalizedToStore,
            isPaid: !!updatePayload.isPaid || updatePayload.paymentStatus === 'Paid',
          },
          issuedAt: nowIso,
          createdAt: serverTimestamp(),
          status: 'Issued',
          source: 'distributor-track-orders',
        };

        await setDoc(invoiceRef, invoiceDoc, { merge: true });
        console.log('[TrackOrders] Invoice created for order', orderId);
      }
    } catch (err) {
      console.error('[TrackOrders] Failed to create invoice for delivered order', orderId, err);
    }

    toast.success('📦 Order marked as Delivered!', {
      position: 'top-right',
      autoClose: 3000,
      icon: '🚚',
    });
  };

  // Confirm COD payment
  const confirmCODPayment = async (order) => {
    const user = auth.currentUser;
    if (!user) return;
    const distributorOrderRef = doc(db, 'businesses', user.uid, 'orderRequests', order.id);
    const retailerOrderRef = order.retailerId
      ? doc(db, 'businesses', order.retailerId, 'sentOrders', order.id)
      : null;

    const now = new Date();
    const nowIso = now.toISOString();
    const paymentInfo = paymentUi(order);
    const normalizedPayment = paymentInfo?.normalized || {};
    const mergedFlags = {
      ...(order?.paymentFlags || {}),
      ...Object.fromEntries(
        Object.entries(paymentInfo?.flags || {}).filter(([, v]) => typeof v === 'boolean')
      ),
    };
    const normalizedToStore =
      normalizedPayment && normalizedPayment.code
        ? { ...(order?.paymentNormalized || {}), ...normalizedPayment }
        : order?.paymentNormalized || null;
    const paymentLabel =
      typeof paymentInfo.label === 'string' && paymentInfo.label !== 'N/A'
        ? paymentInfo.label
        : order?.paymentMode ||
          order?.payment?.type ||
          order?.paymentSummary?.mode ||
          order?.paymentMethod ||
          'COD';
    const payload = {
      isPaid: true,
      paymentStatus: 'Paid',
      paidAt: nowIso,
      'statusTimestamps.paidAt': serverTimestamp(),
      timeline: arrayUnion({ status: 'PAID', by: { uid: user.uid, type: 'distributor' }, at: nowIso }),
      handledBy: {
        ...(order?.handledBy || {}),
        paidBy: { uid: user.uid, type: 'distributor' }
      },
      auditTrail: arrayUnion({ at: nowIso, event: 'recordPayment', by: { uid: user.uid, type: 'distributor' }, meta: { method: 'COD' } }),
      policyVersion: ORDER_POLICY_VERSION,
      paymentUi: paymentLabel,
      paymentMode: paymentLabel,
      paymentNormalized: normalizedToStore,
      paymentFlags: mergedFlags,
    };
    if (normalizedPayment && normalizedPayment.code) {
      payload.paymentMethod = normalizedPayment.code;
    }
    await updateDoc(distributorOrderRef, payload);
    if (retailerOrderRef) {
      await updateDoc(retailerOrderRef, payload);
    }
    toast.success('💰 Payment received marked (COD)');
  };

  // Guarded deliver action
  const getEditedCreditDays = (order) => {
    const v = creditDaysEdit[order.id];
    if (typeof v === 'number' && v > 0) return v;
    const paymentInfo = paymentUi(order);
    const normalizedPayment = paymentInfo?.normalized || {};
    return Number(
      normalizedPayment.creditDays ??
      order.creditDays ??
      order.payment?.creditDays ??
      order.paymentSummary?.creditDueDays ??
      order.payment?.creditDueDays ??
      15
    );
  };
  const guardedMarkDelivered = async (order) => {
    const paymentInfo = paymentUi(order);
    const paymentFlags = paymentInfo?.flags || {};
    const isCOD =
      paymentFlags.isCOD ||
      (typeof order.paymentMethod === 'string' && order.paymentMethod.toUpperCase() === 'COD');
    const isCredit =
      paymentFlags.isCredit ||
      paymentInfo?.normalized?.isCredit ||
      (typeof order.paymentMethod === 'string' && order.paymentMethod.toUpperCase().includes('CREDIT')) ||
      (order.paymentFlags && order.paymentFlags.isCredit === true);

    if (isCOD && !order.isPaid) {
      toast.info("For COD, please confirm 'Payment Received' first.");
      return;
    }
    if (isCredit) {
      const days = Number(getEditedCreditDays(order));
      if (!Number.isFinite(days) || days <= 0) {
        toast.error('Invalid credit days');
        return;
      }
      const user = auth.currentUser; if (!user) return;
      const distributorOrderRef = doc(db, 'businesses', user.uid, 'orderRequests', order.id);
      await updateDoc(distributorOrderRef, { creditDays: days });
      if (order.retailerId) {
        const retailerOrderRef = doc(db, 'businesses', order.retailerId, 'sentOrders', order.id);
        await updateDoc(retailerOrderRef, { creditDays: days });
      }
    }
    await markAsDelivered(order.id);
  };

  // ---------- Proforma-aware helpers ----------
  // Get the calculated base/unit price for display based on pricing mode
  const getDisplayBasePrice = (order, idx, item) => {
    const pricingMode = item.pricingMode || "LEGACY";
    const basePrice = Number(item.basePrice || 0);
    const mrp = Number(item.mrp || 0);
    const sellingPrice = Number(item.sellingPrice || item.price || item.unitPrice || 0);
    const baseGstRate = Number(item.gstRate || item.taxRate || 0);

    // Get proforma line if available
    const pLine = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
    const lineGstRate = pLine?.gstRate !== undefined ? Number(pLine.gstRate) : baseGstRate;

    if (pricingMode === "MRP_INCLUSIVE") {
      // MRP is final, calculate base from MRP
      if (mrp > 0 && lineGstRate > 0) {
        const split = splitFromMrp(mrp, lineGstRate);
        return split.base;
      }
      return mrp || sellingPrice;
    } else if (pricingMode === "SELLING_PRICE") {
      // Selling price is final (GST included), calculate base from it
      if (sellingPrice > 0 && lineGstRate > 0) {
        const split = splitFromMrp(sellingPrice, lineGstRate);
        return split.base;
      }
      return sellingPrice;
    } else if (pricingMode === "BASE_PLUS_TAX") {
      // Base price is explicit
      if (basePrice > 0) {
        return basePrice;
      }
      // Fallback: calculate from selling price if base is missing
      if (sellingPrice > 0 && lineGstRate > 0) {
        const split = splitFromMrp(sellingPrice, lineGstRate);
        return split.base;
      }
      return sellingPrice;
    } else {
      // LEGACY: use basePrice if available, otherwise sellingPrice
      return basePrice || sellingPrice;
    }
  };

  const getDisplayPrice = (order, idx, item) => {
    // Return the selling price (final price) for display
    const ln = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
    if (ln && ln.price != null) return Number(ln.price) || 0;
    const sellingPrice = Number(item.sellingPrice || item.price || 0);
    if (sellingPrice > 0) return sellingPrice;
    return Number(item?.price) || 0;
  };
  const getDisplaySubtotal = (order, idx, item) => {
    const ln = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
    if (ln && ln.gross != null) return Number(ln.gross) || 0;
    const qty = Number(item?.quantity) || 0;
    const price = getDisplayPrice(order, idx, item);
    return qty * price;
  };

  // ✅ prefer canonical grand total from chargesSnapshot if present
  const sumOrderTotal = (order) => {
    if (order?.chargesSnapshot?.breakdown?.grandTotal != null) return Number(order.chargesSnapshot.breakdown.grandTotal) || 0;
    if (order?.proforma?.grandTotal != null) return Number(order.proforma.grandTotal) || 0;
    return (order.items || []).reduce((acc, item, idx) => acc + getDisplaySubtotal(order, idx, item), 0);
  };

  // ---------- Shared Proforma Preview & Line Helpers (read-only) ----------
  const proformaPreviewFromOrder = (order) => {
    const b = order?.chargesSnapshot?.breakdown;
    if (b) {
      // Return full breakdown from chargesSnapshot
      return {
        grossItems: Number(b.grossItems || 0),
        lineDiscountTotal: Number(b.lineDiscountTotal || 0),
        itemsSubTotal: Number(b.itemsSubTotal || b.subTotal || 0),
        orderCharges: {
          delivery: Number(b.delivery || 0),
          packing: Number(b.packing || 0),
          insurance: Number(b.insurance || 0),
          other: Number(b.other || 0),
        },
        discountTotal: Number(b.discountTotal || 0),
        taxableBase: Number(b.taxableBase || 0),
        taxType: b.taxType || 'CGST_SGST',
        taxBreakup: b.taxBreakup || {},
        roundOff: Number(b.roundOff || 0),
        grandTotal: Number(b.grandTotal || 0),
      };
    }
    const items = Array.isArray(order?.items) ? order.items : [];
    const lines = items.map((it, idx) => ({
      qty: Number(it.quantity ?? it.qty ?? 0),
      price: Number(it.unitPrice ?? it.price ?? 0),
      itemDiscountPct: Number(order?.proforma?.lines?.[idx]?.itemDiscountPct ?? it.itemDiscountPct ?? 0),
      gstRate: Number(it.gstRate ?? order?.proforma?.lines?.[idx]?.gstRate ?? 0),
    }));
    const orderCharges = {
      delivery: Number(order?.chargesSnapshot?.breakdown?.delivery || order?.delivery || 0),
      packing: Number(order?.chargesSnapshot?.breakdown?.packing || order?.packing || 0),
      insurance: Number(order?.chargesSnapshot?.breakdown?.insurance || order?.insurance || 0),
      other: Number(order?.chargesSnapshot?.breakdown?.other || order?.other || 0),
      discountPct: Number(order?.chargesSnapshot?.breakdown?.discountPct || order?.orderDiscountPct || 0),
      discountAmt: Number(order?.chargesSnapshot?.breakdown?.discountAmt || order?.orderDiscountAmt || 0),
      discountChangedBy: order?.chargesSnapshot?.breakdown?.discountAmt ? "amt" : "pct",
    };
    const p = calculateProforma({
      lines,
      orderCharges,
      distributorState: order?.distributorState,
      retailerState: order?.retailerState || order?.state,
      roundingEnabled: !!order?.chargesSnapshot?.defaultsUsed?.roundEnabled,
      rounding: (order?.chargesSnapshot?.defaultsUsed?.roundRule || 'nearest').toUpperCase(),
    });
    return {
      grossItems: p.grossItems,
      lineDiscountTotal: p.lineDiscountTotal,
      itemsSubTotal: p.itemsSubTotal ?? p.subTotal,
      orderCharges: {
        delivery: Number(orderCharges.delivery || 0),
        packing: Number(orderCharges.packing || 0),
        insurance: Number(orderCharges.insurance || 0),
        other: Number(orderCharges.other || 0),
      },
      discountTotal: Number(p.discountTotal || 0),
      taxableBase: Number(p.taxableBase || 0),
      taxType: p.taxType || 'CGST_SGST',
      taxBreakup: p.taxBreakup || {},
      roundOff: Number(p.roundOff || 0),
      grandTotal: Number(p.grandTotal || 0),
    };
  };

  const getLineGross = (order, idx, item) => {
    const qty = Number(item?.quantity ?? 0);
    const price = getDisplayPrice(order, idx, item);
    return qty * price;
  };
  const getLineDiscountPct = (order, idx, item) => {
    const ln = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
    return Number(ln?.itemDiscountPct ?? item?.itemDiscountPct ?? 0);
  };
  const getLineDiscountAmt = (order, idx, item) => {
    const ln = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
    const gross = getLineGross(order, idx, item);
    const amt = ln?.discountAmount;
    if (amt != null) return Number(amt) || 0;
    const pct = getLineDiscountPct(order, idx, item);
    return +(gross * Math.max(0, Math.min(100, pct)) / 100);
  };
  const getLineNet = (order, idx, item) => getLineGross(order, idx, item) - getLineDiscountAmt(order, idx, item);

  // Split and filter sections...
  const searchText = searchQuery.toLowerCase();
  const matchesSearch = (order) =>
    order.id?.toLowerCase().includes(searchText) ||
    order.retailerName?.toLowerCase().includes(searchText) ||
    order.retailerEmail?.toLowerCase().includes(searchText) ||
    order.retailerPhone?.toLowerCase().includes(searchText) ||
    order.retailerAddress?.toLowerCase().includes(searchText) ||
    order.city?.toLowerCase().includes(searchText);
  const matchesDate = (order) =>
    filterDate ? order.expectedDeliveryDate?.slice(0, 10) === filterDate : true;

  const computeCreditDueDate = (order) => {
    if (order?.creditDueDate) return new Date(order.creditDueDate);
    const norm = paymentUi(order).normalized;
    const creditDays =
      (norm && Number(norm.creditDays)) ||
      (Number.isFinite(order?.creditDays) ? Number(order.creditDays) : null);
    if (order?.deliveredAt && Number.isFinite(creditDays)) {
      const d = new Date(order.deliveredAt);
      d.setDate(d.getDate() + Number(creditDays || 0));
      return d;
    }
    return null;
  };

  const outForDeliveryOrders = orders.filter((order) => {
    const sc = codeOf(order.statusCode || order.status);
    const isOFD = sc === 'SHIPPED' || sc === 'OUT_FOR_DELIVERY';
    return isOFD && matchesMode(order) && matchesSearch(order) && matchesDate(order);
  });

  const quotedOrders = orders.filter((order) => 
    (order.status === 'Quoted' || order.statusCode === 'QUOTED' || order.statusCode === 'PROFORMA_SENT') && 
    matchesMode(order) &&
    matchesSearch(order) && 
    matchesDate(order)
  );

  let paymentDueOrders = orders
    .filter((order) => {
      if (!matchesMode(order)) return false;
      if (!isCreditOrder(order)) return false; // robust credit detection (Active + Passive + legacy)
      if (order.isPaid === true || order.paymentStatus === 'Paid') return false;
      const due = computeCreditDueDate(order);
      return !!due && matchesSearch(order) && matchesDate(order);
    })
    .map((o) => ({ ...o, __dueDate: computeCreditDueDate(o) }))
    .sort((a, b) => a.__dueDate - b.__dueDate);

  let paidOrders = orders.filter(
    (order) => matchesMode(order) &&
               (order.isPaid === true || order.paymentStatus === 'Paid') &&
               matchesSearch(order) && matchesDate(order)
  );

  const paymentDueTotal = paymentDueOrders.reduce((acc, o) => acc + sumOrderTotal(o), 0);
  const paidOrdersTotal = paidOrders.reduce((acc, o) => acc + sumOrderTotal(o), 0);

  // Date formatting helpers
  const formatDateTime = (d) => {
    try { return new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});} catch { return 'N/A'; }
  };
  const formatDate = (d) => {
    try { return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'});} catch { return 'N/A'; }
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 text-white">
      <ToastContainer />
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">Track Orders</h2>
        <button
          type="button"
          onClick={goToInvoicesTab}
          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-white/10 border border-white/20 text-white hover:bg-white/15 hover:border-emerald-400/60 transition"
        >
          View Invoices
        </button>
      </div>

      {/* Filters */}
      <div className="sticky top-[72px] z-30 backdrop-blur-xl bg-[#0B0F14]/60 supports-[backdrop-filter]:bg-[#0B0F14]/50 border border-white/15 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 flex flex-col lg:flex-row lg:items-center gap-3 sm:gap-4">
        <input
          type="text"
          placeholder="Search by order ID, retailer, phone, email, etc."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 sm:px-4 py-2 rounded-lg w-full lg:w-1/2 bg-white/10 border border-white/15 placeholder-white/50 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60 text-sm"
        />
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 sm:px-4 py-2 rounded-lg bg-white/10 border border-white/15 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 text-sm"
        />
        {/* Mode filter */}
        <div className="ml-auto inline-flex rounded-full bg-white/5 border border-white/15 overflow-hidden backdrop-blur-xl">
          {['all','active','passive'].map((m, i) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={
                "px-3 py-2 font-medium text-xs transition focus:outline-none " +
                (i>0 ? "border-l border-white/10 " : "") +
                (mode===m ? "bg-cyan-400/25 text-cyan-200" : "text-white/70 hover:bg-white/5")
              }
            >
              {m[0].toUpperCase()+m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Section Toggle */}
      <div className="inline-flex rounded-full bg-white/5 border border-white/15 overflow-hidden mb-4 backdrop-blur-xl">
        <button onClick={() => setSectionAndHash('Out for Delivery')} className={"px-4 py-2 font-medium text-sm transition focus:outline-none " + (activeSection==='Out for Delivery' ? "bg-emerald-500/20 text-emerald-200" : "text-white/70 hover:bg-white/5")}>
          Out for Delivery ({outForDeliveryOrders.length})
        </button>
        <button onClick={() => setSectionAndHash('Payment Due')} className={"px-4 py-2 font-medium text-sm transition focus:outline-none border-l border-white/10 " + (activeSection==='Payment Due' ? "bg-amber-500/20 text-amber-200" : "text-white/70 hover:bg-white/5")}>
          Payment Due ({paymentDueOrders.length})
        </button>
        <button onClick={() => setSectionAndHash('Paid Orders')} className={"px-4 py-2 font-medium text-sm transition focus:outline-none border-l border-white/10 " + (activeSection==='Paid Orders' ? "bg-sky-500/20 text-sky-200" : "text-white/70 hover:bg-white/5")}>
          Paid Orders ({paidOrders.length})
        </button>
        <button onClick={() => setSectionAndHash('Quoted')} className={"px-4 py-2 font-medium text-sm transition focus:outline-none border-l border-white/10 " + (activeSection==='Quoted' ? "bg-amber-500/20 text-amber-200" : "text-white/70 hover:bg-white/5")}>
          Quoted ({quotedOrders.length})
        </button>
      </div>

      {paymentDueOrders.length === 0 && paidOrders.length === 0 && outForDeliveryOrders.length === 0 && quotedOrders.length === 0 ? (
        <p className="text-white/60 mt-8 text-center">No orders to track yet.</p>
      ) : (
        <>
          {/* -------------------- Out for Delivery -------------------- */}
          {activeSection === 'Out for Delivery' && (
            <div>
              <h3 className="text-lg font-semibold text-emerald-200 mb-2">🚚 Out for Delivery</h3>
              {outForDeliveryOrders.length === 0 ? (
                <div className="text-white/60 mb-6">No orders are currently out for delivery.</div>
              ) : (
                outForDeliveryOrders.map((order) => (
                  <div key={order.id} className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl overflow-hidden mb-4 transition hover:bg-white/10">
                    {/* header */}
                    <div className="flex justify-between items-center px-4 pt-4 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-white">{order.retailerBusinessName || order.retailerName || order.retailer?.name || 'N/A'}</span>
                        {isPassiveOrder(order) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-200 border border-amber-400/30">passive</span>
                        )}
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-sky-500/15 text-sky-200">{order.status}</span>
                    </div>
                    {/* subheader */}
                    <div className="flex flex-wrap gap-6 items-center text-sm text-white/60 px-4 pb-2">
                      <span><span className="font-medium text-white/80">Total:</span> ₹{sumOrderTotal(order).toFixed(2)}</span>
                      <span className="px-2 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium">Payment: {getPaymentLabel(order)}</span>
                      {isCreditOrder(order) && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-white/70 font-medium">Credit Days:</label>
                          <input
                            type="number"
                            min={1}
                            max={180}
                            className="w-16 px-2 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={getEditedCreditDays(order)}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setCreditDaysEdit((prev) => ({ ...prev, [order.id]: Number.isFinite(val) ? val : '' }));
                            }}
                          />
                          <span className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-200 text-[11px] font-medium">
                            Due if delivered today: {formatDate(duePreviewFromDays(getEditedCreditDays(order)))}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* actions */}
                    <div className="px-4 pb-2 flex flex-col md:flex-row gap-2">
                      {(order.paymentMethod === 'COD' || paymentUi(order).flags.isCOD) && !order.isPaid && (
                        <button onClick={() => confirmCODPayment(order)} className="rounded-lg px-4 py-2 font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-500 transition">
                          Confirm Payment Received
                        </button>
                      )}
                      <button
                        onClick={() => guardedMarkDelivered(order)}
                        className={`rounded-lg px-4 py-2 font-medium text-white transition ${(order.paymentMethod === 'COD' || paymentUi(order).flags.isCOD) && !order.isPaid ? 'bg-white/10 cursor-not-allowed' : 'bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-500'}`}
                        disabled={(order.paymentMethod === 'COD' || paymentUi(order).flags.isCOD) && !order.isPaid}
                      >
                        Mark Delivered
                      </button>
                    </div>

                    {/* expand/collapse */}
                    <div className="flex justify-end px-4 pb-2">
                      <button onClick={() => toggleOrder(order.id)} className="text-sm text-blue-600 hover:underline focus:outline-none">
                        {expandedOrderIds.includes(order.id) ? 'Hide Details' : 'Show Details'}
                      </button>
                    </div>

                    {/* details */}
                    {expandedOrderIds.includes(order.id) && (
                      <div className="p-4 space-y-2 text-sm">
                        {/* two columns of retailer info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold mb-1">At time of order</div>
                            <div className="font-medium text-white">{order.retailerBusinessName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-white/70">Owner: {order.ownerName || order.retailerOwnerName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-white/70">
                              {(() => {
                                const snapAddr = [order.retailerAddress, order.city, order.state].filter(Boolean).join(', ');
                                const current = currentRetailers[order.retailerId] || {};
                                const currAddr = [current.address, current.city, current.state].filter(Boolean).join(', ');
                                const conn = connectedRetailerMap[order.retailerId] || {};
                                const connAddr = [conn.address, conn.city, conn.state].filter(Boolean).join(', ');
                                return snapAddr || currAddr || connAddr || '—';
                              })()}
                            </div>
                          </div>
                          <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold mb-1">Current profile</div>
                            {(() => {
                              const current = currentRetailers[order.retailerId] || {};
                              const currentTitle = current.businessName || current.retailerName || current.ownerName || '—';
                              const currentOwner = current.ownerName || '—';
                              const currentAddress = [current.address, current.city, current.state].filter(Boolean).join(', ') || '—';
                              return (<><div className="font-medium text-white">{currentTitle}</div><div className="text-sm text-white/70">Owner: {currentOwner}</div><div className="text-sm text-white/70">{currentAddress}</div></>);
                            })()}
                          </div>
                        </div>

                        {/* Basic meta */}
                        <p><strong>Order ID:</strong> {order.id}</p>
                        <p><strong>Retailer Email:</strong> {order.retailerEmail || order.retailer?.email || currentRetailers[order.retailerId]?.email || connectedRetailerMap[order.retailerId]?.retailerEmail || 'N/A'}</p>
                        <p><strong>Retailer Phone:</strong> {order.retailerPhone || order.retailer?.phone || currentRetailers[order.retailerId]?.phone || connectedRetailerMap[order.retailerId]?.retailerPhone || 'N/A'}</p>
                        <p><strong>Payment Method:</strong> {getPaymentLabel(order)}</p>
                        <p><strong>Delivery Mode:</strong> {order.deliveryMode || 'N/A'}</p>

                        {/* ITEMS FIRST (with inline discount columns) */}
                        <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-3">
                          <h4 className="font-semibold mb-2">Items Ordered:</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full table-auto">
                              <thead className="bg-white/5">
                                <tr>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Product Details</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">SKU</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Brand</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Category</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Unit</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Base Price</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">MRP</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">GST %</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Selling Price</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-white/70">Qty</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Disc %</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Disc ₹</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Line Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(order.items || []).map((item, idx) => {
                                  const basePrice = getDisplayBasePrice(order, idx, item);
                                  const mrp = Number(item.mrp || 0);
                                  const sellingPrice = getDisplayPrice(order, idx, item);
                                  const gstRate = Number(item.gstRate || item.taxRate || 0);
                                  const pLine = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
                                  const displayGstRate = pLine?.gstRate !== undefined ? Number(pLine.gstRate) : gstRate;
                                  
                                  return (
                                    <tr key={idx} className="hover:bg-white/5 transition">
                                      <td className="px-2 py-2">
                                        <div className="font-medium">{item.productName || item.name || 'N/A'}</div>
                                        {item.hsnCode && (
                                          <div className="text-xs text-white/60 mt-0.5">HSN: {item.hsnCode}</div>
                                        )}
                                      </td>
                                      <td className="px-2 py-2">{item.sku || '—'}</td>
                                      <td className="px-2 py-2">{item.brand || '—'}</td>
                                      <td className="px-2 py-2">{item.category || '—'}</td>
                                      <td className="px-2 py-2 text-right">{item.unit || '—'}</td>
                                      <td className="px-2 py-2 text-right">
                                        {basePrice > 0 ? `₹${basePrice.toFixed(2)}` : '—'}
                                      </td>
                                      <td className="px-2 py-2 text-right">
                                        {mrp > 0 ? `₹${mrp.toFixed(2)}` : '—'}
                                      </td>
                                      <td className="px-2 py-2 text-right">
                                        {displayGstRate > 0 ? `${displayGstRate}%` : '—'}
                                      </td>
                                      <td className="px-2 py-2 text-right">
                                        <span className="font-semibold text-emerald-400">₹{sellingPrice.toFixed(2)}</span>
                                      </td>
                                      <td className="px-2 py-2 text-center">{item.quantity || item.qty || 0}</td>
                                      <td className="px-2 py-2 text-right">{getLineDiscountPct(order, idx, item).toFixed(2)}%</td>
                                      <td className="px-2 py-2 text-right">₹{getLineDiscountAmt(order, idx, item).toFixed(2)}</td>
                                      <td className="px-2 py-2 text-right">₹{getLineNet(order, idx, item).toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {(() => { 
                              const pv = proformaPreviewFromOrder(order);
                              const distributorState = order.distributorState || 'Maharashtra';
                              const retailerState = order.retailerState || order.state || distributorState;
                              const taxTypeLabel = pv.taxType === 'IGST'
                                ? `IGST (Interstate: ${distributorState} → ${retailerState})`
                                : `CGST + SGST (Intrastate: ${distributorState} → ${retailerState})`;
                              
                              return (
                                <div className="mt-2 space-y-1 text-sm text-white/80">
                                  <div className="flex justify-between"><span>Unit Price Total</span><span>₹{pv.grossItems.toFixed(2)}</span></div>
                                  <div className="flex justify-between"><span>− Line Discounts</span><span>₹{pv.lineDiscountTotal.toFixed(2)}</span></div>
                                  <div className="flex justify-between"><span>Items Sub‑Total</span><span>₹{pv.itemsSubTotal.toFixed(2)}</span></div>
                                  {pv.orderCharges.delivery > 0 && (
                                    <div className="flex justify-between"><span>+ Delivery</span><span>₹{pv.orderCharges.delivery.toFixed(2)}</span></div>
                                  )}
                                  {pv.orderCharges.packing > 0 && (
                                    <div className="flex justify-between"><span>+ Packing</span><span>₹{pv.orderCharges.packing.toFixed(2)}</span></div>
                                  )}
                                  {pv.orderCharges.insurance > 0 && (
                                    <div className="flex justify-between"><span>+ Insurance</span><span>₹{pv.orderCharges.insurance.toFixed(2)}</span></div>
                                  )}
                                  {pv.orderCharges.other > 0 && (
                                    <div className="flex justify-between"><span>+ Other</span><span>₹{pv.orderCharges.other.toFixed(2)}</span></div>
                                  )}
                                  {pv.discountTotal > 0 && (
                                    <div className="flex justify-between"><span>− Order Discount</span><span>₹{pv.discountTotal.toFixed(2)}</span></div>
                                  )}
                                  <div className="flex justify-between font-semibold"><span>Taxable Base</span><span>₹{pv.taxableBase.toFixed(2)}</span></div>
                                  <div className="flex justify-between"><span>Tax Type</span><span className="text-xs">{taxTypeLabel}</span></div>
                                  {pv.taxType === 'IGST' ? (
                                    <div className="flex justify-between"><span>IGST</span><span>₹{Number(pv.taxBreakup?.igst || 0).toFixed(2)}</span></div>
                                  ) : (
                                    <>
                                      <div className="flex justify-between"><span>CGST</span><span>₹{Number(pv.taxBreakup?.cgst || 0).toFixed(2)}</span></div>
                                      <div className="flex justify-between"><span>SGST</span><span>₹{Number(pv.taxBreakup?.sgst || 0).toFixed(2)}</span></div>
                                    </>
                                  )}
                                  {pv.roundOff !== 0 && (
                                    <div className="flex justify-between"><span>Round Off</span><span>₹{pv.roundOff.toFixed(2)}</span></div>
                                  )}
                                  <div className="flex justify-between font-semibold text-white border-t border-white/20 pt-1 mt-1"><span>Grand Total</span><span>₹{pv.grandTotal.toFixed(2)}</span></div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* THEN Proforma box (unchanged component, just moved below items) */}
                        {order?.proforma && (
                          <div className="mt-4">
                            <ProformaSummary
                              proforma={order.proforma}
                              distributorState={order.distributorState}
                              retailerState={order.retailerState || order.state}
                            />
                          </div>
                        )}

                        {/* Badges + actions */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={"px-2 py-1 rounded-full text-xs font-medium " + (isCreditOrder(order) ? 'bg-amber-500/15 text-amber-200' : 'bg-white/10 text-white/80')}>Payment: {getPaymentLabel(order)}</span>
                          <span className={"px-2 py-1 rounded-full text-xs font-medium " + (order.deliveryMode === 'Self Pickup' ? 'bg-emerald-500/15 text-emerald-200' : order.deliveryMode === 'Courier' ? 'bg-sky-500/15 text-sky-200' : 'bg-white/10 text-white/80')}>Delivery: {order.deliveryMode || 'N/A'}</span>
                          {order.status === 'Delivered' && (
                            <button
                              onClick={() => handleViewInvoice(order)}
                              disabled={loadingInvoice}
                              className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 transition disabled:opacity-50"
                            >
                              {loadingInvoice ? 'Loading...' : 'View Invoice'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* -------------------- Payment Due -------------------- */}
          {activeSection === 'Payment Due' && (
            <div>
              <h3 className="text-lg font-semibold text-amber-200 mb-2">📅 Payment Due</h3>
              {paymentDueOrders.length === 0 ? (
                <div className="text-white/60 mb-6">No payment due orders.</div>
              ) : (
                paymentDueOrders.map((order) => (
                  <div key={order.id} className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl overflow-hidden mb-4 transition hover:bg-white/10">
                    <div className="flex justify-between items-center px-4 pt-4 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-white">{order.retailerBusinessName || order.retailerName || order.retailer?.name || 'N/A'}</span>
                        {isPassiveOrder(order) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-200 border border-amber-400/30">passive</span>
                        )}
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-200">{order.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-6 items-center text-sm text-white/60 px-4 pb-2">
                      {order.deliveredAt && (<span><span className="font-medium text-white/80">Delivered:</span> {formatDate(order.deliveredAt)}</span>)}
                      {(order.creditDueDate || order.__dueDate) && (
                        <span className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-200 text-xs font-medium">
                          Credit Due Date: <span className="font-semibold">{formatDate(order.creditDueDate || order.__dueDate)}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex justify-end px-4 pb-2">
                      <button onClick={() => toggleOrder(order.id)} className="text-sm text-blue-600 hover:underline focus:outline-none">
                        {expandedOrderIds.includes(order.id) ? 'Hide Details' : 'Show Details'}
                      </button>
                    </div>

                    {expandedOrderIds.includes(order.id) && (
                      <div className="p-4 space-y-3 text-sm">
                        {/* credit header */}
                        <div className="flex flex-wrap items-center gap-3">
                          {order.deliveredAt && (<span><span className="font-medium text-white/80">Delivered:</span> {formatDate(order.deliveredAt)}</span>)}
                          {(order.creditDueDate || order.__dueDate) && (
                            <span className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-200 text-xs font-medium">
                              Credit Due Date: <span className="font-semibold">{formatDate(order.creditDueDate || order.__dueDate)}</span>
                            </span>
                          )}
                        </div>

                        {/* retailer info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold mb-1">At time of order</div>
                            <div className="font-medium text-white">{order.retailerBusinessName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-white/70">Owner: {order.ownerName || order.retailerOwnerName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-white/70">
                              {(() => {
                                const snapAddr = [order.retailerAddress, order.city, order.state].filter(Boolean).join(', ');
                                const current = currentRetailers[order.retailerId] || {};
                                const currAddr = [current.address, current.city, current.state].filter(Boolean).join(', ');
                                const conn = connectedRetailerMap[order.retailerId] || {};
                                const connAddr = [conn.address, conn.city, conn.state].filter(Boolean).join(', ');
                                return snapAddr || currAddr || connAddr || '—';
                              })()}
                            </div>
                          </div>
                          <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold mb-1">Current profile</div>
                            {(() => {
                              const current = currentRetailers[order.retailerId] || {};
                              const currentTitle = current.businessName || current.retailerName || current.ownerName || '—';
                              const currentOwner = current.ownerName || '—';
                              const currentAddress = [current.address, current.city, current.state].filter(Boolean).join(', ') || '—';
                              return (<><div className="font-medium text-white">{currentTitle}</div><div className="text-sm text-white/70">Owner: {currentOwner}</div><div className="text-sm text-white/70">{currentAddress}</div></>);
                            })()}
                          </div>
                        </div>

                        {/* order meta */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <p><strong>Order ID:</strong> {order.id}</p>
                          <p><strong>Payment Method:</strong> {getPaymentLabel(order)}</p>
                          <p><strong>Retailer Email:</strong> {order.retailerEmail || order.retailer?.email || currentRetailers[order.retailerId]?.email || connectedRetailerMap[order.retailerId]?.retailerEmail || 'N/A'}</p>
                          <p><strong>Retailer Phone:</strong> {order.retailerPhone || order.retailer?.phone || currentRetailers[order.retailerId]?.phone || connectedRetailerMap[order.retailerId]?.retailerPhone || 'N/A'}</p>
                          <p><strong>Delivery Mode:</strong> {order.deliveryMode || 'N/A'}</p>
                          {order.deliveredAt && (<p><strong>Delivered On:</strong> {formatDateTime(order.deliveredAt)}</p>)}
                        </div>

                        {/* ITEMS FIRST */}
                        <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-3">
                          <h4 className="font-semibold mb-2">Items Ordered:</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full table-auto">
                              <thead className="bg-white/5">
                                <tr>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Product Details</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">SKU</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Brand</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Category</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Unit</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Base Price</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">MRP</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">GST %</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Selling Price</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-white/70">Qty</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Disc %</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Disc ₹</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Line Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(order.items || []).map((item, idx) => (
                                  <tr key={idx} className="hover:bg-white/5 transition">
                                    <td className="px-2 py-2">
                                      <div className="font-medium">{item.productName || item.name || 'N/A'}</div>
                                      {item.hsnCode && (
                                        <div className="text-xs text-white/60 mt-0.5">HSN: {item.hsnCode}</div>
                                      )}
                                    </td>
                                    <td className="px-2 py-2">{item.sku || '—'}</td>
                                    <td className="px-2 py-2">{item.brand || '—'}</td>
                                    <td className="px-2 py-2">{item.category || '—'}</td>
                                    <td className="px-2 py-2 text-right">{item.unit || '—'}</td>
                                    <td className="px-2 py-2 text-right">
                                      {(() => {
                                        const basePrice = getDisplayBasePrice(order, idx, item);
                                        return basePrice > 0 ? `₹${basePrice.toFixed(2)}` : '—';
                                      })()}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                      {item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                      {(() => {
                                        const gstRate = Number(item.gstRate || item.taxRate || 0);
                                        const pLine = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
                                        const displayGstRate = pLine?.gstRate !== undefined ? Number(pLine.gstRate) : gstRate;
                                        return displayGstRate > 0 ? `${displayGstRate}%` : '—';
                                      })()}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                      <span className="font-semibold text-emerald-400">₹{getDisplayPrice(order, idx, item).toFixed(2)}</span>
                                    </td>
                                    <td className="px-2 py-2 text-center">{item.quantity || item.qty || 0}</td>
                                    <td className="px-2 py-2 text-right">{getLineDiscountPct(order, idx, item).toFixed(2)}%</td>
                                    <td className="px-2 py-2 text-right">₹{getLineDiscountAmt(order, idx, item).toFixed(2)}</td>
                                    <td className="px-2 py-2 text-right">₹{getLineNet(order, idx, item).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {(() => { 
                              const pv = proformaPreviewFromOrder(order);
                              const distributorState = order.distributorState || 'Maharashtra';
                              const retailerState = order.retailerState || order.state || distributorState;
                              const taxTypeLabel = pv.taxType === 'IGST'
                                ? `IGST (Interstate: ${distributorState} → ${retailerState})`
                                : `CGST + SGST (Intrastate: ${distributorState} → ${retailerState})`;
                              
                              return (
                                <div className="mt-2 space-y-1 text-sm text-white/80">
                                  <div className="flex justify-between"><span>Unit Price Total</span><span>₹{pv.grossItems.toFixed(2)}</span></div>
                                  <div className="flex justify-between"><span>− Line Discounts</span><span>₹{pv.lineDiscountTotal.toFixed(2)}</span></div>
                                  <div className="flex justify-between"><span>Items Sub‑Total</span><span>₹{pv.itemsSubTotal.toFixed(2)}</span></div>
                                  {pv.orderCharges.delivery > 0 && (
                                    <div className="flex justify-between"><span>+ Delivery</span><span>₹{pv.orderCharges.delivery.toFixed(2)}</span></div>
                                  )}
                                  {pv.orderCharges.packing > 0 && (
                                    <div className="flex justify-between"><span>+ Packing</span><span>₹{pv.orderCharges.packing.toFixed(2)}</span></div>
                                  )}
                                  {pv.orderCharges.insurance > 0 && (
                                    <div className="flex justify-between"><span>+ Insurance</span><span>₹{pv.orderCharges.insurance.toFixed(2)}</span></div>
                                  )}
                                  {pv.orderCharges.other > 0 && (
                                    <div className="flex justify-between"><span>+ Other</span><span>₹{pv.orderCharges.other.toFixed(2)}</span></div>
                                  )}
                                  {pv.discountTotal > 0 && (
                                    <div className="flex justify-between"><span>− Order Discount</span><span>₹{pv.discountTotal.toFixed(2)}</span></div>
                                  )}
                                  <div className="flex justify-between font-semibold"><span>Taxable Base</span><span>₹{pv.taxableBase.toFixed(2)}</span></div>
                                  <div className="flex justify-between"><span>Tax Type</span><span className="text-xs">{taxTypeLabel}</span></div>
                                  {pv.taxType === 'IGST' ? (
                                    <div className="flex justify-between"><span>IGST</span><span>₹{Number(pv.taxBreakup?.igst || 0).toFixed(2)}</span></div>
                                  ) : (
                                    <>
                                      <div className="flex justify-between"><span>CGST</span><span>₹{Number(pv.taxBreakup?.cgst || 0).toFixed(2)}</span></div>
                                      <div className="flex justify-between"><span>SGST</span><span>₹{Number(pv.taxBreakup?.sgst || 0).toFixed(2)}</span></div>
                                    </>
                                  )}
                                  {pv.roundOff !== 0 && (
                                    <div className="flex justify-between"><span>Round Off</span><span>₹{pv.roundOff.toFixed(2)}</span></div>
                                  )}
                                  <div className="flex justify-between font-semibold text-white border-t border-white/20 pt-1 mt-1"><span>Grand Total</span><span>₹{pv.grandTotal.toFixed(2)}</span></div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Proforma summary AFTER items */}
                        {order?.proforma && (
                          <div className="mt-4">
                            <ProformaSummary
                              proforma={order.proforma}
                              distributorState={order.distributorState}
                              retailerState={order.retailerState || order.state}
                            />
                          </div>
                        )}

                        {/* action */}
                        <div className="mt-4 flex flex-col md:flex-row gap-2 items-center">
                          <button
                            onClick={async () => {
                              const user = auth.currentUser; if (!user) return;
                              const distributorOrderRef = doc(db, 'businesses', user.uid, 'orderRequests', order.id);
                              const payload = {
                                isPaid: true,
                                paymentStatus: 'Paid',
                                paidAt: new Date().toISOString(),
                                'statusTimestamps.paidAt': serverTimestamp(),
                                timeline: arrayUnion({ status: 'PAID', by: { uid: user.uid, type: 'distributor' }, at: serverTimestamp() }),
                                auditTrail: arrayUnion({ at: new Date().toISOString(), event: 'recordPayment', by: { uid: user.uid, type: 'distributor' }, meta: { method: 'CREDIT' } })
                              };
                              await updateDoc(distributorOrderRef, payload);
                              if (order.retailerId) {
                                const retailerOrderRef = doc(db, 'businesses', order.retailerId, 'sentOrders', order.id);
                                await updateDoc(retailerOrderRef, payload);
                              }
                              toast.success('✅ Credit payment marked as received!');
                            }}
                            className="rounded-lg px-4 py-2 font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-500 transition"
                          >
                            Mark Credit as Paid
                          </button>
                          {order.status === 'Delivered' && (
                            <button
                              onClick={() => handleViewInvoice(order)}
                              disabled={loadingInvoice}
                              className="rounded-lg px-4 py-2 font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-500 transition disabled:opacity-50"
                            >
                              {loadingInvoice ? 'Loading...' : 'View Invoice'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* -------------------- Paid Orders -------------------- */}
          {activeSection === 'Paid Orders' && (
            <div>
              <h3 className="text-lg font-semibold text-emerald-200 mb-2">✅ Paid Orders</h3>
              {paidOrders.length === 0 ? (
                <div className="text-white/60 mb-6">No paid orders.</div>
              ) : (
                paidOrders.map((order) => (
                  <div key={order.id} className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl overflow-hidden mb-4 transition hover:bg-white/10">
                    {/* header */}
                    <div className="flex justify-between items-center px-4 pt-4 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-white">{order.retailerBusinessName || order.retailerName || order.retailer?.name || 'N/A'}</span>
                        {isPassiveOrder(order) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-200 border border-amber-400/30">passive</span>
                        )}
                      </div>
                      <span className={"px-2 py-1 rounded-full text-xs font-medium " + (order.status === 'Delivered' ? "bg-emerald-500/15 text-emerald-200" : order.status === 'Shipped' ? "bg-sky-500/15 text-sky-200" : order.status === 'Accepted' ? "bg-amber-500/15 text-amber-200" : "bg-white/10 text-white/80")}>{order.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-6 items-center text-sm text-white/60 px-4 pb-2">
                      <span><span className="font-medium text-white/80">City:</span> {order.city || connectedRetailerMap[order.retailerId]?.city || currentRetailers[order.retailerId]?.city || "—"}</span>
                      {order.deliveredAt && (<span><span className="font-medium text-white/80">Delivered:</span> {formatDate(order.deliveredAt)}</span>)}
                      <span><span className="font-medium text-white/80">Total:</span> ₹{sumOrderTotal(order).toFixed(2)}</span>
                    </div>

                    <div className="px-4 pb-2">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const steps = ['Requested', 'Accepted', 'Shipped', 'Delivered, Paid'];
                          const baseStatuses = ['Requested', 'Accepted', 'Shipped', 'Delivered'];
                          let statusIndex = baseStatuses.indexOf(order.status);
                          if (order.isPaid || order.paymentStatus === 'Paid') statusIndex = 3; // collapse Paid with Delivered badge above
                          return steps.map((step, index) => {
                            const isCompleted = index < statusIndex;
                            const isActive = index === statusIndex;
                            return (
                              <div key={step} className={`flex items-center gap-1 ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-600' : isCompleted ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                                <span className="text-xs">{step}</span>
                                {index !== 3 && <div className="w-6 h-px bg-gray-200"></div>}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* expand/collapse */}
                    <div className="flex justify-end px-4 pb-2">
                      <button onClick={() => toggleOrder(order.id)} className="text-sm text-blue-600 hover:underline focus:outline-none">
                        {expandedOrderIds.includes(order.id) ? 'Hide Details' : 'Show Details'}
                      </button>
                    </div>

                    {expandedOrderIds.includes(order.id) && (
                      <div className="p-4 space-y-2 text-sm">
                        {/* retailer info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold mb-1">At time of order</div>
                            <div className="font-medium text-white">{order.retailerBusinessName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-white/70">Owner: {order.ownerName || order.retailerOwnerName || order.retailerName || 'N/A'}</div>
                            <div className="text-sm text-white/70">
                              {(() => {
                                const snapAddr = [order.retailerAddress, order.city, order.state].filter(Boolean).join(', ');
                                const current = currentRetailers[order.retailerId] || {};
                                const currAddr = [current.address, current.city, current.state].filter(Boolean).join(', ');
                                const conn = connectedRetailerMap[order.retailerId] || {};
                                const connAddr = [conn.address, conn.city, conn.state].filter(Boolean).join(', ');
                                return snapAddr || currAddr || connAddr || '—';
                              })()}
                            </div>
                          </div>
                          <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                            <div className="text-[10px] uppercase tracking-wide text-white/60 font-semibold mb-1">Current profile</div>
                            {(() => {
                              const current = currentRetailers[order.retailerId] || {};
                              const currentTitle = current.businessName || current.retailerName || current.ownerName || '—';
                              const currentOwner = current.ownerName || '—';
                              const currentAddress = [current.address, current.city, current.state].filter(Boolean).join(', ') || '—';
                              return (<><div className="font-medium text-white">{currentTitle}</div><div className="text-sm text-white/70">Owner: {currentOwner}</div><div className="text-sm text-white/70">{currentAddress}</div></>);
                            })()}
                          </div>
                        </div>

                        <p><strong>Order ID:</strong> {order.id}</p>
                        <p><strong>Retailer Email:</strong> {order.retailerEmail || order.retailer?.email || currentRetailers[order.retailerId]?.email || connectedRetailerMap[order.retailerId]?.retailerEmail || 'N/A'}</p>
                        <p><strong>Retailer Phone:</strong> {order.retailerPhone || order.retailer?.phone || currentRetailers[order.retailerId]?.phone || connectedRetailerMap[order.retailerId]?.retailerPhone || 'N/A'}</p>
                        <p><strong>Payment Method:</strong> {getPaymentLabel(order)}</p>
                        <p><strong>Delivery Mode:</strong> {order.deliveryMode || 'N/A'}</p>
                        {order.deliveredAt && (<p><strong>Delivered On:</strong> {formatDateTime(order.deliveredAt)}</p>)}

                        {/* export buttons */}
                        <div className="flex gap-2 mb-2">
                          <button className="rounded-lg px-4 py-2 font-medium bg-blue-600 text-white text-xs hover:bg-blue-700 transition" onClick={() => exportCSV(order)}>Export CSV</button>
                          <button className="rounded-lg px-4 py-2 font-medium bg-green-600 text-white text-xs hover:bg-green-700 transition" onClick={() => exportExcel(order)}>Export Excel</button>
                          <button className="rounded-lg px-4 py-2 font-medium bg-red-500 text-white text-xs hover:bg-red-600 transition" onClick={() => exportPDF(order)}>Export PDF</button>
                        </div>

                        {/* ITEMS FIRST */}
                        <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-3">
                          <h4 className="font-semibold mb-2">Items Ordered:</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full table-auto">
                              <thead className="bg-white/5">
                                <tr>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Product Details</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">SKU</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Brand</th>
                                  <th className="px-2 py-2 text-left text-xs font-semibold text-white/70">Category</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Unit</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Base Price</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">MRP</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">GST %</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Selling Price</th>
                                  <th className="px-2 py-2 text-center text-xs font-semibold text-white/70">Qty</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Disc %</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Disc ₹</th>
                                  <th className="px-2 py-2 text-right text-xs font-semibold text-white/70">Line Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(order.items || []).map((item, idx) => (
                                  <tr key={idx} className="hover:bg-white/5 transition">
                                    <td className="px-2 py-2">
                                      <div className="font-medium">{item.productName || item.name || 'N/A'}</div>
                                      {item.hsnCode && (
                                        <div className="text-xs text-white/60 mt-0.5">HSN: {item.hsnCode}</div>
                                      )}
                                    </td>
                                    <td className="px-2 py-2">{item.sku || '—'}</td>
                                    <td className="px-2 py-2">{item.brand || '—'}</td>
                                    <td className="px-2 py-2">{item.category || '—'}</td>
                                    <td className="px-2 py-2 text-right">{item.unit || '—'}</td>
                                    <td className="px-2 py-2 text-right">
                                      {(() => {
                                        const basePrice = getDisplayBasePrice(order, idx, item);
                                        return basePrice > 0 ? `₹${basePrice.toFixed(2)}` : '—';
                                      })()}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                      {item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                      {(() => {
                                        const gstRate = Number(item.gstRate || item.taxRate || 0);
                                        const pLine = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[idx] : undefined;
                                        const displayGstRate = pLine?.gstRate !== undefined ? Number(pLine.gstRate) : gstRate;
                                        return displayGstRate > 0 ? `${displayGstRate}%` : '—';
                                      })()}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                      <span className="font-semibold text-emerald-400">₹{getDisplayPrice(order, idx, item).toFixed(2)}</span>
                                    </td>
                                    <td className="px-2 py-2 text-center">{item.quantity || item.qty || 0}</td>
                                    <td className="px-2 py-2 text-right">{getLineDiscountPct(order, idx, item).toFixed(2)}%</td>
                                    <td className="px-2 py-2 text-right">₹{getLineDiscountAmt(order, idx, item).toFixed(2)}</td>
                                    <td className="px-2 py-2 text-right">₹{getLineNet(order, idx, item).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {(() => { 
                              const pv = proformaPreviewFromOrder(order);
                              const distributorState = order.distributorState || 'Maharashtra';
                              const retailerState = order.retailerState || order.state || distributorState;
                              const taxTypeLabel = pv.taxType === 'IGST'
                                ? `IGST (Interstate: ${distributorState} → ${retailerState})`
                                : `CGST + SGST (Intrastate: ${distributorState} → ${retailerState})`;
                              
                              return (
                                <div className="mt-2 space-y-1 text-sm text-white/80">
                                  <div className="flex justify-between"><span>Unit Price Total</span><span>₹{pv.grossItems.toFixed(2)}</span></div>
                                  <div className="flex justify-between"><span>− Line Discounts</span><span>₹{pv.lineDiscountTotal.toFixed(2)}</span></div>
                                  <div className="flex justify-between"><span>Items Sub‑Total</span><span>₹{pv.itemsSubTotal.toFixed(2)}</span></div>
                                  {pv.orderCharges.delivery > 0 && (
                                    <div className="flex justify-between"><span>+ Delivery</span><span>₹{pv.orderCharges.delivery.toFixed(2)}</span></div>
                                  )}
                                  {pv.orderCharges.packing > 0 && (
                                    <div className="flex justify-between"><span>+ Packing</span><span>₹{pv.orderCharges.packing.toFixed(2)}</span></div>
                                  )}
                                  {pv.orderCharges.insurance > 0 && (
                                    <div className="flex justify-between"><span>+ Insurance</span><span>₹{pv.orderCharges.insurance.toFixed(2)}</span></div>
                                  )}
                                  {pv.orderCharges.other > 0 && (
                                    <div className="flex justify-between"><span>+ Other</span><span>₹{pv.orderCharges.other.toFixed(2)}</span></div>
                                  )}
                                  {pv.discountTotal > 0 && (
                                    <div className="flex justify-between"><span>− Order Discount</span><span>₹{pv.discountTotal.toFixed(2)}</span></div>
                                  )}
                                  <div className="flex justify-between font-semibold"><span>Taxable Base</span><span>₹{pv.taxableBase.toFixed(2)}</span></div>
                                  <div className="flex justify-between"><span>Tax Type</span><span className="text-xs">{taxTypeLabel}</span></div>
                                  {pv.taxType === 'IGST' ? (
                                    <div className="flex justify-between"><span>IGST</span><span>₹{Number(pv.taxBreakup?.igst || 0).toFixed(2)}</span></div>
                                  ) : (
                                    <>
                                      <div className="flex justify-between"><span>CGST</span><span>₹{Number(pv.taxBreakup?.cgst || 0).toFixed(2)}</span></div>
                                      <div className="flex justify-between"><span>SGST</span><span>₹{Number(pv.taxBreakup?.sgst || 0).toFixed(2)}</span></div>
                                    </>
                                  )}
                                  {pv.roundOff !== 0 && (
                                    <div className="flex justify-between"><span>Round Off</span><span>₹{pv.roundOff.toFixed(2)}</span></div>
                                  )}
                                  <div className="flex justify-between font-semibold text-white border-t border-white/20 pt-1 mt-1"><span>Grand Total</span><span>₹{pv.grandTotal.toFixed(2)}</span></div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Proforma AFTER items */}
                        {order?.proforma && (
                          <div className="mt-4">
                            <ProformaSummary
                              proforma={order.proforma}
                              distributorState={order.distributorState}
                              retailerState={order.retailerState || order.state}
                            />
                          </div>
                        )}

                        {/* View Invoice button for paid orders */}
                        {order.status === 'Delivered' && (
                          <div className="mt-4">
                            <button
                              onClick={() => handleViewInvoice(order)}
                              disabled={loadingInvoice}
                              className="rounded-lg px-4 py-2 font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-500 transition disabled:opacity-50"
                            >
                              {loadingInvoice ? 'Loading...' : 'View Invoice'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* -------------------- Quoted -------------------- */}
          {activeSection === 'Quoted' && (
            <div>
              <h3 className="text-lg font-semibold text-amber-200 mb-2">🧾 Quoted (Proforma Sent)</h3>
              {quotedOrders.length === 0 ? (
                <div className="text-white/60 mb-6">No quoted orders.</div>
              ) : (
                quotedOrders.map((order) => (
                  <div key={order.id} className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl overflow-hidden mb-4 transition hover:bg-white/10">
                    <div className="flex justify-between items-center px-4 pt-4 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-white">{order.retailerBusinessName || order.retailerName || order.retailer?.name || 'N/A'}</span>
                        {isPassiveOrder(order) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-200 border border-amber-400/30">passive</span>
                        )}
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-200">{order.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-6 items-center text-sm text-white/60 px-4 pb-2">
                      <span><span className="font-medium text-white/80">Total:</span> ₹{(Array.isArray(order.items) ? order.items.reduce((s,it)=>s + (Number(it.quantity||0)*Number(it.price||it.unitPrice||0)),0) : 0).toFixed(2)}</span>
                      <span className="px-2 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium">Awaiting retailer acceptance</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Invoice View Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center p-4">
          <div className="bg-[#1a1f2e] rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
            {/* Header */}
            <div className="sticky top-0 bg-[#1a1f2e] border-b border-white/10 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Invoice Details</h2>
              <button
                onClick={closeInvoiceModal}
                className="text-white/70 hover:text-white text-2xl font-bold transition"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 text-white">
              {/* Invoice Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-white/60">Invoice Number</p>
                  <p className="font-semibold text-lg text-white">{selectedInvoice.invoiceNumber || selectedInvoice.id}</p>
                </div>
                <div>
                  <p className="text-sm text-white/60">Issued Date</p>
                  <p className="font-semibold text-white">
                    {selectedInvoice.issuedAt
                      ? new Date(selectedInvoice.issuedAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Buyer and Seller Info */}
              <div className="grid grid-cols-2 gap-6 border-t border-white/10 pt-4">
                <div>
                  <h3 className="font-semibold text-white mb-2">Bill To (Buyer)</h3>
                  <div className="text-sm text-white/70 space-y-1">
                    <p className="font-medium text-white">{selectedInvoice.buyer?.businessName || "N/A"}</p>
                    {selectedInvoice.buyer?.email && <p>Email: {selectedInvoice.buyer.email}</p>}
                    {selectedInvoice.buyer?.phone && <p>Phone: {selectedInvoice.buyer.phone}</p>}
                    {(selectedInvoice.buyer?.city || selectedInvoice.buyer?.state) && (
                      <p>
                        {[selectedInvoice.buyer.city, selectedInvoice.buyer.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Sold By (Seller)</h3>
                  <div className="text-sm text-white/70 space-y-1">
                    <p className="font-medium text-white">{selectedInvoice.seller?.businessName || "N/A"}</p>
                    {selectedInvoice.seller?.email && <p>Email: {selectedInvoice.seller.email}</p>}
                    {selectedInvoice.seller?.phone && <p>Phone: {selectedInvoice.seller.phone}</p>}
                    {selectedInvoice.seller?.gstNumber && <p>GST: {selectedInvoice.seller.gstNumber}</p>}
                    {(selectedInvoice.seller?.city || selectedInvoice.seller?.state) && (
                      <p>
                        {[selectedInvoice.seller.city, selectedInvoice.seller.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Items */}
              {orderDataForInvoice ? (
                <div className="border-t border-white/10 pt-4">
                  <h3 className="font-semibold text-white mb-4">Order Items</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="px-4 py-2 text-left text-white/70">Product Details</th>
                          <th className="px-4 py-2 text-left text-white/70">SKU</th>
                          <th className="px-4 py-2 text-left text-white/70">Brand</th>
                          <th className="px-4 py-2 text-left text-white/70">Category</th>
                          <th className="px-4 py-2 text-right text-white/70">Unit</th>
                          <th className="px-4 py-2 text-right text-white/70">Base Price</th>
                          <th className="px-4 py-2 text-right text-white/70">MRP</th>
                          <th className="px-4 py-2 text-right text-white/70">GST %</th>
                          <th className="px-4 py-2 text-right text-white/70">Selling Price</th>
                          <th className="px-4 py-2 text-center text-white/70">Qty</th>
                          <th className="px-4 py-2 text-right text-white/70">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(orderDataForInvoice.items || []).map((item, idx) => {
                          const qty = Number(item.quantity || item.qty || 0);
                          const price = getDisplayPrice(orderDataForInvoice, idx, item);
                          const total = getDisplaySubtotal(orderDataForInvoice, idx, item);
                          return (
                            <tr key={idx} className="border-b border-white/10">
                              <td className="px-4 py-2 text-white">
                                <div className="font-medium">{item.productName || item.name || "N/A"}</div>
                                {item.hsnCode && (
                                  <div className="text-xs text-white/60 mt-0.5">HSN: {item.hsnCode}</div>
                                )}
                              </td>
                              <td className="px-4 py-2 text-white/70">{item.sku || "—"}</td>
                              <td className="px-4 py-2 text-white/70">{item.brand || "—"}</td>
                              <td className="px-4 py-2 text-white/70">{item.category || "—"}</td>
                              <td className="px-4 py-2 text-right text-white/70">{item.unit || "—"}</td>
                              <td className="px-4 py-2 text-right text-white/70">
                                {(() => {
                                  const basePrice = getDisplayBasePrice(orderDataForInvoice, idx, item);
                                  return basePrice > 0 ? `₹${basePrice.toFixed(2)}` : "—";
                                })()}
                              </td>
                              <td className="px-4 py-2 text-right text-white/70">
                                {item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : "—"}
                              </td>
                              <td className="px-4 py-2 text-right text-white/70">
                                {(() => {
                                  const gstRate = Number(item.gstRate || item.taxRate || 0);
                                  const pLine = Array.isArray(orderDataForInvoice?.proforma?.lines) ? orderDataForInvoice.proforma.lines[idx] : undefined;
                                  const displayGstRate = pLine?.gstRate !== undefined ? Number(pLine.gstRate) : gstRate;
                                  return displayGstRate > 0 ? `${displayGstRate}%` : "—";
                                })()}
                              </td>
                              <td className="px-4 py-2 text-right text-white">
                                <span className="font-semibold text-emerald-400">₹{price.toFixed(2)}</span>
                              </td>
                              <td className="px-4 py-2 text-center text-white">{qty}</td>
                              <td className="px-4 py-2 text-right text-white">
                                <span className="font-semibold">₹{total.toFixed(2)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="border-t border-white/10 pt-4">
                  <p className="text-white/60 text-sm">
                    {selectedInvoice.orderId
                      ? "Order data not available"
                      : "No order ID associated with this invoice"}
                  </p>
                </div>
              )}

              {/* Payment and Totals */}
              <div className="border-t border-white/10 pt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Payment Method:</span>
                  <span className="font-semibold text-white">
                    {selectedInvoice.payment?.mode || selectedInvoice.payment?.normalized?.label || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Payment Status:</span>
                  <span
                    className={`font-semibold ${
                      selectedInvoice.payment?.isPaid ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {selectedInvoice.payment?.isPaid ? "Paid" : "Pending"}
                  </span>
                </div>

                {/* Full Breakdown */}
                {selectedInvoice.totals && (
                  <div className="border-t border-white/10 pt-4">
                    <h4 className="font-semibold mb-3 text-white">Invoice Breakdown</h4>
                    <div className="space-y-1 text-sm text-white/80">
                      {selectedInvoice.totals.grossItems !== undefined && (
                        <div className="flex justify-between"><span>Unit Price Total</span><span>₹{Number(selectedInvoice.totals.grossItems || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.lineDiscountTotal !== undefined && (
                        <div className="flex justify-between"><span>− Line Discounts</span><span>₹{Number(selectedInvoice.totals.lineDiscountTotal || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.itemsSubTotal !== undefined && (
                        <div className="flex justify-between"><span>Items Sub‑Total</span><span>₹{Number(selectedInvoice.totals.itemsSubTotal || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.delivery > 0 && (
                        <div className="flex justify-between"><span>+ Delivery</span><span>₹{Number(selectedInvoice.totals.delivery || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.packing > 0 && (
                        <div className="flex justify-between"><span>+ Packing</span><span>₹{Number(selectedInvoice.totals.packing || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.insurance > 0 && (
                        <div className="flex justify-between"><span>+ Insurance</span><span>₹{Number(selectedInvoice.totals.insurance || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.other > 0 && (
                        <div className="flex justify-between"><span>+ Other</span><span>₹{Number(selectedInvoice.totals.other || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.discountTotal > 0 && (
                        <div className="flex justify-between"><span>− Order Discount</span><span>₹{Number(selectedInvoice.totals.discountTotal || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.taxableBase !== undefined && (
                        <div className="flex justify-between font-semibold"><span>Taxable Base</span><span>₹{Number(selectedInvoice.totals.taxableBase || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.taxType && (
                        <div className="flex justify-between">
                          <span>Tax Type</span>
                          <span className="text-xs">
                            {selectedInvoice.totals.taxType === 'IGST'
                              ? `IGST (Interstate)`
                              : `CGST + SGST (Intrastate)`}
                          </span>
                        </div>
                      )}
                      {selectedInvoice.totals.taxType === 'IGST' && selectedInvoice.totals.taxBreakup?.igst !== undefined && (
                        <div className="flex justify-between"><span>IGST</span><span>₹{Number(selectedInvoice.totals.taxBreakup.igst || 0).toFixed(2)}</span></div>
                      )}
                      {selectedInvoice.totals.taxType !== 'IGST' && (
                        <>
                          {selectedInvoice.totals.taxBreakup?.cgst !== undefined && (
                            <div className="flex justify-between"><span>CGST</span><span>₹{Number(selectedInvoice.totals.taxBreakup.cgst || 0).toFixed(2)}</span></div>
                          )}
                          {selectedInvoice.totals.taxBreakup?.sgst !== undefined && (
                            <div className="flex justify-between"><span>SGST</span><span>₹{Number(selectedInvoice.totals.taxBreakup.sgst || 0).toFixed(2)}</span></div>
                          )}
                        </>
                      )}
                      {selectedInvoice.totals.roundOff !== undefined && selectedInvoice.totals.roundOff !== 0 && (
                        <div className="flex justify-between"><span>Round Off</span><span>₹{Number(selectedInvoice.totals.roundOff || 0).toFixed(2)}</span></div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="text-lg font-semibold text-white">Grand Total:</span>
                  <span className="text-2xl font-bold text-white">
                    ₹{Number(selectedInvoice.totals?.grandTotal || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Order ID if available */}
              {selectedInvoice.orderId && (
                <div className="border-t border-white/10 pt-4">
                  <p className="text-sm text-white/60">
                    <span className="font-medium text-white/80">Order ID:</span> {selectedInvoice.orderId}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Cleanup retailer listeners
  useEffect(() => {
    return () => {
      Object.values(retailerSubsRef.current).forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);
};

export default TrackOrders;