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
    <div className="p-4 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.35)] text-white">
      <h2 className="text-lg font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Send Order Request</h2>

      {/* Universal Product Search Bar */}
      <div className="mb-4 relative">
        <input
          type="text"
          placeholder="🔍 Search product by name, SKU, brand, etc."
          className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 shadow-sm"
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
          <ul className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto text-sm z-50 rounded-xl border border-white/10 bg-[#0B0F14]/90 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            {filteredSuggestions.map((sug) => (
              <li
                key={sug.id}
                className="px-3 py-2 cursor-pointer border-b border-white/10 hover:bg-white/10"
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
                <div className="text-xs text-white/70 flex flex-wrap gap-2">
                  <span>Brand: {sug.brand || '—'}</span>
                  <span>SKU: {sug.sku || '—'}</span>
                  <span>Unit: {sug.unit || '—'}</span>
                  <span>Price: ₹{sug.sellingPrice || '—'}</span>
                  <span className={`font-semibold ${sug.quantity === 0 ? 'text-rose-300' : sug.quantity <= 10 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    In Stock: {sug.quantity}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4">
        <label className="font-medium mr-2 text-white/80">Payment Mode:</label>
        <select
          className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
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
            className="ml-4 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
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
              className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              value={splitPayment.advance}
              onChange={(e) => setSplitPayment({ ...splitPayment, advance: e.target.value })}
            />
            <input
              type="number"
              placeholder="Balance %"
              className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
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
              className="px-3 py-2 rounded-xl w-full bg-white/10 cursor-not-allowed text-white/80 border border-white/20"
              value={item.productName}
              disabled
            />
          </div>
          <input
            type="text"
            placeholder="SKU"
            className="px-3 py-2 rounded-xl bg-white/10 cursor-not-allowed text-white/80 border border-white/20"
            value={item.sku}
            disabled
          />
          <input
            type="text"
            placeholder="Brand"
            className="px-3 py-2 rounded-xl bg-white/10 cursor-not-allowed text-white/80 border border-white/20"
            value={item.brand}
            disabled
          />
          <input
            type="text"
            placeholder="Category"
            className="px-3 py-2 rounded-xl bg-white/10 cursor-not-allowed text-white/80 border border-white/20"
            value={item.category}
            disabled
          />
          <input
            type="number"
            placeholder="Quantity"
            className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            value={item.quantity}
            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
          />
          <input
            type="text"
            placeholder="Unit (e.g., kg)"
            className="px-3 py-2 rounded-xl bg-white/10 cursor-not-allowed text-white/80 border border-white/20"
            value={item.unit}
            disabled
          />
          <input
            type="number"
            placeholder="Price (₹)"
            className="px-3 py-2 rounded-xl bg-white/10 cursor-not-allowed text-white/80 border border-white/20"
            value={item.unitPrice}
            disabled
          />
          <input
            type="text"
            placeholder="Description"
            className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            value={item.description}
            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
          />
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Notes"
              className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 w-full"
              value={item.notes}
              onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
            />
            <button
              onClick={() => {
                const updated = items.filter((_, i) => i !== index);
                setItems(updated);
              }}
              className="text-rose-300 hover:text-rose-200 text-sm"
              title="Remove Row"
            >
              🗑️
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={addItemRow}
        className="mb-4 px-3 py-1 rounded-xl text-sm font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_6px_20px_rgba(16,185,129,0.35)]"
      >
        + Add Item
      </button>

      <div className="text-right font-semibold text-lg mb-3 text-white">
        Total: ₹{items.reduce((acc, item) => acc + (parseFloat(item.unitPrice || 0) * parseFloat(item.quantity || 0)), 0).toFixed(2)}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || !distributorId}
        className="block w-full py-2 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 disabled:opacity-60 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
      >
        {submitting ? 'Sending Order...' : 'Send Order'}
      </button>
    </div>
  );
};

export default RetailerOrderRequestForm;