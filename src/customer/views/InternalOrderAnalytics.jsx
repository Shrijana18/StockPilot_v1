/**
 * Internal Order Analytics - FLYP team view
 * Access via /internal or #internal
 * Shows order flow, status distribution, payment analytics
 */

import React, { useState, useEffect } from 'react';
import {
  FaArrowLeft,
  FaChartBar,
  FaStore,
  FaUser,
  FaCreditCard,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaFilter,
  FaSync,
} from 'react-icons/fa';
import { getOrdersForAnalytics, getOrderStatusInfo } from '../services/orderService';

const InternalOrderAnalytics = ({ onBack }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrdersForAnalytics(150);
      setOrders(data);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filtered = orders.filter((o) => {
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  });

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const paymentMethodCounts = orders.reduce((acc, o) => {
    const m = o.paymentMethod || 'UNKNOWN';
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="customer-screen bg-[#0a0f1a]">
      <div className="bg-[#0a0f1a]/90 backdrop-blur-xl z-10 border-b border-white/[0.06]">
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}
        >
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center"
          >
            <FaArrowLeft className="text-white/60" />
          </button>
          <div>
            <h1 className="font-bold text-white text-lg">Internal Analytics</h1>
            <p className="text-xs text-white/40">Order flow & payment</p>
          </div>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="ml-auto w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"
          >
            <FaSync className={`text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="customer-scroll">
        <div className="px-4 py-4 space-y-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Status breakdown */}
          <div className="bg-slate-800 rounded-xl border border-white/[0.06] p-4">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <FaChartBar className="text-emerald-400" />
              Status
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(statusCounts).map(([status, count]) => {
                const info = getOrderStatusInfo(status);
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                    className={`p-3 rounded-lg border text-left ${
                      statusFilter === status
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-white/[0.08] bg-white/[0.03]'
                    }`}
                  >
                    <p className={`text-sm font-medium ${info?.color || 'text-white/60'}`}>
                      {info?.label || status}
                    </p>
                    <p className="text-lg font-bold text-white">{count}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment methods */}
          <div className="bg-slate-800 rounded-xl border border-white/[0.06] p-4">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <FaCreditCard className="text-amber-400" />
              Payment
            </h3>
            <div className="space-y-2">
              {Object.entries(paymentMethodCounts).map(([method, count]) => (
                <div
                  key={method}
                  className="flex justify-between items-center py-1 text-sm"
                >
                  <span className="text-white/70">{method}</span>
                  <span className="font-semibold text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Order list */}
          <div className="bg-slate-800 rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <FaFilter className="text-white/40" />
                Orders {statusFilter !== 'all' && `(${statusFilter})`}
              </h3>
              <span className="text-xs text-white/40">{filtered.length} of {orders.length}</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-white/40 text-sm">Loading...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-white/40 text-sm">No orders</div>
              ) : (
                filtered.map((o) => {
                  const info = getOrderStatusInfo(o.status);
                  return (
                    <div
                      key={o.id}
                      className="px-4 py-3 border-b border-white/[0.06] last:border-0 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-medium text-white text-sm">
                          {o.orderNumber} • {o.storeName}
                        </p>
                        <p className="text-xs text-white/40">
                          {o.customerName} • ₹{o.total}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${info?.bgColor || 'bg-white/10'} ${info?.color || 'text-white/60'}`}
                      >
                        {info?.label || o.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternalOrderAnalytics;
