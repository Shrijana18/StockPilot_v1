// FLYP Voice Streamer – Cloud Run (WebSocket → Google Cloud Speech-to-Text)
// Receives PCM16 (16 kHz) frames over WS, streams to GCS STT, and sends back transcripts.
// Expected client messages:
//   1) JSON: {type:'config', lang:'en-IN'|'hi-IN'|'mr-IN', sampleRate:16000, format:'pcm16', hints?:string[]}
//   2) JSON: {type:'start'}
//   3) Binary: PCM16 audio frames (Int16LE) at 16 kHz
//
// Server responds with:
//   JSON: {type:'hello'|'status'|'error'|'transcript', ...}
//   - transcript: {type:'transcript', final:boolean, text:string}

import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { SpeechClient } from "@google-cloud/speech";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const PORT = process.env.PORT || 8080;

// Optional env defaults
const DEFAULT_LANG = process.env.DEFAULT_LANG || "en-IN";
const DEFAULT_SAMPLE_RATE = parseInt(process.env.SAMPLE_RATE_HZ || "16000", 10);
const DEFAULT_MODEL = process.env.SPEECH_MODEL || undefined; // only set if provided
const LANG_HINTS = (process.env.LANG_HINTS || "").split(",").map(s => s.trim()).filter(Boolean);
const ENABLE_PUNCTUATION = String(process.env.ENABLE_PUNCTUATION || "true") === "true";

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

  const request = {
    config: {
      languageCode,
      sampleRateHertz,
      encoding: "LINEAR16",
      enableAutomaticPunctuation: !!usePunctuation,
      ...(DEFAULT_MODEL ? { model: DEFAULT_MODEL } : {}),
      ...(phraseHints.length ? { speechContexts: [{ phrases: phraseHints.slice(0, 500) }] } : {}),
    },
    interimResults: true, // send partials
    singleUtterance: false, // keep stream open
  };

  let closed = false;
  const recognizeStream = speechClient
    .streamingRecognize(request)
    .on("error", (err) => {
      if (closed) return;
      console.error("Speech streamingRecognize error:", err?.message || err);
      wsSend(ws, { type: "error", message: err.message });
    })
    .on("data", (data) => {
      // data.results[] may contain partial or final alternatives
      if (!data || !data.results || !data.results.length) return;
      const result = data.results[0];
      const alt = result.alternatives && result.alternatives[0];
      const text = alt?.transcript || "";
      const isFinal = !!result.isFinal;
      if (text) {
        wsSend(ws, { type: "transcript", final: isFinal, text });
      }
    })
    .on("end", () => {
      if (closed) return;
      wsSend(ws, { type: "status", message: "recognizer-ended" });
    });

  return {
    write: (chunk) => {
      try { recognizeStream.write(chunk); } catch (e) { /* ignore */ }
    },
    close: () => {
      try { recognizeStream.end(); } catch { /* ignore */ }
      closed = true;
    },
  };
}

function wsSend(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch { /* ignore */ }
}

// WebSocket handling
wss.on("connection", (ws, req) => {
  console.log("WS connected:", req.socket.remoteAddress);
  wsSend(ws, { type: "hello", msg: "ws connected" });

  let cfg = { lang: DEFAULT_LANG, sampleRate: DEFAULT_SAMPLE_RATE, format: "pcm16", punctuation: ENABLE_PUNCTUATION, hints: LANG_HINTS };
  let recognizer = null;
  let started = false;

  const startRecognizer = () => {
    if (recognizer) return;
    recognizer = createRecognizer(ws, cfg);
    started = true;
    wsSend(ws, { type: "status", message: "recognizer-started", lang: cfg.lang, sampleRate: cfg.sampleRate });
  };

  ws.on("message", (data, isBinary) => {
    // If it's a string, it could be JSON control messages
    if (!isBinary && typeof data === "string") {
      try {
        const msg = JSON.parse(data);
        if (msg && msg.type === "config") {
          // Merge config (allow changing lang, hints, punctuation, sampleRate)
          cfg = {
            ...cfg,
            ...msg,
            // enforce format to pcm16 for now
            format: "pcm16",
          };
          wsSend(ws, { type: "status", message: "config-ack", cfg: { ...cfg, hints: Array.isArray(cfg.hints) ? cfg.hints.slice(0, 10) : [] } });
          return;
        }
        if (msg && msg.type === "start") {
          startRecognizer();
          return;
        }
      } catch {
        // Not JSON → ignore
      }
      // Non-JSON text → ignore quietly
      return;
    }

    // Binary audio chunk
    if (isBinary || Buffer.isBuffer(data)) {
      // Some clients might send audio before 'start' → auto-start
      if (!started) startRecognizer();
      const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (recognizer) recognizer.write(chunk);
      return;
    }

    // Fallback: unknown frame
    wsSend(ws, { type: "error", message: "unknown-frame" });
  });

  ws.on("close", () => {
    if (recognizer) recognizer.close();
    console.log("WS closed");
  });
  ws.on("error", (e) => {
    if (recognizer) recognizer.close();
    console.error("WS error", e);
  });
});

server.listen(PORT, () => {
  console.log(`FLYP Voice Streamer listening on :${PORT}`);
});