/**
 * WhatsApp Business Hub - Professional Edition
 * Clean, demo-ready interface for Meta App Review
 * Clearly shows Tech Provider value proposition
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, onSnapshot, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, auth, storage } from '../../../firebase/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getWhatsAppConfig, WHATSAPP_PROVIDERS, sendWhatsAppMessage } from '../../../services/whatsappService';
import StockRefillReminder from './StockRefillReminder';
import WhatsAppInbox from './WhatsAppInbox';
import WhatsAppCampaigns from './WhatsAppCampaigns';
import WhatsAppScheduler from './WhatsAppScheduler';
import MetaAPIFeatures from './MetaAPIFeatures';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const WhatsAppHub = () => {
  const navigate = useNavigate();
  
  // Shared State - Connects all tabs
  const [sharedState, setSharedState] = useState({
    selectedProducts: [],
    selectedRetailers: new Set(),
    currentMessage: '',
    messageImage: null,
    messageImageUrl: '',
    templateData: {},
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [whatsappConfig, setWhatsappConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [messageHistory, setMessageHistory] = useState([]);
  const [stats, setStats] = useState({ 
    sent: 0, 
    today: 0, 
    thisWeek: 0,
    byType: { stock: 0, promotional: 0, order: 0, payment: 0, catalog: 0 },
    successRate: 0
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);

  const distributorId = auth.currentUser?.uid;

  // Real-time product updates
  useEffect(() => {
    if (!distributorId) return;
    
    const productsRef = collection(db, 'businesses', distributorId, 'products');
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      const productsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        name: doc.data().productName || doc.data().name || 'Unnamed Product',
        price: doc.data().sellingPrice || doc.data().mrp || doc.data().price || 0,
        originalPrice: doc.data().sellingPrice || doc.data().mrp || doc.data().price || 0,
        imageUrl: doc.data().imageUrl || doc.data().image || null,
      }));
      setProducts(productsList);
      
      setSharedState(prev => ({
        ...prev,
        selectedProducts: prev.selectedProducts.map(selected => {
          const updated = productsList.find(p => p.id === selected.id);
          if (updated) {
            return {
              ...selected,
              ...updated,
              price: selected.customPrice !== undefined ? selected.customPrice : updated.price,
              originalPrice: updated.originalPrice,
            };
          }
          return selected;
        })
      }));
    });

    return () => unsubscribe();
  }, [distributorId]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      if (!distributorId) return;
      try {
        const config = await getWhatsAppConfig(distributorId);
        setWhatsappConfig(config);

        // Fetch retailers
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
        
        // Fetch message history for stats
        if (config?.enabled) {
          try {
            const messagesRef = collection(db, 'businesses', distributorId, 'whatsappMessages');
            const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(500));
            const snapshot = await getDocs(q);
            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessageHistory(messages);
            
            // Calculate stats
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            const sent = messages.filter(m => m.status === 'sent').length;
            const failed = messages.filter(m => m.status === 'failed').length;
            const total = sent + failed;
            
            const todayCount = messages.filter(m => {
              const msgDate = m.createdAt?.toDate?.() || new Date(m.createdAt || 0);
              return msgDate >= today && m.status === 'sent';
            }).length;
            
            const weekCount = messages.filter(m => {
              const msgDate = m.createdAt?.toDate?.() || new Date(m.createdAt || 0);
              return msgDate >= weekAgo && m.status === 'sent';
            }).length;
            
            const byType = {
              stock: messages.filter(m => m.messageType === 'stock_reminder' || m.messageType === 'bulk_stock_reminder').length,
              promotional: messages.filter(m => m.messageType === 'promotional').length,
              order: messages.filter(m => m.messageType === 'order_status_update').length,
              payment: messages.filter(m => m.messageType === 'payment_reminder').length,
              catalog: messages.filter(m => m.messageType === 'catalog' || m.messageType === 'product_share').length,
            };
            
            setStats({ 
              sent, 
              today: todayCount, 
              thisWeek: weekCount,
              byType,
              successRate: total > 0 ? Math.round((sent / total) * 100) : 0
            });
          } catch (err) {
            console.warn('Could not fetch message history:', err);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [distributorId]);

  // Handle image upload
  const handleImageUpload = async (file) => {
    if (!file) return;
    
    setUploadingImage(true);
    try {
      const imageRef = ref(storage, `whatsapp-images/${distributorId}/${Date.now()}_${file.name}`);
      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);
      setSharedState(prev => ({ ...prev, messageImageUrl: url, messageImage: file }));
      toast.success('✅ Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('❌ Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  // Update product price
  const updateProductPrice = (productId, newPrice, discountPercent = null) => {
    setSharedState(prev => ({
      ...prev,
      selectedProducts: prev.selectedProducts.map(p => 
        p.id === productId 
          ? { ...p, customPrice: newPrice, discountPercent, price: newPrice }
          : p
      )
    }));
  };

  // Generate catalog message with images
  const generateCatalogMessage = useCallback(async () => {
    if (sharedState.selectedProducts.length === 0) return '';
    
    const businessDoc = doc(db, 'businesses', distributorId);
    const businessSnap = await getDoc(businessDoc);
    const businessData = businessSnap.data();
    const businessName = businessData?.businessName || 'Our Store';
    
    let message = `📦 *Product Catalog*\n\n`;
    message += `Hello!\n\n`;
    message += `Here are our featured products:\n\n`;
    
    sharedState.selectedProducts.forEach((product, index) => {
      message += `${index + 1}. *${product.name}*\n`;
      if (product.brand) message += `   Brand: ${product.brand}\n`;
      
      if (product.price) {
        if (product.discountPercent && product.originalPrice) {
          message += `   Price: ₹${product.price} (${product.discountPercent}% OFF)\n`;
          message += `   ~~Was: ₹${product.originalPrice}~~\n`;
        } else {
          message += `   Price: ₹${product.price}\n`;
        }
      }
      if (product.quantity !== undefined) message += `   Stock: ${product.quantity} ${product.unit || 'units'}\n`;
      message += `\n`;
    });
    
    if (sharedState.messageImageUrl) {
      message += `\n📷 [View Image: ${sharedState.messageImageUrl}]\n\n`;
    }
    
    message += `💡 Interested in any product? Reply to this message to place your order!\n\n`;
    message += `– ${businessName}\n`;
    message += `_Powered by FLYP_`;
    
    setSharedState(prev => ({ ...prev, currentMessage: message }));
    return message;
  }, [sharedState.selectedProducts, sharedState.messageImageUrl, distributorId]);

  // Generate promotional message
  const generatePromotionalMessage = useCallback(async (offer) => {
    const businessDoc = doc(db, 'businesses', distributorId);
    const businessSnap = await getDoc(businessDoc);
    const businessData = businessSnap.data();
    const businessName = businessData?.businessName || 'Our Store';
    
    let message = `🎉 *Special Offer!*\n\n`;
    
    if (offer.title) message += `*${offer.title}*\n\n`;
    if (offer.description) message += `${offer.description}\n\n`;
    
    if (sharedState.selectedProducts.length > 0) {
      message += `📦 *Featured Products:*\n`;
      sharedState.selectedProducts.forEach((product, index) => {
        message += `${index + 1}. *${product.name}*`;
        if (product.price) {
          if (product.discountPercent && product.originalPrice) {
            message += ` - ₹${product.price} (${product.discountPercent}% OFF)`;
            message += ` ~~Was ₹${product.originalPrice}~~`;
          } else {
            message += ` - ₹${product.price}`;
          }
        }
        message += `\n`;
      });
      message += `\n`;
    }
    
    if (offer.discount) message += `💰 *Discount:* ${offer.discount}\n`;
    if (offer.validUntil) message += `📅 *Valid Until:* ${offer.validUntil}\n`;
    if (offer.terms) message += `\n${offer.terms}\n`;
    
    if (sharedState.messageImageUrl) {
      message += `\n📷 [View Image: ${sharedState.messageImageUrl}]\n\n`;
    }
    
    message += `\nDon't miss out on this amazing deal!\n\n`;
    message += `– ${businessName}\n`;
    message += `_Powered by FLYP_`;
    
    setSharedState(prev => ({ ...prev, currentMessage: message }));
    return message;
  }, [sharedState.selectedProducts, sharedState.messageImageUrl, distributorId]);

  // Log message to history
  const logMessageToHistory = async (to, message, status, metadata = {}) => {
    try {
      const messagesRef = collection(db, 'businesses', distributorId, 'whatsappMessages');
      await addDoc(messagesRef, {
        to,
        message,
        status,
        method: whatsappConfig?.provider || 'direct',
        messageType: metadata.messageType || 'general',
        createdAt: serverTimestamp(),
        metadata: {
          ...metadata,
          imageUrl: sharedState.messageImageUrl || null,
          productIds: sharedState.selectedProducts.map(p => p.id),
          productCount: sharedState.selectedProducts.length,
          retailerCount: sharedState.selectedRetailers.size,
        },
      });
    } catch (error) {
      console.error('Error logging message to history:', error);
    }
  };

  // Send message to selected retailers
  const handleSendMessage = async () => {
    if (!distributorId) return;
    if (sharedState.selectedRetailers.size === 0) {
      toast.error('Please select at least one retailer');
      return;
    }
    if (!sharedState.currentMessage.trim()) {
      toast.error('Please compose a message');
      return;
    }

    const config = await getWhatsAppConfig(distributorId);
    if (!config || !config.enabled) {
      toast.warning('WhatsApp not configured. Please set it up in Profile Settings.');
      return;
    }

    const retailersToSend = retailers.filter(r => 
      sharedState.selectedRetailers.has(r.id) && r.phone
    );

    if (retailersToSend.length === 0) {
      toast.error('No retailers with phone numbers selected');
      return;
    }

    setSending(true);

    let finalMessage = sharedState.currentMessage;
    
    if (config.provider === WHATSAPP_PROVIDERS.DIRECT && sharedState.messageImageUrl && !finalMessage.includes(sharedState.messageImageUrl)) {
      finalMessage += `\n\n📷 Image: ${sharedState.messageImageUrl}`;
    }

    const openedLinks = [];
    let successCount = 0;
    let failCount = 0;

    for (const retailer of retailersToSend) {
      try {
        const result = await sendWhatsAppMessage(
          distributorId,
          retailer.phone,
          finalMessage,
          {
            messageType: sharedState.selectedProducts.length > 0 ? 'catalog' : 'promotional',
            metadata: {
              productIds: sharedState.selectedProducts.map(p => p.id),
              imageUrl: sharedState.messageImageUrl,
              documentUrl: null,
              filename: null,
              retailerId: retailer.id,
              retailerName: retailer.businessName,
            },
            logMessage: true,
          }
        );

        await logMessageToHistory(
          retailer.phone,
          finalMessage,
          result.success ? 'sent' : 'failed',
          {
            messageType: sharedState.selectedProducts.length > 0 ? 'catalog' : 'promotional',
            retailerId: retailer.id,
            retailerName: retailer.businessName,
            productIds: sharedState.selectedProducts.map(p => p.id),
            imageUrl: sharedState.messageImageUrl,
          }
        );

        if (result.method === 'direct' || result.method === 'direct_fallback') {
          if (result.link) {
            openedLinks.push({ link: result.link, retailer: retailer.businessName });
          }
        }
        successCount++;
      } catch (error) {
        console.error('Error sending message:', error);
        await logMessageToHistory(
          retailer.phone,
          finalMessage,
          'failed',
          {
            messageType: sharedState.selectedProducts.length > 0 ? 'catalog' : 'promotional',
            error: error.message,
          }
        );
        failCount++;
      }
    }

    if (openedLinks.length > 0 && config.provider === WHATSAPP_PROVIDERS.DIRECT) {
      openedLinks.forEach((item, index) => {
        setTimeout(() => {
          if (item.link) {
            window.open(item.link, '_blank');
          }
        }, index * 1000);
      });
      toast.success(`📱 Opening WhatsApp Web for ${openedLinks.length} retailer(s). Please send each message!`);
    } else if (successCount > 0) {
      toast.success(`✅ Successfully sent to ${successCount} retailer(s)!`);
    }

    if (failCount > 0) {
      toast.warning(`⚠️ Failed to send to ${failCount} retailer(s)`);
    }

    try {
      const messagesRef = collection(db, 'businesses', distributorId, 'whatsappMessages');
      const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessageHistory(messages);
    } catch (err) {
      console.warn('Could not refresh message history:', err);
    }

    if (successCount > 0) {
      setSharedState({
        selectedProducts: [],
        selectedRetailers: new Set(),
        currentMessage: '',
        messageImage: null,
        messageImageUrl: '',
        templateData: {},
      });
      setActiveTab('overview');
    }
    
    setSending(false);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊', description: 'Dashboard & stats' },
    { id: 'send', label: 'Send Message', icon: '📤', description: 'Compose & send' },
    { id: 'inbox', label: 'Inbox', icon: '💬', description: 'Two-way messaging' },
    { id: 'campaigns', label: 'Campaigns', icon: '📈', description: 'Campaign management' },
    { id: 'schedule', label: 'Schedule', icon: '⏰', description: 'Smart scheduling' },
    { id: 'history', label: 'History', icon: '📜', description: 'Message history' },
    { id: 'features', label: 'Features', icon: '🚀', description: 'API features' },
  ];

  const isEnabled = whatsappConfig?.enabled;
  const isTechProvider = whatsappConfig?.provider === WHATSAPP_PROVIDERS.META_TECH_PROVIDER;

  if (loading) {
    return (
      <div className="p-6 text-white">
        <div className="animate-pulse">Loading WhatsApp Hub...</div>
      </div>
    );
  }

  return (
    <div className="p-6 text-white min-h-screen">
      {/* Hero Section - Value Proposition for App Review */}
      <div className="mb-8">
        <div className="bg-gradient-to-br from-emerald-900/40 via-teal-900/30 to-cyan-900/40 rounded-2xl p-8 border-2 border-emerald-500/50 shadow-2xl">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-green-400 to-teal-400">
                💬 WhatsApp Business Hub
              </h1>
              <p className="text-lg text-gray-300 mb-4">
                Connect with your retailers instantly. Send product catalogs, order updates, and promotional messages - all from one place.
              </p>
              
              {/* Value Proposition for Tech Provider */}
              {isTechProvider && (
                <div className="bg-emerald-900/30 rounded-xl p-4 border border-emerald-500/30 mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">🚀</span>
                    <p className="font-semibold text-emerald-300">Tech Provider Mode Active</p>
      </div>
                  <p className="text-sm text-gray-300">
                    Your WhatsApp Business Account is managed centrally, enabling seamless messaging without complex setup.
                  </p>
                </div>
              )}

              {/* Status Badge */}
      {isEnabled ? (
            <div className="flex items-center gap-3">
                  <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 rounded-lg">
                    <p className="text-sm font-semibold text-emerald-300">✅ WhatsApp Enabled</p>
              </div>
                  <div className="px-4 py-2 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                    <p className="text-sm font-semibold text-blue-300">
                      {isTechProvider 
                        ? '🚀 Tech Provider Mode' 
                        : whatsappConfig?.provider === WHATSAPP_PROVIDERS.META
                        ? '⚡ Meta API Mode'
                        : '📱 Simple Mode'}
                    </p>
          </div>
        </div>
      ) : (
                <div className="mt-4">
                  <button
                    onClick={() => navigate('/distributor-dashboard?tab=profile&section=whatsapp')}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg transform transition-all hover:scale-105"
                  >
                    🚀 Set Up WhatsApp Business API
                  </button>
        </div>
      )}
            </div>

            {/* Quick Stats */}
      {isEnabled && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900/60 rounded-xl p-4 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-emerald-400">{stats.sent}</p>
                  <p className="text-xs text-gray-400 mt-1">Total Sent</p>
          </div>
                <div className="bg-slate-900/60 rounded-xl p-4 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-emerald-400">{stats.today}</p>
                  <p className="text-xs text-gray-400 mt-1">Today</p>
          </div>
                <div className="bg-slate-900/60 rounded-xl p-4 border border-white/10 text-center">
                  <p className="text-3xl font-bold text-emerald-400">{stats.successRate}%</p>
                  <p className="text-xs text-gray-400 mt-1">Success Rate</p>
          </div>
        </div>
      )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-2 border-b border-white/10 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
            title={tab.description}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* OVERVIEW TAB - Dashboard */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {!isEnabled ? (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-8 text-center">
                  <div className="text-5xl mb-4">📱</div>
                  <h3 className="text-2xl font-bold text-white mb-2">Get Started with WhatsApp Business</h3>
                  <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                    Connect your WhatsApp Business account to start sending automated messages, track delivery status, 
                    and manage two-way conversations with your retailers - all from one platform.
                  </p>
                        <button
                    onClick={() => navigate('/distributor-dashboard?tab=profile&section=whatsapp')}
                    className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg transform transition-all hover:scale-105"
                  >
                    🚀 Set Up WhatsApp Business API
                        </button>
                      </div>
              ) : (
                <>
                  {/* Stats Grid */}
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
                      <div className="text-3xl mb-2">📤</div>
                      <p className="text-2xl font-bold text-white">{stats.sent}</p>
                      <p className="text-sm text-gray-400">Messages Sent</p>
                        </div>
                    <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
                      <div className="text-3xl mb-2">✅</div>
                      <p className="text-2xl font-bold text-emerald-400">{stats.successRate}%</p>
                      <p className="text-sm text-gray-400">Success Rate</p>
                    </div>
                    <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
                      <div className="text-3xl mb-2">📅</div>
                      <p className="text-2xl font-bold text-blue-400">{stats.today}</p>
                      <p className="text-sm text-gray-400">Sent Today</p>
              </div>
                    <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
                      <div className="text-3xl mb-2">📊</div>
                      <p className="text-2xl font-bold text-purple-400">{stats.thisWeek}</p>
                      <p className="text-sm text-gray-400">This Week</p>
                </div>
            </div>

                  {/* Message Types Breakdown */}
                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
                    <h3 className="text-xl font-semibold mb-4">Message Types</h3>
                    <div className="grid md:grid-cols-5 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-400">{stats.byType.catalog}</p>
                        <p className="text-sm text-gray-400">Catalogs</p>
                    </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-400">{stats.byType.promotional}</p>
                        <p className="text-sm text-gray-400">Promotional</p>
                    </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-400">{stats.byType.order}</p>
                        <p className="text-sm text-gray-400">Order Updates</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-400">{stats.byType.stock}</p>
                        <p className="text-sm text-gray-400">Stock Reminders</p>
                  </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-cyan-400">{stats.byType.payment}</p>
                        <p className="text-sm text-gray-400">Payment</p>
                </div>
                  </div>
                </div>

                  {/* Quick Actions */}
                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
                    <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                    <button
                        onClick={() => setActiveTab('send')}
                        className="p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/30 transition-colors text-left"
                    >
                        <div className="text-2xl mb-2">📤</div>
                        <p className="font-semibold">Send Message</p>
                        <p className="text-sm text-gray-400">Compose and send to retailers</p>
                    </button>
                <button
                        onClick={() => setActiveTab('inbox')}
                        className="p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg hover:bg-blue-500/30 transition-colors text-left"
                      >
                        <div className="text-2xl mb-2">💬</div>
                        <p className="font-semibold">View Inbox</p>
                        <p className="text-sm text-gray-400">Check received messages</p>
                </button>
                  <button
                        onClick={() => setActiveTab('campaigns')}
                        className="p-4 bg-purple-500/20 border border-purple-500/50 rounded-lg hover:bg-purple-500/30 transition-colors text-left"
                      >
                        <div className="text-2xl mb-2">📈</div>
                        <p className="font-semibold">Create Campaign</p>
                        <p className="text-sm text-gray-400">Launch promotional campaigns</p>
                  </button>
                        </div>
                        </div>
                </>
              )}
                        </div>
          )}

          {/* SEND MESSAGE TAB - With Catalog & Product Selection */}
          {activeTab === 'send' && isEnabled && (
            <div className="space-y-6">
              <div className="bg-slate-900/80 border border-white/10 rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-4">📤 Send Message</h3>
                <p className="text-gray-400 mb-4">
                  Compose a message and send it to your connected retailers. You can include products, images, and promotional offers.
                </p>
                
                <div className="space-y-4">
                  {/* Select Retailers */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Select Retailers</label>
                    <div className="max-h-40 overflow-y-auto border border-white/10 rounded-lg p-2 bg-slate-800/40">
                      {retailers.length === 0 ? (
                        <p className="text-sm text-gray-400 p-2">No retailers connected yet</p>
                      ) : (
                        retailers.map((retailer) => (
                          <label key={retailer.id} className="flex items-center gap-2 p-2 hover:bg-slate-700/30 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sharedState.selectedRetailers.has(retailer.id)}
                              onChange={(e) => {
                                const newSet = new Set(sharedState.selectedRetailers);
                                if (e.target.checked) {
                                  newSet.add(retailer.id);
                                } else {
                                  newSet.delete(retailer.id);
                                }
                                setSharedState(prev => ({ ...prev, selectedRetailers: newSet }));
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{retailer.businessName || retailer.retailerName || retailer.phone}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Select Products (Catalog) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Select Products (Optional - for Catalog)</label>
                    <div className="max-h-40 overflow-y-auto border border-white/10 rounded-lg p-2 bg-slate-800/40">
                      {products.length === 0 ? (
                        <p className="text-sm text-gray-400 p-2">No products available</p>
                      ) : (
                        products.slice(0, 20).map((product) => (
                          <label key={product.id} className="flex items-center gap-2 p-2 hover:bg-slate-700/30 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sharedState.selectedProducts.some(p => p.id === product.id)}
                              onChange={(e) => {
                                let newProducts = [...sharedState.selectedProducts];
                                if (e.target.checked) {
                                  newProducts.push(product);
                                } else {
                                  newProducts = newProducts.filter(p => p.id !== product.id);
                                }
                                setSharedState(prev => ({ ...prev, selectedProducts: newProducts }));
                              }}
                              className="rounded"
                            />
                            <span className="text-sm flex-1">{product.name}</span>
                            {product.price && (
                              <span className="text-xs text-gray-400">₹{product.price}</span>
                            )}
                          </label>
                        ))
                      )}
                    </div>
                    {sharedState.selectedProducts.length > 0 && (
                      <button
                        onClick={generateCatalogMessage}
                        className="mt-2 text-sm text-emerald-400 hover:text-emerald-300"
                      >
                        📦 Generate Catalog Message ({sharedState.selectedProducts.length} products)
                      </button>
                    )}
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Image (Optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                      className="text-sm text-gray-300"
                    />
                    {sharedState.messageImageUrl && (
                      <div className="mt-2">
                        <img src={sharedState.messageImageUrl} alt="Preview" className="max-w-xs rounded-lg" />
                        <button
                          onClick={() => setSharedState(prev => ({ ...prev, messageImageUrl: '', messageImage: null }))}
                          className="text-xs text-red-400 hover:text-red-300 mt-1"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Message Text */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                    <textarea
                      value={sharedState.currentMessage}
                      onChange={(e) => setSharedState(prev => ({ ...prev, currentMessage: e.target.value }))}
                      placeholder="Type your message here... (or generate catalog message above)"
                      rows={6}
                      className="w-full bg-slate-800/60 border border-white/10 text-white placeholder-gray-400 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={generateCatalogMessage}
                      disabled={sharedState.selectedProducts.length === 0}
                      className="px-4 py-2 bg-blue-600/20 border border-blue-500/50 text-blue-300 rounded-lg hover:bg-blue-600/30 disabled:opacity-50 text-sm"
                    >
                      📦 Generate Catalog
                    </button>
                    <button
                      onClick={() => {
                        const offer = {
                          title: "Special Offer!",
                          description: "Get amazing discounts on selected products",
                          discount: "Up to 20% OFF",
                          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
                        };
                        generatePromotionalMessage(offer);
                      }}
                      className="px-4 py-2 bg-purple-600/20 border border-purple-500/50 text-purple-300 rounded-lg hover:bg-purple-600/30 text-sm"
                    >
                      🎉 Generate Promo
                    </button>
                  </div>

                  {/* Send Button */}
                  <div className="flex gap-4">
                    <button
                      onClick={handleSendMessage}
                      disabled={sending || !sharedState.currentMessage.trim() || sharedState.selectedRetailers.size === 0}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg transform transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? 'Sending...' : `📤 Send to ${sharedState.selectedRetailers.size} Retailer(s)`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other tabs */}
          {activeTab === 'inbox' && <WhatsAppInbox />}
          {activeTab === 'campaigns' && <WhatsAppCampaigns />}
          {activeTab === 'schedule' && <WhatsAppScheduler />}
          {activeTab === 'history' && (
            <div className="space-y-4">
                <h3 className="text-xl font-semibold">📜 Message History</h3>
              {messageHistory.length === 0 ? (
                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-8 text-center">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-gray-400">No messages sent yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {messageHistory.slice(0, 20).map((msg) => (
                    <div key={msg.id} className="bg-slate-900/80 border border-white/10 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-gray-300 mb-1">{msg.message?.substring(0, 100)}...</p>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span>To: {msg.to}</span>
                            <span>•</span>
                            <span>{msg.createdAt?.toDate?.()?.toLocaleString() || new Date(msg.createdAt || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          msg.status === 'sent' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                        }`}>
                          {msg.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                        </span>
                      </div>
                  </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'features' && <MetaAPIFeatures />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default WhatsAppHub;
