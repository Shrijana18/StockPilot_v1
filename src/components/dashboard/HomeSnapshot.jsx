import React, { useEffect, useState } from 'react';
import { db, auth } from '../../firebase/firebaseConfig';
import { collection, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import KpiCards from './KpiCards';
import RecentInvoices from './RecentInvoices';
import LowStockAlertWidget from './LowStockAlertWidget';

const HomeSnapshot = ({ filterDates, filterType: selectedFilterType }) => {
  const [invoiceData, setInvoiceData] = useState([]);
  const [userId, setUserId] = useState(null);
  const [filterType, setFilterType] = useState(selectedFilterType || 'All');
  const [filteredInvoices, setFilteredInvoices] = useState([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        const q = collection(db, 'businesses', user.uid, 'finalizedInvoices');

        const unsubscribeSnapshot = onSnapshot(
          q,
          (querySnapshot) => {
            const data = [];
            querySnapshot.forEach((doc) => {
              data.push({ ...doc.data(), id: doc.id });
            });
            setInvoiceData(data);
            setFilteredInvoices(applyDateFilter(data, selectedFilterType || 'All', filterDates));
          },
          (error) => {
            console.error('Error in snapshot listener:', error);
          }
        );

        return () => unsubscribeSnapshot();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const applyDateFilter = (data, type, dateRange = {}) => {
    const now = new Date();
    const { start, end } = dateRange;

    return data.filter(inv => {
      const date = inv.issuedAt
        ? typeof inv.issuedAt.toDate === 'function'
          ? inv.issuedAt.toDate()
          : new Date(inv.issuedAt)
        : null;

      if (!date) return false;

      if (start && end) {
        return date >= start && date <= end;
      }

      if (type === 'Today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        return date >= startOfDay && date <= endOfDay;
      } else if (type === 'ThisWeek') {
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return date >= startOfWeek && date <= endOfWeek;
      } else if (type === 'ThisMonth') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return date >= startOfMonth && date <= endOfMonth;
      } else if (type === 'ThisYear') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return date >= startOfYear && date <= endOfYear;
      }

      return true;
    });
  };

  useEffect(() => {
    setFilteredInvoices(applyDateFilter(invoiceData, filterType, filterDates));
  }, [filterType, filterDates, invoiceData]);

  useEffect(() => {
    setFilterType(selectedFilterType || 'All');
  }, [selectedFilterType]);

  const totalRevenue = filteredInvoices.reduce((acc, inv) => acc + parseFloat(inv.totalAmount || inv.total || 0), 0);
  const paymentStats = filteredInvoices.reduce((acc, inv) => {
    const mode = inv.paymentMode || 'Unknown';
    acc[mode] = (acc[mode] || 0) + parseFloat(inv.totalAmount || inv.total || 0);
    return acc;
  }, {});

  console.log('Filtered invoices:', filteredInvoices);

  return (
    <div className="p-4 space-y-6">
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
    </div>
  );
};

export default HomeSnapshot;