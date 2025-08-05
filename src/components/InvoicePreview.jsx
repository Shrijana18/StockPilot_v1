import React from "react";

const InvoicePreview = ({ invoice, onClose }) => {
  if (!invoice) return null;

  const { customer, cartItems, totalAmount, issuedAt, settings, paymentMode } = invoice;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-end">
      <div className="w-full sm:max-w-xl bg-white shadow-xl p-4 md:p-6 rounded-xl overflow-y-auto max-h-[90vh] space-y-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg md:text-xl font-semibold">Invoice Preview</h2>
          <button onClick={onClose} className="text-red-500 font-bold text-lg">✕</button>
        </div>

        <p className="text-sm text-gray-500 mb-2">Date: {new Date(issuedAt).toLocaleString()}</p>

        <div className="mb-4">
          <h3 className="font-semibold">Customer Info</h3>
          <p>Name: {customer?.name}</p>
          <p>Email: {customer?.email}</p>
          <p>Phone: {customer?.phone}</p>
          <p>Address: {customer?.address}</p>
        </div>

        <div className="mb-4">
          <h3 className="font-semibold">Items</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-2 border">Product</th>
                  <th className="text-left p-2 border">Qty</th>
                  <th className="text-left p-2 border">Price</th>
                  <th className="text-left p-2 border">Total</th>
                </tr>
              </thead>
              <tbody>
                {cartItems?.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-2 border">{item.name}</td>
                    <td className="p-2 border">{item.quantity}</td>
                    <td className="p-2 border">₹{item.price}</td>
                    <td className="p-2 border">
                      ₹{(item.quantity * item.price * (1 - (item.discount || 0) / 100)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-sm border-t pt-4">
          <p className="font-bold">Total: ₹{totalAmount}</p>
          <p>Payment Mode: {settings?.paymentMode}</p>
        </div>

        <div className="mt-4">
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Download PDF</button>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;