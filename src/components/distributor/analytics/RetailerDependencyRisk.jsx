import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale);

const RetailerDependencyRisk = ({ distributorId }) => {
  const [retailerData, setRetailerData] = useState([]);
  const [highRisk, setHighRisk] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const ordersRef = collection(db, 'businesses', distributorId, 'orderRequests');
      const snapshot = await getDocs(ordersRef);

      const retailerCounts = {};
      let totalOrders = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        const retailer = data.retailerName || 'Unknown';
        retailerCounts[retailer] = (retailerCounts[retailer] || 0) + 1;
        totalOrders += 1;
      });

      const sortedRetailers = Object.entries(retailerCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));

      const top3Total = sortedRetailers.slice(0, 3).reduce((sum, r) => sum + r.count, 0);
      const riskPercent = (top3Total / totalOrders) * 100;

      setHighRisk(riskPercent > 60);
      setRetailerData(sortedRetailers);
    };

    if (distributorId) fetchData();
  }, [distributorId]);

  const chartData = {
    labels: retailerData.map(r => r.name),
    datasets: [
      {
        data: retailerData.map(r => r.count),
        backgroundColor: [
          '#4CAF50', '#FF9800', '#2196F3', '#F44336', '#9C27B0',
          '#3F51B5', '#009688', '#FF5722', '#607D8B'
        ],
      }
    ],
  };

  return (
    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span>🎯</span> Retailer Dependency Risk
      </h2>
      {retailerData.length === 0 ? (
        <p className="text-white/60">No data yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="max-w-md mx-auto">
            <Pie
              data={chartData}
              options={{
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: { color: "rgba(255,255,255,0.8)", padding: 15 },
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => {
                        const label = context.label || "";
                        const value = context.parsed || 0;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                        return `${label}: ${value} orders (${percentage}%)`;
                      },
                    },
                  },
                },
              }}
            />
          </div>
          {highRisk && (
            <div className="mt-4 p-4 bg-red-500/10 rounded-lg border border-red-500/20">
              <p className="text-red-300 font-medium flex items-center gap-2">
                <span>⚠️</span> High dependency on a few retailers. Consider diversifying your reach.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RetailerDependencyRisk;
