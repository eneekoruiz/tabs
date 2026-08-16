/**
 * @file AudioEngineV2.js
 * @description Motor de reproducción AlphaTab V2 sin settings.file para evitar peticiones XHR no deseadas.
 */

import { events } from './EventBus.js';
import { state } from './State.js';
import { soundFontCache } from '../data/SoundFontCache.js';

class AudioEngineV2 {
  constructor() {
    this.api = null;
    this.container = null;
    this.viewport = null;
    this.score = null;
    this.tracks = [];
    this.isInitialized = false;
    this.tracksState = new Map();
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
    // BLOQUEO ABSOLUTO DE API.LOAD PARA CADENAS DE TEXTO
    // =========================================================================
    const originalLoad = this.api.load.bind(this.api);
    this.api.load = (data, append) => {
      if (typeof data === 'string') {
        return this.api.tex(data.trim(), append);
      }
      
      if (data instanceof ArrayBuffer || data instanceof Uint8Array || (data && data.buffer instanceof ArrayBuffer)) {
        const bytes = data instanceof Uint8Array ? data : (data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer));
        if (!this._isGuitarProBinary(bytes)) {
          try {
            const text = new TextDecoder('utf-8').decode(bytes).trim();
            return this.api.tex(text, append);
          } catch (e) {}
        }
        return originalLoad(bytes, append);
      }

      return originalLoad(data, append);
    };

    this._bindAlphaTabEvents();
    this.isInitialized = true;

    // Renderizar partitura inicial por defecto usando api.tex()
    try {
      this.api.tex('\\title "Tabs & Chords PRO"\n\\tempo 120\n.\n:4 0.6 2.5 2.4 0.3 | :4 3.6 5.5 5.4 3.3 | :1 0.6 |');
    } catch (e) {}

    soundFontCache.getSoundFontSource().catch(err => {
      console.warn('[AudioEngineV2] Caché offline de SoundFont:', err);
    });

    return this.api;
  }

  _isGuitarProBinary(bytes) {
    if (!bytes || bytes.length < 4) return false;
    if (bytes[0] === 70 && bytes[1] === 73 && bytes[2] === 67 && bytes[3] === 72) return true;
    if ((bytes[0] === 66 && bytes[1] === 67) || (bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4)) return true;
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
      console.warn('[AudioEngineV2] Aviso de AlphaTab:', err);
      state.set('systemStatus', { text: 'Listo', type: 'ready' });
      events.emit('error', err);
    });
  }

  loadScoreToAlphaTab(data) {
    if (!this.api) throw new Error('AudioEngineV2 no inicializado.');

    state.set('systemStatus', { text: 'Cargando partitura...', type: 'loading' });

    try {
      if (typeof data === 'string') {
        this.api.tex(data.trim());
        return;
      }

      if (data instanceof Blob) {
        data.arrayBuffer().then(buf => this.loadScoreToAlphaTab(buf));
        return;
      }

      let bytes = null;
      if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
      else if (data instanceof Uint8Array) bytes = data;
      else if (data && typeof data === 'object' && data.buffer instanceof ArrayBuffer) bytes = new Uint8Array(data.buffer);
      else if (Array.isArray(data)) bytes = new Uint8Array(data);

      if (bytes) {
        if (!this._isGuitarProBinary(bytes)) {
          try {
            const decoded = new TextDecoder('utf-8').decode(bytes).trim();
            if (decoded.length > 0) {
              this.api.tex(decoded);
              return;
            }
          } catch (e) {}
        }
        this.api.load(bytes);
        return;
      }

      if (typeof data === 'object' && data !== null) {
        this.api.score = data;
        return;
      }

      throw new Error(`Tipo de dato no válido: ${typeof data}`);
    } catch (err) {
      console.error('❌ [AudioEngineV2] Error al cargar partitura:', err);
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
    if (cur === 'playing') this.pause();
    else this.play();
  }

  play() {
    if (!this.api) return;
    state.set('playback', { state: 'playing' });
    events.emit('playback:state', { state: 'playing' });
    try { this.api.play(); } catch (e) {}
  }

  pause() {
    if (!this.api) return;
    state.set('playback', { state: 'paused' });
    events.emit('playback:state', { state: 'paused' });
    try { this.api.pause(); } catch (e) {}
  }

  stop() {
    if (!this.api) return;
    state.set('playback', { state: 'stopped', currentTime: 0 });
    events.emit('playback:state', { state: 'stopped' });
    try { this.api.stop(); } catch (e) {}
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
    if (targetBar) this.api.tickPosition = targetBar.start;
  }

  setPlaybackSpeed(speed) {
    if (!this.api) return;
    const clamped = Math.max(0.2, Math.min(2.0, speed));
    this.api.playbackSpeed = clamped;
    state.set('playback', { playbackSpeed: clamped });
    events.emit('playback:speedChanged', clamped);
  }

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

export const audioEngine = new AudioEngineV2();
export default audioEngine;
