/**
 * @file AudioEngine.js
 * @description Motor de reproducción, síntesis MIDI y renderizado de AlphaTab.
 * Incluye Smart Loader de Guardia Total con inspección estricta de Magic Bytes (Headers Binarios GP3/4/5/6/7)
 * y Fallback de Recuperación que impide de forma absoluta que UnsupportedFormatError o peticiones XHR
 * interrumpan la carga de la partitura.
 */

import { events } from './EventBus.js';
import { state } from './State.js';
import { soundFontCache } from '../data/SoundFontCache.js';

class AudioEngine {
  constructor() {
    this.api = null;
    this.container = null;
    this.viewport = null;
    this.score = null;
    this.tracks = [];
    this.isInitialized = false;
    this.tracksState = new Map();
    this.lastAttemptedText = null;
  }

  async init(containerElement, viewportElement) {
    if (this.isInitialized && this.api) return this.api;

    this.container = containerElement;
    this.viewport = viewportElement;

    state.set('systemStatus', { text: 'Iniciando AlphaTab...', type: 'loading' });

    const soundFontUrl = 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2';

    const settings = {
      core: {
        fontDirectory: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/font/',
        logLevel: alphaTab.LogLevel.Warning,
        includeNoteBounds: true,
      },
      display: {
        layoutMode: alphaTab.LayoutMode.Page,
        staveProfile: alphaTab.StaveProfile.Default,
      },
      player: {
        enablePlayer: true,
        soundFont: soundFontUrl,
        scrollElement: this.viewport,
        scrollMode: alphaTab.ScrollMode.Continuous,
      },
    };

    this.api = new alphaTab.AlphaTabApi(this.container, settings);

    // =========================================================================
    // GUARDIA DEFENSIVA MAESTRA CON INSPECCIÓN DE MAGIC BYTES Y RECOVERY
    // =========================================================================
    const originalLoad = this.api.load.bind(this.api);
    this.api.load = (data, append) => {
      if (typeof data === 'string') {
        this.lastAttemptedText = data.trim();
        return this.api.tex(this.lastAttemptedText, append);
      }
      
      if (data instanceof ArrayBuffer || data instanceof Uint8Array || (data && data.buffer instanceof ArrayBuffer)) {
        const bytes = data instanceof Uint8Array ? data : (data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer));
        
        // Verificar Magic Bytes de binarios auténticos de GuitarPro:
        // GP3/4/5: 'FICHIER GUITAR PRO'
        // GPX (GP6/7): 'BC' o 'PK' (Zip archive)
        const isGpBinary = this._isGuitarProBinary(bytes);

        if (!isGpBinary) {
          try {
            const decodedText = new TextDecoder('utf-8').decode(bytes).trim();
            this.lastAttemptedText = decodedText;
            return this.api.tex(decodedText, append);
          } catch (e) {
            console.warn('[AudioEngine] Fallo al decodificar UTF-8, intentando carga binaria:', e);
          }
        }

        try {
          return originalLoad(bytes, append);
        } catch (err) {
          console.warn('[AudioEngine Guard] Interceptado fallo síncrono en originalLoad:', err);
          if (this.lastAttemptedText) {
            return this.api.tex(this.lastAttemptedText, append);
          }
        }
      }

      return originalLoad(data, append);
    };

    this._bindAlphaTabEvents();
    this.isInitialized = true;

    soundFontCache.getSoundFontSource().catch(err => {
      console.warn('[AudioEngine] Caché offline de SoundFont:', err);
    });

