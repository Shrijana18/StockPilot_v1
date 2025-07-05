import React from "react";

const InvoiceCard = ({ invoice }) => {
  const { customerInfo, items, total, subtotal, gst, createdAt, settings } = invoice;

  return (
    <div className="border border-gray-300 rounded-lg p-4 shadow-md bg-white hover:shadow-lg transition-all">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-lg">🧾 {settings?.invoiceType || "Invoice"}</h3>
        <span className="text-sm text-gray-500">
          {new Date(createdAt).toLocaleDateString()}
        </span>
      </div>

      <div className="mb-2">
        <p className="font-medium">{customerInfo?.name}</p>
        <p className="text-sm text-gray-600">{customerInfo?.email}</p>
        <p className="text-sm text-gray-600">{customerInfo?.phone}</p>
      </div>

      <div className="border-t pt-2 text-sm">
        {items?.slice(0, 3).map((item, index) => (
          <div key={index} className="flex justify-between">
            <span>{item.name} × {item.quantity}</span>
            <span>₹{item.subtotal}</span>
          </div>
        ))}
        {items?.length > 3 && (
          <p className="text-xs text-blue-500 mt-1">+ {items.length - 3} more items</p>
        )}
      </div>

      <div className="border-t pt-2 mt-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>₹{subtotal}</span>
        </div>
        <div className="flex justify-between">
          <span>GST</span>
          <span>₹{gst}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>₹{total}</span>
        </div>
      </div>

      <div className="mt-3 text-right">
        <button className="text-blue-600 hover:underline text-sm">
          View / Download
        </button>
      </div>
    </div>
  );
};

export default InvoiceCard;