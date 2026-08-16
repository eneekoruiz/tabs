/**
 * @file Mixer.js
 * @description Mezclador multicanal profesional estilo consola DAW con soporte completo de accesibilidad.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { audioEngine } from '../core/AudioEngine.js';

export class Mixer extends Component {
  constructor(container) {
    super(container);
    this.tracks = [];
    this.isOpen = false;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('score:loaded', ({ tracks }) => {
        this.tracks = tracks;
        this.render();
      })
    );

    this.registerUnsub(
      events.on('mixer:trackUpdated', () => {
        this.updateTrackControls();
      })
    );

    this.registerUnsub(
      events.on('track:visualSelected', () => {
        this.updateActiveVisualIndicator();
      })
    );

    this.registerUnsub(
      events.on('ui:toggleMixer', () => {
        this.toggle();
      })
    );
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.container) {
      this.container.classList.toggle('mixer-open', this.isOpen);
    }
  }

  render() {
    if (!this.container) return;

    if (this.tracks.length === 0) {
      this.container.innerHTML = `
        <div class="mixer-drawer" role="region" aria-label="Consola del mezclador">
          <div class="mixer-header">
            <h2>🎚️ Mezclador Multicanal</h2>
            <button class="btn-close-mixer" id="btnCloseMixer" aria-label="Cerrar mezclador">✖</button>
          </div>
          <div class="mixer-empty">Carga una partitura para acceder a sus pistas.</div>
        </div>
      `;
      this.bindHeaderEvents();
      return;
    }

    const activeVisualIdx = state.get('activeTrackIndex');

    this.container.innerHTML = `
      <div class="mixer-drawer" role="region" aria-label="Consola del mezclador multicanal">
        <div class="mixer-header">
          <div class="mixer-title-group">
            <h2>🎚️ Mezclador Multicanal</h2>
            <span class="mixer-track-badge" aria-label="${this.tracks.length} pistas disponibles">${this.tracks.length} Pistas</span>
          </div>
          <button class="btn-close-mixer" id="btnCloseMixer" aria-label="Cerrar consola de mezclador">✖</button>
        </div>

        <div class="mixer-channels-scroll">
          <div class="mixer-channels-grid" role="group" aria-label="Canales de audio">
            ${this.tracks.map((track, idx) => {
              const isVisual = idx === activeVisualIdx;
              return `
                <div class="channel-strip ${isVisual ? 'channel-visual-active' : ''}" data-track-index="${idx}" role="group" aria-label="Canal ${idx + 1}: ${track.name}">
                  
                  <!-- Selector de visualización en partitura -->
                  <div class="channel-view-btn-container">
                    <button class="btn-view-track ${isVisual ? 'active' : ''}" data-track="${idx}" aria-label="Mostrar tablatura de la pista ${track.name}" title="Ver pista">
                      👁️ ${isVisual ? 'Viendo' : 'Ver'}
                    </button>
                  </div>

                  <!-- Medidor y Fader de Volumen -->
                  <div class="channel-fader-section">
                    <input type="range" class="vertical-fader" min="0" max="1" step="0.01" value="${track.volume || 1.0}" data-track="${idx}" aria-label="Volumen pista ${track.name}">
                    <span class="fader-value-label" aria-hidden="true">${Math.round((track.volume || 1.0) * 100)}%</span>
                  </div>

                  <!-- Botones Solo & Mute -->
                  <div class="channel-buttons">
                    <button class="btn-solo ${track.solo ? 'active' : ''}" data-track="${idx}" aria-label="Solo para pista ${track.name}" title="Solo">S</button>
                    <button class="btn-mute ${track.mute ? 'active' : ''}" data-track="${idx}" aria-label="Silenciar pista ${track.name}" title="Mute">M</button>
                  </div>

                  <!-- Nombre y Afinación de la Pista -->
                  <div class="channel-footer">
                    <span class="channel-number" aria-hidden="true">#${idx + 1}</span>
                    <span class="channel-name" title="${track.name}">${track.name}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    this.bindHeaderEvents();
    this.bindChannelEvents();
  }

  bindHeaderEvents() {
    this.container.querySelector('#btnCloseMixer')?.addEventListener('click', () => {
      this.toggle();
    });
  }

  bindChannelEvents() {
    this.container.querySelectorAll('.vertical-fader').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const trackIdx = parseInt(e.target.dataset.track, 10);
        const volume = parseFloat(e.target.value);
        audioEngine.setTrackVolume(trackIdx, volume);
        
        const label = e.target.parentElement.querySelector('.fader-value-label');
        if (label) label.textContent = `${Math.round(volume * 100)}%`;
      });
    });

    this.container.querySelectorAll('.btn-solo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const trackIdx = parseInt(e.target.dataset.track, 10);
        audioEngine.setTrackSolo(trackIdx);
      });
    });

    this.container.querySelectorAll('.btn-mute').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const trackIdx = parseInt(e.target.dataset.track, 10);
        audioEngine.setTrackMute(trackIdx);
      });
    });

    this.container.querySelectorAll('.btn-view-track').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const trackIdx = parseInt(e.target.dataset.track, 10);
        audioEngine.selectVisualTrack(trackIdx);
      });
    });
  }

  updateTrackControls() {
    if (!this.container) return;
    const tracksState = state.get('tracksState') || [];

    tracksState.forEach(track => {
      const strip = this.container.querySelector(`.channel-strip[data-track-index="${track.index}"]`);
      if (strip) {
        const soloBtn = strip.querySelector('.btn-solo');
        const muteBtn = strip.querySelector('.btn-mute');
        if (soloBtn) soloBtn.classList.toggle('active', !!track.solo);
        if (muteBtn) muteBtn.classList.toggle('active', !!track.mute);
      }
    });
  }

  updateActiveVisualIndicator() {
    if (!this.container) return;
    const activeVisualIdx = state.get('activeTrackIndex');

    this.container.querySelectorAll('.channel-strip').forEach(strip => {
      const idx = parseInt(strip.dataset.trackIndex, 10);
      const isVisual = idx === activeVisualIdx;
      strip.classList.toggle('channel-visual-active', isVisual);
      
      const viewBtn = strip.querySelector('.btn-view-track');
      if (viewBtn) {
        viewBtn.classList.toggle('active', isVisual);
        viewBtn.textContent = isVisual ? '👁️ Viendo' : 'Ver';
      }
    });
  }
}

export default Mixer;
