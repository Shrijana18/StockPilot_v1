import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { db, auth } from '../../firebase/firebaseConfig';
import { collection, doc, setDoc, serverTimestamp, addDoc, onSnapshot, query, getDoc } from 'firebase/firestore';
import { computeChargesFromDefaults } from "../../services/proformaDefaults";
import EstimateNotice from "../../components/common/EstimateNotice";
import { calculateEstimate } from "../../lib/calcEstimate";
import { ORDER_STATUSES } from "../../constants/orderStatus";
import { normalizePaymentMode } from "../../lib/orders/orderPolicy";

const RetailerOrderRequestForm = ({ distributorId }) => {
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [distributorInventory, setDistributorInventory] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);

  const [paymentMode, setPaymentMode] = useState('COD');
  const [creditDays, setCreditDays] = useState(15);
  const [splitPayment, setSplitPayment] = useState({ advance: '', balance: '' });
  const [expanded, setExpanded] = useState({});
  const formatINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n || 0));

  const [effectiveDefaults, setEffectiveDefaults] = useState(null);
  const [chargesPreview, setChargesPreview] = useState(null);
  const [fastFlow, setFastFlow] = useState(false); // true => skip proforma and create Order directly
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  const getItemsSubTotal = (list) => list.reduce((sum, it) => (sum + (parseFloat(it.quantity || 0) || 0) * (parseFloat(it.unitPrice || 0) || 0)), 0);

  useEffect(() => {
    const run = async () => {
      if (!distributorId || !auth.currentUser) {
        setEffectiveDefaults(null);
        setFastFlow(false);
        setChargesPreview(null);
        return;
      }
      setLoadingDefaults(true);
      const retailerUid = auth.currentUser.uid;
      try {
        // Read Global
        const globalRef = doc(db, 'businesses', distributorId, 'orderSettings', 'global');
        let globalData = {};
        try {
          const gSnap = await getDoc(globalRef);
          if (gSnap.exists()) globalData = gSnap.data() || {};
        } catch (e) {
          // ignore if retailer cannot read global (rules). We'll still try override.
        }
        // Read retailer override (under global)
        const overrideRef = doc(db, 'businesses', distributorId, 'orderSettings', 'global', 'retailerOverrides', retailerUid);
        let overrideData = {};
        try {
          const oSnap = await getDoc(overrideRef);
          if (oSnap.exists()) overrideData = oSnap.data() || {};
        } catch (e) {
          // ignore read failure
        }
        const merged = { ...globalData, ...overrideData };
        setEffectiveDefaults(merged);
        setFastFlow(Boolean(merged.skipProforma));
      } finally {
        setLoadingDefaults(false);
      }
    };
    run();
  }, [distributorId]);

  useEffect(() => {
    const subTotal = getItemsSubTotal(items);
    if (!effectiveDefaults || !effectiveDefaults.enabled || subTotal <= 0) {
      setChargesPreview(null);
      return;
    }
    try {
      const breakdown = computeChargesFromDefaults({
        itemsSubTotal: subTotal,
        defaults: effectiveDefaults,
        distributorProfile: {},
        retailerProfile: {},
      });
      setChargesPreview(breakdown);
    } catch (e) {
      setChargesPreview(null);
    }
  }, [items, effectiveDefaults]);

  useEffect(() => {
    if (!distributorId) return;
    const q = query(collection(db, "businesses", distributorId, "products"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDistributorInventory(data);
    });
    return () => unsubscribe();
  }, [distributorId]);

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);

    if (field === 'productName') {
      const lower = value.toLowerCase();
      const filtered = distributorInventory.filter(prod =>
        prod.productName?.toLowerCase().includes(lower) ||
        prod.sku?.toLowerCase().includes(lower) ||
        prod.brand?.toLowerCase().includes(lower) ||
        prod.category?.toLowerCase().includes(lower) ||
        prod.unit?.toLowerCase().includes(lower) ||
        (prod.sellingPrice + '').includes(lower)
      );
      setFilteredSuggestions(filtered);
    }
  };

  const addItemRow = () => {
    setItems([...items, { productName: '', sku: '', brand: '', category: '', quantity: '', unit: '', description: '', notes: '', unitPrice: '' }]);
  };

  const handleSubmit = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !distributorId || items.length === 0) return;

    try {
      setSubmitting(true);

      // Build a cart snapshot suitable for pre-tax estimate
      const cartForEstimate = items.map((it) => ({
        inventoryId: it.distributorProductId,
        name: it.productName,
        sku: it.sku,
        hsn: it.hsn || undefined,
        uom: it.unit || undefined,
        imageUrl: it.imageUrl || undefined,
        qty: Number(it.quantity || 0),
        price: Number(it.unitPrice || 0),
        itemDiscountPct: Number(it.itemDiscountPct || 0),
      }));

      const est = calculateEstimate(cartForEstimate);

      const totalAmount = items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unitPrice) || 0;
        return sum + qty * price;
      }, 0);

      const distributorSnap = await getDoc(doc(db, 'businesses', distributorId));
      const distributorData = distributorSnap.exists() ? distributorSnap.data() : {};

      const distributorPhone = distributorData.phone || '';
      const distributorEmail = distributorData.email || '';

      const retailerUid = currentUser.uid;
      const itemsSubTotal = totalAmount;

      // Normalize payment mode AND keep a display label
      const normMode = normalizePaymentMode(paymentMode);

      if (fastFlow && effectiveDefaults && effectiveDefaults.enabled) {
        // DIRECT (proforma skipped)
        const orderId = doc(collection(db, `businesses/${distributorId}/orderRequests`)).id;

        const chargesSnapshot = {
          defaultsUsed: effectiveDefaults,
          breakdown: (chargesPreview || computeChargesFromDefaults({
            itemsSubTotal,
            defaults: effectiveDefaults,
            distributorProfile: {},
            retailerProfile: {},
          }))
        };

        const requestPayload = {
          orderId,
          retailerId: retailerUid,
          distributorId,
          createdBy: 'retailer',
          creatorUid: retailerUid,
          items,
          itemsSubTotal,
          paymentMode: normMode,
          paymentModeLabel: paymentMode, // NEW: preserve human choice
          creditDays: normMode === 'CREDIT_CYCLE' ? creditDays : null,
          splitPayment: normMode === 'SPLIT' ? splitPayment : null,
          chargesSnapshot,
          status: 'Requested',
          statusCode: ORDER_STATUSES.REQUESTED,
          retailerMode: 'active',
          directFlow: true,
          paymentSummary: {
            mode: normMode,
            creditDueDays: normMode === 'CREDIT_CYCLE' ? Number(creditDays || 0) : null,
            splitPayment: normMode === 'SPLIT' ? { ...splitPayment } : null,
            status: 'pending'
          },
          paymentFlags: {
            isCredit: normMode === 'CREDIT_CYCLE',
            isSplit: normMode === 'SPLIT',
            isAdvance: normMode === 'ADVANCE'
          },
          createdAt: serverTimestamp(),
          timestamp: serverTimestamp(),
          distributorName: distributorData.businessName || distributorData.ownerName || '',
          distributorCity: distributorData.city || '',
          distributorState: distributorData.state || '',
          distributorPhone,
          distributorEmail,
          statusTimestamps: { requestedAt: serverTimestamp() },
          retailerName: currentUser.displayName || 'Retailer',
          retailerEmail: currentUser.email || '',
          retailerPhone: currentUser.phoneNumber || '',
        };

        // Write to distributor + mirror to retailer with SAME id
        await setDoc(doc(db, `businesses/${distributorId}/orderRequests/${orderId}`), requestPayload);
        await setDoc(doc(db, `businesses/${retailerUid}/sentOrders/${orderId}`), requestPayload);

        toast.success('Order sent (Direct defaults applied). Awaiting distributor action.');
      } else {
        // PROFORMA flow
        const distributorRef = collection(db, `businesses/${distributorId}/orderRequests`);
        const docRef = await addDoc(distributorRef, {
          retailerId: currentUser.uid,
          distributorId: distributorId,
          createdBy: 'retailer',
          creatorUid: currentUser.uid,
          items,
          itemsSubTotal,
          paymentMode: normMode,
          paymentModeLabel: paymentMode, // NEW
          creditDays: normMode === 'CREDIT_CYCLE' ? creditDays : null,
          splitPayment: normMode === 'SPLIT' ? splitPayment : null,
          retailerMode: 'active',
          directFlow: false,
          paymentSummary: {
            mode: normMode,
            creditDueDays: normMode === 'CREDIT_CYCLE' ? Number(creditDays || 0) : null,
            splitPayment: normMode === 'SPLIT' ? { ...splitPayment } : null,
            status: 'pending'
          },
          paymentFlags: {
            isCredit: normMode === 'CREDIT_CYCLE',
            isSplit: normMode === 'SPLIT',
            isAdvance: normMode === 'ADVANCE'
          },
          status: 'Requested',
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp(), // NEW: canonical createdAt for queries
          distributorName: distributorData.businessName || distributorData.ownerName || '',
          distributorCity: distributorData.city || '',
          distributorState: distributorData.state || '',
          distributorPhone,
          distributorEmail,
          estimate: {
            subtotal: est.subtotal,
            lines: est.items.map(({ qty, price, itemDiscountPct, gross, discountAmount, taxable }) => ({
              qty, price, itemDiscountPct, gross, discountAmount, taxable,
            })),
            note: "Pre-tax estimate. Taxes/charges will be added in Proforma by distributor.",
            version: 1,
          },
          statusCode: ORDER_STATUSES.REQUESTED,
          statusTimestamps: { requestedAt: serverTimestamp() },
          retailerName: currentUser.displayName || 'Retailer',
          retailerEmail: currentUser.email || '',
          retailerPhone: currentUser.phoneNumber || '',
        });

        const retailerRef = doc(db, `businesses/${currentUser.uid}/sentOrders/${docRef.id}`);
        await setDoc(retailerRef, {
          retailerId: currentUser.uid,
          distributorId: distributorId,
          items,
          itemsSubTotal,
          paymentMode: normMode,
          paymentModeLabel: paymentMode, // NEW
          creditDays: normMode === 'CREDIT_CYCLE' ? creditDays : null,
          splitPayment: normMode === 'SPLIT' ? splitPayment : null,
          retailerMode: 'active',
          directFlow: false,
          paymentSummary: {
            mode: normMode,
            creditDueDays: normMode === 'CREDIT_CYCLE' ? Number(creditDays || 0) : null,
            splitPayment: normMode === 'SPLIT' ? { ...splitPayment } : null,
            status: 'pending'
          },
          paymentFlags: {
            isCredit: normMode === 'CREDIT_CYCLE',
            isSplit: normMode === 'SPLIT',
            isAdvance: normMode === 'ADVANCE'
          },
          status: 'Requested',
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp(), // NEW: keep mirror aligned
          distributorName: distributorData.businessName || distributorData.ownerName || '',
          distributorCity: distributorData.city || '',
          distributorState: distributorData.state || '',
          distributorPhone,
          distributorEmail,
          estimate: {
            subtotal: est.subtotal,
            lines: est.items.map(({ qty, price, itemDiscountPct, gross, discountAmount, taxable }) => ({
              qty, price, itemDiscountPct, gross, discountAmount, taxable,
            })),
            note: "Pre-tax estimate. Taxes/charges will be added in Proforma by distributor.",
            version: 1,
          },
          statusCode: ORDER_STATUSES.REQUESTED,
          statusTimestamps: { requestedAt: serverTimestamp() },
          retailerName: currentUser.displayName || 'Retailer',
          retailerEmail: currentUser.email || '',
          retailerPhone: currentUser.phoneNumber || '',
        });

        toast.success('Order request sent successfully!');
      }
      setItems([]);
      setTimeout(() => setItems([{ productName: '', sku: '', brand: '', category: '', quantity: '', unit: '', description: '', notes: '', unitPrice: '' }]), 0);
    } catch (err) {
      console.error('Error sending order:', err);
      alert('Failed to send order request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <h2 className="text-lg font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Send Order Request</h2>

      {/* Universal Product Search Bar */}
      <div className="mb-4 relative">
        <input
          type="text"
          placeholder="🔍 Search product by name, SKU, brand, etc."
          className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 shadow-sm"
          onChange={(e) => {
            const query = e.target.value.toLowerCase();
            if (query.trim() === "") {
              setFilteredSuggestions([]);
              return;
            }
            const filtered = distributorInventory.filter(prod =>
              prod.productName?.toLowerCase().includes(query) ||
              prod.sku?.toLowerCase().includes(query) ||
              prod.brand?.toLowerCase().includes(query) ||
              prod.category?.toLowerCase().includes(query) ||
              (prod.sellingPrice + '').includes(query)
            );
            setFilteredSuggestions(filtered);
          }}
        />
        {filteredSuggestions.length > 0 && (
          <ul className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto text-sm z-50 rounded-xl border border-white/10 bg-[#0B0F14]/90 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            {filteredSuggestions.map((sug) => (
              <li
                key={sug.id}
                className="px-3 py-2 cursor-pointer border-b border-white/10 hover:bg-white/10"
                onClick={() => {
                  const alreadyAdded = items.some(existing => existing.sku === sug.sku);
                  if (alreadyAdded) {
                    toast.warning('Item already added to cart.');
                    return;
                  }
                  setItems([...items, {
                    productName: sug.productName,
                    sku: sug.sku,
                    brand: sug.brand,
                    category: sug.category,
                    quantity: '',
                    unit: sug.unit || '',
                    description: '',
                    notes: '',
                    unitPrice: sug.sellingPrice || '',
                    available: sug.quantity,
                    distributorProductId: sug.id
                  }]);
                  setFilteredSuggestions([]);
                }}
              >
                <div className="font-semibold">{sug.productName}</div>
                <div className="text-xs text-white/70 flex flex-wrap gap-2">
                  <span>Brand: {sug.brand || '—'}</span>
                  <span>SKU: {sug.sku || '—'}</span>
                  <span>Unit: {sug.unit || '—'}</span>
                  <span>Price: ₹{sug.sellingPrice || '—'}</span>
                  <span className={`font-semibold ${sug.quantity === 0 ? 'text-rose-300' : sug.quantity <= 10 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    In Stock: {sug.quantity}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4">
        <label className="font-medium mr-2 text-white/80">Payment Mode:</label>
        <select
          className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value)}
        >
          <option value="COD">Cash on Delivery</option>
          <option value="Advance Payment">Advance Payment</option>
          <option value="Credit Cycle">Credit Cycle</option>
          <option value="Post-Sale Payment">Post-Sale Payment</option>
          <option value="Split Payment">Split Payment</option>
          <option value="Monthly Ledger">Monthly Credit Statement</option>
        </select>
        {paymentMode === 'Credit Cycle' && (
          <input
            type="number"
            className="ml-4 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            placeholder="Credit days"
            value={creditDays}
            onChange={(e) => setCreditDays(e.target.value)}
          />
        )}
        {paymentMode === 'Split Payment' && (
          <div className="ml-4 flex gap-2 mt-2">
            <input
              type="number"
              placeholder="Advance %"
              className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              value={splitPayment.advance}
              onChange={(e) => setSplitPayment({ ...splitPayment, advance: e.target.value })}
            />
            <input
              type="number"
              placeholder="Balance %"
              className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              value={splitPayment.balance}
              onChange={(e) => setSplitPayment({ ...splitPayment, balance: e.target.value })}
            />
          </div>
        )}
      </div>

      {items.map((item, index) => {
        const qtyNum = parseFloat(item.quantity || 0) || 0;
        const priceNum = parseFloat(item.unitPrice || 0) || 0;
        const subtotal = qtyNum * priceNum;
        const isOpen = !!expanded[index];
        return (
          <div key={index} className="mb-2 rounded-lg border border-white/10 bg-white/[0.04] p-2 md:p-3 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate leading-tight">{item.productName || 'Selected product'}</div>
                <div className="mt-0.5 text-[11px] text-white/60 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="truncate">SKU: {item.sku || '—'}</span>
                  {item.brand && <span className="truncate">Brand: {item.brand}</span>}
                  {item.category && <span className="truncate">Category: {item.category}</span>}
                  {item.available !== undefined && (
                    <span className={`truncate ${item.available === 0 ? 'text-rose-300' : item.available <= 10 ? 'text-amber-300' : 'text-emerald-300'}`}>In Stock: {item.available}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden md:block text-xs text-white/70">Subtotal: <span className="font-semibold text-white/90">{formatINR(subtotal)}</span></div>
                <button
                  onClick={() => setExpanded((s) => ({ ...s, [index]: !s[index] }))}
                  className="px-2 py-1 text-xs rounded border border-white/10 bg-white/5 hover:bg-white/10"
                  title={isOpen ? 'Collapse' : 'Expand'}
                >
                  {isOpen ? 'Hide' : 'More'}
                </button>
                <button
                  onClick={() => {
                    const updated = items.filter((_, i) => i !== index);
                    setItems(updated);
                  }}
                  className="px-2 py-1 text-xs rounded border border-white/10 bg-white/5 hover:bg-white/10 text-rose-300"
                  title="Remove Item"
                >
                  Remove
                </button>
              </div>
            </div>

            {/* Inline compact field row */}
            <div className="mt-2 grid grid-cols-2 md:grid-cols-8 gap-2">
              <div className="col-span-1 md:col-span-2">
                <label className="sr-only">Quantity</label>
                <input
                  type="number"
                  placeholder="Qty"
                  className="h-9 w-full rounded-md border border-white/15 bg-white/10 px-2 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="sr-only">Unit</label>
                <div
                  className="h-9 w-full rounded-md border border-white/15 bg-white/10 px-2 text-sm text-white/80 flex items-center"
                  tabIndex={-1}
                  aria-readonly="true"
                >
                  {item.unit || '—'}
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="sr-only">Unit Price</label>
                <div
                  className="h-9 w-full rounded-md border border-white/15 bg-white/10 px-2 text-sm text-white/80 flex items-center justify-between"
                  tabIndex={-1}
                  aria-readonly="true"
                >
                  <span className="truncate">{item.unitPrice ? `₹${item.unitPrice}` : '—'}</span>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="sr-only">SKU</label>
                <div
                  className="h-9 w-full rounded-md border border-white/15 bg-white/10 px-2 text-sm text-white/80 flex items-center"
                  tabIndex={-1}
                  aria-readonly="true"
                >
                  <span className="truncate">{item.sku || '—'}</span>
                </div>
              </div>

              {/* Subtotal (mobile) */}
              <div className="col-span-2 md:col-span-0 md:hidden text-xs text-white/70">
                Subtotal: <span className="font-semibold text-white/90">{formatINR(subtotal)}</span>
              </div>
            </div>

            {/* Collapsible extras */}
            {isOpen && (
              <div className="mt-2 grid grid-cols-2 md:grid-cols-8 gap-2">
                <div className="col-span-2 md:col-span-4">
                  <label className="text-[11px] uppercase tracking-wide text-white/50">Description</label>
                  <input
                    type="text"
                    placeholder="Description"
                    className="mt-1 h-9 w-full rounded-md border border-white/15 bg-white/10 px-2 text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  />
                </div>
                <div className="col-span-2 md:col-span-4">
                  <label className="text-[11px] uppercase tracking-wide text-white/50">Notes</label>
                  <input
                    type="text"
                    placeholder="Notes for supplier (optional)"
                    className="mt-1 h-9 w-full rounded-md border border-white/15 bg-white/10 px-2 text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    value={item.notes}
                    onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={addItemRow}
        className="mb-3 px-3 py-1 rounded-xl text-sm font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_6px_20px_rgba(16,185,129,0.35)]"
      >
        + Add Item
      </button>

      {/* Estimate banner: clarifies this total is pre-tax & pre-charges */}
      <EstimateNotice className="mb-3" />

      <div className="text-right font-semibold text-lg mb-3 text-white">
        Estimate (pre-tax): ₹{items.reduce((acc, item) => acc + (parseFloat(item.unitPrice || 0) * parseFloat(item.quantity || 0)), 0).toFixed(2)}
      </div>

      {fastFlow && effectiveDefaults?.enabled && (
        <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-white">Charges Preview</div>
            <span className="text-xs text-emerald-300">Proforma skipped</span>
          </div>
          {chargesPreview ? (
            <div className="text-sm">
              <div className="flex items-center justify-between py-0.5"><span className="text-white/70">Subtotal</span><span className="text-white">{formatINR(chargesPreview.subTotal || chargesPreview.subtotal || getItemsSubTotal(items))}</span></div>
              {Number(chargesPreview.discountAmt || 0) > 0 && (
                <div className="flex items-center justify-between py-0.5"><span className="text-white/70">Discount</span><span className="text-white">- {formatINR(chargesPreview.discountAmt)}</span></div>
              )}
              {Number(chargesPreview.delivery || 0) > 0 && (<div className="flex items-center justify-between py-0.5"><span className="text-white/70">Delivery</span><span className="text-white">{formatINR(chargesPreview.delivery)}</span></div>)}
              {Number(chargesPreview.packing || 0) > 0 && (<div className="flex items-center justify-between py-0.5"><span className="text-white/70">Packing</span><span className="text-white">{formatINR(chargesPreview.packing)}</span></div>)}
              {Number(chargesPreview.insurance || 0) > 0 && (<div className="flex items-center justify-between py-0.5"><span className="text-white/70">Insurance</span><span className="text-white">{formatINR(chargesPreview.insurance)}</span></div>)}
              {Number(chargesPreview.other || 0) > 0 && (<div className="flex items-center justify-between py-0.5"><span className="text-white/70">Other</span><span className="text-white">{formatINR(chargesPreview.other)}</span></div>)}
              <div className="my-1 border-t border-dashed border-white/15" />
              <div className="flex items-center justify-between py-0.5"><span className="text-white/70">Taxes</span><span className="text-white">{formatINR(chargesPreview.taxes || 0)}</span></div>
              <div className="flex items-center justify-between py-0.5"><span className="text-white/70">Round Off</span><span className="text-white">{formatINR(chargesPreview.roundOff || 0)}</span></div>
              <div className="flex items-center justify-between py-0.5 font-semibold"><span className="text-white">Grand Total</span><span className="text-white">{formatINR(chargesPreview.grandTotal || getItemsSubTotal(items))}</span></div>
            </div>
          ) : (
            <div className="text-xs text-white/60">Distributor defaults will be applied when placing the order.</div>
          )}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !distributorId}
        className="block w-full py-2 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 disabled:opacity-60 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
      >
        {submitting ? 'Sending Order...' : 'Send Order'}
      </button>
    </div>
  );
};

export default RetailerOrderRequestForm;