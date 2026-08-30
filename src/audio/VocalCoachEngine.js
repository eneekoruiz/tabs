/**
 * @file VocalCoachEngine.js
 * @description Motor DSP de Asistencia y Entrenamiento Vocal en tiempo real.
 * Utiliza Web Audio API y algoritmo YIN optimizado para la voz humana.
 * Proporciona:
 * - Detección de Frecuencia Fundamental (F0) y Afinación en Cents en rango vocal (65Hz a 1200Hz / C2 a D6).
 * - Análisis de Estabilidad Vocal (Vocal Jitter / Tremor score).
 * - Detección de Apoyo Respiratorio (Breath Support & Decay Tracker para detectar caídas de aire).
 * - Detección de Registro y Tessitura (Rango vocal alcanzado durante la sesión).
 * - Motor Didáctico de Consejos Vocales en Tiempo Real (Didactic Guidance Engine).
 * - Generador de Tonos Guía y Ejercicios de Calentamiento Vocal.
 */

import { events } from '../core/EventBus.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LATIN_NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

// Consejos didácticos categorizados
const DIDACTIC_TIPS = {
  PERFECT: [
    '🎯 ¡Afinación clavada! Mantén la columna de aire constante.',
    '✨ Excelente resonancia y afinación impecable.',
    '💎 Tono centrado y limpio. Buen control laríngeo.'
  ],
  FLAT: [
    '⬆️ Ligeramente bajo (Flat): Sonríe internamente y proyecta hacia los resonadores faciales.',
    '⬆️ Estás por debajo del tono: Eleva el velo del paladar y piensa la nota "desde arriba".',
    '⬆️ Apoyo: Empuja suavemente con el diafragma para dar energía al tono.'
  ],
  SHARP: [
    '⬇️ Ligeramente alto (Sharp): Relaja la laringe y no aprietes la garganta.',
    '⬇️ Estás por encima del tono: Suelta la tensión del cuello y deja fluir el aire.',
    '⬇️ Demasiada presión de aire: Modera el empuje para no subir el tono.'
  ],
  BREATH_DROP: [
    '🌬️ Apoyo diafragmático: Tu volumen cae al final del verso. Inhala hondo expandiendo las costillas.',
    '🫁 Falta de aire: No dejes que la presión decaiga antes de terminar la frase.',
    '💨 Mantén el caudal de aire continuo hasta la última sílaba.'
  ],
  UNSTABLE: [
    '🌊 Estabilidad: Tu tono fluctúa. Concéntrate en un flujo de aire uniforme y constante.',
    '🧘 Relaja la mandíbula inferior y mantén la lengua apoyada tras los dientes inferiores.'
  ],
  HIGH_STRAIN: [
    '🔥 Registro agudo: Proyecta la "voz mixta" hacia el paladar blando sin empujar desde el cuello.',
    '🕊️ Nota aguda: Abre más la boca verticalmente y mantén los hombros bajos.'
  ],
  POSTURE: [
    '🧘 Postura vocal: Barbilla paralela al suelo, pecho abierto y columna erguida.',
    '💧 Hidratación: Bebe pequeños sorbos de agua templada para mantener las cuerdas elásticas.'
  ]
};

export class VocalCoachEngine {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.buffer = null;
    this.isRunning = false;
    this.animationFrameId = null;

    // Estado en tiempo real
    this.targetNote = null; // { note, octave, midi, freq, noteWithOctave }
    this.lastPitch = null;
    this.centsTolerance = 15; // +/- 15 cents se considera "in-tune" perfecto

    // Buffers de métricas para análisis temporal
    this.pitchHistory = []; // últimas 20 lecturas de frecuencia
    this.rmsHistory = []; // últimas 20 lecturas de volumen RMS
    this.consecutiveSilenceFrames = 0;
    this.singingDurationFrames = 0;

    // Tessitura y estadísticas de sesión
    this.sessionStats = {
      lowestPitch: null,
      highestPitch: null,
      inTuneFrames: 0,
      totalSingingFrames: 0,
      stabilityScore: 100,
      breathSupportScore: 100,
    };

