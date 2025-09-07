import React, { useState, useEffect } from "react";

const BillingCart = ({ selectedProducts = [], cartItems: cartItemsProp, onUpdateCart, settings }) => {
  const [cartItems, setCartItems] = useState([]);
  const isControlled = Array.isArray(cartItemsProp);
  const items = isControlled ? cartItemsProp : cartItems;

  // Extract all tax-related values including SGST
  const {
    includeGST,
    gstRate,
    enableCGST,
    enableSGST,
    enableIGST,
    includeCGST,
    includeSGST,
    includeIGST,
    cgstRate,
    sgstRate,
    igstRate,
  } = settings || {};

  const pushUpdate = (next) => {
    if (onUpdateCart) {
      const taxBreakdown = {
        gst: includeGST && gstRate ? (next.reduce((s,i)=>s + (i.price - (i.price * (parseFloat(i.discount)||0)/100)) * (parseFloat(i.quantity)||0),0) * gstRate) / 100 : 0,
        cgst: includeCGST && cgstRate ? (next.reduce((s,i)=>s + (i.price - (i.price * (parseFloat(i.discount)||0)/100)) * (parseFloat(i.quantity)||0),0) * cgstRate) / 100 : 0,
        sgst: includeSGST && sgstRate ? (next.reduce((s,i)=>s + (i.price - (i.price * (parseFloat(i.discount)||0)/100)) * (parseFloat(i.quantity)||0),0) * sgstRate) / 100 : 0,
        igst: includeIGST && igstRate ? (next.reduce((s,i)=>s + (i.price - (i.price * (parseFloat(i.discount)||0)/100)) * (parseFloat(i.quantity)||0),0) * igstRate) / 100 : 0,
      };
      const sub = next.reduce((total, it) => {
        const q = Math.max(0, parseFloat(it.quantity)||0);
        const p = Math.max(0, parseFloat(it.price)||0);
        const d = Math.max(0, Math.min(100, parseFloat(it.discount)||0));
        const discounted = p - (p * d) / 100;
        return total + discounted * q;
      }, 0);
      const finalTotal = sub + taxBreakdown.gst + taxBreakdown.cgst + taxBreakdown.sgst + taxBreakdown.igst;
      onUpdateCart(next, { subtotal: sub, taxBreakdown, finalTotal });
    }
    if (!isControlled) setCartItems(next);
  };

  const handleAddItem = () => {
    const next = [
      ...items,
      { id: "manual", name: "", sku: "", brand: "", category: "", unit: "", quantity: 1, price: 0, discount: 0 },
    ];
    pushUpdate(next);
  };

  const handleChange = (index, field, value) => {
    const next = [...items];
    let v = value;
    if (field === "quantity" || field === "price" || field === "discount") {
      v = parseFloat(value);
      if (Number.isNaN(v)) v = 0;
      if (field === "discount") v = Math.max(0, Math.min(100, v));
    }
    next[index] = { ...next[index], [field]: v };
    pushUpdate(next);
  };

  const handleRemove = (index) => {
    const next = items.filter((_, i) => i !== index);
    pushUpdate(next);
  };

  const calculateSubtotal = (item) => {
    const q = Math.max(0, parseFloat(item.quantity) || 0);
    const p = Math.max(0, parseFloat(item.price) || 0);
    const d = Math.max(0, Math.min(100, parseFloat(item.discount) || 0));
    const discounted = p - (p * d) / 100;
    return (discounted * q).toFixed(2);
  };

  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      (item.price - (item.price * item.discount) / 100) * item.quantity,
    0
  );

  // GST, CGST, SGST, IGST calculation (Firestore-driven)
  const gstAmount =
    (includeGST && gstRate ? (subtotal * gstRate) / 100 : 0) +
    (includeCGST && cgstRate ? (subtotal * cgstRate) / 100 : 0) +
    (includeSGST && sgstRate ? (subtotal * sgstRate) / 100 : 0) +
    (includeIGST && igstRate ? (subtotal * igstRate) / 100 : 0);

  const finalTotal = subtotal + gstAmount;

  useEffect(() => {
    if (!selectedProducts || selectedProducts.length === 0) return;
    // When using controlled mode, dedupe against the controlled list; otherwise use local state
    const base = items;
    const newItems = selectedProducts
      .filter((product) => !base.some((item) => item.sku === (product.sku || "")))
      .map((product) => ({
        id: product.id,
        name: product.name || product.productName || "",
        sku: product.sku || "",
        brand: product.brand || "",
        category: product.category || "",
        unit: product.unit || "",
        quantity: 1,
        price: parseFloat(product.sellingPrice) || 0,
        discount: 0,
      }));
    if (newItems.length > 0) {
      pushUpdate([...base, ...newItems]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProducts]);

  useEffect(() => {
    // Keep console log for debugging current rendered items
    console.log("Rendered Items (source-of-truth):", items);
    // When controlled, updates are pushed synchronously through handlers; nothing to do here
  }, [items]);

  return (
    <div className="space-y-6 px-4 pt-4 md:px-6 text-white">
      <div className="space-y-4">
        <button
          onClick={handleAddItem}
          className="px-4 py-2 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_10px_30px_rgba(16,185,129,0.35)] transition"
        >
          + Add Item
        </button>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-white/10 bg-white/5 backdrop-blur-xl rounded-xl overflow-hidden">
            <thead className="text-left bg-white/10">
              <tr>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Product Name</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">SKU</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Brand</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Category</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Unit</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Qty</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Price</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Discount (%)</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Subtotal</th>
                <th className="p-2 md:p-3 text-xs md:text-sm font-semibold text-white/80 border-b border-white/10">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-t border-white/10 hover:bg-white/5">
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.name || ""}
                      onChange={(e) => handleChange(index, "name", e.target.value)}
                      className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.sku || ""}
                      onChange={(e) => handleChange(index, "sku", e.target.value)}
                      className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.brand || ""}
                      onChange={(e) => handleChange(index, "brand", e.target.value)}
                      className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.category || ""}
                      onChange={(e) => handleChange(index, "category", e.target.value)}
                      className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.unit || ""}
                      onChange={(e) => handleChange(index, "unit", e.target.value)}
                      className="w-full px-2 py-1 rounded bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={item.quantity || 0}
                      onChange={(e) => handleChange(index, "quantity", e.target.value)}
                      className="w-16 px-2 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={item.price || 0}
                      onChange={(e) => handleChange(index, "price", e.target.value)}
                      className="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={item.discount || 0}
                      onChange={(e) => handleChange(index, "discount", e.target.value)}
                      className="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    />
                  </td>
                  <td className="p-2 md:p-3 text-white/90">{calculateSubtotal(item)}</td>
                  <td className="p-2">
                    <button
                      onClick={() => handleRemove(index)}
                      className="text-rose-300 hover:text-rose-200 underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Bill Summary */}
      <div className="mt-6 text-right space-y-2 text-sm md:text-base bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 md:p-6">
        <p>Total Items: {items.length}</p>
        <p>Total Quantity: {items.reduce((sum, item) => sum + item.quantity, 0)}</p>
        <p>
          Total Before Discount: ₹
          {items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}
        </p>
        <p>
          Total Discount: ₹
          {items.reduce(
            (sum, item) => sum + (item.price * item.discount * item.quantity) / 100,
            0
          ).toFixed(2)}
        </p>
        {includeGST && gstRate > 0 && (
          <p>GST ({gstRate}%): ₹{((subtotal * gstRate) / 100).toFixed(2)}</p>
        )}
        {includeCGST && cgstRate > 0 && (
          <p>CGST ({cgstRate}%): ₹{((subtotal * cgstRate) / 100).toFixed(2)}</p>
        )}
        {includeSGST && sgstRate > 0 && (
          <p>SGST ({sgstRate}%): ₹{((subtotal * sgstRate) / 100).toFixed(2)}</p>
        )}
        {includeIGST && igstRate > 0 && (
          <p>IGST ({igstRate}%): ₹{((subtotal * igstRate) / 100).toFixed(2)}</p>
        )}
        <p className="font-semibold text-lg">
          Final Total: ₹{finalTotal.toFixed(2)}
        </p>
      </div>
    </div>
  );
};

export default BillingCart;