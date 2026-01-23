/**
 * BotQuickSetup - One-Click Bot Activation
 * Simple, non-technical interface to enable WhatsApp bot automation
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, doc, getDoc, setDoc, addDoc, getDocs, 
  serverTimestamp, query, where, onSnapshot 
} from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';
import { 
  FaRobot, FaCheck, FaPlay, FaPause, FaRocket, FaMagic,
  FaComments, FaShoppingCart, FaBoxes, FaHeadset, FaChartLine,
  FaCog, FaToggleOn, FaToggleOff, FaCheckCircle, FaSpinner,
  FaLightbulb, FaWhatsapp, FaArrowRight
} from 'react-icons/fa';
import { HiSparkles, HiLightningBolt } from 'react-icons/hi';

// Default welcome flow template
const DEFAULT_WELCOME_FLOW = {
  name: 'Welcome Flow',
  description: 'Greets customers and shows main menu options',
  isActive: true,
  triggerKeywords: ['hi', 'hello', 'hey', 'start', 'menu', 'hii', 'hiii'],
  nodes: [
    {
      id: 'welcome_msg',
      type: 'message',
      text: 'Welcome to {business_name}! 👋\n\nHow can I help you today?'
    },
    {
      id: 'welcome_buttons',
      type: 'buttons',
      text: 'Please select an option:',
      buttons: [
        { label: '🛒 Browse Products', action: 'browse_products' },
        { label: '📦 My Orders', action: 'view_orders' },
        { label: '💬 Get Help', action: 'contact_support' }
      ]
    }
  ]
};

// Default order flow template
const DEFAULT_ORDER_FLOW = {
  name: 'Order Flow',
  description: 'Helps customers browse and order products',
  isActive: true,
  triggerKeywords: ['order', 'buy', 'purchase', 'products', 'catalog', 'browse'],
  nodes: [
    {
      id: 'order_msg',
      type: 'message',
      text: 'Let me help you place an order! 🛒'
    },
    {
      id: 'order_list',
      type: 'list',
      action: 'view_products',
      title: 'Our Products'
    }
  ]
};

// Default Order Bot config
const DEFAULT_ORDER_BOT_CONFIG = {
  enabled: true,
  welcomeMessage: "Welcome! 👋 I'm your order assistant. What would you like to do?",
  menuOptions: {
    browseProducts: { enabled: true, label: '🛒 Browse Products' },
    viewOrders: { enabled: true, label: '📦 My Orders' },
    trackOrder: { enabled: true, label: '🚚 Track Order' },
    support: { enabled: true, label: '💬 Contact Support' },
  },
  productDisplay: {
    showPrice: true,
    showStock: true,
    showImage: true,
    showDescription: true,
    maxProductsPerMessage: 5,
    groupByCategory: true,
  },
  orderSettings: {
    minOrderValue: 0,
    maxItemsPerOrder: 50,
    requireConfirmation: true,
    autoAssignOrderId: true,
    sendOrderConfirmation: true,
    sendStatusUpdates: true,
  },
  paymentSettings: {
    acceptCOD: true,
    acceptOnline: false,
    acceptCredit: false,
    creditLimit: 0,
    creditDays: 7,
  },
  messages: {
    orderConfirmed: "✅ Order #{order_id} confirmed!\n\nTotal: ₹{total}\nItems: {items_count}\n\nWe'll notify you when it's ready for delivery.",
    orderShipped: "🚚 Great news! Your order #{order_id} has been shipped.",
    orderDelivered: "🎉 Your order #{order_id} has been delivered!\n\nThank you for shopping with us.",
    outOfStock: "Sorry, {product_name} is currently out of stock.",
    cartEmpty: "Your cart is empty. Send 'Browse' to see our products.",
  },
};

const BotQuickSetup = () => {
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [botStatus, setBotStatus] = useState({
    isEnabled: false,
    hasWelcomeFlow: false,
    hasOrderFlow: false,
    orderBotEnabled: false,
    totalFlows: 0,
    activeFlows: 0,
  });
  const [stats, setStats] = useState({
    messagesHandled: 0,
    ordersReceived: 0,
    activeConversations: 0,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const distributorId = auth.currentUser?.uid;

  // Load bot status
  useEffect(() => {
    if (!distributorId) return;

    const loadStatus = async () => {
      try {
        // Check Order Bot config
        const orderBotRef = doc(db, 'businesses', distributorId, 'whatsappBot', 'orderConfig');
        const orderBotDoc = await getDoc(orderBotRef);
        const orderBotEnabled = orderBotDoc.exists() && orderBotDoc.data()?.enabled === true;

        // Check flows
        const flowsRef = collection(db, 'businesses', distributorId, 'whatsappFlows');
        const flowsSnapshot = await getDocs(flowsRef);
        const flows = flowsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const activeFlows = flows.filter(f => f.isActive);
        const hasWelcomeFlow = flows.some(f => 
          f.triggerKeywords?.some(k => ['hi', 'hello', 'start'].includes(k.toLowerCase()))
        );
        const hasOrderFlow = flows.some(f => 
          f.triggerKeywords?.some(k => ['order', 'buy', 'products'].includes(k.toLowerCase()))
        );

        setBotStatus({
          isEnabled: orderBotEnabled || activeFlows.length > 0,
          hasWelcomeFlow,
          hasOrderFlow,
          orderBotEnabled,
          totalFlows: flows.length,
          activeFlows: activeFlows.length,
        });

        // Load stats
        const ordersRef = collection(db, 'businesses', distributorId, 'whatsappOrders');
        const ordersSnapshot = await getDocs(ordersRef);
        
        const messagesRef = collection(db, 'businesses', distributorId, 'whatsappMessages');
        const messagesQuery = query(messagesRef, where('automated', '==', true));
        const messagesSnapshot = await getDocs(messagesQuery);

        const sessionsRef = collection(db, 'businesses', distributorId, 'whatsappSessions');
        const sessionsSnapshot = await getDocs(sessionsRef);

        setStats({
          messagesHandled: messagesSnapshot.size,
          ordersReceived: ordersSnapshot.size,
          activeConversations: sessionsSnapshot.size,
        });

        setLoading(false);
      } catch (error) {
        console.error('Error loading bot status:', error);
        setLoading(false);
      }
    };

    loadStatus();
  }, [distributorId]);

  // Enable bot with default configuration
  const handleEnableBot = async () => {
    if (!distributorId) return;
    setEnabling(true);

    try {
      // 1. Enable Order Bot with default config
      const orderBotRef = doc(db, 'businesses', distributorId, 'whatsappBot', 'orderConfig');
      await setDoc(orderBotRef, {
        ...DEFAULT_ORDER_BOT_CONFIG,
        enabled: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log('✅ Order Bot config created');

      // 2. Create Welcome Flow if it doesn't exist
      const flowsRef = collection(db, 'businesses', distributorId, 'whatsappFlows');
      const existingFlows = await getDocs(flowsRef);
      
      const hasWelcome = existingFlows.docs.some(doc => {
        const data = doc.data();
        return data.triggerKeywords?.some(k => ['hi', 'hello', 'start'].includes(k.toLowerCase()));
      });

      if (!hasWelcome) {
        await addDoc(flowsRef, {
          ...DEFAULT_WELCOME_FLOW,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('✅ Welcome Flow created');
      }

      // 3. Create Order Flow if it doesn't exist
      const hasOrder = existingFlows.docs.some(doc => {
        const data = doc.data();
        return data.triggerKeywords?.some(k => ['order', 'buy', 'products'].includes(k.toLowerCase()));
      });

      if (!hasOrder) {
        await addDoc(flowsRef, {
          ...DEFAULT_ORDER_FLOW,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('✅ Order Flow created');
      }

      // Update status
      setBotStatus(prev => ({
        ...prev,
        isEnabled: true,
        hasWelcomeFlow: true,
        hasOrderFlow: true,
        orderBotEnabled: true,
        activeFlows: prev.activeFlows + (hasWelcome ? 0 : 1) + (hasOrder ? 0 : 1),
        totalFlows: prev.totalFlows + (hasWelcome ? 0 : 1) + (hasOrder ? 0 : 1),
      }));

      toast.success('🤖 Bot enabled successfully! Your customers can now order via WhatsApp.');
    } catch (error) {
      console.error('Error enabling bot:', error);
      toast.error('Failed to enable bot. Please try again.');
    } finally {
      setEnabling(false);
    }
  };

  // Disable bot
  const handleDisableBot = async () => {
    if (!distributorId) return;
    
    try {
      const orderBotRef = doc(db, 'businesses', distributorId, 'whatsappBot', 'orderConfig');
      await setDoc(orderBotRef, { enabled: false, updatedAt: serverTimestamp() }, { merge: true });

      setBotStatus(prev => ({
        ...prev,
        isEnabled: false,
        orderBotEnabled: false,
      }));

      toast.info('Bot paused. Customers will not receive automated responses.');
    } catch (error) {
      console.error('Error disabling bot:', error);
      toast.error('Failed to disable bot.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00a884] to-[#075e54] flex items-center justify-center">
              <FaRobot className="text-white text-lg" />
            </div>
            Bot Quick Setup
          </h2>
          <p className="text-gray-400 mt-1">Enable automated WhatsApp ordering in one click</p>
        </div>
      </div>

      {/* Main Status Card */}
      <div className={`rounded-2xl border-2 p-8 transition-all ${
        botStatus.isEnabled 
          ? 'bg-gradient-to-br from-[#00a884]/20 to-[#075e54]/10 border-[#00a884]/50' 
          : 'bg-[#111b21] border-[#2a3942]'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
              botStatus.isEnabled 
                ? 'bg-[#00a884]/30' 
                : 'bg-[#2a3942]'
            }`}>
              <FaRobot className={`text-4xl ${botStatus.isEnabled ? 'text-[#00a884]' : 'text-[#8696a0]'}`} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold text-white">WhatsApp Order Bot</h3>
                {botStatus.isEnabled && (
                  <span className="px-3 py-1 bg-[#00a884]/20 text-[#00a884] text-sm font-medium rounded-full flex items-center gap-1">
                    <span className="w-2 h-2 bg-[#00a884] rounded-full animate-pulse" />
                    Active
                  </span>
                )}
              </div>
              <p className="text-[#8696a0] mt-1">
                {botStatus.isEnabled 
                  ? 'Your bot is active and responding to customer messages'
                  : 'Enable the bot to let customers order products via WhatsApp automatically'}
              </p>
              
              {/* Feature Checklist */}
              <div className="flex flex-wrap gap-4 mt-4">
                <div className={`flex items-center gap-2 text-sm ${botStatus.hasWelcomeFlow ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                  {botStatus.hasWelcomeFlow ? <FaCheckCircle /> : <div className="w-4 h-4 rounded-full border border-[#8696a0]" />}
                  Welcome Flow
                </div>
                <div className={`flex items-center gap-2 text-sm ${botStatus.hasOrderFlow ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                  {botStatus.hasOrderFlow ? <FaCheckCircle /> : <div className="w-4 h-4 rounded-full border border-[#8696a0]" />}
                  Order Flow
                </div>
                <div className={`flex items-center gap-2 text-sm ${botStatus.orderBotEnabled ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                  {botStatus.orderBotEnabled ? <FaCheckCircle /> : <div className="w-4 h-4 rounded-full border border-[#8696a0]" />}
                  Order Bot
                </div>
              </div>
            </div>
          </div>

          {/* Main Action Button */}
          <div>
            {botStatus.isEnabled ? (
              <button
                onClick={handleDisableBot}
                className="px-6 py-3 bg-[#2a3942] text-white rounded-xl hover:bg-[#374248] transition-all flex items-center gap-2"
              >
                <FaPause />
                Pause Bot
              </button>
            ) : (
              <button
                onClick={handleEnableBot}
                disabled={enabling}
                className="px-8 py-4 bg-gradient-to-r from-[#00a884] to-[#06cf9c] text-white text-lg font-semibold rounded-xl hover:shadow-lg hover:shadow-[#00a884]/30 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                {enabling ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <FaRocket />
                    Enable Bot Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {botStatus.isEnabled && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-6">
            <div className="flex items-center justify-between mb-2">
              <FaComments className="text-[#00a884] text-xl" />
              <span className="text-3xl font-bold text-white">{stats.messagesHandled}</span>
            </div>
            <p className="text-[#8696a0] text-sm">Messages Handled</p>
          </div>
          <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-6">
            <div className="flex items-center justify-between mb-2">
              <FaShoppingCart className="text-[#3b82f6] text-xl" />
              <span className="text-3xl font-bold text-white">{stats.ordersReceived}</span>
            </div>
            <p className="text-[#8696a0] text-sm">Orders Received</p>
          </div>
          <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-6">
            <div className="flex items-center justify-between mb-2">
              <FaWhatsapp className="text-[#00a884] text-xl" />
              <span className="text-3xl font-bold text-white">{stats.activeConversations}</span>
            </div>
            <p className="text-[#8696a0] text-sm">Active Conversations</p>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FaLightbulb className="text-[#f59e0b]" />
          How It Works
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              step: 1,
              icon: FaWhatsapp,
              title: 'Customer Sends "Hi"',
              desc: 'Your customer starts a conversation'
            },
            {
              step: 2,
              icon: FaRobot,
              title: 'Bot Responds',
              desc: 'Shows welcome message with options'
            },
            {
              step: 3,
              icon: FaBoxes,
              title: 'Browse & Select',
              desc: 'Customer browses and adds to cart'
            },
            {
              step: 4,
              icon: FaCheckCircle,
              title: 'Order Confirmed',
              desc: 'Order is created automatically'
            },
          ].map((item, idx) => (
            <div key={idx} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#00a884]/20 flex items-center justify-center mb-3">
                  <item.icon className="text-[#00a884] text-xl" />
                </div>
                <span className="text-xs text-[#00a884] font-medium mb-1">Step {item.step}</span>
                <h4 className="text-white font-medium text-sm">{item.title}</h4>
                <p className="text-[#8696a0] text-xs mt-1">{item.desc}</p>
              </div>
              {idx < 3 && (
                <FaArrowRight className="hidden md:block absolute top-6 -right-2 text-[#2a3942]" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* All Available Flow Templates */}
      <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-6">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <HiSparkles className="text-[#00a884]" />
          Available Flow Templates (6 Ready-to-Use)
        </h3>
        <p className="text-[#8696a0] text-sm mb-4">Choose any template from Flow Builder to customize your bot</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: '👋', name: 'Welcome Flow', triggers: 'hi, hello, start', desc: 'Greets customers & shows main menu', color: 'from-green-500/20 to-green-600/10' },
            { icon: '🛒', name: 'Order Assistant', triggers: 'order, buy, purchase', desc: 'Create & track orders', color: 'from-blue-500/20 to-blue-600/10' },
            { icon: '📦', name: 'Product Catalog', triggers: 'products, catalog, menu', desc: 'Show inventory products', color: 'from-purple-500/20 to-purple-600/10' },
            { icon: '🎧', name: 'Customer Support', triggers: 'help, support, issue', desc: 'Handle support queries', color: 'from-yellow-500/20 to-yellow-600/10' },
            { icon: '🚚', name: 'Order Status', triggers: 'status, track, tracking', desc: 'Check order status & tracking', color: 'from-orange-500/20 to-orange-600/10' },
            { icon: '💳', name: 'Payment Reminder', triggers: 'payment, pay, pending', desc: 'Send payment reminders', color: 'from-pink-500/20 to-pink-600/10' },
          ].map((template, idx) => (
            <div key={idx} className={`p-4 bg-gradient-to-br ${template.color} rounded-xl border border-[#2a3942] hover:border-[#00a884]/50 transition-all`}>
              <div className="flex items-start gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-[#00a884]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">{template.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium text-sm">{template.name}</h4>
                  <p className="text-[#8696a0] text-xs mt-0.5">{template.desc}</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-[#2a3942]">
                <p className="text-[#8696a0] text-xs">
                  <span className="font-medium text-[#00a884]">Triggers:</span> {template.triggers}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-[#00a884]/10 border border-[#00a884]/30 rounded-lg">
          <p className="text-[#00a884] text-xs flex items-center gap-2">
            <FaMagic className="text-[#00a884]" />
            <span>💡 <strong>Tip:</strong> Go to "Flow Builder" tab to customize these templates or create your own flows!</span>
          </p>
        </div>
      </div>

      {/* Test It Section */}
      {botStatus.isEnabled && (
        <div className="bg-gradient-to-r from-[#00a884]/10 to-[#075e54]/10 rounded-xl border border-[#00a884]/30 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00a884]/20 flex items-center justify-center flex-shrink-0">
              <FaWhatsapp className="text-[#00a884] text-2xl" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg mb-1">Test Your Bot</h3>
              <p className="text-[#8696a0] mb-3">
                Send a message from a customer's phone to your WhatsApp Business number. Try sending:
              </p>
              <div className="flex flex-wrap gap-2">
                {['Hi', 'Hello', 'Browse', 'Products', 'Orders'].map((cmd) => (
                  <span key={cmd} className="px-3 py-1 bg-[#2a3942] text-[#00a884] text-sm rounded-full">
                    "{cmd}"
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BotQuickSetup;
