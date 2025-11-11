// Centralized helpers for order flow (active & passive)
// Framework-agnostic: only pure helpers + Firestore patches

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';

// IMPORTANT: relative import (no aliases) so it works everywhere
import { ORDER_STATUSES, codeOf } from '../../constants/orderStatus';

export const VERSION = '2025-11-09a';

/* ============================== Payment ============================== */

const CODE_ALIAS = {
  COD: 'COD',
  'CASH ON DELIVERY': 'COD',
  CASH: 'COD',
  'SPLIT PAYMENT': 'SPLIT',
  SPLIT: 'SPLIT',
  ADVANCE: 'ADVANCE',
  'ADVANCE PAYMENT': 'ADVANCE',
  CREDIT: 'CREDIT_CYCLE',
  'CREDIT CYCLE': 'CREDIT_CYCLE',
  EOM: 'END_OF_MONTH',
  'END OF MONTH': 'END_OF_MONTH',
  UPI: 'UPI',
  'NET BANKING': 'NET_BANKING',
  NEFT: 'NET_BANKING',
  RTGS: 'NET_BANKING',
  CHEQUE: 'CHEQUE',
  CHECK: 'CHEQUE',
  OTHER: 'OTHER',
};

function normalizeCode(raw) {
  if (!raw) return '';
  const s = String(raw).trim().toUpperCase();
  return CODE_ALIAS[s] || s;
}

export function extractPaymentCode(input) {
  if (!input) return '';
  if (typeof input === 'string') return normalizeCode(input);
  if (typeof input === 'object' && input.code) return normalizeCode(input.code);
  if (typeof input === 'object' && input.label) return normalizeCode(input.label);
  return '';
}

export function normalizePaymentMode(input) {
  const code = extractPaymentCode(input);
  const base = {
    code,
    label: code
      ? (code === 'COD' ? 'Cash on Delivery'
        : code === 'SPLIT' ? 'Split Payment'
        : code === 'ADVANCE' ? 'Advance Payment'
        : code === 'CREDIT_CYCLE' ? 'Credit Cycle'
        : code === 'END_OF_MONTH' ? 'End of Month'
        : code === 'UPI' ? 'UPI'
        : code === 'NET_BANKING' ? 'Net Banking'
        : code === 'CHEQUE' ? 'Cheque'
        : code)
      : '',
    isCOD: code === 'COD',
    isSplit: code === 'SPLIT',
    isAdvance: code === 'ADVANCE',
    isCredit: code === 'CREDIT_CYCLE' || code === 'END_OF_MONTH',
    isUPI: code === 'UPI',
    isNetBanking: code === 'NET_BANKING',
    isCheque: code === 'CHEQUE',
  };

  if (typeof input === 'object' && input) {
    if (typeof input.creditDays === 'number') base.creditDays = input.creditDays;
    if (typeof input.advanceAmount === 'number') base.advanceAmount = input.advanceAmount;
    if (typeof input.splitRatio === 'string') base.splitRatio = input.splitRatio; // e.g., "50/50"
  }
  return base;
}

export function formatPaymentLabel(input) {
  const n = normalizePaymentMode(input);
  if (!n.code) return 'N/A';
  if (n.code === 'CREDIT_CYCLE' && n.creditDays) return `Credit Cycle (${n.creditDays} days)`;
  if (n.code === 'ADVANCE' && n.advanceAmount) return `Advance ₹${Number(n.advanceAmount).toFixed(0)}`;
  if (n.code === 'SPLIT' && n.splitRatio) return `Split (${n.splitRatio})`;
  return n.label;
}

/* ============================ Firestore ============================= */

export async function updateLines({
  db,
  distributorId,
  orderId,
  items,
  deliveryMode,
  expectedDeliveryDate,
  paymentMode,
  auth, // optional; for handledBy/audit
}) {
  if (!db || !distributorId || !orderId) throw new Error('updateLines: missing db/distributorId/orderId');
  const payment = normalizePaymentMode(paymentMode);
  const ref = doc(db, 'businesses', distributorId, 'orderRequests', orderId);
  await updateDoc(ref, {
    items: Array.isArray(items) ? items : [],
    deliveryMode: deliveryMode || '',
    expectedDeliveryDate: expectedDeliveryDate || '',
    paymentMode: payment.code,  // simple string for legacy UIs
    payment,                    // rich object for new UIs
    auditTrail: arrayUnion({
      at: new Date().toISOString(),
      event: 'updateLines',
      by: auth?.currentUser?.uid ? { uid: auth.currentUser.uid, type: 'distributor' } : { type: 'system' },
    }),
  });
}

