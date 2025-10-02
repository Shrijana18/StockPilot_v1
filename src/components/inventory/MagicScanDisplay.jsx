import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { BrowserMultiFormatReader } from "@zxing/library";

/**
 * MagicScanDisplay (v2)
 * - Polished, animated scanner UI
 * - Owns camera lifecycle
 * - Flip & Torch controls (where supported)
 * - Emits base64 JPEG (no data: prefix) through onCapture(base64)
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onCapture: ({ base64: string, barcode?: string }) => void
 *  - busy?: boolean
 *  - title?: string
 *  - subtitle?: string
 *  - badge?: string // e.g., "Batch mode"
 */

function ScanningOverlay({ busy, statusText = "Scanning…" }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/35" />

      {/* scan window */}
      <div className="absolute inset-4 md:inset-6 rounded-2xl overflow-hidden ring-2 ring-emerald-300/40 shadow-[0_0_40px_rgba(16,185,129,0.15)_inset]">
        {/* parallax grid */}
        <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" className="text-white" />
        </svg>

        {/* neon corners */}
        <div className="absolute top-0 left-0 w-12 h-12 md:w-16 md:h-16 border-t-4 border-l-4 border-emerald-300 rounded-tl-2xl shadow-[0_0_22px_rgba(16,185,129,.55)]" />
        <div className="absolute top-0 right-0 w-12 h-12 md:w-16 md:h-16 border-t-4 border-r-4 border-emerald-300 rounded-tr-2xl shadow-[0_0_22px_rgba(16,185,129,.55)]" />
        <div className="absolute bottom-0 left-0 w-12 h-12 md:w-16 md:h-16 border-b-4 border-l-4 border-emerald-300 rounded-bl-2xl shadow-[0_0_22px_rgba(16,185,129,.55)]" />
        <div className="absolute bottom-0 right-0 w-12 h-12 md:w-16 md:h-16 border-b-4 border-r-4 border-emerald-300 rounded-br-2xl shadow-[0_0_22px_rgba(16,185,129,.55)]" />

        {/* sweep line */}
        <div className={`absolute inset-x-0 h-0.5 md:h-[3px] bg-gradient-to-r from-transparent via-white to-transparent ${busy ? 'animate-scanLine' : ''}`} />

        {/* reticle */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border border-white/40 backdrop-blur-[1px]" />
          <div className="absolute w-8 h-px bg-white/50" />
          <div className="absolute h-8 w-px bg-white/50" />
        </div>
      </div>

      {/* status chip */}
      <div className="absolute bottom-3 inset-x-0 flex items-center justify-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur text-white text-xs font-medium shadow-lg">
          <span className={`inline-block w-2 h-2 rounded-full ${busy ? 'bg-amber-300 animate-pulse' : 'bg-emerald-300'}`} />
          {busy ? statusText : "Ready"}
        </div>
      </div>

      <style>{`
        @keyframes scanLine { 0% { transform: translateY(12%); opacity:.9 } 50%{ opacity:.7 } 100% { transform: translateY(88%); opacity:.9 } }
        .animate-scanLine { animation: scanLine 2.1s linear infinite; }
      `}</style>
    </div>
  );
}

