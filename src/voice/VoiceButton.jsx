import React, { useEffect } from 'react';
import { useSpeechStream } from '../hooks/useSpeechStream';

/**
 * VoiceButton (presentational)
 *
 * PURPOSE
 *  - Thin UI wrapper that STARTS/STOPs the shared speech stream
 *  - NO audio/WebSocket logic here (prevents drift with VoiceCapture/useSpeechStream)
 *  - Emits partial + final text via callbacks
 *
 * Props:
 *  - onFinalText?: (final: string) => void
 *  - onPartialText?: (partial: string) => void
 *  - className?: string
 *  - autoStopSilenceMs?: number (default 1200)
 *  - labelStart?: string (default 'Start Voice')
 *  - labelStop?: string (default 'Stop Voice')
 */
export default function VoiceButton({
  onFinalText,
  onPartialText,
  className = '',
  autoStopSilenceMs = 1200,
  labelStart = 'Start Voice',
  labelStop = 'Stop Voice',
}) {
  const {
    isListening,
    start,
    stop,
    fullText,
    livePartial,
    error,
    status,
  } = useSpeechStream({ autoStopSilenceMs });

  // Bubble partials upward
  useEffect(() => {
    if (onPartialText) onPartialText(livePartial || '');
  }, [livePartial, onPartialText]);

  const handleClick = async () => {
    if (isListening) {
      stop();
      const finalText = (fullText || '').trim();
      if (finalText && onFinalText) onFinalText(finalText);
    } else {
      await start();
    }
  };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        className={`px-4 py-2 rounded-xl shadow text-white ${isListening ? 'bg-red-600' : 'bg-black'} hover:opacity-90 active:opacity-80 focus:outline-none focus:ring-2 focus:ring-black/30`}
        aria-pressed={isListening}
        aria-live="polite"
      >
        {isListening ? labelStop : labelStart}
      </button>
      <span className="text-sm opacity-70 min-h-[1.25rem]">
        {isListening ? (livePartial || 'listening…') : ''}
      </span>
      {error ? (
        <span className="text-xs text-red-500">{String(error)}</span>
      ) : (
        <span className="text-xs opacity-60">{status}</span>
      )}
    </div>
  );
}
