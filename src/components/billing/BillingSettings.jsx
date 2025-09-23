import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../../firebase/firebaseConfig";
import { toast } from "react-toastify";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

/**
 * BillingSettings (MVP-only)
 * Focused on: Logo, Signature, Stamp, UPI (ID + QR), Bank Details, Terms.
 * No templates/themes/preview logic.
 *
 * Firestore path: businesses/{uid}/preferences/billing
 */

const DEFAULTS = {
  branding: {
    logoUrl: "",
    signatureUrl: "",
    stampUrl: "",
  },
  bank: {
    bankName: "",
    branch: "",
    accountNumber: "",
    ifsc: "",
    accountName: "",
  },
  payment: {
    upiId: "",
    upiQrUrl: "",
  },
  terms: "",
};

// ---- Helpers to ensure Firestore receives only plain JSON-safe values
const asStr = (v) => (v == null ? "" : String(v));

// Strict allowlist + JSON round-trip to strip any non-serializable values
const sanitizeSettings = (raw) => {
  const brandingIn = raw?.branding || {};
  const bankIn = raw?.bank || {};
  const paymentIn = raw?.payment || {};

  const cleaned = {
    branding: {
      logoUrl: asStr(brandingIn.logoUrl),
      signatureUrl: asStr(brandingIn.signatureUrl),
      stampUrl: asStr(brandingIn.stampUrl),
    },
    bank: {
      bankName: asStr(bankIn.bankName || bankIn.name),
      branch: asStr(bankIn.branch),
      accountNumber: asStr(bankIn.accountNumber || bankIn.account),
      ifsc: asStr(bankIn.ifsc),
      accountName: asStr(bankIn.accountName),
    },
    payment: {
      upiId: asStr(paymentIn.upiId),
      upiQrUrl: asStr(paymentIn.upiQrUrl),
    },
    terms: asStr(raw?.terms),
    updatedAt: Date.now(),
  };

  return JSON.parse(JSON.stringify(cleaned));
};

