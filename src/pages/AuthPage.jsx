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
        const docRef = doc(db, "businesses", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          // Check for both 'role' and 'businessType' fields (some users have businessType)
          const rawRole = userData.role || userData.businessType || '';
          const normalized = rawRole.toString().toLowerCase().replace(/\s+/g, '');

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
          console.warn("No user profile found in Firestore.");
          navigate("/");
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        navigate("/");
      } finally {
        setIsLoadingUser(false);
      }
    };

    if (type === "login") {
      checkUserRoleAndRedirect();
    } else {
      setIsLoadingUser(false);
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
          const normalized = rawRole.toString().toLowerCase().replace(/\s+/g, '');
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
          if (!location.pathname.includes("/")) navigate("/", { replace: true });
        }
      } catch (e) {
        console.error("Error resolving role for register guard:", e);
        if (!location.pathname.includes("/")) navigate("/", { replace: true });
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      <>
        {type === "register" && !selectedRole && (
          <div className="relative w-full min-h-screen text-white">
            {/* Page background (single source of truth) */}
            <div className="absolute inset-0 -z-10">
              {/* base color */}
              <div className="absolute inset-0 bg-[#0b1220]" />
              {/* radial washes */}
              <div className="absolute inset-0 [background:radial-gradient(60%_50%_at_15%_10%,rgba(56,189,248,0.12),transparent_60%)]" />
              <div className="absolute inset-0 [background:radial-gradient(60%_50%_at_85%_90%,rgba(217,70,239,0.10),transparent_60%)]" />
              {/* vignette */}
              <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] bg-black/30 pointer-events-none" />
              {/* subtle noise (percent-encoded to avoid JSX issues) */}
              <div className="absolute inset-0 opacity-[0.05] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22160%22%20height=%22160%22%20viewBox=%220%200%20160%20160%22%3E%3Cfilter%20id=%22n%22%3E%3CfeTurbulence%20type=%22fractalNoise%22%20baseFrequency=%220.8%22%20numOctaves=%222%22/%3E%3C/filter%3E%3Crect%20width=%22160%22%20height=%22160%22%20filter=%22url(%23n)%22%20opacity=%220.6%22/%3E%3C/svg%3E')]" />
            </div>

            <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-10 px-6 py-16 lg:py-20 relative">
              {/* LEFT: Informational intro (non-card) */}
              <div className="hidden lg:block">
                <div className="max-w-xl pr-4">
                  <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md bg-white/5 text-[11px] tracking-widest uppercase text-cyan-200/90">
                    FLYP • Choose your role
                  </div>
                  <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white leading-tight">
                    Built for Retailers, Distributors, and Product Owners.
                  </h2>
                  <p className="mt-2 text-slate-300/95 text-sm leading-relaxed">
                    Pick the role that best describes your business. You’ll get tailored dashboards, permissions, and workflows — no extra clutter.
                  </p>

                  <div className="mt-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400" />
                      <div>
                        <div className="text-sm font-semibold text-white">Role‑based views</div>
                        <div className="text-xs text-slate-300">We only show what matters to your job to keep things fast.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400" />
                      <div>
                        <div className="text-sm font-semibold text-white">Instant onboarding</div>
                        <div className="text-xs text-slate-300">AI/OCR tooling to bring your catalog and billing live in minutes.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400" />
                      <div>
                        <div className="text-sm font-semibold text-white">Connected workflows</div>
                        <div className="text-xs text-slate-300">Retailer ↔ Distributor ordering, dispatch, and credit cycles.</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 h-px w-full bg-white/10" />
                  <div className="mt-4 grid grid-cols-3 gap-4 text-xs text-slate-300">
                    <div>
                      <div className="font-semibold text-white">Billing</div>
                      <div>UPI/Cash/Card, credit cycles.</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">Inventory</div>
                      <div>OCR & AI onboarding.</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">Dispatch</div>
                      <div>Track requests to delivery.</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: Glassmorphic role picker */}
              <div className="flex items-center justify-center">
                <div className="w-full max-w-md relative">
                  {/* Glow behind card */}
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500/30 via-blue-500/30 to-fuchsia-500/30 blur-2xl" />
                  <div className="relative rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-bold mb-2 text-center">Select your role</h2>
                    <p className="text-sm text-slate-300 text-center mb-6">We’ll customize FLYP for your workflow.</p>

                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={() => handleRoleSelect("Retailer")}
                        aria-label="Select Retailer"
                        className="group w-full text-left rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl" aria-hidden>🛍️</span>
                          <div>
                            <div className="text-white font-semibold text-lg">Retailer</div>
                            <div className="text-sm text-slate-300">Sell to end customers with fast billing & inventory.</div>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRoleSelect("Distributor")}
                        aria-label="Select Distributor"
                        className="group w-full text-left rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl" aria-hidden>🚚</span>
                          <div>
                            <div className="text-white font-semibold text-lg">Distributor</div>
                            <div className="text-sm text-slate-300">Supply retailers, manage orders, dispatch & credit.</div>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRoleSelect("ProductOwner")}
                        aria-label="Select Product Owner"
                        className="group w-full text-left rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl" aria-hidden>🏭</span>
                          <div>
                            <div className="text-white font-semibold text-lg">Product Owner</div>
                            <div className="text-sm text-slate-300">Own the brand, track distributors & performance.</div>
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="flex justify-center mt-6">
                      <button
                        className="text-sm text-slate-300 hover:text-white hover:bg-white/10 px-4 py-2 rounded transition-all"
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
          <div className="animate-fadeInUp transition-all duration-500">
            <Register role={selectedRole} />
          </div>
        )}

        {type === "login" && <Login />}
      </>
    </div>
  );
};

export default AuthPage;