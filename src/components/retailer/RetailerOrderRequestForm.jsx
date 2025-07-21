import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { db, auth } from '../../firebase/firebaseConfig';
import { collection, doc, setDoc, serverTimestamp, addDoc, onSnapshot, query, getDoc } from 'firebase/firestore';

const RetailerOrderRequestForm = ({ distributorId }) => {
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [distributorInventory, setDistributorInventory] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);

  const [paymentMode, setPaymentMode] = useState('COD');
  const [creditDays, setCreditDays] = useState(15);
  const [splitPayment, setSplitPayment] = useState({ advance: '', balance: '' });

  useEffect(() => {
    if (!distributorId) return;
    const q = query(collection(db, "businesses", distributorId, "products"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDistributorInventory(data);
    });
    return () => unsubscribe();
  }, [distributorId]);

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);

    if (field === 'productName') {
      const lower = value.toLowerCase();
      const filtered = distributorInventory.filter(prod =>
        prod.productName?.toLowerCase().includes(lower) ||
        prod.sku?.toLowerCase().includes(lower) ||
        prod.brand?.toLowerCase().includes(lower) ||
        prod.category?.toLowerCase().includes(lower) ||
        prod.unit?.toLowerCase().includes(lower) ||
        (prod.sellingPrice + '').includes(lower)
      );
      setFilteredSuggestions(filtered);
    }
  };

  const addItemRow = () => {
    setItems([...items, { productName: '', sku: '', brand: '', category: '', quantity: '', unit: '', description: '', notes: '', unitPrice: '' }]);
  };

  const handleSubmit = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !distributorId || items.length === 0) return;

    try {
      setSubmitting(true);
      const totalAmount = items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.unitPrice) || 0;
        return sum + qty * price;
      }, 0);

      const distributorSnap = await getDoc(doc(db, 'businesses', distributorId));
      const distributorData = distributorSnap.exists() ? distributorSnap.data() : {};

      const distributorPhone = distributorData.phone || '';
      const distributorEmail = distributorData.email || '';

      const distributorRef = collection(db, `businesses/${distributorId}/orderRequests`);
      const docRef = await addDoc(distributorRef, {
        retailerId: currentUser.uid,
        distributorId: distributorId,
        items,
        totalAmount,
        paymentMode,
        creditDays: paymentMode === 'Credit Cycle' ? creditDays : null,
        splitPayment: paymentMode === 'Split Payment' ? splitPayment : null,
        status: 'Requested',
        timestamp: serverTimestamp(),
        distributorName: distributorData.businessName || distributorData.ownerName || '',
        distributorCity: distributorData.city || '',
        distributorState: distributorData.state || '',
        distributorPhone,
        distributorEmail,
      });

      const retailerRef = doc(db, `businesses/${currentUser.uid}/sentOrders/${docRef.id}`);
      await setDoc(retailerRef, {
        retailerId: currentUser.uid,
        distributorId: distributorId,
        items,
        totalAmount,
        paymentMode,
        creditDays: paymentMode === 'Credit Cycle' ? creditDays : null,
        splitPayment: paymentMode === 'Split Payment' ? splitPayment : null,
        status: 'Requested',
        timestamp: serverTimestamp(),
        distributorName: distributorData.businessName || distributorData.ownerName || '',
        distributorCity: distributorData.city || '',
        distributorState: distributorData.state || '',
        distributorPhone,
        distributorEmail,
      });

      toast.success('Order request sent successfully!');
      setItems([{ productName: '', sku: '', brand: '', category: '', quantity: '', unit: '', description: '', notes: '', unitPrice: '' }]);
    } catch (err) {
      console.error('Error sending order:', err);
      alert('Failed to send order request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 border rounded shadow-md bg-white">
      <h2 className="text-lg font-semibold mb-4">Send Order Request</h2>

      {/* Universal Product Search Bar */}
      <div className="mb-4 relative">
        <input
          type="text"
          placeholder="🔍 Search product by name, SKU, brand, etc."
          className="w-full px-4 py-2 border rounded shadow-sm"
          onChange={(e) => {
            const query = e.target.value.toLowerCase();
            if (query.trim() === "") {
              setFilteredSuggestions([]);
              return;
            }
            const filtered = distributorInventory.filter(prod =>
              prod.productName?.toLowerCase().includes(query) ||
              prod.sku?.toLowerCase().includes(query) ||
              prod.brand?.toLowerCase().includes(query) ||
              prod.category?.toLowerCase().includes(query) ||
              (prod.sellingPrice + '').includes(query)
            );
            setFilteredSuggestions(filtered);
          }}
        />
        {filteredSuggestions.length > 0 && (
          <ul className="bg-white border rounded mt-1 max-h-40 overflow-y-auto text-sm absolute left-0 right-0 z-20">
            {filteredSuggestions.map((sug) => (
              <li
                key={sug.id}
                className="px-3 py-2 hover:bg-blue-100 cursor-pointer border-b"
                onClick={() => {
                  const alreadyAdded = items.some(existing => existing.sku === sug.sku);
                  if (alreadyAdded) {
                    toast.warning('Item already added to cart.');
                    return;
                  }
                  setItems([...items, {
                    productName: sug.productName,
                    sku: sug.sku,
                    brand: sug.brand,
                    category: sug.category,
                    quantity: '',
                    unit: sug.unit || '',
                    description: '',
                    notes: '',
                    unitPrice: sug.sellingPrice || '',
                    available: sug.quantity,
                    distributorProductId: sug.id
                  }]);
                  setFilteredSuggestions([]);
                }}
              >
                <div className="font-semibold">{sug.productName}</div>
                <div className="text-xs text-gray-600 flex flex-wrap gap-2">
                  <span>Brand: {sug.brand || '—'}</span>
                  <span>SKU: {sug.sku || '—'}</span>
                  <span>Unit: {sug.unit || '—'}</span>
                  <span>Price: ₹{sug.sellingPrice || '—'}</span>
                  <span className={`font-semibold ${sug.quantity === 0 ? 'text-red-600' : sug.quantity <= 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                    In Stock: {sug.quantity}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4">
        <label className="font-medium mr-2">Payment Mode:</label>
        <select
          className="border px-3 py-2 rounded"
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value)}
        >
          <option value="COD">Cash on Delivery</option>
          <option value="Advance Payment">Advance Payment</option>
          <option value="Credit Cycle">Credit Cycle</option>
          <option value="Post-Sale Payment">Post-Sale Payment</option>
          <option value="Split Payment">Split Payment</option>
          <option value="Monthly Ledger">Monthly Credit Statement</option>
        </select>
        {paymentMode === 'Credit Cycle' && (
          <input
            type="number"
            className="ml-4 border px-3 py-2 rounded"
            placeholder="Credit days"
            value={creditDays}
            onChange={(e) => setCreditDays(e.target.value)}
          />
        )}
        {paymentMode === 'Split Payment' && (
          <div className="ml-4 flex gap-2 mt-2">
            <input
              type="number"
              placeholder="Advance %"
              className="border px-3 py-2 rounded"
              value={splitPayment.advance}
              onChange={(e) => setSplitPayment({ ...splitPayment, advance: e.target.value })}
            />
            <input
              type="number"
              placeholder="Balance %"
              className="border px-3 py-2 rounded"
              value={splitPayment.balance}
              onChange={(e) => setSplitPayment({ ...splitPayment, balance: e.target.value })}
            />
          </div>
        )}
      </div>

      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-9 gap-2 mb-2 items-center">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Product Name"
              className="border px-3 py-2 rounded w-full bg-gray-100 cursor-not-allowed"
              value={item.productName}
              disabled
            />
          </div>
          <input
            type="text"
            placeholder="SKU"
            className="border px-3 py-2 rounded bg-gray-100 cursor-not-allowed"
            value={item.sku}
            disabled
          />
          <input
            type="text"
            placeholder="Brand"
            className="border px-3 py-2 rounded bg-gray-100 cursor-not-allowed"
            value={item.brand}
            disabled
          />
          <input
            type="text"
            placeholder="Category"
            className="border px-3 py-2 rounded bg-gray-100 cursor-not-allowed"
            value={item.category}
            disabled
          />
          <input
            type="number"
            placeholder="Quantity"
            className="border px-3 py-2 rounded"
            value={item.quantity}
            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
          />
          <input
            type="text"
            placeholder="Unit (e.g., kg)"
            className="border px-3 py-2 rounded bg-gray-100 cursor-not-allowed"
            value={item.unit}
            disabled
          />
          <input
            type="number"
            placeholder="Price (₹)"
            className="border px-3 py-2 rounded bg-gray-100 cursor-not-allowed"
            value={item.unitPrice}
            disabled
          />
          <input
            type="text"
            placeholder="Description"
            className="border px-3 py-2 rounded"
            value={item.description}
            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
          />
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Notes"
              className="border px-3 py-2 rounded w-full"
              value={item.notes}
              onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
            />
            <button
              onClick={() => {
                const updated = items.filter((_, i) => i !== index);
                setItems(updated);
              }}
              className="text-red-500 hover:text-red-700 text-sm"
              title="Remove Row"
            >
              🗑️
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={addItemRow}
        className="mb-4 bg-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-400"
      >
        + Add Item
      </button>

      <div className="text-right font-semibold text-lg mb-3">
        Total: ₹{items.reduce((acc, item) => acc + (parseFloat(item.unitPrice || 0) * parseFloat(item.quantity || 0)), 0).toFixed(2)}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || !distributorId}
        className="block w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
      >
        {submitting ? 'Sending Order...' : 'Send Order'}
      </button>
    </div>
  );
};

export default RetailerOrderRequestForm;