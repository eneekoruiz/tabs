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
import { gigRecorder } from '../audio/GigRecorder.js';

export class BottomNav extends Component {
  constructor(container) {
    super(container);
    this.activeTab = 'explore'; // 'explore' | 'library' | 'tools' | 'settings' | 'player'
    this.currentTranspose = 0;
    this.isAutoScrolling = false;
    this.autoScrollSpeed = 50;
    this.isRecording = false;
    this.isRecordingPending = false;
    this.isMetronomeRunning = false;
    this.metronomeBpm = 120;
    this.recordingDialog = null;
    this.recordingSurface = null;
    this.recordingReturnFocus = null;

    this.ensureRecordingStyles();
    this.initEvents();
    this.render();
  }

  ensureRecordingStyles() {
    if (document.querySelector('link[data-recording-preview-styles]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../../assets/css/components/recording-preview.css', import.meta.url).href;
    link.dataset.recordingPreviewStyles = 'true';
    document.head.appendChild(link);
  }

  initEvents() {
    this.registerUnsub(
      events.on('ui:switchTab', (tabName) => {
        this.setActiveTab(tabName);
      })
    );

    this.registerUnsub(
      events.on('song:stateChanged', ({ transpose, isAutoScrolling, autoScrollSpeed, isRecording, metronome }) => {
        if (transpose !== undefined) this.currentTranspose = transpose;
        if (isAutoScrolling !== undefined) this.isAutoScrolling = isAutoScrolling;
        if (autoScrollSpeed !== undefined) this.autoScrollSpeed = autoScrollSpeed;
        if (isRecording !== undefined) this.isRecording = isRecording;
        if (metronome !== undefined) {
          this.isMetronomeRunning = Boolean(metronome.isRunning);
          this.metronomeBpm = Number(metronome.bpm) || 120;
        }
        if (this.activeTab === 'player') this.render();
      })
    );

    this.registerUnsub(
      events.on('song:metronomeBeat', ({ beat, isAccent }) => {
        this.flashMetronomeBeat(beat, isAccent);
      })
    );

    this.registerUnsub(
      events.on('recorder:requesting', ({ isVideo } = {}) => {
        this.isRecordingPending = true;
        this.showRecordingSurface({
          phase: 'requesting',
          isVideo: Boolean(isVideo),
          status: isVideo ? 'Solicitando cámara y micrófono' : 'Solicitando micrófono'
        });
      })
    );

    this.registerUnsub(
      events.on('recorder:streamReady', ({ stream, isVideo } = {}) => {
        this.showRecordingSurface({
          phase: 'preparing',
          isVideo: Boolean(isVideo),
          stream,
          status: 'Preparando grabación'
        });
      })
    );

    this.registerUnsub(
      events.on('recorder:started', ({ stream, isVideo } = {}) => {
        this.isRecordingPending = false;
        this.isRecording = true;
        this.syncRecordingButton();
        this.showRecordingSurface({
          phase: 'recording',
          isVideo: Boolean(isVideo),
          stream,
          status: isVideo ? 'Grabando vídeo y audio' : 'Grabando solo audio'
        });
      })
    );

    this.registerUnsub(
      events.on('recorder:finished', () => {
        this.isRecordingPending = false;
        this.isRecording = false;
        this.removeRecordingSurface({ restoreFocus: true });
        this.syncRecordingButton();
      })
    );

    this.registerUnsub(
      events.on('recorder:tick', ({ formatted } = {}) => {
        const timer = this.recordingSurface?.querySelector('[data-recording-timer]');
        if (timer) timer.textContent = formatted || '00:00';
      })
    );

    this.registerUnsub(
      events.on('recorder:stopping', () => {
        this.updateRecordingStatus('Finalizando grabación');
        const stopButton = this.recordingSurface?.querySelector('[data-recording-stop]');
        if (stopButton) stopButton.disabled = true;
      })
    );

    const clearRecordingUi = () => {
      this.isRecordingPending = false;
      this.isRecording = false;
      this.removeRecordingSurface({ restoreFocus: true });
      this.syncRecordingButton();
    };

    this.registerUnsub(events.on('recorder:cancelled', clearRecordingUi));
    this.registerUnsub(events.on('recorder:error', clearRecordingUi));
  }

  openRecordingDialog(trigger) {
    if (this.recordingDialog || this.isRecordingPending || this.isRecording) return;

    this.recordingReturnFocus = trigger || document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'recording-choice-dialog';
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'recordingChoiceTitle');
    dialog.innerHTML = '<div class="recording-choice-dialog__body">' +
        '<h2 id="recordingChoiceTitle">Nueva grabación</h2>' +
        '<div class="recording-choice-dialog__actions" role="group" aria-label="Formato de grabación">' +
          '<button type="button" class="recording-choice-dialog__primary" data-recording-choice="video">Vídeo y audio</button>' +
          '<button type="button" data-recording-choice="audio">Solo audio</button>' +
          '<button type="button" data-recording-choice="cancel">Cancelar</button>' +
        '</div>' +
      '</div>';

    const closeAsCancel = () => this.closeRecordingDialog({ restoreFocus: true });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeAsCancel();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeAsCancel();
    });
    dialog.addEventListener('keydown', (event) => this.trapDialogFocus(event));
    dialog.querySelectorAll('[data-recording-choice]').forEach((button) => {
      button.addEventListener('click', () => {
        const choice = button.dataset.recordingChoice;
        if (choice === 'cancel') {
          closeAsCancel();
          return;
        }
        this.closeRecordingDialog({ restoreFocus: false });
        this.beginRecordingRequest(choice === 'video');
      });
    });

    document.body.appendChild(dialog);
    this.recordingDialog = dialog;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.querySelector('[data-recording-choice="video"]')?.focus();
  }

  trapDialogFocus(event) {
    if (event.key !== 'Tab' || !this.recordingDialog) return;
    const controls = Array.from(this.recordingDialog.querySelectorAll('button:not([disabled])'));
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  closeRecordingDialog({ restoreFocus = true } = {}) {
    const dialog = this.recordingDialog;
    if (!dialog) return;
    this.recordingDialog = null;
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    dialog.remove();
    if (restoreFocus) this.restoreRecordingFocus();
  }

  beginRecordingRequest(withVideo) {
    this.isRecordingPending = true;
    this.showRecordingSurface({
      phase: 'requesting',
      isVideo: withVideo,
      status: withVideo ? 'Solicitando cámara y micrófono' : 'Solicitando micrófono'
    });
    events.emit('song:toggleRecording', { video: withVideo });
  }

  showRecordingSurface({ phase, isVideo, stream = null, status }) {
    if (!this.recordingSurface) {
      const surface = document.createElement('section');
      surface.className = 'recording-preview';
      surface.setAttribute('aria-label', 'Estado de grabación');
      surface.innerHTML = '<div class="recording-preview__media" data-recording-media hidden></div>' +
        '<div class="recording-preview__status-row">' +
          '<span class="recording-preview__dot" aria-hidden="true"></span>' +
          '<span class="recording-preview__status" role="status" aria-live="polite"></span>' +
          '<output class="recording-preview__timer" data-recording-timer aria-label="Duración">00:00</output>' +
        '</div>' +
        '<button type="button" class="recording-preview__stop" data-recording-stop></button>';
      document.body.appendChild(surface);
      this.recordingSurface = surface;
      surface.querySelector('[data-recording-stop]')?.addEventListener('click', () => {
        if (this.isRecordingPending && !this.isRecording) {
          gigRecorder.cancelPendingRecording();
          return;
        }
        events.emit('song:toggleRecording', { video: false });
      });
    }

    const surface = this.recordingSurface;
    surface.dataset.phase = phase;
    surface.setAttribute('aria-busy', String(phase !== 'recording'));
    surface.classList.toggle('recording-preview--video', Boolean(isVideo));
    surface.classList.toggle('recording-preview--audio', !isVideo);

    const media = surface.querySelector('[data-recording-media]');
    const currentVideo = media?.querySelector('video');
    if (isVideo && stream) {
      const video = currentVideo || document.createElement('video');
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('aria-label', 'Vista previa de tu cámara');
      if (!currentVideo) media.appendChild(video);
      if (video.srcObject !== stream) video.srcObject = stream;
      media.hidden = false;
      video.play().catch(() => {});
    } else if (media) {
      if (currentVideo) {
        currentVideo.pause();
        currentVideo.srcObject = null;
        currentVideo.remove();
      }
      media.hidden = true;
    }

    this.updateRecordingStatus(status);
    const timer = surface.querySelector('[data-recording-timer]');
    if (timer) timer.hidden = phase !== 'recording';
    const stopButton = surface.querySelector('[data-recording-stop]');
    if (stopButton) {
      stopButton.disabled = false;
      stopButton.textContent = phase === 'recording' ? 'Detener' : 'Cancelar';
      stopButton.setAttribute(
        'aria-label',
        phase === 'recording' ? 'Detener y guardar grabación' : 'Cancelar solicitud de grabación'
      );
    }
  }

  updateRecordingStatus(message) {
    const status = this.recordingSurface?.querySelector('.recording-preview__status');
    if (status) status.textContent = message || '';
  }

  removeRecordingSurface({ restoreFocus = false } = {}) {
    const video = this.recordingSurface?.querySelector('video');
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    this.recordingSurface?.remove();
    this.recordingSurface = null;
    if (restoreFocus) queueMicrotask(() => this.restoreRecordingFocus());
  }

  restoreRecordingFocus() {
    const preferred = document.getElementById('btnBottomToggleRecord');
    const target = preferred || this.recordingReturnFocus;
    this.recordingReturnFocus = null;
    if (target?.isConnected && typeof target.focus === 'function') target.focus();
  }

  syncRecordingButton() {
    if (this.activeTab !== 'player') return;
    const button = this.container?.querySelector('#btnBottomToggleRecord');
    if (!button) return;
    button.classList.toggle('recording-active', this.isRecording);
    button.setAttribute('aria-pressed', String(this.isRecording));
    button.setAttribute(
      'aria-label',
      this.isRecording ? 'Detener y guardar grabación' : 'Grabar toma de ensayo'
    );
    const label = button.querySelector('[data-recording-button-label]');
    if (label) label.textContent = this.isRecording ? 'Detener' : 'Grabar';
  }

  flashMetronomeBeat(beat, isAccent) {
    if (this.activeTab !== 'player') return;
    const dot = this.container?.querySelector('#bottomMetronomeBeatDot');
    if (dot) {
      dot.classList.remove('beat-pulse', 'beat-accent');
      void dot.offsetWidth;
      dot.classList.add(isAccent ? 'beat-accent' : 'beat-pulse');
    }
  }

  syncMetronomeButton() {
    if (this.activeTab !== 'player') return;
    const button = this.container?.querySelector('#btnBottomMetronomePlay');
    if (button) {
      button.classList.toggle('active', this.isMetronomeRunning);
      button.setAttribute('aria-pressed', String(this.isMetronomeRunning));
      button.setAttribute(
        'aria-label',
        this.isMetronomeRunning ? 'Pausar metrónomo' : 'Iniciar metrónomo'
      );
      const icon = button.querySelector('.nav-player-metro-icon');
      if (icon) icon.textContent = this.isMetronomeRunning ? '⏸' : '⏱️';
      const label = button.querySelector('.nav-player-metro-label');
      if (label) label.textContent = this.isMetronomeRunning ? 'Pausa' : 'Metro';
    }
    const bpmLabel = this.container?.querySelector('#lblBottomMetronomeBpm');
    if (bpmLabel) bpmLabel.textContent = String(this.metronomeBpm);
    const openBtn = this.container?.querySelector('#btnBottomMetronomeOpen');
    if (openBtn) openBtn.setAttribute('aria-label', `Abrir panel de metrónomo (${this.metronomeBpm} BPM)`);
    const dot = this.container?.querySelector('#bottomMetronomeBeatDot');
    if (dot) dot.classList.toggle('active', this.isMetronomeRunning);
  }

  destroy() {
    this.closeRecordingDialog({ restoreFocus: false });
    this.removeRecordingSurface();
    super.destroy();
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
        <nav class="bottom-nav-bar bottom-player-bar" role="toolbar" aria-label="Controles principales de canción">
          <!-- Transpositor rápido de Tono -->
          <div class="nav-player-transpose-cluster" role="group" aria-label="Transponer tono">
            <button class="nav-player-step-btn" id="btnBottomTransposeDown" aria-label="Bajar semitono">-1</button>
            <span class="nav-player-val-badge" id="lblBottomTranspose">${this.currentTranspose > 0 ? '+' : ''}${this.currentTranspose}</span>
            <button class="nav-player-step-btn" id="btnBottomTransposeUp" aria-label="Subir semitono">+1</button>
          </div>

          <!-- Auto-Scroll Directo y Control de Velocidad -->
          <div class="nav-player-autoscroll-cluster" role="group" aria-label="Auto-scroll y velocidad">
            <button class="nav-player-btn btn-player-autoscroll ${this.isAutoScrolling ? 'active' : ''}" id="btnBottomToggleAutoScroll" aria-label="${this.isAutoScrolling ? 'Pausar auto-scroll' : 'Iniciar auto-scroll'}" aria-pressed="${this.isAutoScrolling}">
              <span class="nav-player-scroll-icon">${this.isAutoScrolling ? '⏸' : '⚡'}</span>
              <span>${this.isAutoScrolling ? 'Pausa' : 'Scroll'}</span>
            </button>
            <div class="nav-player-scroll-controls" role="group" aria-label="Velocidad de desplazamiento">
              <button type="button" class="nav-player-step-btn" id="btnBottomScrollSpeedDecr" aria-label="Reducir velocidad">−</button>
              <span class="nav-player-val-badge nav-player-speed-badge font-mono" id="lblBottomScrollSpeed" title="Velocidad de auto-scroll">${this.autoScrollSpeed || 50}%</span>
              <button type="button" class="nav-player-step-btn" id="btnBottomScrollSpeedIncr" aria-label="Aumentar velocidad">+</button>
              <input type="range" id="rngAutoScrollSpeed" min="1" max="100" value="${this.autoScrollSpeed || 50}" class="sr-only" aria-label="Velocidad de desplazamiento automático">
            </div>
          </div>

          <!-- Metrónomo Directo en Barra Inferior -->
          <div class="nav-player-metronome-cluster" role="group" aria-label="Metrónomo de canción">
            <button class="nav-player-btn btn-player-metro-toggle ${this.isMetronomeRunning ? 'active' : ''}" id="btnBottomMetronomePlay" aria-label="${this.isMetronomeRunning ? 'Pausar metrónomo' : 'Iniciar metrónomo'}" aria-pressed="${this.isMetronomeRunning}">
              <span class="nav-player-metro-dot ${this.isMetronomeRunning ? 'active' : ''}" id="bottomMetronomeBeatDot" aria-hidden="true"></span>
              <span class="nav-player-metro-icon">${this.isMetronomeRunning ? '⏸' : '⏱️'}</span>
              <span class="nav-player-metro-label">${this.isMetronomeRunning ? 'Pausa' : 'Metro'}</span>
            </button>
            <div class="nav-player-metro-controls" role="group" aria-label="Ajuste de BPM">
              <button class="nav-player-step-btn btn-metro-step" id="btnBottomMetronomeMinus" aria-label="Reducir 1 BPM">−</button>
              <button class="nav-player-val-badge nav-player-bpm-btn" id="btnBottomMetronomeOpen" aria-label="Abrir panel de metrónomo (${this.metronomeBpm} BPM)" title="Configurar metrónomo">
                <span id="lblBottomMetronomeBpm">${this.metronomeBpm}</span>
                <span class="bpm-unit">BPM</span>
              </button>
              <button class="nav-player-step-btn btn-metro-step" id="btnBottomMetronomePlus" aria-label="Aumentar 1 BPM">+</button>
              <button class="nav-player-step-btn btn-metro-tap" id="btnBottomMetronomeTap" aria-label="Tap tempo por pulsación" title="Tap Tempo">TAP</button>
            </div>
          </div>

          <!-- Grabador Directo -->
          <button class="nav-player-btn btn-player-record ${this.isRecording ? 'recording-active' : ''}" id="btnBottomToggleRecord" aria-label="${this.isRecording ? 'Detener y guardar grabación' : 'Grabar toma de ensayo'}" aria-pressed="${this.isRecording}">
            <span class="nav-player-rec-dot"></span>
            <span data-recording-button-label>${this.isRecording ? 'Detener' : 'Grabar'}</span>
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

      this.container.querySelector('#btnBottomScrollSpeedDecr')?.addEventListener('click', () => {
        events.emit('song:stepAutoScrollSpeed', -1);
      });

      this.container.querySelector('#btnBottomScrollSpeedIncr')?.addEventListener('click', () => {
        events.emit('song:stepAutoScrollSpeed', 1);
      });

      this.container.querySelector('#rngAutoScrollSpeed')?.addEventListener('input', (event) => {
        events.emit('song:setAutoScrollSpeed', Number(event.target.value));
      });

      this.container.querySelector('#btnBottomMetronomePlay')?.addEventListener('click', () => {
        events.emit('song:toggleMetronome');
      });

      this.container.querySelector('#btnBottomMetronomeMinus')?.addEventListener('click', () => {
        events.emit('song:stepMetronomeBpm', -1);
      });

      this.container.querySelector('#btnBottomMetronomePlus')?.addEventListener('click', () => {
        events.emit('song:stepMetronomeBpm', 1);
      });

      this.container.querySelector('#btnBottomMetronomeTap')?.addEventListener('click', () => {
        events.emit('song:tapMetronome');
      });

      this.container.querySelector('#btnBottomMetronomeOpen')?.addEventListener('click', () => {
        events.emit('song:openMetronomePanel');
      });

      this.container.querySelector('#btnBottomToggleRecord')?.addEventListener('click', () => {
        const trigger = this.container.querySelector('#btnBottomToggleRecord');
        this.recordingReturnFocus = trigger;
        if (this.isRecording) {
          events.emit('song:toggleRecording', { video: false });
        } else if (!this.isRecordingPending) {
          this.openRecordingDialog(trigger);
        }
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
