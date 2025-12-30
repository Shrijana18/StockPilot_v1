import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import InvoicePreview from "../billing/InvoicePreview";
import { collection, getDocs, doc as docRef, getDoc, updateDoc, doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";
import moment from "moment";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import DistributorManualInvoicePdf from "./DistributorManualInvoicePdf";
import MarkPaidModal from "../billing/MarkPaidModal";
import PaymentLinkSender from "../payment/PaymentLinkSender";
import { createPortal } from "react-dom";

const DEFAULT_BILLING = {
  branding: { logoUrl: "", signatureUrl: "", stampUrl: "" },
  bank: { bankName: "", branch: "", accountNumber: "", ifsc: "", accountName: "" },
  payment: { upiId: "", upiQrUrl: "" },
  terms: "",
};

// --- normalized readers so invoices render identically ---
const deriveMode = (inv = {}) => (
  inv.paymentMode?.toLowerCase() ||
  inv.payment?.mode?.toLowerCase() ||
  inv.settings?.paymentMode?.toLowerCase() ||
  ""
);

const deriveCreditDue = (inv = {}) => (
  inv.creditDueDate ||
  inv.settings?.creditDueDate ||
  null
);

const deriveIsPaid = (inv = {}) => {
  if (typeof inv.isPaid === "boolean") return inv.isPaid;
  if (inv.payment?.isPaid === true) return true;
  if (inv.payment?.status?.toLowerCase() === "paid") return true;
  const mode = deriveMode(inv);
  return mode !== "credit"; // Non-credit invoices are considered paid by default
};

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return "N/A";
  const d = value instanceof Date ? value : (value?.toDate?.() || new Date(value));
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const d = value instanceof Date ? value : (value?.toDate?.() || new Date(value));
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildInvoiceShareLink = (invoice) => {
  if (!invoice || !auth.currentUser?.uid) return null;
  const invoiceId = invoice.id;
  const baseUrl = window.location.origin;
  return `${baseUrl}/invoice/${auth.currentUser.uid}/${invoiceId}`;
};

const buildWhatsAppLink = (invoice) => {
  if (!invoice) return null;
  const phoneRaw = invoice.customer?.phone || invoice.buyer?.phone;
  const phone = phoneRaw ? phoneRaw.toString().replace(/\D/g, "") : "";
  const invoiceNumber = invoice.invoiceNumber || invoice.invoiceId || invoice.id;
  const total = formatCurrency(invoice.totalAmount || invoice.totals?.grandTotal || 0);
  const issued = formatDateTime(invoice.issuedAt || invoice.createdAt);
  const seller =
    invoice.seller?.businessName ||
    invoice.seller?.name ||
    "our team";
  const shareLink = buildInvoiceShareLink(invoice);
  const message = [
    `📄 Invoice ${invoiceNumber}`,
    `💰 Amount: ${total}`,
    `📅 Issued: ${issued}`,
    ``,
    `🔗 View and download your digital invoice:`,
    shareLink || "Link unavailable",
    ``,
    `You can view the invoice online and download the PDF from the link above.`,
    ``,
    `Thank you for your business!`,
    `— ${seller}`,
  ]
    .join("\n")
    .trim();
  const encodedMessage = encodeURIComponent(message);
  const baseUrl = phone ? `https://wa.me/${phone}` : `https://wa.me/`;
  return `${baseUrl}?text=${encodedMessage}`;
};

const DistributorViewManualInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [billingSettings, setBillingSettings] = useState(DEFAULT_BILLING);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showPaymentLinkSender, setShowPaymentLinkSender] = useState(false);

  useEffect(() => {
    const loadBilling = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      try {
        const prefRef = doc(db, "businesses", uid, "preferences", "billing");
        const snap = await getDoc(prefRef);
        if (snap.exists()) {
          const d = snap.data();
          const bankIn = d.bank || {};
          const bank = {
            bankName: bankIn.bankName || bankIn.name || "",
            branch: bankIn.branch || "",
            accountNumber: bankIn.accountNumber || bankIn.account || "",
            ifsc: bankIn.ifsc || "",
            accountName: bankIn.accountName || "",
          };
          const merged = {
            ...DEFAULT_BILLING,
            ...d,
            branding: {
              ...DEFAULT_BILLING.branding,
              ...(d.branding || {}),
            },
            bank,
            payment: { ...DEFAULT_BILLING.payment, ...(d.payment || {}) },
            terms: d.terms || "",
          };
          setBillingSettings(merged);
        }
      } catch (e) {
        console.warn("Failed to load billing settings:", e);
      }
    };
    loadBilling();
  }, []);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }

    console.log('[DistributorViewManualInvoices] Setting up real-time listener for manual invoices');
    // Only fetch invoices that don't have orderId (manual invoices)
    const invoicesCol = collection(db, `businesses/${userId}/invoices`);

    const unsubscribe = onSnapshot(
      invoicesCol,
      async (snapshot) => {
        console.log('[DistributorViewManualInvoices] Snapshot received, size:', snapshot.size);
        const data = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const d = doc.data();
            
            // Filter: Only show invoices without orderId (manual invoices)
            if (d.orderId) {
              return null; // Skip order-based invoices
            }
            
            let customer = d.customer || d.buyer || {};
            
            // Try to fetch customer details if custId exists
            if (d.custId) {
              try {
                const custSnap = await getDoc(docRef(db, "businesses", userId, "customers", d.custId));
                if (custSnap.exists()) {
                  customer = { ...customer, ...custSnap.data() };
                }
              } catch (e) {
                console.warn("Customer lookup failed:", e);
              }
            }

            // Normalize date
            const createdAt = d.issuedAt 
              ? (d.issuedAt instanceof Date ? d.issuedAt : (d.issuedAt?.toDate?.() || new Date(d.issuedAt)))
              : (d.createdAt instanceof Date ? d.createdAt : (d.createdAt?.toDate?.() || new Date(d.createdAt || Date.now())));

            return {
              id: doc.id,
              ...d,
              customer: {
                name: customer.name || customer.businessName || d.buyer?.businessName || "Unnamed",
                businessName: customer.businessName || customer.name || d.buyer?.businessName || "Unnamed",
                phone: customer.phone || d.buyer?.phone || "",
                email: customer.email || d.buyer?.email || "",
                address: customer.address || d.buyer?.address || "",
                city: customer.city || d.buyer?.city || "",
                state: customer.state || d.buyer?.state || "",
              },
              createdAt,
              totalAmount: d.totalAmount || d.totals?.grandTotal || 0,
            };
          })
        );
        
        // Filter out nulls and sort by date descending (newest first)
        const filteredData = data
          .filter(inv => inv !== null && inv.createdAt)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log('[DistributorViewManualInvoices] Setting invoices, count:', filteredData.length);
        setInvoices(filteredData);
        setLoading(false);
      },
      (err) => {
        console.error("[DistributorViewManualInvoices] Error loading invoices:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const term = search.toLowerCase();
    const filtered = invoices.filter((inv) => {
      const matchesSearch =
        inv.customer?.name?.toLowerCase().includes(term) ||
        inv.customer?.businessName?.toLowerCase().includes(term) ||
        inv.invoiceNumber?.toLowerCase().includes(term) ||
        inv.invoiceId?.toLowerCase().includes(term) ||
        inv.invoiceType?.toLowerCase().includes(term);

      const createdDate = inv.createdAt ? new Date(inv.createdAt) : null;
      const matchesStartDate = startDate
        ? moment(createdDate).format("YYYY-MM-DD") >= startDate
        : true;
      const matchesEndDate = endDate
        ? moment(createdDate).format("YYYY-MM-DD") <= endDate
        : true;
      
      return matchesSearch && matchesStartDate && matchesEndDate;
    });
    setFiltered(filtered);
  }, [search, invoices, startDate, endDate]);

  if (loading) {
    return (
      <div className="px-4 py-6 md:px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 rounded-full border-4 border-white/30 border-t-emerald-300 animate-spin" />
            <p className="text-white/70">Loading invoices...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white">
      <h2 className="text-xl font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">Manual Invoices</h2>
      <p className="text-sm text-white/60 mb-4">Invoices created manually for direct sales (not from orders)</p>

      <div className="flex flex-col md:flex-row justify-between items-end mb-4 gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by customer, invoice number, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 w-full rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </div>
        <div className="flex gap-2">
          <div className="w-48">
            <label className="block text-sm mb-1 text-white/80">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-xl w-full bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            />
          </div>
          <div className="w-48">
            <label className="block text-sm mb-1 text-white/80">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-xl w-full bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-white/60">
          <p className="text-lg mb-2">No manual invoices found</p>
          <p className="text-sm">Create your first invoice to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((inv) => {
            const mode = deriveMode(inv);
            const isCredit = mode === "credit";
            const isPaid = deriveIsPaid(inv);
            const creditDueRaw = deriveCreditDue(inv);
            const dueDate = creditDueRaw ? moment(creditDueRaw) : null;
            const isOverdue = dueDate ? dueDate.isBefore(moment(), "day") : false;

            return (
              <div className="relative" key={inv.id}>
                <div className="px-4 py-4 flex flex-col md:flex-row justify-between items-start md:items-center text-sm space-y-2 md:space-y-0 bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.35)] hover:bg-white/15 transition">
                  <div className="flex-1 mb-2 md:mb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-base">{inv.customer?.name || inv.customer?.businessName || "Unnamed"}</p>
                      {inv.invoiceNumber && (
                        <span className="text-xs text-white/60">({inv.invoiceNumber})</span>
                      )}
                    </div>
                    <p className="text-white/70 text-sm">
                      {inv.customer?.address || "No Address"} | {inv.customer?.phone || "No Phone"}
                    </p>
                    <p className="text-white/60 text-xs mt-1">
                      Items: {inv.items?.length || inv.cartItems?.length || 0} | 
                      Date: {inv.createdAt ? moment(inv.createdAt).local().format("DD MMM YYYY, hh:mm A") : "N/A"}
                    </p>
                    {isCredit && !isPaid && dueDate && (
                      <p className={`text-xs mt-1 ${isOverdue ? "text-orange-400" : "text-red-400"}`}>
                        {isOverdue ? "⚠️ Overdue: " : "📅 Credit Due: "}
                        {dueDate.format("DD MMM YYYY")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end justify-center gap-2 relative min-h-[50px]">
                    {isCredit && !isPaid && dueDate && (
                      <span
                        className={`absolute top-1/2 right-[72px] transform -translate-y-1/2 text-white text-[10px] px-3 py-[2px] rounded-full shadow whitespace-nowrap ${
                          isOverdue ? "bg-orange-600" : "bg-red-600"
                        }`}>
                        {isOverdue ? "Overdue" : "Credit Due"}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        isPaid ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                      }`}>
                        {isPaid ? "Paid" : "Pending"}
                      </span>
                      <p className="font-semibold text-lg">₹{Number(inv.totalAmount || 0).toFixed(2)}</p>
                    </div>
                    <button
                      className="mt-1 px-3 py-1 rounded-lg text-xs font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_6px_20px_rgba(16,185,129,0.35)] transition"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedInvoice && createPortal(
        <div className="fixed inset-0 w-screen h-screen bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="rounded-lg shadow-lg p-4 md:p-6 max-w-4xl xl:max-w-5xl 2xl:max-w-6xl w-full max-h-screen overflow-y-auto space-y-4 text-white bg-white/10 backdrop-blur-2xl border border-white/10 mx-4">
            <div className="invoice-preview-container">
              <InvoicePreview
                customer={selectedInvoice.customer}
                cartItems={(selectedInvoice.cartItems || selectedInvoice.items || []).map(item => ({
                  ...item,
                  unit: item.unit || "-",
                  name: item.name || item.productName || "Unknown",
                  quantity: item.quantity || item.qty || 0,
                  price: item.price || item.sellingPrice || item.unitPrice || 0,
                }))}
                settings={{
                  ...selectedInvoice.settings,
                  creditDueDate: deriveCreditDue(selectedInvoice),
                  splitCash: selectedInvoice.splitPayment?.cash || selectedInvoice.settings?.splitCash || 0,
                  splitUPI: selectedInvoice.splitPayment?.upi || selectedInvoice.settings?.splitUPI || 0,
                  splitCard: selectedInvoice.splitPayment?.card || selectedInvoice.settings?.splitCard || 0,
                  isPaid: selectedInvoice.isPaid,
                  paidOn: selectedInvoice.paidOn,
                  paidVia: selectedInvoice.paidVia,
                  deliveryFee: selectedInvoice.chargesSnapshot?.delivery || selectedInvoice.totals?.delivery || 0,
                  packagingFee: selectedInvoice.chargesSnapshot?.packing || selectedInvoice.totals?.packing || 0,
                  insuranceType: selectedInvoice.chargesSnapshot?.insuranceType || "none",
                  insuranceValue: selectedInvoice.chargesSnapshot?.insuranceValue || 0,
                }}
                deliveryExtras={{
                  driverName: selectedInvoice.settings?.driver?.name || "",
                  driverPhone: selectedInvoice.settings?.driver?.phone || "",
                  vehicleId: selectedInvoice.settings?.driver?.vehicle || "",
                  trackingRef: selectedInvoice.settings?.driver?.tracking || "",
                }}
                invoiceType={selectedInvoice.invoiceType}
                paymentMode={deriveMode(selectedInvoice)}
                issuedAt={selectedInvoice.createdAt || selectedInvoice.issuedAt}
                userInfo={{
                  businessName: selectedInvoice.seller?.businessName || "N/A",
                  ownerName: selectedInvoice.seller?.ownerName || "N/A",
                  address: selectedInvoice.seller?.address || "N/A",
                  city: selectedInvoice.seller?.city || "N/A",
                  state: selectedInvoice.seller?.state || "N/A",
                  phone: selectedInvoice.seller?.phone || "N/A",
                  email: selectedInvoice.seller?.email || "N/A",
                  gstNumber: selectedInvoice.seller?.gstNumber || selectedInvoice.seller?.gstin || "N/A",
                  pan: selectedInvoice.seller?.pan || "N/A"
                }}
                onCancel={() => setSelectedInvoice(null)}
                viewOnly={true}
                previewMode
                branding={billingSettings.branding}
                bank={billingSettings.bank}
                payment={billingSettings.payment}
                terms={billingSettings.terms}
              />
            </div>
            {/* Action Buttons */}
            <div className="mt-4 p-4 rounded text-sm bg-white/5 backdrop-blur-xl border border-white/10">
              <p className="mb-2">
                Invoice from <strong>{selectedInvoice.seller?.businessName || "Distributor"}</strong>
                {selectedInvoice.seller?.address && (
                  <> located at <strong>{selectedInvoice.seller.address}</strong></>
                )}.<br />
                Total: <strong>₹{Number(selectedInvoice.totalAmount || 0).toFixed(2)}</strong><br />
                Issued on:{" "}
                <strong>
                  {selectedInvoice.createdAt 
                    ? moment(selectedInvoice.createdAt).format("DD MMM YYYY, hh:mm A") 
                    : (selectedInvoice.issuedAt 
                        ? moment(selectedInvoice.issuedAt).format("DD MMM YYYY, hh:mm A")
                        : "N/A")}
                </strong>
              </p>
              {(() => {
                const mode = deriveMode(selectedInvoice);
                const isCredit = mode === "credit";
                const isPaid = deriveIsPaid(selectedInvoice);
                if (!(isCredit && !isPaid)) return null;
                return (
                  <button
                    className="px-4 py-2 rounded-lg mb-4 font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
                    onClick={() => setShowMarkPaidModal(true)}
                  >
                    Mark as Paid
                  </button>
                );
              })()}
              <div className="flex flex-wrap gap-3">
                <button
                  className="px-4 py-2 rounded-lg font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={async () => {
                    if (!selectedInvoice) return;
                    try {
                      setDownloadingPdf(true);
                      const doc = (
                        <DistributorManualInvoicePdf invoice={selectedInvoice} />
                      );
                      const blob = await pdf(doc).toBlob();
                      const invoiceNumber = selectedInvoice.invoiceNumber || selectedInvoice.invoiceId || selectedInvoice.id;
                      const issued = formatDate(selectedInvoice.issuedAt || selectedInvoice.createdAt).replace(/\s+/g, "-");
                      const filename = `${invoiceNumber}-${issued}.pdf`;
                      saveAs(blob, filename);
                    } catch (err) {
                      console.error("[DistributorViewManualInvoices] Failed to generate PDF", err);
                      toast.error("Failed to generate PDF. Please try again.");
                    } finally {
                      setDownloadingPdf(false);
                    }
                  }}
                  disabled={downloadingPdf}
                >
                  {downloadingPdf ? "Generating PDF..." : "Download PDF (A4)"}
                </button>
                <a
                  href={buildWhatsAppLink(selectedInvoice)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg inline-block font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
                  title={selectedInvoice.customer?.phone ? `Send to ${selectedInvoice.customer.phone}` : "Open WhatsApp to share invoice link"}
                >
                  Send Invoice Link
                </a>
                {/* Payment Link Sender Button - Show for UPI, Card, or Credit invoices */}
                {(() => {
                  const mode = deriveMode(selectedInvoice);
                  const isPaid = deriveIsPaid(selectedInvoice);
                  const showPaymentLink = (mode === "upi" || mode === "card" || (mode === "credit" && !isPaid));
                  
                  if (!showPaymentLink) return null;
                  
                  return (
                    <button
                      className="px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 hover:shadow-[0_8px_24px_rgba(99,102,241,0.35)]"
                      onClick={() => setShowPaymentLinkSender(true)}
                      title="Send payment link to customer"
                    >
                      💳 Send Payment Link
                    </button>
                  );
                })()}
              </div>
              <p className="mt-2 text-xs text-white/70 italic">Powered by FLYP — smart business invoicing</p>
            </div>
          </div>
        </div>,
        document.body
      )}
      {showMarkPaidModal && (
        <MarkPaidModal
          isOpen={true}
          onClose={() => setShowMarkPaidModal(false)}
          invoice={selectedInvoice}
          onConfirm={async (paymentMethod) => {
            const userId = auth.currentUser?.uid;
            if (!userId || !selectedInvoice) return;
            
            const docPath = `businesses/${userId}/invoices/${selectedInvoice.id}`;
            const invoiceRef = doc(db, docPath);
            const paidAt = new Date();
            
            try {
              await updateDoc(invoiceRef, {
                isPaid: true,
                paidOn: paidAt,
                paidVia: paymentMethod,
                "payment.isPaid": true,
                "payment.status": "Paid",
                "payment.paidOn": paidAt,
                "payment.paidVia": paymentMethod,
              });
              
              const updatedInvoices = invoices.map((inv) =>
                inv.id === selectedInvoice.id
                  ? { 
                      ...inv, 
                      isPaid: true, 
                      paidOn: paidAt, 
                      paidVia: paymentMethod,
                      payment: {
                        ...inv.payment,
                        isPaid: true,
                        status: "Paid",
                        paidOn: paidAt,
                        paidVia: paymentMethod,
                      }
                    }
                  : inv
              );
              setInvoices(updatedInvoices);
              setFiltered(updatedInvoices);
              toast.success("Invoice marked as paid successfully!");
              setShowMarkPaidModal(false);
              setSelectedInvoice(null);
            } catch (error) {
              console.error("Error marking invoice as paid:", error);
              toast.error("Failed to mark invoice as paid. Please try again.");
            }
          }}
        />
      )}
      
      {showPaymentLinkSender && selectedInvoice && (
        <PaymentLinkSender
          isOpen={showPaymentLinkSender}
          onClose={() => setShowPaymentLinkSender(false)}
          invoice={selectedInvoice}
          customer={selectedInvoice.customer || selectedInvoice.buyer}
        />
      )}
    </div>
  );
};

export default DistributorViewManualInvoices;

