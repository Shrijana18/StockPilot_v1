import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { functions, empAuth } from '../firebase/firebaseConfig';
import { setDistributorEmployeeSession, clearDistributorEmployeeSession, setDistributorEmployeeRedirect } from '../utils/distributorEmployeeSession';
import { toast } from 'react-toastify';

const DistributorEmployeeLogin = () => {
  const [form, setForm] = useState({
    employeeId: '',
    pin: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const distributorId = searchParams.get('distributorId');
  const empId = searchParams.get('empId');

  useEffect(() => {
    if (empId) {
      setForm(prev => ({ ...prev, employeeId: empId.toUpperCase() }));
      // If employee ID is pre-filled, focus the PIN input for better UX
      const pinInput = document.querySelector('input[name="pin"]');
      if (pinInput) {
        setTimeout(() => pinInput.focus(), 100);
      }
    }
  }, [empId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!form.employeeId.trim() || !form.pin.trim()) {
        setError('Please enter both Employee ID and PIN');
        setLoading(false);
        return;
      }

      // Use Cloud Function for authentication
      // distributorId is optional - if not in URL, function will search across all distributors
      const distributorEmployeeLogin = httpsCallable(functions, 'distributorEmployeeLogin');
      const result = await distributorEmployeeLogin({
        ...(distributorId && { distributorId }), // Only include if present
        employeeId: form.employeeId.toUpperCase(),
        pin: form.pin
      });

      if (!result.data.success) {
        setError(result.data.message || 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      const { employeeData, customToken } = result.data;

      // Sign in with custom token using employee auth instance
      await signInWithCustomToken(empAuth, customToken);

      // Store session IMMEDIATELY and ensure it's committed
      setDistributorEmployeeSession({
        employeeId: employeeData.id,
        distributorId: employeeData.distributorId || distributorId,
        name: employeeData.name,
        role: employeeData.role,
        flypEmployeeId: employeeData.flypEmployeeId || employeeData.id, // Include flypEmployeeId
        accessSections: employeeData.accessSections || {}
      });

      // Set redirect flag
      setDistributorEmployeeRedirect();

      // CRITICAL: Force localStorage to flush synchronously (especially important in production)
      // This ensures the session is committed before page reload
      try {
        // Trigger a dummy localStorage write to force flush
        localStorage.setItem('__flyp_commit_check', Date.now().toString());
        localStorage.removeItem('__flyp_commit_check');
        // Also verify the session was stored
        const verifySession = localStorage.getItem('flyp_distributor_employee_session');
        if (!verifySession) {
          console.warn('[Login] Session storage verification failed, retrying...');
          // Retry storing session
          setDistributorEmployeeSession({
            employeeId: employeeData.id,
            distributorId: employeeData.distributorId || distributorId,
            name: employeeData.name,
            role: employeeData.role,
            flypEmployeeId: employeeData.flypEmployeeId || employeeData.id, // Include flypEmployeeId
            accessSections: employeeData.accessSections || {}
          });
        }
      } catch (e) {
        console.error('[Login] Failed to verify localStorage commit:', e);
      }

      toast.success('Login successful! Redirecting...');

      // SIMPLE REDIRECT - Use window.location.href for ALL devices (most reliable)
      // Increased timeout in production to ensure localStorage is committed (CDN/network delays)
      const isProduction = window.location.hostname !== 'localhost';
      const redirectDelay = isProduction ? 1000 : 500; // Longer delay in production
      
      setTimeout(() => {
        window.location.href = '/distributor-employee-dashboard';
      }, redirectDelay);

    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 rounded-full mb-4">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Distributor Employee Login</h1>
            <p className="text-white/70 text-sm">Enter your credentials to access the system</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {distributorId && empId && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-lg text-sm">
                <p className="font-medium">✓ Using Shared Link</p>
                <p className="text-xs mt-1">Your Employee ID has been pre-filled from the link.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Employee ID
              </label>
              <input
                type="text"
                name="employeeId"
                value={form.employeeId}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="FLYP-DIST-XXXXXX"
                required
              />
              {distributorId && empId && (
                <p className="text-xs text-emerald-300 mt-1">
                  Pre-filled from shared link
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                PIN
              </label>
              <input
                type="password"
                name="pin"
                value={form.pin}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="Enter your PIN"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing In...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/50 text-xs">
              Need help? Contact your manager for assistance.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DistributorEmployeeLogin;
