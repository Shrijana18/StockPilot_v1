/**
 * WhatsApp Inbox - Two-Way Communication Hub
 * Manage incoming messages, respond, and track conversations
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { sendWhatsAppMessage, getWhatsAppConfig } from '../../../services/whatsappService';
import { toast } from 'react-toastify';

const WhatsAppInbox = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [retailers, setRetailers] = useState([]);

  const distributorId = auth.currentUser?.uid;

  // Fetch retailers for name mapping
  useEffect(() => {
    if (!distributorId) return;
    const retailersRef = collection(db, 'businesses', distributorId, 'connectedRetailers');
    getDocs(retailersRef).then(snapshot => {
      setRetailers(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        phone: (doc.data().phone || doc.data().retailerPhone || '').replace(/^\+/, '').replace(/^91/, ''),
        businessName: doc.data().businessName || doc.data().retailerName || '',
      })));
    }).catch(err => {
      console.error('Error fetching retailers:', err);
    });
  }, [distributorId]);

  useEffect(() => {
    if (!distributorId) return;

    // Listen to BOTH incoming and outgoing messages for unified view
    const inboxRef = collection(db, 'businesses', distributorId, 'whatsappInbox');
    const sentRef = collection(db, 'businesses', distributorId, 'whatsappMessages');
    
    const inboxQuery = query(inboxRef, orderBy('timestamp', 'desc'), limit(500));
    const sentQuery = query(sentRef, orderBy('createdAt', 'desc'), limit(500));
    
    let allMessages = [];
    const convMap = new Map();
    
    const updateConversations = () => {
      // Group all messages by phone number (conversations)
      allMessages.forEach(msg => {
        // Normalize phone number (remove +, handle both formats)
        const phone = msg.from?.replace(/^\+/, '') || msg.to?.replace(/^\+/, '') || '';
        if (!phone) return;
        
        const phoneKey = phone.startsWith('91') ? phone : `91${phone}`;
        
        if (!convMap.has(phoneKey)) {
          // Try to get retailer name from connectedRetailers
          const retailerName = retailers.find(r => {
            const rPhone = (r.phone || r.retailerPhone || '').replace(/^\+/, '').replace(/^91/, '');
            return rPhone === phone.replace(/^91/, '');
          })?.businessName || phone;
          
          convMap.set(phoneKey, {
            id: phoneKey,
            phone: phoneKey,
            phoneDisplay: phone,
            retailerName,
            lastMessage: msg.text || msg.message || '',
            lastMessageAt: msg.timestamp || msg.createdAt,
            unreadCount: msg.read === false ? 1 : 0,
            lastMessageId: msg.messageId || msg.id,
            direction: msg.from ? 'incoming' : 'outgoing',
          });
        } else {
          const conv = convMap.get(phoneKey);
          const msgTime = msg.timestamp?.toDate?.() || msg.createdAt?.toDate?.() || new Date(msg.timestamp || msg.createdAt || 0);
          const convTime = conv.lastMessageAt?.toDate?.() || new Date(conv.lastMessageAt || 0);
          
          if (msgTime > convTime) {
            conv.lastMessage = msg.text || msg.message || '';
            conv.lastMessageAt = msg.timestamp || msg.createdAt;
            conv.lastMessageId = msg.messageId || msg.id;
            conv.direction = msg.from ? 'incoming' : 'outgoing';
          }
          if (msg.read === false && msg.from) {
            conv.unreadCount++;
          }
        }
      });
      
      setConversations(Array.from(convMap.values()).sort((a, b) => {
        const aTime = a.lastMessageAt?.toDate?.() || new Date(a.lastMessageAt || 0);
        const bTime = b.lastMessageAt?.toDate?.() || new Date(b.lastMessageAt || 0);
        return bTime - aTime;
      }));
      
      // Update messages state for conversation view
      setMessages(allMessages);
      setLoading(false);
    };
    
    const unsubscribeInbox = onSnapshot(inboxQuery, (snapshot) => {
      const inboxMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        direction: 'incoming',
      }));
      
      allMessages = allMessages.filter(m => m.direction !== 'incoming');
      allMessages.push(...inboxMessages);
      updateConversations();
    }, (error) => {
      console.error('Error listening to inbox:', error);
    });
    
    const unsubscribeSent = onSnapshot(sentQuery, (snapshot) => {
      const sentMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          direction: 'outgoing',
          text: data.message || '',
          from: null,
          to: data.to?.replace(/^\+/, '') || '',
        };
      });
      
      allMessages = allMessages.filter(m => m.direction !== 'outgoing');
      allMessages.push(...sentMessages);
      updateConversations();
    }, (error) => {
      console.error('Error listening to sent messages:', error);
    });

    return () => {
      unsubscribeInbox();
      unsubscribeSent();
    };
  }, [distributorId, retailers]);

  const handleSendReply = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const config = await getWhatsAppConfig(distributorId);
      if (!config || !config.enabled) {
        toast.error('WhatsApp not configured');
        return;
      }

      const result = await sendWhatsAppMessage(
        distributorId,
        selectedConversation.phone,
        newMessage,
        {
          messageType: 'reply',
          metadata: {
            conversationId: selectedConversation.id,
            inReplyTo: selectedConversation.lastMessageId,
          },
        }
      );

      if (result.success) {
        // Log reply to conversation
        const conversationsRef = collection(db, 'businesses', distributorId, 'whatsappConversations');
        const convRef = doc(conversationsRef, selectedConversation.id);
        await updateDoc(convRef, {
          lastMessage: newMessage,
          lastMessageAt: serverTimestamp(),
          unreadCount: 0,
        });

        setNewMessage('');
        toast.success('Reply sent!');
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold">💬 WhatsApp Inbox</h3>
        <p className="text-xs text-gray-400">Manage incoming messages and conversations</p>
      </div>

      {/* Conversations List */}
      {conversations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-2xl font-bold mb-2">No Messages Yet</h3>
            <p className="text-gray-400 mb-6">
              Incoming WhatsApp messages will appear here once webhook fields are subscribed.
            </p>
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-200">
                <strong>Note:</strong> Make sure to subscribe to "messages" field in Meta App Dashboard → WhatsApp → Configuration → Webhook fields
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex">
          {/* Conversations Sidebar */}
          <div className="w-1/3 border-r border-white/10 overflow-y-auto">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`p-4 border-b border-white/10 cursor-pointer hover:bg-slate-800/50 ${
                  selectedConversation?.id === conv.id ? 'bg-slate-800/70' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold">{conv.phone}</p>
                  {conv.unreadCount > 0 && (
                    <span className="bg-emerald-500 text-white text-xs px-2 py-1 rounded-full">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 truncate">{conv.lastMessage}</p>
              </div>
            ))}
          </div>

          {/* Messages View */}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{selectedConversation.retailerName || selectedConversation.phone}</h4>
                    <p className="text-xs text-gray-400">{selectedConversation.phone}</p>
                  </div>
                  <button
                    onClick={() => {
                      // Mark all messages as read
                      const unreadMessages = messages.filter(m => {
                        const msgPhone = (m.from || m.to || '').replace(/^\+/, '').replace(/^91/, '');
                        const convPhone = selectedConversation.phone.replace(/^\+/, '').replace(/^91/, '');
                        return (msgPhone === convPhone || msgPhone === convPhone.replace(/^91/, '')) && m.read === false;
                      });
                      unreadMessages.forEach(msg => {
                        const msgRef = doc(db, 'businesses', distributorId, 'whatsappInbox', msg.id);
                        updateDoc(msgRef, { read: true });
                      });
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    Mark as read
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {(() => {
                    // Get all messages for this conversation (both incoming and outgoing)
                    const conversationMessages = messages
                      .filter(msg => {
                        const msgPhone = (msg.from || msg.to || '').replace(/^\+/, '').replace(/^91/, '');
                        const convPhone = selectedConversation.phone.replace(/^\+/, '').replace(/^91/, '');
                        return msgPhone === convPhone || msgPhone === convPhone.replace(/^91/, '');
                      })
                      .sort((a, b) => {
                        const aTime = a.timestamp?.toDate?.() || a.createdAt?.toDate?.() || new Date(a.receivedAt || a.createdAt || 0);
                        const bTime = b.timestamp?.toDate?.() || b.createdAt?.toDate?.() || new Date(b.receivedAt || b.createdAt || 0);
                        return aTime - bTime;
                      });
                    
                    return conversationMessages.map((msg) => {
                      const isIncoming = msg.direction === 'incoming' || msg.from;
                      const msgTime = msg.timestamp?.toDate?.() || msg.createdAt?.toDate?.() || new Date(msg.receivedAt || msg.createdAt || 0);
                      
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              isIncoming
                                ? 'bg-slate-800/70 rounded-tl-none'
                                : 'bg-emerald-600 rounded-tr-none'
                            }`}
                          >
                            <p className="text-sm text-white">{msg.text || msg.message}</p>
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <p className="text-xs text-white/60">
                                {msgTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {!isIncoming && (
                                <span className="text-xs">
                                  {msg.status === 'sent' ? '✓' : msg.status === 'delivered' ? '✓✓' : msg.status === 'read' ? '✓✓' : '⏱'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div className="p-4 border-t border-white/10">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
                      placeholder="Type a reply..."
                      className="flex-1 bg-slate-800/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={sending || !newMessage.trim()}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                    >
                      {sending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-400">Select a conversation to view messages</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppInbox;

