

import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement
);

const HomeSnapshot = () => {
  const [invoiceData, setInvoiceData] = useState([]);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const q = collection(db, 'businesses', user.uid, 'finalizedInvoices');
        const querySnapshot = await getDocs(q);
        const data = [];
        querySnapshot.forEach((doc) => {
          data.push({ ...doc.data(), id: doc.id });
        });
        setInvoiceData(data);
      } catch (err) {
        console.error('Error fetching invoices:', err);
      }
    };

    fetchInvoices();
  }, []);

  const barData = {
    labels: invoiceData.map((inv) =>
      new Date(inv.timestamp?.seconds * 1000).toLocaleDateString()
    ),
    datasets: [
      {
        label: 'Total Sales',
        data: invoiceData.map((inv) => inv.grandTotal || 0),
        backgroundColor: 'rgba(255, 159, 64, 0.6)',
      },
    ],
  };

  const pieData = {
    labels: ['Cash', 'UPI', 'Card'],
    datasets: [
      {
        data: [
          invoiceData.filter((i) => i.paymentMode === 'Cash').length,
          invoiceData.filter((i) => i.paymentMode === 'UPI').length,
          invoiceData.filter((i) => i.paymentMode === 'Card').length,
        ],
        backgroundColor: ['#36A2EB', '#FFCE56', '#FF6384'],
      },
    ],
  };

  const lineData = {
    labels: invoiceData.map((inv) =>
      new Date(inv.timestamp?.seconds * 1000).toLocaleDateString()
    ),
    datasets: [
      {
        label: 'Invoice Count Over Time',
        data: invoiceData.map((_, idx) => idx + 1),
        borderColor: '#4bc0c0',
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-lg font-semibold">📊 Home Snapshot: Today’s KPIs</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded shadow p-4">
          <h3 className="font-semibold mb-2">Bar Chart: Sales</h3>
          <Bar data={barData} />
        </div>
        <div className="bg-white rounded shadow p-4">
          <h3 className="font-semibold mb-2">Pie Chart: Payment Modes</h3>
          <Pie data={pieData} />
        </div>
        <div className="bg-white rounded shadow p-4">
          <h3 className="font-semibold mb-2">Line Chart: Invoice Trend</h3>
          <Line data={lineData} />
        </div>
      </div>
    </div>
  );
};

export default HomeSnapshot;