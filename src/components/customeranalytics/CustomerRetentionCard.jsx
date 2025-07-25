

import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const CustomerRetentionCard = () => {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    returningCustomers: 0,
    retentionRate: 0,
    chartData: [],
  });

  useEffect(() => {
    const fetchInvoices = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const ref = collection(db, `businesses/${userId}/finalizedInvoices`);
      const snap = await getDocs(ref);

      const grouped = {};

      snap.docs.forEach((doc) => {
        const inv = doc.data();
        const c = inv.customer || {};
        const key = c.custId || c.phone || c.email || c.name;

        if (!grouped[key]) {
          grouped[key] = {
            custId: c.custId,
            name: c.name,
            visits: 0,
          };
        }

        grouped[key].visits += 1;
      });

      const totalCustomers = Object.keys(grouped).length;
      const returningCustomers = Object.values(grouped).filter(c => c.visits > 1).length;
      const retentionRate = totalCustomers > 0 ? ((returningCustomers / totalCustomers) * 100).toFixed(1) : 0;

      const chartData = Object.values(grouped)
        .sort((a, b) => b.visits - a.visits)
        .map(c => ({
          name: c.name || "Unknown",
          visits: c.visits,
        }));

      setStats({ totalCustomers, returningCustomers, retentionRate, chartData });
    };

    fetchInvoices();
  }, []);

  const barData = {
    labels: stats.chartData.map(c => c.name),
    datasets: [
      {
        label: "Visits",
        data: stats.chartData.map(c => c.visits),
        backgroundColor: "#3B82F6",
      },
    ],
  };

  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <h2 className="text-lg font-bold mb-2">📈 Customer Retention</h2>
      <p>Total Customers: <strong>{stats.totalCustomers}</strong></p>
      <p>Returning Customers: <strong>{stats.returningCustomers}</strong></p>
      <p>Retention Rate: <strong>{stats.retentionRate}%</strong></p>
      {stats.chartData.length > 0 && (
        <div className="mt-4">
          <Bar data={barData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </div>
      )}
    </div>
  );
};

export default CustomerRetentionCard;