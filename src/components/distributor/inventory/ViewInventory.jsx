import React, { useEffect, useState } from 'react';
import { getFirestore, collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const ViewInventory = () => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editedQuantities, setEditedQuantities] = useState({});

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;
    if (!user) return;

    const productsRef = collection(db, 'businesses', user.uid, 'products');
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(items);
    });

    return () => unsubscribe();
  }, []);

  const handleFieldChange = async (id, field, value) => {
    const db = getFirestore();
    const docRef = doc(db, 'businesses', getAuth().currentUser.uid, 'products', id);
    await updateDoc(docRef, {
      [field]: value
    });
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value.toLowerCase());
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const getStatus = (quantity) => {
    if (quantity == null || isNaN(quantity)) return 'Unknown';
    if (quantity > 10) return 'In Stock';
    if (quantity > 0) return 'Low';
    return 'Out of Stock';
  };

  const filteredProducts = products
    .filter(p =>
      ((p.name || p.productName)?.toLowerCase().includes(searchTerm)) ||
      (p.sku?.toLowerCase().includes(searchTerm)) ||
      (p.brand?.toLowerCase().includes(searchTerm)) ||
      (p.category?.toLowerCase().includes(searchTerm))
    )
    .filter(p => {
      const status = getStatus(editedQuantities[p.id] ?? p.quantity);
      return statusFilter === 'All' || status === statusFilter;
    })
    .sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      // Fallback for undefined/null
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Numeric sort for number fields
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // String fallback sort
      return sortOrder === 'asc'
        ? aVal.toString().localeCompare(bVal.toString(), undefined, { numeric: true })
        : bVal.toString().localeCompare(aVal.toString(), undefined, { numeric: true });
    });

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col sm:flex-row justify-between gap-2">
        <input
          type="text"
          placeholder="Search by name, brand, SKU..."
          value={searchTerm}
          onChange={handleSearch}
          className="border rounded px-3 py-1 w-full sm:w-1/3"
        />
        <div className="flex gap-2">
          <select
            onChange={(e) => setSortKey(e.target.value)}
            className="border rounded px-2 py-1"
            value={sortKey}
          >
            <option value="name">Sort by Name</option>
            <option value="sku">Sort by SKU</option>
            <option value="quantity">Sort by Quantity</option>
            <option value="costPrice">Sort by Cost Price</option>
            <option value="sellingPrice">Sort by Selling Price</option>
          </select>
          <select
            onChange={(e) => setSortOrder(e.target.value)}
            className="border rounded px-2 py-1"
            value={sortOrder}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
          <select
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-2 py-1"
            value={statusFilter}
          >
            <option value="All">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low">Low</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>
      </div>
      <div className="overflow-auto w-full">
        <table className="min-w-full bg-white border border-gray-200 rounded text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-3 border-b break-words whitespace-normal">Image</th>
              <th className="p-3 border-b whitespace-normal break-words max-w-[200px]">Product</th>
              <th className="p-3 border-b whitespace-normal break-words max-w-[200px]">SKU</th>
              <th className="p-3 border-b whitespace-normal break-words max-w-[200px]">Brand</th>
              <th className="p-3 border-b whitespace-normal break-words max-w-[200px]">Category</th>
              <th className="p-3 border-b whitespace-normal break-words max-w-[200px]">Qty</th>
              <th className="p-3 border-b whitespace-normal break-words max-w-[200px]">Unit</th>
              <th className="p-3 border-b whitespace-normal break-words max-w-[200px]">Cost</th>
              <th className="p-3 border-b whitespace-normal break-words max-w-[200px]">Sell</th>
              <th className="p-3 border-b text-center break-words whitespace-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(product => (
              <tr key={product.id} className="border-t hover:bg-gray-50">
                <td className="p-3 break-words whitespace-normal"><img src={product.imageUrl || '/placeholder.png'} alt="" className="h-10 w-10 object-cover rounded" /></td>
                <td className="p-3 border-b whitespace-normal break-words max-w-[200px]">
                  <div className="w-full overflow-x-auto">
                    <input defaultValue={product.name || product.productName} onBlur={(e) => handleFieldChange(product.id, 'name', e.target.value)} className="w-full border-b" />
                  </div>
                </td>
                <td className="p-3 border-b whitespace-normal break-words max-w-[200px]">
                  <div className="w-full overflow-x-auto">
                    <input defaultValue={product.sku} onBlur={(e) => handleFieldChange(product.id, 'sku', e.target.value)} className="w-full border-b" />
                  </div>
                </td>
                <td className="p-3 border-b whitespace-normal break-words max-w-[200px]">
                  <div className="w-full overflow-x-auto">
                    <input defaultValue={product.brand} onBlur={(e) => handleFieldChange(product.id, 'brand', e.target.value)} className="w-full border-b" />
                  </div>
                </td>
                <td className="p-3 border-b whitespace-normal break-words max-w-[200px]">
                  <div className="w-full overflow-x-auto">
                    <input defaultValue={product.category} onBlur={(e) => handleFieldChange(product.id, 'category', e.target.value)} className="w-full border-b" />
                  </div>
                </td>
                <td className="p-3 border-b whitespace-normal break-words max-w-[200px]">
                  <div className="w-full overflow-x-auto">
                    <input
                      type="number"
                      value={editedQuantities[product.id] ?? product.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setEditedQuantities(prev => ({ ...prev, [product.id]: val }));
                      }}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        handleFieldChange(product.id, 'quantity', val);
                      }}
                      className="w-full border-b"
                    />
                  </div>
                </td>
                <td className="p-3 border-b whitespace-normal break-words max-w-[200px]">
                  <div className="w-full overflow-x-auto">
                    <input defaultValue={product.unit} onBlur={(e) => handleFieldChange(product.id, 'unit', e.target.value)} className="w-full border-b" />
                  </div>
                </td>
                <td className="p-3 border-b whitespace-normal break-words max-w-[200px]">₹
                  <div className="w-full overflow-x-auto">
                    <input type="number" defaultValue={product.costPrice} onBlur={(e) => handleFieldChange(product.id, 'costPrice', parseFloat(e.target.value))} className="w-full border-b" />
                  </div>
                </td>
                <td className="p-3 border-b whitespace-normal break-words max-w-[200px]">₹
                  <div className="w-full overflow-x-auto">
                    <input type="number" defaultValue={product.sellingPrice} onBlur={(e) => handleFieldChange(product.id, 'sellingPrice', parseFloat(e.target.value))} className="w-full border-b" />
                  </div>
                </td>
                <td className="p-3 text-center break-words whitespace-normal">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                    getStatus(editedQuantities[product.id] ?? product.quantity) === 'In Stock' ? 'bg-green-100 text-green-700'
                    : getStatus(editedQuantities[product.id] ?? product.quantity) === 'Low' ? 'bg-yellow-100 text-yellow-700'
                    : getStatus(editedQuantities[product.id] ?? product.quantity) === 'Out of Stock' ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
                  }`}>
                    {getStatus(editedQuantities[product.id] ?? product.quantity)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ViewInventory;