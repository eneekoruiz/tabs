/**
 * @file PedalboardEngine.js
 * @description Virtual Pedalboard & Amp Simulator DSP con latencia ultra-baja y Smart Tone inteligente.
 * Encadena Noise Gate, Compresor, Tube Overdrive / Amp Simulator (WaveShaper),
 * Chorus analógico, Stereo Delay, Convolver Reverb y Cab Sim 4x12.
 */

import { events } from '../core/EventBus.js';

export class PedalboardEngine {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.isActive = false;

    // Nodos de la cadena DSP
    this.nodes = {
      inputGain: null,
      noiseGateGain: null,
      compressor: null,
      preDriveFilter: null,
      waveShaper: null,
      postDriveFilter: null,
      eqBass: null,
      eqMid: null,
      eqTreble: null,
      cabFilterLow: null,
      cabFilterHigh: null,
      chorusDelay: null,
      chorusLfo: null,
      chorusLfoGain: null,
      chorusDryGain: null,
      chorusWetGain: null,
      delayNode: null,
      delayFeedback: null,
      delayDryGain: null,
      delayWetGain: null,
      reverbConvolver: null,
      reverbDryGain: null,
      reverbWetGain: null,
      masterGain: null,
      analyser: null
    };

    // Estado de parámetros y Bypass por pedal
    this.params = {
      // 1. Noise Gate
      gateEnabled: true,
      gateThreshold: -48, // dB

      // 2. Drive / Amp Sim
      driveEnabled: true,
      driveGain: 4.5, // 0 to 10
      driveTone: 5.0,  // 0 to 10
      driveType: 'tube', // 'tube', 'crunch', 'highgain', 'clean'

      // 3. Ecualizador & Cab Sim
      eqBass: 0,   // dB (-12 to +12)
      eqMid: 2,    // dB (-12 to +12)
      eqTreble: 1, // dB (-12 to +12)
      cabSimEnabled: true,

      // 4. Chorus
      chorusEnabled: false,
      chorusRate: 1.5,  // Hz
      chorusDepth: 0.003, // sec
      chorusMix: 0.4,

      // 5. Delay
      delayEnabled: false,
      delayTime: 0.35, // sec
      delayFeedback: 0.38,
      delayMix: 0.35,

      // 6. Reverb
      reverbEnabled: true,
      reverbType: 'spring', // 'spring', 'room', 'hall', 'shimmer'
      reverbMix: 0.32,

      // 7. Master
      masterVolume: 1.0
    };

