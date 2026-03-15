import React from "react";

const InvoiceCard = ({ invoice, onView }) => {
  // Normalize: billing POS uses customerInfo/items/total/subtotal/gst
  //            restaurant POS uses customer/lines/totals.grandTotal
  const cust      = invoice.customerInfo || invoice.customer || {};
  const lineItems = invoice.items || invoice.lines || [];
  const grandTotal  = invoice.total      ?? invoice.totals?.grandTotal  ?? invoice.totalAmount ?? 0;
  const subTotalAmt = invoice.subtotal   ?? invoice.totals?.subTotal    ?? 0;
  const taxAmt      = invoice.gst        ?? invoice.totals?.tax         ?? 0;
  const isRestaurant = invoice.meta?.source === "restaurant-pos";
  const { createdAt, settings, invoiceId, id } = invoice;

  const displayId = invoiceId || id || "—";
  const dateStr   = createdAt
    ? new Date(typeof createdAt === "number" ? createdAt : createdAt?.toDate?.() || createdAt)
        .toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="w-full max-w-md mx-auto mb-4">
      <div className="border border-gray-200 rounded-xl p-4 shadow-md bg-white hover:shadow-lg transition-all overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap gap-2 justify-between items-start mb-2">
          <div>
            <div className="font-semibold text-sm flex items-center gap-1.5">
              {isRestaurant ? "🍽️" : "🧾"}{" "}
              {isRestaurant ? `${invoice.meta?.tableName || "Table"} · ${invoice.meta?.tableZone || ""}` : (settings?.invoiceType || "Invoice")}
            </div>
            <div className="text-[11px] text-gray-400 font-mono mt-0.5">#{displayId}</div>
          </div>
          <span className="text-xs text-gray-500 text-right">{dateStr}</span>
        </div>

        {/* Customer */}
        {(cust.name || cust.email || cust.phone) && (
          <div className="mb-2 bg-gray-50 rounded-lg px-3 py-2">
            {cust.name  && <p className="font-medium text-sm">{cust.name}</p>}
            {cust.phone && <p className="text-xs text-gray-500">{cust.phone}</p>}
            {cust.email && <p className="text-xs text-gray-500">{cust.email}</p>}
          </div>
        )}

        {/* Items */}
        <div className="border-t pt-2 text-xs space-y-1">
          {lineItems.slice(0, 3).map((item, index) => {
            const name = item.product?.name || item.name || "Item";
            const qty  = item.qty ?? item.quantity ?? 1;
            const price = item.product?.price ?? item.price ?? 0;
            const lineTotal = item.subtotal ?? (price * qty);
            return (
              <div key={index} className="flex justify-between text-gray-700">
                <span>{name} × {qty}</span>
                <span>₹{Number(lineTotal).toFixed(2)}</span>
              </div>
            );
          })}
          {lineItems.length > 3 && (
            <p className="text-xs text-blue-500">+ {lineItems.length - 3} more items</p>
          )}
        </div>

        {/* Totals */}
        <div className="border-t pt-2 mt-2 text-xs space-y-0.5">
          {subTotalAmt > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>₹{Number(subTotalAmt).toFixed(2)}</span>
            </div>
          )}
          {taxAmt > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Tax / GST</span><span>₹{Number(taxAmt).toFixed(2)}</span>
            </div>
          )}
          {invoice.meta?.paymentMethod && (
            <div className="flex justify-between text-gray-400">
              <span>Payment</span><span>{invoice.meta.paymentMethod}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-800 pt-1 border-t">
            <span>Total</span>
            <span>₹{Number(grandTotal).toFixed(2)}</span>
          </div>
        </div>

        {onView && (
          <div className="mt-3 text-right">
            <button onClick={onView} className="text-blue-600 hover:underline text-xs">
              View details →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceCard;