import React, { useContext, useEffect, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { AuthContext } from '/src/context/AuthContext';
import Register from "../components/Register";
import Login from "../components/Login";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

const AuthPage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type");

  const [selectedRole, setSelectedRole] = useState("");
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    if (!type) {
      navigate("/auth?type=login", { replace: true });
      return;
    }
  }, [type, navigate]);

  useEffect(() => {
    // If a post-signup role hint exists, skip auto-redirects to avoid racing the initial navigation
    const pending = (typeof window !== 'undefined' && sessionStorage.getItem('postSignupRole')) || null;
    if (pending) {
      setIsLoadingUser(false);
      return;
    }

    // For login type, let Login.jsx handle navigation after successful authentication
    // AuthPage should only handle post-signup redirects and register page guards
    if (type === "login") {
      setIsLoadingUser(false);
      return;
    }

    const checkUserRoleAndRedirect = async () => {
      if (!user) {
        setIsLoadingUser(false);
        return;
      }

      try {
        // Check if this is a distributor employee (has custom claims)
        if (user.customClaims?.isDistributorEmployee) {
          // Only redirect if not already on distributor employee pages
          if (!location.pathname.includes("/distributor-employee-dashboard") && 
              !location.pathname.includes("/distributor-employee-login")) {
            navigate("/distributor-employee-dashboard", { replace: true });
          }
          setIsLoadingUser(false);
          return;
        }

        // Check if this is a regular business user
        // Skip Firestore check if user is currently registering (prevents 400 errors during signup)
        const isRegistering = sessionStorage.getItem('postSignupRole') !== null;
        if (isRegistering) {
          setIsLoadingUser(false);
          return; // Let Register component handle the flow
        }
        
        const docRef = doc(db, "businesses", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          // Check for both 'role' and 'businessType' fields (some users have businessType)
          const rawRole = userData.role || userData.businessType || '';
          const normalized = rawRole.toString().toLowerCase().replace(/\s+/g, '').replace(/_/g, '');

          if (normalized === "retailer") {
            if (!location.pathname.includes("/dashboard")) navigate("/dashboard", { replace: true });
          } else if (normalized === "distributor") {
            if (!location.pathname.includes("/distributor-dashboard")) navigate("/distributor-dashboard", { replace: true });
          } else if (normalized === "productowner") {
            if (!location.pathname.includes("/product-owner-dashboard")) navigate("/product-owner-dashboard", { replace: true });
          } else {
            if (!location.pathname.includes("/")) navigate("/", { replace: true });
          }
        } else {
          // No profile found - only redirect if not currently registering
          const postSignupRole = sessionStorage.getItem('postSignupRole');
          if (postSignupRole) {
            setIsLoadingUser(false);
            return; // Don't redirect - let Register component finish
          }
          // Only navigate to landing page if not on auth/register page
          if (!location.pathname.includes('/auth')) {
            navigate("/");
          }
        }
      } catch (error) {
        // Don't log Firestore permission errors during registration
        const isRegistering = sessionStorage.getItem('postSignupRole') !== null;
        if (!isRegistering) {
          console.error("Error fetching user role:", error);
          if (!location.pathname.includes('/auth')) {
            navigate("/");
          }
        }
      } finally {
        setIsLoadingUser(false);
      }
    };

    // Only run checkUserRoleAndRedirect for non-login types (like register)
    if (type !== "login") {
      checkUserRoleAndRedirect();
    }
  }, [user, type]);

  useEffect(() => {
    const pending = (typeof window !== 'undefined' && sessionStorage.getItem('postSignupRole')) || null;
    if (pending) return; // let the first post-signup navigation proceed without interference

    // Block authenticated users from accessing the register page; redirect based on role
    if (!user || type !== "register") return;
    (async () => {
      try {
        const ref = doc(db, "businesses", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const userData = snap.data();
          // Check for both 'role' and 'businessType' fields (some users have businessType)
          const rawRole = userData.role || userData.businessType || '';
          const normalized = rawRole.toString().toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
          if (normalized === "retailer") {
            if (!location.pathname.includes("/dashboard")) navigate("/dashboard", { replace: true });
          } else if (normalized === "distributor") {
            if (!location.pathname.includes("/distributor-dashboard")) navigate("/distributor-dashboard", { replace: true });
          } else if (normalized === "productowner") {
            if (!location.pathname.includes("/product-owner-dashboard")) navigate("/product-owner-dashboard", { replace: true });
          } else {
            if (!location.pathname.includes("/")) navigate("/", { replace: true });
          }
        } else {
          // Check if user just registered - don't redirect, let Register component finish
          const postSignupRole = sessionStorage.getItem('postSignupRole');
          if (!postSignupRole && !location.pathname.includes("/")) {
            navigate("/", { replace: true });
          }
        }
      } catch (e) {
        console.error("Error resolving role for register guard:", e);
        // Don't redirect if user just registered - let Register component handle it
        const postSignupRole = sessionStorage.getItem('postSignupRole');
        if (!postSignupRole && !location.pathname.includes("/")) {
          navigate("/", { replace: true });
        }
      }
    })();
  }, [user, type, navigate, location.pathname]);

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <p className="text-white text-lg animate-pulse">Loading...</p>
      </div>
    );
  }

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center safe-top safe-bottom">
      <>
        {type === "register" && !selectedRole && (
          <div className="relative w-full min-h-screen text-white overflow-hidden">
            {/* Enhanced Page background */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e1a] via-[#0f1419] to-[#0a0e1a]" />
              <div className="absolute inset-0 [background:radial-gradient(ellipse_80%_50%_at_20%_20%,rgba(56,189,248,0.15),transparent_70%)]" />
              <div className="absolute inset-0 [background:radial-gradient(ellipse_80%_50%_at_80%_80%,rgba(217,70,239,0.12),transparent_70%)]" />
              <div className="absolute inset-0 [background:radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(16,185,129,0.08),transparent_80%)]" />
              <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_100%)] bg-black/20 pointer-events-none" />
              <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22160%22%20height=%22160%22%20viewBox=%220%200%20160%20160%22%3E%3Cfilter%20id=%22n%22%3E%3CfeTurbulence%20type=%22fractalNoise%22%20baseFrequency=%220.8%22%20numOctaves=%222%22/%3E%3C/filter%3E%3Crect%20width=%22160%22%20height=%22160%22%20filter=%22url(%23n)%22%20opacity=%220.6%22/%3E%3C/svg%3E')]" />
            </div>

            <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 px-4 sm:px-6 py-12 sm:py-16 lg:py-24 relative">
              {/* LEFT: Enhanced Informational Panel */}
              <div className="hidden lg:flex flex-col justify-center">
                <div className="max-w-xl space-y-6 animate-fadeIn">
                  <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30 text-[11px] tracking-widest uppercase text-cyan-300 font-medium backdrop-blur-sm">
                    <img 
                      src="/assets/flyp_logo.png" 
                      alt="FLYP" 
                      className="h-12 w-12 sm:h-14 sm:w-14 object-contain"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                    <span>Choose Your Role</span>
                  </div>
                  
                  <h1 className="text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
                    Built for <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-fuchsia-400 bg-clip-text text-transparent">Retailers</span>, <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 bg-clip-text text-transparent">Distributors</span>, and <span className="bg-gradient-to-r from-red-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">Product Owners</span>.
                  </h1>
                  
                  <p className="text-lg text-slate-300/90 leading-relaxed">
                    Pick the role that best describes your business. You'll get tailored dashboards, permissions, and workflows — no extra clutter.
                  </p>

                  <div className="mt-8 space-y-5">
                    {[
                      { title: "Role‑based views", desc: "We only show what matters to your job to keep things fast.", icon: "👁️" },
                      { title: "Instant onboarding", desc: "AI/OCR tooling to bring your catalog and billing live in minutes.", icon: "⚡" },
                      { title: "Connected workflows", desc: "Retailer ↔ Distributor ordering, dispatch, and credit cycles.", icon: "🔗" }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-4 group/item">
                        <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30 flex items-center justify-center text-lg backdrop-blur-sm group-hover/item:scale-110 transition-transform duration-300">
                          {item.icon}
                        </div>
                        <div className="flex-1">
                          <div className="text-base font-bold text-white mb-1">{item.title}</div>
                          <div className="text-sm text-slate-300/80 leading-relaxed">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-10 pt-8 border-t border-white/10">
                    <div className="grid grid-cols-3 gap-6">
                      {[
                        { label: "Billing", desc: "UPI/Cash/Card, credit cycles" },
                        { label: "Inventory", desc: "OCR & AI onboarding" },
                        { label: "Dispatch", desc: "Track requests to delivery" }
                      ].map((item, idx) => (
                        <div key={idx} className="text-center">
                          <div className="text-sm font-bold text-white mb-1.5">{item.label}</div>
                          <div className="text-xs text-slate-400 leading-relaxed">{item.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: Enhanced Role Selection Card */}
              <div className="flex items-center justify-center lg:justify-end">
                <div className="w-full max-w-lg relative">
                  {/* Animated glow effect */}
                  <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-cyan-500/40 via-blue-500/40 to-fuchsia-500/40 blur-3xl opacity-60 animate-pulse" />
                  <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 blur-2xl" />
                  
                  <div className="relative rounded-3xl border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-white/10 backdrop-blur-2xl p-8 sm:p-10 shadow-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                      <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
                        Select your role
                      </h2>
                      <p className="text-slate-300/80 text-sm">We'll customize FLYP for your workflow</p>
                    </div>

                    {/* Role Cards */}
                    <div className="space-y-4">
                      {[
                        { 
                          role: "Retailer", 
                          icon: "🛍️", 
                          desc: "Sell to end customers with fast billing & inventory",
                          gradient: "from-pink-500/20 to-rose-500/20",
                          borderGradient: "from-pink-400/50 to-rose-400/50",
                          hoverGlow: "group-hover:shadow-pink-500/20"
                        },
                        { 
                          role: "Distributor", 
                          icon: "🚚", 
                          desc: "Supply retailers, manage orders, dispatch & credit",
                          gradient: "from-orange-500/20 to-amber-500/20",
                          borderGradient: "from-orange-400/50 to-amber-400/50",
                          hoverGlow: "group-hover:shadow-orange-500/20"
                        },
                        { 
                          role: "ProductOwner", 
                          icon: "🏭", 
                          desc: "Own the brand, track distributors & performance",
                          gradient: "from-red-500/20 to-pink-500/20",
                          borderGradient: "from-red-400/50 to-pink-400/50",
                          hoverGlow: "group-hover:shadow-red-500/20"
                        }
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleRoleSelect(item.role)}
                          aria-label={`Select ${item.role}`}
                          className={`group w-full text-left rounded-2xl border-2 border-white/10 bg-gradient-to-br ${item.gradient} p-6 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-white/30 hover:shadow-2xl ${item.hoverGlow} focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:ring-offset-2 focus:ring-offset-transparent backdrop-blur-sm`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`text-3xl transform group-hover:scale-110 transition-transform duration-300`}>
                              {item.icon}
                            </div>
                            <div className="flex-1">
                              <div className="text-xl font-bold text-white mb-1.5">{item.role === "ProductOwner" ? "Product Owner" : item.role}</div>
                              <div className="text-sm text-slate-300/90 leading-relaxed">{item.desc}</div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Cancel Button */}
                    <div className="flex justify-center mt-8 pt-6 border-t border-white/10">
                      <button
                        className="text-sm text-slate-400 hover:text-white hover:bg-white/10 px-5 py-2.5 rounded-xl transition-all duration-200 font-medium"
                        onClick={() => navigate("/")}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {type === "register" && selectedRole && (
          <div className="animate-slideInFromRight">
            <Register role={selectedRole} />
          </div>
        )}

        {type === "login" && <Login />}
      </>
    </div>
  );
};

export default AuthPage;