/**
 * CartContext - Shopping Cart State Management for Customer App
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [cartStore, setCartStore] = useState(null); // Store from which items are added

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('flyp_customer_cart');
    const savedStore = localStorage.getItem('flyp_customer_cart_store');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to load cart:', e);
      }
    }
    if (savedStore) {
      try {
        setCartStore(JSON.parse(savedStore));
      } catch (e) {
        console.error('Failed to load cart store:', e);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('flyp_customer_cart', JSON.stringify(cartItems));
    if (cartStore) {
      localStorage.setItem('flyp_customer_cart_store', JSON.stringify(cartStore));
    }
  }, [cartItems, cartStore]);

  // Add item to cart
  const addToCart = (product, store, quantity = 1) => {
    // If cart has items from different store, ask to clear
    if (cartStore && cartStore.id !== store.id && cartItems.length > 0) {
      return { 
        success: false, 
        error: 'DIFFERENT_STORE',
        message: `Your cart has items from ${cartStore.name}. Clear cart to add from ${store.name}?`
      };
    }

    // Set or update store
    if (!cartStore || cartStore.id === store.id) {
      setCartStore({
        id: store.id,
        name: store.businessName || store.name,
        deliveryFee: store.deliveryFee || 0,
        minOrder: parseFloat(store.minOrderValue) || 0,
        freeDeliveryAbove: parseFloat(store.freeDeliveryAbove) || 0,
        deliveryRadius: store.deliveryRadius || 10,
        pickupEnabled: store.pickupEnabled || false
      });
    }

    // Get price - handle different field names from marketplace sync
    const itemPrice = product.sellingPrice || product.price || 0;
    const itemMrp = product.mrp || itemPrice;
    const itemImage = product.imageUrl || product.image || '';
    const itemUnit = product.unit || product.packSize || '';

    setCartItems(prev => {
      const existingIndex = prev.findIndex(item => item.productId === product.id);
      
      if (existingIndex >= 0) {
        // Update quantity
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      } else {
        // Add new item
        return [...prev, {
          productId: product.id,
          name: product.name,
          price: itemPrice,
          mrp: itemMrp,
          image: itemImage,
          unit: itemUnit,
          quantity: quantity
        }];
      }
    });

    return { success: true };
  };

  // Update item quantity
  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCartItems(prev => 
      prev.map(item => 
        item.productId === productId 
          ? { ...item, quantity } 
          : item
      )
    );
  };

  // Remove item from cart
  const removeFromCart = (productId) => {
    setCartItems(prev => {
      const filtered = prev.filter(item => item.productId !== productId);
      // Clear store if cart is empty
      if (filtered.length === 0) {
        setCartStore(null);
        localStorage.removeItem('flyp_customer_cart_store');
      }
      return filtered;
    });
  };

  // Clear entire cart
  const clearCart = () => {
    setCartItems([]);
    setCartStore(null);
    localStorage.removeItem('flyp_customer_cart');
    localStorage.removeItem('flyp_customer_cart_store');
  };

  // Calculate totals
  const getCartTotals = () => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Check for free delivery threshold
    const baseDeliveryFee = parseFloat(cartStore?.deliveryFee) || 0;
    const freeDeliveryAbove = parseFloat(cartStore?.freeDeliveryAbove) || 0;
    const qualifiesForFreeDelivery = freeDeliveryAbove > 0 && subtotal >= freeDeliveryAbove;
    const deliveryFee = qualifiesForFreeDelivery ? 0 : baseDeliveryFee;
    
    // Amount needed for free delivery
    const amountForFreeDelivery = freeDeliveryAbove > 0 ? Math.max(0, freeDeliveryAbove - subtotal) : 0;
    
    const platformFee = 10; // Fixed platform fee
    const total = subtotal + deliveryFee + platformFee;
    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const savings = cartItems.reduce((sum, item) => {
      const mrpTotal = (item.mrp || item.price) * item.quantity;
      const priceTotal = item.price * item.quantity;
      return sum + (mrpTotal - priceTotal);
    }, 0);

    return {
      subtotal,
      deliveryFee,
      baseDeliveryFee,
      platformFee,
      total,
      itemCount,
      savings,
      meetsMinOrder: subtotal >= (cartStore?.minOrder || 0),
      freeDeliveryAbove,
      qualifiesForFreeDelivery,
      amountForFreeDelivery
    };
  };

  // Get quantity of specific product in cart
  const getItemQuantity = (productId) => {
    const item = cartItems.find(item => item.productId === productId);
    return item?.quantity || 0;
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      cartStore,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      getCartTotals,
      getItemQuantity
    }}>
      {children}
    </CartContext.Provider>
  );
};

export default CartContext;
