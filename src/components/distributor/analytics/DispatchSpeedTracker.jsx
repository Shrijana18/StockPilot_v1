import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import dayjs from 'dayjs';

const DispatchSpeedTracker = ({ distributorId }) => {
  const [averageTime, setAverageTime] = useState(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchDispatchTimes = async () => {
      const ordersRef = collection(db, 'businesses', distributorId, 'orderRequests');
      const snapshot = await getDocs(ordersRef);

      let totalMinutes = 0;
      let count = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        const acceptedAt = data.orderAcceptedAt || data.createdAt;
        const shippedAt = data.orderShippedAt || data.deliveredAt;

        if (acceptedAt && shippedAt) {
          const accepted = dayjs(acceptedAt);
          const shipped = dayjs(shippedAt);
          const diff = shipped.diff(accepted, 'minute');
          if (!isNaN(diff) && diff >= 0) {
            totalMinutes += diff;
            count += 1;
          }
        }
      });

      const average = count > 0 ? (totalMinutes / count).toFixed(1) : null;
      setAverageTime(average);
      setCount(count);
    };

    if (distributorId) {
      fetchDispatchTimes();
    }
  }, [distributorId]);

  return (
    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span>🚚</span> Dispatch Speed Tracker
      </h2>
      {averageTime !== null ? (
        <div className="space-y-2">
          <p className="text-white/80">
            Average Dispatch Time: <strong className="text-emerald-400 text-xl">{averageTime} minutes</strong>
          </p>
          <p className="text-white/60 text-sm">Across {count} orders</p>
          <div className="mt-4 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <p className="text-xs text-emerald-300">
              {averageTime < 60
                ? "⚡ Excellent dispatch speed!"
                : averageTime < 120
                ? "✅ Good dispatch performance"
                : "⚠️ Consider optimizing dispatch process"}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-white/60">No dispatch data available.</p>
      )}
    </div>
  );
};

export default DispatchSpeedTracker;
