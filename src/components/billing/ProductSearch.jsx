import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

const ProductSearch = ({ onSelect }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const inputRef = useRef(null);
  const [dropdownRect, setDropdownRect] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        const snapshot = await getDocs(collection(db, "businesses", userId, "products"));
        const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAllProducts(items);
      } catch (err) {
        console.error("Failed to load inventory:", err);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    const matches = allProducts.filter((item) =>
      item.productName?.toLowerCase().includes(term) ||
      item.sku?.toLowerCase().includes(term) ||
      item.brand?.toLowerCase().includes(term) ||
      item.category?.toLowerCase().includes(term)
    );
    setSuggestions(term ? matches : []);
  }, [searchTerm, allProducts]);

  useEffect(() => {
    const updateRect = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownRect({ left: rect.left, top: rect.bottom + 8, width: rect.width });
    };
    if (suggestions.length > 0) {
      updateRect();
      window.addEventListener('scroll', updateRect, true);
      window.addEventListener('resize', updateRect);
    }
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [suggestions.length, searchTerm]);

  return (
    <div className="relative z-[999] mb-6 px-4 md:px-0 text-white">
      <input ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search product by name, SKU, brand, category..."
        className="w-full px-4 py-2 rounded-xl text-sm md:text-base bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 shadow-[0_6px_20px_rgba(0,0,0,0.25)]"
      />
      {suggestions.length > 0 && dropdownRect && createPortal(
        <ul
          style={{ position: 'fixed', left: dropdownRect.left, top: dropdownRect.top, width: dropdownRect.width, maxHeight: '16rem' }}
          className="mt-2 overflow-y-auto z-[2000] rounded-xl border border-white/10 bg-[#0B0F14]/70 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        >
          {suggestions.map((product) => (
            <li
              key={product.id}
              onClick={() => {
                onSelect(product);
                setSearchTerm("");
                setSuggestions([]);
              }}
              className="p-3 hover:bg-white/10 cursor-pointer flex items-center gap-4 border-b border-white/10"
            >
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.productName}
                  className="w-10 h-10 object-cover rounded ring-1 ring-white/20"
                />
              )}
              <div className="flex flex-col">
                <span className="font-medium text-white">{product.productName}</span>
                <span className="text-sm text-white/60">
                  SKU: {product.sku || "N/A"} | Brand: {product.brand || "N/A"} | Category: {product.category || "N/A"}
                </span>
                <span className="text-sm text-white/70">Selling Price: ₹{product.sellingPrice || "0.00"}</span>
                <span className="text-xs text-white/60">Unit: {product.unit || "N/A"}</span>
                <span className="text-xs text-emerald-300">In Stock: {product.quantity}</span>
              </div>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
};

export default ProductSearch;