/**
 * SupportFlow - Multi-step Help flow for customers
 * Category → Order (if order-related) → Issue type → Form → Submit → Success
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaArrowLeft,
  FaQuestionCircle,
  FaBox,
  FaCreditCard,
  FaUser,
  FaChevronRight,
  FaStore,
  FaUndo,
  FaExclamationTriangle,
  FaTruck,
  FaEllipsisH,
  FaCheckCircle,
  FaTimes,
  FaCheck,
} from 'react-icons/fa';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { getCustomerOrders } from '../services/orderService';
import { submitSupportTicket } from '../services/supportService';

const CATEGORIES = [
  { id: 'order', label: 'Order related', icon: FaBox, desc: 'Query, return, refund, delivery' },
  { id: 'payment', label: 'Payment', icon: FaCreditCard, desc: 'Billing, Pay Later, refunds' },
  { id: 'account', label: 'Account', icon: FaUser, desc: 'Profile, addresses, settings' },
  { id: 'other', label: 'Other', icon: FaQuestionCircle, desc: 'General help' },
];

/** Shown when order is delivered – return, refund, wrong/missing item */
const ISSUE_TYPES_ORDER_DELIVERED = [
  { id: 'query', label: 'Query / Question', icon: FaQuestionCircle },
  { id: 'return_request', label: 'Return request', icon: FaUndo },
  { id: 'refund', label: 'Refund request', icon: FaCreditCard },
  { id: 'wrong_missing_item', label: 'Wrong or missing item', icon: FaExclamationTriangle },
  { id: 'delivery_issue', label: 'Delivery issue', icon: FaTruck },
  { id: 'other', label: 'Other', icon: FaEllipsisH },
];

/** Shown when order is not yet delivered – no return/refund */
const ISSUE_TYPES_ORDER_NOT_DELIVERED = [
  { id: 'query', label: 'Query / Question', icon: FaQuestionCircle },
  { id: 'cancel_request', label: 'Cancel order request', icon: FaTimes },
  { id: 'delivery_issue', label: 'Delivery issue', icon: FaTruck },
  { id: 'other', label: 'Other', icon: FaEllipsisH },
];

const ISSUE_TYPES_GENERAL = [
  { id: 'query', label: 'Query / Question', icon: FaQuestionCircle },
  { id: 'other', label: 'Other', icon: FaEllipsisH },
];

const STEP = { CATEGORY: 0, ORDER: 1, ISSUE: 2, PRODUCTS: 3, FORM: 4, SUCCESS: 5 };

/** Issue types that allow selecting specific products (like Swiggy/Zomato/Amazon) */
const PRODUCT_SPECIFIC_ISSUES = ['return_request', 'wrong_missing_item', 'refund'];

