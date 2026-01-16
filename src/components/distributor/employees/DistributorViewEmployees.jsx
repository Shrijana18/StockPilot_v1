import React, { useEffect, useState, useMemo } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, setDoc, serverTimestamp, getDoc, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db, auth } from "../../../firebase/firebaseConfig";
import { FiTrash2, FiPlus, FiEdit, FiDatabase, FiActivity, FiChevronDown, FiChevronUp, FiSearch, FiFilter, FiDownload, FiEye, FiCalendar, FiX, FiArrowDown, FiArrowUp, FiMail, FiPhone, FiUser, FiShield, FiCopy, FiExternalLink, FiMoreVertical, FiCheckCircle, FiClock, FiMapPin, FiUsers, FiSettings } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { httpsCallable } from 'firebase/functions';
import { functions } from "../../../firebase/firebaseConfig";
import AddDistributorEmployeeModal from './AddDistributorEmployeeModal';
import EmployeeZoneRetailerModal from './EmployeeZoneRetailerModal';
import EditEmployeeModal from './EditEmployeeModal';
import PermissionSelectorModal from './PermissionSelectorModal';

const ConfirmResetModal = ({ open, name, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md mx-4 rounded-2xl border border-white/15 bg-gray-900/90 shadow-2xl p-6 text-white">
        <h3 className="text-lg font-semibold mb-2">Reset PIN?</h3>
        <p className="text-sm text-gray-300 mb-6">Are you sure you want to reset the PIN for <span className="font-medium">"{name}"</span>? The new PIN will be visible for 2 minutes.</p>
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-gray-200">Cancel</button>
          <button type="button" onClick={onConfirm} className="px-3 py-2 rounded-lg border border-red-400/30 bg-red-500/20 hover:bg-red-500/30 text-red-200">Reset PIN</button>
        </div>
      </div>
    </div>
  );
};

// Role Selector Component with Custom Role Support
const RoleSelector = ({ employee, currentUser, customRoles, onRoleChange }) => {
  const standardRoles = ['Manager', 'Sales Executive', 'Order Manager', 'Dispatch Manager', 'Admin'];
  const allRoles = [...standardRoles, ...customRoles];
  const isCurrentlyCustom = employee.role && !allRoles.includes(employee.role);
  
  const [selectedRole, setSelectedRole] = useState(employee.role || '');
  const [isCustom, setIsCustom] = useState(isCurrentlyCustom);
  const [customRoleName, setCustomRoleName] = useState(isCurrentlyCustom ? employee.role : '');

  useEffect(() => {
    setSelectedRole(employee.role || '');
    const allRolesList = ['Manager', 'Sales Executive', 'Order Manager', 'Dispatch Manager', 'Admin', ...customRoles];
    const isCustomRole = employee.role && !allRolesList.includes(employee.role);
    setIsCustom(isCustomRole);
    if (isCustomRole) {
      setCustomRoleName(employee.role);
    }
  }, [employee.role, customRoles]);

  const handleRoleChange = (value) => {
    if (value === 'custom') {
      setIsCustom(true);
      setCustomRoleName('');
    } else {
      setIsCustom(false);
      setSelectedRole(value);
      if (value) {
        onRoleChange(value);
      }
    }
  };

  const handleCustomRoleSubmit = () => {
    if (customRoleName.trim()) {
      setSelectedRole(customRoleName.trim());
      onRoleChange(customRoleName.trim());
      setIsCustom(false);
    }
  };

  if (isCustom) {
    return (
      <div className="mb-4">
        <label className="block text-xs text-gray-400 mb-1.5">Role</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customRoleName}
            onChange={(e) => setCustomRoleName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCustomRoleSubmit();
              } else if (e.key === 'Escape') {
                setIsCustom(false);
                setCustomRoleName('');
                setSelectedRole(employee.role || '');
              }
            }}
            placeholder="Enter custom role name"
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            autoFocus
          />
          <button
            onClick={handleCustomRoleSubmit}
            className="px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-300 text-sm transition-all"
          >
            Save
          </button>
          <button
            onClick={() => {
              setIsCustom(false);
              setCustomRoleName('');
              setSelectedRole(employee.role || '');
            }}
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-sm transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <label className="block text-xs text-gray-400 mb-1.5">Role</label>
      <select
        value={selectedRole}
        onChange={(e) => handleRoleChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      >
        <option value="" className="bg-gray-900">Select Role</option>
        {standardRoles.map(role => (
          <option key={role} value={role} className="bg-gray-900">{role}</option>
        ))}
        {customRoles.length > 0 && (
          <>
            <optgroup label="Custom Roles" className="bg-gray-900">
              {customRoles.map(role => (
                <option key={role} value={role} className="bg-gray-900">{role}</option>
              ))}
            </optgroup>
          </>
        )}
        <option value="custom" className="bg-gray-900 text-emerald-400">+ Create Custom Role</option>
      </select>
    </div>
  );
};

