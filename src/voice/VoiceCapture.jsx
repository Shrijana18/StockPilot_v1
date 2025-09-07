import React, { useEffect, useMemo, useRef, useState } from "react";
import LiveCaption from "../components/billing/LiveCaption";
import { useSpeechStream } from "../hooks/useSpeechStream";

/**
 * VoiceCapture
 * Premium UI/UX wrapper around useSpeechStream that shows live captions while listening
 * and a persistent transcript. Finalizes on Stop (or auto after silence via hook).
 *
 * Props:
 *  - onFinalize?: (text: string) => void  // called when user presses Stop & Apply
 *  - autoStopSilenceMs?: number           // pass-through to hook (default 1200)
 *  - onParsedResult?: (parsed: object) => void // receives parsed JSON from cloud-fn
 */
export default function VoiceCapture({ onFinalize, onParsedResult, autoStopSilenceMs = 1200 }) {
  const [err, setErr] = useState("");
  const [startedAt, setStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const appliedOnceRef = useRef(false);

  const {
    isListening,
    start,
    stop,
    fullText,
    segments,
    livePartial,
    reset,
  } = useSpeechStream({ autoStopSilenceMs });

  // Elapsed timer while listening
  useEffect(() => {
    let id;
    if (isListening) {
      setStartedAt(Date.now());
      id = setInterval(() => setElapsed(Date.now() - (startedAt || Date.now())), 200);
    } else {
      setStartedAt(null);
      setElapsed(0);
    }
    return () => id && clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  const prettyElapsed = useMemo(() => {
    if (!elapsed) return "00:00";
    const s = Math.floor(elapsed / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [elapsed]);

  const handleStart = async () => {
    setErr("");
    appliedOnceRef.current = false;
    try {
      await start();
    } catch (e) {
      const msg = (e && (e.message || e.toString())) || "Failed to start voice";
      setErr(msg);
    }
  };

  const handleStop = async () => {
    try {
      stop();
    } finally {
      // avoid double-calling onFinalize if hook also auto-stops
      if (!appliedOnceRef.current) {
        const t = (fullText || "").trim();
        if (t && typeof onFinalize === "function") {
          console.log("[VoiceCapture] Final recognized text:", t);
          onFinalize(t);

          // 🔁 Send to parser function
          try {
            const res = await fetch("https://us-central1-stockpilotv1.cloudfunctions.net/parseVoice", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: t }),
            });
            const parsed = await res.json();
            console.log("🎯 Parsed result:", parsed);
            if (typeof onParsedResult === "function") onParsedResult(parsed);
          } catch (err) {
            console.error("❌ Failed to parse voice command:", err);
          }

          appliedOnceRef.current = true;
        }
      }
    }
  };

  const handleClear = () => {
    if (isListening) return; // guarded by disabled, but be safe
    setErr("");
    appliedOnceRef.current = false;
    reset();
  };

  // Keyboard shortcuts: Space = start/stop, Esc = stop, Ctrl/Cmd+K = clear (when idle)
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)) {
        return; // don't hijack typing
      }
      // Space to toggle
      if (e.code === "Space") {
        e.preventDefault();
        if (!isListening) handleStart(); else handleStop();
      }
      // Esc to stop
      if (e.key === "Escape" && isListening) {
        e.preventDefault();
        handleStop();
      }
      // Ctrl/Cmd+K to clear when idle
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !isListening) {
        e.preventDefault();
        handleClear();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isListening]);

  const SegmentsBadge = () => (
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="opacity-75"><circle cx="12" cy="12" r="4"/></svg>
      {segments.length} segment{segments.length !== 1 ? "s" : ""}
    </span>
  );

  const MicIcon = ({ active }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 18v4" stroke="currentColor" strokeWidth="1.5"/>
      {active ? <circle cx="12" cy="2" r="2" fill="currentColor"/> : null}
    </svg>
  );

  const StopIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
    </svg>
  );

  const ClearIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );

  return (
    <div className="w-full p-4 rounded-xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          {isListening ? (
            <span className="relative inline-flex items-center">
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-red-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
          ) : (
            <span className="inline-flex h-2 w-2 rounded-full bg-gray-300" />
          )}
          <span>{isListening ? "Listening…" : "Ready to capture"}</span>
          <span className="text-gray-400">•</span>
          <span className="tabular-nums text-gray-500" title="Elapsed while listening">{prettyElapsed}</span>
        </div>
        <SegmentsBadge />
      </div>

      {/* Live caption area */}
      <div className="mt-3">
        {livePartial && isListening && (
          <div className="text-[13px] italic text-gray-500 mb-2">
            {livePartial}
          </div>
        )}
        <LiveCaption isListening={isListening} transcript={fullText || livePartial} />
        {fullText && !isListening && (
          <div className="mt-2 text-sm text-green-700 font-medium">
            ✅ Recognized: {fullText}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 mt-4">
        {!isListening ? (
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-black text-white hover:opacity-90 active:opacity-80 focus:outline-none focus:ring-2 focus:ring-black/30"
            aria-label="Start listening"
            title="Start (Space)"
          >
            <MicIcon active={false} />
            Start
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStop}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-red-600 text-white hover:opacity-90 active:opacity-80 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            aria-label="Stop listening and apply"
            title="Stop & Apply (Space / Esc)"
          >
            <StopIcon />
            Stop & Apply
          </button>
        )}

        <button
          type="button"
          onClick={handleClear}
          disabled={isListening}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300/60 ${isListening ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Clear transcript"
          title={isListening ? "Stop first to clear" : "Clear (Ctrl/Cmd+K)"}
        >
          <ClearIcon />
          Clear
        </button>
      </div>

      {/* Error + SR live region */}
      {err && (
        <div className="mt-2 text-xs text-red-600" role="status">
          {err}
        </div>
      )}

      {livePartial && (
        <div className="sr-only" aria-live="polite">{livePartial}</div>
      )}
    </div>
  );
}