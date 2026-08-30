/**
 * @file SpatialXRHudView.js
 * @description Vista y Entorno de Computación Espacial WebXR / Realidad Aumentada (Glassmorphism HUD).
 * Permite desprender la partitura, transportes y afinador del fondo oscuro para flotar como un HUD
 * transparente cristalino en visores XR (Apple Vision Pro, Meta Quest) y pantallas transparentes.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';

export class SpatialXRHudView extends Component {
  constructor() {
    super(null);
    this.isXREnabled = false;
    this.glassOpacity = 0.75;
    this.hudElevation = 0; // Offset vertical
    this.initEvents();
  }

  initEvents() {
    events.on('spatialXR:open', () => this.open('#spatial-xr-modal-container'));
  }

  open(targetContainerSelector = '#spatial-xr-modal-container') {
    let host = document.querySelector(targetContainerSelector);
    if (!host || host.offsetParent === null && targetContainerSelector === '#toolModalHost') {
      host = document.querySelector('#spatial-xr-modal-container') || document.querySelector('#toolModalHost');
    }
    if (!host) return;

    this.currentHost = targetContainerSelector;
    host.innerHTML = this.renderModal();
    this.attachListeners(host);
  }

  close(host) {
    this.disableSpatialMode();
    if (host) host.innerHTML = '';
  }

  renderModal() {
    const song = state.get('activeSong');
    return `
      <div class="modal-spatial-backdrop ${this.isXREnabled ? 'xr-active' : ''}" role="dialog" aria-modal="true" aria-labelledby="spatialTitle">
        <!-- Floating Glassmorphic HUD Card -->
        <div class="spatial-hud-card" id="spatialHudCard" style="opacity: ${this.glassOpacity}; transform: translateY(${this.hudElevation}px);">
          <!-- Top Spatial Bar -->
          <div class="spatial-hud-header">
            <div class="spatial-brand-pill">
              <span class="spatial-xr-icon">🥽</span>
              <span>SPATIAL COMPUTING HUD · WEBXR AR/VR</span>
            </div>
            <h2 id="spatialTitle" class="spatial-song-title">${song?.title || 'Blackbird'}</h2>
            <span class="spatial-artist-subtitle">${song?.artist || 'The Beatles'}</span>
            <button class="btn-close-spatial" id="btnCloseSpatial" aria-label="Cerrar Spatial XR">✕</button>
          </div>

          <!-- Spatial Content Area -->
          <div class="spatial-hud-body">
            <div class="spatial-tab-viewport" id="spatialTabViewport">
              <div class="spatial-chords-preview">
                <div class="spatial-chord-card"><span class="chord-sym">G</span><span class="chord-lbl">Compás 1</span></div>
                <div class="spatial-chord-card"><span class="chord-sym">Am7</span><span class="chord-lbl">Compás 2</span></div>
                <div class="spatial-chord-card"><span class="chord-sym">G/B</span><span class="chord-lbl">Compás 3</span></div>
                <div class="spatial-chord-card"><span class="chord-sym">C</span><span class="chord-lbl">Compás 4</span></div>
              </div>
              <p class="spatial-lyrics-line">Blackbird singing in the dead of night, take these broken wings and learn to fly...</p>
            </div>
          </div>

          <!-- Controls Bar -->
          <div class="spatial-hud-controls">
            <div class="spatial-ctrl-group">
              <label for="rngSpatialOpacity">Transparencia Cristal (Glass Opacity)</label>
              <input type="range" id="rngSpatialOpacity" min="0.2" max="0.95" step="0.05" value="${this.glassOpacity}">
            </div>

            <button class="btn-spatial-toggle ${this.isXREnabled ? 'active' : ''}" id="btnToggleXR">
              ${this.isXREnabled ? '🥽 Salir de Modo Espacial XR' : '🥽 Activar Vista Flotante AR (Vision Pro)'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  attachListeners(container) {
    const card = container.querySelector('.modal-spatial-backdrop');
    if (!card) return;

    card.querySelector('#btnCloseSpatial')?.addEventListener('click', () => this.close(container));

    // Opacidad cristalina Glassmorphism
    card.querySelector('#rngSpatialOpacity')?.addEventListener('input', (e) => {
      this.glassOpacity = parseFloat(e.target.value);
      const hud = card.querySelector('#spatialHudCard');
      if (hud) hud.style.opacity = this.glassOpacity;
    });

    // Toggle modo XR
    card.querySelector('#btnToggleXR')?.addEventListener('click', () => {
      this.isXREnabled = !this.isXREnabled;
      card.classList.toggle('xr-active', this.isXREnabled);
      document.body.classList.toggle('spatial-xr-mode', this.isXREnabled);
      card.querySelector('#btnToggleXR').textContent = this.isXREnabled ? '🥽 Salir de Modo Espacial XR' : '🥽 Activar Vista Flotante AR (Vision Pro)';
    });
  }

  disableSpatialMode() {
    this.isXREnabled = false;
    document.body.classList.remove('spatial-xr-mode');
  }
}

export const spatialXRHudView = new SpatialXRHudView();
export default spatialXRHudView;
