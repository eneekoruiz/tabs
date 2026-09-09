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
import { KaraokeBackingEngine } from '../audio/KaraokeBackingEngine.js';
import { karaokeSongKey } from '../data/KaraokeBackingStore.js';
import { SessionRecovery } from '../data/SessionRecovery.js';
import { PitchLaneCanvas } from './lyrics/PitchLaneCanvas.js';
import { onlineSongProvider } from '../data/OnlineSongProvider.js';
import { assessSong } from '../data/catalog/CatalogQuality.js';
import { toast } from './Toast.js';
import { ChordProParser } from './lyrics/ChordProParser.js';
import { ChordDiagramRenderer } from './lyrics/ChordDiagramRenderer.js';
import { SongAutoScroller } from './lyrics/SongAutoScroller.js';
import { SongAudioRecorder } from './lyrics/SongAudioRecorder.js';
import { ChordPopoverModal } from './lyrics/ChordPopoverModal.js';
import { SongMetronomeCompanion } from './lyrics/SongMetronomeCompanion.js';
import { extractYouTubeVideoId, saveSongYouTubeVideoId, buildYouTubeSearchUrl } from './lyrics/YouTubeCompanion.js';
import { escapeHTML } from '../utils/sanitize.js';
import { trapModalFocus } from './ModalFocus.js';