export async function shipOrder({
  db,
  distributorId,
  orderId,
  expectedDeliveryDate,
  deliveryMode,
  courier = null,
  awb = null,
  auth,
}) {
  if (!db || !distributorId || !orderId) throw new Error('shipOrder: missing db/distributorId/orderId');

  const orderRef = doc(db, 'businesses', distributorId, 'orderRequests', orderId);
  const snap = await getDoc(orderRef);
  if (!snap.exists()) throw new Error('Order not found');

  const data = snap.data() || {};
  const patch = {
    status: 'Shipped',
    statusCode: ORDER_STATUSES.SHIPPED,
    expectedDeliveryDate: expectedDeliveryDate || data.expectedDeliveryDate || '',
    deliveryMode: deliveryMode || data.deliveryMode || '',
    ['statusTimestamps.shippedAt']: serverTimestamp(),
    shipment: {
      ...(data.shipment || {}),
      courier,
      awb,
      shippedAt: serverTimestamp(),
    },
    handledBy: {
      ...(data.handledBy || {}),
      shippedBy: auth?.currentUser?.uid ? { uid: auth.currentUser.uid, type: 'distributor' } : { type: 'system' },
    },
    auditTrail: arrayUnion({
      at: new Date().toISOString(),
      event: 'shipOrder',
      by: auth?.currentUser?.uid ? { uid: auth.currentUser.uid, type: 'distributor' } : { type: 'system' },
      meta: { deliveryMode: deliveryMode || data.deliveryMode || '' },
    }),
  };

  await updateDoc(orderRef, patch);

  // Mirror for active orders
  if (data.retailerId) {
    try {
      const retailerRef = doc(db, 'businesses', data.retailerId, 'sentOrders', orderId);
      await setDoc(
        retailerRef,
        {
          distributorId,
          retailerId: data.retailerId,
          status: 'Shipped',
          statusCode: ORDER_STATUSES.SHIPPED,
          expectedDeliveryDate: patch.expectedDeliveryDate,
          deliveryMode: patch.deliveryMode,
          ['statusTimestamps.shippedAt']: serverTimestamp(),
        },
        { merge: true },
      );
    } catch {
      // ignore; UI can show a soft warning if needed
    }
  }
}

// Generic status transition (used by PassiveOrderRequests etc.)
export async function setOrderStatus({ db, distributorId, orderId, current, next, extra = {}, actorUid }) {
  if (!db || !distributorId || !orderId) throw new Error('setOrderStatus: missing db/distributorId/orderId');
  const nxt = codeOf(next);
  const ref = doc(db, 'businesses', distributorId, 'orderRequests', orderId);

  const tsField =
    nxt === ORDER_STATUSES.REQUESTED ? 'requestedAt' :
    nxt === ORDER_STATUSES.QUOTED ? 'quotedAt' :
    nxt === ORDER_STATUSES.ACCEPTED ? 'acceptedAt' :
    nxt === ORDER_STATUSES.PACKED ? 'packedAt' :
    nxt === ORDER_STATUSES.SHIPPED ? 'shippedAt' :
    nxt === ORDER_STATUSES.DELIVERED ? 'deliveredAt' :
    nxt === ORDER_STATUSES.REJECTED ? 'rejectedAt' : null;

  const human =
    nxt === ORDER_STATUSES.REQUESTED ? 'Requested' :
    nxt === ORDER_STATUSES.QUOTED ? 'Quoted' :
    nxt === ORDER_STATUSES.ACCEPTED ? 'Accepted' :
    nxt === ORDER_STATUSES.PACKED ? 'Packed' :
    nxt === ORDER_STATUSES.SHIPPED ? 'Shipped' :
    nxt === ORDER_STATUSES.DELIVERED ? 'Delivered' :
    nxt === ORDER_STATUSES.REJECTED ? 'Rejected' : 'Requested';

  const patch = { statusCode: nxt, status: human, ...extra };
  if (tsField) patch[`statusTimestamps.${tsField}`] = serverTimestamp();
  patch.auditTrail = arrayUnion({
    at: new Date().toISOString(),
    status: nxt,
    by: actorUid ? { uid: actorUid, type: 'distributor' } : { type: 'system' },
  });

  await updateDoc(ref, patch);
}