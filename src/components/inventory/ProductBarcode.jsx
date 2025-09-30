

import React, { useEffect, useRef, useState } from "react";

/**
 * ProductBarcode.jsx
 * Reusable camera-based scanner for barcodes & QR codes.
 *
 * Props:
 *  - open: boolean (controls visibility)
 *  - onClose: () => void
 *  - onDetected: ({ rawValue, format }) => void
 *  - torch: boolean (optional) enable flashlight when supported
 *
 * Example:
 *   <ProductBarcode
 *     open={scanOpen}
 *     onClose={() => setScanOpen(false)}
 *     onDetected={({ rawValue }) => { setBarcode(rawValue); setScanOpen(false); }}
 *   />
 */
export default function ProductBarcode({ open, onClose, onDetected, torch = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const detectorRef = useRef(null);

  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!open) return;

    let stopped = false;

    const cleanup = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;

      if (videoRef.current) {
        try { videoRef.current.pause(); } catch {}
        videoRef.current.srcObject = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setActive(false);
    };

    const init = async () => {
      setError("");
      setActive(true);

      // 1) API support check
      const hasAPI = "BarcodeDetector" in window;
      if (!hasAPI) {
        setSupported(false);
        setActive(false);
        return;
      }

      try {
        // 2) Init the detector
        const formats = [
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "code_128",
          "code_39",
          "qr_code",
          "pdf417",
          "aztec",
          "data_matrix",
        ];
        detectorRef.current = new window.BarcodeDetector({ formats });

        // 3) Start camera
        const constraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stopped) return; // in case user closed quickly

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          // Torch attempt (best-effort)
          if (torch) {
            try {
              const track = stream.getVideoTracks()[0];
              const capabilities = track.getCapabilities?.() || {};
              if (capabilities.torch) {
                await track.applyConstraints({ advanced: [{ torch: true }] });
              }
            } catch {
              // ignore torch errors
            }
          }

          const tick = async () => {
            if (!videoRef.current || videoRef.current.readyState !== 4) {
              rafRef.current = requestAnimationFrame(tick);
              return;
            }
            try {
              const results = await detectorRef.current.detect(videoRef.current);
              if (results && results.length) {
                const { rawValue, format } = results[0];
                cleanup();
                onDetected?.({ rawValue, format });
                return;
              }
            } catch {
              // transient failures are normal; keep scanning
            }
            rafRef.current = requestAnimationFrame(tick);
          };

          tick();
        }
      } catch (e) {
        setError(e?.message || "Unable to access camera");
        setActive(false);
      }
    };

    init();

    return () => {
      stopped = true;
      cleanup();
    };
  }, [open, onDetected, torch]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/70 backdrop-blur-sm flex items-center justify-center">
      <div className="relative bg-white w-[min(92vw,760px)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-lg font-semibold">
              {supported ? "Scan Barcode / QR" : "Scanner Not Supported"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        {/* Body */}
        {!supported ? (
          <div className="p-6 text-sm">
            <p className="font-medium mb-2">
              Your browser doesn’t support the Barcode Detection API.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>Try Chrome on Android or a recent desktop Chromium browser.</li>
              <li>You can still type or paste the code manually in the form.</li>
              <li>We can add a fallback library (Quagga2 / html5-qrcode) later if you need iOS Safari support.</li>
            </ul>
          </div>
        ) : (
          <>
            <div className="relative bg-black">
              <video
                ref={videoRef}
                className="w-full max-h-[65vh] object-contain"
                playsInline
                muted
              />
              {/* Guide overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-[80%] h-44 border-2 border-white/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"></div>
              </div>
              {/* Status chip */}
              <div className="absolute left-4 bottom-4 text-[11px] bg-white/90 text-gray-800 px-2.5 py-1 rounded-full">
                {active ? "Scanning…" : "Idle"}
              </div>
            </div>
            <div className="p-3 text-center text-xs text-gray-600">
              Align the code within the box. It auto-detects EAN/UPC/Code128/QR.
              {error ? <div className="text-red-600 mt-2">{error}</div> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}