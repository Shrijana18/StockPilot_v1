/**
 * RoleSelection - Choose between Retailer or Distributor employee login
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getEmployeeSession, clearEmployeeSession } from '../../utils/employeeSession';
import { getDistributorEmployeeSession, clearDistributorEmployeeSession } from '../../utils/distributorEmployeeSession';

const RoleSelection = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Do NOT clear session on mount - that was causing the bug where after login
  // redirect to / would wipe the session. Instead: if user already has valid
  // session, redirect to the correct dashboard.
  useEffect(() => {
    if (searchParams.toString()) {
      setSearchParams({}, { replace: true });
    }

    const retailerSession = getEmployeeSession();
    const distributorSession = getDistributorEmployeeSession();
    const hasRetailerSession = retailerSession?.retailerId && retailerSession?.employeeId;
    const hasDistributorSession = distributorSession?.distributorId && distributorSession?.employeeId;

    if (hasRetailerSession) {
      navigate('/employee-dashboard', { replace: true });
      return;
    }
    if (hasDistributorSession) {
      navigate('/distributor-employee-dashboard', { replace: true });
      return;
    }
  }, [navigate, searchParams]);

  const handleRoleSelect = (role) => {
    // When user explicitly chooses a role, clear only the OTHER role's session
    // so we start fresh for the chosen flow
    if (role === 'retailer') {
      clearDistributorEmployeeSession();
    } else {
      clearEmployeeSession();
    }
    if (role === 'retailer') {
      navigate('/employee-login');
    } else if (role === 'distributor') {
      navigate('/distributor-employee-login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-24 h-24 mx-auto mb-4 flex items-center justify-center"
          >
            <img 
              src="/assets/flyp_logo.png" 
              alt="FLYP Logo" 
              className="w-full h-full object-contain drop-shadow-2xl"
              onError={(e) => {
                // Fallback if image doesn't load
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg hidden">
              <span className="text-3xl font-bold text-white">FLYP</span>
            </div>
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">
            FL<span className="text-cyan-400">Y</span>P
          </h1>
          <p className="text-gray-400">Employee Portal</p>
        </div>

        {/* Role Selection Cards */}
        <div className="space-y-4">
          <motion.button
            onClick={() => handleRoleSelect('retailer')}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-semibold py-6 px-6 rounded-2xl shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 transition-all duration-300 flex items-center justify-between group border border-emerald-400/20"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-lg font-bold">Retailer Employee</div>
                <div className="text-sm text-emerald-100">Delivery & Store Operations</div>
              </div>
            </div>
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>

          {/* HIDDEN FOR APP STORE REVIEW - Distributor Employee option */}
          {/* Uncomment below to enable distributor employee flow */}
          {false && (
            <motion.button
              onClick={() => handleRoleSelect('distributor')}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white font-semibold py-6 px-6 rounded-2xl shadow-xl shadow-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/40 transition-all duration-300 flex items-center justify-between group border border-cyan-400/20"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold">Distributor Employee</div>
                  <div className="text-sm text-cyan-100">Warehouse & Distribution</div>
                </div>
              </div>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </motion.button>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-8">
          Sign in to continue
        </p>
      </motion.div>
    </div>
  );
};

export default RoleSelection;
