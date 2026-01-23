/**
 * QuickSend Component
 * Easy "choose and send" interface for non-technical users
 * Select template, products, retailers, and send with one click
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { sendWhatsAppMessage, getWhatsAppConfig, WHATSAPP_PROVIDERS } from '../../../services/whatsappService';
import { toast } from 'react-toastify';
import MessageTemplates, { TEMPLATE_TYPES, generateMessage } from './MessageTemplates';
import { 
  FaWhatsapp, FaCheck, FaTimes, FaImage, FaVideo, FaLink,
  FaArrowRight, FaSpinner
} from 'react-icons/fa';

const QuickSend = () => {
  const [step, setStep] = useState(1); // 1: Template, 2: Products, 3: Retailers, 4: Preview
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedRetailers, setSelectedRetailers] = useState(new Set());
  const [products, setProducts] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');

  const distributorId = auth.currentUser?.uid;

  // Load products and retailers
  useEffect(() => {
    if (!distributorId) return;

    // Load products
    const productsRef = collection(db, 'businesses', distributorId, 'products');
    const unsubscribeProducts = onSnapshot(productsRef, (snapshot) => {
      const productsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        name: doc.data().productName || doc.data().name || 'Unnamed Product',
        price: doc.data().sellingPrice || doc.data().mrp || doc.data().price || 0,
        stock: doc.data().quantity || 0,
      }));
      setProducts(productsList);
    });

    // Load retailers
    const retailersRef = collection(db, 'businesses', distributorId, 'connectedRetailers');
    getDocs(retailersRef).then(async (snapshot) => {
      const retailerPromises = snapshot.docs.map(async (retailerDoc) => {
        const data = retailerDoc.data();
        const retailerId = retailerDoc.id;
        
        let phone = data.phone || data.retailerPhone || '';
        
        if (!phone && retailerId) {
          try {
            const retailerDocRef = doc(db, 'businesses', retailerId);
            const retailerDocSnap = await getDoc(retailerDocRef);
            if (retailerDocSnap.exists()) {
              const retailerData = retailerDocSnap.data();
              phone = retailerData.phone || retailerData.ownerPhone || '';
            }
          } catch (err) {
            console.warn('Could not fetch phone:', err);
          }
        }
        
        return {
          id: retailerId,
          ...data,
          phone: phone,
          businessName: data.businessName || data.retailerName || '',
        };
      });
      
      const retailerList = await Promise.all(retailerPromises);
      setRetailers(retailerList);
      setLoading(false);
    }).catch((error) => {
      console.error('Error fetching retailers:', error);
      setLoading(false);
    });

    return () => unsubscribeProducts();
  }, [distributorId]);

  // Generate preview message when template or products change
  useEffect(() => {
    if (!selectedTemplate) {
      setPreviewMessage('');
      return;
    }

    // Build variables from selected products
    const variables = {};
    
    if (selectedProducts.length === 1) {
      const product = selectedProducts[0];
      variables.productName = product.name;
      variables.price = `₹${product.price}`;
      variables.stock = product.stock;
      variables.oldPrice = `₹${product.price}`;
      variables.newPrice = `₹${product.price}`;
    } else if (selectedProducts.length > 1) {
      variables.productName = `${selectedProducts.length} products`;
      variables.productCount = selectedProducts.length;
    }

    const message = generateMessage(selectedTemplate, variables);
    setPreviewMessage(message);
  }, [selectedTemplate, selectedProducts]);

  // Handle template selection
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setStep(2);
  };

  // Handle product selection
  const toggleProduct = (productId) => {
    setSelectedProducts(prev => {
      const exists = prev.find(p => p.id === productId);
      if (exists) {
        return prev.filter(p => p.id !== productId);
      } else {
        const product = products.find(p => p.id === productId);
        return product ? [...prev, product] : prev;
      }
    });
  };

  // Handle retailer selection
  const toggleRetailer = (retailerId) => {
    setSelectedRetailers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(retailerId)) {
        newSet.delete(retailerId);
      } else {
        newSet.add(retailerId);
      }
      return newSet;
    });
  };

  // Send messages
  const handleSend = async () => {
    if (!selectedTemplate || selectedRetailers.size === 0) {
      toast.error('Please select template and at least one retailer');
      return;
    }

    const config = await getWhatsAppConfig(distributorId);
    if (!config || !config.enabled) {
      toast.warning('WhatsApp not configured. Please set it up in Profile Settings.');
      return;
    }

    setSending(true);
    let successCount = 0;
    let failCount = 0;

    const retailersToSend = retailers.filter(r => 
      selectedRetailers.has(r.id) && r.phone
    );

    if (retailersToSend.length === 0) {
      toast.error('No retailers with phone numbers selected');
      setSending(false);
      return;
    }

    try {
      for (const retailer of retailersToSend) {
        try {
          // Build variables for this retailer
          const variables = {};
          
          if (selectedProducts.length === 1) {
            const product = selectedProducts[0];
            variables.productName = product.name;
            variables.price = `₹${product.price}`;
            variables.stock = product.stock;
            variables.oldPrice = `₹${product.price}`;
            variables.newPrice = `₹${product.price}`;
          } else if (selectedProducts.length > 1) {
            variables.productName = `${selectedProducts.length} products`;
            variables.productCount = selectedProducts.length;
          }

          const message = generateMessage(selectedTemplate, variables);
          
          const result = await sendWhatsAppMessage(
            distributorId,
            retailer.phone,
            message,
            {
              messageType: selectedTemplate.type || 'custom',
              metadata: {
                templateId: selectedTemplate.id,
                templateName: selectedTemplate.name,
                productIds: selectedProducts.map(p => p.id),
                imageUrl: selectedTemplate.imageUrl,
                videoUrl: selectedTemplate.videoUrl,
                linkUrl: selectedTemplate.linkUrl,
                retailerId: retailer.id,
                retailerName: retailer.businessName,
              },
              logMessage: true,
            }
          );

          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error('Error sending message:', error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`✅ Successfully sent to ${successCount} retailer(s)!`);
        // Reset
        setSelectedTemplate(null);
        setSelectedProducts([]);
        setSelectedRetailers(new Set());
        setStep(1);
      }

      if (failCount > 0) {
        toast.warning(`⚠️ Failed to send to ${failCount} retailer(s)`);
      }
    } catch (error) {
      console.error('Error sending messages:', error);
      toast.error('❌ Failed to send messages');
    } finally {
      setSending(false);
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
      {/* Compact Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h2 className="text-xl font-semibold text-white">
              Quick Send
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Choose a template, select products & retailers, and send with one click
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4 mb-6">
        {[1, 2, 3, 4].map((s) => (
          <React.Fragment key={s}>
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                step >= s
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-slate-800 border-gray-600 text-gray-400'
              }`}
            >
              {step > s ? <FaCheck /> : s}
            </div>
            {s < 4 && (
              <div
                className={`h-1 w-16 transition-all ${
                  step > s ? 'bg-emerald-600' : 'bg-gray-600'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Select Template */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/80 border border-white/10 rounded-xl p-6"
        >
          <h3 className="text-xl font-semibold text-white mb-4">Step 1: Choose a Template</h3>
          <MessageTemplates 
            mode="select" 
            onTemplateSelect={handleTemplateSelect}
          />
        </motion.div>
      )}

      {/* Step 2: Select Products */}
      {step === 2 && selectedTemplate && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/80 border border-white/10 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">Step 2: Select Products (Optional)</h3>
            <button
              onClick={() => setStep(1)}
              className="text-sm text-gray-400 hover:text-white"
            >
              ← Back
            </button>
          </div>
          
          <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <p className="text-sm text-emerald-300">
              <strong>Selected Template:</strong> {selectedTemplate.name}
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {products.length === 0 ? (
              <p className="text-sm text-gray-400">No products available</p>
            ) : (
              products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => toggleProduct(product.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedProducts.find(p => p.id === product.id)
                      ? 'bg-emerald-500/20 border-emerald-500/50'
                      : 'bg-slate-800/60 border-white/10 hover:bg-slate-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-white">{product.name}</p>
                      <p className="text-xs text-gray-400">
                        ₹{product.price} • Stock: {product.stock} units
                      </p>
                    </div>
                    {selectedProducts.find(p => p.id === product.id) && (
                      <FaCheck className="text-emerald-400" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => setStep(3)}
            className="mt-6 w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
          >
            Continue to Retailers <FaArrowRight />
          </button>
        </motion.div>
      )}

      {/* Step 3: Select Retailers */}
      {step === 3 && selectedTemplate && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/80 border border-white/10 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">Step 3: Select Retailers</h3>
            <button
              onClick={() => setStep(2)}
              className="text-sm text-gray-400 hover:text-white"
            >
              ← Back
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 mb-6">
            {retailers.length === 0 ? (
              <p className="text-sm text-gray-400">No retailers connected</p>
            ) : (
              retailers.map((retailer) => {
                const hasPhone = !!retailer.phone;
                return (
                  <div
                    key={retailer.id}
                    onClick={() => hasPhone && toggleRetailer(retailer.id)}
                    className={`p-4 rounded-lg border transition-all ${
                      !hasPhone
                        ? 'opacity-60 cursor-not-allowed bg-slate-800/40 border-red-500/30'
                        : selectedRetailers.has(retailer.id)
                        ? 'bg-blue-500/20 border-blue-500/50 cursor-pointer'
                        : 'bg-slate-800/60 border-white/10 hover:bg-slate-700/60 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-white">
                          {retailer.businessName || 'Retailer'}
                        </p>
                        <p className={`text-xs ${hasPhone ? 'text-gray-400' : 'text-red-400'}`}>
                          {retailer.phone || '❌ Phone number required'}
                        </p>
                      </div>
                      {hasPhone && selectedRetailers.has(retailer.id) && (
                        <FaCheck className="text-blue-400" />
                      )}
                      {!hasPhone && <FaTimes className="text-red-400" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => setStep(4)}
            disabled={selectedRetailers.size === 0}
            className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Preview & Send <FaArrowRight />
          </button>
        </motion.div>
      )}

      {/* Step 4: Preview & Send */}
      {step === 4 && selectedTemplate && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/80 border border-white/10 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">Step 4: Preview & Send</h3>
            <button
              onClick={() => setStep(3)}
              className="text-sm text-gray-400 hover:text-white"
            >
              ← Back
            </button>
          </div>

          {/* Preview */}
          <div className="space-y-4 mb-6">
            {/* Template Preview */}
            <div className="bg-slate-800/60 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Template Preview</h4>
              {selectedTemplate.imageUrl && (
                <img 
                  src={selectedTemplate.imageUrl} 
                  alt="Template" 
                  className="w-full rounded-lg mb-3"
                />
              )}
              <div className="bg-slate-900 rounded-lg p-4 whitespace-pre-wrap text-sm text-white">
                {previewMessage}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                {selectedTemplate.imageUrl && <span className="flex items-center gap-1"><FaImage /> Image</span>}
                {selectedTemplate.videoUrl && <span className="flex items-center gap-1"><FaVideo /> Video</span>}
                {selectedTemplate.linkUrl && <span className="flex items-center gap-1"><FaLink /> Link</span>}
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-emerald-300">{selectedProducts.length}</p>
                <p className="text-xs text-gray-400">Products</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-300">{selectedRetailers.size}</p>
                <p className="text-xs text-gray-400">Retailers</p>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-purple-300">{selectedRetailers.size}</p>
                <p className="text-xs text-gray-400">Messages</p>
              </div>
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={sending || selectedRetailers.size === 0}
            className="w-full px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {sending ? (
              <>
                <FaSpinner className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <FaWhatsapp />
                Send to {selectedRetailers.size} Retailer{selectedRetailers.size > 1 ? 's' : ''}
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default QuickSend;
