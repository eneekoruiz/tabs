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
    this.consecutiveVocalFrames = 0;
    this.isPlaybackActive = false;
    this.stabilitySamples = [];
    this.breathSamples = [];

    // Tessitura y estadísticas de sesión genuinas
    this.sessionStats = {
      lowestPitch: null,
      highestPitch: null,
      inTuneFrames: 0,
      totalSingingFrames: 0,
      stabilityScore: null,
      breathSupportScore: null,
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

      if (window.__IS_TESTING__) {
        console.log('[VocalCoachEngine] TESTING MODE: Inyectando OscillatorNode (440Hz -> 523.25Hz)');
        this.testOscillator = this.audioContext.createOscillator();
        this.testOscillator.type = 'sine';
        this.testOscillator.frequency.value = 440; // A4
        this.testOscillator.start();
        
        // Simular cambio a C5 (523.25Hz) a los 2 segundos
        setTimeout(() => {
          if (this.testOscillator) this.testOscillator.frequency.value = 523.25;
        }, 2000);

        this.sourceNode = this.testOscillator;
      } else if (mockStream) {
        this.mediaStream = mockStream;
        this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      } else {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
            latency: 0,
          },
        });
        this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      }

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

    if (this.testOscillator) {
      this.testOscillator.stop();
      this.testOscillator.disconnect();
      this.testOscillator = null;
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
   * Activa o desactiva la captura de estadísticas de interpretación vinculadas al reproductor.
   * @param {boolean} active 
   */
  setPlaybackActive(active) {
    this.isPlaybackActive = Boolean(active);
  }

  /**
   * Reinicia completamente las estadísticas de ensayo vocal a valores limpios.
   */
  resetSessionStats() {
    this.sessionStats = {
      lowestPitch: null,
      highestPitch: null,
      inTuneFrames: 0,
      totalSingingFrames: 0,
      stabilityScore: null,
      breathSupportScore: null,
    };
    this.pitchHistory = [];
    this.rmsHistory = [];
    this.stabilitySamples = [];
    this.breathSamples = [];
    this.consecutiveVocalFrames = 0;
    this.consecutiveSilenceFrames = 0;
    this.singingDurationFrames = 0;
  }

  /**
   * Bucle de análisis continuo por requestAnimationFrame.
   */
  loop() {
    if (!this.isRunning) return;

    this.analyser.getFloatTimeDomainData(this.buffer);
    const detection = this.detectVocalPitch(this.buffer, this.audioContext.sampleRate);

    // Filtrar con umbral de claridad estricto para evitar ruidos de fondo
    if (detection && detection.clarity > 0.88) {
      this._handleVocalDetection(detection);
    } else {
      this._handleSilence();
    }

    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }

  /**
   * Procesa un frame de audio donde se ha detectado voz humana.
   * @param {{frequency: number, clarity: number, rms: number}} detection - Datos de pitch detectados.
   * @private
   */
  _handleVocalDetection(detection) {
    this.consecutiveSilenceFrames = 0;
    this.consecutiveVocalFrames++;
    this.singingDurationFrames++;

    const noteInfo = this.frequencyToNote(detection.frequency);
    this._updateHistoryBuffers(detection);

    const stability = this.calculateStability();
    const breathSupport = this.calculateBreathSupport();

    // Solo actualizar tesitura si es voz humana sostenida (mínimo 3 frames y volumen vocal real)
    if (this.consecutiveVocalFrames >= 3 && detection.rms >= 0.020) {
      this.updateTessitura(noteInfo);
    }

    const { targetMidi, targetFreq } = this._resolveTargetFrequency(noteInfo);
    const centsOffset = Math.round(1200 * Math.log2(detection.frequency / targetFreq));
    const accuracyStatus = this._determineAccuracy(centsOffset);

    // CRÍTICO: Registrar en estadísticas de sesión ÚNICAMENTE cuando la canción se está reproduciendo
    // y el usuario está cantando de verdad de forma sostenida (evita que el ruido ambiente invente datos)
    if (this.isPlaybackActive && this.consecutiveVocalFrames >= 3 && detection.rms >= 0.020) {
      this._updateSessionStats(accuracyStatus, stability, breathSupport);
    }

    this.evaluateDidacticTips({
      accuracyStatus, centsOffset, stability, breathSupport, noteInfo, duration: this.singingDurationFrames,
    });

    this.lastPitch = {
      ...detection, ...noteInfo, centsOffset, accuracyStatus, stability, breathSupport,
      targetNote: this.targetNote, tip: this.currentTip, sessionStats: { ...this.sessionStats }
    };

    events.emit('vocalCoach:pitch', this.lastPitch);
  }

  /**
   * Actualiza los buffers circulares de historial de pitch y volumen.
   * @param {{frequency: number, rms: number}} detection 
   * @private
   */
  _updateHistoryBuffers(detection) {
    this.pitchHistory.push(detection.frequency);
    if (this.pitchHistory.length > 20) this.pitchHistory.shift();
    this.rmsHistory.push(detection.rms);
    if (this.rmsHistory.length > 20) this.rmsHistory.shift();
  }

  /**
   * Resuelve la nota objetivo contra la que comparar la afinación.
   * @param {{midi: number}} noteInfo - Nota detectada libremente.
   * @returns {{targetMidi: number, targetFreq: number}}
   * @private
   */
  _resolveTargetFrequency(noteInfo) {
    if (!this.targetNote) {
      return { targetMidi: noteInfo.midi, targetFreq: this.midiToFrequency(noteInfo.midi) };
    }
    // Ajustar la nota objetivo a la octava más cercana del cantante (evita penalizar registro masculino vs femenino)
    let targetMidi = this.targetNote.midi;
    while (targetMidi - noteInfo.midi > 6) targetMidi -= 12;
    while (noteInfo.midi - targetMidi > 6) targetMidi += 12;
    const targetFreq = this.midiToFrequency(targetMidi);
    return { targetMidi, targetFreq };
  }

  /**
   * Evalúa la precisión en base a la tolerancia en cents.
   * @param {number} centsOffset 
   * @returns {'in-tune'|'flat'|'sharp'}
   * @private
   */
  _determineAccuracy(centsOffset) {
    if (centsOffset < -this.centsTolerance) return 'flat';
    if (centsOffset > this.centsTolerance) return 'sharp';
    return 'in-tune';
  }

  /**
   * Actualiza estadísticas de sesión (puntuación, aciertos).
   * @param {'in-tune'|'flat'|'sharp'} accuracyStatus 
   * @param {number|null} stability 
   * @param {number|null} breathSupport 
   * @private
   */
  _updateSessionStats(accuracyStatus, stability, breathSupport) {
    this.sessionStats.totalSingingFrames++;
    if (accuracyStatus === 'in-tune') this.sessionStats.inTuneFrames++;
    if (typeof stability === 'number' && stability > 0) {
      this.stabilitySamples.push(stability);
      if (this.stabilitySamples.length > 200) this.stabilitySamples.shift();
      const avg = this.stabilitySamples.reduce((a, b) => a + b, 0) / this.stabilitySamples.length;
      this.sessionStats.stabilityScore = Math.round(avg);
    }
    if (typeof breathSupport === 'number' && breathSupport > 0) {
      this.breathSamples.push(breathSupport);
      if (this.breathSamples.length > 200) this.breathSamples.shift();
      const avg = this.breathSamples.reduce((a, b) => a + b, 0) / this.breathSamples.length;
      this.sessionStats.breathSupportScore = Math.round(avg);
    }
  }

  /**
   * Procesa un frame de silencio o señal no vocal.
   * @private
   */
  _handleSilence() {
    this.consecutiveSilenceFrames++;
    this.consecutiveVocalFrames = 0;
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

    // Umbral de volumen para descartar ruido ambiente (AC, ventiladores, clicks). El canto supera 0.020
    if (rms < 0.020) return null;

    const minPeriod = Math.floor(sampleRate / 1100); // ~1100Hz (C6)
    const maxPeriod = Math.floor(sampleRate / 80);   // ~80Hz (E2) - evita zumbidos de red de 50/60Hz
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
      if (minVal > 0.35) return null; // No es tono periódico claro
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

    if (frequency >= 80 && frequency <= 1100) {
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
   * Calcula la estabilidad real del tono (0 - 100%).
   * Mide la varianza de afinación en cents durante frases sostenidas.
   */
  calculateStability() {
    if (this.pitchHistory.length < 6) return null;
    const slice = this.pitchHistory.slice(-10);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    if (mean <= 0) return null;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
    const stdDev = Math.sqrt(variance);

    // Desviación en semitonos/cents
    const centsStdDev = 1200 * (stdDev / mean);
    // Un vibrato natural y controlado suele tener 15 - 30 cents de fluctuación suave.
    // Fluctuaciones erráticas mayores a 50 cents penalizan la estabilidad.
    if (centsStdDev <= 25) {
      return Math.min(100, Math.round(85 + (1 - centsStdDev / 25) * 15));
    }
    const score = Math.max(15, Math.round(85 - (centsStdDev - 25) * 1.6));
    return score;
  }

  /**
   * Calcula la consistencia del apoyo respiratorio real (0 - 100%).
   * Evalúa la curva envolvente de presión SPL a lo largo del verso.
   */
  calculateBreathSupport() {
    if (this.rmsHistory.length < 8) return null;
    const firstHalf = this.rmsHistory.slice(0, 4);
    const secondHalf = this.rmsHistory.slice(-4);
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (avgFirst < 0.02) return null;

    const ratio = avgSecond / avgFirst;
    if (ratio >= 0.70) {
      return Math.min(100, Math.round(80 + Math.min(1, ratio) * 20));
    } else if (ratio >= 0.40) {
      return Math.round(50 + (ratio - 0.40) * 100);
    } else {
      return Math.max(10, Math.round(ratio * 100));
    }
  }

  /**
   * Actualiza el registro de tessitura alcanzado en la sesión.
   */
  updateTessitura(noteInfo) {
    if (!noteInfo || noteInfo.midi < 36 || noteInfo.midi > 84) return;
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
