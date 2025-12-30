import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { db, auth } from '../../firebase/firebaseConfig';
import { collection, doc, setDoc, serverTimestamp, onSnapshot, Timestamp, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTrash, FaTimes, FaBox, FaSearch } from 'react-icons/fa';
import { ORDER_STATUSES } from '../../constants/orderStatus';

const ProductOwnerAssignOrderForm = ({ distributor, onClose, onSuccess }) => {
  const [items, setItems] = useState([{ productName: '', quantity: 1, unitPrice: 0, notes: '', productId: null }]);
  const [paymentMode, setPaymentMode] = useState('COD');
  const [creditDays, setCreditDays] = useState(15);
  const [splitPayment, setSplitPayment] = useState({ cash: 0, upi: 0, card: 0 });
  const [advancePaid, setAdvancePaid] = useState(0);
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  
  // Inventory integration
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);

  const formatINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n || 0));

  // Fetch inventory products
  useEffect(() => {
    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) return;

    const productsRef = collection(db, `businesses/${productOwnerId}/products`);
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      const productsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInventoryProducts(productsList);
    });

    return () => unsubscribe();
  }, []);

  const getItemsSubTotal = () => {
    return items.reduce((sum, it) => sum + (parseFloat(it.quantity || 0) * parseFloat(it.unitPrice || 0)), 0);
  };
  
  // Filter inventory products based on search
  const filteredInventoryProducts = inventoryProducts.filter((product) => {
    const query = inventorySearchQuery.toLowerCase();
    const name = (product.name || product.productName || '').toLowerCase();
    const sku = (product.sku || '').toLowerCase();
    const brand = (product.brand || '').toLowerCase();
    const category = (product.category || '').toLowerCase();
    return name.includes(query) || sku.includes(query) || brand.includes(query) || category.includes(query);
  });

  // Handle adding product from inventory
  const handleAddFromInventory = (product) => {
    const sellingPrice = product.sellingPrice || product.mrp || product.costPrice || 0;
    const newItem = {
      productName: product.name || product.productName || '',
      quantity: 1,
      unitPrice: parseFloat(sellingPrice),
      notes: product.description || '',
      productId: product.id,
      sku: product.sku || '',
      productData: product, // Store full product data for reference
    };
    setItems([...items, newItem]);
    setShowInventoryModal(false);
    setInventorySearchQuery('');
    toast.success(`${product.name || product.productName} added to order`);
  };

  // Handle opening inventory modal for specific item index (for replacing)
  const handleOpenInventoryForItem = (itemIndex) => {
    setSelectedInventoryItem(itemIndex);
    setShowInventoryModal(true);
  };

  // Handle replacing item with inventory product
  const handleReplaceWithInventory = (product) => {
    const sellingPrice = product.sellingPrice || product.mrp || product.costPrice || 0;
    const updated = [...items];
    updated[selectedInventoryItem] = {
      productName: product.name || product.productName || '',
      quantity: updated[selectedInventoryItem].quantity || 1,
      unitPrice: parseFloat(sellingPrice),
      notes: product.description || '',
      productId: product.id,
      sku: product.sku || '',
      productData: product,
    };
    setItems(updated);
    setShowInventoryModal(false);
    setSelectedInventoryItem(null);
    setInventorySearchQuery('');
    toast.success(`${product.name || product.productName} added to order`);
  };

  const addItem = () => {
    setItems([...items, { productName: '', quantity: 1, unitPrice: 0, notes: '', productId: null }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const normalizePaymentMode = (mode) => {
    const normalized = {
      code: mode.toUpperCase(),
      label: mode,
      isCredit: /credit/i.test(mode),
      isSplit: mode.toLowerCase() === 'split',
      isAdvance: /advance/i.test(mode),
      creditDays: /credit/i.test(mode) ? Number(creditDays || 0) : null,
      splitPayment: mode.toLowerCase() === 'split' ? { ...splitPayment } : null,
      advancePaid: /advance/i.test(mode) ? Number(advancePaid || 0) : null,
    };
    return normalized;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!distributor?.distributorId) {
      toast.error('Distributor information missing');
      return;
    }

    const productOwnerId = auth.currentUser?.uid;
    if (!productOwnerId) {
      toast.error('Please log in again');
      return;
    }

    // Validate items
    const validItems = items.filter(it => it.productName.trim() && it.quantity > 0 && it.unitPrice >= 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item');
      return;
    }

    // Validate payment mode specific fields
    if (paymentMode.toLowerCase() === 'split') {
      const total = splitPayment.cash + splitPayment.upi + splitPayment.card;
      const itemsTotal = getItemsSubTotal();
      if (Math.abs(total - itemsTotal) > 0.01) {
        toast.error('Split payment amounts must equal the order total');
        return;
      }
    }

    if (paymentMode.toLowerCase() === 'credit' && (!creditDays || creditDays < 0)) {
      toast.error('Please specify credit days');
      return;
    }

    setSubmitting(true);

    try {
      // Fetch Product Owner's business information from Firestore
      const productOwnerBusinessRef = doc(db, 'businesses', productOwnerId);
      const productOwnerBusinessSnap = await getDoc(productOwnerBusinessRef);
      const productOwnerBusinessData = productOwnerBusinessSnap.exists() ? productOwnerBusinessSnap.data() : {};
      
      // Debug log to verify data is being fetched correctly
      console.log('Product Owner Business Data:', {
        businessName: productOwnerBusinessData.businessName,
        ownerName: productOwnerBusinessData.ownerName,
        email: productOwnerBusinessData.email,
        phone: productOwnerBusinessData.phone,
      });
      
      const itemsSubTotal = getItemsSubTotal();
      const orderId = doc(collection(db, `businesses/${distributor.distributorId}/productOwnerOrders`)).id;
      
      const paymentPolicy = normalizePaymentMode(paymentMode);
      
      const orderPayload = {
        orderId,
        productOwnerId,
        distributorId: distributor.distributorId,
        createdBy: 'productOwner',
        creatorUid: productOwnerId,
        items: validItems.map(it => ({
          productName: it.productName.trim(),
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          subtotal: Number(it.quantity) * Number(it.unitPrice),
          notes: it.notes?.trim() || '',
          productId: it.productId || null,
          sku: it.sku || null,
        })),
        itemsSubTotal,
        grandTotal: itemsSubTotal, // Can add charges later if needed
        paymentMode: paymentPolicy.code,
        paymentModeLabel: paymentPolicy.label,
        paymentNormalized: paymentPolicy,
        creditDays: paymentPolicy.creditDays,
        splitPayment: paymentPolicy.splitPayment,
        advancePaid: paymentPolicy.advancePaid,
        paymentFlags: {
          isCredit: !!paymentPolicy.isCredit,
          isSplit: !!paymentPolicy.isSplit,
          isAdvance: !!paymentPolicy.isAdvance,
        },
        priority: priority || 'normal',
        notes: notes.trim() || '',
        status: 'ASSIGNED',
        statusCode: 'ASSIGNED',
        // Use actual business name from Firestore, fallback to ownerName, then displayName, then default
        productOwnerName: productOwnerBusinessData.businessName || productOwnerBusinessData.ownerName || auth.currentUser?.displayName || 'Product Owner',
        productOwnerEmail: productOwnerBusinessData.email || auth.currentUser?.email || '',
        productOwnerPhone: productOwnerBusinessData.phone || auth.currentUser?.phoneNumber || '',
        productOwnerId: productOwnerId,
        distributorName: distributor.businessName || distributor.distributorName || '',
        distributorEmail: distributor.email || distributor.distributorEmail || '',
        distributorPhone: distributor.phone || distributor.distributorPhone || '',
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        statusTimestamps: {
          assignedAt: serverTimestamp(),
        },
        statusHistory: [{
          status: 'ASSIGNED',
          updatedAt: Timestamp.now(),
          updatedBy: productOwnerId,
          updatedByName: productOwnerBusinessData.businessName || productOwnerBusinessData.ownerName || auth.currentUser?.displayName || 'Product Owner',
          notes: 'Order assigned to distributor',
        }],
      };

      // Save to distributor's productOwnerOrders
      await setDoc(doc(db, `businesses/${distributor.distributorId}/productOwnerOrders/${orderId}`), orderPayload);

      // Mirror to product owner's assignedOrdersToDistributors
      await setDoc(doc(db, `businesses/${productOwnerId}/assignedOrdersToDistributors/${orderId}`), {
        ...orderPayload,
        // Add any PO-specific fields if needed
      });

      toast.success('Order assigned successfully!');
      
      if (onSuccess) {
        onSuccess();
      }
      
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error assigning order:', error);
      toast.error('Failed to assign order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const itemsTotal = getItemsSubTotal();

  return (
    <>
      <style>{`
        /* Custom scrollbar for inventory modal */
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.5);
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 rounded-xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-white/10 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">Assign Order to {distributor?.businessName || 'Distributor'}</h2>
            <p className="text-white/60 text-sm mt-1">Create a new order assignment</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition"
          >
            <FaTimes />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Order Items</h3>
                <p className="text-sm text-white/60">Add products from inventory or enter manually</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedInventoryItem(null);
                    setShowInventoryModal(true);
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-500/20 to-blue-400/20 hover:from-blue-500/30 hover:to-blue-400/30 border border-blue-400/30 rounded-lg text-blue-300 text-sm font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20 flex items-center gap-2"
                >
                  <FaBox className="text-sm" /> Select from Inventory
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-500/20 to-emerald-400/20 hover:from-emerald-500/30 hover:to-emerald-400/30 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/20 flex items-center gap-2"
                >
                  <FaPlus className="text-sm" /> Add Manual Item
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="group relative p-4 bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 hover:border-emerald-400/30 transition-all duration-300 shadow-lg hover:shadow-emerald-500/10"
                >
                  {item.productId && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 bg-gradient-to-r from-emerald-500/20 to-emerald-400/20 border border-emerald-400/40 rounded-lg text-xs text-emerald-300 flex items-center gap-1.5 font-medium shadow-lg shadow-emerald-500/20">
                      <FaBox className="text-[10px]" /> From Inventory
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    {/* Product Name */}
                    <div className="col-span-12 md:col-span-5">
                      <label className="block text-xs font-medium text-white/60 mb-1.5">Product Name *</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter product name"
                          value={item.productName}
                          onChange={(e) => updateItem(index, 'productName', e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
                          required
                        />
                        {!item.productId && (
                          <button
                            type="button"
                            onClick={() => handleOpenInventoryForItem(index)}
                            className="px-4 py-2.5 bg-gradient-to-r from-blue-500/20 to-blue-400/20 hover:from-blue-500/30 hover:to-blue-400/30 border border-blue-400/30 rounded-lg text-blue-300 text-sm transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20"
                            title="Select from Inventory"
                          >
                            <FaBox />
                          </button>
                        )}
                      </div>
                      {item.sku && (
                        <p className="text-xs text-emerald-400/80 mt-1.5 flex items-center gap-1">
                          <span className="font-medium">SKU:</span> {item.sku}
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="col-span-6 md:col-span-2">
                      <label className="block text-xs font-medium text-white/60 mb-1.5">Quantity *</label>
                      <input
                        type="number"
                        placeholder="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        min="1"
                        className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
                        required
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="col-span-6 md:col-span-2">
                      <label className="block text-xs font-medium text-white/60 mb-1.5">Unit Price (₹) *</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
                        required
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="col-span-6 md:col-span-2">
                      <label className="block text-xs font-medium text-white/60 mb-1.5">Subtotal</label>
                      <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-500/10 to-emerald-400/10 border border-emerald-400/20 rounded-lg text-emerald-300 font-semibold text-center">
                        {formatINR(item.quantity * item.unitPrice)}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <div className="col-span-6 md:col-span-1 flex items-end">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="w-full px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 rounded-lg text-red-300 transition-all hover:scale-105 hover:shadow-lg hover:shadow-red-500/20"
                          title="Remove item"
                        >
                          <FaTrash />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-5 bg-gradient-to-r from-emerald-500/10 via-emerald-400/10 to-emerald-500/10 border border-emerald-400/30 rounded-xl shadow-lg shadow-emerald-500/10"
            >
              <div className="flex justify-between items-center">
                <span className="text-white/80 font-semibold text-lg">Order Total:</span>
                <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-emerald-400">
                  {formatINR(itemsTotal)}
                </span>
              </div>
              <p className="text-xs text-white/50 mt-2">{items.length} item{items.length !== 1 ? 's' : ''} in order</p>
            </motion.div>
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Payment Mode *</label>
            <select
              value={paymentMode}
              onChange={(e) => {
                setPaymentMode(e.target.value);
                if (e.target.value.toLowerCase() === 'split') {
                  setShowSplitModal(true);
                } else if (e.target.value.toLowerCase() === 'credit') {
                  setShowCreditModal(true);
                }
              }}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              required
            >
              <option value="COD">Cash on Delivery (COD)</option>
              <option value="PREPAID">Prepaid</option>
              <option value="CREDIT">Credit</option>
              <option value="SPLIT">Split Payment</option>
              <option value="ADVANCE">Advance Payment</option>
            </select>
          </div>

          {/* Credit Days (if credit) */}
          {paymentMode.toLowerCase() === 'credit' && (
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Credit Days *</label>
              <input
                type="number"
                value={creditDays}
                onChange={(e) => setCreditDays(e.target.value)}
                min="0"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                required
              />
            </div>
          )}

          {/* Split Payment Modal */}
          <AnimatePresence>
            {showSplitModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                onClick={() => setShowSplitModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-slate-800 rounded-xl border border-white/10 p-6 max-w-md w-full"
                >
                  <h3 className="text-lg font-bold text-white mb-4">Split Payment</h3>
                  <p className="text-white/70 text-sm mb-4">Total: {formatINR(itemsTotal)}</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-white/70 mb-1">Cash (₹)</label>
                      <input
                        type="number"
                        value={splitPayment.cash}
                        onChange={(e) => setSplitPayment({ ...splitPayment, cash: e.target.value })}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-1">UPI (₹)</label>
                      <input
                        type="number"
                        value={splitPayment.upi}
                        onChange={(e) => setSplitPayment({ ...splitPayment, upi: e.target.value })}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-1">Card (₹)</label>
                      <input
                        type="number"
                        value={splitPayment.card}
                        onChange={(e) => setSplitPayment({ ...splitPayment, card: e.target.value })}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowSplitModal(false)}
                      className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              placeholder="Additional notes or instructions..."
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition"
            >
              {submitting ? 'Assigning...' : 'Assign Order'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Inventory Selection Modal */}
      <AnimatePresence>
        {showInventoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => {
              setShowInventoryModal(false);
              setSelectedInventoryItem(null);
              setInventorySearchQuery('');
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-xl border border-white/10 w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-r from-slate-900/98 via-slate-800/95 to-slate-900/98 backdrop-blur-xl border-b border-white/10 p-5 flex items-center justify-between z-10 shadow-lg">
                <div>
                  <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-emerald-300">
                    Select from Inventory
                  </h3>
                  <p className="text-white/60 text-sm mt-1.5">
                    {selectedInventoryItem !== null 
                      ? 'Select a product to replace this item' 
                      : 'Browse and select products to add to your order'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowInventoryModal(false);
                    setSelectedInventoryItem(null);
                    setInventorySearchQuery('');
                  }}
                  className="p-2.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all hover:scale-110"
                >
                  <FaTimes className="text-lg" />
                </button>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent">
                <div className="relative">
                  <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-lg" />
                  <input
                    type="text"
                    placeholder="Search products by name, SKU, brand, or category..."
                    value={inventorySearchQuery}
                    onChange={(e) => setInventorySearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all shadow-lg"
                    autoFocus
                  />
                  {inventorySearchQuery && (
                    <button
                      onClick={() => setInventorySearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition"
                    >
                      <FaTimes className="text-sm" />
                    </button>
                  )}
                </div>
                {filteredInventoryProducts.length > 0 && (
                  <p className="text-xs text-white/50 mt-2 ml-1">
                    {filteredInventoryProducts.length} product{filteredInventoryProducts.length !== 1 ? 's' : ''} found
                  </p>
                )}
              </div>

              {/* Products List */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {filteredInventoryProducts.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16 text-white/60"
                  >
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 mb-4">
                      <FaBox className="text-4xl opacity-50" />
                    </div>
                    <p className="text-xl font-semibold mb-2 text-white/80">
                      {inventorySearchQuery ? 'No products found' : 'No products in inventory'}
                    </p>
                    <p className="text-sm text-white/50">
                      {inventorySearchQuery 
                        ? 'Try a different search term' 
                        : 'Add products to your inventory first'}
                    </p>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredInventoryProducts.map((product, idx) => {
                      const sellingPrice = product.sellingPrice || product.mrp || product.costPrice || 0;
                      const stockQuantity = product.quantity || 0;
                      const isOutOfStock = stockQuantity <= 0;
                      
                      return (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`group relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                            isOutOfStock
                              ? 'bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-400/30 opacity-60 cursor-not-allowed'
                              : 'bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 hover:border-emerald-400/50 hover:bg-gradient-to-br hover:from-emerald-500/10 hover:to-emerald-400/5 hover:shadow-xl hover:shadow-emerald-500/20 hover:scale-[1.02]'
                          }`}
                          onClick={() => {
                            if (!isOutOfStock) {
                              if (selectedInventoryItem !== null) {
                                handleReplaceWithInventory(product);
                              } else {
                                handleAddFromInventory(product);
                              }
                            }
                          }}
                        >
                          {/* Product Image Placeholder */}
                          {product.images && product.images[0] ? (
                            <div className="w-full h-32 mb-3 rounded-lg overflow-hidden bg-white/5">
                              <img 
                                src={product.images[0]} 
                                alt={product.name || product.productName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-32 mb-3 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                              <FaBox className="text-3xl text-white/30" />
                            </div>
                          )}

                          {/* Stock Badge */}
                          {isOutOfStock ? (
                            <div className="absolute top-3 right-3 px-2.5 py-1 bg-red-500/20 border border-red-400/40 rounded-lg text-xs text-red-300 font-medium shadow-lg">
                              Out of Stock
                            </div>
                          ) : stockQuantity < 10 && (
                            <div className="absolute top-3 right-3 px-2.5 py-1 bg-yellow-500/20 border border-yellow-400/40 rounded-lg text-xs text-yellow-300 font-medium shadow-lg">
                              Low Stock
                            </div>
                          )}

                          {/* Product Name */}
                          <h4 className="font-bold text-white text-lg mb-2 line-clamp-2 group-hover:text-emerald-300 transition-colors">
                            {product.name || product.productName || 'Unnamed Product'}
                          </h4>
                          
                          {/* Product Details */}
                          <div className="space-y-2 text-sm">
                            {product.sku && (
                              <div className="flex items-center gap-2">
                                <span className="text-white/50 font-medium">SKU:</span>
                                <span className="text-white/80">{product.sku}</span>
                              </div>
                            )}
                            {product.brand && (
                              <div className="flex items-center gap-2">
                                <span className="text-white/50 font-medium">Brand:</span>
                                <span className="text-white/80">{product.brand}</span>
                              </div>
                            )}
                            {product.category && (
                              <div className="flex items-center gap-2">
                                <span className="text-white/50 font-medium">Category:</span>
                                <span className="text-white/80">{product.category}</span>
                              </div>
                            )}
                            
                            {/* Stock & Price */}
                            <div className="pt-3 mt-3 border-t border-white/10 flex justify-between items-end">
                              <div>
                                <p className="text-xs text-white/50 mb-1">Available Stock</p>
                                <p className="text-sm font-semibold text-white/90">
                                  {stockQuantity} <span className="text-xs text-white/60">{product.unit || 'units'}</span>
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-white/50 mb-1">Price</p>
                                <p className="text-lg font-bold text-emerald-400">
                                  {formatINR(sellingPrice)}
                                </p>
                                {product.mrp && product.mrp !== sellingPrice && (
                                  <p className="text-xs text-white/50 line-through">
                                    {formatINR(product.mrp)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Add Button Overlay */}
                          {!isOutOfStock && (
                            <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                              <div className="px-4 py-2 bg-emerald-500/90 hover:bg-emerald-500 rounded-lg text-white font-semibold text-sm shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                {selectedInventoryItem !== null ? 'Replace Item' : 'Add to Order'}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
    </>
  );
};

export default ProductOwnerAssignOrderForm;

