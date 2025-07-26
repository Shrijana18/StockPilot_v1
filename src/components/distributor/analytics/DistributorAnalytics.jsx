import React, { useEffect, useState } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import DispatchSpeedTracker from "./DispatchSpeedTracker";
import InventoryDrainForecast from "./InventoryDrainForecast";
import RetailerDependencyRisk from "./RetailerDependencyRisk";
import BrandPerformanceTracker from "./BrandPerformanceTracker";
import DailySmartSummary from "./DailySmartSummary";

const DistributorAnalytics = ({ distributorId }) => {
  console.log("✅ DistributorAnalytics loaded with distributorId:", distributorId);

  const [totalOrders, setTotalOrders] = useState(0);
  const [avgDispatchTime, setAvgDispatchTime] = useState(0);
  const [topRequestedProducts, setTopRequestedProducts] = useState([]);

  const db = getFirestore();

  useEffect(() => {
    if (!distributorId) return;

    const fetchAnalytics = async () => {
      try {
        const orderRef = collection(db, "businesses", distributorId, "orderRequests");
        const orderSnap = await getDocs(orderRef);
        setTotalOrders(orderSnap.size);

        // Placeholder for avg dispatch time and top requested product logic
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      }
    };

    fetchAnalytics();
  }, [distributorId]);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Analytics</h2>
      <div className="bg-white shadow rounded p-6 grid gap-6">
        <div>
          <p className="text-lg font-medium">Total Orders Fulfilled</p>
          <p className="text-2xl">{totalOrders}</p>
        </div>
        <div>
          <p className="text-lg font-medium">Avg. Dispatch Time (mins)</p>
          <p className="text-2xl">{avgDispatchTime}</p>
        </div>
        <div>
          <p className="text-lg font-medium">Top Requested Products</p>
          {topRequestedProducts.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <ul className="list-disc list-inside">
              {topRequestedProducts.map((item, i) => (
                <li key={i}>{item.name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-8 grid gap-6">
        <h3 className="text-xl font-semibold">Advanced Insights</h3>
        <DispatchSpeedTracker distributorId={distributorId} />
        <InventoryDrainForecast distributorId={distributorId} />
        <RetailerDependencyRisk distributorId={distributorId} />
        <BrandPerformanceTracker distributorId={distributorId} />
        <DailySmartSummary distributorId={distributorId} />
      </div>
    </div>
  );
};

export default DistributorAnalytics;