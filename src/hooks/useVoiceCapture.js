import { useState, useEffect, useRef, useCallback } from "react";

export default function useVoiceCapture(inventory = []) {
  // Explicit pause+run gates to coordinate with FastBillingMode
  const shouldRunRef = useRef(false); // allows auto/continued run when true
  const pausedRef = useRef(false);    // true when user explicitly paused

  const [connectionState, setConnectionState] = useState("closed");
  const [lastPartial, setLastPartial] = useState("");
  const [segments, setSegments] = useState([]);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [pausedState, setPausedState] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);

  const uploadToWhisper = useCallback(async () => {
    if (recordedChunks.length === 0) return;

    const blob = new Blob(recordedChunks, { type: "audio/webm" });

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Audio = reader.result.split(',')[1]; // remove data:* prefix

      try {
        const res = await fetch(import.meta.env.VITE_WHISPER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: base64Audio,
            userId: "test-user"  // replace with dynamic ID if needed
          }),
        });

        const result = await res.json();
        console.log("Whisper fallback result:", result);

        if (result.transcript) {
          setFinalTranscript(result.transcript);  // triggers /parse call
        }
      } catch (err) {
        console.error("Whisper API fallback error:", err);
      }
    };

    reader.readAsDataURL(blob); // trigger base64 conversion
  }, [recordedChunks]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Web Speech API is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setPausedState(false);
      setConnectionState("open");
    };
    recognition.onend = () => {
      if (pausedRef.current) {
        setConnectionState("paused");
        setPausedState(true);
      } else {
        setConnectionState("closed");
        setPausedState(false);
      }
      // do not auto-reconnect here; FastBilling controls explicit restarts
    };

    recognition.onresult = (event) => {
      if (pausedRef.current) return; // ignore stream while paused
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript.trim() + " ";
        } else {
          interim += result[0].transcript.trim() + " ";
        }
      }

      if (interim) setLastPartial(interim.trim());
      if (final) {
        setSegments(prev => [...prev, { id: Date.now(), text: final.trim(), ts: new Date().toISOString() }]);
        setFinalTranscript(final.trim());
        setLastPartial("");
      }
    };

    recognition.onerror = (e) => {
      if (pausedRef.current) {
        setConnectionState("paused");
        setPausedState(true);
        return;
      }
      console.error("Speech recognition error:", e);
      setConnectionState("closed");
      setPausedState(false);
    };

    recognitionRef.current = recognition;

    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = event => {
          if (event.data.size > 0) {
            setRecordedChunks(prev => [...prev, event.data]);
          }
        };
      });
    }

    return () => {
      try { recognitionRef.current?.stop(); } catch {}
    };
  }, []);


  useEffect(() => {
    if (pausedRef.current) return;
    const fallbackTimeout = setTimeout(() => {
      if (!finalTranscript && recordedChunks.length > 0) {
        try { uploadToWhisper(); } catch (e) { console.warn('Whisper fallback call skipped:', e); }
      }
    }, 5000);
    return () => clearTimeout(fallbackTimeout);
  }, [finalTranscript, recordedChunks]);

  const start = () => {
    if (!recognitionRef.current) return;
    pausedRef.current = false;
    shouldRunRef.current = true;
    setPausedState(false);
    setConnectionState("connecting"); // immediate feedback
    try { recognitionRef.current.start(); } catch (_) {}
  };

  const stop = () => {
    pausedRef.current = true;        // explicit pause
    shouldRunRef.current = false;    // disable any reconnect attempts
    setPausedState(true);
    setConnectionState("paused");   // reflect paused immediately

    // Hard stop recognition immediately
    try { recognitionRef.current?.stop(); } catch (_) {}
    try { recognitionRef.current?.abort?.(); } catch (_) {}

    // Do NOT stop mic tracks here; keeps stream alive for resume
  };

  const clearSegments = () => setSegments([]);
  const clearFinalTranscript = () => setFinalTranscript("");

  return {
    start,
    stop,
    connectionState,
    lastPartial,
    segments,
    clearSegments,
    clearFinalTranscript,
    finalTranscript,
    uploadToWhisper,
    paused: pausedState,
  };
}