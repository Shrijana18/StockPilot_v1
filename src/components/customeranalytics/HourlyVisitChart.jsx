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
        backgroundColor: "rgba(16,185,129,0.8)", // teal gradient-like color
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: {
          color: "#e5e7eb" // Tailwind gray-200 for visibility on dark
        },
        grid: {
          color: "rgba(255,255,255,0.04)"
        }
      },
      y: {
        beginAtZero: true,
        stepSize: 1,
        ticks: {
          color: "#e5e7eb"
        },
        grid: {
          color: "rgba(255,255,255,0.08)"
        }
      },
    },
  };

  return (
    <div className="bg-slate-900/60 border border-white/10 backdrop-blur-sm shadow rounded p-4 mb-6">
      <h2 className="text-lg font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400">
        🕓 Hourly Customer Visit Trends
      </h2>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default HourlyVisitChart;