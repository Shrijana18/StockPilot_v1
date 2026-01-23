/**
 * DeliveryChat - Dark theme chat between customer and delivery agent
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaArrowLeft, FaPaperPlane, FaPhone, FaUser, FaMotorcycle,
  FaTimes, FaCheckDouble, FaCheck
} from 'react-icons/fa';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { useCustomerAuth } from '../context/CustomerAuthContext';

const DeliveryChat = ({ order, onClose }) => {
  const { customer, customerData } = useCustomerAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
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
      await addDoc(chatRef, {
        text: messageText,
        senderId: customer?.uid || 'customer',
        senderName: customerData?.name || 'Customer',
        senderType: 'customer',
        createdAt: serverTimestamp(),
        read: false
      });

      // Update last message in order chat metadata
      const chatMetaRef = doc(db, 'orderChats', order.id);
      await updateDoc(chatMetaRef, {
        lastMessage: messageText,
        lastMessageAt: serverTimestamp(),
        lastMessageBy: 'customer'
      }).catch(() => {
        // If doc doesn't exist, that's okay - it will be created by first message
      });

    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageText); // Restore message on error
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

  // Quick messages
  const quickMessages = [
    "Where are you?",
    "How long?",
    "I'm outside",
    "Call me",
    "Wait please"
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed inset-0 bg-[#060D2D] z-50 flex flex-col"
    >
      {/* Header */}
      <div 
        className="bg-gradient-to-r from-[#05E06C] to-[#04B857] text-white px-4 py-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all"
          >
            <FaArrowLeft />
          </button>
          
          <div className="flex-1 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-lg">
              <FaMotorcycle />
            </div>
            <div>
              <h2 className="font-semibold text-base">
                {order.deliveryAgent?.name || order.deliveryPartner || 'Delivery Partner'}
              </h2>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse"></span>
                <p className="text-xs text-white/80">
                  {order.status === 'out_for_delivery' ? 'On the way' : 'Delivery Agent'}
                </p>
              </div>
            </div>
          </div>

          {/* Call Button */}
          {(order.deliveryAgent?.phone || order.deliveryPartnerPhone) && (
            <a
              href={`tel:${order.deliveryAgent?.phone || order.deliveryPartnerPhone}`}
              className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-emerald-600 shadow-lg hover:scale-105 transition-all"
            >
              <FaPhone />
            </a>
          )}
        </div>

        {/* Delivery Info Pill */}
        {order.deliveryAgent?.vehicleNumber && (
          <div className="mt-3 inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5 text-xs">
            <FaMotorcycle className="text-white/70" />
            <span>{order.deliveryAgent.vehicleNumber}</span>
            <span className="text-white/50">•</span>
            <span className="text-white/70">Order #{order.orderNumber?.slice(-6) || order.id?.slice(-6)}</span>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#0A1340]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-[#05E06C]/20 flex items-center justify-center mb-4">
              <FaMotorcycle className="text-3xl text-emerald-400" />
            </div>
            <h3 className="font-semibold text-white text-lg mb-2">Chat with your delivery agent</h3>
            <p className="text-sm text-white/40 max-w-xs leading-relaxed">
              Coordinate delivery or share your location details
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isCustomer = msg.senderType === 'customer';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      isCustomer
                        ? 'bg-gradient-to-br from-[#05E06C] to-[#04B857] text-white rounded-tr-sm shadow-lg shadow-[#05E06C]/20'
                        : 'bg-[#101B4A] border border-white/10 text-white rounded-tl-sm'
                    }`}
                  >
                    {!isCustomer && (
                      <p className="text-xs font-medium text-emerald-400 mb-1">
                        {msg.senderName}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <div className={`flex items-center justify-end gap-1.5 mt-2 ${
                      isCustomer ? 'text-white/70' : 'text-white/40'
                    }`}>
                      <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                      {isCustomer && (
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

      {/* Quick Messages */}
      <div className="px-4 py-2 bg-[#060D2D] border-t border-white/5">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {quickMessages.map((msg, idx) => (
            <button
              key={idx}
              onClick={() => setNewMessage(msg)}
              className="px-4 py-2 bg-[#101B4A] hover:bg-emerald-500/10 border border-white/10 hover:border-[#05E06C]/30 rounded-full text-sm text-white/70 hover:text-emerald-400 whitespace-nowrap transition-all"
            >
              {msg}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div 
        className="bg-[#060D2D] border-t border-white/5 px-4 py-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-5 py-3.5 bg-[#101B4A] rounded-full text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-white/10 focus:border-[#05E06C]/50 transition-all text-sm"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              newMessage.trim()
                ? 'bg-gradient-to-br from-[#05E06C] to-[#04B857] text-white shadow-lg shadow-[#05E06C]/30 hover:shadow-[#05E06C]/50 hover:scale-105'
                : 'bg-[#101B4A] text-white/30 border border-white/10'
            }`}
          >
            <FaPaperPlane className={`text-sm ${sending ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default DeliveryChat;
