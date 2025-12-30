
/* PCM16 encoder & resampler AudioWorkletProcessor
 * Produces fixed-size PCM16 LE frames from arbitrary input (e.g., 48 kHz) to targetRate (default 16 kHz).
 * Use with:
 *   new AudioWorkletNode(audioCtx, 'pcm16-encoder', {
 *     processorOptions: { targetRate: 16000, frameSize: 320 }
 *   })
 * frameSize 320 = 20ms @ 16k
 */
class PCM16Encoder extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.targetRate = Math.max(8000, opts.targetRate || 16000);
    // 20 ms by default if not provided
    this.frameSize = Math.max(1, opts.frameSize || Math.round(0.02 * this.targetRate));

    // Resampling state
    this._ratio = sampleRate / this.targetRate; // e.g., 48000/16000 = 3
    this._phase = 0;                            // fractional read index into _src
    this._src = new Float32Array(0);            // rolling source buffer (input sample rate)

    // Output accumulator (resampled, not yet framed)
    this._out = [];
  }

  /** Downmix to mono if needed */
  _monoFromInputs(inputs) {
    const chans = inputs[0] || [];
    if (chans.length === 0) return null;
    if (chans.length === 1) return chans[0];
    const a = chans[0], b = chans[1];
    const n = Math.min(a.length, b.length);
    const mono = new Float32Array(n);
    for (let i = 0; i < n; i++) mono[i] = (a[i] + b[i]) * 0.5;
    return mono;
  }

  /** Clamp float [-1,1] and convert to Int16 */
  _toPCM16(frameFloat) {
    const out = new Int16Array(frameFloat.length);
    for (let i = 0; i < frameFloat.length; i++) {
      let s = frameFloat[i];
      if (s > 1) s = 1; else if (s < -1) s = -1;
      out[i] = s < 0 ? (s * 0x8000) : (s * 0x7FFF);
    }
    return out;
  }

  process(inputs) {
    // Get mono float32 at context sampleRate (e.g., 48k)
    const mono = this._monoFromInputs(inputs);
    if (!mono || mono.length === 0) return true; // keep node alive

    // Append to rolling source buffer
    const merged = new Float32Array(this._src.length + mono.length);
    merged.set(this._src, 0);
    merged.set(mono, this._src.length);

    // Resample merged -> targetRate using linear interpolation, maintaining phase
    let read = this._phase;              // fractional index into merged
    const maxRead = merged.length - 1;   // we need i1 = i0+1, so stop at length-1

    while (read < maxRead) {
      const i0 = read | 0;               // floor
      const i1 = i0 + 1;
      const t = read - i0;               // frac
      const s0 = merged[i0];
      const s1 = merged[i1];
      const y = s0 * (1 - t) + s1 * t;   // linear interpolation
      this._out.push(y);
      read += this._ratio;               // advance in source domain by ratio
    }

    // Keep leftover source and phase for next callback
    const consumed = Math.min(maxRead, read | 0); // integer part consumed
    this._src = merged.subarray(consumed);
    this._phase = read - consumed;                // keep fractional part

    // Emit exact frameSize chunks as PCM16
    while (this._out.length >= this.frameSize) {
      const frame = this._out.splice(0, this.frameSize); // Array<number>
      const int16 = this._toPCM16(frame);
      // Transfer underlying buffer to avoid copy on main thread
      this.port.postMessage(int16, [int16.buffer]);
    }

    return true; // keep processor alive
  }
}

registerProcessor('pcm16-encoder', PCM16Encoder);