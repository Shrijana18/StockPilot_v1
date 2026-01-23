/**
 * OrderChat - Chat between retailer/delivery agent and customer
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  FaTimes, FaPaperPlane, FaUser, FaMotorcycle,
  FaCheckDouble, FaCheck, FaPhone, FaStore
} from 'react-icons/fa';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';

const OrderChat = ({ order, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [senderRole, setSenderRole] = useState('store'); // 'store' or 'delivery'
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to chat messages
  useEffect(() => {
    if (!order?.id) return;

    // Create chat document if it doesn't exist
    const initChat = async () => {
      const chatDocRef = doc(db, 'orderChats', order.id);
      try {
        await setDoc(chatDocRef, {
          orderId: order.id,
          orderNumber: order.orderNumber || order.id.slice(-8),
          customerId: order.customerId,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          storeId: order.storeId,
          storeName: order.storeName,
          deliveryAgent: order.deliveryAgent || null,
          createdAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        console.error('Error initializing chat:', error);
      }
    };
    initChat();

    const chatRef = collection(db, 'orderChats', order.id, 'messages');
    const q = query(chatRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      setMessages(chatMessages);
    }, (error) => {
      console.error('Error fetching chat:', error);
    });

    return () => unsubscribe();
  }, [order?.id]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const chatRef = collection(db, 'orderChats', order.id, 'messages');
      
      // Determine sender name based on role
      const senderName = senderRole === 'delivery' 
        ? (order.deliveryAgent?.name || 'Delivery Agent')
        : (order.storeName || 'Store');

      await addDoc(chatRef, {
        text: messageText,
        senderId: auth.currentUser?.uid || 'store',
        senderName: senderName,
        senderType: senderRole, // 'store' or 'delivery'
        createdAt: serverTimestamp(),
        read: false
      });

      // Update last message in order chat metadata
      const chatMetaRef = doc(db, 'orderChats', order.id);
      await setDoc(chatMetaRef, {
        lastMessage: messageText,
        lastMessageAt: serverTimestamp(),
        lastMessageBy: senderRole
      }, { merge: true });

    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageText);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Format time
  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Quick messages for store/delivery
  const quickMessages = senderRole === 'delivery' 
    ? [
        "I'm on my way",
        "Arriving in 5 minutes",
        "I'm at your location",
        "Please come to collect",
        "Unable to reach you"
      ]
    : [
        "Order is being prepared",
        "Order will be ready soon",
        "Delivery partner assigned",
        "Please provide landmark",
        "Thank you for ordering!"
      ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-slate-900 rounded-2xl w-full max-w-md h-[85vh] max-h-[700px] flex flex-col overflow-hidden shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white text-lg">
                {order.customerName?.charAt(0)?.toUpperCase() || <FaUser />}
              </div>
              <div className="text-white">
                <h3 className="font-semibold text-base">{order.customerName || 'Customer'}</h3>
                <p className="text-xs text-white/70">Order #{order.id?.slice(-6).toUpperCase()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {order.customerPhone && (
                <a
                  href={`tel:${order.customerPhone}`}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-all hover:scale-105"
                >
                  <FaPhone className="text-sm" />
                </a>
              )}
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-red-500/50 transition-all hover:scale-105"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          {/* Sender Role Toggle - Inside Header */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-white/60 text-xs">Reply as:</span>
            <div className="flex gap-2 flex-1">
              <button
                onClick={() => setSenderRole('store')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  senderRole === 'store'
                    ? 'bg-white text-emerald-600 shadow-lg'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                <FaStore className="text-xs" />
                Store
              </button>
              {order.deliveryAgent && (
                <button
                  onClick={() => setSenderRole('delivery')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    senderRole === 'delivery'
                      ? 'bg-white text-cyan-600 shadow-lg'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  <FaMotorcycle className="text-xs" />
                  {order.deliveryAgent.name?.split(' ')[0] || 'Delivery'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-800/50" style={{ 
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.03) 0%, transparent 50%)'
        }}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center mb-4">
                <FaUser className="text-3xl text-emerald-400/60" />
              </div>
              <h3 className="font-semibold text-white text-lg mb-2">Start the conversation</h3>
              <p className="text-sm text-white/50 max-w-xs leading-relaxed">
                Send order updates or coordinate delivery with the customer
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const isCustomer = msg.senderType === 'customer';
                const isDelivery = msg.senderType === 'delivery';
                
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-md ${
                        isCustomer
                          ? 'bg-slate-700 text-white rounded-tl-sm'
                          : isDelivery
                          ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-tr-sm'
                          : 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-tr-sm'
                      }`}
                    >
                      <p className={`text-xs font-medium mb-1 ${
                        isCustomer ? 'text-emerald-400' : 'text-white/80'
                      }`}>
                        {isCustomer ? (msg.senderName || 'Customer') : msg.senderName}
                      </p>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                      <div className={`flex items-center justify-end gap-1.5 mt-2 ${
                        isCustomer ? 'text-white/50' : 'text-white/70'
                      }`}>
                        <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                        {!isCustomer && (
                          msg.read 
                            ? <FaCheckDouble className="text-[10px]" />
                            : <FaCheck className="text-[10px]" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Quick Messages - Collapsible */}
        {showQuickReplies && (
          <div className="px-3 py-2 bg-slate-800 border-t border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/40 uppercase tracking-wide">Quick Replies</span>
              <button 
                onClick={() => setShowQuickReplies(false)}
                className="text-white/30 hover:text-white/60 text-xs"
              >
                Hide
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {quickMessages.map((msg, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setNewMessage(msg);
                    setShowQuickReplies(false);
                  }}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-white/70 whitespace-nowrap transition-all hover:border-emerald-500/50 hover:text-emerald-400"
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="bg-slate-900 border-t border-white/10 px-3 py-3">
          <div className="flex items-center gap-2">
            {!showQuickReplies && (
              <button
                onClick={() => setShowQuickReplies(true)}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white/80 transition-all text-lg"
                title="Quick replies"
              >
                ⚡
              </button>
            )}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => setShowQuickReplies(false)}
                placeholder={`Type a message...`}
                className="w-full px-4 py-3 bg-white/5 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 border border-white/10 focus:border-emerald-500/50 transition-all text-sm"
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                newMessage.trim()
                  ? senderRole === 'delivery' 
                    ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105' 
                    : 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
            >
              <FaPaperPlane className={`text-sm ${sending ? 'animate-pulse' : ''}`} />
            </button>
          </div>
          
          {/* Typing indicator */}
          <div className="mt-2 flex items-center justify-center">
            <span className={`text-[10px] transition-all ${
              senderRole === 'delivery' ? 'text-cyan-400/60' : 'text-emerald-400/60'
            }`}>
              Replying as {senderRole === 'delivery' ? (order.deliveryAgent?.name || 'Delivery Agent') : 'Store'}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default OrderChat;
