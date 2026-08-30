/**
 * @file TransportBar.js
 * @description Barra de transporte para el Reproductor Limpio (Player View - Ultimate Guitar UX).
 * Mantiene la partitura en el 90% de la pantalla sin estorbos y oculta Mástil/Mezclador por defecto
 * bajo el principio de Divulgación Progresiva.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { audioEngine } from '../core/AudioEngine.js';

export class TransportBar extends Component {
  constructor(container) {
    super(container);
    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('playback:state', ({ state: pState }) => {
        this.updatePlayState(pState);
      })
    );

    this.registerUnsub(
      events.on('playback:time', ({ currentTime, totalTime }) => {
        this.updateTimeDisplay(currentTime, totalTime);
      })
    );

    this.registerUnsub(
      events.on('player:ready', () => {
        this.enableControls(true);
      })
    );
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="topbar-inner player-topbar-clean" role="toolbar" aria-label="Controles del reproductor">
        <!-- Volver a Explorar / Catálogo -->
        <button id="btnNavBack" class="btn btn-icon" aria-label="Volver a Explorar" title="Volver">
          <span aria-hidden="true">◀</span>
        </button>

        <!-- Controles Centrales de Reproducción -->
        <div class="transport-center" role="group" aria-label="Controles de transporte">
          <button id="btnStop" class="btn btn-secondary btn-icon-round" disabled aria-label="Detener" title="Detener">
            <span aria-hidden="true">⏹</span>
          </button>

          <button id="btnPlayPause" class="btn btn-primary btn-play" disabled aria-label="Reproducir o pausar" title="Play / Pause">
            <span id="transportPlayIcon" aria-hidden="true">▶</span>
            <span id="transportPlayText">Play</span>
          </button>

          <div class="time-readout" aria-live="off" aria-label="Tiempo">
            <span id="readoutCurrent">00:00</span>
            <span class="time-sep" aria-hidden="true">/</span>
            <span id="readoutTotal">00:00</span>
          </div>
        </div>

        <!-- Acceso a Herramientas PRO (Divulgación Progresiva) -->
        <div class="tools-right" role="group" aria-label="Ajustes de reproducción">
          <button id="btnToggleGigMode" class="btn btn-tool" aria-label="Modo Directo" title="Modo Directo (G)">
            <span aria-hidden="true">🎤</span>
          </button>

          <button id="btnToggleToolbox" class="btn btn-tool" aria-label="Ajustes y Visualización" title="Herramientas PRO (P)">
            <span aria-hidden="true">⚙️</span> Ajustes
          </button>
        </div>
      </div>
    `;

    this.bindDOMEvents();
  }

  bindDOMEvents() {
    const get = (id) => this.container.querySelector(id);

    get('#btnPlayPause')?.addEventListener('click', () => audioEngine.playPause());
    get('#btnStop')?.addEventListener('click', () => audioEngine.stop());

    get('#btnNavBack')?.addEventListener('click', () => {
      events.emit('ui:switchTab', 'explore');
    });

    get('#btnToggleGigMode')?.addEventListener('click', () => {
      events.emit('ui:toggleGigMode');
    });

    get('#btnToggleToolbox')?.addEventListener('click', () => {
      events.emit('ui:toggleToolbox');
    });
  }

  updatePlayState(pState) {
    const playIcon = this.container?.querySelector('#transportPlayIcon');
    const playText = this.container?.querySelector('#transportPlayText');
    const playBtn = this.container?.querySelector('#btnPlayPause');

    if (!playIcon || !playBtn) return;

    const isPlaying = pState === 'playing';
    playIcon.textContent = isPlaying ? '⏸' : '▶';
    playText.textContent = isPlaying ? 'Pausa' : 'Play';
    playBtn.classList.toggle('playing', isPlaying);
  }

  updateTimeDisplay(currentTime, totalTime) {
    const curEl = this.container?.querySelector('#readoutCurrent');
    const totEl = this.container?.querySelector('#readoutTotal');
    if (curEl) curEl.textContent = this.formatTime(currentTime);
    if (totEl) totEl.textContent = this.formatTime(totalTime);
  }

  enableControls(enabled) {
    const playBtn = this.container?.querySelector('#btnPlayPause');
    const stopBtn = this.container?.querySelector('#btnStop');
    if (playBtn) playBtn.disabled = !enabled;
    if (stopBtn) stopBtn.disabled = !enabled;
  }

  formatTime(ms) {
    if (isNaN(ms) || ms < 0) return '00:00';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
}

export default TransportBar;
