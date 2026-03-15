import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import InvoiceCard from "../components/InvoiceCard";
import InvoicePreview from "../components/InvoicePreview";

const AllInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);

  // Fix auth race: wait for auth state before fetching
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) { setLoading(false); return; }
      try {
        const invoicesRef = collection(getFirestore(), `businesses/${user.uid}/finalizedInvoices`);
        const snapshot = await getDocs(invoicesRef);
        const fetched = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setInvoices(fetched);
        setFilteredInvoices(fetched);
      } catch (e) {
        console.error("Failed to load invoices:", e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const lowerSearch = searchTerm.toLowerCase().trim();

    const filtered = invoices.filter(inv => {
      // Support both billing POS (customerInfo) and restaurant POS (customer) formats
      const custName  = (inv.customerInfo?.name  || inv.customer?.name  || "").toLowerCase();
      const custEmail = (inv.customerInfo?.email || inv.customer?.email || "").toLowerCase();
      const custPhone = (inv.customerInfo?.phone || inv.customer?.phone || "").toLowerCase();
      const tableInfo = (inv.meta?.tableName || "").toLowerCase();

      const matchSearch = lowerSearch === ""
        || custName.includes(lowerSearch)
        || custEmail.includes(lowerSearch)
        || custPhone.includes(lowerSearch)
        || tableInfo.includes(lowerSearch);

      const invoiceDate = new Date(inv.createdAt);
      const fromDate = dateRange.from ? new Date(dateRange.from) : null;
      const toDate   = dateRange.to   ? new Date(new Date(dateRange.to).setHours(23,59,59,999)) : null;

      const matchDate =
        (!fromDate || invoiceDate >= fromDate) &&
        (!toDate   || invoiceDate <= toDate);

      return matchSearch && matchDate;
    });

    setFilteredInvoices(filtered);
  }, [searchTerm, dateRange, invoices]);

  const handleViewInvoice = (invoice) => setSelectedInvoice(invoice);
  const closePreview = () => setSelectedInvoice(null);

  return (
    <div className="px-4 py-6 md:px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] space-y-6">
      <h2 className="text-lg md:text-xl font-semibold mb-4">All Invoices</h2>

      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="text"
          placeholder="Search by customer name/email"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border border-gray-300 p-2 rounded w-full sm:max-w-xs text-sm"
        />
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
          className="border border-gray-300 p-2 rounded w-full sm:max-w-xs text-sm"
        />
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
          className="border border-gray-300 p-2 rounded w-full sm:max-w-xs text-sm"
        />
      </div>

      {loading ? (
        <p className="text-white/50">Loading invoices...</p>
      ) : filteredInvoices.length === 0 ? (
        <p>No invoices found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInvoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} onView={() => handleViewInvoice(invoice)} />
          ))}
        </div>
      )}

      {selectedInvoice && (
        <InvoicePreview invoice={selectedInvoice} onClose={closePreview} />
      )}
    </div>
  );
};

export default AllInvoices;