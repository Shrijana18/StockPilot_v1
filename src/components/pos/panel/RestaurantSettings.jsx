import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from "firebase/auth";
import { db, auth, storage } from "../../../firebase/firebaseConfig";
import { usePOSTheme } from "../POSThemeContext";
import { invalidateBizCache } from "../POSBusinessContext";

const getUid = () => auth.currentUser?.uid;

const TABS = [
  { key: "business",  icon: "�", label: "Business Info" },
  { key: "invoice",   icon: "📊", label: "Invoice & Legal" },
  { key: "pos",       icon: "⚙️", label: "POS Settings" },
  { key: "receipt",   icon: "🧾", label: "Receipt" },
  { key: "hours",     icon: "🕐", label: "Hours" },
  { key: "account",   icon: "🔐", label: "Account" },
];

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const DEFAULT_SETTINGS = {
  business: { name: "", tagline: "", address: "", city: "", phone: "", email: "", gstNumber: "", fssaiNumber: "", panNumber: "", logoUrl: "" },
  invoice: { prefix: "INV", startNumber: "1", showGstOnInvoice: true, showFssaiOnInvoice: true, showPanOnInvoice: false, termsLine1: "Thank you for your business.", termsLine2: "All disputes subject to local jurisdiction.", dueDays: "0" },
  pos: { defaultTaxPct: "5", enableServiceCharge: false, serviceChargeLabel: "Service Charge", serviceChargePct: "10", currency: "₹", roundOffTotal: true },
  receipt: { headerLine1: "", headerLine2: "", footerLine1: "Thank you for dining with us!", footerLine2: "Visit again soon!", showGst: true, showItemWiseTax: false },
  hours: DAYS.reduce((a, d) => ({ ...a, [d]: { open: true, from: "09:00", to: "22:00" } }), {}),
};

