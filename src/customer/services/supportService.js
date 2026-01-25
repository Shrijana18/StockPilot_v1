/**
 * Support Service - Customer help/support tickets
 * Submit queries, return requests, refund requests, etc.
 */

import { db } from '../../firebase/firebaseConfig';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';

/** Generate ticket ID for display */
const generateTicketNumber = () =>
  `TKT${Date.now().toString(36).toUpperCase().slice(-8)}`;

/**
 * Submit a support ticket
 * @param {Object} data
 * @param {string} data.customerId
 * @param {string} data.customerName
 * @param {string} data.customerPhone
 * @param {string} [data.orderId]
 * @param {string} [data.orderNumber]
 * @param {string} [data.storeId]
 * @param {string} [data.storeName]
 * @param {'order'|'payment'|'account'|'other'} data.category
 * @param {string} data.issueType - query | return_request | refund | wrong_missing_item | delivery_issue | cancel_request | other
 * @param {string} [data.subject]
 * @param {string} data.description
 * @param {Array<{index:number, productId:string, name:string, quantity:number, price?:number}>} [data.selectedItems]
 */
export const submitSupportTicket = async (data) => {
  try {
    const ticketNumber = generateTicketNumber();
    const ticket = {
      ticketNumber,
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      orderId: data.orderId || null,
      orderNumber: data.orderNumber || null,
      storeId: data.storeId || null,
      storeName: data.storeName || null,
      category: data.category,
      issueType: data.issueType,
      subject: data.subject || null,
      description: data.description,
      selectedItems: data.selectedItems && data.selectedItems.length > 0 ? data.selectedItems : null,
      status: 'open',
      statusHistory: { open: serverTimestamp() },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const ref = await addDoc(collection(db, 'customerSupport'), ticket);
    return {
      success: true,
      ticketId: ref.id,
      ticketNumber,
    };
  } catch (error) {
    console.error('Error submitting support ticket:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get support tickets for a customer
 */
export const getCustomerSupportTickets = async (customerId, limitCount = 20) => {
  try {
    const q = query(
      collection(db, 'customerSupport'),
      where('customerId', '==', customerId),
      limit(limitCount * 2)
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        ...x,
        createdAt: x.createdAt?.toDate?.() || new Date(),
        updatedAt: x.updatedAt?.toDate?.() || new Date(),
      };
    });
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list.slice(0, limitCount);
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    throw error;
  }
};

/**
 * Subscribe to a single ticket (real-time updates)
 */
export const subscribeToSupportTicket = (ticketId, callback) => {
  const ref = doc(db, 'customerSupport', ticketId);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const x = snap.data();
        callback({
          id: snap.id,
          ...x,
          createdAt: x.createdAt?.toDate?.() || new Date(),
          updatedAt: x.updatedAt?.toDate?.() || new Date(),
        });
      }
    },
    (err) => console.error('Support ticket subscription error:', err)
  );
};
