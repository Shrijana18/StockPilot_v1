import React from "react";
import moment from "moment";
import { db, auth } from "../../firebase/firebaseConfig";
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import html2pdf from "html2pdf.js";
const FLYPLogo = "/assets/flyp-logo.png";

const InvoicePreview = ({
  customer,
  cartItems,
  settings,
  paymentMode,
  invoiceType,
  issuedAt,
  userInfo,
  onCancel,
  onConfirm,
}) => {
  const [retailerData, setRetailerData] = React.useState(null);

  React.useEffect(() => {
    const fetchRetailerInfo = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const docSnap = await getDoc(doc(db, "businesses", user.uid));
      if (docSnap.exists()) {
        setRetailerData(docSnap.data());
      }
    };
    fetchRetailerInfo();
  }, []);
  const calculateSubtotal = (item) =>
    item.quantity * item.price * (1 - item.discount / 100);

  const subtotal = (cartItems || []).reduce(
    (sum, item) => sum + calculateSubtotal(item),
    0
  );

  const gstAmount = settings.includeGST
    ? (subtotal * (settings.gstRate || 0)) / 100
    : 0;
  const cgstAmount = settings.includeCGST
    ? (subtotal * (settings.cgstRate || 0)) / 100
    : 0;
  const sgstAmount = settings.includeSGST
    ? (subtotal * (settings.sgstRate || 0)) / 100
    : 0;
  const igstAmount = settings.includeIGST
    ? (subtotal * (settings.igstRate || 0)) / 100
    : 0;

  const total =
    subtotal +
    gstAmount +
    cgstAmount +
    sgstAmount +
    igstAmount;

  const handleDownloadPDF = () => {
    const element = document.getElementById("invoice-content");
    html2pdf().from(element).save(`Invoice-FLYP-${issuedAt ? new Date(issuedAt).getTime() : Date.now()}.pdf`);
  };

  const handleWhatsAppShare = async () => {
    const phone = customer.phone?.replace(/\D/g, "");
    if (phone) {
      const message = encodeURIComponent(
        `Hi ${customer.name}, your invoice of ₹${total.toFixed(2)} has been created via FLYP.\nThank you for your business!`
      );
      window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
    }
  };

  return (
    <>
      <div className="text-right mb-2 max-w-4xl mx-auto mt-4">
        <button onClick={handleDownloadPDF} className="px-4 py-1 bg-gray-700 text-white rounded mr-2">Download PDF</button>
      </div>
      <div id="invoice-content" className="bg-white p-4 md:p-6 rounded-xl shadow-md max-w-4xl mx-auto mt-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] space-y-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Invoice Preview</h2>
          <button className="text-red-500 hover:underline" onClick={onCancel}>
            Cancel
          </button>
        </div>

        <div className="flex justify-between mb-6 border-b pb-4">
          {/* Customer Info */}
          <div className="w-1/2 pr-6 border-r border-gray-300">
            <h3 className="font-semibold text-lg mb-2 border-b pb-1">Customer Information</h3>
            <p><strong>Name:</strong> {customer.name}</p>
            <p><strong>Phone:</strong> {customer.phone}</p>
            <p><strong>Email:</strong> {customer.email}</p>
            <p><strong>Address:</strong> {customer.address}</p>
          </div>

          {/* Business Info */}
          <div className="w-1/2 pl-6 text-right">
            <h3 className="font-semibold text-lg mb-2 border-b pb-1">Retailer Information</h3>
            <p><strong>Business Name:</strong> {retailerData?.businessName || "Retailer"}</p>
            <p><strong>Owner:</strong> {retailerData?.ownerName}</p>
            <p><strong>Phone:</strong> {retailerData?.phone}</p>
            <p><strong>Email:</strong> {retailerData?.email}</p>
            <p><strong>Address:</strong> {retailerData?.address}</p>
            <p><strong>GSTIN:</strong> {retailerData?.gstNumber || "N/A"}</p>
            <p><strong>PAN:</strong> {retailerData?.pan || "N/A"}</p>
            <p><strong>Invoice ID:</strong> FLYP-{issuedAt ? new Date(issuedAt).getTime() : Date.now()}</p>
            <p><strong>Invoice Issued On:</strong> {issuedAt ? moment(issuedAt).local().format("DD MMM YYYY, hh:mm A") : "N/A"}</p>
            <p><strong>Current Issue Date &amp; Time:</strong> {moment().local().format("DD MMM YYYY, hh:mm A")}</p>
          </div>
        </div>

        <h2 className="text-center font-extrabold text-2xl mb-6 uppercase tracking-widest font-bold">
          {invoiceType === 'retail'
            ? 'RETAIL INVOICE'
            : invoiceType === 'tax'
            ? 'TAX INVOICE'
            : invoiceType === 'quote'
            ? 'QUOTATION'
            : invoiceType === 'estimation'
            ? 'ESTIMATION'
            : 'TAX INVOICE'}
        </h2>

        {/* Products */}
        <div className="mb-4">
          <h3 className="text-center font-bold text-lg mt-6 uppercase">
            Products
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1">Name</th>
                  <th className="border px-2 py-1">Brand</th>
                  <th className="border px-2 py-1">Category</th>
                  <th className="border px-2 py-1">Unit</th>
                  <th className="border px-2 py-1">Qty</th>
                  <th className="border px-2 py-1">Price</th>
                  <th className="border px-2 py-1">Discount (%)</th>
                  <th className="border px-2 py-1">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border px-2 py-1">{item.name}</td>
                    <td className="border px-2 py-1">{item.brand || "-"}</td>
                    <td className="border px-2 py-1">{item.category || "-"}</td>
                    <td className="border px-2 py-1">{item.unit || "-"}</td>
                    <td className="border px-2 py-1">{item.quantity}</td>
                    <td className="border px-2 py-1">₹{item.price}</td>
                    <td className="border px-2 py-1">{item.discount || 0}</td>
                    <td className="border px-2 py-1">
                      ₹{calculateSubtotal(item).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tax Summary */}
        <div className="mb-4 text-right">
          <h3 className="font-semibold text-lg mb-2">Tax Summary</h3>
          {settings.includeGST && (
            <p className="flex justify-end gap-4">
              <span className="w-24 text-left">GST ({settings.gstRate || 0}%):</span> ₹{gstAmount.toFixed(2)}
            </p>
          )}
          {settings.includeCGST && (
            <p className="flex justify-end gap-4">
              <span className="w-24 text-left">CGST ({settings.cgstRate || 0}%):</span> ₹{cgstAmount.toFixed(2)}
            </p>
          )}
          {settings.includeSGST && (
            <p className="flex justify-end gap-4">
              <span className="w-24 text-left">SGST ({settings.sgstRate || 0}%):</span> ₹{sgstAmount.toFixed(2)}
            </p>
          )}
          {settings.includeIGST && (
            <p className="flex justify-end gap-4">
              <span className="w-24 text-left">IGST ({settings.igstRate || 0}%):</span> ₹{igstAmount.toFixed(2)}
            </p>
          )}
          <p className="mt-2 font-bold text-xl">Total: ₹{total.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">
            Payment Mode: {paymentMode || "N/A"} | Invoice Type: {invoiceType && invoiceType.length > 0 ? invoiceType.charAt(0).toUpperCase() + invoiceType.slice(1) : "N/A"}
          </p>
          {paymentMode === "credit" && (settings.creditDueDate || settings.dueDate) && (
            <p className="text-sm text-red-600 mt-1">
              Due Date: {moment(settings.creditDueDate || settings.dueDate).format("DD MMM YYYY")}
            </p>
          )}
          {settings.isPaid && settings.paidOn && (
            <p className="text-sm text-green-600 mt-1">
              ✅ Paid on: {moment(settings.paidOn.toDate?.() || settings.paidOn).format("DD MMM YYYY")} via {settings.paidVia?.toUpperCase()}
            </p>
          )}
          {paymentMode === "split" && (
            <div className="text-sm text-gray-600 mt-1 space-y-1">
              <p>Split Breakdown:</p>
              <p>- ₹{settings.splitCash ?? 0} by Cash</p>
              <p>- ₹{settings.splitUPI ?? 0} by UPI</p>
              <p>- ₹{settings.splitCard ?? 0} by Card</p>
            </div>
          )}
        </div>

        <div className="text-center">
          <div className="flex justify-between items-center mt-8">
            <div className="text-left">
              <img src={FLYPLogo} alt="FLYP Logo" className="w-24 opacity-70" />
            </div>
            <div className="text-right text-sm text-gray-500 italic">
              Thank you for your business!
            </div>
          </div>

          <button
            className="mt-6 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            onClick={onConfirm}
          >
            Publish Invoice
          </button>
        </div>
      </div>
    </>
  );
};

export default InvoicePreview;