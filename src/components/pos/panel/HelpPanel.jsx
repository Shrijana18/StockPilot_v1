import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePOSTheme } from "../POSThemeContext";

const SUPPORT_EMAIL = "support@flypnow.com";
const SUPPORT_PHONE = "+918263874329";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const FAQ = [
  {
    q: "How do I add or edit menu items?",
    a: "Go to Menu Builder in the left sidebar. Use Smart Import to scan a photo/PDF, or click + Item to add manually. You can also edit any existing item by clicking on it.",
  },
  {
    q: "How do I take a table order?",
    a: "Go to Tables & Orders. Select an existing table or add a new one. Click + New Order on a table to open the order screen and start adding dishes.",
  },
  {
    q: "How do I view Kitchen Display / KDS?",
    a: "Click Kitchen Display in the sidebar. All active orders appear here in real-time. Staff can mark items as done from this screen.",
  },
  {
    q: "How do I generate a QR code for table ordering?",
    a: "Go to QR Orders in the sidebar. Each table will have its own QR code — download or print it. Customers scan and order directly to the kitchen.",
  },
  {
    q: "How do I view or reprint invoices?",
    a: "Go to Invoices in the sidebar. You can search, filter by date, and reprint any past invoice.",
  },
  {
    q: "How do I update my restaurant name or address?",
    a: "Go to Settings → Business Info tab. Update your name, address, GSTIN and other details there. Changes reflect across invoices, QR and header.",
  },
  {
    q: "How do I change the POS theme (Dark/Light/FLYP)?",
    a: "Use the three-button theme toggle in the top-right corner of the POS header — FLYP, Light, and Dark modes are available.",
  },
  {
    q: "How do I log out?",
    a: "Click the Sign Out button at the bottom of the left sidebar. You will be redirected to the POS login screen.",
  },
  {
    q: "My orders are not appearing on KDS — what do I do?",
    a: "Make sure orders are placed with status 'active'. Check your internet connection. If the issue persists, try refreshing the page or contact support.",
  },
  {
    q: "How do I enable online orders?",
    a: "Go to Online Orders in the sidebar to manage incoming orders. Make sure your menu is published and QR codes are active.",
  },
];

