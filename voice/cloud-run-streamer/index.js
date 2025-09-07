// FLYP Voice Streamer – Cloud Run (WebSocket → Google Cloud Speech-to-Text)
// Receives PCM16 (48 kHz by default) frames over WS, streams to GCS STT, and sends back transcripts.
// Expected client messages:
//   1) JSON: {type:'config', lang:'en-IN'|'hi-IN'|'hi-IN'|'mr-IN', sampleRate:48000, format:'pcm16', hints?:string[]}
//   2) JSON: {type:'start'}
//   3) Binary: PCM16 audio frames (Int16LE) at the negotiated sampleRate (default 48 kHz)

import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { SpeechClient } from "@google-cloud/speech";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// Optional env defaults
const DEFAULT_LANG = process.env.DEFAULT_LANG || "en-IN";
const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_MODEL = process.env.SPEECH_MODEL || undefined; // only set if provided
const LANG_HINTS = (process.env.LANG_HINTS || "").split(",").map(s => s.trim()).filter(Boolean);
const ENABLE_PUNCTUATION = String(process.env.ENABLE_PUNCTUATION || "true") === "true";
const ALT_LANGS = (process.env.ALT_LANGS || "hi-IN,mr-IN")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const speechClient = new SpeechClient();

// Health endpoints
app.get("/", (_req, res) => {
  res
    .type("text/plain")
    .send("FLYP Voice Streamer: OK\nUse /ws for WebSocket.");
});
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

// Helper: create a new streamingRecognize session
function createRecognizer(ws, cfg) {
  const languageCode = cfg?.lang || DEFAULT_LANG;
  const sampleRateHertz = cfg?.sampleRate || DEFAULT_SAMPLE_RATE;
  const usePunctuation = cfg?.punctuation ?? ENABLE_PUNCTUATION;
  const phraseHints = Array.isArray(cfg?.hints) && cfg.hints.length ? cfg.hints : LANG_HINTS;
  const altLangs = Array.isArray(cfg?.altLangs) && cfg.altLangs.length ? cfg.altLangs : ALT_LANGS;

  const request = {
    config: {
      languageCode,
      sampleRateHertz,
      encoding: "LINEAR16",
      enableAutomaticPunctuation: !!usePunctuation,
      ...(DEFAULT_MODEL ? { model: DEFAULT_MODEL } : {}),
      ...(altLangs.length ? { alternativeLanguageCodes: altLangs.slice(0, 3) } : {}),
      ...(phraseHints.length ? { speechContexts: [{ phrases: phraseHints.slice(0, 500) }] } : {}),
    },
    interimResults: true, // send partials
    singleUtterance: false, // keep stream open
  };

  console.log('🔧 Google request =', JSON.stringify(request, null, 2));

  let closed = false;
  const recognizeStream = speechClient
    .streamingRecognize(request);

  recognizeStream
    .on("error", (err) => {
      if (closed) return;
      console.error("❌ Recognizer error:", err.message);
      closed = true;
      wsSend(ws, { type: "error", message: err.message });
    })
    .on("end", () => {
      if (closed) return;
      closed = true;
      wsSend(ws, { type: "status", message: "recognizer-ended" });
    })
    .on("close", () => {
      closed = true;
      console.log("🛑 Recognizer stream closed");
    });

  recognizeStream
    .on("data", (data) => {
      console.log("📡 STT DATA:", JSON.stringify(data, null, 2));
      console.log("📤 Raw STT Response:", JSON.stringify(data, null, 2));
      if (!data.results || !data.results.length) {
        console.log("📭 STT returned no results.");
      }
      // data.results[] may contain partial or final alternatives
      const results = (data && data.results) || [];
      if (!results.length) {
        console.log("📝 STT data event: empty results");
        return;
      }
      const r = results[0];
      const alt = r?.alternatives && r.alternatives[0];
      const text = alt?.transcript || "";
      const isFinal = !!r?.isFinal;
      console.log("📝 STT result:", { isFinal, text: text ? text.slice(0, 80) : "" });
      if (text) {
        // Send in both formats for compatibility
        wsSend(ws, { type: "transcript", final: isFinal, text, partial: !isFinal });
        if (isFinal) {
          wsSend(ws, { final: true, text });
        } else {
          wsSend(ws, { partial: true, text });
        }
      }
    });

  console.log('✅ Recognizer stream created (interimResults=true, sampleRate=%d, lang=%s)', sampleRateHertz, languageCode);

  return {
    write: (chunk) => {
      try {
        if (recognizeStream && !recognizeStream.destroyed) {
          // Ensure a proper Buffer and non-empty, even-length (Int16LE)
          const audioBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          if (!audioBuffer || audioBuffer.length === 0) return;
          if (audioBuffer.length % 2 !== 0) {
            // drop the last odd byte to keep Int16 alignment
            const trimmed = audioBuffer.slice(0, audioBuffer.length - 1);
            const ok = recognizeStream.write({ audioContent: trimmed });
            if (ok === false) console.warn("⚠️ recognizeStream backpressure (trimmed)");
            return;
          }
          const ok = recognizeStream.write({ audioContent: audioBuffer });
          if (ok === false) console.warn("⚠️ recognizeStream backpressure, write returned false");
        } else {
          console.warn("⚠️ Tried to write to a destroyed stream.");
        }
      } catch (e) {
        console.error("🎤 write error (safe write):", e?.message || e);
      }
    },
    close: () => {
      if (!closed) {
        try { recognizeStream.end(); } catch { /* ignore */ }
        closed = true;
      }
    },
  };
}

