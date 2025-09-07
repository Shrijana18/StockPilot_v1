import { useRef, useState, useMemo } from "react";

const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

async function connectWsWithFallback(candidates, timeoutMs = 7000) {
  for (const url of uniq(candidates)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const ws = await new Promise((resolve, reject) => {
        const sock = new WebSocket(url);
        let done = false;
        const to = setTimeout(() => {
          if (done) return;
          done = true;
          try { sock.close(); } catch {}
          reject(new Error(`WS timeout: ${url}`));
        }, timeoutMs);
        sock.binaryType = "arraybuffer";
        sock.onopen = () => { if (done) return; done = true; clearTimeout(to); resolve(sock); };
        sock.onerror = (e) => { if (done) return; done = true; clearTimeout(to); reject(e); };
        sock.onclose = () => { /* ignore close during connect */ };
      });
      return ws;
    } catch (e) {
      console.warn("WS connect failed:", e?.message || e, "— trying next…");
    }
  }
  throw new Error("All WS endpoints failed");
}

/**
 * useSpeechStream
 * Maintains a rolling transcript that never disappears while listening.
 * - segments[] holds finalized chunks
 * - livePartial holds the latest interim text
 * - fullText joins both for UI display
 *
 * Env: VITE_SPEECH_WS_URL (wss://<cloud-run-streamer>) or VITE_VOICE_STREAMER_URL (https base)
 */
