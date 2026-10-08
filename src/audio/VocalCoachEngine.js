/**
 * Recorded-signal pitch analysis using Pitchy's McLeod detector (80–1100 Hz).
 * Measures periodicity, tuning, pitch fluctuation and signal-level consistency.
 * These measurements do not identify a human voice or diagnose breathing,
 * resonance, laryngeal control or vocal health. Use headphones during karaoke.
 */

import { events } from '../core/EventBus.js';
import { PitchDetector as PeriodicPitchDetector } from '../../assets/vendor/pitchy/4.1.0/pitchy.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LATIN_NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

// Consejos didácticos categorizados
const DIDACTIC_TIPS = {
  PERFECT: ['🎯 Tono centrado en la referencia.', '✨ Afinación dentro del margen elegido.'],
  FLAT: ['⬆️ La señal está por debajo de la nota de referencia.'],
  SHARP: ['⬇️ La señal está por encima de la nota de referencia.'],
  BREATH_DROP: ['🔉 El nivel de la señal ha bajado. Revisa la distancia al micrófono.'],
  UNSTABLE: ['🌊 El tono fluctúa; puede ser vibrato, una transición o ruido.']
};

export class VocalCoachEngine {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.buffer = null;
    this.isRunning = false;
    this.starting = false;
    this.captureGeneration = 0;
    this.minimumRms = 0.005;
    this.animationFrameId = null;

