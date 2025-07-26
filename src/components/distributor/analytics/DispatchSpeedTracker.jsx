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
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-lg font-semibold mb-2">🚚 Dispatch Speed Tracker</h2>
      {averageTime !== null ? (
        <p>
          Average Dispatch Time: <strong>{averageTime} minutes</strong> across {count} orders
        </p>
      ) : (
        <p>No dispatch data available.</p>
      )}
    </div>
  );
};

export default DispatchSpeedTracker;
