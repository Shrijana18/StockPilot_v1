import React, { useEffect, useState } from 'react';
import { db, auth } from '../../firebase/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import KpiCards from './KpiCards';
import RecentInvoices from './RecentInvoices';
import LowStockAlertWidget from './LowStockAlertWidget';

const HomeSnapshot = ({ filterDates }) => {
  const [invoiceData, setInvoiceData] = useState([]);
  const [userId, setUserId] = useState(null);
  const [filterType, setFilterType] = useState('All'); // 'All', 'Today', 'ThisMonth', 'ThisYear'
  const [filteredInvoices, setFilteredInvoices] = useState([]);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        setUserId(user.uid);
        const q = collection(db, 'businesses', user.uid, 'finalizedInvoices');
        const querySnapshot = await getDocs(q);
        const data = [];
        querySnapshot.forEach((doc) => {
          data.push({ ...doc.data(), id: doc.id });
        });
        setInvoiceData(data);
        setFilteredInvoices(applyDateFilter(data, filterType, filterDates));
      } catch (err) {
        console.error('Error fetching invoices:', err);
      }
    };

    fetchInvoices();
  }, []);

  const applyDateFilter = (data, type, dateRange = {}) => {
    const now = new Date();
    const { start, end } = dateRange;

    return data.filter(inv => {
      const date = inv.createdAt ? new Date(inv.createdAt) : null;
      if (!date) return false;

      if (start && end) {
        return date >= start && date <= end;
      }

      if (type === 'Today') {
        return date.toDateString() === now.toDateString();
      } else if (type === 'ThisWeek') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return date >= startOfWeek && date <= endOfWeek;
      } else if (type === 'ThisMonth') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      } else if (type === 'ThisYear') {
        return date.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  useEffect(() => {
    setFilteredInvoices(applyDateFilter(invoiceData, filterType, filterDates));
  }, [filterType, filterDates, invoiceData]);

  // Compute totalRevenue and paymentStats for passing to KpiCards
  const totalRevenue = filteredInvoices.reduce((acc, inv) => acc + (parseFloat(inv.totalAmount || 0)), 0);
  const paymentStats = filteredInvoices.reduce((acc, inv) => {
    const mode = inv.paymentMode || 'Unknown';
    acc[mode] = (acc[mode] || 0) + parseFloat(inv.totalAmount || 0);
    return acc;
  }, {});

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-end mb-2">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border px-3 py-1 rounded-md shadow text-sm"
          aria-label="Select date filter"
        >
          <option value="All">All Time</option>
          <option value="Today">Today</option>
          <option value="ThisWeek">This Week</option>
          <option value="ThisMonth">This Month</option>
          <option value="Custom">Custom</option>
        </select>
      </div>
      <div className="text-xs text-gray-500 mb-1">
        {filterType === 'All' && !filterDates?.start ? 'Showing all time data' : `Filtered by: ${filterType}`}
        {filterDates?.start && filterDates?.end && (
          <span> | Custom Range: {filterDates.start.toLocaleDateString()} - {filterDates.end.toLocaleDateString()}</span>
        )}
      </div>
      <h2 className="text-lg font-semibold">📊 Home Snapshot: Today’s KPIs</h2>
      <KpiCards
        invoiceData={filteredInvoices}
        totalRevenue={totalRevenue}
        paymentStats={paymentStats}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LowStockAlertWidget userId={userId} />
        <RecentInvoices invoiceData={[...filteredInvoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))} />
      </div>

      {/* Daily Snapshot Visualization Placeholder - To be implemented */}
    </div>
  );
};

export default HomeSnapshot;