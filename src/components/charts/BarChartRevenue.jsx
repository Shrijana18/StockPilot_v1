

import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const BarChartRevenue = () => {
  const [paymentData, setPaymentData] = useState({});

  useEffect(() => {
    const fetchRevenueByPayment = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const snapshot = await getDocs(collection(db, "businesses", user.uid, "finalizedInvoices"));
      const paymentSums = { Cash: 0, UPI: 0, Card: 0 };

      snapshot.forEach((doc) => {
        const data = doc.data();
        const mode = data.paymentMode;
        const total = data.grandTotal || 0;
        if (mode && paymentSums[mode] !== undefined) {
          paymentSums[mode] += total;
        }
      });

      setPaymentData({
        labels: Object.keys(paymentSums),
        datasets: [
          {
            label: "Revenue by Payment Mode (₹)",
            data: Object.values(paymentSums),
            backgroundColor: ["#60a5fa", "#34d399", "#facc15"],
          },
        ],
      });
    };

    fetchRevenueByPayment();
  }, []);

  return (
    <div className="w-full h-full">
      {paymentData.labels ? <Bar data={paymentData} /> : <p>Loading chart...</p>}
    </div>
  );
};

export default BarChartRevenue;