function wsSend(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch { /* ignore */ }
}

function attachSocketHandlers(ws, req) {
  console.log("WS connected:", (req && req.url) || "/", req.socket?.remoteAddress);
  wsSend(ws, { type: "hello", msg: "ws connected" });

  let cfg = { lang: DEFAULT_LANG, sampleRate: DEFAULT_SAMPLE_RATE, format: "pcm16", punctuation: !!ENABLE_PUNCTUATION, hints: LANG_HINTS, altLangs: ALT_LANGS };
  let recognizer = null;
  let started = false;

  // Buffer audio frames that arrive before recognizer is ready
  let prebuffer = [];
  let prebufferBytes = 0;
  const MAX_PREBUFFER_BYTES = 16000 * 2 * 3; // ~3s of 16k mono PCM16 (~96 KB)

  const ensureRecognizerStarted = (reason = 'unknown') => {
    if (started && recognizer) return;
    console.log(`🚀 ensureRecognizerStarted(${reason})`);
    try {
      recognizer = createRecognizer(ws, cfg);
      started = true;
      console.log("Starting recognizer with:", { lang: cfg.lang, sampleRate: cfg.sampleRate, altLangs: cfg.altLangs, hints: (cfg.hints || []).slice(0, 5) });
      wsSend(ws, { type: "status", message: "recognizer-started", lang: cfg.lang, sampleRate: cfg.sampleRate });

      // Flush any buffered audio frames collected before START
      if (prebuffer.length) {
        console.log(`🔁 Flushing ${prebuffer.length} buffered frames (${prebufferBytes} bytes) to recognizer...`);
        for (const buf of prebuffer) {
          try { recognizer.write(buf); } catch (e) { console.error('⚠️ Error flushing prebuffer:', e?.message || e); }
        }
        prebuffer = [];
        prebufferBytes = 0;
      }
    } catch (e) {
      console.error('❌ Failed to start recognizer:', e?.message || e);
      recognizer = null;
      started = false;
    }
  };

  const startRecognizer = () => ensureRecognizerStarted('start-msg');

  ws.on("message", (data, isBinary) => {
    // Log all incoming WebSocket text messages
    if (!isBinary) {
      try {
        const str = typeof data === "string" ? data : data.toString("utf8");
        console.log("📩 Incoming WS Message:", str);
      } catch (e) {
        console.error("❌ WS Message Parse Error:", e.message);
      }
    }
    // Control messages may arrive as string
    if (!isBinary && typeof data === "string") {
      try {
        const msg = JSON.parse(data);
        if (!msg || typeof msg !== "object") return;
        // Accept both legacy and new client contracts
        if (msg.type === "config" || msg.type === "CONFIG") {
          cfg = { ...cfg, ...msg, format: "pcm16", altLangs: msg.altLangs || cfg.altLangs };
          wsSend(ws, { type: "status", message: "config-ack", cfg: { ...cfg, hints: Array.isArray(cfg.hints) ? cfg.hints.slice(0, 10) : [] } });
          return;
        }
        if (msg.type === "start" || msg.type === "START") {
          // Some clients send START with nested config
          if (msg.config && typeof msg.config === "object") {
            const c = msg.config;
            cfg = {
              ...cfg,
              lang: c.languageCode || c.lang || cfg.lang,
              sampleRate: c.sampleRateHertz || c.sampleRate || cfg.sampleRate,
              punctuation: typeof c.enableAutomaticPunctuation === "boolean" ? c.enableAutomaticPunctuation : cfg.punctuation,
              hints: c.speechContexts?.[0]?.phrases || cfg.hints,
              altLangs: c.alternativeLanguageCodes || c.altLangs || cfg.altLangs,
              format: "pcm16",
            };
            wsSend(ws, { type: "status", message: "start-config-ack", cfg: { ...cfg, hints: Array.isArray(cfg.hints) ? cfg.hints.slice(0, 10) : [] } });
          }
          console.log("🟢 Received START command — starting recognizer...");
          startRecognizer();
          return;
        }
        if (msg.type === "stop" || msg.type === "STOP") {
          if (recognizer) recognizer.close();
          started = false;
          wsSend(ws, { type: "status", message: "recognizer-stopped" });
          return;
        }
      } catch {
        // Non-JSON control message; ignore
      }
      return; // ignore other text frames
    }

    // Binary audio
    if (isBinary || Buffer.isBuffer(data)) {
      const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);

      if (!started || !recognizer) {
        // Try to auto-start on first audio to avoid race with slow cold-starts
        ensureRecognizerStarted('first-audio');

        if (!started || !recognizer) {
          // Still not ready: buffer until recognizer is live
          prebuffer.push(chunk);
          prebufferBytes += chunk.length;
          while (prebufferBytes > MAX_PREBUFFER_BYTES && prebuffer.length) {
            const dropped = prebuffer.shift();
            prebufferBytes -= dropped.length;
          }
          if (prebuffer.length % 25 === 1) {
            console.log(`⏳ Buffering audio before recognizer start… frames=${prebuffer.length}, bytes=${prebufferBytes}`);
          }
          return;
        }
      }

      // Recognizer is ready: write directly
      console.log("🔊 Received audio chunk of", chunk.length, "bytes");
      try {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        recognizer.write(buffer);
      } catch (e) {
        console.error('🎤 write error:', e?.message || e);
      }
      return;
    }

    // Unknown frame
    wsSend(ws, { type: "error", message: "unknown-frame" });
  });

  ws.on("close", () => {
    if (recognizer) recognizer.close();
    started = false;
    recognizer = null;
    prebuffer = [];
    prebufferBytes = 0;
    console.log("WS closed");
  });
  ws.on("error", (e) => {
    if (recognizer) recognizer.close();
    started = false;
    recognizer = null;
    prebuffer = [];
    prebufferBytes = 0;
    console.error("WS error", e);
  });
}

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws, req) => attachSocketHandlers(ws, req));

server.on("upgrade", (request, socket, head) => {
  const { url } = request;
  if (url === "/ws" || url === "/stream") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`FLYP Voice Streamer listening on :${PORT}`);
});