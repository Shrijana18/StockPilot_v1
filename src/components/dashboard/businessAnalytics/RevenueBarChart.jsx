import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../../../firebase/firebaseConfig';
import { format } from 'date-fns';

const RevenueBarChart = () => {
  const [barData, setBarData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const invoicesRef = collection(db, 'businesses', user.uid, 'finalizedInvoices');
        const snapshot = await getDocs(invoicesRef);

        const dataMap = {}; // { date: { Cash: 0, UPI: 0, Card: 0 } }

        snapshot.forEach(doc => {
          const data = doc.data();
          const date = data.createdAt?.toDate ? format(data.createdAt.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
          const mode = data.paymentMode?.toLowerCase();
          const amount = data.totalAmount || 0;

          if (!dataMap[date]) {
            dataMap[date] = { date, Cash: 0, UPI: 0, Card: 0 };
          }

          if (mode === 'cash') dataMap[date].Cash += amount;
          else if (mode === 'upi') dataMap[date].UPI += amount;
          else if (mode === 'card') dataMap[date].Card += amount;
        });

        const formattedData = Object.values(dataMap).sort((a, b) => new Date(a.date) - new Date(b.date));
        setBarData(formattedData);
      } catch (err) {
        console.error('Error fetching bar chart data:', err);
      }
    };

    fetchData();
  }, []);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={barData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip formatter={(val) => `₹${val}`} />
        <Legend />
        <Bar dataKey="Cash" stackId="a" fill="#fbbf24" />
        <Bar dataKey="UPI" stackId="a" fill="#34d399" />
        <Bar dataKey="Card" stackId="a" fill="#818cf8" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default RevenueBarChart;