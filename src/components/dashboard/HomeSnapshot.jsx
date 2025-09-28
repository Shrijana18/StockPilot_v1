import React, { useEffect, useState, useRef } from 'react';
import { db, auth } from '../../firebase/firebaseConfig';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import KpiCards from './KpiCards';
import RecentInvoices from './RecentInvoices';
import LowStockAlertWidget from './LowStockAlertWidget';
import CreditDueList from './CreditDueList';
// Import motion from Framer Motion
import { motion } from 'framer-motion';

// --- ANIMATION VARIANTS ---

// This variant controls the container. It will be invisible at first
// and then orchestrate the animation of its children.
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      // The `staggerChildren` property creates the cinematic sequence effect.
      // Each child will animate in 0.1 seconds after the previous one.
      staggerChildren: 0.1,
    },
  },
};

// This variant controls each individual item.
// They will start slightly lower and invisible, then spring up into place.
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
    },
  },
};


const HomeSnapshot = ({ filterDates, filterType: selectedFilterType }) => {
  const [invoiceData, setInvoiceData] = useState([]);
  const [userId, setUserId] = useState(null);
  const [filterType, setFilterType] = useState(selectedFilterType || 'All');
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [businessInfo, setBusinessInfo] = useState({ name: '', address: '' });
  const creditsSectionRef = useRef(null);

  const scrollToCredits = () => { if (creditsSectionRef.current) { creditsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };

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
  const dueTodayAmount = dueTodayInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || inv.settings?.totalAmount || 0), 0);

  const dueTomorrowInvoices = creditInvoices.filter(inv => {
    const dueDateStr = inv.settings?.creditDueDate || inv.creditDueDate;
    const dueDate = new Date(`${dueDateStr}T00:00:00`);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() === tomorrow.getTime();
  });
  const dueTomorrowAmount = dueTomorrowInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || inv.settings?.totalAmount || 0), 0);
  
  const totalDueAmount = creditInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || inv.settings?.totalAmount || 0), 0);

  // We replace the main `div` with `motion.div` and apply our variants.
  return (
    <motion.div
      className="px-4 md:px-6 py-4 space-y-6 text-white max-w-[1400px] mx-auto w-full"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Each major element is now an animated item. */}
      <motion.h2
        variants={itemVariants}
        className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-emerald-200"
      >
        📊 Home Snapshot: Today’s KPIs
      </motion.h2>

      <motion.div variants={itemVariants}>
        <KpiCards
          invoiceData={filteredInvoices}
          totalRevenue={totalRevenue}
          paymentStats={paymentStats}
          dueToday={dueTodayAmount}
          dueTomorrow={dueTomorrowAmount}
          totalDue={totalDueAmount}
          totalDueCount={creditInvoices?.filter(i => i.isPaid === false).length || 0}
        />
      </motion.div>

      <motion.section
        variants={itemVariants}
        className="mt-4 overflow-x-auto"
        ref={creditsSectionRef}
      >
        <div className="relative rounded-2xl min-w-0 w-full">
          <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 pointer-events-none" />
          <div className="relative rounded-[14px] bg-white/10 backdrop-blur-xl border border-white/10 p-4 md:p-5 w-full min-w-0 overflow-visible">
            <CreditDueList
              creditInvoices={creditInvoices}
              dueToday={dueTodayInvoices}
              dueTomorrow={dueTomorrowInvoices}
              totalDue={totalDueAmount}
              businessName={businessInfo.name}
              businessAddress={businessInfo.address}
              layout="horizontal"
            />
          </div>
        </div>
      </motion.section>
      
      {/* We wrap the grid itself so both cards can animate in together after the items above them. */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div className="relative rounded-2xl h-full">
          <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 pointer-events-none" />
          <div className="relative rounded-[14px] bg-white/10 backdrop-blur-xl border border-white/10 p-4 h-full">
            <LowStockAlertWidget userId={userId} />
          </div>
        </div>

        <div className="relative rounded-2xl h-full">
          <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 pointer-events-none" />
          <div className="relative rounded-[14px] bg-white/10 backdrop-blur-xl border border-white/10 p-4 h-full">
            <RecentInvoices invoiceData={[...filteredInvoices].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default HomeSnapshot;