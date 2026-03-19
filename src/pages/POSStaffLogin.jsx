import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { empDB as db, empAuth as auth } from "../firebase/firebaseConfig";
import { motion, AnimatePresence } from "framer-motion";

const PIN_LENGTH = 6;

export default function POSStaffLogin() {
  const [searchParams] = useSearchParams();
  const bizId = searchParams.get("biz") || "";
  const navigate = useNavigate();

  const [staffId, setStaffId] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState("id"); // "id" | "pin"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyDot, setBusyDot] = useState(false);
  const pinRef = useRef(null);
  const idRef = useRef(null);

  useEffect(() => {
    if (!bizId) setError("Invalid login link — business code missing.");
    else { const s = sessionStorage.getItem("pos_staff_session"); if (s) { try { const d = JSON.parse(s); if (d?.bizId === bizId) navigate("/pos-staff/dashboard", { replace: true }); } catch (_) {} } }
  }, [bizId, navigate]);

  const handleIdSubmit = (e) => {
    e.preventDefault();
    const id = staffId.trim().toUpperCase();
    if (!id) { setError("Enter your Staff ID"); return; }
    setStaffId(id);
    setStep("pin");
    setError("");
    setTimeout(() => pinRef.current?.focus(), 80);
  };

  const handlePinInput = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    setError("");
    if (digits.length === PIN_LENGTH) verifyLogin(digits);
  };

  const verifyLogin = async (pinVal) => {
    if (!bizId) { setError("Invalid login link"); return; }
    setLoading(true); setError("");
    try {
      // Step 1: Read staff list — no auth required (public read for login verification)
      const staffRef = collection(db, "businesses", bizId, "pos-staff");
      const snap = await getDocs(staffRef);
      const match = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find(s => {
          const sid = (s.staffId || s.id.slice(0, 8).toUpperCase());
          return sid.toUpperCase() === staffId.toUpperCase() && s.pin === pinVal;
        });
      if (!match) { setError("Incorrect Staff ID or PIN. Try again."); setPin(""); setLoading(false); setBusyDot(true); setTimeout(() => setBusyDot(false), 600); return; }
      if (match.active === false) { setError("Your account is deactivated. Contact your manager."); setPin(""); setLoading(false); return; }

      // Step 2: Anonymous sign-in for dashboard Firestore access (optional — silently skipped if disabled)
      try { await signInAnonymously(auth); } catch (_) { /* anonymous auth may be disabled — dashboard uses sessionStorage */ }

      // Step 3: Persist session and navigate
      sessionStorage.setItem("pos_staff_session", JSON.stringify({ bizId, staffId: match.staffId || match.id.slice(0, 8).toUpperCase(), docId: match.id, name: match.name, role: match.role, accessLevel: match.accessLevel, pin: null }));
      navigate("/pos-staff/dashboard", { replace: true });
    } catch (e) { console.error(e); setError("Login failed. Please try again."); setPin(""); setLoading(false); }
  };

  const handlePinSubmit = (e) => { e.preventDefault(); if (pin.length >= 4) verifyLogin(pin); };

  const numPad = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  const tapPin = (k) => {
    if (k === "⌫") { setPin(p => p.slice(0, -1)); setError(""); return; }
    if (k === "") return;
    const next = (pin + k).slice(0, PIN_LENGTH);
    setPin(next);
    setError("");
    if (next.length === PIN_LENGTH) verifyLogin(next);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(160deg, #060c17 0%, #0b1f35 50%, #060c17 100%)" }}>
      {/* Aurora blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-20 w-[55%] h-[55%] rounded-full blur-[120px]" style={{ background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 65%)" }} />
        <div className="absolute -bottom-40 -left-20 w-[50%] h-[50%] rounded-full blur-[120px]" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 65%)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-4">
            <span className="text-2xl font-black text-white">F</span>
          </div>
          <div className="text-white/90 text-xl font-black tracking-tight">Staff Portal</div>
          <div className="text-white/40 text-xs mt-1">Restaurant POS · Secure Login</div>
        </div>

        <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
          <AnimatePresence mode="wait">
            {step === "id" ? (
              <motion.form key="id-step" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                onSubmit={handleIdSubmit} className="p-7 space-y-5"
              >
                <div>
                  <div className="text-white text-sm font-bold mb-0.5">Welcome back 👋</div>
                  <div className="text-white/40 text-xs">Enter your Staff ID to continue</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 block mb-2">Staff ID</label>
                  <input
                    ref={idRef}
                    autoFocus
                    value={staffId}
                    onChange={e => { setStaffId(e.target.value.toUpperCase()); setError(""); }}
                    placeholder="e.g. STF-AB123"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 uppercase tracking-widest"
                    disabled={loading}
                    spellCheck={false}
                    autoCapitalize="characters"
                  />
                </div>
                {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-xs font-semibold">{error}</motion.p>}
                <button type="submit" disabled={!staffId.trim() || loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                >Continue →</button>
              </motion.form>
            ) : (
              <motion.div key="pin-step" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-7">
                <button onClick={() => { setStep("id"); setPin(""); setError(""); }} className="text-white/40 hover:text-white/70 text-xs mb-5 flex items-center gap-1 transition">← Back</button>
                <div className="text-white text-sm font-bold mb-0.5">Enter PIN</div>
                <div className="text-white/40 text-xs mb-5">Logging in as <span className="text-white/70 font-semibold font-mono">{staffId}</span></div>

                {/* PIN dots */}
                <div className="flex justify-center gap-3 mb-5">
                  {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                    <motion.div key={i}
                      animate={{ scale: pin.length === i + 1 ? [1, 1.25, 1] : 1, backgroundColor: busyDot ? "#ef4444" : pin.length > i ? "#10b981" : "rgba(255,255,255,0.12)" }}
                      transition={{ duration: 0.18 }}
                      className="w-3.5 h-3.5 rounded-full"
                    />
                  ))}
                </div>

                {/* Number pad */}
                <div className="grid grid-cols-3 gap-2.5 mb-4">
                  {numPad.map((k, i) => (
                    <motion.button key={i} type="button"
                      whileTap={{ scale: k ? 0.9 : 1 }}
                      onClick={() => tapPin(k)}
                      disabled={loading || !k}
                      className={`h-14 rounded-2xl text-lg font-bold transition-all ${
                        k === "⌫"
                          ? "bg-white/[0.06] hover:bg-white/[0.12] text-red-400 border border-white/10"
                          : k ? "bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.08] active:bg-white/20"
                          : "invisible"
                      } disabled:opacity-40`}
                    >{k}</motion.button>
                  ))}
                </div>

                {/* Hidden input for keyboard users */}
                <input ref={pinRef} type="tel" inputMode="numeric" value={pin}
                  onChange={e => handlePinInput(e.target.value)} className="sr-only" />

                {loading && (
                  <div className="flex justify-center gap-1.5 mt-2">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-pulse" style={{ animationDelay: `${i * 0.18}s` }} />
                    ))}
                  </div>
                )}
                {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-xs font-semibold text-center mt-2">{error}</motion.p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center mt-6 text-white/20 text-[10px]">
          Powered by FLYP · Secure Staff Access
        </div>
      </motion.div>
    </div>
  );
}
