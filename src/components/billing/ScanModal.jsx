import React, { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { db } from "../../firebase/firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

/**
 * ScanModal – safe & robust modal QR/barcode scanner.
 * - Starts camera ONLY when `open` is true
 * - Properly stops tracks on close/unmount
 * - Torch toggle when supported
 * - Manual input fallback for USB scanners / pasted codes
 */

// ---------- helpers ----------
const base64urlToJson = (str) => {
  try {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
};

const isUnifiedPayload = (obj) =>
  obj && obj.t === "product" && typeof obj.v === "number" && obj.id;

const beep = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.06;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 130);
  } catch {}
};

const normalizeToCartLine = (productId, p, batchId) => ({
  productId,
  productName: p.productName || p.name || "Item",
  brand: p.brand || "",
  unit: p.unit || p.packSize || "",
  sku: p.sku || p.code || "",
  price: p.sell ?? p.sellingPrice ?? p.price ?? 0,
  gstRate: p.gstRate ?? p.taxRate ?? 0,
  qty: 1,
  ...(batchId ? { batchId } : {}),
});

export default function ScanModal({ open = true, userId, onClose, onAddToCart }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const lastCodeRef = useRef("");
  const trackRef = useRef(null);

  const stopReader = useCallback(() => {
    try { readerRef.current?.reset(); } catch {}
    if (trackRef.current) {
      try { trackRef.current.stop(); } catch {}
      trackRef.current = null;
    }
    const stream = videoRef.current?.srcObject;
    if (stream) {
      try { stream.getTracks().forEach((t) => t.stop()); } catch {}
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {}
    }
  }, []);

  // Torch toggle (when supported by the camera)
  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      const caps = track.getCapabilities?.();
      if (caps && caps.torch) {
        await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
        setTorchOn((v) => !v);
      }
    } catch {}
  }, [torchOn]);

  useEffect(() => {
    let cancelled = false;
    if (!open) {
      stopReader();
      return undefined;
    }

    const start = async () => {
      try {
        setError("");
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const preferred =
          devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ||
          undefined;

        await reader.decodeFromVideoDevice(
          preferred,
          videoRef.current,
          async (result, err, controls) => {
            if (cancelled) return;
            // ZXing sends NotFoundException repeatedly while scanning; ignore it
            if (err && err?.name !== "NotFoundException") {
              // show one-time error but keep scanning
              console.debug("ZXing error:", err);
            }
            if (!result) return;

            // Save track for torch support once stream is live
            try {
              const stream = videoRef.current?.srcObject;
              const track = stream?.getVideoTracks?.()[0];
              if (track && !trackRef.current) {
                trackRef.current = track;
                const caps = track.getCapabilities?.();
                setTorchSupported(Boolean(caps?.torch));
              }
            } catch {}

            const text = (result.getText?.() || "").trim();
            if (!text || text === lastCodeRef.current) return;
            lastCodeRef.current = text; // debounce dup frames

            setBusy(true);
            try {
              await handleScannedText(text);
              beep();
            } catch (e) {
              console.error(e);
              setError(e.message || "Failed to process code.");
            } finally {
              setBusy(false);
              setTimeout(() => { lastCodeRef.current = ""; }, 800);
            }
          }
        );
      } catch (e) {
        console.error("Scanner init error:", e);
        setError(
          "Camera is unavailable. Please grant permission or try a different device."
        );
      }
    };

    start();
    return () => { cancelled = true; stopReader(); };
  }, [open, stopReader]);

  const addByProductId = useCallback(async (bid, pid, batchId) => {
    const ref = doc(db, "businesses", bid, "products", pid);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Product not found for this QR");
    const p = snap.data();
    onAddToCart(normalizeToCartLine(pid, p, batchId));
  }, [onAddToCart]);

  const addBySku = useCallback(async (bid, code) => {
    const col = collection(db, "businesses", bid, "products");
    const q = query(col, where("sku", "==", code));
    const res = await getDocs(q);
    if (res.empty) throw new Error("Code not recognized");
    const d = res.docs[0];
    onAddToCart(normalizeToCartLine(d.id, d.data(), null));
  }, [onAddToCart]);

  const handleScannedText = useCallback(async (raw) => {
    // 1) Unified base64url payload
    const maybe = base64urlToJson(raw);
    if (isUnifiedPayload(maybe)) {
      const bid = maybe.bid || userId; // fallback to current tenant
      await addByProductId(bid, maybe.id, maybe.b);
      return;
    }
    // 2) Deep link with ?q=payload
    if (/^https?:\/\/.+/.test(raw)) {
      try {
        const url = new URL(raw);
        const q = url.searchParams.get("q");
        if (q) {
          const json = base64urlToJson(q);
          if (isUnifiedPayload(json)) {
            const bid = json.bid || userId;
            await addByProductId(bid, json.id, json.b);
            return;
          }
        }
      } catch {}
    }
    // 3) Legacy: treat as SKU/barcode under current tenant
    await addBySku(userId, raw);
  }, [userId, addByProductId, addBySku]);

  const submitManual = async () => {
    const code = manual.trim();
    if (!code) return;
    setBusy(true);
    setError("");
    try {
      await handleScannedText(code);
      setManual("");
      beep();
    } catch (e) {
      setError(e.message || "Could not resolve code");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null; // render nothing when closed

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={() => { stopReader(); onClose(); }} />

      <div className="relative w-[92%] max-w-xl rounded-2xl overflow-hidden border border-white/10 bg-[#0B0F14]/80 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.55)] text-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="font-semibold">Scan Product QR / Barcode</h3>
          <button
            onClick={() => { stopReader(); onClose(); }}
            className="px-2 py-1 rounded hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <div className="rounded-xl overflow-hidden border border-white/10 aspect-video bg-black/50 relative">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {torchSupported && (
              <button
                onClick={toggleTorch}
                className="absolute right-2 top-2 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                type="button"
              >
                {torchOn ? "Torch Off" : "Torch On"}
              </button>
            )}
          </div>

          {busy && (
            <div className="mt-2 text-emerald-300 text-sm">Adding to cart…</div>
          )}
          {error && (
            <div className="mt-2 text-rose-300 text-sm">{error}</div>
          )}

          {/* Manual entry / USB scanner fallback */}
          <div className="mt-3 flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitManual()}
              placeholder="Paste/enter code if camera is unavailable…"
              className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm placeholder-white/50 outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button
              onClick={submitManual}
              className="px-3 py-2 text-sm rounded-lg font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
              type="button"
            >
              Add
            </button>
          </div>

          <div className="mt-3 text-xs text-white/60">
            Tip: Use the rear camera on mobile for best results. Works for both FLYP QRs and regular barcodes (SKU lookup).
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => { stopReader(); onClose(); }}
              className="px-4 py-2 rounded-xl font-medium text-slate-900 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 hover:shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

ScanModal.propTypes = {
  open: PropTypes.bool,
  userId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onAddToCart: PropTypes.func.isRequired, // (line) => void
};