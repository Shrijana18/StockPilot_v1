import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../../../firebase/firebaseConfig";
import { usePOSTheme } from "../POSThemeContext";

const ROLES = [
  { key: "owner",     label: "Owner",     icon: "👑", gradient: "from-amber-500 to-orange-600",   badge: "bg-amber-500/15 text-amber-300 border border-amber-400/30" },
  { key: "manager",   label: "Manager",   icon: "🎯", gradient: "from-blue-500 to-indigo-600",    badge: "bg-blue-500/15 text-blue-300 border border-blue-400/30" },
  { key: "cashier",   label: "Cashier",   icon: "💳", gradient: "from-emerald-500 to-teal-600",   badge: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30" },
  { key: "server",    label: "Server",    icon: "🍽️", gradient: "from-violet-500 to-purple-600",  badge: "bg-violet-500/15 text-violet-300 border border-violet-400/30" },
  { key: "chef",      label: "Chef",      icon: "👨‍🍳", gradient: "from-red-500 to-rose-600",       badge: "bg-red-500/15 text-red-300 border border-red-400/30" },
  { key: "host",      label: "Host",      icon: "🤝", gradient: "from-pink-500 to-rose-500",      badge: "bg-pink-500/15 text-pink-300 border border-pink-400/30" },
  { key: "bartender", label: "Bartender", icon: "🍹", gradient: "from-cyan-500 to-sky-600",       badge: "bg-cyan-500/15 text-cyan-300 border border-cyan-400/30" },
  { key: "staff",     label: "Staff",     icon: "👤", gradient: "from-slate-400 to-gray-600",     badge: "bg-gray-500/15 text-gray-300 border border-gray-400/30" },
];

const ACCESS_LEVELS = [
  { key: "full",    label: "Full Access",  desc: "All features + settings",    icon: "🔑", color: "amber" },
  { key: "billing", label: "Billing",      desc: "Checkout & invoices",        icon: "💰", color: "emerald" },
  { key: "orders",  label: "Orders",       desc: "Take & manage orders",       icon: "📋", color: "blue" },
  { key: "view",    label: "View Only",    desc: "Read-only access",           icon: "👁️", color: "gray" },
];

const ACCESS_COLORS = {
  amber:   { active: "bg-gradient-to-r from-amber-500/20 to-orange-500/10 border-amber-400/40 text-amber-200",   inactive: "border-amber-400/15 text-amber-300/60" },
  emerald: { active: "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border-emerald-400/40 text-emerald-200", inactive: "border-emerald-400/15 text-emerald-300/60" },
  blue:    { active: "bg-gradient-to-r from-blue-500/20 to-cyan-500/10 border-blue-400/40 text-blue-200",         inactive: "border-blue-400/15 text-blue-300/60" },
  gray:    { active: "bg-gradient-to-r from-gray-500/20 to-slate-500/10 border-gray-400/40 text-gray-200",        inactive: "border-gray-400/15 text-gray-300/60" },
};

function getInitials(name = "") {
  return name.split(" ").map(n => n[0] || "").join("").toUpperCase().slice(0, 2) || "?";
}
const getUid = () => auth.currentUser?.uid;
const getRoleMeta   = key => ROLES.find(r => r.key === key) || ROLES[ROLES.length - 1];
const getAccessMeta = key => ACCESS_LEVELS.find(a => a.key === key) || ACCESS_LEVELS[0];

const EMPTY_FORM = { name: "", role: "server", pin: "", phone: "", accessLevel: "billing", active: true };

export default function StaffManagement() {
  const { tc } = usePOSTheme();
  const [staff, setStaff]           = React.useState([]);
  const [showModal, setShowModal]   = React.useState(false);
  const [editing, setEditing]       = React.useState(null);
  const [saving, setSaving]         = React.useState(false);
  const [filterRole, setFilterRole] = React.useState("all");
  const [form, setForm]             = React.useState(EMPTY_FORM);
  const [toast, setToast]           = React.useState(null);

  const showToastMsg = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  React.useEffect(() => {
    const uid = getUid();
    if (!uid) return;
    const unsub = onSnapshot(collection(db, "businesses", uid, "pos-staff"), snap => {
      setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = member => {
    setEditing(member);
    setForm({ name: member.name || "", role: member.role || "staff", pin: member.pin || "", phone: member.phone || "", accessLevel: member.accessLevel || "billing", active: member.active !== false });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const uid = getUid();
    if (!uid) return;
    setSaving(true);
    try {
      const data = { name: form.name.trim(), role: form.role, pin: form.pin.trim(), phone: form.phone.trim(), accessLevel: form.accessLevel, active: form.active, updatedAt: Date.now() };
      if (editing) {
        await updateDoc(doc(db, "businesses", uid, "pos-staff", editing.id), data);
        showToastMsg("Staff updated");
      } else {
        await addDoc(collection(db, "businesses", uid, "pos-staff"), { ...data, createdAt: Date.now() });
        showToastMsg("Staff member added");
      }
      setShowModal(false);
    } catch (e) {
      console.error(e);
      showToastMsg("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async member => {
    const uid = getUid();
    if (!uid) return;
    await updateDoc(doc(db, "businesses", uid, "pos-staff", member.id), { active: !(member.active !== false), updatedAt: Date.now() });
  };

  const handleDelete = async id => {
    if (!window.confirm("Remove this staff member?")) return;
    const uid = getUid();
    if (uid) { await deleteDoc(doc(db, "businesses", uid, "pos-staff", id)); setShowModal(false); }
  };

  const filtered    = filterRole === "all" ? staff : staff.filter(s => s.role === filterRole);
  const activeCount = staff.filter(s => s.active !== false).length;
  const roleTabKeys = [...new Set(staff.map(s => s.role))];

  return (
    <div className="relative flex flex-col h-full overflow-y-auto" style={tc.bg}>
      {/* Aurora */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-16 w-[60%] h-[60%] rounded-full blur-[110px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob1} 0%, transparent 65%)` }} />
        <div className="absolute -bottom-32 -left-16 w-[55%] h-[55%] rounded-full blur-[110px]" style={{ background: `radial-gradient(circle, ${tc.auroraBlob2} 0%, transparent 65%)` }} />
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[999999] px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xl backdrop-blur-lg ${toast.type === "error" ? "bg-red-500/90 text-white" : "bg-emerald-500/90 text-white"}`}
          >{toast.msg}</motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className={`sticky top-0 z-20 ${tc.headerBg}`}>
        <div className="px-5 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-bold ${tc.textPrimary}`}>Staff Management</div>
            <div className={`text-[11px] mt-0.5 flex items-center gap-2 ${tc.textSub}`}>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />{activeCount} active</span>
              <span className={tc.textMuted}>·</span>
              <span className={tc.textMuted}>{staff.length} total</span>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={openAdd}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold ${tc.primaryBtn}`}
          >+ Add Staff</motion.button>
        </div>
      </div>

      <div className="relative z-10 p-5 flex-1">
        {/* Role filter pills */}
        {roleTabKeys.length > 1 && (
          <div className="flex gap-2 mb-5 flex-wrap">
            <button onClick={() => setFilterRole("all")} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${filterRole === "all" ? tc.zonePillActive : tc.zonePillInactive}`}>All</button>
            {roleTabKeys.map(rk => { const rm = getRoleMeta(rk); return (
              <button key={rk} onClick={() => setFilterRole(rk)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${filterRole === rk ? tc.zonePillActive : tc.zonePillInactive}`}>
                {rm.icon} {rm.label}
              </button>
            );})}
          </div>
        )}

        {/* Stats row */}
        {staff.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total Staff",  value: staff.length,                              icon: "👥", color: "text-white" },
              { label: "Active",       value: activeCount,                               icon: "🟢", color: "text-emerald-400" },
              { label: "Roles",        value: new Set(staff.map(s => s.role)).size,      icon: "🎭", color: "text-sky-400" },
              { label: "Full Access",  value: staff.filter(s => s.accessLevel === "full").length, icon: "🔑", color: "text-amber-400" },
            ].map(stat => (
              <div key={stat.label} className={`rounded-2xl border p-3 text-center ${tc.cardBg} ${tc.borderSoft}`}>
                <div className="text-xl mb-1">{stat.icon}</div>
                <div className={`text-lg font-black ${stat.color}`}>{stat.value}</div>
                <div className={`text-[10px] ${tc.textMuted}`}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Staff grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-5 ${tc.emptyIcon}`}>👥</div>
            <div className={`text-sm font-semibold mb-1 ${tc.textSub}`}>No staff members yet</div>
            <div className={`text-xs mb-5 ${tc.textMuted}`}>Add your team to track who's serving each order</div>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={openAdd}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold ${tc.primaryBtn}`}
            >+ Add First Staff Member</motion.button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <AnimatePresence>
              {filtered.map(member => {
                const rm = getRoleMeta(member.role);
                const am = getAccessMeta(member.accessLevel);
                const isActive = member.active !== false;
                return (
                  <motion.div key={member.id}
                    initial={{ opacity: 0, scale: 0.88, y: 14 }}
                    animate={{ opacity: isActive ? 1 : 0.45, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.88 }}
                    whileHover={{ y: -5, scale: 1.03 }}
                    transition={{ type: "spring", stiffness: 360, damping: 22 }}
                    className={`relative group rounded-2xl border p-4 flex flex-col items-center text-center cursor-pointer transition-all ${tc.cardBg} ${tc.borderSoft}`}
                    onClick={() => openEdit(member)}
                  >
                    {/* Active dot */}
                    <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${isActive ? "bg-emerald-400 shadow-sm shadow-emerald-400/60 animate-pulse" : "bg-gray-500"}`} />

                    {/* Avatar */}
                    <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${rm.gradient} flex items-center justify-center mb-3 shadow-lg ring-2 ring-white/10`}>
                      <span className="text-white font-black text-xl select-none">{getInitials(member.name)}</span>
                      <span className="absolute -bottom-2 -right-2 text-xl leading-none">{rm.icon}</span>
                    </div>

                    {/* Name */}
                    <div className={`text-sm font-bold leading-tight mb-2 ${tc.textPrimary}`}>{member.name}</div>

                    {/* Role badge */}
                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full mb-1.5 ${rm.badge}`}>{rm.label}</span>

                    {/* Access level */}
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-lg ${tc.mutedBg} ${tc.textMuted}`}>{am.icon} {am.label}</span>

                    {/* Hover overlay */}
                    <div className="absolute inset-0 rounded-2xl bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col items-center justify-center gap-2 p-3">
                      <button onClick={e => { e.stopPropagation(); openEdit(member); }}
                        className="w-full py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition">
                        Edit
                      </button>
                      <button onClick={e => { e.stopPropagation(); toggleActive(member); }}
                        className={`w-full py-1.5 rounded-xl text-xs font-semibold transition ${isActive ? "bg-red-500/30 hover:bg-red-500/50 text-red-200" : "bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-200"}`}>
                        {isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 12 }}
              transition={{ type: "spring", stiffness: 360, damping: 26 }}
              className={`w-full max-w-md rounded-2xl border shadow-2xl flex flex-col max-h-[90vh] ${tc.modalBg}`}
            >
              {/* Header */}
              <div className={`px-5 py-4 border-b flex items-center justify-between shrink-0 ${tc.borderSoft}`}>
                <div>
                  <div className={`text-sm font-bold ${tc.textPrimary}`}>{editing ? "Edit Staff Member" : "Add Staff Member"}</div>
                  <div className={`text-xs mt-0.5 ${tc.textMuted}`}>Set role, access level and optional PIN</div>
                </div>
                <button onClick={() => setShowModal(false)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${tc.editBtn}`}>✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Name + Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${tc.textMuted}`}>Name *</label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Rahul" autoFocus
                      className={`w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${tc.inputBg}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${tc.textMuted}`}>Phone (optional)</label>
                    <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="9876543210" type="tel"
                      className={`w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${tc.inputBg}`}
                    />
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-wider mb-2.5 block ${tc.textMuted}`}>Role</label>
                  <div className="grid grid-cols-4 gap-2">
                    {ROLES.map(r => (
                      <motion.button key={r.key} whileTap={{ scale: 0.93 }} onClick={() => setForm(p => ({ ...p, role: r.key }))}
                        className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border transition-all ${
                          form.role === r.key
                            ? `bg-gradient-to-br ${r.gradient} border-white/20 shadow-md`
                            : `${tc.cardBg} ${tc.borderSoft} opacity-55 hover:opacity-80`
                        }`}
                      >
                        <span className="text-xl leading-none">{r.icon}</span>
                        <span className={`text-[10px] font-semibold ${form.role === r.key ? "text-white" : tc.textMuted}`}>{r.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Access Level */}
                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-wider mb-2.5 block ${tc.textMuted}`}>Access Level</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ACCESS_LEVELS.map(al => {
                      const colors = ACCESS_COLORS[al.color];
                      const isSelected = form.accessLevel === al.key;
                      return (
                        <button key={al.key} onClick={() => setForm(p => ({ ...p, accessLevel: al.key }))}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${isSelected ? colors.active : `${tc.cardBg} border-white/[0.08] opacity-60 hover:opacity-90`}`}
                        >
                          <span className="text-base mt-0.5">{al.icon}</span>
                          <div>
                            <div className={`text-xs font-bold leading-tight ${isSelected ? "" : tc.textSub}`}>{al.label}</div>
                            <div className={`text-[10px] mt-0.5 ${isSelected ? "opacity-70" : tc.textMuted}`}>{al.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* PIN */}
                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${tc.textMuted}`}>Quick PIN <span className="normal-case font-normal">(optional)</span></label>
                  <input value={form.pin} onChange={e => setForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                    placeholder="4–6 digit PIN for quick checkout selection" type="text" inputMode="numeric"
                    className={`w-full px-3 py-2.5 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${tc.inputBg}`}
                  />
                  <p className={`text-[10px] mt-1 ${tc.textMuted}`}>Staff can be selected at checkout using this PIN</p>
                </div>

                {/* Active toggle */}
                <div className={`flex items-center justify-between py-3 px-4 rounded-xl border ${tc.borderSoft} ${tc.mutedBg}`}>
                  <div>
                    <div className={`text-xs font-semibold ${tc.textSub}`}>Active</div>
                    <div className={`text-[10px] ${tc.textMuted}`}>Inactive staff won't appear in checkout</div>
                  </div>
                  <button onClick={() => setForm(p => ({ ...p, active: !p.active }))}
                    className={`w-12 h-6 rounded-full relative transition-all duration-200 ${form.active ? "bg-emerald-500" : "bg-white/15"}`}
                  >
                    <motion.div animate={{ x: form.active ? 26 : 2 }} transition={{ type: "spring", stiffness: 600, damping: 30 }}
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                    />
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className={`px-5 py-4 border-t flex gap-2 shrink-0 ${tc.borderSoft}`}>
                {editing && (
                  <button onClick={() => handleDelete(editing.id)}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/20 transition">
                    Delete
                  </button>
                )}
                <button onClick={() => setShowModal(false)} className={`flex-1 py-2.5 rounded-xl text-sm transition ${tc.outlineBtn}`}>Cancel</button>
                <button onClick={handleSave} disabled={!form.name.trim() || saving}
                  className={`flex-[2] py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 ${tc.primaryBtn}`}>
                  {saving ? "Saving…" : editing ? "Save Changes" : "Add Staff Member"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
