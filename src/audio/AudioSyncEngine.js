/**
 * @file AudioSyncEngine.js
 * @description Motor de sincronización de pistas de audio real (.mp3, .wav) con la partitura AlphaTab (Backing Track Engine).
 * Controla offset milimétrico (ms), ajuste de volumen independiente, silenciamiento y sincronización de transporte y tempo.
 */

import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';

class AudioSyncEngine {
  constructor() {
    this.audioElement = new Audio();
    this.audioElement.preload = 'auto';
    this.offsetMs = 0; // Desfase en milisegundos respecto a la partitura
    this.isLoaded = false;
    this.fileName = '';
    this.volume = 0.85;
    this.isMuted = false;
    this.syncToleranceMs = 150; // Margen para re-sincronización suave

    this.initEvents();
  }

  initEvents() {
    // Sincronizar transporte con AlphaTab
    events.on('playback:state', ({ state: pState }) => {
      if (!this.isLoaded) return;

      if (pState === 'playing') {
        this.play();
      } else if (pState === 'paused') {
        this.pause();
      } else if (pState === 'stopped') {
        this.stop();
      }
    });

    // Sincronizar posición de reproducción continua
    events.on('playback:time', ({ currentTime }) => {
      if (!this.isLoaded || this.audioElement.paused) return;

      const targetTimeSec = Math.max(0, (currentTime + this.offsetMs) / 1000);
      const currentAudioTimeSec = this.audioElement.currentTime;
      const diffSec = Math.abs(currentAudioTimeSec - targetTimeSec);

      // Si el desfase acumulado supera la tolerancia, corregir posición
      if (diffSec > this.syncToleranceMs / 1000) {
        this.audioElement.currentTime = targetTimeSec;
      }
    });

    // Sincronizar velocidad de reproducción
    events.on('playback:speedChanged', (speed) => {
      if (this.audioElement) {
        this.audioElement.playbackRate = speed;
      }
    });

    // Actualizaciones de volumen
    this.audioElement.volume = this.volume;
  }

  /**
   * Carga un archivo de audio real desde un Blob / File o URL
   * @param {File|Blob} file 
   */
  async loadAudioFile(file) {
    if (!file) return;

    try {
      const objectUrl = URL.createObjectURL(file);
      this.audioElement.src = objectUrl;
      this.fileName = file.name || 'Audio Sincronizado.mp3';
      this.isLoaded = true;

      await this.audioElement.load();
      events.emit('audioSync:loaded', {
        fileName: this.fileName,
        duration: this.audioElement.duration || 0,
        offsetMs: this.offsetMs,
      });

      return true;
    } catch (err) {
      console.warn('[AudioSyncEngine] Error cargando archivo de audio:', err);
      throw err;
    }
  }

  play() {
    if (!this.isLoaded) return;
    const curTabTime = state.get('playback').currentTime || 0;
    const startTimeSec = Math.max(0, (curTabTime + this.offsetMs) / 1000);
    
    if (Math.abs(this.audioElement.currentTime - startTimeSec) > 0.1) {
      this.audioElement.currentTime = startTimeSec;
    }

    this.audioElement.play().catch(e => {
      console.warn('[AudioSyncEngine] Play ignorado:', e);
    });
  }

  pause() {
    if (!this.isLoaded) return;
    this.audioElement.pause();
  }

  stop() {
    if (!this.isLoaded) return;
    this.audioElement.pause();
    this.audioElement.currentTime = Math.max(0, this.offsetMs / 1000);
  }

  setOffsetMs(ms) {
    this.offsetMs = parseInt(ms, 10) || 0;
    events.emit('audioSync:offsetChanged', this.offsetMs);
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.audioElement.volume = this.isMuted ? 0 : this.volume;
    events.emit('audioSync:volumeChanged', this.volume);
  }

  toggleMute(mute) {
    this.isMuted = (mute !== undefined) ? mute : !this.isMuted;
    this.audioElement.volume = this.isMuted ? 0 : this.volume;
    events.emit('audioSync:muteChanged', this.isMuted);
    return this.isMuted;
  }

  unload() {
    this.stop();
    this.audioElement.src = '';
    this.isLoaded = false;
    this.fileName = '';
    this.offsetMs = 0;
    events.emit('audioSync:unloaded');
  }
}

export const audioSyncEngine = new AudioSyncEngine();
export default audioSyncEngine;
