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
import { vocalCoachEngine } from '../audio/VocalCoachEngine.js';
import { PitchLaneCanvas } from './lyrics/PitchLaneCanvas.js';
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
    this.performanceMode = localStorage.getItem('app_performance_mode') || 'play';
    this.isSimplified = localStorage.getItem('app_simplified_chords') === 'true';
    this.hideChordsMode = false;
    this.isStageMode = false;
    this.isInstrumentMenuOpen = false;
    this.isOptionsMenuOpen = false;
    this.isLiveListening = false;
    this.wakeLockSentinel = null;
    this.pitchLane = null;

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

  /**
   * Inicializa la escucha de eventos globales (EventBus).
   * Mantiene el acoplamiento débil (SOLID: Inversión de Dependencias).
   * @private
   */
  initEvents() {
    /**
     * Carga una canción y extrae su letra/acordes si es necesario.
     * @param {Object} song - Modelo de canción activo.
     */
    const handleSongLoad = async (song) => {
      if (!song) return;
      
      const isSameSong = this.currentSong && 
        ((this.currentSong.id && song.id && String(this.currentSong.id) === String(song.id)) ||
         (this.currentSong.title && song.title && this.currentSong.title === song.title)) &&
        this.currentSong.lyricsChords;

      if (isSameSong) {
        this.render();
        return;
      }

      this.currentSong = song;
      this.transposeSemitones = 0;
      this.capoFret = 0;
      this.visualTheme = localStorage.getItem('app_visual_theme') || 'paper';
      this.audioRecorder.dismiss();

      try {
        if (this.currentSong && (!this.currentSong.lyricsChords || this.currentSong.lyricsChords.trim().length === 0)) {
          this.currentSong.lyricsChords = await onlineSongProvider.fetchLyricsAndChords(this.currentSong.title, this.currentSong.artist);
        }
      } catch (e) {
        console.warn('[LyricsChordsView] Error obteniendo acordes online:', e);
        import('./Toast.js').then(({ toast }) => toast.show('Error al descargar acordes', 'error', 3000)).catch(console.error);
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
    this.registerUnsub(events.on('song:loaded', handleSongLoad));

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
      if (pitch && pitch.frequency > 0) {
        const noteEl = this.container?.querySelector('#singerNoteBig');
        const freqEl = this.container?.querySelector('#singerFreqBadge');
        const labelEl = this.container?.querySelector('#singerPitchNoteLabel');
        const meterNeedle = this.container?.querySelector('#singerMeterNeedle');

        if (noteEl) noteEl.textContent = pitch.note || '—';
        if (freqEl) freqEl.textContent = `${Math.round(pitch.frequency)} Hz`;
        if (labelEl) {
          const cents = pitch.cents || 0;
          const statusText = Math.abs(cents) <= 15 ? '🎯 ¡Afinación Perfecta!' : cents < 0 ? '♭ Un poco bajo (sube la voz)' : '♯ Un poco alto (baja la voz)';
          labelEl.textContent = `🎤 Cantando: ${pitch.note} (${statusText})`;
        }
        if (meterNeedle) {
          const clampedCents = Math.max(-50, Math.min(50, pitch.cents || 0));
          const percent = 50 + (clampedCents / 50) * 45;
          meterNeedle.style.left = `${percent}%`;
        }
      }
      if (this.isLiveListening && pitch) {
        this.handleLiveChordDetected(pitch.note);
      }
    }));

    // Suscripción a eventos de audio para Smart Pause
    this.registerUnsub(events.on('vocalCoach:silence', () => {
      if (this.smartPauseEnabled && this.performanceMode === 'sing' && this.pitchLane?.isPlaying) {
        this.pitchLane?.pause();
        const btn = this.container?.querySelector('#btnSingPlayPause');
        if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        import('./Toast.js').then(({ toast }) => toast.show('Pausa Inteligente: Canción pausada por silencio', 'info', 1500));
      }
    }));

    this.registerUnsub(events.on('vocalCoach:pitch', (pitchData) => {
      if (this.smartPauseEnabled && this.performanceMode === 'sing' && !this.pitchLane?.isPlaying) {
        this.pitchLane?.play();
        const btn = this.container?.querySelector('#btnSingPlayPause');
        if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
      }
      // Actualizar medidor de volumen (RMS) en la UI
      const bar = this.container?.querySelector('#singMicMeterBar');
      if (bar) {
        const rms = pitchData.rms || 0;
        const percent = Math.min(100, (rms / 0.1) * 100);
        bar.style.width = `${percent}%`;
        bar.style.background = percent > 80 ? '#ef4444' : '#22c55e';
      }
    }));

    // Vocal Coach Engine: actualizar colores y escala de notas en modo cantante
    this.registerUnsub(events.on('vocalCoach:pitch', (pitch) => {
      if (this.performanceMode !== 'sing' || !pitch) return;
      this._updateSingerRibbonColor(pitch);
    }));

    this.registerUnsub(events.on('vocalCoach:silence', () => {
      const ribbon = this.container?.querySelector('#singerVocalRibbon');
      if (ribbon) {
        ribbon.classList.remove('in-tune', 'near-tune', 'out-tune');
      }
    }));
  }

  /**
   * Actualiza el color de la cinta de cantante según la afinación detectada.
   * Verde = perfecto (≤15 cents), Naranja = casi (16-35), Rojo = desafinado (>35)
   */
  _updateSingerRibbonColor(pitch) {
    const ribbon = this.container?.querySelector('#singerVocalRibbon');
    const noteEl = this.container?.querySelector('#singerNoteBig');
    const labelEl = this.container?.querySelector('#singerPitchNoteLabel');
    const freqEl = this.container?.querySelector('#singerFreqBadge');
    const scaleCursor = this.container?.querySelector('#singerScaleCursor');

    const absCents = Math.abs(pitch.centsOffset ?? pitch.cents ?? 0);
    let tuneClass = 'out-tune';
    let statusEmoji = '🔴';
    let statusText = 'Desafinado';
    if (absCents <= 15) { tuneClass = 'in-tune'; statusEmoji = '🟢'; statusText = '¡Afinación Perfecta!'; }
    else if (absCents <= 35) { tuneClass = 'near-tune'; statusEmoji = '🟠'; statusText = pitch.centsOffset < 0 ? '♭ Un poco bajo' : '♯ Un poco alto'; }
    else { statusText = pitch.centsOffset < 0 ? '♭ Demasiado bajo' : '♯ Demasiado alto'; }

    if (ribbon) {
      ribbon.classList.remove('in-tune', 'near-tune', 'out-tune');
      ribbon.classList.add(tuneClass);
    }
    if (noteEl) {
      noteEl.textContent = pitch.note || '—';
      noteEl.className = `ribbon-note-big ${tuneClass}`;
    }
    if (labelEl) {
      labelEl.textContent = `🎤 Cantando: ${pitch.note}${pitch.octave ?? ''} (${statusEmoji} ${statusText})`;
    }
    if (freqEl) {
      freqEl.textContent = `${Math.round(pitch.frequency)} Hz`;
    }
    // Mover cursor en la escala vertical de notas
    if (scaleCursor && pitch.midi) {
      // Escala: C2(36) a D6(86) → mapear a 0-100% (top=agudo, bottom=grave)
      const minMidi = 36, maxMidi = 86;
      const clampedMidi = Math.max(minMidi, Math.min(maxMidi, pitch.midi));
      const pct = 100 - ((clampedMidi - minMidi) / (maxMidi - minMidi)) * 100;
      scaleCursor.style.top = `${pct}%`;
      scaleCursor.className = `singer-scale-cursor ${tuneClass}`;
    }
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
    this.visualTheme = localStorage.getItem('app_visual_theme') || 'paper';

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

        <!-- BARRA FLOTANTE MODO CANTO -->
        ${this.performanceMode === 'sing' ? `
          <div class="sing-floating-hud" style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 16px; background: rgba(20, 16, 30, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); padding: 12px 24px; border-radius: 40px; box-shadow: 0 16px 40px rgba(0,0,0,0.6); z-index: 2000;">
            <button id="btnToggleSmartPause" style="background: transparent; border: none; color: ${this.smartPauseEnabled ? '#22c55e' : '#aaa'}; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; transition: all 0.2s;" title="Pausa Inteligente (Smart Pause)">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
            </button>
            <button id="btnSingRestart" style="background: transparent; border: none; color: #aaa; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; transition: all 0.2s;">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
            </button>
            <button id="btnSingPlayPause" style="background: var(--accent-primary, #007aff); border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%; box-shadow: 0 4px 16px rgba(0, 122, 255, 0.4); transition: all 0.2s;">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <div style="display: flex; flex-direction: column; align-items: center; width: 60px;">
              <span style="font-size: 0.65rem; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; margin-bottom: 4px;">Micrófono</span>
              <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                <div id="singMicMeterBar" style="width: 0%; height: 100%; background: #22c55e; transition: width 0.1s linear;"></div>
              </div>
            </div>
          </div>
        ` : ''}

          <!-- Cabecera Principal -->
          <div class="lyrics-header-main">
            <!-- Fila 1: Volver, Título, Modo (Tocar/Cantar), Opciones -->
            <div class="lyrics-title-nav-row" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
              <button class="btn-back-to-explore" id="btnBackToExplore" aria-label="Volver a explorar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
                <span>Volver</span>
              </button>

              <div class="lyrics-title-group" style="flex: 1; min-width: 200px;">
                <h1 class="lyrics-song-title">${title}</h1>
                <span class="lyrics-song-artist">— ${artist} (${tuning}${this.capoFret > 0 ? ` · Capo ${this.capoFret}` : ''})</span>
              </div>

              <div style="display: flex; align-items: center; gap: 12px; margin-left: auto;">
                <!-- Mode Toggle (Tocar/Cantar) -->
                <div class="performance-mode-toggle" style="display: flex; background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 20px; padding: 2px;">
                  <button class="btn-mode-toggle ${this.performanceMode === 'play' ? 'active' : ''}" data-mode="play" style="padding: 6px 16px; border: none; border-radius: 18px; background: ${this.performanceMode === 'play' ? 'var(--accent-primary)' : 'transparent'}; color: ${this.performanceMode === 'play' ? '#fff' : 'var(--text-primary)'}; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;">🎸 Tocar</button>
                  <button class="btn-mode-toggle ${this.performanceMode === 'sing' ? 'active' : ''}" data-mode="sing" style="padding: 6px 16px; border: none; border-radius: 18px; background: ${this.performanceMode === 'sing' ? 'var(--accent-primary)' : 'transparent'}; color: ${this.performanceMode === 'sing' ? '#fff' : 'var(--text-primary)'}; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;">🎤 Cantar</button>
                </div>

                <button id="btnOpenToolsSheet" style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); color: var(--text-primary); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%;">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                </button>
              </div>
            </div>

            <!-- Fila 2: Herramientas Frecuentes (solo si estamos en modo tocar) -->
            ${this.performanceMode === 'play' ? `
            <div class="lyrics-quick-tools-row" style="display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 10px 14px; background: rgba(0,0,0,0.02); border-radius: 12px; border: 1px solid var(--border-subtle); overflow-x: auto; flex-wrap: nowrap;">
              
              <!-- Instrumento -->
              <div class="quick-tool-pill" style="display: flex; align-items: center; gap: 6px; background: var(--bg-surface-solid); border: 1px solid var(--border-subtle); padding: 4px 12px; border-radius: 20px; white-space: nowrap;">
                <span style="font-size: 1rem;">🎸</span>
                <select id="selInstrumentQuick" style="background: transparent; border: none; color: var(--text-primary); font-size: 0.85rem; font-weight: 700; cursor: pointer; outline: none; padding-right: 4px;">
                  <option value="guitar" ${this.currentInstrument === 'guitar' ? 'selected' : ''}>Guitarra</option>
                  <option value="piano" ${this.currentInstrument === 'piano' ? 'selected' : ''}>Piano</option>
                  <option value="ukulele" ${this.currentInstrument === 'ukulele' ? 'selected' : ''}>Ukelele</option>
                </select>
              </div>

              <!-- Cejilla -->
              <div class="quick-tool-pill" style="display: flex; align-items: center; gap: 6px; background: var(--bg-surface-solid); border: 1px solid var(--border-subtle); padding: 4px 12px; border-radius: 20px; white-space: nowrap;">
                <span style="font-size: 1rem;">🎵</span>
                <select id="selCapoQuick" style="background: transparent; border: none; color: var(--text-primary); font-size: 0.85rem; font-weight: 700; cursor: pointer; outline: none;">
                  <option value="0" ${this.capoFret === 0 ? 'selected' : ''}>Capo: Off</option>
                  <option value="1" ${this.capoFret === 1 ? 'selected' : ''}>Capo: Traste 1</option>
                  <option value="2" ${this.capoFret === 2 ? 'selected' : ''}>Capo: Traste 2</option>
                  <option value="3" ${this.capoFret === 3 ? 'selected' : ''}>Capo: Traste 3</option>
                  <option value="4" ${this.capoFret === 4 ? 'selected' : ''}>Capo: Traste 4</option>
                  <option value="5" ${this.capoFret === 5 ? 'selected' : ''}>Capo: Traste 5</option>
                </select>
              </div>

              <!-- Tamaño Letra -->
              <div class="quick-tool-pill" style="display: flex; align-items: center; gap: 6px; background: var(--bg-surface-solid); border: 1px solid var(--border-subtle); padding: 4px 12px; border-radius: 20px; white-space: nowrap; margin-left: auto;">
                <button id="btnQuickFontDecr" style="background: transparent; border: none; cursor: pointer; color: var(--text-primary); font-weight: 700; padding: 2px 6px;">A-</button>
                <span style="font-size: 0.85rem; font-weight: 700; min-width: 36px; text-align: center;">${this.fontSizeScale}%</span>
                <button id="btnQuickFontIncr" style="background: transparent; border: none; cursor: pointer; color: var(--text-primary); font-weight: 700; padding: 2px 6px;">A+</button>
              </div>
            </div>
            ` : ''}
          </div>

          <!-- BOTTOM SHEET ESTILO iOS (Herramientas avanzadas) -->
          <div id="lyricsToolsBottomSheetOverlay" style="display: ${this.isOptionsMenuOpen ? 'flex' : 'none'}; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); z-index: 9999; justify-content: center; align-items: flex-end; animation: fadeIn 0.2s;">
            <div class="bottom-sheet-content" style="background: var(--bg-surface-solid, #1c1c1e); width: 100%; max-width: 600px; max-height: 80vh; border-radius: 24px 24px 0 0; padding: 20px 24px 32px; overflow-y: auto; box-shadow: 0 -4px 32px rgba(0,0,0,0.5); animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(255,255,255,0.1); border-bottom: none;">
              
              <div style="width: 40px; height: 5px; background: rgba(255,255,255,0.2); border-radius: 3px; margin: 0 auto 16px;"></div>
              
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary); font-weight: 800;">Más opciones</h3>
                <button id="btnCloseToolsSheet" style="background: rgba(255,255,255,0.1); border: none; color: var(--text-primary); border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; justify-content: center; align-items: center; font-size: 1.2rem; line-height: 1;">&times;</button>
              </div>

              <!-- Vista (Letra / Partitura) — solo si hay partitura -->
              ${this.currentSong?.data ? `
              <div style="display: flex; background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 12px; overflow: hidden; margin-bottom: 16px;">
                <button id="btnModeLyrics" style="flex: 1; padding: 10px 12px; border: none; background: ${this.viewMode === 'lyrics' ? 'var(--accent-primary)' : 'transparent'}; color: ${this.viewMode === 'lyrics' ? '#fff' : 'var(--text-primary)'}; cursor: pointer; font-weight: 700; font-size: 0.9rem; transition: background 0.2s;">🎵 Letra & Acordes</button>
                <button id="btnModeScore" style="flex: 1; padding: 10px 12px; border: none; background: ${this.viewMode === 'score' ? 'var(--accent-primary)' : 'transparent'}; color: ${this.viewMode === 'score' ? '#fff' : 'var(--text-primary)'}; cursor: pointer; font-weight: 700; font-size: 0.9rem; transition: background 0.2s;">🎼 Partitura</button>
              </div>
              ` : ''}

              <!-- Acciones rápidas en fila -->
              <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px;">
                <button id="btnEnterStageMode" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🎭 Modo Atril (Pantalla Completa)</button>
                <button id="btnPrintPDF" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🖨️ Exportar PDF / Imprimir</button>
                <button id="btnOpenTunerQuick" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🎼 Afinador Cromático</button>
              </div>

              <!-- Ajustes de notación y acordes -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
                <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px;">
                  <span style="display: block; font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 800; margin-bottom: 6px;">Cifrado</span>
                  <select id="selSongNotation" style="background: transparent; border: none; color: var(--text-primary); font-size: 0.9rem; font-weight: 600; cursor: pointer; outline: none; width: 100%;">
                    <option value="anglo" ${this.notationSystem === 'anglo' ? 'selected' : ''}>C, D, E (Anglo)</option>
                    <option value="latin" ${this.notationSystem === 'latin' ? 'selected' : ''}>Do, Re, Mi (Latino)</option>
                  </select>
                </div>
                <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px;">
                  <span style="display: block; font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 800; margin-bottom: 6px;">Transponer</span>
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                    <button id="btnTransposeDown" style="background: rgba(255,255,255,0.1); border: none; color: var(--text-primary); width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 1rem;">↓</button>
                    <span style="font-weight: 700; font-size: 0.9rem;">${this.transposeSemitones > 0 ? '+' : ''}${this.transposeSemitones} st</span>
                    <button id="btnTransposeUp" style="background: rgba(255,255,255,0.1); border: none; color: var(--text-primary); width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 1rem;">↑</button>
                  </div>
                </div>
              </div>
              
              <div style="display: flex; gap: 8px;">
                <button class="btn-menu-action ${this.isSimplified ? 'active' : ''}" id="btnToggleSimplified" style="flex:1; justify-content: center;">Simplificar acordes</button>
                <button class="btn-menu-action ${this.hideChordsMode ? 'active' : ''}" id="btnToggleHideChords" style="flex:1; justify-content: center;">Ocultar acordes</button>
              </div>

            </div>
          </div>
          
          <style>
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(100%); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }
          </style>


          <!-- Singer Live Pitch Ribbon Overlay (Modo Cantar) -->
          <!-- Singer Live Pitch Ribbon Overlay (Modo Cantar) -->
          ${this.performanceMode === 'sing' ? `
            <div class="singer-pitch-lane-wrapper" style="width: 100%; height: 380px; position: relative; border-radius: 20px; overflow: hidden; margin-top: 12px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 12px 32px rgba(0,0,0,0.3);">
              <canvas id="pitchLaneCanvas" style="display:block; width:100%; height:100%;"></canvas>
            </div>

            <div class="singer-vocal-ribbon" id="singerVocalRibbon" style="margin-top: 12px;">
              <div class="ribbon-left">
                <span class="ribbon-live-dot"></span>
                <span class="ribbon-status-label" id="singerPitchNoteLabel">🎤 Cantando en vivo...</span>
              </div>
              <div class="ribbon-center">
                <span class="ribbon-note-big" id="singerNoteBig">—</span>
                <span class="ribbon-freq-badge font-mono" id="singerFreqBadge">0 Hz</span>
              </div>
              <div class="ribbon-right">
                <button class="btn-ribbon-range-finder" id="btnOpenRangeFinder" title="Encuentra tu rango vocal">
                  🎙️ Rango Vocal
                </button>
              </div>
            </div>

            <!-- Banner de Permiso de Micrófono si fue Denegado -->
            <div class="mic-permission-warning-banner" id="micPermissionWarning" style="display: none;">
              <div class="mic-warning-content">
                <span class="mic-warning-icon">⚠️</span>
                <div class="mic-warning-info">
                  <strong>Permiso de Micrófono Requerido</strong>
                  <span>La app necesita acceso al micrófono para detectar la afinación de tu voz mientras cantas.</span>
                </div>
              </div>
              <button class="btn-request-mic-permission" id="btnRetryMicPermission">
                🎤 Otorgar Permiso al Micrófono
              </button>
            </div>
          ` : ''}

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
        ${this.performanceMode !== 'sing' ? ChordDiagramRenderer.renderGallery(uniqueChords, {
          instrument: this.currentInstrument,
          notation: this.notationSystem,
          tempo: this.currentSong?.tempo || 120,
          timeSignature: this.currentSong?.timeSignature || '4/4'
        }) : ''}

          <!-- CUERPO DE LETRA (Oculto en modo cantar) -->
        <div id="lyricsBodyContent" style="display: ${this.viewMode === 'score' || this.performanceMode === 'sing' ? 'none' : 'block'};">
          ${this.currentSong?.youtubeVideoId ? `
            <div class="youtube-pip-container" style="margin-bottom: 24px; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.4); max-width: 480px;">
              <div class="youtube-ai-banner" style="background: linear-gradient(90deg, #ff0050, #7c3aed); color: #fff; padding: 6px 12px; font-size: 0.75rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: space-between;">
                <span>🎵 Acordes por IA (Sincronizados)</span>
                <span style="font-size: 0.65rem; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 8px;">AUTO-SCROLL ON</span>
              </div>
              <iframe width="100%" height="270" src="https://www.youtube-nocookie.com/embed/${this.currentSong.youtubeVideoId}?autoplay=0&rel=0&modestbranding=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="display: block;"></iframe>
            </div>
          ` : ''}
          ${parsedHtml}
        </div>
      </div>
    `;

    this.updateFontSizeInDOM();
    this.bindEvents();

    // Sincronizar estado visual (PitchLane) SIEMPRE después del render
    const globalBottomNav = document.getElementById('bottom-nav-container');

    if (this.performanceMode === 'sing') {
      if (globalBottomNav) globalBottomNav.style.display = 'none';

      const canvasEl = this.container.querySelector('#pitchLaneCanvas');
      if (canvasEl) {
        if (this.pitchLane) {
          this.pitchLane.stop();
        }
        import('./lyrics/PitchLaneCanvas.js').then(({ PitchLaneCanvas }) => {
          this.pitchLane = new PitchLaneCanvas(canvasEl);
          if (this.currentSong?.lyricsChords) {
            this.pitchLane.setTargetLyrics(this.currentSong.lyricsChords);
          }
          this.pitchLane.start();
          if (this.autoScroller && this.autoScroller.isRunning) {
            this.pitchLane.play();
          }
        });
      }
    } else {
      if (globalBottomNav) globalBottomNav.style.display = 'block';

      if (this.pitchLane) {
        this.pitchLane.stop();
        this.pitchLane = null;
      }
    }
  }

  bindEvents() {
    
    this.container.querySelector('#btnOpenToolsSheet')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = true;
      this.render();
    });

    this.container.querySelector('#btnCloseToolsSheet')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
    });

    // Close when clicking the overlay background
    this.container.querySelector('#lyricsToolsBottomSheetOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'lyricsToolsBottomSheetOverlay') {
        this.isOptionsMenuOpen = false;
        this.render();
      }
    });

    this.container.querySelector('#selInstrumentSheet')?.addEventListener('change', (e) => {
      this.setInstrument(e.target.value);
    });

    this.container.querySelector('#btnPrintPDF')?.addEventListener('click', () => {
      window.print();
    });

    this.container.querySelector('#btnBackToExplore')?.addEventListener('click', () => {
      events.emit('ui:switchTab', 'explore');
    });

    this.container.querySelector('#btnGuiderPlay')?.addEventListener('click', () => {
      this.performanceMode = 'play';
      localStorage.setItem('app_performance_mode', 'play');
      this.fontSizeScale = 100;
      localStorage.setItem('lyrics_font_scale', 100);
      pitchDetector.stop();
      vocalCoachEngine.stop();
      this.render();
      toast.show('🎸 Modo Instrumento: Acordes, tablatura y acompañamiento listos', 'info', 1500);
    });

    this.container.querySelector('#btnGuiderSing')?.addEventListener('click', async () => {
      this.performanceMode = 'sing';
      localStorage.setItem('app_performance_mode', 'sing');
      this.fontSizeScale = 135;
      localStorage.setItem('lyrics_font_scale', 135);
      this.render();

      // Arrancar motores de audio (PitchLaneCanvas ya ha sido arrancado por render())
      const [pitchOk] = await Promise.allSettled([
        pitchDetector.start(),
        vocalCoachEngine.start(),
      ]);
      import('./Toast.js').then(({ toast }) => {
        if (pitchOk?.status !== 'fulfilled' || !pitchOk.value) {
          const warningEl = this.container?.querySelector('#micPermissionWarning');
          if (warningEl) warningEl.style.display = 'flex';
          toast.show('⚠️ Permiso de micrófono requerido para afinación vocal en tiempo real', 'warning', 3000);
        } else {
          toast.show('🎤 Modo Guía Cantante: Micrófono activo. ¡Canta para afinar en directo!', 'success', 2500);
        }
      });
    });

    this.container.querySelector('#btnOpenRangeFinder')?.addEventListener('click', () => {
      import('./lyrics/VocalRangeFinder.js').then(({ VocalRangeFinder }) => {
        VocalRangeFinder.open({ vocalCoachEngine });
      }).catch(() => toast.show('⚠️ No se pudo abrir el analizador de rango vocal', 'warning'));
    });

    this.container.querySelector('#btnModeLyrics')?.addEventListener('click', () => this.setViewMode('lyrics'));
    this.container.querySelector('#btnModeScore')?.addEventListener('click', () => this.setViewMode('score'));

    // --- Nueva barra de herramientas del header ---
    this.container.querySelectorAll('.btn-mode-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const mode = btn.dataset.mode;
        if (mode === 'play') {
          this.performanceMode = 'play';
          localStorage.setItem('app_performance_mode', 'play');
          this.fontSizeScale = 100;
          localStorage.setItem('lyrics_font_scale', 100);
          pitchDetector.stop();
          vocalCoachEngine.stop();
          this.render();
          toast.show('🎸 Modo Tocar: Acordes y tablatura listos', 'info', 1500);
        } else if (mode === 'sing') {
          this.performanceMode = 'sing';
          localStorage.setItem('app_performance_mode', 'sing');
          this.fontSizeScale = 135;
          localStorage.setItem('lyrics_font_scale', 135);
          this.render();
          const [pitchOk] = await Promise.allSettled([pitchDetector.start(), vocalCoachEngine.start()]);
          if (pitchOk?.status !== 'fulfilled' || !pitchOk.value) {
            const warningEl = this.container?.querySelector('#micPermissionWarning');
            if (warningEl) warningEl.style.display = 'flex';
            toast.show('⚠️ Permiso de micrófono requerido para afinación vocal', 'warning', 3000);
          } else {
            toast.show('🎤 Modo Cantar: Micrófono activo. ¡Canta en directo!', 'success', 2500);
          }
        }
      });
    });

    this.container.querySelector('#selInstrumentQuick')?.addEventListener('change', (e) => {
      this.setInstrument(e.target.value);
    });

    this.container.querySelector('#selCapoQuick')?.addEventListener('change', (e) => {
      this.setCapo(Number(e.target.value));
    });

    this.container.querySelector('#btnQuickFontDecr')?.addEventListener('click', () => {
      this.setFontSizeScale(-10);
    });
    this.container.querySelector('#btnQuickFontIncr')?.addEventListener('click', () => {
      this.setFontSizeScale(10);
    });

    this.container.querySelector('#btnQuickRecordAction')?.addEventListener('click', () => this.toggleRecording());
    this.container.querySelector('#btnStageRecord')?.addEventListener('click', () => this.toggleRecording());
    this.container.querySelector('#btnDownloadRecording')?.addEventListener('click', () => this.audioRecorder.download(this.currentSong?.title));
    this.container.querySelector('#btnDismissRecording')?.addEventListener('click', () => {
      this.audioRecorder.dismiss();
      this.render();
    });

    // --- Canto: Controles Flotantes y Smart Pause ---
    this.container.querySelector('#btnSingPlayPause')?.addEventListener('click', () => {
      if (vocalCoachEngine.audioContext && vocalCoachEngine.audioContext.state === 'suspended') {
        vocalCoachEngine.audioContext.resume();
      }
      if (this.pitchLane) {
        if (this.pitchLane.isPlaying) this.pitchLane.pause();
        else this.pitchLane.play();
      }
      const isRunning = this.pitchLane ? this.pitchLane.isPlaying : false;
      const btn = this.container.querySelector('#btnSingPlayPause');
      if (btn) btn.innerHTML = isRunning 
        ? '<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>' // Pause
        : '<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'; // Play
    });

    this.container.querySelector('#btnSingRestart')?.addEventListener('click', () => {
      if (this.pitchLane) {
        this.pitchLane.pause();
        this.pitchLane.seek(0);
      }
      const btn = this.container.querySelector('#btnSingPlayPause');
      if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'; // Play
    });

    this.container.querySelector('#btnToggleSmartPause')?.addEventListener('click', (e) => {
      this.smartPauseEnabled = !this.smartPauseEnabled;
      const btn = e.currentTarget;
      btn.style.color = this.smartPauseEnabled ? '#22c55e' : '#aaa';
      import('./Toast.js').then(({ toast }) => toast.show(this.smartPauseEnabled ? 'Pausa Inteligente Activada' : 'Pausa Inteligente Desactivada', 'info', 2000));
    });

    // --- AutoScroll: panel flotante de velocidad ---
    const speedPanel = this.container.querySelector('#autoScrollSpeedPanel');
    const speedBtn   = this.container.querySelector('#btnOpenSpeedPanel');

    // Botón principal ⚡ Scroll: activa/para el scroll y actualiza el label del botón sin re-render
    this.container.querySelector('#btnToggleAutoScroll')?.addEventListener('click', () => {
      this.autoScroller.toggle();
      const btn = this.container.querySelector('#btnToggleAutoScroll');
      const panelBtn = this.container.querySelector('#btnToggleAutoScrollPanel');
      if (btn) {
        btn.classList.toggle('active', this.autoScroller.isRunning);
        btn.querySelector('span').textContent = this.autoScroller.isRunning ? 'Parar' : 'Scroll';
      }
      if (panelBtn) panelBtn.textContent = this.autoScroller.isRunning ? '⏸ Parar' : '▶ Iniciar';
      this.syncContextualState();
    });

    // Botón "X% ▾": abre/cierra el panel de velocidad
    speedBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!speedPanel) return;
      const isOpen = speedPanel.style.display === 'flex';
      speedPanel.style.display = isOpen ? 'none' : 'flex';
    });

    // Cerrar el panel al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (speedPanel && speedPanel.style.display === 'flex') {
        if (!speedPanel.contains(e.target) && e.target !== speedBtn) {
          speedPanel.style.display = 'none';
        }
      }
    }, { once: false });

    // Botón Iniciar/Parar dentro del panel
    this.container.querySelector('#btnToggleAutoScrollPanel')?.addEventListener('click', () => {
      this.autoScroller.toggle();
      const mainBtn  = this.container.querySelector('#btnToggleAutoScroll');
      const panelBtn = this.container.querySelector('#btnToggleAutoScrollPanel');
      if (mainBtn) {
        mainBtn.classList.toggle('active', this.autoScroller.isRunning);
        mainBtn.querySelector('span').textContent = this.autoScroller.isRunning ? 'Parar' : 'Scroll';
      }
      if (panelBtn) panelBtn.textContent = this.autoScroller.isRunning ? '⏸ Parar' : '▶ Iniciar';
      this.syncContextualState();
    });

    // Botones -5 / +5 dentro del panel
    const _updateSpeedUI = () => {
      const badge  = this.container?.querySelector('#lblAutoScrollPercent');
      const slider = this.container?.querySelector('#rngAutoScrollSpeed');
      const speedBtnLabel = this.container?.querySelector('#btnOpenSpeedPanel');
      if (badge)  badge.textContent  = `${this.autoScroller.speedPercent}%`;
      if (slider) slider.value = this.autoScroller.speedPercent;
      if (speedBtnLabel) speedBtnLabel.textContent = `${this.autoScroller.speedPercent}% ▾`;
    };

    this.container.querySelector('#btnAutoScrollDecr')?.addEventListener('click', () => {
      this.autoScroller.stepSpeed(-5);
      _updateSpeedUI();
    });
    this.container.querySelector('#btnAutoScrollIncr')?.addEventListener('click', () => {
      this.autoScroller.stepSpeed(5);
      _updateSpeedUI();
    });

    // Slider de rango
    this.container.querySelector('#rngAutoScrollSpeed')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.autoScroller.setSpeed(val);
      const badge = this.container?.querySelector('#lblAutoScrollPercent');
      const speedBtnLabel = this.container?.querySelector('#btnOpenSpeedPanel');
      if (badge) badge.textContent = `${val}%`;
      if (speedBtnLabel) speedBtnLabel.textContent = `${val}% ▾`;
    });

    this.container.querySelector('#btnStageToggleAutoScroll')?.addEventListener('click', () => this.toggleAutoScroll());
  
    this.container.querySelector('#btnTransposeMinus')?.addEventListener('click', () => this.setTranspose(this.transposeSemitones - 1));
    this.container.querySelector('#btnTransposePlus')?.addEventListener('click', () => this.setTranspose(this.transposeSemitones + 1));
    this.container.querySelector('#btnTransposeReset')?.addEventListener('click', () => this.setTranspose(0));
    this.container.querySelector('#btnTransposeDown')?.addEventListener('click', () => this.setTranspose(this.transposeSemitones - 1));
    this.container.querySelector('#btnTransposeUp')?.addEventListener('click', () => this.setTranspose(this.transposeSemitones + 1));

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
      import('../ai/HandsFreeController.js').then(({ handsFreeController }) => {
        if (this.isLiveListening) {
          handsFreeController.start();
          import('./Toast.js').then(({ toast }) => toast.show('🎤 Escucha Activa: Control por Voz Habilitado', 'success', 2000));
        } else {
          handsFreeController.stop();
          import('./Toast.js').then(({ toast }) => toast.show('Pausado', 'info', 1000));
        }
      });
      this.isOptionsMenuOpen = false;
      this.render();
    });

    this.container.querySelector('#btnOpenBandRoomQuick')?.addEventListener('click', () => {
      import('../network/BandRoomClient.js').then(({ bandRoomClient }) => {
        if (!bandRoomClient.isConnected) {
          bandRoomClient.createRoom().then(id => {
            import('./Toast.js').then(({ toast }) => toast.show(`🌐 Sala P2P Creada. Código: ${id.substring(0,8)}...`, 'success', 3000));
          });
        } else {
          bandRoomClient.disconnect();
          import('./Toast.js').then(({ toast }) => toast.show(`Desconectado de la sala.`, 'info', 2000));
        }
      });
      this.isOptionsMenuOpen = false;
      this.render();
    });

    this.container.querySelector('#btnOpenStageQuick')?.addEventListener('click', () => {
      import('../audio/MidiController.js').then(({ midiController }) => {
        if (!midiController.isActive) {
          midiController.initialize().then(success => {
            import('./Toast.js').then(({ toast }) => toast.show(success ? '🎹 Stage Automation: Controlador MIDI USB conectado.' : '❌ Error MIDI', success ? 'success' : 'error', 3000));
          });
        } else {
          midiController.destroy();
          import('./Toast.js').then(({ toast }) => toast.show('🎹 Stage Automation: Desconectado.', 'info', 2000));
        }
      });
      this.isOptionsMenuOpen = false;
      this.render();
    });

    this.container.querySelector('#btnOpenSpatialQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      import('./Toast.js').then(({ toast }) => toast.show('🥽 HUD de Spatial Computing: Requiere gafas de Realidad Mixta (AR/VR)', 'warning', 3500));
    });

    this.container.querySelector('#btnOpenSmartBandQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('smartBand:open');
    });

    this.container.querySelector('#btnOpenArcadeQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('arcade:open');
    });

    this.container.querySelector('#btnOpenLooperQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      
      const res = confirm("Entrenador Adaptativo (Smart Looper):\n¿Deseas iniciar el entrenamiento de bucle con Web Audio API?\n\n- Toca/Canta por encima del 95% de precisión para aumentar la velocidad un 5%.\n- Falla (<70%) y la reduciremos automáticamente.\n\n¿Empezar?");
      if(res) {
        toast.show('🔁 Bucle Adaptativo Activo. Escuchando micrófono...', 'success', 3000);
        
        let hits = 0;
        let misses = 0;
        
        // Simulated AI Loop evaluation logic (using real pitchDetector events if available)
        const unregister = events.on('tuner:pitch', (pitch) => {
          if (!this.autoScroller.isRunning) this.autoScroller.start();
          
          const errorCents = Math.abs(pitch.cents || 0);
          if (errorCents <= 15) hits++;
          else if (errorCents > 40) misses++;
          
          // Evalúa cada 50 muestras (~2-3 segundos de audio)
          if (hits + misses > 50) {
            const accuracy = hits / (hits + misses);
            if (accuracy >= 0.95) {
              toast.show('🔥 ¡Perfecto! Subiendo velocidad (+5%)', 'success', 1500);
              this.autoScroller.stepSpeed(5);
            } else if (accuracy < 0.70) {
              toast.show('📉 Vamos a intentarlo más despacio (-5%)', 'warning', 1500);
              this.autoScroller.stepSpeed(-5);
            } else {
              toast.show(`✅ Vas bien (Precisión: ${Math.round(accuracy*100)}%). Manteniendo velocidad.`, 'info', 1500);
            }
            hits = 0;
            misses = 0;
          }
        });
        
        import('../audio/PitchDetector.js').then(({ pitchDetector }) => {
          pitchDetector.start();
        });

        // Autodestrucción del loop si sale de la vista
        const cleanup = () => {
          unregister();
          events.off('ui:switchTab', cleanup);
        };
        events.on('ui:switchTab', cleanup);
      }
    });

    this.container.querySelector('#btnOpenPedalboardQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('pedalboard:open');
    });

    this.container.querySelector('#btnOpenStemsQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('stems:open');
    });

    this.container.querySelector('#btnOpenLooperQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('looper:open');
    });

    this.container.querySelector('#btnOpenVocalCoachQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('ui:switchTab', 'tools');
      events.emit('ui:openTool', 'vocal');
    });

    this.container.querySelector('#btnOpenTranscriberQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('transcriber:open');
    });

    this.container.querySelector('#btnOpenAnalyticsQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('analytics:open');
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