// Returns:
// { start, stop, reset, clearSegments, connectionState, lastPartial, segments: [{id,text}], fullText, isListening, status, error }
export function useSpeechStream({ autoStopSilenceMs = 1200, onFinalize } = {}) {
  const wsRef = useRef(null);
  const mediaRef = useRef(null);
  const audioCtxRef = useRef(null);
  const workletRef = useRef(null);
  const silenceTimer = useRef(null);

  const [isListening, setIsListening] = useState(false);
  const [segments, setSegments] = useState([]); // finalized phrases
  const [livePartial, setLivePartial] = useState(""); // interim caption
  const [status, setStatus] = useState("idle"); // idle | request-mic | connecting | listening | closed | error
  const segIdRef = useRef(0);
  const [error, setError] = useState("");

  const resetSilenceTimer = () => {
    if (!autoStopSilenceMs) return;
    clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(() => stop(), autoStopSilenceMs);
  };

  const start = async () => {
    if (isListening) return;
    setSegments([]);
    setLivePartial("");
    setError("");
    setStatus("request-mic");

    try {
      // 1) Get mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
      mediaRef.current = stream;

      // 2) Build WS candidates (prefer explicit WS URL; else derive from HTTP base)
      const explicit = (import.meta.env.VITE_SPEECH_WS_URL || "").replace(/\/$/, "");
      const base = (import.meta.env.VITE_VOICE_STREAMER_URL || "")
        .replace(/\/$/, "")
        .replace(/^https:/, "wss:");

      let candidates = [];
      if (explicit) {
        candidates = [explicit, explicit + "/ws", explicit + "/stream"]; // try root then common paths
      } else if (base) {
        candidates = [base + "/ws", base + "/stream"]; // server commonly exposes these
      } else {
        throw new Error("Voice WS URL missing (set VITE_SPEECH_WS_URL or VITE_VOICE_STREAMER_URL)");
      }
      candidates = uniq(candidates);

      setStatus("connecting");
      const ws = await connectWsWithFallback(candidates);
      wsRef.current = ws;
      try { ws.binaryType = "arraybuffer"; } catch {}


      // 3) Send CONFIG then START so server creates recognizer before audio
      const configMsg = {
        type: "config",
        lang: "en-IN",
        sampleRate: 16000, // \u274c do not send 48000 if server expects 16k
        format: "pcm16",
        punctuation: true,
        altLangs: ["hi-IN", "mr-IN"],
        hints: Array.isArray(window.__PRODUCT_HINTS__)
          ? window.__PRODUCT_HINTS__.slice(0, 300)
          : ["Dabur", "Dabur Red Paste", "Colgate", "Closeup", "Parachute", "Haldiram", "Nivea", "Clinic Plus", "Surf Excel", "Tide"],
      };
      ws.send(JSON.stringify(configMsg));
      ws.send(JSON.stringify({ type: "start" }));

      // 4) Audio: create context @48k (browser default) but resample -> 16k in the worklet
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 48000 });
      audioCtxRef.current = audioCtx;

      // Load (or re-use) encoder worklet that resamples to 16k and emits 320-sample Int16 frames
      await audioCtx.audioWorklet.addModule("/worklets/pcm16-encoder.js");
      const source = audioCtx.createMediaStreamSource(stream);
      const encoder = new AudioWorkletNode(audioCtx, "pcm16-encoder", {
        processorOptions: { targetRate: 16000, frameSize: 320 }, // 20ms @16k
      });
      workletRef.current = encoder;

      encoder.port.onmessage = ({ data }) => {
        console.debug("[pcm16] sending", data?.length, "samples");
        // data is an Int16Array (already resampled to 16k, 20ms frames)
        if (!data || !data.buffer) return;
        // simple energy check for silence auto-stop
        let energetic = 0;
        const view = data; // Int16Array
        for (let i = 0; i < view.length; i++) {
          if (Math.abs(view[i]) > 100) { // ~0.003 in float terms
            energetic++;
            if (energetic > 8) break;
          }
        }
        if (energetic > 8) resetSilenceTimer();

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try { 
            wsRef.current.send(view.buffer);
            console.debug("[ws] sent frame:", view?.length, "samples");
          } catch {}
        }
      };

      source.connect(encoder);
      setIsListening(true);
      setStatus("listening");

      // 5) Transcript handling — support multiple server shapes & Blob frames
      ws.onmessage = (evt) => {
        const handleMsg = (msg) => {
          console.log("[🎤 WS Message]:", msg);
          if (!msg || typeof msg !== "object") return;

          // Ignore noise/status frames
          if (msg.type === "hello") return;
          if (msg.type === "status") return;
          if (msg.type === "error" && typeof msg.message === "string") {
            console.error("[useSpeechStream] STT/Streamer error:", msg.message);
            setError(msg.message);
            return;
          }

          // 1) { type: "transcript", final: true|false, text }
          if (msg.type === "transcript" && typeof msg.text === "string") {
            if (msg.final === false || msg.partial === true) {
              setLivePartial(msg.text);
              return;
            }
            if (msg.final === true) {
              const text = msg.text;
              if (text) {
                setSegments((prev) => {
                  const id = ++segIdRef.current;
                  const updated = [...prev, { id, text }];
                  const joined = updated.map(s => s.text).join(" ").trim();
                  console.log("[useSpeechStream] Finalized:", joined);
                  if (typeof onFinalize === "function") onFinalize(joined);
                  return updated;
                });
              }
              setLivePartial("");
              return;
            }
          }

          // 2) { type: "partial" | "final", text }
          if ((msg.type === "partial" || msg.type === "final") && typeof msg.text === "string") {
            if (msg.type === "partial") { setLivePartial(msg.text); return; }
            if (msg.type === "final") {
              const text = msg.text;
              if (text) {
                setSegments((prev) => {
                  const id = ++segIdRef.current;
                  const updated = [...prev, { id, text }];
                  const joined = updated.map(s => s.text).join(" ").trim();
                  console.log("[useSpeechStream] Finalized:", joined);
                  if (typeof onFinalize === "function") onFinalize(joined);
                  return updated;
                });
              }
              setLivePartial("");
              return;
            }
          }

          // 3) { event: "transcript", isFinal: true|false, text }
          if (msg.event === "transcript" && typeof msg.text === "string") {
            if (msg.isFinal === false) { setLivePartial(msg.text); return; }
            if (msg.isFinal === true) {
              const text = msg.text;
              setSegments((prev) => {
                const id = ++segIdRef.current;
                const updated = [...prev, { id, text }];
                const joined = updated.map(s => s.text).join(" ").trim();
                console.log("[useSpeechStream] Finalized:", joined);
                if (typeof onFinalize === "function") onFinalize(joined);
                return updated;
              });
              setLivePartial("");
              return;
            }
          }

          // 4) Google proxy: { results:[{ alternatives:[{ transcript }], isFinal }]}
          if (Array.isArray(msg.results) && msg.results.length) {
            const r = msg.results[0];
            const alt = r?.alternatives?.[0];
            const text = alt?.transcript || "";
            if (!text) return;
            if (r.isFinal === false) { setLivePartial(text); return; }
            if (r.isFinal === true) {
              setSegments((prev) => {
                const id = ++segIdRef.current;
                const updated = [...prev, { id, text }];
                const joined = updated.map(s => s.text).join(" ").trim();
                console.log("[useSpeechStream] Finalized:", joined);
                if (typeof onFinalize === "function") onFinalize(joined);
                return updated;
              });
              setLivePartial("");
              return;
            }
          }

          // Debug: log unknown shapes (first few only)
          if (!window.__VOICE_DEBUG_COUNT) window.__VOICE_DEBUG_COUNT = 0;
          if (window.__VOICE_DEBUG_COUNT < 5) {
            console.warn("[useSpeechStream] Unrecognized WS msg shape:", msg);
            window.__VOICE_DEBUG_COUNT++;
          }
        };

        try {
          // Some browsers deliver JSON as Blob/ArrayBuffer — normalize to object
          if (typeof evt.data === "string") {
            handleMsg(JSON.parse(evt.data));
            return;
          }
          if (evt.data instanceof Blob) {
            evt.data.text().then(t => { try { handleMsg(JSON.parse(t)); } catch {} });
            return;
          }
          if (evt.data instanceof ArrayBuffer) {
            const t = new TextDecoder("utf-8").decode(new Uint8Array(evt.data));
            try { handleMsg(JSON.parse(t)); } catch {}
            return;
          }
          // Ignore pure binary (audio) echoes or unknown frames
        } catch (e) {
          console.error("[useSpeechStream] onmessage parse error:", e);
        }
      };

      ws.onerror = async (e) => {
        console.error("speech ws error", e);
        setError("WebSocket error. Check voice streamer service");
        setStatus("error");
        await safeTearDown();
      };

      ws.onclose = () => {
        setStatus("closed");
      };
    } catch (e) {
      console.error(e);
      setError(e?.message || "Microphone or audio context error");
      setStatus("error");
      await safeTearDown();
    }
  };

  const safeTearDown = async () => {
    clearTimeout(silenceTimer.current);
    try { if (workletRef.current) workletRef.current.port.onmessage = null; } catch {}
    try { if (audioCtxRef.current && audioCtxRef.current.state !== "closed") await audioCtxRef.current.close(); } catch {}
    audioCtxRef.current = null;
    workletRef.current = null;

    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;

    try { mediaRef.current?.getTracks()?.forEach((t) => t.stop()); } catch {}
    mediaRef.current = null;

    setIsListening(false);
  };

  const stop = async () => {
    if (!isListening) return;
    await safeTearDown();
  };

  const reset = () => {
    setSegments([]);
    setLivePartial("");
  };

  const clearSegments = () => setSegments([]);

  const fullText = (segments.map(s => s.text).join(" ") + (livePartial ? " " + livePartial : "")).trim();

  const mapConnectionState = () => {
    // Prefer actual WS readyState if available
    const rs = wsRef.current?.readyState;
    if (rs === 1) return "open";
    if (rs === 0) return "connecting";
    if (rs === 2) return "closing";
    if (rs === 3) return "closed";
    // Fallback to status
    if (status === "connecting") return "connecting";
    if (status === "listening") return "open";
    if (status === "closed") return "closed";
    if (status === "error") return "error";
    return "idle";
  };

  const api = useMemo(() => ({
    start,
    stop,
    reset,
    clearSegments,
    connectionState: mapConnectionState(),
    lastPartial: livePartial,
    segments,          // array of { id, text }
    fullText,
    isListening,
    status,
    error,
  }), [start, stop, reset, clearSegments, livePartial, segments, fullText, isListening, status, error]);
  
  return api;
}