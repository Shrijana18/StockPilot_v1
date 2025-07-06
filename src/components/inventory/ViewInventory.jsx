import { getStorage, ref, getDownloadURL } from "firebase/storage";
import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
// Removed useAuth because we will pass userId as prop

const ViewInventory = ({ userId }) => {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const db = getFirestore();

  // Prevent rendering if userId is not available
  if (!userId) {
    return <div className="text-center p-4">Loading user data...</div>;
  }

  useEffect(() => {
    if (!userId) return;
    console.log("Current user UID:", userId);
    const fetchProducts = async () => {
      try {
        const productRef = collection(db, "businesses", userId, "products");
        const snapshot = await getDocs(productRef);
        const storage = getStorage();
        const productList = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const data = doc.data();
            let imageUrl = "";
            try {
              if (data.imageUrl) {
                imageUrl = data.imageUrl;
              } else if (data.imagePath) {
                try {
                  const imageRef = ref(storage, data.imagePath);
                  imageUrl = await getDownloadURL(imageRef);
                } catch (err) {
                  console.warn("Image fetch error for path:", data.imagePath, err.message);
                }
              }
            } catch (err) {
              console.warn("Image fetch error:", err.message);
            }
            return { id: doc.id, ...data, imageUrl, imagePath: data.imagePath || "" };
          })
        );
        console.log("Fetched products:", productList);
        setProducts(productList);
        setFiltered(productList);
      } catch (err) {
        console.error("Error fetching inventory:", err);
      }
    };
    fetchProducts();
  }, [userId]);

  useEffect(() => {
    const s = search.toLowerCase();
    const result = products.filter(p =>
      p.productName?.toLowerCase().includes(s) ||
      p.sku?.toLowerCase().includes(s) ||
      p.brand?.toLowerCase().includes(s) ||
      p.category?.toLowerCase().includes(s)
    );
    setFiltered(result);
  }, [search, products]);

  useEffect(() => {
    if (!sortKey) {
      setFiltered((prev) => [...prev]);
      return;
    }
    // Sort the filtered list
    setFiltered((prevFiltered) => {
      const sorted = [...prevFiltered].sort((a, b) => {
        const valA = parseFloat(a[sortKey]) || 0;
        const valB = parseFloat(b[sortKey]) || 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
      return sorted;
    });
  }, [sortKey, sortOrder]);

  const getStatus = (qty) => {
    const q = parseInt(qty);
    return isNaN(q) ? "Unknown" : q <= 5 ? "Low" : "In Stock";
  };

  return (
    <div className="p-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name, brand, SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-4 py-2 rounded w-full md:w-1/3"
        />
        <div className="flex items-center gap-2">
          <select
            className="border px-3 py-2 rounded"
            onChange={(e) => setSortKey(e.target.value)}
            value={sortKey}
          >
            <option value="">Sort by</option>
            <option value="quantity">Quantity</option>
            <option value="costPrice">Cost Price</option>
            <option value="sellingPrice">Selling Price</option>
          </select>
          <select
            className="border px-3 py-2 rounded"
            onChange={(e) => setSortOrder(e.target.value)}
            value={sortOrder}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border rounded shadow-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-2">Image</th>
              <th className="p-2">Product</th>
              <th className="p-2">SKU</th>
              <th className="p-2">Brand</th>
              <th className="p-2">Category</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Unit</th>
              <th className="p-2">Cost</th>
              <th className="p-2">Sell</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">
                  <img
                    src={p.imageUrl || "/placeholder.png"}
                    alt="product"
                    className="h-10 w-10 rounded object-cover"
                  />
                </td>
                <td className="p-2">{p.productName}</td>
                <td className="p-2">{p.sku}</td>
                <td className="p-2">{p.brand}</td>
                <td className="p-2">{p.category}</td>
                <td className="p-2">{p.quantity}</td>
                <td className="p-2">{p.unit}</td>
                <td className="p-2">₹{p.costPrice}</td>
                <td className="p-2">₹{p.sellingPrice}</td>
                <td className="p-2">
                  <span
                    className={`px-2 py-1 rounded text-white text-xs ${
                      getStatus(p.quantity) === "Low" ? "bg-red-500" : "bg-green-500"
                    }`}
                  >
                    {getStatus(p.quantity)}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="10" className="text-center p-4 text-gray-500">
                  {products.length === 0 ? "No products found." : "Loading inventory..."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ViewInventory;