/**
 * Promotional Broadcast Component
 * Allows distributors to send promotional offers via WhatsApp to multiple retailers
 */

import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { sendPromotionalOffer, getWhatsAppConfig } from '../../../services/whatsappService';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';

const PromotionalBroadcast = () => {
  const [retailers, setRetailers] = useState([]);
  const [selectedRetailers, setSelectedRetailers] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [offer, setOffer] = useState({
    title: '',
    description: '',
    discount: '',
    validUntil: '',
    terms: '',
  });
  const [pastOffers, setPastOffers] = useState([]);

  const distributorId = auth.currentUser?.uid;

  useEffect(() => {
    if (!distributorId) return;

    // Fetch connected retailers
    const retailersRef = collection(db, 'businesses', distributorId, 'connectedRetailers');
    getDocs(retailersRef).then((snapshot) => {
      const retailerList = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Map phone from various possible fields
          phone: data.phone || data.retailerPhone || data.retailer?.phone || '',
          businessName: data.businessName || data.retailerName || data.retailer?.businessName || '',
          retailerName: data.retailerName || data.businessName || data.retailer?.retailerName || '',
        };
      });
      setRetailers(retailerList);
      setLoading(false);
    }).catch((error) => {
      console.error('Error fetching retailers:', error);
      toast.error('Failed to load retailers. Please refresh the page.');
      setLoading(false);
    });

    // Fetch past offers
    const offersRef = collection(db, 'businesses', distributorId, 'whatsappOffers');
    getDocs(offersRef).then((snapshot) => {
      const offers = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return bTime - aTime;
        })
        .slice(0, 10); // Show last 10 offers
      setPastOffers(offers);
    });
  }, [distributorId]);

  const handleSendBroadcast = async () => {
    if (!distributorId) return;

    // Validate offer
    if (!offer.title || !offer.description) {
      toast.error('Please fill in offer title and description');
      return;
    }

    if (selectedRetailers.size === 0) {
      toast.error('Please select at least one retailer');
      return;
    }

    // Check WhatsApp configuration
    const config = await getWhatsAppConfig(distributorId);
    if (!config || !config.enabled) {
      toast.warning('WhatsApp Business API is not configured. Please set it up in Profile Settings.');
      return;
    }

    setSending(true);

    try {
      // Get phone numbers of selected retailers
      const phoneNumbers = retailers
        .filter((r) => selectedRetailers.has(r.id) && r.phone)
        .map((r) => r.phone);

      if (phoneNumbers.length === 0) {
        toast.error('No valid phone numbers found for selected retailers');
        setSending(false);
        return;
      }

      // Create offer object
      const offerData = {
        ...offer,
        id: `offer_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };

      // Send promotional offers
      const result = await sendPromotionalOffer(distributorId, phoneNumbers, offerData);

      // Save offer to Firestore
      const offersRef = collection(db, 'businesses', distributorId, 'whatsappOffers');
      await addDoc(offersRef, {
        ...offerData,
        sentTo: phoneNumbers.length,
        successful: result.successful,
        total: result.total,
        createdAt: serverTimestamp(),
      });

      toast.success(
        `Successfully sent to ${result.successful} out of ${result.total} retailers!`
      );

      // Reset form
      setOffer({
        title: '',
        description: '',
        discount: '',
        validUntil: '',
        terms: '',
      });
      setSelectedRetailers(new Set());
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast.error('Failed to send promotional broadcast');
    } finally {
      setSending(false);
    }
  };

  const toggleRetailer = (retailerId) => {
    const newSet = new Set(selectedRetailers);
    if (newSet.has(retailerId)) {
      newSet.delete(retailerId);
    } else {
      newSet.add(retailerId);
    }
    setSelectedRetailers(newSet);
  };

  const selectAll = () => {
    const allIds = new Set(retailers.filter((r) => r.phone).map((r) => r.id));
    setSelectedRetailers(allIds);
  };

  const deselectAll = () => {
    setSelectedRetailers(new Set());
  };

  if (loading) {
    return (
      <div className="p-6 text-white">
        <div className="animate-pulse">Loading retailers...</div>
      </div>
    );
  }

  return (
    <div className="p-6 text-white">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-pink-400">
          🎉 Promotional Broadcast
        </h2>
        <p className="text-sm text-gray-400">
          Send promotional offers and announcements to multiple retailers via WhatsApp
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Offer Form */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
            <h3 className="font-semibold mb-4 text-purple-300">Create Offer</h3>

            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-300">
                  Offer Title *
                </label>
                <input
                  type="text"
                  value={offer.title}
                  onChange={(e) => setOffer({ ...offer, title: e.target.value })}
                  placeholder="e.g., Diwali Special Discount"
                  className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-300">
                  Description *
                </label>
                <textarea
                  value={offer.description}
                  onChange={(e) => setOffer({ ...offer, description: e.target.value })}
                  placeholder="Describe your offer in detail..."
                  rows={4}
                  className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-300">
                    Discount
                  </label>
                  <input
                    type="text"
                    value={offer.discount}
                    onChange={(e) => setOffer({ ...offer, discount: e.target.value })}
                    placeholder="e.g., 20% OFF"
                    className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-300">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={offer.validUntil}
                    onChange={(e) => setOffer({ ...offer, validUntil: e.target.value })}
                    className="w-full bg-slate-800/60 border border-white/10 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-300">
                  Terms & Conditions
                </label>
                <textarea
                  value={offer.terms}
                  onChange={(e) => setOffer({ ...offer, terms: e.target.value })}
                  placeholder="Terms and conditions (optional)"
                  rows={2}
                  className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Retailers Selection */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-pink-300">
                Select Retailers ({selectedRetailers.size} selected)
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {retailers.length === 0 ? (
                <p className="text-sm text-gray-400">No connected retailers found</p>
              ) : (
                retailers.map((retailer) => (
                  <div
                    key={retailer.id}
                    onClick={() => retailer.phone && toggleRetailer(retailer.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      !retailer.phone
                        ? 'opacity-50 cursor-not-allowed'
                        : selectedRetailers.has(retailer.id)
                        ? 'bg-pink-500/20 border-pink-500/50'
                        : 'bg-slate-800/60 border-white/10 hover:bg-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">
                          {retailer.businessName || retailer.retailerName || 'Retailer'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {retailer.phone || 'No phone number'}
                        </p>
                      </div>
                      {retailer.phone && (
                        <input
                          type="checkbox"
                          checked={selectedRetailers.has(retailer.id)}
                          onChange={() => {}}
                          className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendBroadcast}
            disabled={sending || selectedRetailers.size === 0 || !offer.title || !offer.description}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>💬</span>
            {sending ? 'Sending...' : `Send to ${selectedRetailers.size} Retailer(s)`}
          </button>
        </div>
      </div>

      {/* Past Offers */}
      {pastOffers.length > 0 && (
        <div className="mt-6 bg-slate-900/80 border border-white/10 rounded-xl p-6">
          <h3 className="font-semibold mb-4 text-gray-300">Recent Offers</h3>
          <div className="space-y-2">
            {pastOffers.map((pastOffer) => (
              <div
                key={pastOffer.id}
                className="p-3 bg-slate-800/60 rounded-lg border border-white/10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{pastOffer.title}</p>
                    <p className="text-xs text-gray-400">
                      Sent to {pastOffer.successful || 0} retailers
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {pastOffer.createdAt?.toDate?.()?.toLocaleDateString() ||
                      new Date(pastOffer.createdAt || 0).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PromotionalBroadcast;

