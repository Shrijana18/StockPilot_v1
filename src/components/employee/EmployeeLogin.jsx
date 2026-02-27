import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { empFunctions, empAuth } from '../../firebase/firebaseConfig';
import { setEmployeeSession, setEmployeeRedirect, setPendingEmployeeSession } from '../../utils/employeeSession';
import { toast } from 'react-toastify';

const EmployeeLogin = () => {
  const [form, setForm] = useState({
    employeeId: '',
    pin: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const signingInRef = React.useRef(false); // Prevent concurrent sign-in attempts

  useEffect(() => {
    // ALWAYS clear form on mount - no prefilling
    setForm({ employeeId: '', pin: '' });
    
    // Clear any URL parameters to ensure clean state
    // This makes it a unique gateway - no prefilled data
    if (searchParams.toString()) {
      // Remove all query parameters from URL
      setSearchParams({}, { replace: true });
    }
  }, []); // Empty dependency array - only run once on mount

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
      // No retailerId needed - function will search across all retailers
      // Use empFunctions (employee app's functions) for consistency
      const retailerEmployeeLogin = httpsCallable(empFunctions, 'retailerEmployeeLogin');
      const result = await retailerEmployeeLogin({
        employeeId: form.employeeId.toUpperCase(),
        pin: form.pin
      });

      if (!result.data.success) {
        setError(result.data.message || 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      const { employeeData, customToken } = result.data;

      // Validate token before using it
      if (!customToken || typeof customToken !== 'string' || customToken.trim().length === 0) {
        console.error('[EmployeeLogin] ❌ Invalid custom token received:', { 
          hasToken: !!customToken, 
          type: typeof customToken,
          length: customToken?.length 
        });
        setError('Login failed: Invalid authentication token. Please try again.');
        setLoading(false);
        return;
      }

      // Sign in with custom token using employee auth instance
      try {
        // Prevent concurrent sign-in attempts
        if (signingInRef.current) {
          console.warn('[EmployeeLogin] ⚠️ Sign-in already in progress, skipping duplicate call');
          return;
        }
        signingInRef.current = true;
        
        // Validate empAuth instance before using it
        if (!empAuth) {
          signingInRef.current = false;
          console.error('[EmployeeLogin] ❌ empAuth instance is null/undefined');
          setError('Login failed: Authentication service unavailable. Please try again.');
          setLoading(false);
          return;
        }
        
        // Validate empAuth is a proper Firebase Auth instance
        if (typeof empAuth !== 'object' || !empAuth.app) {
          console.error('[EmployeeLogin] ❌ empAuth is not a valid Firebase Auth instance:', {
            type: typeof empAuth,
            hasApp: !!empAuth?.app,
            empAuthKeys: empAuth ? Object.keys(empAuth) : []
          });
          setError('Login failed: Authentication service unavailable. Please try again.');
          setLoading(false);
          return;
        }
        
        // Validate token one more time right before use
        if (!customToken || typeof customToken !== 'string' || customToken.trim().length === 0) {
          console.error('[EmployeeLogin] ❌ Token invalid right before signIn:', {
            hasToken: !!customToken,
            type: typeof customToken,
            length: customToken?.length,
            isEmpty: customToken?.trim().length === 0
          });
          setError('Login failed: Invalid authentication token. Please try again.');
          setLoading(false);
          return;
        }
        
        // Check if already signed in - if so, sign out first to avoid conflicts
        if (empAuth.currentUser) {
          console.log('[EmployeeLogin] ⚠️ Already signed in, signing out first:', empAuth.currentUser.uid);
          try {
            await signOut(empAuth);
            // Wait a bit for sign out to complete
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (signOutError) {
            console.warn('[EmployeeLogin] Sign out failed (non-fatal):', signOutError);
          }
        }
        
        console.log('[EmployeeLogin] 🔑 Signing in with custom token...', { 
          tokenLength: customToken.length,
          tokenPrefix: customToken.substring(0, 20) + '...',
          authAppName: empAuth.app?.name,
          authAppId: empAuth.app?.options?.appId
        });
        
        // Double-check auth and token right before the call
        if (!empAuth || !customToken) {
          console.error('[EmployeeLogin] ❌ CRITICAL: Auth or token became invalid right before signIn!', {
            hasAuth: !!empAuth,
            hasToken: !!customToken
          });
          setError('Login failed: Authentication error. Please try again.');
          setLoading(false);
          return;
        }
        
        await signInWithCustomToken(empAuth, customToken);
        
        // Verify auth was set
        if (!empAuth.currentUser) {
          console.error('[EmployeeLogin] ❌ Auth not set after signInWithCustomToken');
          signingInRef.current = false;
          setError('Login failed: Authentication not set. Please try again.');
          setLoading(false);
          return;
        }
        console.log('[EmployeeLogin] ✅ Signed in successfully:', empAuth.currentUser.uid);
        signingInRef.current = false;
      } catch (signInError) {
        signingInRef.current = false;
        console.error('[EmployeeLogin] ❌ signInWithCustomToken failed:', signInError);
        console.error('[EmployeeLogin] SignIn error details:', {
          code: signInError?.code,
          message: signInError?.message,
          name: signInError?.name,
          stack: signInError?.stack
        });
        
        // Provide more specific error messages
        if (signInError?.code === 'auth/argument-error') {
          console.error('[EmployeeLogin] ❌ auth/argument-error - This means invalid auth instance or token!', {
            hasAuth: !!empAuth,
            authType: typeof empAuth,
            hasToken: !!customToken,
            tokenType: typeof customToken,
            tokenLength: customToken?.length
          });
          setError('Login failed: Authentication configuration error. Please restart the app.');
        } else {
          setError(signInError?.message || 'Login failed: Authentication error. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Store session IMMEDIATELY and ensure it's committed
      // CRITICAL: Ensure all IDs are strings, not objects
      setEmployeeSession({
        employeeId: String(employeeData.id || '').trim(),
        retailerId: String(employeeData.retailerId || '').trim(), // Always use from response, never from URL
        name: employeeData.name || '',
        role: employeeData.role || 'Employee',
        flypEmployeeId: String(employeeData.flypEmployeeId || employeeData.id || '').trim(), // Include flypEmployeeId
        accessSections: employeeData.accessSections || {}
      });

      // Set redirect flag
      setEmployeeRedirect();

      // CRITICAL: Force localStorage to flush synchronously (especially important in production)
      // This ensures the session is committed before page reload
      try {
        // Trigger a dummy localStorage write to force flush
        localStorage.setItem('__flyp_commit_check', Date.now().toString());
        localStorage.removeItem('__flyp_commit_check');
        // Also verify the session was stored
        const verifySession = localStorage.getItem('employeeSession');
        if (!verifySession) {
          console.warn('[Login] Session storage verification failed, retrying...');
          // Retry storing session
          // CRITICAL: Ensure all IDs are strings, not objects
          setEmployeeSession({
            employeeId: String(employeeData.id || '').trim(),
            retailerId: String(employeeData.retailerId || '').trim(), // Always use from response
            name: employeeData.name || '',
            role: employeeData.role || 'Employee',
            flypEmployeeId: String(employeeData.flypEmployeeId || employeeData.id || '').trim(), // Include flypEmployeeId
            accessSections: employeeData.accessSections || {}
          });
        }
      } catch (e) {
        console.error('[Login] Failed to verify localStorage commit:', e);
      }

      toast.success('Login successful! Redirecting...');

      // CRITICAL: Pass session in navigation state so Android WebView doesn't rely on
      // localStorage timing. EmployeeRoute and EmployeeDashboard will use this.
      const sessionPayload = {
        retailerId: employeeData.retailerId,
        employeeId: employeeData.id,
        name: employeeData.name,
        role: employeeData.role,
        flypEmployeeId: employeeData.flypEmployeeId || employeeData.id,
        accessSections: employeeData.accessSections || {}
      };

      const isCapacitor = typeof window !== 'undefined' && window.Capacitor;
      const isProduction = window.location.hostname !== 'localhost';

      if (isCapacitor) {
        // Set in-memory pending session so route/dashboard see it even if state or localStorage lags
        setPendingEmployeeSession(sessionPayload);
        setTimeout(() => {
          navigate('/employee-dashboard', {
            replace: true,
            state: { fromLogin: true, session: sessionPayload }
          });
        }, 400);
      } else {
        const redirectDelay = isProduction ? 1000 : 500;
        setTimeout(() => {
          window.location.href = '/employee-dashboard';
        }, redirectDelay);
      }

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
            <h1 className="text-2xl font-bold text-white mb-2">Retailer Employee Login</h1>
            <p className="text-white/70 text-sm">Enter your credentials to access the system</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
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
                placeholder="FLYP-RETAIL-XXXXXX"
                required
                autoComplete="off"
              />
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

export default EmployeeLogin;