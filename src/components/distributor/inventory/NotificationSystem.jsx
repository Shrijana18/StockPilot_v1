import React, { useState, useEffect } from 'react';

/**
 * Silent Notification System
 * Only shows critical errors and important confirmations
 * Minor actions use subtle visual feedback instead
 */

const NotificationSystem = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const showNotification = (message, type = 'info', duration = 3000) => {
    // Only show critical notifications
    if (type === 'error' || type === 'critical') {
      const id = Date.now();
      setNotifications(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }
  };

  return (
    <>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notif => (
          <div
            key={notif.id}
            className={`px-4 py-3 rounded-lg shadow-xl backdrop-blur-sm border ${
              notif.type === 'error' 
                ? 'bg-red-500/90 border-red-400 text-white' 
                : 'bg-emerald-500/90 border-emerald-400 text-white'
            }`}
          >
            {notif.message}
          </div>
        ))}
      </div>
    </>
  );
};

export default NotificationSystem;