const SupportFlow = ({ isOpen, onClose, preSelectedOrder = null }) => {
  const { customer, customerData } = useCustomerAuth();
  const [step, setStep] = useState(STEP.CATEGORY);
  const [category, setCategory] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(preSelectedOrder);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [issueType, setIssueType] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const isOrderRelated = category === 'order';
  const orderDelivered = selectedOrder?.status === 'delivered';
  const orderPending = selectedOrder?.status === 'pending';
  const baseIssueTypesOrder = isOrderRelated
    ? (orderDelivered ? ISSUE_TYPES_ORDER_DELIVERED : ISSUE_TYPES_ORDER_NOT_DELIVERED)
    : ISSUE_TYPES_GENERAL;
  const issueTypes = isOrderRelated && !orderDelivered
    ? baseIssueTypesOrder.filter((t) => t.id !== 'cancel_request' || orderPending)
    : baseIssueTypesOrder;
  const showProductStep =
    isOrderRelated &&
    orderDelivered &&
    selectedOrder?.items?.length > 0 &&
    PRODUCT_SPECIFIC_ISSUES.includes(issueType);

  // Fetch orders when category is order and we don't have a pre-selected order
  useEffect(() => {
    if (!isOpen || !customer?.uid) return;
    if (category !== 'order' || preSelectedOrder) return;

    setOrdersLoading(true);
    getCustomerOrders(customer.uid, 30)
      .then((list) => setOrders(list))
      .catch((e) => {
        console.error(e);
        setOrders([]);
      })
      .finally(() => setOrdersLoading(false));
  }, [isOpen, customer?.uid, category, preSelectedOrder]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep(STEP.CATEGORY);
      setCategory(null);
      setSelectedOrder(preSelectedOrder || null);
      setIssueType(null);
      setSelectedItems([]);
      setSubject('');
      setDescription('');
      setResult(null);
      setError('');
    } else {
      setSelectedOrder(preSelectedOrder || null);
    }
  }, [isOpen, preSelectedOrder]);

  const goBack = () => {
    setError('');
    if (step === STEP.ORDER) setStep(STEP.CATEGORY);
    else if (step === STEP.ISSUE) setStep(isOrderRelated ? STEP.ORDER : STEP.CATEGORY);
    else if (step === STEP.PRODUCTS) setStep(STEP.ISSUE);
    else if (step === STEP.FORM) setStep(showProductStep ? STEP.PRODUCTS : STEP.ISSUE);
    else setStep(Math.max(0, step - 1));
  };

  const handleCategorySelect = (id) => {
    setCategory(id);
    if (id === 'order' && !preSelectedOrder) {
      setStep(STEP.ORDER);
    } else if (id === 'order' && preSelectedOrder) {
      setSelectedOrder(preSelectedOrder);
      setStep(STEP.ISSUE);
    } else {
      setStep(STEP.ISSUE);
    }
  };

  const handleOrderSelect = (order) => {
    setSelectedOrder(order);
    setStep(STEP.ISSUE);
  };

  const handleIssueSelect = (id) => {
    setIssueType(id);
    const productSpecific = isOrderRelated && selectedOrder?.items?.length > 0 && PRODUCT_SPECIFIC_ISSUES.includes(id);
    setStep(productSpecific ? STEP.PRODUCTS : STEP.FORM);
  };

  const toggleProduct = (index) => {
    setSelectedItems((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
    );
  };

  const handleProductsContinue = () => {
    setStep(STEP.FORM);
  };

  const handleSubmit = async () => {
    const desc = description.trim();
    if (!desc) {
      setError('Please describe your issue.');
      return;
    }

    setSubmitting(true);
    setError('');

    const itemsPayload = selectedItems.length > 0 && selectedOrder?.items
      ? selectedItems.map((idx) => {
          const it = selectedOrder.items[idx];
          return {
            index: idx,
            productId: it.productId || it.id || `item-${idx}`,
            name: it.name || 'Item',
            quantity: it.quantity ?? 1,
            price: it.price,
          };
        })
      : null;

    try {
      const res = await submitSupportTicket({
        customerId: customer?.uid || 'guest',
        customerName: customerData?.name || 'Customer',
        customerPhone: customerData?.phone || '',
        orderId: selectedOrder?.id || null,
        orderNumber: selectedOrder?.orderNumber || null,
        storeId: selectedOrder?.storeId || null,
        storeName: selectedOrder?.storeName || null,
        category: category || 'other',
        issueType: issueType || 'other',
        subject: subject.trim() || null,
        description: desc,
        selectedItems: itemsPayload,
      });

      if (res.success) {
        setResult({ ticketId: res.ticketId, ticketNumber: res.ticketNumber });
        setStep(STEP.SUCCESS);
      } else {
        setError(res.error || 'Something went wrong. Please try again.');
      }
    } catch (e) {
      setError(e?.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[201] bg-[#0f172a] rounded-t-3xl border-t border-white/10 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 flex items-center justify-between border-b border-white/10">
          <button
            type="button"
            onClick={step === STEP.CATEGORY ? onClose : goBack}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          >
            {step === STEP.CATEGORY ? (
              <FaTimes className="text-white/70" />
            ) : (
              <FaArrowLeft className="text-white/70" />
            )}
          </button>
          <h2 className="font-bold text-white text-lg">
            {step === STEP.CATEGORY && 'Get Help'}
            {step === STEP.ORDER && 'Select Order'}
            {step === STEP.ISSUE && 'What’s the issue?'}
            {step === STEP.PRODUCTS && 'Select products'}
            {step === STEP.FORM && 'Describe your issue'}
            {step === STEP.SUCCESS && 'Submitted'}
          </h2>
          <div className="w-10" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <AnimatePresence mode="wait">
            {/* Step: Category */}
            {step === STEP.CATEGORY && (
              <motion.div
                key="category"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <p className="text-white/60 text-sm mb-4">What do you need help with?</p>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCategorySelect(c.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <c.icon className="text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{c.label}</p>
                      <p className="text-xs text-white/50">{c.desc}</p>
                    </div>
                    <FaChevronRight className="text-white/40 flex-shrink-0" />
                  </button>
                ))}
              </motion.div>
            )}

            {/* Step: Select Order */}
            {step === STEP.ORDER && (
              <motion.div
                key="order"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <p className="text-white/60 text-sm mb-4">Which order is this about?</p>
                {ordersLoading ? (
                  <div className="py-12 flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-white/50 text-sm">Loading orders…</p>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="py-12 text-center">
                    <FaBox className="text-white/20 text-4xl mx-auto mb-3" />
                    <p className="text-white/60">No orders found.</p>
                    <p className="text-white/40 text-sm mt-1">You can still submit a general query.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(null);
                        setStep(STEP.ISSUE);
                      }}
                      className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-medium"
                    >
                      Continue without order
                    </button>
                  </div>
                ) : (
                  orders.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => handleOrderSelect(o)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/40 transition-all text-left"
                    >
                      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                        <FaStore className="text-white/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate">{o.storeName}</p>
                        <p className="text-xs text-white/50">
                          #{o.orderNumber?.slice(-8)} • ₹{o.total}
                        </p>
                      </div>
                      <FaChevronRight className="text-white/40 flex-shrink-0" />
                    </button>
                  ))
                )}
              </motion.div>
            )}

            {/* Step: Issue Type */}
            {step === STEP.ISSUE && (
              <motion.div
                key="issue"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                {selectedOrder && (
                  <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                    <FaStore className="text-emerald-400" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{selectedOrder.storeName}</p>
                      <p className="text-xs text-white/50">#{selectedOrder.orderNumber?.slice(-8)}</p>
                    </div>
                  </div>
                )}
                <p className="text-white/60 text-sm mb-4">What’s the issue?</p>
                {issueTypes.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => handleIssueSelect(i.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/40 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                      <i.icon className="text-emerald-400 text-sm" />
                    </div>
                    <p className="font-medium text-white flex-1">{i.label}</p>
                    <FaChevronRight className="text-white/40 flex-shrink-0" />
                  </button>
                ))}
              </motion.div>
            )}

            {/* Step: Select Products (order-related, product-specific issues) */}
            {step === STEP.PRODUCTS && selectedOrder?.items?.length > 0 && (
              <motion.div
                key="products"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <p className="text-white/60 text-sm mb-4">
                  Select the product(s) this is about. You can also continue without selecting.
                </p>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, index) => {
                    const isSelected = selectedItems.includes(index);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleProduct(index)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/40'
                            : 'bg-white/5 border-white/10 hover:border-emerald-500/30'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border-2 ${
                            isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-white/30'
                          }`}
                        >
                          {isSelected && <FaCheck className="text-white text-xs" />}
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                          ) : (
                            <FaBox className="text-white/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{item.name}</p>
                          <p className="text-xs text-white/50">
                            Qty: {item.quantity} × ₹{item.price ?? 0}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="text-emerald-400 text-xs font-medium flex-shrink-0">Selected</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleProductsContinue}
                  className="w-full py-4 rounded-xl bg-emerald-500 text-slate-900 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors mt-4"
                >
                  Continue
                  <FaChevronRight className="text-sm" />
                </button>
              </motion.div>
            )}

            {/* Step: Form */}
            {step === STEP.FORM && (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {showProductStep && selectedItems.length > 0 && selectedOrder?.items && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                    <p className="text-xs font-medium text-emerald-400">Selected product(s)</p>
                    {selectedItems.map((idx) => {
                      const it = selectedOrder.items[idx];
                      return (
                        <div key={idx} className="flex items-center gap-2 text-sm text-white/80">
                          <FaCheck className="text-emerald-400 text-xs flex-shrink-0" />
                          <span className="truncate">{it?.name}</span>
                          <span className="text-white/50 flex-shrink-0">×{it?.quantity ?? 1}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Subject (optional)
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Missing item in order"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your issue in detail. We'll get back to you soon."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 resize-none"
                  />
                </div>
                {error && (
                  <p className="text-red-400 text-sm flex items-center gap-2">
                    <FaExclamationTriangle /> {error}
                  </p>
                )}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="w-full py-4 rounded-xl bg-emerald-500 text-slate-900 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      Submit
                      <FaChevronRight className="text-sm" />
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* Step: Success */}
            {step === STEP.SUCCESS && result && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                  <FaCheckCircle className="text-emerald-400 text-4xl" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Query submitted</h3>
                <p className="text-white/60 text-sm mb-6">
                  We’ve received your request and will get back to you soon.
                </p>
                <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 mb-6">
                  <p className="text-xs text-white/50 mb-1">Ticket number</p>
                  <p className="font-mono font-bold text-emerald-400">{result.ticketNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-4 rounded-xl bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 transition-colors"
                >
                  Done
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SupportFlow;
