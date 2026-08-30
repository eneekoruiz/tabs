/**
 * @file PitchDetector.js
 * @description Motor DSP de detección de tono (Pitch Detection) en tiempo real mediante Web Audio API
 * y algoritmo de autocorrelación optimizado (YIN/Autocorrelation).
 * Proporciona afinador cromático en tiempo real y modo de seguimiento de partitura acústico (Score Following).
 */

import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';

// Notas de la escala cromática y frecuencias de referencia (A4 = 440Hz)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export class PitchDetector {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.buffer = null;
    this.isRunning = false;
    this.scoreFollowingActive = false;
    this.animationFrameId = null;

    // Tolerancia para seguimiento de partitura (en semitonos / centésimas)
    this.centsTolerance = 45; // +/- 45 cents
    this.currentExpectedNote = null;
    this.lastDetectedPitch = null;
  }

  /**
   * Inicializa el micrófono y el contexto de Web Audio para captura en tiempo real.
   * @param {MediaStream} [mockStream] - Stream simulado opcional para pruebas unitarias y Playwright
   */
  async start(mockStream = null) {
    if (this.isRunning) return true;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 44100 });

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (mockStream) {
        this.mediaStream = mockStream;
      } else {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false,
            latency: 0,
          },
        });
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.2;

      this.sourceNode.connect(this.analyser);
      this.buffer = new Float32Array(this.analyser.fftSize);
      this.isRunning = true;

      events.emit('pitch:started');
      this.loop();
      return true;
    } catch (err) {
      this.isRunning = false;
      events.emit('pitch:error', err);
      if (err.name !== 'NotAllowedError') {
        console.warn('[PitchDetector] Captura de audio no disponible:', err);
      }
      return false;
    }
  }

  /**
   * Detiene el micrófono y libera los recursos de audio.
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    events.emit('pitch:stopped');
  }

  /**
   * Bucle de análisis continuo por frame de animación.
   */
  loop() {
    if (!this.isRunning) return;

    this.analyser.getFloatTimeDomainData(this.buffer);
    const result = this.detectPitch(this.buffer, this.audioContext.sampleRate);

    if (result && result.clarity > 0.85) {
      const noteInfo = this.frequencyToNote(result.frequency);
      this.lastDetectedPitch = { ...result, ...noteInfo };

      // Emitir evento de afinador cromático en tiempo real
      events.emit('tuner:pitch', this.lastDetectedPitch);

      // Si el modo Score Following (Escucha Activa) está encendido, comparar con la partitura
      if (this.scoreFollowingActive && this.currentExpectedNote) {
        this.evaluateScoreFollowing(this.lastDetectedPitch);
      }
    } else {
      events.emit('tuner:silence');
    }

    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }

  /**
   * Algoritmo de Autocorrelación normalizada para detección de frecuencia fundamental (F0).
   * @param {Float32Array} buffer 
   * @param {number} sampleRate 
   * @returns {{ frequency: number, clarity: number } | null}
   */
  detectPitch(buffer, sampleRate) {
    const SIZE = buffer.length;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);

    // Umbral de ruido acústico mínimo para descartar silencio de fondo
    if (rms < 0.015) {
      return null;
    }

    // Recorte de señal para acelerar cálculo
    let r1 = 0, r2 = SIZE - 1;
    const thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    }

    const trimmed = buffer.subarray(r1, r2);
    const c = new Float32Array(trimmed.length).fill(0);

    for (let i = 0; i < trimmed.length; i++) {
      for (let j = 0; j < trimmed.length - i; j++) {
        c[i] = c[i] + trimmed[j] * trimmed[j + i];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < trimmed.length; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }

    let T0 = maxpos;
    // Interpolación parabólica para precisión sub-hertzio
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    const frequency = sampleRate / T0;
    const clarity = maxval / c[0];

    // Rango de frecuencias de guitarra y bajo estándar (40Hz [Mi bajo] a 1200Hz [traste 24 guitarra])
    if (frequency >= 40 && frequency <= 1300) {
      return { frequency, clarity, rms };
    }

    return null;
  }

  /**
   * Convierte una frecuencia en Hertz a nota musical, octava, número MIDI y desviación en cents.
   * @param {number} frequency 
   * @returns {{ note: string, octave: number, midi: number, cents: number, noteWithOctave: string }}
   */
  frequencyToNote(frequency) {
    const midiNumber = 69 + 12 * Math.log2(frequency / 440);
    const roundedMidi = Math.round(midiNumber);
    const cents = Math.round((midiNumber - roundedMidi) * 100);

    const noteIndex = ((roundedMidi % 12) + 12) % 12;
    const octave = Math.floor(roundedMidi / 12) - 1;
    const note = NOTE_NAMES[noteIndex];

    return {
      note,
      octave,
      midi: roundedMidi,
      cents,
      noteWithOctave: `${note}${octave}`,
    };
  }

  /**
   * Establece la nota que la partitura espera en el compás/beat actual.
   * @param {Object} noteData - { midi, noteName, fret, string }
   */
  setExpectedNote(noteData) {
    this.currentExpectedNote = noteData;
  }

  /**
   * Evalúa si la nota tocada en el instrumento real coincide con la esperada en la partitura.
   */
  evaluateScoreFollowing(detected) {
    if (!this.currentExpectedNote) return;

    const midiDiff = Math.abs(detected.midi - this.currentExpectedNote.midi);
    const isMatching = midiDiff === 0 || (midiDiff === 12 && Math.abs(detected.cents) <= this.centsTolerance);

    if (isMatching) {
      events.emit('scoreFollowing:hit', {
        expected: this.currentExpectedNote,
        detected,
        accuracy: Math.max(0, 100 - Math.abs(detected.cents)),
      });
    } else {
      events.emit('scoreFollowing:miss', {
        expected: this.currentExpectedNote,
        detected,
      });
    }
  }

  /**
   * Alterna el modo de seguimiento de partitura acústico.
   */
  toggleScoreFollowing(active) {
    this.scoreFollowingActive = (active !== undefined) ? active : !this.scoreFollowingActive;
    events.emit('scoreFollowing:toggled', this.scoreFollowingActive);
    return this.scoreFollowingActive;
  }
}

export const pitchDetector = new PitchDetector();
export default pitchDetector;
