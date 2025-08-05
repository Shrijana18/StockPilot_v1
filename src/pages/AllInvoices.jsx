import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import InvoiceCard from "../components/InvoiceCard";
import InvoicePreview from "../components/InvoicePreview";

const AllInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  useEffect(() => {
    const fetchInvoices = async () => {
      const currentUser = getAuth().currentUser;
      if (!currentUser) return;
      const invoicesRef = collection(getFirestore(), `businesses/${currentUser.uid}/finalizedInvoices`);
      const snapshot = await getDocs(invoicesRef);
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvoices(fetched);
      setFilteredInvoices(fetched);
    };

    fetchInvoices();
  }, []);

  useEffect(() => {
    const lowerSearch = searchTerm.toLowerCase();

    const filtered = invoices.filter(inv => {
      const matchName = inv.customerInfo?.name?.toLowerCase().includes(lowerSearch);
      const matchEmail = inv.customerInfo?.email?.toLowerCase().includes(lowerSearch);

      const invoiceDate = new Date(inv.createdAt);
      const fromDate = dateRange.from ? new Date(dateRange.from) : null;
      const toDate = dateRange.to ? new Date(dateRange.to) : null;

      const matchDate =
        (!fromDate || invoiceDate >= fromDate) &&
        (!toDate || invoiceDate <= toDate);

      return (matchName || matchEmail) && matchDate;
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

      {filteredInvoices.length === 0 ? (
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