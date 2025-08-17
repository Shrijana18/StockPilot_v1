

import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";
import { motion } from "framer-motion";

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

const DistributorCreditDue = () => {
  const [snapshot, setSnapshot] = useState({
    totalDueOrders: 0,
    dueToday: { amount: 0, retailers: [] },
    dueTomorrow: { amount: 0, retailers: [] },
  });

  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const distributorId = user.uid;
      const orderRef = collection(db, "businesses", distributorId, "orderRequests");
      const querySnap = await getDocs(orderRef);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      let totalDueOrders = 0;
      let dueTodayAmount = 0;
      let dueTomorrowAmount = 0;
      let dueTodayRetailers = new Set();
      let dueTomorrowRetailers = new Set();
      querySnap.forEach((doc) => {
        const order = doc.data();
        if (order.isPaid === false && order.status === "Delivered") {
          totalDueOrders += 1;
          // Parse deliveredAt and creditDays
          const deliveredAt = order.deliveredAt
            ? new Date(order.deliveredAt)
            : null;
          const creditDays = Number(order.creditDays || 0);
          if (deliveredAt && !isNaN(deliveredAt.getTime())) {
            const dueDate = addDays(deliveredAt, creditDays);
            dueDate.setHours(0, 0, 0, 0);
            const totalAmount = Number(order.totalAmount || 0);
            const retailerName = order.retailerName || order.retailer || "Unknown";
            if (isSameDay(dueDate, today)) {
              dueTodayAmount += totalAmount;
              dueTodayRetailers.add(retailerName);
            } else if (isSameDay(dueDate, tomorrow)) {
              dueTomorrowAmount += totalAmount;
              dueTomorrowRetailers.add(retailerName);
            }
          }
        }
      });
      setSnapshot({
        totalDueOrders,
        dueToday: {
          amount: dueTodayAmount,
          retailers: Array.from(dueTodayRetailers),
        },
        dueTomorrow: {
          amount: dueTomorrowAmount,
          retailers: Array.from(dueTomorrowRetailers),
        },
      });
    };
    fetchData();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.35 }}
      className="bg-white shadow-md rounded-lg p-4 max-w-md"
    >
      <h3 className="font-semibold text-lg mb-3">Credit Due Snapshot</h3>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Total Due Orders</span>
          <span className="font-semibold">{snapshot.totalDueOrders}</span>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Due Today</span>
            <span className="font-semibold text-orange-600">{inr.format(snapshot.dueToday.amount)}</span>
          </div>
          {snapshot.dueToday.retailers.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {snapshot.dueToday.retailers.slice(0,3).map((r) => (
                <span key={r} className="px-2 py-0.5 text-xs rounded-full bg-orange-50 text-orange-700 border border-orange-200">{r}</span>
              ))}
              {snapshot.dueToday.retailers.length > 3 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-50 text-gray-600 border border-gray-200">+{snapshot.dueToday.retailers.length - 3} more</span>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Due Tomorrow</span>
            <span className="font-semibold text-indigo-600">{inr.format(snapshot.dueTomorrow.amount)}</span>
          </div>
          {snapshot.dueTomorrow.retailers.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {snapshot.dueTomorrow.retailers.slice(0,3).map((r) => (
                <span key={r} className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{r}</span>
              ))}
              {snapshot.dueTomorrow.retailers.length > 3 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-50 text-gray-600 border border-gray-200">+{snapshot.dueTomorrow.retailers.length - 3} more</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default DistributorCreditDue;