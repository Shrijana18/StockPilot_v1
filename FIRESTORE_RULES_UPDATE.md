# Firestore Rules Update - Delivery Employee System

## ✅ Rules Added

### 1. Customer Orders Collection
**Path:** `businesses/{retailerId}/customerOrders/{orderId}`

**Permissions:**
- **READ:** 
  - Retailer (owner) can read all their customer orders
  - Employees with delivery access can read orders
  
- **CREATE:**
  - Retailer can create orders (for testing)
  - Orders are typically created by customers via marketplace
  
- **UPDATE:**
  - Retailer can update all fields (status, assignment, etc.)
  - Employees with delivery access can only update status-related fields:
    - `status`
    - `deliveredAt`
    - `deliveredBy`
    - `outForDeliveryAt`
  
- **DELETE:**
  - Only retailer can delete orders

### 2. Employee Deliveries Collection
**Path:** `businesses/{retailerId}/employeeDeliveries/{assignmentId}`

**Permissions:**
- **READ:**
  - Retailer can read all assignments
  - Employee can read only their own assignments
  
- **CREATE:**
  - Retailer can create assignments when assigning orders to employees
  - Must include: `retailerId`, `employeeId`, `orderId`
  
- **UPDATE:**
  - Retailer can update all fields
  - Employee can only update:
    - `status`
    - `pickedUpAt`
    - `deliveredAt`
    - `deliveryProof`
    - `updatedAt`
  
- **DELETE:**
  - Only retailer can delete assignments

## 🔐 Security Features

1. **Employee Access Control:**
   - Employees must have `accessSections.delivery == true` to access orders
   - Employees can only see/update their own assignments
   - Custom token authentication supported

2. **Field-Level Restrictions:**
   - Employees can only update specific status fields
   - Prevents unauthorized data modification

3. **Retailer Control:**
   - Retailer has full control over orders and assignments
   - Can assign, reassign, or delete assignments

## 📋 Testing Checklist

After deploying these rules, test:

- [ ] Retailer can assign order to employee
- [ ] Employee can see assigned orders
- [ ] Employee can mark order as picked up
- [ ] Employee can mark order as delivered
- [ ] Employee cannot see other employees' assignments
- [ ] Employee cannot update unauthorized fields
- [ ] Retailer can update all fields
- [ ] Retailer can delete assignments

## 🚀 Deployment

1. **Deploy Rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Verify:**
   - Check Firebase Console → Firestore → Rules
   - Test assignment flow in app
   - Check console for permission errors

## ⚠️ Important Notes

- These rules work with both standard Firebase Auth and custom token authentication
- Employee access is checked via `accessSections.delivery` field
- Custom tokens must include `businessId` and `employeeId` in claims

---

**Rules are now updated and ready for deployment!** ✅
