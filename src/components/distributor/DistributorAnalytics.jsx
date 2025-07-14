

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
const DistributorAnalytics = ({ db, auth }) => {
  const [stats, setStats] = useState({
    totalOrders: 0,
    averageDispatchTime: 0,
    topProducts: [],
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const dispatchRef = collection(db, `businesses/${user.uid}/dispatches`);
      const snapshot = await getDocs(dispatchRef);
      const data = snapshot.docs.map((doc) => doc.data());

      const totalOrders = data.length;

      const dispatchTimes = data
        .filter((d) => d.createdAt && d.dispatchedAt)
        .map((d) => {
          const created = new Date(d.createdAt);
          const dispatched = new Date(d.dispatchedAt);
          return (dispatched - created) / (1000 * 60); // in minutes
        });

      const averageDispatchTime =
        dispatchTimes.length > 0
          ? (dispatchTimes.reduce((a, b) => a + b, 0) / dispatchTimes.length).toFixed(2)
          : 0;

      const productCount = {};
      data.forEach((d) => {
        d.products?.forEach((p) => {
          productCount[p.name] = (productCount[p.name] || 0) + 1;
        });
      });

      const topProducts = Object.entries(productCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      setStats({ totalOrders, averageDispatchTime, topProducts });
    };

    fetchAnalytics();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-4 shadow rounded">
          <h3 className="font-medium text-gray-700">Total Orders Fulfilled</h3>
          <p className="text-2xl font-bold">{stats.totalOrders}</p>
        </div>
        <div className="bg-white p-4 shadow rounded">
          <h3 className="font-medium text-gray-700">Avg. Dispatch Time (mins)</h3>
          <p className="text-2xl font-bold">{stats.averageDispatchTime}</p>
        </div>
      </div>
      <div className="bg-white p-4 shadow rounded">
        <h3 className="font-medium text-gray-700 mb-2">Top Requested Products</h3>
        <ul className="list-disc ml-5">
          {stats.topProducts.length === 0 ? (
            <li className="text-gray-500">No data yet.</li>
          ) : (
            stats.topProducts.map((item) => (
              <li key={item.name}>
                {item.name} — {item.count} orders
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default DistributorAnalytics;