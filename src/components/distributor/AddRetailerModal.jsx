import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../../firebase/firebaseConfig";
import {
  doc,
  collection,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
// Optional Cloud Function (if wired later)
let functionsRef = null;
try {
  // Lazy import to avoid breaking web if functions not initialized yet
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  functionsRef = { getFunctions, httpsCallable };
} catch (_) {
  // no-op
}

/**
 * AddRetailerModal
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - distributorId: string (required for local fallback writes)
 *  - onCreated?: (result) => void  // receives { provisionalId, inviteUrl, payload }
 *  - useCloudFunction?: boolean    // if true, attempts to call `createProvisionalRetailer`
 *  - toast?: (opts: { type: 'success'|'error'|'info', message: string }) => void
 *  - uiVariant?: string            // UI variant for modal layout
 *  - autofocus?: boolean           // whether to autofocus business name input
 */
export default function AddRetailerModal({
  open,
  onClose,
  distributorId,
  onCreated,
  createdBy,
  useCloudFunction = true,
  toast,
  uiVariant = "centered",
  autofocus = false,
}) {
  const [form, setForm] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    phone: "",
    gst: "",
    address: "",
    city: "",
    state: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteInfo, setInviteInfo] = useState(null);

  const canCreateLocal = useMemo(() => form.businessName.trim() !== "" && !loading, [form, loading]);
  const canSubmit = useMemo(() => {
    const hasContact = form.email.trim() !== "" || form.phone.trim() !== "";
    return form.businessName.trim() !== "" && hasContact && !loading;
  }, [form, loading]);

  // Close on ESC; quick submit on Cmd/Ctrl + Enter
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (e.key === "Escape" && !loading) onClose?.();
      if (mod && e.key === "Enter" && canSubmit && !loading) {
        e.preventDefault();
        const btn = document.getElementById("add-retailer-submit");
        btn?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, canSubmit, onClose]);

  useEffect(() => {
    if (!open) {
      setForm({
        businessName: "",
        ownerName: "",
        email: "",
        phone: "",
        gst: "",
        address: "",
        city: "",
        state: "",
      });
      setLoading(false);
      setError("");
      setInviteInfo(null);
    }
  }, [open]);


  const setVal = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const validate = () => {
    // Require business name
    if (!form.businessName.trim()) return "Business name is required.";
    // Require at least one contact
    if (!form.email.trim() && !form.phone.trim()) {
      return "Provide at least an email or a phone number.";
    }
    // Email basic validation (optional)
    if (form.email.trim()) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(form.email.trim())) return "Enter a valid email address.";
    }
    // Phone (India) basic validation (optional)
    if (form.phone.trim()) {
      const digits = form.phone.replace(/[^\d]/g, "");
      // Accept inputs like 9876543210 or +919876543210; store last 10
      if (!(digits.length === 10 || (digits.length === 12 && digits.startsWith("91")))) {
        return "Enter a valid 10‑digit Indian phone (with or without +91).";
      }
    }
    // GSTIN (optional, 15‑char alphanumeric)
    if (form.gst.trim()) {
      const gstOk = /^[0-9A-Z]{15}$/i.test(form.gst.trim());
      if (!gstOk) return "Enter a valid 15‑character GSTIN (alphanumeric).";
    }
    return "";
  };

  // Create locally without generating invite (primary action)
  const handleCreateLocal = async () => {
    setError("");
    if (!distributorId) {
      const msg = "Missing distributorId – cannot create retailer.";
      setError(msg);
      toast?.({ type: "error", message: msg });
      return;
    }
    if (!form.businessName.trim()) {
      const msg = "Business name is required.";
      setError(msg);
      toast?.({ type: "error", message: msg });
      return;
    }
    
    // Check for duplicates
    try {
      const normalizedPhone = normalizePhoneIN(form.phone);
      const normalizedEmail = form.email.trim().toLowerCase() || null;
      
      const retailersRef = collection(db, "businesses", distributorId, "connectedRetailers");
      const retailersSnap = await getDocs(retailersRef);
      
      const duplicate = retailersSnap.docs.find(doc => {
        const data = doc.data();
        const existingPhone = data.retailerPhone || data.phone;
        const existingEmail = (data.retailerEmail || data.email || "").toLowerCase();
        
        return (normalizedPhone && existingPhone && existingPhone === normalizedPhone) ||
               (normalizedEmail && existingEmail && existingEmail === normalizedEmail);
      });
      
      if (duplicate) {
        const msg = "A retailer with this email or phone number already exists.";
        setError(msg);
        toast?.({ type: "error", message: msg });
        return;
      }
    } catch (checkErr) {
      console.error("Error checking duplicates:", checkErr);
      // Continue with creation if duplicate check fails
    }
    
    setLoading(true);
    try {
      // Minimal local record in connectedRetailers; can invite later from panel
      // Save all retailer info including city, state, and address for order display
      const connRef = doc(collection(db, "businesses", distributorId, "connectedRetailers"));
      
      // Build payload, filtering out undefined values
      const docId = connRef.id;
      const payload = {
        retailerId: docId, // Store the document ID as retailerId for consistency
        retailerName: form.businessName.trim(),
        status: "provisioned-local",
        source: "provisioned-local",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      // Only add fields that have values (not undefined, not empty string)
      if (form.email.trim()) {
        payload.retailerEmail = form.email.trim();
      }
      if (form.phone.trim()) {
        const normalizedPhone = normalizePhoneIN(form.phone);
        if (normalizedPhone) {
          payload.retailerPhone = normalizedPhone;
        }
      }
      if (form.address.trim()) {
        payload.retailerAddress = form.address.trim();
      }
      if (form.city.trim()) {
        payload.retailerCity = form.city.trim();
      }
      if (form.state.trim()) {
        payload.retailerState = form.state.trim();
      }
      if (form.gst.trim()) {
        payload.gst = form.gst.trim().toUpperCase();
      }
      
      // Add createdBy info
      if (createdBy?.type && createdBy?.id) {
        payload.addedBy = {
          type: createdBy.type,
          id: createdBy.id,
        };
        if (createdBy.name) payload.addedBy.name = createdBy.name;
        if (createdBy.flypEmployeeId) payload.addedBy.flypEmployeeId = createdBy.flypEmployeeId;
      } else {
        payload.addedBy = { type: 'distributor', id: distributorId };
      }
      
      await setDoc(connRef, payload, { merge: true });
      onCreated?.({ retailerId: docId, payload });
      toast?.({ type: "success", message: "Retailer created successfully!" });
      onClose?.();
    } catch (e) {
      console.error("Error creating retailer:", e);
      const msg = e.message || "Failed to create retailer. Please check your permissions.";
      setError(msg);
      toast?.({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast?.({ type: "success", message: "Invite link copied." });
    } catch {
      toast?.({ type: "error", message: "Could not copy. Select and copy manually." });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      toast?.({ type: "error", message: v });
      return;
    }
    if (!distributorId) {
      const msg = "Missing distributorId – cannot create provisional retailer.";
      setError(msg);
      toast?.({ type: "error", message: msg });
      return;
    }

    setLoading(true);
    try {
      // Prefer Cloud Function if allowed & available
      if (useCloudFunction && functionsRef) {
        const fn = functionsRef.httpsCallable(functionsRef.getFunctions(), "createProvisionalRetailer");
        const res = await fn({
          distributorId,
          payload: {
            businessName: form.businessName.trim(),
            ownerName: form.ownerName.trim(),
            email: form.email.trim() || null,
            phone: normalizePhoneIN(form.phone),
            gst: form.gst.trim() || null,
            address: form.address.trim() || null,
            city: form.city.trim() || null,
            state: form.state.trim() || null,
          },
        });
        const { provisionalId, inviteUrl } = res?.data || {};
        const info = { provisionalId, inviteUrl, payload: res?.data?.payload || null };
        setInviteInfo(info);
        onCreated?.(info);
        toast?.({ type: "success", message: "Provisional retailer created." });
        setLoading(false);
        return;
      }

      // Check for duplicates BEFORE creating
      const normalizedPhone = normalizePhoneIN(form.phone);
      const normalizedEmail = form.email.trim().toLowerCase() || null;
      
      const retailersRef = collection(db, "businesses", distributorId, "connectedRetailers");
      const retailersSnap = await getDocs(retailersRef);
      
      const duplicate = retailersSnap.docs.find(doc => {
        const data = doc.data();
        const existingPhone = data.retailerPhone || data.phone;
        const existingEmail = (data.retailerEmail || data.email || "").toLowerCase();
        
        return (normalizedPhone && existingPhone && existingPhone === normalizedPhone) ||
               (normalizedEmail && existingEmail && existingEmail === normalizedEmail);
      });
      
      if (duplicate) {
        throw new Error("A retailer with this email or phone number already exists.");
      }

      // Fallback: Local Firestore write (no token)
      // NOTE: This is a temporary client‑side path; once your CF is ready,
      //       it should be replaced by the callable to generate a secure invite.
      const provisionalId = cryptoRandomId();
      const provisionalRef = doc(collection(db, "provisionalRetailers"), provisionalId);
      
      // Build payload, filtering out undefined values
      const payload = {
        createdBy: distributorId,
        businessName: form.businessName.trim(),
        status: "provisional",
        connectedDistributorId: distributorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      // Only add fields that have values
      if (form.ownerName.trim()) {
        payload.ownerName = form.ownerName.trim();
      }
      if (form.email.trim()) {
        payload.retailerEmail = form.email.trim();
      }
      if (normalizedPhone) {
        payload.retailerPhone = normalizedPhone;
      }
      if (form.gst.trim()) {
        payload.gst = form.gst.trim().toUpperCase();
      }
      if (form.address.trim()) {
        payload.address = form.address.trim();
      }
      if (form.city.trim()) {
        payload.city = form.city.trim();
      }
      if (form.state.trim()) {
        payload.state = form.state.trim();
      }
      
      await setDoc(provisionalRef, payload, { merge: true });
      
      // Also create a connectedRetailers entry (provisioned)
      // Save all retailer info including city, state, and address for order display
      const connRef = doc(collection(db, "businesses", distributorId, "connectedRetailers"));
      
      // Build payload, filtering out undefined values
      const docId = connRef.id;
      const connPayload = {
        retailerId: docId, // Store document ID as retailerId
        provisionalId,
        retailerName: payload.businessName,
        status: "provisioned",
        source: "provisioned",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      // Only add fields that have values
      if (payload.retailerEmail) {
        connPayload.retailerEmail = payload.retailerEmail;
      }
      if (payload.retailerPhone) {
        connPayload.retailerPhone = payload.retailerPhone;
      }
      if (payload.address) {
        connPayload.retailerAddress = payload.address;
      }
      if (payload.city) {
        connPayload.retailerCity = payload.city;
      }
      if (payload.state) {
        connPayload.retailerState = payload.state;
      }
      
      // Add createdBy info
      if (createdBy?.type && createdBy?.id) {
        connPayload.addedBy = {
          type: createdBy.type,
          id: createdBy.id,
        };
        if (createdBy.name) connPayload.addedBy.name = createdBy.name;
        if (createdBy.flypEmployeeId) connPayload.addedBy.flypEmployeeId = createdBy.flypEmployeeId;
      } else {
        connPayload.addedBy = { type: 'distributor', id: distributorId };
      }
      
      await setDoc(connRef, connPayload);
      const inviteUrl = `${window.location.origin}/claim?pid=${provisionalId}`; // temporary (no token)
      const info = { provisionalId, inviteUrl, payload };
      setInviteInfo(info);
      onCreated?.(info);
      toast?.({ type: "success", message: "Provisional retailer created (local draft)." });
    } catch (err) {
      console.error(err);
      const msg = "Failed to create provisional retailer.";
      setError(msg);
      toast?.({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  // Embedded variant: render inline without modal overlay
  if (uiVariant === "embedded") {
    if (!open) return null;
    return (
      <div className="w-full">
        <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          .input { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); }
          .input:focus { outline: none; box-shadow: 0 0 0 2px rgba(16,185,129,0.35); }
          .chip { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); }
        `}</style>
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/60">Provisioned Retailer</div>
              <h3 id="add-retailer-title" className="text-lg md:text-xl font-semibold">Add Retailer for Management</h3>
              <div className="text-[11px] text-white/50 mt-0.5">Create a managed retailer entry now and share an invite to claim later.</div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-3 py-2">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Business Name *">
                  <input
                    className="w-full rounded-lg input px-3 py-2 text-white placeholder:text-white/40"
                    value={form.businessName}
                    onChange={setVal("businessName")}
                    placeholder="e.g., Shree Ganesh Traders"
                    required
                    autoFocus={autofocus}
                  />
                </Field>
                <Field label="Owner Name">
                  <input
                    className="w-full rounded-lg input px-3 py-2 text-white placeholder:text-white/40"
                    value={form.ownerName}
                    onChange={setVal("ownerName")}
                    placeholder="e.g., Ramesh Patil"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    className="w-full rounded-lg input px-3 py-2 text-white placeholder:text-white/40"
                    value={form.email}
                    onChange={setVal("email")}
                    placeholder="owner@retailer.com"
                  />
                  <div className="mt-1 text-[11px] text-white/50">We'll send an invite here if provided.</div>
                </Field>
                <Field label="Phone (+91)">
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-lg input border-r-0 text-white/70 select-none">+91</span>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="w-full rounded-r-lg input px-3 py-2 text-white placeholder:text-white/40"
                      value={displayPhone(form.phone)}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="10‑digit number"
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-white/50">Enter 10 digits; we'll format as +91 automatically.</div>
                </Field>
                <Field label="GSTIN (optional)">
                  <input
                    className="w-full rounded-lg input px-3 py-2 uppercase text-white placeholder:text-white/40"
                    value={form.gst}
                    onChange={(e) => setForm((p) => ({ ...p, gst: e.target.value.toUpperCase() }))}
                    placeholder="15‑character GSTIN"
                  />
                  <div className="mt-1 text-[11px] text-white/50">Optional. 15 characters alphanumeric.</div>
                </Field>
                <Field label="Address (optional)">
                  <input
                    className="w-full rounded-lg input px-3 py-2 text-white placeholder:text-white/40"
                    value={form.address}
                    onChange={setVal("address")}
                    placeholder="Street address"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City (optional)">
                    <input
                      className="w-full rounded-lg input px-3 py-2 text-white placeholder:text-white/40"
                      value={form.city}
                      onChange={setVal("city")}
                      placeholder="City"
                    />
                  </Field>
                  <Field label="State (optional)">
                    <input
                      className="w-full rounded-lg input px-3 py-2 text-white placeholder:text-white/40"
                      value={form.state}
                      onChange={setVal("state")}
                      placeholder="State"
                    />
                  </Field>
                </div>
              </div>

              <div className="h-px bg-white/10 my-2" />

              <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
                <div className="text-[11px] text-white/55">
                  * Email or Phone required only for "Create & Generate Invite". You can invite later from the panel.
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={!canCreateLocal}
                    onClick={handleCreateLocal}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? "Creating…" : "Create"}
                  </button>
                  <button
                    id="add-retailer-submit"
                    type="submit"
                    disabled={!canSubmit}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? "Creating…" : "Create & Generate Invite"}
                  </button>
                </div>
              </div>
            </form>

            {/* Invite info (after create) */}
            {inviteInfo && (
              <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-white/90 font-medium mb-2">Invite Link</div>
                {inviteInfo?.provisionalId && (
                  <div className="mb-2">
                    <span className="chip rounded-md px-2 py-1 text-[10px] uppercase tracking-wide text-white/70">ID: {inviteInfo.provisionalId}</span>
                  </div>
                )}
                <div className="text-xs text-white/80 break-all mb-3">{inviteInfo.inviteUrl}</div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm transition-all"
                    onClick={() => copy(inviteInfo.inviteUrl)}
                  >
                    Copy Link
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm transition-all"
                    onClick={() => {
                      setInviteInfo(null);
                      onClose?.();
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default modal variant: render as fixed overlay modal
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`${uiVariant === "centered" ? "w-[94%] max-w-3xl" : "w-[92%] max-w-2xl"} relative rounded-2xl border border-white/10 bg-[#0b1220]/95 text-white shadow-[0_30px_120px_rgba(0,0,0,.6)] backdrop-blur-xl max-h-[90vh] overflow-y-auto no-scrollbar mx-auto my-6`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-retailer-title"
          >
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-white/60">Provisioned Retailer</div>
                <h3 id="add-retailer-title" className="text-lg md:text-xl font-semibold">Add Retailer for Management</h3>
                <div className="text-[11px] text-white/50 mt-0.5">Create a managed retailer entry now and share an invite to claim later.</div>
              </div>
              <button
                className="rounded-full px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white/90 text-sm"
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4 no-scrollbar">
              <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .input { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); }
                .input:focus { outline: none; box-shadow: 0 0 0 2px rgba(16,185,129,0.35); }
                .chip { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); }
              `}</style>
              <form onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-3 py-2">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Business Name *">
                    <input
                      className="w-full rounded-lg input px-3 py-2"
                      value={form.businessName}
                      onChange={setVal("businessName")}
                      placeholder="e.g., Shree Ganesh Traders"
                      required
                      autoFocus={autofocus}
                    />
                  </Field>
                  <Field label="Owner Name">
                    <input
                      className="w-full rounded-lg input px-3 py-2"
                      value={form.ownerName}
                      onChange={setVal("ownerName")}
                      placeholder="e.g., Ramesh Patil"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      className="w-full rounded-lg input px-3 py-2"
                      value={form.email}
                      onChange={setVal("email")}
                      placeholder="owner@retailer.com"
                    />
                    <div className="mt-1 text-[11px] text-white/50">We’ll send an invite here if provided.</div>
                  </Field>
                  <Field label="Phone (+91)">
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-lg input border-r-0 text-white/70 select-none">+91</span>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="w-full rounded-r-lg input px-3 py-2"
                        value={displayPhone(form.phone)}
                        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="10‑digit number"
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-white/50">Enter 10 digits; we’ll format as +91 automatically.</div>
                  </Field>
                  <Field label="GSTIN (optional)">
                    <input
                      className="w-full rounded-lg input px-3 py-2 uppercase"
                      value={form.gst}
                      onChange={(e) => setForm((p) => ({ ...p, gst: e.target.value.toUpperCase() }))}
                      placeholder="15‑character GSTIN"
                    />
                    <div className="mt-1 text-[11px] text-white/50">Optional. 15 characters alphanumeric.</div>
                  </Field>
                  <Field label="Address (optional)">
                    <input
                      className="w-full rounded-lg input px-3 py-2"
                      value={form.address}
                      onChange={setVal("address")}
                      placeholder="Street address"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City (optional)">
                      <input
                        className="w-full rounded-lg input px-3 py-2"
                        value={form.city}
                        onChange={setVal("city")}
                        placeholder="City"
                      />
                    </Field>
                    <Field label="State (optional)">
                      <input
                        className="w-full rounded-lg input px-3 py-2"
                        value={form.state}
                        onChange={setVal("state")}
                        placeholder="State"
                      />
                    </Field>
                  </div>
                </div>

                <div className="h-px bg-white/10 my-2" />

                <div className="pt-2 flex items-center justify-between">
                  <div className="text-[11px] text-white/55">
                    * Email or Phone required only for "Create & Generate Invite". You can invite later from the panel.
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!canCreateLocal}
                      onClick={handleCreateLocal}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-900 font-semibold disabled:opacity-50"
                    >
                      {loading ? "Creating…" : "Create"}
                    </button>
                    <button
                      id="add-retailer-submit"
                      type="submit"
                      disabled={!canSubmit}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white disabled:opacity-50"
                    >
                      {loading ? "Creating…" : "Create & Generate Invite"}
                    </button>
                  </div>
                </div>
              </form>

              {/* Invite info (after create) */}
              {inviteInfo && (
                <div className="px-5 pb-5">
                  <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="text-sm text-white/90 font-medium mb-1">Invite Link</div>
                    {inviteInfo?.provisionalId && (
                      <div className="mb-2">
                        <span className="chip rounded-md px-2 py-1 text-[10px] uppercase tracking-wide text-white/70">ID: {inviteInfo.provisionalId}</span>
                      </div>
                    )}
                    <div className="text-xs text-white/80 break-all">{inviteInfo.inviteUrl}</div>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm"
                        onClick={() => copy(inviteInfo.inviteUrl)}
                      >
                        Copy Link
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm"
                        onClick={() => {
                          setInviteInfo(null);
                          onClose?.();
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs text-white/70 mb-1">{label}</div>
      {children}
    </label>
  );
}

// Helpers
function normalizePhoneIN(input) {
  const digits = (input || "").replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 12 && digits.startsWith("91") === false) return `+91${digits.slice(-10)}`;
  // Fallback: last 10 digits with +91
  return `+91${digits.slice(-10)}`;
}
function displayPhone(input) {
  const digits = (input || "").replace(/[^\d]/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}
function cryptoRandomId() {
  // short random id for provisional record (client‑side fallback only)
  const a = crypto.getRandomValues(new Uint32Array(4));
  return Array.from(a, (x) => x.toString(16).padStart(8, "0")).join("").slice(0, 20);
}