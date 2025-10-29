import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Enhanced Voice Capture Hook
 * Combines Web Speech API with WebSocket streaming for maximum reliability
 * Features:
 * - Automatic fallback between WebSocket and Web Speech API
 * - Robust error handling and reconnection
 * - Real-time audio level monitoring
 * - Configurable timeouts and retry logic
 * - Memory-efficient audio processing
 */

const WEBSOCKET_URL = import.meta.env.VITE_VOICE_WS_URL || 'wss://voice-streamer-xxxxx-uc.a.run.app/ws';
const WS_CONFIGURED = !!(WEBSOCKET_URL && !/xxxxx/.test(WEBSOCKET_URL));
const FALLBACK_TIMEOUT = 3000; // 3 seconds to establish WebSocket connection
const RECONNECT_DELAY = 2000; // 2 seconds between reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 5;

export default function useEnhancedVoiceCapture(options = {}) {
  const {
    autoStopSilenceMs = 1500,
    onFinalize = () => {},
    onPartial = () => {},
    onError = () => {},
    onStatusChange = () => {},
    enableWebSocket = true,
    enableWebSpeech = true,
    language = 'en-IN',
    sampleRate = 16000
  } = options;

  // State management
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [connectionState, setConnectionState] = useState('closed');
  const [lastPartial, setLastPartial] = useState('');
  const [segments, setSegments] = useState([]);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState(null);
  const [activeMethod, setActiveMethod] = useState(null); // 'websocket' | 'webspeech' | null

  // Refs for cleanup and state management
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const workletRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldRunRef = useRef(false);
  const pausedRef = useRef(false);
  const lastNotifiedErrorRef = useRef("");

  // Audio level monitoring
  const updateAudioLevel = useCallback((level) => {
    setAudioLevel(level);
    if (level > 0.01) {
      // Reset silence timer when audio is detected
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        if (isListening && !isPaused) {
          stop();
        }
      }, autoStopSilenceMs);
    }
  }, [isListening, isPaused, autoStopSilenceMs]);

  // WebSocket implementation
  const initializeWebSocket = useCallback(() => {
    if (!enableWebSocket || !WS_CONFIGURED) {
      // Explicitly report disabled state to caller
      onStatusChange?.('websocket-disabled');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WEBSOCKET_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        setConnectionState('open');
        setActiveMethod('websocket');
        setError(null);
        reconnectAttemptsRef.current = 0;
        onStatusChange?.('websocket-connected');

        // Send configuration
        ws.send(JSON.stringify({
          type: 'config',
          lang: language,
          sampleRate: sampleRate,
          format: 'pcm16',
          hints: ['product', 'quantity', 'payment', 'customer', 'gst', 'discount']
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'transcript' || data.partial || data.final) {
            const text = data.text || data.transcript || '';
            const isFinal = data.final || data.isFinal || false;
            
            if (text.trim()) {
              if (isFinal) {
                setFinalTranscript(text);
                setSegments(prev => [...prev, { 
                  id: Date.now(), 
                  text: text.trim(), 
                  ts: new Date().toISOString(),
                  method: 'websocket'
                }]);
                onFinalize?.(text);
              } else {
                setLastPartial(text);
                onPartial?.(text);
              }
            }
          } else if (data.type === 'error') {
            console.error('WebSocket error:', data.message);
            setError(data.message);
            onError?.(data.message);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setConnectionState('closed');
        
        if (event.code !== 1000 && shouldRunRef.current) {
          // Unexpected close, attempt reconnection
          attemptReconnect();
        }
      };

      ws.onerror = (error) => {
        console.error('🔌 WebSocket error:', error);
        setError('WebSocket connection failed');
        // Avoid spamming the same error repeatedly
        if (lastNotifiedErrorRef.current !== 'ws-failed') {
          onError?.('WebSocket connection failed');
          lastNotifiedErrorRef.current = 'ws-failed';
        }
        setConnectionState('error');
      };

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      setError('Failed to initialize WebSocket');
      if (lastNotifiedErrorRef.current !== 'ws-init-failed') {
        onError?.('Failed to initialize WebSocket');
        lastNotifiedErrorRef.current = 'ws-init-failed';
      }
    }
  }, [enableWebSocket, language, sampleRate, onStatusChange, onFinalize, onPartial, onError]);

  // Web Speech API implementation
  const initializeWebSpeech = useCallback(() => {
    if (!enableWebSpeech || recognitionRef.current) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('🎤 Web Speech started');
      setConnectionState('open');
      setActiveMethod('webspeech');
      setError(null);
      onStatusChange?.('webspeech-started');
    };

    recognition.onresult = (event) => {
      if (pausedRef.current) return;

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript.trim() + ' ';
        } else {
          interim += result[0].transcript.trim() + ' ';
        }
      }

      if (interim) {
        setLastPartial(interim.trim());
        onPartial?.(interim.trim());
      }

      if (final) {
        const finalText = final.trim();
        setFinalTranscript(finalText);
        setSegments(prev => [...prev, { 
          id: Date.now(), 
          text: finalText, 
          ts: new Date().toISOString(),
          method: 'webspeech'
        }]);
        onFinalize?.(finalText);
        setLastPartial('');
      }
    };

    recognition.onerror = (event) => {
      console.error('🎤 Web Speech error:', event.error);
      setError(`Web Speech error: ${event.error}`);
      onError?.(`Web Speech error: ${event.error}`);
      setConnectionState('error');
    };

    recognition.onend = () => {
      console.log('🎤 Web Speech ended');
      if (pausedRef.current) {
        setConnectionState('paused');
        setIsPaused(true);
      } else {
        setConnectionState('closed');
        setIsPaused(false);
      }
    };

    recognitionRef.current = recognition;
  }, [enableWebSpeech, language, onStatusChange, onFinalize, onPartial, onError]);

  // Audio processing for WebSocket
  const initializeAudioProcessing = useCallback(async () => {
    if (!streamRef.current) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 48000 });
      audioCtxRef.current = audioCtx;

      // Load PCM16 encoder worklet
      await audioCtx.audioWorklet.addModule('/worklets/pcm16-encoder.js');
      const source = audioCtx.createMediaStreamSource(streamRef.current);
      const encoder = new AudioWorkletNode(audioCtx, 'pcm16-encoder', {
        processorOptions: { targetRate: sampleRate, frameSize: 320 }
      });
      workletRef.current = encoder;

      encoder.port.onmessage = ({ data }) => {
        if (!data || !data.buffer) return;

        // Calculate audio level for VU meter
        const view = new Int16Array(data.buffer);
        let sum = 0;
        for (let i = 0; i < view.length; i++) {
          sum += Math.abs(view[i]);
        }
        const level = sum / view.length / 32768; // Normalize to 0-1
        updateAudioLevel(level);

        // Send to WebSocket if connected
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(data.buffer);
          } catch (e) {
            console.error('Failed to send audio data:', e);
          }
        }
      };

      source.connect(encoder);
    } catch (error) {
      console.error('Failed to initialize audio processing:', error);
      setError('Failed to initialize audio processing');
      onError?.('Failed to initialize audio processing');
    }
  }, [sampleRate, updateAudioLevel, onError]);

  // Reconnection logic
  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnection attempts reached, falling back to Web Speech API');
      setActiveMethod('webspeech');
      initializeWebSpeech();
      return;
    }

    reconnectAttemptsRef.current++;
    console.log(`Attempting reconnection ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`);
    
    // Exponential backoff with jitter
    const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1);
    const jitter = Math.floor(Math.random() * 300);
    reconnectTimerRef.current = setTimeout(() => {
      initializeWebSocket();
    }, delay + jitter);
  }, [initializeWebSocket, initializeWebSpeech]);

  // Start voice capture
  const start = useCallback(async () => {
    if (isListening) return;

    try {
      setError(null);
      setSegments([]);
      setFinalTranscript('');
      setLastPartial('');
      shouldRunRef.current = true;
      pausedRef.current = false;
      setIsPaused(false);

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      // Try WebSocket first if enabled and configured
      if (enableWebSocket && WS_CONFIGURED) {
        initializeWebSocket();
        
        // Wait for WebSocket connection or timeout
        const wsTimeout = setTimeout(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            console.log('WebSocket connection timeout, falling back to Web Speech API');
            setActiveMethod('webspeech');
            initializeWebSpeech();
            try { recognitionRef.current?.start(); } catch {}
          }
        }, FALLBACK_TIMEOUT);

        wsRef.current?.addEventListener('open', () => {
          clearTimeout(wsTimeout);
        });
      } else {
        // Use Web Speech API directly
        setActiveMethod('webspeech');
        initializeWebSpeech();
        try { recognitionRef.current?.start(); } catch {}
      }

      // Initialize audio processing for WebSocket
      if (enableWebSocket && WS_CONFIGURED) {
        await initializeAudioProcessing();
      }

      setIsListening(true);
      setConnectionState('connecting');

      // If WS is disabled or not configured, Web Speech was started above

    } catch (error) {
      console.error('Failed to start voice capture:', error);
      setError('Failed to access microphone');
      onError?.('Failed to access microphone');
      setConnectionState('error');
    }
  }, [isListening, enableWebSocket, enableWebSpeech, initializeWebSocket, initializeWebSpeech, initializeAudioProcessing, onError]);

  // Stop voice capture
  const stop = useCallback(() => {
    shouldRunRef.current = false;
    pausedRef.current = true;
    setIsPaused(true);
    setConnectionState('paused');

    // Stop WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }

    // Stop Web Speech API
    try {
      recognitionRef.current?.stop();
    } catch (e) {
      // Ignore errors when stopping
    }

    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
  }, []);

  // Resume voice capture
  const resume = useCallback(() => {
    if (!isListening || !isPaused) return;

    pausedRef.current = false;
    setIsPaused(false);
    setConnectionState('open');

    if (activeMethod === 'websocket') {
      wsRef.current?.send(JSON.stringify({ type: 'start' }));
    } else if (activeMethod === 'webspeech') {
      recognitionRef.current?.start();
    }
  }, [isListening, isPaused, activeMethod]);

  // Clear transcripts
  const clearSegments = useCallback(() => {
    setSegments([]);
    setFinalTranscript('');
    setLastPartial('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRunRef.current = false;
      
      // Cleanup WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Cleanup audio context
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }

      // Cleanup media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Cleanup timers
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  return {
    // State
    isListening,
    isPaused,
    connectionState,
    lastPartial,
    segments,
    finalTranscript,
    audioLevel,
    error,
    activeMethod,
    
    // Actions
    start,
    stop,
    resume,
    clearSegments,
    
    // Utilities
    hasWebSocket: enableWebSocket,
    hasWebSpeech: enableWebSpeech,
  };
}
