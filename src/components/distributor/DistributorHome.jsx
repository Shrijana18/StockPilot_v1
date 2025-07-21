import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebase/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

const DistributorHome = () => {
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    inventoryCount: 0,
    lowStockCount: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const distributorId = auth.currentUser?.uid;
      if (!distributorId) return;

      try {
        const orderSnap = await getDocs(
          collection(db, `businesses/${distributorId}/orderRequests`)
        );

        let total = 0,
          pending = 0,
          completed = 0,
          revenue = 0;

        orderSnap.forEach((doc) => {
          const d = doc.data();
          total++;
          if (d.status === "Pending" || d.status === "Accepted" || d.status === "Modified") pending++;
          if (d.status === "Delivered") completed++;
          revenue += Number(d.totalAmount || 0);
        });

        const productSnap = await getDocs(
          collection(db, `businesses/${distributorId}/products`)
        );

        let inventoryCount = 0,
          lowStockCount = 0;

        productSnap.forEach((doc) => {
          const d = doc.data();
          inventoryCount++;
          if (d.quantity < 5) lowStockCount++;
        });

        setStats({
          totalOrders: total,
          pendingOrders: pending,
          completedOrders: completed,
          totalRevenue: revenue,
          inventoryCount,
          lowStockCount,
        });
      } catch (err) {
        console.error("Error loading distributor stats:", err);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-3xl font-bold">📦 Distributor Business Snapshot</h2>

      {/* Top KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white shadow-md rounded-lg p-4">
          <p className="text-gray-500 text-sm">Total Orders</p>
          <p className="text-2xl font-bold">{stats.totalOrders}</p>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <p className="text-gray-500 text-sm">Pending Orders</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pendingOrders}</p>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <p className="text-gray-500 text-sm">Completed Orders</p>
          <p className="text-2xl font-bold text-green-600">{stats.completedOrders}</p>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <p className="text-gray-500 text-sm">Total Revenue</p>
          <p className="text-2xl font-bold text-blue-600">₹{stats.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <p className="text-gray-500 text-sm">Inventory Items</p>
          <p className="text-2xl font-bold">{stats.inventoryCount}</p>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <p className="text-gray-500 text-sm">Low Stock Alerts</p>
          <p className="text-2xl font-bold text-red-600">{stats.lowStockCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white shadow-md rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-2">📊 Order Trends</h3>
          <div className="h-40 bg-gray-100 rounded flex items-center justify-center text-gray-400">
            Chart Placeholder
          </div>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-2">💸 Revenue Insights</h3>
          <div className="h-40 bg-gray-100 rounded flex items-center justify-center text-gray-400">
            Revenue Chart Placeholder
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-4 mt-6">
        <h3 className="font-semibold text-lg mb-2">📅 Today’s Collection Schedule</h3>
        <p className="text-sm text-gray-600">
          Data will list retailers with dues today (future enhancement)
        </p>
      </div>
    </div>
  );
};

export default DistributorHome;