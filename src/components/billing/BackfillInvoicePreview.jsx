import React, { useState, useEffect } from 'react';
// Inline currency formatter for ₹
const formatCurrency = (amount) => {
  if (!amount) return "₹0.00";
  return `₹${parseFloat(amount).toFixed(2)}`;
};
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const BackfillInvoicePreview = ({ parsedInvoiceData, onCancel, onConfirmSave }) => {
  const [customer, setCustomer] = useState({
    name: parsedInvoiceData.customerName || '',
    phone: parsedInvoiceData.customerPhone || '',
    email: parsedInvoiceData.customerEmail || '',
    address: parsedInvoiceData.customerAddress || ''
  });

  const [products, setProducts] = useState(parsedInvoiceData.productList || []);
  const [invoiceDate, setInvoiceDate] = useState(parsedInvoiceData.invoiceDate || '');
  const [gstPercent, setGstPercent] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Backfilled');
  const [invoiceType, setInvoiceType] = useState('Tax');
  const [retailerInfo, setRetailerInfo] = useState(null);

  // Auto-link Customer Data and Smart-Match Inventory Data
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    const fetchData = async () => {
      const db = getFirestore();
      try {
        const businessRef = doc(db, "businesses", user.uid);
        const businessSnap = await getDoc(businessRef);
        if (businessSnap.exists()) {
          setRetailerInfo(businessSnap.data());
        }
      } catch (err) {
        console.error("Error fetching retailer info:", err);
      }

      try {
        const customerSnap = await getDocs(collection(db, "businesses", user.uid, "customers"));
        customerSnap.forEach(doc => {
          const data = doc.data();
          if (data.name && data.name.toLowerCase().includes(customer.name.toLowerCase())) {
            setCustomer(prev => ({
              ...prev,
              phone: prev.phone || data.phone || "",
              email: prev.email || data.email || "",
              address: prev.address || data.address || ""
            }));
          }
        });
      } catch (err) {
        console.error("Error auto-matching customer:", err);
      }

      try {
        const inventorySnap = await getDocs(collection(db, "businesses", user.uid, "inventory"));
        const updatedProducts = [...products];
        inventorySnap.forEach(doc => {
          const inv = doc.data();
          updatedProducts.forEach((p, i) => {
            if (p.name && inv.name && inv.name.toLowerCase().includes(p.name.toLowerCase())) {
              updatedProducts[i] = {
                ...p,
                brand: p.brand || inv.brand || "",
                category: p.category || inv.category || "",
                unit: p.unit || inv.unit || "",
                sku: p.sku || inv.sku || ""
              };
            }
          });
        });
        setProducts(updatedProducts);
      } catch (err) {
        console.error("Error auto-matching inventory:", err);
      }
    };

    fetchData();
  }, []);

  const handleProductChange = (index, field, value) => {
    const updated = [...products];
    updated[index][field] = value;
    setProducts(updated);
  };

  const handleSave = async () => {
    const subtotal = products.reduce((sum, item) => {
      const itemSubtotal = (parseFloat(item.price || 0) * parseFloat(item.quantity || 0)) * (1 - (parseFloat(item.discount || 0) / 100));
      return sum + itemSubtotal;
    }, 0);
    const gstAmount = (subtotal * gstPercent) / 100;
    const total = subtotal + gstAmount;

    const invoiceToSave = {
      customer,
      products,
      invoiceDate,
      gstPercent,
      gstAmount,
      subtotal,
      total,
      paymentMode,
      invoiceType,
      status: 'backfilled',
      createdAt: new Date().toISOString()
    };

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return alert("User not logged in");

    const db = getFirestore();
    const invoiceRef = collection(db, "businesses", user.uid, "finalizedInvoices");

    await addDoc(invoiceRef, {
      ...invoiceToSave,
      invoiceId: `FLYP-${Date.now()}`,
      issuedAt: serverTimestamp()
    });

    if (onConfirmSave) onConfirmSave();
  };

  // Calculate subtotal for summary
  const subtotal = products.reduce((sum, item) => {
    const itemSubtotal = (parseFloat(item.price || 0) * parseFloat(item.quantity || 0)) * (1 - (parseFloat(item.discount || 0) / 100));
    return sum + itemSubtotal;
  }, 0);
  const gstAmount = (subtotal * gstPercent) / 100;
  const total = subtotal + gstAmount;

  return (
    <div className="bg-white shadow-lg p-6 rounded-md">
      <h2 className="text-2xl font-bold mb-4">Backfilled Invoice Preview</h2>

      {/* Top section: Customer Info and Retailer Info side by side */}
      <div className="flex justify-between mb-6 gap-6">
        {/* Customer Info */}
        <div className="w-1/2 border rounded p-4">
          <h3 className="font-semibold mb-2">Customer Info</h3>
          <label className="block mb-1">Name:
            <input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} className="border p-1 w-full mt-1" />
          </label>
          <label className="block mb-1">Phone:
            <input value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} className="border p-1 w-full mt-1" />
          </label>
          <label className="block mb-1">Email:
            <input value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} className="border p-1 w-full mt-1" />
          </label>
          <label className="block mb-1">Address:
            <input value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} className="border p-1 w-full mt-1" />
          </label>
        </div>

        {/* Retailer Info */}
        <div className="w-1/2 border rounded p-4">
          <h3 className="font-semibold mb-2">Retailer Info</h3>
          {retailerInfo ? (
            <>
              <p><strong>Business Name:</strong> {retailerInfo.businessName || "N/A"}</p>
              <p><strong>Owner:</strong> {retailerInfo.ownerName || "N/A"}</p>
              <p><strong>Phone:</strong> {retailerInfo.phone || "N/A"}</p>
              <p><strong>Email:</strong> {retailerInfo.email || "N/A"}</p>
              <p><strong>Address:</strong> {retailerInfo.address || "N/A"}</p>
              <p><strong>GSTIN:</strong> {retailerInfo.gstNumber || "N/A"}</p>
            </>
          ) : (
            <p>Loading...</p>
          )}
        </div>
      </div>

      {/* Product Table */}
      <table className="w-full border mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th>Name</th><th>Brand</th><th>Category</th><th>Qty</th><th>Unit</th><th>Price</th><th>Discount (%)</th><th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {products.map((item, idx) => {
            const itemSubtotal = (parseFloat(item.price || 0) * parseFloat(item.quantity || 0)) * (1 - (parseFloat(item.discount || 0) / 100));
            return (
              <tr key={idx}>
                <td><input value={item.name} onChange={e => handleProductChange(idx, 'name', e.target.value)} className="border p-1 w-full" /></td>
                <td><input value={item.brand || ''} onChange={e => handleProductChange(idx, 'brand', e.target.value)} className="border p-1 w-full" /></td>
                <td><input value={item.category || ''} onChange={e => handleProductChange(idx, 'category', e.target.value)} className="border p-1 w-full" /></td>
                <td><input type="number" value={item.quantity} onChange={e => handleProductChange(idx, 'quantity', e.target.value)} className="border p-1 w-16" /></td>
                <td><input value={item.unit} onChange={e => handleProductChange(idx, 'unit', e.target.value)} className="border p-1 w-20" /></td>
                <td><input type="number" value={item.price} onChange={e => handleProductChange(idx, 'price', e.target.value)} className="border p-1 w-24" /></td>
                <td><input type="number" value={item.discount || 0} onChange={e => handleProductChange(idx, 'discount', e.target.value)} className="border p-1 w-20" /></td>
                <td className="text-right px-2">{formatCurrency(itemSubtotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Settings */}
      <div className="flex items-center gap-4 mb-4">
        <label>Date: <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="border p-1 ml-2" /></label>
        <label>GST %: <input type="number" value={gstPercent} onChange={e => setGstPercent(e.target.value)} className="border p-1 ml-2 w-20" /></label>
        <label>Payment Mode:
          <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="border p-1 ml-2">
            <option>Backfilled</option>
            <option>Cash</option>
            <option>UPI</option>
            <option>Card</option>
          </select>
        </label>
        <label>Invoice Type:
          <select value={invoiceType} onChange={e => setInvoiceType(e.target.value)} className="border p-1 ml-2">
            <option>Tax</option>
            <option>Retail</option>
            <option>Estimate</option>
          </select>
        </label>
      </div>

      {/* Tax Summary and Total */}
      <div className="text-right mt-4 border-t pt-4">
        <p>Subtotal: {formatCurrency(subtotal)}</p>
        <p>GST ({gstPercent}%): {formatCurrency(gstAmount)}</p>
        <p className="text-lg font-bold">Total: {formatCurrency(total)}</p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4 mt-6">
        <button onClick={onCancel} className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded">Cancel</button>
        <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded shadow-md">Confirm & Save</button>
      </div>
    </div>
  );
};

export default BackfillInvoicePreview;