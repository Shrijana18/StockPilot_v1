/**
 * FlowBuilder - Visual Conversation Flow Designer
 * Create automated WhatsApp conversation flows with drag-and-drop interface
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, query, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, onSnapshot, serverTimestamp, orderBy 
} from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';
import { 
  FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaRobot, FaPlay, FaPause,
  FaComments, FaShoppingCart, FaBoxes, FaTruck, FaHeadset, FaArrowRight,
  FaCog, FaCopy, FaEye, FaChevronDown, FaChevronUp, FaMagic, FaLink, FaList
} from 'react-icons/fa';
import { HiSparkles, HiLightningBolt } from 'react-icons/hi';

// Flow node types
const NODE_TYPES = {
  TRIGGER: 'trigger',
  MESSAGE: 'message', 
  BUTTONS: 'buttons',
  LIST: 'list',
  ACTION: 'action',
  CONDITION: 'condition',
};

// Pre-built action types
const ACTION_TYPES = {
  VIEW_ORDERS: 'view_orders',
  CREATE_ORDER: 'create_order',
  BROWSE_CATALOG: 'browse_catalog',
  TRACK_ORDER: 'track_order',
  CONTACT_SUPPORT: 'contact_support',
  VIEW_PRODUCTS: 'view_products',
  CUSTOM: 'custom',
};

// Pre-built templates
const FLOW_TEMPLATES = [
  {
    id: 'welcome',
    name: 'Welcome Flow',
    description: 'Greet customers and show main menu',
    icon: '👋',
    nodes: [
      { type: NODE_TYPES.TRIGGER, keywords: ['hi', 'hello', 'hey', 'start'] },
      { type: NODE_TYPES.MESSAGE, text: 'Welcome to {business_name}! How can I help you today?' },
      { type: NODE_TYPES.BUTTONS, buttons: [
        { label: '🛒 Browse Products', action: ACTION_TYPES.BROWSE_CATALOG },
        { label: '📦 My Orders', action: ACTION_TYPES.VIEW_ORDERS },
        { label: '💬 Get Help', action: ACTION_TYPES.CONTACT_SUPPORT },
      ]},
    ],
  },
  {
    id: 'order_flow',
    name: 'Order Assistant',
    description: 'Help customers create and track orders',
    icon: '🛒',
    nodes: [
      { type: NODE_TYPES.TRIGGER, keywords: ['order', 'buy', 'purchase'] },
      { type: NODE_TYPES.MESSAGE, text: 'I can help you with orders! What would you like to do?' },
      { type: NODE_TYPES.BUTTONS, buttons: [
        { label: '➕ New Order', action: ACTION_TYPES.CREATE_ORDER },
        { label: '📋 View Orders', action: ACTION_TYPES.VIEW_ORDERS },
        { label: '🚚 Track Delivery', action: ACTION_TYPES.TRACK_ORDER },
      ]},
    ],
  },
  {
    id: 'catalog_flow',
    name: 'Product Catalog',
    description: 'Show products from your inventory',
    icon: '📦',
    nodes: [
      { type: NODE_TYPES.TRIGGER, keywords: ['products', 'catalog', 'menu', 'items'] },
      { type: NODE_TYPES.MESSAGE, text: 'Here are our product categories:' },
      { type: NODE_TYPES.LIST, action: ACTION_TYPES.VIEW_PRODUCTS },
    ],
  },
  {
    id: 'support_flow',
    name: 'Customer Support',
    description: 'Handle support queries',
    icon: '🎧',
    nodes: [
      { type: NODE_TYPES.TRIGGER, keywords: ['help', 'support', 'issue', 'problem'] },
      { type: NODE_TYPES.MESSAGE, text: 'I\'m here to help! What do you need assistance with?' },
      { type: NODE_TYPES.BUTTONS, buttons: [
        { label: '📦 Order Issue', action: 'order_support' },
        { label: '💰 Payment Help', action: 'payment_support' },
        { label: '👤 Talk to Human', action: ACTION_TYPES.CONTACT_SUPPORT },
      ]},
    ],
  },
  {
    id: 'order_status_flow',
    name: 'Order Status',
    description: 'Check order status and tracking',
    icon: '🚚',
    nodes: [
      { type: NODE_TYPES.TRIGGER, keywords: ['status', 'track', 'tracking', 'where'] },
      { type: NODE_TYPES.MESSAGE, text: 'I can help you check your order status! 📦\n\nPlease provide your order ID, or I can show your recent orders.' },
      { type: NODE_TYPES.BUTTONS, buttons: [
        { label: '📋 Recent Orders', action: ACTION_TYPES.VIEW_ORDERS },
        { label: '🔍 Track by ID', action: ACTION_TYPES.TRACK_ORDER },
        { label: '🏠 Main Menu', action: 'main_menu' },
      ]},
    ],
  },
  {
    id: 'payment_reminder_flow',
    name: 'Payment Reminder',
    description: 'Send payment reminders to customers',
    icon: '💳',
    nodes: [
      { type: NODE_TYPES.TRIGGER, keywords: ['payment', 'pay', 'pending', 'due', 'credit'] },
      { type: NODE_TYPES.MESSAGE, text: '💰 *Payment Information*\n\nI can help you with payment-related queries. What would you like to know?' },
      { type: NODE_TYPES.BUTTONS, buttons: [
        { label: '📋 Pending Payments', action: 'view_pending_payments' },
        { label: '💰 Pay Now', action: 'make_payment' },
        { label: '💳 Payment History', action: 'payment_history' },
      ]},
    ],
  },
];

const FlowBuilder = () => {
  const [flows, setFlows] = useState([]);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [expandedNode, setExpandedNode] = useState(null);
  const [quickSetupLoading, setQuickSetupLoading] = useState(false);

  const distributorId = auth.currentUser?.uid;

  // Calculate bot status
  const activeFlows = flows.filter(f => f.isActive);
  const botStatus = {
    totalFlows: flows.length,
    activeFlows: activeFlows.length,
    hasWelcome: flows.some(f => f.triggerKeywords?.some(k => ['hi', 'hello', 'start'].includes(k?.toLowerCase()))),
    hasOrder: flows.some(f => f.triggerKeywords?.some(k => ['order', 'buy', 'products', 'browse'].includes(k?.toLowerCase()))),
  };

  // Quick setup - creates essential flows
  const handleQuickSetup = async () => {
    if (!distributorId) return;
    setQuickSetupLoading(true);

    try {
      const flowsRef = collection(db, 'businesses', distributorId, 'whatsappFlows');
      
      // Check existing flows
      const existingFlows = await getDocs(flowsRef);
      const existingKeywords = existingFlows.docs.flatMap(doc => doc.data().triggerKeywords || []).map(k => k?.toLowerCase());
      
      let createdCount = 0;

      // Create Welcome Flow if missing
      if (!existingKeywords.some(k => ['hi', 'hello', 'start'].includes(k))) {
        await addDoc(flowsRef, {
          name: 'Welcome Flow',
          description: 'Greets customers and shows main menu',
          isActive: true,
          triggerKeywords: ['hi', 'hello', 'hey', 'start', 'menu', 'hii'],
          nodes: [
            { id: 'msg1', type: 'message', text: 'Welcome to {business_name}! 👋\n\nHow can I help you today?' },
            { id: 'btn1', type: 'buttons', text: 'Please select an option:', buttons: [
              { label: '🛒 Browse Products', action: 'browse_products' },
              { label: '📦 My Orders', action: 'view_orders' },
              { label: '💬 Get Help', action: 'contact_support' }
            ]}
          ],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        createdCount++;
      }

      // Create Order Flow if missing
      if (!existingKeywords.some(k => ['order', 'buy', 'products', 'browse'].includes(k))) {
        await addDoc(flowsRef, {
          name: 'Order Flow',
          description: 'Helps customers browse and order products',
          isActive: true,
          triggerKeywords: ['order', 'buy', 'purchase', 'products', 'catalog', 'browse'],
          nodes: [
            { id: 'msg1', type: 'message', text: 'Let me help you place an order! 🛒' },
            { id: 'list1', type: 'list', action: 'view_products', title: 'Our Products' }
          ],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        createdCount++;
      }

      // Create Support Flow if missing
      if (!existingKeywords.some(k => ['help', 'support'].includes(k))) {
        await addDoc(flowsRef, {
          name: 'Support Flow',
          description: 'Handles customer support requests',
          isActive: true,
          triggerKeywords: ['help', 'support', 'issue', 'problem'],
          nodes: [
            { id: 'msg1', type: 'message', text: "I'm here to help! What do you need assistance with?" },
            { id: 'btn1', type: 'buttons', text: 'Select an option:', buttons: [
              { label: '📦 Order Issue', action: 'order_support' },
              { label: '💰 Payment Help', action: 'payment_support' },
              { label: '👤 Talk to Human', action: 'contact_support' }
            ]}
          ],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        createdCount++;
      }

      if (createdCount > 0) {
        toast.success(`Created ${createdCount} essential flow${createdCount > 1 ? 's' : ''}! Your bot is ready.`);
      } else {
        toast.info('All essential flows already exist!');
      }
    } catch (error) {
      console.error('Quick setup error:', error);
      toast.error('Failed to create flows');
    } finally {
      setQuickSetupLoading(false);
    }
  };

  // Form state for new/edit flow
  const [flowData, setFlowData] = useState({
    name: '',
    description: '',
    isActive: true,
    triggerKeywords: [],
    nodes: [],
  });

  const [newKeyword, setNewKeyword] = useState('');

  // Load flows from Firestore
  useEffect(() => {
    if (!distributorId) return;

    const flowsRef = collection(db, 'businesses', distributorId, 'whatsappFlows');
    const q = query(flowsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const flowsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFlows(flowsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [distributorId]);

  // Save flow
  const handleSaveFlow = async () => {
    if (!flowData.name) {
      toast.error('Please enter a flow name');
      return;
    }

    if (flowData.triggerKeywords.length === 0) {
      toast.error('Please add at least one trigger keyword');
      return;
    }

    if (flowData.nodes.length === 0) {
      toast.error('Please add at least one node to the flow');
      return;
    }

    setSaving(true);
    try {
      const data = {
        ...flowData,
        updatedAt: serverTimestamp(),
      };

      if (selectedFlow) {
        await updateDoc(doc(db, 'businesses', distributorId, 'whatsappFlows', selectedFlow.id), data);
        toast.success('Flow updated successfully!');
      } else {
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'businesses', distributorId, 'whatsappFlows'), data);
        toast.success('Flow created successfully!');
      }

      setShowCreateModal(false);
      setSelectedFlow(null);
      resetForm();
    } catch (error) {
      console.error('Error saving flow:', error);
      toast.error('Failed to save flow');
    } finally {
      setSaving(false);
    }
  };

  // Delete flow
  const handleDeleteFlow = async (flowId) => {
    if (!confirm('Are you sure you want to delete this flow?')) return;

    try {
      await deleteDoc(doc(db, 'businesses', distributorId, 'whatsappFlows', flowId));
      toast.success('Flow deleted successfully!');
    } catch (error) {
      console.error('Error deleting flow:', error);
      toast.error('Failed to delete flow');
    }
  };

  // Toggle flow active status
  const handleToggleActive = async (flow) => {
    try {
      await updateDoc(doc(db, 'businesses', distributorId, 'whatsappFlows', flow.id), {
        isActive: !flow.isActive,
        updatedAt: serverTimestamp(),
      });
      toast.success(flow.isActive ? 'Flow paused' : 'Flow activated');
    } catch (error) {
      console.error('Error toggling flow:', error);
      toast.error('Failed to update flow');
    }
  };

  // Reset form
  const resetForm = () => {
    setFlowData({
      name: '',
      description: '',
      isActive: true,
      triggerKeywords: [],
      nodes: [],
    });
    setNewKeyword('');
  };

  // Add keyword
  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    if (flowData.triggerKeywords.includes(newKeyword.toLowerCase().trim())) {
      toast.warning('Keyword already added');
      return;
    }
    setFlowData(prev => ({
      ...prev,
      triggerKeywords: [...prev.triggerKeywords, newKeyword.toLowerCase().trim()],
    }));
    setNewKeyword('');
  };

  // Remove keyword
  const removeKeyword = (keyword) => {
    setFlowData(prev => ({
      ...prev,
      triggerKeywords: prev.triggerKeywords.filter(k => k !== keyword),
    }));
  };

  // Add node
  const addNode = (type, data = {}) => {
    const newNode = {
      id: Date.now().toString(),
      type,
      ...data,
    };

    switch (type) {
      case NODE_TYPES.MESSAGE:
        newNode.text = data.text || '';
        break;
      case NODE_TYPES.BUTTONS:
        newNode.buttons = data.buttons || [{ label: '', action: '' }];
        break;
      case NODE_TYPES.LIST:
        newNode.title = data.title || 'Select an option';
        newNode.items = data.items || [];
        newNode.action = data.action || '';
        break;
      case NODE_TYPES.ACTION:
        newNode.actionType = data.actionType || ACTION_TYPES.CUSTOM;
        newNode.customAction = data.customAction || '';
        break;
    }

    setFlowData(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
  };

  // Update node
  const updateNode = (nodeId, updates) => {
    setFlowData(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => 
        node.id === nodeId ? { ...node, ...updates } : node
      ),
    }));
  };

  // Delete node
  const deleteNode = (nodeId) => {
    setFlowData(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== nodeId),
    }));
  };

  // Move node up/down
  const moveNode = (nodeId, direction) => {
    const index = flowData.nodes.findIndex(n => n.id === nodeId);
    if ((direction === 'up' && index === 0) || 
        (direction === 'down' && index === flowData.nodes.length - 1)) return;

    const newNodes = [...flowData.nodes];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newNodes[index], newNodes[newIndex]] = [newNodes[newIndex], newNodes[index]];
    
    setFlowData(prev => ({ ...prev, nodes: newNodes }));
  };

  // Use template
  const useTemplate = (template) => {
    setFlowData({
      name: template.name,
      description: template.description,
      isActive: true,
      triggerKeywords: template.nodes[0]?.keywords || [],
      nodes: template.nodes.slice(1).map((node, idx) => ({
        id: Date.now().toString() + idx,
        ...node,
      })),
    });
    setShowTemplates(false);
    setShowCreateModal(true);
  };

  // Edit flow
  const handleEditFlow = (flow) => {
    setSelectedFlow(flow);
    setFlowData({
      name: flow.name || '',
      description: flow.description || '',
      isActive: flow.isActive !== false,
      triggerKeywords: flow.triggerKeywords || [],
      nodes: flow.nodes || [],
    });
    setShowCreateModal(true);
  };

  // Render node editor
  const renderNodeEditor = (node, index) => {
    const isExpanded = expandedNode === node.id;

    return (
      <motion.div
        key={node.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-[#202c33] rounded-xl border border-[#2a3942] overflow-hidden"
      >
        {/* Node Header */}
        <div 
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#2a3942] transition-colors"
          onClick={() => setExpandedNode(isExpanded ? null : node.id)}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00a884]/20 flex items-center justify-center">
              {node.type === NODE_TYPES.MESSAGE && <FaComments className="text-[#00a884]" />}
              {node.type === NODE_TYPES.BUTTONS && <FaList className="text-[#00a884]" />}
              {node.type === NODE_TYPES.LIST && <FaBoxes className="text-[#00a884]" />}
              {node.type === NODE_TYPES.ACTION && <HiLightningBolt className="text-[#00a884]" />}
            </div>
            <div>
              <p className="text-white text-sm font-medium">
                {node.type === NODE_TYPES.MESSAGE && 'Message'}
                {node.type === NODE_TYPES.BUTTONS && 'Quick Reply Buttons'}
                {node.type === NODE_TYPES.LIST && 'List Menu'}
                {node.type === NODE_TYPES.ACTION && 'Action'}
              </p>
              <p className="text-[#8696a0] text-xs">Step {index + 1}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); moveNode(node.id, 'up'); }}
              className="p-1.5 rounded hover:bg-[#374248] text-[#8696a0] hover:text-white transition-colors"
              disabled={index === 0}
            >
              <FaChevronUp size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); moveNode(node.id, 'down'); }}
              className="p-1.5 rounded hover:bg-[#374248] text-[#8696a0] hover:text-white transition-colors"
              disabled={index === flowData.nodes.length - 1}
            >
              <FaChevronDown size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
              className="p-1.5 rounded hover:bg-red-500/20 text-[#8696a0] hover:text-red-400 transition-colors"
            >
              <FaTrash size={12} />
            </button>
            {isExpanded ? <FaChevronUp className="text-[#8696a0]" /> : <FaChevronDown className="text-[#8696a0]" />}
          </div>
        </div>

        {/* Node Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-[#2a3942]"
            >
              <div className="p-4 space-y-4">
                {/* Message Node */}
                {node.type === NODE_TYPES.MESSAGE && (
                  <div>
                    <label className="block text-[#8696a0] text-xs mb-2">Message Text</label>
                    <textarea
                      value={node.text || ''}
                      onChange={(e) => updateNode(node.id, { text: e.target.value })}
                      placeholder="Enter your message... Use {customer_name}, {business_name} for variables"
                      className="w-full bg-[#2a3942] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#00a884] min-h-[80px] resize-none placeholder-[#8696a0]"
                    />
                    <p className="text-[#8696a0] text-xs mt-1">
                      Variables: {'{customer_name}'}, {'{business_name}'}, {'{order_id}'}
                    </p>
                  </div>
                )}

                {/* Buttons Node */}
                {node.type === NODE_TYPES.BUTTONS && (
                  <div className="space-y-3">
                    <label className="block text-[#8696a0] text-xs">Quick Reply Buttons (max 3)</label>
                    {(node.buttons || []).map((button, btnIdx) => (
                      <div key={btnIdx} className="flex gap-2">
                        <input
                          type="text"
                          value={button.label}
                          onChange={(e) => {
                            const newButtons = [...(node.buttons || [])];
                            newButtons[btnIdx] = { ...newButtons[btnIdx], label: e.target.value };
                            updateNode(node.id, { buttons: newButtons });
                          }}
                          placeholder="Button label"
                          maxLength={20}
                          className="flex-1 bg-[#2a3942] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#00a884] placeholder-[#8696a0]"
                        />
                        <select
                          value={button.action}
                          onChange={(e) => {
                            const newButtons = [...(node.buttons || [])];
                            newButtons[btnIdx] = { ...newButtons[btnIdx], action: e.target.value };
                            updateNode(node.id, { buttons: newButtons });
                          }}
                          className="bg-[#2a3942] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                        >
                          <option value="">Select action</option>
                          <option value={ACTION_TYPES.BROWSE_CATALOG}>Browse Products</option>
                          <option value={ACTION_TYPES.VIEW_ORDERS}>View Orders</option>
                          <option value={ACTION_TYPES.CREATE_ORDER}>Create Order</option>
                          <option value={ACTION_TYPES.TRACK_ORDER}>Track Order</option>
                          <option value={ACTION_TYPES.CONTACT_SUPPORT}>Contact Support</option>
                          <option value={ACTION_TYPES.CUSTOM}>Custom Response</option>
                        </select>
                        <button
                          onClick={() => {
                            const newButtons = (node.buttons || []).filter((_, i) => i !== btnIdx);
                            updateNode(node.id, { buttons: newButtons });
                          }}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-[#8696a0] hover:text-red-400 transition-colors"
                        >
                          <FaTimes size={14} />
                        </button>
                      </div>
                    ))}
                    {(node.buttons || []).length < 3 && (
                      <button
                        onClick={() => {
                          const newButtons = [...(node.buttons || []), { label: '', action: '' }];
                          updateNode(node.id, { buttons: newButtons });
                        }}
                        className="flex items-center gap-2 text-[#00a884] text-sm hover:text-[#06cf9c] transition-colors"
                      >
                        <FaPlus size={12} /> Add Button
                      </button>
                    )}
                  </div>
                )}

                {/* List Node */}
                {node.type === NODE_TYPES.LIST && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[#8696a0] text-xs mb-2">List Action</label>
                      <select
                        value={node.action || ''}
                        onChange={(e) => updateNode(node.id, { action: e.target.value })}
                        className="w-full bg-[#2a3942] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                      >
                        <option value="">Select what to show</option>
                        <option value={ACTION_TYPES.VIEW_PRODUCTS}>Product Categories (from Inventory)</option>
                        <option value={ACTION_TYPES.VIEW_ORDERS}>Recent Orders</option>
                        <option value="custom_list">Custom List</option>
                      </select>
                    </div>
                    <p className="text-[#8696a0] text-xs">
                      This will automatically show items from your inventory or orders
                    </p>
                  </div>
                )}

                {/* Action Node */}
                {node.type === NODE_TYPES.ACTION && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[#8696a0] text-xs mb-2">Action Type</label>
                      <select
                        value={node.actionType || ''}
                        onChange={(e) => updateNode(node.id, { actionType: e.target.value })}
                        className="w-full bg-[#2a3942] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                      >
                        <option value={ACTION_TYPES.CREATE_ORDER}>Create Order</option>
                        <option value={ACTION_TYPES.VIEW_ORDERS}>Show Orders</option>
                        <option value={ACTION_TYPES.BROWSE_CATALOG}>Show Catalog</option>
                        <option value={ACTION_TYPES.TRACK_ORDER}>Track Order</option>
                        <option value={ACTION_TYPES.CONTACT_SUPPORT}>Transfer to Human</option>
                        <option value={ACTION_TYPES.CUSTOM}>Custom Action</option>
                      </select>
                    </div>
                    {node.actionType === ACTION_TYPES.CUSTOM && (
                      <div>
                        <label className="block text-[#8696a0] text-xs mb-2">Custom Response</label>
                        <textarea
                          value={node.customAction || ''}
                          onChange={(e) => updateNode(node.id, { customAction: e.target.value })}
                          placeholder="Enter custom response message..."
                          className="w-full bg-[#2a3942] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#00a884] min-h-[60px] resize-none placeholder-[#8696a0]"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
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
            Flow Builder
          </h2>
          <p className="text-gray-400 mt-1">Create automated conversation flows for WhatsApp</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleQuickSetup}
            disabled={quickSetupLoading}
            className="px-4 py-2 bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            title="Creates Welcome, Order, and Support flows automatically"
          >
            <HiLightningBolt size={16} className={quickSetupLoading ? 'animate-spin' : ''} />
            {quickSetupLoading ? 'Creating...' : 'Quick Setup'}
          </button>
          <button
            onClick={() => setShowTemplates(true)}
            className="px-4 py-2 bg-[#2a3942] text-white rounded-lg hover:bg-[#374248] transition-colors flex items-center gap-2"
          >
            <FaMagic size={14} />
            Templates
          </button>
          <button
            onClick={() => { resetForm(); setSelectedFlow(null); setShowCreateModal(true); }}
            className="px-4 py-2 bg-[#00a884] text-white rounded-lg hover:bg-[#06cf9c] transition-colors flex items-center gap-2"
          >
            <FaPlus size={14} />
            Create Flow
          </button>
        </div>
      </div>

      {/* Bot Status Banner */}
      <div className={`rounded-xl border p-4 ${
        botStatus.activeFlows > 0 
          ? 'bg-[#00a884]/10 border-[#00a884]/30' 
          : 'bg-[#f59e0b]/10 border-[#f59e0b]/30'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              botStatus.activeFlows > 0 ? 'bg-[#00a884]/20' : 'bg-[#f59e0b]/20'
            }`}>
              {botStatus.activeFlows > 0 ? (
                <FaRobot className="text-[#00a884] text-xl" />
              ) : (
                <FaRobot className="text-[#f59e0b] text-xl" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold">Bot Status</h3>
                {botStatus.activeFlows > 0 ? (
                  <span className="px-2 py-0.5 bg-[#00a884]/20 text-[#00a884] text-xs rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-pulse" />
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-[#f59e0b]/20 text-[#f59e0b] text-xs rounded-full">
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex gap-4 mt-1 text-sm">
                <span className="text-[#8696a0]">
                  <span className="text-white font-medium">{botStatus.activeFlows}</span> active flow{botStatus.activeFlows !== 1 ? 's' : ''}
                </span>
                <span className={botStatus.hasWelcome ? 'text-[#00a884]' : 'text-[#8696a0]'}>
                  {botStatus.hasWelcome ? '✓' : '○'} Welcome
                </span>
                <span className={botStatus.hasOrder ? 'text-[#00a884]' : 'text-[#8696a0]'}>
                  {botStatus.hasOrder ? '✓' : '○'} Orders
                </span>
              </div>
            </div>
          </div>
          {botStatus.activeFlows === 0 && (
            <button
              onClick={handleQuickSetup}
              disabled={quickSetupLoading}
              className="px-4 py-2 bg-[#00a884] text-white rounded-lg hover:bg-[#06cf9c] transition-colors flex items-center gap-2 text-sm"
            >
              <HiSparkles />
              Enable Bot
            </button>
          )}
        </div>
      </div>

      {/* Active Flows */}
      {flows.length === 0 ? (
        <div className="bg-[#111b21] rounded-xl border border-[#2a3942] p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[#202c33] flex items-center justify-center">
            <FaRobot className="text-[#00a884] text-3xl" />
          </div>
          <h3 className="text-white text-xl font-semibold mb-2">No flows created yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create automated conversation flows to respond to customer messages instantly
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setShowTemplates(true)}
              className="px-6 py-3 bg-[#2a3942] text-white rounded-lg hover:bg-[#374248] transition-colors flex items-center gap-2"
            >
              <FaMagic /> Use Template
            </button>
            <button
              onClick={() => { resetForm(); setShowCreateModal(true); }}
              className="px-6 py-3 bg-[#00a884] text-white rounded-lg hover:bg-[#06cf9c] transition-colors flex items-center gap-2"
            >
              <FaPlus /> Create from Scratch
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {flows.map((flow) => (
            <motion.div
              key={flow.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111b21] rounded-xl border border-[#2a3942] p-5 hover:border-[#00a884]/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    flow.isActive ? 'bg-[#00a884]/20' : 'bg-[#2a3942]'
                  }`}>
                    <FaRobot className={flow.isActive ? 'text-[#00a884] text-xl' : 'text-gray-500 text-xl'} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                      {flow.name}
                      {flow.isActive && (
                        <span className="px-2 py-0.5 bg-[#00a884]/20 text-[#00a884] text-xs rounded-full">
                          Active
                        </span>
                      )}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">{flow.description || 'No description'}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(flow.triggerKeywords || []).slice(0, 5).map((keyword, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-[#2a3942] text-[#8696a0] text-xs rounded-lg"
                        >
                          "{keyword}"
                        </span>
                      ))}
                      {(flow.triggerKeywords || []).length > 5 && (
                        <span className="text-[#8696a0] text-xs">
                          +{flow.triggerKeywords.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(flow)}
                    className={`p-2 rounded-lg transition-colors ${
                      flow.isActive 
                        ? 'bg-[#00a884]/20 text-[#00a884] hover:bg-[#00a884]/30' 
                        : 'bg-[#2a3942] text-gray-400 hover:bg-[#374248]'
                    }`}
                    title={flow.isActive ? 'Pause flow' : 'Activate flow'}
                  >
                    {flow.isActive ? <FaPause size={14} /> : <FaPlay size={14} />}
                  </button>
                  <button
                    onClick={() => handleEditFlow(flow)}
                    className="p-2 rounded-lg bg-[#2a3942] text-gray-400 hover:bg-[#374248] hover:text-white transition-colors"
                  >
                    <FaEdit size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteFlow(flow.id)}
                    className="p-2 rounded-lg bg-[#2a3942] text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  >
                    <FaTrash size={14} />
                  </button>
                </div>
              </div>
              
              {/* Flow Steps Preview */}
              <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2">
                <div className="flex items-center gap-1 px-3 py-1.5 bg-[#2a3942] rounded-lg text-xs text-[#00a884] whitespace-nowrap">
                  <HiLightningBolt /> Trigger
                </div>
                {(flow.nodes || []).slice(0, 4).map((node, idx) => (
                  <React.Fragment key={idx}>
                    <FaArrowRight className="text-[#8696a0] text-xs flex-shrink-0" />
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-[#2a3942] rounded-lg text-xs text-[#8696a0] whitespace-nowrap">
                      {node.type === NODE_TYPES.MESSAGE && <><FaComments size={10} /> Message</>}
                      {node.type === NODE_TYPES.BUTTONS && <><FaList size={10} /> Buttons</>}
                      {node.type === NODE_TYPES.LIST && <><FaBoxes size={10} /> List</>}
                      {node.type === NODE_TYPES.ACTION && <><HiLightningBolt size={10} /> Action</>}
                    </div>
                  </React.Fragment>
                ))}
                {(flow.nodes || []).length > 4 && (
                  <span className="text-[#8696a0] text-xs">+{flow.nodes.length - 4} more</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Templates Modal */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowTemplates(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111b21] rounded-2xl border border-[#2a3942] w-full max-w-2xl max-h-[80vh] overflow-hidden"
            >
              <div className="p-6 border-b border-[#2a3942]">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FaMagic className="text-[#00a884]" />
                  Flow Templates
                </h3>
                <p className="text-gray-400 text-sm mt-1">Start with a pre-built template</p>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {FLOW_TEMPLATES.map((template) => (
                    <motion.div
                      key={template.id}
                      onClick={() => useTemplate(template)}
                      whileHover={{ scale: 1.02 }}
                      className="p-5 bg-gradient-to-br from-[#202c33] to-[#111b21] rounded-xl border-2 border-[#2a3942] hover:border-[#00a884]/70 cursor-pointer transition-all hover:shadow-lg hover:shadow-[#00a884]/10 group"
                    >
                      <div className="flex items-start gap-4 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-[#00a884]/10 flex items-center justify-center group-hover:bg-[#00a884]/20 transition-colors flex-shrink-0">
                          <span className="text-2xl">{template.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-semibold text-base mb-1">{template.name}</h4>
                          <p className="text-[#8696a0] text-sm leading-relaxed">{template.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#2a3942]">
                        <span className="text-[#8696a0] text-xs font-medium mr-1">Triggers:</span>
                        {template.nodes[0]?.keywords?.slice(0, 4).map((keyword, idx) => (
                          <span key={idx} className="px-2.5 py-1 bg-[#2a3942] text-[#00a884] text-xs rounded-full font-medium border border-[#00a884]/20">
                            "{keyword}"
                          </span>
                        ))}
                        {template.nodes[0]?.keywords?.length > 4 && (
                          <span className="px-2.5 py-1 text-[#8696a0] text-xs">+{template.nodes[0].keywords.length - 4} more</span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Edit Flow Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => { setShowCreateModal(false); setSelectedFlow(null); resetForm(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111b21] rounded-2xl border border-[#2a3942] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-[#2a3942] flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {selectedFlow ? 'Edit Flow' : 'Create New Flow'}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">Design your automated conversation</p>
                </div>
                <button
                  onClick={() => { setShowCreateModal(false); setSelectedFlow(null); resetForm(); }}
                  className="p-2 rounded-lg hover:bg-[#2a3942] text-gray-400 hover:text-white transition-colors"
                >
                  <FaTimes size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#8696a0] text-sm mb-2">Flow Name *</label>
                    <input
                      type="text"
                      value={flowData.name}
                      onChange={(e) => setFlowData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Welcome Flow"
                      className="w-full bg-[#202c33] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#00a884] placeholder-[#8696a0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#8696a0] text-sm mb-2">Description</label>
                    <input
                      type="text"
                      value={flowData.description}
                      onChange={(e) => setFlowData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description..."
                      className="w-full bg-[#202c33] text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#00a884] placeholder-[#8696a0]"
                    />
                  </div>
                </div>

                {/* Trigger Keywords */}
                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">
                    Trigger Keywords *
                    <span className="text-[#8696a0] text-xs ml-2">
                      (When customer sends these words, flow starts)
                    </span>
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                      placeholder="Type keyword and press Enter..."
                      className="flex-1 bg-[#202c33] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-[#00a884] placeholder-[#8696a0]"
                    />
                    <button
                      onClick={addKeyword}
                      className="px-4 py-2 bg-[#00a884] text-white rounded-lg hover:bg-[#06cf9c] transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {flowData.triggerKeywords.map((keyword, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-[#202c33] text-white text-sm rounded-lg flex items-center gap-2"
                      >
                        "{keyword}"
                        <button
                          onClick={() => removeKeyword(keyword)}
                          className="text-[#8696a0] hover:text-red-400 transition-colors"
                        >
                          <FaTimes size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Flow Nodes */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[#8696a0] text-sm">Flow Steps</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => addNode(NODE_TYPES.MESSAGE)}
                        className="px-3 py-1.5 bg-[#202c33] text-[#8696a0] text-sm rounded-lg hover:bg-[#2a3942] hover:text-white transition-colors flex items-center gap-1"
                      >
                        <FaComments size={12} /> Message
                      </button>
                      <button
                        onClick={() => addNode(NODE_TYPES.BUTTONS, { buttons: [{ label: '', action: '' }] })}
                        className="px-3 py-1.5 bg-[#202c33] text-[#8696a0] text-sm rounded-lg hover:bg-[#2a3942] hover:text-white transition-colors flex items-center gap-1"
                      >
                        <FaList size={12} /> Buttons
                      </button>
                      <button
                        onClick={() => addNode(NODE_TYPES.LIST)}
                        className="px-3 py-1.5 bg-[#202c33] text-[#8696a0] text-sm rounded-lg hover:bg-[#2a3942] hover:text-white transition-colors flex items-center gap-1"
                      >
                        <FaBoxes size={12} /> List
                      </button>
                      <button
                        onClick={() => addNode(NODE_TYPES.ACTION)}
                        className="px-3 py-1.5 bg-[#202c33] text-[#8696a0] text-sm rounded-lg hover:bg-[#2a3942] hover:text-white transition-colors flex items-center gap-1"
                      >
                        <HiLightningBolt size={12} /> Action
                      </button>
                    </div>
                  </div>

                  {flowData.nodes.length === 0 ? (
                    <div className="bg-[#202c33] rounded-xl border border-dashed border-[#2a3942] p-8 text-center">
                      <FaLink className="text-[#8696a0] text-2xl mx-auto mb-3" />
                      <p className="text-[#8696a0] text-sm">Add steps to your flow using the buttons above</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {flowData.nodes.map((node, index) => renderNodeEditor(node, index))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-[#2a3942] flex justify-end gap-3 flex-shrink-0">
                <button
                  onClick={() => { setShowCreateModal(false); setSelectedFlow(null); resetForm(); }}
                  className="px-6 py-2.5 bg-[#2a3942] text-white rounded-lg hover:bg-[#374248] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFlow}
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#00a884] text-white rounded-lg hover:bg-[#06cf9c] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FaSave size={14} />
                      {selectedFlow ? 'Update Flow' : 'Create Flow'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FlowBuilder;
