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
    <div className="bg-white p-4 md:p-6 rounded-xl shadow-md mb-6 overflow-x-auto space-y-4">
      <h2 className="text-lg font-semibold mb-2">Product Cart</h2>
      {cart.length === 0 ? (
        <p className="text-gray-500 italic">No products added yet.</p>
      ) : (
        <table className="min-w-[600px] w-full text-sm text-left border">
          <thead className="bg-gray-100 text-xs uppercase">
            <tr>
              <th className="p-2 border text-xs md:text-sm">Name</th>
              <th className="p-2 border text-xs md:text-sm">SKU</th>
              <th className="p-2 border text-xs md:text-sm">Qty</th>
              <th className="p-2 border text-xs md:text-sm">Price</th>
              <th className="p-2 border text-xs md:text-sm">Discount (%)</th>
              <th className="p-2 border text-xs md:text-sm">Subtotal</th>
              <th className="p-2 border text-xs md:text-sm">Action</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((item, idx) => (
              <tr key={idx}>
                <td className="p-2 border text-xs md:text-sm">{item.name}</td>
                <td className="p-2 border text-xs md:text-sm">{item.sku}</td>
                <td className="p-2 border text-xs md:text-sm">
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
                <td className="p-2 border text-xs md:text-sm">
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) =>
                      handleChange(idx, "price", e.target.value)
                    }
                    className="w-20 border rounded p-1"
                  />
                </td>
                <td className="p-2 border text-xs md:text-sm">
                  <input
                    type="number"
                    value={item.discount}
                    onChange={(e) =>
                      handleChange(idx, "discount", e.target.value)
                    }
                    className="w-16 border rounded p-1"
                  />
                </td>
                <td className="p-2 border font-semibold text-xs md:text-sm">
                  ₹{item.subtotal.toFixed(2)}
                </td>
                <td className="p-2 border text-xs md:text-sm">
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