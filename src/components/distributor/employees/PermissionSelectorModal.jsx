import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import { FiX, FiShield, FiSearch, FiCheck, FiSave } from 'react-icons/fi';
import { toast } from 'react-toastify';

// Available features from distributor dashboard
const AVAILABLE_FEATURES = [
  { 
    key: 'addRetailers', 
    label: 'Add Retailers', 
    description: 'Add new retailers to the distributor network',
    icon: '👥',
    category: 'Retailers'
  },
  { 
    key: 'createOrders', 
    label: 'Create Orders', 
    description: 'Create passive orders for retailers',
    icon: '➕',
    category: 'Orders'
  },
  { 
    key: 'manageOrders', 
    label: 'Manage Orders', 
    description: 'Manage order requests and pending orders',
    icon: '📋',
    category: 'Orders'
  },
  { 
    key: 'trackOrders', 
    label: 'Track Orders', 
    description: 'Track and update order status',
    icon: '📍',
    category: 'Orders'
  },
  { 
    key: 'inventory', 
    label: 'Inventory Management', 
    description: 'View and manage inventory',
    icon: '📦',
    category: 'Inventory'
  },
  { 
    key: 'dispatch', 
    label: 'Dispatch Tracker', 
    description: 'Track dispatches and deliveries',
    icon: '🚚',
    category: 'Logistics'
  },
  { 
    key: 'analytics', 
    label: 'Analytics', 
    description: 'View business analytics and reports',
    icon: '📊',
    category: 'Analytics'
  },
  { 
    key: 'aiForecast', 
    label: 'AI Forecast', 
    description: 'Access AI-powered forecasting',
    icon: '🧠',
    category: 'Analytics'
  },
  { 
    key: 'manualBilling', 
    label: 'Manual Billing', 
    description: 'Create and manage manual bills',
    icon: '💰',
    category: 'Billing'
  },
  { 
    key: 'invoices', 
    label: 'Invoices', 
    description: 'View and manage invoices',
    icon: '🧾',
    category: 'Billing'
  },
  { 
    key: 'productOwners', 
    label: 'Product Owners', 
    description: 'Manage product owners',
    icon: '🏭',
    category: 'Products'
  },
  { 
    key: 'retailerRequests', 
    label: 'Retailer Requests', 
    description: 'Manage retailer connection requests',
    icon: '📨',
    category: 'Retailers'
  }
];

const PermissionSelectorModal = ({ open, onClose, employee, currentUser }) => {
  const [selectedPermissions, setSelectedPermissions] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (employee?.accessSections) {
      setSelectedPermissions({ ...employee.accessSections });
    } else {
      setSelectedPermissions({});
    }
  }, [employee]);

  const categories = ['all', ...new Set(AVAILABLE_FEATURES.map(f => f.category))];

  const filteredFeatures = AVAILABLE_FEATURES.filter(feature => {
    const matchesSearch = feature.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         feature.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || feature.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const togglePermission = (key) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSelectAll = () => {
    const allSelected = filteredFeatures.reduce((acc, feature) => {
      acc[feature.key] = true;
      return acc;
    }, {});
    setSelectedPermissions(prev => ({ ...prev, ...allSelected }));
  };

  const handleDeselectAll = () => {
    const allDeselected = filteredFeatures.reduce((acc, feature) => {
      acc[feature.key] = false;
      return acc;
    }, {});
    setSelectedPermissions(prev => ({ ...prev, ...allDeselected }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateDoc(
        doc(db, 'businesses', currentUser.uid, 'distributorEmployees', employee.id),
        {
          accessSections: selectedPermissions,
          updatedAt: new Date()
        }
      );
      toast.success('Permissions updated successfully');
      onClose();
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
    } finally {
      setLoading(false);
    }
  };

  if (!open || !employee) return null;

  const selectedCount = Object.values(selectedPermissions).filter(Boolean).length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/20 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-white/20">
                  <FiShield className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Manage Permissions</h2>
                  <p className="text-xs text-gray-400">{employee.name} • {selectedCount} permission{selectedCount !== 1 ? 's' : ''} selected</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-all"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Search and Filters */}
            <div className="p-4 border-b border-white/10 space-y-3 bg-white/2.5">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="Search permissions..."
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">Category:</span>
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      selectedCategory === category
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </button>
                ))}
                <div className="flex-1"></div>
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Permissions List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredFeatures.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">No permissions found</p>
                </div>
              ) : (
                filteredFeatures.map((feature) => {
                  const isSelected = !!selectedPermissions[feature.key];
                  return (
                    <label
                      key={feature.key}
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all hover:bg-white/5 ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePermission(feature.key)}
                          className="accent-emerald-500 w-4 h-4"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{feature.icon}</span>
                          <span className={`font-medium ${isSelected ? 'text-emerald-300' : 'text-white'}`}>
                            {feature.label}
                          </span>
                          {isSelected && (
                            <FiCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{feature.description}</p>
                        <span className="inline-block mt-2 px-2 py-0.5 text-xs rounded bg-white/5 text-gray-500">
                          {feature.category}
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-white/2.5 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                <span className="text-white font-semibold">{selectedCount}</span> of {AVAILABLE_FEATURES.length} permissions selected
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/20 text-white font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <FiSave className="w-4 h-4" />
                      Save Permissions
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PermissionSelectorModal;

