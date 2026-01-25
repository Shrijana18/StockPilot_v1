/**
 * CustomerProfile - Premium dark theme profile
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FaUser, FaMapMarkerAlt, FaPhone, FaEnvelope, FaSignOutAlt,
  FaChevronRight, FaPlus, FaEdit, FaTrash, FaShieldAlt,
  FaQuestionCircle, FaInfoCircle
} from 'react-icons/fa';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import SupportFlow from '../components/SupportFlow';

// FLYP Logo - Uses actual logo
const FlypLogo = () => (
  <img src="/assets/flyp_logo.png" alt="FLYP" className="w-12 h-12 object-contain" />
);

// Menu Item Component - Dark Theme
const MenuItem = ({ icon: Icon, label, value, onClick, danger }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-4 py-3 ${danger ? 'text-red-400' : 'text-white'}`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
      danger ? 'bg-red-500/10 border border-red-500/20' : 'bg-slate-700 border border-slate-600'
    }`}>
      <Icon className={danger ? 'text-red-400' : 'text-slate-400'} />
    </div>
    <div className="flex-1 text-left">
      <p className="font-medium">{label}</p>
      {value && <p className="text-sm text-white/40">{value}</p>}
    </div>
    <FaChevronRight className="text-white/30" />
  </button>
);

// Address Card - Dark Theme
const AddressCard = ({ address, onEdit, onDelete, onSetDefault }) => (
  <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 p-4">
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <FaMapMarkerAlt className="text-[#05E06C]400 text-sm" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-white">{address.label}</p>
            {address.isDefault && (
              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[#05E06C]400 text-xs rounded-full">
                Default
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">{address.address}</p>
        </div>
      </div>
    </div>
    <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
      {!address.isDefault && (
        <button
          onClick={() => onSetDefault(address.id)}
          className="flex-1 py-2 text-sm text-[#05E06C]400 font-medium"
        >
          Set as Default
        </button>
      )}
      <button
        onClick={() => onEdit(address)}
        className="px-4 py-2 text-sm text-slate-400"
      >
        <FaEdit />
      </button>
      <button
        onClick={() => onDelete(address.id)}
        className="px-4 py-2 text-sm text-red-400"
      >
        <FaTrash />
      </button>
    </div>
  </div>
);

const CustomerProfile = ({ onBack }) => {
  const { customer, customerData, updateProfile, logout, setDefaultAddress, addAddress } = useCustomerAuth();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(customerData?.name || '');
  const [showAddresses, setShowAddresses] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: '', address: '' });
  const [showSupportFlow, setShowSupportFlow] = useState(false);

  // Handle name update
  const handleNameUpdate = async () => {
    if (newName.trim() && newName !== customerData?.name) {
      await updateProfile({ name: newName.trim() });
    }
    setEditingName(false);
  };

  // Handle add address
  const handleAddAddress = async () => {
    if (newAddress.label && newAddress.address) {
      await addAddress(newAddress);
      setNewAddress({ label: '', address: '' });
      setAddingAddress(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      {/* Profile Header */}
      <div 
        className="relative px-4 pt-6 pb-12 overflow-hidden"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 24px)' }}
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-900" />
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-teal-500/10 blur-3xl" />

        <div className="relative flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-white/5 border-2 border-emerald-500/30 flex items-center justify-center">
            <FaUser className="text-[#05E06C]400 text-3xl" />
          </div>
          <div className="flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
                <button
                  onClick={handleNameUpdate}
                  className="px-3 py-2 bg-emerald-500 rounded-lg text-slate-900 font-medium hover:bg-emerald-400 transition"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">
                  {customerData?.name || 'Customer'}
                </h2>
                <button onClick={() => setEditingName(true)}>
                  <FaEdit className="text-white/40" />
                </button>
              </div>
            )}
            <p className="text-slate-400">{customer?.phoneNumber}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-6">
        <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 p-4 flex">
          <div className="flex-1 text-center border-r border-white/10">
            <p className="text-2xl font-bold text-white">
              {customerData?.totalOrders || 0}
            </p>
            <p className="text-xs text-white/40">Total Orders</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-white">
              {customerData?.addresses?.length || 0}
            </p>
            <p className="text-xs text-white/40">Saved Addresses</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="mt-6 px-4 space-y-4">
        {/* Account Section */}
        <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 overflow-hidden">
          <p className="px-4 py-3 text-sm font-medium text-white/40 border-b border-white/10">
            Account
          </p>
          <MenuItem
            icon={FaPhone}
            label="Phone Number"
            value={customer?.phoneNumber}
          />
          <MenuItem
            icon={FaEnvelope}
            label="Email"
            value={customerData?.email || 'Not added'}
          />
          <MenuItem
            icon={FaMapMarkerAlt}
            label="Saved Addresses"
            value={`${customerData?.addresses?.length || 0} addresses`}
            onClick={() => setShowAddresses(!showAddresses)}
          />
        </div>

        {/* Addresses (expanded) */}
        {showAddresses && (
          <div className="space-y-3">
            {customerData?.addresses?.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                onSetDefault={setDefaultAddress}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            ))}
            
            {addingAddress ? (
              <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 p-4 space-y-3">
                <input
                  type="text"
                  placeholder="Label (Home, Office, etc.)"
                  value={newAddress.label}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <textarea
                  placeholder="Full address"
                  value={newAddress.address}
                  onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddingAddress(false)}
                    className="flex-1 py-2 border border-slate-600 rounded-lg text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddAddress}
                    className="flex-1 py-2 bg-emerald-500 text-slate-900 rounded-lg hover:bg-emerald-400 transition"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingAddress(true)}
                className="w-full p-4 rounded-xl border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 flex items-center justify-center gap-2 text-[#05E06C]400"
              >
                <FaPlus />
                <span>Add New Address</span>
              </button>
            )}
          </div>
        )}

        {/* Support Section */}
        <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 overflow-hidden">
          <p className="px-4 py-3 text-sm font-medium text-white/40 border-b border-white/10">
            Support
          </p>
          <MenuItem
            icon={FaQuestionCircle}
            label="Help & Support"
            onClick={() => setShowSupportFlow(true)}
          />
          <MenuItem
            icon={FaShieldAlt}
            label="Privacy Policy"
          />
          <MenuItem
            icon={FaInfoCircle}
            label="About FLYP"
          />
        </div>

        {/* Logout */}
        <div className="bg-white/5/50 backdrop-blur-xl rounded-xl border border-white/10/50 overflow-hidden">
          <MenuItem
            icon={FaSignOutAlt}
            label="Logout"
            onClick={handleLogout}
            danger
          />
        </div>

        {/* Version with Logo */}
        <div className="flex flex-col items-center py-6">
          <FlypLogo />
          <p className="text-xs text-white/40 mt-3">
            FLYP Customer App v1.0.0
          </p>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-24" />

      <SupportFlow
        isOpen={showSupportFlow}
        onClose={() => setShowSupportFlow(false)}
        preSelectedOrder={null}
      />
    </div>
  );
};

export default CustomerProfile;