export default function BillingSettings({ isOpen, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(DEFAULTS);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [uploadingKey, setUploadingKey] = useState(""); // "branding.logoUrl" etc
  const canvasRef = useRef(null);
  const storage = getStorage();

  // Lock page scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Load settings when opened
  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      setLoading(true);
      try {
        const ref = doc(db, "businesses", uid, "preferences", "billing");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() || {};

          // Normalize bank keys from any legacy structure
          const bankIn = data.bank || {};
          const bank = {
            bankName: bankIn.bankName || bankIn.name || "",
            branch: bankIn.branch || "",
            accountNumber: bankIn.accountNumber || bankIn.account || "",
            ifsc: bankIn.ifsc || "",
            accountName: bankIn.accountName || "",
          };

          setSettings({
            branding: {
              logoUrl: data.branding?.logoUrl || "",
              signatureUrl: data.branding?.signatureUrl || "",
              stampUrl: data.branding?.stampUrl || "",
            },
            bank,
            payment: {
              upiId: data.payment?.upiId || "",
              upiQrUrl: data.payment?.upiQrUrl || "",
            },
            terms: data.terms || "",
          });
        } else {
          setSettings(DEFAULTS);
        }
      } catch (e) {
        console.error("Failed to load billing settings", e);
        toast?.error?.("Failed to load billing settings");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen]);

  const setField = (path, value) => {
    setSettings((prev) => {
      const next = { ...prev };
      const segs = path.split(".");
      let obj = next;
      for (let i = 0; i < segs.length - 1; i++) {
        obj[segs[i]] = { ...(obj[segs[i]] || {}) };
        obj = obj[segs[i]];
      }
      obj[segs[segs.length - 1]] = value;
      return next;
    });
  };

  // Upload a file/blob to Storage and store the download URL into Firestore field
  const uploadToStorage = async (pathKey, blobOrFile, fileNameHint = "image.png") => {
    const uid = auth.currentUser?.uid;
    if (!uid || !blobOrFile) return;

    try {
      setUploadingKey(pathKey);
      const keySafe = pathKey.replace(/\./g, "-"); // branding-logoUrl
      const fileRef = storageRef(
        storage,
        `businesses/${uid}/billing/${keySafe}/${Date.now()}-${fileNameHint}`
      );

      const fileLike =
        blobOrFile instanceof Blob || blobOrFile instanceof File
          ? blobOrFile
          : new Blob([blobOrFile], { type: "application/octet-stream" });

      await uploadBytes(fileRef, fileLike);
      const url = await getDownloadURL(fileRef);
      setField(pathKey, url); // store short https URL
      toast?.success?.("Image uploaded");
    } catch (e) {
      console.error("Upload to storage failed", e);
      toast?.error?.("Upload failed");
    } finally {
      setUploadingKey("");
    }
  };

  const onUpload = async (pathKey, file) => {
    if (!file) return;
    await uploadToStorage(pathKey, file, file.name || "image.png");
  };

  const handleSave = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSaving(true);
    try {
      const ref = doc(db, "businesses", uid, "preferences", "billing");
      const toSave = sanitizeSettings(settings);

      // Small payload now (just short URLs). Keep the guard anyway.
      const json = JSON.stringify(toSave);
      const jsonSize = new Blob([json]).size; // bytes
      console.debug("Saving billing settings payload bytes:", jsonSize, toSave);
      if (jsonSize > 900000) {
        toast?.error?.(
          "Images are too large to store in settings. Please re-upload smaller images."
        );
        setSaving(false);
        return;
      }

      await setDoc(ref, toSave, { merge: true });
      toast?.success?.("Billing settings saved");
      onSaved?.(toSave);
      onClose?.();
    } catch (e) {
      console.error("Failed to save billing settings", e);
      toast?.error?.("Failed to save billing settings");
    } finally {
      setSaving(false);
    }
  };

  // Signature pad (upload drawn image to Storage)
  useEffect(() => {
    if (!showSignaturePad || !canvasRef.current) return;
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    let drawing = false;

    const pos = (e) => {
      const rect = c.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      return { x, y };
    };
    const down = (e) => {
      drawing = true;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = (e) => {
      if (!drawing) return;
      const p = pos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const up = () => {
      drawing = false;
    };

    c.addEventListener("mousedown", down);
    c.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    c.addEventListener("touchstart", down, { passive: true });
    c.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);

    return () => {
      c.removeEventListener("mousedown", down);
      c.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      c.removeEventListener("touchstart", down);
      c.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [showSignaturePad]);

  const uploadCanvasSignature = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !canvasRef.current) return;
    try {
      setUploadingKey("branding.signatureUrl");
      // Convert canvas to blob then upload
      const blob = await new Promise((resolve) =>
        canvasRef.current.toBlob(resolve, "image/png")
      );
      await uploadToStorage("branding.signatureUrl", blob, "signature.png");
      setShowSignaturePad(false);
    } catch (e) {
      console.error("Signature upload failed", e);
      toast?.error?.("Signature upload failed");
    } finally {
      setUploadingKey("");
    }
  };

  if (!isOpen) return null;

  return isOpen
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-3xl mx-4 rounded-lg border border-white/10 bg-white/10 backdrop-blur-2xl text-white shadow-xl">
            <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-semibold">Billing Settings</h2>
              <button className="opacity-80 hover:opacity-100" onClick={onClose}>
                Close
              </button>
            </div>

            <div
              className={
                "p-4 md:p-6 space-y-6 max-h-[75vh] overflow-y-auto relative " +
                (loading ? "opacity-60 pointer-events-none" : "")
              }
            >
              {/* Branding */}
              <section>
                <h3 className="font-semibold mb-2">Branding</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Logo */}
                  <div>
                    <label className="block text-sm opacity-80 mb-1">Logo</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => onUpload("branding.logoUrl", e.target.files?.[0])}
                        className="block w-full text-sm"
                        disabled={uploadingKey === "branding.logoUrl"}
                      />
                    </div>
                    {settings.branding.logoUrl ? (
                      <div className="mt-2 p-2 rounded bg-white/5 border border-white/10">
                        <img
                          src={settings.branding.logoUrl}
                          alt="Logo preview"
                          className="max-h-16 object-contain"
                        />
                      </div>
                    ) : null}
                    {uploadingKey === "branding.logoUrl" && (
                      <p className="text-xs opacity-70 mt-1">Uploading…</p>
                    )}
                  </div>

                  {/* Signature */}
                  <div>
                    <label className="block text-sm opacity-80 mb-1">Signature</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        onChange={(e) =>
                          onUpload("branding.signatureUrl", e.target.files?.[0])
                        }
                        className="block w-full text-sm"
                        disabled={uploadingKey === "branding.signatureUrl"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignaturePad(true)}
                        className="px-2 py-1 rounded border border-white/20 bg-white/10 hover:bg-white/15 text-sm"
                      >
                        Draw
                      </button>
                    </div>
                    {settings.branding.signatureUrl ? (
                      <div className="mt-2 p-2 rounded bg-white/5 border border-white/10">
                        <img
                          src={settings.branding.signatureUrl}
                          alt="Signature preview"
                          className="max-h-16 object-contain"
                        />
                      </div>
                    ) : null}
                    {uploadingKey === "branding.signatureUrl" && (
                      <p className="text-xs opacity-70 mt-1">Uploading…</p>
                    )}
                  </div>
                </div>

                {/* Stamp */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm opacity-80 mb-1">Stamp (optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onUpload("branding.stampUrl", e.target.files?.[0])}
                      className="block w-full text-sm"
                      disabled={uploadingKey === "branding.stampUrl"}
                    />
                    {settings.branding.stampUrl ? (
                      <div className="mt-2 p-2 rounded bg-white/5 border border-white/10">
                        <img
                          src={settings.branding.stampUrl}
                          alt="Stamp preview"
                          className="max-h-20 object-contain"
                        />
                      </div>
                    ) : null}
                    {uploadingKey === "branding.stampUrl" && (
                      <p className="text-xs opacity-70 mt-1">Uploading…</p>
                    )}
                  </div>
                </div>
              </section>

              {/* UPI */}
              <section>
                <h3 className="font-semibold mb-2">UPI</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm opacity-80 mb-1">UPI ID</label>
                    <input
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                      placeholder="username@bank"
                      value={settings.payment?.upiId ?? ""}
                      onChange={(e) => setField("payment.upiId", e.target.value)}
                    />
                    <p className="text-xs opacity-70 mt-1">Shown on invoice and for QR generation.</p>
                  </div>
                  <div>
                    <label className="block text-sm opacity-80 mb-1">UPI QR Code</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onUpload("payment.upiQrUrl", e.target.files?.[0])}
                      className="block w-full text-sm"
                      disabled={uploadingKey === "payment.upiQrUrl"}
                    />
                    {settings.payment?.upiQrUrl ? (
                      <div className="mt-2 p-2 rounded bg-white/5 border border-white/10">
                        <img
                          src={settings.payment.upiQrUrl}
                          alt="UPI QR"
                          className="max-h-32 object-contain"
                        />
                      </div>
                    ) : null}
                    {uploadingKey === "payment.upiQrUrl" && (
                      <p className="text-xs opacity-70 mt-1">Uploading…</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Bank */}
              <section>
                <h3 className="font-semibold mb-2">Bank Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm opacity-80 mb-1">Bank Name</label>
                    <input
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                      value={settings.bank.bankName ?? ""}
                      onChange={(e) => setField("bank.bankName", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm opacity-80 mb-1">Branch</label>
                    <input
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                      value={settings.bank.branch ?? ""}
                      onChange={(e) => setField("bank.branch", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm opacity-80 mb-1">Account Number</label>
                    <input
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                      value={settings.bank.accountNumber ?? ""}
                      onChange={(e) => setField("bank.accountNumber", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm opacity-80 mb-1">IFSC</label>
                    <input
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                      value={settings.bank.ifsc ?? ""}
                      onChange={(e) => setField("bank.ifsc", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm opacity-80 mb-1">Account Holder Name</label>
                    <input
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                      value={settings.bank.accountName ?? ""}
                      onChange={(e) => setField("bank.accountName", e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* Terms / Declaration */}
              <section>
                <h3 className="font-semibold mb-2">Terms / Declaration</h3>
                <textarea
                  className="w-full min-h-[120px] px-3 py-2 rounded-lg bg-white/10 border border-white/20"
                  placeholder="Any terms & conditions you want to show on invoices…"
                  value={settings.terms ?? ""}
                  onChange={(e) => setField("terms", e.target.value)}
                />
              </section>

              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin h-8 w-8 rounded-full border-2 border-white/30 border-t-white" />
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 border-t border-white/10 flex items-center justify-end gap-3">
              <button className="px-4 py-2 rounded-lg border border-white/20" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
                onClick={handleSave}
                disabled={saving || !!uploadingKey}
                title={uploadingKey ? "Please wait for uploads to finish" : ""}
              >
                {saving ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </div>

          {showSignaturePad &&
            createPortal(
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
                <div className="bg-white text-slate-900 rounded-lg p-4 w-[90vw] max-w-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">Draw Signature</div>
                    <button onClick={() => setShowSignaturePad(false)}>✕</button>
                  </div>
                  <canvas ref={canvasRef} width={500} height={200} className="border w-full bg-white" />
                  <div className="mt-3 flex gap-2 justify-end">
                    <button
                      className="px-3 py-1 rounded border"
                      onClick={() => {
                        const c = canvasRef.current;
                        const ctx = c.getContext("2d");
                        ctx.clearRect(0, 0, c.width, c.height);
                      }}
                    >
                      Clear
                    </button>
                    <button
                      className="px-3 py-1 rounded bg-emerald-500 text-white"
                      onClick={uploadCanvasSignature}
                      disabled={uploadingKey === "branding.signatureUrl"}
                    >
                      Use
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )}
        </div>,
        document.body
      )
    : null;
}