    // Estado en tiempo real
    this.targetNote = null; // { note, octave, midi, freq, noteWithOctave }
    this.lastPitch = null;
    this.referenceMode = false;
    this.targetProvider = null;
    this.inputLatencyMs = 0;
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
      expectedReferenceFrames: 0,
      referenceFrames: 0,
      inTuneReferenceFrames: 0,
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
    if (this.isRunning) return true;
    if (this.starting) return this.startPromise;
    const generation = ++this.captureGeneration;
    this.starting = true;
    this.startPromise = this._startCapture(mockStream, generation);
    return this.startPromise;
  }

  async _startCapture(mockStream, generation) {
    let context, stream, source, oscillator;
    let attached = false;
    const current = () => generation === this.captureGeneration;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      context = new AudioCtx({ sampleRate: 44100 });
      this.pendingContext = context;

      if (context.state === 'suspended') {
        await context.resume();
      }
      if (!current()) return false;

      if (window.__IS_TESTING__) {
        console.log('[VocalCoachEngine] TESTING MODE: Inyectando OscillatorNode (440Hz -> 523.25Hz)');
        oscillator = context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = 440; // A4
        oscillator.start();
        
        // Simular cambio a C5 (523.25Hz) a los 2 segundos
        setTimeout(() => {
          if (current() && this.testOscillator) this.testOscillator.frequency.value = 523.25;
        }, 2000);

        source = oscillator;
      } else if (mockStream) {
        stream = mockStream;
        source = context.createMediaStreamSource(stream);
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
            latency: 0,
          },
        });
        if (!current()) return false;
        source = context.createMediaStreamSource(stream);
      }

      this.analyser = context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.25;

      source.connect(this.analyser);
      this.audioContext = context;
      this.mediaStream = stream || null;
      this.sourceNode = source;
      this.testOscillator = oscillator || null;
      this.buffer = new Float32Array(this.analyser.fftSize);
      attached = true;
      this.isRunning = true;
      this.starting = false;

      events.emit('vocalCoach:started');
      this.loop();
      return true;
    } catch (err) {
      if (current()) {
        this.isRunning = false;
        events.emit('vocalCoach:error', err);
        console.warn('[VocalCoachEngine] Error al iniciar captura:', err);
      }
      return false;
    } finally {
      if (!attached) {
        stream?.getTracks().forEach(track => track.stop());
        try { oscillator?.stop(); source?.disconnect(); } catch (_) {}
        if (context && context.state !== 'closed') await context.close().catch(() => {});
      }
      if (current()) {
        this.starting = false;
        this.startPromise = null;
        this.pendingContext = null;
      }
    }
  }

  /**
   * Detiene el motor de audio vocal.
   */
  stop() {
    ++this.captureGeneration;
    this.starting = false;
    this.startPromise = null;
    if (this.pendingContext && this.pendingContext !== this.audioContext && this.pendingContext.state !== 'closed') {
      this.pendingContext.close().catch(() => {});
    }
    this.pendingContext = null;
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
      this.audioContext.close().catch(() => {});
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
      expectedReferenceFrames: 0,
      referenceFrames: 0,
      inTuneReferenceFrames: 0,
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
   * Procesa un frame de audio donde se ha detectado una señal periódica.
   * @param {{frequency: number, clarity: number, rms: number}} detection - Datos de pitch detectados.
   * @private
   */
  _handleVocalDetection(detection) {
    this.consecutiveSilenceFrames = 0;
    this.consecutiveVocalFrames++;
    this.singingDurationFrames++;

    this._countReferenceFrame();
    const noteInfo = this.frequencyToNote(detection.frequency);
    this._updateHistoryBuffers(detection);

    const stability = this.calculateStability();
    const breathSupport = this.calculateBreathSupport();

    // Solo actualizar tesitura si es señal periódica sostenida (mínimo 3 frames y volumen vocal real)
    if (this.consecutiveVocalFrames >= 3 && detection.rms >= this.minimumRms) {
      this.updateTessitura(noteInfo);
    }

    const { targetMidi, targetFreq } = this._resolveTargetFrequency(noteInfo);
    const centsOffset = Math.round(1200 * Math.log2(detection.frequency / targetFreq));
    const accuracyStatus = this._determineAccuracy(centsOffset);

    // CRÍTICO: Registrar en estadísticas de sesión ÚNICAMENTE cuando la canción se está reproduciendo
    // y el usuario está cantando de verdad de forma sostenida (evita que el ruido ambiente invente datos)
    if (this.isPlaybackActive && this.consecutiveVocalFrames >= 3 && detection.rms >= this.minimumRms) {
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
    if (this.referenceMode && this.targetNote) {
      this.sessionStats.referenceFrames++;
      if (accuracyStatus === 'in-tune') this.sessionStats.inTuneReferenceFrames++;
    }
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
  _countReferenceFrame() {
    if (this.targetProvider) this.setTargetNote(this.targetProvider(this.inputLatencyMs));
    if (this.isPlaybackActive && this.referenceMode && this.targetNote) this.sessionStats.expectedReferenceFrames++;
  }

  _handleSilence() {
    this._countReferenceFrame();
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
   * Detector McLeod de señal periódica (80–1100 Hz).
   * @param {Float32Array} buffer 
   * @param {number} sampleRate 
   * @returns {{ frequency: number, clarity: number, rms: number } | null}
   */
  detectVocalPitch(buffer, sampleRate) {
    const size = buffer?.length;
    if (!size || size < 256 || (size & (size - 1)) || !Number.isFinite(sampleRate) || sampleRate <= 0) return null;
    let energy = 0;
    for (let i = 0; i < size; i++) energy += buffer[i] * buffer[i];
    const rms = Math.sqrt(energy / size);
    if (!Number.isFinite(rms) || rms < this.minimumRms) return null;
    if (this.periodicDetector?.inputLength !== size) {
      this.periodicDetector = PeriodicPitchDetector.forFloat32Array(size);
    }
    this.periodicDetector.minVolumeAbsolute = this.minimumRms;
    const [frequency, clarity] = this.periodicDetector.findPitch(buffer, sampleRate);
    // Periodicity cannot distinguish a singer from a loudspeaker or instrument.
    return Number.isFinite(frequency) && frequency >= 80 && frequency <= 1100
      ? { frequency, clarity, rms } : null;
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
   * Calcula la consistencia del nivel de señal (0 - 100%), no el apoyo respiratorio.
   * Compara RMS relativo; influyen el micrófono, la distancia y el control de ganancia.
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

    if (breathSupport !== null && breathSupport < 60 && duration > 25) {
      selectedTip = this.getRandomTip(DIDACTIC_TIPS.BREATH_DROP);
    } else if (stability !== null && stability < 65 && duration > 15) {
      selectedTip = this.getRandomTip(DIDACTIC_TIPS.UNSTABLE);
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
    if (typeof noteOrMidi === 'number' && (!Number.isFinite(noteOrMidi) || noteOrMidi < 0 || noteOrMidi > 127)) noteOrMidi = null;
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
    if (this.lastTargetMidi !== this.targetNote?.midi) {
      this.lastTargetMidi = this.targetNote?.midi;
      events.emit('vocalCoach:targetChanged', this.targetNote);
    }
  }

  /**
   * Sintetiza un tono de referencia auditivo (Pitch Pipe) para guiar al cantante.
   * @param {number} frequency 
   * @param {number} [durationSec=1.5] 
   */
  playReferenceTone(frequency, durationSec = 1.5) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ownsContext = !this.audioContext;
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

      osc.onended = () => { osc.disconnect(); gain.disconnect(); if (ownsContext) ctx.close().catch(() => {}); };
      osc.start();
      osc.stop(ctx.currentTime + durationSec);
    } catch (e) {
      console.warn('Error al reproducir tono de referencia:', e);
    }
  }
}

export const vocalCoachEngine = new VocalCoachEngine();
export default vocalCoachEngine;