    this.currentPreset = 'rock';
    this.inputLevel = 0;
    this.outputLevel = 0;
    this.animFrameId = null;
  }

  _getAudioContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx({ latencyHint: 'interactive' });
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Inicia la captura de audio en vivo desde micrófono o tarjeta de sonido/guitarra
   */
  async startLiveInput() {
    const ctx = this._getAudioContext();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia no disponible en este entorno');
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0.005
      }
    });

    this.sourceNode = ctx.createMediaStreamSource(this.mediaStream);
    this._buildDspChain(ctx);
    this.sourceNode.connect(this.nodes.inputGain);

    this.isActive = true;
    this._startMetering();
    events.emit('pedalboard:state', { isActive: true, params: this.params, preset: this.currentPreset });
    return true;
  }

  stopLiveInput() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) {}
      this.sourceNode = null;
    }

    this._tearDownDspChain();
    this.isActive = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    events.emit('pedalboard:state', { isActive: false });
  }

  /**
   * Construye el grafo de nodos Web Audio para la pedalera
   */
  _buildDspChain(ctx) {
    this._tearDownDspChain();

    // 1. Input & Gate
    const inputGain = ctx.createGain();
    const noiseGateGain = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, ctx.currentTime);
    compressor.knee.setValueAtTime(10, ctx.currentTime);
    compressor.ratio.setValueAtTime(4, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.15, ctx.currentTime);

    // 2. Overdrive / Amp Waveshaper
    const preDriveFilter = ctx.createBiquadFilter();
    preDriveFilter.type = 'peaking';
    preDriveFilter.frequency.setValueAtTime(720, ctx.currentTime); // Mid boost Tube Screamer
    preDriveFilter.Q.setValueAtTime(1.2, ctx.currentTime);
    preDriveFilter.gain.setValueAtTime(3.0, ctx.currentTime);

    const waveShaper = ctx.createWaveShaper();
    waveShaper.oversample = '4x';
    waveShaper.curve = this._generateDistortionCurve(this.params.driveGain, this.params.driveType);

    const postDriveFilter = ctx.createBiquadFilter();
    postDriveFilter.type = 'lowpass';
    postDriveFilter.frequency.setValueAtTime(4800, ctx.currentTime);

    // 3. EQ & Cab Sim
    const eqBass = ctx.createBiquadFilter();
    eqBass.type = 'lowshelf';
    eqBass.frequency.setValueAtTime(100, ctx.currentTime);
    eqBass.gain.setValueAtTime(this.params.eqBass, ctx.currentTime);

    const eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.setValueAtTime(1000, ctx.currentTime);
    eqMid.Q.setValueAtTime(1.0, ctx.currentTime);
    eqMid.gain.setValueAtTime(this.params.eqMid, ctx.currentTime);

    const eqTreble = ctx.createBiquadFilter();
    eqTreble.type = 'highshelf';
    eqTreble.frequency.setValueAtTime(3500, ctx.currentTime);
    eqTreble.gain.setValueAtTime(this.params.eqTreble, ctx.currentTime);

    // Cab Sim Filters (Emulación Pantalla 4x12)
    const cabFilterLow = ctx.createBiquadFilter();
    cabFilterLow.type = 'highpass';
    cabFilterLow.frequency.setValueAtTime(75, ctx.currentTime);

    const cabFilterHigh = ctx.createBiquadFilter();
    cabFilterHigh.type = 'lowpass';
    cabFilterHigh.frequency.setValueAtTime(5200, ctx.currentTime);

    // 4. Chorus (LFO + Modulated Delay)
    const chorusDelay = ctx.createDelay();
    chorusDelay.delayTime.setValueAtTime(0.015, ctx.currentTime);

    const chorusLfo = ctx.createOscillator();
    chorusLfo.type = 'sine';
    chorusLfo.frequency.setValueAtTime(this.params.chorusRate, ctx.currentTime);

    const chorusLfoGain = ctx.createGain();
    chorusLfoGain.gain.setValueAtTime(this.params.chorusDepth, ctx.currentTime);
    chorusLfo.connect(chorusLfoGain);
    chorusLfoGain.connect(chorusDelay.delayTime);
    chorusLfo.start(0);

    const chorusDryGain = ctx.createGain();
    const chorusWetGain = ctx.createGain();
    chorusDryGain.gain.setValueAtTime(this.params.chorusEnabled ? 0.7 : 1.0, ctx.currentTime);
    chorusWetGain.gain.setValueAtTime(this.params.chorusEnabled ? this.params.chorusMix : 0.0, ctx.currentTime);

    const chorusMerge = ctx.createGain();

    // 5. Stereo Delay
    const delayNode = ctx.createDelay();
    delayNode.delayTime.setValueAtTime(this.params.delayTime, ctx.currentTime);

    const delayFeedback = ctx.createGain();
    delayFeedback.gain.setValueAtTime(this.params.delayFeedback, ctx.currentTime);

    const delayDryGain = ctx.createGain();
    const delayWetGain = ctx.createGain();
    delayDryGain.gain.setValueAtTime(1.0, ctx.currentTime);
    delayWetGain.gain.setValueAtTime(this.params.delayEnabled ? this.params.delayMix : 0.0, ctx.currentTime);

    const delayMerge = ctx.createGain();

    // Loop de feedback
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);

    // 6. Reverb
    const reverbConvolver = ctx.createConvolver();
    reverbConvolver.buffer = this._generateImpulseResponse(ctx, this.params.reverbType);

    const reverbDryGain = ctx.createGain();
    const reverbWetGain = ctx.createGain();
    reverbDryGain.gain.setValueAtTime(1.0 - (this.params.reverbEnabled ? this.params.reverbMix * 0.5 : 0), ctx.currentTime);
    reverbWetGain.gain.setValueAtTime(this.params.reverbEnabled ? this.params.reverbMix : 0.0, ctx.currentTime);

    const reverbMerge = ctx.createGain();

    // 7. Master & Analizador
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.params.masterVolume, ctx.currentTime);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;

    // Conexión del grafo completo
    // Input -> Gate -> Compressor -> Drive Filter -> WaveShaper -> Post Filter
    inputGain.connect(noiseGateGain);
    noiseGateGain.connect(compressor);
    compressor.connect(preDriveFilter);

    if (this.params.driveEnabled) {
      preDriveFilter.connect(waveShaper);
      waveShaper.connect(postDriveFilter);
      postDriveFilter.connect(eqBass);
    } else {
      preDriveFilter.connect(eqBass);
    }

    // EQ -> Cab Sim
    eqBass.connect(eqMid);
    eqMid.connect(eqTreble);

    if (this.params.cabSimEnabled) {
      eqTreble.connect(cabFilterLow);
      cabFilterLow.connect(cabFilterHigh);
      cabFilterHigh.connect(chorusDryGain);
      cabFilterHigh.connect(chorusDelay);
    } else {
      eqTreble.connect(chorusDryGain);
      eqTreble.connect(chorusDelay);
    }

    // Chorus routing
    chorusDelay.connect(chorusWetGain);
    chorusDryGain.connect(chorusMerge);
    chorusWetGain.connect(chorusMerge);

    // Delay routing
    chorusMerge.connect(delayDryGain);
    chorusMerge.connect(delayNode);
    delayNode.connect(delayWetGain);

    delayDryGain.connect(delayMerge);
    delayWetGain.connect(delayMerge);

    // Reverb routing
    delayMerge.connect(reverbDryGain);
    delayMerge.connect(reverbConvolver);
    reverbConvolver.connect(reverbWetGain);

    reverbDryGain.connect(reverbMerge);
    reverbWetGain.connect(reverbMerge);

    // Master -> Analyser -> Output
    reverbMerge.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    this.nodes = {
      inputGain,
      noiseGateGain,
      compressor,
      preDriveFilter,
      waveShaper,
      postDriveFilter,
      eqBass,
      eqMid,
      eqTreble,
      cabFilterLow,
      cabFilterHigh,
      chorusDelay,
      chorusLfo,
      chorusLfoGain,
      chorusDryGain,
      chorusWetGain,
      chorusMerge,
      delayNode,
      delayFeedback,
      delayDryGain,
      delayWetGain,
      delayMerge,
      reverbConvolver,
      reverbDryGain,
      reverbWetGain,
      reverbMerge,
      masterGain,
      analyser
    };
  }

  _tearDownDspChain() {
    Object.values(this.nodes).forEach(node => {
      if (node) {
        try {
          if (node.stop) node.stop();
          node.disconnect();
        } catch (e) {}
      }
    });
  }

  /**
   * Generación matemática de curvas no lineales de saturación
   */
  _generateDistortionCurve(amount = 5, type = 'tube') {
    const k = typeof amount === 'number' ? amount * 10 : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;

      if (type === 'tube') {
        // Saturación asimétrica a válvulas (armónicos pares cálidos)
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x)) + (x > 0 ? 0.05 * Math.sin(x * Math.PI) : 0);
      } else if (type === 'highgain') {
        // Hard clipping agresivo para Heavy Metal / Solos
        curve[i] = Math.tanh(x * (k * 0.35 + 2));
      } else if (type === 'crunch') {
        // Crunch británico clásico
        curve[i] = (2 / Math.PI) * Math.atan(x * (k * 0.15 + 1.5));
      } else {
        // Clean suave
        curve[i] = x;
      }
    }
    return curve;
  }

  /**
   * Generación algorítmica de Impulse Responses (IR) para Reverbs
   */
  _generateImpulseResponse(ctx, type = 'spring') {
    const rate = ctx.sampleRate;
    let length = rate * 2.0; // 2 seg
    let decay = 2.0;

    if (type === 'room') {
      length = rate * 1.0;
      decay = 1.0;
    } else if (type === 'hall') {
      length = rate * 3.5;
      decay = 3.2;
    } else if (type === 'shimmer') {
      length = rate * 4.0;
      decay = 3.8;
    }

    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = length - i;
      const t = i / rate;
      const expDecay = Math.pow(n / length, decay);

      if (type === 'spring') {
        // Modulación chirp para emular muelles metálicos Fender
        const chirp = Math.sin(2 * Math.PI * (120 + 400 * (i / length)) * t);
        left[i] = (Math.random() * 2 - 1) * expDecay * 0.7 + chirp * expDecay * 0.3;
        right[i] = (Math.random() * 2 - 1) * expDecay * 0.7 - chirp * expDecay * 0.3;
      } else if (type === 'shimmer') {
        // Armónicos octavados brillantes
        const shimmerMod = Math.sin(2 * Math.PI * 1760 * t) * 0.25;
        left[i] = ((Math.random() * 2 - 1) * 0.8 + shimmerMod) * expDecay;
        right[i] = ((Math.random() * 2 - 1) * 0.8 + shimmerMod) * expDecay;
      } else {
        left[i] = (Math.random() * 2 - 1) * expDecay;
        right[i] = (Math.random() * 2 - 1) * expDecay;
      }
    }

    return impulse;
  }

  // =========================================================================
  // CONTROL DE PARÁMETROS EN TIEMPO REAL
  // =========================================================================

  setParam(name, value) {
    this.params[name] = value;
    const ctx = this.audioContext;
    if (!ctx || !this.isActive) return;

    const time = ctx.currentTime;

    switch (name) {
      case 'driveGain':
      case 'driveType':
        if (this.nodes.waveShaper) {
          this.nodes.waveShaper.curve = this._generateDistortionCurve(this.params.driveGain, this.params.driveType);
        }
        break;

      case 'driveEnabled':
        this._buildDspChain(ctx);
        if (this.sourceNode) this.sourceNode.connect(this.nodes.inputGain);
        break;

      case 'eqBass':
        if (this.nodes.eqBass) this.nodes.eqBass.gain.setTargetAtTime(value, time, 0.02);
        break;
      case 'eqMid':
        if (this.nodes.eqMid) this.nodes.eqMid.gain.setTargetAtTime(value, time, 0.02);
        break;
      case 'eqTreble':
        if (this.nodes.eqTreble) this.nodes.eqTreble.gain.setTargetAtTime(value, time, 0.02);
        break;

      case 'chorusEnabled':
      case 'chorusMix':
        if (this.nodes.chorusDryGain && this.nodes.chorusWetGain) {
          this.nodes.chorusDryGain.gain.setTargetAtTime(this.params.chorusEnabled ? 0.7 : 1.0, time, 0.02);
          this.nodes.chorusWetGain.gain.setTargetAtTime(this.params.chorusEnabled ? this.params.chorusMix : 0.0, time, 0.02);
        }
        break;
      case 'chorusRate':
        if (this.nodes.chorusLfo) this.nodes.chorusLfo.frequency.setTargetAtTime(value, time, 0.02);
        break;

      case 'delayEnabled':
      case 'delayMix':
        if (this.nodes.delayWetGain) {
          this.nodes.delayWetGain.gain.setTargetAtTime(this.params.delayEnabled ? this.params.delayMix : 0.0, time, 0.02);
        }
        break;
      case 'delayTime':
        if (this.nodes.delayNode) this.nodes.delayNode.delayTime.setTargetAtTime(value, time, 0.02);
        break;
      case 'delayFeedback':
        if (this.nodes.delayFeedback) this.nodes.delayFeedback.gain.setTargetAtTime(value, time, 0.02);
        break;

      case 'reverbEnabled':
      case 'reverbMix':
        if (this.nodes.reverbDryGain && this.nodes.reverbWetGain) {
          this.nodes.reverbDryGain.gain.setTargetAtTime(1.0 - (this.params.reverbEnabled ? this.params.reverbMix * 0.5 : 0), time, 0.02);
          this.nodes.reverbWetGain.gain.setTargetAtTime(this.params.reverbEnabled ? this.params.reverbMix : 0.0, time, 0.02);
        }
        break;
      case 'reverbType':
        if (this.nodes.reverbConvolver) {
          this.nodes.reverbConvolver.buffer = this._generateImpulseResponse(ctx, value);
        }
        break;

      case 'masterVolume':
        if (this.nodes.masterGain) this.nodes.masterGain.gain.setTargetAtTime(value, time, 0.02);
        break;
    }

    events.emit('pedalboard:paramsChanged', this.params);
  }

  // =========================================================================
  // SMART TONE INTELIGENTE (ADAPTACIÓN PROACTIVA A LA CANCIÓN)
  // =========================================================================

  applyPreset(presetName) {
    this.currentPreset = presetName;

    const presets = {
      metal: {
        name: '⚡ High-Gain Lead',
        description: 'Tono demoledor para Heavy Metal y Solos virtuosos con compresión y noise gate activo.',
        params: {
          gateEnabled: true,
          gateThreshold: -42,
          driveEnabled: true,
          driveGain: 8.5,
          driveTone: 7.0,
          driveType: 'highgain',
          eqBass: 3,
          eqMid: -2,
          eqTreble: 4,
          cabSimEnabled: true,
          chorusEnabled: false,
          delayEnabled: true,
          delayTime: 0.32,
          delayFeedback: 0.30,
          delayMix: 0.25,
          reverbEnabled: true,
          reverbType: 'room',
          reverbMix: 0.25,
          masterVolume: 1.0
        }
      },
      rock: {
        name: '🎸 British Crunch',
        description: 'Saturación cálida con mordiente estilo Marshall / Plexi.',
        params: {
          gateEnabled: true,
          gateThreshold: -48,
          driveEnabled: true,
          driveGain: 4.8,
          driveTone: 5.5,
          driveType: 'crunch',
          eqBass: 1,
          eqMid: 3,
          eqTreble: 2,
          cabSimEnabled: true,
          chorusEnabled: false,
          delayEnabled: false,
          delayTime: 0.28,
          delayFeedback: 0.25,
          delayMix: 0.20,
          reverbEnabled: true,
          reverbType: 'spring',
          reverbMix: 0.35,
          masterVolume: 1.0
        }
      },
      blues: {
        name: '🎷 Warm Tube Blues',
        description: 'Overdrive dinámico sensible al tacto con reverb de muelle estilo Fender Twin Reverb.',
        params: {
          gateEnabled: false,
          gateThreshold: -55,
          driveEnabled: true,
          driveGain: 3.2,
          driveTone: 4.5,
          driveType: 'tube',
          eqBass: 2,
          eqMid: 2,
          eqTreble: 0,
          cabSimEnabled: true,
          chorusEnabled: false,
          delayEnabled: false,
          delayTime: 0.22,
          delayFeedback: 0.20,
          delayMix: 0.15,
          reverbEnabled: true,
          reverbType: 'spring',
          reverbMix: 0.45,
          masterVolume: 1.0
        }
      },
      jazz: {
        name: '☕ Velvet Jazz Clean',
        description: 'Tono limpio, redondo y aterciopelado con realce de medios y room reverb sutil.',
        params: {
          gateEnabled: false,
          gateThreshold: -60,
          driveEnabled: false,
          driveGain: 1.0,
          driveTone: 3.5,
          driveType: 'clean',
          eqBass: 3,
          eqMid: 1,
          eqTreble: -2,
          cabSimEnabled: true,
          chorusEnabled: false,
          delayEnabled: false,
          delayTime: 0.20,
          delayFeedback: 0.15,
          delayMix: 0.10,
          reverbEnabled: true,
          reverbType: 'room',
          reverbMix: 0.28,
          masterVolume: 1.0
        }
      },
      pop: {
        name: '✨ Crystal Chorus & Delay',
        description: 'Sonido moderno pulido con modulación espacial y repeticiones etéreas.',
        params: {
          gateEnabled: true,
          gateThreshold: -50,
          driveEnabled: false,
          driveGain: 1.5,
          driveTone: 6.0,
          driveType: 'clean',
          eqBass: 0,
          eqMid: 0,
          eqTreble: 3,
          cabSimEnabled: true,
          chorusEnabled: true,
          chorusRate: 1.8,
          chorusDepth: 0.004,
          chorusMix: 0.45,
          delayEnabled: true,
          delayTime: 0.40,
          delayFeedback: 0.35,
          delayMix: 0.30,
          reverbEnabled: true,
          reverbType: 'hall',
          reverbMix: 0.35,
          masterVolume: 1.0
        }
      },
      acoustic: {
        name: '🌲 Acoustic Shimmer & Resonance',
        description: 'Brillo y cuerpo cristalino para guitarras acústicas y ukeleles.',
        params: {
          gateEnabled: false,
          gateThreshold: -55,
          driveEnabled: false,
          driveGain: 1.0,
          driveTone: 7.0,
          driveType: 'clean',
          eqBass: 2,
          eqMid: -1,
          eqTreble: 4,
          cabSimEnabled: false,
          chorusEnabled: true,
          chorusRate: 0.8,
          chorusDepth: 0.002,
          chorusMix: 0.20,
          delayEnabled: false,
          delayTime: 0.25,
          delayFeedback: 0.20,
          delayMix: 0.15,
          reverbEnabled: true,
          reverbType: 'shimmer',
          reverbMix: 0.40,
          masterVolume: 1.0
        }
      }
    };

    const targetPreset = presets[presetName] || presets.rock;
    Object.assign(this.params, targetPreset.params);

    if (this.isActive && this.audioContext) {
      this._buildDspChain(this.audioContext);
      if (this.sourceNode) this.sourceNode.connect(this.nodes.inputGain);
    }

    events.emit('pedalboard:presetApplied', { preset: presetName, details: targetPreset });
    return targetPreset;
  }

  /**
   * Smart Tone: Detecta automáticamente el preset óptimo según la canción
   */
  detectToneForSong(song) {
    if (!song) return this.applyPreset('rock');

    const genre = (song.genre || '').toLowerCase();
    const title = (song.title || '').toLowerCase();
    const artist = (song.artist || '').toLowerCase();

    if (genre.includes('metal') || artist.includes('metallica') || genre.includes('hard rock') || title.includes('enter sandman')) {
      return this.applyPreset('metal');
    }
    if (genre.includes('jazz') || genre.includes('bossa') || genre.includes('blues')) {
      return this.applyPreset('jazz');
    }
    if (genre.includes('acoustic') || genre.includes('folk') || title.includes('blackbird') || artist.includes('beatles')) {
      return this.applyPreset('acoustic');
    }
    if (genre.includes('pop') || artist.includes('ariana grande') || artist.includes('katy perry') || artist.includes('taylor swift')) {
      return this.applyPreset('pop');
    }

    return this.applyPreset('rock');
  }

  _startMetering() {
    const dataArray = new Uint8Array(32);

    const checkLevels = () => {
      if (!this.isActive || !this.nodes.analyser) return;

      this.nodes.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];

      this.outputLevel = Math.min(100, Math.round((sum / (dataArray.length * 255)) * 130));

      // Noise Gate logic
      if (this.params.gateEnabled && this.nodes.noiseGateGain && this.audioContext) {
        const thresholdNorm = Math.pow(10, this.params.gateThreshold / 20) * 100;
        if (this.outputLevel < thresholdNorm) {
          this.nodes.noiseGateGain.gain.setTargetAtTime(0.001, this.audioContext.currentTime, 0.05);
        } else {
          this.nodes.noiseGateGain.gain.setTargetAtTime(1.0, this.audioContext.currentTime, 0.01);
        }
      }

      events.emit('pedalboard:meter', { level: this.outputLevel });
      this.animFrameId = requestAnimationFrame(checkLevels);
    };

    this.animFrameId = requestAnimationFrame(checkLevels);
  }

  dispose() {
    this.stopLiveInput();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch (e) {}
    }
    this.audioContext = null;
  }
}

export const pedalboardEngine = new PedalboardEngine();
export default pedalboardEngine;
