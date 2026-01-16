import { db } from '../firebase/firebaseConfig';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  runTransaction,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { logInventoryChange } from '../utils/logInventoryChange';

/**
 * Stock Management Service
 * Handles real-time inventory checking, reservation, and deduction for orders
 */

/**
 * Check stock availability for order items
 * @param {string} distributorId - Distributor's user ID
 * @param {Array} orderItems - Array of order items with sku and qty
 * @returns {Promise<Object>} Stock availability status for each item
 */
export async function checkStockAvailability(distributorId, orderItems) {
  if (!distributorId || !Array.isArray(orderItems) || orderItems.length === 0) {
    return { available: false, items: [], errors: ['Invalid input'] };
  }

  const stockStatus = {
    available: true,
    items: [],
    warnings: [],
    errors: []
  };

  try {
    // Get all SKUs from order items
    const skus = orderItems
      .map(item => item.sku || item.SKU)
      .filter(Boolean);

    if (skus.length === 0) {
      stockStatus.available = false;
      stockStatus.errors.push('No valid SKUs found in order items');
      return stockStatus;
    }

    // Fetch inventory products by SKU
    const productsRef = collection(db, `businesses/${distributorId}/products`);
    const productsQuery = query(productsRef, where('sku', 'in', skus));
    const productsSnap = await getDocs(productsQuery);
    
    // Create a map of SKU -> Product
    const inventoryMap = new Map();
    productsSnap.forEach(doc => {
      const product = { id: doc.id, ...doc.data() };
      inventoryMap.set(product.sku, product);
    });

    // Check each order item against inventory
    for (const orderItem of orderItems) {
      const sku = orderItem.sku || orderItem.SKU;
      const requestedQty = Number(orderItem.qty || orderItem.quantity || 0);
      
      if (!sku) {
        stockStatus.items.push({
          sku: 'N/A',
          name: orderItem.name || orderItem.productName || 'Unknown',
          requested: requestedQty,
          available: 0,
          reserved: 0,
          status: 'not_found',
          message: 'SKU not provided'
        });
        stockStatus.available = false;
        continue;
      }

      const product = inventoryMap.get(sku);
      
      if (!product) {
        stockStatus.items.push({
          sku,
          name: orderItem.name || orderItem.productName || 'Unknown',
          requested: requestedQty,
          available: 0,
          reserved: 0,
          status: 'not_found',
          message: 'Product not found in inventory'
        });
        stockStatus.available = false;
        stockStatus.warnings.push(`Product ${sku} not found in inventory`);
        continue;
      }

      const currentStock = Number(product.quantity || 0);
      const reservedStock = Number(product.reservedQuantity || 0);
      const availableStock = currentStock - reservedStock;

      const itemStatus = {
        sku,
        productId: product.id,
        name: product.productName || product.name || orderItem.name || 'Unknown',
        requested: requestedQty,
        available: availableStock,
        reserved: reservedStock,
        totalStock: currentStock,
        status: 'available',
        message: 'In stock'
      };

      if (availableStock < requestedQty) {
        itemStatus.status = 'insufficient';
        itemStatus.message = `Only ${availableStock} available (requested: ${requestedQty})`;
        stockStatus.available = false;
        stockStatus.warnings.push(
          `${itemStatus.name} (${sku}): Insufficient stock. Available: ${availableStock}, Requested: ${requestedQty}`
        );
      } else if (availableStock === requestedQty) {
        itemStatus.status = 'exact';
        itemStatus.message = 'Exact stock available';
        stockStatus.warnings.push(
          `${itemStatus.name} (${sku}): Stock will be depleted after this order`
        );
      }

      stockStatus.items.push(itemStatus);
    }

    return stockStatus;
  } catch (error) {
    console.error('[StockManagement] Error checking stock:', error);
    stockStatus.available = false;
    stockStatus.errors.push(`Error checking stock: ${error.message}`);
    return stockStatus;
  }
}