const ISSUE_TYPES = [
  "General Question",
  "Menu / Items Issue",
  "Order Not Working",
  "Payment / Invoice Issue",
  "KDS / Kitchen Display",
  "QR Code Issue",
  "Settings / Configuration",
  "Bug / Error",
  "Feature Request",
  "Other",
];

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const day = DAYS[now.getDay()];
  const date = now.getDate();
  const month = MONTHS[now.getMonth()];
  const year = now.getFullYear();

  return (
    <div className="flex flex-col items-center justify-center py-8 select-none">
      {/* Day + Date pill */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-3"
      >
        <motion.span
          key={day}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="px-3 py-1 rounded-full text-[11px] font-black bg-gradient-to-r from-violet-500/20 to-indigo-500/20 border border-violet-400/25 text-violet-300 uppercase tracking-widest"
        >
          {day}
        </motion.span>
        <span className="text-white/30 text-[11px] font-medium">{date} {month} {year}</span>
      </motion.div>

      {/* Big clock */}
      <div className="flex items-baseline gap-1">
        {[String(h12).padStart(2,"0"), m, s].map((seg, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <motion.span
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-3xl font-black text-white/20 leading-none mb-1"
              >:</motion.span>
            )}
            <motion.div
              key={seg}
              initial={{ opacity: 0.7, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className={`tabular-nums font-black leading-none ${
                i === 0 ? "text-6xl text-white" :
                i === 1 ? "text-6xl text-white/80" :
                "text-3xl text-white/35"
              }`}
            >{seg}</motion.div>
          </React.Fragment>
        ))}
        <span className="text-lg font-black text-white/40 ml-1 mb-1">{ampm}</span>
      </div>

      {/* Glow pulse */}
      <motion.div
        animate={{ opacity: [0.1, 0.25, 0.1], scale: [0.95, 1.05, 0.95] }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="absolute w-64 h-32 rounded-full blur-3xl bg-violet-500/20 pointer-events-none"
      />
    </div>
  );
}

export default function HelpPanel() {
  const { tc } = usePOSTheme();
  const [openFaq, setOpenFaq] = useState(null);
  const [form, setForm] = useState({ name: "", issueType: ISSUE_TYPES[0], message: "" });
  const [sent, setSent] = useState(false);
  const [activeSection, setActiveSection] = useState("faq"); // faq | contact | ticket

  const handleSend = () => {
    if (!form.message.trim()) return;
    const subject = encodeURIComponent(`[FLYP POS Support] ${form.issueType}${form.name ? ` — ${form.name}` : ""}`);
    const body = encodeURIComponent(
      `Name: ${form.name || "Not provided"}\nIssue Type: ${form.issueType}\n\nMessage:\n${form.message}\n\n---\nSent from FLYP Restaurant POS`
    );
    window.open(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`, "_blank");
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={tc.bg}>

      {/* ── Header with live clock ── */}
      <div className={`relative shrink-0 border-b ${tc.borderSoft} overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/30 via-indigo-900/20 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl bg-violet-500/10 pointer-events-none" />

        <div className="relative px-6 pt-5 pb-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xl">🆘</span>
                <h1 className={`text-xl font-black ${tc.textPrimary}`}>Help & Support</h1>
              </div>
              <p className={`text-[11px] ${tc.textMuted}`}>FAQs · Contact support · Send a ticket</p>
            </div>
            {/* Contact quick-action buttons */}
            <div className="flex gap-2 shrink-0">
              <motion.a
                href={`tel:${SUPPORT_PHONE}`}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 transition"
              >📞 Call</motion.a>
              <motion.a
                href={`mailto:${SUPPORT_EMAIL}`}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/25 transition"
              >✉️ Email</motion.a>
            </div>
          </div>

          {/* Live clock */}
          <div className="relative">
            <LiveClock />
          </div>
        </div>

        {/* Section tabs */}
        <div className={`flex gap-1 px-6 pb-0 border-t ${tc.borderSoft}`}>
          {[["faq","💬 FAQs"],["contact","📞 Contact"],["ticket","🎫 Send Ticket"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                activeSection === key
                  ? "border-violet-400 text-violet-300"
                  : `border-transparent ${tc.textMuted} hover:text-white/70`
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <AnimatePresence mode="wait">

          {/* FAQs */}
          {activeSection === "faq" && (
            <motion.div key="faq" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-2">
              <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${tc.textMuted}`}>Frequently Asked Questions</p>
              {FAQ.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`rounded-2xl border overflow-hidden transition-all ${tc.borderSoft} ${openFaq === i ? tc.cardBg : "bg-white/2 hover:bg-white/4"}`}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <motion.span
                      animate={{ rotate: openFaq === i ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                      className={`text-xs shrink-0 ${tc.textMuted}`}
                    >▶</motion.span>
                    <span className={`text-sm font-semibold flex-1 ${tc.textSub}`}>{item.q}</span>
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className={`px-4 pb-4 text-sm leading-relaxed border-t ${tc.borderSoft} pt-3 ${tc.textMuted}`}>
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Contact */}
          {activeSection === "contact" && (
            <motion.div key="contact" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
              <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${tc.textMuted}`}>Reach Our Support Team</p>

              {/* Phone card */}
              <motion.a
                href={`tel:${SUPPORT_PHONE}`}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                className={`flex items-center gap-4 p-5 rounded-2xl border ${tc.borderSoft} bg-gradient-to-r from-emerald-500/8 to-teal-500/5 hover:from-emerald-500/14 hover:to-teal-500/10 transition-all group`}
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/25 flex items-center justify-center text-2xl shrink-0">
                  📞
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold uppercase tracking-widest ${tc.textMuted} mb-0.5`}>Call Us</p>
                  <p className={`text-lg font-black ${tc.textPrimary} group-hover:text-emerald-300 transition`}>{SUPPORT_PHONE}</p>
                  <p className={`text-[10px] ${tc.textMuted}`}>Mon–Sat, 9 AM – 7 PM IST</p>
                </div>
                <span className={`text-sm ${tc.textMuted} group-hover:text-emerald-300 transition`}>→</span>
              </motion.a>

              {/* Email card */}
              <motion.a
                href={`mailto:${SUPPORT_EMAIL}`}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                className={`flex items-center gap-4 p-5 rounded-2xl border ${tc.borderSoft} bg-gradient-to-r from-violet-500/8 to-indigo-500/5 hover:from-violet-500/14 hover:to-indigo-500/10 transition-all group`}
              >
                <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-400/25 flex items-center justify-center text-2xl shrink-0">
                  ✉️
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold uppercase tracking-widest ${tc.textMuted} mb-0.5`}>Email Us</p>
                  <p className={`text-lg font-black ${tc.textPrimary} group-hover:text-violet-300 transition`}>{SUPPORT_EMAIL}</p>
                  <p className={`text-[10px] ${tc.textMuted}`}>We reply within 24 hours</p>
                </div>
                <span className={`text-sm ${tc.textMuted} group-hover:text-violet-300 transition`}>→</span>
              </motion.a>

              {/* Info card */}
              <div className={`p-4 rounded-2xl border ${tc.borderSoft} ${tc.mutedBg}`}>
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">💡</span>
                  <div>
                    <p className={`text-xs font-bold ${tc.textSub} mb-1`}>For fastest resolution</p>
                    <p className={`text-xs ${tc.textMuted} leading-relaxed`}>
                      Use the <strong className="text-white/70">Send Ticket</strong> tab to pre-fill your issue type and message. Our team will have context ready when they respond.
                    </p>
                  </div>
                </div>
              </div>

              {/* FLYP branding */}
              <div className="flex items-center justify-center gap-3 pt-4">
                <img src="/assets/flyp_logo.png" alt="FLYP" className="w-6 h-6 object-contain opacity-50" onError={e => { e.target.style.display = "none"; }} />
                <span className={`text-[10px] font-black tracking-widest uppercase ${tc.textMuted}`}>FLYP Support Team</span>
              </div>
            </motion.div>
          )}

          {/* Support Ticket */}
          {activeSection === "ticket" && (
            <motion.div key="ticket" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4 max-w-lg">
              <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${tc.textMuted}`}>Send a Support Ticket</p>

              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${tc.textSub}`}>Your Name (optional)</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Raj Kumar"
                  className={`w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 ${tc.inputBg}`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${tc.textSub}`}>Issue Type</label>
                <select
                  value={form.issueType}
                  onChange={e => setForm(f => ({ ...f, issueType: e.target.value }))}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 ${tc.inputBg}`}
                >
                  {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${tc.textSub}`}>Describe Your Issue *</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  rows={5}
                  placeholder="Please describe your issue in detail…"
                  className={`w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 resize-none ${tc.inputBg}`}
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleSend}
                disabled={!form.message.trim()}
                className={`w-full py-3 rounded-2xl text-sm font-black transition flex items-center justify-center gap-2 ${
                  sent
                    ? "bg-emerald-500/20 border border-emerald-400/30 text-emerald-300"
                    : "bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                {sent ? (
                  <><span>✅</span> Ticket opened in your email app!</>
                ) : (
                  <><span>📨</span> Send to Support</>
                )}
              </motion.button>

              <p className={`text-center text-[10px] ${tc.textMuted}`}>
                This will open your email app pre-filled with your issue.
                <br />Sending to <strong className="text-white/50">{SUPPORT_EMAIL}</strong>
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
