// PCM decoding and independent reference metrics for recorded-audio regressions.
export function decodePcmWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 12) !== 'WAVE') throw new Error('Not a WAV');
  let format, dataOffset, dataLength;
  for (let p = 12; p + 8 <= bytes.length;) {
    const length = view.getUint32(p + 4, true);
    if (p + 8 + length > bytes.length) throw new Error('Truncated WAV');
    if (ascii(p, p + 4) === 'fmt ') format = {
      codec: view.getUint16(p + 8, true), channels: view.getUint16(p + 10, true),
      sampleRate: view.getUint32(p + 12, true), bits: view.getUint16(p + 22, true),
    };
    if (ascii(p, p + 4) === 'data') { dataOffset = p + 8; dataLength = length; }
    p += 8 + length + length % 2;
  }
  if (!format || format.codec !== 1 || format.bits !== 16 || !format.channels || dataOffset == null) throw new Error('Expected PCM16 WAV');
  const samples = new Float32Array(dataLength / 2 / format.channels);
  for (let i = 0; i < samples.length; i++) {
    for (let channel = 0; channel < format.channels; channel++) {
      samples[i] += view.getInt16(dataOffset + (i * format.channels + channel) * 2, true) / (32768 * format.channels);
    }
  }
  return { samples, sampleRate: format.sampleRate };
}

export function parseF0Csv(text) {
  return text.trim().split(/\r?\n/).map(line => line.split(',').map(Number));
}

export function evaluateRecordedPitch(engine, signal, reference, { hop = 441, windowSize = 2048 } = {}) {
  const frames = [];
  let refIndex = 0;
  const started = performance.now();
  for (let offset = 0; offset + windowSize <= signal.samples.length; offset += hop) {
    const time = (offset + windowSize / 2) / signal.sampleRate;
    while (refIndex + 1 < reference.length && reference[refIndex + 1][0] < time) refIndex++;
    const truth = reference[refIndex]?.[1] || 0;
    const detection = engine.detectVocalPitch(signal.samples.subarray(offset, offset + windowSize), signal.sampleRate);
    const frequency = detection && detection.clarity > 0.88 ? detection.frequency : 0;
    frames.push({ time, truth, frequency,
      errorCents: truth > 0 && frequency > 0 ? 1200 * Math.log2(frequency / truth) : null });
  }
  const voiced = frames.filter(frame => frame.truth >= 80 && frame.truth <= 1100);
  const detected = voiced.filter(frame => frame.frequency > 0);
  const correct = detected.filter(frame => Math.abs(frame.errorCents) <= 50);
  const errors = detected.map(frame => Math.abs(frame.errorCents)).sort((a, b) => a - b);
  const unvoiced = frames.filter(frame => frame.truth === 0);
  return {
    seconds: signal.samples.length / signal.sampleRate, frames: frames.length,
    referenceVoicedFrames: voiced.length, detectedVoicedFrames: detected.length,
    coverage: voiced.length ? detected.length / voiced.length : null,
    within50Cents: voiced.length ? correct.length / voiced.length : null,
    precisionWithin50Cents: detected.length ? correct.length / detected.length : null,
    medianAbsoluteCents: errors.length ? errors[Math.floor(errors.length / 2)] : null,
    unvoicedFrames: unvoiced.length, falseVoicedFrames: unvoiced.filter(frame => frame.frequency > 0).length,
    elapsedMs: performance.now() - started, framesData: frames,
  };
}
