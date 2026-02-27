/**
 * Delivery Employee Service
 * Handles assignment of delivery orders to employees and syncing
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
  writeBatch
} from 'firebase/firestore';

/**
 * Assign order to employee for delivery
 */
export const assignOrderToEmployee = async (retailerId, orderId, employeeId) => {
  try {
    // Get employee details
    const employeeRef = doc(db, 'businesses', retailerId, 'employees', employeeId);
    const employeeDoc = await getDoc(employeeRef);
    
    if (!employeeDoc.exists()) {
      throw new Error('Employee not found');
    }

    const employeeData = employeeDoc.data();

    // Get order details - Orders are stored in stores collection, not businesses
    const orderRef = doc(db, 'stores', retailerId, 'customerOrders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      throw new Error('Order not found');
    }

    const orderData = orderDoc.data();

    // Update order with employee assignment in stores collection
    const orderUpdateData = {
      assignedEmployeeId: employeeId,
      assignedEmployee: {
        id: employeeId,
        name: employeeData.name || '',
        phone: employeeData.phone || '',
        flypEmployeeId: employeeData.flypEmployeeId || employeeId
      },
      assignedAt: serverTimestamp(),
      status: 'out_for_delivery',
      outForDeliveryAt: serverTimestamp(),
      [`statusHistory.out_for_delivery`]: serverTimestamp(),
      deliveryAgent: {
        name: employeeData.name || '',
        phone: employeeData.phone || '',
        employeeId: employeeId,
        flypEmployeeId: employeeData.flypEmployeeId || employeeId,
        vehicleNumber: orderData.deliveryAgent?.vehicleNumber || ''
      },
      updatedAt: serverTimestamp()
    };
    await updateDoc(orderRef, orderUpdateData);

    // Also update global customerOrders collection (for customer tracking)
    const globalOrderRef = doc(db, 'customerOrders', orderId);
    try {
      await updateDoc(globalOrderRef, orderUpdateData);
    } catch (error) {
      // Global order might not exist, try to create it from store order
      const orderDoc = await getDoc(orderRef);
      if (orderDoc.exists()) {
        await setDoc(globalOrderRef, {
          ...orderDoc.data(),
          ...orderUpdateData
        }, { merge: true });
      }
    }

    // Use the employee document ID (not flypEmployeeId) for consistency
    // The employeeId passed here is the document ID from the dropdown selection
    // Store both the document ID and flypEmployeeId for flexible querying
    const employeeDocId = employeeId; // This is the document ID
    const flypEmployeeId = employeeData.flypEmployeeId || employeeId;
    
    // Create/update employee delivery assignment
    // Use document ID as primary key for consistency
    const assignmentRef = doc(db, 'businesses', retailerId, 'employeeDeliveries', `${orderId}_${employeeDocId}`);
    await setDoc(assignmentRef, {
      orderId,
      employeeId: employeeDocId, // Store document ID (primary)
      flypEmployeeId: flypEmployeeId, // Also store flypEmployeeId for flexible querying
      retailerId,
      status: 'assigned',
      assignedAt: serverTimestamp(),
      orderData: {
        orderNumber: orderData.orderNumber,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        deliveryAddress: orderData.deliveryAddress,
        total: orderData.total,
        items: orderData.items,
        orderType: orderData.orderType
      },
      employeeData: {
        name: employeeData.name,
        phone: employeeData.phone,
        flypEmployeeId: flypEmployeeId
      }
    }, { merge: true });

    return { success: true, message: 'Order assigned to employee' };
  } catch (error) {
    console.error('Error assigning order to employee:', error);
    throw error;
  }
};

/**
 * Get all employees for a retailer (for assignment dropdown)
 */
export const getRetailerEmployees = async (retailerId) => {
  try {
    const employeesRef = collection(db, 'businesses', retailerId, 'employees');
    const snapshot = await getDocs(employeesRef);
    
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(emp => emp.status === 'active'); // Only active employees
  } catch (error) {
    console.error('Error getting retailer employees:', error);
    throw error;
  }
};

/**
 * Subscribe to employee's assigned delivery orders
 */
