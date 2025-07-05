import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { useAuth } from '/src/context/AuthContext';

const ViewInventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const db = getFirestore();

  useEffect(() => {
    const fetchProducts = async () => {
      if (!currentUser) return;
      try {
        const productRef = collection(db, "businesses", currentUser.uid, "products");
        const snapshot = await getDocs(productRef);
        const productList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProducts(productList);
      } catch (err) {
        console.error("Error fetching inventory:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [currentUser]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Current Inventory</h2>
      {loading ? (
        <p className="text-gray-500 italic">Loading inventory...</p>
      ) : products.length === 0 ? (
        <p className="text-gray-500 italic">No products found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 border">Image</th>
                <th className="px-4 py-2 border">Product Name</th>
                <th className="px-4 py-2 border">SKU</th>
                <th className="px-4 py-2 border">Quantity</th>
                <th className="px-4 py-2 border">Unit</th>
                <th className="px-4 py-2 border">Selling Price</th>
                <th className="px-4 py-2 border">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id}>
                  <td className="border px-4 py-2">
                    {product.imageUrls?.[0] ? (
                      <img src={product.imageUrls[0]} alt="product" className="h-12 w-12 object-cover rounded" />
                    ) : (
                      <span className="text-xs text-gray-400">No Image</span>
                    )}
                  </td>
                  <td className="border px-4 py-2">{product.productName || "—"}</td>
                  <td className="border px-4 py-2">{product.sku || "—"}</td>
                  <td className="border px-4 py-2">{product.quantity ?? 0}</td>
                  <td className="border px-4 py-2">{product.unit || "—"}</td>
                  <td className="border px-4 py-2">₹{parseFloat(product.sellingPrice || 0).toFixed(2)}</td>
                  <td className="border px-4 py-2">
                    {product.quantity > 0 ? (
                      <span className="text-green-600 font-semibold">In Stock</span>
                    ) : (
                      <span className="text-red-600 font-semibold">Low</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ViewInventory;