// Order Detail Modal Component
const OrderDetailModal = ({ orderId, orderData, loading, onClose, currentUser, db }) => {
  const getProformaBreakdown = (order) => {
    if (order?.proforma && order.proforma.lines && Array.isArray(order.proforma.lines) && order.proforma.lines.length > 0) {
      return {
        grossItems: Number(order.proforma.grossItems || 0),
        lineDiscountTotal: Number(order.proforma.lineDiscountTotal || 0),
        itemsSubTotal: Number(order.proforma.itemsSubTotal || order.proforma.subTotal || 0),
        orderCharges: {
          delivery: Number(order.proforma.orderCharges?.delivery ?? 0),
          packing: Number(order.proforma.orderCharges?.packing ?? 0),
          insurance: Number(order.proforma.orderCharges?.insurance ?? 0),
          other: Number(order.proforma.orderCharges?.other ?? 0),
        },
        discountTotal: Number(order.proforma.discountTotal || 0),
        taxableBase: Number(order.proforma.taxableBase || 0),
        taxType: order.proforma.taxType || 'CGST_SGST',
        taxBreakup: order.proforma.taxBreakup || {},
        roundOff: Number(order.proforma.roundOff || 0),
        grandTotal: Number(order.proforma.grandTotal || 0),
        lines: order.proforma.lines || []
      };
    }
    
    const b = order?.chargesSnapshot?.breakdown;
    if (b) {
      return {
        grossItems: Number(b.grossItems || 0),
        lineDiscountTotal: Number(b.lineDiscountTotal || 0),
        itemsSubTotal: Number(b.itemsSubTotal || b.subTotal || 0),
        orderCharges: {
          delivery: Number(b.delivery || 0),
          packing: Number(b.packing || 0),
          insurance: Number(b.insurance || 0),
          other: Number(b.other || 0),
        },
        discountTotal: Number(b.discountTotal || 0),
        taxableBase: Number(b.taxableBase || 0),
        taxType: b.taxType || 'CGST_SGST',
        taxBreakup: b.taxBreakup || {},
        roundOff: Number(b.roundOff || 0),
        grandTotal: Number(b.grandTotal || 0),
        lines: b.lines || []
      };
    }
    
    return null;
  };

  if (!orderId) return null;

  const breakdown = orderData ? getProformaBreakdown(orderData) : null;
  const items = orderData?.items || [];
  const proformaLines = breakdown?.lines || items;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div 
        role="dialog" 
        aria-modal="true" 
        className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/15 bg-gray-900/95 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">Order Details</h3>
            <p className="text-sm text-gray-400">Order ID: {orderId.substring(0, 20)}...</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
            </div>
          ) : !orderData ? (
            <div className="text-center py-12 text-gray-400">Order data not available</div>
          ) : (
            <>
              {/* Order Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="backdrop-blur-sm bg-white/5 rounded-xl p-4 border border-white/10">
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Retailer Information</h4>
                  <p className="text-white font-medium">{orderData.retailerName || 'N/A'}</p>
                  <p className="text-sm text-gray-300">{orderData.retailerEmail || ''}</p>
                  <p className="text-sm text-gray-300">{orderData.retailerPhone || ''}</p>
                  <p className="text-sm text-gray-300">{orderData.retailerCity || ''}</p>
                </div>
                <div className="backdrop-blur-sm bg-white/5 rounded-xl p-4 border border-white/10">
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Order Information</h4>
                  <p className="text-white"><span className="text-gray-400">Status:</span> {orderData.status || 'N/A'}</p>
                  <p className="text-white"><span className="text-gray-400">Payment:</span> {orderData.paymentModeLabel || orderData.paymentMode || 'N/A'}</p>
                  <p className="text-sm text-gray-300">
                    <span className="text-gray-400">Created:</span> {orderData.createdAt?.toDate?.().toLocaleString() || orderData.timestamp?.toDate?.().toLocaleString() || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="backdrop-blur-sm bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                  <h4 className="text-lg font-semibold text-white">Order Items</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Price</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Discount</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">GST %</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {proformaLines.map((line, idx) => {
                        const item = Array.isArray(items) ? items[idx] : null;
                        const itemName = item?.productName || item?.name || line.productName || line.name || 'Product';
                        const qty = line.qty || item?.qty || item?.quantity || 0;
                        const price = line.price || item?.price || item?.sellingPrice || 0;
                        const discountPct = line.itemDiscountPct || 0;
                        const discountAmt = line.itemDiscountAmt || 0;
                        const gstRate = line.gstRate || item?.gstRate || 0;
                        const gross = qty * price;
                        const discount = discountAmt > 0 ? discountAmt : (gross * discountPct / 100);
                        const subtotal = gross - discount;
                        
                        return (
                          <tr key={idx} className="hover:bg-white/5">
                            <td className="px-4 py-3 text-white">{itemName}</td>
                            <td className="px-4 py-3 text-gray-300">{qty}</td>
                            <td className="px-4 py-3 text-gray-300">₹{price.toFixed(2)}</td>
                            <td className="px-4 py-3 text-gray-300">
                              {discountAmt > 0 ? `₹${discountAmt.toFixed(2)}` : discountPct > 0 ? `${discountPct}%` : '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-300">{gstRate}%</td>
                            <td className="px-4 py-3 text-emerald-300 font-medium">₹{subtotal.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Proforma Breakdown */}
              {breakdown && (
                <div className="backdrop-blur-sm bg-white/5 rounded-xl p-6 border border-white/10">
                  <h4 className="text-lg font-semibold text-white mb-4">Financial Breakdown</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Gross Items:</span>
                      <span className="text-white">₹{breakdown.grossItems.toFixed(2)}</span>
                    </div>
                    {breakdown.lineDiscountTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Line Discounts:</span>
                        <span className="text-red-300">-₹{breakdown.lineDiscountTotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Items Subtotal:</span>
                      <span className="text-white">₹{breakdown.itemsSubTotal.toFixed(2)}</span>
                    </div>
                    {breakdown.orderCharges.delivery > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Delivery:</span>
                        <span className="text-white">₹{breakdown.orderCharges.delivery.toFixed(2)}</span>
                      </div>
                    )}
                    {breakdown.orderCharges.packing > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Packing:</span>
                        <span className="text-white">₹{breakdown.orderCharges.packing.toFixed(2)}</span>
                      </div>
                    )}
                    {breakdown.orderCharges.insurance > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Insurance:</span>
                        <span className="text-white">₹{breakdown.orderCharges.insurance.toFixed(2)}</span>
                      </div>
                    )}
                    {breakdown.orderCharges.other > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Other Charges:</span>
                        <span className="text-white">₹{breakdown.orderCharges.other.toFixed(2)}</span>
                      </div>
                    )}
                    {breakdown.discountTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Order Discount:</span>
                        <span className="text-red-300">-₹{breakdown.discountTotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Taxable Base:</span>
                      <span className="text-white">₹{breakdown.taxableBase.toFixed(2)}</span>
                    </div>
                    {breakdown.taxBreakup && (
                      <>
                        {breakdown.taxBreakup.cgst > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">CGST:</span>
                            <span className="text-white">₹{breakdown.taxBreakup.cgst.toFixed(2)}</span>
                          </div>
                        )}
                        {breakdown.taxBreakup.sgst > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">SGST:</span>
                            <span className="text-white">₹{breakdown.taxBreakup.sgst.toFixed(2)}</span>
                          </div>
                        )}
                        {breakdown.taxBreakup.igst > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">IGST:</span>
                            <span className="text-white">₹{breakdown.taxBreakup.igst.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                    {breakdown.roundOff !== 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Round Off:</span>
                        <span className="text-gray-300">₹{breakdown.roundOff.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10">
                      <span className="text-white">Grand Total:</span>
                      <span className="text-emerald-400">₹{breakdown.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Enhanced Employee Activity Analytics Component with Advanced Features
const EnhancedEmployeeActivityAnalytics = ({ activitiesByEmployee, employees, loadingActivity, currentUser, db }) => {
  const [expandedEmployees, setExpandedEmployees] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
  const [activitySortBy, setActivitySortBy] = useState('date-desc');
  const [activityPageSize, setActivityPageSize] = useState(50);
  const [currentActivityPage, setCurrentActivityPage] = useState({});
  const [orderDetailData, setOrderDetailData] = useState(null);

  // Helper to toggle employee expansion
  const toggleEmployeeExpansion = (empKey) => {
    setExpandedEmployees(prev => ({
      ...prev,
      [empKey]: !prev[empKey]
    }));
  };

  // Helper to toggle section expansion
  const toggleSectionExpansion = (empKey, section) => {
    const key = `${empKey}-${section}`;
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Fetch detailed order data
  const fetchOrderDetail = async (orderId) => {
    if (!currentUser?.uid || !orderId) return;
    
    setLoadingOrderDetail(true);
    setSelectedOrderDetail(orderId);
    
    try {
      const orderRef = doc(db, 'businesses', currentUser.uid, 'orderRequests', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (orderSnap.exists()) {
        setOrderDetailData({ id: orderSnap.id, ...orderSnap.data() });
      } else {
        toast.error('Order not found');
        setSelectedOrderDetail(null);
      }
    } catch (err) {
      console.error('Error fetching order detail:', err);
      toast.error('Failed to load order details');
      setSelectedOrderDetail(null);
    } finally {
      setLoadingOrderDetail(false);
    }
  };

  // Close order detail modal
  const closeOrderDetail = () => {
    setSelectedOrderDetail(null);
    setOrderDetailData(null);
  };

  // Filter and sort activities
  const filteredAndSortedActivities = useMemo(() => {
    const result = {};
    
    Object.keys(activitiesByEmployee).forEach(empKey => {
      const empData = activitiesByEmployee[empKey];
      let activities = [...empData.activities];
      
      // Apply search filter
      if (activitySearchTerm) {
        const term = activitySearchTerm.toLowerCase();
        activities = activities.filter(a => 
          (a.retailerName || '').toLowerCase().includes(term) ||
          (a.orderId || '').toLowerCase().includes(term) ||
          (a.retailerId || '').toLowerCase().includes(term)
        );
      }
      
      // Apply activity type filter
      if (activityFilter !== 'all') {
        activities = activities.filter(a => a.action === activityFilter);
      }
      
      // Apply date range filter
      if (dateRange.start || dateRange.end) {
        activities = activities.filter(a => {
          if (!a.orderDate) return false;
          const date = a.orderDate instanceof Date ? a.orderDate : new Date(a.orderDate);
          if (dateRange.start && date < dateRange.start) return false;
          if (dateRange.end) {
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
            if (date > endDate) return false;
          }
          return true;
        });
      }
      
      // Apply sorting
      activities.sort((a, b) => {
        const dateA = a.orderDate instanceof Date ? a.orderDate : new Date(a.orderDate || 0);
        const dateB = b.orderDate instanceof Date ? b.orderDate : new Date(b.orderDate || 0);
        
        switch (activitySortBy) {
          case 'date-desc':
            return dateB - dateA;
          case 'date-asc':
            return dateA - dateB;
          case 'revenue-desc':
            return (b.grandTotal || 0) - (a.grandTotal || 0);
          case 'revenue-asc':
            return (a.grandTotal || 0) - (b.grandTotal || 0);
          default:
            return dateB - dateA;
        }
      });
      
      result[empKey] = {
        ...empData,
        filteredActivities: activities
      };
    });
    
    return result;
  }, [activitiesByEmployee, activitySearchTerm, activityFilter, dateRange, activitySortBy]);

  // Group activities by type
  const groupActivitiesByType = (activities) => {
    const grouped = {
      created: [],
      accepted: [],
      shipped: [],
      delivered: [],
      modified: [],
      rejected: [],
      added_retailer: []
    };
    
    activities.forEach(activity => {
      if (grouped[activity.action]) {
        grouped[activity.action].push(activity);
      }
    });
    
    return grouped;
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Export activities to CSV
  const exportActivitiesCSV = (empKey) => {
    const empData = filteredAndSortedActivities[empKey];
    if (!empData || !empData.filteredActivities.length) {
      toast.error('No activities to export');
      return;
    }
    
    const rows = [['Date', 'Action', 'Order ID', 'Retailer', 'Amount', 'Employee']];
    empData.filteredActivities.forEach(activity => {
      rows.push([
        formatDate(activity.orderDate),
        activity.action.toUpperCase(),
        activity.orderId || 'N/A',
        activity.retailerName || 'N/A',
        formatCurrency(activity.grandTotal),
        `${empData.employeeName} (${empData.employeeRole})`
      ]);
    });
    
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee_activity_${empData.employeeName || empKey}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Activity data exported successfully');
  };

  // Calculate overall stats - MUST be before any early returns (Rules of Hooks)
  const overallStats = useMemo(() => {
    const totals = Object.values(activitiesByEmployee || {}).reduce((acc, emp) => {
      acc.totalOrders += emp.stats?.totalOrders || 0;
      acc.totalRevenue += emp.stats?.totalRevenue || 0;
      acc.totalCreated += emp.stats?.created || 0;
      acc.totalDelivered += emp.stats?.delivered || 0;
      return acc;
    }, { totalOrders: 0, totalRevenue: 0, totalCreated: 0, totalDelivered: 0 });
    return totals;
  }, [activitiesByEmployee]);

  // Get filtered employee list - MUST be before early returns
  const filteredEmployees = useMemo(() => {
    if (selectedEmployeeFilter === 'all') {
      return Object.values(filteredAndSortedActivities);
    }
    return Object.values(filteredAndSortedActivities).filter(emp => {
      const empKey = emp.flypEmployeeId || emp.employeeId || '';
      return empKey === selectedEmployeeFilter;
    });
  }, [filteredAndSortedActivities, selectedEmployeeFilter]);

  if (loadingActivity) {
    return (
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 text-sm text-gray-200 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p>Loading activity data...</p>
        </div>
      </div>
    );
  }

  if (Object.keys(activitiesByEmployee || {}).length === 0) {
    return (
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 text-sm text-gray-300 text-center min-h-[400px] flex items-center justify-center">
        <div>
          <FiActivity className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <p>No employee activity found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Custom Scrollbar Styles */}
      <style>{`
        .activity-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .activity-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .activity-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.4);
          border-radius: 4px;
        }
        .activity-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.6);
        }
      `}</style>
      
      {/* Header Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Employee Activity Analytics
          </h2>
          <p className="text-sm text-gray-400">Comprehensive tracking and insights for employee performance</p>
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="backdrop-blur-md bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-xl p-4 hover:border-emerald-400/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-emerald-300 uppercase tracking-wider">Total Orders</div>
              <FiDatabase className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-emerald-400 mb-1">{overallStats.totalOrders}</div>
            <div className="text-xs text-gray-400">Across all employees</div>
          </div>

          <div className="backdrop-blur-md bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4 hover:border-blue-400/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-blue-300 uppercase tracking-wider">Created</div>
              <FiActivity className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-blue-400 mb-1">{overallStats.totalCreated}</div>
            <div className="text-xs text-gray-400">Orders created</div>
          </div>

          <div className="backdrop-blur-md bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-xl p-4 hover:border-cyan-400/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-cyan-300 uppercase tracking-wider">Delivered</div>
              <FiCheckCircle className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold text-cyan-400 mb-1">{overallStats.totalDelivered}</div>
            <div className="text-xs text-gray-400">Orders delivered</div>
          </div>

          <div className="backdrop-blur-md bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-4 hover:border-purple-400/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-purple-300 uppercase tracking-wider">Total Revenue</div>
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-purple-400 mb-1">
              ₹{overallStats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-400">Total revenue generated</div>
          </div>
        </div>
      </div>

      {/* Advanced Filters and Controls */}
      <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-5 space-y-5">
        {/* First Row - Main Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search orders, retailers..."
              value={activitySearchTerm}
              onChange={(e) => setActivitySearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
          </div>

          {/* Employee Filter */}
          <div className="relative">
            <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          <select
            value={selectedEmployeeFilter}
            onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
          >
            <option value="all" className="bg-gray-900">All Employees</option>
            {Object.values(activitiesByEmployee).map((emp) => {
              const key = emp.flypEmployeeId || emp.employeeId || '';
              const name = emp.employeeName || 'Employee';
              return (
                <option key={key} value={key} className="bg-gray-900">{name}</option>
              );
            })}
          </select>
          </div>

          {/* Activity Type Filter */}
          <div className="relative">
            <FiFilter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
          >
            <option value="all" className="bg-gray-900">All Actions</option>
            <option value="created" className="bg-gray-900">Created Orders</option>
            <option value="accepted" className="bg-gray-900">Accepted Orders</option>
            <option value="shipped" className="bg-gray-900">Shipped Orders</option>
            <option value="delivered" className="bg-gray-900">Delivered Orders</option>
            <option value="modified" className="bg-gray-900">Modified Orders</option>
            <option value="rejected" className="bg-gray-900">Rejected Orders</option>
            <option value="added_retailer" className="bg-gray-900">Retailers Added</option>
          </select>
          </div>

          {/* Sort By */}
          <div className="relative">
            <FiArrowDown className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          <select
            value={activitySortBy}
            onChange={(e) => setActivitySortBy(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
          >
            <option value="date-desc" className="bg-gray-900">Date: Newest First</option>
            <option value="date-asc" className="bg-gray-900">Date: Oldest First</option>
            <option value="revenue-desc" className="bg-gray-900">Revenue: High to Low</option>
            <option value="revenue-asc" className="bg-gray-900">Revenue: Low to High</option>
          </select>
          </div>
        </div>

        {/* Second Row - Date Range and Page Size */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5 flex items-center gap-1">
              <FiCalendar className="w-3.5 h-3.5" />
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start ? (dateRange.start instanceof Date ? dateRange.start.toISOString().split('T')[0] : new Date(dateRange.start).toISOString().split('T')[0]) : ''}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value ? new Date(e.target.value) : null }))}
              className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5 flex items-center gap-1">
              <FiCalendar className="w-3.5 h-3.5" />
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end ? (dateRange.end instanceof Date ? dateRange.end.toISOString().split('T')[0] : new Date(dateRange.end).toISOString().split('T')[0]) : ''}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value ? new Date(e.target.value) : null }))}
              className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
          </div>
          <div className="flex gap-2">
            {(dateRange.start || dateRange.end) && (
              <button
                onClick={() => setDateRange({ start: null, end: null })}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-300 text-sm font-medium transition-all hover:border-red-400/50"
              >
                Clear
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Items per page</label>
            <select
              value={activityPageSize}
              onChange={(e) => setActivityPageSize(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
            >
              <option value={20} className="bg-gray-900">20 per page</option>
              <option value={50} className="bg-gray-900">50 per page</option>
              <option value={100} className="bg-gray-900">100 per page</option>
              <option value={200} className="bg-gray-900">200 per page</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        {filteredEmployees.length > 0 && (
          <div className="pt-2 border-t border-white/10">
            <p className="text-sm text-gray-400">
              Showing <span className="font-semibold text-white">{filteredEmployees.length}</span> employee{filteredEmployees.length !== 1 ? 's' : ''}
              {activitySearchTerm && ` • "${activitySearchTerm}"`}
            </p>
          </div>
        )}
      </div>

      {/* Employee Activity Cards */}
      <div className="space-y-5">
        {filteredEmployees.map((empData) => {
          const empKey = empData.flypEmployeeId || empData.employeeId || 'unknown';
          const isExpanded = expandedEmployees[empKey];
          const matchingEmployee = employees.find(emp => 
            emp.flypEmployeeId === empData.flypEmployeeId || 
            emp.id === empData.employeeId
          );
          const displayName = empData.employeeName || matchingEmployee?.name || 'Employee';
          const displayRole = empData.employeeRole || matchingEmployee?.role || 'Employee';
          const displayFlypId = empData.flypEmployeeId || matchingEmployee?.flypEmployeeId || empData.employeeId || 'N/A';
          
          const groupedActivities = groupActivitiesByType(empData.filteredActivities || empData.activities);
          const totalFiltered = empData.filteredActivities?.length || empData.activities.length;

          return (
            <div
              key={empKey}
              className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all hover:border-white/20 hover:shadow-lg hover:shadow-emerald-500/10"
            >
              {/* Employee Header - Always Visible */}
              <div 
                className="p-6 cursor-pointer hover:bg-white/5 transition-all"
                onClick={() => toggleEmployeeExpansion(empKey)}
              >
                <div className="flex items-start justify-between gap-6">
                  {/* Left: Employee Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`flex-shrink-0 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                      {isExpanded ? <FiChevronUp className="w-5 h-5 text-gray-400" /> : <FiChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                    {/* Profile Picture */}
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
                        {matchingEmployee?.profilePictureUrl ? (
                          <img
                            src={matchingEmployee.profilePictureUrl}
                            alt={displayName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to initial if image fails to load
                              e.target.style.display = 'none';
                              const parent = e.target.parentElement;
                              if (parent && !parent.querySelector('span')) {
                                const initial = document.createElement('span');
                                initial.className = 'text-xl font-bold text-white';
                                initial.textContent = displayName.charAt(0).toUpperCase();
                                parent.appendChild(initial);
                              }
                            }}
                          />
                        ) : (
                          <span className="text-xl font-bold text-white">{displayName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-bold text-white truncate">{displayName}</h3>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 font-medium text-xs">
                          {displayRole}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="font-mono text-xs">{displayFlypId}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Center: Key Metrics */}
                  <div className="hidden lg:grid grid-cols-4 gap-4 text-center flex-shrink-0">
                    <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <div className="text-xl font-bold text-blue-400">{empData.stats.created}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Created</div>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-xl font-bold text-emerald-400">{empData.stats.delivered}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Delivered</div>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      <div className="text-xl font-bold text-cyan-400">{empData.stats.added_retailer}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Retailers</div>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <div className="text-lg font-bold text-purple-400 truncate">₹{empData.stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Revenue</div>
                    </div>
                  </div>

                  {/* Right: Export Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportActivitiesCSV(empKey);
                    }}
                    className="flex-shrink-0 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-300 text-sm font-medium flex items-center gap-2 transition-all hover:border-blue-400/50"
                  >
                    <FiDownload className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>

                {/* Activity Summary Bar */}
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mt-5">
                  <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-lg p-3 text-center hover:border-blue-400/50 transition-all">
                    <div className="text-lg font-bold text-blue-300">{empData.stats.created}</div>
                    <div className="text-xs text-gray-400 mt-1">Created</div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-lg p-3 text-center hover:border-emerald-400/50 transition-all">
                    <div className="text-lg font-bold text-emerald-300">{empData.stats.accepted}</div>
                    <div className="text-xs text-gray-400 mt-1">Accepted</div>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-lg p-3 text-center hover:border-yellow-400/50 transition-all">
                    <div className="text-lg font-bold text-yellow-300">{empData.stats.shipped}</div>
                    <div className="text-xs text-gray-400 mt-1">Shipped</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-lg p-3 text-center hover:border-green-400/50 transition-all">
                    <div className="text-lg font-bold text-green-300">{empData.stats.delivered}</div>
                    <div className="text-xs text-gray-400 mt-1">Delivered</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-lg p-3 text-center hover:border-purple-400/50 transition-all">
                    <div className="text-lg font-bold text-purple-300">{empData.stats.modified}</div>
                    <div className="text-xs text-gray-400 mt-1">Modified</div>
                  </div>
                  <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-lg p-3 text-center hover:border-cyan-400/50 transition-all">
                    <div className="text-lg font-bold text-cyan-300">{empData.stats.added_retailer}</div>
                    <div className="text-xs text-gray-400 mt-1">Retailers</div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-lg p-3 text-center hover:border-emerald-400/50 transition-all col-span-3 sm:col-span-1">
                    <div className="text-lg font-bold text-emerald-300">{empData.stats.totalOrders}</div>
                    <div className="text-xs text-gray-400 mt-1">Total Orders</div>
                  </div>
                </div>
              </div>

              {/* Expanded Content - Detailed Activity Sections */}
              {isExpanded && (
                <div className="border-t border-white/10 bg-white/2.5 p-6 space-y-4 max-h-[800px] overflow-y-auto activity-scrollbar">
                  {/* Activity Type Sections */}
                  {Object.entries(groupedActivities).map(([actionType, activities]) => {
                    if (activities.length === 0) return null;
                    
                    const sectionKey = `${empKey}-${actionType}`;
                    const isSectionExpanded = expandedSections[sectionKey] !== false; // Default to expanded
                    const actionLabels = {
                      created: 'Created Orders',
                      accepted: 'Accepted Orders',
                      shipped: 'Shipped Orders',
                      delivered: 'Delivered Orders',
                      modified: 'Modified Orders',
                      rejected: 'Rejected Orders',
                      added_retailer: 'Retailers Added'
                    };
                    const actionColors = {
                      created: { bg: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30', text: 'text-blue-300', badge: 'bg-blue-500/20 text-blue-300' },
                      accepted: { bg: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30', text: 'text-emerald-300', badge: 'bg-emerald-500/20 text-emerald-300' },
                      shipped: { bg: 'from-yellow-500/20 to-yellow-600/10', border: 'border-yellow-500/30', text: 'text-yellow-300', badge: 'bg-yellow-500/20 text-yellow-300' },
                      delivered: { bg: 'from-green-500/20 to-green-600/10', border: 'border-green-500/30', text: 'text-green-300', badge: 'bg-green-500/20 text-green-300' },
                      modified: { bg: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/30', text: 'text-purple-300', badge: 'bg-purple-500/20 text-purple-300' },
                      rejected: { bg: 'from-red-500/20 to-red-600/10', border: 'border-red-500/30', text: 'text-red-300', badge: 'bg-red-500/20 text-red-300' },
                      added_retailer: { bg: 'from-cyan-500/20 to-cyan-600/10', border: 'border-cyan-500/30', text: 'text-cyan-300', badge: 'bg-cyan-500/20 text-cyan-300' }
                    };
                    const color = actionColors[actionType] || actionColors.created;
                    const sectionRevenue = activities.reduce((sum, a) => sum + (a.grandTotal || 0), 0);
                    
                    // Pagination for this section
                    const pageKey = `${empKey}-${actionType}`;
                    const currentPage = currentActivityPage[pageKey] || 1;
                    const startIndex = (currentPage - 1) * activityPageSize;
                    const endIndex = startIndex + activityPageSize;
                    const paginatedActivities = activities.slice(startIndex, endIndex);
                    const totalPages = Math.ceil(activities.length / activityPageSize);

                    return (
                      <div key={actionType} className="backdrop-blur-sm bg-gradient-to-br from-white/5 to-white/2.5 rounded-xl border border-white/10 overflow-hidden hover:border-white/20 transition-all">
                        {/* Section Header */}
                        <div
                          className="p-4 cursor-pointer hover:bg-white/5 transition-all flex items-center justify-between"
                          onClick={() => toggleSectionExpansion(empKey, actionType)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`flex-shrink-0 transform transition-transform duration-200 ${isSectionExpanded ? 'rotate-180' : ''}`}>
                              {isSectionExpanded ? <FiChevronUp className="w-4 h-4 text-gray-400" /> : <FiChevronDown className="w-4 h-4 text-gray-400" />}
                            </div>
                            <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${color.badge} border ${color.border}`}>
                              {actionLabels[actionType] || actionType.toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-400 font-medium">
                              {activities.length} {activities.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          {actionType === 'created' && sectionRevenue > 0 && (
                            <div className={`text-sm ${color.text} font-semibold ml-4 flex-shrink-0`}>
                              Total: ₹{sectionRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>

                        {/* Section Content */}
                        {isSectionExpanded && (
                          <div className="border-t border-white/10 p-4 space-y-3">
                            {paginatedActivities.length === 0 ? (
                              <p className="text-sm text-gray-400 text-center py-8">No activities in this section</p>
                            ) : (
                              <>
                                <div className="space-y-2">
                                {paginatedActivities.map((activity, idx) => (
                                  <div
                                    key={`${activity.orderId || activity.retailerId || idx}-${activity.action}`}
                                      className="bg-white/5 rounded-lg p-4 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2.5 flex-wrap mb-2.5">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${color.badge} border ${color.border}`}>
                                            {activity.action === 'added_retailer' ? 'ADDED RETAILER' : activity.action.toUpperCase()}
                                          </span>
                                          {activity.orderId && (
                                            <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  fetchOrderDetail(activity.orderId);
                                                }}
                                                className="text-blue-300 hover:text-blue-200 text-sm font-mono flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-blue-500/20 transition-all"
                                              >
                                                <FiEye className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Order:</span>
                                                <span className="font-medium">{activity.orderId.substring(0, 12)}...</span>
                                            </button>
                                          )}
                                            <span className="text-gray-200 font-medium truncate">{activity.retailerName || 'N/A'}</span>
                                          {activity.grandTotal > 0 && (
                                              <span className={`text-sm font-bold ${color.text} ml-auto flex-shrink-0`}>
                                                ₹{activity.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                              </span>
                                          )}
                                        </div>
                                          <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <FiClock className="w-3.5 h-3.5" />
                                            <span>{formatDate(activity.orderDate)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                </div>
                                
                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10">
                                    <div className="text-sm text-gray-400">
                                      Showing <span className="font-semibold text-white">{startIndex + 1}</span> to <span className="font-semibold text-white">{Math.min(endIndex, activities.length)}</span> of <span className="font-semibold text-white">{activities.length}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCurrentActivityPage(prev => ({ ...prev, [pageKey]: Math.max(1, currentPage - 1) }));
                                        }}
                                        disabled={currentPage === 1}
                                        className="px-4 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 hover:border-white/30 transition-all font-medium"
                                      >
                                        Previous
                                      </button>
                                      <span className="text-sm text-gray-400 px-3">
                                        Page {currentPage} of {totalPages}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCurrentActivityPage(prev => ({ ...prev, [pageKey]: Math.min(totalPages, currentPage + 1) }));
                                        }}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 hover:border-white/30 transition-all font-medium"
                                      >
                                        Next
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Order Detail Modal */}
      {selectedOrderDetail && (
        <OrderDetailModal
          orderId={selectedOrderDetail}
          orderData={orderDetailData}
          loading={loadingOrderDetail}
          onClose={closeOrderDetail}
          currentUser={currentUser}
          db={db}
        />
      )}
    </div>
  );
};

const DistributorViewEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [tempPins, setTempPins] = useState({});
  const [visiblePins, setVisiblePins] = useState({}); // Track which PINs are visible
  const [tick, setTick] = useState(0);
  const [confirmReset, setConfirmReset] = useState({ open: false, id: null, name: "" });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showZoneRetailerModal, setShowZoneRetailerModal] = useState(false);
  const [selectedEmployeeForZones, setSelectedEmployeeForZones] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedEmployeeForPermissions, setSelectedEmployeeForPermissions] = useState(null);
  const [customRoles, setCustomRoles] = useState([]);
  const [migrating, setMigrating] = useState(false);
  const [activeTab, setActiveTab] = useState('manage'); // 'manage' or 'activity'
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [employeeActivity, setEmployeeActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  
  // Enhanced Analytics State
  const [expandedEmployees, setExpandedEmployees] = useState({}); // Track which employee cards are expanded
  const [expandedSections, setExpandedSections] = useState({}); // Track expanded activity sections per employee
  const [activitySearchTerm, setActivitySearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState('all'); // 'all', 'created', 'accepted', etc.
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
  const [activitySortBy, setActivitySortBy] = useState('date-desc'); // 'date-desc', 'date-asc', 'revenue-desc', etc.
  const [activityPageSize, setActivityPageSize] = useState(20);
  const [currentActivityPage, setCurrentActivityPage] = useState({}); // Per-employee pagination

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'businesses', currentUser.uid, 'distributorEmployees'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEmployees(data);
      setFilteredEmployees(data);
      setLoading(false);
      
      // Extract unique custom roles from employees
      const roles = new Set(data.map(emp => emp.role).filter(Boolean));
      const standardRoles = ['Manager', 'Sales Executive', 'Order Manager', 'Dispatch Manager', 'Admin'];
      const customRolesList = Array.from(roles).filter(role => !standardRoles.includes(role));
      setCustomRoles(customRolesList);
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!confirmReset.open) return;
    const onKey = (e) => { if (e.key === 'Escape') setConfirmReset({ open: false, id: null, name: '' }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmReset.open]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    let filtered = employees.filter(emp => {
      // Apply search filter
      if (term) {
      const idVal = (emp.flypEmployeeId || emp.id || '').toString().toLowerCase();
        const matchesSearch = (
        emp.name?.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term) ||
        emp.role?.toLowerCase().includes(term) ||
        emp.phone?.toLowerCase?.().includes(term) ||
        idVal.includes(term)
      );
        if (!matchesSearch) return false;
      }
      
      // Apply status filter
      if (statusFilter !== 'all' && emp.status !== statusFilter) return false;
      
      // Apply role filter
      if (roleFilter !== 'all' && emp.role !== roleFilter) return false;
      
      return true;
    });
    setFilteredEmployees(filtered);
  }, [searchTerm, employees, statusFilter, roleFilter]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      await deleteDoc(doc(db, 'businesses', currentUser.uid, 'distributorEmployees', id));
      toast.success('Employee deleted successfully');
    }
  };

  const handleResetPin = async (employeeId, employeeName) => {
    if (!auth.currentUser) {
      toast.error("Please sign in again.");
      return;
    }
    try {
      await auth.currentUser.getIdToken(true);
    } catch (e) {
      console.warn("Failed to refresh ID token before resetPin:", e);
    }

    try {
      const resetPinFn = httpsCallable(functions, 'resetDistributorEmployeePin');
      const res = await resetPinFn({ employeeId, distributorId: currentUser.uid });

      const ok = res?.data?.success ?? false;
      const newPin = res?.data?.newPin;

      if (!ok || !newPin) {
        throw new Error(res?.data?.message || "Reset failed");
      }

      const empKey = employeeId;
      const expiresAt = Date.now() + 2 * 60 * 1000;
      setTempPins((prev) => ({ ...prev, [empKey]: { pin: newPin, expiresAt } }));
      setTimeout(() => {
        setTempPins((prev) => {
          const next = { ...prev };
          delete next[empKey];
          return next;
        });
      }, 2 * 60 * 1000);

      try {
        await navigator.clipboard.writeText(newPin);
        toast.success(`PIN reset for "${employeeName}". New PIN copied to clipboard.`);
      } catch {
        toast.success(`PIN reset for "${employeeName}". (Couldn't copy automatically)`);
        console.log("New PIN:", newPin);
      }
    } catch (err) {
      console.error("Reset PIN Error:", err.code, err.message, err.details);
      const code = err?.code;
      const details = err?.details;
      const message = err?.message;

      const msg =
        code === "unauthenticated" ? "You are not signed in."
        : code === "not-found" ? "Employee not found."
        : details || message || "Something went wrong while resetting the PIN.";

      toast.error(msg);
    }
  };

  const handleToggleStatus = async (emp) => {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'businesses', currentUser.uid, 'distributorEmployees', emp.id), {
        status: newStatus
      });
      toast.success(`Status changed to ${newStatus}`);
    } catch (err) {
      console.error("Status update error:", err);
      toast.error("Failed to update status. Please try again.");
    }
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp?.toDate) return '-';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return date.toLocaleTimeString();
    return date.toLocaleDateString();
  };

  const formatCountdown = (ms) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const confirmAndReset = (employeeId, employeeName) => {
    setConfirmReset({ open: true, id: employeeId, name: employeeName });
  };

  const getAccessSections = (emp) => {
    const sections = [];
    if (emp.accessSections?.addRetailers) sections.push('Add Retailers');
    if (emp.accessSections?.createOrders) sections.push('Create Orders');
    if (emp.accessSections?.manageOrders) sections.push('Manage Orders');
    if (emp.accessSections?.trackOrders) sections.push('Track Orders');
    if (emp.accessSections?.analytics) sections.push('Analytics');
    return sections.join(', ') || 'None';
  };

  const togglePinVisibility = (employeeId) => {
    setVisiblePins(prev => ({
      ...prev,
      [employeeId]: !prev[employeeId]
    }));
  };

  const isPinExpired = (emp) => {
    if (!emp.pinExpiresAt) return false;
    const expiresAt = emp.pinExpiresAt?.toDate ? emp.pinExpiresAt.toDate() : new Date(emp.pinExpiresAt);
    return new Date() > expiresAt;
  };

  const getPinStatus = (emp) => {
    if (isPinExpired(emp)) return 'expired';
    if (emp.pinCreatedAt) {
      const created = emp.pinCreatedAt?.toDate ? emp.pinCreatedAt.toDate() : new Date(emp.pinCreatedAt);
      const daysSinceCreation = Math.floor((new Date() - created) / (1000 * 60 * 60 * 24));
      if (daysSinceCreation >= 25) return 'expiring'; // Show warning 5 days before expiry
    }
    return 'valid';
  };

  const handleMigration = async () => {
    if (!currentUser?.uid) return;
    
    setMigrating(true);
    try {
      const migrateEmployeeIds = httpsCallable(functions, 'migrateEmployeeIds');
      const result = await migrateEmployeeIds({ distributorId: currentUser.uid });
      
      if (result.data.success) {
        toast.success(result.data.message);
        // Refresh the employees list
        window.location.reload();
      } else {
        toast.error(result.data.message);
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  // Load employee activity from orders and retailers
  useEffect(() => {
    if (!currentUser?.uid || activeTab !== 'activity') return;
    
    setLoadingActivity(true);
    let allActivities = [];
    let ordersLoaded = false;
    let retailersLoaded = false;
    
    const checkAndUpdate = () => {
      if (ordersLoaded && retailersLoaded) {
        allActivities.sort((a, b) => b.orderDate - a.orderDate);
        setEmployeeActivity([...allActivities]);
        setLoadingActivity(false);
      }
    };
    
    // Load orders
    const ordersRef = collection(db, 'businesses', currentUser.uid, 'orderRequests');
    const unsubscribeOrders = onSnapshot(ordersRef, (snapshot) => {
      // Remove existing order activities (keep retailer activities)
      allActivities = allActivities.filter(a => a.action === 'added_retailer');
      
      snapshot.docs.forEach((orderDoc) => {
        const order = { id: orderDoc.id, ...orderDoc.data() };
        
        // Check for employee activity in creatorDetails (fallback if employeeActivity array is missing)
        // Priority: Check employeeActivity array first, then creatorDetails
        const hasCreatedInActivityArray = Array.isArray(order.employeeActivity) && 
          order.employeeActivity.some(a => a.action === 'created' && (a.employeeId || a.flypEmployeeId));
        
        if (!hasCreatedInActivityArray && (order.creatorDetails?.type === 'employee' || order.createdBy === 'employee')) {
          const creatorInfo = order.creatorDetails || {};
          // Only add if we have valid employee identification
          // IMPORTANT: We need at least employeeId OR flypEmployeeId to track the activity
          if (creatorInfo.employeeId || creatorInfo.flypEmployeeId) {
            allActivities.push({
              employeeId: creatorInfo.employeeId || null,
              flypEmployeeId: creatorInfo.flypEmployeeId || null,
              employeeName: creatorInfo.name || 'Employee',
              employeeRole: creatorInfo.role || 'Employee',
              action: 'created',
              orderId: order.id,
              orderDate: order.createdAt?.toDate?.() || order.timestamp?.toDate?.() || new Date(),
              retailerName: order.retailerName || order.retailerBusinessName || 'N/A',
              grandTotal: order.chargesSnapshot?.breakdown?.grandTotal || order.chargesSnapshot?.grandTotal || 0,
            });
          }
        }
        
        if (order.handledBy?.acceptedBy?.type === 'employee') {
          allActivities.push({
            employeeId: order.handledBy.acceptedBy.employeeId,
            flypEmployeeId: order.handledBy.acceptedBy.flypEmployeeId,
            employeeName: order.handledBy.acceptedBy.name || 'Employee',
            employeeRole: order.handledBy.acceptedBy.role || 'Employee',
            action: 'accepted',
            orderId: order.id,
            orderDate: order.statusTimestamps?.acceptedAt?.toDate?.() || new Date(),
            retailerName: order.retailerName || order.retailerBusinessName || 'N/A',
            grandTotal: order.chargesSnapshot?.breakdown?.grandTotal || 0,
          });
        }
        
        if (order.handledBy?.shippedBy?.type === 'employee') {
          allActivities.push({
            employeeId: order.handledBy.shippedBy.employeeId,
            flypEmployeeId: order.handledBy.shippedBy.flypEmployeeId,
            employeeName: order.handledBy.shippedBy.name || 'Employee',
            employeeRole: order.handledBy.shippedBy.role || 'Employee',
            action: 'shipped',
            orderId: order.id,
            orderDate: order.statusTimestamps?.shippedAt?.toDate?.() || new Date(),
            retailerName: order.retailerName || order.retailerBusinessName || 'N/A',
            grandTotal: order.chargesSnapshot?.breakdown?.grandTotal || 0,
          });
        }
        
        if (order.handledBy?.deliveredBy?.type === 'employee') {
          allActivities.push({
            employeeId: order.handledBy.deliveredBy.employeeId,
            flypEmployeeId: order.handledBy.deliveredBy.flypEmployeeId,
            employeeName: order.handledBy.deliveredBy.name || 'Employee',
            employeeRole: order.handledBy.deliveredBy.role || 'Employee',
            action: 'delivered',
            orderId: order.id,
            orderDate: order.statusTimestamps?.deliveredAt?.toDate?.() || order.deliveredAt ? new Date(order.deliveredAt) : new Date(),
            retailerName: order.retailerName || order.retailerBusinessName || 'N/A',
            grandTotal: order.chargesSnapshot?.breakdown?.grandTotal || 0,
          });
        }
        
        if (order.handledBy?.modifiedBy?.type === 'employee') {
          allActivities.push({
            employeeId: order.handledBy.modifiedBy.employeeId,
            flypEmployeeId: order.handledBy.modifiedBy.flypEmployeeId,
            employeeName: order.handledBy.modifiedBy.name || 'Employee',
            employeeRole: order.handledBy.modifiedBy.role || 'Employee',
            action: 'modified',
            orderId: order.id,
            orderDate: order.updatedAt?.toDate?.() || new Date(),
            retailerName: order.retailerName || order.retailerBusinessName || 'N/A',
            grandTotal: order.chargesSnapshot?.breakdown?.grandTotal || 0,
          });
        }
        
        if (order.handledBy?.rejectedBy?.type === 'employee') {
          allActivities.push({
            employeeId: order.handledBy.rejectedBy.employeeId,
            flypEmployeeId: order.handledBy.rejectedBy.flypEmployeeId,
            employeeName: order.handledBy.rejectedBy.name || 'Employee',
            employeeRole: order.handledBy.rejectedBy.role || 'Employee',
            action: 'rejected',
            orderId: order.id,
            orderDate: order.statusTimestamps?.rejectedAt?.toDate?.() || new Date(),
            retailerName: order.retailerName || order.retailerBusinessName || 'N/A',
            grandTotal: order.chargesSnapshot?.breakdown?.grandTotal || 0,
          });
        }
        
        // Check employeeActivity array (this is the most reliable source)
        if (Array.isArray(order.employeeActivity) && order.employeeActivity.length > 0) {
          order.employeeActivity.forEach((activity) => {
            // Skip duplicate 'created' entries if we already added one from creatorDetails
            const isDuplicateCreated = activity.action === 'created' && 
              allActivities.some(a => a.orderId === order.id && a.action === 'created' && a.employeeId === activity.employeeId);
            
            if (!isDuplicateCreated) {
              allActivities.push({
                employeeId: activity.employeeId,
                flypEmployeeId: activity.flypEmployeeId || activity.employeeId,
                employeeName: activity.employeeName || 'Employee',
                employeeRole: activity.employeeRole || 'Employee',
                action: activity.action,
                orderId: order.id,
                orderDate: activity.timestamp?.toDate?.() || (activity.at ? new Date(activity.at) : new Date()),
                retailerName: order.retailerName || order.retailerBusinessName || 'N/A',
                grandTotal: order.chargesSnapshot?.breakdown?.grandTotal || order.chargesSnapshot?.grandTotal || 0,
              });
            }
          });
        }
      });
      
      ordersLoaded = true;
      checkAndUpdate();
    });
    
    // Load retailers
    const retailersRef = collection(db, 'businesses', currentUser.uid, 'connectedRetailers');
    const unsubscribeRetailers = onSnapshot(retailersRef, (snapshot) => {
      // Remove existing retailer activities (keep order activities)
      allActivities = allActivities.filter(a => a.action !== 'added_retailer');
      
      snapshot.docs.forEach((retailerDoc) => {
        const retailer = { id: retailerDoc.id, ...retailerDoc.data() };
        
        // Check if retailer was added by an employee
        if (retailer.addedBy?.type === 'employee') {
          allActivities.push({
            employeeId: retailer.addedBy.id,
            flypEmployeeId: retailer.addedBy.flypEmployeeId,
            employeeName: retailer.addedBy.name || 'Employee',
            employeeRole: retailer.addedBy.role || 'Employee',
            action: 'added_retailer',
            retailerId: retailer.id,
            retailerName: retailer.retailerName || retailer.businessName || 'N/A',
            orderDate: retailer.createdAt?.toDate?.() || retailer.addedAt?.toDate?.() || new Date(),
            grandTotal: 0,
          });
        }
      });
      
      retailersLoaded = true;
      checkAndUpdate();
    });
    
    return () => {
      unsubscribeOrders();
      unsubscribeRetailers();
    };
  }, [currentUser, activeTab]);

  // Group activities by employee - use flypEmployeeId as primary key, fallback to employeeId
  const activitiesByEmployee = useMemo(() => {
    const grouped = {};
    
    employeeActivity.forEach((activity) => {
      // Primary key: flypEmployeeId (most stable), fallback to employeeId
      const key = activity.flypEmployeeId || activity.employeeId || 'unknown';
      
      if (!grouped[key]) {
        grouped[key] = {
          employeeId: activity.employeeId,
          flypEmployeeId: activity.flypEmployeeId || activity.employeeId,
          employeeName: activity.employeeName,
          employeeRole: activity.employeeRole,
          activities: [],
          stats: {
            created: 0,
            accepted: 0,
            shipped: 0,
            delivered: 0,
            modified: 0,
            rejected: 0,
            added_retailer: 0,
            totalOrders: 0,
            totalRevenue: 0,
          },
        };
      }
      
      // Merge activities - ensure we have the best available employee info
      if (activity.employeeName && !grouped[key].employeeName) {
        grouped[key].employeeName = activity.employeeName;
      }
      if (activity.employeeRole && !grouped[key].employeeRole) {
        grouped[key].employeeRole = activity.employeeRole;
      }
      if (activity.flypEmployeeId && !grouped[key].flypEmployeeId) {
        grouped[key].flypEmployeeId = activity.flypEmployeeId;
      }
      
      grouped[key].activities.push(activity);
      
      // Update stats
      if (activity.action === 'created') grouped[key].stats.created++;
      if (activity.action === 'accepted') grouped[key].stats.accepted++;
      if (activity.action === 'shipped') grouped[key].stats.shipped++;
      if (activity.action === 'delivered') grouped[key].stats.delivered++;
      if (activity.action === 'modified') grouped[key].stats.modified++;
      if (activity.action === 'rejected') grouped[key].stats.rejected++;
      if (activity.action === 'added_retailer') grouped[key].stats.added_retailer++;
      
      // Count unique orders
      const uniqueOrderIds = new Set(grouped[key].activities.filter(a => a.orderId).map(a => a.orderId));
      grouped[key].stats.totalOrders = uniqueOrderIds.size;
      
      // Calculate revenue from delivered orders
      if (activity.action === 'delivered') {
        grouped[key].stats.totalRevenue += activity.grandTotal || 0;
      }
    });
    
    // Also try to match employees by flypEmployeeId from the employees list
    // This helps group activities even if employeeId doesn't match exactly
    employees.forEach((emp) => {
      const empKey = emp.flypEmployeeId || emp.id;
      Object.keys(grouped).forEach((key) => {
        const group = grouped[key];
        // If this group's flypEmployeeId matches an employee, merge with employee data
        if (group.flypEmployeeId === emp.flypEmployeeId || group.employeeId === emp.id) {
          if (!group.employeeName && emp.name) group.employeeName = emp.name;
          if (!group.employeeRole && emp.role) group.employeeRole = emp.role;
          if (!group.flypEmployeeId && emp.flypEmployeeId) group.flypEmployeeId = emp.flypEmployeeId;
          if (!group.employeeId && emp.id) group.employeeId = emp.id;
        }
      });
    });
    
    return grouped;
  }, [employeeActivity, employees]);

  return (
    <div className="w-full text-white">
      <div className="w-full">
        {/* Tabs */}
        <div className="flex gap-6 mb-8 border-b border-white/10">
          <button
            onClick={() => setActiveTab('manage')}
            className={`pb-3 px-1 font-semibold text-sm transition-colors ${
              activeTab === 'manage'
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Manage Employees
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-3 px-1 font-semibold text-sm transition-colors ${
              activeTab === 'activity'
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Employee Activity Analytics
          </button>
        </div>

        {activeTab === 'manage' ? (
          <>
            {/* Header Section */}
            <div className="mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">Employee Management</h1>
                  <p className="text-slate-400">Manage your team members, permissions, and access controls</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleMigration}
                    disabled={migrating}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-200 hover:bg-slate-700/80 disabled:opacity-50 transition-all"
                  >
                    <FiDatabase className="w-4 h-4" />
                    {migrating ? 'Migrating...' : 'Migrate IDs'}
                  </button>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <FiPlus className="w-5 h-5" />
                    Add Employee
                  </button>
                </div>
              </div>

              {/* Filters Section */}
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative md:col-span-2">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name, email, role, or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-900/50 border border-slate-700/50 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 appearance-none cursor-pointer"
                    >
                      <option value="all" className="bg-slate-900">All Statuses</option>
                      <option value="active" className="bg-slate-900">Active</option>
                      <option value="inactive" className="bg-slate-900">Inactive</option>
                    </select>
                    <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-900/50 border border-slate-700/50 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 appearance-none cursor-pointer"
                    >
                      <option value="all" className="bg-slate-900">All Roles</option>
                      <option value="Manager" className="bg-slate-900">Manager</option>
                      <option value="Sales Executive" className="bg-slate-900">Sales Executive</option>
                      <option value="Order Manager" className="bg-slate-900">Order Manager</option>
                      <option value="Dispatch Manager" className="bg-slate-900">Dispatch Manager</option>
                      <option value="Admin" className="bg-slate-900">Admin</option>
                    </select>
                    <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-5 backdrop-blur-sm">
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Total</div>
                  <div className="text-3xl font-bold text-white">{employees.length}</div>
                  <div className="text-xs text-slate-500 mt-1">Employees</div>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-5 backdrop-blur-sm">
                  <div className="text-xs font-medium text-emerald-300 uppercase tracking-wider mb-2">Active</div>
                  <div className="text-3xl font-bold text-emerald-200">
                    {employees.filter(e => e.status === 'active').length}
                  </div>
                  <div className="text-xs text-emerald-400/70 mt-1">Currently active</div>
                </div>
                <div className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-sky-600/5 p-5 backdrop-blur-sm">
                  <div className="text-xs font-medium text-sky-300 uppercase tracking-wider mb-2">Online</div>
                  <div className="text-3xl font-bold text-sky-200">
                    {employees.filter(e => e.online).length}
                  </div>
                  <div className="text-xs text-sky-400/70 mt-1">Currently online</div>
                </div>
                <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-5 backdrop-blur-sm">
                  <div className="text-xs font-medium text-purple-300 uppercase tracking-wider mb-2">Assigned</div>
                  <div className="text-3xl font-bold text-purple-200">
                    {employees.filter(e => e.zones?.length > 0 || e.assignedRetailers?.length > 0).length}
                  </div>
                  <div className="text-xs text-purple-400/70 mt-1">With assignments</div>
                </div>
              </div>
            </div>

            {/* Employee Table */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
                  <p className="text-slate-400">Loading employees...</p>
                </div>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-12 text-center">
                <FiUser className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-300 text-lg mb-2">No employees found</p>
                <p className="text-slate-500 text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-900/50 border-b border-white/10">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Assignments</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">PIN</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredEmployees.map((emp) => {
                        const pinStatus = getPinStatus(emp);
                        const isVisible = visiblePins[emp.flypEmployeeId || emp.id];
                        const empKey = emp.flypEmployeeId || emp.id;
                        const temp = tempPins[empKey];
                        const enabledPermissions = emp.accessSections 
                          ? Object.entries(emp.accessSections).filter(([_, enabled]) => enabled).length 
                          : 0;

                        return (
                          <tr key={emp.id} className="hover:bg-white/5 transition-colors group">
                            {/* Employee Info */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="relative h-10 w-10 rounded-full overflow-hidden border-2 border-white/20 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
                                  {emp.profilePictureUrl ? (
                                    <img
                                      src={emp.profilePictureUrl}
                                      alt={emp.name || 'Employee'}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.parentElement.innerHTML = `<span class="text-sm font-bold text-white">${(emp.name || 'E').charAt(0).toUpperCase()}</span>`;
                                      }}
                                    />
                                  ) : (
                                    <span className="text-sm font-bold text-white">
                                      {(emp.name || 'E').charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-white truncate">{emp.name || 'Unnamed Employee'}</h3>
                                    {emp.online && (
                                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse flex-shrink-0"></div>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400 font-mono truncate">{emp.flypEmployeeId || emp.id || 'No ID'}</p>
                                </div>
                              </div>
                            </td>

                            {/* Contact */}
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                {emp.email && (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                                    <FiMail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                    <span className="truncate max-w-[200px]">{emp.email}</span>
                                  </div>
                                )}
                                {emp.phone && (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                                    <FiPhone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                    <span>{emp.phone}</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Role */}
                            <td className="px-6 py-4">
                              <RoleSelector
                                employee={emp}
                                currentUser={currentUser}
                                customRoles={customRoles}
                                onRoleChange={async (newRole) => {
                                  if (newRole && !['Manager', 'Sales Executive', 'Order Manager', 'Dispatch Manager', 'Admin', ...customRoles].includes(newRole)) {
                                    setCustomRoles(prev => [...prev, newRole]);
                                  }
                                  await updateDoc(doc(db, 'businesses', currentUser.uid, 'distributorEmployees', emp.id), {
                                    role: newRole
                                  });
                                  toast.success(`Role updated to ${newRole}`);
                                }}
                              />
                            </td>

                            {/* Status */}
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => handleToggleStatus(emp)}
                                  className={`w-fit px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                    emp.status === 'active'
                                      ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/30 hover:bg-emerald-500/20'
                                      : 'bg-slate-700/40 text-slate-300 border-slate-600/50 hover:bg-slate-700/60'
                                  }`}
                                >
                                  {emp.status === 'active' ? 'Active' : 'Inactive'}
                                </button>
                                {!emp.online && (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <FiClock className="w-3 h-3" />
                                    <span>{formatLastSeen(emp.lastSeen)}</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Assignments */}
                            <td className="px-6 py-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedEmployeeForZones(emp);
                                      setShowZoneRetailerModal(true);
                                    }}
                                    className="px-2.5 py-1 rounded-md bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 text-purple-300 text-xs transition-all"
                                  >
                                    <FiMapPin className="w-3.5 h-3.5 inline mr-1" />
                                    Assign
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {emp.zones?.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-400/20 text-purple-300 text-xs">
                                      {emp.zones.length} zone{emp.zones.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {emp.assignedRetailers?.length > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-xs">
                                      {emp.assignedRetailers.length} retailer{emp.assignedRetailers.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {(!emp.zones?.length && !emp.assignedRetailers?.length) && (
                                    <span className="text-xs text-slate-500 italic">None</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedEmployeeForPermissions(emp);
                                    setShowPermissionModal(true);
                                  }}
                                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                                >
                                  {enabledPermissions} permission{enabledPermissions !== 1 ? 's' : ''}
                                </button>
                              </div>
                            </td>

                            {/* PIN */}
                            <td className="px-6 py-4">
                              <div className="space-y-2">
                                {temp && temp.expiresAt > Date.now() ? (
                                  <div className="space-y-1">
                                    <div className="text-xs text-amber-200">New PIN:</div>
                                    <div className="font-mono text-sm font-bold text-amber-300">{temp.pin}</div>
                                    <div className="text-xs text-amber-400">
                                      Expires in {formatCountdown(temp.expiresAt - Date.now())}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                        pinStatus === 'expired'
                                          ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                                          : pinStatus === 'expiring'
                                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                      }`}>
                                        {pinStatus}
                                      </span>
                                      <button
                                        onClick={() => confirmAndReset(empKey, emp.name)}
                                        className="text-xs text-amber-300 hover:text-amber-200 underline"
                                      >
                                        Reset
                                      </button>
                                    </div>
                                    <button
                                      onClick={() => togglePinVisibility(empKey)}
                                      className={`w-full px-2 py-1.5 rounded-md border text-xs font-mono transition-all ${
                                        pinStatus === 'expired'
                                          ? 'border-red-400/30 bg-red-500/10 text-red-200'
                                          : pinStatus === 'expiring'
                                          ? 'border-yellow-400/30 bg-yellow-500/10 text-yellow-200'
                                          : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                                      }`}
                                    >
                                      {isVisible ? (emp.pin || 'No PIN') : '••••••'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <a
                                  href={`${(typeof window !== 'undefined' && window.location ? window.location.origin : 'https://flypnow.com')}/distributor-employee-login?distributorId=${encodeURIComponent(currentUser?.uid)}&empId=${encodeURIComponent(emp.flypEmployeeId || emp.id)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-8 h-8 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-200 flex items-center justify-center transition-all"
                                  title="Open Login Link"
                                >
                                  <FiExternalLink className="w-4 h-4" />
                                </a>
                                <button
                                  onClick={async () => {
                                    try {
                                      const base = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'https://flypnow.com';
                                      const loginLink = `${base}/distributor-employee-login?distributorId=${encodeURIComponent(currentUser?.uid)}&empId=${encodeURIComponent(emp.flypEmployeeId || emp.id)}`;
                                      if (navigator.share) {
                                        try {
                                          await navigator.share({ 
                                            title: 'Employee Login Link', 
                                            text: `Login link for ${emp.name}`, 
                                            url: loginLink 
                                          });
                                          toast.success('Link shared!');
                                          return;
                                        } catch (err) {
                                          if (err.name !== 'AbortError') {
                                            console.log('Share failed:', err);
                                            // Fall through to copy
                                          } else {
                                            return; // User cancelled
                                          }
                                        }
                                      }
                                      await navigator.clipboard.writeText(loginLink);
                                      toast.success('Link copied to clipboard!');
                                    } catch (err) {
                                      toast.error('Failed to copy link');
                                    }
                                  }}
                                  className="w-8 h-8 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 flex items-center justify-center transition-all"
                                  title="Share or Copy Login Link"
                                >
                                  <FiCopy className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedEmployeeForEdit(emp);
                                    setShowEditModal(true);
                                  }}
                                  className="w-8 h-8 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-200 flex items-center justify-center transition-all"
                                  title="Edit"
                                >
                                  <FiSettings className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(emp.id)}
                                  className="w-8 h-8 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-200 flex items-center justify-center transition-all"
                                  title="Delete"
                                >
                                  <FiTrash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-4 border-t border-white/10 bg-slate-900/30">
                  <div className="text-sm text-slate-400">
                    Showing <span className="text-white font-semibold">{filteredEmployees.length}</span> of{' '}
                    <span className="text-white font-semibold">{employees.length}</span> employees
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <EnhancedEmployeeActivityAnalytics
            activitiesByEmployee={activitiesByEmployee}
            employees={employees}
            loadingActivity={loadingActivity}
            currentUser={currentUser}
            db={db}
          />
        )}
      </div>

      <ConfirmResetModal
        open={confirmReset.open}
        name={confirmReset.name}
        onCancel={() => setConfirmReset({ open: false, id: null, name: "" })}
        onConfirm={async () => {
          const { id, name } = confirmReset;
          setConfirmReset({ open: false, id: null, name: "" });
          await handleResetPin(id, name);
        }}
      />

      <AddDistributorEmployeeModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        distributorId={currentUser?.uid}
        onCreated={() => {
          setShowAddModal(false);
          toast.success('Employee created successfully!');
        }}
      />

      <EmployeeZoneRetailerModal
        key={selectedEmployeeForZones?.id || 'modal'} // Force remount when employee changes
        open={showZoneRetailerModal}
        onClose={() => {
          setShowZoneRetailerModal(false);
          setSelectedEmployeeForZones(null);
        }}
        employee={selectedEmployeeForZones}
        distributorId={currentUser?.uid}
      />

      <EditEmployeeModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedEmployeeForEdit(null);
        }}
        employee={selectedEmployeeForEdit}
        currentUser={currentUser}
      />

      <PermissionSelectorModal
        open={showPermissionModal}
        onClose={() => {
          setShowPermissionModal(false);
          setSelectedEmployeeForPermissions(null);
        }}
        employee={selectedEmployeeForPermissions}
        currentUser={currentUser}
      />
    </div>
  );
};

export default DistributorViewEmployees;