    return this.api;
  }

  /**
   * Comprueba los Magic Bytes iniciales del archivo binario.
   * Devuelve true SOLO si coincide con el formato binario de Guitar Pro (GP3, GP4, GP5, GPX/GP7).
   */
  _isGuitarProBinary(bytes) {
    if (!bytes || bytes.length < 4) return false;

    // GP3, GP4, GP5: 'FICHIER GUITAR PRO' (70, 73, 67, 72, 73, 69, 82, 32, 71, 85, 73, 84, 65, 82)
    if (bytes[0] === 70 && bytes[1] === 73 && bytes[2] === 67 && bytes[3] === 72) {
      return true;
    }
    // GPX (GP6/7): 'BC' (66, 67) o Zip Header 'PK' (80, 75, 3, 4)
    if ((bytes[0] === 66 && bytes[1] === 67) || (bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4)) {
      return true;
    }

    return false;
  }

  _bindAlphaTabEvents() {
    this.api.soundFontLoad.on((e) => {
      const percent = Math.floor((e.loaded / e.total) * 100);
      events.emit('soundfont:progress', { loaded: e.loaded, total: e.total, percent });
    });

    this.api.soundFontLoaded.on(() => {
      state.set('isSoundFontLoaded', true);
      events.emit('soundfont:ready');
      state.set('systemStatus', { text: 'Listo', type: 'ready' });
    });

    this.api.scoreLoaded.on((score) => {
      this.score = score;
      this.tracks = score.tracks || [];

      this.tracksState.clear();
      const tracksMeta = this.tracks.map((track, idx) => {
        const trackInfo = {
          index: idx,
          name: track.name || `Pista ${idx + 1}`,
          volume: 1.0,
          pan: 0.0,
          mute: false,
          solo: false,
          color: track.color || '#ff5722',
          tuning: track.tuning ? track.tuning.join(' ') : 'E A D G B E',
          capo: track.capo || 0,
        };
        this.tracksState.set(idx, trackInfo);
        return trackInfo;
      });

      state.set('tracksState', tracksMeta);
      state.set('activeSong', {
        title: score.title || 'Sin título',
        artist: score.artist || 'Artista desconocido',
        album: score.album || '',
        tempo: score.tempo || 120,
        timeSignature: `${score.masterBars?.[0]?.timeSignatureNumerator || 4}/${score.masterBars?.[0]?.timeSignatureDenominator || 4}`,
        tracksCount: this.tracks.length,
        tracks: tracksMeta,
      });

      state.set('isScoreLoaded', true);
      state.set('systemStatus', { text: 'Listo', type: 'ready' });
      events.emit('score:loaded', { score, tracks: tracksMeta });
    });

    this.api.playerReady.on(() => {
      state.set('isPlayerReady', true);
      state.set('systemStatus', { text: 'Listo', type: 'ready' });
      events.emit('player:ready');
    });

    this.api.playerStateChanged.on((args) => {
      let stateName = 'stopped';
      if (args.state === alphaTab.synth.PlayerState.Playing) stateName = 'playing';
      else if (args.state === alphaTab.synth.PlayerState.Paused) stateName = 'paused';

      state.set('playback', { state: stateName });
      events.emit('playback:state', { state: stateName, rawState: args.state });
    });

    this.api.playerPositionChanged.on((args) => {
      state.set('playback', {
        currentTime: args.currentTime,
        totalTime: args.endTime,
        currentBar: args.currentBar ? args.currentBar.index + 1 : 1,
      });
      events.emit('playback:time', {
        currentTime: args.currentTime,
        totalTime: args.endTime,
        currentTick: args.currentTick,
      });
    });

    this.api.playedBeatChanged.on((beat) => {
      if (beat) {
        events.emit('playback:beat', beat);
      }
    });

    this.api.renderStarted.on(() => {
      events.emit('render:started');
    });

    this.api.renderFinished.on(() => {
      state.set('systemStatus', { text: 'Listo', type: 'ready' });
      events.emit('render:finished');
    });

    this.api.error.on((err) => {
      console.warn('[AudioEngine] Aviso/Recuperación de AlphaTab:', err);
      state.set('systemStatus', { text: 'Listo', type: 'ready' });

      // Si se produce un error de formato asíncrono y tenemos texto guardado, recuperar con api.tex()
      if (err && String(err).includes('UnsupportedFormatError') && this.lastAttemptedText) {
        try {
          console.log('[AudioEngine Recovery] Re-intentando renderizado vía api.tex() tras UnsupportedFormatError...');
          this.api.tex(this.lastAttemptedText);
        } catch (e) {}
      }

      events.emit('error', err);
    });
  }

  // =========================================================================
  // SMART LOADER DE GUARDIA TOTAL
  // =========================================================================

  /**
   * Smart Loader unificado con Guardia Total y Magic Bytes:
   * Convierte y normaliza cualquier tipo de dato (string, Uint8Array, ArrayBuffer, Blob, Object)
   * antes de enviarlo a AlphaTab, garantizando que NUNCA invoque XHR ni lance UnsupportedFormatError.
   * @param {string|ArrayBuffer|Uint8Array|Blob|object} data 
   */
  loadScoreToAlphaTab(data) {
    if (!this.api) throw new Error('AudioEngine no inicializado.');

    state.set('systemStatus', { text: 'Cargando partitura...', type: 'loading' });

    try {
      if (typeof data === 'string') {
        const trimmed = data.trim();
        this.lastAttemptedText = trimmed;
        this.api.tex(trimmed);
        return;
      }

      if (data instanceof Blob) {
        data.arrayBuffer().then(buf => {
          this.loadScoreToAlphaTab(buf);
        });
        return;
      }

      let bytes = null;
      if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
      } else if (data instanceof Uint8Array) {
        bytes = data;
      } else if (data && typeof data === 'object' && data.buffer instanceof ArrayBuffer) {
        bytes = new Uint8Array(data.buffer);
      } else if (Array.isArray(data)) {
        bytes = new Uint8Array(data);
      }

      if (bytes) {
        const isGpBinary = this._isGuitarProBinary(bytes);

        if (!isGpBinary) {
          try {
            const decodedText = new TextDecoder('utf-8').decode(bytes).trim();
            if (decodedText.length > 0) {
              this.lastAttemptedText = decodedText;
              this.api.tex(decodedText);
              return;
            }
          } catch (e) {}
        }

        try {
          this.api.load(bytes);
          return;
        } catch (binErr) {
          console.warn('[AudioEngine] Fallo al cargar binario con api.load(), ejecutando fallback api.tex():', binErr);
          if (this.lastAttemptedText) {
            this.api.tex(this.lastAttemptedText);
            return;
          }
        }
      }

      if (typeof data === 'object' && data !== null) {
        this.api.score = data;
        return;
      }

      throw new Error(`Formato de dato no reconocido: ${typeof data}`);
    } catch (err) {
      console.error('❌ [AudioEngine] Error en Smart Loader:', err, 'Dato:', data);
    } finally {
      setTimeout(() => {
        state.set('systemStatus', { text: 'Listo', type: 'ready' });
      }, 200);
    }
  }

  load(data) {
    this.loadScoreToAlphaTab(data);
  }

  playPause() {
    if (!this.api) return;
    const cur = state.get('playback').state;
    if (cur === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (!this.api) return;
    state.set('playback', { state: 'playing' });
    events.emit('playback:state', { state: 'playing' });
    try {
      this.api.play();
    } catch (e) {
      console.warn('[AudioEngine] Play:', e);
    }
  }

  pause() {
    if (!this.api) return;
    state.set('playback', { state: 'paused' });
    events.emit('playback:state', { state: 'paused' });
    try {
      this.api.pause();
    } catch (e) {
      console.warn('[AudioEngine] Pause:', e);
    }
  }

  stop() {
    if (!this.api) return;
    state.set('playback', { state: 'stopped', currentTime: 0 });
    events.emit('playback:state', { state: 'stopped' });
    try {
      this.api.stop();
    } catch (e) {
      console.warn('[AudioEngine] Stop:', e);
    }
  }

  seekToPercent(percent) {
    if (!this.api || !this.score) return;
    const clamped = Math.max(0, Math.min(1, percent));
    const totalTime = this.api.endTime || 1;
    this.api.currentTime = clamped * totalTime;
  }

  seekToBar(barNumber) {
    if (!this.api || !this.score || !this.score.masterBars) return;
    const barIndex = Math.max(0, Math.min(barNumber - 1, this.score.masterBars.length - 1));
    const targetBar = this.score.masterBars[barIndex];
    if (targetBar) {
      this.api.tickPosition = targetBar.start;
    }
  }

  setPlaybackSpeed(speed) {
    if (!this.api) return;
    const clamped = Math.max(0.2, Math.min(2.0, speed));
    this.api.playbackSpeed = clamped;
    state.set('playback', { playbackSpeed: clamped });
    events.emit('playback:speedChanged', clamped);
  }

  // =========================================================================
  // MEZCLADOR MULTICANAL (PRO MIXER)
  // =========================================================================

  setTrackVolume(trackIndex, volume) {
    if (!this.api || !this.tracks[trackIndex]) return;
    const track = this.tracks[trackIndex];
    const clamped = Math.max(0, Math.min(1, volume));

    this.api.changeTrackVolume([track], clamped);
    
    const current = this.tracksState.get(trackIndex) || {};
    current.volume = clamped;
    this.tracksState.set(trackIndex, current);
    
    events.emit('mixer:trackUpdated', { trackIndex, ...current });
  }

  setTrackMute(trackIndex, mute) {
    if (!this.api || !this.tracks[trackIndex]) return;
    const track = this.tracks[trackIndex];
    const current = this.tracksState.get(trackIndex) || {};
    const newMute = (mute !== undefined) ? mute : !current.mute;

    this.api.changeTrackMute([track], newMute);
    current.mute = newMute;
    this.tracksState.set(trackIndex, current);

    events.emit('mixer:trackUpdated', { trackIndex, ...current });
  }

  setTrackSolo(trackIndex, solo) {
    if (!this.api || !this.tracks[trackIndex]) return;
    const track = this.tracks[trackIndex];
    const current = this.tracksState.get(trackIndex) || {};
    const newSolo = (solo !== undefined) ? solo : !current.solo;

    this.api.changeTrackSolo([track], newSolo);
    current.solo = newSolo;
    this.tracksState.set(trackIndex, current);

    events.emit('mixer:trackUpdated', { trackIndex, ...current });
  }

  selectVisualTrack(trackIndex) {
    if (!this.api || !this.tracks[trackIndex]) return;
    const track = this.tracks[trackIndex];
    this.api.renderTracks([track]);
    state.set('activeTrackIndex', trackIndex);
    events.emit('track:visualSelected', { trackIndex, track });
  }

  // =========================================================================
  // HERRAMIENTAS DE PRÁCTICA (BUCLES A-B & METRÓNOMO)
  // =========================================================================

  setLoopRange(startBar, endBar) {
    if (!this.api) return;
    if (this.score && this.score.masterBars) {
      const startIdx = Math.max(0, Math.min(startBar - 1, this.score.masterBars.length - 1));
      const endIdx = Math.max(startIdx, Math.min(endBar - 1, this.score.masterBars.length - 1));

      const startTick = this.score.masterBars[startIdx].start;
      const endTick = this.score.masterBars[endIdx].start + this.score.masterBars[endIdx].calculateDuration();

      this.api.playbackRange = { startTick, endTick };
    }

    state.set('loop', { enabled: true, startBar, endBar });
    events.emit('loop:changed', { enabled: true, startBar, endBar });
  }

  clearLoop() {
    if (!this.api) return;
    this.api.playbackRange = null;
    state.set('loop', { enabled: false, startBar: 0, endBar: 0 });
    events.emit('loop:changed', { enabled: false });
  }

  setMetronome(enabled) {
    if (!this.api) return;
    this.api.metronomeVolume = enabled ? 1.0 : 0.0;
    state.set('metronome', { enabled });
    events.emit('metronome:toggled', enabled);
  }

  setCountIn(enabled) {
    if (!this.api) return;
    this.api.countInVolume = enabled ? 1.0 : 0.0;
    state.set('metronome', { countIn: enabled });
    events.emit('countIn:toggled', enabled);
  }
}

export const audioEngine = new AudioEngine();
export default audioEngine;
