import React, { useState } from 'react';
import { db, storage } from '../../firebase/firebaseConfig';
import { collection, doc, setDoc, updateDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';

const AddDeliveredItemsToInventory = ({ order, onClose }) => {
  const auth = getAuth();
  const [items, setItems] = useState(
    (order.items || []).map((item) => ({
      ...item,
      sellingPrice: '',
      category: item.category || '',
      brand: item.brand || '',
      imageFile: null,
      imageUrl: '',
      sku: item.sku || '',
      unit: item.unit || '',
    }))
  );
  const [loading, setLoading] = useState(false);

  const handleChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const handleFileChange = (index, file) => {
    const updated = [...items];
    updated[index].imageFile = file;
    setItems(updated);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const batchPromises = items.map(async (item, idx) => {
        let imageUrl = '';
        if (item.imageFile) {
          const imageRef = ref(storage, `products/${uuidv4()}`);
          await uploadBytes(imageRef, item.imageFile);
          imageUrl = await getDownloadURL(imageRef);
        }

        const productId = uuidv4();
        const newProduct = {
          name: item.productName || item.name || `Product ${idx + 1}`,
          sku: item.sku || `SKU-${uuidv4().slice(0, 6)}`,
          quantity: Number(item.quantity || 0),
          unit: item.unit || 'unit',
          costPrice: Number(item.price || 0),
          sellingPrice: Number(item.sellingPrice || 0),
          brand: item.brand || '',
          category: item.category || '',
          imageUrl,
          distributorPrice: Number(item.price || 0),
          sourceOrderId: order.id,
          createdAt: serverTimestamp(),
        };

        console.log("Saving product to inventory:", newProduct);

        const productsRef = collection(db, 'businesses', auth.currentUser.uid, 'products');
        const q = query(productsRef, where('name', '==', newProduct.name), where('brand', '==', newProduct.brand));
        const existingSnap = await getDocs(q);

        if (!existingSnap.empty) {
          // Update existing product
          const existingDoc = existingSnap.docs[0];
          const existingData = existingDoc.data();
          const updatedQty = Number(existingData.quantity || 0) + Number(newProduct.quantity);

          await updateDoc(existingDoc.ref, {
            quantity: updatedQty,
            costPrice: newProduct.costPrice,
            sellingPrice: newProduct.sellingPrice,
            lastUpdatedFromOrder: order.id,
          });

          console.log("Updated existing product:", existingDoc.id);
        } else {
          // Add new product
          await setDoc(doc(productsRef, productId), newProduct);
          console.log("Created new product:", productId);
        }
      });

      await Promise.all(batchPromises);

      console.log("All products saved successfully.");

      // Mark order as synced
      const orderRef = doc(db, 'businesses', auth.currentUser.uid, 'sentOrders', order.id);
      await updateDoc(orderRef, {
        inventorySynced: true,
        'statusTimestamps.inventorySyncedAt': serverTimestamp(),
      });

      alert('Items added to inventory!');
      onClose();
    } catch (err) {
      console.error("Inventory addition failed:", err);
      alert('Failed to add items.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Add Delivered Items to Inventory</h2>
      {items.map((item, idx) => (
        <div key={idx} className="border p-3 mb-3 rounded-md">
          <p><strong>{item.productName || item.name}</strong></p>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <label>Quantity</label>
              <input value={item.quantity} disabled className="w-full border px-2 py-1 rounded" />
            </div>
            <div>
              <label>Distributor Price</label>
              <input value={item.price} disabled className="w-full border px-2 py-1 rounded" />
            </div>
            <div>
              <label>Selling Price</label>
              <input
                type="number"
                value={item.sellingPrice}
                onChange={(e) => handleChange(idx, 'sellingPrice', e.target.value)}
                className="w-full border px-2 py-1 rounded"
              />
            </div>
            <div>
              <label>Brand</label>
              <input
                value={item.brand}
                onChange={(e) => handleChange(idx, 'brand', e.target.value)}
                className="w-full border px-2 py-1 rounded"
              />
            </div>
            <div>
              <label>Category</label>
              <input
                value={item.category}
                onChange={(e) => handleChange(idx, 'category', e.target.value)}
                className="w-full border px-2 py-1 rounded"
              />
            </div>
            <div>
              <label>Upload Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(idx, e.target.files[0])}
              />
            </div>
            <div>
              <label>Unit</label>
              <input
                value={item.unit}
                onChange={(e) => handleChange(idx, 'unit', e.target.value)}
                className="w-full border px-2 py-1 rounded"
              />
            </div>
            <div>
              <label>SKU</label>
              <input
                value={item.sku}
                onChange={(e) => handleChange(idx, 'sku', e.target.value)}
                className="w-full border px-2 py-1 rounded"
              />
            </div>
          </div>
        </div>
      ))}
      <div className="flex justify-between mt-4">
        <button onClick={onClose} className="bg-gray-400 text-white px-4 py-2 rounded">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {loading ? 'Adding...' : 'Add to Inventory'}
        </button>
      </div>
    </div>
  );
};

export default AddDeliveredItemsToInventory;