/**
 * Reserve stock for an order (atomic transaction)
 * This prevents concurrent orders from overselling
 * @param {string} distributorId - Distributor's user ID
 * @param {string} orderId - Order ID
 * @param {Array} orderItems - Array of order items
 * @returns {Promise<Object>} Reservation result
 */
export async function reserveStockForOrder(distributorId, orderId, orderItems) {
  if (!distributorId || !orderId || !Array.isArray(orderItems)) {
    throw new Error('Invalid parameters for stock reservation');
  }

  try {
    // First, fetch all product references by SKU (outside transaction)
    // Aggregate quantities by SKU to avoid multiple reads/updates per product
    const qtyBySku = new Map();
    for (const item of orderItems) {
      const sku = item.sku || item.SKU;
      const qty = Number(item.qty || item.quantity || 0);
      if (!sku || qty <= 0) continue;
      qtyBySku.set(sku, (qtyBySku.get(sku) || 0) + qty);
    }
    const skus = Array.from(qtyBySku.keys());
    
    if (skus.length === 0) {
      throw new Error('No valid SKUs found in order items');
    }

    const productsRef = collection(db, `businesses/${distributorId}/products`);
    // Firestore 'in' queries are limited to 10 items, so we need to handle this
    const productQueries = [];
    for (let i = 0; i < skus.length; i += 10) {
      productQueries.push(query(productsRef, where('sku', 'in', skus.slice(i, i + 10))));
    }
    const productSnaps = await Promise.all(productQueries.map(q => getDocs(q)));

    // Create a map of SKU -> DocumentReference
    const skuToRef = new Map();
    productSnaps.forEach(snap => {
      snap.forEach(doc => {
        const sku = doc.data().sku;
        if (sku) skuToRef.set(sku, doc.ref);
      });
    });

    // Now perform the transaction
    const result = await runTransaction(db, async (transaction) => {
      const reservations = [];
      const errors = [];
      const productDataBySku = new Map();

      // READS FIRST: load all product docs in the transaction
      for (const [sku, requestedQty] of qtyBySku.entries()) {
        if (!sku || requestedQty <= 0) {
          errors.push(`Invalid item: ${sku}`);
          continue;
        }

        const productRef = skuToRef.get(sku);
        if (!productRef) {
          errors.push(`Product with SKU ${sku} not found`);
          continue;
        }

        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) {
          errors.push(`Product with SKU ${sku} not found`);
          continue;
        }

        const productData = productSnap.data();
        const currentStock = Number(productData.quantity || 0);
        const reservedStock = Number(productData.reservedQuantity || 0);
        const availableStock = currentStock - reservedStock;

        if (availableStock < requestedQty) {
          errors.push(
            `Insufficient stock for ${sku}: Available ${availableStock}, Requested ${requestedQty}`
          );
          continue;
        }

        productDataBySku.set(sku, {
          ref: productRef,
          snap: productSnap,
          currentStock,
          reservedStock,
          requestedQty
        });
      }

      if (errors.length > 0) {
        throw new Error(`Stock reservation failed: ${errors.join('; ')}`);
      }

      // WRITES AFTER READS: reserve stock
      for (const [sku, data] of productDataBySku.entries()) {
        const newReservedQty = data.reservedStock + data.requestedQty;
        transaction.update(data.ref, {
          reservedQuantity: newReservedQty,
          lastReservedAt: serverTimestamp(),
          lastReservedBy: orderId
        });

        reservations.push({
          sku,
          productId: data.snap.id,
          quantity: data.requestedQty,
          reservedQuantity: newReservedQty
        });
      }

      return { success: true, reservations, errors: [] };
    });

    return result;
  } catch (error) {
    console.error('[StockManagement] Error reserving stock:', error);
    throw error;
  }
}

/**
 * Release reserved stock (when order is rejected or cancelled)
 * @param {string} distributorId - Distributor's user ID
 * @param {Array} orderItems - Array of order items to release
 * @returns {Promise<Object>} Release result
 */
export async function releaseReservedStock(distributorId, orderItems) {
  if (!distributorId || !Array.isArray(orderItems)) {
    throw new Error('Invalid parameters for stock release');
  }

  try {
    const batch = writeBatch(db);
    const releases = [];

    for (const orderItem of orderItems) {
      const sku = orderItem.sku || orderItem.SKU;
      const qtyToRelease = Number(orderItem.qty || orderItem.quantity || 0);

      if (!sku || qtyToRelease <= 0) continue;

      // Find product by SKU
      const productsRef = collection(db, `businesses/${distributorId}/products`);
      const productQuery = query(productsRef, where('sku', '==', sku));
      const productSnap = await getDocs(productQuery);

      if (productSnap.empty) continue;

      const productDoc = productSnap.docs[0];
      const productData = productDoc.data();
      const currentReserved = Number(productData.reservedQuantity || 0);
      const newReserved = Math.max(0, currentReserved - qtyToRelease);

      batch.update(productDoc.ref, {
        reservedQuantity: newReserved,
        lastReleasedAt: serverTimestamp()
      });

      releases.push({ sku, released: qtyToRelease, newReserved });
    }

    await batch.commit();
    return { success: true, releases };
  } catch (error) {
    console.error('[StockManagement] Error releasing stock:', error);
    throw error;
  }
}

/**
 * Deduct stock when order is accepted (convert reservation to actual deduction)
 * @param {string} distributorId - Distributor's user ID
 * @param {string} orderId - Order ID
 * @param {Array} orderItems - Array of order items
 * @returns {Promise<Object>} Deduction result with inventory changes
 */