export default function RestaurantSettings() {
  const { tc } = usePOSTheme();
  const [activeTab, setActiveTab] = React.useState("business");
  const [settings, setSettings]   = React.useState(DEFAULT_SETTINGS);
  const [loading, setLoading]     = React.useState(true);
  const [saving, setSaving]       = React.useState(false);
  const [saved, setSaved]         = React.useState(false);
  const [toast, setToast]         = React.useState(null);
  const [logoUploading, setLogoUploading] = React.useState(false);
  const logoInputRef = React.useRef(null);

  const [pwCurrent, setPwCurrent]     = React.useState("");
  const [pwNew,     setPwNew]         = React.useState("");
  const [pwConfirm, setPwConfirm]     = React.useState("");
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew,     setShowNew]     = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [pwChanging,  setPwChanging]  = React.useState(false);
  const [pwStatus,    setPwStatus]    = React.useState(null);

  const [showForgotPw,    setShowForgotPw]    = React.useState(false);
  const [forgotPwPhone,   setForgotPwPhone]   = React.useState("");
  const [forgotPwLoading, setForgotPwLoading] = React.useState(false);
  const [forgotPwStatus,  setForgotPwStatus]  = React.useState(null);

  const handleForgotPassword = async () => {
    setForgotPwStatus(null);
    const phone = forgotPwPhone.replace(/\D/g, "");
    if (phone.length < 10) { setForgotPwStatus({ ok: false, msg: "Enter a valid 10-digit phone number." }); return; }
    const uid = getUid();
    const user = auth.currentUser;
    if (!uid || !user?.email) { setForgotPwStatus({ ok: false, msg: "Not signed in." }); return; }
    setForgotPwLoading(true);
    try {
      const snap = await getDoc(doc(db, "businesses", uid, "posConfig", "restaurantSettings"));
      const stored = (snap.data()?.business?.phone || "").replace(/\D/g, "");
      if (!stored || stored.slice(-10) !== phone.slice(-10)) {
        setForgotPwStatus({ ok: false, msg: "Phone number does not match our records." });
        return;
      }
      await sendPasswordResetEmail(auth, user.email);
      setForgotPwStatus({ ok: true, msg: `Reset link sent to ${user.email}` });
      setForgotPwPhone("");
    } catch (err) {
      setForgotPwStatus({ ok: false, msg: err.message || "Failed to send reset email." });
    } finally {
      setForgotPwLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwStatus(null);
    if (!pwCurrent) { setPwStatus({ ok: false, msg: "Enter your current password." }); return; }
    if (pwNew.length < 6) { setPwStatus({ ok: false, msg: "New password must be at least 6 characters." }); return; }
    if (pwNew !== pwConfirm) { setPwStatus({ ok: false, msg: "New passwords do not match." }); return; }
    const user = auth.currentUser;
    if (!user?.email) { setPwStatus({ ok: false, msg: "No email account found." }); return; }
    setPwChanging(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, pwCurrent);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, pwNew);
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      setShowCurrent(false); setShowNew(false); setShowConfirm(false);
      setPwStatus({ ok: true, msg: "Password updated successfully!" });
    } catch (err) {
      const code = err?.code || "";
      const msg = code === "auth/wrong-password" || code === "auth/invalid-credential"
        ? "Current password is incorrect."
        : code === "auth/too-many-requests"
          ? "Too many attempts. Try again later."
          : "Update failed: " + (err.message || code);
      setPwStatus({ ok: false, msg });
    } finally {
      setPwChanging(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uid = getUid();
    if (!uid) return;
    setLogoUploading(true);
    try {
      const compressed = await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const MAX = 320;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width  = Math.round(img.width  * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          canvas.toBlob(b => b ? resolve(b) : reject(new Error("Compression failed")), "image/png", 0.92);
        };
        img.onerror = reject;
        img.src = url;
      });
      const storageRef = ref(storage, `businesses/${uid}/pos_logo`);
      await uploadBytes(storageRef, compressed, { contentType: "image/png" });
      const logoUrl = await getDownloadURL(storageRef);
      setField("business", "logoUrl", logoUrl);
      await setDoc(doc(db, "businesses", uid, "posConfig", "restaurantSettings"), { business: { logoUrl } }, { merge: true });
      invalidateBizCache(uid);
      showMsg("Logo uploaded!");
    } catch (err) {
      console.error("Logo upload failed:", err);
      showMsg("Upload failed: " + (err.message || err.code), "error");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleLogoRemove = async () => {
    const uid = getUid();
    if (!uid) return;
    try {
      await deleteObject(ref(storage, `businesses/${uid}/pos_logo`)).catch(() => {});
      setField("business", "logoUrl", "");
      await setDoc(doc(db, "businesses", uid, "posConfig", "restaurantSettings"), { business: { logoUrl: "" } }, { merge: true });
      invalidateBizCache(uid);
      showMsg("Logo removed");
    } catch (err) {
      showMsg("Remove failed", "error");
    }
  };

  const showMsg = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  React.useEffect(() => {
    const uid = getUid();
    if (!uid) { setLoading(false); return; }
    getDoc(doc(db, "businesses", uid, "posConfig", "restaurantSettings")).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings(prev => ({
          business: { ...prev.business, ...data.business },
          invoice:  { ...prev.invoice,  ...data.invoice },
          pos:      { ...prev.pos,      ...data.pos },
          receipt:  { ...prev.receipt,  ...data.receipt },
          hours:    { ...prev.hours,    ...data.hours },
        }));
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const setField = (section, key, value) => {
    setSettings(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
    setSaved(false);
  };

  const setHoursField = (day, key, value) => {
    setSettings(prev => ({ ...prev, hours: { ...prev.hours, [day]: { ...prev.hours[day], [key]: value } } }));
    setSaved(false);
  };

  const handleSave = async () => {
    const uid = getUid();
    if (!uid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "businesses", uid, "posConfig", "restaurantSettings"), { ...settings, updatedAt: Date.now() }, { merge: true });
      setSaved(true);
      showMsg("Settings saved successfully");
    } catch (e) {
      console.error(e);
      showMsg("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const S = settings;

  const inputCls = `w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${tc.inputBg}`;
  const labelCls = `text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${tc.textMuted}`;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center" style={tc.bg}>
      <div className="w-8 h-8 border-2 border-emerald-500/40 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="relative flex flex-col h-full overflow-hidden" style={tc.bg}>
      {/* Aurora */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-16 w-[55%] h-[55%] rounded-full blur-[100px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob1} 0%, transparent 65%)` }} />
        <div className="absolute -bottom-32 -left-16 w-[50%] h-[50%] rounded-full blur-[100px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob2} 0%, transparent 65%)` }} />
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999999] px-5 py-2.5 rounded-xl text-sm font-semibold shadow-xl backdrop-blur-lg ${toast.type === "error" ? "bg-red-500/90 text-white" : "bg-emerald-500/90 text-white"}`}
          >{toast.msg}</motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className={`sticky top-0 z-20 flex-none ${tc.headerBg}`}>
        <div className="px-5 py-3 flex items-center gap-3">
          <div className="flex-1">
            <div className={`text-sm font-bold ${tc.textPrimary}`}>Store Settings</div>
            <div className={`text-[11px] mt-0.5 ${tc.textMuted}`}>Restaurant POS configuration</div>
          </div>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-60 ${saved ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30" : tc.primaryBtn}`}
          >
            {saving ? "⏳ Saving…" : saved ? "✓ Saved" : "💾 Save Settings"}
          </motion.button>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 px-4 pb-2 border-t ${tc.borderSoft}`} style={{ paddingTop: 8 }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.key ? "bg-white/15 text-white shadow-sm" : `${tc.textMuted} hover:bg-white/[0.06]`}`}
            >
              <span>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>

            {/* ── Business Info ── */}
            {activeTab === "business" && (
              <div className="max-w-xl space-y-5">

                {/* Logo upload card */}
                <div className={`rounded-2xl border p-5 ${tc.cardBg} ${tc.borderSoft}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🖼️</span>
                    <div className={`text-sm font-bold ${tc.textPrimary}`}>Business Logo</div>
                    <span className={`text-[10px] ${tc.textMuted} ml-1`}>Shown in header, invoices, KOT & checkout</span>
                  </div>
                  <div className="flex items-center gap-5">
                    {/* Preview */}
                    <div
                      className={`w-20 h-20 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden flex-none transition-all ${
                        S.business.logoUrl ? `${tc.borderSoft} bg-transparent` : `border-white/20 ${tc.mutedBg}`
                      }`}
                    >
                      {S.business.logoUrl ? (
                        <img src={S.business.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                      ) : (
                        <span className="text-3xl opacity-30">🏪</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 flex-1">
                      <p className={`text-xs ${tc.textMuted} leading-relaxed`}>
                        Upload your restaurant logo (PNG, JPG). Max size 5 MB — auto-compressed and saved to cloud.
                      </p>
                      <div className="flex gap-2">
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        <motion.button
                          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          onClick={() => logoInputRef.current?.click()}
                          disabled={logoUploading}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50 ${tc.primaryBtn}`}
                        >
                          {logoUploading ? (
                            <><span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin inline-block" /> Uploading…</>
                          ) : (
                            <><span>📤</span> {S.business.logoUrl ? "Change Logo" : "Upload Logo"}</>
                          )}
                        </motion.button>
                        {S.business.logoUrl && (
                          <motion.button
                            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={handleLogoRemove}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition"
                          >🗑 Remove</motion.button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`rounded-2xl border p-5 ${tc.cardBg} ${tc.borderSoft}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🏪</span>
                    <div className={`text-sm font-bold ${tc.textPrimary}`}>Business Details</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={labelCls}>Restaurant / Café Name *</label>
                      <input value={S.business.name} onChange={e => setField("business","name",e.target.value)} placeholder="e.g. The Grand Café" className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Tagline</label>
                      <input value={S.business.tagline} onChange={e => setField("business","tagline",e.target.value)} placeholder="e.g. Good food, great vibes" className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Address</label>
                      <input value={S.business.address} onChange={e => setField("business","address",e.target.value)} placeholder="Street, Area" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>City</label>
                      <input value={S.business.city} onChange={e => setField("business","city",e.target.value)} placeholder="Mumbai" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input value={S.business.phone} onChange={e => setField("business","phone",e.target.value)} placeholder="+91 98765 43210" type="tel" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Email</label>
                      <input value={S.business.email} onChange={e => setField("business","email",e.target.value)} placeholder="hello@café.com" type="email" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>GSTIN</label>
                      <input value={S.business.gstNumber} onChange={e => setField("business","gstNumber",e.target.value)} placeholder="22AAAAA0000A1Z5" className={`${inputCls} font-mono tracking-wide`} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>FSSAI License Number</label>
                      <input value={S.business.fssaiNumber} onChange={e => setField("business","fssaiNumber",e.target.value)} placeholder="10012345000123" className={`${inputCls} font-mono`} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── POS Settings ── */}
            {activeTab === "pos" && (
              <div className="max-w-xl space-y-4">
                <div className={`rounded-2xl border p-5 space-y-4 ${tc.cardBg} ${tc.borderSoft}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">💰</span>
                    <div className={`text-sm font-bold ${tc.textPrimary}`}>Tax & Charges</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Default GST %</label>
                      <div className="relative">
                        <input value={S.pos.defaultTaxPct} onChange={e => setField("pos","defaultTaxPct",e.target.value)}
                          type="number" min="0" max="28" placeholder="5" className={`${inputCls} pr-8`} />
                        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${tc.textMuted}`}>%</span>
                      </div>
                      <div className="flex gap-1 mt-2">
                        {["0","5","12","18","28"].map(v => (
                          <button key={v} onClick={() => setField("pos","defaultTaxPct",v)}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition ${S.pos.defaultTaxPct === v ? "bg-emerald-500 text-white" : `${tc.mutedBg} ${tc.textMuted} hover:bg-white/10`}`}
                          >{v}%</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Currency Symbol</label>
                      <input value={S.pos.currency} onChange={e => setField("pos","currency",e.target.value)}
                        placeholder="₹" className={`${inputCls} text-lg font-bold`} />
                    </div>
                  </div>

                  {/* Service Charge */}
                  <div className={`rounded-xl border p-3 space-y-3 ${tc.borderSoft} ${tc.mutedBg}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-xs font-semibold ${tc.textSub}`}>Service Charge</div>
                        <div className={`text-[10px] ${tc.textMuted}`}>Auto-add to every bill</div>
                      </div>
                      <button onClick={() => setField("pos","enableServiceCharge",!S.pos.enableServiceCharge)}
                        className={`w-11 h-6 rounded-full relative transition-all ${S.pos.enableServiceCharge ? "bg-emerald-500" : "bg-white/15"}`}
                      >
                        <motion.div animate={{ x: S.pos.enableServiceCharge ? 23 : 2 }} transition={{ type: "spring", stiffness: 600, damping: 30 }}
                          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>
                    {S.pos.enableServiceCharge && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Label</label>
                          <input value={S.pos.serviceChargeLabel} onChange={e => setField("pos","serviceChargeLabel",e.target.value)}
                            placeholder="Service Charge" className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Percentage</label>
                          <div className="relative">
                            <input value={S.pos.serviceChargePct} onChange={e => setField("pos","serviceChargePct",e.target.value)}
                              type="number" min="0" max="30" className={`${inputCls} pr-8`} />
                            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${tc.textMuted}`}>%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Round off */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-xs font-semibold ${tc.textSub}`}>Round Off Total</div>
                      <div className={`text-[10px] ${tc.textMuted}`}>Round grand total to nearest ₹</div>
                    </div>
                    <button onClick={() => setField("pos","roundOffTotal",!S.pos.roundOffTotal)}
                      className={`w-11 h-6 rounded-full relative transition-all ${S.pos.roundOffTotal ? "bg-emerald-500" : "bg-white/15"}`}
                    >
                      <motion.div animate={{ x: S.pos.roundOffTotal ? 23 : 2 }} transition={{ type: "spring", stiffness: 600, damping: 30 }}
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Receipt ── */}
            {activeTab === "receipt" && (
              <div className="max-w-xl space-y-4">
                <div className={`rounded-2xl border p-5 space-y-4 ${tc.cardBg} ${tc.borderSoft}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🧾</span>
                    <div className={`text-sm font-bold ${tc.textPrimary}`}>Receipt Customization</div>
                  </div>
                  <div>
                    <label className={labelCls}>Header Line 1</label>
                    <input value={S.receipt.headerLine1} onChange={e => setField("receipt","headerLine1",e.target.value)}
                      placeholder="e.g. Welcome to The Grand Café" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Header Line 2</label>
                    <input value={S.receipt.headerLine2} onChange={e => setField("receipt","headerLine2",e.target.value)}
                      placeholder="e.g. Good Food · Great Vibes" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Footer Line 1</label>
                    <input value={S.receipt.footerLine1} onChange={e => setField("receipt","footerLine1",e.target.value)}
                      placeholder="Thank you for dining with us!" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Footer Line 2</label>
                    <input value={S.receipt.footerLine2} onChange={e => setField("receipt","footerLine2",e.target.value)}
                      placeholder="Visit again soon!" className={inputCls} />
                  </div>
                  <div className="space-y-3 pt-2">
                    {[
                      { key: "showGst",          label: "Show GST breakdown",     sub: "Display tax details on receipt" },
                      { key: "showItemWiseTax",   label: "Item-wise tax",          sub: "Show tax rate per item" },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between">
                        <div>
                          <div className={`text-xs font-semibold ${tc.textSub}`}>{item.label}</div>
                          <div className={`text-[10px] ${tc.textMuted}`}>{item.sub}</div>
                        </div>
                        <button onClick={() => setField("receipt", item.key, !S.receipt[item.key])}
                          className={`w-11 h-6 rounded-full relative transition-all ${S.receipt[item.key] ? "bg-emerald-500" : "bg-white/15"}`}
                        >
                          <motion.div animate={{ x: S.receipt[item.key] ? 23 : 2 }} transition={{ type: "spring", stiffness: 600, damping: 30 }}
                            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Invoice & Legal ── */}
            {activeTab === "invoice" && (
              <div className="max-w-xl space-y-5">
                {/* Invoice Numbering */}
                <div className={`rounded-2xl border p-5 ${tc.cardBg} ${tc.borderSoft}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">📝</span>
                    <div className={`text-sm font-bold ${tc.textPrimary}`}>Invoice Numbering</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Invoice Prefix</label>
                      <input value={S.invoice.prefix} onChange={e => setField("invoice","prefix",e.target.value)}
                        placeholder="INV" className={`${inputCls} font-mono uppercase tracking-widest`} />
                      <div className={`text-[10px] mt-1.5 ${tc.textMuted}`}>e.g. “REST” → REST-0001</div>
                    </div>
                    <div>
                      <label className={labelCls}>Start From Number</label>
                      <input value={S.invoice.startNumber} onChange={e => setField("invoice","startNumber",e.target.value)}
                        type="number" min="1" placeholder="1" className={`${inputCls} font-mono`} />
                    </div>
                  </div>
                </div>

                {/* Legal & Compliance */}
                <div className={`rounded-2xl border p-5 ${tc.cardBg} ${tc.borderSoft}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">⚖️</span>
                    <div className={`text-sm font-bold ${tc.textPrimary}`}>Legal & Compliance</div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={labelCls}>GSTIN (Tax Registration Number)</label>
                      <input value={S.business.gstNumber} onChange={e => setField("business","gstNumber",e.target.value)}
                        placeholder="22AAAAA0000A1Z5" className={`${inputCls} font-mono tracking-widest`} />
                    </div>
                    <div>
                      <label className={labelCls}>FSSAI License Number</label>
                      <input value={S.business.fssaiNumber} onChange={e => setField("business","fssaiNumber",e.target.value)}
                        placeholder="10012345000123" className={`${inputCls} font-mono`} />
                    </div>
                    <div>
                      <label className={labelCls}>PAN Number</label>
                      <input value={S.business.panNumber} onChange={e => setField("business","panNumber",e.target.value)}
                        placeholder="AAAAA0000A" className={`${inputCls} font-mono uppercase tracking-widest`} />
                    </div>
                  </div>
                  {/* Print toggles */}
                  <div className="space-y-3 mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${tc.textMuted}`}>Show on Invoice</div>
                    {[
                      { key: "showGstOnInvoice",   label: "GSTIN on invoice",         sub: "Print your GST number on every bill" },
                      { key: "showFssaiOnInvoice", label: "FSSAI number on invoice",   sub: "Print FSSAI license for food safety compliance" },
                      { key: "showPanOnInvoice",   label: "PAN on invoice",            sub: "Print PAN number on invoice" },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between">
                        <div>
                          <div className={`text-xs font-semibold ${tc.textSub}`}>{item.label}</div>
                          <div className={`text-[10px] ${tc.textMuted}`}>{item.sub}</div>
                        </div>
                        <button onClick={() => setField("invoice", item.key, !S.invoice[item.key])}
                          className={`w-11 h-6 rounded-full relative transition-all ${S.invoice[item.key] ? "bg-emerald-500" : "bg-white/15"}`}
                        >
                          <motion.div animate={{ x: S.invoice[item.key] ? 23 : 2 }} transition={{ type: "spring", stiffness: 600, damping: 30 }}
                            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Terms & Conditions */}
                <div className={`rounded-2xl border p-5 ${tc.cardBg} ${tc.borderSoft}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">📜</span>
                    <div className={`text-sm font-bold ${tc.textPrimary}`}>Terms & Conditions</div>
                    <div className={`text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold`}>Printed on invoice</div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={labelCls}>Terms Line 1</label>
                      <input value={S.invoice.termsLine1} onChange={e => setField("invoice","termsLine1",e.target.value)}
                        placeholder="Thank you for your business." className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Terms Line 2</label>
                      <input value={S.invoice.termsLine2} onChange={e => setField("invoice","termsLine2",e.target.value)}
                        placeholder="All disputes subject to local jurisdiction." className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Hours ── */}
            {activeTab === "hours" && (
              <div className="max-w-lg space-y-3">
                <div className={`rounded-2xl border p-5 ${tc.cardBg} ${tc.borderSoft}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🕐</span>
                    <div className={`text-sm font-bold ${tc.textPrimary}`}>Opening Hours</div>
                  </div>
                  <div className="space-y-2.5">
                    {DAYS.map(day => {
                      const h = S.hours[day] || { open: true, from: "09:00", to: "22:00" };
                      return (
                        <div key={day} className={`flex items-center gap-3 py-2.5 px-3 rounded-xl ${tc.mutedBg} border ${tc.borderSoft}`}>
                          <button onClick={() => setHoursField(day, "open", !h.open)}
                            className={`w-10 h-5 rounded-full relative transition-all flex-none ${h.open ? "bg-emerald-500" : "bg-white/15"}`}
                          >
                            <motion.div animate={{ x: h.open ? 19 : 2 }} transition={{ type: "spring", stiffness: 600, damping: 30 }}
                              className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm" />
                          </button>
                          <div className={`text-xs font-semibold w-24 flex-none ${h.open ? tc.textSub : tc.textMuted}`}>{day}</div>
                          {h.open ? (
                            <>
                              <input type="time" value={h.from} onChange={e => setHoursField(day, "from", e.target.value)}
                                className={`flex-1 px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/40 ${tc.inputBg}`} />
                              <span className={`text-xs ${tc.textMuted}`}>to</span>
                              <input type="time" value={h.to} onChange={e => setHoursField(day, "to", e.target.value)}
                                className={`flex-1 px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/40 ${tc.inputBg}`} />
                            </>
                          ) : (
                            <span className={`text-xs ${tc.textMuted}`}>Closed</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Account / Security ── */}
            {activeTab === "account" && (
              <div className="max-w-md space-y-5">

                {/* Account info card */}
                <div className={`rounded-2xl border p-5 ${tc.cardBg} ${tc.borderSoft}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">👤</span>
                    <div className={`text-sm font-bold ${tc.textPrimary}`}>Signed-in Account</div>
                  </div>
                  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${tc.mutedBg} border ${tc.borderSoft}`}>
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-black flex-none">
                      {auth.currentUser?.email?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div className="min-w-0">
                      <div className={`text-xs font-bold truncate ${tc.textPrimary}`}>{auth.currentUser?.email || "—"}</div>
                      <div className={`text-[10px] ${tc.textMuted}`}>Email / Password account</div>
                    </div>
                  </div>
                </div>

                {/* Change password card */}
                <div className={`rounded-2xl border p-5 ${tc.cardBg} ${tc.borderSoft}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🔑</span>
                    <div className={`text-sm font-bold ${tc.textPrimary}`}>Change Password</div>
                  </div>

                  <div className="space-y-3">

                    {/* ── Current Password ── */}
                    <div>
                      <label className={labelCls}>Current Password</label>
                      <div className="relative">
                        <input
                          type={showCurrent ? "text" : "password"}
                          value={pwCurrent}
                          onChange={e => { setPwCurrent(e.target.value); setPwStatus(null); }}
                          placeholder="Enter current password"
                          className={`${inputCls} pr-10`}
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowCurrent(p => !p)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm transition-opacity ${tc.textMuted} hover:opacity-100 opacity-60`}
                          tabIndex={-1}
                        >{showCurrent ? "🙈" : "👁️"}</button>
                      </div>
                      {/* Forgot current password */}
                      <button
                        type="button"
                        onClick={() => { setShowForgotPw(p => !p); setForgotPwStatus(null); setForgotPwPhone(""); }}
                        className={`mt-1.5 text-[10px] font-semibold transition-opacity hover:opacity-100 opacity-60 ${tc.textMuted}`}
                      >
                        {showForgotPw ? "↑ Cancel" : "Forgot current password?"}
                      </button>
                    </div>

                    {/* ── Forgot-password inline panel ── */}
                    <AnimatePresence>
                      {showForgotPw && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className={`rounded-xl border p-3.5 space-y-3 ${tc.mutedBg} ${tc.borderSoft}`}>
                            <div className={`text-[11px] font-semibold ${tc.textSub}`}>
                              🔒 Verify your identity to receive a password reset link
                            </div>
                            <div>
                              <label className={labelCls}>Registered Phone Number</label>
                              <input
                                type="tel"
                                value={forgotPwPhone}
                                onChange={e => { setForgotPwPhone(e.target.value); setForgotPwStatus(null); }}
                                placeholder="+91 98765 43210"
                                className={inputCls}
                              />
                            </div>
                            <AnimatePresence>
                              {forgotPwStatus && (
                                <motion.div
                                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                  className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs font-semibold border ${
                                    forgotPwStatus.ok
                                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                                      : "bg-red-500/10 text-red-400 border-red-500/25"
                                  }`}
                                >
                                  <span>{forgotPwStatus.ok ? "✓" : "⚠"}</span>
                                  {forgotPwStatus.msg}
                                </motion.div>
                              )}
                            </AnimatePresence>
                            <motion.button
                              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                              onClick={handleForgotPassword}
                              disabled={forgotPwLoading || forgotPwPhone.replace(/\D/g,"").length < 10}
                              className={`w-full py-2 rounded-xl text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed ${tc.primaryBtn}`}
                            >
                              {forgotPwLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                                  Verifying…
                                </span>
                              ) : "📧 Send Reset Link"}
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* ── New Password ── */}
                    <div>
                      <label className={labelCls}>New Password</label>
                      <div className="relative">
                        <input
                          type={showNew ? "text" : "password"}
                          value={pwNew}
                          onChange={e => { setPwNew(e.target.value); setPwStatus(null); }}
                          placeholder="Min 6 characters"
                          className={`${inputCls} pr-10`}
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowNew(p => !p)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm transition-opacity ${tc.textMuted} hover:opacity-100 opacity-60`}
                          tabIndex={-1}
                        >{showNew ? "🙈" : "👁️"}</button>
                      </div>
                    </div>

                    {/* ── Confirm New Password ── */}
                    <div>
                      <label className={labelCls}>Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showConfirm ? "text" : "password"}
                          value={pwConfirm}
                          onChange={e => { setPwConfirm(e.target.value); setPwStatus(null); }}
                          placeholder="Min 6 characters"
                          className={`${inputCls} pr-10`}
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowConfirm(p => !p)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm transition-opacity ${tc.textMuted} hover:opacity-100 opacity-60`}
                          tabIndex={-1}
                        >{showConfirm ? "🙈" : "👁️"}</button>
                      </div>
                    </div>

                    {/* Status message */}
                    <AnimatePresence>
                      {pwStatus && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border ${
                            pwStatus.ok
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                              : "bg-red-500/10 text-red-400 border-red-500/25"
                          }`}
                        >
                          <span className="mt-px">{pwStatus.ok ? "✓" : "⚠"}</span>
                          {pwStatus.msg}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Submit */}
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={handlePasswordChange}
                      disabled={pwChanging || !pwCurrent || !pwNew || !pwConfirm}
                      className={`w-full py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed ${tc.primaryBtn}`}
                    >
                      {pwChanging ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                          Updating…
                        </span>
                      ) : "🔐 Update Password"}
                    </motion.button>

                    <p className={`text-[10px] text-center ${tc.textMuted} leading-relaxed`}>
                      You will remain signed in after changing your password.
                    </p>
                  </div>
                </div>

              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
