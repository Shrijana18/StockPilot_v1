import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

// This function remains the same
function calculateFrameQuality(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let totalBrightness = 0;
  let sharpness = 0;
  const laplacianKernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];
  for (let y = 1; y < height - 1; y += 4) {
    for (let x = 1; x < width - 1; x += 4) {
      const i = (y * width + x) * 4;
      const brightness = (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114);
      totalBrightness += brightness;
      let laplace = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const kernelIndex = (ky + 1) * 3 + (kx + 1);
          const pixelIndex = ((y + ky) * width + (x + kx)) * 4;
          const pixelBrightness = (data[pixelIndex] * 0.299) + (data[pixelIndex+1] * 0.587) + (data[pixelIndex+2] * 0.114);
          laplace += pixelBrightness * laplacianKernel[kernelIndex];
        }
      }
      sharpness += laplace * laplace;
    }
  }
  const numPixelsAnalyzed = (width / 4) * (height / 4);
  return {
    brightness: totalBrightness / numPixelsAnalyzed,
    sharpness: sharpness / numPixelsAnalyzed,
  };
}

// The overlay is updated with new animation classes and the laser reticle
function ScanningOverlay({ busy, statusText = "Scanning…", frameQuality = 'poor', statusHint = 'Align product', scanState = 'idle' }) {
  const isGood = frameQuality === 'good';
  const isIdle = scanState === 'idle';
  const isAnalyzing = scanState === 'analyzing';

  let borderColorClass = 'border-red-400 animate-pulse-red';
  if (isIdle) borderColorClass = 'border-white/50';
  if (isGood) borderColorClass = 'border-emerald-300 animate-pulse-green';

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/35" />
      <div className={`absolute inset-4 md:inset-6 rounded-2xl overflow-hidden ring-2 ring-white/20 transition-all duration-300`}>
        
        {/* --- NEW: Sweeping Laser Reticle --- */}
        {isAnalyzing && (
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
            <div className="laser-line"></div>
          </div>
        )}

        {/* Corners now have animation classes */}
        <div className={`absolute top-0 left-0 w-12 h-12 md:w-16 md:h-16 border-t-4 border-l-4 rounded-tl-2xl transition-all duration-300 ${borderColorClass}`} />
        <div className={`absolute top-0 right-0 w-12 h-12 md:w-16 md:h-16 border-t-4 border-r-4 rounded-tr-2xl transition-all duration-300 ${borderColorClass}`} />
        <div className={`absolute bottom-0 left-0 w-12 h-12 md:w-16 md:h-16 border-b-4 border-l-4 rounded-bl-2xl transition-all duration-300 ${borderColorClass}`} />
        <div className={`absolute bottom-0 right-0 w-12 h-12 md:w-16 md:h-16 border-b-4 border-r-4 rounded-br-2xl transition-all duration-300 ${borderColorClass}`} />
      </div>

      <div className="absolute bottom-3 inset-x-0 flex items-center justify-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur text-white text-xs font-medium shadow-lg">
          <span className={`inline-block w-2 h-2 rounded-full transition-colors ${busy ? 'bg-amber-300 animate-pulse' : (isGood ? 'bg-emerald-300' : (isIdle ? 'bg-white/50' : 'bg-red-400'))}`} />
          {busy ? statusText : statusHint}
        </div>
      </div>
    </div>
  );
}

