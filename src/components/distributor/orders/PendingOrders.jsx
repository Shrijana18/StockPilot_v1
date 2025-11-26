import React, { useEffect, useState, useMemo } from 'react';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  getDoc,
  query,
  where,
  updateDoc,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { toast } from 'react-toastify';
// Removed ProformaSummary import - using detailed breakdown instead
import { codeOf } from '../../../constants/orderStatus';
import * as orderPolicy from '../../../lib/orders/orderPolicy';
import { splitFromMrp } from '../../../utils/pricing';
import { calculateProforma } from '../../../lib/calcProforma';
import { getDistributorEmployeeSession } from '../../../utils/distributorEmployeeSession';
import { empAuth } from '../../../firebase/firebaseConfig';

const PendingOrders = () => {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [shippingIds, setShippingIds] = useState(new Set());
  const [employees, setEmployees] = useState([]);
  const [expandedDeliveryDetails, setExpandedDeliveryDetails] = useState(new Set());

  const db = getFirestore();
  const auth = getAuth();

  // ---------- Helpers ----------
  const formatDateTime = (d) => {
    try {
      return new Date(d).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const checkStockAvailability = (item) => {
    if (item.stockAvailable === undefined || item.stockAvailable === null) {
      return { isOverstock: false, message: '' };
    }
    if (Number(item.quantity) > Number(item.stockAvailable)) {
      return { isOverstock: true, message: `Only ${item.stockAvailable} in stock` };
    }
    return { isOverstock: false, message: '' };
  };

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
    if (Array.isArray(order?.proforma?.lines)) {
      const ln = order.proforma.lines[idx];
      if (ln && ln.price != null) return Number(ln.price) || 0;
    }
    const sellingPrice = Number(item.sellingPrice || item.price || 0);
    if (sellingPrice > 0) return sellingPrice;
    return Number(item.price) || 0;
  };

  const getDisplaySubtotal = (order, idx, item) => {
    if (Array.isArray(order?.proforma?.lines)) {
      const ln = order.proforma.lines[idx];
      if (ln && ln.gross != null) return Number(ln.gross) || 0;
    }
    const qty = Number(item?.quantity) || 0;
    const price = getDisplayPrice(order, idx, item);
    return qty * price;
  };

  // Get full proforma breakdown for display
  const getProformaBreakdown = (order) => {
    // Prefer saved proforma if it exists (includes complete discount info)
    if (order?.proforma && order.proforma.lines && Array.isArray(order.proforma.lines) && order.proforma.lines.length > 0) {
      return {
        grossItems: Number(order.proforma.grossItems || 0),
        lineDiscountTotal: Number(order.proforma.lineDiscountTotal || 0),
        itemsSubTotal: Number(order.proforma.itemsSubTotal || order.proforma.subTotal || 0),
        orderCharges: {
          delivery: Number(order.proforma.orderCharges?.delivery ?? 0),
          packing: Number(order.proforma.orderCharges?.packing ?? 0),
          insurance: Number(order.proforma.orderCharges?.insurance ?? 0),
          other: Number(order.proforma.orderCharges?.other ?? 0),
        },
        discountTotal: Number(order.proforma.discountTotal || 0),
        taxableBase: Number(order.proforma.taxableBase || 0),
        taxType: order.proforma.taxType || 'CGST_SGST',
        taxBreakup: order.proforma.taxBreakup || {},
        roundOff: Number(order.proforma.roundOff || 0),
        grandTotal: Number(order.proforma.grandTotal || 0),
      };
    }
    
    // Fallback: use chargesSnapshot.breakdown if available
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
    // Calculate from order data if chargesSnapshot not available
    // But prefer using saved proforma.lines if available (preserves discounts)
    const items = Array.isArray(order?.items) ? order.items : [];
    const proformaLines = Array.isArray(order?.proforma?.lines) ? order.proforma.lines : null;
    
    const lines = items.map((it, idx) => {
      // Use proforma line if available (preserves discount info)
      if (proformaLines && proformaLines[idx]) {
        const pLine = proformaLines[idx];
        return {
          qty: Number(pLine.qty ?? it.quantity ?? it.qty ?? 0),
          price: Number(pLine.price ?? it.sellingPrice ?? it.price ?? it.unitPrice ?? 0),
          itemDiscountPct: Number(pLine.itemDiscountPct ?? 0),
          itemDiscountAmt: Number(pLine.itemDiscountAmt ?? 0),
          itemDiscountChangedBy: pLine.itemDiscountChangedBy || (pLine.itemDiscountAmt > 0 ? 'amt' : 'pct'),
          gstRate: Number(pLine.gstRate ?? it.gstRate ?? it.taxRate ?? 0),
        };
      }
      // Fallback: use item data
      return {
      qty: Number(it.quantity ?? it.qty ?? 0),
      price: Number(it.sellingPrice ?? it.price ?? it.unitPrice ?? 0),
        itemDiscountPct: Number(it.itemDiscountPct ?? 0),
        itemDiscountAmt: Number(it.itemDiscountAmt ?? 0),
        itemDiscountChangedBy: it.itemDiscountChangedBy || (it.itemDiscountAmt > 0 ? 'amt' : 'pct'),
        gstRate: Number(it.gstRate ?? it.taxRate ?? 0),
      };
    });
    
    // Get order charges from chargesSnapshot.breakdown, proforma.orderCharges, or order fields
    const orderCharges = {
      delivery: Number(order?.chargesSnapshot?.breakdown?.delivery ?? order?.proforma?.orderCharges?.delivery ?? order?.delivery ?? 0),
      packing: Number(order?.chargesSnapshot?.breakdown?.packing ?? order?.proforma?.orderCharges?.packing ?? order?.packing ?? 0),
      insurance: Number(order?.chargesSnapshot?.breakdown?.insurance ?? order?.proforma?.orderCharges?.insurance ?? order?.insurance ?? 0),
      other: Number(order?.chargesSnapshot?.breakdown?.other ?? order?.proforma?.orderCharges?.other ?? order?.other ?? 0),
      discountPct: Number(order?.chargesSnapshot?.breakdown?.discountPct ?? order?.proforma?.orderCharges?.discountPct ?? order?.orderDiscountPct ?? 0),
      discountAmt: Number(order?.chargesSnapshot?.breakdown?.discountAmt ?? order?.proforma?.orderCharges?.discountAmt ?? order?.orderDiscountAmt ?? 0),
      discountChangedBy: order?.chargesSnapshot?.breakdown?.discountChangedBy ?? order?.proforma?.orderCharges?.discountChangedBy ?? (order?.orderDiscountAmt ? "amt" : "pct"),
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

  // ---------- Inline editors ----------
  const handleDateChange = async (orderId, newDate) => {
    const user = auth.currentUser;
    if (!user) return;
    const orderRef = doc(db, 'businesses', user.uid, 'orderRequests', orderId);
    await updateDoc(orderRef, { expectedDeliveryDate: newDate || '' });
  };

  const handleDeliveryModeChange = async (orderId, mode) => {
    const user = auth.currentUser;
    if (!user) return;
    const orderRef = doc(db, 'businesses', user.uid, 'orderRequests', orderId);
    await updateDoc(orderRef, { deliveryMode: mode || '' });
  };

  // ---------- Delivery Tracking Handlers ----------
  const handleDeliveryFieldChange = async (orderId, field, value) => {
    const user = auth.currentUser;
    if (!user) return;
    const orderRef = doc(db, 'businesses', user.uid, 'orderRequests', orderId);
    
    // Update local state immediately for responsive UI
    setPendingOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              deliveryDetails: {
                ...(o.deliveryDetails || {}),
                [field]: value,
              },
            }
          : o
      )
    );
    
    // Save to Firestore
    try {
      await updateDoc(orderRef, {
        [`deliveryDetails.${field}`]: value || null,
        lastUpdated: serverTimestamp(),
      });
      
      // Also update retailer order if exists (for seamless flow)
      const order = pendingOrders.find((o) => o.id === orderId);
      if (order?.retailerId) {
        const retailerOrderRef = doc(db, 'businesses', order.retailerId, 'sentOrders', orderId);
        await updateDoc(retailerOrderRef, {
          [`deliveryDetails.${field}`]: value || null,
          lastUpdated: serverTimestamp(),
        }).catch(console.error); // Fail silently if retailer order doesn't exist
      }
    } catch (err) {
      console.error('Failed to update delivery field:', err);
      toast.error('Failed to save delivery details');
      // Revert local state on error
      setPendingOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? pendingOrders.find((o2) => o2.id === orderId) || o : o
        )
      );
    }
  };

  const toggleDeliveryDetails = (orderId) => {
    setExpandedDeliveryDetails((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };


  const handleItemEdit = (orderId, index, field, value) => {
    setPendingOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        const updated = [...(order.items || [])];
        updated[index] = { ...updated[index], [field]: value };
        return { ...order, items: updated };
      }),
    );
  };

  const handleDeleteItem = (orderId, index) => {
    setPendingOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        const updated = (order.items || []).filter((_, i) => i !== index);
        return { ...order, items: updated };
      }),
    );
  };

  const saveModifiedOrder = async (orderId) => {
    const user = auth.currentUser;
    if (!user) return;
    const updatedOrder = pendingOrders.find((o) => o.id === orderId);
    if (!updatedOrder) return;
    
    // Check if current user is an employee
    const employeeSession = getDistributorEmployeeSession();
    const isEmployee = !!employeeSession;
    const employeeInfo = isEmployee ? {
      type: 'employee',
      employeeId: employeeSession.employeeId,
      flypEmployeeId: employeeSession.flypEmployeeId || employeeSession.employeeId,
      name: employeeSession.name || null,
      role: employeeSession.role || null,
      uid: empAuth.currentUser?.uid || user.uid,
    } : null;
    
    await orderPolicy.updateLines({
      db,
      auth,
      distributorId: user.uid,
      orderId,
      items: updatedOrder.items,
      deliveryMode: updatedOrder.deliveryMode,
      expectedDeliveryDate: updatedOrder.expectedDeliveryDate,
      paymentMode: updatedOrder.payment || updatedOrder.paymentMode,
    });
    
    // Add employee activity tracking
    if (isEmployee && employeeInfo) {
      try {
        const orderRef = doc(db, 'businesses', user.uid, 'orderRequests', orderId);
        await updateDoc(orderRef, {
          'handledBy.modifiedBy': { ...employeeInfo, uid: employeeInfo.uid, type: 'employee' },
          employeeActivity: arrayUnion({
            action: 'modified',
            employeeId: employeeInfo.employeeId,
            flypEmployeeId: employeeInfo.flypEmployeeId,
            employeeName: employeeInfo.name,
            employeeRole: employeeInfo.role,
            at: new Date().toISOString(),
            // Note: Using ISO string (at field) instead of serverTimestamp() as serverTimestamp() cannot be used inside arrays
          }),
        });
      } catch (err) {
        console.warn('Failed to log employee activity for order modification:', err);
      }
    }
    
    if (typeof toast === 'function') toast.success('Changes saved');
  };

  // ---------- Ship flow ----------
  const markAsShipped = async (orderId) => {
    const user = auth.currentUser;
    if (!user) return;

    const order = pendingOrders.find((o) => o.id === orderId);
    if (!order) return;

    // Check if current user is an employee
    const employeeSession = getDistributorEmployeeSession();
    const isEmployee = !!employeeSession;
    const employeeInfo = isEmployee ? {
      type: 'employee',
      employeeId: employeeSession.employeeId,
      flypEmployeeId: employeeSession.flypEmployeeId || employeeSession.employeeId,
      name: employeeSession.name || null,
      role: employeeSession.role || null,
      uid: empAuth.currentUser?.uid || user.uid,
    } : null;

    // UI validation and loading guard
    setPendingOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, deliveryDateError: !o.expectedDeliveryDate, deliveryModeError: !o.deliveryMode }
          : o,
      ),
    );
    if (!order.expectedDeliveryDate || !order.deliveryMode) return;

    // Disable the button instantly (optimistic)
    setShippingIds((prev) => new Set(prev).add(orderId));

    try {
      await orderPolicy.shipOrder({
        db,
        auth,
        distributorId: user.uid,
        orderId,
        expectedDeliveryDate: order.expectedDeliveryDate,
        deliveryMode: order.deliveryMode,
        courier: order.courier || null,
        awb: order.awb || null,
      });

      // Add employee activity tracking
      if (isEmployee && employeeInfo) {
        try {
          const orderRef = doc(db, 'businesses', user.uid, 'orderRequests', orderId);
          await updateDoc(orderRef, {
            'handledBy.shippedBy': { ...employeeInfo, uid: employeeInfo.uid, type: 'employee' },
            employeeActivity: arrayUnion({
              action: 'shipped',
              employeeId: employeeInfo.employeeId,
              flypEmployeeId: employeeInfo.flypEmployeeId,
              employeeName: employeeInfo.name,
              employeeRole: employeeInfo.role,
              deliveryMode: order.deliveryMode,
              expectedDeliveryDate: order.expectedDeliveryDate,
              at: new Date().toISOString(),
              // Note: Using ISO string (at field) instead of serverTimestamp() as serverTimestamp() cannot be used inside arrays
            }),
          });
        } catch (err) {
          console.warn('Failed to log employee activity for shipping:', err);
        }
      }

      // Optimistic UI update
      setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
      if (typeof toast === 'function') toast.success('Order marked as Shipped → Track Orders');
    } catch (err) {
      console.error('shipOrder failed:', err);
      if (typeof toast === 'function') toast.error(err.message || 'Failed to mark as Shipped.');
    } finally {
      setShippingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // ---------- Load Employees ----------
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const employeesRef = collection(db, 'businesses', user.uid, 'distributorEmployees');
    const unsubscribe = onSnapshot(employeesRef, (snapshot) => {
      const employeeData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEmployees(employeeData);
    });

    return () => unsubscribe();
  }, []);

  // ---------- Live data ----------
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ordersRef = collection(db, 'businesses', user.uid, 'orderRequests');

    // Primary: canonical statusCode
    const q1 = query(ordersRef, where('statusCode', 'in', ['ACCEPTED', 'MODIFIED', 'PACKED']));
    // Fallback: legacy status (when accept wrote only `status: 'Accepted'`)
    const q2 = query(ordersRef, where('status', 'in', ['Accepted', 'Modified', 'Packed']));

    // aggregator by id (dedupe between q1 & q2)
    const byId = new Map();

    const enrich = async (docSnap) => {
      const data = docSnap.data() || {};
      const retailerId =
        typeof data.retailerId === 'string' && data.retailerId.trim().length
          ? data.retailerId.trim()
          : null;

      // Retailer profile (guard for passive/provisional without retailerId)
      let retailerData = {};
      if (retailerId) {
        try {
          const retailerRef = doc(db, 'businesses', retailerId);
          const retailerSnap = await getDoc(retailerRef);
          if (retailerSnap.exists()) retailerData = retailerSnap.data() || {};
        } catch {
          /* keep empty retailerData */
        }
      } else if (data.retailerInfo) {
        // passive snapshot written at accept time
        retailerData = {
          businessName: data.retailerInfo.name || data.retailerInfo.businessName,
          ownerName: data.retailerInfo.ownerName || null,
          email: data.retailerInfo.email || null,
          phone: data.retailerInfo.phone || null,
          city: data.retailerInfo.city || null,
          state: data.retailerInfo.state || null,
          address: data.retailerInfo.address || null,
        };
      }

      // Items enrichment: prefer proforma line values
      const itemsSrc = Array.isArray(data.items) ? data.items : [];
      const itemsWithStock = await Promise.all(
        itemsSrc.map(async (item, idx) => {
          const pLine = Array.isArray(data.proforma?.lines) ? data.proforma.lines[idx] : undefined;
          let enriched = { ...item };

          // prefer distributorProductId, fall back to productId
          const prodId =
            (typeof item.distributorProductId === 'string' && item.distributorProductId.trim()) ||
            (typeof item.productId === 'string' && item.productId.trim()) ||
            null;

          if (!pLine && prodId) {
            try {
              const productRef = doc(db, 'businesses', user.uid, 'products', prodId);
              const productSnap = await getDoc(productRef);
              if (productSnap.exists()) {
                const p = productSnap.data() || {};
                enriched = {
                  ...enriched,
                  stockAvailable: p.quantity ?? p.stockAvailable,
                  price: p.sellingPrice || p.price || enriched.price || 0,
                  sku: p.sku || enriched.sku || '',
                  unit: p.unit || enriched.unit || '',
                };
              }
            } catch {
              /* ignore product enrichment failure */
            }
          }

          if (pLine) {
            enriched = {
              ...enriched,
              price: Number(pLine.price ?? enriched.price ?? 0),
              proformaGross: Number(pLine.gross ?? 0),
              gstRate: Number(pLine.gstRate ?? enriched.gstRate ?? 0),
            };
          }

          return enriched;
        }),
      );

      return {
        id: docSnap.id,
        ...data,
        items: itemsWithStock,
        retailerName:
          retailerData.businessName ||
          retailerData.ownerName ||
          data.retailerName ||
          'N/A',
        retailerEmail:
          retailerData.email ||
          data.retailerEmail ||
          data.retailerInfo?.email ||
          'N/A',
      };
    };

    const unsub1 = onSnapshot(q1, async (snap) => {
      const rows = await Promise.all(snap.docs.map(enrich));
      rows.forEach((r) => byId.set(r.id, r));
      setPendingOrders(Array.from(byId.values()));
    });

    const unsub2 = onSnapshot(q2, async (snap) => {
      const rows = await Promise.all(snap.docs.map(enrich));
      rows.forEach((r) => byId.set(r.id, r));
      setPendingOrders(Array.from(byId.values()));
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  // Filter (supports legacy status, too)
  const filteredOrders = useMemo(() => {
    return pendingOrders.filter((order) => {
      if (statusFilter === 'All') return true;
      if (statusFilter === 'Modified') return order.status === 'Modified';
      const orderCode = codeOf(order.statusCode || order.status);
      const filterCode = codeOf(statusFilter);
      return orderCode && filterCode && orderCode === filterCode;
    });
  }, [pendingOrders, statusFilter]);

  return (
    <div className="p-6 space-y-6 text-white">
      {/* Segmented control for status filter */}
      <div className="mb-4 sticky top-[72px] z-30 backdrop-blur-xl bg-[#0B0F14]/60 border border-white/10 rounded-xl px-3 py-2">
        <div className="flex gap-2 flex-wrap">
          {['All', 'Accepted', 'Packed', 'Modified'].map((status) => {
            const active = statusFilter === status;
            const base = 'px-4 py-1 rounded-full text-sm border transition backdrop-blur-xl';
            const on =
              'bg-emerald-500 text-slate-900 border-transparent shadow-[0_8px_24px_rgba(16,185,129,0.35)]';
            const off = 'bg-white/10 text-white border-white/15 hover:bg-white/15';
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

      {filteredOrders.map((order) => {
        const displayStatus =
          order.status ||
          (order.statusCode
            ? order.statusCode.charAt(0) + order.statusCode.slice(1).toLowerCase()
            : 'N/A');
        const paymentLabel = orderPolicy.formatPaymentLabel(order.paymentMode || order.payment);

        return (
          <div
            key={order.id}
            className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl hover:shadow-emerald-400/10 transition p-6"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-lg text-white">Retailer: {order.retailerName}</h3>
                <p className="text-sm text-white/60">Order ID: {order.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    order.statusCode === 'ACCEPTED'
                      ? 'bg-emerald-400/15 text-emerald-300'
                      : order.statusCode === 'MODIFIED'
                      ? 'bg-amber-400/15 text-amber-300'
                      : order.statusCode === 'PACKED'
                      ? 'bg-sky-400/15 text-sky-300'
                      : 'bg-white/10 text-white/80'
                  }`}
                >
                  {displayStatus}
                </span>
              </div>
            </div>

            <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <p className="text-white/70">Email: {order.retailerEmail}</p>
              {order.status === 'Modified' ? (
                <label className="flex items-center gap-2">
                  <span className="font-medium text-white/80">Payment Mode:</span>
                  <select
                    value={orderPolicy.extractPaymentCode(order.payment || order.paymentMode) || ''}
                    onChange={(e) =>
                      setPendingOrders(prev =>
                        prev.map(o =>
                          o.id === order.id ? { ...o, paymentMode: e.target.value } : o
                        )
                      )
                    }
                    className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                  >
                    <option value="">Select</option>
                    <option value="COD">Cash on Delivery (COD)</option>
                    <option value="SPLIT">Split Payment (50/50 or custom %)</option>
                    <option value="ADVANCE">Advance Payment</option>
                    <option value="END_OF_MONTH">End of Month</option>
                    <option value="CREDIT_CYCLE">Credit Cycle (15/30 days)</option>
                    <option value="UPI">UPI</option>
                    <option value="NET_BANKING">Net Banking</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
              ) : (
                <p className="text-white/70">
                  <span className="font-medium">Payment Mode:</span> {paymentLabel}
                </p>
              )}
            </div>

            <p className="mt-1 text-white/60 text-sm">
              Requested On:{' '}
              {order.timestamp?.seconds ? formatDateTime(order.timestamp.seconds * 1000) : 'N/A'}
            </p>

            <div className="mt-4 border border-white/10 rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 font-semibold bg-white/5 border-b border-white/10 px-4 py-2 text-white text-sm">
                <div>Name</div>
                <div>Brand</div>
                <div>Category</div>
                <div className="text-right">Qty</div>
                <div>Unit</div>
                <div className="text-right">Base Price</div>
                <div className="text-right">MRP</div>
                <div className="text-right">Selling Price</div>
                <div className="text-right">GST %</div>
                <div>Actions</div>
                <div className="text-right">Price</div>
                <div className="text-right">Subtotal</div>
              </div>

              {(order.items || []).map((item, i) => {
                const { isOverstock, message } = checkStockAvailability(item);
                const basePrice = getDisplayBasePrice(order, i, item);
                const mrp = Number(item.mrp || 0);
                const sellingPrice = getDisplayPrice(order, i, item);
                const gstRate = Number(item.gstRate || item.taxRate || 0);
                const pLine = Array.isArray(order?.proforma?.lines) ? order.proforma.lines[i] : undefined;
                const displayGstRate = pLine?.gstRate !== undefined ? Number(pLine.gstRate) : gstRate;
                
                return (
                  <div
                    key={i}
                    className="grid grid-cols-12 border-t border-white/10 px-4 py-2 text-sm items-center gap-2 hover:bg-white/5 transition"
                  >
                    {order.status === 'Modified' ? (
                      <>
                        <input
                          className="rounded px-2 py-1 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                          type="text"
                          value={item.productName}
                          onChange={(e) => handleItemEdit(order.id, i, 'productName', e.target.value)}
                        />
                        <input
                          className="rounded px-2 py-1 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                          type="text"
                          value={item.brand || ''}
                          onChange={(e) => handleItemEdit(order.id, i, 'brand', e.target.value)}
                        />
                        <input
                          className="rounded px-2 py-1 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                          type="text"
                          value={item.category || ''}
                          onChange={(e) => handleItemEdit(order.id, i, 'category', e.target.value)}
                        />
                        <div className="flex flex-col gap-1">
                          <input
                            className={`rounded px-2 py-1 bg-white/10 border ${
                              isOverstock ? 'border-rose-500' : 'border-white/20'
                            } text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition text-right`}
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemEdit(order.id, i, 'quantity', parseInt(e.target.value))
                            }
                          />
                          {isOverstock && (
                            <span className="text-xs text-rose-300">{message}</span>
                          )}
                        </div>
                        <input
                          className="rounded px-2 py-1 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition"
                          type="text"
                          value={item.unit || ''}
                          onChange={(e) => handleItemEdit(order.id, i, 'unit', e.target.value)}
                        />
                        <div className="text-right text-white/90">₹{basePrice.toFixed(2)}</div>
                        <div className="text-right text-white/90">{mrp > 0 ? `₹${mrp.toFixed(2)}` : '—'}</div>
                        <div className="text-right text-white/90">₹{sellingPrice.toFixed(2)}</div>
                        <div className="text-right text-white/90">{displayGstRate > 0 ? `${displayGstRate}%` : '—'}</div>
                        <button
                          onClick={() => handleDeleteItem(order.id, i)}
                          className="text-rose-300 font-semibold px-2 py-1 rounded hover:bg-white/10 transition"
                          title="Delete Item"
                          type="button"
                        >
                          Delete
                        </button>
                        <div className="text-right text-white/90">₹{sellingPrice.toFixed(2)}</div>
                        <div className="text-right text-white/90">₹{getDisplaySubtotal(order, i, item).toFixed(2)}</div>
                      </>
                    ) : (
                      <>
                        <div>{item.productName}</div>
                        <div>{item.brand || 'N/A'}</div>
                        <div>{item.category || 'N/A'}</div>
                        <div className="text-right">
                          {item.quantity}
                          {item.stockAvailable !== undefined &&
                            Number(item.quantity) > Number(item.stockAvailable) && (
                              <span className="text-rose-300 text-xs ml-1">Out of Stock</span>
                            )}
                        </div>
                        <div>{item.unit || 'N/A'}</div>
                        <div className="text-right text-white/90">₹{basePrice.toFixed(2)}</div>
                        <div className="text-right text-white/90">{mrp > 0 ? `₹${mrp.toFixed(2)}` : '—'}</div>
                        <div className="text-right text-white/90">₹{sellingPrice.toFixed(2)}</div>
                        <div className="text-right text-white/90">{displayGstRate > 0 ? `${displayGstRate}%` : '—'}</div>
                        <div></div>
                        <div className="text-right text-white/90">₹{sellingPrice.toFixed(2)}</div>
                        <div className="text-right text-white/90">₹{getDisplaySubtotal(order, i, item).toFixed(2)}</div>
                      </>
                    )}
                  </div>
                );
              })}

              {order?.proforma?.grandTotal != null && (
                <div className="flex justify-end px-4 py-2 border-t border-white/10 text-sm font-semibold">
                  <span className="mr-2 text-white/80">Grand Total:</span>
                  <span>₹{Number(order.proforma.grandTotal || 0).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Full Breakdown */}
            {(() => {
              const breakdown = getProformaBreakdown(order);
              const distributorState = order.distributorState || 'Maharashtra';
              const retailerState = order.retailerState || order.state || distributorState;
              const taxTypeLabel = breakdown.taxType === 'IGST'
                ? `IGST (Interstate: ${distributorState} → ${retailerState})`
                : `CGST + SGST (Intrastate: ${distributorState} → ${retailerState})`;
              
              return (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <h4 className="font-semibold mb-3 text-white">Proforma Breakdown</h4>
                  <div className="space-y-1 text-sm text-white/80">
                    <div className="flex justify-between"><span>Unit Price Total</span><span>₹{breakdown.grossItems.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>− Line Discounts</span><span>₹{breakdown.lineDiscountTotal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Items Sub‑Total</span><span>₹{breakdown.itemsSubTotal.toFixed(2)}</span></div>
                    {breakdown.orderCharges.delivery > 0 && (
                      <div className="flex justify-between"><span>+ Delivery</span><span>₹{breakdown.orderCharges.delivery.toFixed(2)}</span></div>
                    )}
                    {breakdown.orderCharges.packing > 0 && (
                      <div className="flex justify-between"><span>+ Packing</span><span>₹{breakdown.orderCharges.packing.toFixed(2)}</span></div>
                    )}
                    {breakdown.orderCharges.insurance > 0 && (
                      <div className="flex justify-between"><span>+ Insurance</span><span>₹{breakdown.orderCharges.insurance.toFixed(2)}</span></div>
                    )}
                    {breakdown.orderCharges.other > 0 && (
                      <div className="flex justify-between"><span>+ Other</span><span>₹{breakdown.orderCharges.other.toFixed(2)}</span></div>
                    )}
                    {breakdown.discountTotal > 0 && (
                      <div className="flex justify-between"><span>− Order Discount</span><span>₹{breakdown.discountTotal.toFixed(2)}</span></div>
                    )}
                    <div className="flex justify-between font-semibold"><span>Taxable Base</span><span>₹{breakdown.taxableBase.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Tax Type</span><span className="text-xs">{taxTypeLabel}</span></div>
                    {breakdown.taxType === 'IGST' ? (
                      <div className="flex justify-between"><span>IGST</span><span>₹{Number(breakdown.taxBreakup?.igst || 0).toFixed(2)}</span></div>
                    ) : (
                      <>
                        <div className="flex justify-between"><span>CGST</span><span>₹{Number(breakdown.taxBreakup?.cgst || 0).toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>SGST</span><span>₹{Number(breakdown.taxBreakup?.sgst || 0).toFixed(2)}</span></div>
                      </>
                    )}
                    {breakdown.roundOff !== 0 && (
                      <div className="flex justify-between"><span>Round Off</span><span>₹{breakdown.roundOff.toFixed(2)}</span></div>
                    )}
                    <div className="flex justify-between font-semibold text-white border-t border-white/20 pt-1 mt-1"><span>Grand Total</span><span>₹{breakdown.grandTotal.toFixed(2)}</span></div>
                  </div>
                </div>
              );
            })()}

            {/* Delivery Tracking Section */}
            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
              <button
                type="button"
                onClick={() => toggleDeliveryDetails(order.id)}
                className="w-full flex items-center justify-between font-semibold text-white mb-2 hover:text-emerald-300 transition"
              >
                <span className="flex items-center gap-2">
                  <span>🚚</span>
                  <span>Delivery Tracking & Logistics</span>
                </span>
                <span className="text-white/60">
                  {expandedDeliveryDetails.has(order.id) ? '▼' : '▶'}
                </span>
              </button>

              {expandedDeliveryDetails.has(order.id) && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Delivery Person Type */}
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-white/80">Delivery Person Type</label>
                      <select
                        value={order?.deliveryDetails?.personType || ''}
                        onChange={(e) => handleDeliveryFieldChange(order.id, 'personType', e.target.value)}
                        className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                      >
                        <option value="">Select Type</option>
                        <option value="employee">Employee</option>
                        <option value="external">External Person</option>
                        <option value="third-party">Third Party Service</option>
                      </select>
                    </div>

                    {/* Delivery Person Name / Employee */}
                    {(order?.deliveryDetails?.personType === 'employee' || !order?.deliveryDetails?.personType) && (
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-white/80">Select Employee</label>
                        <select
                          value={order?.deliveryDetails?.employeeId || ''}
                          onChange={(e) => {
                            const selectedEmployee = employees.find((emp) => emp.id === e.target.value);
                            handleDeliveryFieldChange(order.id, 'employeeId', e.target.value);
                            if (selectedEmployee) {
                              handleDeliveryFieldChange(order.id, 'personName', selectedEmployee.name || '');
                              handleDeliveryFieldChange(order.id, 'personPhone', selectedEmployee.phone || '');
                              handleDeliveryFieldChange(order.id, 'personDesignation', selectedEmployee.designation || selectedEmployee.role || '');
                            }
                          }}
                          className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                        >
                          <option value="">Select Employee</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name || emp.flypEmployeeId || emp.id} {emp.phone ? `- ${emp.phone}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Manual Person Name */}
                    {order?.deliveryDetails?.personType === 'external' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-white/80">Person Name</label>
                        <input
                          type="text"
                          value={order?.deliveryDetails?.personName || ''}
                          onChange={(e) => handleDeliveryFieldChange(order.id, 'personName', e.target.value)}
                          placeholder="Enter person name"
                          className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                        />
                      </div>
                    )}

                    {/* Person Contact Number */}
                    {(order?.deliveryDetails?.personType === 'external' || order?.deliveryDetails?.personType === 'third-party') && (
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-white/80">Contact Number</label>
                        <input
                          type="tel"
                          value={order?.deliveryDetails?.personPhone || ''}
                          onChange={(e) => handleDeliveryFieldChange(order.id, 'personPhone', e.target.value)}
                          placeholder="Enter contact number"
                          className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                        />
                      </div>
                    )}

                    {/* Person Designation */}
                    {order?.deliveryDetails?.personType && (
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-white/80">Designation / Role</label>
                        <input
                          type="text"
                          value={order?.deliveryDetails?.personDesignation || ''}
                          onChange={(e) => handleDeliveryFieldChange(order.id, 'personDesignation', e.target.value)}
                          placeholder="Driver, Delivery Boy, etc."
                          className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                        />
                      </div>
                    )}

                    {/* Vehicle Type */}
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-white/80">Vehicle Type</label>
                      <select
                        value={order?.deliveryDetails?.vehicleType || ''}
                        onChange={(e) => handleDeliveryFieldChange(order.id, 'vehicleType', e.target.value)}
                        className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                      >
                        <option value="">Select Vehicle</option>
                        <option value="car">Car</option>
                        <option value="jeep">Jeep</option>
                        <option value="van">Van</option>
                        <option value="truck">Truck</option>
                        <option value="motorcycle">Motorcycle</option>
                        <option value="auto">Auto Rickshaw</option>
                        <option value="bicycle">Bicycle</option>
                        <option value="e-rickshaw">E-Rickshaw</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {/* Vehicle Number */}
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-white/80">Vehicle Number</label>
                      <input
                        type="text"
                        value={order?.deliveryDetails?.vehicleNumber || ''}
                        onChange={(e) => handleDeliveryFieldChange(order.id, 'vehicleNumber', e.target.value.toUpperCase())}
                        placeholder="MH-12-AB-1234"
                        className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                      />
                    </div>

                    {/* Transport Method */}
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-white/80">Transport Method</label>
                      <select
                        value={order?.deliveryDetails?.transportMethod || ''}
                        onChange={(e) => handleDeliveryFieldChange(order.id, 'transportMethod', e.target.value)}
                        className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                      >
                        <option value="">Select Method</option>
                        <option value="by-distributor">By Distributor (Own Vehicle)</option>
                        <option value="transport">Transport Service</option>
                        <option value="bus">Bus Service</option>
                        <option value="courier">Courier Service</option>
                        <option value="shiprocket">Shiprocket</option>
                        <option value="delhivery">Delhivery</option>
                        <option value="bluedart">Blue Dart</option>
                        <option value="dtdc">DTDC</option>
                        <option value="fedex">FedEx</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {/* Transport Service Name */}
                    {['transport', 'bus', 'other'].includes(order?.deliveryDetails?.transportMethod) && (
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-white/80">Transport Service Name</label>
                        <input
                          type="text"
                          value={order?.deliveryDetails?.transportServiceName || ''}
                          onChange={(e) => handleDeliveryFieldChange(order.id, 'transportServiceName', e.target.value)}
                          placeholder="Enter transport service name"
                          className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                        />
                      </div>
                    )}

                    {/* AWB / Tracking Number */}
                    {['courier', 'shiprocket', 'delhivery', 'bluedart', 'dtdc', 'fedex'].includes(order?.deliveryDetails?.transportMethod) && (
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-white/80">AWB / Tracking Number</label>
                        <input
                          type="text"
                          value={order?.deliveryDetails?.awbNumber || order?.awb || ''}
                          onChange={(e) => {
                            handleDeliveryFieldChange(order.id, 'awbNumber', e.target.value);
                            // Also update the main awb field for compatibility
                            const orderRef = doc(db, 'businesses', auth.currentUser?.uid, 'orderRequests', order.id);
                            updateDoc(orderRef, { awb: e.target.value || null }).catch(console.error);
                          }}
                          placeholder="Enter AWB/Tracking number"
                          className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                        />
                      </div>
                    )}

                    {/* Courier Service */}
                    {order?.deliveryDetails?.transportMethod === 'courier' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-white/80">Courier Service</label>
                        <input
                          type="text"
                          value={order?.courier || order?.deliveryDetails?.courierName || ''}
                          onChange={(e) => {
                            handleDeliveryFieldChange(order.id, 'courierName', e.target.value);
                            // Also update the main courier field for compatibility
                            const orderRef = doc(db, 'businesses', auth.currentUser?.uid, 'orderRequests', order.id);
                            updateDoc(orderRef, { courier: e.target.value || null }).catch(console.error);
                          }}
                          placeholder="Enter courier service name"
                          className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                        />
                      </div>
                    )}

                    {/* Expected Delivery Date - Consolidated */}
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-white/80">Expected Delivery Date</label>
                <input
                  type="date"
                        value={order?.expectedDeliveryDate || order?.deliveryDetails?.expectedDeliveryDate || ''}
                  onChange={(e) => {
                    handleDateChange(order.id, e.target.value);
                          handleDeliveryFieldChange(order.id, 'expectedDeliveryDate', e.target.value);
                    setPendingOrders((prev) =>
                      prev.map((o) =>
                        o.id === order.id ? { ...o, expectedDeliveryDate: e.target.value } : o,
                      ),
                    );
                  }}
                        className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                />
                    </div>

                    {/* Delivery Mode - Consolidated */}
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-white/80">Delivery Mode</label>
                <select
                        value={order?.deliveryMode || order?.deliveryDetails?.deliveryMode || ''}
                  onChange={(e) => {
                    handleDeliveryModeChange(order.id, e.target.value);
                          handleDeliveryFieldChange(order.id, 'deliveryMode', e.target.value);
                    setPendingOrders((prev) =>
                      prev.map((o) =>
                        o.id === order.id ? { ...o, deliveryMode: e.target.value } : o,
                      ),
                    );
                  }}
                        className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition"
                >
                  <option value="">Select</option>
                  <option value="By Distributor">By Distributor</option>
                  <option value="Shiprocket">Shiprocket</option>
                  <option value="Delhivery">Delhivery</option>
                  <option value="Other">Other</option>
                </select>
                    </div>
                  </div>

                  {/* Delivery Notes */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-white/80">Delivery Notes / Special Instructions</label>
                    <textarea
                      value={order?.deliveryDetails?.deliveryNotes || ''}
                      onChange={(e) => handleDeliveryFieldChange(order.id, 'deliveryNotes', e.target.value)}
                      placeholder="Enter any special instructions, delivery address details, landmark, etc."
                      rows={3}
                      className="rounded-lg px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition resize-none"
                    />
                  </div>

                  {/* Display Summary */}
                  {order?.deliveryDetails && Object.keys(order.deliveryDetails).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <h5 className="text-sm font-semibold text-white/90 mb-2">Delivery Summary:</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-white/70">
                        {order.deliveryDetails.personName && (
                          <div><span className="font-medium">Person:</span> {order.deliveryDetails.personName}</div>
                        )}
                        {order.deliveryDetails.vehicleType && (
                          <div><span className="font-medium">Vehicle:</span> {order.deliveryDetails.vehicleType}</div>
                        )}
                        {order.deliveryDetails.vehicleNumber && (
                          <div><span className="font-medium">Vehicle No:</span> {order.deliveryDetails.vehicleNumber}</div>
                        )}
                        {order.deliveryDetails.transportMethod && (
                          <div><span className="font-medium">Method:</span> {order.deliveryDetails.transportMethod.replace(/-/g, ' ')}</div>
                        )}
                        {order.deliveryDetails.awbNumber && (
                          <div><span className="font-medium">AWB:</span> {order.deliveryDetails.awbNumber}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error messages for delivery date and mode */}
            {(order.deliveryDateError || order.deliveryModeError) && (
              <div className="mt-4">
                {order.deliveryDateError && (
                  <p className="text-rose-300 text-sm">Please select a valid delivery date.</p>
                )}
              {order.deliveryModeError && (
                  <p className="text-rose-300 text-sm">Please select a delivery mode.</p>
              )}
            </div>
            )}

            <div className="mt-4 flex gap-3 flex-wrap">
              {order.status === 'Modified' && (
                <button
                  onClick={() => saveModifiedOrder(order.id)}
                  className="px-4 py-2 rounded-full font-medium text-sm text-slate-900 bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-300 hover:shadow-[0_8px_24px_rgba(251,191,36,0.35)] transition"
                >
                  Save Changes
                </button>
              )}
              <button
                onClick={() => markAsShipped(order.id)}
                disabled={shippingIds.has(order.id)}
                className={`px-4 py-2 rounded-full font-medium text-sm text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] transition ${shippingIds.has(order.id) ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {shippingIds.has(order.id) ? 'Shipping…' : 'Mark as Shipped'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PendingOrders;