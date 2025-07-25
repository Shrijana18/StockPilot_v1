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

const HourlyVisitChart = () => {
  const [hourlyData, setHourlyData] = useState(new Array(24).fill(0));

  useEffect(() => {
    const fetchData = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const ref = collection(db, `businesses/${userId}/finalizedInvoices`);
      const snap = await getDocs(ref);

      const counts = new Array(24).fill(0);
      const uniqueVisits = new Set();

      snap.docs.forEach(doc => {
        const data = doc.data();
        const timestamp = data.issuedAt || data.createdAt;
        if (!timestamp) return;

        const date = new Date(timestamp);
        const hour = date.getHours();

        const customer = data.customer || {};
        const key = customer.custId || customer.phone || customer.email || customer.name;
        const uniqueKey = `${key}-${hour}`;
        if (!uniqueVisits.has(uniqueKey)) {
          uniqueVisits.add(uniqueKey);
          counts[hour]++;
        }
      });

      setHourlyData(counts);
    };

    fetchData();
  }, []);

  const chartData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: "Invoices",
        data: hourlyData,
        backgroundColor: "#10B981",
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        stepSize: 1,
      },
    },
  };

  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <h2 className="text-lg font-bold mb-4">🕓 Hourly Customer Visit Trends</h2>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default HourlyVisitChart;