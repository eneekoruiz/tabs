/**
 * @file State.js
 * @description Almacén de estado reactivo unidireccional (Single Source of Truth).
 * Notifica automáticamente a los observadores y emite eventos en el EventBus al mutar propiedades.
 */

import { events } from './EventBus.js';

class StateStore {
  constructor() {
    this._state = {
      // Estado de Carga y Sistema
      isSoundFontLoaded: false,
      isScoreLoaded: false,
      isPlayerReady: false,
      isOfflineReady: false,
      systemStatus: { text: 'Iniciando sistema...', type: 'loading' },

      // Metadatos de la Canción Activa
      activeSong: {
        id: null,
        title: 'Sin partitura',
        artist: 'Desconocido',
        album: '',
        tempo: 120,
        timeSignature: '4/4',
        tracksCount: 0,
        tracks: [],
      },

      // Pista Seleccionada Actualmente para Visualización
      activeTrackIndex: 0,

      // Estado de Reproducción y Transporte
      playback: {
        state: 'stopped', // 'playing' | 'paused' | 'stopped'
        currentTime: 0,   // milisegundos
        totalTime: 0,     // milisegundos
        playbackSpeed: 1.0, // 0.25x - 2.0x
        currentBar: 0,
        currentTick: 0,
      },

      // Funcionalidades PRO de Práctica
      loop: {
        enabled: false,
        startBar: 0,
        endBar: 0,
        count: 0,
      },

      metronome: {
        enabled: false,
        countIn: false,
        volume: 0.8,
      },

      speedTrainer: {
        enabled: false,
        startSpeed: 0.6,
        targetSpeed: 1.0,
        stepSpeed: 0.05,
        stepInterval: 2, // incrementar cada N repeticiones del bucle
        currentIteration: 0,
      },

      // Mezclador de Pistas: Array o Map de { id, name, volume, pan, mute, solo, color }
      tracksState: [],

      // Estado de Interfaz de Usuario
      ui: {
        sidebarOpen: true,
        mixerOpen: false,
        fretboardOpen: true,
        speedTrainerOpen: false,
        theme: 'dark-slate', // 'dark-slate' | 'dark-amber' | 'stage-mode'
        layoutMode: 'page',  // 'page' | 'horizontal'
      },

      // Biblioteca
      library: {
        totalSongs: 0,
        searchQuery: '',
        selectedFilter: 'all',
      },
    };

    this._listeners = new Set();
  }

  /**
   * Obtiene una copia inmutable o de sólo lectura del estado completo.
   */
  getState() {
    return this._state;
  }

  /**
   * Obtiene una rama específica del estado.
   * @param {string} key 
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Actualiza una rama del estado y emite notificación a los suscriptores.
   * @param {string} key - Clave del estado (ej. 'playback', 'activeSong')
   * @param {Object|any} partialUpdate - Nuevos valores o reemplazo
   */
  set(key, partialUpdate) {
    if (this._state[key] !== undefined) {
      if (typeof this._state[key] === 'object' && this._state[key] !== null && !Array.isArray(this._state[key])) {
        this._state[key] = { ...this._state[key], ...partialUpdate };
      } else {
        this._state[key] = partialUpdate;
      }

      // Notificamos a los suscriptores directos del almacén
      this._notify(key, this._state[key]);

      // Emitimos en el EventBus para desacoplamiento total
      events.emit(`state:${key}`, this._state[key]);
      events.emit('state:change', { key, value: this._state[key] });
    } else {
      console.warn(`[StateStore] La clave "${key}" no existe en el estado inicial.`);
    }
  }

  /**
   * Suscribe una función para recibir actualizaciones globales del estado.
   * @param {Function} listener 
   * @returns {Function} unsubscribe
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notify(key, value) {
    for (const listener of this._listeners) {
      try {
        listener(key, value, this._state);
      } catch (err) {
        console.error('[StateStore] Error en listener de estado:', err);
      }
    }
  }
}

export const state = new StateStore();
export default state;
