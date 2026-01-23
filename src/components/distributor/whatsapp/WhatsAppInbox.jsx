/**
 * WhatsApp Inbox - Complete Redesign
 * Exact WhatsApp-like UI/UX with proper scroll isolation
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, query, limit, onSnapshot, 
  getDocs, doc, getDoc, orderBy, updateDoc, where, writeBatch
} from 'firebase/firestore';
import { db, auth, functions } from '../../../firebase/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { sendWhatsAppMessage, getWhatsAppConfig } from '../../../services/whatsappService';
import { toast } from 'react-toastify';
import { 
  FaSearch, FaPaperPlane, FaPhone, FaVideo, FaEllipsisV, 
  FaCheck, FaCheckDouble, FaMicrophone, FaRegSmile, FaPaperclip, 
  FaArrowLeft, FaTimes, FaComments, FaBug, FaSync, FaWrench, FaExclamationTriangle, FaRobot,
  FaList, FaMousePointer, FaShoppingCart
} from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi';

// --- WhatsApp Web Exact Clone Styles ---
const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Segoe+UI:wght@300;400;500;600;700&display=swap');
  
  .wa-inbox-root {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    height: calc(100vh - 200px);
    min-height: 500px;
    width: 100%;
    display: flex;
    position: relative;
    overflow: hidden;
    background: #111b21;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  
  /* Chat list panel */
  .wa-chat-list {
    width: 35%;
    min-width: 320px;
    max-width: 420px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #111b21;
    border-right: 1px solid rgba(134, 150, 160, 0.15);
  }
  
  /* Chat area panel */
  .wa-chat-area {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    background: #0b141a;
  }
  
  /* WhatsApp doodle background pattern */
  .wa-chat-bg {
    position: absolute;
    inset: 0;
    background-color: #0b141a;
    background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAeCAYAAABwmH1PAAAACXBIWXMAAAsTAAALEwEAmpwYAAAFFmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDUgNzkuMTYzNDk5LCAyMDE4LzA4LzEzLTE2OjQwOjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIi8+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7/7gAOQWRvYmUAZMAAAAAB/9sAhAAGBAQEBQQGBQUGCQYFBgkLCAYGCAsMCgoLCgoMEAwMDAwMDBAMDg8QDw4MExMUFBMTHBsbGxwfHx8fHx8fHx8fAQcHBw0MDRgQEBgaFREVGh8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx//wAARCAAeADwDAREAAhEBAxEB/8QAewABAQEBAQAAAAAAAAAAAAAAAAcIBgQBAQAAAAAAAAAAAAAAAAAAAAAQAAEDAwMCBAUEAgMAAAAAAAECAwQABQYREgchCBMxQVEUImFxkSMyQlKBobFyFREBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A0lQKBQRPl3mq44Lk1kx2DjLl1ul0ZefCXpKI7TLKFbFLKkKUolStgA0PhkUHQcecgycqxSLkN4sDuPPvPPNtwn5DT77aGXVNhTi2SlKSspKgE6j3Jqg71AoFAoFBmLyN8pu4fPLpgeJW9i23Kw7m7tfccU6086h4obKkoSEBsJCQdCo9dexArRjQcNxa7uyLKxKkPOyH3obDrrzzhW444ttKlLWtRJUpR1JJOpoOhoFAoMheRXkC8Ye/wAPeY3jcYWYKuSrU/fnILb5mmFvqihDSXt6G1oU3qF6FJPj6UGu6BQKCDeTXlCXwvlFoxJeHi+C5QnXlOm4+QI2xnG2/wBvxlav3df6j/tBuugUCgjnJGQ3Czx/brYXXYJu7qoT8pgqS4GGQVOPLQR7K0SI+v0cVQb1x+6wrxYLXdLcFi33KGxPihYAWGX2kurQFAkbglaRuHv7UCgUH/9k=");
    opacity: 0.04;
    pointer-events: none;
  }
  
  /* Message bubbles - WhatsApp exact colors */
  .wa-msg-incoming {
    background: #202c33;
    border-radius: 8px;
    border-top-left-radius: 0;
  }
  
  .wa-msg-outgoing {
    background: #005c4b;
    border-radius: 8px;
    border-top-right-radius: 0;
  }
  
  /* Scrollbar - WhatsApp style */
  .wa-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .wa-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .wa-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
  }
  .wa-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.25);
  }
  
  /* Conversation hover */
  .wa-conv-item {
    transition: all 0.15s ease;
  }
  .wa-conv-item:hover {
    background: rgba(32, 44, 51, 0.8);
  }
  .wa-conv-item.active {
    background: #2a3942;
  }
  
  /* Header style */
  .wa-header {
    background: #202c33;
    height: 60px;
    min-height: 60px;
  }
  
  /* Input area */
  .wa-input-area {
    background: #202c33;
    padding: 10px 16px;
  }
  
  .wa-input-box {
    background: #2a3942;
    border-radius: 8px;
  }
  
  /* Animations */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .wa-conv-item {
    animation: fadeInUp 0.2s ease forwards;
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
  const [botEnabled, setBotEnabled] = useState(null);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const distributorId = auth.currentUser?.uid;
  
  // Keep ref in sync with state
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Check bot status on load
  useEffect(() => {
    if (!distributorId) return;
    
    const checkBotStatus = async () => {
      try {
        const orderBotRef = doc(db, 'businesses', distributorId, 'whatsappBot', 'orderConfig');
        const orderBotDoc = await getDoc(orderBotRef);
        const enabled = orderBotDoc.exists() && orderBotDoc.data()?.enabled === true;
        
        const flowsRef = collection(db, 'businesses', distributorId, 'whatsappFlows');
        const flowsSnap = await getDocs(query(flowsRef, where('isActive', '==', true)));
        const hasActiveFlows = flowsSnap.size > 0;
        
        setBotEnabled(enabled || hasActiveFlows);
      } catch (err) {
        console.error('Error checking bot status:', err);
      }
    };
    
    checkBotStatus();
    // Re-check every 10 seconds
    const interval = setInterval(checkBotStatus, 10000);
    return () => clearInterval(interval);
  }, [distributorId]);

  // Debug function
  const checkWhatsAppSetup = async () => {
    if (!distributorId) return;
    
    try {
      const businessDocRef = doc(db, 'businesses', distributorId);
      const orderBotRef = doc(db, 'businesses', distributorId, 'whatsappBot', 'orderConfig');
      const flowsRef = collection(db, 'businesses', distributorId, 'whatsappFlows');
      
      const [businessDoc, orderBotDoc, flowsSnap] = await Promise.all([
        getDoc(businessDocRef),
        getDoc(orderBotRef),
        getDocs(query(flowsRef, where('isActive', '==', true)))
      ]);
      
      const inboxRef = collection(db, 'businesses', distributorId, 'whatsappInbox');
      const sentRef = collection(db, 'businesses', distributorId, 'whatsappMessages');
      
      const [inboxSnap, sentSnap] = await Promise.all([
        getDocs(query(inboxRef, limit(100))),
        getDocs(query(sentRef, limit(100)))
      ]);
      
      let lastInboxFrom = 'None';
      let lastInboxText = '';
      if (inboxSnap.docs.length > 0) {
        const lastDoc = inboxSnap.docs[0].data();
        lastInboxFrom = lastDoc.from || lastDoc.phoneNumber || 'Unknown';
        lastInboxText = (lastDoc.text || lastDoc.message || '').substring(0, 30);
      }
      
      const orderBotEnabled = orderBotDoc.exists() && orderBotDoc.data()?.enabled === true;
      const activeFlows = flowsSnap.size;
      
      if (businessDoc.exists()) {
        const data = businessDoc.data();
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
          botEnabled: orderBotEnabled ? 'Yes ✅' : 'No ❌',
          activeFlows: activeFlows.toString(),
        });
      }
    } catch (err) {
      console.error('Debug check error:', err);
      setDebugInfo({ error: err.message });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setMessages([]);
    setConversations([]);
    setLoading(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleRepairWebhook = async () => {
    if (repairing) return;
    setRepairing(true);
    
    try {
      const repairWebhookSubscription = httpsCallable(functions, 'repairWebhookSubscription');
      const result = await repairWebhookSubscription();
      
      if (result.data?.success) {
        toast.success('Webhook subscription repaired! Please test by sending a message from a customer phone.');
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

  // Message filtering
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

  // Fetch retailers
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
    
    fetchRetailers();
  }, [distributorId]);

  // Real-time message listening
  useEffect(() => {
    if (!distributorId) return;

    const inboxRef = collection(db, 'businesses', distributorId, 'whatsappInbox');
    const sentRef = collection(db, 'businesses', distributorId, 'whatsappMessages');
    
    const mergeMessages = (newMsgs) => {
      setMessages(prev => {
        // Create a map of existing messages by ID for deduplication
        const messageMap = new Map();
        prev.forEach(m => messageMap.set(m.id, m));
        newMsgs.forEach(m => messageMap.set(m.id, m));
        const combined = Array.from(messageMap.values());
        
        // Build conversations from all messages
        const convMap = new Map();
        const unreadByConv = new Map(); // Track unread messages separately
        
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

          // Track unread messages for this conversation (only incoming and not read)
          const isUnread = msg.direction === 'incoming' && msg.read !== true && !msg.read;
          if (isUnread) {
            unreadByConv.set(key, (unreadByConv.get(key) || 0) + 1);
          }

          const existing = convMap.get(key);
          
          if (!existing || msgTime > existing.lastMessageTime) {
            const msgText = msg.text || msg.message || '';
            
            convMap.set(key, {
              id: key,
              phone: rawPhone,
              displayName,
              lastMessage: msgText || (msg.type === 'image' ? '📷 Image' : 'Message'),
              lastMessageTime: msgTime,
              lastMessageDirection: msg.direction,
              avatarChar: displayName.charAt(0).toUpperCase(),
              avatarHue: (displayName.charCodeAt(0) * 137) % 360
            });
          }
        });

        // Apply unread counts to conversations
        // Use ref to get current selected conversation (avoids stale closure)
        const currentSelectedConv = selectedConversationRef.current;
        
        const conversationsList = Array.from(convMap.values()).map(conv => {
          // If this conversation is currently selected, show 0 unread
          const isSelected = currentSelectedConv && conv.id === currentSelectedConv.id;
          return {
            ...conv,
            unreadCount: isSelected ? 0 : (unreadByConv.get(conv.id) || 0)
          };
        });
        
        setConversations(conversationsList.sort((a, b) => b.lastMessageTime - a.lastMessageTime));
        setLoading(false);
        return combined;
      });
    };

    const unsubInbox = onSnapshot(
      query(inboxRef, limit(500)),
      (snap) => {
        const inboxMsgs = snap.docs.map(d => {
          const data = d.data();
          return { 
            id: d.id, 
            ...data, 
            direction: 'incoming',
            from: data.from || data.phoneNumber || '',
            text: data.text || data.message || '',
            rawTime: data.timestamp || data.receivedAt || data.createdAt,
            read: data.read === true || data.read === 'true', // Ensure boolean
            // Check if this is an interactive response (button/list selection)
            isInteractiveResponse: data.type === 'interactive' || data.context || false,
            interactiveType: data.type === 'interactive' ? (data.media?.button_reply ? 'button' : 'list') : null
          };
        });
        mergeMessages(inboxMsgs);
      },
      (error) => {
        console.error('❌ Error listening to inbox:', error);
      }
    );

    const unsubSent = onSnapshot(
      query(sentRef, limit(500)),
      (snap) => {
        const sentMsgs = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id, 
            ...data,
            direction: 'outgoing',
            to: data.to || '',
            text: data.message || data.text || '',
            rawTime: data.createdAt || data.timestamp,
            read: data.read || data.status === 'read',
            delivered: data.delivered || data.status === 'delivered',
            status: data.status || 'sent',
            messageType: data.messageType || 'text',
            // Preserve message type for interactive detection
            isInteractiveMessage: ['flow_buttons', 'flow_catalog', 'order_bot_welcome'].includes(data.messageType)
          };
        });
        mergeMessages(sentMsgs);
      },
      (error) => {
        console.error('❌ Error listening to sent messages:', error);
      }
    );

    return () => { unsubInbox(); unsubSent(); };
  }, [distributorId, retailers]); // Removed selectedConversation - using ref instead

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current && selectedConversation) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [activeMessages.length, selectedConversation?.id]);

  // Handlers
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

  // Mark messages as read when conversation is opened
  const markMessagesAsRead = async (conversation) => {
    if (!distributorId || !conversation) return;
    
    try {
      const phoneDigits = (conversation.phone || '').replace(/\D/g, '');
      if (!phoneDigits || phoneDigits.length < 10) return;
      
      const phoneLast10 = phoneDigits.slice(-10);
      
      // Get all inbox messages and filter by phone number
      const inboxRef = collection(db, 'businesses', distributorId, 'whatsappInbox');
      const inboxQuery = query(inboxRef, limit(1000)); // Get more messages to ensure we catch all
      const inboxSnap = await getDocs(inboxQuery);
      
      const batch = writeBatch(db);
      let updateCount = 0;
      const maxBatchSize = 500; // Firestore batch limit
      
      inboxSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const msgPhone = (data.from || data.phoneNumber || '').replace(/\D/g, '');
        const msgLast10 = msgPhone.slice(-10);
        
        // Match if last 10 digits match and message is unread
        if (msgLast10 === phoneLast10 && !data.read && data.read !== true) {
          if (updateCount < maxBatchSize) {
            batch.update(docSnap.ref, { 
              read: true,
              readAt: new Date()
            });
            updateCount++;
          }
        }
      });
      
      if (updateCount > 0) {
        await batch.commit();
        console.log(`✅ Marked ${updateCount} messages as read for ${conversation.displayName}`);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
      // Don't show error to user - it's not critical
    }
  };

  // Handle conversation selection - prevent any scroll
  const handleConversationClick = async (conv) => {
    // Update ref immediately for use in mergeMessages
    selectedConversationRef.current = conv;
    
    // Lock parent scroll
    const mainContainer = document.querySelector('main');
    if (mainContainer) {
      const scrollTop = mainContainer.scrollTop;
      setSelectedConversation(conv);
      // Keep scroll locked
      requestAnimationFrame(() => {
        if (mainContainer) mainContainer.scrollTop = scrollTop;
      });
      setTimeout(() => {
        if (mainContainer) mainContainer.scrollTop = scrollTop;
      }, 100);
    } else {
      setSelectedConversation(conv);
    }
    
    // Immediately update local messages state to mark as read (for instant UI update)
    const convPhoneLast10 = (conv.phone || '').replace(/\D/g, '').slice(-10);
    setMessages(prev => prev.map(msg => {
      const msgPhone = (msg.from || '').replace(/\D/g, '');
      const msgLast10 = msgPhone.slice(-10);
      if (msg.direction === 'incoming' && msgLast10 === convPhoneLast10) {
        return { ...msg, read: true };
      }
      return msg;
    }));
    
    // Also immediately update conversation list to show 0 unread for this chat
    setConversations(prev => prev.map(c => 
      c.id === conv.id ? { ...c, unreadCount: 0 } : c
    ));
    
    // Mark messages as read in Firestore (background update)
    markMessagesAsRead(conv);
  };

  return (
    <div className="wa-inbox-root">
      <style>{customStyles}</style>
      
      {/* LEFT PANEL - Chat List */}
      <div className={`wa-chat-list ${selectedConversation ? 'hidden md:flex' : 'flex'} flex-col`}>
        {/* Header */}
        <div className="wa-header flex items-center justify-between px-4 border-b border-[#222d34]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00a884] to-[#075e54] flex items-center justify-center shadow-lg shadow-[#00a884]/20">
              <FaComments className="text-white text-base" />
            </div>
            <div>
              <h1 className="text-white font-medium text-[15px]">Chats</h1>
              <p className="text-[#8696a0] text-[11px]">{conversations.length} conversations</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#aebac1] hover:bg-[#202c33] hover:text-white transition-all"
              title="Refresh"
            >
              <FaSync size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={() => { setShowDebug(!showDebug); checkWhatsAppSetup(); }}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${showDebug ? 'text-[#00a884] bg-[#00a884]/10' : 'text-[#aebac1] hover:bg-[#202c33] hover:text-white'}`}
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
              className="overflow-hidden border-b border-[#222d34] flex-shrink-0"
            >
              <div className="p-3 bg-[#111b21] text-xs space-y-2">
                <h3 className="text-[#00a884] font-medium mb-2">Debug Info</h3>
                {debugInfo.error ? (
                  <p className="text-red-400">Error: {debugInfo.error}</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-1 text-[#8696a0]">
                      <span>Phone ID:</span>
                      <span className="text-[#e9edef] font-mono text-[10px] truncate">{debugInfo.phoneNumberId}</span>
                      <span>Inbox:</span>
                      <span className={debugInfo.inboxCount > 0 ? 'text-[#00a884]' : 'text-[#e9edef]'}>{debugInfo.inboxCount}</span>
                      <span>Bot Enabled:</span>
                      <span className={debugInfo.botEnabled?.includes('Yes') ? 'text-[#00a884]' : 'text-[#ef4444]'}>
                        {debugInfo.botEnabled || 'Unknown'}
                      </span>
                      <span>Active Flows:</span>
                      <span className="text-[#e9edef]">{debugInfo.activeFlows || '0'}</span>
                    </div>
                    {debugInfo.botEnabled?.includes('No') && (
                      <div className="mt-2 p-2 bg-[#f59e0b]/20 border border-[#f59e0b]/30 rounded text-[#f59e0b] text-[10px]">
                        ⚠️ Bot is not enabled. Go to "Bot Setup" tab to enable it.
                      </div>
                    )}
                    <button
                      onClick={handleRepairWebhook}
                      disabled={repairing}
                      className="mt-2 w-full py-1.5 px-3 rounded bg-[#00a884]/20 text-[#00a884] text-xs hover:bg-[#00a884]/30 transition-all flex items-center justify-center gap-2"
                    >
                      <FaWrench className={repairing ? 'animate-spin' : ''} size={10} />
                      {repairing ? 'Repairing...' : 'Repair Webhook'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bot Status Warning */}
        {botEnabled === false && (
          <div className="mx-3 mt-2 p-3 bg-[#f59e0b]/20 border border-[#f59e0b]/40 rounded-lg">
            <div className="flex items-start gap-2">
              <FaExclamationTriangle className="text-[#f59e0b] text-sm mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[#f59e0b] text-xs font-medium">Bot Not Enabled</p>
                <p className="text-[#f59e0b]/80 text-[10px] mt-0.5">
                  Customers sending "Hi" won't receive automated responses. Enable bot in <strong>Bot Setup</strong> tab.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-3 py-2.5 bg-[#111b21]">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <FaSearch className="text-[#8696a0] text-xs" />
            </div>
            <input
              type="text"
              placeholder="Search or start new chat"
              className="w-full bg-[#202c33] text-[#e9edef] text-[13px] rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#00a884]/30 placeholder-[#8696a0] transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8696a0] hover:text-[#e9edef] transition-colors"
              >
                <FaTimes size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List - This is the scrollable area */}
        <div className="flex-1 overflow-y-auto wa-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center pt-20 gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#00a884]/20 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
              </div>
              <span className="text-[#8696a0] text-sm">Loading chats...</span>
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#202c33] flex items-center justify-center mb-4">
                <FaComments className="text-[#8696a0] text-2xl" />
              </div>
              <p className="text-[#e9edef] font-medium mb-1">No conversations yet</p>
              <p className="text-[#8696a0] text-xs">Messages from customers will appear here</p>
            </div>
          ) : (
            <div>
              {filteredConvs.map((conv) => {
                const hasUnread = conv.unreadCount > 0;
                const isSelected = selectedConversation?.id === conv.id;
                
                return (
                  <div 
                    key={conv.id}
                    onClick={() => handleConversationClick(conv)}
                    className={`wa-conv-item flex items-center gap-3 px-3 py-3 cursor-pointer border-b border-[#222d34]/60 ${
                      isSelected ? 'active' : ''
                    }`}
                  >
                    {/* Avatar with online indicator */}
                    <div className="relative flex-shrink-0">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-lg"
                        style={{ background: `hsl(${conv.avatarHue}, 45%, 35%)` }}
                      >
                        {conv.avatarChar}
                      </div>
                      {/* Green add/plus icon on avatar */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#00a884] rounded-full flex items-center justify-center border-2 border-[#111b21]">
                        <span className="text-white text-xs font-bold">+</span>
                      </div>
                    </div>
                    
                    {/* Conversation Info */}
                    <div className="flex-1 min-w-0">
                      {/* Name and Time Row */}
                      <div className="flex justify-between items-center">
                        <span className={`font-normal text-[15px] truncate ${
                          hasUnread ? 'text-white' : 'text-[#e9edef]'
                        }`}>
                          {conv.displayName}
                        </span>
                        <span className={`text-xs flex-shrink-0 ml-2 ${
                          hasUnread ? 'text-[#00a884] font-medium' : 'text-[#8696a0]'
                        }`}>
                          {formatTime(conv.lastMessageTime)}
                        </span>
                      </div>
                      
                      {/* Message Preview and Badge Row */}
                      <div className="flex justify-between items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          {/* Double check for outgoing messages */}
                          {conv.lastMessageDirection === 'outgoing' && (
                            <FaCheckDouble size={14} className="text-[#53bdeb] flex-shrink-0" />
                          )}
                          <span className={`text-sm truncate ${
                            hasUnread ? 'text-[#d1d7db]' : 'text-[#8696a0]'
                          }`}>
                            {conv.lastMessage}
                          </span>
                        </div>
                        
                        {/* Unread Badge */}
                        {hasUnread && (
                          <span className="bg-[#00a884] text-[#111b21] text-[11px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center flex-shrink-0">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL - Chat Area */}
      {selectedConversation ? (
        <div className="wa-chat-area">
          {/* WhatsApp doodle background */}
          <div className="wa-chat-bg" />
          
          {/* Chat Header - Fixed */}
          <div className="wa-header flex items-center justify-between px-4 relative z-10 border-b border-[#222d34]">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button 
                onClick={() => setSelectedConversation(null)} 
                className="md:hidden w-10 h-10 rounded-full flex items-center justify-center text-[#aebac1] hover:bg-[#202c33] flex-shrink-0"
              >
                <FaArrowLeft size={16} />
              </button>
              
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0"
                style={{ background: `hsl(${selectedConversation.avatarHue}, 50%, 40%)` }}
              >
                {selectedConversation.avatarChar}
              </div>
              
              <div className="flex-1 min-w-0">
                <h2 className="text-[#e9edef] font-normal text-base truncate">
                  {selectedConversation.displayName}
                </h2>
                <p className="text-[#8696a0] text-xs truncate">
                  {selectedConversation.phone}
                </p>
              </div>
            </div>
            
            <div className="flex gap-1 flex-shrink-0">
              {[FaVideo, FaPhone, FaSearch, FaEllipsisV].map((Icon, i) => (
                <button 
                  key={i}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[#aebac1] hover:bg-[#202c33] transition-all"
                >
                  <Icon size={i === 3 ? 16 : 18} />
                </button>
              ))}
            </div>
          </div>

          {/* Messages Area - Scrollable */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto wa-scrollbar px-4 md:px-[8%] py-2 relative z-10"
          >
            {activeMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 rounded-full bg-[#202c33] flex items-center justify-center mb-4">
                  <HiSparkles className="text-[#00a884] text-2xl" />
                </div>
                <h3 className="text-[#e9edef] font-normal mb-1">Start the conversation</h3>
                <p className="text-[#8696a0] text-sm">
                  Send a message to {selectedConversation.displayName}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {activeMessages.map((msg, index) => {
                  const isIncoming = msg.direction === 'incoming';
                  const msgTime = getMessageTime(msg);
                  
                  // Detect message types for better display
                  const msgText = msg.text || msg.message || '';
                  const isInteractiveSent = (msg.messageType && ['flow_buttons', 'flow_catalog', 'order_bot_welcome'].includes(msg.messageType)) || msg.isInteractiveMessage;
                  const isInteractiveSelection = isIncoming && (msg.isInteractiveResponse || msg.interactiveType);
                  
                  // Common button selections
                  const buttonOptions = ['Browse Products', 'My Orders', 'Get Help', 'View Cart', 'Checkout', 'Add More', 'Clear Cart', 'Contact Support', 'Track Order', 'Continue Shopping', 'Main Menu', 'Confirm Order', 'Cancel'];
                  const isButtonSelection = isIncoming && msgText && buttonOptions.some(btn => msgText.includes(btn));
                  
                  // Product selection: Usually longer product names, or matches pattern
                  const isProductSelection = isIncoming && (
                    msgText.length > 10 && 
                    !buttonOptions.some(btn => msgText.includes(btn)) &&
                    !['hi', 'hello', 'catalog', 'browse', 'products', 'orders', 'help', 'yes', 'no'].includes(msgText.toLowerCase().trim())
                  );
                  
                  return (
                    <div
                      key={msg.id || index}
                      className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`relative max-w-[65%] px-3 py-1.5 shadow-sm ${
                          isIncoming ? 'wa-msg-incoming' : 'wa-msg-outgoing'
                        }`}
                      >
                        {/* Interactive element indicator for outgoing messages */}
                        {!isIncoming && isInteractiveSent && (
                          <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-white/10">
                            {msg.messageType === 'flow_catalog' && (
                              <>
                                <FaList className="text-[#00a884] text-xs" />
                                <span className="text-[#00a884] text-[10px] font-medium">Product List Sent</span>
                              </>
                            )}
                            {msg.messageType === 'flow_buttons' && (
                              <>
                                <FaMousePointer className="text-[#00a884] text-xs" />
                                <span className="text-[#00a884] text-[10px] font-medium">Interactive Buttons Sent</span>
                              </>
                            )}
                            {msg.messageType === 'order_bot_welcome' && (
                              <>
                                <FaRobot className="text-[#00a884] text-xs" />
                                <span className="text-[#00a884] text-[10px] font-medium">Welcome Menu Sent</span>
                              </>
                            )}
                          </div>
                        )}
                        
                        {/* Selection indicator for incoming messages */}
                        {isIncoming && (isInteractiveSelection || isButtonSelection || isProductSelection) && (
                          <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-white/10">
                            {isInteractiveSelection && msg.interactiveType === 'button' && (
                              <>
                                <FaMousePointer className="text-[#8696a0] text-xs" />
                                <span className="text-[#8696a0] text-[10px]">Clicked button</span>
                              </>
                            )}
                            {isInteractiveSelection && msg.interactiveType === 'list' && (
                              <>
                                <FaList className="text-[#00a884] text-xs" />
                                <span className="text-[#00a884] text-[10px]">Selected from list</span>
                              </>
                            )}
                            {!isInteractiveSelection && isButtonSelection && (
                              <>
                                <FaMousePointer className="text-[#8696a0] text-xs" />
                                <span className="text-[#8696a0] text-[10px]">Selected option</span>
                              </>
                            )}
                            {!isInteractiveSelection && isProductSelection && (
                              <>
                                <FaShoppingCart className="text-[#00a884] text-xs" />
                                <span className="text-[#00a884] text-[10px]">Product selected</span>
                              </>
                            )}
                          </div>
                        )}
                        
                        <p className="text-[#e9edef] text-sm leading-relaxed whitespace-pre-wrap">
                          {msgText}
                        </p>
                        
                        {/* System/automated message indicator */}
                        {msg.messageType && msg.messageType !== 'text' && !isInteractiveSent && (
                          <p className="text-[#8696a0] text-[10px] mt-1 italic">
                            {msg.messageType === 'cart_update' && '🛒 Cart updated'}
                            {msg.messageType === 'order_confirmed' && '✅ Order confirmed'}
                            {msg.messageType === 'cart_view' && '📦 Cart viewed'}
                            {msg.messageType === 'checkout' && '🛍️ Checkout initiated'}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="text-[11px] text-[#8696a0]">
                            {formatTime(msgTime)}
                          </span>
                          {!isIncoming && (
                            <span className={msg.read ? 'text-[#53bdeb]' : 'text-[#8696a0]'}>
                              {msg.read ? <FaCheckDouble size={12} /> : <FaCheck size={12} />}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="wa-input-area relative z-10 flex items-center gap-2">
            <button className="w-10 h-10 rounded-full flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33] transition-all flex-shrink-0">
              <FaRegSmile size={22} />
            </button>
            <button className="w-10 h-10 rounded-full flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33] transition-all flex-shrink-0">
              <FaPaperclip size={20} />
            </button>
            
            <div className="flex-1 wa-input-box">
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type a message"
                rows={1}
                className="w-full bg-transparent text-[#e9edef] px-4 py-2.5 text-sm focus:outline-none placeholder-[#8696a0] resize-none"
                style={{ minHeight: '42px', maxHeight: '100px' }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                }}
              />
            </div>

            {newMessage.trim() ? (
              <button
                onClick={handleSendMessage}
                disabled={sending}
                className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center hover:bg-[#06cf9c] transition-all flex-shrink-0"
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FaPaperPlane className="text-white text-base" />
                )}
              </button>
            ) : (
              <button className="w-10 h-10 rounded-full flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33] transition-all flex-shrink-0">
                <FaMicrophone size={20} />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Empty state - No conversation selected */
        <div className="wa-chat-area hidden md:flex flex-col items-center justify-center">
          <div className="wa-chat-bg" />
          <div className="relative z-10 text-center max-w-md px-6">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#00a884]/20 to-[#075e54]/10 flex items-center justify-center border border-[#00a884]/20">
              <FaComments className="text-[#00a884] text-4xl" />
            </div>
            <h1 className="text-[#e9edef] text-2xl font-medium mb-3">
              WhatsApp Web
            </h1>
            <p className="text-[#8696a0] text-sm leading-relaxed mb-6">
              Send and receive messages without keeping your phone online.
              <br />
              Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00a884]/10 border border-[#00a884]/20">
              <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse" />
              <span className="text-[#00a884] text-xs font-medium">End-to-end encrypted</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppInbox;
