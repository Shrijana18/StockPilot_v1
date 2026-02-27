/**
 * EmployeeDeliveryChat - Chat interface for employees to communicate with customers during delivery
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  FaTimes, FaPaperPlane, FaUser, FaPhone,
  FaCheckDouble, FaCheck
} from 'react-icons/fa';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db, empAuth } from '../../firebase/firebaseConfig';
import { getEmployeeSession } from '../../utils/employeeSession';

const EmployeeDeliveryChat = ({ order, employee, onClose }) => {
  const session = getEmployeeSession();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
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
    if (!order?.orderId && !order?.id) return;

    const orderId = order.orderId || order.id;

    // Create chat document if it doesn't exist
    const initChat = async () => {
      const chatDocRef = doc(db, 'orderChats', orderId);
      try {
        await setDoc(chatDocRef, {
          orderId: orderId,
          orderNumber: order.orderData?.orderNumber || orderId.slice(-8),
          customerId: order.orderData?.customerId || order.customerId,
          customerName: order.orderData?.customerName || order.customerName || 'Customer',
          customerPhone: order.orderData?.customerPhone || order.customerPhone,
          storeId: session?.retailerId,
          storeName: order.orderData?.storeName || 'Store',
          deliveryAgent: {
            id: session?.employeeId,
            name: employee?.name || 'Delivery Agent',
            flypEmployeeId: employee?.flypEmployeeId || session?.employeeId
          },
          createdAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        console.error('Error initializing chat:', error);
      }
    };
    initChat();

    const chatRef = collection(db, 'orderChats', orderId, 'messages');
    const q = query(chatRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      setMessages(chatMessages);

      // Mark messages as read when employee views them
      const unreadMessages = chatMessages.filter(
        msg => msg.senderType === 'customer' && !msg.read
      );
      if (unreadMessages.length > 0) {
        unreadMessages.forEach(msg => {
          updateDoc(doc(db, 'orderChats', orderId, 'messages', msg.id), {
            read: true
          }).catch(console.error);
        });
      }
    }, (error) => {
      console.error('Error fetching chat:', error);
    });

    return () => unsubscribe();
  }, [order?.orderId, order?.id, session, employee]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const orderId = order.orderId || order.id;
      const chatRef = collection(db, 'orderChats', orderId, 'messages');
      
      await addDoc(chatRef, {
        text: messageText,
        senderId: session?.employeeId || empAuth.currentUser?.uid || 'employee',
        senderName: employee?.name || 'Delivery Agent',
        senderType: 'delivery',
        createdAt: serverTimestamp(),
        read: false
      });

      // Update last message in order chat metadata
      const chatMetaRef = doc(db, 'orderChats', orderId);
      await setDoc(chatMetaRef, {
        lastMessage: messageText,
        lastMessageAt: serverTimestamp(),
        lastMessageBy: 'delivery'
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

  // Quick messages for delivery agents
  const quickMessages = [
    "I'm on my way",
    "Arriving in 5 minutes",
    "I'm at your location",
    "Please come to collect",
    "Unable to reach you",
    "Call me when you're ready"
  ];

  const customerName = order.orderData?.customerName || order.customerName || 'Customer';
  const customerPhone = order.orderData?.customerPhone || order.customerPhone;
  const orderId = order.orderId || order.id;

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
        <div className="bg-gradient-to-r from-cyan-600 to-emerald-500 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white text-lg">
                {customerName?.charAt(0)?.toUpperCase() || <FaUser />}
              </div>
              <div className="text-white">
                <h3 className="font-semibold text-base">{customerName}</h3>
                <p className="text-xs text-white/70">
                  Order #{order.orderData?.orderNumber || orderId?.slice(-8)?.toUpperCase()}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {customerPhone && (
                <a
                  href={`tel:${customerPhone}`}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-all hover:scale-105"
                  title="Call customer"
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
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-800/50" style={{ 
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.03) 0%, transparent 50%)'
        }}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 flex items-center justify-center mb-4">
                <FaUser className="text-3xl text-cyan-400/60" />
              </div>
              <h3 className="font-semibold text-white text-lg mb-2">Start the conversation</h3>
              <p className="text-sm text-white/50 max-w-xs leading-relaxed">
                Coordinate delivery with the customer
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
                          : 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-tr-sm'
                      }`}
                    >
                      <p className={`text-xs font-medium mb-1 ${
                        isCustomer ? 'text-emerald-400' : 'text-white/80'
                      }`}>
                        {isCustomer ? (msg.senderName || 'Customer') : (msg.senderName || 'You')}
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
                    inputRef.current?.focus();
                  }}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-white/70 whitespace-nowrap transition-all hover:border-cyan-500/50 hover:text-cyan-400"
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
                placeholder="Type a message..."
                className="w-full px-4 py-3 bg-white/5 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 border border-white/10 focus:border-cyan-500/50 transition-all text-sm"
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                newMessage.trim()
                  ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105' 
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
            >
              <FaPaperPlane className={`text-sm ${sending ? 'animate-pulse' : ''}`} />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EmployeeDeliveryChat;
