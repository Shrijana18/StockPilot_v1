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

const TopProductsChart = () => {
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const ref = collection(db, `businesses/${userId}/finalizedInvoices`);
      const snap = await getDocs(ref);

      const productMap = {};
      const customerProductMap = {};

      snap.docs.forEach(doc => {
        const data = doc.data();
        const customer = data.customer || {};
        const custKey = customer.custId || customer.phone || customer.email || customer.name;
        (data.cartItems || []).forEach(item => {
          const name = item.name || "Unnamed";
          const key = `${custKey}-${name}`;
          if (!customerProductMap[key]) {
            customerProductMap[key] = item.quantity;
            productMap[name] = (productMap[name] || 0) + item.quantity;
          }
        });
      });

      const sorted = Object.entries(productMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => ({ name, qty }));

      setTopProducts(sorted);
    };

    fetchData();
  }, []);

  const chartData = {
    labels: topProducts.map(p => p.name),
    datasets: [
      {
        label: "Quantity Sold",
        data: topProducts.map(p => p.qty),
        backgroundColor: "#6366F1",
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
      <h2 className="text-lg font-bold mb-4">🛒 Top 5 Most Frequently Bought Products</h2>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default TopProductsChart;