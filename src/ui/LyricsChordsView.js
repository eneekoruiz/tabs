/**
 * @file LyricsChordsView.js
 * @description Vista principal de Letra con Acordes interactivos Multi-Instrumento (Guitarra, Piano, Ukelele).
 * Arquitectura modular Clean Code con SRP (Single Responsibility Principle).
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { chordEngine } from '../tools/ChordEngine.js';
import { pitchDetector } from '../audio/PitchDetector.js';
import { onlineSongProvider } from '../data/OnlineSongProvider.js';
import { toast } from './Toast.js';
import { ChordProParser } from './lyrics/ChordProParser.js';
import { ChordDiagramRenderer } from './lyrics/ChordDiagramRenderer.js';
import { SongAutoScroller } from './lyrics/SongAutoScroller.js';
import { SongAudioRecorder } from './lyrics/SongAudioRecorder.js';
import { ChordPopoverModal } from './lyrics/ChordPopoverModal.js';

export class LyricsChordsView extends Component {
  constructor(container) {
    super(container);
    this.currentSong = null;
    this.transposeSemitones = 0;
    this.capoFret = 0;
    this.fontSizeScale = parseInt(localStorage.getItem('lyrics_font_scale'), 10) || 100;
    this.viewMode = 'lyrics';
    this.currentInstrument = localStorage.getItem('app_instrument') || 'guitar';
    this.visualTheme = localStorage.getItem('app_visual_theme') || 'paper';
    this.notationSystem = localStorage.getItem('app_notation') || 'anglo';
    this.isSimplified = localStorage.getItem('app_simplified_chords') === 'true';
    this.hideChordsMode = false;
    this.isStageMode = false;
    this.isInstrumentMenuOpen = false;
    this.isOptionsMenuOpen = false;
    this.isLiveListening = false;
    this.wakeLockSentinel = null;

    // Submódulos desacoplados SRP
    this.autoScroller = new SongAutoScroller({
      initialSpeed: 25,
      onStateChange: () => this.syncContextualState()
    });

    this.audioRecorder = new SongAudioRecorder({
      onStateChange: () => {
        this.syncContextualState();
        this.render();
      }
    });

    this.chordPopover = new ChordPopoverModal({
      instrument: this.currentInstrument,
      notation: this.notationSystem
    });

    chordEngine.setInstrument(this.currentInstrument);
    this.initEvents();
    this.requestScreenWakeLock();
    this.initFullscreenListeners();
  }

  async requestScreenWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLockSentinel = await navigator.wakeLock.request('screen');
      }
    } catch (e) {}
  }

  initFullscreenListeners() {
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && this.isStageMode) {
        this.exitStageMode();
      }
    });
  }

  initEvents() {
    const handleSongLoad = async (song) => {
      if (this.currentSong && (String(this.currentSong.id) === String(song.id) || this.currentSong.title === song.title) && this.currentSong.lyricsChords) {
        return;
      }
      this.currentSong = song;
      this.transposeSemitones = 0;
      this.capoFret = 0;
      this.visualTheme = localStorage.getItem('app_visual_theme') || 'oled';
      this.audioRecorder.dismiss();

      if (this.currentSong && (!this.currentSong.lyricsChords || this.currentSong.lyricsChords.trim().length === 0)) {
        this.currentSong.lyricsChords = await onlineSongProvider.fetchLyricsAndChords(this.currentSong.title, this.currentSong.artist);
      }
      this.setViewMode('lyrics');
      this.render();
      this.syncContextualState();
    };

    this.registerUnsub(events.on('score:loaded', ({ score }) => {
      const activeSong = state.get('activeSong');
      if (activeSong) handleSongLoad(activeSong);
    }));

    this.registerUnsub(events.on('ui:loadLyricsSong', handleSongLoad));

    this.registerUnsub(events.on('song:transpose', (step) => {
      this.setTranspose(this.transposeSemitones + step);
    }));

    this.registerUnsub(events.on('song:toggleAutoScroll', () => {
      this.toggleAutoScroll();
    }));

    this.registerUnsub(events.on('song:toggleRecording', (opts) => {
      this.toggleRecording(opts?.video || false);
    }));

    this.registerUnsub(events.on('song:enterStageMode', () => {
      this.enterStageMode();
    }));

    this.registerUnsub(events.on('song:exitStageMode', () => {
      this.exitStageMode();
    }));

    this.registerUnsub(events.on('tuner:pitch', (pitch) => {
      if (this.isLiveListening && pitch) {
        this.handleLiveChordDetected(pitch.note);
      }
    }));
  }

  syncContextualState() {
    events.emit('song:stateChanged', {
      transpose: this.transposeSemitones,
      isAutoScrolling: this.autoScroller.isRunning,
      autoScrollSpeed: this.autoScroller.speedPercent,
      isRecording: this.audioRecorder.isRecording,
      isStageMode: this.isStageMode
    });
  }

  setTranspose(semitones) {
    this.transposeSemitones = semitones;
    this.render();
    this.syncContextualState();
    toast.show(`Tono: ${this.transposeSemitones > 0 ? '+' : ''}${this.transposeSemitones}`, 'info', 500);
  }

  setCapo(fret) {
    this.capoFret = Math.max(0, Math.min(7, fret));
    this.render();
    toast.show(this.capoFret === 0 ? 'Cejilla desactivada' : `Cejilla en traste ${this.capoFret}`, 'info', 800);
  }

  setInstrument(inst) {
    this.currentInstrument = inst;
    localStorage.setItem('app_instrument', inst);
    chordEngine.setInstrument(inst);
    this.isInstrumentMenuOpen = false;
    this.render();
    toast.show(`Instrumento: ${ChordDiagramRenderer.getInstrumentDisplayName(inst)}`, 'success', 800);
  }

  setNotationSystem(notation) {
    this.notationSystem = notation;
    localStorage.setItem('app_notation', notation);
    this.render();
    toast.show(`Cifrado: ${notation === 'latin' ? 'Latino (Do, Re, Mi)' : 'Americano (C, D, E)'}`, 'info', 800);
  }

  toggleAutoScroll() {
    this.autoScroller.toggle();
    this.render();
    this.syncContextualState();
  }

  toggleRecording(wantVideo = false) {
    this.audioRecorder.toggle(this.currentSong?.title || 'Ensayo', wantVideo);
  }

  enterStageMode() {
    this.isStageMode = true;
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
    events.emit('ui:stageMode', true);
    this.render();
    this.syncContextualState();
    toast.show('Modo Atril de Escenario Activo (Pantalla Completa)', 'success');
  }

  exitStageMode() {
    this.isStageMode = false;
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    events.emit('ui:stageMode', false);
    this.render();
    this.syncContextualState();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    const alphatabEl = document.getElementById('alphatab');
    const lyricsContent = this.container.querySelector('#lyricsBodyContent');
    const lyricsToolbar = this.container.querySelector('.lyrics-essential-toolbar');
    
    if (this.viewMode === 'score') {
      if (alphatabEl) alphatabEl.style.display = 'block';
      if (lyricsContent) lyricsContent.style.display = 'none';
      if (lyricsToolbar) lyricsToolbar.style.display = 'none';
      // Forzar a AlphaTab a recalcular su tamaño al volverse visible
      window.dispatchEvent(new Event('resize'));
    } else {
      if (alphatabEl) alphatabEl.style.display = 'none';
      if (lyricsContent) lyricsContent.style.display = 'block';
      if (lyricsToolbar) lyricsToolbar.style.display = 'flex';
    }
    this.render();
  }

  setFontSizeScale(delta) {
    this.fontSizeScale = Math.max(80, Math.min(180, this.fontSizeScale + delta));
    localStorage.setItem('lyrics_font_scale', this.fontSizeScale);
    this.updateFontSizeInDOM();
    const badge = this.container?.querySelector('#lblFontScalePercent');
    if (badge) badge.textContent = `${this.fontSizeScale}%`;
  }

  updateFontSizeInDOM() {
    const container = this.container?.querySelector('.lyrics-chords-container');
    const scale = this.fontSizeScale / 100;
    if (container) {
      container.style.setProperty('--lyrics-font-scale', String(scale));
      container.style.setProperty('--lyrics-font-size', `${1.12 * scale}rem`);
    }
  }

  handleLiveChordDetected(detectedNote) {
    if (!this.isLiveListening || !detectedNote) return;
    const chordBadges = this.container?.querySelectorAll('.chord-badge');
    if (!chordBadges || chordBadges.length === 0) return;
    const currentBadge = chordBadges[0];
    if (currentBadge) {
      currentBadge.classList.add('chord-detected-active');
      setTimeout(() => currentBadge.classList.remove('chord-detected-active'), 1000);
    }
  }

  render() {
    if (!this.container) return;

    const title = this.currentSong?.title || 'Selecciona una canción';
    const artist = this.currentSong?.artist || 'Tabs & Chords PRO';
    const tuning = this.currentSong?.tuning || 'Standard E';
    const rawLyrics = this.currentSong?.lyricsChords || '';
    this.visualTheme = localStorage.getItem('app_visual_theme') || 'oled';

    const uniqueChords = ChordProParser.extractUniqueChords(rawLyrics, this.transposeSemitones, this.capoFret);
    const parsedHtml = ChordProParser.parseToHtml(rawLyrics, {
      semitones: this.transposeSemitones,
      capoFret: this.capoFret,
      notation: this.notationSystem,
      hideChords: this.hideChordsMode
    });

    this.container.innerHTML = `
      <div class="lyrics-chords-container theme-${this.visualTheme} ${this.isStageMode ? 'stage-mode-view' : ''}" role="region" aria-label="Letra y acordes de ${title}">
        
        <!-- BARRA FLOTANTE MODO ATRIL -->
        ${this.isStageMode ? `
          <div class="stage-floating-hud" role="toolbar" aria-label="Controles de atril de escenario">
            <button class="btn-stage-exit" id="btnExitStageMode" aria-label="Salir de Modo Atril">
              <span>Salir de Atril</span>
            </button>
            <button class="btn-stage-record ${this.audioRecorder.isRecording ? 'recording-active' : ''}" id="btnStageRecord">
              <span class="record-red-dot"></span>
              <span>${this.audioRecorder.isRecording ? 'Detener Toma' : 'Grabar Ensayo'}</span>
              ${this.audioRecorder.isRecording ? `<span class="lbl-recording-time font-mono">${this.audioRecorder.formatTime(this.audioRecorder.recordingDuration)}</span>` : ''}
            </button>
            <button class="btn-stage-autoscroll ${this.autoScroller.isRunning ? 'active' : ''}" id="btnStageToggleAutoScroll">
              ${this.autoScroller.isRunning ? 'Pausa' : 'Auto-Scroll'} (<span id="lblStageAutoScrollPercent">${this.autoScroller.speedPercent}%</span>)
            </button>
            <div class="stage-zoom-stepper">
              <button class="btn-stage-zoom-btn" id="btnStageFontDecr">-</button>
              <span class="stage-hud-font-badge">${this.fontSizeScale}%</span>
              <button class="btn-stage-zoom-btn" id="btnStageFontIncr">+</button>
            </div>
          </div>
        ` : ''}

        <!-- Cabecera Principal -->
        <div class="lyrics-header-main">
          <div class="lyrics-title-nav-row">
            <button class="btn-back-to-explore" id="btnBackToExplore" aria-label="Volver a explorar">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
              <span>Volver</span>
            </button>
            <div class="lyrics-title-group">
              <h1 class="lyrics-song-title">${title}</h1>
              <span class="lyrics-song-artist">— ${artist} (${tuning}${this.capoFret > 0 ? ` · Capo ${this.capoFret}` : ''})</span>
            </div>
            
            <div class="view-mode-toggle" style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
              <button id="btnPrintPDF" style="padding: 6px 12px; border: 1px solid var(--border-subtle); background: var(--bg-surface-raised); color: var(--text-primary); border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;" aria-label="Imprimir a PDF">
                🖨️ PDF
              </button>
              <div style="display: flex; background: var(--bg-surface-solid); border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden;">
              <button id="btnModeLyrics" style="padding: 6px 12px; border: none; background: ${this.viewMode === 'lyrics' ? 'var(--accent-primary)' : 'transparent'}; color: ${this.viewMode === 'lyrics' ? '#fff' : 'var(--text-primary)'}; cursor: pointer; font-weight: 600; font-size: 0.85rem;">Letra & Acordes</button>
              ${this.song.data ? `<button id="btnModeScore" style="padding: 6px 12px; border: none; background: ${this.viewMode === 'score' ? 'var(--accent-primary)' : 'transparent'}; color: ${this.viewMode === 'score' ? '#fff' : 'var(--text-primary)'}; cursor: pointer; font-weight: 600; font-size: 0.85rem;">Partitura Musical</button>` : ''}
            </div>
          </div>

          <!-- Barra de Controles Esenciales -->
          <div class="lyrics-essential-toolbar" style="display: ${this.viewMode === 'score' ? 'none' : 'flex'};">
            <!-- Selector Instrumento -->
            <div class="dropdown-container">
              <button class="btn-instrument-select" id="btnInstrumentSelect" aria-label="Elige instrumento">
                <span id="lblCurrentInstrument">${ChordDiagramRenderer.getInstrumentDisplayName(this.currentInstrument)}</span>
                <span class="dropdown-caret">▾</span>
              </button>
              <div class="instrument-dropdown-popup" id="instrumentDropdownPopup" style="display: ${this.isInstrumentMenuOpen ? 'flex' : 'none'};">
                <button class="inst-option-card ${this.currentInstrument === 'guitar' ? 'active' : ''}" data-inst="guitar"><strong>Guitarra</strong></button>
                <button class="inst-option-card ${this.currentInstrument === 'piano' ? 'active' : ''}" data-inst="piano"><strong>Piano</strong></button>
                <button class="inst-option-card ${this.currentInstrument === 'ukulele' ? 'active' : ''}" data-inst="ukulele"><strong>Ukelele</strong></button>
              </div>
            </div>

            <!-- Zoom de Fuente ([A-] 100% [A+]) -->
            <div class="font-scaler-group" role="group" aria-label="Tamaño de letra">
              <button class="btn-font-scale-step" id="btnFontDecr" aria-label="Reducir letra">A-</button>
              <span class="font-scale-percent-badge" id="lblFontScalePercent">${this.fontSizeScale}%</span>
              <button class="btn-font-scale-step" id="btnFontIncr" aria-label="Aumentar letra">A+</button>
            </div>

            <!-- Desplegable Opciones -->
            <div class="dropdown-container">
              <button class="btn-more-options" id="btnMoreOptions" aria-label="Más opciones">
                <span>Opciones</span>
                <span class="dropdown-caret">▾</span>
              </button>
              <div class="more-options-dropdown-popup" id="moreOptionsDropdownPopup" style="display: ${this.isOptionsMenuOpen ? 'flex' : 'none'};">
                <button class="btn-menu-action btn-menu-stage-highlight" id="btnEnterStageMode"><strong>Modo Atril (Pantalla Completa)</strong></button>
                <button class="btn-menu-action" id="btnPrintSong"><span>Imprimir / PDF</span></button>
                
                <!-- Escucha Activa por Micrófono -->
                <button class="btn-menu-action ${this.isLiveListening ? 'active' : ''}" id="btnToggleLiveListen">
                  <span>${this.isLiveListening ? 'Pausar Escucha Activa' : 'Activar Escucha Activa (Micrófono)'}</span>
                </button>

                <!-- Afinador Rápido con Clavijeros -->
                <button class="btn-menu-action" id="btnOpenTunerQuick">
                  <span>Abrir Afinador Cromático</span>
                </button>

                <div class="options-menu-row">
                  <span class="options-menu-label">Cejilla:</span>
                  <select id="selSongCapo" class="sel-options-input">
                    ${[0, 1, 2, 3, 4, 5, 6, 7].map(f => `<option value="${f}" ${this.capoFret === f ? 'selected' : ''}>${f === 0 ? 'Off' : `Traste ${f}`}</option>`).join('')}
                  </select>
                </div>
                <div class="options-menu-row">
                  <span class="options-menu-label">Cifrado:</span>
                  <select id="selSongNotation" class="sel-options-input">
                    <option value="anglo" ${this.notationSystem === 'anglo' ? 'selected' : ''}>C, D, E (Anglo)</option>
                    <option value="latin" ${this.notationSystem === 'latin' ? 'selected' : ''}>Do, Re, Mi (Latino)</option>
                  </select>
                </div>
                <button class="btn-menu-action ${this.isSimplified ? 'active' : ''}" id="btnToggleSimplified"><span>Modo Fácil (Simplificar)</span></button>
                <button class="btn-menu-action ${this.hideChordsMode ? 'active' : ''}" id="btnToggleHideChords"><span>Modo Solo Letra</span></button>
                <div class="options-viewmode-row">
                  <button class="btn-viewmode-choice ${this.viewMode === 'lyrics' ? 'active' : ''}" id="btnModeLyrics">Letra & Acordes</button>
                  <button class="btn-viewmode-choice ${this.viewMode === 'tab' ? 'active' : ''}" id="btnModeTab">Tablatura</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TOMA RECIENTE -->
        ${this.audioRecorder.recordedUrl && !this.audioRecorder.isRecording ? `
          <div class="recording-playback-card">
            <div class="rec-card-meta">
              <strong>🎙️ Toma Grabada</strong>
              <audio controls src="${this.audioRecorder.recordedUrl}" class="rec-audio-element"></audio>
            </div>
            <div class="rec-card-actions">
              <button class="btn-rec-download" id="btnDownloadRecording">Descargar Audio</button>
              <button class="btn-rec-dismiss" id="btnDismissRecording">Descartar</button>
            </div>
          </div>
        ` : ''}

        <!-- GALERÍA DE DIAGRAMAS SVG -->
        ${ChordDiagramRenderer.renderGallery(uniqueChords, {
          instrument: this.currentInstrument,
          notation: this.notationSystem,
          tempo: this.currentSong?.tempo || 120,
          timeSignature: this.currentSong?.timeSignature || '4/4'
        })}

        <!-- CUERPO DE LETRA -->
        <div id="lyricsBodyContent" style="display: ${this.viewMode === 'score' ? 'none' : 'block'};">
          ${parsedHtml}
        </div>
      </div>
    `;

    this.updateFontSizeInDOM();
    this.bindEvents();
  }

  bindEvents() {
    
    this.container.querySelector('#btnPrintPDF')?.addEventListener('click', () => {
      window.print();
    });

    this.container.querySelector('#btnBackToExplore')?.addEventListener('click', () => {
      events.emit('ui:switchTab', 'explore');
    });

    this.container.querySelector('#btnModeLyrics')?.addEventListener('click', () => this.setViewMode('lyrics'));
    this.container.querySelector('#btnModeScore')?.addEventListener('click', () => this.setViewMode('score'));

    this.container.querySelector('#btnQuickRecordAction')?.addEventListener('click', () => this.toggleRecording());
    this.container.querySelector('#btnStageRecord')?.addEventListener('click', () => this.toggleRecording());
    this.container.querySelector('#btnDownloadRecording')?.addEventListener('click', () => this.audioRecorder.download(this.currentSong?.title));
    this.container.querySelector('#btnDismissRecording')?.addEventListener('click', () => {
      this.audioRecorder.dismiss();
      this.render();
    });

    this.container.querySelector('#btnToggleAutoScroll')?.addEventListener('click', () => this.toggleAutoScroll());
    this.container.querySelector('#btnStageToggleAutoScroll')?.addEventListener('click', () => this.toggleAutoScroll());
    
    this.container.querySelector('#btnAutoScrollDecr')?.addEventListener('click', () => {
      this.autoScroller.stepSpeed(-1);
      const badge = this.container?.querySelector('#lblAutoScrollPercent');
      const slider = this.container?.querySelector('#rngAutoScrollSpeed');
      if (badge) badge.textContent = `${this.autoScroller.speedPercent}%`;
      if (slider) slider.value = this.autoScroller.speedPercent;
    });

    this.container.querySelector('#btnAutoScrollIncr')?.addEventListener('click', () => {
      this.autoScroller.stepSpeed(1);
      const badge = this.container?.querySelector('#lblAutoScrollPercent');
      const slider = this.container?.querySelector('#rngAutoScrollSpeed');
      if (badge) badge.textContent = `${this.autoScroller.speedPercent}%`;
      if (slider) slider.value = this.autoScroller.speedPercent;
    });

    this.container.querySelector('#rngAutoScrollSpeed')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.autoScroller.setSpeed(val);
      const badge = this.container?.querySelector('#lblAutoScrollPercent');
      if (badge) badge.textContent = `${val}%`;
    });

    
    this.container.querySelector('#btnAsSlower')?.addEventListener('click', () => { this.autoScroller.stepSpeed(-5); document.getElementById('lblAsSpeed').textContent = this.autoScroller.speedPercent; });
    this.container.querySelector('#btnAsFaster')?.addEventListener('click', () => { this.autoScroller.stepSpeed(5); document.getElementById('lblAsSpeed').textContent = this.autoScroller.speedPercent; });
 
      this.container.querySelector('#btnAsSlower')?.addEventListener('click', () => { this.autoScroller.stepSpeed(-5); document.getElementById('lblAsSpeed').textContent = this.autoScroller.speedPercent; });
      this.container.querySelector('#btnAsFaster')?.addEventListener('click', () => { this.autoScroller.stepSpeed(5); document.getElementById('lblAsSpeed').textContent = this.autoScroller.speedPercent; });
  
    this.container.querySelector('#btnTransposeMinus')?.addEventListener('click', () => this.setTranspose(this.transposeSemitones - 1));
    this.container.querySelector('#btnTransposePlus')?.addEventListener('click', () => this.setTranspose(this.transposeSemitones + 1));
    this.container.querySelector('#btnTransposeReset')?.addEventListener('click', () => this.setTranspose(0));

    this.container.querySelector('#btnFontDecr')?.addEventListener('click', () => this.setFontSizeScale(-10));
    this.container.querySelector('#btnFontIncr')?.addEventListener('click', () => this.setFontSizeScale(10));
    this.container.querySelector('#btnStageFontDecr')?.addEventListener('click', () => this.setFontSizeScale(-10));
    this.container.querySelector('#btnStageFontIncr')?.addEventListener('click', () => this.setFontSizeScale(10));

    this.container.querySelector('#btnInstrumentSelect')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isInstrumentMenuOpen = !this.isInstrumentMenuOpen;
      this.isOptionsMenuOpen = false;
      this.render();
    });

    this.container.querySelectorAll('.inst-option-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setInstrument(btn.dataset.inst);
      });
    });

    this.container.querySelector('#btnMoreOptions')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isOptionsMenuOpen = !this.isOptionsMenuOpen;
      this.isInstrumentMenuOpen = false;
      this.render();
    });

    this.container.querySelector('#btnEnterStageMode')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.enterStageMode();
    });
    this.container.querySelector('#btnExitStageMode')?.addEventListener('click', () => this.exitStageMode());
    
    this.container.querySelector('#btnToggleLiveListen')?.addEventListener('click', () => {
      this.isLiveListening = !this.isLiveListening;
      toast.show(this.isLiveListening ? '🎤 Escucha activa iniciada' : 'Escucha pausada', 'info');
      this.isOptionsMenuOpen = false;
      this.render();
    });

    this.container.querySelector('#btnOpenTunerQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('tuner:open');
    });

    this.container.querySelector('#btnPrintSong')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      setTimeout(() => window.print(), 100);
    });

    this.container.querySelector('#selSongCapo')?.addEventListener('change', (e) => {
      this.setCapo(parseInt(e.target.value, 10));
    });
    this.container.querySelector('#selSongNotation')?.addEventListener('change', (e) => {
      this.setNotationSystem(e.target.value);
    });

    // Clic en .chord-badge -> Abrir Popover Modal interactivo con notas y selector de instrumentos
    this.container.querySelectorAll('.chord-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const chordName = badge.dataset.chord || badge.dataset.originalChord;
        if (chordName) {
          this.chordPopover.show(chordName, badge, this.currentInstrument, this.notationSystem);
        }
      });
    });

    // Audición directa en la galería visual superior
    this.container.querySelectorAll('.song-chord-visual-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const chordName = card.dataset.originalChord || card.dataset.chord;
        if (chordName) {
          chordEngine.auditionChord(chordName, this.currentInstrument);
          const displayName = ChordProParser.formatChordDisplay(chordName, this.notationSystem);
          toast.show(`Sonando ${displayName}`, 'info', 600);
        }
      });
    });
  }
}

export default LyricsChordsView;
