import React, { useEffect, useState } from "react";
import InvoicePreview from "./InvoicePreview";
import { collection, getDocs, doc as docRef, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";
import moment from "moment";

const ViewInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);

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
    const filtered = invoices.filter((inv) =>
      inv.customer?.name?.toLowerCase().includes(term) ||
      inv.invoiceType?.toLowerCase().includes(term)
    );
    setFiltered(filtered);
  }, [search, invoices]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">All Invoices</h2>

      <input
        type="text"
        placeholder="Search by customer or invoice type..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border px-4 py-2 mb-4 w-full md:w-1/2 rounded"
      />

      <div className="space-y-4">
        {filtered.map((inv) => (
          <div key={inv.id} className="border bg-white shadow rounded px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center text-sm">
            <div className="flex-1 mb-2 md:mb-0">
              <p className="font-semibold">{inv.customer?.name || "Unnamed"}</p>
              <p className="text-gray-600">
                {inv.customer?.address || "No Address"} | {inv.customer?.phone || "No Phone"}
              </p>
              <p className="text-gray-500">
                Items: {inv.cartItems?.length || 0} | Date: {inv.createdAt ? moment(inv.createdAt).local().format("DD MMM YYYY, hh:mm A") : "N/A"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-lg">₹{Number(inv.totalAmount || inv.total || 0).toFixed(2)}</p>
              <button
                className="mt-1 px-3 py-1 bg-blue-600 text-white rounded text-xs"
                onClick={() => setSelectedInvoice(inv)}
              >
                View
              </button>
            </div>
          </div>
        ))}
      </div>
      {/* Modal-style Invoice Preview */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-4xl w-full max-h-screen overflow-y-auto">
            <InvoicePreview
              customer={selectedInvoice.customer}
              cartItems={selectedInvoice.cartItems?.map(item => ({
                ...item,
                unit: item.unit || "-"
              }))}
              settings={selectedInvoice.settings}
              invoiceType={selectedInvoice.invoiceType}
              paymentMode={selectedInvoice.paymentMode}
              issuedAt={selectedInvoice.createdAt}
              userInfo={{ businessName: selectedInvoice.userInfo?.businessName }}
              onCancel={() => setSelectedInvoice(null)}
              viewOnly={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewInvoices;