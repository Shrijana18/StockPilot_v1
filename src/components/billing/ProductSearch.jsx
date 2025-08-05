import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

const ProductSearch = ({ onSelect }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

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

  return (
    <div className="relative mb-6 px-4 md:px-0">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search product by name, SKU, brand, category..."
        className="border w-full px-4 py-2 rounded-lg shadow-sm text-sm md:text-base"
      />
      {suggestions.length > 0 && (
        <ul className="absolute bg-white border w-full mt-2 max-h-64 overflow-y-auto z-20 rounded-lg shadow-lg">
          {suggestions.map((product) => (
            <li
              key={product.id}
              onClick={() => {
                onSelect(product);
                setSearchTerm("");
                setSuggestions([]);
              }}
              className="p-3 hover:bg-blue-100 cursor-pointer flex items-center gap-4 border-b"
            >
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.productName}
                  className="w-10 h-10 object-cover rounded"
                />
              )}
              <div className="flex flex-col">
                <span className="font-medium">{product.productName}</span>
                <span className="text-sm text-gray-500">
                  SKU: {product.sku || "N/A"} | Brand: {product.brand || "N/A"} | Category: {product.category || "N/A"}
                </span>
                <span className="text-sm text-gray-600">Selling Price: ₹{product.sellingPrice || "0.00"}</span>
                <span className="text-xs text-gray-500">Unit: {product.unit || "N/A"}</span>
                <span className="text-xs text-green-600">In Stock: {product.quantity}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ProductSearch;