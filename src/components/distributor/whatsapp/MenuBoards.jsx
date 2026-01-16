/**
 * Menu Boards - Interactive WhatsApp Menu System
 * Automated responses with interactive buttons and quick replies
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, onSnapshot, serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { sendWhatsAppMessage, getWhatsAppConfig } from '../../../services/whatsappService';
import { toast } from 'react-toastify';
import { 
  FaPlus, FaEdit, FaTrash, FaSave, FaTimes, FaRobot, 
  FaList, FaCheckCircle, FaCog, FaPlay
} from 'react-icons/fa';

const MenuBoards = () => {
  const [menus, setMenus] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState(null);

  const distributorId = auth.currentUser?.uid;

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    triggerKeywords: [], // Keywords that trigger this menu (e.g., "hi", "hello", "help")
    welcomeMessage: '',
    options: [], // Array of {id, label, action, response}
    isActive: true,
  });

  const [newKeyword, setNewKeyword] = useState('');
  const [newOption, setNewOption] = useState({ label: '', action: '', response: '' });

  useEffect(() => {
    if (!distributorId) return;

    const menusRef = collection(db, 'businesses', distributorId, 'whatsappMenus');
    const unsubscribe = onSnapshot(menusRef, (snapshot) => {
      const menusList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMenus(menusList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [distributorId]);

  const handleCreateMenu = async () => {
    if (!formData.name || !formData.welcomeMessage) {
      toast.error('Please fill in menu name and welcome message');
      return;
    }

    if (formData.options.length === 0) {
      toast.error('Please add at least one menu option');
      return;
    }

    try {
      const menuData = {
        ...formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (editingMenu) {
        await updateDoc(doc(db, 'businesses', distributorId, 'whatsappMenus', editingMenu.id), menuData);
        toast.success('Menu updated successfully!');
      } else {
        await addDoc(collection(db, 'businesses', distributorId, 'whatsappMenus'), menuData);
        toast.success('Menu created successfully!');
      }

      setShowCreateModal(false);
      setEditingMenu(null);
      resetForm();
    } catch (error) {
      console.error('Error saving menu:', error);
      toast.error('Failed to save menu');
    }
  };

  const handleEditMenu = (menu) => {
    setEditingMenu(menu);
    setFormData({
      name: menu.name || '',
      triggerKeywords: menu.triggerKeywords || [],
      welcomeMessage: menu.welcomeMessage || '',
      options: menu.options || [],
      isActive: menu.isActive !== false,
    });
    setShowCreateModal(true);
  };

  const handleDeleteMenu = async (menuId) => {
    if (!window.confirm('Are you sure you want to delete this menu?')) return;

    try {
      await deleteDoc(doc(db, 'businesses', distributorId, 'whatsappMenus', menuId));
      toast.success('Menu deleted successfully!');
    } catch (error) {
      console.error('Error deleting menu:', error);
      toast.error('Failed to delete menu');
    }
  };

  const toggleMenuActive = async (menu) => {
    try {
      await updateDoc(doc(db, 'businesses', distributorId, 'whatsappMenus', menu.id), {
        isActive: !menu.isActive,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Menu ${!menu.isActive ? 'activated' : 'deactivated'}!`);
    } catch (error) {
      console.error('Error toggling menu:', error);
      toast.error('Failed to update menu');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      triggerKeywords: [],
      welcomeMessage: '',
      options: [],
      isActive: true,
    });
    setNewKeyword('');
    setNewOption({ label: '', action: '', response: '' });
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !formData.triggerKeywords.includes(newKeyword.toLowerCase())) {
      setFormData({
        ...formData,
        triggerKeywords: [...formData.triggerKeywords, newKeyword.toLowerCase()],
      });
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword) => {
    setFormData({
      ...formData,
      triggerKeywords: formData.triggerKeywords.filter(k => k !== keyword),
    });
  };

  const addOption = () => {
    if (!newOption.label || !newOption.response) {
      toast.error('Please fill in option label and response');
      return;
    }

    const option = {
      id: Date.now().toString(),
      label: newOption.label,
      action: newOption.action || 'reply',
      response: newOption.response,
    };

    setFormData({
      ...formData,
      options: [...formData.options, option],
    });
    setNewOption({ label: '', action: '', response: '' });
  };

  const removeOption = (optionId) => {
    setFormData({
      ...formData,
      options: formData.options.filter(o => o.id !== optionId),
    });
  };

  const testMenu = async (menu) => {
    const config = await getWhatsAppConfig(distributorId);
    if (!config || !config.enabled) {
      toast.error('WhatsApp not configured');
      return;
    }

    // Show preview
    toast.info(`Menu Preview:\n\n${menu.welcomeMessage}\n\nOptions:\n${menu.options.map(o => `• ${o.label}`).join('\n')}`, {
      autoClose: 5000,
    });
  };

  if (loading) {
    return (
      <div className="p-6 text-white">
        <div className="animate-pulse">Loading menus...</div>
      </div>
    );
  }

  return (
    <div className="p-6 text-white space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-400">
            🤖 Menu Boards
          </h2>
          <p className="text-gray-400">
            Create interactive menus for automated WhatsApp responses
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingMenu(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105"
        >
          <FaPlus />
          Create Menu
        </button>
      </div>

      {/* Menus Grid */}
      {menus.length === 0 ? (
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="text-2xl font-semibold mb-2">No Menus Created Yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first interactive menu to automate customer responses
          </p>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
          >
            Create Your First Menu
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menus.map((menu) => (
            <motion.div
              key={menu.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/80 border border-white/10 rounded-xl p-6 hover:border-emerald-500/50 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-500/20 rounded-lg">
                    <FaRobot className="text-emerald-400 text-xl" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{menu.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {menu.isActive ? (
                        <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-1 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMenuActive(menu)}
                    className={`p-2 rounded-lg transition-colors ${
                      menu.isActive
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                        : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                    }`}
                    title={menu.isActive ? 'Deactivate' : 'Activate'}
                  >
                    <FaCog />
                  </button>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Triggers:</p>
                  <div className="flex flex-wrap gap-1">
                    {menu.triggerKeywords?.slice(0, 3).map((keyword, idx) => (
                      <span key={idx} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                        {keyword}
                      </span>
                    ))}
                    {menu.triggerKeywords?.length > 3 && (
                      <span className="text-xs text-gray-400">+{menu.triggerKeywords.length - 3}</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Welcome Message:</p>
                  <p className="text-sm text-gray-300 line-clamp-2">{menu.welcomeMessage}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Options:</p>
                  <div className="space-y-1">
                    {menu.options?.slice(0, 3).map((option, idx) => (
                      <div key={idx} className="text-sm text-gray-300 flex items-center gap-2">
                        <FaList className="text-emerald-400 text-xs" />
                        {option.label}
                      </div>
                    ))}
                    {menu.options?.length > 3 && (
                      <p className="text-xs text-gray-400">+{menu.options.length - 3} more options</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-white/10">
                <button
                  onClick={() => testMenu(menu)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg text-sm transition-colors"
                >
                  <FaPlay />
                  Test
                </button>
                <button
                  onClick={() => handleEditMenu(menu)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-sm transition-colors"
                >
                  <FaEdit />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteMenu(menu.id)}
                  className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg text-sm transition-colors"
                >
                  <FaTrash />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowCreateModal(false);
              setEditingMenu(null);
              resetForm();
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">
                  {editingMenu ? 'Edit Menu' : 'Create New Menu'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingMenu(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="space-y-6">
                {/* Menu Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Menu Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Welcome Menu, Order Support"
                    className="w-full bg-slate-700/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Trigger Keywords */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Trigger Keywords *
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    When users send these keywords, this menu will be triggered
                  </p>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                      placeholder="e.g., hi, hello, help"
                      className="flex-1 bg-slate-700/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={addKeyword}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.triggerKeywords.map((keyword, idx) => (
                      <span
                        key={idx}
                        className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-sm"
                      >
                        {keyword}
                        <button
                          onClick={() => removeKeyword(keyword)}
                          className="hover:text-red-400"
                        >
                          <FaTimes className="text-xs" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Welcome Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Welcome Message *
                  </label>
                  <textarea
                    value={formData.welcomeMessage}
                    onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                    placeholder="Welcome! How can I help you today?"
                    rows={4}
                    className="w-full bg-slate-700/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Menu Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Menu Options *
                  </label>
                  <div className="space-y-3 mb-3">
                    {formData.options.map((option) => (
                      <div
                        key={option.id}
                        className="flex items-center justify-between bg-slate-700/40 p-3 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-white">{option.label}</p>
                          <p className="text-xs text-gray-400">{option.response}</p>
                        </div>
                        <button
                          onClick={() => removeOption(option.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3 p-4 bg-slate-700/20 rounded-lg border border-white/10">
                    <input
                      type="text"
                      value={newOption.label}
                      onChange={(e) => setNewOption({ ...newOption, label: e.target.value })}
                      placeholder="Option Label (e.g., Check Order Status)"
                      className="w-full bg-slate-700/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <textarea
                      value={newOption.response}
                      onChange={(e) => setNewOption({ ...newOption, response: e.target.value })}
                      placeholder="Response when user selects this option"
                      rows={2}
                      className="w-full bg-slate-700/60 border border-white/10 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={addOption}
                      className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                    >
                      Add Option
                    </button>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingMenu(null);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateMenu}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  >
                    <FaSave />
                    {editingMenu ? 'Update Menu' : 'Create Menu'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MenuBoards;
