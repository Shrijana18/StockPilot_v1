import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { toast } from 'react-toastify';
import { FaTimes, FaBuilding, FaCheckCircle, FaShoppingCart, FaSearch, FaBox } from 'react-icons/fa';
import DistributorOrderRequestForm from '../DistributorOrderRequestForm';

const QuickOrderModal = ({ forecast, onClose }) => {
  const [productOwners, setProductOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductOwner, setSelectedProductOwner] = useState(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [productOwnerProducts, setProductOwnerProducts] = useState({}); // productOwnerId -> products array

  const distributorId = auth.currentUser?.uid;
  const productSku = forecast?.sku;
  const productName = forecast?.productName;
  const recommendedQty = forecast?.recommendedOrderQuantity || forecast?.optimalOrderTiming?.reorderPoint || 0;

  // Fetch connected product owners
  useEffect(() => {
    if (!distributorId) return;

    const productOwnersRef = collection(db, `businesses/${distributorId}/connectedProductOwners`);
    const unsubscribe = onSnapshot(productOwnersRef, async (snapshot) => {
      const owners = [];
      
      for (const ownerDoc of snapshot.docs) {
        const ownerData = ownerDoc.data();
        const productOwnerId = ownerData.productOwnerId || ownerDoc.id;
        
        // Fetch product owner business details
        try {
          const businessRef = doc(db, 'businesses', productOwnerId);
          const businessSnap = await getDoc(businessRef);
          const businessData = businessSnap.exists() ? businessSnap.data() : {};
          
          owners.push({
            id: productOwnerId,
            productOwnerId,
            ...ownerData,
            ...businessData,
            businessName: businessData.businessName || ownerData.productOwnerName || 'Product Owner',
          });
        } catch (err) {
          console.error(`Error fetching product owner ${productOwnerId}:`, err);
          owners.push({
            id: productOwnerId,
            productOwnerId,
            ...ownerData,
            businessName: ownerData.productOwnerName || 'Product Owner',
          });
        }
      }
      
      setProductOwners(owners);
      
      // Check which product owners have this product
      if (owners.length > 0 && (productSku || productName)) {
        checkProductAvailability(owners);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [distributorId, productSku, productName]);

  // Check which product owners have this product
  const checkProductAvailability = async (owners) => {
    const availability = {};
    
    for (const owner of owners) {
      try {
        const productsRef = collection(db, `businesses/${owner.productOwnerId}/products`);
        const productsSnap = await getDocs(productsRef);
        
        const matchingProducts = [];
        productsSnap.forEach(productDoc => {
          const product = productDoc.data();
          const productDocSku = product.sku || product.SKU || '';
          const productDocName = (product.name || product.productName || '').toLowerCase();
          const searchName = (productName || '').toLowerCase();
          const searchSku = (productSku || '').toLowerCase();
          
          // Match by SKU (most accurate) or by name
          const matches = 
            (searchSku && productDocSku.toLowerCase() === searchSku) ||
            (searchName && productDocName.includes(searchName)) ||
            (searchSku && productDocName.includes(searchSku));
          
          if (matches) {
            matchingProducts.push({
              id: productDoc.id,
              ...product,
              productOwnerId: owner.productOwnerId,
            });
          }
        });
        
        if (matchingProducts.length > 0) {
          availability[owner.productOwnerId] = matchingProducts;
        }
      } catch (err) {
        console.error(`Error checking products for ${owner.productOwnerId}:`, err);
      }
    }
    
    setProductOwnerProducts(availability);
    setLoading(false);
  };

  const handleSelectProductOwner = (owner) => {
    setSelectedProductOwner(owner);
    setShowOrderForm(true);
  };

  const handleOrderSuccess = () => {
    toast.success('Order request sent to product owner!');
    setShowOrderForm(false);
    setSelectedProductOwner(null);
    onClose();
  };

  const ownersWithProduct = productOwners.filter(owner => 
    productOwnerProducts[owner.productOwnerId]?.length > 0
  );

  if (showOrderForm && selectedProductOwner) {
    return (
      <DistributorOrderRequestForm
        productOwner={selectedProductOwner}
        onClose={() => {
          setShowOrderForm(false);
          setSelectedProductOwner(null);
        }}
        onSuccess={handleOrderSuccess}
        initialProduct={{
          productName: productName,
          sku: productSku,
          quantity: recommendedQty > 0 ? recommendedQty : 1,
          unitPrice: 0, // Will be fetched from product owner's catalog
        }}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 rounded-xl border border-white/10 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">Order from Product Owner</h3>
            <p className="text-sm text-white/60 mt-1">
              {productName} {productSku && `(${productSku})`}
            </p>
            <p className="text-sm text-emerald-400 mt-1">
              Recommended: {recommendedQty} units
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl"
          >
            <FaTimes />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-white/60">Loading product owners...</div>
          </div>
        ) : productOwners.length === 0 ? (
          <div className="text-center py-12">
            <FaBox className="text-4xl text-white/30 mx-auto mb-4" />
            <p className="text-white/80 text-lg mb-2">No Product Owners Connected</p>
            <p className="text-white/60 text-sm mb-4">
              You need to connect with product owners first to place orders.
            </p>
            <button
              onClick={() => {
                window.location.hash = '#/distributor-dashboard?tab=product-owners';
                onClose();
              }}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white text-sm"
            >
              Connect with Product Owners
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-white/60 text-sm mb-4">
              Select a product owner to place your order:
            </p>
            
            {/* Show product owners WITH the product first */}
            {ownersWithProduct.length > 0 && (
              <>
                <div className="text-xs text-emerald-400/80 mb-2 font-medium">
                  ✓ Product Available ({ownersWithProduct.length})
                </div>
                {ownersWithProduct.map((owner) => {
                  const products = productOwnerProducts[owner.productOwnerId] || [];
                  const mainProduct = products[0];
                  
                  return (
                    <motion.div
                      key={owner.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/15 transition cursor-pointer"
                      onClick={() => handleSelectProductOwner(owner)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <FaBuilding className="text-emerald-400 text-xl" />
                            <div>
                              <h4 className="font-semibold text-white text-lg">
                                {owner.businessName || owner.productOwnerName || 'Product Owner'}
                              </h4>
                              {owner.ownerName && (
                                <p className="text-sm text-white/60">{owner.ownerName}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="ml-8 space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <FaCheckCircle className="text-emerald-400 text-xs" />
                              <span className="text-emerald-300">
                                Product available: {mainProduct.name || mainProduct.productName}
                              </span>
                            </div>
                            {mainProduct.sku && (
                              <p className="text-xs text-white/50 ml-5">SKU: {mainProduct.sku}</p>
                            )}
                            {mainProduct.quantity !== undefined && (
                              <p className="text-xs text-white/50 ml-5">
                                Stock: {mainProduct.quantity} units
                              </p>
                            )}
                            {mainProduct.sellingPrice || mainProduct.mrp ? (
                              <p className="text-xs text-emerald-400 ml-5">
                                Price: ₹{mainProduct.sellingPrice || mainProduct.mrp || 0}
                              </p>
                            ) : null}
                          </div>
                          
                          {owner.productOwnerEmail && (
                            <p className="text-xs text-white/50 mt-2 ml-8">
                              {owner.productOwnerEmail}
                            </p>
                          )}
                        </div>
                        
                        <button className="ml-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white text-sm font-medium flex items-center gap-2">
                          <FaShoppingCart />
                          Order
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </>
            )}
            
            {/* Show product owners WITHOUT the product (but still allow ordering) */}
            {productOwners.filter(owner => !productOwnerProducts[owner.productOwnerId]?.length).length > 0 && (
              <>
                <div className="text-xs text-amber-400/80 mb-2 font-medium mt-4">
                  ⚠ Product Not Found in Catalog ({productOwners.filter(owner => !productOwnerProducts[owner.productOwnerId]?.length).length})
                </div>
                {productOwners
                  .filter(owner => !productOwnerProducts[owner.productOwnerId]?.length)
                  .map((owner) => {
                    return (
                      <motion.div
                        key={owner.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 rounded-lg p-4 border border-amber-500/30 hover:border-amber-500/50 hover:bg-white/10 transition cursor-pointer"
                        onClick={() => handleSelectProductOwner(owner)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <FaBuilding className="text-amber-400 text-xl" />
                              <div>
                                <h4 className="font-semibold text-white text-lg">
                                  {owner.businessName || owner.productOwnerName || 'Product Owner'}
                                </h4>
                                {owner.ownerName && (
                                  <p className="text-sm text-white/60">{owner.ownerName}</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="ml-8 space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <FaBox className="text-amber-400 text-xs" />
                                <span className="text-amber-300">
                                  Product not found in catalog - you can still order manually
                                </span>
                              </div>
                              <p className="text-xs text-white/50 ml-5">
                                Product: {productName} {productSku && `(${productSku})`}
                              </p>
                            </div>
                            
                            {owner.productOwnerEmail && (
                              <p className="text-xs text-white/50 mt-2 ml-8">
                                {owner.productOwnerEmail}
                              </p>
                            )}
                          </div>
                          
                          <button className="ml-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-white text-sm font-medium flex items-center gap-2">
                            <FaShoppingCart />
                            Order
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
              </>
            )}
            
            {/* Show product owners WITHOUT the product (but still allow ordering) */}
            {productOwners.filter(owner => !productOwnerProducts[owner.productOwnerId]?.length).length > 0 && (
              <>
                <div className="text-xs text-amber-400/80 mb-2 font-medium mt-4">
                  ⚠ Product Not Found in Catalog ({productOwners.filter(owner => !productOwnerProducts[owner.productOwnerId]?.length).length})
                </div>
                {productOwners
                  .filter(owner => !productOwnerProducts[owner.productOwnerId]?.length)
                  .map((owner) => {
                    return (
                      <motion.div
                        key={owner.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 rounded-lg p-4 border border-amber-500/30 hover:border-amber-500/50 hover:bg-white/10 transition cursor-pointer"
                        onClick={() => handleSelectProductOwner(owner)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <FaBuilding className="text-amber-400 text-xl" />
                              <div>
                                <h4 className="font-semibold text-white text-lg">
                                  {owner.businessName || owner.productOwnerName || 'Product Owner'}
                                </h4>
                                {owner.ownerName && (
                                  <p className="text-sm text-white/60">{owner.ownerName}</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="ml-8 space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <FaBox className="text-amber-400 text-xs" />
                                <span className="text-amber-300">
                                  Product not found in catalog - you can still order manually
                                </span>
                              </div>
                              <p className="text-xs text-white/50 ml-5">
                                Product: {productName} {productSku && `(${productSku})`}
                              </p>
                            </div>
                            
                            {owner.productOwnerEmail && (
                              <p className="text-xs text-white/50 mt-2 ml-8">
                                {owner.productOwnerEmail}
                              </p>
                            )}
                          </div>
                          
                          <button className="ml-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-white text-sm font-medium flex items-center gap-2">
                            <FaShoppingCart />
                            Order
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
              </>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default QuickOrderModal;

