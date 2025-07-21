import React, { useState, useEffect } from "react";

const BillingCart = ({ selectedProducts = [], onUpdateCart }) => {
  const [cartItems, setCartItems] = useState([]);

  const handleAddItem = () => {
    setCartItems([
      ...cartItems,
      { id: "manual", name: "", sku: "", brand: "", category: "", unit: "", quantity: 1, price: 0, discount: 0 },
    ]);
  };

  const handleChange = (index, field, value) => {
    const updated = [...cartItems];
    updated[index][field] = field === "quantity" || field === "price" || field === "discount"
      ? parseFloat(value) || 0
      : value;
    setCartItems(updated);
    // onUpdateCart is now handled in useEffect
  };

  const handleRemove = (index) => {
    const updated = [...cartItems];
    updated.splice(index, 1);
    setCartItems(updated);
    // onUpdateCart is now handled in useEffect
  };

  const calculateSubtotal = (item) => {
    const discounted = item.price - (item.price * item.discount) / 100;
    return (discounted * item.quantity).toFixed(2);
  };

  useEffect(() => {
    const newItems = selectedProducts
      .filter(
        (product) => !cartItems.some((item) => item.sku === product.sku)
      )
      .map((product) => ({
        id: product.id, // Add this line to link with Firestore
        name: product.productName || "",
        sku: product.sku || "",
        brand: product.brand || "",
        category: product.category || "",
        unit: product.unit || "",
        quantity: 1,
        price: product.sellingPrice || 0,
        discount: 0,
      }));

    if (newItems.length > 0) {
      setCartItems((prev) => [...prev, ...newItems]);
    }
  }, [selectedProducts]);

  useEffect(() => {
    // Notify parent of cart update after cartItems is set
    console.log("Updated Cart Items:", cartItems);
    if (onUpdateCart && cartItems.length > 0) {
      onUpdateCart(cartItems);
    }
  }, [cartItems]);

  return (
    <div>
      <div className="space-y-4">
        <button
          onClick={handleAddItem}
          className="bg-green-600 text-white px-4 py-2 rounded shadow"
        >
          + Add Item
        </button>

        <table className="min-w-full border border-gray-300 text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-2">Product Name</th>
              <th className="p-2">SKU</th>
              <th className="p-2">Brand</th>
              <th className="p-2">Category</th>
              <th className="p-2">Unit</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Price</th>
              <th className="p-2">Discount (%)</th>
              <th className="p-2">Subtotal</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {cartItems.map((item, index) => (
              <tr key={index} className="border-t">
                <td className="p-2">
                  <input
                    type="text"
                    value={item.name || ""}
                    onChange={(e) => handleChange(index, "name", e.target.value)}
                    className="w-full border px-2 py-1 rounded"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="text"
                    value={item.sku || ""}
                    onChange={(e) => handleChange(index, "sku", e.target.value)}
                    className="w-full border px-2 py-1 rounded"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="text"
                    value={item.brand || ""}
                    onChange={(e) => handleChange(index, "brand", e.target.value)}
                    className="w-full border px-2 py-1 rounded"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="text"
                    value={item.category || ""}
                    onChange={(e) => handleChange(index, "category", e.target.value)}
                    className="w-full border px-2 py-1 rounded"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="text"
                    value={item.unit || ""}
                    onChange={(e) => handleChange(index, "unit", e.target.value)}
                    className="w-full border px-2 py-1 rounded"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={item.quantity || 0}
                    onChange={(e) => handleChange(index, "quantity", e.target.value)}
                    className="w-16 border px-2 py-1 rounded"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={item.price || 0}
                    onChange={(e) => handleChange(index, "price", e.target.value)}
                    className="w-20 border px-2 py-1 rounded"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={item.discount || 0}
                    onChange={(e) => handleChange(index, "discount", e.target.value)}
                    className="w-20 border px-2 py-1 rounded"
                  />
                </td>
                <td className="p-2">{calculateSubtotal(item)}</td>
                <td className="p-2">
                  <button
                    onClick={() => handleRemove(index)}
                    className="text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Bill Summary */}
      <div className="mt-4 text-right space-y-1">
        <p>Total Items: {cartItems.length}</p>
        <p>
          Total Quantity:{" "}
          {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
        </p>
        <p>
          Total Before Discount: ₹
          {cartItems
            .reduce((sum, item) => sum + item.price * item.quantity, 0)
            .toFixed(2)}
        </p>
        <p>
          Total Discount: ₹
          {cartItems
            .reduce(
              (sum, item) =>
                sum + (item.price * item.discount * item.quantity) / 100,
              0
            )
            .toFixed(2)}
        </p>
        <p className="font-semibold text-lg">
          Final Total: ₹
          {cartItems
            .reduce(
              (sum, item) =>
                sum +
                (item.price - (item.price * item.discount) / 100) * item.quantity,
              0
            )
            .toFixed(2)}
        </p>
      </div>
    </div>
  );
};

export default BillingCart;