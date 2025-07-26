import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

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
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-lg font-semibold mb-2">🎯 Retailer Dependency Risk</h2>
      {retailerData.length === 0 ? (
        <p>No data yet.</p>
      ) : (
        <>
          <Pie data={chartData} />
          {highRisk && (
            <p className="mt-4 text-red-600 font-medium">
              ⚠️ High dependency on a few retailers. Consider diversifying your reach.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default RetailerDependencyRisk;