export const subscribeToEmployeeDeliveries = (retailerId, employeeId, callback) => {
  let unsubscribe = () => {};
  
  // Employee session might have flypEmployeeId (EMP-xxx) but assignments use document ID
  // First, resolve the employee document ID
  const resolveEmployeeDocId = async () => {
    if (employeeId.toUpperCase().startsWith('EMP-')) {
      // Session has flypEmployeeId, find document ID
      const employeesRef = collection(db, 'businesses', retailerId, 'employees');
      const empQuery = query(employeesRef, where('flypEmployeeId', '==', employeeId.toUpperCase()));
      const empSnapshot = await getDocs(empQuery);
      if (!empSnapshot.empty) {
        return empSnapshot.docs[0].id; // Return document ID
      }
      return null;
    } else {
      // Session has document ID, use it directly
      return employeeId;
    }
  };
  
  // Resolve employee document ID first, then set up subscription
  resolveEmployeeDocId().then((employeeDocId) => {
    if (!employeeDocId) {
      console.error('Employee document not found for:', employeeId);
      callback([]);
      return;
    }
    
    // Query deliveries using document ID (no orderBy to avoid index requirement)
    const q = query(
      collection(db, 'businesses', retailerId, 'employeeDeliveries'),
      where('employeeId', '==', employeeDocId),
      where('status', 'in', ['assigned', 'picked_up', 'out_for_delivery'])
    );
    
    unsubscribe = onSnapshot(q, (snapshot) => {
      const deliveries = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        // Sort by assignedAt descending (newest first) client-side
        .sort((a, b) => {
          const aTime = a.assignedAt?.toDate ? a.assignedAt.toDate().getTime() : 0;
          const bTime = b.assignedAt?.toDate ? b.assignedAt.toDate().getTime() : 0;
          return bTime - aTime;
        });
      callback(deliveries);
    }, (error) => {
      console.error('Error subscribing to employee deliveries:', error);
      callback([]);
    });
  }).catch((error) => {
    console.error('Error resolving employee document ID:', error);
    callback([]);
  });
  
  // Return cleanup function
  return () => unsubscribe();
};

/**
 * Get employee's assigned delivery orders
 */
