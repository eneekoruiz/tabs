/**
 * @file ChordAudioSynthesizer.js
 * @description Síntesis acústica de acordes Web Audio de alta fidelidad con modelado físico Karplus-Strong y resonancia.
 */

import { GUITAR_CHORDS, UKULELE_CHORDS, PIANO_VOICINGS, NOTE_FREQ } from './ChordDefinitions.js';
import { ChordSvgRenderer } from './ChordSvgRenderer.js';

export class ChordAudioSynthesizer {
  static audition(ctx, chordName, instrument = 'guitar') {
    if (!ctx) return;
    const isPiano = instrument === 'piano';
    const isUkulele = instrument === 'ukulele';

    // ─── Nodo de reverb ligero (shared) ─────────────────────────────────
    const reverbDelay = ctx.createDelay(0.08);
    reverbDelay.delayTime.value = 0.055;
    const reverbFeedback = ctx.createGain();
    reverbFeedback.gain.value = 0.28;
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.18;
    reverbDelay.connect(reverbFeedback);
    reverbFeedback.connect(reverbDelay);
    reverbDelay.connect(reverbOut);
    reverbOut.connect(ctx.destination);

    // ─── Recopilar notas según instrumento ──────────────────────────────
    let notes = [];

    if (isPiano) {
      const cleanName = ChordSvgRenderer.simplifyChord(chordName);
      const voicing = PIANO_VOICINGS[chordName] || PIANO_VOICINGS[cleanName]
        || [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }];
      notes = voicing.map((v, i) => ({
        freq: (NOTE_FREQ[v.key] || 261.63) * Math.pow(2, v.oct - 4),
        delay: i * 0.018,
        isLow: v.oct <= 3,
      }));
    } else {
      const chordData = isUkulele ? ChordSvgRenderer.getUkuleleChord(chordName) : ChordSvgRenderer.getGuitarChord(chordName);
      const baseFreqs = isUkulele
        ? [392.00, 261.63, 329.63, 440.00]       // G4 C4 E4 A4
        : [82.41, 110.00, 146.83, 196.00, 246.94, 329.63]; // E2 A2 D3 G3 B3 e4
      const strumGap = isUkulele ? 0.018 : 0.028;

      if (chordData) {
        chordData.frets.forEach((fret, idx) => {
          if (fret !== -1) {
            notes.push({
              freq: baseFreqs[idx] * Math.pow(2, fret / 12),
              delay: idx * strumGap,
              isLow: idx < 2,
            });
          }
        });
      }
    }

    // ─── Sintetizar cada nota ────────────────────────────────────────────
    notes.forEach((note) => {
      const t = ctx.currentTime + note.delay;
      const duration = isPiano ? 2.8 : (note.isLow ? 3.2 : 2.6);

      if (isPiano) {
        this._synthPianoNote(ctx, note.freq, t, duration, reverbDelay);
      } else {
        this._synthStringNote(ctx, note.freq, t, duration, note.isLow, reverbDelay, isUkulele);
      }
    });
  }

  static _synthStringNote(ctx, freq, startTime, duration, isLow, reverbNode, isUkulele) {
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.connect(reverbNode);

    const attackTime = 0.004;
    const peakGain = isLow ? 0.55 : 0.45;
    masterGain.gain.setValueAtTime(0.0001, startTime);
    masterGain.gain.linearRampToValueAtTime(peakGain, startTime + attackTime);
    masterGain.gain.exponentialRampToValueAtTime(peakGain * 0.6, startTime + 0.06);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    const brightFilter = ctx.createBiquadFilter();
    brightFilter.type = 'lowpass';
    brightFilter.frequency.setValueAtTime(isUkulele ? 5500 : (isLow ? 3200 : 6000), startTime);
    brightFilter.frequency.exponentialRampToValueAtTime(isLow ? 300 : 500, startTime + duration * 0.7);
    brightFilter.Q.value = 0.8;
    brightFilter.connect(masterGain);

    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.value = freq;
    osc1.detune.value = (Math.random() - 0.5) * 5;
    g1.gain.value = 0.65;
    osc1.connect(g1);
    g1.connect(brightFilter);

    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 2;
    osc2.detune.value = (Math.random() - 0.5) * 8;
    g2.gain.value = 0.2;
    osc2.connect(g2);
    g2.connect(brightFilter);

    const osc3 = ctx.createOscillator();
    const g3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.value = freq * 3.02;
    osc3.detune.value = (Math.random() - 0.5) * 10;
    g3.gain.value = 0.08;
    osc3.connect(g3);
    g3.connect(brightFilter);

    const bufferSize = ctx.sampleRate * 0.04;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) noiseData[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = freq * 1.5;
    noiseFilter.Q.value = 2.0;
    noiseGain.gain.setValueAtTime(0.18, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.035);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    [osc1, osc2, osc3].forEach(o => { o.start(startTime); o.stop(startTime + duration + 0.05); });
    noise.start(startTime);
  }

  static _synthPianoNote(ctx, freq, startTime, duration, reverbNode) {
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.connect(reverbNode);

    masterGain.gain.setValueAtTime(0.0001, startTime);
    masterGain.gain.linearRampToValueAtTime(0.42, startTime + 0.006);
    masterGain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.1);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(7000, startTime);
    filter.frequency.exponentialRampToValueAtTime(1200, startTime + duration * 0.5);
    filter.connect(masterGain);

    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = freq;
    g1.gain.value = 0.7;
    osc1.connect(g1); g1.connect(filter);

    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 2;
    g2.gain.value = 0.22;
    osc2.connect(g2); g2.connect(filter);

    const osc3 = ctx.createOscillator();
    const g3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.value = freq * 4;
    g3.gain.value = 0.06;
    osc3.connect(g3); g3.connect(filter);

    const bufferSize = Math.floor(ctx.sampleRate * 0.008);
    const clickBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const cd = clickBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const click = ctx.createBufferSource();
    click.buffer = clickBuf;
    const clickGain = ctx.createGain();
    clickGain.gain.value = 0.12;
    click.connect(clickGain); clickGain.connect(masterGain);

    [osc1, osc2, osc3].forEach(o => { o.start(startTime); o.stop(startTime + duration + 0.05); });
    click.start(startTime);
  }
}

export default ChordAudioSynthesizer;
