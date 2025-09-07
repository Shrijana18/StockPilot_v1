

import React, { useMemo } from 'react';

/**
 * LiveCaption
 * Accessible, neutral-styled live transcript block.
 *
 * Props:
 *  - isListening: boolean
 *  - transcript: string
 *  - className?: string
 *  - showCopy?: boolean (default true)
 *  - size?: 'sm' | 'md' (default 'md')
 */
const LiveCaption = ({ isListening, transcript, className = '', showCopy = true, size = 'md' }) => {
  const hasText = !!(transcript && transcript.trim());

  const sizeClasses = useMemo(() => {
    return size === 'sm'
      ? { title: 'text-[11px]', body: 'text-[13px] leading-5', pad: 'px-3 py-2' }
      : { title: 'text-xs', body: 'text-[15px] leading-6', pad: 'px-4 py-3' };
  }, [size]);

  const handleCopy = async () => {
    try {
      if (!hasText) return;
      await navigator.clipboard.writeText(transcript.trim());
    } catch (_) {}
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white/90 backdrop-blur ${sizeClasses.pad} ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Header */}
      <div className={`flex items-center justify-between ${sizeClasses.title} text-gray-600`}>
        <div className="flex items-center gap-2">
          {isListening ? (
            <span className="relative inline-flex items-center" aria-hidden>
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-red-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
          ) : (
            <span className="inline-flex h-2 w-2 rounded-full bg-gray-300" aria-hidden />
          )}
          <span>{isListening ? 'Listening…' : 'Last voice'}</span>
        </div>

        {showCopy && hasText ? (
          <button
            type="button"
            onClick={handleCopy}
            className="hidden sm:inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300/60"
            title="Copy transcript"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 9h8v10H9z" stroke="currentColor" strokeWidth="1.5"/><path d="M7 15H5V5h10v2" stroke="currentColor" strokeWidth="1.5"/></svg>
            Copy
          </button>
        ) : null}
      </div>

      {/* Body */}
      <p className={`mt-2 ${sizeClasses.body} ${isListening ? 'italic text-gray-900' : 'font-medium text-gray-900'}`}>
        {hasText ? transcript : (isListening ? 'Start speaking to see text here…' : 'No recent voice input')}
      </p>

      {/* Screen reader live region duplicate for reliability */}
      <span className="sr-only">{hasText ? transcript : ''}</span>
    </div>
  );
}

export default LiveCaption;