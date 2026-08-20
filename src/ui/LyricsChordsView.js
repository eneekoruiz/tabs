/**
 * @file LyricsChordsView.js
 * @description Vista principal de Letra con Acordes interactivos Multi-Instrumento (Guitarra, Piano, Ukelele).
 * - Barra de herramientas simplificada y despejada.
 * - Modo Atril / Pantalla Completa de Escenario con Grabador de Ensayos en Directo.
 * - Galería Visual de Diagramas de Acordes Reales al inicio de la canción (Todos visibles sin tener que pinchar).
 * - Grabador de Tomas de Estudio (.webm / .wav descargable).
 * - Zoom Reactivo con Micro-Animación del porcentaje ([A-] 100% [A+]).
 * - Sistema de Cifrado Dual: Anglo (C, D, E) vs Latino (Do, Re, Mi).
 * - Modo Fácil y Modo Solo Letra.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { chordEngine } from '../tools/ChordEngine.js';
import { pitchDetector } from '../audio/PitchDetector.js';
import { gigRecorder } from '../audio/GigRecorder.js';
import { onlineSongProvider } from '../data/OnlineSongProvider.js';
import { toast } from './Toast.js';

const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const LATIN_ROOTS = {
  'C': 'Do', 'C#': 'Do#', 'Db': 'Reb',
  'D': 'Re', 'D#': 'Re#', 'Eb': 'Mib',
  'E': 'Mi',
  'F': 'Fa', 'F#': 'Fa#', 'Gb': 'Solb',
  'G': 'Sol', 'G#': 'Sol#', 'Ab': 'Lab',
  'A': 'La', 'A#': 'La#', 'Bb': 'Sib',
  'B': 'Si'
};

export class LyricsChordsView extends Component {
  constructor(container) {
    super(container);
    this.currentSong = null;
    this.transposeSemitones = 0;
    this.capoFret = 0; // 0 a 7
    this.fontSizeScale = parseInt(localStorage.getItem('lyrics_font_scale'), 10) || 100;
    this.viewMode = 'lyrics';
    this.currentInstrument = localStorage.getItem('app_instrument') || 'guitar';
    this.visualTheme = localStorage.getItem('app_visual_theme') || 'oled';
    this.notationSystem = localStorage.getItem('app_notation') || 'anglo';
    this.isSimplified = localStorage.getItem('app_simplified_chords') === 'true';
    this.hideChordsMode = false;
    this.isStageMode = false;
    this.showChordGallery = true;

    // Grabación
    this.isRecording = false;
    this.recordingDuration = 0;
    this.recordingAudioUrl = null;

    this.isAutoScrolling = false;
    this.autoScrollPercent = 25;
    this.autoScrollInterval = null;
    this.accumulatedScroll = 0;
    this.isLiveListening = false;
    this.activePopoverChord = null;
    this.currentChordIndex = 0;
    this.isInstrumentMenuOpen = false;
    this.isOptionsMenuOpen = false;
    this.wakeLockSentinel = null;

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
    this.registerUnsub(
      events.on('score:loaded', async ({ score }) => {
        const activeSong = state.get('activeSong');
        if (!activeSong) return;
        if (this.currentSong && (String(this.currentSong.id) === String(activeSong.id) || this.currentSong.title === activeSong.title) && this.currentSong.lyricsChords) {
          return;
        }
        this.currentSong = activeSong;
        this.transposeSemitones = 0;
        this.capoFret = 0;
        this.visualTheme = localStorage.getItem('app_visual_theme') || 'oled';
        this.recordingAudioUrl = null;

        if (this.currentSong && (!this.currentSong.lyricsChords || this.currentSong.lyricsChords.trim().length === 0)) {
          this.currentSong.lyricsChords = await onlineSongProvider.fetchLyricsAndChords(this.currentSong.title, this.currentSong.artist);
        }
        this.render();
      })
    );

    this.registerUnsub(
      events.on('ui:loadLyricsSong', async (song) => {
        if (this.currentSong && (String(this.currentSong.id) === String(song.id) || this.currentSong.title === song.title) && this.currentSong.lyricsChords === song.lyricsChords) {
          return;
        }
        this.currentSong = song;
        this.transposeSemitones = 0;
        this.capoFret = 0;
        this.visualTheme = localStorage.getItem('app_visual_theme') || 'oled';
        this.recordingAudioUrl = null;

        if (this.currentSong && (!this.currentSong.lyricsChords || this.currentSong.lyricsChords.trim().length === 0)) {
          this.currentSong.lyricsChords = await onlineSongProvider.fetchLyricsAndChords(this.currentSong.title, this.currentSong.artist);
        }
        this.render();
      })
    );

    this.registerUnsub(
      events.on('tuner:pitch', (pitch) => {
        if (this.isLiveListening && pitch) {
          this.handleLiveChordDetected(pitch.note);
        }
      })
    );

    // Eventos del grabador
    this.registerUnsub(
      events.on('recorder:started', () => {
        this.isRecording = true;
        this.recordingDuration = 0;
        this.updateRecorderUI();
      })
    );

    this.registerUnsub(
      events.on('recorder:tick', ({ duration, formatted }) => {
        this.recordingDuration = duration;
        const labels = this.container?.querySelectorAll('.lbl-recording-time');
        labels?.forEach(l => l.textContent = formatted);
      })
    );

    this.registerUnsub(
      events.on('recorder:finished', ({ url }) => {
        this.isRecording = false;
        this.recordingAudioUrl = url;
        this.render();
      })
    );
  }

  toggleRecording() {
    if (this.isRecording) {
      gigRecorder.stopRecording();
    } else {
      gigRecorder.startRecording({
        title: this.currentSong?.title || 'Ensayo',
        artist: this.currentSong?.artist || 'Tabs & Chords PRO'
      });
    }
  }

  updateRecorderUI() {
    const banner = this.container?.querySelector('#activeRecordingBanner');
    const recBtns = this.container?.querySelectorAll('.btn-record-toggle, .btn-stage-record');
    if (banner) banner.style.display = this.isRecording ? 'flex' : 'none';
    if (recBtns) {
      recBtns.forEach(b => b.classList.toggle('recording-active', this.isRecording));
    }
  }

  toggleLiveListening() {
    this.isLiveListening = !this.isLiveListening;
    if (this.isLiveListening) {
      pitchDetector.start().then(() => {
        toast.show('Micrófono activo: Toca los acordes y avanzará automáticamente', 'success', 1500);
        this.render();
      }).catch(() => {
        this.isLiveListening = false;
        toast.show('Micrófono no disponible.', 'warning');
        this.render();
      });
    } else {
      pitchDetector.stop();
      toast.show('Escucha activa pausada', 'info', 800);
      this.render();
    }
  }

  handleLiveChordDetected(detectedNote) {
    if (!this.isLiveListening || !detectedNote) return;

    const chordBadges = this.container?.querySelectorAll('.chord-badge');
    if (!chordBadges || chordBadges.length === 0) return;

    if (this.currentChordIndex >= chordBadges.length) {
      this.currentChordIndex = 0;
    }

    const currentBadge = chordBadges[this.currentChordIndex];
    if (!currentBadge) return;

    const rawChord = (currentBadge.dataset.originalChord || currentBadge.dataset.chord || '').trim();
    const rootExpected = rawChord.replace(/[^A-G#b]/g, '');

    const matches = detectedNote === rootExpected || 
                    rawChord.startsWith(detectedNote) ||
                    this.areNotesEnharmonic(detectedNote, rootExpected);

    if (matches) {
      currentBadge.classList.add('chord-detected-active');
      toast.show(`Acorde reconocido: ${currentBadge.textContent}`, 'success', 600);

      setTimeout(() => {
        currentBadge.classList.remove('chord-detected-active');
      }, 1200);

      this.currentChordIndex++;

      const scrollEl = document.getElementById('score-viewport');
      if (scrollEl) {
        scrollEl.scrollBy({ top: 65, behavior: 'smooth' });
      }
    }
  }

  areNotesEnharmonic(n1, n2) {
    const map = { 'A#': 'Bb', 'Bb': 'A#', 'C#': 'Db', 'Db': 'C#', 'D#': 'Eb', 'Eb': 'D#', 'F#': 'Gb', 'Gb': 'F#', 'G#': 'Ab', 'Ab': 'G#' };
    return map[n1] === n2 || map[n2] === n1;
  }

  setFontSizeScale(delta) {
    this.fontSizeScale = Math.max(80, Math.min(180, this.fontSizeScale + delta));
    localStorage.setItem('lyrics_font_scale', this.fontSizeScale);
    
    const badges = this.container?.querySelectorAll('.font-scale-percent-badge, .stage-hud-font-badge');
    if (badges) {
      badges.forEach(badge => {
        badge.textContent = `${this.fontSizeScale}%`;
        badge.classList.remove('zoom-pulse-anim');
        void badge.offsetWidth;
        badge.classList.add('zoom-pulse-anim');
      });
    }

    this.updateFontSizeInDOM();
  }

  updateFontSizeInDOM() {
    const container = this.container?.querySelector('.lyrics-chords-container');
    const scale = this.fontSizeScale / 100;
    if (container) {
      container.style.setProperty('--lyrics-font-scale', String(scale));
      container.style.setProperty('--lyrics-font-size', `${1.12 * scale}rem`);
      container.style.setProperty('--chord-font-size', `${0.95 * scale}rem`);
    }
  }

  setCapo(fret) {
    this.capoFret = fret;
    toast.show(`Cejilla: ${fret === 0 ? 'Sin cejilla' : `Traste ${fret}`}`, 'info', 800);
    this.render();
  }

  enterStageMode() {
    this.isStageMode = true;
    document.body.classList.add('stage-mode-active');
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    toast.show('Modo Atril de Escenario Activo', 'info', 1200);
    this.render();
  }

  exitStageMode() {
    this.isStageMode = false;
    document.body.classList.remove('stage-mode-active');
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    toast.show('Modo Atril desactivado', 'info', 700);
    this.render();
  }

  setInstrument(instrument) {
    this.currentInstrument = instrument;
    localStorage.setItem('app_instrument', instrument);
    chordEngine.setInstrument(instrument);
    const instNames = { guitar: 'Guitarra', piano: 'Piano', ukulele: 'Ukelele' };
    toast.show(`Instrumento: ${instNames[instrument]}`, 'info', 800);
    this.isInstrumentMenuOpen = false;
    this.render();
  }

  setNotationSystem(sys) {
    this.notationSystem = sys;
    localStorage.setItem('app_notation', sys);
    toast.show(`Cifrado: ${sys === 'latin' ? 'Latino (Do, Re, Mi)' : 'Americano (C, D, E)'}`, 'info', 800);
    this.render();
  }

  toggleSimplifiedChords() {
    this.isSimplified = !this.isSimplified;
    localStorage.setItem('app_simplified_chords', this.isSimplified);
    toast.show(this.isSimplified ? 'Modo Fácil activado (Acordes simplificados)' : 'Modo Fácil desactivado', 'info', 800);
    this.render();
  }

  toggleHideChords() {
    this.hideChordsMode = !this.hideChordsMode;
    toast.show(this.hideChordsMode ? 'Modo Solo Letra (Vocalista)' : 'Acordes visibles', 'info', 800);
    this.render();
  }

  setTranspose(semitones) {
    this.transposeSemitones = Math.max(-12, Math.min(12, semitones));
    const val = this.container?.querySelector('#lblTransposeDisplay');
    if (val) val.textContent = `${this.transposeSemitones > 0 ? '+' : ''}${this.transposeSemitones}`;
    toast.show(`Tono: ${this.transposeSemitones > 0 ? '+' : ''}${this.transposeSemitones} semitonos`, 'info', 700);
    this.render();
  }

  setAutoScrollPercent(percent) {
    this.autoScrollPercent = Math.max(1, Math.min(100, percent));
    const labels = document.querySelectorAll('#lblAutoScrollPercent, #lblStageAutoScrollPercent');
    const sliders = document.querySelectorAll('#rngAutoScrollSpeed');
    labels.forEach(l => l.textContent = `${this.autoScrollPercent}%`);
    sliders.forEach(s => s.value = this.autoScrollPercent);

    if (this.isAutoScrolling) {
      this.startAutoScroll();
    }
  }

  toggleAutoScroll() {
    this.isAutoScrolling = !this.isAutoScrolling;
    if (this.isAutoScrolling) {
      this.startAutoScroll();
      toast.show(`Auto-Scroll (${this.autoScrollPercent}%)`, 'info', 700);
    } else {
      this.stopAutoScroll();
      toast.show('Auto-Scroll pausado', 'info', 700);
    }
    this.updateAutoScrollUI();
  }

  startAutoScroll() {
    this.stopAutoScroll();
    this.accumulatedScroll = 0;

    this.autoScrollInterval = setInterval(() => {
      if (!this.isAutoScrolling) return;

      const pixelsPerTick = (this.autoScrollPercent / 100) * 3.8 + 0.12;
      this.accumulatedScroll += pixelsPerTick;

      if (this.accumulatedScroll >= 1.0) {
        const delta = Math.floor(this.accumulatedScroll);
        const scrollEl = document.getElementById('score-viewport');
        if (scrollEl) {
          scrollEl.scrollTop += delta;
        } else {
          window.scrollBy(0, delta);
        }
        this.accumulatedScroll -= delta;
      }
    }, 30);
  }

  stopAutoScroll() {
    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }
  }

  updateAutoScrollUI() {
    const btns = this.container?.querySelectorAll('#btnToggleAutoScroll, #btnStageToggleAutoScroll');
    if (btns) {
      btns.forEach(btn => {
        btn.classList.toggle('active', this.isAutoScrolling);
        btn.innerHTML = this.isAutoScrolling ? 'Pausa' : 'Auto-Scroll';
      });
    }
  }

  simplifyChordName(chord) {
    if (!chord) return chord;
    const match = chord.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return chord;
    const [, root, ext] = match;

    if (ext.startsWith('m') && !ext.startsWith('maj')) {
      return `${root}m`;
    }
    return root;
  }

  formatChordDisplay(chordName) {
    let chord = chordName;
    if (this.isSimplified) {
      chord = this.simplifyChordName(chord);
    }

    if (this.notationSystem === 'latin') {
      const match = chord.match(/^([A-G][#b]?)(.*)$/);
      if (match) {
        const [, root, ext] = match;
        const latinRoot = LATIN_ROOTS[root] || root;
        return `${latinRoot}${ext}`;
      }
    }
    return chord;
  }

  transposeChord(chordName, semitones) {
    const totalSemitones = semitones - this.capoFret;
    if (totalSemitones === 0 || !chordName) return chordName;

    const match = chordName.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return chordName;

    const root = match[1];
    const suffix = match[2];

    let idx = NOTES_SHARP.indexOf(root);
    let useSharps = true;
    if (idx === -1) {
      idx = NOTES_FLAT.indexOf(root);
      useSharps = false;
    }
    if (idx === -1) return chordName;

    let newIdx = (idx + totalSemitones) % 12;
    if (newIdx < 0) newIdx += 12;

    const newRoot = useSharps ? NOTES_SHARP[newIdx] : NOTES_FLAT[newIdx];
    return `${newRoot}${suffix}`;
  }

  extractUniqueChords(rawText) {
    if (!rawText) return [];
    const chords = new Set();
    const regex = /\[([A-G0-9#b\/\+msusdimmaj]+)\]/g;
    let match;
    while ((match = regex.exec(rawText)) !== null) {
      if (match[1]) {
        const transposed = this.transposeChord(match[1], this.transposeSemitones);
        chords.add(transposed);
      }
    }
    return Array.from(chords);
  }

  parseLyricsChords(rawText) {
    if (!rawText) return '<p class="lyrics-empty">Cargando letra oficial...</p>';

    const lines = rawText.split('\n');
    let html = '<div class="lyrics-content-body" id="lyricsContentBodyInner">';

    for (let rawLine of lines) {
      const line = rawLine.trim();

      if (/^\[(Intro|Verse|Chorus|Bridge|Outro|Solo|Pre-Chorus|Estribillo|Verso)[^\]]*\]$/i.test(line)) {
        const sectionName = line.replace(/[\[\]]/g, '');
        html += `<div class="lyrics-section-header">${sectionName}</div>`;
        continue;
      }

      if (line === '') {
        html += '<div class="lyrics-spacer" style="height: 14px;"></div>';
        continue;
      }

      html += '<div class="lyrics-line">';

      const regex = /\[([A-G0-9#b\/\+msusdimmaj]+)\]|([^\[]+)/g;
      let match;
      let currentChord = null;

      while ((match = regex.exec(rawLine)) !== null) {
        if (match[1]) {
          const transposed = this.transposeChord(match[1], this.transposeSemitones);
          if (currentChord) {
            const displayChord = this.formatChordDisplay(currentChord);
            html += `
              <div class="lyrics-chord-word-pair">
                ${!this.hideChordsMode ? `<button class="chord-badge btn-chord-popover" data-chord="${currentChord}" data-original-chord="${currentChord}" aria-label="Ver acorde ${displayChord}">${displayChord}</button>` : ''}
                <span class="lyrics-word">&nbsp;&nbsp;&nbsp;&nbsp;</span>
              </div>
            `;
          }
          currentChord = transposed;
        } else if (match[2]) {
          const textPart = match[2];
          const words = textPart.split(/(\s+)/);
          for (let w of words) {
            if (w.trim() === '') {
              html += `<span class="lyrics-space" style="display: inline-block; width: 6px;"></span>`;
            } else {
              const displayChord = currentChord ? this.formatChordDisplay(currentChord) : '';
              html += `
                <div class="lyrics-chord-word-pair">
                  ${!this.hideChordsMode && currentChord ? `<button class="chord-badge btn-chord-popover" data-chord="${currentChord}" data-original-chord="${currentChord}" aria-label="Ver acorde ${displayChord}">${displayChord}</button>` : (!this.hideChordsMode ? '<span class="chord-placeholder" style="height: 20px; display: block;"></span>' : '')}
                  <span class="lyrics-word">${w}</span>
                </div>
              `;
              currentChord = null;
            }
          }
        }
      }

      if (currentChord) {
        const displayChord = this.formatChordDisplay(currentChord);
        html += `
          <div class="lyrics-chord-word-pair">
            ${!this.hideChordsMode ? `<button class="chord-badge btn-chord-popover" data-chord="${currentChord}" data-original-chord="${currentChord}" aria-label="Ver acorde ${displayChord}">${displayChord}</button>` : ''}
            <span class="lyrics-word">&nbsp;</span>
          </div>
        `;
      }

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  getInstrumentDisplayName(inst) {
    switch (inst) {
      case 'piano': return 'Piano';
      case 'ukulele': return 'Ukelele';
      default: return 'Guitarra';
    }
  }

  render() {
    if (!this.container) return;

    const title = this.currentSong?.title || 'Selecciona una canción';
    const artist = this.currentSong?.artist || 'Tabs & Chords PRO';
    const tuning = this.currentSong?.tuning || 'Standard E';
    const rawLyrics = this.currentSong?.lyricsChords || this.getDefaultLyrics(title, artist);
    this.visualTheme = localStorage.getItem('app_visual_theme') || 'oled';

    const uniqueChords = this.extractUniqueChords(rawLyrics);

    this.container.innerHTML = `
      <div class="lyrics-chords-container theme-${this.visualTheme} ${this.isStageMode ? 'stage-mode-view' : ''}" role="region" aria-label="Letra y acordes de ${title}">
        
        <!-- BARRA FLOTANTE EXCLUSIVA DE MODO ATRIL DE ESCENARIO -->
        ${this.isStageMode ? `
          <div class="stage-floating-hud" role="toolbar" aria-label="Controles de atril de escenario">
            <button class="btn-stage-exit" id="btnExitStageMode" aria-label="Salir de Modo Atril">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
              <span>Salir de Atril</span>
            </button>

            <!-- Grabador en Modo Atril -->
            <button class="btn-stage-record ${this.isRecording ? 'recording-active' : ''}" id="btnStageRecord">
              <span class="record-red-dot"></span>
              <span>${this.isRecording ? 'Detener Toma' : 'Grabar Ensayo'}</span>
              ${this.isRecording ? `<span class="lbl-recording-time font-mono">${gigRecorder.formatTime(this.recordingDuration)}</span>` : ''}
            </button>

            <button class="btn-stage-autoscroll ${this.isAutoScrolling ? 'active' : ''}" id="btnStageToggleAutoScroll">
              ${this.isAutoScrolling ? 'Pausa' : 'Auto-Scroll'} (<span id="lblStageAutoScrollPercent">${this.autoScrollPercent}%</span>)
            </button>

            <div class="stage-zoom-stepper">
              <button class="btn-stage-zoom-btn" id="btnStageFontDecr">-</button>
              <span class="stage-hud-font-badge">${this.fontSizeScale}%</span>
              <button class="btn-stage-zoom-btn" id="btnStageFontIncr">+</button>
            </div>
          </div>
        ` : ''}

        <!-- Cabecera Principal de Canción -->
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
          </div>

          <!-- Barra de Controles Esenciales de Estudio -->
          <div class="lyrics-essential-toolbar">
            <!-- 1. Selector de Instrumento -->
            <div class="dropdown-container">
              <button class="btn-instrument-select" id="btnInstrumentSelect" aria-label="Elige instrumento">
                <span id="lblCurrentInstrument">${this.getInstrumentDisplayName(this.currentInstrument)}</span>
                <span class="dropdown-caret">▾</span>
              </button>
              
              <div class="instrument-dropdown-popup" id="instrumentDropdownPopup" style="display: ${this.isInstrumentMenuOpen ? 'flex' : 'none'};">
                <button class="inst-option-card ${this.currentInstrument === 'guitar' ? 'active' : ''}" data-inst="guitar">
                  <div class="inst-meta">
                    <strong>Guitarra</strong>
                    <span>6 cuerdas (E A D G B E)</span>
                  </div>
                </button>
                <button class="inst-option-card ${this.currentInstrument === 'piano' ? 'active' : ''}" data-inst="piano">
                  <div class="inst-meta">
                    <strong>Piano</strong>
                    <span>Teclado armónico</span>
                  </div>
                </button>
                <button class="inst-option-card ${this.currentInstrument === 'ukulele' ? 'active' : ''}" data-inst="ukulele">
                  <div class="inst-meta">
                    <strong>Ukelele</strong>
                    <span>4 cuerdas (G C E A)</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- 2. Transposición de Tono (-1 / 0 / +1) -->
            <div class="transpose-box" role="group" aria-label="Transponer tono">
              <button class="btn-transpose-step" id="btnTransposeMinus" aria-label="Bajar semitono">-1</button>
              <span class="transpose-value-display" id="lblTransposeDisplay">${this.transposeSemitones > 0 ? '+' : ''}${this.transposeSemitones}</span>
              <button class="btn-transpose-step" id="btnTransposePlus" aria-label="Subir semitono">+1</button>
            </div>

            <!-- 3. Zoom de Fuente Táctil con Porcentaje Animado ([A-] 100% [A+]) -->
            <div class="font-scaler-group" role="group" aria-label="Tamaño de letra">
              <button class="btn-font-scale-step" id="btnFontDecr" aria-label="Reducir letra">A-</button>
              <span class="font-scale-percent-badge" id="lblFontScalePercent">${this.fontSizeScale}%</span>
              <button class="btn-font-scale-step" id="btnFontIncr" aria-label="Aumentar letra">A+</button>
            </div>

            <!-- 4. Auto-Scroll con Slider y Porcentaje -->
            <div class="autoscroll-control" role="group" aria-label="Desplazamiento automático">
              <button class="btn-autoscroll-toggle ${this.isAutoScrolling ? 'active' : ''}" id="btnToggleAutoScroll" aria-label="Iniciar Auto-Scroll">
                ${this.isAutoScrolling ? 'Pausa' : 'Auto-Scroll'}
              </button>
              <button class="btn-autoscroll-step-btn" id="btnAutoScrollDecr" aria-label="Reducir velocidad">-</button>
              <input type="range" class="autoscroll-speed-slider" id="rngAutoScrollSpeed" min="1" max="100" step="1" value="${this.autoScrollPercent}" title="Velocidad 1%-100%" aria-label="Velocidad 1%-100%">
              <button class="btn-autoscroll-step-btn" id="btnAutoScrollIncr" aria-label="Aumentar velocidad">+</button>
              <span class="autoscroll-percent-badge" id="lblAutoScrollPercent">${this.autoScrollPercent}%</span>
            </div>

            <!-- 5. Botón de Grabación de Ensayo Rápido -->
            <button class="btn-quick-record-action ${this.isRecording ? 'recording-active' : ''}" id="btnQuickRecordAction">
              <span class="record-red-dot"></span>
              <span>${this.isRecording ? 'Detener' : 'Grabar'}</span>
            </button>

            <!-- 6. Desplegable Unificado "Opciones" -->
            <div class="dropdown-container">
              <button class="btn-more-options" id="btnMoreOptions" aria-label="Más opciones de interpretación">
                <span>Opciones</span>
                <span class="dropdown-caret">▾</span>
              </button>

              <div class="more-options-dropdown-popup" id="moreOptionsDropdownPopup" style="display: ${this.isOptionsMenuOpen ? 'flex' : 'none'};">
                <!-- Modo Atril / Pantalla Completa -->
                <button class="btn-menu-action btn-menu-stage-highlight" id="btnEnterStageMode">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                  </svg>
                  <strong>Modo Atril (Pantalla Completa Limpia)</strong>
                </button>

                <!-- Exportar PDF / Imprimir -->
                <button class="btn-menu-action" id="btnPrintSong">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
                  </svg>
                  <span>Imprimir / PDF</span>
                </button>

                <!-- Cejilla / Capo -->
                <div class="options-menu-row">
                  <span class="options-menu-label">Cejilla / Capo:</span>
                  <select id="selSongCapo" class="sel-options-input">
                    ${[0, 1, 2, 3, 4, 5, 6, 7].map(f => `
                      <option value="${f}" ${this.capoFret === f ? 'selected' : ''}>${f === 0 ? 'Sin cejilla (Off)' : `Traste ${f}`}</option>
                    `).join('')}
                  </select>
                </div>

                <!-- Notación: Anglo vs Latino -->
                <div class="options-menu-row">
                  <span class="options-menu-label">Cifrado:</span>
                  <select id="selSongNotation" class="sel-options-input">
                    <option value="anglo" ${this.notationSystem === 'anglo' ? 'selected' : ''}>C, D, E (Americano)</option>
                    <option value="latin" ${this.notationSystem === 'latin' ? 'selected' : ''}>Do, Re, Mi (Latino)</option>
                  </select>
                </div>

                <!-- Modo Fácil (Simplificar Acordes) -->
                <button class="btn-menu-action ${this.isSimplified ? 'active' : ''}" id="btnToggleSimplified">
                  <span>${this.isSimplified ? '✓ Modo Fácil (Simplificado)' : 'Modo Fácil (Simplificar acordes)'}</span>
                </button>

                <!-- Modo Solo Letra -->
                <button class="btn-menu-action ${this.hideChordsMode ? 'active' : ''}" id="btnToggleHideChords">
                  <span>${this.hideChordsMode ? '✓ Modo Solo Letra (Vocalista)' : 'Modo Solo Letra (Ocultar acordes)'}</span>
                </button>

                <!-- Escucha Activa por Micrófono -->
                <button class="btn-menu-action ${this.isLiveListening ? 'active' : ''}" id="btnToggleLiveListen">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zM17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  <span>${this.isLiveListening ? 'Pausar Escucha Activa' : 'Activar Escucha Activa (Micrófono)'}</span>
                </button>

                <!-- Afinador Rápido -->
                <button class="btn-menu-action" id="btnOpenTunerQuick">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                  <span>Abrir Afinador Cromático</span>
                </button>

                <!-- Alternar Letra vs Tablatura -->
                <div class="options-viewmode-row">
                  <button class="btn-viewmode-choice ${this.viewMode === 'lyrics' ? 'active' : ''}" id="btnModeLyrics">Letra & Acordes</button>
                  <button class="btn-viewmode-choice ${this.viewMode === 'tab' ? 'active' : ''}" id="btnModeTab">Tablatura</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- BANNER DE GRABACIÓN ACTIVA O TOMA RECIENTE -->
        ${this.isRecording ? `
          <div class="active-recording-bar" id="activeRecordingBanner">
            <div class="rec-live-indicator">
              <span class="rec-dot-pulsing"></span>
              <strong>Grabando Ensayo en Directo...</strong>
            </div>
            <span class="lbl-recording-time font-mono">${gigRecorder.formatTime(this.recordingDuration)}</span>
            <button class="btn-rec-stop-bar" id="btnStopActiveRecord">Detener y Guardar</button>
          </div>
        ` : ''}

        ${this.recordingAudioUrl && !this.isRecording ? `
          <div class="recording-playback-card">
            <div class="rec-card-meta">
              <strong>Toma de Ensayo Grabada</strong>
              <audio controls src="${this.recordingAudioUrl}" class="rec-audio-element"></audio>
            </div>
            <div class="rec-card-actions">
              <button class="btn-rec-download" id="btnDownloadRecording">Descargar Audio (.webm)</button>
              <button class="btn-rec-dismiss" id="btnDismissRecording">Descartar</button>
            </div>
          </div>
        ` : ''}

        <!-- GALERÍA VISUAL DE DIAGRAMAS DE ACORDES REALES AL INICIO DE LA CANCIÓN -->
        ${uniqueChords.length > 0 && !this.hideChordsMode ? `
          <div class="song-chords-visual-gallery" role="region" aria-label="Diagramas de acordes de la canción">
            <div class="gallery-header-row">
              <div class="gallery-title-group">
                <span class="gallery-badge-studio">DIAGRAMAS DE LA CANCIÓN</span>
                <h2 class="gallery-heading">Acordes Utilizados (${this.getInstrumentDisplayName(this.currentInstrument)})</h2>
              </div>
              <span class="gallery-tip">Toca cualquier diagrama para escuchar su sonido acústico</span>
            </div>

            <div class="chords-visual-cards-grid">
              ${uniqueChords.map(chordName => {
                const formattedName = this.formatChordDisplay(chordName);
                const svgDiagram = chordEngine.renderChordSVG(chordName, { instrument: this.currentInstrument });
                return `
                  <div class="song-chord-visual-card" data-chord="${chordName}" data-original-chord="${chordName}" role="button" aria-label="Escuchar y ver acorde ${formattedName}">
                    <div class="chord-card-diagram-box">
                      ${svgDiagram}
                    </div>
                    <div class="chord-card-footer">
                      <span class="chord-card-name">${formattedName}</span>
                      <span class="chord-card-action-label">🔊 Tocar</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Cuerpo de Letra con Acordes -->
        <div id="lyricsBodyContent" style="${this.viewMode === 'lyrics' ? 'display: block;' : 'display: none;'}">
          ${this.parseLyricsChords(rawLyrics)}
        </div>
      </div>
    `;

    const alphatabEl = document.getElementById('alphatab');
    if (alphatabEl) {
      alphatabEl.style.display = this.viewMode === 'lyrics' ? 'none' : 'block';
    }

    this.updateFontSizeInDOM();
    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btnBackToExplore')?.addEventListener('click', () => {
      events.emit('ui:switchTab', 'explore');
    });

    // Grabador
    this.container.querySelector('#btnQuickRecordAction')?.addEventListener('click', () => {
      this.toggleRecording();
    });

    this.container.querySelector('#btnStageRecord')?.addEventListener('click', () => {
      this.toggleRecording();
    });

    this.container.querySelector('#btnStopActiveRecord')?.addEventListener('click', () => {
      gigRecorder.stopRecording();
    });

    this.container.querySelector('#btnDownloadRecording')?.addEventListener('click', () => {
      gigRecorder.downloadRecording(this.currentSong?.title || 'Ensayo');
    });

    this.container.querySelector('#btnDismissRecording')?.addEventListener('click', () => {
      this.recordingAudioUrl = null;
      this.render();
    });

    // Galería de acordes interactiva (Sonido al tocar)
    this.container.querySelectorAll('.song-chord-visual-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const chordName = card.dataset.originalChord || card.dataset.chord;
        chordEngine.auditionChord(chordName, this.currentInstrument);
        const displayName = this.formatChordDisplay(chordName);
        toast.show(`Sonando ${displayName}`, 'info', 600);
      });
    });

    // Dropdown de Instrumento
    this.container.querySelector('#btnInstrumentSelect')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isInstrumentMenuOpen = !this.isInstrumentMenuOpen;
      this.isOptionsMenuOpen = false;
      this.updateDropdownsVisibility();
    });

    this.container.querySelectorAll('.inst-option-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setInstrument(btn.dataset.inst);
      });
    });

    // Dropdown "Opciones"
    this.container.querySelector('#btnMoreOptions')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isOptionsMenuOpen = !this.isOptionsMenuOpen;
      this.isInstrumentMenuOpen = false;
      this.updateDropdownsVisibility();
    });

    // Modo Atril
    this.container.querySelector('#btnEnterStageMode')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.enterStageMode();
    });

    this.container.querySelector('#btnPrintSong')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render(); // Close menu visually before printing
      setTimeout(() => window.print(), 100);
    });

    this.container.querySelector('#btnExitStageMode')?.addEventListener('click', () => {
      this.exitStageMode();
    });

    // Cejilla / Capo
    this.container.querySelector('#selSongCapo')?.addEventListener('change', (e) => {
      const fret = parseInt(e.target.value, 10);
      this.setCapo(fret);
    });

    // Notación (Anglo vs Latino)
    this.container.querySelector('#selSongNotation')?.addEventListener('change', (e) => {
      this.setNotationSystem(e.target.value);
    });

    // Modo Fácil
    this.container.querySelector('#btnToggleSimplified')?.addEventListener('click', () => {
      this.toggleSimplifiedChords();
      this.isOptionsMenuOpen = false;
    });

    // Modo Solo Letra
    this.container.querySelector('#btnToggleHideChords')?.addEventListener('click', () => {
      this.toggleHideChords();
      this.isOptionsMenuOpen = false;
    });

    // Zoom / Tamaño de letra (A- / A+)
    this.container.querySelector('#btnFontDecr')?.addEventListener('click', () => {
      this.setFontSizeScale(-10);
    });

    this.container.querySelector('#btnFontIncr')?.addEventListener('click', () => {
      this.setFontSizeScale(+10);
    });

    // Controles de zoom en Modo Atril
    this.container.querySelector('#btnStageFontDecr')?.addEventListener('click', () => {
      this.setFontSizeScale(-10);
    });

    this.container.querySelector('#btnStageFontIncr')?.addEventListener('click', () => {
      this.setFontSizeScale(+10);
    });

    this.container.querySelector('#btnStageToggleAutoScroll')?.addEventListener('click', () => {
      this.toggleAutoScroll();
    });

    this.container.querySelector('#btnToggleLiveListen')?.addEventListener('click', () => {
      this.toggleLiveListening();
      this.isOptionsMenuOpen = false;
      this.updateDropdownsVisibility();
    });

    this.container.querySelector('#btnOpenTunerQuick')?.addEventListener('click', () => {
      events.emit('ui:toggleTuner');
      this.isOptionsMenuOpen = false;
      this.updateDropdownsVisibility();
    });

    this.container.querySelector('#btnTransposeMinus')?.addEventListener('click', () => {
      this.setTranspose(this.transposeSemitones - 1);
    });

    this.container.querySelector('#btnTransposePlus')?.addEventListener('click', () => {
      this.setTranspose(this.transposeSemitones + 1);
    });

    this.container.querySelector('#btnToggleAutoScroll')?.addEventListener('click', () => {
      this.toggleAutoScroll();
    });

    const speedSlider = this.container.querySelector('#rngAutoScrollSpeed');
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.setAutoScrollPercent(val);
      });
    }

    this.container.querySelector('#btnAutoScrollDecr')?.addEventListener('click', () => {
      this.setAutoScrollPercent(this.autoScrollPercent - 1);
    });

    this.container.querySelector('#btnAutoScrollIncr')?.addEventListener('click', () => {
      this.setAutoScrollPercent(this.autoScrollPercent + 1);
    });

    this.container.querySelector('#btnModeLyrics')?.addEventListener('click', () => {
      this.viewMode = 'lyrics';
      const lyricsEl = this.container.querySelector('#lyricsBodyContent');
      const alphatabEl = document.getElementById('alphatab');
      if (lyricsEl) lyricsEl.style.display = 'block';
      if (alphatabEl) alphatabEl.style.display = 'none';
      this.isOptionsMenuOpen = false;
      this.render();
    });

    this.container.querySelector('#btnModeTab')?.addEventListener('click', () => {
      this.viewMode = 'tab';
      const lyricsEl = this.container.querySelector('#lyricsBodyContent');
      const alphatabEl = document.getElementById('alphatab');
      if (lyricsEl) lyricsEl.style.display = 'none';
      if (alphatabEl) alphatabEl.style.display = 'block';
      this.isOptionsMenuOpen = false;
      this.render();
    });

    this.container.querySelectorAll('.btn-chord-popover').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chordName = btn.dataset.originalChord || btn.dataset.chord;
        this.showChordPopover(chordName, btn);
      });
    });

    this.getPopoverElement();

    if (!this._globalClickListenerAttached) {
      this._globalClickListenerAttached = true;
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#chordPopoverCard') && !e.target.closest('.btn-chord-popover')) {
          this.hideChordPopover();
        }
        if (this.isInstrumentMenuOpen || this.isOptionsMenuOpen) {
          this.isInstrumentMenuOpen = false;
          this.isOptionsMenuOpen = false;
          this.updateDropdownsVisibility();
        }
      });
    }
  }

  getPopoverElement() {
    let popover = document.getElementById('chordPopoverCard');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'chordPopoverCard';
      popover.className = 'chord-popover-card';
      popover.style.display = 'none';
      popover.innerHTML = `
        <div class="popover-header-row">
          <div class="popover-inst-tabs" role="group" aria-label="Cambiar instrumento del acorde">
            <button class="btn-popover-inst active" data-popinst="guitar">Guitarra</button>
            <button class="btn-popover-inst" data-popinst="piano">Piano</button>
            <button class="btn-popover-inst" data-popinst="ukulele">Ukelele</button>
          </div>
          <button class="btn-popover-x-close" id="btnPopoverXClose" aria-label="Cerrar ventana">✕</button>
        </div>

        <div class="chord-popover-diagram" id="chordPopoverDiagramSlot"></div>

        <div class="popover-actions-row">
          <button class="btn-audition-chord" id="btnAuditionPopoverChord" aria-label="Escuchar acorde">
            Escuchar
          </button>
          <button class="btn-close-popover" id="btnCloseChordPopover">Cerrar</button>
        </div>
      `;
      document.body.appendChild(popover);

      popover.addEventListener('click', (e) => e.stopPropagation());

      popover.querySelectorAll('.btn-popover-inst').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const selectedInst = btn.dataset.popinst;
          this.activePopoverInstrument = selectedInst;
          this.updatePopoverDisplay();
        });
      });

      popover.querySelector('#btnAuditionPopoverChord')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.activePopoverChord) {
          chordEngine.auditionChord(this.activePopoverChord, this.activePopoverInstrument || this.currentInstrument);
        }
      });

      popover.querySelector('#btnPopoverXClose')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideChordPopover();
      });

      popover.querySelector('#btnCloseChordPopover')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideChordPopover();
      });
    }
    return popover;
  }

  updateDropdownsVisibility() {
    const instPopup = this.container?.querySelector('#instrumentDropdownPopup');
    const optionsPopup = this.container?.querySelector('#moreOptionsDropdownPopup');

    if (instPopup) instPopup.style.display = this.isInstrumentMenuOpen ? 'flex' : 'none';
    if (optionsPopup) optionsPopup.style.display = this.isOptionsMenuOpen ? 'flex' : 'none';
  }

  showChordPopover(chordName, buttonElement) {
    const popover = this.getPopoverElement();
    if (!popover) return;

    this.activePopoverChord = chordName;
    this.activePopoverInstrument = this.currentInstrument;
    this.updatePopoverDisplay();

    popover.style.display = 'flex';

    const rect = buttonElement.getBoundingClientRect();
    const popoverHeight = 310;
    const popoverWidth = 280;

    let top = rect.bottom + 8;
    if (top + popoverHeight > window.innerHeight - 80) {
      top = Math.max(10, rect.top - popoverHeight - 8);
    }
    if (top + popoverHeight > window.innerHeight - 80) {
      top = Math.max(10, (window.innerHeight - 80 - popoverHeight) / 2);
    }

    let left = rect.left - 20;
    if (left + popoverWidth > window.innerWidth - 10) {
      left = window.innerWidth - popoverWidth - 10;
    }
    if (left < 10) left = 10;

    popover.style.top = `${Math.round(top)}px`;
    popover.style.left = `${Math.round(left)}px`;
  }

  updatePopoverDisplay() {
    const popover = this.getPopoverElement();
    if (!popover || !this.activePopoverChord) return;

    const instrument = this.activePopoverInstrument || this.currentInstrument;
    const chordName = this.activePopoverChord;

    popover.querySelectorAll('.btn-popover-inst').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.popinst === instrument);
    });

    const diagramSlot = popover.querySelector('#chordPopoverDiagramSlot');
    if (diagramSlot) {
      diagramSlot.innerHTML = chordEngine.renderChordSVG(chordName, { instrument });
    }

    const displayTitle = this.formatChordDisplay(chordName);
    const auditionBtn = popover.querySelector('#btnAuditionPopoverChord');
    if (auditionBtn) {
      auditionBtn.textContent = `Escuchar (${displayTitle})`;
      auditionBtn.setAttribute('aria-label', `Escuchar acorde ${displayTitle}`);
    }
  }

  hideChordPopover() {
    const popover = document.getElementById('chordPopoverCard');
    if (popover) popover.style.display = 'none';
  }

  getDefaultLyrics(title, artist) {
    const known = onlineSongProvider.getKnownSongLyrics(title, artist);
    if (known) return known;
    return `[Intro]
[C] [G] [Am] [F]

[Verse 1]
[C]${title}
[G]${artist}`;
  }

  destroy() {
    this.stopAutoScroll();
    if (this.wakeLockSentinel) {
      this.wakeLockSentinel.release().catch(() => {});
      this.wakeLockSentinel = null;
    }
    super.destroy();
  }
}

export default LyricsChordsView;
