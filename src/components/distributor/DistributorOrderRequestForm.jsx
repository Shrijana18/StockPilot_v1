import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { db, auth } from '../../firebase/firebaseConfig';
import { collection, doc, setDoc, serverTimestamp, getDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTrash, FaTimes, FaBox, FaSearch, FaCheckCircle } from 'react-icons/fa';
import { ORDER_STATUSES } from '../../constants/orderStatus';

const DistributorOrderRequestForm = ({ productOwner, onClose, onSuccess, initialProduct }) => {
  // Initialize with initialProduct if provided
  const getInitialItems = () => {
    if (initialProduct) {
      return [{
        productName: initialProduct.productName || '',
        quantity: initialProduct.quantity || 1,
        unitPrice: initialProduct.unitPrice || 0,
        notes: initialProduct.notes || '',
        productId: initialProduct.productId || null,
        sku: initialProduct.sku || null,
      }];
    }
    return [{ productName: '', quantity: 1, unitPrice: 0, notes: '', productId: null, sku: null }];
  };
  
  const [items, setItems] = useState(getInitialItems());
  const [paymentMode, setPaymentMode] = useState('COD');
  const [creditDays, setCreditDays] = useState(0);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Inventory integration
  const [inventoryProducts, setInventoryProducts] = useState([]); // Product Owner's inventory
  const [distributorInventoryProducts, setDistributorInventoryProducts] = useState([]); // Distributor's own inventory
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventorySource, setInventorySource] = useState(null); // 'productOwner' or 'distributor'
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
  const [productOwnerInfo, setProductOwnerInfo] = useState(null);

  const formatINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n || 0));

  // Fetch Product Owner information
  useEffect(() => {
    const fetchProductOwnerInfo = async () => {
      // Get productOwnerId from various possible fields
      const productOwnerId = productOwner?.productOwnerId || productOwner?.id;
      if (!productOwnerId) {
        console.error('No productOwnerId found in productOwner prop:', productOwner);
        // Still set productOwnerInfo from prop if available
        if (productOwner) {
          setProductOwnerInfo(productOwner);
        }
        return;
      }
      
      try {
        console.log('Fetching Product Owner info for ID:', productOwnerId);
        const productOwnerBusinessRef = doc(db, 'businesses', productOwnerId);
        const productOwnerBusinessSnap = await getDoc(productOwnerBusinessRef);
        if (productOwnerBusinessSnap.exists()) {
          const data = productOwnerBusinessSnap.data();
          console.log('Fetched Product Owner data:', data);
          // Merge fetched data with prop data to ensure all fields are available
          setProductOwnerInfo({
            ...productOwner,
            ...data,
            productOwnerId: productOwnerId,
            id: productOwnerId,
          });
        } else {
          console.warn('Product Owner document not found, using prop data');
          // Fallback to prop data, ensure productOwnerId is set
          setProductOwnerInfo({
            ...productOwner,
            productOwnerId: productOwnerId,
            id: productOwnerId,
          });
        }
      } catch (err) {
        console.error('Error fetching product owner info:', err);
        // Fallback to prop data, ensure productOwnerId is set
        setProductOwnerInfo({
          ...productOwner,
          productOwnerId: productOwnerId,
          id: productOwnerId,
        });
      }
    };
    
    if (productOwner) {
      fetchProductOwnerInfo();
    }
  }, [productOwner]);

  // Fetch inventory products from Product Owner
  useEffect(() => {
    // Get productOwnerId from various possible fields
    const productOwnerId = productOwner?.productOwnerId || productOwner?.id;
    if (!productOwnerId) {
      console.error('[DistributorOrderRequestForm] No productOwnerId found for inventory fetch:', productOwner);
      setInventoryProducts([]);
      return;
    }

    console.log('[DistributorOrderRequestForm] Fetching inventory products for Product Owner ID:', productOwnerId);
    console.log('[DistributorOrderRequestForm] Current user:', auth.currentUser?.uid);
    console.log('[DistributorOrderRequestForm] Product Owner object:', productOwner);
    
    const productsRef = collection(db, `businesses/${productOwnerId}/products`);
    const unsubscribe = onSnapshot(
      productsRef,
      (snapshot) => {
        console.log(`[DistributorOrderRequestForm] Snapshot received: ${snapshot.docs.length} products`);
        const productsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log(`[DistributorOrderRequestForm] Found ${productsList.length} products in Product Owner inventory`);
        console.log('[DistributorOrderRequestForm] Sample products:', productsList.slice(0, 2));
        setInventoryProducts(productsList);
      },
      (err) => {
        console.error('[DistributorOrderRequestForm] Error fetching inventory products:', err);
        console.error('[DistributorOrderRequestForm] Error details:', {
          code: err.code,
          message: err.message,
          productOwnerId,
          path: `businesses/${productOwnerId}/products`,
          currentUser: auth.currentUser?.uid,
          errorName: err.name
        });
        
        // Show user-friendly error message
        if (err.code === 'permission-denied') {
          toast.error('Permission denied: Unable to access product owner inventory. Please ensure you are connected to this product owner.');
        } else {
          toast.error(`Failed to load inventory: ${err.message || 'Unknown error'}`);
        }
        setInventoryProducts([]);
      }
    );

    return () => {
      console.log('[DistributorOrderRequestForm] Cleaning up inventory subscription');
      unsubscribe();
    };
  }, [productOwner]);

  // Fetch distributor's own inventory products
  useEffect(() => {
    const distributorId = auth.currentUser?.uid;
    if (!distributorId) {
      setDistributorInventoryProducts([]);
      return;
    }

    console.log('Fetching distributor inventory products for Distributor ID:', distributorId);
    const productsRef = collection(db, `businesses/${distributorId}/products`);
    const unsubscribe = onSnapshot(
      productsRef,
      (snapshot) => {
        const productsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log(`Found ${productsList.length} products in Distributor inventory`);
        setDistributorInventoryProducts(productsList);
      },
      (err) => {
        console.error('Error fetching distributor inventory products:', err);
        setDistributorInventoryProducts([]);
      }
    );

    return () => unsubscribe();
  }, []);

  const normalizePaymentMode = (mode) => {
    const modeLower = mode.toLowerCase();
    if (modeLower === 'cod' || modeLower === 'cash_on_delivery') {
      return {
        code: 'COD',
        label: 'Cash On Delivery',
        isCredit: false,
        creditDays: 0,
        advancePaid: 0,
        splitPayment: null,
      };
    } else if (modeLower === 'credit' || modeLower === 'credit_cycle') {
      return {
        code: 'CREDIT',
        label: 'Credit Cycle',
        isCredit: true,
        creditDays: creditDays || 15,
        advancePaid: 0,
        splitPayment: null,
      };
    } else if (modeLower === 'advance') {
      return {
        code: 'ADVANCE',
        label: 'Advance Payment',
        isCredit: false,
        creditDays: 0,
        advancePaid: advancePaid || 0,
        splitPayment: null,
      };
    }
    return {
      code: mode,
      label: mode,
      isCredit: false,
      creditDays: 0,
      advancePaid: 0,
      splitPayment: null,
    };
  };

  const getItemsSubTotal = () => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return sum + (qty * price);
    }, 0);
  };

  const handleAddItem = () => {
    setItems([...items, { productName: '', quantity: 1, unitPrice: 0, notes: '' }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate subtotal
    if (field === 'quantity' || field === 'unitPrice') {
      const qty = Number(updated[index].quantity) || 0;
      const price = Number(updated[index].unitPrice) || 0;
      updated[index].subtotal = qty * price;
    }
    
    setItems(updated);
  };

  // Filter inventory products based on search and source
  const getFilteredProducts = (products) => {
    const query = inventorySearchQuery.toLowerCase();
    return products.filter((product) => {
      const name = (product.name || product.productName || '').toLowerCase();
      const sku = (product.sku || '').toLowerCase();
      const brand = (product.brand || '').toLowerCase();
      const category = (product.category || '').toLowerCase();
      return name.includes(query) || sku.includes(query) || brand.includes(query) || category.includes(query);
    });
  };

  const filteredInventoryProducts = inventorySource === 'distributor' 
    ? getFilteredProducts(distributorInventoryProducts)
    : getFilteredProducts(inventoryProducts);

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
      subtotal: parseFloat(sellingPrice),
    };
    setItems([...items, newItem]);
    setShowInventoryModal(false);
    setInventorySearchQuery('');
    toast.success(`${product.name || product.productName} added to order`);
  };

  // Handle opening inventory modal for specific item index (for replacing)
  const handleOpenInventoryForItem = (itemIndex, source = 'productOwner') => {
    setSelectedInventoryItem(itemIndex);
    setInventorySource(source);
    setShowInventoryModal(true);
  };

  // Handle replacing item with inventory product
  const handleReplaceWithInventory = (product) => {
    const sellingPrice = product.sellingPrice || product.mrp || product.costPrice || 0;
    const updated = [...items];
    const existingQty = updated[selectedInventoryItem].quantity || 1;
    updated[selectedInventoryItem] = {
      productName: product.name || product.productName || '',
      quantity: existingQty,
      unitPrice: parseFloat(sellingPrice),
      notes: product.description || '',
      productId: product.id,
      sku: product.sku || '',
      subtotal: existingQty * parseFloat(sellingPrice),
    };
    setItems(updated);
    setShowInventoryModal(false);
    setSelectedInventoryItem(null);
    setInventorySearchQuery('');
    toast.success(`${product.name || product.productName} added to order`);
  };

    const handleSubmit = async (e) => {
    e.preventDefault();

    // Get productOwnerId from various possible fields
    const productOwnerId = productOwner?.productOwnerId || productOwner?.id;
    if (!productOwner || !productOwnerId) {
      console.error('Product Owner object:', productOwner);
      toast.error('Product Owner information missing');
      return;
    }

    const distributorId = auth.currentUser?.uid;
    if (!distributorId) {
      toast.error('Please log in again');
      return;
    }

    // Verify connection exists before proceeding
    console.log('[DistributorOrderRequestForm] Verifying connection...');
    try {
      const connectionRef = doc(db, `businesses/${distributorId}/connectedProductOwners/${productOwnerId}`);
      const connectionSnap = await getDoc(connectionRef);
      if (!connectionSnap.exists()) {
        console.error('[DistributorOrderRequestForm] Connection not found!');
        toast.error('You are not connected to this product owner. Please connect first.');
        return;
      }
      console.log('[DistributorOrderRequestForm] Connection verified:', connectionSnap.data());
    } catch (connErr) {
      console.error('[DistributorOrderRequestForm] Error verifying connection:', connErr);
      // Continue anyway - the Firestore rules will catch permission issues
    }

    // Validate items
    const validItems = items.filter(it => it.productName.trim() && it.quantity > 0 && it.unitPrice >= 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item');
      return;
    }

    // Validate payment mode specific fields
    if (paymentMode.toLowerCase() === 'credit' && (!creditDays || creditDays < 0)) {
      toast.error('Please specify credit days');
      return;
    }

    if (paymentMode.toLowerCase() === 'advance' && (!advancePaid || advancePaid < 0)) {
      toast.error('Please specify advance amount');
      return;
    }

    setSubmitting(true);

    try {
      console.log('[DistributorOrderRequestForm] Starting order submission...');
      console.log('[DistributorOrderRequestForm] Distributor ID:', distributorId);
      console.log('[DistributorOrderRequestForm] Product Owner ID:', productOwnerId);
      
      // Fetch Distributor's business information from Firestore
      console.log('[DistributorOrderRequestForm] Fetching distributor business data...');
      const distributorBusinessRef = doc(db, 'businesses', distributorId);
      const distributorBusinessSnap = await getDoc(distributorBusinessRef);
      const distributorBusinessData = distributorBusinessSnap.exists() ? distributorBusinessSnap.data() : {};
      console.log('[DistributorOrderRequestForm] Distributor business data:', distributorBusinessData);

      // Fetch Product Owner's business information from Firestore
      console.log('[DistributorOrderRequestForm] Fetching product owner business data...');
      const productOwnerBusinessRef = doc(db, 'businesses', productOwnerId);
      let productOwnerBusinessData = {};
      try {
        const productOwnerBusinessSnap = await getDoc(productOwnerBusinessRef);
        productOwnerBusinessData = productOwnerBusinessSnap.exists() ? productOwnerBusinessSnap.data() : {};
        console.log('[DistributorOrderRequestForm] Product Owner business data:', productOwnerBusinessData);
      } catch (fetchErr) {
        console.warn('[DistributorOrderRequestForm] Could not fetch product owner business data:', fetchErr);
        // Use fallback data from prop
        productOwnerBusinessData = {
          businessName: productOwner?.businessName || productOwner?.productOwnerName || productOwner?.ownerName,
          email: productOwner?.email || productOwner?.productOwnerEmail,
          phone: productOwner?.phone || productOwner?.productOwnerPhone,
        };
        console.log('[DistributorOrderRequestForm] Using fallback product owner data:', productOwnerBusinessData);
      }

      const itemsSubTotal = getItemsSubTotal();
      const orderId = doc(collection(db, `businesses/${productOwnerId}/distributorOrderRequests`)).id;
      
      const paymentPolicy = normalizePaymentMode(paymentMode);
      
      const orderPayload = {
        orderId,
        distributorId,
        productOwnerId: productOwnerId,
        createdBy: 'distributor',
        creatorUid: distributorId,
        items: validItems.map(it => ({
          productName: it.productName.trim(),
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          subtotal: Number(it.quantity) * Number(it.unitPrice),
          notes: it.notes?.trim() || '',
        })),
        itemsSubTotal,
        grandTotal: itemsSubTotal, // Can add charges later if needed
        paymentMode: paymentPolicy.code,
        paymentModeLabel: paymentPolicy.label,
        paymentNormalized: paymentPolicy,
        creditDays: paymentPolicy.creditDays,
        advancePaid: paymentPolicy.advancePaid,
        paymentFlags: {
          isCredit: !!paymentPolicy.isCredit,
          isAdvance: !!paymentPolicy.advancePaid > 0,
        },
        priority: priority || 'normal',
        notes: notes.trim() || '',
        status: 'REQUESTED',
        statusCode: ORDER_STATUSES.REQUESTED,
        // Distributor information
        distributorName: distributorBusinessData.businessName || distributorBusinessData.ownerName || 'Distributor',
        distributorEmail: distributorBusinessData.email || auth.currentUser?.email || '',
        distributorPhone: distributorBusinessData.phone || auth.currentUser?.phoneNumber || '',
        // Product Owner information
        productOwnerName: productOwnerBusinessData.businessName || productOwnerBusinessData.ownerName || productOwner.businessName || 'Product Owner',
        productOwnerEmail: productOwnerBusinessData.email || productOwner.email || '',
        productOwnerPhone: productOwnerBusinessData.phone || productOwner.phone || '',
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        statusTimestamps: {
          requestedAt: serverTimestamp(),
        },
        statusHistory: [{
          status: 'REQUESTED',
          updatedAt: Timestamp.now(),
          updatedBy: distributorId,
          updatedByName: distributorBusinessData.businessName || distributorBusinessData.ownerName || 'Distributor',
          notes: 'Order requested by distributor',
        }],
      };

      console.log('[DistributorOrderRequestForm] Order payload prepared:', {
        orderId,
        distributorId,
        productOwnerId,
        itemsCount: orderPayload.items.length,
        totalAmount: orderPayload.grandTotal,
      });

      // Save to Product Owner's distributorOrderRequests
      console.log('[DistributorOrderRequestForm] Saving to product owner\'s distributorOrderRequests...');
      try {
        await setDoc(doc(db, `businesses/${productOwnerId}/distributorOrderRequests/${orderId}`), orderPayload);
        console.log('[DistributorOrderRequestForm] Successfully saved to product owner\'s collection');
      } catch (createErr) {
        console.error('[DistributorOrderRequestForm] Error saving to product owner collection:', createErr);
        console.error('[DistributorOrderRequestForm] Error details:', {
          code: createErr.code,
          message: createErr.message,
          path: `businesses/${productOwnerId}/distributorOrderRequests/${orderId}`,
        });
        throw createErr;
      }

      // Mirror to distributor's sentOrdersToProductOwners
      console.log('[DistributorOrderRequestForm] Saving to distributor\'s sentOrdersToProductOwners...');
      try {
        await setDoc(doc(db, `businesses/${distributorId}/sentOrdersToProductOwners/${orderId}`), {
          ...orderPayload,
        });
        console.log('[DistributorOrderRequestForm] Successfully saved to distributor\'s collection');
      } catch (mirrorErr) {
        console.error('[DistributorOrderRequestForm] Error saving to distributor collection:', mirrorErr);
        // Don't throw here - the main order was created, this is just a mirror
        console.warn('[DistributorOrderRequestForm] Continuing despite mirror save error');
      }

      console.log('[DistributorOrderRequestForm] Order request sent successfully!');
      toast.success('Order request sent successfully!');
      
      if (onSuccess) {
        onSuccess();
      }
      
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('[DistributorOrderRequestForm] Error sending order request:', error);
      console.error('[DistributorOrderRequestForm] Error details:', {
        code: error.code,
        message: error.message,
        name: error.name,
        distributorId,
        productOwnerId,
      });
      
      // Provide more specific error messages
      if (error.code === 'permission-denied') {
        toast.error('Permission denied: Unable to send order request. Please ensure you are connected to this product owner.');
      } else if (error.code === 'unavailable') {
        toast.error('Service temporarily unavailable. Please check your connection and try again.');
      } else {
        toast.error(`Failed to send order request: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Send Order Request to Product Owner</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition"
          >
            <FaTimes size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Owner Info */}
          <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-blue-400/30 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <FaBox /> Product Owner Information
            </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-white/50">Business Name:</span>
                <p className="text-white font-medium">
                  {productOwnerInfo?.businessName || 
                   productOwnerInfo?.productOwnerName || 
                   productOwner?.businessName || 
                   productOwner?.productOwnerName || 
                   productOwner?.ownerName || 
                   'N/A'}
                </p>
              </div>
              <div>
                <span className="text-white/50">Email:</span>
                <p className="text-white">
                  {productOwnerInfo?.email || 
                   productOwnerInfo?.productOwnerEmail || 
                   productOwner?.email || 
                   productOwner?.productOwnerEmail || 
                   'N/A'}
                </p>
              </div>
              {(productOwnerInfo?.phone || productOwner?.phone) && (
                <div>
                  <span className="text-white/50">Phone:</span>
                  <p className="text-white">
                    {productOwnerInfo?.phone || 
                     productOwnerInfo?.productOwnerPhone || 
                     productOwner?.phone || 
                     productOwner?.productOwnerPhone || 
                     'N/A'}
                  </p>
                </div>
              )}
              {(productOwnerInfo?.productOwnerId || productOwner?.productOwnerId || productOwnerInfo?.id || productOwner?.id) && (
                <div>
                  <span className="text-white/50">FLYP ID:</span>
                  <p className="text-emerald-400 font-mono text-xs">
                    {(productOwnerInfo?.productOwnerId || productOwner?.productOwnerId || productOwnerInfo?.id || productOwner?.id || '').slice(0, 12)}...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FaBox /> Order Items
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedInventoryItem(null);
                    setInventorySource('productOwner');
                    setShowInventoryModal(true);
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition"
                  title="Select from Product Owner's inventory"
                >
                  <FaSearch /> Select from Product Owner Inventory
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedInventoryItem(null);
                    setInventorySource('distributor');
                    setShowInventoryModal(true);
                  }}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition"
                  title="Select from your own inventory"
                >
                  <FaSearch /> Select from My Inventory
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition"
                >
                  <FaPlus /> Add Manual Item
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-emerald-400/30 transition">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 grid grid-cols-12 gap-3 items-start">
                      <div className="col-span-5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Product Name"
                            value={item.productName}
                            onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-emerald-400"
                            required
                          />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenInventoryForItem(index, 'productOwner')}
                              className="px-2 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-blue-300 text-xs transition"
                              title="Select from Product Owner Inventory"
                            >
                              <FaSearch />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenInventoryForItem(index, 'distributor')}
                              className="px-2 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 rounded-lg text-purple-300 text-xs transition"
                              title="Select from My Inventory"
                            >
                              <FaSearch />
                            </button>
                          </div>
                        </div>
                        {item.productId && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-400/30 flex items-center gap-1">
                              <FaCheckCircle className="text-xs" /> From Inventory
                            </span>
                            {item.sku && (
                              <span className="text-xs text-white/50">SKU: {item.sku}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          min="1"
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-emerald-400"
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          placeholder="Unit Price"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-emerald-400"
                          required
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        <span className="text-emerald-400 font-semibold">
                          {formatINR((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                        </span>
                      </div>
                      <div className="col-span-1">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="w-full p-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-lg text-red-300 transition"
                            title="Remove Item"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
              <div className="text-right">
                <p className="text-white/70 text-sm">Subtotal:</p>
                <p className="text-2xl font-bold text-emerald-400">
                  ₹{getItemsSubTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Payment Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-2">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="COD">Cash On Delivery (COD)</option>
                  <option value="CREDIT">Credit Cycle</option>
                  <option value="ADVANCE">Advance Payment</option>
                </select>
              </div>

              {paymentMode.toLowerCase() === 'credit' && (
                <div>
                  <label className="block text-white/70 text-sm mb-2">Credit Days</label>
                  <input
                    type="number"
                    value={creditDays}
                    onChange={(e) => setCreditDays(Number(e.target.value))}
                    min="1"
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>
              )}

              {paymentMode.toLowerCase() === 'advance' && (
                <div>
                  <label className="block text-white/70 text-sm mb-2">Advance Amount (₹)</label>
                  <input
                    type="number"
                    value={advancePaid}
                    onChange={(e) => setAdvancePaid(Number(e.target.value))}
                    min="0"
                    step="0.01"
                    max={getItemsSubTotal()}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-400"
                    required
                  />
                </div>
              )}
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Additional Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm mb-2">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-white/70 text-sm mb-2">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any additional notes or instructions..."
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-emerald-400 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition"
            >
              {submitting ? 'Sending...' : 'Send Order Request'}
            </button>
          </div>
        </form>

        {/* Inventory Selection Modal */}
        <AnimatePresence>
          {showInventoryModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-gray-900 border border-white/20 rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
              >
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Select Product from {inventorySource === 'distributor' ? 'My Inventory' : "Product Owner's Inventory"}
                    </h3>
                    <p className="text-sm text-white/60 mt-1">
                      {inventorySource === 'distributor' 
                        ? 'Select products from your own inventory to request from the product owner'
                        : 'Select products from the product owner\'s inventory'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowInventoryModal(false);
                      setInventorySearchQuery('');
                      setSelectedInventoryItem(null);
                      setInventorySource(null);
                    }}
                    className="text-white/70 hover:text-white transition"
                  >
                    <FaTimes size={24} />
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                  <input
                    type="text"
                    placeholder="Search by name, SKU, brand, or category..."
                    value={inventorySearchQuery}
                    onChange={(e) => setInventorySearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>

                {/* Products Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {filteredInventoryProducts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredInventoryProducts.map((product) => {
                        const sellingPrice = product.sellingPrice || product.mrp || product.costPrice || 0;
                        const availableStock = product.quantity || product.stock || 0;
                        const isOutOfStock = availableStock <= 0;

                        return (
                          <motion.div
                            key={product.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.02 }}
                            onClick={() => {
                              if (!isOutOfStock) {
                                if (selectedInventoryItem !== null) {
                                  handleReplaceWithInventory(product);
                                } else {
                                  handleAddFromInventory(product);
                                }
                              }
                            }}
                            className={`p-4 rounded-xl border cursor-pointer transition ${
                              isOutOfStock
                                ? 'bg-red-500/10 border-red-400/30 opacity-60'
                                : 'bg-white/5 border-white/10 hover:border-emerald-400/50 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-white text-sm flex-1">
                                {product.name || product.productName || 'Unnamed Product'}
                              </h4>
                              {product.productId && (
                                <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-400/30">
                                  Inventory
                                </span>
                              )}
                            </div>
                            {product.sku && (
                              <p className="text-xs text-white/50 mb-1">SKU: {product.sku}</p>
                            )}
                            {(product.brand || product.category) && (
                              <p className="text-xs text-white/60 mb-2">
                                {product.brand && <span>{product.brand}</span>}
                                {product.brand && product.category && ' • '}
                                {product.category && <span>{product.category}</span>}
                              </p>
                            )}
                            <div className="flex items-center justify-between mt-3">
                              <div>
                                <p className="text-emerald-400 font-semibold">{formatINR(sellingPrice)}</p>
                                <p className={`text-xs ${isOutOfStock ? 'text-red-400' : 'text-white/50'}`}>
                                  Stock: {availableStock}
                                </p>
                              </div>
                              {isOutOfStock && (
                                <span className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded border border-red-400/30">
                                  Out of Stock
                                </span>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-white/50">
                      {inventorySearchQuery ? (
                        <div>
                          <FaSearch className="mx-auto mb-3 text-white/30" size={48} />
                          <p>No products found matching "{inventorySearchQuery}"</p>
                        </div>
                      ) : (
                        <div>
                          <FaBox className="mx-auto mb-3 text-white/30" size={48} />
                          <p>No products available in inventory</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default DistributorOrderRequestForm;

