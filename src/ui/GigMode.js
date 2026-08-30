/**
 * @file GigMode.js
 * @description Modo Directo / Modo Atril para tocar en vivo en el escenario.
 * - Pantalla completa OLED de alto contraste sin distracciones.
 * - WakeLock API: Mantiene la pantalla encendida para que el móvil/tablet no se apague durante el concierto.
 * - Reloj de escenario en vivo y monitor de batería para controlar los tiempos del show.
 * - Siguiente canción del Setlist y botones gigantes aptos para dedos o pedales Bluetooth.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { audioEngine } from '../core/AudioEngineV2.js';
import { setlistManager } from '../data/SetlistManager.js';
import { toast } from './Toast.js';

export class GigMode extends Component {
  constructor(container) {
    super(container);
    this.isActive = false;
    this.clockInterval = null;
    this.batteryLevel = '100%';
    this.nextSongTitle = 'Fin del Setlist';
    this.wakeLock = null;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('ui:toggleGigMode', () => {
        this.toggle();
      })
    );

    this.registerUnsub(
      events.on('ui:closeAllOverlays', () => {
        if (this.isActive) this.toggle();
      })
    );

    this.registerUnsub(
      events.on('setlist:songChanged', () => {
        if (this.isActive) this.updateNextSong();
      })
    );

    this.registerUnsub(
      events.on('score:loaded', () => {
        if (this.isActive) {
          this.updateNextSong();
          this.render();
        }
      })
    );
  }

  async toggle() {
    this.isActive = !this.isActive;
    document.body.classList.toggle('gig-mode-active', this.isActive);

    if (this.isActive) {
      this.startClock();
      await this.initBattery();
      await this.requestWakeLock();
      await this.updateNextSong();
      this.render();

      toast.show('🎤 MODO DIRECTO (PANTALLA ESCENARIO): Pulsa ESC o Salir para volver', 'success', 2500);
    } else {
      this.stopClock();
      this.releaseWakeLock();
      if (this.container) this.container.innerHTML = '';

      toast.show('Modo Directo desactivado', 'info', 1500);
    }
  }

  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('[GigMode] WakeLock no disponible:', err);
      }
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
        this.wakeLock = null;
      } catch (err) {}
    }
  }

  startClock() {
    if (this.clockInterval) clearInterval(this.clockInterval);
    this.clockInterval = setInterval(() => {
      const clockEl = document.getElementById('gigClockDisplay');
      if (clockEl) {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    }, 1000);
  }

  stopClock() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  async initBattery() {
    if (navigator.getBattery) {
      try {
        const battery = await navigator.getBattery();
        this.batteryLevel = `${Math.round(battery.level * 100)}%`;
        battery.addEventListener('levelchange', () => {
          this.batteryLevel = `${Math.round(battery.level * 100)}%`;
          const batEl = document.getElementById('gigBatteryDisplay');
          if (batEl) batEl.textContent = `🔋 ${this.batteryLevel}`;
        });
      } catch (e) {
        this.batteryLevel = '100%';
      }
    } else {
      this.batteryLevel = '100%';
    }
  }

  async updateNextSong() {
    const next = await setlistManager.getNextSong();
    this.nextSongTitle = next ? `${next.title} (${next.artist})` : 'Fin del Setlist';
    const nextEl = document.getElementById('gigNextSongLabel');
    if (nextEl) nextEl.textContent = this.nextSongTitle;
  }

  render() {
    if (!this.container || !this.isActive) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const currentSong = state.get('activeSong') || {};

    this.container.innerHTML = `
      <aside class="gig-hud-overlay" role="region" aria-label="Pantalla de escenario Modo Directo">
        <!-- Barra Superior de Escenario -->
        <div class="gig-top-hud">
          <div class="gig-current-song-tag">
            <span class="gig-live-indicator" aria-hidden="true">🔴 EN VIVO</span>
            <span class="gig-song-name">${currentSong.title || 'Tabs & Chords PRO'}</span>
            <span class="gig-song-artist">— ${currentSong.artist || ''}</span>
          </div>

          <div class="gig-teleprompter-meta">
            <!-- Siguiente Canción -->
            <div class="gig-next-song-card" title="Próxima canción en el setlist">
              <span class="gig-next-label">⏭️ Siguiente:</span>
              <strong id="gigNextSongLabel">${this.nextSongTitle}</strong>
            </div>

            <!-- Reloj de Escenario -->
            <div class="gig-clock-card" title="Hora actual en vivo">
              <span class="gig-clock-icon" aria-hidden="true">🕒</span>
              <span id="gigClockDisplay" class="gig-clock-digits">${timeStr}</span>
            </div>

            <!-- Batería -->
            <div class="gig-battery-card" title="Nivel de batería del dispositivo">
              <span id="gigBatteryDisplay">🔋 ${this.batteryLevel}</span>
            </div>

            <!-- Salir del Modo Directo -->
            <button id="btnExitGigMode" class="btn btn-secondary btn-exit-gig" aria-label="Salir del Modo Directo (ESC)">
              <span>✕ Salir</span>
            </button>
          </div>
        </div>

        <!-- Controles Flotantes para Pedales o Táctil en Escenario -->
        <div class="gig-bottom-hud" role="group" aria-label="Controles de escenario">
          <button id="btnGigPrevSong" class="btn btn-gig-action" aria-label="Tema anterior en setlist">
            <span>⏮️ Canción Anterior</span>
          </button>
          <button id="btnGigPlayPause" class="btn btn-gig-play" aria-label="Reproducir o pausar">
            <span id="gigPlayIcon">▶ Play / Pausa</span>
          </button>
          <button id="btnGigNextSong" class="btn btn-gig-action" aria-label="Siguiente tema en setlist">
            <span>⏭️ Siguiente Canción</span>
          </button>
        </div>
      </aside>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btnExitGigMode')?.addEventListener('click', () => {
      this.toggle();
    });

    this.container.querySelector('#btnGigPlayPause')?.addEventListener('click', () => {
      audioEngine.playPause();
    });

    this.container.querySelector('#btnGigNextSong')?.addEventListener('click', () => {
      setlistManager.playNextSongInSetlist();
    });

    this.container.querySelector('#btnGigPrevSong')?.addEventListener('click', () => {
      setlistManager.playPreviousSongInSetlist();
    });
  }
}

export const gigMode = new GigMode();
export default gigMode;
