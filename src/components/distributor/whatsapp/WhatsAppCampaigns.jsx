/**
 * WhatsApp Campaigns - Smart Campaign Management
 * Create, track, and optimize message campaigns
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';

const WhatsAppCampaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [retailers, setRetailers] = useState([]);
  const [selectedRetailers, setSelectedRetailers] = useState(new Set());
  const [customPhoneNumbers, setCustomPhoneNumbers] = useState([]);
  const [customPhoneInput, setCustomPhoneInput] = useState('');
  const [customNameInput, setCustomNameInput] = useState('');
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    goal: 'engagement', // engagement, sales, awareness
    targetRetailers: 'selected', // all, selected, custom
    message: '',
    scheduledFor: '',
  });

  const distributorId = auth.currentUser?.uid;
  
  // Load retailers
  useEffect(() => {
    if (!distributorId) return;
    const loadRetailers = async () => {
      try {
        const retailersRef = collection(db, 'businesses', distributorId, 'connectedRetailers');
        const retailersSnap = await getDocs(retailersRef);
        const retailersList = retailersSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            phone: data.phone || data.retailerPhone || '',
            businessName: data.businessName || data.retailerName || '',
          };
        });
        setRetailers(retailersList);
      } catch (error) {
        console.error('Error loading retailers:', error);
      }
    };
    loadRetailers();
  }, [distributorId]);

  useEffect(() => {
    if (!distributorId) return;
    loadCampaigns();
  }, [distributorId]);

  const loadCampaigns = async () => {
    try {
      const campaignsRef = collection(db, 'businesses', distributorId, 'whatsappCampaigns');
      const q = query(campaignsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const campaignsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCampaigns(campaignsList);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  const handleCreateCampaign = async () => {
    if (!newCampaign.name || !newCampaign.message) {
      toast.error('Please fill in campaign name and message');
      return;
    }
    
    // Validate recipients
    if (newCampaign.targetRetailers === 'selected' && selectedRetailers.size === 0 && customPhoneNumbers.length === 0) {
      toast.error('Please select at least one retailer or enter a phone number');
      return;
    }

    try {
      // Get selected retailer IDs and custom phone numbers
      const selectedRetailerIds = Array.from(selectedRetailers);
      const recipients = {
        retailerIds: selectedRetailerIds,
        customPhoneNumbers: customPhoneNumbers.map(c => ({ phone: c.phone, name: c.name }))
      };

      const campaignsRef = collection(db, 'businesses', distributorId, 'whatsappCampaigns');
      await addDoc(campaignsRef, {
        ...newCampaign,
        recipients,
        status: 'draft',
        sent: 0,
        delivered: 0,
        opened: 0,
        converted: 0,
        createdAt: serverTimestamp(),
      });

      toast.success('Campaign created!');
      setShowCreateModal(false);
      setNewCampaign({
        name: '',
        goal: 'engagement',
        targetRetailers: 'selected',
        message: '',
        scheduledFor: '',
      });
      setSelectedRetailers(new Set());
      setCustomPhoneNumbers([]);
      setCustomPhoneInput('');
      setCustomNameInput('');
      loadCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold mb-1">📊 Campaign Management</h3>
          <p className="text-sm text-gray-400">Create, track, and optimize message campaigns</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
        >
          + Create Campaign
        </button>
      </div>

      {/* Campaigns List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">{campaign.name}</h4>
              <span className={`text-xs px-2 py-1 rounded-full ${
                campaign.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' :
                campaign.status === 'completed' ? 'bg-blue-500/20 text-blue-300' :
                'bg-gray-500/20 text-gray-300'
              }`}>
                {campaign.status}
              </span>
            </div>
            <p className="text-sm text-gray-400 mb-4 line-clamp-2">{campaign.message}</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Sent:</span>
                <span className="text-white">{campaign.sent || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Delivered:</span>
                <span className="text-white">{campaign.delivered || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Opened:</span>
                <span className="text-emerald-400">{campaign.opened || 0}</span>
              </div>
              {campaign.goal === 'sales' && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Converted:</span>
                  <span className="text-purple-400">{campaign.converted || 0}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {campaigns.length === 0 && (
        <div className="text-center py-12 bg-slate-900/80 rounded-xl border border-white/10">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-400">No campaigns yet</p>
          <p className="text-sm text-gray-500 mt-2">Create your first campaign to get started</p>
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-white/10 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-semibold mb-4">Create New Campaign</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="w-full bg-slate-800/60 border border-white/10 text-white px-3 py-2 rounded"
                  placeholder="e.g., Diwali Sale 2025"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Campaign Goal</label>
                <select
                  value={newCampaign.goal}
                  onChange={(e) => setNewCampaign({ ...newCampaign, goal: e.target.value })}
                  className="w-full bg-slate-800/60 border border-white/10 text-white px-3 py-2 rounded"
                >
                  <option value="engagement">Engagement</option>
                  <option value="sales">Sales</option>
                  <option value="awareness">Awareness</option>
                </select>
              </div>
              
              {/* Retailer Selection */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">Select Recipients</label>
                
                {/* Target Type Selection */}
                <select
                  value={newCampaign.targetRetailers}
                  onChange={(e) => setNewCampaign({ ...newCampaign, targetRetailers: e.target.value })}
                  className="w-full bg-slate-800/60 border border-white/10 text-white px-3 py-2 rounded mb-3"
                >
                  <option value="all">All Retailers</option>
                  <option value="selected">Selected Retailers / Custom Numbers</option>
                </select>
                
                {newCampaign.targetRetailers === 'selected' && (
                  <div className="space-y-3">
                    {/* Retailer Selection */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Connected Retailers:</p>
                      <div className="max-h-40 overflow-y-auto border border-white/10 rounded-lg p-2 bg-slate-800/40">
                        {retailers.length === 0 ? (
                          <p className="text-sm text-gray-400 p-2">No retailers connected yet</p>
                        ) : (
                          retailers.map((retailer) => (
                            <label key={retailer.id} className="flex items-center gap-2 p-2 hover:bg-slate-700/30 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedRetailers.has(retailer.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedRetailers);
                                  if (e.target.checked) {
                                    newSet.add(retailer.id);
                                  } else {
                                    newSet.delete(retailer.id);
                                  }
                                  setSelectedRetailers(newSet);
                                }}
                                className="rounded"
                              />
                              <span className="text-sm flex-1">{retailer.businessName || retailer.retailerName || retailer.phone}</span>
                              {retailer.phone && (
                                <span className="text-xs text-gray-400">{retailer.phone}</span>
                              )}
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                    
                    {/* Add Custom Phone Number */}
                    <div className="border-t border-white/10 pt-3">
                      <p className="text-xs text-gray-400 mb-2">Or Enter New Phone Number:</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Name (optional)"
                          value={customNameInput}
                          onChange={(e) => setCustomNameInput(e.target.value)}
                          className="flex-1 bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        />
                        <input
                          type="tel"
                          placeholder="+91XXXXXXXXXX"
                          value={customPhoneInput}
                          onChange={(e) => setCustomPhoneInput(e.target.value)}
                          className="flex-1 bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        />
                        <button
                          onClick={() => {
                            if (customPhoneInput.trim()) {
                              const phone = customPhoneInput.trim().replace(/[^0-9+]/g, '');
                              if (phone.length >= 10) {
                                const newCustom = {
                                  phone: phone.startsWith('+') ? phone : `+91${phone}`,
                                  name: customNameInput.trim() || 'Custom Contact',
                                  id: `custom_${Date.now()}`
                                };
                                setCustomPhoneNumbers([...customPhoneNumbers, newCustom]);
                                setCustomPhoneInput('');
                                setCustomNameInput('');
                                toast.success('Phone number added');
                              } else {
                                toast.error('Please enter a valid phone number');
                              }
                            }
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      
                      {/* Show Added Custom Numbers */}
                      {customPhoneNumbers.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {customPhoneNumbers.map((custom, idx) => (
                            <div key={custom.id} className="flex items-center justify-between bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-2">
                              <div className="flex-1">
                                <p className="text-sm text-white">{custom.name}</p>
                                <p className="text-xs text-gray-400">{custom.phone}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setCustomPhoneNumbers(customPhoneNumbers.filter((_, i) => i !== idx));
                                }}
                                className="text-red-400 hover:text-red-300 text-sm px-2"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm text-gray-300 mb-1">Message</label>
                <textarea
                  value={newCampaign.message}
                  onChange={(e) => setNewCampaign({ ...newCampaign, message: e.target.value })}
                  rows={6}
                  className="w-full bg-slate-800/60 border border-white/10 text-white px-3 py-2 rounded"
                  placeholder="Enter your campaign message..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Schedule For (Optional)</label>
                <input
                  type="datetime-local"
                  value={newCampaign.scheduledFor}
                  onChange={(e) => setNewCampaign({ ...newCampaign, scheduledFor: e.target.value })}
                  className="w-full bg-slate-800/60 border border-white/10 text-white px-3 py-2 rounded"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateCampaign}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
              >
                Create Campaign
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppCampaigns;

