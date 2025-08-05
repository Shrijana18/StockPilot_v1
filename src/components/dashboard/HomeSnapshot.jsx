import React, { useEffect, useState } from 'react';
import { db, auth } from '../../firebase/firebaseConfig';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import KpiCards from './KpiCards';
import RecentInvoices from './RecentInvoices';
import LowStockAlertWidget from './LowStockAlertWidget';
import CreditDueList from './CreditDueList';

const HomeSnapshot = ({ filterDates, filterType: selectedFilterType }) => {
  const [invoiceData, setInvoiceData] = useState([]);
  const [userId, setUserId] = useState(null);
  const [filterType, setFilterType] = useState(selectedFilterType || 'All');
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [businessInfo, setBusinessInfo] = useState({ name: '', address: '' });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        const fetchBusinessInfo = async () => {
          try {
            const docRef = doc(db, 'businesses', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              setBusinessInfo({
                name: data.businessName || 'Your Business',
                address: data.businessAddress || ''
              });
            }
          } catch (err) {
            console.error('Error fetching business info:', err);
          }
        };
        fetchBusinessInfo();

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

  // KPI calculations: Only count credit invoices if isPaid === true, and use paidVia for paymentStats
  const totalRevenue = filteredInvoices.reduce((acc, inv) => {
    const total = parseFloat(inv.totalAmount || inv.total || 0);

    if (!inv.isPaid) return acc;

    return acc + total;
  }, 0);

  const paymentStats = filteredInvoices.reduce((acc, inv) => {
    if (!inv.isPaid) return acc;

    const total = parseFloat(inv.totalAmount || inv.total || 0);
    const mode = (inv.paymentMode || '').toLowerCase();

    if (mode === 'split') {
      const split = inv.splitPayment || {};
      const cash = parseFloat(split.cash || 0);
      const card = parseFloat(split.card || 0);
      const upi = parseFloat(split.upi || 0);

      acc['Cash'] = (acc['Cash'] || 0) + cash;
      acc['Card'] = (acc['Card'] || 0) + card;
      acc['UPI'] = (acc['UPI'] || 0) + upi;
    } else if (mode === 'credit') {
      const paidVia = (inv.paidVia || '').toLowerCase();
      if (paidVia === 'cash') acc['Cash'] = (acc['Cash'] || 0) + total;
      else if (paidVia === 'card') acc['Card'] = (acc['Card'] || 0) + total;
      else if (paidVia === 'upi') acc['UPI'] = (acc['UPI'] || 0) + total;
      else acc['Other'] = (acc['Other'] || 0) + total;
    } else {
      const label = mode === 'cash' ? 'Cash' : mode === 'card' ? 'Card' : mode === 'upi' ? 'UPI' : 'Other';
      acc[label] = (acc[label] || 0) + total;
    }

    return acc;
  }, {});

  const creditInvoices = filteredInvoices.filter(
    inv =>
      inv.paymentMode?.toLowerCase() === 'credit' &&
      inv.isPaid === false &&
      (inv.settings?.creditDueDate || inv.creditDueDate)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const dueTodayInvoices = creditInvoices.filter(inv => {
    const dueDateStr = inv.settings?.creditDueDate || inv.creditDueDate;
    const dueDate = new Date(`${dueDateStr}T00:00:00`);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() === today.getTime();
  });
  const dueTodayAmount = dueTodayInvoices.reduce((sum, inv) => {
    const amt = parseFloat(inv.totalAmount || inv.settings?.totalAmount || 0);
    return sum + amt;
  }, 0);

  const dueTomorrowInvoices = creditInvoices.filter(inv => {
    const dueDateStr = inv.settings?.creditDueDate || inv.creditDueDate;
    const dueDate = new Date(`${dueDateStr}T00:00:00`);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() === tomorrow.getTime();
  });
  const dueTomorrowAmount = dueTomorrowInvoices.reduce((sum, inv) => {
    const amt = parseFloat(inv.totalAmount || inv.settings?.totalAmount || 0);
    return sum + amt;
  }, 0);

  console.log('Filtered invoices:', filteredInvoices);

  // Compute total due across all unpaid credit invoices
  const totalDueAmount = creditInvoices.reduce((sum, inv) => {
    const amt = parseFloat(inv.totalAmount || inv.settings?.totalAmount || 0);
    return sum + amt;
  }, 0);

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
        dueToday={dueTodayAmount}
        dueTomorrow={dueTomorrowAmount}
        totalDue={totalDueAmount}
        totalDueCount={creditInvoices?.filter(i => i.isPaid === false).length || 0}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <LowStockAlertWidget userId={userId} />
        <RecentInvoices invoiceData={[...filteredInvoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))} />
        <CreditDueList
          creditInvoices={creditInvoices}
          dueToday={dueTodayInvoices}
          dueTomorrow={dueTomorrowInvoices}
          totalDue={totalDueAmount}
          businessName={businessInfo.name}
          businessAddress={businessInfo.address}
        />
      </div>
    </div>
  );
};

export default HomeSnapshot;