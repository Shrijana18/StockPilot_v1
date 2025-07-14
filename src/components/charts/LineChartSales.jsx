

import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

const LineChartSales = () => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    const fetchSalesData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const snapshot = await getDocs(collection(db, "businesses", user.uid, "finalizedInvoices"));
      const salesByDate = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp;
        const total = data.grandTotal || 0;

        if (timestamp?.seconds) {
          const dateStr = new Date(timestamp.seconds * 1000).toLocaleDateString();
          salesByDate[dateStr] = (salesByDate[dateStr] || 0) + total;
        }
      });

      const labels = Object.keys(salesByDate).sort((a, b) => new Date(a) - new Date(b));
      const data = labels.map(date => salesByDate[date]);

      setChartData({
        labels,
        datasets: [
          {
            label: "Daily Sales (₹)",
            data,
            borderColor: "#3b82f6",
            backgroundColor: "#93c5fd",
            tension: 0.3,
            fill: true,
          },
        ],
      });
    };

    fetchSalesData();
  }, []);

  return (
    <div className="w-full h-full">
      {chartData ? <Line data={chartData} /> : <p>Loading chart...</p>}
    </div>
  );
};

export default LineChartSales;