import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';

const AddDistributorEmployeeModal = ({ open, onClose, distributorId, onCreated }) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    accessSections: {
      addRetailers: false,
      createOrders: false,
      manageOrders: false,
      trackOrders: false,
      analytics: false
    }
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    
    if (!form.email.trim() && !form.phone.trim()) {
      toast.error('Email or phone is required');
      return;
    }

    if (!Object.values(form.accessSections).some(Boolean)) {
      toast.error('Select at least one access section');
      return;
    }

    setLoading(true);
    try {
      // Generate FLYP-DIST-XXXXXX format (6 digits)
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      const flypEmployeeId = `FLYP-DIST-${randomDigits}`;
      
      // Generate initial PIN (6 digits)
      const initialPin = Math.floor(100000 + Math.random() * 900000).toString();
      
      const employeeData = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        role: form.role || 'Employee',
        accessSections: form.accessSections,
        status: 'active',
        online: false,
        flypEmployeeId,
        distributorId,
        pin: initialPin,
        pinCreatedAt: serverTimestamp(),
        pinExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'businesses', distributorId, 'distributorEmployees'), employeeData);
      
      // Show PIN to user
      toast.success(`Employee created! PIN: ${initialPin} (Valid for 30 days)`);
      
      onCreated?.({ ...employeeData, initialPin });
      resetForm();
    } catch (error) {
      console.error('Error creating employee:', error);
      toast.error('Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      phone: '',
      role: '',
      accessSections: {
        addRetailers: false,
        createOrders: false,
        manageOrders: false,
        trackOrders: false,
        analytics: false
      }
    });
  };

  const handleAccessChange = (section) => {
    setForm(prev => ({
      ...prev,
      accessSections: {
        ...prev.accessSections,
        [section]: !prev.accessSections[section]
      }
    }));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl mx-4 rounded-2xl border border-white/10 bg-[#0b1220]/95 text-white shadow-[0_30px_120px_rgba(0,0,0,.6)] backdrop-blur-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Add Distributor Employee</h3>
                <p className="text-sm text-white/70 mt-1">Create employee account with specific access permissions</p>
              </div>
              <button
                className="rounded-full p-2 bg-white/10 hover:bg-white/15 text-white/90"
                onClick={onClose}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Employee name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="" className="bg-gray-900">Select Role</option>
                    <option value="Manager" className="bg-gray-900">Manager</option>
                    <option value="Sales Executive" className="bg-gray-900">Sales Executive</option>
                    <option value="Order Manager" className="bg-gray-900">Order Manager</option>
                    <option value="Dispatch Manager" className="bg-gray-900">Dispatch Manager</option>
                    <option value="Admin" className="bg-gray-900">Admin</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="employee@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">Access Permissions *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { key: 'addRetailers', label: 'Add Retailers', desc: 'Can add new retailers to the system' },
                    { key: 'createOrders', label: 'Create Orders', desc: 'Can create passive orders for retailers' },
                    { key: 'manageOrders', label: 'Manage Orders', desc: 'Can manage order requests and pending orders' },
                    { key: 'trackOrders', label: 'Track Orders', desc: 'Can track and update order status' },
                    { key: 'analytics', label: 'Analytics', desc: 'Can view business analytics and reports' }
                  ].map((section) => (
                    <label key={section.key} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.accessSections[section.key]}
                        onChange={() => handleAccessChange(section.key)}
                        className="mt-1 accent-emerald-500"
                      />
                      <div>
                        <div className="font-medium text-sm">{section.label}</div>
                        <div className="text-xs text-white/60">{section.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Employee'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddDistributorEmployeeModal;