const CHORD_MARKER_RE = /\[[A-G][#b]?(?:m|min|maj|dim|aug|sus|add|\d|\+)*(?:\/[A-G][#b]?)?\]/i;

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
    this.isGeneratedChordGuide = false;
    this.isShortcutsGuideOpen = false;
    this._removeSpeedPanelOutsideListener = null;
    this.wakeLockSentinel = null;
    this.pitchLane = null;
    this.backing = new KaraokeBackingEngine({
      onChange: () => this.updateKaraokeState(),
      onEnded: () => { this.pauseSinging(); this.showVocalScorecard({ reason: 'completed' }); }
    });
    this.karaokeTrackMode = 'original';
    this.micStatus = 'Micrófono desactivado';
    this._sessionSaveTimer = null;
    this.sessionRecovery = new SessionRecovery();
    this.isYouTubeCompanionOpen = false;
    this.isYouTubeEditorOpen = false;
    this.songMetronome = new SongMetronomeCompanion({
      onStateChange: (metronome) => {
        events.emit('song:stateChanged', { metronome });
        this.updateSongMetronomeDOM();
      },
      onBeat: (beat) => events.emit('song:metronomeBeat', beat)
    });

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
    const onFullscreen = () => {
      if (!document.fullscreenElement && this.isStageMode) {
        this.exitStageMode();
      }
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    this.registerUnsub(() => document.removeEventListener('fullscreenchange', onFullscreen));
    const onHidden = () => {
      this.savePracticeSession();
      if (document.hidden) { this.stopSinging(); this.songMetronome.stop(); this.autoScroller.stop('explicit'); }
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onHidden);
    this.registerUnsub(() => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onHidden);
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
      
      const isSameSong = this.currentSong === song && this.currentSong.lyricsChords;

      if (isSameSong) {
        this.render();
        return;
      }

      this.savePracticeSession();
      clearTimeout(this._sessionSaveTimer);
      this.stopSinging();
      this.currentSong = song;
      this.transposeSemitones = 0;
      this.capoFret = 0;
      this.visualTheme = localStorage.getItem('app_visual_theme') || 'paper';
      this.performanceMode = 'play';
      localStorage.setItem('app_performance_mode', 'play');
      this.restorePracticeSession(song);
      this.audioRecorder.dismiss();
      this._scorecardShown = false;
      try { vocalCoachEngine.resetSessionStats(); } catch (_) {}

      try {
        // Fill missing catalog lyrics without replacing imported/user-authored content.
        const curatedLyrics = onlineSongProvider.getKnownSongLyrics(song.title, song.artist);
        if (curatedLyrics && !String(song.lyricsChords || '').trim()) {
          song.lyricsChords = curatedLyrics;
          song.contentSource = 'repository_unverified';
        }
        const hadChordMarkersBeforeLoad = CHORD_MARKER_RE.test(String(song.lyricsChords || ''));
        if (this.currentSong && (!this.currentSong.lyricsChords || this.currentSong.lyricsChords.trim().length === 0)) {
          const lyrics = await onlineSongProvider.fetchLyricsAndChords(song.title, song.artist);
          if (this.currentSong !== song) return;
          song.lyricsChords = lyrics;
          if (lyrics && !song.contentSource) song.contentSource = 'repository_unverified';
        }
        const sourceLyrics = String(song.lyricsChords || '');
        this.isGeneratedChordGuide = assessSong(song).generated;
        // Never place guessed chords into an existing song's lyrics.
        if (this.currentSong) {
          const { resolveSongMetadata } = await import('../data/catalog/SongMetadataResolver.js');
          if (this.currentSong !== song) return;
          const meta = resolveSongMetadata(this.currentSong.title, this.currentSong.artist, this.currentSong.genre);
          if (meta?.tempo && !Number(this.currentSong.tempo)) this.currentSong.tempo = meta.tempo;
          if (meta?.difficulty && !this.currentSong.difficulty) this.currentSong.difficulty = meta.difficulty;

          const { getSongYouTubeVideoId, getSongKaraokeVideoId } = await import('./lyrics/YouTubeCompanion.js');
          if (this.currentSong !== song) return;
          this.currentSong.youtubeVideoId = getSongYouTubeVideoId(this.currentSong);
          this.currentSong.karaokeVideoId = getSongKaraokeVideoId(this.currentSong);
        }
      } catch (e) {
        console.warn('[LyricsChordsView] Error obteniendo acordes online:', e);
        import('./Toast.js').then(({ toast }) => toast.show('Error al descargar acordes', 'error', 3000)).catch(console.error);
      }

      if (this.currentSong !== song) return;
      const recovered = song._practiceRecovery;
      if (recovered) {
        if (Number.isFinite(recovered.transposeSemitones)) this.transposeSemitones = Math.max(-12, Math.min(12, Math.round(recovered.transposeSemitones)));
        if (Number.isFinite(recovered.capoFret)) this.capoFret = Math.max(0, Math.min(7, Math.round(recovered.capoFret)));
        if (Number.isFinite(recovered.fontSizeScale)) this.fontSizeScale = Math.max(80, Math.min(180, recovered.fontSizeScale));
        if (['guitar', 'piano', 'ukulele'].includes(recovered.instrument)) this.currentInstrument = recovered.instrument;
        if (['anglo', 'latin'].includes(recovered.notationSystem)) this.notationSystem = recovered.notationSystem;
        if (Number.isFinite(recovered.autoScroll?.speedPercent)) this.autoScroller.setSpeed(recovered.autoScroll.speedPercent);
        this.hideChordsMode = Boolean(recovered.hideChordsMode);
        this.isSimplified = Boolean(recovered.isSimplified);
        chordEngine.setInstrument(this.currentInstrument);
        delete song._practiceRecovery;
      }
      this.songMetronome.setSong(song);
      void this.backing.loadSong(song).then(() => {
        if (this.currentSong === song && this.pitchLane) {
          this.pitchLane.setTargetLyrics(song.lyricsChords, song.tempo, song);
          this.updateKaraokeState();
        }
      });
      this.backing.setTranspose(this.transposeSemitones);
      this.setViewMode('lyrics');
      this.render();
      if (recovered && Number.isFinite(recovered.scrollTop)) {
        this.autoScroller.writeScrollTop(this.autoScroller.readScrollMetrics(), recovered.scrollTop);
      }
      this.syncContextualState();
    };

    this.registerUnsub(events.on('score:loaded', ({ score }) => {
      const activeSong = state.get('activeSong');
      if (activeSong) handleSongLoad(activeSong);
    }));

    this.registerUnsub(events.on('ui:loadLyricsSong', handleSongLoad));
    this.registerUnsub(events.on('ui:switchTab', tab => {
      if (tab !== 'player') {
        this.savePracticeSession();
        this.stopSinging();
        this.songMetronome.stop();
        this.autoScroller.stop('explicit');
      }
    }));
    this.registerUnsub(events.on('vocalCoach:error', error => {
      if (this.performanceMode !== 'sing') return;
      this.micStatus = error?.name === 'NotAllowedError'
        ? 'Permiso denegado. Habilita el micrófono en el navegador y vuelve a intentarlo.'
        : 'Micrófono no disponible. Comprueba la conexión y vuelve a intentarlo.';
      this.updateKaraokeState();
    }));
    this.registerUnsub(events.on('song:loaded', handleSongLoad));
    this.registerUnsub(events.on('settings:accidentalsChanged', () => {
      this.render();
      this.syncContextualState();
    }));

    this.registerUnsub(events.on('song:transpose', (step) => {
      this.setTranspose(this.transposeSemitones + step);
    }));

    this.registerUnsub(events.on('song:toggleAutoScroll', () => {
      this.toggleAutoScroll();
    }));

    this.registerUnsub(events.on('song:stepAutoScroll', (delta) => {
      if (this.autoScroller) {
        this.autoScroller.stepSpeed(delta);
        toast.show(`Velocidad Auto-Scroll: ${this.autoScroller.speedPercent}%`, 'info', 700);
      }
    }));

    this.registerUnsub(events.on('ui:closeAllOverlays', () => {
      const hadOverlay = this.isOptionsMenuOpen || this.isShortcutsGuideOpen || this.isYouTubeCompanionOpen;
      this.isOptionsMenuOpen = false;
      this.isShortcutsGuideOpen = false;
      this.isYouTubeCompanionOpen = false;
      this.isYouTubeEditorOpen = false;
      this.closeSongMetronomePanel();
      const sheet = this.container?.querySelector('#lyricsToolsBottomSheetOverlay');
      if (sheet) sheet.style.display = 'none';
      const scoreModal = document.getElementById('vocalScorecardModal');
      if (scoreModal) scoreModal.remove();
      if (hadOverlay) this.render();
    }));
    this.registerUnsub(events.on('song:stepAutoScrollSpeed', (delta) => {
      this.autoScroller.stepSpeed(delta);
      this.syncContextualState();
    }));
    this.registerUnsub(events.on('song:setAutoScrollSpeed', (speed) => {
      this.autoScroller.setSpeed(speed);
      this.syncContextualState();
    }));

    this.registerUnsub(events.on('song:toggleMetronome', () => this.songMetronome.toggle()));
    this.registerUnsub(events.on('song:stepMetronomeBpm', (delta) => this.songMetronome.stepBpm(delta)));
    this.registerUnsub(events.on('song:tapMetronome', () => this.songMetronome.handleTapTempo()));
    this.registerUnsub(events.on('song:openMetronomePanel', () => this.openSongMetronomePanel()));

    this.registerUnsub(events.on('song:toggleRecording', (opts) => {
      this.toggleRecording(opts?.video || false);
    }));

    this.registerUnsub(events.on('song:enterStageMode', () => {
      this.enterStageMode();
    }));

    this.registerUnsub(events.on('song:exitStageMode', () => {
      this.exitStageMode();
    }));

    this.registerUnsub(events.on('ui:closeAllOverlays', () => {
      if (this.isOptionsMenuOpen || this.isShortcutsGuideOpen) {
        this.isOptionsMenuOpen = false;
        this.isShortcutsGuideOpen = false;
        this.render();
      }
    }));

    this.registerUnsub(events.on('tuner:pitch', (pitch) => {
      if (this.performanceMode !== 'sing' && pitch && pitch.frequency > 0) {
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
    // Suscripción a eventos de audio para Smart Pause (solo cuando el usuario lo active y tras silencio prolongado)
    this._smartPauseTimer = null;
    this.registerUnsub(events.on('vocalCoach:silence', () => {
      if (this.smartPauseEnabled && this.isSingingPlaying()) {
        if (!this._smartPauseTimer) {
          this._smartPauseTimer = setTimeout(() => {
            this._smartPauseTimer = null;
            if (this.smartPauseEnabled && this.isSingingPlaying()) {
              this.pauseSinging();
              this._setSingerRibbonPausedState();
              const btn = this.container?.querySelector('#btnSingPlayPause');
              if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
              import('./Toast.js').then(({ toast }) => toast.show('Pausa Inteligente: Canción en pausa por inactividad', 'info', 1500));
            }
          }, 4500); // 4.5 segundos continuos para respetar pausas musicales naturales
        }
      }
    }));

    this.registerUnsub(events.on('vocalCoach:pitch', (pitchData) => {
      if (this._smartPauseTimer) {
        clearTimeout(this._smartPauseTimer);
        this._smartPauseTimer = null;
      }
      // Actualizar medidor de volumen (RMS) en la UI solo si la canción está reproduciendo
      const bar = this.container?.querySelector('#singMicMeterBar');
      if (bar) {
        if (!this.isSingingPlaying()) {
          bar.style.width = '0%';
        } else {
          const rms = pitchData.rms || 0;
          const percent = Math.min(100, (rms / 0.1) * 100);
          bar.style.width = `${percent}%`;
          bar.style.background = percent > 80 ? '#ef4444' : '#22c55e';
        }
      }
    }));

    // Vocal Coach Engine: actualizar colores y afinación SOLO cuando la canción está reproduciendo
    this.registerUnsub(events.on('vocalCoach:pitch', (pitch) => {
      if (this.performanceMode !== 'sing' || !pitch) return;
      if (!this.isSingingPlaying()) {
        this._setSingerRibbonPausedState();
        return;
      }
      this._updateSingerRibbonColor(pitch);
    }));

    this.registerUnsub(events.on('vocalCoach:silence', () => {
      if (!this.isSingingPlaying()) {
        this._setSingerRibbonPausedState();
        return;
      }
      const ribbon = this.container?.querySelector('#singerVocalRibbon');
      if (ribbon) {
        ribbon.classList.remove('in-tune', 'near-tune', 'out-tune');
      }
    }));
  }

  renderKaraokePanel() {
    const originalVideoId = this.currentSong?.youtubeVideoId || '';
    const instrumentalVideoId = this.currentSong?.karaokeVideoId || this.currentSong?.backingTrackVideoId || '';
    const videoCandidate = this.getSingModeVideoId() || originalVideoId;
    const activeVideoId = /^[A-Za-z0-9_-]{11}$/.test(videoCandidate) ? videoCandidate : '';
    const isVocalComfort = Boolean(this.backing?.vocalComfortMode);

    return `
      <section class="karaoke-audio-companion-panel" id="karaokeAudioCompanion" aria-label="Base de canto">
        <div class="karaoke-primary-bar">
          <div class="karaoke-status-block">
            <span class="studio-eyebrow">ACOMPAÑAMIENTO</span>
            <p id="karaokeBackingStatus" class="karaoke-backing-status-text" role="status">Preparando acompañamiento…</p>
          </div>

          <div class="karaoke-timeline">
            <output id="karaokeTime">0:00 / 0:00</output>
            <input type="range" id="karaokeSeek" aria-label="Posición de la base" min="0" max="1" step="0.1" value="0">
          </div>

          <div class="karaoke-quick-actions">
            <button type="button" id="btnToggleVocalComfort" class="karaoke-comfort-pill ${isVocalComfort ? 'active' : ''}" aria-pressed="${isVocalComfort}" title="Modo Voz Fácil: curva suave y menor fatiga vocal">
              🎙️ Voz Fácil: ${isVocalComfort ? 'ON' : 'OFF'}
            </button>
            <div class="karaoke-mic-row">
              <button type="button" id="btnKaraokeMic" aria-pressed="false">Activar micrófono</button>
              <span id="karaokeMicStatus" role="status">Micrófono desactivado</span>
            </div>
          </div>
        </div>

        <!-- Opciones Secundarias Condensadas en Acordeón de Estudio -->
        <details class="karaoke-secondary-drawer" id="karaokeSecondaryDrawer" open>
          <summary class="karaoke-drawer-summary">
            <span class="karaoke-drawer-title">⚙️ Ajustes de Pista y Archivos</span>
            <span class="karaoke-drawer-sub">Importar audio/LRC, tempo, desfase y vídeo</span>
          </summary>

          <div class="karaoke-drawer-content">
            <!-- Bloque 1: Fuente y Archivo de Audio -->
            <div class="karaoke-card-group">
              <span class="karaoke-group-label">Pista y Archivo de Audio</span>
              <div class="karaoke-source-switch" role="group" aria-label="Fuente de acompañamiento">
                <label><input type="radio" name="karaokeSource" value="local" checked> Base importada</label>
                <label><input type="radio" name="karaokeSource" value="synth"> Guía de práctica</label>
              </div>
              <p class="karaoke-source-note" id="karaokeSourceNote">Audio guardado en este dispositivo.</p>
              <div class="karaoke-actions-inline">
                <button type="button" id="btnImportKaraokeBacking" ${this.backing?.loading ? 'disabled' : ''}>Importar audio</button>
                <input type="file" id="karaokeBackingFile" accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac" hidden>
                <button type="button" id="btnRemoveKaraokeBacking" ${this.backing?.loading || !this.backing?.record ? 'disabled' : ''}>Borrar base</button>
              </div>
              <button type="button" id="btnAssociateLegacyBacking" hidden>Asociar base anterior a esta versión</button>
              <p class="karaoke-error" id="karaokeBackingError" role="alert" hidden></p>
            </div>

            <!-- Bloque 2: Mezcla y Sincronización -->
            <div class="karaoke-card-group">
              <span class="karaoke-group-label">Mezcla y Sincronización</span>
              <div class="karaoke-mixer">
                <label>Volumen de base <input type="range" id="karaokeVolume" min="0" max="1" step="0.01" value="0.65"></label>
                <label>Tempo de práctica <input type="number" id="karaokeTempo" min="40" max="220" step="1" value="${Number(this.backing?.tempoBpm || this.currentSong?.tempo) || 72}" ${this.backing?.loading ? 'disabled' : ''}></label>
                <label>Inicio de letra (s) <input type="number" id="karaokeOffset" min="-600" max="600" step="0.1" value="0" ${this.backing?.mode !== 'local' || !this.backing?.record ? 'disabled' : ''}></label>
              </div>
              <p class="karaoke-source-note" id="karaokeTimingNote">Letra con avance estimado. Sin melodía vocal de referencia.</p>
            </div>

            <!-- Bloque 3: Letra LRC y Vídeo de Referencia -->
            <div class="karaoke-card-group">
              <span class="karaoke-group-label">Letra Sincronizada y Vídeo</span>
              <div class="karaoke-lyrics-import">
                <button type="button" id="btnImportKaraokeLyrics" ${this.backing?.loading ? 'disabled' : ''}>Importar letra con tiempos · LRC</button>
                <input type="file" id="karaokeLyricsFile" accept=".lrc,text/plain" hidden>
              </div>
              ${activeVideoId ? `
                <div class="karaoke-video-block" aria-label="Referencia de vídeo">
                  <div class="karaoke-track-switch" role="group" aria-label="Fuente de vídeo de la pista">
                    <button type="button" id="btnKaraokeTrackOriginal" class="${this.karaokeTrackMode === 'original' ? 'active' : ''}" data-karaoke-track="original" ${originalVideoId ? '' : 'disabled'}>Original</button>
                    <button type="button" id="btnKaraokeTrackInstrumental" class="${this.karaokeTrackMode === 'instrumental' ? 'active' : ''}" data-karaoke-track="instrumental" ${instrumentalVideoId ? '' : 'disabled'}>Instrumental</button>
                  </div>
                  <iframe id="karaokeYouTubeIframe" title="Vídeo de referencia de la canción" width="100%" height="150" src="https://www.youtube-nocookie.com/embed/${activeVideoId}?autoplay=0&rel=0&modestbranding=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                </div>
              ` : ''}
              ${/^[A-Za-z0-9_-]{11}$/.test(this.currentSong?.youtubeVideoId || '') ? `<a class="karaoke-video-link" href="https://www.youtube.com/watch?v=${this.currentSong.youtubeVideoId}" target="_blank" rel="noopener noreferrer">Vídeo opcional en YouTube</a>` : ''}
            </div>
          </div>
        </details>
      </section>
    `;
  }

  updateKaraokeState() {
    this.pitchLane?.setTranspose(this.backing?.effectiveTranspose || 0);
    const panel = this.container?.querySelector('#karaokeAudioCompanion');
    if (!panel || !this.backing) return;
    const engine = this.backing;
    const local = engine.mode === 'local';
    const status = engine.loading ? 'Preparando base…' : local
      ? engine.record ? `${engine.record.name} · guardada en este dispositivo` : 'Esta canción aún no tiene una base importada.'
      : 'Acompañamiento generado · no es una grabación original';
    const backingStatusEl = panel.querySelector('#karaokeBackingStatus');
    if (backingStatusEl) backingStatusEl.textContent = status;
    const sourceNoteEl = panel.querySelector('#karaokeSourceNote');
    if (sourceNoteEl) sourceNoteEl.textContent = local
      ? `Velocidad ${engine.playbackRate.toFixed(2)}× · el navegador conserva el tono. Los tiempos siguen al audio.${this.transposeSemitones ? ' El audio y la referencia vocal no se transponen; el cambio de tono solo afecta al cifrado. Usa la guía generada para ensayar en otro tono.' : ''}`
      : `${engine.chords.length ? 'Arreglo estimado del cifrado' : 'Pulso de práctica, sin acordes disponibles'} a ${Math.round(engine.tempoBpm)} BPM · tono ${engine.transposeSemitones > 0 ? '+' : ''}${engine.transposeSemitones} st. No reproduce el arreglo original.`;
    panel.querySelectorAll('[name="karaokeSource"]').forEach(input => {
      input.checked = input.value === engine.mode;
      input.disabled = engine.loading;
    });
    const error = panel.querySelector('#karaokeBackingError');
    if (error) {
      error.textContent = engine.error;
      error.hidden = !engine.error;
    }
    const importBtn = panel.querySelector('#btnImportKaraokeBacking');
    const associate = panel.querySelector('#btnAssociateLegacyBacking');
    if (associate) { associate.hidden = !engine.legacyRecord; associate.disabled = engine.loading; }
    if (importBtn) importBtn.disabled = engine.loading;
    const lyricsImportBtn = panel.querySelector('#btnImportKaraokeLyrics');
    if (lyricsImportBtn) lyricsImportBtn.disabled = engine.loading;
    const removeBtn = panel.querySelector('#btnRemoveKaraokeBacking');
    if (removeBtn) removeBtn.disabled = engine.loading || !engine.record;
    const volume = panel.querySelector('#karaokeVolume');
    if (volume && document.activeElement !== volume) volume.value = engine.volume;
    const offset = panel.querySelector('#karaokeOffset');
    if (offset) {
      offset.disabled = !local || !engine.record;
      if (document.activeElement !== offset) offset.value = engine.offsetMs / 1000;
    }
    const tempo = panel.querySelector('#karaokeTempo');
    if (tempo) {
      tempo.disabled = engine.loading;
      if (document.activeElement !== tempo) tempo.value = Math.round(engine.tempoBpm || this.currentSong?.tempo || 72);
    }
    const seek = panel.querySelector('#karaokeSeek');
    if (seek) {
      seek.disabled = !engine.ready;
      seek.max = Math.max(1, engine.durationMs / 1000);
      if (document.activeElement !== seek) seek.value = engine.currentTimeMs / 1000;
    }
    const format = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
    const timeEl = panel.querySelector('#karaokeTime');
    if (timeEl) timeEl.textContent = `${format(engine.currentTimeMs)} / ${format(engine.durationMs)}`;
    const micStatusEl = panel.querySelector('#karaokeMicStatus');
    if (micStatusEl) micStatusEl.textContent = this.micStatus;
    const play = this.container.querySelector('#btnSingPlayPause');
    if (play) {
      play.disabled = !engine.ready;
      play.setAttribute('aria-label', engine.playing ? 'Pausar canto' : 'Reproducir base');
      play.title = engine.playing ? 'Pausar canto' : 'Reproducir base';
      play.textContent = engine.playing ? 'Ⅱ' : '▶';
    }
    const mic = panel.querySelector('#btnKaraokeMic');
    if (mic) {
      mic.disabled = Boolean(vocalCoachEngine.starting);
      mic.textContent = vocalCoachEngine.isRunning ? 'Desactivar micrófono' : 'Activar micrófono';
      mic.setAttribute('aria-pressed', String(vocalCoachEngine.isRunning));
    }
    const comfortBtn = panel.querySelector('#btnToggleVocalComfort');
    if (comfortBtn) {
      const active = Boolean(engine.vocalComfortMode);
      comfortBtn.classList.toggle('active', active);
      comfortBtn.setAttribute('aria-pressed', String(active));
      comfortBtn.textContent = `🎙️ Voz Fácil: ${active ? 'ON' : 'OFF'}`;
    }
    const heroLabel = this.container.querySelector('.sing-mic-label');
    if (heroLabel) heroLabel.textContent = vocalCoachEngine.isRunning ? 'Micrófono activo' : 'Micrófono apagado';
    const lane = this.pitchLane;
    if (!lane) return;
    const lines = lane.lyricLines || [];
    const time = this.getKaraokeClockMs();
    const index = lines.findIndex(line => time >= line.startTime && time < line.startTime + line.duration);
    const curLine = this.container?.querySelector('#karaokeCurrentLine');
    if (curLine) {
      curLine.textContent = index >= 0 ? lines[index].text
        : time < 0 ? 'Introducción instrumental' : lines.length ? (time === 0 ? lines[0].text : '') : 'Sin letra disponible para esta canción.';
    }
    const nextLine = this.container?.querySelector('#karaokeNextLine');
    if (nextLine) {
      nextLine.textContent = (index >= 0 ? lines[index + 1] : lines.find(line => line.startTime > time))?.text || '';
    }
    const timingNote = panel?.querySelector('#karaokeTimingNote');
    if (timingNote) {
      timingNote.textContent = [
        lane.timingIsEstimated ? 'Letra con avance estimado.' : 'Letra con tiempos aportados.',
        lane.targetBlocks.length ? 'Melodía vocal aportada.' : 'Afinación cromática; sin evaluación de la melodía original.'
      ].join(' ');
    }
  }

  async startSingingMicrophone() {
    const song = this.currentSong;
    this.micStatus = 'Esperando permiso del micrófono…';
    const pending = vocalCoachEngine.start();
    this.updateKaraokeState();
    const ok = await pending;
    if (this.performanceMode !== 'sing' || song !== this.currentSong) return false;
    if (ok) this.micStatus = 'Micrófono activo';
    this.updateKaraokeState();
    return ok;
  }

  async playSinging() {
    if (!this.pitchLane || this.performanceMode !== 'sing') return;
    const lane = this.pitchLane;
    if (await this.backing.play()) {
      if (this.pitchLane !== lane || this.performanceMode !== 'sing') { this.backing.pause(); return; }
      lane.seek(this.backing.lyricTimeMs);
      lane.play();
      this._scorecardShown = false;
      this.container.querySelector('#singerPitchNoteLabel').textContent = vocalCoachEngine.isRunning
        ? 'Escuchando tu voz · afinación cromática' : 'Base en reproducción · micrófono desactivado';
    }
    this.updateKaraokeState();
  }

  pauseSinging() {
    this.backing?.pause();
    this.pitchLane?.pause();
    vocalCoachEngine.setPlaybackActive(false);
    clearTimeout(this._smartPauseTimer);
    this._smartPauseTimer = null;
    this._setSingerRibbonPausedState();
    this.updateKaraokeState();
  }

  stopSinging() {
    this.pauseSinging();
    vocalCoachEngine.stop();
    vocalCoachEngine.setTargetNote(null);
    this.micStatus = 'Micrófono desactivado';
    this.pitchLane?.stop();
    this.pitchLane = null;
    this._songCompletedUnsub?.();
    this._songCompletedUnsub = null;
    const nav = document.getElementById('bottom-nav-container');
    if (nav) nav.style.display = '';
    this.updateKaraokeState();
  }

  async setPerformanceMode(mode) {
    if (!['play', 'sing'].includes(mode)) return;
    this.stopSinging();
    pitchDetector.stop();
    this.isLiveListening = false;
    this.performanceMode = mode;
    localStorage.setItem('app_performance_mode', mode);
    this.render();
    if (mode === 'sing') {
      vocalCoachEngine.resetSessionStats();
      await this.backing.loadSong(this.currentSong);
      this.updateKaraokeState();
    }
  }

  isSingingPlaying() {
    return Boolean(this.performanceMode === 'sing' && (this.pitchLane?.isPlaying || this.backing?.playing));
  }

  getKaraokeClockMs() {
    return Number(this.backing?.lyricTimeMs) || 0;
  }

  _setSingerRibbonPausedState() {
    const ribbon = this.container?.querySelector('#singerVocalRibbon');
    const noteEl = this.container?.querySelector('#singerNoteBig');
    const labelEl = this.container?.querySelector('#singerPitchNoteLabel');
    const freqEl = this.container?.querySelector('#singerFreqBadge');
    const scaleCursor = this.container?.querySelector('#singerScaleCursor');

    if (ribbon) {
      ribbon.classList.remove('in-tune', 'near-tune', 'out-tune');
    }
    if (noteEl) {
      noteEl.textContent = '—';
      noteEl.className = 'ribbon-note-big';
    }
    if (labelEl) {
      labelEl.textContent = '⏸️ Canción en pausa · Pulsa ▶ para empezar a cantar';
    }
    if (freqEl) {
      freqEl.textContent = '0 Hz';
    }
    if (scaleCursor) {
      scaleCursor.style.top = '50%';
      scaleCursor.className = 'singer-scale-cursor';
    }
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
    this.queuePracticeAutosave();
    events.emit('song:stateChanged', {
      transpose: this.transposeSemitones,
      isAutoScrolling: this.autoScroller.isRunning,
      autoScrollSpeed: this.autoScroller.speedPercent,
      isRecording: this.audioRecorder.isRecording,
      isStageMode: this.isStageMode
    });
  }

  setTranspose(semitones) {
    if (!Number.isFinite(Number(semitones))) return;
    this.transposeSemitones = Math.max(-12, Math.min(12, Math.round(Number(semitones))));
    const focusedId = this.container?.contains(document.activeElement) ? document.activeElement.id : null;
    this.backing.setTranspose(this.transposeSemitones);
    this.queuePracticeAutosave();
    this.render();
    if (focusedId) this.container.querySelector(`#${CSS.escape(focusedId)}`)?.focus({ preventScroll: true });
    this.syncContextualState();
    toast.show(`Tono: ${this.transposeSemitones > 0 ? '+' : ''}${this.transposeSemitones}`, 'info', 500);
  }

  setCapo(fret) {
    this.capoFret = Math.max(0, Math.min(7, fret));
    this.queuePracticeAutosave();
    this.render();
    toast.show(this.capoFret === 0 ? 'Cejilla desactivada' : `Cejilla en traste ${this.capoFret}`, 'info', 800);
  }

  setInstrument(inst) {
    this.currentInstrument = inst;
    localStorage.setItem('app_instrument', inst);
    this.queuePracticeAutosave();
    chordEngine.setInstrument(inst);
    this.isInstrumentMenuOpen = false;
    this.render();
    toast.show(`Instrumento: ${ChordDiagramRenderer.getInstrumentDisplayName(inst)}`, 'success', 800);
  }

  setNotationSystem(notation) {
    this.notationSystem = notation;
    localStorage.setItem('app_notation', notation);
    this.queuePracticeAutosave();
    this.render();
    toast.show(`Cifrado: ${notation === 'latin' ? 'Latino (Do, Re, Mi)' : 'Americano (C, D, E)'}`, 'info', 800);
  }

  toggleAutoScroll() {
    this.autoScroller.toggle();
    this.queuePracticeAutosave();
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
    this.queuePracticeAutosave();
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
    this.queuePracticeAutosave();
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

  getPracticeSessionKey(song = this.currentSong) {
    if (!song) return '';
    return `tabs_practice_session_${karaokeSongKey(song)}`;
  }

  restorePracticeSession(song) {
    try {
      const raw = localStorage.getItem(this.getPracticeSessionKey(song));
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Number.isFinite(Number(saved.transpose))) this.transposeSemitones = Math.max(-12, Math.min(12, Number(saved.transpose)));
      if (Number.isFinite(Number(saved.capo))) this.capoFret = Math.max(0, Math.min(7, Number(saved.capo)));
      if (['guitar', 'piano', 'ukulele'].includes(saved.instrument)) this.currentInstrument = saved.instrument;
      if (['anglo', 'latin'].includes(saved.notation)) this.notationSystem = saved.notation;
      if (Number.isFinite(Number(saved.fontSize))) this.fontSizeScale = Math.max(80, Math.min(180, Number(saved.fontSize)));
      if (Number.isFinite(saved.scrollSpeed)) this.autoScroller.setSpeed(saved.scrollSpeed);
      chordEngine.setInstrument(this.currentInstrument);
    } catch (_) {
      // A damaged preference must never prevent a song from opening.
    }
  }

  queuePracticeAutosave() {
    if (!this.currentSong) return;
    clearTimeout(this._sessionSaveTimer);
    this._sessionSaveTimer = setTimeout(() => this.savePracticeSession(), 180);
  }

  savePracticeSession() {
    clearTimeout(this._sessionSaveTimer);
    if (!this.currentSong) return;
    const session = {
      id: this.currentSong.id || null,
      title: this.currentSong.title || '',
      artist: this.currentSong.artist || '',
      transpose: this.transposeSemitones,
      capo: this.capoFret,
      instrument: this.currentInstrument,
      notation: this.notationSystem,
      fontSize: this.fontSizeScale,
      viewMode: this.viewMode,
      scrollSpeed: this.autoScroller?.speedPercent || 25,
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(this.getPracticeSessionKey(), JSON.stringify(session));
      localStorage.setItem('tabs_last_session', JSON.stringify(session));
      const saved = this.sessionRecovery.flush({ song: this.currentSong,
        transposeSemitones: this.transposeSemitones, capoFret: this.capoFret,
        fontSizeScale: this.fontSizeScale, instrument: this.currentInstrument,
        notationSystem: this.notationSystem, visualTheme: this.visualTheme,
        hideChordsMode: this.hideChordsMode, isSimplified: this.isSimplified, viewMode: this.viewMode,
        scrollTop: this.autoScroller.readScrollMetrics().scrollTop,
        autoScroll: { speedPercent: this.autoScroller?.speedPercent } });
      if (!saved) throw new Error('Session storage unavailable');
      this._saveWarningShown = false;
    } catch (_) {
      if (!this._saveWarningShown) {
        toast.show('No se pudo guardar la sesión completa en este navegador. Puedes seguir practicando.', 'warning', 3500);
        this._saveWarningShown = true;
      }
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
    this._dialogFocusCleanup?.(false);
    this._dialogFocusCleanup = null;

    const title = this.currentSong?.title || 'Selecciona una canción';
    const artist = this.currentSong?.artist || 'Tabs & Chords PRO';
    const tuning = this.currentSong?.tuning || 'Standard E';
    const safeTitle = escapeHTML(title);
    const safeArtist = escapeHTML(artist);
    const safeTuning = escapeHTML(tuning);
    const rawLyrics = this.currentSong?.lyricsChords || '';
    const quality = assessSong(this.currentSong || {});
    this.visualTheme = localStorage.getItem('app_visual_theme') || 'paper';

    const uniqueChords = ChordProParser.extractUniqueChords(rawLyrics, this.transposeSemitones, this.capoFret);
    const parsedHtml = ChordProParser.parseToHtml(rawLyrics, {
      semitones: this.transposeSemitones,
      capoFret: this.capoFret,
      notation: this.notationSystem,
      hideChords: this.hideChordsMode
    });

    this.container.innerHTML = `
      <div class="lyrics-chords-container theme-${this.visualTheme} ${this.isStageMode ? 'stage-mode-view' : ''}" role="region" aria-label="Letra y acordes de ${safeTitle}">
        
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
            <button class="btn-stage-metronome ${this.songMetronome.isRunning ? 'active' : ''}" id="btnStageMetronomeToggle" aria-pressed="${this.songMetronome.isRunning}">
              ${this.songMetronome.isRunning ? 'Pausa' : 'Metrónomo'} <span id="lblStageMetronomeBpm">${this.songMetronome.bpm}</span>
            </button>
            <button class="btn-stage-zoom-btn" id="btnStageMetronomeIncr" aria-label="Aumentar BPM">+</button>
            <div class="stage-zoom-stepper">
              <button class="btn-stage-zoom-btn" id="btnStageFontDecr" aria-label="Reducir letra del atril">-</button>
              <span class="stage-hud-font-badge">${this.fontSizeScale}%</span>
              <button class="btn-stage-zoom-btn" id="btnStageFontIncr" aria-label="Aumentar letra del atril">+</button>
            </div>
          </div>
        ` : ''}

        <!-- BARRA FLOTANTE MODO CANTO -->
        ${this.performanceMode === 'sing' ? `
          <div class="sing-floating-hud" role="group" aria-label="Controles de canto">
            <button id="btnToggleSmartPause" aria-label="Pausa automática al dejar de cantar" aria-pressed="${Boolean(this.smartPauseEnabled)}" title="Pausa Inteligente (Smart Pause)">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
            </button>
            <button id="btnSingRestart" aria-label="Volver al inicio del ensayo" title="Volver al inicio">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
            </button>
            <button id="btnSingPlayPause" aria-label="Reproducir base">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button id="btnFinishVocalSession" aria-label="Finalizar ensayo y ver resumen" title="Finalizar ensayo y ver resumen">✓</button>
            <div style="display: flex; flex-direction: column; align-items: center; width: 60px;">
              <span class="sing-meter-label">Micrófono</span>
              <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                <div id="singMicMeterBar" style="width: 0%; height: 100%; background: #22c55e; transition: width 0.1s linear;"></div>
              </div>
            </div>
          </div>
        ` : ''}

          <!-- Cabecera Principal Reestructurada: Jerarquía Visual de 2 Filas Lógicas -->
          <header class="lyrics-header-main">
            <!-- Fila 1 (Superior): Navigation & Tools -->
            <div class="lyrics-nav-tools-row">
              <button class="btn-back-to-explore" id="btnBackToExplore" aria-label="Volver a explorar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
                <span>Volver</span>
              </button>

              <div class="lyrics-header-tools-group">
                <!-- Toggle Directo: Partitura / Letra (Toggle Switch) -->
                <button id="btnToggleScoreView" class="quick-tool-pill tool-score-toggle desktop-header-tool ${this.viewMode === 'score' ? 'active' : ''}" type="button" aria-pressed="${this.viewMode === 'score'}" title="${this.viewMode === 'score' ? 'Volver a Letra y Acordes' : 'Ver Partitura Interactiva'}">
                  <span class="tool-btn-icon">🎼</span>
                  <span class="tool-btn-label">Partitura</span>
                </button>

                <!-- Botón Directo: Exportar PDF / Imprimir -->
                <button id="btnQuickExportPdf" class="quick-tool-pill tool-pdf-pill desktop-header-tool" type="button" aria-label="Exportar PDF o Imprimir" title="Exportar o Imprimir PDF">
                  <span class="tool-btn-icon">📄</span>
                  <span class="tool-btn-label">PDF</span>
                </button>

                <button id="btnShareSong" class="quick-tool-pill desktop-header-tool" type="button" aria-label="Compartir canción" title="Compartir canción">
                  <span class="tool-btn-icon">↗</span>
                  <span class="tool-btn-label">Compartir</span>
                </button>

                <button id="btnSongTopMetronome" class="quick-tool-pill desktop-header-tool" type="button" aria-pressed="${this.songMetronome.isRunning}" aria-label="${this.songMetronome.isRunning ? 'Pausar' : 'Iniciar'} metrónomo" title="Metrónomo de canción">
                  <span class="tool-btn-icon">⏱</span><span class="tool-btn-label">${this.songMetronome.bpm} BPM</span>
                </button>

                <button id="btnQuickRecordAction" class="quick-tool-pill desktop-header-tool ${this.audioRecorder.isRecording ? 'active' : ''}" type="button" aria-pressed="${this.audioRecorder.isRecording}" aria-label="${this.audioRecorder.isRecording ? 'Detener grabación' : 'Grabar ensayo'}" title="${this.audioRecorder.isRecording ? 'Detener grabación' : 'Grabar ensayo'}">
                  <span class="tool-btn-icon">${this.audioRecorder.isRecording ? '■' : '●'}</span>
                  <span class="tool-btn-label">${this.audioRecorder.isRecording ? 'Parar' : 'Grabar'}</span>
                </button>

                <!-- Cejilla / Capo -->
                <div class="quick-tool-pill tool-capo desktop-header-tool">
                  <span class="tool-label">Capo</span>
                  <select id="selCapoQuick" aria-label="Seleccionar cejilla">
                    <option value="0" ${this.capoFret === 0 ? 'selected' : ''}>Off</option>
                    <option value="1" ${this.capoFret === 1 ? 'selected' : ''}>1</option>
                    <option value="2" ${this.capoFret === 2 ? 'selected' : ''}>2</option>
                    <option value="3" ${this.capoFret === 3 ? 'selected' : ''}>3</option>
                    <option value="4" ${this.capoFret === 4 ? 'selected' : ''}>4</option>
                    <option value="5" ${this.capoFret === 5 ? 'selected' : ''}>5</option>
                  </select>
                </div>

                <!-- Zoom de Letra -->
                <div class="quick-tool-pill tool-font desktop-header-tool">
                  <button id="btnFontDecr" class="btn-quick-font-decr" type="button" aria-label="Reducir letra">A-</button>
                  <span id="lblFontScalePercent" class="font-scale-text">${this.fontSizeScale}%</span>
                  <button id="btnFontIncr" class="btn-quick-font-incr" type="button" aria-label="Aumentar letra">A+</button>
                </div>

                <!-- AutoScroll: botón + panel flotante de velocidad -->
                <div class="autoscroll-toolbar-cluster" style="position: relative; display: flex; align-items: center; gap: 6px;">
                  <button class="quick-tool-pill ${this.autoScroller.isRunning ? 'active' : ''}" id="btnToggleAutoScroll" aria-label="AutoScroll" type="button" style="display:flex;align-items:center;gap:5px;">
                    ⚡ <span>${this.autoScroller.isRunning ? 'Parar' : 'Scroll'}</span>
                  </button>
                  <button class="btn-font-scale-step" id="btnOpenSpeedPanel" aria-label="Ajustar velocidad" type="button" style="font-size:0.75rem;padding:4px 8px;border-radius:16px;">
                    ${this.autoScroller.speedPercent}% ▾
                  </button>
                  <!-- Panel flotante de velocidad -->
                  <div id="autoScrollSpeedPanel" style="
                    display: none;
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    z-index: 200;
                    background: var(--bg-surface-solid, #1c1c1e);
                    border: 1px solid var(--border-subtle, rgba(255,255,255,0.15));
                    border-radius: 16px;
                    padding: 14px 16px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.45);
                    min-width: 220px;
                    flex-direction: column;
                    gap: 10px;
                  ">
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;font-weight:700;">
                      <span>Velocidad de Scroll</span>
                      <span id="lblAutoScrollPercent" style="color:var(--accent-primary, #007aff);font-size:0.9rem;">${this.autoScroller.speedPercent}%</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <button id="btnAutoScrollDecr" class="btn-font-scale-step" style="width:28px;height:28px;padding:0;border-radius:50%;font-size:0.85rem;" aria-label="Bajar velocidad">-5</button>
                      <input type="range" id="rngAutoScrollSpeed" min="1" max="100" value="${this.autoScroller.speedPercent}" style="flex:1;accent-color:var(--accent-primary, #007aff);" aria-label="Velocidad de scroll">
                      <button id="btnAutoScrollIncr" class="btn-font-scale-step" style="width:28px;height:28px;padding:0;border-radius:50%;font-size:0.85rem;" aria-label="Subir velocidad">+5</button>
                    </div>
                    <button id="btnToggleAutoScrollPanel" class="btn-top-action-pill ${this.autoScroller.isRunning ? 'active' : ''}" style="width:100%;justify-content:center;padding:6px;font-size:0.8rem;">
                      ${this.autoScroller.isRunning ? '⏸ Parar' : '▶ Iniciar'}
                    </button>
                  </div>
                </div>

                <!-- Menú de opciones (Tres puntos) -->
                <button id="btnMoreOptions" class="btn-more-options-circle" aria-label="Más opciones" type="button">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                </button>
              </div>
            </div>

            <!-- Fila 2 (Inferior): Hero Title y Barra Unificada de Modo e Instrumento -->
            <div class="lyrics-hero-row">
              <div class="lyrics-hero-title-group">
                <h1 class="lyrics-song-title">${safeTitle}</h1>
                <div class="lyrics-song-meta-line">
                  <span class="lyrics-song-artist">${safeArtist}</span>
                  <span class="meta-dot-sep">•</span>
                  <span class="lyrics-song-tuning">Afinación: ${safeTuning}${this.capoFret > 0 ? ` · Capo ${this.capoFret}` : ''}</span>
                </div>
              </div>

              <!-- Cluster Derecho: Toggle Real Deslizante con Sub-opciones de Instrumento Conectadas -->
              <div class="hero-right-controls" role="toolbar" aria-label="Modo de ejecución e instrumento">
                <div class="hero-mode-cluster" id="heroModeCluster">
                  <!-- Toggle Deslizante Físico (Switch Real) -->
                  <div class="performance-mode-segmented-control">
                    <button id="btnPlaySingToggle" class="ui-toggle-switch ${this.performanceMode === 'sing' ? 'is-sing' : 'is-play'}" type="button" role="switch" aria-checked="${this.performanceMode === 'sing'}" title="Alternar entre Modo Tocar y Modo Cantar">
                      <span class="toggle-slider-thumb"></span>
                      <span class="toggle-label opt-play btn-mode-toggle ${this.performanceMode === 'play' ? 'active' : ''}" data-mode="play">🎸 Tocar</span>
                      <span class="toggle-label opt-sing btn-mode-toggle ${this.performanceMode === 'sing' ? 'active' : ''}" data-mode="sing">🎤 Cantar</span>
                    </button>
                  </div>

                  <!-- Sub-opción que nace directamente de "Tocar" (Oculta automáticamente en Modo Cantar) -->
                  <div class="hero-instrument-extension ${this.performanceMode === 'play' ? 'is-expanded' : 'is-collapsed'}" id="heroInstrumentExtension" aria-label="Seleccionar instrumento">
                    <div class="hero-suboption-bridge" title="Instrumento para el modo Tocar">
                      <span class="suboption-bridge-arrow">↳</span>
                      <span class="suboption-bridge-text">Instrumento:</span>
                    </div>
                    <div class="hero-instrument-selector" role="group" aria-label="Instrumento de interpretación">
                      <button class="btn-hero-inst-pill ${this.currentInstrument === 'guitar' ? 'active' : ''}" aria-pressed="${this.currentInstrument === 'guitar'}" data-inst="guitar" type="button" title="Guitarra">
                        <span class="inst-pill-icon">🎸</span>
                        <span class="inst-pill-label">Guitarra</span>
                      </button>
                      <button class="btn-hero-inst-pill ${this.currentInstrument === 'ukulele' ? 'active' : ''}" aria-pressed="${this.currentInstrument === 'ukulele'}" data-inst="ukulele" type="button" title="Ukelele">
                        <span class="inst-pill-icon">🏝️</span>
                        <span class="inst-pill-label">Ukelele</span>
                      </button>
                      <button class="btn-hero-inst-pill ${this.currentInstrument === 'piano' ? 'active' : ''}" aria-pressed="${this.currentInstrument === 'piano'}" data-inst="piano" type="button" title="Piano">
                        <span class="inst-pill-icon">🎹</span>
                        <span class="inst-pill-label">Piano</span>
                      </button>
                    </div>
                  </div>

                  <!-- Indicador sutil para Modo Cantar cuando está activo -->
                  <div class="hero-sing-indicator ${this.performanceMode === 'sing' ? 'is-active' : 'is-hidden'}" id="heroSingIndicator" aria-hidden="${this.performanceMode !== 'sing'}">
                    <span class="sing-mic-icon">🎙️</span>
                    <span class="sing-mic-label">Voz Activa</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <!-- BOTTOM SHEET ESTILO iOS (Herramientas avanzadas) -->
          <div id="lyricsToolsBottomSheetOverlay" style="display: ${this.isOptionsMenuOpen ? 'flex' : 'none'}; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); z-index: 9999; justify-content: center; align-items: flex-end; animation: fadeIn 0.2s;">
            <div class="bottom-sheet-content" role="dialog" aria-modal="true" aria-labelledby="songOptionsTitle">
              
              <div style="width: 40px; height: 5px; background: rgba(255,255,255,0.2); border-radius: 3px; margin: 0 auto 16px;"></div>
              
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 id="songOptionsTitle" style="margin: 0; font-size: 1.1rem; color: var(--text-primary); font-weight: 800;">Ajusta tu ensayo</h3>
                <button id="btnCloseToolsSheet" aria-label="Cerrar más opciones" style="background: rgba(255,255,255,0.1); border: none; color: var(--text-primary); border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; justify-content: center; align-items: center; font-size: 1.2rem; line-height: 1;">&times;</button>
              </div>

              <!-- Modo de interpretación: Tocar o Cantar -->
              <div style="display: flex; background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 12px; overflow: hidden; margin-bottom: 16px;">
                <button id="btnGuiderPlay" class="btn-guider-choice ${this.performanceMode === 'play' ? 'active' : ''}" type="button" style="flex: 1; padding: 10px 12px; border: none; background: ${this.performanceMode === 'play' ? 'var(--accent-primary)' : 'transparent'}; color: ${this.performanceMode === 'play' ? '#fff' : 'var(--text-primary)'}; cursor: pointer; font-weight: 700; font-size: 0.9rem; transition: background 0.2s;">🎸 Modo Tocar</button>
                <button id="btnGuiderSing" class="btn-guider-choice ${this.performanceMode === 'sing' ? 'active' : ''}" type="button" style="flex: 1; padding: 10px 12px; border: none; background: ${this.performanceMode === 'sing' ? 'var(--accent-primary)' : 'transparent'}; color: ${this.performanceMode === 'sing' ? '#fff' : 'var(--text-primary)'}; cursor: pointer; font-weight: 700; font-size: 0.9rem; transition: background 0.2s;">🎤 Modo Cantar</button>
              </div>

              <!-- Vista (Letra / Partitura) — solo si hay partitura -->
              ${this.currentSong?.data ? `
              <div style="display: flex; background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 12px; overflow: hidden; margin-bottom: 16px;">
                <button id="btnModeLyrics" style="flex: 1; padding: 10px 12px; border: none; background: ${this.viewMode === 'lyrics' ? 'var(--accent-primary)' : 'transparent'}; color: ${this.viewMode === 'lyrics' ? '#fff' : 'var(--text-primary)'}; cursor: pointer; font-weight: 700; font-size: 0.9rem; transition: background 0.2s;">🎵 Letra & Acordes</button>
                <button id="btnModeScore" style="flex: 1; padding: 10px 12px; border: none; background: ${this.viewMode === 'score' ? 'var(--accent-primary)' : 'transparent'}; color: ${this.viewMode === 'score' ? '#fff' : 'var(--text-primary)'}; cursor: pointer; font-weight: 700; font-size: 0.9rem; transition: background 0.2s;">🎼 Partitura</button>
              </div>
              ` : ''}

              <details class="song-advanced-options" ${this._advancedOptionsOpen ? 'open' : ''}>
              <summary>Herramientas y exportación <span>Grabación, escenario, PDF y más</span></summary>
              <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px;">
                <button id="btnEnterStageMode" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🎭 Modo Atril (Pantalla Completa)</button>
                <button id="btnOpenBandRoomQuick" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🌐 BandRoom Multijugador P2P</button>
                <button id="btnOpenStageQuick" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🎹 Stage Automation & MIDI</button>
                <button id="btnOpenSpatialQuick" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🥽 HUD Spatial Computing (XR)</button>
                <button id="btnOpenPedalboardQuick" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🎛️ Pedalera Virtual & Smart Tone</button>
                <button id="btnOpenStemsQuick" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🎚️ Separador de Pistas (Stems)</button>
                <button id="btnOpenLooperQuick" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🔁 Smart Looper & Speed Trainer</button>
                <button id="btnOpenSmartBandQuick" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🥁 The Smart Band (Acompañamiento AI)</button>
                <button id="btnOpenArcadeQuick" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🎮 Modo Arcade / Jam Session</button>
                <button id="btnOpenVocalCoachQuick" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🎤 Entrenador Vocal (Pitch Lane)</button>
                <button id="btnOpenTranscriberQuick" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🎼 Transcriptor de Audio / YouTube</button>
                <button id="btnOpenAnalyticsQuick" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">📊 Analíticas de Práctica Musical</button>
                <button id="btnPrintPDF" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🖨️ Exportar Canción (PDF / Imprimir)</button>
                <button id="btnExportSongbookPDF" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">📚 Exportar Cancionero Completo (PDF con Índice)</button>
                <button id="btnOpenShortcutsGuide" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">⌨️ Pedales Bluetooth y Atajos de Escenario</button>
                <button id="btnOpenTunerQuick" class="btn-menu-action" style="justify-content: flex-start; padding: 12px 16px;">🎼 Afinador Cromático</button>
                <button id="btnToggleLiveListen" class="btn-menu-action ${this.isLiveListening ? 'active' : ''}" aria-pressed="${this.isLiveListening}" style="justify-content: flex-start; padding: 12px 16px;">🎤 ${this.isLiveListening ? 'Desactivar escucha activa' : 'Activar escucha activa'}</button>
              </div>
              </details>

              <!-- Ajustes de notación y acordes -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
                <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px;">
                  <label for="selSongNotation" style="display: block; font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 800; margin-bottom: 6px;">Cifrado</label>
                  <select id="selSongNotation" style="background: transparent; border: none; color: var(--text-primary); font-size: 0.9rem; font-weight: 600; cursor: pointer; outline: none; width: 100%;">
                    <option value="anglo" ${this.notationSystem === 'anglo' ? 'selected' : ''}>C, D, E (Anglo)</option>
                    <option value="latin" ${this.notationSystem === 'latin' ? 'selected' : ''}>Do, Re, Mi (Latino)</option>
                  </select>
                </div>
                <div style="background: var(--bg-surface-raised); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px;">
                  <span style="display: block; font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 800; margin-bottom: 6px;">Transponer</span>
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                    <button id="btnSongTransposeDown" type="button" aria-label="Bajar un semitono" ${this.transposeSemitones <= -12 ? 'disabled' : ''} style="background: rgba(255,255,255,0.1); border: none; color: var(--text-primary); width: 44px; height: 44px; border-radius: 6px; cursor: pointer; font-size: 1rem;">−</button>
                    <span style="font-weight: 700; font-size: 0.9rem;">${this.transposeSemitones > 0 ? '+' : ''}${this.transposeSemitones} st</span>
                    <button id="btnSongTransposeUp" type="button" aria-label="Subir un semitono" ${this.transposeSemitones >= 12 ? 'disabled' : ''} style="background: rgba(255,255,255,0.1); border: none; color: var(--text-primary); width: 44px; height: 44px; border-radius: 6px; cursor: pointer; font-size: 1rem;">+</button>
                  </div>
                </div>
              </div>
              
              <div style="display: flex; gap: 8px;">
                <button class="btn-menu-action ${this.isSimplified ? 'active' : ''}" id="btnToggleSimplified" style="flex:1; justify-content: center;">Simplificar acordes</button>
                <button class="btn-menu-action ${this.hideChordsMode ? 'active' : ''}" id="btnToggleHideChords" style="flex:1; justify-content: center;">Ocultar acordes</button>
              </div>

            </div>
          </div>

          ${this.isShortcutsGuideOpen ? `
            <div class="shortcuts-guide-overlay" id="shortcutsGuideOverlay" role="dialog" aria-modal="true" aria-labelledby="shortcutsGuideTitle">
              <div class="shortcuts-guide-card">
                <div class="shortcuts-guide-head"><div><span class="view-header-badge">CONTROL RÁPIDO</span><h2 id="shortcutsGuideTitle">Atajos de ensayo</h2></div><button type="button" id="btnCloseShortcutsGuide" aria-label="Cerrar atajos">×</button></div>
                <p>Funcionan cuando no estás escribiendo en un campo de texto. También son compatibles con pedales Bluetooth que envían teclas.</p>
                <div class="shortcuts-guide-grid">
                  <div><kbd>Espacio</kbd><span>Auto-scroll / pausa</span></div>
                  <div><kbd>Page ↑/↓</kbd><span>Pasar página</span></div>
                  <div><kbd>↑ / ↓</kbd><span>Ajustar velocidad</span></div>
                  <div><kbd>← / →</kbd><span>Cambiar compás</span></div>
                  <div><kbd>M</kbd><span>Metrónomo</span></div>
                  <div><kbd>A</kbd><span>Afinador</span></div>
                  <div><kbd>G</kbd><span>Modo directo</span></div>
                  <div><kbd>Esc</kbd><span>Cerrar paneles</span></div>
                </div>
              </div>
            </div>
          ` : ''}
          <!-- Singer Live Pitch Stage (Modo Cantar) - Experiencia Single-Page centrada en afinación -->
          ${this.performanceMode === 'sing' ? `
            <div class="sing-stage-workspace" id="singStageWorkspace">
              <!-- Letra de canto prominente e integrada -->
              <div class="karaoke-lyrics" aria-label="Letra de canto">
                <p id="karaokeCurrentLine"></p><p id="karaokeNextLine"></p>
              </div>

              <!-- Pista de afinación principal (Pitch Lane) -->
              <div class="singer-pitch-lane-wrapper" style="width: 100%; height: clamp(200px, 28vh, 320px); position: relative; border-radius: 16px; overflow: hidden; margin-top: 8px; border: 1px solid var(--border-subtle); box-shadow: 0 8px 24px rgba(0,0,0,0.25);">
                <canvas id="pitchLaneCanvas" style="display:block; width:100%; height:100%;"></canvas>
              </div>

              <!-- Cinta de Afinación en Tiempo Real -->
              <div class="singer-vocal-ribbon" id="singerVocalRibbon" style="margin-top: 8px;">
                <div class="ribbon-left">
                  <span class="ribbon-live-dot"></span>
                  <span class="ribbon-status-label" id="singerPitchNoteLabel">⏸️ En pausa · Pulsa ▶ para cantar</span>
                </div>
                <div class="ribbon-center">
                  <span class="ribbon-note-big" id="singerNoteBig">—</span>
                  <span class="ribbon-freq-badge font-mono" id="singerFreqBadge">0 Hz</span>
                </div>
                <div class="ribbon-right">
                  <button type="button" class="btn-ribbon-range-finder" id="btnOpenRangeFinder" title="Encuentra tu rango vocal">
                    🎙️ Rango Vocal
                  </button>
                </div>
              </div>

              <!-- Consola de Acompañamiento Condensada y Opciones Secundarias -->
              ${this.renderKaraokePanel()}

              <!-- Banner de Permiso de Micrófono si fue Denegado -->
              <div class="mic-permission-warning-banner" id="micPermissionWarning" style="display: none;">
                <div class="mic-warning-content">
                  <span class="mic-warning-icon">⚠️</span>
                  <div class="mic-warning-info">
                    <strong>Permiso de Micrófono Requerido</strong>
                    <span>La app necesita acceso al micrófono para detectar la afinación de tu voz mientras cantas.</span>
                  </div>
                </div>
                <button type="button" class="btn-request-mic-permission" id="btnRetryMicPermission">
                  🎤 Otorgar Permiso al Micrófono
                </button>
              </div>
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
          <aside class="song-content-audit" aria-label="Estado de verificación">
            <strong>${escapeHTML(quality.label)}</strong>
            <span>${quality.hasTempo ? 'Tempo declarado, sin contrastar con la grabación.' : 'Tempo de la canción sin documentar.'} ${quality.hasChords ? 'Autenticidad y letra completa pendientes de revisión.' : 'No se añadirán acordes inventados.'}</span>
          </aside>
          ${this.isGeneratedChordGuide ? `
            <aside class="generated-guide-notice" role="note" aria-label="Guía armónica aproximada">
              <span class="generated-guide-icon" aria-hidden="true">✦</span>
              <div><strong>Guía armónica aproximada</strong><span>Los acordes se han colocado para ayudarte a practicar y pueden no coincidir con la grabación original.</span></div>
            </aside>
          ` : ''}
          <div class="youtube-companion ${this.isYouTubeCompanionOpen ? 'is-open' : ''}" id="youtubeCompanion" role="dialog" aria-modal="true" aria-label="Vídeo de referencia" ${this.isYouTubeCompanionOpen ? '' : 'hidden'}>
            <div class="youtube-companion-header"><div><strong>Vídeo original</strong><span>Referencia opcional para practicar</span></div><button type="button" id="btnCloseYouTube" aria-label="Cerrar vídeo">×</button></div>
            <form id="youtubeCompanionForm" class="youtube-companion-form" ${this.isYouTubeEditorOpen ? '' : 'hidden'}>
              <label for="youtubeCompanionUrl">Enlace de YouTube</label>
              <div class="youtube-companion-form-row"><input id="youtubeCompanionUrl" type="url" value="${this.currentSong?.youtubeVideoId ? `https://youtu.be/${this.currentSong.youtubeVideoId}` : ''}" placeholder="https://youtu.be/..." autocomplete="off"><button type="submit">Guardar</button></div>
              <p id="youtubeCompanionStatus" role="status" aria-live="polite"></p>
              <button type="button" class="btn-link-subtle" id="btnOpenYouTubeSearch">Buscar versión en YouTube</button>
            </form>
            ${this.isYouTubeCompanionOpen && /^[A-Za-z0-9_-]{11}$/.test(this.currentSong?.youtubeVideoId || '') ? `
            <div class="youtube-pip-container">
              <p class="youtube-reference-note">Vídeo de referencia · reproducción independiente de la letra</p>
              <iframe title="Vídeo de referencia" width="100%" height="270" src="https://www.youtube-nocookie.com/embed/${this.currentSong.youtubeVideoId}?autoplay=0&rel=0" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen style="display: block;"></iframe>
            </div>
          ` : '<div class="youtube-companion-empty">Añade un vídeo para tener una referencia visual durante el ensayo.</div>'}
          </div>
          <button type="button" id="btnToggleYouTube" class="youtube-companion-trigger">${this.currentSong?.youtubeVideoId ? 'Abrir vídeo original' : 'Añadir vídeo original'}</button>
          ${parsedHtml}
        </div>
      </div>
    `;

    this.updateFontSizeInDOM();
    this.bindEvents();

    // Sincronizar estado visual (PitchLane) SIEMPRE después del render
    const globalBottomNav = document.getElementById('bottom-nav-container');
    const isPlayerActive = document.getElementById('score-viewport')?.classList.contains('active-view');

    if (this.performanceMode === 'sing') {
      if (globalBottomNav && isPlayerActive) globalBottomNav.style.display = 'none';

      const canvasEl = this.container.querySelector('#pitchLaneCanvas');
      if (canvasEl) {
        if (this.pitchLane) {
          this.pitchLane.stop();
        }
        {
          this.pitchLane = new PitchLaneCanvas(canvasEl, {
            clock: () => this.getKaraokeClockMs()
          });
          if (this.currentSong?.lyricsChords || this.currentSong?.title) {
            const songTempo = Number(this.currentSong?.tempo) || 72;
            this.pitchLane.setTargetLyrics(this.currentSong?.lyricsChords, songTempo, this.currentSong);
          }
          this.pitchLane.start();
          this.pitchLane.seek(this.getKaraokeClockMs());
          if (this.backing.playing) this.pitchLane.play();
          if (typeof window !== 'undefined') {
            window.__PITCH_LANE_INSTANCE__ = this.pitchLane;
            window.__ACTIVE_LYRICS_VIEW__ = this;
          }
          this._setSingerRibbonPausedState();
          if (this.autoScroller && this.autoScroller.isRunning) {
            this.autoScroller.stop('explicit');
          }

          this._songCompletedUnsub?.();
          this._songCompletedUnsub = events.on('pitchLane:songCompleted', () => {
            if (this.performanceMode === 'sing' && !this._scorecardShown) {
              this._scorecardShown = true;
              this.showVocalScorecard({ reason: 'completed' });
            }
          });
        }
      }
    } else {
      if (globalBottomNav) globalBottomNav.style.display = '';

      if (this.pitchLane) {
        this.pitchLane.stop();
        this.pitchLane = null;
      }
    }
    this.updateKaraokeState();
    if (this.isYouTubeCompanionOpen) {
      this._dialogFocusCleanup = trapModalFocus(this.container.querySelector('#youtubeCompanion'), {
        onClose: () => this.closeYouTubePanel(), returnFocus: () => this.container.querySelector('#btnToggleYouTube'),
      });
    }
    if (this.isOptionsMenuOpen) {
      this._dialogFocusCleanup?.(false);
      this._dialogFocusCleanup = trapModalFocus(this.container.querySelector('#lyricsToolsBottomSheetOverlay [role="dialog"]'), {
        onClose: () => this.closeOptionsMenu(), returnFocus: () => this.container.querySelector('#btnMoreOptions'),
      });
    }
  }

  closeOptionsMenu() {
    this.isOptionsMenuOpen = false;
    this.render();
    this.container.querySelector('#btnMoreOptions')?.focus({ preventScroll: true });
  }

  bindEvents() {
    this.container.querySelector('#btnAssociateLegacyBacking')?.addEventListener('click', async () => {
      if (await this.backing.useLegacyRecording()) {
        this.pitchLane?.setTargetLyrics(this.currentSong.lyricsChords, this.currentSong.tempo, this.currentSong);
        this.updateKaraokeState();
        toast.show('Base asociada. Comprueba que sus tiempos correspondan a esta versión.', 'info', 3000);
      }
    });
    
    this.container.querySelector('#btnOpenToolsSheet')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = true;
      this.render();
    });

    this.container.querySelector('#btnCloseToolsSheet')?.addEventListener('click', () => this.closeOptionsMenu());
    this.container.querySelector('.song-advanced-options')?.addEventListener('toggle', event => {
      this._advancedOptionsOpen = event.currentTarget.open;
    });

    // Close when clicking the overlay background
    this.container.querySelector('#lyricsToolsBottomSheetOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'lyricsToolsBottomSheetOverlay') {
        this.closeOptionsMenu();
      }
    });

    this.container.querySelector('#selInstrumentSheet')?.addEventListener('change', (e) => {
      this.setInstrument(e.target.value);
    });

    this.container.querySelector('#btnPrintPDF')?.addEventListener('click', () => {
      window.print();
    });

    this.container.querySelector('#btnExportSongbookPDF')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      const sheet = this.container?.querySelector('#lyricsToolsBottomSheetOverlay');
      if (sheet) sheet.style.display = 'none';

      import('../data/Exporter.js').then(({ exporter }) => {
        import('../data/SetlistManager.js').then(({ setlistManager }) => {
          const setlistSongs = (typeof setlistManager.getActiveSetlistSongs === 'function')
            ? setlistManager.getActiveSetlistSongs()
            : [];
          const songsToExport = (setlistSongs && setlistSongs.length > 0)
            ? setlistSongs
            : [this.currentSong].filter(Boolean);

          exporter.exportSongbookPDF({
            title: setlistManager.getActiveSetlist?.()?.name || 'Cancionero y Repertorio',
            songs: songsToExport,
            instrument: this.currentInstrument
          });
        });
      });
    });

    this.container.querySelector('#btnBackToExplore')?.addEventListener('click', () => {
      // Detener cualquier loop antes de cambiar de vista evita que el
      // auto-scroll siga moviendo el viewport mientras se navega atrás.
      this.autoScroller?.stop('navigation');
      this.songMetronome?.stop('navigation');
      this.stopSinging();
      if (this.performanceMode === 'sing') {
        const frames = vocalCoachEngine.sessionStats.totalSingingFrames || 0;
        if (frames >= 25 && !this._scorecardShown) {
          this._scorecardShown = true;
          this.showVocalScorecard({
            onClose: () => {
              const globalBottomNav = document.getElementById('bottom-nav-container');
              if (globalBottomNav) globalBottomNav.style.display = '';
              events.emit('ui:switchTab', 'explore');
            }
          });
          return;
        }
      }
      const globalBottomNav = document.getElementById('bottom-nav-container');
      if (globalBottomNav) globalBottomNav.style.display = '';
      events.emit('ui:switchTab', 'explore');
    });

    this.container.querySelector('#btnGuiderPlay')?.addEventListener('click', () => {
      void this.setPerformanceMode('play');
    });

    this.container.querySelector('#btnGuiderSing')?.addEventListener('click', async () => {
      await this.setPerformanceMode('sing');
    });

    this.container.querySelector('#btnOpenRangeFinder')?.addEventListener('click', () => {
      import('./lyrics/VocalRangeFinder.js').then(({ VocalRangeFinder }) => {
        VocalRangeFinder.open({ vocalCoachEngine });
      }).catch(() => toast.show('⚠️ No se pudo abrir el analizador de rango vocal', 'warning'));
    });

    this.container.querySelector('#btnModeLyrics')?.addEventListener('click', () => this.setViewMode('lyrics'));
    this.container.querySelector('#btnModeScore')?.addEventListener('click', () => this.setViewMode('score'));

    // --- Toggle Real Deslizante Tocar / Cantar ---
    const handleToggleMode = async (targetMode) => {
      if (targetMode === this.performanceMode) return;
      await this.setPerformanceMode(targetMode);
      if (targetMode === 'sing') toast.show('Pulsa reproducir para ensayar. Activa el micrófono cuando quieras.', 'info', 2500);
    };

    const playSingToggle = this.container.querySelector('#btnPlaySingToggle');
    playSingToggle?.addEventListener('click', (e) => {
      const labelClicked = e.target.closest('[data-mode]');
      let nextMode;
      if (labelClicked) {
        const clickedMode = labelClicked.dataset.mode;
        // If clicking the currently active mode, toggle to the other mode
        nextMode = clickedMode === this.performanceMode 
          ? (this.performanceMode === 'play' ? 'sing' : 'play')
          : clickedMode;
      } else {
        nextMode = this.performanceMode === 'play' ? 'sing' : 'play';
      }
      handleToggleMode(nextMode);
    });


    // --- Toggle Directo Partitura / Letra (Activar / Desactivar) ---
    const handleScoreToggle = () => {
      const nextMode = this.viewMode === 'score' ? 'lyrics' : 'score';
      this.setViewMode(nextMode);
      toast.show(nextMode === 'score' ? '🎼 Vista Partitura activada' : '📄 Vista Letra y Acordes activada', 'info', 1000);
    };
    this.container.querySelector('#btnToggleScoreView')?.addEventListener('click', handleScoreToggle);
    this.container.querySelector('#btnQuickScoreView')?.addEventListener('click', handleScoreToggle);

    this.container.querySelector('#btnQuickExportPdf')?.addEventListener('click', () => {
      window.print();
    });

    this.container.querySelector('#btnShareSong')?.addEventListener('click', async () => {
      const songTitle = this.currentSong?.title || 'Canción';
      const shareData = {
        title: `${songTitle} · Tabs & Chords PRO`,
        text: `Estoy practicando ${songTitle}${this.currentSong?.artist ? ` de ${this.currentSong.artist}` : ''} en Tabs & Chords PRO.`,
        url: window.location.href
      };
      try {
        if (typeof navigator.share === 'function') {
          await navigator.share(shareData);
          return;
        }
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
          toast.show('Enlace de práctica copiado', 'success', 1400);
        } else {
          toast.show('Copia el enlace desde la barra del navegador', 'info', 1800);
        }
      } catch (error) {
        if (error?.name !== 'AbortError') toast.show('No se pudo compartir todavía', 'warning', 1400);
      }
    });

    this.container.querySelector('#btnSongTopMetronome')?.addEventListener('click', () => this.openSongMetronomePanel());
    this.container.querySelector('#btnStageMetronomeToggle')?.addEventListener('click', () => this.songMetronome.toggle());
    this.container.querySelector('#btnStageMetronomeIncr')?.addEventListener('click', () => this.songMetronome.stepBpm(1));

    this.container.querySelector('#btnToggleYouTube')?.addEventListener('click', () => {
      this.isYouTubeCompanionOpen = true;
      this.isYouTubeEditorOpen = true;
      this.render();
      this.container.querySelector('#youtubeCompanionUrl')?.focus();
    });
    this.container.querySelector('#btnCloseYouTube')?.addEventListener('click', () => {
      this.closeYouTubePanel();
    });
    this.container.querySelector('#youtubeCompanionForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const input = form.querySelector('#youtubeCompanionUrl');
      const status = form.querySelector('#youtubeCompanionStatus');
      const videoId = extractYouTubeVideoId(input?.value || '');
      if (!videoId) {
        input?.setAttribute('aria-invalid', 'true');
        if (status) status.textContent = 'Introduce un enlace válido de YouTube.';
        return;
      }
      input?.setAttribute('aria-invalid', 'false');
      if (this.currentSong) {
        this.currentSong.youtubeVideoId = saveSongYouTubeVideoId(this.currentSong, videoId) || videoId;
      }
      if (status) status.textContent = 'Vídeo guardado para esta canción.';
      this.isYouTubeEditorOpen = false;
      const iframe = this.container.querySelector('.youtube-companion iframe');
      if (iframe) iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1`;
      else this.render();
    });
    this.container.querySelector('#btnOpenYouTubeSearch')?.addEventListener('click', () => {
      window.open(buildYouTubeSearchUrl(this.currentSong), '_blank', 'noopener,noreferrer');
    });

    // --- Selector de Instrumento Integrado en Hero Cluster ---
    this.container.querySelectorAll('.btn-hero-inst-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const inst = btn.dataset.inst;
        if (inst && inst !== this.currentInstrument) {
          this.setInstrument(inst);
          const name = inst === 'ukulele' ? 'Ukelele 🏝️' : (inst === 'piano' ? 'Piano 🎹' : 'Guitarra 🎸');
          toast.show(`Instrumento activo: ${name}`, 'info', 1200);
        }
      });
    });

    this.container.querySelector('#selInstrumentQuick')?.addEventListener('change', (e) => {
      this.setInstrument(e.target.value);
    });

    this.container.querySelector('#selCapoQuick')?.addEventListener('change', (e) => {
      this.setCapo(Number(e.target.value));
    });



    this.container.querySelector('#btnQuickRecordAction')?.addEventListener('click', () => this.toggleRecording());
    this.container.querySelector('#btnStageRecord')?.addEventListener('click', () => this.toggleRecording());
    this.container.querySelector('#btnDownloadRecording')?.addEventListener('click', () => this.audioRecorder.download(this.currentSong?.title));
    this.container.querySelector('#btnDismissRecording')?.addEventListener('click', () => {
      this.audioRecorder.dismiss();
      this.render();
    });

    this.container.querySelector('#btnImportKaraokeBacking')?.addEventListener('click', () => {
      this.container.querySelector('#karaokeBackingFile')?.click();
    });

    this.container.querySelector('#karaokeBackingFile')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const ok = await this.backing.importFile(file);
      event.target.value = '';
      this.updateKaraokeState();
      toast.show(ok ? 'Base guardada para esta canción' : (this.backing.error || 'No se pudo importar la base'), ok ? 'success' : 'warning', 1800);
    });

    this.container.querySelectorAll('[name="karaokeSource"]').forEach((input) => {
      input.addEventListener('change', (event) => {
        this.backing.setMode(event.currentTarget.value);
        this.updateKaraokeState();
      });
    });

    this.container.querySelectorAll('[data-karaoke-track]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextMode = button.dataset.karaokeTrack;
        if (!['original', 'instrumental'].includes(nextMode) || nextMode === this.karaokeTrackMode) return;
        this.karaokeTrackMode = nextMode;
        this.render();
      });
    });

    this.container.querySelector('#karaokeVolume')?.addEventListener('input', (event) => {
      this.backing.setVolume(Number(event.currentTarget.value));
    });
    this.container.querySelector('#karaokeVolume')?.addEventListener('change', () => void this.backing.saveSettings());

    this.container.querySelector('#karaokeOffset')?.addEventListener('input', (event) => {
      this.backing.setOffsetMs(Number(event.currentTarget.value) * 1000);
      if (this.pitchLane) this.pitchLane.seek(this.backing.lyricTimeMs);
      this.updateKaraokeState();
    });
    this.container.querySelector('#karaokeOffset')?.addEventListener('change', () => void this.backing.saveSettings());

    this.container.querySelector('#karaokeTempo')?.addEventListener('change', (event) => {
      if (!event.currentTarget.value || !event.currentTarget.validity.valid) {
        toast.show('Elige un tempo entre 40 y 220 BPM.', 'warning', 2000);
        event.currentTarget.value = this.backing.tempoBpm;
        return;
      }
      this.backing.setTempoBpm(Number(event.currentTarget.value));
      void this.backing.saveSettings();
      toast.show(`Tempo de práctica: ${Math.round(this.backing.tempoBpm)} BPM`, 'info', 900);
    });

    this.container.querySelector('#btnImportKaraokeLyrics')?.addEventListener('click', () => this.container.querySelector('#karaokeLyricsFile')?.click());
    this.container.querySelector('#karaokeLyricsFile')?.addEventListener('change', async event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (!file) return;
      if (await this.backing.importLyrics(file)) {
        this.pitchLane?.setTargetLyrics(this.currentSong.lyricsChords, this.currentSong.tempo, this.currentSong);
        this.pauseSinging();
        toast.show('Letra con tiempos guardada. Lista para ensayar.', 'success', 2200);
      }
    });

    this.container.querySelector('#karaokeSeek')?.addEventListener('input', (event) => {
      this.backing.seek(Number(event.currentTarget.value) * 1000);
      if (this.pitchLane) this.pitchLane.seek(this.backing.lyricTimeMs);
      this.updateKaraokeState();
    });

    this.container.querySelector('#btnRemoveKaraokeBacking')?.addEventListener('click', async () => {
      const removed = await this.backing.removeFile();
      this.updateKaraokeState();
      if (removed) toast.show('Base eliminada. Tus letras con tiempos se conservan.', 'info', 1800);
    });

    this.container.querySelector('#btnKaraokeMic')?.addEventListener('click', async () => {
      if (vocalCoachEngine.isRunning) {
        vocalCoachEngine.stop();
        this.micStatus = 'Micrófono desactivado';
        this.updateKaraokeState();
      } else {
        await this.startSingingMicrophone();
      }
    });

    this.container.querySelector('#btnToggleVocalComfort')?.addEventListener('click', () => {
      const active = this.backing.setVocalComfortMode();
      this.updateKaraokeState();
      import('./Toast.js').then(({ toast }) => {
        toast.show(active ? 'Modo Voz Fácil: mezcla optimizada y menor esfuerzo' : 'Modo Voz Fácil desactivado', 'info', 1500);
      });
    });

    // --- Canto: Controles Flotantes y Sincronización de Audio ---
    this.container.querySelector('#btnSingPlayPause')?.addEventListener('click', async () => {
      if (this.backing?.playing || this.pitchLane?.isPlaying) {
        this.pauseSinging();
        if (this.autoScroller?.isRunning) this.autoScroller.stop('explicit');
      } else {
        await this.playSinging();
      }
      this.updateKaraokeState();
    });

    this.container.querySelector('#btnSingRestart')?.addEventListener('click', () => {
      this.pauseSinging();
      this.backing?.seek(0);
      this.pitchLane?.seek(0);
      this._scorecardShown = false;
      try { vocalCoachEngine.resetSessionStats(); } catch (_) {}
      if (this.autoScroller) {
        this.autoScroller.stop('explicit');
        const el = this.container?.querySelector('#lyricsBodyScroll');
        if (el) el.scrollTop = 0;
      }
      this._setSingerRibbonPausedState();
      this.updateKaraokeState();
    });

    this.container.querySelector('#btnToggleSmartPause')?.addEventListener('click', (e) => {
      this.smartPauseEnabled = !this.smartPauseEnabled;
      const btn = e.currentTarget;
      btn.setAttribute('aria-pressed', String(this.smartPauseEnabled));
      import('./Toast.js').then(({ toast }) => toast.show(this.smartPauseEnabled ? 'Pausa Inteligente Activada' : 'Pausa Inteligente Desactivada', 'info', 2000));
    });

    this.container.querySelector('#btnFinishVocalSession')?.addEventListener('click', () => {
      this.pauseSinging();
      this.showVocalScorecard({ reason: 'user_finish' });
    });

    // --- Patrón de Rasgueo: Escuchar Ritmo Acústico ---
    const btnStrumPreview = this.container.querySelector('#btnPreviewStrumming');
    let strumTimer = null;
    let strumIndex = 0;

    btnStrumPreview?.addEventListener('click', async () => {
      const isPlaying = btnStrumPreview.classList.contains('playing');
      const arrows = this.container.querySelectorAll('.strum-pattern-arrows .strum-arrow');
      const tempo = parseInt(btnStrumPreview.dataset.tempo, 10) || 120;
      const beatMs = Math.round((60 / tempo) * 1000 / 2); // Corchea (eighth note)

      if (isPlaying) {
        clearInterval(strumTimer);
        strumTimer = null;
        btnStrumPreview.classList.remove('playing');
        const icon = btnStrumPreview.querySelector('.strum-play-icon');
        const label = btnStrumPreview.querySelector('.strum-play-label');
        if (icon) icon.textContent = '▶';
        if (label) label.textContent = 'Escuchar';
        arrows.forEach(p => p.classList.remove('pulse-active'));
        return;
      }

      const ctx = chordEngine.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }

      btnStrumPreview.classList.add('playing');
      const icon = btnStrumPreview.querySelector('.strum-play-icon');
      const label = btnStrumPreview.querySelector('.strum-play-label');
      if (icon) icon.textContent = '⏹';
      if (label) label.textContent = 'Pausar';

      // Obtener el primer acorde real de la canción para que el rasgueo suene afinado a la canción
      const firstChordCard = this.container.querySelector('.song-chord-visual-card');
      const sampleChord = firstChordCard?.dataset?.chord || firstChordCard?.dataset?.originalChord || 'G';

      // Mapeo rítmico de 8 corcheas a las 6 flechas: [arrow0, null, arrow1, arrow2, null, arrow3, arrow4, arrow5]
      const stepToArrow = [0, null, 1, 2, null, 3, 4, 5];
      const strokeTypes = ['down', null, 'down', 'up', null, 'up', 'down', 'up'];

      strumIndex = 0;
      const playStep = () => {
        const arrowIdx = stepToArrow[strumIndex];
        arrows.forEach((arr, idx) => arr.classList.toggle('pulse-active', idx === arrowIdx));
        const stroke = strokeTypes[strumIndex];
        if (stroke) {
          try {
            chordEngine.strumGuitar(sampleChord, stroke, tempo);
          } catch (e) {
            console.warn('[StrumPreview] Audio error:', e);
          }
        }
        strumIndex = (strumIndex + 1) % stepToArrow.length;
      };

      playStep();
      strumTimer = setInterval(playStep, beatMs);
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
    this._removeSpeedPanelOutsideListener?.();
    const closeSpeedPanelOnOutsideClick = (e) => {
      if (speedPanel && speedPanel.style.display === 'flex') {
        if (!speedPanel.contains(e.target) && e.target !== speedBtn) {
          speedPanel.style.display = 'none';
        }
      }
    };
    document.addEventListener('click', closeSpeedPanelOnOutsideClick);
    this._removeSpeedPanelOutsideListener = () => {
      document.removeEventListener('click', closeSpeedPanelOnOutsideClick);
      this._removeSpeedPanelOutsideListener = null;
    };

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
    this.container.querySelector('#btnSongTransposeDown')?.addEventListener('click', () => this.setTranspose(this.transposeSemitones - 1));
    this.container.querySelector('#btnSongTransposeUp')?.addEventListener('click', () => this.setTranspose(this.transposeSemitones + 1));

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

    this.container.querySelector('#btnOpenShortcutsGuide')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.isShortcutsGuideOpen = true;
      this.render();
    });
    this.container.querySelector('#btnCloseShortcutsGuide')?.addEventListener('click', () => {
      this.isShortcutsGuideOpen = false;
      this.render();
    });
    this.container.querySelector('#shortcutsGuideOverlay')?.addEventListener('click', (event) => {
      if (event.target.id === 'shortcutsGuideOverlay') {
        this.isShortcutsGuideOpen = false;
        this.render();
      }
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
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('bandRoom:open');
    });

    this.container.querySelector('#btnOpenStageQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('stageAutomation:open');
    });

    this.container.querySelector('#btnOpenSpatialQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('spatialXR:open');
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

  getSingModeVideoId() {
    if (!this.currentSong) return null;
    if (this.karaokeTrackMode === 'instrumental') {
      return this.currentSong.karaokeVideoId || this.currentSong.backingTrackVideoId || this.currentSong.youtubeVideoId || null;
    }
    return this.currentSong.youtubeVideoId || null;
  }

  showVocalScorecard(options = {}) {
    import('./lyrics/VocalScorecardModal.js').then(({ VocalScorecardModal }) => {
      import('../audio/VocalCoachEngine.js').then(({ vocalCoachEngine }) => {
        VocalScorecardModal.show({
          songTitle: this.currentSong?.title || 'Canción Actual',
          artist: this.currentSong?.artist || '',
          sessionStats: vocalCoachEngine.sessionStats,
          hasMelodyReference: Boolean(this.pitchLane?.targetBlocks.length),
          onClose: () => {
            this._scorecardShown = true;
            if (options.onClose) options.onClose();
          },
          onRetry: () => {
            try { vocalCoachEngine.resetSessionStats(); } catch (_) {}
            this._scorecardShown = false;
            this.pauseSinging();
            this.backing.seek(0);
            this.pitchLane?.seek(0);
            void this.playSinging();
            if (options.onRetry) options.onRetry();
          }
        });
      });
    });
  }

  openSongMetronomePanel() {
    if (!this.currentSong || !this.container) return;
    let overlay = this.container.querySelector('#songMetronomeOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'songMetronomeOverlay';
      overlay.className = 'studio-modal-overlay song-metronome-overlay';
      overlay.innerHTML = `
        <section class="studio-modal-card song-metronome-card" role="dialog" aria-modal="true" aria-labelledby="songMetroTitle">
          <button type="button" class="studio-modal-close" id="btnCloseSongMetronome" aria-label="Cerrar metrónomo">×</button>
          <p class="eyebrow">Ritmo de práctica</p>
          <h2 id="songMetroTitle">Metrónomo de canción</h2>
          <div class="song-metro-display"><span id="songMetroTempoName">${this.songMetronome.getTempoName()}</span><strong id="songMetroBpmDisplay">${this.songMetronome.bpm}</strong><span>BPM</span></div>
          <div class="song-metro-stepper"><button type="button" id="songMetroMinus">−</button><input id="songMetroBpmRange" type="range" min="30" max="280" value="${this.songMetronome.bpm}" aria-label="Tempo del metrónomo"><button type="button" id="songMetroPlus">+</button></div>
          <div class="song-metro-options" role="group" aria-label="Compás">
            ${['2/4','3/4','4/4','6/8','12/8'].map(ts => `<button type="button" class="metro-option ${this.songMetronome.timeSignature === ts ? 'active' : ''}" data-metro-signature="${ts}">${ts}</button>`).join('')}
          </div>
          <div class="song-metro-options" role="group" aria-label="Cuenta atrás"><span class="song-metro-label">Cuenta atrás</span>${[0,1,2,4].map(n => `<button type="button" class="metro-option ${this.songMetronome.countInMeasures === n ? 'active' : ''}" data-metro-countin="${n}">${n === 0 ? 'No' : `${n} compás${n > 1 ? 'es' : ''}`}</button>`).join('')}</div>
          <button type="button" class="btn-primary studio-modal-main-action" id="btnSongMetroToggle">${this.songMetronome.isRunning ? 'Pausar metrónomo' : 'Iniciar metrónomo'}</button>
        </section>`;
      this.container.appendChild(overlay);
      overlay.addEventListener('click', (event) => { if (event.target === overlay) this.closeSongMetronomePanel(); });
      overlay.querySelector('#btnCloseSongMetronome')?.addEventListener('click', () => this.closeSongMetronomePanel());
      overlay.querySelector('#songMetroMinus')?.addEventListener('click', () => this.songMetronome.stepBpm(-1));
      overlay.querySelector('#songMetroPlus')?.addEventListener('click', () => this.songMetronome.stepBpm(1));
      overlay.querySelector('#songMetroBpmRange')?.addEventListener('input', (event) => this.songMetronome.setBpm(event.target.value));
      overlay.querySelector('#btnSongMetroToggle')?.addEventListener('click', () => this.songMetronome.toggle());
      overlay.querySelectorAll('[data-metro-signature]').forEach(btn => btn.addEventListener('click', () => this.songMetronome.setTimeSignature(btn.dataset.metroSignature)));
      overlay.querySelectorAll('[data-metro-countin]').forEach(btn => btn.addEventListener('click', () => this.songMetronome.setCountIn(btn.dataset.metroCountin)));
    }
    overlay.hidden = false;
    overlay.classList.add('active');
    this.updateSongMetronomeDOM();
    this._dialogFocusCleanup?.(false);
    this._dialogFocusCleanup = trapModalFocus(overlay, {
      onClose: () => this.closeSongMetronomePanel(), returnFocus: () => this.container.querySelector('#btnSongTopMetronome'),
    });
  }

  closeSongMetronomePanel() {
    const overlay = this.container?.querySelector('#songMetronomeOverlay');
    if (overlay && !overlay.hidden) {
      overlay.hidden = true; overlay.classList.remove('active');
      this._dialogFocusCleanup?.(); this._dialogFocusCleanup = null;
    }
  }

  closeYouTubePanel() {
    this.isYouTubeCompanionOpen = this.isYouTubeEditorOpen = false;
    this.render();
    this.container.querySelector('#btnToggleYouTube')?.focus({ preventScroll: true });
  }

  updateSongMetronomeDOM() {
    const topButton = this.container?.querySelector('#btnSongTopMetronome');
    const stageButton = this.container?.querySelector('#btnStageMetronomeToggle');
    const label = this.songMetronome.isRunning ? 'Pausar metrónomo' : 'Iniciar metrónomo';
    if (topButton) {
      topButton.setAttribute('aria-pressed', String(this.songMetronome.isRunning));
      topButton.setAttribute('aria-label', label);
      const text = topButton.querySelector('.tool-btn-label');
      if (text) text.textContent = `${this.songMetronome.bpm} BPM`;
      topButton.classList.toggle('active', this.songMetronome.isRunning);
    }
    if (stageButton) {
      if (stageButton.firstChild?.nodeType === Node.TEXT_NODE) {
        stageButton.firstChild.textContent = this.songMetronome.isRunning ? 'Pausa ' : 'Metrónomo ';
      }
      const bpmLabel = stageButton.querySelector('#lblStageMetronomeBpm');
      if (bpmLabel) bpmLabel.textContent = String(this.songMetronome.bpm);
      stageButton.classList.toggle('active', this.songMetronome.isRunning);
      stageButton.setAttribute('aria-label', label);
      stageButton.setAttribute('aria-pressed', String(this.songMetronome.isRunning));
    }
    const root = this.container?.querySelector('#songMetronomeOverlay');
    if (!root) return;
    const m = this.songMetronome;
    const bpm = root.querySelector('#songMetroBpmDisplay');
    const tempo = root.querySelector('#songMetroTempoName');
    const range = root.querySelector('#songMetroBpmRange');
    const toggle = root.querySelector('#btnSongMetroToggle');
    if (bpm) bpm.textContent = String(m.bpm);
    if (tempo) tempo.textContent = m.getTempoName();
    if (range) range.value = String(m.bpm);
    if (toggle) toggle.textContent = m.isRunning ? 'Pausar metrónomo' : 'Iniciar metrónomo';
    root.querySelectorAll('[data-metro-signature]').forEach(btn => btn.classList.toggle('active', btn.dataset.metroSignature === m.timeSignature));
    root.querySelectorAll('[data-metro-countin]').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.metroCountin) === m.countInMeasures));
  }

  destroy() {
    this._dialogFocusCleanup?.(false);
    this.savePracticeSession();
    this.stopSinging();
    this.autoScroller?.stop('explicit');
    this._removeSpeedPanelOutsideListener?.();
    this.songMetronome?.destroy();
    this.backing?.destroy();
    super.destroy();
  }
}

export default LyricsChordsView;
