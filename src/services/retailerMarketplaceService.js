/**
 * Retailer Marketplace Service
 * Handles syncing retailer data to the customer-facing stores collection
 */

import { db } from '../firebase/firebaseConfig';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  deleteDoc,
  addDoc
} from 'firebase/firestore';

// ============== STORE MANAGEMENT ==============

/**
 * Get retailer's marketplace store profile
 */
export const getMarketplaceStore = async (retailerId) => {
  try {
    const storeDoc = await getDoc(doc(db, 'stores', retailerId));
    if (storeDoc.exists()) {
      return { id: storeDoc.id, ...storeDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting marketplace store:', error);
    throw error;
  }
};

/**
 * Create or update marketplace store profile
 */
export const saveMarketplaceStore = async (retailerId, storeData) => {
  try {
    const storeRef = doc(db, 'stores', retailerId);
    const existingStore = await getDoc(storeRef);

    const dataToSave = {
      ...storeData,
      retailerId,
      updatedAt: serverTimestamp()
    };

    if (!existingStore.exists()) {
      dataToSave.createdAt = serverTimestamp();
      dataToSave.isActive = true;
      dataToSave.rating = 0;
      dataToSave.totalOrders = 0;
      dataToSave.totalReviews = 0;
    }

    await setDoc(storeRef, dataToSave, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error saving marketplace store:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Toggle store active status (open/close for orders)
 */
export const toggleStoreStatus = async (retailerId, isActive) => {
  try {
    await updateDoc(doc(db, 'stores', retailerId), {
      isActive,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error toggling store status:', error);
    return { success: false, error: error.message };
  }
};

// ============== PRODUCT MANAGEMENT ==============

/**
 * Get all products from retailer's inventory
 */
export const getRetailerProducts = async (retailerId) => {
  try {
    const productsRef = collection(db, 'businesses', retailerId, 'products');
    const snapshot = await getDocs(productsRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting retailer products:', error);
    throw error;
  }
};

/**
 * Get products synced to marketplace
 */
export const getMarketplaceProducts = async (retailerId) => {
  try {
    const productsRef = collection(db, 'stores', retailerId, 'products');
    const snapshot = await getDocs(productsRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting marketplace products:', error);
    throw error;
  }
};

/**
 * Sync a product to the marketplace
 */
export const syncProductToMarketplace = async (retailerId, product, marketplaceData = {}) => {
  try {
    const productRef = doc(db, 'stores', retailerId, 'products', product.id);
    
    const mrp = marketplaceData.mrp ?? product.mrp ?? product.price ?? 0;
    const basePrice = product.sellingPrice ?? product.price ?? 0;
    const offerPrice = marketplaceData.offerPrice;
    const discountPercent = marketplaceData.discountPercent;
    let sellingPrice = marketplaceData.sellingPrice ?? basePrice;
    let offerLabel = marketplaceData.offerLabel;

    if (offerPrice != null && offerPrice > 0) {
      sellingPrice = offerPrice;
      const effectiveMrp = mrp || sellingPrice;
      if (effectiveMrp > sellingPrice) {
        const pct = Math.round((1 - sellingPrice / effectiveMrp) * 100);
        offerLabel = offerLabel || (pct ? `${pct}% OFF` : null);
      }
    } else if (discountPercent != null && discountPercent > 0 && (mrp || basePrice)) {
      const effectiveMrp = mrp || basePrice;
      sellingPrice = Math.round((effectiveMrp * (1 - discountPercent / 100)) * 100) / 100;
      offerLabel = offerLabel || `${discountPercent}% OFF`;
    }

    const marketplaceProduct = {
      // Core product info
      name: product.productName || product.name,
      description: product.description || '',
      brand: product.brand || '',
      category: product.category || 'General',
      sku: product.sku || '',
      barcode: product.barcode || '',
      
      // Pricing
      mrp: mrp,
      sellingPrice,
      offerPrice: offerPrice ?? null,
      discountPercent: discountPercent ?? null,
      offerLabel: offerLabel || null,
      
      // Return policy (inherit = use store default)
      returnPolicy: marketplaceData.returnPolicy ?? 'inherit',
      
      // Stock
      inStock: (product.quantity || 0) > 0,
      quantity: product.quantity || 0,
      
      // Images
      imageUrl: product.imageUrl || product.image || '',
      images: product.images || [],
      
      // Unit info
      unit: product.unit || 'pcs',
      packSize: product.packSize || '1',
      
      // Marketplace specific
      isAvailable: marketplaceData.isAvailable !== false,
      displayOrder: marketplaceData.displayOrder || 0,
      tags: marketplaceData.tags || [],
      
      // Metadata
      originalProductId: product.id,
      storeId: retailerId,
      syncedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(productRef, marketplaceProduct);
    return { success: true };
  } catch (error) {
    console.error('Error syncing product to marketplace:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk sync products to marketplace
 */
export const bulkSyncProducts = async (retailerId, products) => {
  try {
    const batch = writeBatch(db);
    
    for (const product of products) {
      const productRef = doc(db, 'stores', retailerId, 'products', product.id);
      const mrp = product.mrp || product.price || 0;
      const sellingPrice = product.sellingPrice || product.price || 0;

      const marketplaceProduct = {
        name: product.productName || product.name,
        description: product.description || '',
        brand: product.brand || '',
        category: product.category || 'General',
        sku: product.sku || '',
        mrp,
        sellingPrice,
        offerPrice: null,
        discountPercent: null,
        offerLabel: null,
        returnPolicy: 'inherit',
        inStock: (product.quantity || 0) > 0,
        quantity: product.quantity || 0,
        imageUrl: product.imageUrl || product.image || '',
        unit: product.unit || 'pcs',
        isAvailable: true,
        originalProductId: product.id,
        storeId: retailerId,
        syncedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      batch.set(productRef, marketplaceProduct);
    }
    
    await batch.commit();
    return { success: true, count: products.length };
  } catch (error) {
    console.error('Error bulk syncing products:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Remove product from marketplace
 */
export const removeProductFromMarketplace = async (retailerId, productId) => {
  try {
    await deleteDoc(doc(db, 'stores', retailerId, 'products', productId));
    return { success: true };
  } catch (error) {
    console.error('Error removing product from marketplace:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update product availability/stock
 */
export const updateProductAvailability = async (retailerId, productId, updates) => {
  try {
    await updateDoc(doc(db, 'stores', retailerId, 'products', productId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating product availability:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update marketplace-specific product data (offers, return policy).
 * Use this from Marketplace Products UI – does not overwrite core inventory fields.
 */
export const updateProductMarketplaceData = async (retailerId, productId, updates) => {
  try {
    const productRef = doc(db, 'stores', retailerId, 'products', productId);
    const snap = await getDoc(productRef);
    if (!snap.exists()) return { success: false, error: 'Product not found' };

    const current = snap.data();
    const mrp = current.mrp || current.sellingPrice || 0;
    const payload = { updatedAt: serverTimestamp() };

    if (Object.prototype.hasOwnProperty.call(updates, 'returnPolicy')) {
      payload.returnPolicy = updates.returnPolicy;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'isAvailable')) {
      payload.isAvailable = updates.isAvailable;
    }

    const offerPrice = updates.offerPrice;
    const discountPercent = updates.discountPercent;

    if (offerPrice !== undefined) {
      if (offerPrice === '' || offerPrice === null) {
        payload.offerPrice = null;
        payload.discountPercent = null;
        payload.offerLabel = null;
        payload.sellingPrice = current.mrp || current.sellingPrice || 0;
      } else {
        const op = parseFloat(offerPrice);
        if (!isNaN(op) && op >= 0) {
          payload.offerPrice = op;
          payload.sellingPrice = op;
          payload.discountPercent = null;
          payload.offerLabel = mrp > op ? `${Math.round((1 - op / mrp) * 100)}% OFF` : null;
        }
      }
    } else if (discountPercent !== undefined) {
      if (discountPercent === '' || discountPercent === null) {
        payload.offerPrice = null;
        payload.discountPercent = null;
        payload.offerLabel = null;
        payload.sellingPrice = current.mrp || current.sellingPrice || 0;
      } else {
        const dp = parseFloat(discountPercent);
        if (!isNaN(dp) && dp >= 0 && dp <= 100) {
          const sp = Math.round((mrp * (1 - dp / 100)) * 100) / 100;
          payload.discountPercent = dp;
          payload.offerPrice = null;
          payload.sellingPrice = sp;
          payload.offerLabel = `${dp}% OFF`;
        }
      }
    }

    await updateDoc(productRef, payload);
    return { success: true };
  } catch (error) {
    console.error('Error updating product marketplace data:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk-update offer or return policy for selected marketplace products.
 */
export const bulkUpdateProductMarketplaceData = async (retailerId, productIds, updates) => {
  try {
    const batch = writeBatch(db);
    for (const productId of productIds) {
      const productRef = doc(db, 'stores', retailerId, 'products', productId);
      const snap = await getDoc(productRef);
      if (!snap.exists()) continue;

      const current = snap.data();
      const mrp = current.mrp || current.sellingPrice || 0;
      const payload = { updatedAt: serverTimestamp() };

      if (updates.returnPolicy !== undefined) payload.returnPolicy = updates.returnPolicy;

      if (updates.discountPercent !== undefined && updates.discountPercent !== '' && updates.discountPercent !== null) {
        const dp = parseFloat(updates.discountPercent);
        if (!isNaN(dp) && dp >= 0 && dp <= 100) {
          const sp = Math.round((mrp * (1 - dp / 100)) * 100) / 100;
          payload.discountPercent = dp;
          payload.offerPrice = null;
          payload.sellingPrice = sp;
          payload.offerLabel = `${dp}% OFF`;
        }
      }

      if (Object.keys(payload).length > 1) {
        batch.update(productRef, payload);
      }
    }
    await batch.commit();
    return { success: true, count: productIds.length };
  } catch (error) {
    console.error('Error bulk updating product marketplace data:', error);
    return { success: false, error: error.message };
  }
};

// ============== ORDER MANAGEMENT ==============

/**
 * Get customer orders for retailer
 */
export const getCustomerOrders = async (retailerId, status = null) => {
  try {
    let q;
    const ordersRef = collection(db, 'stores', retailerId, 'customerOrders');
    
    if (status) {
      q = query(ordersRef, where('status', '==', status), orderBy('createdAt', 'desc'));
    } else {
      q = query(ordersRef, orderBy('createdAt', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting customer orders:', error);
    throw error;
  }
};

/**
 * Subscribe to new customer orders (real-time)
 */
export const subscribeToCustomerOrders = (retailerId, callback) => {
  const ordersRef = collection(db, 'stores', retailerId, 'customerOrders');
  const q = query(ordersRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(orders);
  }, (error) => {
    console.error('Error subscribing to orders:', error);
  });
};

/**
 * Update order status
 */
export const updateOrderStatus = async (retailerId, orderId, status, additionalData = {}) => {
  try {
    const orderRef = doc(db, 'stores', retailerId, 'customerOrders', orderId);
    const globalOrderRef = doc(db, 'customerOrders', orderId);
    
    const updateData = {
      status,
      [`statusHistory.${status}`]: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...additionalData
    };
    
    // Update both store-specific and global order
    await updateDoc(orderRef, updateData);
    
    // Try to update global order (may not exist)
    try {
      await updateDoc(globalOrderRef, updateData);
    } catch (e) {
      // Global order might not exist, that's okay
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating order status:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get stock availability for order items
 */
export const checkOrderItemsStock = async (retailerId, items) => {
  try {
    const stockStatus = [];
    
    for (const item of items) {
      const productRef = doc(db, 'stores', retailerId, 'products', item.productId);
      const productSnap = await getDoc(productRef);
      
      if (productSnap.exists()) {
        const product = productSnap.data();
        const availableQty = product.quantity || 0;
        const requestedQty = item.quantity || 1;
        
        stockStatus.push({
          productId: item.productId,
          name: item.name,
          requestedQty,
          availableQty,
          inStock: availableQty >= requestedQty,
          shortfall: Math.max(0, requestedQty - availableQty)
        });
      } else {
        // Product not found in marketplace
        stockStatus.push({
          productId: item.productId,
          name: item.name,
          requestedQty: item.quantity || 1,
          availableQty: 0,
          inStock: false,
          shortfall: item.quantity || 1,
          notFound: true
        });
      }
    }
    
    return {
      items: stockStatus,
      allInStock: stockStatus.every(s => s.inStock),
      outOfStockItems: stockStatus.filter(s => !s.inStock)
    };
  } catch (error) {
    console.error('Error checking order items stock:', error);
    throw error;
  }
};

/**
 * Deduct stock for order items
 */
export const deductOrderStock = async (retailerId, items) => {
  try {
    const batch = writeBatch(db);
    
    for (const item of items) {
      const productRef = doc(db, 'stores', retailerId, 'products', item.productId);
      const productSnap = await getDoc(productRef);
      
      if (productSnap.exists()) {
        const product = productSnap.data();
        const currentQty = product.quantity || 0;
        const newQty = Math.max(0, currentQty - (item.quantity || 1));
        
        batch.update(productRef, {
          quantity: newQty,
          inStock: newQty > 0,
          updatedAt: serverTimestamp()
        });
        
        // Also update the main inventory
        const mainProductRef = doc(db, 'businesses', retailerId, 'products', item.productId);
        try {
          batch.update(mainProductRef, {
            quantity: newQty,
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          // Main product might not exist with same ID
        }
      }
    }
    
    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error('Error deducting order stock:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Accept customer order and deduct stock
 */
export const acceptOrder = async (retailerId, orderId, estimatedTime = 30) => {
  try {
    // Get the order to access items
    const orderRef = doc(db, 'stores', retailerId, 'customerOrders', orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) {
      return { success: false, error: 'Order not found' };
    }
    
    const order = orderSnap.data();
    
    // Deduct stock for all items
    if (order.items && order.items.length > 0) {
      await deductOrderStock(retailerId, order.items);
    }
    
    // Update order status
    return updateOrderStatus(retailerId, orderId, 'confirmed', {
      estimatedDeliveryMinutes: estimatedTime,
      confirmedAt: serverTimestamp(),
      stockDeducted: true
    });
  } catch (error) {
    console.error('Error accepting order:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Mark order as preparing
 */
export const startPreparingOrder = async (retailerId, orderId) => {
  return updateOrderStatus(retailerId, orderId, 'preparing', {
    preparingStartedAt: serverTimestamp()
  });
};

/**
 * Mark order as ready for pickup/delivery
 */
export const markOrderReady = async (retailerId, orderId) => {
  return updateOrderStatus(retailerId, orderId, 'ready', {
    readyAt: serverTimestamp()
  });
};

/**
 * Mark order as out for delivery
 */
export const markOrderOutForDelivery = async (retailerId, orderId, deliveryInfo = {}) => {
  return updateOrderStatus(retailerId, orderId, 'out_for_delivery', {
    outForDeliveryAt: serverTimestamp(),
    deliveryPartner: deliveryInfo.partnerName || 'Store Delivery',
    deliveryPartnerPhone: deliveryInfo.partnerPhone || '',
    deliveryVehicle: deliveryInfo.vehicleNumber || '',
    // Store delivery agent details in a structured object for easier access
    deliveryAgent: {
      name: deliveryInfo.partnerName || 'Store Delivery',
      phone: deliveryInfo.partnerPhone || '',
      vehicleNumber: deliveryInfo.vehicleNumber || ''
    }
  });
};

/**
 * Mark order as delivered
 */
export const markOrderDelivered = async (retailerId, orderId) => {
  return updateOrderStatus(retailerId, orderId, 'delivered', {
    deliveredAt: serverTimestamp()
  });
};

/**
 * Cancel/reject order
 */
export const cancelOrder = async (retailerId, orderId, reason = '') => {
  return updateOrderStatus(retailerId, orderId, 'cancelled', {
    cancelledAt: serverTimestamp(),
    cancellationReason: reason,
    cancelledBy: 'retailer'
  });
};

// ============== ANALYTICS ==============

/**
 * Get marketplace stats for retailer
 */
export const getMarketplaceStats = async (retailerId) => {
  try {
    // Get store data
    const store = await getMarketplaceStore(retailerId);
    
    // Get product count
    const productsRef = collection(db, 'stores', retailerId, 'products');
    const productsSnap = await getDocs(productsRef);
    
    // Get orders
    const ordersRef = collection(db, 'stores', retailerId, 'customerOrders');
    const ordersSnap = await getDocs(ordersRef);
    const orders = ordersSnap.docs.map(doc => doc.data());
    
    // Calculate stats
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status)).length;
    const completedOrders = orders.filter(o => o.status === 'delivered').length;
    const totalRevenue = orders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total || 0), 0);
    
    return {
      store,
      totalProducts: productsSnap.size,
      totalOrders,
      pendingOrders,
      completedOrders,
      totalRevenue,
      rating: store?.rating || 0,
      isActive: store?.isActive || false
    };
  } catch (error) {
    console.error('Error getting marketplace stats:', error);
    throw error;
  }
};

/**
 * Mark a pay later order as paid
 */
export const markOrderAsPaid = async (retailerId, orderId, paymentDetails = {}) => {
  try {
    const batch = writeBatch(db);
    const now = serverTimestamp();
    
    const paymentUpdate = {
      paymentStatus: 'paid',
      amountPaid: paymentDetails.amountPaid || null,
      amountDue: 0,
      paidAt: now,
      paymentReceivedBy: paymentDetails.receivedBy || 'retailer',
      paymentNote: paymentDetails.note || '',
      updatedAt: now
    };
    
    // Update in store's customerOrders subcollection
    const storeOrderRef = doc(db, 'stores', retailerId, 'customerOrders', orderId);
    batch.update(storeOrderRef, paymentUpdate);
    
    // Also update in main customerOrders collection (for customer view)
    const mainOrderRef = doc(db, 'customerOrders', orderId);
    batch.update(mainOrderRef, paymentUpdate);
    
    await batch.commit();
    
    return { success: true };
  } catch (error) {
    console.error('Error marking order as paid:', error);
    return { success: false, error: error.message };
  }
};

export default {
  getMarketplaceStore,
  saveMarketplaceStore,
  toggleStoreStatus,
  getRetailerProducts,
  getMarketplaceProducts,
  syncProductToMarketplace,
  bulkSyncProducts,
  removeProductFromMarketplace,
  updateProductAvailability,
  updateProductMarketplaceData,
  bulkUpdateProductMarketplaceData,
  getCustomerOrders,
  subscribeToCustomerOrders,
  updateOrderStatus,
  checkOrderItemsStock,
  deductOrderStock,
  acceptOrder,
  startPreparingOrder,
  markOrderReady,
  markOrderOutForDelivery,
  markOrderDelivered,
  cancelOrder,
  markOrderAsPaid,
  getMarketplaceStats
};
