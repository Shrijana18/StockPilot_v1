import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../../../firebase/firebaseConfig";
import { usePOSTheme } from "../POSThemeContext";

const getUid = () => auth.currentUser?.uid;

const TABS = [
  { key: "business",  icon: "�", label: "Business Info" },
  { key: "invoice",   icon: "📊", label: "Invoice & Legal" },
  { key: "pos",       icon: "⚙️", label: "POS Settings" },
  { key: "receipt",   icon: "🧾", label: "Receipt" },
  { key: "hours",     icon: "🕐", label: "Hours" },
];

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const DEFAULT_SETTINGS = {
  business: { name: "", tagline: "", address: "", city: "", phone: "", email: "", gstNumber: "", fssaiNumber: "", panNumber: "" },
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

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
