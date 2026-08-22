/**
 * @file BottomNav.js
 * @description Barra de Navegación Inferior Fija Mobile-First (Estilo Studio PRO):
 * - 🔍 Explorar (Buscador universal masivo)
 * - 📚 Mis Tabs (Repertorios guardados)
 * - 🛠️ Herramientas (Afinador, Metrónomo, Buscador de Acordes, Escalas)
 * - ⚙️ Ajustes (Perfil, Zurdo/Diestro, Instrumento por defecto, Cuenta y Nube)
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { audioFeedback } from '../audio/AudioFeedback.js';

export class BottomNav extends Component {
  constructor(container) {
    super(container);
    this.activeTab = 'explore'; // 'explore' | 'library' | 'tools' | 'settings' | 'player'
    this.currentTranspose = 0;
    this.isAutoScrolling = false;
    this.isRecording = false;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('ui:switchTab', (tabName) => {
        this.setActiveTab(tabName);
      })
    );

    this.registerUnsub(
      events.on('song:stateChanged', ({ transpose, isAutoScrolling, isRecording }) => {
        if (transpose !== undefined) this.currentTranspose = transpose;
        if (isAutoScrolling !== undefined) this.isAutoScrolling = isAutoScrolling;
        if (isRecording !== undefined) this.isRecording = isRecording;
        if (this.activeTab === 'player') {
          this.render();
        }
      })
    );

    this.registerUnsub(
      events.on('recorder:started', () => {
        this.isRecording = true;
        if (this.activeTab === 'player') this.render();
      })
    );

    this.registerUnsub(
      events.on('recorder:finished', () => {
        this.isRecording = false;
        if (this.activeTab === 'player') this.render();
      })
    );
  }

  setActiveTab(tabName) {
    this.activeTab = tabName;
    this.updateDOMVisibility();
    this.render();
  }

  updateDOMVisibility() {
    const exploreView = document.getElementById('explore-view-container');
    const libraryContainer = document.getElementById('library-container');
    const toolsView = document.getElementById('tools-view-container');
    const settingsView = document.getElementById('settings-view-container');
    const scoreViewport = document.getElementById('score-viewport');
    const songInfoStrip = document.getElementById('songInfoStrip');
    const transportHeader = document.getElementById('transport-container');

    // Ocultar todas las vistas principales
    if (exploreView) exploreView.classList.remove('active-view');
    if (libraryContainer) libraryContainer.classList.remove('active-view', 'library-open-mobile');
    if (toolsView) toolsView.classList.remove('active-view');
    if (settingsView) settingsView.classList.remove('active-view');
    if (scoreViewport) scoreViewport.classList.remove('active-view', 'active-player-view');

    if (this.activeTab === 'explore') {
      if (exploreView) exploreView.classList.add('active-view');
      if (songInfoStrip) songInfoStrip.style.display = 'none';
      if (transportHeader) transportHeader.style.display = 'none';
    } else if (this.activeTab === 'library') {
      if (libraryContainer) {
        libraryContainer.classList.add('active-view', 'library-open-mobile');
      }
      if (songInfoStrip) songInfoStrip.style.display = 'none';
      if (transportHeader) transportHeader.style.display = 'none';
    } else if (this.activeTab === 'tools') {
      if (toolsView) toolsView.classList.add('active-view');
      if (songInfoStrip) songInfoStrip.style.display = 'none';
      if (transportHeader) transportHeader.style.display = 'none';
    } else if (this.activeTab === 'settings') {
      if (settingsView) settingsView.classList.add('active-view');
      if (songInfoStrip) songInfoStrip.style.display = 'none';
      if (transportHeader) transportHeader.style.display = 'none';
    } else if (this.activeTab === 'player') {
      if (scoreViewport) scoreViewport.classList.add('active-view', 'active-player-view');
      if (songInfoStrip) songInfoStrip.style.display = 'none';
      if (transportHeader) transportHeader.style.display = 'none';
    }
  }

  render() {
    if (!this.container) return;

    if (this.activeTab === 'player') {
      // BARRA CONTEXTUAL DE CANCIÓN
      this.container.innerHTML = `
        <nav class="bottom-nav-bar bottom-player-bar" role="toolbar" aria-label="Controles de canción">
          <button class="nav-player-btn btn-player-exit" id="btnBottomExitSong" aria-label="Volver a explorar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            <span>Volver</span>
          </button>

          <!-- Transpositor rápido de Tono -->
          <div class="nav-player-transpose-cluster" role="group" aria-label="Transponer tono">
            <button class="nav-player-step-btn" id="btnBottomTransposeDown" aria-label="Bajar semitono">-1</button>
            <span class="nav-player-val-badge" id="lblBottomTranspose">${this.currentTranspose > 0 ? '+' : ''}${this.currentTranspose}</span>
            <button class="nav-player-step-btn" id="btnBottomTransposeUp" aria-label="Subir semitono">+1</button>
          </div>

          <!-- Auto-Scroll Directo -->
          <button class="nav-player-btn btn-player-autoscroll ${this.isAutoScrolling ? 'active' : ''}" id="btnBottomToggleAutoScroll" aria-label="Auto-Scroll">
            <span class="nav-player-scroll-icon">${this.isAutoScrolling ? '⏸' : '⚡'}</span>
            <span>${this.isAutoScrolling ? 'Pausa' : 'AutoScroll'}</span>
          </button>

          <!-- Grabador Directo -->
          <button class="nav-player-btn btn-player-record ${this.isRecording ? 'recording-active' : ''}" id="btnBottomToggleRecord" aria-label="Grabar toma de ensayo">
            <span class="nav-player-rec-dot"></span>
            <span>${this.isRecording ? 'Detener' : 'Grabar'}</span>
          </button>

          <!-- Modo Atril / Pantalla Completa -->
          <button class="nav-player-btn" id="btnBottomEnterStage" aria-label="Modo atril pantalla completa">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
            <span>Atril</span>
          </button>
        </nav>
      `;
    } else {
      // BARRA PRINCIPAL DE LA APP
      this.container.innerHTML = `
        <nav class="bottom-nav-bar" role="navigation" aria-label="Navegación principal inferior">
          <button class="nav-tab-btn ${this.activeTab === 'explore' ? 'active' : ''}" data-tab="explore" aria-label="Explorar catálogo masivo">
            <svg class="nav-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <span>Explorar</span>
          </button>

          <button class="nav-tab-btn ${this.activeTab === 'library' ? 'active' : ''}" data-tab="library" aria-label="Mis tablaturas y repertorios">
            <svg class="nav-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
            </svg>
            <span>Mis Tabs</span>
          </button>

          <button class="nav-tab-btn ${this.activeTab === 'tools' ? 'active' : ''}" data-tab="tools" aria-label="Herramientas y estudio">
            <svg class="nav-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
            </svg>
            <span>Herramientas</span>
          </button>

          <button class="nav-tab-btn ${this.activeTab === 'settings' ? 'active' : ''}" data-tab="settings" aria-label="Ajustes de cuenta y preferencias">
            <svg class="nav-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
            <span>Ajustes</span>
          </button>
        </nav>
      `;
    }

    this.bindEvents();
  }

  bindEvents() {
    if (this.activeTab === 'player') {
      this.container.querySelector('#btnBottomExitSong')?.addEventListener('click', () => {
        audioFeedback.playTabSwitch();
        events.emit('ui:switchTab', 'explore');
      });

      this.container.querySelector('#btnBottomTransposeDown')?.addEventListener('click', () => {
        events.emit('song:transpose', -1);
      });

      this.container.querySelector('#btnBottomTransposeUp')?.addEventListener('click', () => {
        events.emit('song:transpose', 1);
      });

      this.container.querySelector('#btnBottomToggleAutoScroll')?.addEventListener('click', () => {
        events.emit('song:toggleAutoScroll');
      });

      this.container.querySelector('#btnBottomToggleRecord')?.addEventListener('click', () => {
        events.emit('song:toggleRecording');
      });

      this.container.querySelector('#btnBottomEnterStage')?.addEventListener('click', () => {
        events.emit('song:enterStageMode');
      });
    } else {
      this.container.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.dataset.tab;
          audioFeedback.playTabSwitch();
          this.setActiveTab(tab);
        });
      });
    }
  }
}

export default BottomNav;
