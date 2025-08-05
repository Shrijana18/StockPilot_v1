import React from "react";

const InvoiceSummary = ({
  cart,
  invoiceSettings,
  onGenerateInvoice,
  isGenerating,
}) => {
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const gstRate = invoiceSettings.includeGST ? 0.18 : 0; // 18% GST
  const gstAmount = subtotal * gstRate;
  const total = subtotal + gstAmount;

  const amountInWords = (amount) => {
    const formatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    });
    return formatter.format(amount);
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-xl shadow-md mb-6 space-y-4">
      <h2 className="text-base md:text-lg font-semibold mb-3">Invoice Summary</h2>
      <div className="space-y-2 text-xs md:text-sm">
        <p>Subtotal: ₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
        {invoiceSettings.includeGST && (
          <p>GST (18%): ₹{gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
        )}
        <p className="font-bold text-lg">
          Grand Total: ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </p>
        <p className="italic text-gray-500">
          In Words: {amountInWords(total)}
        </p>
      </div>

      <button
        onClick={onGenerateInvoice}
        disabled={isGenerating || cart.length === 0}
        aria-label="Finalize and Save Invoice"
        title="Click to finalize the invoice and save it"
        className={`mt-4 w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold ${
          isGenerating || cart.length === 0
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700"
        }`}
      >
        {isGenerating ? "Saving..." : "Finalize & Save Invoice"}
      </button>
    </div>
  );
};

export default InvoiceSummary;