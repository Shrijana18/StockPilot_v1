/**
 * Order Service - Customer order operations
 */

import { db } from '../../firebase/firebaseConfig';
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  setDoc,
  updateDoc,
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';

/**
 * Place a new order
 */
export const placeOrder = async (orderData) => {
  try {
    const {
      customerId,
      customerName,
      customerPhone,
      storeId,
      storeName,
      storePhone,
      items,
      subtotal,
      deliveryFee,
      platformFee,
      total,
      // Delivery/Pickup info
      orderType = 'delivery', // 'delivery' or 'pickup'
      deliveryAddress,
      deliverySlot,
      // Customer distance from store (for ETA)
      customerDistance,
      // Scheduled delivery fields
      isScheduledDelivery,
      deliveryDate,
      deliveryDateLabel,
      // Pickup fields
      pickupSlot,
      pickupDate,
      pickupDateLabel,
      pickupInstructions,
      scheduledTime,
      // Payment info
      paymentMethod,
      payNow = total,
      payLater = 0,
      paymentDueDate,
      specialInstructions
    } = orderData;

    // Generate order number
    const orderNumber = `ORD${Date.now().toString(36).toUpperCase()}`;

    // Determine payment status
    let paymentStatus = 'pending';
    if (paymentMethod === 'UPI') {
      paymentStatus = 'paid';
    } else if (paymentMethod === 'PAY_LATER') {
      paymentStatus = 'pay_later';
    } else if (paymentMethod === 'PARTIAL') {
      paymentStatus = 'partial_paid';
    }

    const order = {
      orderNumber,
      customerId,
      customerName,
      customerPhone,
      storeId,
      storeName,
      storePhone,
      items,
      subtotal,
      deliveryFee,
      platformFee,
      total,
      // Order type
      orderType,
      // Delivery info (if delivery)
      deliveryAddress: orderType === 'delivery' ? deliveryAddress : null,
      deliverySlot: orderType === 'delivery' ? deliverySlot : null,
      // Customer distance from store (for ETA calculation)
      customerDistance: orderType === 'delivery' ? customerDistance : null,
      // Scheduled delivery info
      isScheduledDelivery: orderType === 'delivery' ? Boolean(isScheduledDelivery) : false,
      deliveryDate: orderType === 'delivery' && isScheduledDelivery ? deliveryDate : null,
      deliveryDateLabel: orderType === 'delivery' && isScheduledDelivery ? deliveryDateLabel : null,
      // Pickup info (if pickup)
      pickupSlot: orderType === 'pickup' ? pickupSlot : null,
      pickupDate: orderType === 'pickup' ? pickupDate : null,
      pickupDateLabel: orderType === 'pickup' ? pickupDateLabel : null,
      pickupInstructions: orderType === 'pickup' ? pickupInstructions : null,
      scheduledTime: scheduledTime || null,
      // Payment info
      paymentMethod,
      paymentStatus,
      payNow,
      payLater,
      paymentDueDate: paymentDueDate || null,
      amountPaid: paymentMethod === 'PAY_LATER' ? 0 : payNow,
      amountDue: payLater,
      // Status
      status: 'pending',
      statusHistory: {
        pending: serverTimestamp()
      },
      specialInstructions: specialInstructions || '',
      deliveryPartner: null,
      deliveryPartnerPhone: null,
      estimatedDeliveryMinutes: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Add to customerOrders collection
    const orderRef = await addDoc(collection(db, 'customerOrders'), order);

    // Also add to store's orders subcollection for retailer access (same ID)
    await setDoc(doc(db, 'stores', storeId, 'customerOrders', orderRef.id), {
      ...order,
      orderId: orderRef.id
    });

    return { 
      success: true, 
      orderId: orderRef.id, 
      orderNumber 
    };
  } catch (error) {
    console.error('Error placing order:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get customer's orders
 */
export const getCustomerOrders = async (customerId, limitCount = 20) => {
  try {
    const ordersRef = collection(db, 'customerOrders');
    // Simple query without orderBy to avoid requiring composite index
    const q = query(
      ordersRef,
      where('customerId', '==', customerId),
      limit(limitCount * 2) // Get more, we'll sort and limit client-side
    );

    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date()
    }));

    // Sort by createdAt descending (newest first) client-side
    orders.sort((a, b) => b.createdAt - a.createdAt);
    
    return orders.slice(0, limitCount);
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
};

/**
 * Get single order details
 */
export const getOrderById = async (orderId) => {
  try {
    const orderDoc = await getDoc(doc(db, 'customerOrders', orderId));
    if (orderDoc.exists()) {
      return {
        id: orderDoc.id,
        ...orderDoc.data(),
        createdAt: orderDoc.data().createdAt?.toDate?.() || new Date()
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching order:', error);
    throw error;
  }
};

/**
 * Listen to order status changes (real-time)
 */
export const subscribeToOrder = (orderId, callback) => {
  const orderRef = doc(db, 'customerOrders', orderId);
  
  return onSnapshot(orderRef, (doc) => {
    if (doc.exists()) {
      callback({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      });
    }
  }, (error) => {
    console.error('Error in order subscription:', error);
  });
};

/**
 * Cancel order (only if not yet accepted)
 */
export const cancelOrder = async (orderId, reason) => {
  try {
    const orderRef = doc(db, 'customerOrders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      return { success: false, error: 'Order not found' };
    }

    const order = orderDoc.data();
    
    // Can only cancel if status is 'pending'
    if (order.status !== 'pending') {
      return { 
        success: false, 
        error: 'Cannot cancel order. It has already been accepted by the store.' 
      };
    }

    await updateDoc(orderRef, {
      status: 'cancelled',
      'statusHistory.cancelled': serverTimestamp(),
      cancellationReason: reason,
      cancelledBy: 'customer',
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error cancelling order:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Rate order/store and delivery person
 */
export const rateOrder = async (orderId, ratingData) => {
  try {
    const {
      storeRating,
      storeReview,
      deliveryPersonRating,
      deliveryPersonReview,
      deliveryPersonName,
      deliveryPersonId
    } = ratingData;

    const orderRef = doc(db, 'customerOrders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      return { success: false, error: 'Order not found' };
    }

    const orderData = orderDoc.data();
    const updates = {
      ratedAt: serverTimestamp()
    };

    // Store rating and review
    if (storeRating !== undefined) {
      updates.storeRating = storeRating;
      if (storeReview) updates.storeReview = storeReview;
    }

    // Delivery person rating and review (only for delivery orders)
    if (orderData.orderType === 'delivery' && deliveryPersonRating !== undefined) {
      updates.deliveryPersonRating = deliveryPersonRating;
      if (deliveryPersonReview) updates.deliveryPersonReview = deliveryPersonReview;
      if (deliveryPersonName) updates.deliveryPersonName = deliveryPersonName;
      if (deliveryPersonId) updates.deliveryPersonId = deliveryPersonId;
    }

    await updateDoc(orderRef, updates);

    // Also save review to store's reviews collection for display on retailer profile
    if (storeRating !== undefined && orderData.storeId) {
      const storeReviewsRef = collection(db, 'stores', orderData.storeId, 'reviews');
      await addDoc(storeReviewsRef, {
        orderId,
        customerId: orderData.customerId,
        customerName: orderData.customerName,
        rating: storeRating,
        review: storeReview || '',
        createdAt: serverTimestamp(),
        orderDate: orderData.createdAt
      });

      // Update store's average rating
      const storeRef = doc(db, 'stores', orderData.storeId);
      const storeDoc = await getDoc(storeRef);
      if (storeDoc.exists()) {
        const storeData = storeDoc.data();
        const existingReviews = storeData.reviews || [];
        const newReviews = [...existingReviews, storeRating];
        const avgRating = newReviews.reduce((sum, r) => sum + r, 0) / newReviews.length;
        await updateDoc(storeRef, {
          rating: Math.round(avgRating * 10) / 10,
          totalReviews: newReviews.length,
          reviews: newReviews.slice(-100) // Keep last 100 ratings for calculation
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error rating order:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get order status display info
 * @param {string} status - Order status
 * @param {string} orderType - 'delivery' or 'pickup'
 */
export const getOrderStatusInfo = (status, orderType = 'delivery') => {
  const isPickup = orderType === 'pickup';
  
  const statusMap = {
    'pending': {
      label: 'Order Placed',
      description: 'Waiting for store to accept',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/20',
      icon: '📝',
      step: 1
    },
    'confirmed': {
      label: 'Confirmed',
      description: 'Store has accepted your order',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20',
      icon: '✅',
      step: 2
    },
    'preparing': {
      label: 'Preparing',
      description: 'Your order is being packed',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/20',
      icon: '📦',
      step: 3
    },
    'ready': {
      label: isPickup ? 'Ready for Pickup' : 'Ready',
      description: isPickup ? 'Your order is ready to collect' : 'Your order is ready for delivery',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/20',
      icon: isPickup ? '🏪' : '✨',
      step: 4
    },
    'out_for_delivery': {
      label: 'Out for Delivery',
      description: 'Your order is on the way',
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/20',
      icon: '🚚',
      step: 5
    },
    'delivered': {
      label: isPickup ? 'Picked Up' : 'Delivered',
      description: isPickup ? 'Order picked up successfully' : 'Order delivered successfully',
      color: 'text-green-500',
      bgColor: 'bg-green-500/20',
      icon: '🎉',
      step: isPickup ? 5 : 6
    },
    'cancelled': {
      label: 'Cancelled',
      description: 'Order was cancelled',
      color: 'text-red-500',
      bgColor: 'bg-red-500/20',
      icon: '❌',
      step: 0
    }
  };

  return statusMap[status] || statusMap['pending'];
};
