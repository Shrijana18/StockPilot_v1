import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import InvoicePreview from "./InvoicePreview";
import { collection, getDocs, doc as docRef, getDoc, updateDoc, doc } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";
import moment from "moment";
import html2pdf from "html2pdf.js";
import MarkPaidModal from "./MarkPaidModal";

// --- normalized readers so Manual + Fast (voice) render identically ---
const deriveMode = (inv = {}) => (
  inv.paymentModeLower ||
  inv.paymentMode ||
  inv.paymentSummary?.mode ||
  inv.invoiceConfig?.paymentMode ||
  ""
).toString().toLowerCase();

const deriveCreditDue = (inv = {}) => (
  inv.creditDueDate ||
  inv.paymentSummary?.creditDueDate ||
  inv.settings?.creditDueDate ||
  inv.invoiceConfig?.creditDueDate ||
  inv.chargesSnapshot?.creditDueDate ||
  null
);

const deriveIsPaid = (inv = {}, modeLower = "") => (
  typeof inv.isPaid === "boolean"
    ? inv.isPaid
    : (inv.paymentSummary?.status
        ? inv.paymentSummary.status !== "pending"
        : (modeLower === "credit" ? false : true))
);

const ViewInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);

  useEffect(() => {
    const fetchInvoices = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      try {
        const ref = collection(db, `businesses/${userId}/finalizedInvoices`);
        const snap = await getDocs(ref);
        const data = await Promise.all(
          snap.docs.map(async (doc) => {
            const d = doc.data();
            let customer = d.customer || {};
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
            return {
              id: doc.id,
              ...d,
              customer,
              createdAt:
                d.createdAt instanceof Date
                  ? d.createdAt
                  : d.createdAt?.toDate?.() ||
                    (typeof d.createdAt === "string" ? new Date(d.createdAt) : null),
              total: d.totalAmount ?? d.total ?? 0,
            };
          })
        );
        const filteredData = data
          .filter(inv => inv.createdAt)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setInvoices(filteredData);
        setFiltered(filteredData);
      } catch (err) {
        console.error("Error loading invoices:", err);
      }
    };
    fetchInvoices();
  }, []);

  useEffect(() => {
    const term = search.toLowerCase();
    const filtered = invoices.filter((inv) => {
      const matchesSearch =
        inv.customer?.name?.toLowerCase().includes(term) ||
        inv.invoiceType?.toLowerCase().includes(term);

      const createdDate = inv.createdAt ? new Date(inv.createdAt) : null;
      const matchesDate = startDate
        ? moment(createdDate).format("YYYY-MM-DD") === startDate
        : true;
      return matchesSearch && matchesDate;
    });
    setFiltered(filtered);
  }, [search, invoices, startDate, endDate]);

  return (
    <div className="px-4 py-6 md:px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white">
      <h2 className="text-xl font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200">All Invoices</h2>

      <div className="flex flex-col md:flex-row justify-between items-end mb-4 gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by customer or invoice type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 w-full rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </div>
        <div className="w-64">
          <label className="block text-sm mb-1 text-white/80">Invoice Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 rounded-xl w-full bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((inv) => (
          <div className="relative" key={inv.id}>
            <div className="px-4 py-4 flex flex-col md:flex-row justify-between items-start md:items-center text-sm space-y-2 md:space-y-0 bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
              <div className="flex-1 mb-2 md:mb-0">
                <p className="font-semibold">{inv.customer?.name || "Unnamed"}</p>
                <p className="text-white/70">
                  {inv.customer?.address || "No Address"} | {inv.customer?.phone || "No Phone"}
                </p>
                <p className="text-white/60">
                  Items: {inv.cartItems?.length || 0} | Date: {inv.createdAt ? moment(inv.createdAt).local().format("DD MMM YYYY, hh:mm A") : "N/A"}
                </p>
              </div>
              <div className="flex flex-col items-end justify-center gap-2 relative min-h-[50px]">
                {(() => {
                  const mode = deriveMode(inv);
                  const isCredit = (inv.paymentFlags?.isCredit === true) || mode === "credit";
                  const isPaid = deriveIsPaid(inv, mode);
                  if (!(isCredit && !isPaid)) return null;
                  const creditDueRaw = deriveCreditDue(inv);
                  const dueDate = creditDueRaw ? moment(creditDueRaw) : null;
                  const isOverdue = dueDate ? dueDate.isBefore(moment(), "day") : false;
                  return (
                    <span
                      className={`absolute top-1/2 right-[72px] transform -translate-y-1/2 text-white text-[10px] px-3 py-[2px] rounded-full shadow whitespace-nowrap ${
                        isOverdue ? "bg-orange-600" : "bg-red-600"
                      }`}>
                      {isOverdue ? "Overdue: " : "Credit Due: "}
                      {dueDate ? dueDate.format("DD MMM") : "N/A"}
                    </span>
                  );
                })()}
                <p className="font-semibold text-lg">₹{Number(inv.totalAmount || inv.total || 0).toFixed(2)}</p>
                <button
                  className="mt-1 px-3 py-1 rounded-lg text-xs font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_6px_20px_rgba(16,185,129,0.35)]"
                  onClick={() => setSelectedInvoice(inv)}
                >
                  View
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Modal-style Invoice Preview */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="rounded-lg shadow-lg p-4 md:p-6 max-w-4xl w-full max-h-screen overflow-y-auto space-y-4 text-white bg-white/10 backdrop-blur-2xl border border-white/10">
            <div className="invoice-preview-container">
              <InvoicePreview
                customer={selectedInvoice.customer}
                cartItems={(selectedInvoice.cartItems || []).map(item => ({
                  ...item,
                  unit: item.unit || "-"
                }))}
                settings={{
                  ...selectedInvoice.settings,
                  creditDueDate: deriveCreditDue(selectedInvoice),
                  splitCash:
                    selectedInvoice.settings?.splitCash ??
                    selectedInvoice.paymentSummary?.splitPayment?.cash ??
                    selectedInvoice.splitPayment?.cash ??
                    0,
                  splitUPI:
                    selectedInvoice.settings?.splitUPI ??
                    selectedInvoice.paymentSummary?.splitPayment?.upi ??
                    selectedInvoice.splitPayment?.upi ??
                    0,
                  splitCard:
                    selectedInvoice.settings?.splitCard ??
                    selectedInvoice.paymentSummary?.splitPayment?.card ??
                    selectedInvoice.splitPayment?.card ??
                    0,
                  isPaid: selectedInvoice.isPaid,
                  paidOn: selectedInvoice.paidOn,
                  paidVia: selectedInvoice.paidVia,
                }}
                invoiceType={selectedInvoice.invoiceType}
                paymentMode={deriveMode(selectedInvoice)}
                issuedAt={selectedInvoice.createdAt}
                userInfo={{
                  businessName: selectedInvoice.userInfo?.businessName,
                  gstNumber: selectedInvoice.userInfo?.gstNumber || selectedInvoice.gstNumber || "N/A"
                }}
                onCancel={() => setSelectedInvoice(null)}
                viewOnly={true}
              />
            </div>
          {/* Action Buttons */}
          <div className="mt-4 p-4 rounded text-sm bg-white/5 backdrop-blur-xl border border-white/10">
            <p className="mb-2">
              Here is your receipt from <strong>{selectedInvoice.userInfo?.businessName}</strong>, located at{" "}
              <strong>{selectedInvoice.userInfo?.address || "N/A"}</strong>.<br />
              Total: <strong>₹{Number(selectedInvoice.totalAmount || 0).toFixed(2)}</strong><br />
              Issued on:{" "}
              <strong>
                {selectedInvoice.createdAt ? moment(selectedInvoice.createdAt).format("DD MMM YYYY, hh:mm A") : "N/A"}
              </strong>
            </p>
            {(() => {
              const mode = deriveMode(selectedInvoice);
              const isCredit = (selectedInvoice.paymentFlags?.isCredit === true) || mode === "credit";
              const isPaid = deriveIsPaid(selectedInvoice, mode);
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
            <div className="flex gap-3">
              <a
                href={`https://wa.me/91${selectedInvoice.customer?.phone}?text=Here%20is%20your%20invoice%20from%20${encodeURIComponent(selectedInvoice.userInfo?.businessName || "FLYP")}%20-%20Total%3A%20₹${Number(selectedInvoice.totalAmount || 0).toFixed(2)}%20on%20${encodeURIComponent(moment(selectedInvoice.createdAt).format("DD MMM YYYY, hh:mm A"))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg inline-block font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
              >
                Send via WhatsApp
              </a>
              <button
                className="px-4 py-2 rounded-lg font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
                onClick={() => {
                  const element = document.querySelector(".invoice-preview-container"); // wrap your InvoicePreview in this class
                  if (!element) return alert("Invoice content not found.");

                  const opt = {
                    margin:       0.5,
                    filename:     `Invoice-${selectedInvoice.id}.pdf`,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2 },
                    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
                  };

                  html2pdf().set(opt).from(element).save(); // or email logic later
                }}
              >
                Send via Email
              </button>
            </div>
            <p className="mt-2 text-xs text-white/70 italic">
              Powered by FLYP — smart business invoicing
            </p>
          </div>
          </div>
        </div>
      )}
      {showMarkPaidModal && (
        <MarkPaidModal
          isOpen={true}
          onClose={() => setShowMarkPaidModal(false)}
          invoice={selectedInvoice}
          onConfirm={async (paymentMethod) => {
            const userId = auth.currentUser?.uid;
            const docPath = `businesses/${userId}/finalizedInvoices/${selectedInvoice.id}`;
            const invoiceRef = doc(db, docPath);
            const paidAt = new Date();
            await updateDoc(invoiceRef, {
              isPaid: true,
              paidOn: paidAt,
              paidVia: paymentMethod,
            });
            const updatedInvoices = invoices.map((inv) =>
              inv.id === selectedInvoice.id
                ? { ...inv, isPaid: true, paidOn: paidAt, paidVia: paymentMethod }
                : inv
            );
            setInvoices(updatedInvoices);
            setFiltered(updatedInvoices);
            toast.success("Invoice marked as paid successfully!");
            setShowMarkPaidModal(false);
            setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
};

export default ViewInvoices;