import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../../firebase/firebaseConfig';
import { doc, updateDoc, serverTimestamp, arrayUnion, getDoc, Timestamp, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { FaTimes, FaBox, FaTruck, FaCheckCircle, FaClock, FaMapMarkerAlt, FaUser, FaDollarSign, FaInfoCircle, FaEdit, FaSave, FaPlus } from 'react-icons/fa';
import { ORDER_STATUSES, ORDER_TRANSITIONS, nextStatuses, canTransition } from '../../constants/orderStatus';
import { calculateProforma } from '../../lib/calcProforma';
import { splitFromMrp, calcBasePlusTax } from '../../utils/pricing';
import { PRICING_MODES } from '../../utils/pricing';

const OrderDetailModal = ({ order, onClose, onUpdate, readOnly = false, isDistributorOrderRequest = false }) => {
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [statusNotes, setStatusNotes] = useState('');
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [showQuoteEditor, setShowQuoteEditor] = useState(false);
  // Helper function to normalize order data (ensure arrays are valid)
  const normalizeOrderData = (orderData) => {
    if (!orderData) return null;
    
    // Normalize statusHistory - preserve Timestamp objects
    let normalizedStatusHistory = [];
    if (orderData.statusHistory) {
      if (Array.isArray(orderData.statusHistory)) {
        normalizedStatusHistory = orderData.statusHistory.map(entry => ({
          ...entry,
          // Ensure updatedAt is preserved as Timestamp if it exists
          updatedAt: entry.updatedAt || entry.at || entry.timestamp || entry.createdAt,
        }));
      } else if (typeof orderData.statusHistory === 'object') {
        // Convert object to array, preserving Timestamp objects
        normalizedStatusHistory = Object.values(orderData.statusHistory)
          .filter(item => item !== null && item !== undefined)
          .map(entry => ({
            ...entry,
            updatedAt: entry.updatedAt || entry.at || entry.timestamp || entry.createdAt,
          }));
      }
    }
    
    return {
      ...orderData,
      items: Array.isArray(orderData.items) ? orderData.items : (orderData.items ? [orderData.items] : []),
      statusHistory: normalizedStatusHistory,
    };
  };
  
  const [currentOrder, setCurrentOrder] = useState(() => normalizeOrderData(order));
  
  // Quote editor state
  const [quoteLines, setQuoteLines] = useState([]);
  const [quoteCharges, setQuoteCharges] = useState({
    delivery: 0,
    packing: 0,
    insurance: 0,
    other: 0,
    discountPct: 0,
    discountAmt: 0,
    discountChangedBy: 'pct',
  });
  const [roundingEnabled, setRoundingEnabled] = useState(false);
  const [rounding, setRounding] = useState('NEAREST');
  const [skipProforma, setSkipProforma] = useState(false);
  const [userData, setUserData] = useState(null);
  const [savingQuote, setSavingQuote] = useState(false);
  const [addingToInventory, setAddingToInventory] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);

  // Helper function to check for existing products and prepare inventory modal
  const handleAddToInventoryClick = async () => {
    console.log('[OrderDetailModal] handleAddToInventoryClick called', {
      currentOrder,
      hasItems: currentOrder?.items,
      itemsLength: currentOrder?.items?.length,
      items: currentOrder?.items,
      hasProforma: !!currentOrder?.proforma,
      proformaLines: currentOrder?.proforma?.lines
    });

    // Try multiple sources for items: items array, proforma.lines, or single item
    let itemsArray = [];
    
    if (Array.isArray(currentOrder?.items) && currentOrder.items.length > 0) {
      itemsArray = currentOrder.items;
    } else if (currentOrder?.items && typeof currentOrder.items === 'object') {
      // Single item object
      itemsArray = [currentOrder.items];
    } else if (Array.isArray(currentOrder?.proforma?.lines) && currentOrder.proforma.lines.length > 0) {
      // Try proforma lines as fallback
      itemsArray = currentOrder.proforma.lines.map(line => ({
        productName: line.name || line.productName,
        name: line.name || line.productName,
        quantity: line.qty || line.quantity,
        price: line.price,
        unitPrice: line.price,
        basePrice: line.basePrice || line.price,
        sellingPrice: line.sellingPrice || line.price,
        mrp: line.mrp,
        brand: line.brand || '',
        category: line.category || '',
        sku: line.sku || '',
        unit: line.uom || line.unit || 'unit',
        hsn: line.hsn || '',
        gstRate: line.gstRate || 0,
      }));
    }
    
    console.log('[OrderDetailModal] Extracted items array:', itemsArray);
    
    if (!currentOrder || itemsArray.length === 0) {
      console.error('[OrderDetailModal] No items found in order:', {
        currentOrder,
        items: currentOrder?.items,
        proformaLines: currentOrder?.proforma?.lines,
        itemsArray
      });
      toast.error('No items found in order. Please check if the order has any items.');
      return;
    }

    const distributorId = currentOrder.distributorId || auth.currentUser?.uid;
    if (!distributorId) {
      toast.error('Distributor ID not found');
      return;
    }

    try {
      const productsRef = collection(db, 'businesses', distributorId, 'products');
      
      // Check each item against existing inventory
      const itemsWithExisting = await Promise.all(
        itemsArray.map(async (item, idx) => {
          console.log(`[OrderDetailModal] Processing item ${idx}:`, item);
          
          // Extract product name from various possible fields
          const productName = item.productName || item.name || item.product?.name || 'Unnamed Product';
          const brand = item.brand || item.product?.brand || '';
          const quantity = Number(item.quantity || item.qty || 0);
          const basePrice = Number(item.basePrice || item.price || item.unitPrice || item.costPrice || 0);
          const sellingPrice = Number(item.sellingPrice || item.mrp || item.price || basePrice || 0);
          const sku = item.sku || item.product?.sku || `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
          const unit = item.unit || item.uom || item.product?.unit || 'unit';
          const hsn = item.hsn || item.hsnCode || item.product?.hsn || '';
          const category = item.category || item.product?.category || '';
          
          // Validate required fields
          if (!productName || productName === 'Unnamed Product') {
            console.warn(`[OrderDetailModal] Item ${idx} has invalid product name:`, item);
          }
          
          if (quantity <= 0) {
            console.warn(`[OrderDetailModal] Item ${idx} has invalid quantity:`, quantity, item);
          }

          // Check if product exists
          const q = query(productsRef, where('name', '==', productName), where('brand', '==', brand));
          const existingSnap = await getDocs(q);
          const existingProduct = !existingSnap.empty ? { id: existingSnap.docs[0].id, ...existingSnap.docs[0].data() } : null;

          return {
            ...item,
            // Order data
            productName,
            brand,
            category,
            quantity,
            basePrice,
            costPrice: basePrice || item.price || 0,
            sellingPrice,
            sku,
            unit,
            hsn,
            // Existing product info
            existingProduct,
            action: existingProduct ? 'update' : 'new', // 'update' or 'new'
            // Editable fields
            finalQuantity: quantity,
            finalCostPrice: basePrice || item.price || 0,
            finalSellingPrice: sellingPrice,
            finalSku: sku,
            finalUnit: unit,
            finalCategory: category,
            finalBrand: brand,
          };
        })
      );

      console.log('[OrderDetailModal] Items with existing checked:', itemsWithExisting);
      
      if (!itemsWithExisting || itemsWithExisting.length === 0) {
        console.error('[OrderDetailModal] No items processed:', {
          itemsArray,
          itemsWithExisting
        });
        toast.error('Failed to process items. Please check console for details.');
        return;
      }

      setInventoryItems(itemsWithExisting);
      setShowInventoryModal(true);
      console.log('[OrderDetailModal] Inventory modal opened with', itemsWithExisting.length, 'items');
    } catch (err) {
      console.error('[OrderDetailModal] Error checking existing products:', err);
      toast.error(`Failed to check existing products: ${err.message || 'Unknown error'}`);
    }
  };

  // Handle field changes in inventory modal
  const handleInventoryItemChange = (index, field, value) => {
    const updated = [...inventoryItems];
    updated[index][field] = value;
    
    // If action is 'update' and changing quantity, calculate total
    if (field === 'finalQuantity' && updated[index].action === 'update') {
      // Quantity will be added to existing
    }
    
    setInventoryItems(updated);
  };

  // Helper function to actually add items to inventory
  const handleAddToInventory = async () => {
    if (!inventoryItems || inventoryItems.length === 0) {
      toast.error('No items to add');
      return;
    }

    const distributorId = currentOrder?.distributorId || auth.currentUser?.uid;
    if (!distributorId) {
      toast.error('Distributor ID not found');
      return;
    }

    setAddingToInventory(true);
    try {
      const productsRef = collection(db, 'businesses', distributorId, 'products');
      let addedCount = 0;
      let updatedCount = 0;

      for (const item of inventoryItems) {
        try {
          const productName = item.productName;
          const brand = item.finalBrand || item.brand;
          const quantity = Number(item.finalQuantity || item.quantity || 0);
          const costPrice = Number(item.finalCostPrice || item.costPrice || 0);
          const sellingPrice = Number(item.finalSellingPrice || item.sellingPrice || 0);
          const sku = item.finalSku || item.sku;
          const unit = item.finalUnit || item.unit;
          const category = item.finalCategory || item.category || '';
          const hsn = item.hsn || '';

          if (item.action === 'update' && item.existingProduct) {
            // Update existing product
            const existingDoc = doc(productsRef, item.existingProduct.id);
            const existingData = item.existingProduct;
            
            // Calculate new quantity (add to existing)
            const updatedQty = Number(existingData.quantity || 0) + quantity;

            await updateDoc(existingDoc, {
              quantity: updatedQty,
              costPrice: costPrice, // Update with new cost price
              sellingPrice: sellingPrice, // Update selling price
              category: category || existingData.category || '',
              lastUpdatedFromOrder: currentOrder.id,
              lastUpdatedAt: serverTimestamp(),
            });

            updatedCount++;
            console.log(`[OrderDetailModal] Updated existing product: ${productName}`);
          } else {
            // Create new product
            const newProduct = {
              name: productName,
              productName: productName,
              sku: sku,
              quantity: quantity,
              unit: unit,
              costPrice: costPrice,
              sellingPrice: sellingPrice,
              brand: brand,
              category: category,
              hsn: hsn,
              imageUrl: item.imageUrl || '',
              distributorPrice: costPrice,
              sourceOrderId: currentOrder.id,
              sourceType: 'product_owner_order',
              createdAt: serverTimestamp(),
            };

            await setDoc(doc(productsRef), newProduct);
            addedCount++;
            console.log(`[OrderDetailModal] Created new product: ${productName}`);
          }
        } catch (itemError) {
          console.error(`[OrderDetailModal] Error adding item to inventory:`, itemError);
          toast.error(`Failed to add item: ${item.productName || 'Unknown'}`);
        }
      }

      // Mark order as inventory synced
      try {
        let orderRef;
        
        // Determine which collection to update
        if (isDistributorOrderRequest || (readOnly && currentOrder.productOwnerId)) {
          // Order sent by distributor to product owner
          orderRef = doc(db, `businesses/${distributorId}/sentOrdersToProductOwners/${currentOrder.id}`);
        } else if (readOnly) {
          // Assigned order from product owner
          orderRef = doc(db, `businesses/${distributorId}/productOwnerOrders/${currentOrder.id}`);
        }

        if (orderRef) {
          await updateDoc(orderRef, {
            inventorySynced: true,
            inventorySyncedAt: serverTimestamp(),
            'statusTimestamps.inventorySyncedAt': serverTimestamp(),
          });
        }
      } catch (syncError) {
        console.warn('[OrderDetailModal] Could not mark order as inventory synced:', syncError);
      }

      toast.success(`✅ Added ${addedCount} new product(s) and updated ${updatedCount} existing product(s) to inventory!`);
      setShowInventoryModal(false);
      setInventoryItems([]);
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('[OrderDetailModal] Error adding items to inventory:', err);
      toast.error('Failed to add items to inventory. Please try again.');
    } finally {
      setAddingToInventory(false);
    }
  };

  // Fetch product owner user data for state
  useEffect(() => {
    const fetchUserData = async () => {
      const productOwnerId = auth.currentUser?.uid;
      if (!productOwnerId) return;
      
      try {
        const userDocRef = doc(db, 'businesses', productOwnerId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserData(userDocSnap.data());
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchLatestOrderData = async () => {
      if (!order || !order.id) return;
      
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        let orderRef;
        
        if (readOnly) {
          // For Distributor view, check if it's a sent order to product owner
          if (order.productOwnerId) {
            // Distributor viewing their sent order to product owner
            orderRef = doc(db, `businesses/${userId}/sentOrdersToProductOwners/${order.id}`);
          } else {
            // Distributor viewing assigned order from product owner
            orderRef = doc(db, `businesses/${userId}/productOwnerOrders/${order.id}`);
          }
        } else if (isDistributorOrderRequest) {
          // For Product Owner viewing distributor order requests
          orderRef = doc(db, `businesses/${userId}/distributorOrderRequests/${order.id}`);
        } else {
          // For Product Owner view, fetch from their assignedOrdersToDistributors collection
          orderRef = doc(db, `businesses/${userId}/assignedOrdersToDistributors/${order.id}`);
        }
        
        const orderSnap = await getDoc(orderRef);
        
        if (orderSnap.exists()) {
          let latestOrderData = { id: orderSnap.id, ...orderSnap.data() };
          
          // Ensure items is always an array
          if (!Array.isArray(latestOrderData.items)) {
            latestOrderData.items = latestOrderData.items ? [latestOrderData.items] : [];
          }
          
          // Ensure statusHistory is always an array and preserve Timestamps
          if (!Array.isArray(latestOrderData.statusHistory)) {
            if (latestOrderData.statusHistory && typeof latestOrderData.statusHistory === 'object') {
              // If it's an object, convert to array and preserve Timestamps
              latestOrderData.statusHistory = Object.values(latestOrderData.statusHistory)
                .filter(item => item !== null && item !== undefined)
                .map(entry => ({
                  ...entry,
                  updatedAt: entry.updatedAt || entry.at || entry.timestamp || entry.createdAt,
                }));
            } else {
              latestOrderData.statusHistory = [];
            }
          } else {
            // Ensure all entries have updatedAt
            latestOrderData.statusHistory = latestOrderData.statusHistory.map(entry => ({
              ...entry,
              updatedAt: entry.updatedAt || entry.at || entry.timestamp || entry.createdAt,
            }));
          }
          
          // If readOnly (Distributor viewing), always fetch fresh Product Owner business info to ensure accuracy
          if (readOnly && latestOrderData.productOwnerId) {
            try {
              const productOwnerBusinessRef = doc(db, 'businesses', latestOrderData.productOwnerId);
              const productOwnerBusinessSnap = await getDoc(productOwnerBusinessRef);
              if (productOwnerBusinessSnap.exists()) {
                const poData = productOwnerBusinessSnap.data();
                // Always use fresh business data for accuracy (especially important for orders created before the fix)
                latestOrderData = {
                  ...latestOrderData,
                  productOwnerName: poData.businessName || poData.ownerName || latestOrderData.productOwnerName || 'Product Owner',
                  productOwnerEmail: poData.email || latestOrderData.productOwnerEmail || '',
                  productOwnerPhone: poData.phone || latestOrderData.productOwnerPhone || '',
                };
                console.log('Enhanced Product Owner info:', {
                  businessName: poData.businessName,
                  ownerName: poData.ownerName,
                  email: poData.email,
                  phone: poData.phone,
                  finalName: latestOrderData.productOwnerName
                });
              }
            } catch (err) {
              console.error('Error fetching product owner business info:', err);
              // Continue with existing data if fetch fails
            }
          }
          
          const normalizedData = normalizeOrderData(latestOrderData);
          setCurrentOrder(normalizedData);
          const currentStatus = latestOrderData.statusCode || latestOrderData.status || ORDER_STATUSES.ASSIGNED;
          setSelectedStatus(currentStatus);

          // Check if order is DELIVERED and create invoice if it doesn't exist (for product owner orders)
          if (readOnly && normalizedData.status === ORDER_STATUSES.DELIVERED && normalizedData.distributorId) {
            const distributorId = normalizedData.distributorId;
            const isProductOwnerOrder = !normalizedData.retailerId && normalizedData.productOwnerId;
            
            if (isProductOwnerOrder) {
              // Check if invoice exists, if not create it
              try {
                const invoicesCol = collection(db, 'businesses', distributorId, 'invoices');
                const invoiceRef = doc(invoicesCol, normalizedData.id);
                const invoiceSnap = await getDoc(invoiceRef);
                
                if (!invoiceSnap.exists()) {
                  console.log('[OrderDetailModal] Order is DELIVERED but no invoice found, creating invoice...');
                  await createInvoiceForProductOwnerOrder(distributorId, normalizedData.id, normalizedData);
                }
              } catch (invoiceErr) {
                console.error('[OrderDetailModal] Error checking/creating invoice for delivered order:', invoiceErr);
                // Don't fail the component load if invoice creation fails
              }
            }
          }
        } else {
          // Fallback to prop order if document doesn't exist
          setCurrentOrder(normalizeOrderData(order));
          const currentStatus = order.statusCode || order.status || (isDistributorOrderRequest ? ORDER_STATUSES.REQUESTED : ORDER_STATUSES.ASSIGNED);
          setSelectedStatus(currentStatus);
        }
      } catch (error) {
        console.error('Error fetching latest order data:', error);
        // Fallback to prop order on error
        setCurrentOrder(normalizeOrderData(order));
        const currentStatus = order?.statusCode || order?.status || (isDistributorOrderRequest ? ORDER_STATUSES.REQUESTED : ORDER_STATUSES.ASSIGNED);
        setSelectedStatus(currentStatus);
      }
    };
    
    fetchLatestOrderData();
  }, [order, readOnly, isDistributorOrderRequest]);

  // Initialize quote editor when opening for REQUESTED orders
  useEffect(() => {
    if (showQuoteEditor && currentOrder && Array.isArray(currentOrder.items) && currentOrder.items.length > 0) {
      const initialLines = currentOrder.items.map((it) => {
        // Determine pricing mode from product data
        const pricingMode = it.pricingMode || PRICING_MODES.LEGACY;
        const gstRate = Number(it.gstRate || 0);
        
        // Get price based on pricing mode
        let price = 0;
        if (pricingMode === PRICING_MODES.MRP_INCLUSIVE && it.mrp) {
          price = Number(it.mrp);
        } else if (pricingMode === PRICING_MODES.BASE_PLUS_TAX && it.basePrice) {
          price = Number(it.basePrice);
        } else {
          price = Number(it.unitPrice || it.price || it.sellingPrice || 0);
        }
        
        return {
          name: it.productName || it.name || 'Item',
          sku: it.sku || '',
          hsn: it.hsn || it.hsnCode || '',
          uom: it.uom || it.unit || '',
          qty: Number(it.quantity || it.qty || 0),
          price: price,
          pricingMode: pricingMode,
          mrp: Number(it.mrp || 0),
          basePrice: Number(it.basePrice || 0),
          itemDiscountPct: Number(it.itemDiscountPct || 0),
          itemDiscountAmt: Number(it.itemDiscountAmt || 0),
          itemDiscountChangedBy: it.itemDiscountChangedBy || 'pct',
          gstRate: gstRate,
        };
      });
      setQuoteLines(initialLines);
      
      // Initialize charges from existing order or defaults
      if (currentOrder.chargesSnapshot?.breakdown) {
        const breakdown = currentOrder.chargesSnapshot.breakdown;
        setQuoteCharges({
          delivery: Number(breakdown.delivery || 0),
          packing: Number(breakdown.packing || 0),
          insurance: Number(breakdown.insurance || 0),
          other: Number(breakdown.other || 0),
          discountPct: Number(breakdown.discountPct || 0),
          discountAmt: Number(breakdown.discountAmt || 0),
          discountChangedBy: breakdown.discountChangedBy || 'pct',
        });
      }
    }
  }, [showQuoteEditor, currentOrder]);

  const formatINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n || 0));
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      let d;
      // Handle Firestore Timestamp
      if (date && typeof date === 'object' && date.toDate) {
        d = date.toDate();
      } 
      // Handle Timestamp with seconds/nanoseconds
      else if (date && typeof date === 'object' && (date.seconds || date._seconds)) {
        d = new Date((date.seconds || date._seconds) * 1000);
      }
      // Handle ISO string or number
      else if (typeof date === 'string' || typeof date === 'number') {
        d = new Date(date);
      }
      // Handle Date object
      else if (date instanceof Date) {
        d = date;
      }
      else {
        return 'N/A';
      }
      
      // Check if date is valid
      if (isNaN(d.getTime())) {
        return 'N/A';
      }
      
      return d.toLocaleString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return 'N/A';
    }
  };

  const getStatusColor = (status) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'REQUESTED': return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
      case 'QUOTED': return 'bg-blue-500/20 text-blue-300 border-blue-400/30';
      case 'ACCEPTED': return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
      case 'REJECTED': return 'bg-red-500/20 text-red-300 border-red-400/30';
      case 'DIRECT': return 'bg-purple-500/20 text-purple-300 border-purple-400/30';
      case 'ASSIGNED': return 'bg-blue-500/20 text-blue-300 border-blue-400/30';
      case 'PACKED': return 'bg-purple-500/20 text-purple-300 border-purple-400/30';
      case 'SHIPPED': return 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30';
      case 'OUT_FOR_DELIVERY': return 'bg-orange-500/20 text-orange-300 border-orange-400/30';
      case 'DELIVERED': return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
      case 'INVOICED': return 'bg-green-500/20 text-green-300 border-green-400/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-400/30';
    }
  };

  const getStatusIcon = (status) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'REQUESTED': return <FaClock className="text-sm" />;
      case 'QUOTED': return <FaDollarSign className="text-sm" />;
      case 'ACCEPTED': return <FaCheckCircle className="text-sm" />;
      case 'REJECTED': return <FaTimes className="text-sm" />;
      case 'DIRECT': return <FaCheckCircle className="text-sm" />;
      case 'ASSIGNED': return <FaBox className="text-sm" />;
      case 'PACKED': return <FaBox className="text-sm" />;
      case 'SHIPPED': return <FaTruck className="text-sm" />;
      case 'OUT_FOR_DELIVERY': return <FaMapMarkerAlt className="text-sm" />;
      case 'DELIVERED': return <FaCheckCircle className="text-sm" />;
      case 'INVOICED': return <FaCheckCircle className="text-sm" />;
      default: return <FaClock className="text-sm" />;
    }
  };

  const getStatusLabel = (status) => {
    const s = (status || '').toUpperCase();
    const labels = {
      'REQUESTED': 'Requested',
      'QUOTED': 'Quoted',
      'ACCEPTED': 'Accepted',
      'REJECTED': 'Rejected',
      'DIRECT': 'Direct (Proforma Skipped)',
      'ASSIGNED': 'Assigned',
      'PACKED': 'Packed',
      'SHIPPED': 'Shipped',
      'OUT_FOR_DELIVERY': 'Out for Delivery',
      'DELIVERED': 'Delivered',
      'INVOICED': 'Invoiced',
    };
    return labels[s] || s.replace(/_/g, ' ');
  };

  const currentStatus = currentOrder?.statusCode || currentOrder?.status || ORDER_STATUSES.ASSIGNED;
  const availableNextStatuses = nextStatuses(currentStatus);

  // Get states for tax calculation (Product Owner is seller, Distributor is buyer)
  const productOwnerState = userData?.state || currentOrder?.productOwnerState || 'Maharashtra';
  const distributorState = currentOrder?.distributorState || currentOrder?.state || productOwnerState;

  // Quote preview calculation
  const quotePreview = useMemo(() => {
    if (!showQuoteEditor || quoteLines.length === 0) return null;
    
    try {
      const preview = calculateProforma({
        lines: quoteLines,
        orderCharges: quoteCharges,
        distributorState: productOwnerState, // Product Owner is the seller
        retailerState: distributorState, // Distributor is the buyer
        roundingEnabled,
        rounding,
      });
      return preview || {
        grossItems: 0,
        lineDiscountTotal: 0,
        itemsSubTotal: 0,
        discountTotal: 0,
        taxableBase: 0,
        taxType: 'CGST_SGST',
        taxBreakup: { cgst: 0, sgst: 0, igst: 0 },
        roundOff: 0,
        grandTotal: 0,
        orderCharges: { delivery: 0, packing: 0, insurance: 0, other: 0 },
      };
    } catch (e) {
      console.error('Quote preview calculation failed:', e);
      return null;
    }
  }, [quoteLines, quoteCharges, productOwnerState, distributorState, roundingEnabled, rounding, showQuoteEditor]);

  // Calculate order-level discount amount in real-time (after quotePreview is defined)
  const orderDiscountAmount = useMemo(() => {
    if (!quotePreview) return 0;
    const preDiscount = (quotePreview.itemsSubTotal || 0) + 
                       (quoteCharges.delivery || 0) + 
                       (quoteCharges.packing || 0) + 
                       (quoteCharges.insurance || 0) + 
                       (quoteCharges.other || 0);
    
    if (quoteCharges.discountChangedBy === 'pct') {
      return Math.round((preDiscount * (quoteCharges.discountPct || 0) / 100) * 100) / 100;
    }
    return quoteCharges.discountAmt || 0;
  }, [quotePreview, quoteCharges]);

  const handleStatusUpdate = async (newStatus) => {
    if (!currentOrder || !currentOrder.id || !currentOrder.distributorId) {
      toast.error('Order information missing');
      return;
    }

    const currentStatusCode = currentOrder.statusCode || currentOrder.status || ORDER_STATUSES.ASSIGNED;
    
    if (!canTransition(currentStatusCode, newStatus)) {
      toast.error(`Cannot transition from ${getStatusLabel(currentStatusCode)} to ${getStatusLabel(newStatus)}`);
      return;
    }

    setUpdating(true);
    try {
      const currentUserId = auth.currentUser?.uid;
      const distributorId = currentOrder.distributorId;
      const productOwnerId = currentOrder.productOwnerId || (readOnly ? currentOrder.productOwnerId : currentUserId);
      
      // Determine who is updating (distributor or product owner)
      const isDistributorUpdating = readOnly && distributorId === currentUserId;

      // Update status timestamp - convert status to camelCase timestamp key
      const statusTimestamps = { ...(currentOrder.statusTimestamps || {}) };
      // Convert "OUT_FOR_DELIVERY" to "outForDeliveryAt", "PACKED" to "packedAt", etc.
      const statusKey = newStatus
        .toLowerCase()
        .split('_')
        .map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
        .join('') + 'At';
      statusTimestamps[statusKey] = serverTimestamp();

      // Create status history entry
      // Note: Cannot use serverTimestamp() inside arrayUnion(), must use Timestamp.now()
      const updaterName = isDistributorUpdating 
        ? (currentOrder.distributorName || 'Distributor')
        : (userData?.businessName || userData?.ownerName || 'Product Owner');
      
      const statusHistoryEntry = {
        status: newStatus,
        updatedAt: Timestamp.now(),
        updatedBy: currentUserId,
        updatedByName: updaterName,
        notes: statusNotes.trim() || null,
      };

      const updateData = {
        status: newStatus,
        statusCode: newStatus,
        statusTimestamps: statusTimestamps,
        statusHistory: arrayUnion(statusHistoryEntry),
        lastUpdated: serverTimestamp(),
      };

      // Determine which collections to update based on order type and who is updating
      let poOrderRef;
      let distributorOrderRef;
      
      if (isDistributorOrderRequest || (readOnly && currentOrder.productOwnerId)) {
        // Distributor order request flow
        const poId = currentOrder.productOwnerId || productOwnerId;
        poOrderRef = doc(db, `businesses/${poId}/distributorOrderRequests/${currentOrder.id}`);
        distributorOrderRef = doc(db, `businesses/${distributorId}/sentOrdersToProductOwners/${currentOrder.id}`);
      } else {
        // Assigned order flow (Product Owner -> Distributor)
        poOrderRef = doc(db, `businesses/${productOwnerId}/assignedOrdersToDistributors/${currentOrder.id}`);
        distributorOrderRef = doc(db, `businesses/${distributorId}/productOwnerOrders/${currentOrder.id}`);
      }

      // Update in Product Owner's collection
      try {
        await updateDoc(poOrderRef, updateData);
      } catch (poError) {
        console.error('Error updating Product Owner collection:', poError);
        throw new Error(`Failed to update Product Owner order: ${poError.message}`);
      }

      // Update in Distributor's collection (mirror)
      try {
        await updateDoc(distributorOrderRef, updateData);
      } catch (distError) {
        console.error('Error updating Distributor collection:', distError);
        // Log but don't fail - the PO update already succeeded
        console.warn('Note: Distributor mirror update failed, but PO update succeeded');
      }

      // Refresh order data
      const updatedOrderSnap = await getDoc(poOrderRef);
      if (updatedOrderSnap.exists()) {
        const updatedData = normalizeOrderData({ id: updatedOrderSnap.id, ...updatedOrderSnap.data() });
        setCurrentOrder(updatedData);
      }

      // Create invoice automatically when order is marked as DELIVERED (for product owner orders)
      if (newStatus === ORDER_STATUSES.DELIVERED && isDistributorUpdating && distributorOrderRef) {
        try {
          // Check if this is a product owner order (not a retailer order)
          // Handle both cases:
          // 1. sentOrdersToProductOwners - orders sent by distributor to product owner
          // 2. productOwnerOrders - orders assigned by product owner to distributor
          const isProductOwnerOrder = !currentOrder.retailerId && 
                                      currentOrder.productOwnerId && 
                                      (distributorOrderRef.path.includes('productOwnerOrders') || 
                                       distributorOrderRef.path.includes('sentOrdersToProductOwners'));
          
          if (isProductOwnerOrder) {
            // Fetch latest order data after update to ensure we have the most recent information
            const latestOrderSnap = await getDoc(distributorOrderRef);
            const latestOrderData = latestOrderSnap.exists() ? { id: latestOrderSnap.id, ...latestOrderSnap.data() } : currentOrder;
            await createInvoiceForProductOwnerOrder(distributorId, currentOrder.id, latestOrderData);
            console.log('[OrderDetailModal] Invoice creation triggered for product owner order:', currentOrder.id);
          }
        } catch (invoiceError) {
          console.error('[OrderDetailModal] Error creating invoice for product owner order:', invoiceError);
          // Don't fail the status update if invoice creation fails - just log the error
        }
      }

      toast.success(`Order status updated to ${getStatusLabel(newStatus)}`);
      setShowStatusUpdate(false);
      setStatusNotes('');
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        orderId: currentOrder?.id,
        distributorId: currentOrder?.distributorId,
        productOwnerId: auth.currentUser?.uid,
      });
      toast.error(`Failed to update order status: ${error.message || 'Please try again.'}`);
    } finally {
      setUpdating(false);
    }
  };

  // Quote editor handlers
  const updateQuoteLine = (index, field, value) => {
    setQuoteLines((prev) => {
      const next = [...prev];
      const updated = { ...next[index] };
      
      if (['qty', 'price', 'mrp', 'basePrice', 'itemDiscountPct', 'itemDiscountAmt', 'gstRate'].includes(field)) {
        let num = Number(value || 0);
        if (!Number.isFinite(num)) num = 0;
        if (['qty', 'price', 'mrp', 'basePrice'].includes(field)) num = Math.max(0, num);
        if (field === 'itemDiscountPct') {
          num = Math.min(100, Math.max(0, num));
          // Auto-calculate discount amount when percentage changes
          const gross = (updated.qty || 0) * (updated.price || 0);
          updated.itemDiscountAmt = Math.round((gross * num / 100) * 100) / 100;
          updated.itemDiscountChangedBy = 'pct';
        }
        if (field === 'itemDiscountAmt') {
          num = Math.max(0, num);
          // Auto-calculate discount percentage when amount changes
          const gross = (updated.qty || 0) * (updated.price || 0);
          if (gross > 0) {
            updated.itemDiscountPct = Math.round((num / gross * 100) * 100) / 100;
          }
          updated.itemDiscountChangedBy = 'amt';
        }
        if (field === 'gstRate') num = Math.min(28, Math.max(0, num));
        
        // Handle pricing mode changes
        if (field === 'pricingMode') {
          updated.pricingMode = value;
          // Recalculate price based on mode
          if (value === PRICING_MODES.MRP_INCLUSIVE && updated.mrp) {
            updated.price = updated.mrp;
          } else if (value === PRICING_MODES.BASE_PLUS_TAX && updated.basePrice) {
            updated.price = updated.basePrice;
          }
        }
        
        // Handle MRP/Base Price changes - update price accordingly
        if (field === 'mrp' && updated.pricingMode === PRICING_MODES.MRP_INCLUSIVE) {
          updated.price = num;
        }
        if (field === 'basePrice' && updated.pricingMode === PRICING_MODES.BASE_PLUS_TAX) {
          updated.price = num;
        }
        
        updated[field] = num;
      } else {
        updated[field] = value;
      }
      
      next[index] = updated;
      return next;
    });
  };

  const updateQuoteCharge = (field, value) => {
    let num = Number(value || 0);
    if (!Number.isFinite(num)) num = 0;
    num = Math.max(0, num);
    
    if (field === 'discountPct') {
      num = Math.min(100, num);
      // Auto-calculate discount amount when percentage changes
      const preDiscount = (quotePreview?.itemsSubTotal || 0) + 
                         (quoteCharges.delivery || 0) + 
                         (quoteCharges.packing || 0) + 
                         (quoteCharges.insurance || 0) + 
                         (quoteCharges.other || 0);
      const calculatedAmt = Math.round((preDiscount * num / 100) * 100) / 100;
      setQuoteCharges((prev) => ({ 
        ...prev, 
        discountPct: num, 
        discountAmt: calculatedAmt,
        discountChangedBy: 'pct' 
      }));
    } else if (field === 'discountAmt') {
      // Auto-calculate discount percentage when amount changes
      const preDiscount = (quotePreview?.itemsSubTotal || 0) + 
                         (quoteCharges.delivery || 0) + 
                         (quoteCharges.packing || 0) + 
                         (quoteCharges.insurance || 0) + 
                         (quoteCharges.other || 0);
      const calculatedPct = preDiscount > 0 ? Math.round((num / preDiscount * 100) * 100) / 100 : 0;
      setQuoteCharges((prev) => ({ 
        ...prev, 
        discountAmt: num, 
        discountPct: calculatedPct,
        discountChangedBy: 'amt' 
      }));
    } else {
      setQuoteCharges((prev) => ({ ...prev, [field]: num }));
    }
  };

  // Handle quote submission
  const handleSubmitQuote = async () => {
    if (!currentOrder || !currentOrder.id || !currentOrder.distributorId) {
      toast.error('Order information missing');
      return;
    }

    if (!quotePreview) {
      toast.error('Please review the quote before submitting');
      return;
    }

    setSavingQuote(true);
    try {
      const productOwnerId = auth.currentUser?.uid;
      const distributorId = currentOrder.distributorId;
      const finalStatus = skipProforma ? ORDER_STATUSES.DIRECT : ORDER_STATUSES.QUOTED;

      // Helper function to remove undefined values from object (defined early for use)
      const removeUndefined = (obj) => {
        if (obj === null || obj === undefined) return null;
        // Handle Firestore special types
        if (obj instanceof Timestamp || (typeof obj === 'object' && obj !== null && (obj.toDate || obj.toMillis))) {
          return obj;
        }
        // Handle arrays
        if (Array.isArray(obj)) {
          return obj.map(item => removeUndefined(item)).filter(item => item !== undefined && item !== null);
        }
        // Handle objects
        if (typeof obj === 'object') {
          const cleaned = {};
          for (const key in obj) {
            if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
              const cleanedValue = removeUndefined(obj[key]);
              if (cleanedValue !== undefined && cleanedValue !== null) {
                cleaned[key] = cleanedValue;
              }
            }
          }
          return cleaned;
        }
        return obj;
      };

      // Build updated items with quote modifications
      const updatedItems = quoteLines.map((line, idx) => {
        const originalItem = currentOrder.items[idx] || {};
        const lineResult = quotePreview.lines?.[idx] || {};
        
        // Build item object, explicitly setting each field to avoid undefined from originalItem
        const itemData = {
          productName: line.name || originalItem.productName || '',
          quantity: line.qty || originalItem.quantity || 0,
          unitPrice: line.price || originalItem.unitPrice || 0,
          sellingPrice: line.price || originalItem.sellingPrice || originalItem.unitPrice || 0,
          pricingMode: line.pricingMode || originalItem.pricingMode || PRICING_MODES.LEGACY,
          itemDiscountPct: line.itemDiscountPct !== undefined ? line.itemDiscountPct : (originalItem.itemDiscountPct || 0),
          itemDiscountAmt: line.itemDiscountAmt !== undefined ? line.itemDiscountAmt : (lineResult.discountAmount || originalItem.itemDiscountAmt || 0),
          itemDiscountChangedBy: line.itemDiscountChangedBy || originalItem.itemDiscountChangedBy || 'pct',
          gstRate: line.gstRate !== undefined ? line.gstRate : (originalItem.gstRate || 0),
          sku: line.sku || originalItem.sku || '',
          hsn: line.hsn || line.hsnCode || originalItem.hsn || originalItem.hsnCode || '',
          uom: line.uom || originalItem.uom || originalItem.unit || '',
          subtotal: lineResult.taxable || (line.qty * line.price * (1 - ((line.itemDiscountPct || 0) / 100))) || originalItem.subtotal || 0,
          gross: lineResult.gross || (line.qty * line.price) || originalItem.gross || 0,
        };
        
        // Only add mrp if it exists and is relevant
        if (line.pricingMode === PRICING_MODES.MRP_INCLUSIVE) {
          itemData.mrp = line.mrp || line.price || originalItem.mrp || 0;
        } else if (line.mrp !== undefined) {
          itemData.mrp = line.mrp;
        } else if (originalItem.mrp !== undefined) {
          itemData.mrp = originalItem.mrp;
        }
        
        // Only add basePrice if it exists and is relevant
        if (line.pricingMode === PRICING_MODES.BASE_PLUS_TAX) {
          itemData.basePrice = line.basePrice || line.price || originalItem.basePrice || 0;
        } else if (line.basePrice !== undefined) {
          itemData.basePrice = line.basePrice;
        } else if (originalItem.basePrice !== undefined) {
          itemData.basePrice = originalItem.basePrice;
        }
        
        // Remove any undefined values from the item
        return removeUndefined(itemData);
      });

      // Build charges snapshot
      const chargesSnapshot = {
        breakdown: {
          grossItems: quotePreview.grossItems || 0,
          lineDiscountTotal: quotePreview.lineDiscountTotal || 0,
          itemsSubTotal: quotePreview.itemsSubTotal || 0,
          subTotal: quotePreview.subTotal || quotePreview.itemsSubTotal || 0,
          delivery: quoteCharges.delivery,
          packing: quoteCharges.packing,
          insurance: quoteCharges.insurance,
          other: quoteCharges.other,
          discountPct: quoteCharges.discountPct,
          discountAmt: quoteCharges.discountAmt,
          discountChangedBy: quoteCharges.discountChangedBy,
          roundOff: quotePreview.roundOff || 0,
          taxableBase: quotePreview.taxableBase || 0,
          taxType: quotePreview.taxType || 'CGST_SGST',
          taxBreakup: quotePreview.taxBreakup || { cgst: 0, sgst: 0, igst: 0 },
          grandTotal: quotePreview.grandTotal || 0,
        },
        defaultsUsed: {
          enabled: true,
          skipProforma: skipProforma,
          autodetectTaxType: true,
          deliveryFee: quoteCharges.delivery,
          packingFee: quoteCharges.packing,
          insuranceFee: quoteCharges.insurance,
          otherFee: quoteCharges.other,
          discountPct: quoteCharges.discountPct,
          discountAmt: quoteCharges.discountAmt,
          roundEnabled: roundingEnabled,
          roundRule: rounding.toLowerCase(),
        },
        version: 1,
      };

      // Build update payload
      const statusTimestamps = { ...(currentOrder.statusTimestamps || {}) };
      const statusKey = finalStatus.toLowerCase().split('_').map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'At';
      statusTimestamps[statusKey] = serverTimestamp();

      const statusHistoryEntry = {
        status: finalStatus,
        updatedAt: Timestamp.now(),
        updatedBy: productOwnerId,
        updatedByName: userData?.businessName || userData?.ownerName || 'Product Owner',
        notes: statusNotes.trim() || (skipProforma ? 'Proforma skipped - defaults applied' : 'Quote sent to distributor'),
      };


      // Build proforma object, ensuring no undefined values
      const proformaData = {
        lines: quotePreview.lines || [],
        orderCharges: quotePreview.orderCharges || {},
        grossItems: quotePreview.grossItems || 0,
        lineDiscountTotal: quotePreview.lineDiscountTotal || 0,
        itemsSubTotal: quotePreview.itemsSubTotal || 0,
        subTotal: quotePreview.subTotal || quotePreview.itemsSubTotal || 0,
        discountTotal: quotePreview.discountTotal || 0,
        taxableBase: quotePreview.taxableBase || 0,
        taxType: quotePreview.taxType || 'CGST_SGST',
        taxBreakup: quotePreview.taxBreakup || { cgst: 0, sgst: 0, igst: 0 },
        roundOff: quotePreview.roundOff || 0,
        grandTotal: quotePreview.grandTotal || 0,
      };

      // Clean all nested objects before building updateData
      const cleanedChargesSnapshot = removeUndefined(chargesSnapshot);
      const cleanedProformaData = removeUndefined(proformaData);
      const cleanedStatusTimestamps = removeUndefined(statusTimestamps);
      
      const updateData = removeUndefined({
        items: updatedItems,
        itemsSubTotal: quotePreview.itemsSubTotal || 0,
        grandTotal: quotePreview.grandTotal || 0,
        status: finalStatus,
        statusCode: finalStatus,
        statusTimestamps: cleanedStatusTimestamps,
        statusHistory: arrayUnion(statusHistoryEntry),
        chargesSnapshot: cleanedChargesSnapshot,
        proforma: cleanedProformaData,
        lastUpdated: serverTimestamp(),
        quotedAt: serverTimestamp(),
        quotedBy: productOwnerId,
      });
      
      // Final safety check - ensure no undefined values remain
      // Deep clean the updateData one more time to catch any missed undefined values
      const deepClean = (obj, path = '') => {
        if (obj === null) return null;
        if (obj === undefined) {
          console.warn(`[OrderDetailModal] Found undefined at path: ${path}`);
          return null; // Return null instead of undefined
        }
        // Handle Firestore special types (serverTimestamp, arrayUnion, FieldValue, etc.)
        if (typeof obj === 'function') {
          return obj; // Keep functions (like serverTimestamp, arrayUnion)
        }
        // Check for Firestore FieldValue types
        if (typeof obj === 'object' && obj !== null) {
          // Check if it's a Firestore special type
          if (obj.toDate || obj.toMillis || obj.type || obj._methodName) {
            return obj; // Keep Firestore special types
          }
        }
        if (Array.isArray(obj)) {
          return obj.map((item, idx) => deepClean(item, `${path}[${idx}]`));
        }
        if (typeof obj === 'object') {
          const cleaned = {};
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              if (obj[key] === undefined) {
                console.warn(`[OrderDetailModal] Skipping undefined value at: ${path}.${key}`);
                continue; // Skip undefined values
              }
              cleaned[key] = deepClean(obj[key], `${path}.${key}`);
            }
          }
          return cleaned;
        }
        return obj;
      };
      
      const finalUpdateData = deepClean(updateData);
      
      console.log('[OrderDetailModal] Submitting quote - final updateData keys:', Object.keys(finalUpdateData));
      console.log('[OrderDetailModal] Items count:', finalUpdateData.items?.length || 0);

      // Update in Product Owner's distributorOrderRequests collection
      const poOrderRef = doc(db, `businesses/${productOwnerId}/distributorOrderRequests/${currentOrder.id}`);
      console.log('[OrderDetailModal] Updating PO order document:', poOrderRef.path);
      await updateDoc(poOrderRef, finalUpdateData);

      // Update in Distributor's sentOrdersToProductOwners collection (mirror update)
      // Note: Product owner can update this because they're updating the quote they created
      const distributorOrderRef = doc(db, `businesses/${distributorId}/sentOrdersToProductOwners/${currentOrder.id}`);
      
      // Check if document exists, if not create it
      const distributorOrderSnap = await getDoc(distributorOrderRef);
      console.log('[OrderDetailModal] Updating distributor order document:', distributorOrderRef.path, 'exists:', distributorOrderSnap.exists());
      if (distributorOrderSnap.exists()) {
        await updateDoc(distributorOrderRef, finalUpdateData);
      } else {
        // If document doesn't exist, create it with the update data
        const createData = deepClean({
          ...finalUpdateData,
          distributorId: distributorId,
          productOwnerId: productOwnerId,
          createdAt: serverTimestamp(),
        });
        await setDoc(distributorOrderRef, createData);
      }

      // Refresh order data
      const updatedOrderSnap = await getDoc(poOrderRef);
      if (updatedOrderSnap.exists()) {
        const updatedData = normalizeOrderData({ id: updatedOrderSnap.id, ...updatedOrderSnap.data() });
        setCurrentOrder(updatedData);
      }

      toast.success(`Quote ${skipProforma ? 'sent (Proforma skipped)' : 'sent'} successfully!`);
      setShowQuoteEditor(false);
      setStatusNotes('');
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error submitting quote:', error);
      toast.error(`Failed to submit quote: ${error.message || 'Please try again.'}`);
    } finally {
      setSavingQuote(false);
    }
  };

  // Helper function to create invoice for product owner orders
  const createInvoiceForProductOwnerOrder = async (distributorId, orderId, orderData) => {
    try {
      const invoicesCol = collection(db, 'businesses', distributorId, 'invoices');
      const invoiceRef = doc(invoicesCol, orderId);
      const existingInvoiceSnap = await getDoc(invoiceRef);

      if (!existingInvoiceSnap.exists()) {
        console.log('[OrderDetailModal] Creating invoice for product owner order:', orderId);

        // Fetch distributor profile for seller info
        const distributorProfileSnap = await getDoc(doc(db, 'businesses', distributorId));
        const distributorProfile = distributorProfileSnap.exists() ? distributorProfileSnap.data() : {};

        // Fetch product owner profile for buyer info
        const productOwnerId = orderData.productOwnerId;
        let productOwnerProfile = {};
        if (productOwnerId) {
          try {
            const poProfileSnap = await getDoc(doc(db, 'businesses', productOwnerId));
            productOwnerProfile = poProfileSnap.exists() ? poProfileSnap.data() : {};
          } catch (err) {
            console.warn('[OrderDetailModal] Could not fetch product owner profile:', err);
          }
        }

        // Build buyer info (Product Owner)
        const buyerInfo = {
          businessId: productOwnerId || null,
          businessName: productOwnerProfile.businessName || orderData.productOwnerName || 'Product Owner',
          email: productOwnerProfile.email || orderData.productOwnerEmail || null,
          phone: productOwnerProfile.phone || orderData.productOwnerPhone || null,
          city: productOwnerProfile.city || orderData.productOwnerCity || null,
          state: productOwnerProfile.state || orderData.productOwnerState || null,
        };

        // Build seller info (Distributor)
        const sellerInfo = {
          businessId: distributorId,
          businessName: distributorProfile.businessName || distributorProfile.ownerName || distributorProfile.name || null,
          email: distributorProfile.email || null,
          phone: distributorProfile.phone || null,
          city: distributorProfile.city || null,
          state: distributorProfile.state || null,
          gstNumber: distributorProfile.gstNumber || distributorProfile.gstin || null,
        };

        // Get totals from chargesSnapshot or proforma
        const breakdown = orderData?.chargesSnapshot?.breakdown || orderData?.proforma;
        let invoiceTotals = {
          grandTotal: breakdown?.grandTotal 
            ? Number(breakdown.grandTotal)
            : (orderData.grandTotal || orderData.itemsSubTotal || 0),
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
        }

        const invoiceNumber = orderData.invoiceNumber || `INV-${(orderId || '').slice(-6).toUpperCase()}`;

        // Determine payment status
        const orderIsPaid = orderData?.isPaid === true || orderData?.paymentStatus === 'Paid' || orderData?.payment?.isPaid === true;
        const paymentMode = orderData?.paymentMode || orderData?.payment?.mode || orderData?.paymentNormalized?.code || 'COD';
        const paymentLabel = orderData?.paymentModeLabel || orderData?.payment?.normalized?.label || paymentMode;

        const invoiceDoc = {
          orderId,
          invoiceNumber,
          distributorId,
          productOwnerId: productOwnerId || null,
          // Explicitly NO retailerId to indicate this is a product owner order
          retailerId: null,
          buyer: buyerInfo,
          seller: sellerInfo,
          totals: invoiceTotals,
          payment: {
            mode: paymentLabel,
            normalized: orderData?.paymentNormalized || { code: paymentMode, label: paymentLabel },
            isPaid: orderIsPaid,
            status: orderIsPaid ? 'Paid' : (orderData?.paymentMode?.toLowerCase() === 'credit' ? 'Payment Due' : 'Pending'),
          },
          deliveryDetails: orderData.deliveryDetails || null,
          deliveryMode: orderData.deliveryMode || null,
          expectedDeliveryDate: orderData.expectedDeliveryDate || null,
          issuedAt: new Date().toISOString(),
          createdAt: serverTimestamp(),
          status: orderIsPaid ? 'Paid' : 'Issued',
          paymentStatus: orderIsPaid ? 'Paid' : 'Pending',
          isPaid: orderIsPaid,
          source: 'product-owner-order', // Mark source to distinguish from retailer orders
        };

        await setDoc(invoiceRef, invoiceDoc, { merge: true });
        console.log('[OrderDetailModal] Invoice created for product owner order:', orderId);
      } else {
        console.log('[OrderDetailModal] Invoice already exists for order:', orderId);
      }
    } catch (err) {
      console.error('[OrderDetailModal] Failed to create invoice for product owner order:', orderId, err);
      throw err; // Re-throw to be caught by caller
    }
  };

  if (!order) return null;

  // Safely extract and validate data from currentOrder
  const items = Array.isArray(currentOrder?.items) ? currentOrder.items : [];
  
  // Ensure statusHistory is always an array
  let statusHistory = [];
  if (currentOrder?.statusHistory) {
    if (Array.isArray(currentOrder.statusHistory)) {
      statusHistory = currentOrder.statusHistory;
    } else if (typeof currentOrder.statusHistory === 'object' && currentOrder.statusHistory !== null) {
      // If it's an object, try to convert it to an array
      statusHistory = Object.values(currentOrder.statusHistory).filter(item => item !== null && item !== undefined);
    }
  }
  
  // Safely create timeline
  const timeline = Array.isArray(statusHistory) ? [...statusHistory].reverse() : []; // Show most recent first

  return (
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
        className="bg-slate-900 rounded-xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-900/98 via-slate-800/95 to-slate-900/98 backdrop-blur-xl border-b border-white/10 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-emerald-300">
              Order Details
            </h2>
            <p className="text-white/60 text-sm mt-1">Order ID: #{currentOrder.id?.slice(0, 12)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Order Status Section */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-400/20 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Current Status</h3>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`px-4 py-2 rounded-lg text-sm font-semibold border flex items-center gap-2 ${getStatusColor(currentStatus)}`}>
                    {getStatusIcon(currentStatus)}
                    {getStatusLabel(currentStatus)}
                  </span>
                  {!readOnly && (
                    <>
                      {/* Show Create Quote button for REQUESTED distributor order requests */}
                      {isDistributorOrderRequest && currentStatus === ORDER_STATUSES.REQUESTED && (
                        <button
                          onClick={() => setShowQuoteEditor(true)}
                          className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-blue-300 text-sm font-medium transition-all hover:scale-105 flex items-center gap-2"
                        >
                          <FaEdit /> Create Quote
                        </button>
                      )}
                      {/* Show Update Status button for other statuses */}
                      {availableNextStatuses.length > 0 && (
                        <button
                          onClick={() => setShowStatusUpdate(true)}
                          className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm font-medium transition-all hover:scale-105"
                        >
                          Update Status
                        </button>
                      )}
                    </>
                  )}
                  {/* Allow distributors to accept/reject quotes even in readOnly mode */}
                  {readOnly && currentStatus === ORDER_STATUSES.QUOTED && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedStatus(ORDER_STATUSES.ACCEPTED);
                          handleStatusUpdate(ORDER_STATUSES.ACCEPTED);
                        }}
                        disabled={updating}
                        className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm font-medium transition-all hover:scale-105 flex items-center gap-2"
                      >
                        <FaCheckCircle /> Accept Quote
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus(ORDER_STATUSES.REJECTED);
                          setShowStatusUpdate(true);
                        }}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-lg text-red-300 text-sm font-medium transition-all hover:scale-105 flex items-center gap-2"
                      >
                        <FaTimes /> Reject Quote
                      </button>
                    </div>
                  )}
                  {/* Add to Inventory button for delivered orders */}
                  {readOnly && currentStatus === ORDER_STATUSES.DELIVERED && !currentOrder.inventorySynced && (
                    <button
                      onClick={handleAddToInventoryClick}
                      disabled={addingToInventory || (!currentOrder.items || currentOrder.items.length === 0) && (!currentOrder.proforma?.lines || currentOrder.proforma.lines.length === 0)}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-blue-300 text-sm font-medium transition-all hover:scale-105 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FaPlus /> Add to Inventory
                    </button>
                  )}
                  {/* Show synced indicator if already added */}
                  {readOnly && currentStatus === ORDER_STATUSES.DELIVERED && currentOrder.inventorySynced && (
                    <span className="px-4 py-2 bg-emerald-500/20 border border-emerald-400/30 rounded-lg text-emerald-300 text-sm font-medium flex items-center gap-2">
                      <FaCheckCircle /> Added to Inventory
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Status Update Modal */}
          <AnimatePresence>
            {showStatusUpdate && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4"
              >
                <h4 className="text-lg font-semibold text-white">Update Order Status</h4>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Select New Status</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {availableNextStatuses.map((status) => (
                      <button
                        key={status}
                        onClick={() => setSelectedStatus(status)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedStatus === status
                            ? 'border-emerald-400 bg-emerald-500/20'
                            : 'border-white/10 hover:border-white/20 bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-white">
                          {getStatusIcon(status)}
                          <span className="text-sm font-medium">{getStatusLabel(status)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Notes (Optional)</label>
                  <textarea
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    placeholder="Add any notes about this status update..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowStatusUpdate(false);
                      setSelectedStatus(null);
                      setStatusNotes('');
                    }}
                    className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => selectedStatus && handleStatusUpdate(selectedStatus)}
                    disabled={!selectedStatus || updating}
                    className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition"
                  >
                    {updating ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quote Editor Modal */}
          <AnimatePresence>
            {showQuoteEditor && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xl font-semibold text-white">Create Quote / Quotation</h4>
                  <button
                    onClick={() => {
                      setShowQuoteEditor(false);
                      setStatusNotes('');
                    }}
                    className="text-white/70 hover:text-white transition"
                  >
                    <FaTimes />
                  </button>
                </div>

                {/* Items Editor */}
                <div>
                  <h5 className="text-lg font-medium text-white mb-4">Order Items</h5>
                  <div className="space-y-3">
                    {quoteLines.map((line, index) => {
                      const gross = (line.qty || 0) * (line.price || 0);
                      const lineDiscountAmt = line.itemDiscountChangedBy === 'amt' 
                        ? (line.itemDiscountAmt || 0)
                        : Math.round((gross * (line.itemDiscountPct || 0) / 100) * 100) / 100;
                      const lineAfterDiscount = gross - lineDiscountAmt;
                      
                      return (
                        <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10 space-y-3">
                          <div className="grid grid-cols-12 gap-3 items-start">
                            <div className="col-span-4">
                              <label className="text-xs text-white/50 mb-1 block">Product Name</label>
                              <input
                                type="text"
                                value={line.name}
                                onChange={(e) => updateQuoteLine(index, 'name', e.target.value)}
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                              />
                              {line.sku && (
                                <p className="text-xs text-white/40 mt-1">SKU: {line.sku}</p>
                              )}
                            </div>
                            <div className="col-span-2">
                              <label className="text-xs text-white/50 mb-1 block">Quantity</label>
                              <input
                                type="number"
                                value={line.qty}
                                onChange={(e) => updateQuoteLine(index, 'qty', e.target.value)}
                                min="0"
                                step="1"
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="text-xs text-white/50 mb-1 block">Price Type</label>
                              <select
                                value={line.pricingMode || PRICING_MODES.LEGACY}
                                onChange={(e) => updateQuoteLine(index, 'pricingMode', e.target.value)}
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                              >
                                <option value={PRICING_MODES.LEGACY}>Selling Price</option>
                                <option value={PRICING_MODES.MRP_INCLUSIVE}>MRP (GST Inclusive)</option>
                                <option value={PRICING_MODES.BASE_PLUS_TAX}>Base Price (GST Exclusive)</option>
                              </select>
                            </div>
                            <div className="col-span-3">
                              <label className="text-xs text-white/50 mb-1 block">
                                {line.pricingMode === PRICING_MODES.MRP_INCLUSIVE ? 'MRP' : 
                                 line.pricingMode === PRICING_MODES.BASE_PLUS_TAX ? 'Base Price' : 
                                 'Selling Price'}
                              </label>
                              <input
                                type="number"
                                value={line.pricingMode === PRICING_MODES.MRP_INCLUSIVE ? (line.mrp || line.price) :
                                       line.pricingMode === PRICING_MODES.BASE_PLUS_TAX ? (line.basePrice || line.price) :
                                       line.price}
                                onChange={(e) => {
                                  const field = line.pricingMode === PRICING_MODES.MRP_INCLUSIVE ? 'mrp' :
                                               line.pricingMode === PRICING_MODES.BASE_PLUS_TAX ? 'basePrice' :
                                               'price';
                                  updateQuoteLine(index, field, e.target.value);
                                }}
                                min="0"
                                step="0.01"
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-12 gap-3 items-start">
                            <div className="col-span-3">
                              <label className="text-xs text-white/50 mb-1 block">Discount %</label>
                              <input
                                type="number"
                                value={line.itemDiscountPct}
                                onChange={(e) => updateQuoteLine(index, 'itemDiscountPct', e.target.value)}
                                min="0"
                                max="100"
                                step="0.01"
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                              />
                              <p className="text-xs text-emerald-400 mt-1">
                                = {formatINR(lineDiscountAmt)}
                              </p>
                            </div>
                            <div className="col-span-3">
                              <label className="text-xs text-white/50 mb-1 block">Discount Amount (₹)</label>
                              <input
                                type="number"
                                value={line.itemDiscountAmt || 0}
                                onChange={(e) => updateQuoteLine(index, 'itemDiscountAmt', e.target.value)}
                                min="0"
                                step="0.01"
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                              />
                              <p className="text-xs text-emerald-400 mt-1">
                                = {line.itemDiscountPct.toFixed(2)}%
                              </p>
                            </div>
                            <div className="col-span-3">
                              <label className="text-xs text-white/50 mb-1 block">GST Rate %</label>
                              <input
                                type="number"
                                value={line.gstRate}
                                onChange={(e) => updateQuoteLine(index, 'gstRate', e.target.value)}
                                min="0"
                                max="28"
                                step="0.01"
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="text-xs text-white/50 mb-1 block">Line Total</label>
                              <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-400/20 rounded-lg">
                                <p className="text-sm font-semibold text-emerald-400">
                                  {formatINR(lineAfterDiscount)}
                                </p>
                                <p className="text-xs text-white/50">
                                  Gross: {formatINR(gross)} | Disc: {formatINR(lineDiscountAmt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Order Charges */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Delivery Fee</label>
                    <input
                      type="number"
                      value={quoteCharges.delivery}
                      onChange={(e) => updateQuoteCharge('delivery', e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Packing Fee</label>
                    <input
                      type="number"
                      value={quoteCharges.packing}
                      onChange={(e) => updateQuoteCharge('packing', e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Insurance</label>
                    <input
                      type="number"
                      value={quoteCharges.insurance}
                      onChange={(e) => updateQuoteCharge('insurance', e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Other Charges</label>
                    <input
                      type="number"
                      value={quoteCharges.other}
                      onChange={(e) => updateQuoteCharge('other', e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>

                {/* Order Discount */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h6 className="text-sm font-semibold text-white mb-3">Order-Level Discount</h6>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-white/50 mb-1 block">Discount %</label>
                      <input
                        type="number"
                        value={quoteCharges.discountPct}
                        onChange={(e) => updateQuoteCharge('discountPct', e.target.value)}
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                      />
                      <p className="text-xs text-emerald-400 mt-1">
                        Amount: {formatINR(orderDiscountAmount)}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1 block">Discount Amount (₹)</label>
                      <input
                        type="number"
                        value={quoteCharges.discountAmt}
                        onChange={(e) => updateQuoteCharge('discountAmt', e.target.value)}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                      />
                      <p className="text-xs text-emerald-400 mt-1">
                        Percentage: {quoteCharges.discountPct.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quote Preview - Accounting Compliant Breakdown */}
                {quotePreview && (
                  <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-blue-400/20 rounded-xl p-5">
                    <h5 className="text-lg font-medium text-white mb-4">Quote Preview (Accounting Breakdown)</h5>
                    <div className="space-y-3 text-sm">
                      {/* Gross Items */}
                      <div className="flex justify-between items-center py-2 border-b border-white/10">
                        <span className="text-white/70 font-medium">Gross Items Value:</span>
                        <span className="text-white font-semibold">{formatINR(quotePreview.grossItems || 0)}</span>
                      </div>
                      
                      {/* Line Discounts */}
                      {quotePreview.lineDiscountTotal > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-white/10">
                          <span className="text-white/70">Less: Line Item Discounts:</span>
                          <span className="text-red-400 font-semibold">-{formatINR(quotePreview.lineDiscountTotal || 0)}</span>
                        </div>
                      )}
                      
                      {/* Items Subtotal */}
                      <div className="flex justify-between items-center py-2 border-b border-white/10">
                        <span className="text-white/70 font-medium">Items Subtotal (After Line Discounts):</span>
                        <span className="text-white font-semibold">{formatINR(quotePreview.itemsSubTotal || 0)}</span>
                      </div>
                      
                      {/* Order Charges Breakdown */}
                      <div className="bg-white/5 rounded-lg p-3 space-y-1">
                        <div className="text-xs text-white/50 mb-2">Add: Order Charges</div>
                        {quoteCharges.delivery > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Delivery Fee:</span>
                            <span className="text-white">{formatINR(quoteCharges.delivery)}</span>
                          </div>
                        )}
                        {quoteCharges.packing > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Packing Fee:</span>
                            <span className="text-white">{formatINR(quoteCharges.packing)}</span>
                          </div>
                        )}
                        {quoteCharges.insurance > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Insurance:</span>
                            <span className="text-white">{formatINR(quoteCharges.insurance)}</span>
                          </div>
                        )}
                        {quoteCharges.other > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Other Charges:</span>
                            <span className="text-white">{formatINR(quoteCharges.other)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t border-white/10 mt-1">
                          <span className="text-white/70 font-medium">Total Charges:</span>
                          <span className="text-white font-semibold">
                            {formatINR((quoteCharges.delivery + quoteCharges.packing + quoteCharges.insurance + quoteCharges.other) || 0)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Order Discount */}
                      {quotePreview.discountTotal > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-white/10">
                          <span className="text-white/70">Less: Order Discount ({quoteCharges.discountPct.toFixed(2)}%):</span>
                          <span className="text-red-400 font-semibold">-{formatINR(quotePreview.discountTotal || 0)}</span>
                        </div>
                      )}
                      
                      {/* Taxable Base */}
                      <div className="flex justify-between items-center py-2 border-b border-white/10 bg-white/5 px-3 rounded">
                        <span className="text-white font-medium">Taxable Base (Before GST):</span>
                        <span className="text-white font-semibold">{formatINR(quotePreview.taxableBase || 0)}</span>
                      </div>
                      
                      {/* GST Breakdown */}
                      {quotePreview.taxBreakup && (quotePreview.taxBreakup.cgst > 0 || quotePreview.taxBreakup.sgst > 0 || quotePreview.taxBreakup.igst > 0) && (
                        <div className="bg-white/5 rounded-lg p-3 space-y-1">
                          <div className="text-xs text-white/50 mb-2">
                            Add: GST ({quotePreview.taxType === 'IGST' ? 'Interstate' : 'Intrastate'} - {productOwnerState} → {distributorState})
                          </div>
                          {quotePreview.taxBreakup.cgst > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-white/60">CGST:</span>
                              <span className="text-white">{formatINR(quotePreview.taxBreakup.cgst)}</span>
                            </div>
                          )}
                          {quotePreview.taxBreakup.sgst > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-white/60">SGST:</span>
                              <span className="text-white">{formatINR(quotePreview.taxBreakup.sgst)}</span>
                            </div>
                          )}
                          {quotePreview.taxBreakup.igst > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-white/60">IGST:</span>
                              <span className="text-white">{formatINR(quotePreview.taxBreakup.igst)}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-1 border-t border-white/10 mt-1">
                            <span className="text-white/70 font-medium">Total GST:</span>
                            <span className="text-white font-semibold">
                              {formatINR((quotePreview.taxBreakup.cgst || 0) + (quotePreview.taxBreakup.sgst || 0) + (quotePreview.taxBreakup.igst || 0))}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Round Off */}
                      {quotePreview.roundOff !== 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-white/10">
                          <span className="text-white/70">Round Off ({rounding}):</span>
                          <span className={quotePreview.roundOff > 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {quotePreview.roundOff > 0 ? '+' : ''}{formatINR(quotePreview.roundOff)}
                          </span>
                        </div>
                      )}
                      
                      {/* Grand Total */}
                      <div className="flex justify-between items-center py-3 pt-4 border-t-2 border-emerald-400/30 bg-emerald-500/10 px-4 rounded-lg">
                        <span className="text-white font-bold text-lg">Grand Total (Payable):</span>
                        <span className="text-emerald-400 font-bold text-xl">{formatINR(quotePreview.grandTotal || 0)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rounding Options */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      id="roundingEnabled"
                      checked={roundingEnabled}
                      onChange={(e) => setRoundingEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-white/10 text-emerald-500 focus:ring-emerald-400"
                    />
                    <label htmlFor="roundingEnabled" className="text-white/70 text-sm font-medium">
                      Enable Rounding
                    </label>
                  </div>
                  {roundingEnabled && (
                    <div className="ml-7">
                      <label className="text-xs text-white/50 mb-2 block">Rounding Method</label>
                      <div className="flex gap-3">
                        {['NEAREST', 'UP', 'DOWN'].map((method) => (
                          <button
                            key={method}
                            onClick={() => setRounding(method)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              rounding === method
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }`}
                          >
                            {method === 'NEAREST' ? 'Nearest' : method === 'UP' ? 'Round Up' : 'Round Down'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Skip Proforma Option */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="skipProforma"
                    checked={skipProforma}
                    onChange={(e) => setSkipProforma(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/10 text-emerald-500 focus:ring-emerald-400"
                  />
                  <label htmlFor="skipProforma" className="text-white/70 text-sm">
                    Skip Proforma (Apply defaults and move directly to ACCEPTED)
                  </label>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Notes (Optional)</label>
                  <textarea
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    placeholder="Add any notes about this quote..."
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowQuoteEditor(false);
                      setStatusNotes('');
                    }}
                    className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitQuote}
                    disabled={!quotePreview || savingQuote}
                    className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition flex items-center justify-center gap-2"
                  >
                    <FaSave /> {savingQuote ? 'Saving...' : skipProforma ? 'Skip Proforma & Accept' : 'Send Quote'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quote Breakdown - Show for QUOTED orders or orders with chargesSnapshot */}
          {(currentStatus === ORDER_STATUSES.QUOTED || currentOrder.chargesSnapshot) && currentOrder.chargesSnapshot?.breakdown && (
            <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-blue-400/20 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FaDollarSign /> Quote Breakdown (Accounting View)
              </h3>
              {(() => {
                const breakdown = currentOrder.chargesSnapshot.breakdown;
                const proforma = currentOrder.proforma || {};
                const taxBreakup = proforma.taxBreakup || currentOrder.chargesSnapshot.breakdown.taxBreakup || {};
                const defaults = currentOrder.chargesSnapshot.defaultsUsed || {};
                
                return (
                  <div className="space-y-3 text-sm">
                    {/* Gross Items */}
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-white/70 font-medium">Gross Items Value:</span>
                      <span className="text-white font-semibold">{formatINR(breakdown.grossItems || 0)}</span>
                    </div>
                    
                    {/* Line Discounts */}
                    {breakdown.lineDiscountTotal > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-white/10">
                        <span className="text-white/70">Less: Line Item Discounts:</span>
                        <span className="text-red-400 font-semibold">-{formatINR(breakdown.lineDiscountTotal || 0)}</span>
                      </div>
                    )}
                    
                    {/* Items Subtotal */}
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-white/70 font-medium">Items Subtotal (After Line Discounts):</span>
                      <span className="text-white font-semibold">{formatINR(breakdown.itemsSubTotal || breakdown.subTotal || 0)}</span>
                    </div>
                    
                    {/* Order Charges */}
                    {(breakdown.delivery > 0 || breakdown.packing > 0 || breakdown.insurance > 0 || breakdown.other > 0) && (
                      <div className="bg-white/5 rounded-lg p-3 space-y-1">
                        <div className="text-xs text-white/50 mb-2">Add: Order Charges</div>
                        {breakdown.delivery > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Delivery Fee:</span>
                            <span className="text-white">{formatINR(breakdown.delivery)}</span>
                          </div>
                        )}
                        {breakdown.packing > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Packing Fee:</span>
                            <span className="text-white">{formatINR(breakdown.packing)}</span>
                          </div>
                        )}
                        {breakdown.insurance > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Insurance:</span>
                            <span className="text-white">{formatINR(breakdown.insurance)}</span>
                          </div>
                        )}
                        {breakdown.other > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Other Charges:</span>
                            <span className="text-white">{formatINR(breakdown.other)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t border-white/10 mt-1">
                          <span className="text-white/70 font-medium">Total Charges:</span>
                          <span className="text-white font-semibold">
                            {formatINR((breakdown.delivery || 0) + (breakdown.packing || 0) + (breakdown.insurance || 0) + (breakdown.other || 0))}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Order Discount */}
                    {breakdown.discountTotal > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-white/10">
                        <span className="text-white/70">Less: Order Discount ({breakdown.discountPct?.toFixed(2) || 0}%):</span>
                        <span className="text-red-400 font-semibold">-{formatINR(breakdown.discountTotal || 0)}</span>
                      </div>
                    )}
                    
                    {/* Taxable Base */}
                    <div className="flex justify-between items-center py-2 border-b border-white/10 bg-white/5 px-3 rounded">
                      <span className="text-white font-medium">Taxable Base (Before GST):</span>
                      <span className="text-white font-semibold">{formatINR(breakdown.taxableBase || proforma.taxableBase || 0)}</span>
                    </div>
                    
                    {/* GST Breakdown */}
                    {(taxBreakup.cgst > 0 || taxBreakup.sgst > 0 || taxBreakup.igst > 0) && (
                      <div className="bg-white/5 rounded-lg p-3 space-y-1">
                        <div className="text-xs text-white/50 mb-2">
                          Add: GST ({proforma.taxType === 'IGST' ? 'Interstate' : 'Intrastate'} - {productOwnerState} → {distributorState})
                        </div>
                        {taxBreakup.cgst > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">CGST:</span>
                            <span className="text-white">{formatINR(taxBreakup.cgst)}</span>
                          </div>
                        )}
                        {taxBreakup.sgst > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">SGST:</span>
                            <span className="text-white">{formatINR(taxBreakup.sgst)}</span>
                          </div>
                        )}
                        {taxBreakup.igst > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">IGST:</span>
                            <span className="text-white">{formatINR(taxBreakup.igst)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t border-white/10 mt-1">
                          <span className="text-white/70 font-medium">Total GST:</span>
                          <span className="text-white font-semibold">
                            {formatINR((taxBreakup.cgst || 0) + (taxBreakup.sgst || 0) + (taxBreakup.igst || 0))}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Round Off */}
                    {proforma.roundOff !== 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-white/10">
                        <span className="text-white/70">Round Off ({defaults.roundRule?.toUpperCase() || 'NEAREST'}):</span>
                        <span className={proforma.roundOff > 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {proforma.roundOff > 0 ? '+' : ''}{formatINR(proforma.roundOff)}
                        </span>
                      </div>
                    )}
                    
                    {/* Grand Total */}
                    <div className="flex justify-between items-center py-3 pt-4 border-t-2 border-emerald-400/30 bg-emerald-500/10 px-4 rounded-lg">
                      <span className="text-white font-bold text-lg">Grand Total (Payable):</span>
                      <span className="text-emerald-400 font-bold text-xl">{formatINR(currentOrder.grandTotal || proforma.grandTotal || 0)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Order Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Order Items */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FaBox /> Order Items
              </h3>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-white">{item.productName || 'Unnamed Product'}</p>
                        {item.sku && (
                          <p className="text-xs text-white/50 mt-1">SKU: {item.sku}</p>
                        )}
                        {item.pricingMode && (
                          <p className="text-xs text-emerald-400/70 mt-1">
                            {item.pricingMode === PRICING_MODES.MRP_INCLUSIVE ? 'MRP' : 
                             item.pricingMode === PRICING_MODES.BASE_PLUS_TAX ? 'Base Price' : 
                             'Selling Price'}
                          </p>
                        )}
                      </div>
                      <span className="text-emerald-400 font-semibold">{formatINR(item.subtotal || (item.quantity * item.unitPrice))}</span>
                    </div>
                    <div className="flex justify-between text-sm text-white/70">
                      <span>Qty: {item.quantity}</span>
                      <span>Price: {formatINR(item.unitPrice)}</span>
                      {item.itemDiscountPct > 0 && (
                        <span className="text-red-400">Disc: {item.itemDiscountPct.toFixed(2)}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {!currentOrder.chargesSnapshot && (
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-white font-semibold">Subtotal:</span>
                  <span className="text-xl font-bold text-emerald-400">
                    {formatINR(currentOrder.itemsSubTotal || currentOrder.grandTotal || 0)}
                  </span>
                </div>
              )}
            </div>

            {/* Distributor/Product Owner & Payment Info */}
            <div className="space-y-4">
              {/* Show Product Owner Info when Distributor views, Distributor Info when Product Owner views */}
              {readOnly ? (
                // Distributor viewing - show Product Owner Information
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FaUser /> Product Owner Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-white/50">Name:</span>
                      <span className="text-white ml-2">{currentOrder.productOwnerName || 'N/A'}</span>
                    </div>
                    {currentOrder.productOwnerEmail && (
                      <div>
                        <span className="text-white/50">Email:</span>
                        <span className="text-white ml-2">{currentOrder.productOwnerEmail}</span>
                      </div>
                    )}
                    {currentOrder.productOwnerPhone && (
                      <div>
                        <span className="text-white/50">Phone:</span>
                        <span className="text-white ml-2">{currentOrder.productOwnerPhone}</span>
                      </div>
                    )}
                    {currentOrder.productOwnerId && (
                      <div>
                        <span className="text-white/50">FLYP ID:</span>
                        <span className="text-white ml-2 font-mono text-xs">{currentOrder.productOwnerId.slice(0, 12)}...</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Product Owner viewing - show Distributor Information
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FaUser /> Distributor Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-white/50">Name:</span>
                      <span className="text-white ml-2">{currentOrder.distributorName || 'N/A'}</span>
                    </div>
                    {currentOrder.distributorEmail && (
                      <div>
                        <span className="text-white/50">Email:</span>
                        <span className="text-white ml-2">{currentOrder.distributorEmail}</span>
                      </div>
                    )}
                    {currentOrder.distributorPhone && (
                      <div>
                        <span className="text-white/50">Phone:</span>
                        <span className="text-white ml-2">{currentOrder.distributorPhone}</span>
                      </div>
                    )}
                    {currentOrder.distributorId && (
                      <div>
                        <span className="text-white/50">FLYP ID:</span>
                        <span className="text-white ml-2 font-mono text-xs">{currentOrder.distributorId.slice(0, 12)}...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Information */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FaDollarSign /> Payment Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Payment Mode:</span>
                    <span className="text-white font-medium">{currentOrder.paymentModeLabel || currentOrder.paymentMode || 'COD'}</span>
                  </div>
                  {currentOrder.creditDays && (
                    <div className="flex justify-between">
                      <span className="text-white/50">Credit Days:</span>
                      <span className="text-white">{currentOrder.creditDays} days</span>
                    </div>
                  )}
                  {currentOrder.advancePaid > 0 && (
                    <div className="flex justify-between">
                      <span className="text-white/50">Advance Paid:</span>
                      <span className="text-white">{formatINR(currentOrder.advancePaid)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-white font-semibold">Total Amount:</span>
                    <span className="text-emerald-400 font-bold">{formatINR(currentOrder.grandTotal || currentOrder.itemsSubTotal || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Timeline */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FaClock /> Status Timeline
            </h3>
            {timeline.length > 0 ? (
              <div className="space-y-4">
                {timeline.map((entry, index) => {
                  const entryStatus = entry.status || entry.statusCode || '';
                  return (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(entryStatus).split(' ')[0]}`} />
                        {index < timeline.length - 1 && (
                          <div className="w-0.5 h-full bg-white/10 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className={`px-3 py-1 rounded-lg text-sm font-medium border inline-flex items-center gap-2 ${getStatusColor(entryStatus)}`}>
                              {getStatusIcon(entryStatus)}
                              {getStatusLabel(entryStatus)}
                            </span>
                            {(entry.updatedByName || entry.updatedBy) && (
                              <p className="text-xs text-white/50 mt-1">
                                Updated by {entry.updatedByName || entry.updatedBy || 'System'}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-white/50">
                            {formatDate(entry.updatedAt || entry.at || entry.createdAt || entry.timestamp)}
                          </span>
                        </div>
                        {entry.notes && (
                          <p className="text-sm text-white/70 mt-2 bg-white/5 p-2 rounded border border-white/10">
                            <FaInfoCircle className="inline mr-1 text-xs" />
                            {entry.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-white/50 text-sm mb-2">No status history available</p>
                <p className="text-white/30 text-xs">Status updates will appear here as the order progresses</p>
              </div>
            )}
          </div>

          {/* Additional Notes */}
          {currentOrder.notes && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-2">Order Notes</h3>
              <p className="text-white/70 text-sm">{currentOrder.notes}</p>
            </div>
          )}
        </div>

        {/* Add to Inventory Modal */}
        <AnimatePresence>
          {showInventoryModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
              onClick={() => !addingToInventory && setShowInventoryModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 rounded-xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
              >
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-slate-900/98 via-slate-800/95 to-slate-900/98 backdrop-blur-xl border-b border-white/10 p-6 flex items-center justify-between z-10">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Add Items to Inventory</h2>
                    <p className="text-white/60 text-sm mt-1">Review and edit items before adding to inventory</p>
                  </div>
                  <button
                    onClick={() => setShowInventoryModal(false)}
                    disabled={addingToInventory}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all disabled:opacity-50"
                  >
                    <FaTimes className="text-lg" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {inventoryItems.map((item, index) => {
                    const isExisting = item.existingProduct;
                    const currentQty = isExisting ? item.existingProduct.quantity : 0;
                    const newQty = Number(item.finalQuantity || item.quantity || 0);
                    const totalQty = item.action === 'update' ? currentQty + newQty : newQty;

                    return (
                      <div
                        key={index}
                        className={`bg-white/5 border rounded-xl p-5 ${
                          isExisting && item.action === 'update'
                            ? 'border-emerald-400/30 bg-emerald-500/5'
                            : 'border-white/10'
                        }`}
                      >
                        {/* Item Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-1">
                              {item.productName}
                            </h3>
                            {isExisting && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded border border-emerald-400/30">
                                  Exists in Inventory
                                </span>
                                <span className="text-white/50 text-xs">
                                  Current Qty: {currentQty} {item.unit}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {isExisting && (
                              <button
                                onClick={() => handleInventoryItemChange(index, 'action', item.action === 'update' ? 'new' : 'update')}
                                disabled={addingToInventory}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                  item.action === 'update'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                                } disabled:opacity-50`}
                              >
                                {item.action === 'update' ? 'Update Existing' : 'Add as New'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Fields Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-xs text-white/50 mb-1">Quantity {item.action === 'update' && `(Will add to ${currentQty})`}</label>
                            <input
                              type="number"
                              value={item.finalQuantity || item.quantity || 0}
                              onChange={(e) => handleInventoryItemChange(index, 'finalQuantity', e.target.value)}
                              disabled={addingToInventory}
                              min="0"
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                            />
                            {item.action === 'update' && (
                              <p className="text-xs text-emerald-400 mt-1">Total: {totalQty} {item.unit}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs text-white/50 mb-1">Cost Price (₹)</label>
                            <input
                              type="number"
                              value={item.finalCostPrice || item.costPrice || 0}
                              onChange={(e) => handleInventoryItemChange(index, 'finalCostPrice', e.target.value)}
                              disabled={addingToInventory}
                              min="0"
                              step="0.01"
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-white/50 mb-1">Selling Price (₹)</label>
                            <input
                              type="number"
                              value={item.finalSellingPrice || item.sellingPrice || 0}
                              onChange={(e) => handleInventoryItemChange(index, 'finalSellingPrice', e.target.value)}
                              disabled={addingToInventory}
                              min="0"
                              step="0.01"
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-white/50 mb-1">SKU</label>
                            <input
                              type="text"
                              value={item.finalSku || item.sku || ''}
                              onChange={(e) => handleInventoryItemChange(index, 'finalSku', e.target.value)}
                              disabled={addingToInventory || item.action === 'update'}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                              placeholder="Auto-generated"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-white/50 mb-1">Brand</label>
                            <input
                              type="text"
                              value={item.finalBrand || item.brand || ''}
                              onChange={(e) => handleInventoryItemChange(index, 'finalBrand', e.target.value)}
                              disabled={addingToInventory}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-white/50 mb-1">Category</label>
                            <input
                              type="text"
                              value={item.finalCategory || item.category || ''}
                              onChange={(e) => handleInventoryItemChange(index, 'finalCategory', e.target.value)}
                              disabled={addingToInventory}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-white/50 mb-1">Unit</label>
                            <input
                              type="text"
                              value={item.finalUnit || item.unit || ''}
                              onChange={(e) => handleInventoryItemChange(index, 'finalUnit', e.target.value)}
                              disabled={addingToInventory}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm disabled:opacity-50"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-gradient-to-r from-slate-900/98 via-slate-800/95 to-slate-900/98 backdrop-blur-xl border-t border-white/10 p-6 flex items-center justify-between">
                  <button
                    onClick={() => setShowInventoryModal(false)}
                    disabled={addingToInventory}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddToInventory}
                    disabled={addingToInventory || !inventoryItems || inventoryItems.length === 0}
                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition flex items-center gap-2"
                  >
                    <FaPlus /> {addingToInventory ? 'Adding...' : 'Add to Inventory'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <style>{`
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
    </motion.div>
  );
};

export default OrderDetailModal;

