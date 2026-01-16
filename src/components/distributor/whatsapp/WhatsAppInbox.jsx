/**
 * WhatsApp Inbox - Redesigned "Amber Glass" Edition
 * A modern, luxurious messenger interface with warm amber accents
 * and glassmorphic design language
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, query, limit, onSnapshot, 
  getDocs, doc, getDoc, orderBy
} from 'firebase/firestore';
import { db, auth, functions } from '../../../firebase/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { sendWhatsAppMessage, getWhatsAppConfig } from '../../../services/whatsappService';
import { toast } from 'react-toastify';
import { 
  FaSearch, FaPaperPlane, FaPhone, FaVideo, FaEllipsisV, 
  FaCheck, FaCheckDouble, FaMicrophone, FaRegSmile, FaPaperclip, 
  FaArrowLeft, FaTimes, FaComments, FaBug, FaSync, FaWrench
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi';

// --- Custom Styles ---
const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
  
  .inbox-container {
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  
  .glass-panel {
    background: rgba(15, 15, 20, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }
  
  .glass-panel-light {
    background: rgba(25, 25, 35, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  .amber-glow {
    box-shadow: 0 0 30px rgba(251, 191, 36, 0.15), 0 0 60px rgba(251, 191, 36, 0.05);
  }
  
  .message-incoming {
    background: linear-gradient(135deg, rgba(30, 30, 40, 0.95) 0%, rgba(25, 25, 35, 0.9) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  
  .message-outgoing {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.15) 100%);
    border: 1px solid rgba(251, 191, 36, 0.25);
  }
  
  .inbox-scrollbar::-webkit-scrollbar {
    width: 5px;
  }
  .inbox-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .inbox-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(251, 191, 36, 0.2);
    border-radius: 10px;
  }
  .inbox-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(251, 191, 36, 0.35);
  }
  
  .conversation-item {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .conversation-item:hover {
    background: rgba(251, 191, 36, 0.08);
    transform: translateX(4px);
  }
  .conversation-item.active {
    background: linear-gradient(90deg, rgba(251, 191, 36, 0.15) 0%, transparent 100%);
    border-left: 3px solid #fbbf24;
  }
  
  .input-glow:focus-within {
    box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.2), 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  
  .mesh-gradient {
    background: 
      radial-gradient(ellipse at 10% 10%, rgba(251, 191, 36, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 90% 90%, rgba(245, 158, 11, 0.06) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(30, 30, 40, 1) 0%, rgba(15, 15, 20, 1) 100%);
  }
  
  .chat-pattern {
    background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23fbbf24' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
`;

const WhatsAppInbox = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [retailers, setRetailers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const distributorId = auth.currentUser?.uid;

  // Debug function to check WhatsApp configuration
  const checkWhatsAppSetup = async () => {
    if (!distributorId) return;
    
    try {
      const businessDocRef = doc(db, 'businesses', distributorId);
      const businessDoc = await getDoc(businessDocRef);
      
      if (businessDoc.exists()) {
        const data = businessDoc.data();
        const inboxRef = collection(db, 'businesses', distributorId, 'whatsappInbox');
        const sentRef = collection(db, 'businesses', distributorId, 'whatsappMessages');
        
        const [inboxSnap, sentSnap] = await Promise.all([
          getDocs(query(inboxRef, limit(100))),
          getDocs(query(sentRef, limit(100)))
        ]);
        
        // Get last inbox message for display
        let lastInboxFrom = 'None';
        let lastInboxText = '';
        if (inboxSnap.docs.length > 0) {
          const lastDoc = inboxSnap.docs[0].data();
          lastInboxFrom = lastDoc.from || lastDoc.phoneNumber || 'Unknown';
          lastInboxText = (lastDoc.text || lastDoc.message || '').substring(0, 30);
        }
        
        setDebugInfo({
          phoneNumberId: data.whatsappPhoneNumberId || 'NOT SET ❌',
          wabaId: data.whatsappBusinessAccountId || 'NOT SET ❌',
          phoneNumber: data.whatsappPhoneNumber || 'NOT SET',
          enabled: data.whatsappEnabled ? 'Yes ✅' : 'No ❌',
          provider: data.whatsappProvider || 'NOT SET',
          phoneRegistered: data.whatsappPhoneRegistered ? 'Yes ✅' : 'No ❌',
          accountReviewStatus: data.whatsappAccountReviewStatus || 'UNKNOWN',
          inboxCount: inboxSnap.size,
          sentCount: sentSnap.size,
          lastInboxFrom,
          lastInboxText,
          webhookUrl: 'https://us-central1-stockpilotv1.cloudfunctions.net/whatsappWebhook',
          webhookRepaired: data.webhookSubscriptionStatus === 'repaired' ? 'Yes ✅' : 'No',
        });
      }
    } catch (err) {
      console.error('Debug check error:', err);
      setDebugInfo({ error: err.message });
    }
  };

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    setMessages([]);
    setConversations([]);
    setLoading(true);
    
    // Re-trigger the effect by briefly clearing distributorId reference
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // Repair webhook subscription
  const handleRepairWebhook = async () => {
    if (repairing) return;
    setRepairing(true);
    
    try {
      const repairWebhookSubscription = httpsCallable(functions, 'repairWebhookSubscription');
      const result = await repairWebhookSubscription();
      
      if (result.data?.success) {
        toast.success('Webhook subscription repaired! Please test by sending a message from a customer phone.');
        console.log('🔧 Repair results:', result.data);
        
        // Refresh debug info
        await checkWhatsAppSetup();
      } else {
        toast.error(result.data?.message || 'Repair failed');
      }
    } catch (err) {
      console.error('Repair error:', err);
      toast.error('Failed to repair: ' + (err.message || 'Unknown error'));
    } finally {
      setRepairing(false);
    }
  };

  // --- Message Filtering Logic ---
  const activeMessages = selectedConversation 
    ? messages
        .filter(msg => {
          const msgPhone = (msg.from || msg.to || '').replace(/\D/g, ''); 
          const convPhone = selectedConversation.phone.replace(/\D/g, '');
          if (!msgPhone || !convPhone) return false;
          const msgLast10 = msgPhone.slice(-10);
          const convLast10 = convPhone.slice(-10);
          return msgLast10 === convLast10 || msgPhone.includes(convPhone) || convPhone.includes(msgPhone);
        })
        .sort((a, b) => {
          const getTime = (item) => {
            if (item.rawTime?.toMillis) return item.rawTime.toMillis();
            if (typeof item.rawTime === 'number') return item.rawTime;
            if (item.rawTime?.seconds) return item.rawTime.seconds * 1000;
            if (item.timestamp?.toMillis) return item.timestamp.toMillis();
            if (item.createdAt?.toMillis) return item.createdAt.toMillis();
            return 0;
          };
          return getTime(a) - getTime(b);
        })
    : [];

  // --- Effects ---
  useEffect(() => {
    if (!distributorId) return;
    
    const fetchRetailers = async () => {
      try {
        const ref = collection(db, 'businesses', distributorId, 'connectedRetailers');
        const snap = await getDocs(ref);
        setRetailers(snap.docs.map(d => ({
          id: d.id, 
          ...d.data(),
          cleanPhone: (d.data().phone || '').replace(/\D/g, '')
        })));
      } catch (err) {
        console.error("Retailer fetch error", err);
      }
    };
    
    const checkWhatsAppConfig = async () => {
      try {
        const businessDocRef = doc(db, 'businesses', distributorId);
        const businessDoc = await getDoc(businessDocRef);
        if (businessDoc.exists()) {
          const data = businessDoc.data();
          if (!data.whatsappPhoneNumberId) {
            toast.warning('WhatsApp Phone Number ID not configured');
          }
        }
      } catch (err) {
        console.error('Error checking WhatsApp config:', err);
      }
    };
    
    fetchRetailers();
    checkWhatsAppConfig();
  }, [distributorId]);

  useEffect(() => {
    if (!distributorId) return;

    const inboxRef = collection(db, 'businesses', distributorId, 'whatsappInbox');
    const sentRef = collection(db, 'businesses', distributorId, 'whatsappMessages');
    
    const mergeMessages = (newMsgs) => {
      setMessages(prev => {
        const combined = [...prev];
        newMsgs.forEach(m => {
          if (!combined.find(x => x.id === m.id)) combined.push(m);
        });
        
        const convMap = new Map();
        combined.forEach(msg => {
          const rawPhone = msg.from || msg.to || '';
          if (!rawPhone) return;
          
          const phoneDigits = rawPhone.replace(/\D/g, '');
          if (!phoneDigits || phoneDigits.length < 10) return;
          
          const retailer = retailers.find(r => {
            const rPhone = r.cleanPhone || (r.phone || '').replace(/\D/g, '');
            if (!rPhone) return false;
            const rLast10 = rPhone.slice(-10);
            const msgLast10 = phoneDigits.slice(-10);
            return rLast10 === msgLast10 || rPhone.includes(phoneDigits) || phoneDigits.includes(rPhone);
          });
          
          const displayName = retailer?.businessName || retailer?.retailerName || `+${phoneDigits}`;
          const key = phoneDigits.slice(-10);

          let msgTime = 0;
          if (msg.rawTime?.toMillis) msgTime = msg.rawTime.toMillis();
          else if (typeof msg.rawTime === 'number') msgTime = msg.rawTime;
          else if (msg.rawTime?.seconds) msgTime = msg.rawTime.seconds * 1000;

          const existing = convMap.get(key);
          if (!existing || msgTime > existing.lastMessageTime) {
            const msgText = msg.text || msg.message || '';
            convMap.set(key, {
              id: key,
              phone: rawPhone,
              displayName,
              lastMessage: msgText || (msg.type === 'image' ? '📷 Image' : 'Message'),
              lastMessageTime: msgTime,
              unreadCount: (existing?.unreadCount || 0) + (msg.read === false && msg.direction === 'incoming' ? 1 : 0),
              avatarChar: displayName.charAt(0).toUpperCase(),
              // Generate consistent avatar color based on name
              avatarHue: (displayName.charCodeAt(0) * 137) % 360
            });
          } else if (msg.read === false && msg.direction === 'incoming') {
            existing.unreadCount = (existing.unreadCount || 0) + 1;
          }
        });

        setConversations(Array.from(convMap.values()).sort((a, b) => b.lastMessageTime - a.lastMessageTime));
        setLoading(false);
        return combined;
      });
    };

    const unsubInbox = onSnapshot(
      query(inboxRef, limit(500)),
      (snap) => {
        console.log(`📥 Inbox snapshot: ${snap.docs.length} documents`);
        const inboxMsgs = snap.docs.map(d => {
          const data = d.data();
          // Log each incoming message for debugging
          if (snap.docs.length <= 10) {
            console.log(`📥 Incoming msg: from=${data.from || data.phoneNumber}, text="${(data.text || data.message || '').substring(0, 30)}..."`);
          }
          return { 
            id: d.id, 
            ...data, 
            direction: 'incoming',
            from: data.from || data.phoneNumber || '',
            text: data.text || data.message || '',
            rawTime: data.timestamp || data.receivedAt || data.createdAt
          };
        });
        mergeMessages(inboxMsgs);
      },
      (error) => {
        console.error('❌ Error listening to inbox:', error);
        console.error('Error code:', error.code);
        if (error.code === 'permission-denied') {
          toast.error('Permission denied for whatsappInbox');
        } else if (error.code === 'failed-precondition') {
          console.warn('Index may be required for whatsappInbox query');
        }
      }
    );

    const unsubSent = onSnapshot(
      query(sentRef, limit(500)),
      (snap) => {
        console.log(`📤 Sent messages snapshot: ${snap.docs.length} documents`);
        const sentMsgs = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id, 
            ...data,
            direction: 'outgoing',
            to: data.to || '',
            text: data.message || data.text || '',
            rawTime: data.createdAt || data.timestamp,
            // Include status for read receipts
            read: data.read || data.status === 'read',
            delivered: data.delivered || data.status === 'delivered',
            status: data.status || 'sent'
          };
        });
        mergeMessages(sentMsgs);
      },
      (error) => {
        console.error('❌ Error listening to sent messages:', error);
      }
    );

    return () => { unsubInbox(); unsubSent(); };
  }, [distributorId, retailers]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, selectedConversation?.id]);

  // --- Handlers ---
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    setSending(true);

    try {
      const config = await getWhatsAppConfig(distributorId);
      if (!config?.enabled) throw new Error("WhatsApp not configured");

      const res = await sendWhatsAppMessage(
        distributorId,
        selectedConversation.phone,
        newMessage,
        { messageType: 'text' }
      );

      if (res.success) setNewMessage('');
    } catch (err) {
      toast.error("Failed: " + err.message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (millis) => {
    if (!millis) return '';
    const d = new Date(millis);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getMessageTime = (msg) => {
    if (msg.rawTime?.toMillis) return msg.rawTime.toMillis();
    if (typeof msg.rawTime === 'number') return msg.rawTime;
    if (msg.rawTime?.seconds) return msg.rawTime.seconds * 1000;
    if (msg.timestamp?.toMillis) return msg.timestamp.toMillis();
    if (msg.createdAt?.toMillis) return msg.createdAt.toMillis();
    return 0;
  };

  const filteredConvs = conversations.filter(c => 
    c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  );

  // --- Animation Variants ---
  const listItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.05, duration: 0.3, ease: [0.4, 0, 0.2, 1] }
    })
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
    },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.15 } }
  };

  return (
    <div className="inbox-container flex h-[calc(100vh-100px)] overflow-hidden rounded-2xl relative">
      <style>{customStyles}</style>
      
      {/* Background */}
      <div className="absolute inset-0 mesh-gradient" />
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5" />
      
      {/* Main Container */}
      <div className="relative z-10 flex w-full h-full glass-panel rounded-2xl overflow-hidden amber-glow">
        
        {/* === LEFT SIDEBAR === */}
        <motion.div 
          className={`flex flex-col border-r border-white/5 bg-black/20 transition-all duration-300 ${
            selectedConversation ? 'hidden md:flex md:w-[340px] lg:w-[380px]' : 'w-full md:w-[340px] lg:w-[380px]'
          }`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <div className="h-[72px] flex items-center justify-between px-5 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                  <FaComments className="text-white text-lg" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#0f0f14]" />
              </div>
              <div>
                <h1 className="text-white font-semibold text-lg tracking-tight">Messages</h1>
                <p className="text-white/40 text-xs font-medium">{conversations.length} conversations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-10 h-10 rounded-xl glass-panel-light flex items-center justify-center text-white/50 hover:text-amber-400 hover:bg-amber-400/10 transition-all"
                title="Refresh messages"
              >
                <FaSync size={14} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <button 
                onClick={() => { setShowDebug(!showDebug); checkWhatsAppSetup(); }}
                className={`w-10 h-10 rounded-xl glass-panel-light flex items-center justify-center transition-all ${showDebug ? 'text-amber-400 bg-amber-400/10' : 'text-white/50 hover:text-amber-400 hover:bg-amber-400/10'}`}
                title="Debug Info"
              >
                <FaBug size={14} />
              </button>
            </div>
          </div>
          
          {/* Debug Panel */}
          <AnimatePresence>
            {showDebug && debugInfo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-white/5"
              >
                <div className="p-4 bg-black/30 text-xs space-y-2">
                  <h3 className="text-amber-400 font-semibold mb-2">🔍 WhatsApp Debug Info</h3>
                  {debugInfo.error ? (
                    <p className="text-red-400">Error: {debugInfo.error}</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-white/50">Phone Number ID:</div>
                        <div className="text-white/80 font-mono text-[10px] break-all">{debugInfo.phoneNumberId}</div>
                        
                        <div className="text-white/50">WABA ID:</div>
                        <div className="text-white/80 font-mono text-[10px] break-all">{debugInfo.wabaId}</div>
                        
                        <div className="text-white/50">Phone:</div>
                        <div className="text-white/80">{debugInfo.phoneNumber}</div>
                        
                        <div className="text-white/50">Enabled:</div>
                        <div className="text-white/80">{debugInfo.enabled}</div>
                        
                        <div className="text-white/50">Registered:</div>
                        <div className="text-white/80">{debugInfo.phoneRegistered}</div>
                        
                        <div className="text-white/50">Review Status:</div>
                        <div className="text-white/80">{debugInfo.accountReviewStatus}</div>
                        
                        <div className="text-white/50">Inbox Messages:</div>
                        <div className={debugInfo.inboxCount > 0 ? 'text-emerald-400' : 'text-white/80'}>{debugInfo.inboxCount}</div>
                        
                        <div className="text-white/50">Sent Messages:</div>
                        <div className="text-white/80">{debugInfo.sentCount}</div>
                        
                        {debugInfo.webhookRepaired && (
                          <>
                            <div className="text-white/50">Webhook Repaired:</div>
                            <div className="text-emerald-400">{debugInfo.webhookRepaired}</div>
                          </>
                        )}
                      </div>
                      
                      {debugInfo.inboxCount > 0 && (
                        <div className="mt-3 p-2 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                          <strong>✅ Working!</strong> Last received from: {debugInfo.lastInboxFrom}
                          {debugInfo.lastInboxText && <span className="text-white/60"> - "{debugInfo.lastInboxText}..."</span>}
                        </div>
                      )}
                      
                      {debugInfo.phoneNumberId === 'NOT SET ❌' && (
                        <div className="mt-3 p-2 rounded bg-red-500/20 border border-red-500/30 text-red-300">
                          <strong>⚠️ Issue Found:</strong> Phone Number ID is not set! 
                          Incoming messages cannot be routed to this business. 
                          Please complete WhatsApp setup.
                        </div>
                      )}
                      
                      {debugInfo.inboxCount === 0 && debugInfo.sentCount > 0 && (
                        <div className="mt-3 p-2 rounded bg-yellow-500/20 border border-yellow-500/30 text-yellow-300">
                          <strong>📝 Note:</strong> No incoming messages found, but outgoing messages exist.
                          <br />Click "Repair Webhook" to fix subscription.
                        </div>
                      )}
                      
                      <button
                        onClick={handleRepairWebhook}
                        disabled={repairing}
                        className="mt-3 w-full py-2 px-3 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                      >
                        <FaWrench className={repairing ? 'animate-spin' : ''} size={12} />
                        {repairing ? 'Repairing...' : 'Repair Webhook Subscription'}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search */}
          <div className="px-4 py-3 flex-shrink-0">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FaSearch className="text-white/30 text-sm group-focus-within:text-amber-400 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full bg-white/5 text-white text-sm rounded-xl pl-11 pr-4 py-3 focus:outline-none placeholder-white/30 border border-transparent focus:border-amber-400/30 focus:bg-white/8 transition-all input-glow"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/30 hover:text-white/60"
                >
                  <FaTimes size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto inbox-scrollbar px-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center pt-16 gap-3">
                <div className="relative">
                  <div className="w-10 h-10 border-2 border-amber-400/20 rounded-full" />
                  <div className="absolute inset-0 w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
                <span className="text-white/40 text-sm">Loading chats...</span>
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center pt-16 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                  <FaComments className="text-white/20 text-2xl" />
                </div>
                <p className="text-white/50 text-sm font-medium mb-1">No conversations yet</p>
                <p className="text-white/30 text-xs">Messages will appear here</p>
              </div>
            ) : (
              <div className="space-y-1 py-2">
                {filteredConvs.map((conv, index) => (
                  <motion.div 
                    key={conv.id}
                    custom={index}
                    variants={listItemVariants}
                    initial="hidden"
                    animate="visible"
                    onClick={() => setSelectedConversation(conv)}
                    className={`conversation-item flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer ${
                      selectedConversation?.id === conv.id ? 'active' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-semibold text-lg flex-shrink-0 shadow-lg"
                      style={{ 
                        background: `linear-gradient(135deg, hsl(${conv.avatarHue}, 60%, 45%) 0%, hsl(${conv.avatarHue + 30}, 50%, 35%) 100%)`
                      }}
                    >
                      {conv.avatarChar}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white font-medium text-[15px] truncate">
                          {conv.displayName}
                        </span>
                        <span className="text-white/40 text-xs flex-shrink-0 ml-2 font-medium">
                          {formatTime(conv.lastMessageTime)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-white/50 text-sm truncate">
                          {conv.lastMessage}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="bg-amber-400 text-black text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-lg shadow-amber-400/30">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* === RIGHT SIDE (Chat Area) === */}
        {selectedConversation ? (
          <motion.div 
            className="flex-1 flex flex-col h-full relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Chat Pattern Background */}
            <div className="absolute inset-0 chat-pattern opacity-50" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
            
            {/* Chat Header */}
            <div className="relative z-10 h-[72px] glass-panel flex items-center justify-between px-4 md:px-5 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedConversation(null)} 
                  className="md:hidden w-10 h-10 rounded-xl glass-panel-light flex items-center justify-center text-white/70 hover:text-amber-400 transition-colors"
                >
                  <FaArrowLeft size={14} />
                </button>
                
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-semibold shadow-lg"
                  style={{ 
                    background: `linear-gradient(135deg, hsl(${selectedConversation.avatarHue}, 60%, 45%) 0%, hsl(${selectedConversation.avatarHue + 30}, 50%, 35%) 100%)`
                  }}
                >
                  {selectedConversation.avatarChar}
                </div>
                
                <div>
                  <h2 className="text-white font-semibold text-[15px] md:text-base">
                    {selectedConversation.displayName}
                  </h2>
                  <p className="text-white/40 text-xs font-medium">
                    {selectedConversation.phone}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-1">
                {[FaVideo, FaPhone, FaSearch, FaEllipsisV].map((Icon, i) => (
                  <button 
                    key={i}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-amber-400 hover:bg-amber-400/10 transition-all"
                  >
                    <Icon size={i === 3 ? 14 : 16} />
                  </button>
                ))}
              </div>
            </div>

            {/* Messages Area */}
            <div className="relative z-10 flex-1 overflow-y-auto inbox-scrollbar px-4 md:px-6 py-4">
              <AnimatePresence initial={false}>
                {activeMessages.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center h-full text-center px-4"
                  >
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/10 flex items-center justify-center mb-4 border border-amber-400/20">
                      <HiSparkles className="text-amber-400 text-3xl" />
                    </div>
                    <h3 className="text-white/70 font-medium mb-2">Start the conversation</h3>
                    <p className="text-white/40 text-sm max-w-[280px]">
                      Send a message to {selectedConversation.displayName}
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-3">
                    {activeMessages.map((msg, index) => {
                      const isIncoming = msg.direction === 'incoming';
                      const msgTime = getMessageTime(msg);
                      
                      return (
                        <motion.div
                          key={msg.id || index}
                          variants={messageVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`relative max-w-[75%] md:max-w-[65%] rounded-2xl px-4 py-2.5 shadow-lg ${
                              isIncoming 
                                ? 'message-incoming rounded-bl-md' 
                                : 'message-outgoing rounded-br-md'
                            }`}
                          >
                            <p className="text-white/90 text-[15px] leading-relaxed whitespace-pre-wrap">
                              {msg.text || msg.message || ''}
                            </p>
                            
                            <div className="flex items-center justify-end gap-1.5 mt-1.5">
                              <span className="text-[11px] text-white/40 font-medium">
                                {formatTime(msgTime)}
                              </span>
                              {!isIncoming && (
                                <span className={msg.read ? 'text-amber-400' : 'text-white/40'}>
                                  {msg.read ? <FaCheckDouble size={12} /> : <FaCheck size={12} />}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="relative z-10 glass-panel border-t border-white/5 px-4 py-3 flex-shrink-0">
              <div className="flex items-end gap-3">
                <button className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-amber-400 hover:bg-amber-400/10 transition-all flex-shrink-0 mb-0.5">
                  <FaRegSmile size={20} />
                </button>
                <button className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-amber-400 hover:bg-amber-400/10 transition-all flex-shrink-0 mb-0.5">
                  <FaPaperclip size={18} />
                </button>
                
                <div className="flex-1 bg-white/5 rounded-2xl border border-white/5 focus-within:border-amber-400/30 transition-all input-glow">
                  <textarea
                    ref={inputRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type a message..."
                    rows={1}
                    className="w-full bg-transparent text-white px-4 py-3 text-[15px] focus:outline-none placeholder-white/30 resize-none"
                    style={{ minHeight: '48px', maxHeight: '120px' }}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                  />
                </div>

                {newMessage.trim() ? (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={handleSendMessage}
                    disabled={sending}
                    className="w-12 h-12 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all active:scale-95 flex-shrink-0"
                  >
                    {sending ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <FaPaperPlane className="text-white text-base -translate-x-0.5" />
                    )}
                  </motion.button>
                ) : (
                  <button className="w-12 h-12 rounded-xl glass-panel-light flex items-center justify-center text-white/40 hover:text-amber-400 hover:bg-amber-400/10 transition-all flex-shrink-0">
                    <FaMicrophone size={18} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Empty State */
          <motion.div 
            className="hidden md:flex flex-1 flex-col items-center justify-center relative overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {/* Decorative elements */}
            <div className="absolute inset-0 chat-pattern opacity-30" />
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-amber-400/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-orange-400/5 rounded-full blur-3xl" />
            
            <div className="relative z-10 text-center max-w-md px-6">
              <motion.div 
                className="w-28 h-28 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-amber-400/20 to-orange-500/10 flex items-center justify-center border border-amber-400/20 shadow-2xl"
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.5, delay: 0.3, type: "spring" }}
              >
                <FaComments className="text-amber-400 text-4xl" />
              </motion.div>
              
              <motion.h1 
                className="text-white text-2xl md:text-3xl font-semibold mb-3 tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Your Messages
              </motion.h1>
              
              <motion.p 
                className="text-white/50 text-base leading-relaxed mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                Select a conversation from the list to view messages and start chatting with your retailers.
              </motion.p>
              
              <motion.div 
                className="flex items-center justify-center gap-2 text-white/30 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400/60" />
                <span>Connected & Secure</span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppInbox;
