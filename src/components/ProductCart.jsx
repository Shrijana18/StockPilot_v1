import React from "react";

const ProductCart = ({ cart, updateCartItem, removeCartItem }) => {
  const handleChange = (index, field, value) => {
    const updated = [...cart];
    if (field === "quantity" || field === "price" || field === "discount") {
      updated[index][field] = parseFloat(value) || 0;
    }
    updated[index].subtotal =
      updated[index].quantity *
      updated[index].price *
      (1 - updated[index].discount / 100);
    updateCartItem(updated);
  };

  return (
    <div className="bg-white p-4 rounded shadow mb-4 overflow-auto">
      <h2 className="text-lg font-semibold mb-2">Product Cart</h2>
      {cart.length === 0 ? (
        <p className="text-gray-500 italic">No products added yet.</p>
      ) : (
        <table className="min-w-full text-sm text-left border">
          <thead className="bg-gray-100 text-xs uppercase">
            <tr>
              <th className="p-2 border">Name</th>
              <th className="p-2 border">SKU</th>
              <th className="p-2 border">Qty</th>
              <th className="p-2 border">Price</th>
              <th className="p-2 border">Discount (%)</th>
              <th className="p-2 border">Subtotal</th>
              <th className="p-2 border">Action</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((item, idx) => (
              <tr key={idx}>
                <td className="p-2 border">{item.name}</td>
                <td className="p-2 border">{item.sku}</td>
                <td className="p-2 border">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      handleChange(idx, "quantity", e.target.value)
                    }
                    className="w-16 border rounded p-1"
                    min={1}
                  />
                </td>
                <td className="p-2 border">
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) =>
                      handleChange(idx, "price", e.target.value)
                    }
                    className="w-20 border rounded p-1"
                  />
                </td>
                <td className="p-2 border">
                  <input
                    type="number"
                    value={item.discount}
                    onChange={(e) =>
                      handleChange(idx, "discount", e.target.value)
                    }
                    className="w-16 border rounded p-1"
                  />
                </td>
                <td className="p-2 border font-semibold">
                  ₹{item.subtotal.toFixed(2)}
                </td>
                <td className="p-2 border">
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => removeCartItem(idx)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ProductCart;