/**
 * @file SmartBandEngine.js
 * @description Motor de Acompañamiento Generativo IA (The Smart Band).
 * Genera líneas de bajo y patrones de batería en tiempo real adaptados a la progresión
 * de acordes de la partitura o detectados en directo, con síntesis Web Audio pura y SoundFonts.
 */

import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';

export class SmartBandEngine {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.bpm = 120;
    this.style = 'rock'; // 'rock' | 'jazz' | 'funk' | 'pop' | 'metronome'
    this.currentStep = 0; // 0 a 15 (16th notes por compás)
    this.stepInterval = null;
    this.nextNoteTime = 0;
    this.timerId = null;

    // Volúmenes y Mutes
    this.masterVolume = 0.85;
    this.drumsVolume = 0.8;
    this.bassVolume = 0.85;
    this.drumsMuted = false;
    this.bassMuted = false;

    // Progresión de acordes activa
    this.chordProgression = ['Am', 'F', 'C', 'G'];
    this.currentChordIndex = 0;
    this.chordsPerBar = 1; // Cuántos acordes por compás (1 o 2)

    // Master Gains
    this.drumsGainNode = null;
    this.bassGainNode = null;
    this.masterGainNode = null;

    this.initEvents();
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx({ latencyHint: 'interactive' });
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this._ensureGains();
    return this.audioCtx;
  }

  _ensureGains() {
    if (!this.audioCtx) return;
    if (!this.masterGainNode) {
      this.masterGainNode = this.audioCtx.createGain();
      this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.audioCtx.currentTime);
      this.masterGainNode.connect(this.audioCtx.destination);
    }
    if (!this.drumsGainNode) {
      this.drumsGainNode = this.audioCtx.createGain();
      this.drumsGainNode.gain.setValueAtTime(this.drumsMuted ? 0 : this.drumsVolume, this.audioCtx.currentTime);
      this.drumsGainNode.connect(this.masterGainNode);
    }
    if (!this.bassGainNode) {
      this.bassGainNode = this.audioCtx.createGain();
      this.bassGainNode.gain.setValueAtTime(this.bassMuted ? 0 : this.bassVolume, this.audioCtx.currentTime);
      this.bassGainNode.connect(this.masterGainNode);
    }
  }

  initEvents() {
    // Sincronizar tempo y acordes al cargar partitura
    events.on('score:loaded', ({ score }) => {
      if (score.tempo) this.bpm = score.tempo;
      this._extractChordsFromSong(score);
    });

    events.on('song:loaded', (song) => {
      if (song.tempo) this.bpm = song.tempo;
      if (song.chords && song.chords.length > 0) {
        this.chordProgression = song.chords.map(c => typeof c === 'string' ? c : c.name);
      }
    });

    // Sincronizar con reproducción global si el usuario lo desea
    events.on('playback:state', ({ state: playState }) => {
      if (playState === 'playing' && this.syncWithPlayback) {
        this.start();
      } else if (playState !== 'playing' && this.syncWithPlayback) {
        this.stop();
      }
    });

    events.on('playback:time', ({ currentTick }) => {
      // Calcular compás activo si está sincronizado
    });
  }

  _extractChordsFromSong(score) {
    if (!score) return;
    const chords = [];
    if (score.masterBars) {
      // Extraer de compases si existen anotaciones de acordes
    }
    if (chords.length > 0) {
      this.chordProgression = chords;
    }
  }

  setProgression(chordsArray) {
    if (Array.isArray(chordsArray) && chordsArray.length > 0) {
      this.chordProgression = chordsArray;
      this.currentChordIndex = 0;
      events.emit('smartBand:progressionUpdated', { progression: this.chordProgression });
    }
  }

  setStyle(styleName) {
    this.style = styleName;
    events.emit('smartBand:styleChanged', { style: this.style });
  }

  setTempo(newBpm) {
    this.bpm = Math.max(40, Math.min(260, Math.round(newBpm)));
    events.emit('smartBand:tempoChanged', { bpm: this.bpm });
  }

  setDrumsVolume(val) {
    this.drumsVolume = Math.max(0, Math.min(1, val));
    if (this.drumsGainNode && !this.drumsMuted) {
      this.drumsGainNode.gain.setTargetAtTime(this.drumsVolume, this.audioCtx.currentTime, 0.02);
    }
  }

  setBassVolume(val) {
    this.bassVolume = Math.max(0, Math.min(1, val));
    if (this.bassGainNode && !this.bassMuted) {
      this.bassGainNode.gain.setTargetAtTime(this.bassVolume, this.audioCtx.currentTime, 0.02);
    }
  }

  toggleDrumsMute(forceState) {
    this.drumsMuted = typeof forceState === 'boolean' ? forceState : !this.drumsMuted;
    if (this.drumsGainNode) {
      this.drumsGainNode.gain.setTargetAtTime(this.drumsMuted ? 0 : this.drumsVolume, this.audioCtx.currentTime, 0.02);
    }
    return this.drumsMuted;
  }

  toggleBassMute(forceState) {
    this.bassMuted = typeof forceState === 'boolean' ? forceState : !this.bassMuted;
    if (this.bassGainNode) {
      this.bassGainNode.gain.setTargetAtTime(this.bassMuted ? 0 : this.bassVolume, this.audioCtx.currentTime, 0.02);
    }
    return this.bassMuted;
  }

  start() {
    if (this.isPlaying) return;
    const ctx = this.getAudioContext();
    this.isPlaying = true;
    this.currentStep = 0;
    this.currentChordIndex = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;

    this._scheduleNextBeats();
    events.emit('smartBand:stateChanged', { isPlaying: true, style: this.style, bpm: this.bpm });
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    events.emit('smartBand:stateChanged', { isPlaying: false });
  }

  toggle() {
    if (this.isPlaying) this.stop();
    else this.start();
    return this.isPlaying;
  }

  _scheduleNextBeats() {
    if (!this.isPlaying) return;
    const ctx = this.getAudioContext();
    const lookahead = 0.1; // 100ms
    const secondsPer16th = (60.0 / this.bpm) / 4.0;

    while (this.nextNoteTime < ctx.currentTime + lookahead) {
      this._playStepAtTime(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += secondsPer16th;
      this.currentStep = (this.currentStep + 1) % 16;
      if (this.currentStep === 0) {
        this.currentChordIndex = (this.currentChordIndex + 1) % this.chordProgression.length;
      }
    }

    this.timerId = setTimeout(() => this._scheduleNextBeats(), 25);
  }

  _playStepAtTime(step, time) {
    const currentChord = this.chordProgression[this.currentChordIndex] || 'Am';
    const rootFreq = this._getChordRootFrequency(currentChord);

    // Disparar eventos visuales de metrónomo y pulso
    events.emit('smartBand:step', {
      step,
      isQuarterBeat: step % 4 === 0,
      beatNumber: Math.floor(step / 4) + 1,
      currentChord,
      style: this.style
    });

    // 1. Sintetizar Batería según Estilo
    if (!this.drumsMuted) {
      this._synthesizeDrumsForStyle(this.style, step, time);
    }

    // 2. Sintetizar Bajo según Estilo
    if (!this.bassMuted && this.style !== 'metronome') {
      this._synthesizeBassForStyle(this.style, step, time, rootFreq, currentChord);
    }
  }

  // =========================================================================
  // SÍNTESIS DE BATERÍA (WEB AUDIO DSP ANALÓGICO)
  // =========================================================================

  _playKick(time, gain = 1.0) {
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.08);

    gainNode.gain.setValueAtTime(gain * 0.9, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(gainNode);
    gainNode.connect(this.drumsGainNode);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  _playSnare(time, gain = 0.85) {
    const ctx = this.audioCtx;

    // Cuerpo tonal de la caja (180Hz)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.frequency.setValueAtTime(185, time);
    oscGain.gain.setValueAtTime(gain * 0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(oscGain);
    oscGain.connect(this.drumsGainNode);
    osc.start(time);
    osc.stop(time + 0.14);

    // Ruido blanco filtrado paso banda (bordonero)
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, time);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(gain * 0.8, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.drumsGainNode);

    noise.start(time);
    noise.stop(time + 0.2);
  }

  _playHiHat(time, isOpen = false, gain = 0.45) {
    const ctx = this.audioCtx;
    const bufferSize = ctx.sampleRate * (isOpen ? 0.25 : 0.05);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, time);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(gain, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + (isOpen ? 0.22 : 0.04));

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.drumsGainNode);

    noise.start(time);
    noise.stop(time + (isOpen ? 0.25 : 0.05));
  }

  _synthesizeDrumsForStyle(style, step, time) {
    switch (style) {
      case 'rock':
        // Rock 4/4 clásico: Kick en 0 y 8 (o sincopa en 10), Snare en 4 y 12, Hi-Hat cada 2 pasos
        if (step === 0 || step === 8 || step === 10) this._playKick(time, step === 10 ? 0.7 : 1.0);
        if (step === 4 || step === 12) this._playSnare(time, 0.9);
        if (step % 2 === 0) this._playHiHat(time, step === 14, 0.4);
        break;

      case 'jazz':
        // Jazz Swing: Ride cymbal suave en 0, 4, 6, 8, 12, 14, HiHat de pedal en 4 y 12
        if (step === 0 || step === 8) this._playKick(time, 0.4); // Feathered kick
        if (step === 4 || step === 12) this._playHiHat(time, false, 0.35); // Foot chick
        if (step % 4 === 0 || step % 4 === 3) this._playHiHat(time, true, 0.25); // Swing ride
        if (step === 10) this._playSnare(time, 0.3); // Ghost brush
        break;

      case 'funk':
        // Funk Syncopated Groove: Kick en 0, 6, 10, Snare en 4, 12 + ghost notes en 7 y 15
        if (step === 0 || step === 6 || step === 10) this._playKick(time, 0.95);
        if (step === 4 || step === 12) this._playSnare(time, 0.95);
        if (step === 7 || step === 15) this._playSnare(time, 0.3); // Ghost note
        this._playHiHat(time, step === 14, (step % 2 === 0) ? 0.4 : 0.25); // 16th HiHats
        break;

      case 'pop':
        // Pop / Ballad Half-time: Kick en 0 y 10, Snare en 8 (half time), 8th-note hats
        if (step === 0 || step === 10) this._playKick(time, 0.85);
        if (step === 8) this._playSnare(time, 0.85);
        if (step % 2 === 0) this._playHiHat(time, false, 0.35);
        break;

      case 'metronome':
        // Metrónomo puro
        if (step === 0) this._playKick(time, 1.0);
        else if (step % 4 === 0) this._playSnare(time, 0.5);
        break;
    }
  }

  // =========================================================================
  // SÍNTESIS DE LÍNEA DE BAJO (DUAL OSCILLATOR ANALOG BASS)
  // =========================================================================

  _playBassNote(freq, time, duration = 0.2, gain = 0.85) {
    if (!freq || freq <= 0) return;
    const ctx = this.audioCtx;

    // Oscilador 1: Senoidal para subgraves sólidos
    const oscSub = ctx.createOscillator();
    oscSub.type = 'sine';
    oscSub.frequency.setValueAtTime(freq, time);

    // Oscilador 2: Diente de sierra con filtro pasabajos para cuerpo armónico
    const oscSaw = ctx.createOscillator();
    oscSaw.type = 'sawtooth';
    oscSaw.frequency.setValueAtTime(freq, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, time);
    filter.frequency.exponentialRampToValueAtTime(140, time + duration);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, time);
    gainNode.gain.linearRampToValueAtTime(gain, time + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

    oscSub.connect(gainNode);
    oscSaw.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.bassGainNode);

    oscSub.start(time);
    oscSaw.start(time);
    oscSub.stop(time + duration + 0.05);
    oscSaw.stop(time + duration + 0.05);
  }

  _synthesizeBassForStyle(style, step, time, rootFreq, chordName) {
    const isMinor = chordName.toLowerCase().includes('m') && !chordName.toLowerCase().includes('maj');
    const thirdFreq = rootFreq * (isMinor ? 1.189 : 1.259); // 3ra menor o mayor
    const fifthFreq = rootFreq * 1.498; // 5ta justa
    const octaveFreq = rootFreq * 2.0;

    switch (style) {
      case 'rock':
        // Corcheas pulsantes sólidas (Root-Root-Root-5th/Octave)
        if (step === 0 || step === 2 || step === 4 || step === 6) {
          this._playBassNote(rootFreq, time, 0.18, 0.85);
        } else if (step === 8 || step === 10) {
          this._playBassNote(rootFreq, time, 0.18, 0.85);
        } else if (step === 12) {
          this._playBassNote(fifthFreq, time, 0.18, 0.85);
        } else if (step === 14) {
          this._playBassNote(octaveFreq, time, 0.18, 0.8);
        }
        break;

      case 'jazz':
        // Walking Bass por negras: 1 (Root), 2 (Third), 3 (Fifth), 4 (Chromatic Approach)
        if (step === 0) this._playBassNote(rootFreq, time, 0.45, 0.8);
        if (step === 4) this._playBassNote(thirdFreq, time, 0.45, 0.75);
        if (step === 8) this._playBassNote(fifthFreq, time, 0.45, 0.8);
        if (step === 12) this._playBassNote(rootFreq * 1.059, time, 0.45, 0.7); // Semitono de paso
        break;

      case 'funk':
        // Slap Bass sincopado con octavas y pop
        if (step === 0) this._playBassNote(rootFreq, time, 0.15, 0.95);
        if (step === 3) this._playBassNote(octaveFreq, time, 0.1, 0.9); // Pop octave
        if (step === 6) this._playBassNote(rootFreq, time, 0.15, 0.85);
        if (step === 10) this._playBassNote(fifthFreq, time, 0.15, 0.9);
        if (step === 14) this._playBassNote(thirdFreq, time, 0.15, 0.85);
        break;

      case 'pop':
        // Notas largas arpegiadas y cálidas
        if (step === 0) this._playBassNote(rootFreq, time, 0.6, 0.85);
        if (step === 8) this._playBassNote(fifthFreq, time, 0.5, 0.75);
        if (step === 12) this._playBassNote(rootFreq, time, 0.35, 0.7);
        break;
    }
  }

  _getChordRootFrequency(chordName) {
    if (!chordName) return 110.0; // A2
    const clean = chordName.replace(/m|maj|min|dim|aug|7|9|sus4|sus2|\/.*$/gi, '').trim();
    const noteMap = {
      'C': 65.41,  // C2
      'C#': 69.30, 'Db': 69.30,
      'D': 73.42,  // D2
      'D#': 77.78, 'Eb': 77.78,
      'E': 82.41,  // E2
      'F': 87.31,  // F2
      'F#': 92.50, 'Gb': 92.50,
      'G': 98.00,  // G2
      'G#': 103.83, 'Ab': 103.83,
      'A': 110.00, // A2
      'A#': 116.54, 'Bb': 116.54,
      'B': 123.47  // B2
    };
    return noteMap[clean] || 110.0;
  }

  dispose() {
    this.stop();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try { this.audioCtx.close(); } catch (e) {}
    }
    this.audioCtx = null;
    this.masterGainNode = null;
    this.drumsGainNode = null;
    this.bassGainNode = null;
  }
}

export const smartBandEngine = new SmartBandEngine();
export default smartBandEngine;
