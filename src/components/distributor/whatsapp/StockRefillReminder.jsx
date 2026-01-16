/**
 * Stock Refill Reminder Component
 * Allows distributors to send WhatsApp reminders to retailers about low stock items
 */

import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { sendStockRefillReminder, sendBulkStockRefillReminder, getWhatsAppConfig, WHATSAPP_PROVIDERS } from '../../../services/whatsappService';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

const StockRefillReminder = () => {
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [retailers, setRetailers] = useState([]);
  const [selectedRetailers, setSelectedRetailers] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [threshold, setThreshold] = useState(10); // Default threshold

  const distributorId = auth.currentUser?.uid;

  useEffect(() => {
    if (!distributorId) return;

    // Fetch low stock products
    const productsRef = collection(db, 'businesses', distributorId, 'products');
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      const products = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((product) => {
          const stock = Number(product.quantity || 0);
          return stock > 0 && stock <= threshold;
        })
        .sort((a, b) => (a.quantity || 0) - (b.quantity || 0));

      setLowStockProducts(products);
      setLoading(false);
    });

    // Fetch connected retailers and enrich with phone numbers
    const retailersRef = collection(db, 'businesses', distributorId, 'connectedRetailers');
    getDocs(retailersRef).then(async (snapshot) => {
      const retailerPromises = snapshot.docs.map(async (retailerDoc) => {
        const data = retailerDoc.data();
        const retailerId = retailerDoc.id;
        
        // Try to get phone from connectedRetailers data first
        let phone = data.phone || data.retailerPhone || data.retailer?.phone || '';
        
        // If no phone in connectedRetailers, try fetching from retailer's main business document
        if (!phone && retailerId) {
          try {
            const retailerDocRef = doc(db, 'businesses', retailerId);
            const retailerDocSnap = await getDoc(retailerDocRef);
            if (retailerDocSnap.exists()) {
              const retailerData = retailerDocSnap.data();
              phone = retailerData.phone || retailerData.ownerPhone || '';
            }
          } catch (err) {
            // Silent fail - phone might not be accessible (permission issues)
            console.warn('Could not fetch phone from retailer document:', err);
          }
        }
        
        return {
          id: retailerId,
          ...data,
          phone: phone,
          businessName: data.businessName || data.retailerName || data.retailer?.businessName || '',
          retailerName: data.retailerName || data.businessName || data.retailer?.retailerName || '',
        };
      });
      
      const retailerList = await Promise.all(retailerPromises);
      setRetailers(retailerList);
    }).catch((error) => {
      console.error('Error fetching retailers:', error);
      // Don't show error if it's just permission issue - retailers might still work
      if (error.code !== 'permission-denied') {
        toast.error('Failed to load retailers. Please refresh the page.');
      }
    });

    return () => unsubscribe();
  }, [distributorId, threshold]);

  const handleSendReminders = async () => {
    if (!distributorId) return;

    // Check WhatsApp configuration
    const config = await getWhatsAppConfig(distributorId);
    if (!config || !config.enabled) {
      toast.warning('WhatsApp Business API is not configured. Please set it up in Profile Settings.');
      return;
    }

    if (selectedProducts.size === 0 || selectedRetailers.size === 0) {
      toast.error('Please select at least one product and one retailer');
      return;
    }

    // Check for retailers with phone numbers
    const retailersWithPhone = retailers.filter(
      (r) => selectedRetailers.has(r.id) && r.phone
    );
    const retailersWithoutPhone = retailers.filter(
      (r) => selectedRetailers.has(r.id) && !r.phone
    );

    if (retailersWithoutPhone.length > 0 && retailersWithPhone.length === 0) {
      toast.error(
        `❌ None of the selected retailers have phone numbers. Please add phone numbers to retailers first.`
      );
      return;
    }

    if (retailersWithoutPhone.length > 0) {
      toast.warning(
        `⚠️ ${retailersWithoutPhone.length} retailer(s) don't have phone numbers. They will be skipped.`
      );
    }

    setSending(true);
    let successCount = 0;
    let failCount = 0;
    const openedLinks = [];

    try {
      // Get all selected products
      const selectedProductsList = Array.from(selectedProducts)
        .map(id => lowStockProducts.find(p => p.id === id))
        .filter(p => p);

      if (selectedProductsList.length === 0) {
        toast.error('No products selected');
        setSending(false);
        return;
      }

      // Send bulk message to each retailer (all products in one message)
      for (const retailerId of selectedRetailers) {
        const retailer = retailers.find((r) => r.id === retailerId);
        if (!retailer || !retailer.phone) {
          failCount++;
          continue;
        }

        try {
          // Use bulk function to send all selected products in one message
          const result = await sendBulkStockRefillReminder(
            distributorId,
            selectedProductsList,
            retailer.phone,
            retailer.businessName || retailer.retailerName
          );
          
          // For Direct Link mode, open WhatsApp Web
          if (result.method === 'direct' || result.method === 'direct_fallback') {
            if (result.link) {
              openedLinks.push({ 
                link: result.link, 
                retailer: retailer.businessName || retailer.retailerName,
                productCount: selectedProductsList.length
              });
            }
          }
          
          successCount++;
        } catch (error) {
          console.error('Error sending reminder:', error);
          failCount++;
        }
      }

      // Open WhatsApp Web links for Direct Link mode
      if (openedLinks.length > 0 && config.provider === WHATSAPP_PROVIDERS.DIRECT) {
        // Open first link immediately
        if (openedLinks[0].link) {
          window.open(openedLinks[0].link, '_blank');
        }
        
        // Show message about remaining links
        if (openedLinks.length > 1) {
          toast.info(
            `📱 WhatsApp Web opened! ${openedLinks.length - 1} more message(s) will open in new tabs. Each message contains ${selectedProductsList.length} product(s). Please send each one.`,
            { autoClose: 5000 }
          );
          
          // Open remaining links with delay to avoid popup blocker
          openedLinks.slice(1).forEach((item, index) => {
            setTimeout(() => {
              if (item.link) {
                window.open(item.link, '_blank');
              }
            }, (index + 1) * 1000);
          });
        } else {
          toast.success(`📱 WhatsApp Web opened! Message contains ${selectedProductsList.length} product(s). Please click "Send" to send the reminder.`);
        }
      } else if (successCount > 0) {
        toast.success(`✅ Successfully sent ${successCount} reminder(s) to ${successCount} retailer(s)! Each message contained ${selectedProductsList.length} product(s).`);
      }

      if (failCount > 0) {
        const failReason = retailersWithoutPhone.length > 0 
          ? `${failCount} reminder(s) failed - retailers missing phone numbers`
          : `Failed to send ${failCount} reminder(s)`;
        toast.warning(`⚠️ ${failReason}`);
      }

      // Clear selections
      setSelectedProducts(new Set());
      setSelectedRetailers(new Set());
    } catch (error) {
      console.error('Error sending reminders:', error);
      toast.error(`❌ Failed to send reminders: ${error.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  const toggleProduct = (productId) => {
    const newSet = new Set(selectedProducts);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    setSelectedProducts(newSet);
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

  if (loading) {
    return (
      <div className="p-6 text-white">
        <div className="animate-pulse">Loading stock data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 text-white space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-400">
            📦 Stock Refill Reminders
          </h2>
          <p className="text-gray-400">
            Send bulk WhatsApp reminders to retailers about low stock items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {selectedProducts.size} products • {selectedRetailers.size} retailers
          </span>
        </div>
      </div>

      {/* Threshold Setting */}
      <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Low Stock Threshold</h3>
            <p className="text-sm text-gray-400">Set the minimum stock level to trigger reminders</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 0)}
              min="1"
              className="w-24 bg-slate-700/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center font-semibold"
            />
            <span className="text-gray-400">units</span>
          </div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
          <p className="text-sm text-emerald-300">
            📊 <strong>{lowStockProducts.length}</strong> products found with stock ≤ {threshold} units
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Products List */}
        <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-emerald-300 flex items-center gap-2">
              <span>📦</span>
              Low Stock Products
            </h3>
            <span className="text-sm bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full">
              {lowStockProducts.length} items
            </span>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-gray-400">No low stock products found</p>
            ) : (
              lowStockProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => toggleProduct(product.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedProducts.has(product.id)
                      ? 'bg-emerald-500/20 border-emerald-500/50'
                      : 'bg-slate-800/60 border-white/10 hover:bg-slate-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{product.name || 'Unnamed Product'}</p>
                      <p className="text-xs text-gray-400">
                        Stock: {product.quantity || 0} {product.unit || 'units'}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.id)}
                      onChange={() => {}}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Retailers List */}
        <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-blue-300 flex items-center gap-2">
              <span>👥</span>
              Connected Retailers
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full">
                {retailers.length} total
              </span>
              {retailers.filter(r => !r.phone).length > 0 && (
                <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-1 rounded-full">
                  ⚠️ {retailers.filter(r => !r.phone).length} without phone
                </span>
              )}
            </div>
          </div>
          
          {retailers.filter(r => !r.phone).length > 0 && (
            <div className="mb-3 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm text-amber-200 font-medium mb-1">
                    {retailers.filter(r => !r.phone).length} retailer(s) missing phone numbers
                  </p>
                  <p className="text-xs text-amber-300 mb-2">
                    They won't receive WhatsApp messages. Add phone numbers to enable sending.
                  </p>
                  <a
                    href="#/distributor-dashboard?tab=retailerRequests"
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    → Go to Retailer Panel to add phone numbers
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {retailers.length === 0 ? (
              <p className="text-sm text-gray-400">No connected retailers found</p>
            ) : (
              retailers.map((retailer) => {
                const hasPhone = !!retailer.phone;
                return (
                  <div
                    key={retailer.id}
                    onClick={() => hasPhone && toggleRetailer(retailer.id)}
                    className={`p-3 rounded-lg border transition-all ${
                      !hasPhone
                        ? 'opacity-60 cursor-not-allowed bg-slate-800/40 border-red-500/30'
                        : selectedRetailers.has(retailer.id)
                        ? 'bg-blue-500/20 border-blue-500/50 cursor-pointer'
                        : 'bg-slate-800/60 border-white/10 hover:bg-slate-700/60 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {retailer.businessName || retailer.retailerName || 'Retailer'}
                          </p>
                          {!hasPhone && (
                            <span className="text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded">
                              No Phone
                            </span>
                          )}
                        </div>
                        <p className={`text-xs ${hasPhone ? 'text-gray-400' : 'text-red-400'}`}>
                          {retailer.phone || '❌ Phone number required'}
                        </p>
                      </div>
                      {hasPhone && (
                        <input
                          type="checkbox"
                          checked={selectedRetailers.has(retailer.id)}
                          onChange={() => {}}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                      )}
                      {!hasPhone && (
                        <span className="text-xs text-red-400">⚠️</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Send Button Section */}
      <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
        {(() => {
          const retailersWithPhone = retailers.filter(
            (r) => selectedRetailers.has(r.id) && r.phone
          );
          const totalMessages = retailersWithPhone.length;
          const retailersWithoutPhone = retailers.filter(
            (r) => selectedRetailers.has(r.id) && !r.phone
          );
          
          return (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-300">{selectedProducts.size}</p>
                  <p className="text-xs text-gray-400">Products Selected</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-300">{retailersWithPhone.length}</p>
                  <p className="text-xs text-gray-400">Retailers Ready</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-purple-300">{totalMessages}</p>
                  <p className="text-xs text-gray-400">Messages to Send</p>
                </div>
              </div>

              {retailersWithoutPhone.length > 0 && (
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-sm text-amber-300">
                    ⚠️ {retailersWithoutPhone.length} retailer(s) will be skipped (no phone number)
                  </p>
                </div>
              )}

              <button
                onClick={handleSendReminders}
                disabled={sending || selectedProducts.size === 0 || retailersWithPhone.length === 0}
                className="w-full px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 text-lg"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Sending Reminders...</span>
                  </>
                ) : totalMessages > 0 ? (
                  <>
                    <span>📤</span>
                    <span>Send {totalMessages} Reminder{totalMessages > 1 ? 's' : ''}</span>
                  </>
                ) : (
                  <>
                    <span>📦</span>
                    <span>Select Products & Retailers</span>
                  </>
                )}
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default StockRefillReminder;