export const getEmployeeDeliveries = async (retailerId, employeeId) => {
  try {
    // Resolve employee document ID (assignments use document ID, not flypEmployeeId)
    let employeeDocId = employeeId;
    if (employeeId.toUpperCase().startsWith('EMP-')) {
      const employeesRef = collection(db, 'businesses', retailerId, 'employees');
      const empQuery = query(employeesRef, where('flypEmployeeId', '==', employeeId.toUpperCase()));
      const empSnapshot = await getDocs(empQuery);
      if (!empSnapshot.empty) {
        employeeDocId = empSnapshot.docs[0].id;
      } else {
        return []; // Employee not found, return empty
      }
    }
    
    const deliveriesRef = collection(db, 'businesses', retailerId, 'employeeDeliveries');
    // Query without orderBy to avoid index requirement - sort client-side
    const q = query(
      deliveriesRef,
      where('employeeId', '==', employeeDocId),
      where('status', 'in', ['assigned', 'picked_up', 'out_for_delivery'])
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      // Sort by assignedAt descending (newest first) client-side
      .sort((a, b) => {
        const aTime = a.assignedAt?.toDate ? a.assignedAt.toDate().getTime() : 0;
        const bTime = b.assignedAt?.toDate ? b.assignedAt.toDate().getTime() : 0;
        return bTime - aTime;
      });
  } catch (error) {
    console.error('Error getting employee deliveries:', error);
    throw error;
  }
};

/**
 * Mark order as picked up by employee
 */
export const markOrderPickedUp = async (retailerId, orderId, employeeId) => {
  try {
    // Resolve employee document ID (assignments use document ID, not flypEmployeeId)
    let employeeDocId = employeeId;
    if (employeeId.toUpperCase().startsWith('EMP-')) {
      const employeesRef = collection(db, 'businesses', retailerId, 'employees');
      const empQuery = query(employeesRef, where('flypEmployeeId', '==', employeeId.toUpperCase()));
      const empSnapshot = await getDocs(empQuery);
      if (!empSnapshot.empty) {
        employeeDocId = empSnapshot.docs[0].id;
      } else {
        throw new Error('Employee not found');
      }
    }
    
    const assignmentRef = doc(db, 'businesses', retailerId, 'employeeDeliveries', `${orderId}_${employeeDocId}`);
    const assignmentDoc = await getDoc(assignmentRef);

    if (!assignmentDoc.exists()) {
      throw new Error('Assignment not found');
    }

    // Get employee data for sync
    const employeeRef = doc(db, 'businesses', retailerId, 'employees', employeeDocId);
    const employeeDataDoc = await getDoc(employeeRef);
    const employeeData = employeeDataDoc.exists() 
      ? employeeDataDoc.data() 
      : (assignmentDoc.data().employeeData || {});

    // Update assignment
    await updateDoc(assignmentRef, {
      status: 'picked_up',
      pickedUpAt: serverTimestamp()
    });

    // Update order status in stores collection (for retailer)
    const orderRef = doc(db, 'stores', retailerId, 'customerOrders', orderId);
    const orderUpdateData = {
      status: 'out_for_delivery',
      outForDeliveryAt: serverTimestamp(),
      [`statusHistory.out_for_delivery`]: serverTimestamp(),
      deliveryAgent: {
        name: employeeData.name || '',
        phone: employeeData.phone || '',
        employeeId: employeeDocId,
        flypEmployeeId: employeeData.flypEmployeeId || employeeDocId
      },
      assignedEmployee: {
        id: employeeDocId,
        name: employeeData.name || '',
        phone: employeeData.phone || '',
        flypEmployeeId: employeeData.flypEmployeeId || employeeDocId
      },
      updatedAt: serverTimestamp()
    };
    await updateDoc(orderRef, orderUpdateData);

    // Also update global customerOrders collection (for customer tracking)
    const globalOrderRef = doc(db, 'customerOrders', orderId);
    try {
      await updateDoc(globalOrderRef, orderUpdateData);
    } catch (error) {
      // Global order might not exist, try to create it from store order
      const orderDoc = await getDoc(orderRef);
      if (orderDoc.exists()) {
        await setDoc(globalOrderRef, {
          ...orderDoc.data(),
          ...orderUpdateData
        }, { merge: true });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error marking order as picked up:', error);
    throw error;
  }
};

/**
 * Mark order as delivered by employee
 */
export const markOrderDeliveredByEmployee = async (retailerId, orderId, employeeId, deliveryProof = {}) => {
  try {
    // Resolve employee document ID (assignments use document ID, not flypEmployeeId)
    let employeeDocId = employeeId;
    if (employeeId.toUpperCase().startsWith('EMP-')) {
      const employeesRef = collection(db, 'businesses', retailerId, 'employees');
      const empQuery = query(employeesRef, where('flypEmployeeId', '==', employeeId.toUpperCase()));
      const empSnapshot = await getDocs(empQuery);
      if (!empSnapshot.empty) {
        employeeDocId = empSnapshot.docs[0].id;
      } else {
        throw new Error('Employee not found');
      }
    }
    
    const assignmentRef = doc(db, 'businesses', retailerId, 'employeeDeliveries', `${orderId}_${employeeDocId}`);
    const assignmentDoc = await getDoc(assignmentRef);

    if (!assignmentDoc.exists()) {
      throw new Error('Assignment not found');
    }

    // Get employee data for sync
    const employeeRef = doc(db, 'businesses', retailerId, 'employees', employeeDocId);
    const employeeDataDoc = await getDoc(employeeRef);
    const employeeData = employeeDataDoc.exists() ? employeeDataDoc.data() : assignmentDoc.data().employeeData || {};

    // Update assignment
    await updateDoc(assignmentRef, {
      status: 'delivered',
      deliveredAt: serverTimestamp(),
      deliveryProof: {
        signature: deliveryProof.signature || null,
        photo: deliveryProof.photo || null,
        notes: deliveryProof.notes || ''
      }
    });

    // Update order status in stores collection (for retailer)
    const orderRef = doc(db, 'stores', retailerId, 'customerOrders', orderId);
    const orderUpdateData = {
      status: 'delivered',
      deliveredAt: serverTimestamp(),
      [`statusHistory.delivered`]: serverTimestamp(),
      deliveredBy: {
        type: 'employee',
        employeeId: employeeDocId,
        flypEmployeeId: employeeData.flypEmployeeId || employeeDocId,
        name: employeeData.name || assignmentDoc.data().employeeData?.name || ''
      },
      deliveryAgent: {
        name: employeeData.name || assignmentDoc.data().employeeData?.name || '',
        phone: employeeData.phone || assignmentDoc.data().employeeData?.phone || '',
        employeeId: employeeDocId,
        flypEmployeeId: employeeData.flypEmployeeId || employeeDocId
      },
      updatedAt: serverTimestamp()
    };
    await updateDoc(orderRef, orderUpdateData);

    // Also update global customerOrders collection (for customer tracking)
    const globalOrderRef = doc(db, 'customerOrders', orderId);
    try {
      await updateDoc(globalOrderRef, orderUpdateData);
    } catch (error) {
      // Global order might not exist, try to create it from store order
      const orderDoc = await getDoc(orderRef);
      if (orderDoc.exists()) {
        await setDoc(globalOrderRef, {
          ...orderDoc.data(),
          ...orderUpdateData
        }, { merge: true });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error marking order as delivered:', error);
    throw error;
  }
};

/**
 * Get delivery history for employee
 */
export const getEmployeeDeliveryHistory = async (retailerId, employeeId, limit = 50) => {
  try {
    // Resolve employee document ID (assignments use document ID, not flypEmployeeId)
    let employeeDocId = employeeId;
    if (employeeId.toUpperCase().startsWith('EMP-')) {
      const employeesRef = collection(db, 'businesses', retailerId, 'employees');
      const empQuery = query(employeesRef, where('flypEmployeeId', '==', employeeId.toUpperCase()));
      const empSnapshot = await getDocs(empQuery);
      if (!empSnapshot.empty) {
        employeeDocId = empSnapshot.docs[0].id;
      } else {
        return []; // Employee not found, return empty
      }
    }
    
    const deliveriesRef = collection(db, 'businesses', retailerId, 'employeeDeliveries');
    // Query without orderBy to avoid index requirement - sort client-side
    const q = query(
      deliveriesRef,
      where('employeeId', '==', employeeDocId),
      where('status', '==', 'delivered')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      // Sort by deliveredAt descending (newest first) client-side
      .sort((a, b) => {
        const aTime = a.deliveredAt?.toDate ? a.deliveredAt.toDate().getTime() : 0;
        const bTime = b.deliveredAt?.toDate ? b.deliveredAt.toDate().getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting delivery history:', error);
    throw error;
  }
};

/**
 * Sync order status with employee assignment
 * Called when order status changes to ensure employee assignment is updated
 */
export const syncOrderWithEmployeeAssignment = async (retailerId, orderId) => {
  try {
    // Orders are stored in stores collection, not businesses
    const orderRef = doc(db, 'stores', retailerId, 'customerOrders', orderId);
    const orderDoc = await getDoc(orderRef);

    if (!orderDoc.exists()) {
      return;
    }

    const orderData = orderDoc.data();
    const employeeId = orderData.assignedEmployeeId;

    if (!employeeId) {
      return; // No employee assigned
    }

    // Find or create assignment
    const assignmentRef = doc(db, 'businesses', retailerId, 'employeeDeliveries', `${orderId}_${employeeId}`);
    const assignmentDoc = await getDoc(assignmentRef);

    const assignmentData = {
      orderId,
      employeeId,
      retailerId,
      status: orderData.status === 'delivered' ? 'delivered' : 
              orderData.status === 'out_for_delivery' ? 'out_for_delivery' : 
              'assigned',
      orderData: {
        orderNumber: orderData.orderNumber,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        deliveryAddress: orderData.deliveryAddress,
        total: orderData.total,
        items: orderData.items,
        orderType: orderData.orderType
      },
      updatedAt: serverTimestamp()
    };

    if (orderData.status === 'delivered' && orderData.deliveredAt) {
      assignmentData.deliveredAt = orderData.deliveredAt;
    }

    if (orderData.status === 'out_for_delivery' && orderData.outForDeliveryAt) {
      assignmentData.pickedUpAt = orderData.outForDeliveryAt;
    }

    if (!assignmentDoc.exists()) {
      // Get employee data
      const employeeRef = doc(db, 'businesses', retailerId, 'employees', employeeId);
      const employeeDoc = await getDoc(employeeRef);
      
      if (employeeDoc.exists()) {
        assignmentData.employeeData = {
          name: employeeDoc.data().name,
          phone: employeeDoc.data().phone,
          flypEmployeeId: employeeDoc.data().flypEmployeeId || employeeId
        };
      }
      assignmentData.assignedAt = orderData.assignedAt || serverTimestamp();
    }

    await setDoc(assignmentRef, assignmentData, { merge: true });

    return { success: true };
  } catch (error) {
    console.error('Error syncing order with employee assignment:', error);
    throw error;
  }
};
