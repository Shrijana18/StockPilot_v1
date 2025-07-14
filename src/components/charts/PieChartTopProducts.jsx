

import React, { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

ChartJS.register(ArcElement, Tooltip, Legend);

const PieChartTopProducts = () => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    const fetchTopProducts = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const snapshot = await getDocs(collection(db, "businesses", user.uid, "finalizedInvoices"));
      const productMap = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        const cartItems = data.cartItems || [];

        cartItems.forEach((item) => {
          const name = item.name;
          const qty = Number(item.quantity) || 0;

          if (!productMap[name]) {
            productMap[name] = 0;
          }
          productMap[name] += qty;
        });
      });

      const labels = Object.keys(productMap);
      const data = Object.values(productMap);

      setChartData({
        labels,
        datasets: [
          {
            label: "Units Sold",
            data,
            backgroundColor: [
              "#60a5fa",
              "#f87171",
              "#34d399",
              "#facc15",
              "#a78bfa",
              "#fb923c",
              "#4ade80",
              "#f472b6",
            ],
            borderWidth: 1,
          },
        ],
      });
    };

    fetchTopProducts();
  }, []);

  return (
    <div className="w-full h-full">
      {chartData ? <Pie data={chartData} /> : <p>Loading chart...</p>}
    </div>
  );
};

export default PieChartTopProducts;