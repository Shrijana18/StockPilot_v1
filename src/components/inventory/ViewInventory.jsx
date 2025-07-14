import { getStorage, ref, getDownloadURL } from "firebase/storage";
import React, { useEffect, useState } from "react";
import { getFirestore, collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
// Removed useAuth because we will pass userId as prop

const ViewInventory = ({ userId }) => {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [editingCell, setEditingCell] = useState({ rowId: null, field: null });
  const [editedValue, setEditedValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const db = getFirestore();

  // Prevent rendering if userId is not available
  if (!userId) {
    return <div className="text-center p-4">Loading user data...</div>;
  }

  useEffect(() => {
    if (!userId) return;
    console.log("Current user UID:", userId);
    const productRef = collection(db, "businesses", userId, "products");
    const unsubscribe = onSnapshot(productRef, async (snapshot) => {
      const storage = getStorage();
      const productList = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          let imageUrl = "";
          try {
            if (data.imageUrl) {
              imageUrl = data.imageUrl;
            } else if (data.imagePath) {
              const imageRef = ref(storage, data.imagePath);
              imageUrl = await getDownloadURL(imageRef);
            }
          } catch (err) {
            console.warn("Image fetch error for:", data.imagePath || "unknown", err.message);
          }
          return { id: doc.id, ...data, imageUrl, imagePath: data.imagePath || "" };
        })
      );
      setProducts(productList);
      setFiltered(productList);
    });

    return () => unsubscribe(); // cleanup on unmount
  }, [userId]);

  useEffect(() => {
    const s = search.toLowerCase();
    const result = products.filter(p => {
      const matchesSearch =
        p.productName?.toLowerCase().includes(s) ||
        p.sku?.toLowerCase().includes(s) ||
        p.brand?.toLowerCase().includes(s) ||
        p.category?.toLowerCase().includes(s);
      const matchesStatus =
        !statusFilter || getStatus(p.quantity) === statusFilter;
      return matchesSearch && matchesStatus;
    });
    setFiltered(result);
  }, [search, products, statusFilter]);

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

  const startEdit = (rowId, field, currentValue) => {
    setEditingCell({ rowId, field });
    setEditedValue(currentValue);
  };

  const saveEdit = async (rowId, field, value) => {
    try {
      const productRef = collection(db, "businesses", userId, "products");
      const productDoc = doc(productRef, rowId);
      await updateDoc(productDoc, { [field]: value });
    } catch (err) {
      console.error("Error updating inventory field:", err);
    } finally {
      setEditingCell({ rowId: null, field: null });
      setEditedValue("");
    }
  };

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
          <select
            className="border px-3 py-2 rounded"
            onChange={(e) => setStatusFilter(e.target.value)}
            value={statusFilter}
          >
            <option value="">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low">Low</option>
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
                <td className="p-2" onClick={() => startEdit(p.id, "productName", p.productName)}>
                  {editingCell.rowId === p.id && editingCell.field === "productName" ? (
                    <input
                      className="w-full border px-1"
                      value={editedValue}
                      onChange={(e) => setEditedValue(e.target.value)}
                      onBlur={() => saveEdit(p.id, "productName", editedValue)}
                      autoFocus
                    />
                  ) : (
                    p.productName
                  )}
                </td>
                <td className="p-2" onClick={() => startEdit(p.id, "sku", p.sku)}>
                  {editingCell.rowId === p.id && editingCell.field === "sku" ? (
                    <input
                      className="w-full border px-1"
                      value={editedValue}
                      onChange={(e) => setEditedValue(e.target.value)}
                      onBlur={() => saveEdit(p.id, "sku", editedValue)}
                      autoFocus
                    />
                  ) : (
                    p.sku
                  )}
                </td>
                <td className="p-2" onClick={() => startEdit(p.id, "brand", p.brand)}>
                  {editingCell.rowId === p.id && editingCell.field === "brand" ? (
                    <input
                      className="w-full border px-1"
                      value={editedValue}
                      onChange={(e) => setEditedValue(e.target.value)}
                      onBlur={() => saveEdit(p.id, "brand", editedValue)}
                      autoFocus
                    />
                  ) : (
                    p.brand
                  )}
                </td>
                <td className="p-2" onClick={() => startEdit(p.id, "category", p.category)}>
                  {editingCell.rowId === p.id && editingCell.field === "category" ? (
                    <input
                      className="w-full border px-1"
                      value={editedValue}
                      onChange={(e) => setEditedValue(e.target.value)}
                      onBlur={() => saveEdit(p.id, "category", editedValue)}
                      autoFocus
                    />
                  ) : (
                    p.category
                  )}
                </td>
                <td className="p-2" onClick={() => startEdit(p.id, "quantity", p.quantity)}>
                  {editingCell.rowId === p.id && editingCell.field === "quantity" ? (
                    <input
                      type="number"
                      className="w-full border px-1"
                      value={editedValue}
                      onChange={(e) => setEditedValue(e.target.value)}
                      onBlur={() => saveEdit(p.id, "quantity", Number(editedValue))}
                      autoFocus
                    />
                  ) : (
                    p.quantity
                  )}
                </td>
                <td className="p-2" onClick={() => startEdit(p.id, "unit", p.unit)}>
                  {editingCell.rowId === p.id && editingCell.field === "unit" ? (
                    <input
                      className="w-full border px-1"
                      value={editedValue}
                      onChange={(e) => setEditedValue(e.target.value)}
                      onBlur={() => saveEdit(p.id, "unit", editedValue)}
                      autoFocus
                    />
                  ) : (
                    p.unit
                  )}
                </td>
                <td className="p-2" onClick={() => startEdit(p.id, "costPrice", p.costPrice)}>
                  {editingCell.rowId === p.id && editingCell.field === "costPrice" ? (
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border px-1"
                      value={editedValue}
                      onChange={(e) => setEditedValue(e.target.value)}
                      onBlur={() => saveEdit(p.id, "costPrice", Number(editedValue))}
                      autoFocus
                    />
                  ) : (
                    <>₹{p.costPrice}</>
                  )}
                </td>
                <td className="p-2" onClick={() => startEdit(p.id, "sellingPrice", p.sellingPrice)}>
                  {editingCell.rowId === p.id && editingCell.field === "sellingPrice" ? (
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border px-1"
                      value={editedValue}
                      onChange={(e) => setEditedValue(e.target.value)}
                      onBlur={() => saveEdit(p.id, "sellingPrice", Number(editedValue))}
                      autoFocus
                    />
                  ) : (
                    <>₹{p.sellingPrice}</>
                  )}
                </td>
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