export async function deductStockOnAccept(distributorId, orderId, orderItems) {
  if (!distributorId || !orderId || !Array.isArray(orderItems)) {
    throw new Error('Invalid parameters for stock deduction');
  }

  try {
    // First, fetch all product references by SKU (outside transaction)
    // Aggregate quantities by SKU to avoid multiple reads/updates per product
    const qtyBySku = new Map();
    for (const item of orderItems) {
      const sku = item.sku || item.SKU;
      const qty = Number(item.qty || item.quantity || 0);
      if (!sku || qty <= 0) continue;
      qtyBySku.set(sku, (qtyBySku.get(sku) || 0) + qty);
    }
    const skus = Array.from(qtyBySku.keys());
    
    if (skus.length === 0) {
      throw new Error('No valid SKUs found in order items');
    }

    const productsRef = collection(db, `businesses/${distributorId}/products`);
    // Firestore 'in' queries are limited to 10 items, so we need to handle this
    const productQueries = [];
    for (let i = 0; i < skus.length; i += 10) {
      const skuBatch = skus.slice(i, i + 10);
      productQueries.push(query(productsRef, where('sku', 'in', skuBatch)));
    }
    
    const allProductSnaps = await Promise.all(productQueries.map(q => getDocs(q)));
    
    // Create a map of SKU -> DocumentReference
    const skuToRef = new Map();
    allProductSnaps.forEach(snap => {
      snap.forEach(doc => {
        const productData = doc.data();
        const sku = productData.sku;
        if (sku) {
          skuToRef.set(sku, doc.ref);
        }
      });
    });

    // Now perform the transaction
    const result = await runTransaction(db, async (transaction) => {
      const deductions = [];
      const errors = [];
      const productDataBySku = new Map();

      // READS FIRST: load all product docs in the transaction
      for (const [sku, qtyToDeduct] of qtyBySku.entries()) {
        if (!sku || qtyToDeduct <= 0) {
          errors.push(`Invalid item: ${sku}`);
          continue;
        }

        const productRef = skuToRef.get(sku);
        if (!productRef) {
          errors.push(`Product with SKU ${sku} not found`);
          continue;
        }

        const productSnap = await transaction.get(productRef);
        if (!productSnap.exists()) {
          errors.push(`Product with SKU ${sku} not found`);
          continue;
        }

        const productData = productSnap.data();
        const currentStock = Number(productData.quantity || 0);
        const reservedStock = Number(productData.reservedQuantity || 0);

        // Verify we have enough reserved stock
        if (reservedStock < qtyToDeduct) {
          const availableStock = currentStock - reservedStock;
          if (availableStock < qtyToDeduct) {
            errors.push(
              `Insufficient stock for ${sku}: Available ${availableStock}, Requested ${qtyToDeduct}`
            );
            continue;
          }
        }

        productDataBySku.set(sku, {
          ref: productRef,
          snap: productSnap,
          productName: productData.productName || productData.name || 'Unknown',
          currentStock,
          reservedStock,
          qtyToDeduct
        });
      }

      if (errors.length > 0) {
        throw new Error(`Stock deduction failed: ${errors.join('; ')}`);
      }

      // WRITES AFTER READS: apply deductions
      for (const [sku, data] of productDataBySku.entries()) {
        const newStock = Math.max(0, data.currentStock - data.qtyToDeduct);
        const newReserved = Math.max(0, data.reservedStock - data.qtyToDeduct);

        transaction.update(data.ref, {
          quantity: newStock,
          reservedQuantity: newReserved,
          lastDeductedAt: serverTimestamp(),
          lastDeductedBy: orderId
        });

        deductions.push({
          sku,
          productId: data.snap.id,
          productName: data.productName,
          quantityDeducted: data.qtyToDeduct,
          previousStock: data.currentStock,
          newStock,
          previousReserved: data.reservedStock,
          newReserved
        });
      }

      return { success: true, deductions, errors: [] };
    });

    // Log inventory changes after successful transaction
    if (result.success && result.deductions) {
      for (const deduction of result.deductions) {
        try {
          const productRef = skuToRef.get(deduction.sku);
          if (productRef) {
            const productSnap = await getDoc(productRef);
            if (productSnap.exists()) {
              const productData = productSnap.data();
              await logInventoryChange({
                userId: distributorId,
                productId: deduction.productId,
                sku: deduction.sku,
                productName: deduction.productName,
                brand: productData.brand || 'N/A',
                category: productData.category || 'N/A',
                previousData: { quantity: deduction.previousStock, reservedQuantity: deduction.previousReserved },
                updatedData: { quantity: deduction.newStock, reservedQuantity: deduction.newReserved },
                action: 'deducted',
                source: 'order-acceptance',
                orderId: orderId,
                quantityChange: -deduction.quantityDeducted
              });
            }
          }
        } catch (logError) {
          console.warn('[StockManagement] Failed to log inventory change:', logError);
        }
      }
    }

    return result;
  } catch (error) {
    console.error('[StockManagement] Error deducting stock:', error);
    throw error;
  }
}

/**
 * Get real-time stock status for a single product by SKU
 * @param {string} distributorId - Distributor's user ID
 * @param {string} sku - Product SKU
 * @returns {Promise<Object|null>} Stock status or null if not found
 */
export async function getProductStockStatus(distributorId, sku) {
  if (!distributorId || !sku) return null;

  try {
    const productsRef = collection(db, `businesses/${distributorId}/products`);
    const productQuery = query(productsRef, where('sku', '==', sku));
    const productSnap = await getDocs(productQuery);

    if (productSnap.empty) return null;

    const productDoc = productSnap.docs[0];
    const productData = productDoc.data();
    const currentStock = Number(productData.quantity || 0);
    const reservedStock = Number(productData.reservedQuantity || 0);
    const availableStock = currentStock - reservedStock;

    return {
      productId: productDoc.id,
      sku,
      productName: productData.productName || productData.name || 'Unknown',
      totalStock: currentStock,
      reservedStock,
      availableStock,
      isLowStock: availableStock <= 5,
      isOutOfStock: availableStock <= 0
    };
  } catch (error) {
    console.error('[StockManagement] Error getting stock status:', error);
    return null;
  }
}