export default function MagicScanDisplay({
  open,
  onClose,
  onCapture,
  busy = false,
  title = "Magic Scan (Live)",
  subtitle = "Align the product in the frame. The scan will trigger automatically when the image is clear.",
  badge,
  batchMode = false,
  statusText = "Scanning…",
  error = "",
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const capturingRef = useRef(false);
  
  const [scanState, setScanState] = useState('idle');
  
  // --- NEW: State to trigger the capture flash animation ---
  const [showCaptureFlash, setShowCaptureFlash] = useState(false);
  
  const [frameQuality, setFrameQuality] = useState('poor');
  const [statusHint, setStatusHint] = useState('Ready to scan');
  const goodFramesCountRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [camError, setCamError] = useState("");
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoom, setZoom] = useState(1);
  const zoomMinRef = useRef(1);
  const zoomMaxRef = useRef(1);

  const [facingMode, setFacingMode] = useState("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(true);

  // ... (startCamera, stopCamera etc. are unchanged)
  const stopCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = null;
      trackRef.current = null;
      if (canvasRef.current) { canvasRef.current.width = 0; canvasRef.current.height = 0; }
    } catch {}
  };

  const startCamera = async () => {
    stopCamera();
    setReady(false);
    setCamError("");
    const constraints = { video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false };
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia(constraints); } catch (e) { setCamError("Camera access failed. Please allow camera permissions."); throw e; }
    streamRef.current = stream;
    const t = stream.getVideoTracks()[0];
    trackRef.current = t;

    // Try enabling continuous focus/exposure/white-balance if supported
    try {
      await t.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
    } catch {}
    try {
      await t.applyConstraints({ advanced: [{ exposureMode: "continuous" }] });
    } catch {}
    try {
      await t.applyConstraints({ advanced: [{ whiteBalanceMode: "continuous" }] });
    } catch {}

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
      } else { setZoomSupported(false); }
    } catch { setTorchSupported(false); setZoomSupported(false); }
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      const waitMeta = new Promise((resolve) => {
        const v = videoRef.current;
        if (!v || v.readyState >= 2) return resolve();
        const onLoaded = () => { v.removeEventListener('loadedmetadata', onLoaded); resolve(); };
        v.addEventListener('loadedmetadata', onLoaded);
      });
      await Promise.race([ waitMeta, new Promise((r) => setTimeout(r, 800)) ]);

      // Ensure canvas matches the real video resolution for crisp OCR frames
      if (canvasRef.current && videoRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const vw = Math.max(1, videoRef.current.videoWidth || 1280);
        const vh = Math.max(1, videoRef.current.videoHeight || 720);
        canvasRef.current.width = Math.round(vw * dpr);
        canvasRef.current.height = Math.round(vh * dpr);
      }

      await videoRef.current.play().catch((err) => {
        console.warn("Initial video play failed, will retry on user interaction.", err)
      });
      setReady(true);
    }
    setTorchOn(false);
  };

  useEffect(() => {
    if (open) {
      setScanState('idle');
      setStatusHint('Ready to scan');
      (async () => {
        try { await startCamera(); } catch (e) { onClose?.(); }
      })();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line
  }, [open, facingMode]);

  useEffect(() => {
    if (open && ready && !busy && scanState === 'analyzing') {
      const stuckTimer = setTimeout(() => {
        setStatusHint('Scan difficult. Try uploading a photo instead.');
      }, 8000);

      let rafId = 0;
      let vfcb = null;
      let lowLightStreak = 0;

      const BRIGHTNESS_MIN = 55;   // slightly higher than before
      const SHARPNESS_MIN  = 18;   // slightly more forgiving for handheld

      const analyze = () => {
        if (!videoRef.current || !canvasRef.current || capturingRef.current) {
          vfcb = videoRef.current && videoRef.current.requestVideoFrameCallback
            ? videoRef.current.requestVideoFrameCallback(analyze)
            : (rafId = requestAnimationFrame(analyze));
          return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const quality = calculateFrameQuality(ctx, canvas.width, canvas.height);

        // Adaptive hints & thresholds
        let isGood = true;
        if (quality.brightness < BRIGHTNESS_MIN) {
          setStatusHint('More light needed');
          isGood = false;
          lowLightStreak++;
        } else if (quality.sharpness < SHARPNESS_MIN) {
          setStatusHint('Hold steady, image is blurry');
          isGood = false;
          lowLightStreak = 0;
        } else {
          lowLightStreak = 0;
        }

        // Auto-torch if repeatedly too dark and supported
        if (lowLightStreak >= 6 && torchSupported && !torchOn) {
          (async () => {
            try {
              await trackRef.current?.applyConstraints({ advanced: [{ torch: true }] });
              setTorchOn(true);
            } catch {}
          })();
          lowLightStreak = 0;
        }

        if (isGood) {
          setFrameQuality('good');
          setStatusHint('Perfect, hold it!');
          goodFramesCountRef.current++;
          if (goodFramesCountRef.current >= 3) {
            handleCapture();
          }
        } else {
          setFrameQuality('poor');
          goodFramesCountRef.current = 0;
        }

        vfcb = videoRef.current && videoRef.current.requestVideoFrameCallback
          ? videoRef.current.requestVideoFrameCallback(analyze)
          : (rafId = requestAnimationFrame(analyze));
      };

      // Kick off the loop
      if (videoRef.current && videoRef.current.requestVideoFrameCallback) {
        vfcb = videoRef.current.requestVideoFrameCallback(analyze);
      } else {
        rafId = requestAnimationFrame(analyze);
      }

      return () => {
        if (vfcb && videoRef.current && videoRef.current.cancelVideoFrameCallback) {
          try { videoRef.current.cancelVideoFrameCallback(vfcb); } catch {}
        }
        if (rafId) cancelAnimationFrame(rafId);
        clearTimeout(stuckTimer);
      };
    }
  }, [open, ready, busy, scanState]);

  const handleCapture = async () => {
    if (capturingRef.current || !ready) return;
    capturingRef.current = true;
    setScanState('capturing');

    // --- NEW: Trigger the capture flash animation ---
    setShowCaptureFlash(true);
    setTimeout(() => setShowCaptureFlash(false), 500); // Reset after animation duration

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const framesBase64 = [];
      for (let i = 0; i < 3; i++) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const b64 = canvas.toDataURL("image/jpeg", 0.92).replace(/^data:image\/jpeg;base64,/, "");
        framesBase64.push(b64);
        await new Promise((r) => setTimeout(r, 180));
      }
      onCapture?.({ base64: framesBase64[0], framesBase64 });
    } finally {
      capturingRef.current = false;
    }
  };

  const handleFlip = () => setFacingMode((m) => (m === "environment" ? "user" : "environment"));
  const handleTorch = async () => {
    try {
      const next = !torchOn;
      await trackRef.current.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {}
  };
  const handleZoom = async (val) => { setZoom(val); try { await trackRef.current.applyConstraints({ advanced: [{ zoom: Number(val) }] }); } catch {} };

  const handleStartAnalysis = () => {
    if (videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch(err => console.warn("Video play failed on click:", err));
    }
    setScanState('analyzing');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm flex items-center justify-center">
      <div className="w-[min(500px,95vw)] rounded-2xl border border-white/15 bg-white/10 shadow-2xl relative overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <div className="font-bold text-lg text-white">{title}</div>
          <div className="text-[11px] text-white/80 mt-1">{subtitle}</div>
        </div>

        <div className="relative mx-5 rounded-2xl overflow-hidden border border-white/20 bg-black/70 mb-4 flex items-center justify-center min-h-[260px]">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-[280px] object-cover" />
          <ScanningOverlay busy={busy} statusText={statusText} frameQuality={frameQuality} statusHint={statusHint} scanState={scanState} />
          
          {/* --- NEW: Capture Flash Overlay --- */}
          {showCaptureFlash && (
            <div className="absolute inset-0 z-30 animate-flash-green pointer-events-none"></div>
          )}

          <canvas ref={canvasRef} className="hidden" data-role="capture-canvas" />

          {scanState === 'idle' && ready && !busy && (
            <div className="absolute inset-0 flex items-center justify-center z-30">
              <button
                type="button"
                onClick={handleStartAnalysis}
                className="px-6 py-3 rounded-xl font-semibold text-white bg-emerald-500/80 hover:bg-emerald-500 shadow-lg backdrop-blur-sm border border-emerald-400/50"
              >
                Start Scanning
              </button>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex items-center justify-center gap-3">
           {scanState === 'analyzing' && (
             <button
               type="button"
               onClick={handleCapture}
               disabled={busy || !ready}
               className="px-4 py-2 rounded-xl font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-lg"
             >
               Scan Now
             </button>
           )}
           <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl font-semibold text-white/80 bg-white/10 border border-white/20 hover:bg-white/20 text-sm" disabled={busy}>
             Cancel
           </button>
           <button type="button" onClick={handleFlip} className="px-3 py-2 rounded-xl text-sm" disabled={busy || !ready}>🔁</button>
           <button type="button" onClick={handleTorch} className="px-3 py-2 rounded-xl text-sm" disabled={busy || !torchSupported || !ready}>🔦</button>
        </div>
      </div>
      
      {/* --- NEW: CSS Animations for the magical effects --- */}
      <style>{`
        @keyframes pulse-red {
          0%, 100% { box-shadow: 0 0 18px rgba(239, 68, 68, 0.45); }
          50% { box-shadow: 0 0 30px rgba(239, 68, 68, 0.7); }
        }
        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.55); }
          50% { box-shadow: 0 0 35px rgba(16, 185, 129, 0.8); }
        }
        .animate-pulse-red { animation: pulse-red 2.5s infinite; }
        .animate-pulse-green { animation: pulse-green 1.5s infinite; }

        @keyframes sweep {
          0% { transform: translateY(-10%); }
          100% { transform: translateY(110%); }
        }
        .laser-line {
          position: absolute;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(110, 231, 183, 0.8), transparent);
          box-shadow: 0 0 10px rgba(110, 231, 183, 0.9);
          animation: sweep 2.2s infinite ease-in-out;
        }

        @keyframes flash-green {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(16, 185, 129, 0.3); }
        }
        .animate-flash-green {
          animation: flash-green 0.5s ease-out;
        }

        canvas[data-role="capture-canvas"] {
          display: none;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>
    </div>
  );
}