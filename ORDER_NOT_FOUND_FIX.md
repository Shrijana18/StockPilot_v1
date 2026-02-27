# Order Not Found Error - Fix

## 🐛 Problem

When assigning an order to an employee, the system was throwing "Order not found" error because:

1. **Path Mismatch:** Orders are stored in `stores/{retailerId}/customerOrders/{orderId}`, but the service was trying to read from `businesses/{retailerId}/customerOrders/{orderId}`

2. **Missing Firestore Rules:** The rules for `stores/{storeId}/customerOrders/{orderId}` didn't allow employees with delivery access to update orders

## ✅ Fixes Applied

### 1. Fixed Service Paths (`src/services/deliveryEmployeeService.js`)

Changed all order references from:
```javascript
doc(db, 'businesses', retailerId, 'customerOrders', orderId)
```

To:
```javascript
doc(db, 'stores', retailerId, 'customerOrders', orderId)
```

**Functions Fixed:**
- `assignOrderToEmployee()` - Line 38
- `markOrderPickedUp()` - Line 181
- `markOrderDeliveredByEmployee()` - Line 218
- `syncOrderWithEmployeeAssignment()` - Line 267

### 2. Updated Firestore Rules (`firestore.rules`)

Updated `stores/{storeId}/customerOrders/{orderId}` rules to allow:
- Store owner (retailer) can update all fields
- Employees with delivery access can update status-related fields:
  - `status`
  - `deliveredAt`
  - `deliveredBy`
  - `outForDeliveryAt`
  - `assignedEmployeeId`
  - `assignedEmployee`
  - `assignedAt`

## 🔍 Root Cause

The marketplace orders are stored in the `stores` collection (for customer-facing marketplace), not in the `businesses` collection (for B2B operations). The delivery employee service was using the wrong collection path.

## 📋 Testing

After these fixes, test:

- [ ] Retailer can assign order to employee
- [ ] Order is found and updated correctly
- [ ] Employee can see assigned order
- [ ] Employee can mark order as picked up
- [ ] Employee can mark order as delivered
- [ ] No "Order not found" errors

## 🚀 Next Steps

1. **Deploy Firestore Rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Test the Assignment Flow:**
   - Assign an order to an employee
   - Verify no errors in console
   - Check that order status updates correctly

---

**The "Order not found" error should now be resolved!** ✅