    // Control de tips didácticos
    this.currentTip = '🎙️ Canta una nota para comenzar el análisis vocal.';
    this.lastTipChangeTime = 0;
    this.tipCooldownMs = 3000;
  }

  /**
   * Inicia la captura de audio del micrófono o stream simulado.
   * @param {MediaStream} [mockStream] 
   */
  async start(mockStream = null) {
    if (this.isRunning) return;

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
      this.analyser.smoothingTimeConstant = 0.25;

      this.sourceNode.connect(this.analyser);
      this.buffer = new Float32Array(this.analyser.fftSize);
      this.isRunning = true;

      events.emit('vocalCoach:started');
      this.loop();
    } catch (err) {
      this.isRunning = false;
      events.emit('vocalCoach:error', err);
      console.warn('[VocalCoachEngine] Error al iniciar captura:', err);
    }
  }

  /**
   * Detiene el motor de audio vocal.
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
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

    events.emit('vocalCoach:stopped');
  }

  /**
   * Bucle de análisis continuo por requestAnimationFrame.
   */
  loop() {
    if (!this.isRunning) return;

    this.analyser.getFloatTimeDomainData(this.buffer);
    const detection = this.detectVocalPitch(this.buffer, this.audioContext.sampleRate);

    if (detection && detection.clarity > 0.82) {
      this.consecutiveSilenceFrames = 0;
      this.singingDurationFrames++;

      const noteInfo = this.frequencyToNote(detection.frequency);
      
      // Actualizar historial
      this.pitchHistory.push(detection.frequency);
      if (this.pitchHistory.length > 20) this.pitchHistory.shift();

      this.rmsHistory.push(detection.rms);
      if (this.rmsHistory.length > 20) this.rmsHistory.shift();

      // Métricas de estabilidad y aliento
      const stability = this.calculateStability();
      const breathSupport = this.calculateBreathSupport();

      // Seguimiento de tessitura / rango
      this.updateTessitura(noteInfo);

      // Evaluación respecto a nota objetivo (si existe) o afinación cromática libre
      const targetMidi = this.targetNote ? this.targetNote.midi : noteInfo.midi;
      const targetFreq = this.targetNote ? this.targetNote.freq : this.midiToFrequency(noteInfo.midi);
      
      // Desviación en cents respecto a la nota objetivo más cercana
      const centsOffset = Math.round(1200 * Math.log2(detection.frequency / targetFreq));
      
      let accuracyStatus = 'in-tune'; // 'in-tune' | 'flat' | 'sharp'
      if (centsOffset < -this.centsTolerance) accuracyStatus = 'flat';
      else if (centsOffset > this.centsTolerance) accuracyStatus = 'sharp';

      // Actualizar estadísticas de sesión
      this.sessionStats.totalSingingFrames++;
      if (accuracyStatus === 'in-tune') this.sessionStats.inTuneFrames++;
      this.sessionStats.stabilityScore = stability;
      this.sessionStats.breathSupportScore = breathSupport;

      // Evaluar consejo didáctico
      this.evaluateDidacticTips({
        accuracyStatus,
        centsOffset,
        stability,
        breathSupport,
        noteInfo,
        duration: this.singingDurationFrames,
      });

      this.lastPitch = {
        ...detection,
        ...noteInfo,
        centsOffset,
        accuracyStatus,
        stability,
        breathSupport,
        targetNote: this.targetNote,
        tip: this.currentTip,
        sessionStats: { ...this.sessionStats },
      };

      events.emit('vocalCoach:pitch', this.lastPitch);
    } else {
      this.consecutiveSilenceFrames++;
      if (this.consecutiveSilenceFrames > 8) {
        this.singingDurationFrames = 0;
        this.pitchHistory = [];
        this.rmsHistory = [];
        events.emit('vocalCoach:silence', {
          tip: this.currentTip,
          sessionStats: { ...this.sessionStats },
        });
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }

  /**
   * Algoritmo de detección de tono YIN optimizado para voz humana (65Hz - 1200Hz).
   * @param {Float32Array} buffer 
   * @param {number} sampleRate 
   * @returns {{ frequency: number, clarity: number, rms: number } | null}
   */
  detectVocalPitch(buffer, sampleRate) {
    const SIZE = buffer.length;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
      const v = buffer[i];
      rms += v * v;
    }
    rms = Math.sqrt(rms / SIZE);

    // Umbral de volumen para descartar ruido ambiente
    if (rms < 0.012) return null;

    const minPeriod = Math.floor(sampleRate / 1200); // ~1200Hz (D6)
    const maxPeriod = Math.floor(sampleRate / 65);   // ~65Hz (C2)
    const halfSize = Math.floor(SIZE / 2);
    const difference = new Float32Array(maxPeriod + 1);

    // Paso 1: Función de diferencia d(t)
    for (let tau = minPeriod; tau <= maxPeriod && tau < halfSize; tau++) {
      let sum = 0;
      for (let i = 0; i < halfSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      difference[tau] = sum;
    }

    // Paso 2: Función de diferencia media acumulada normalizada d'(t)
    const cmndf = new Float32Array(maxPeriod + 1);
    cmndf[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maxPeriod && tau < halfSize; tau++) {
      runningSum += difference[tau];
      cmndf[tau] = runningSum > 0 ? (difference[tau] * tau) / runningSum : 1;
    }

    // Paso 3: Búsqueda del primer valle bajo el umbral de YIN (0.15)
    const threshold = 0.15;
    let tauEstimate = -1;
    for (let tau = minPeriod; tau <= maxPeriod && tau < halfSize; tau++) {
      if (cmndf[tau] < threshold) {
        while (tau + 1 <= maxPeriod && cmndf[tau + 1] < cmndf[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    // Si ningún valle cae bajo el umbral, buscar el mínimo global
    if (tauEstimate === -1) {
      let minVal = 1;
      for (let tau = minPeriod; tau <= maxPeriod && tau < halfSize; tau++) {
        if (cmndf[tau] < minVal) {
          minVal = cmndf[tau];
          tauEstimate = tau;
        }
      }
      if (minVal > 0.45) return null; // No es tono periódico claro
    }

    if (tauEstimate <= 0 || tauEstimate >= halfSize - 1) return null;

    // Paso 4: Interpolación parabólica para precisión sub-cent
    const x0 = tauEstimate;
    const x1 = tauEstimate - 1;
    const x2 = tauEstimate + 1;
    const y0 = cmndf[x0];
    const y1 = cmndf[x1];
    const y2 = cmndf[x2];

    const denom = 2 * (2 * y0 - y1 - y2);
    let betterTau = tauEstimate;
    if (Math.abs(denom) > 1e-6) {
      betterTau = tauEstimate + (y1 - y2) / (2 * (y1 - 2 * y0 + y2));
    }

    const frequency = sampleRate / betterTau;
    const clarity = Math.max(0, Math.min(1, 1 - cmndf[tauEstimate]));

    if (frequency >= 65 && frequency <= 1200) {
      return { frequency, clarity, rms };
    }

    return null;
  }

  /**
   * Convierte Hz a información de nota musical.
   */
  frequencyToNote(frequency) {
    const midiNumber = 69 + 12 * Math.log2(frequency / 440);
    const roundedMidi = Math.round(midiNumber);
    const cents = Math.round((midiNumber - roundedMidi) * 100);

    const noteIndex = ((roundedMidi % 12) + 12) % 12;
    const octave = Math.floor(roundedMidi / 12) - 1;
    const note = NOTE_NAMES[noteIndex];
    const latin = LATIN_NAMES[noteIndex];

    return {
      note,
      latin,
      octave,
      midi: roundedMidi,
      cents,
      frequency: Math.round(frequency * 10) / 10,
      noteWithOctave: `${note}${octave}`,
      latinWithOctave: `${latin}${octave}`,
    };
  }

  midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * Calcula la estabilidad del tono (0 - 100%).
   */
  calculateStability() {
    if (this.pitchHistory.length < 5) return 100;
    const slice = this.pitchHistory.slice(-10);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
    const stdDev = Math.sqrt(variance);

    // Si la desviación estándar en Hz es < 2Hz, 100% de estabilidad
    const score = Math.max(0, Math.min(100, Math.round(100 - (stdDev / mean) * 800)));
    return score;
  }

  /**
   * Calcula la consistencia del apoyo respiratorio (0 - 100%).
   */
  calculateBreathSupport() {
    if (this.rmsHistory.length < 8) return 100;
    const firstHalf = this.rmsHistory.slice(0, 4);
    const secondHalf = this.rmsHistory.slice(-4);
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    // Si el volumen cae drásticamente (>50% de caída), el apoyo respiratorio está fallando
    if (avgFirst > 0.03 && avgSecond < avgFirst * 0.45) {
      return 40;
    }
    return 95;
  }

  /**
   * Actualiza el registro de tessitura alcanzado en la sesión.
   */
  updateTessitura(noteInfo) {
    if (!this.sessionStats.lowestPitch || noteInfo.midi < this.sessionStats.lowestPitch.midi) {
      this.sessionStats.lowestPitch = noteInfo;
    }
    if (!this.sessionStats.highestPitch || noteInfo.midi > this.sessionStats.highestPitch.midi) {
      this.sessionStats.highestPitch = noteInfo;
    }
  }

  /**
   * Evalúa patrones vocales y dispara consejos didácticos inteligentes.
   */
  evaluateDidacticTips({ accuracyStatus, centsOffset, stability, breathSupport, noteInfo, duration }) {
    const now = Date.now();
    if (now - this.lastTipChangeTime < this.tipCooldownMs) return;

    let selectedTip = null;

    if (breathSupport < 60 && duration > 25) {
      selectedTip = this.getRandomTip(DIDACTIC_TIPS.BREATH_DROP);
    } else if (stability < 65 && duration > 15) {
      selectedTip = this.getRandomTip(DIDACTIC_TIPS.UNSTABLE);
    } else if (noteInfo.midi >= 72 && accuracyStatus !== 'in-tune') { // C5 o superior
      selectedTip = this.getRandomTip(DIDACTIC_TIPS.HIGH_STRAIN);
    } else if (accuracyStatus === 'flat') {
      selectedTip = this.getRandomTip(DIDACTIC_TIPS.FLAT);
    } else if (accuracyStatus === 'sharp') {
      selectedTip = this.getRandomTip(DIDACTIC_TIPS.SHARP);
    } else if (accuracyStatus === 'in-tune') {
      selectedTip = this.getRandomTip(DIDACTIC_TIPS.PERFECT);
    }

    if (selectedTip && selectedTip !== this.currentTip) {
      this.currentTip = selectedTip;
      this.lastTipChangeTime = now;
      events.emit('vocalCoach:tip', this.currentTip);
    }
  }

  getRandomTip(tipsArray) {
    return tipsArray[Math.floor(Math.random() * tipsArray.length)];
  }

  /**
   * Establece una nota objetivo para que el usuario intente igualarla (Matching Pitch).
   * @param {string|number} noteOrMidi - Ej: 'A4', 'C#3' o número MIDI (69)
   */
  setTargetNote(noteOrMidi) {
    if (typeof noteOrMidi === 'number') {
      const freq = this.midiToFrequency(noteOrMidi);
      this.targetNote = { ...this.frequencyToNote(freq), freq };
    } else if (typeof noteOrMidi === 'string') {
      const match = noteOrMidi.match(/^([A-G][#b]?)([0-8])$/i);
      if (match) {
        const note = match[1].toUpperCase();
        const octave = parseInt(match[2], 10);
        const idx = NOTE_NAMES.indexOf(note);
        if (idx !== -1) {
          const midi = (octave + 1) * 12 + idx;
          const freq = this.midiToFrequency(midi);
          this.targetNote = {
            note,
            latin: LATIN_NAMES[idx],
            octave,
            midi,
            freq,
            noteWithOctave: `${note}${octave}`,
            latinWithOctave: `${LATIN_NAMES[idx]}${octave}`,
          };
        }
      }
    } else {
      this.targetNote = null;
    }
    events.emit('vocalCoach:targetChanged', this.targetNote);
  }

  /**
   * Sintetiza un tono de referencia auditivo (Pitch Pipe) para guiar al cantante.
   * @param {number} frequency 
   * @param {number} [durationSec=1.5] 
   */
  playReferenceTone(frequency, durationSec = 1.5) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = this.audioContext || new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Timbre suave tipo flauta/vocal con onda triangular y envolvente ADSR suave
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationSec);
    } catch (e) {
      console.warn('Error al reproducir tono de referencia:', e);
    }
  }
}

export const vocalCoachEngine = new VocalCoachEngine();
export default vocalCoachEngine;