export default function MagicScanDisplay({
  open,
  onClose,
  onCapture,   // (base64NoPrefix: string) => void
  busy = false,
  title = "Magic Scan (Live)",
  subtitle = "Align the product, hold steady, then tap Scan. We'll capture a quick burst for accuracy.",
  badge,
  batchMode = false,
  statusText = "Scanning…",
  error = "",
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const zxingRef = useRef(null);
  const capturingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState("");
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoom, setZoom] = useState(1);
  const zoomMinRef = useRef(1);
  const zoomMaxRef = useRef(1);

  const [facingMode, setFacingMode] = useState("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(true);

  const stopCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = null;
      trackRef.current = null;
      if (zxingRef.current && typeof zxingRef.current.reset === 'function') {
        try { zxingRef.current.reset(); } catch {}
      }
    } catch {}
  };

  const startCamera = async () => {
    // stop old
    stopCamera();
    setReady(false);
    setCamError("");
    const constraints = {
      video: {
        facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      setCamError("Camera access failed. Please allow camera permissions.");
      throw e;
    }
    streamRef.current = stream;
    const t = stream.getVideoTracks()[0];
    trackRef.current = t;

    try {
      const caps = t?.getCapabilities?.() || {};
      setTorchSupported(!!("torch" in caps));
      if (typeof caps.zoom === "number" || (caps.zoom && (caps.zoom.min !== undefined))) {
        setZoomSupported(true);
        const min = caps.zoom?.min ?? 1;
        const max = caps.zoom?.max ?? 1;
        zoomMinRef.current = min;
        zoomMaxRef.current = max;
        setZoom(Math.max(1, min));
      } else {
        setZoomSupported(false);
      }
    } catch { setTorchSupported(false); setZoomSupported(false); }

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      // wait for metadata so videoWidth/Height are non-zero
      const waitMeta = new Promise((resolve) => {
        const v = videoRef.current;
        if (!v) return resolve();
        if (v.readyState >= 2) return resolve();
        const onLoaded = () => { v.removeEventListener('loadedmetadata', onLoaded); resolve(); };
        v.addEventListener('loadedmetadata', onLoaded);
      });
      await Promise.race([
        waitMeta,
        new Promise((r) => setTimeout(r, 800)), // safety timeout
      ]);
      await videoRef.current.play().catch(() => {});
      setReady(true);
    }
    setTorchOn(false);

    if (!zxingRef.current) {
      try { zxingRef.current = new BrowserMultiFormatReader(); } catch {}
    }
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    (async () => {
      try { await startCamera(); } catch (e) { onClose?.(); }
    })();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line
  }, [open, facingMode]);

  const handleFlip = () => setFacingMode((m) => (m === "environment" ? "user" : "environment"));

  const handleTorch = async () => {
    try {
      const track = trackRef.current;
      if (!track?.getCapabilities) return;
      const caps = track.getCapabilities();
      if (!("torch" in caps)) return;
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {}
  };

  const handleZoom = async (val) => {
    setZoom(val);
    try {
      const track = trackRef.current;
      if (!track?.applyConstraints) return;
      await track.applyConstraints({ advanced: [{ zoom: Number(val) }] });
    } catch {}
  };

  const handleCapture = async () => {
    if (capturingRef.current) return; // debounce
    if (!videoRef.current || !canvasRef.current) return;
    if (!ready) return;
    capturingRef.current = true;
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext("2d");

      // Capture a short burst (3 frames, ~180ms apart)
      const framesBase64 = [];
      for (let i = 0; i < 3; i++) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const b64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
        framesBase64.push(b64);
        // allow autofocus/exposure to settle slightly
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 180));
      }

      // Optional: try to decode barcode from the middle frame
      let detectedBarcode = "";
      try {
        if (zxingRef.current && framesBase64.length) {
          const midFrame = framesBase64[Math.min(1, framesBase64.length - 1)];
          const img = new Image();
          await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = `data:image/jpeg;base64,${midFrame}`; });
          const result = await zxingRef.current.decodeFromImageElement(img);
          if (result && result.text) detectedBarcode = String(result.text).trim();
        }
      } catch {}

      // Emit burst + first frame for backward compatibility
      onCapture?.({ base64: framesBase64[0], framesBase64, barcode: detectedBarcode });
    } finally {
      capturingRef.current = false;
    }
  };

  if (!open) {
    stopCamera();
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm flex items-center justify-center">
      <div className="w-[min(500px,95vw)] rounded-2xl border border-white/15 bg-white/10 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="font-bold text-lg text-white flex items-center gap-2">
              <span className="text-2xl">🧠</span>
              <span>{title}</span>
            </div>
            {(badge || batchMode) && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-300/40">
                {badge || "Batch mode"}
              </span>
            )}
          </div>
          <div className="text-[11px] text-white/80 mt-1">{subtitle}</div>
        </div>

        {(camError || error) && (
          <div className="mx-5 -mt-2 mb-3 px-3 py-2 rounded-lg bg-red-600/80 text-white text-xs shadow">
            {camError || error}
          </div>
        )}

        {/* Video stage */}
        <div className="relative mx-5 rounded-2xl overflow-hidden border border-white/20 bg-black/70 mb-4 flex items-center justify-center min-h-[260px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-[280px] object-cover"
            style={{ background: "#000" }}
          />
          <ScanningOverlay busy={busy} statusText={statusText} />
          {!ready && (
            <div className="absolute bottom-3 left-3 text-[11px] px-2 py-1 rounded bg-black/60 text-white/80">Starting camera…</div>
          )}
          <canvas ref={canvasRef} className="hidden" />

          {/* Torch badge if unsupported */}
          {!torchSupported && (
            <div className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded bg-black/60 text-white/80">
              Torch unavailable on this device
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-5 pb-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleCapture}
            className="px-5 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-500 via-pink-400 to-orange-400 shadow-lg hover:shadow-xl text-base flex items-center gap-2 disabled:opacity-50"
            disabled={busy || !ready}
          >
            {busy ? "Scanning..." : "Scan Now"}
          </button>
          <button
            type="button"
            onClick={handleFlip}
            className="px-3 py-2 rounded-xl font-semibold text-white/90 bg-white/10 border border-white/20 hover:bg-white/20 text-sm"
            disabled={busy || !ready}
            title="Flip camera"
          >
            🔁 Flip
          </button>
          <button
            type="button"
            onClick={handleTorch}
            className="px-3 py-2 rounded-xl font-semibold text-white/90 bg-white/10 border border-white/20 hover:bg-white/20 text-sm disabled:opacity-50"
            disabled={busy || !torchSupported || !ready}
            title={torchSupported ? (torchOn ? 'Turn torch off' : 'Turn torch on') : 'Torch not supported'}
          >
            🔦 Torch
          </button>
          {zoomSupported && (
            <div className="flex items-center gap-2 text-white/80 text-xs ml-1">
              <span>Zoom</span>
              <input
                type="range"
                min={zoomMinRef.current}
                max={zoomMaxRef.current}
                step={0.1}
                value={zoom}
                onChange={(e) => handleZoom(e.target.value)}
              />
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl font-semibold text-white/80 bg-white/10 border border-white/20 hover:bg-white/20 text-sm"
            disabled={busy || !ready}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

MagicScanDisplay.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  onCapture: PropTypes.func,
  busy: PropTypes.bool,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  badge: PropTypes.string,
  batchMode: PropTypes.bool,
  statusText: PropTypes.string,
  error: PropTypes.string,
};
