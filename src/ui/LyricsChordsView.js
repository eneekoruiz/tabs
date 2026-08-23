/**
 * @file LyricsChordsView.js
 * @description Music workspace for lyrics, chords, rehearsal controls and session recovery.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { audioEngine } from '../core/AudioEngineV2.js';
import { chordEngine } from '../tools/ChordEngine.js';
import { pitchDetector } from '../audio/PitchDetector.js';
import { onlineSongProvider } from '../data/OnlineSongProvider.js';
import { SessionRecovery } from '../data/SessionRecovery.js';
import { toast } from './Toast.js';
import { ChordProParser } from './lyrics/ChordProParser.js';
import { ChordDiagramRenderer } from './lyrics/ChordDiagramRenderer.js';
import { SongAutoScroller } from './lyrics/SongAutoScroller.js';
import { SongAudioRecorder } from './lyrics/SongAudioRecorder.js';
import { ChordPopoverModal } from './lyrics/ChordPopoverModal.js';
import { SongMetronomeCompanion } from './lyrics/SongMetronomeCompanion.js';
import {
  buildYouTubeSearchUrl,
  getSongYouTubeVideoId,
  saveSongYouTubeVideoId
} from './lyrics/YouTubeCompanion.js';

const SECTION_PATTERN = /^\[(Intro|Verse|Chorus|Bridge|Outro|Solo|Pre-Chorus|Estribillo|Verso)[^\]]*\]$/i;
const VALID_INSTRUMENTS = new Set(['guitar', 'piano', 'ukulele']);
const VALID_THEMES = new Set(['paper', 'oled', 'amber']);

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

const safeStorageGet = (key, fallback = '') => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch (error) {
    return fallback;
  }
};

const safeStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
  } catch (error) {
    console.warn(`[LyricsChordsView] No se pudo guardar ${key}:`, error);
  }
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const normalizeLyrics = (value) => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return value.chordpro || value.lyrics || value.text || '';
};

const normalizeLabel = (value, fallback) => {
  const label = String(value || '').trim();
  return label || fallback;
};

const simplifyChordPro = (rawLyrics) => rawLyrics.replace(/\[([A-G][#b]?)([^\]]*)\]/g, (match, root, suffix) => {
  const normalizedSuffix = String(suffix || '').replace(/\/.*$/, '');
  if (/^maj/i.test(normalizedSuffix)) return `[${root}]`;
  if (/^m(?!aj)/i.test(normalizedSuffix)) return `[${root}m]`;
  if (/^(dim|o)/i.test(normalizedSuffix)) return `[${root}dim]`;
  if (/^(aug|\+)/i.test(normalizedSuffix)) return `[${root}aug]`;
  return `[${root}]`;
});

export class LyricsChordsView extends Component {
  constructor(container) {
    super(container);

    this.sessionRecovery = new SessionRecovery();
    this.recoveredSession = this.sessionRecovery.read();
    this.currentSong = this.recoveredSession?.song || null;
    this.transposeSemitones = clamp(this.recoveredSession?.transposeSemitones, -12, 12);
    this.capoFret = clamp(this.recoveredSession?.capoFret, 0, 12);
    this.fontSizeScale = clamp(
      this.recoveredSession?.fontSizeScale ?? parseInt(safeStorageGet('lyrics_font_scale', '100'), 10),
      80,
      180
    ) || 100;
    this.viewMode = this.recoveredSession?.viewMode === 'score' ? 'score' : 'lyrics';
    this.currentInstrument = VALID_INSTRUMENTS.has(this.recoveredSession?.instrument)
      ? this.recoveredSession.instrument
      : (VALID_INSTRUMENTS.has(safeStorageGet('app_instrument')) ? safeStorageGet('app_instrument') : 'guitar');
    this.visualTheme = VALID_THEMES.has(this.recoveredSession?.visualTheme)
      ? this.recoveredSession.visualTheme
      : (VALID_THEMES.has(safeStorageGet('app_visual_theme')) ? safeStorageGet('app_visual_theme') : 'paper');
    this.notationSystem = this.recoveredSession?.notationSystem === 'latin'
      ? 'latin'
      : (safeStorageGet('app_notation') === 'latin' ? 'latin' : 'anglo');
    this.hideChordsMode = Boolean(this.recoveredSession?.hideChordsMode);
    this.isSimplified = Boolean(this.recoveredSession?.isSimplified ?? (safeStorageGet('app_simplified_chords') === 'true'));
    this.isLiveListening = false;
    this.liveListeningError = '';
    this.isStageMode = false;
    this.isInstrumentMenuOpen = false;
    this.isOptionsMenuOpen = false;
    this.isYouTubePanelOpen = false;
    this.isMetronomePanelOpen = false;
    this.isPlayerVisible = false;
    this.autoScrollIntent = Boolean(this.recoveredSession?.autoScroll?.isRunning);
    this.activeSectionId = this.recoveredSession?.activeSectionId || '';
    this.pendingScrollTop = this.recoveredSession?.scrollTop ?? null;
    this.sections = this.extractSections(normalizeLyrics(this.currentSong?.lyricsChords));
    this.currentVersionKey = '';
    this.showRestoredNotice = Boolean(this.currentSong);
    this.wakeLockSentinel = null;
    this.scrollRaf = null;
    this.renderCycle = 0;
    this.songLoadRequest = 0;
    this.dockObserver = null;
    this.restoredNoticeTimer = null;
    this.recoveryResumePending = Boolean(this.currentSong);
    this.recoveryResumeTimer = null;
    this.recoveryReadyUnsub = null;
    this.recoveryScoreLoadPending = false;
    this.recoveryScoreLoadTimer = null;

    this.autoScroller = new SongAutoScroller({
      initialSpeed: clamp(this.recoveredSession?.autoScroll?.speedPercent ?? 25, 1, 100),
      onStateChange: () => {
        this.syncContextualState();
        this.scheduleSessionSave();
      },
      onEnd: () => this.handleAutoScrollEnd()
    });

    this.songMetronome = new SongMetronomeCompanion({
      song: this.currentSong,
      onStateChange: () => {
        this.syncContextualState();
        this.updateMetronomeInDOM();
      },
      onBeat: (beatInfo) => {
        this.handleMetronomeBeat(beatInfo);
      },
      onCountInComplete: () => {
        this.handleMetronomeCountInComplete();
      }
    });

    let previousRecordingState = false;
    let previousRecordingUrl = null;
    this.audioRecorder = new SongAudioRecorder({
      onStateChange: (recordingState = {}) => {
        const shouldRender = previousRecordingState !== Boolean(recordingState.isRecording)
          || previousRecordingUrl !== (recordingState.url || null);
        previousRecordingState = Boolean(recordingState.isRecording);
        previousRecordingUrl = recordingState.url || null;
        this.syncContextualState();
        if (shouldRender) this.render();
        else this.updateRecordingTimerInDOM();
      }
    });

    this.chordPopover = new ChordPopoverModal({
      instrument: this.currentInstrument,
      notation: this.notationSystem
    });

    safeStorageSet('app_instrument', this.currentInstrument);
    safeStorageSet('app_visual_theme', this.visualTheme);
    safeStorageSet('app_notation', this.notationSystem);
    safeStorageSet('lyrics_font_scale', this.fontSizeScale);
    chordEngine.setInstrument(this.currentInstrument);

    this.ensureWorkspaceStyles();
    this.initEvents();
    this.initDocumentListeners();
    this.initScrollTracking();
    this.initBottomDockCompatibility();

    if (this.currentSong) this.scheduleRecoveredSessionResume();
  }

  ensureWorkspaceStyles() {
    if (document.querySelector('link[data-song-workspace-styles]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../../assets/css/components/song-workspace.css', import.meta.url).href;
    link.dataset.songWorkspaceStyles = 'true';
    document.head.appendChild(link);
  }

  initEvents() {
    this.registerUnsub(events.on('score:loaded', () => {
      if (this.recoveryResumePending) return;

      if (this.recoveryScoreLoadPending) {
        this.recoveryScoreLoadPending = false;
        if (this.recoveryScoreLoadTimer) clearTimeout(this.recoveryScoreLoadTimer);
        this.recoveryScoreLoadTimer = null;
        const recoveredSong = this.recoveredSession?.song;
        if (recoveredSong?.title) {
          state.set('activeSong', recoveredSong);
          this.currentSong = { ...this.currentSong, ...recoveredSong };
          this.currentVersionKey = String(recoveredSong.versionId ?? recoveredSong.selectedVersionId ?? '');
          this.syncContextualState();
          this.saveSessionNow();
        }
        return;
      }

      const activeSong = state.get('activeSong');
      const isInitialDemo = this.recoveredSession
        && activeSong?.title === 'Tabs & Chords PRO'
        && this.currentSong?.title === this.recoveredSession.song?.title;
      if (!isInitialDemo && activeSong?.title) this.handleSongLoad(activeSong);
    }));

    this.registerUnsub(events.on('ui:loadLyricsSong', (song) => this.handleSongLoad(song)));

    this.registerUnsub(events.on('settings:accidentalsChanged', (preference) => {
      this.render();
      this.announce(preference === 'flats' ? 'Acordes escritos con bemoles' : 'Acordes escritos con sostenidos');
    }));

    this.registerUnsub(events.on('ui:switchTab', (tabName) => {
      this.isPlayerVisible = tabName === 'player';
      if (!this.isPlayerVisible && this.songMetronome?.isRunning) {
        this.songMetronome.stop('tab_switch');
      }
      if (this.isPlayerVisible && this.autoScrollIntent && !this.autoScroller.isRunning) {
        setTimeout(() => {
          if (this.isPlayerVisible && this.autoScrollIntent) this.autoScroller.start();
        }, 120);
      } else if (!this.isPlayerVisible && this.autoScroller.isRunning) {
        this.autoScroller.pause();
      }
      this.scheduleSessionSave();
    }));

    this.registerUnsub(events.on('song:transpose', (step) => {
      this.setTranspose(this.transposeSemitones + Number(step || 0));
    }));

    this.registerUnsub(events.on('song:toggleAutoScroll', () => this.toggleAutoScroll()));
    this.registerUnsub(events.on('song:stepAutoScrollSpeed', (delta) => {
      this.setAutoScrollSpeed(this.autoScroller.speedPercent + Number(delta || 0));
    }));
    this.registerUnsub(events.on('song:setAutoScrollSpeed', (speed) => {
      this.setAutoScrollSpeed(Number(speed || 50));
    }));
    this.registerUnsub(events.on('song:toggleRecording', (options) => {
      this.toggleRecording(Boolean(options?.video));
    }));

    this.registerUnsub(events.on('song:toggleMetronome', () => {
      this.songMetronome.toggle();
    }));
    this.registerUnsub(events.on('song:stepMetronomeBpm', (delta) => {
      this.songMetronome.stepBpm(delta);
    }));
    this.registerUnsub(events.on('song:setMetronomeBpm', (bpm) => {
      this.songMetronome.setBpm(bpm);
    }));
    this.registerUnsub(events.on('song:tapMetronome', () => {
      this.songMetronome.handleTapTempo();
    }));
    this.registerUnsub(events.on('song:openMetronomePanel', () => {
      this.isMetronomePanelOpen = true;
      this.render();
      requestAnimationFrame(() => {
        this.container.querySelector('#rngSongMetroBpm')?.focus();
      });
    }));
    this.registerUnsub(events.on('song:closeMetronomePanel', () => {
      this.isMetronomePanelOpen = false;
      this.render();
    }));

    this.registerUnsub(events.on('song:enterStageMode', () => this.enterStageMode()));
    this.registerUnsub(events.on('song:exitStageMode', () => this.exitStageMode()));

    this.registerUnsub(events.on('tuner:pitch', (pitch) => {
      if (this.isLiveListening && pitch?.note) this.handleLiveChordDetected(pitch.note);
    }));

    this.registerUnsub(events.on('pitch:error', () => {
      if (!this.isLiveListening) return;
      this.isLiveListening = false;
      this.liveListeningError = 'No se pudo continuar la escucha. Revisa el permiso del micrófono.';
      this.render();
      this.announce(this.liveListeningError);
      toast.show(this.liveListeningError, 'error', 3200);
    }));
  }

  initDocumentListeners() {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && this.isStageMode) this.exitStageMode();
    };
    const onDocumentClick = (event) => {
      if (!this.isInstrumentMenuOpen && !this.isOptionsMenuOpen) return;
      if (this.container?.contains(event.target)) return;
      this.closeMenus();
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (this.isInstrumentMenuOpen || this.isOptionsMenuOpen) {
        event.preventDefault();
        this.closeMenus(true);
      }
    };
    const onPageHide = () => this.saveSessionNow();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && this.isStageMode) this.requestScreenWakeLock();
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    this.registerUnsub(() => document.removeEventListener('fullscreenchange', onFullscreenChange));
    this.registerUnsub(() => document.removeEventListener('click', onDocumentClick));
    this.registerUnsub(() => document.removeEventListener('keydown', onKeyDown));
    this.registerUnsub(() => document.removeEventListener('visibilitychange', onVisibilityChange));
    this.registerUnsub(() => window.removeEventListener('pagehide', onPageHide));
  }

  initScrollTracking() {
    const scrollElement = this.getScrollElement();
    const onScroll = () => {
      if (this.scrollRaf) return;
      this.scrollRaf = requestAnimationFrame(() => {
        this.scrollRaf = null;
        this.updateActiveSectionFromScroll();
        this.scheduleSessionSave();
      });
    };

    scrollElement?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    this.registerUnsub(() => scrollElement?.removeEventListener('scroll', onScroll));
    this.registerUnsub(() => window.removeEventListener('scroll', onScroll));
  }

  initBottomDockCompatibility() {
    const dockContainer = document.getElementById('bottom-nav-container');
    if (!dockContainer) return;
    this.dockObserver = new MutationObserver(() => this.syncBottomDockAliases());
    this.dockObserver.observe(dockContainer, { childList: true, subtree: true });
    this.syncBottomDockAliases();
  }

  syncBottomDockAliases() {
    const bottomBackButton = document.getElementById('btnBottomExitSong');
    if (bottomBackButton) {
      bottomBackButton.hidden = true;
      bottomBackButton.tabIndex = -1;
      bottomBackButton.setAttribute('aria-hidden', 'true');
    }

    const aliases = [
      ['btnBottomTransposeDown', 'btnTransposeMinus', null],
      ['btnBottomTransposeUp', 'btnTransposePlus', null],
      ['btnBottomToggleAutoScroll', 'btnToggleAutoScroll', 'span:last-of-type'],
      ['btnBottomScrollSpeedDecr', 'btnAutoScrollDecr', null],
      ['btnBottomScrollSpeedIncr', 'btnAutoScrollIncr', null],
      ['lblBottomScrollSpeed', 'lblAutoScrollPercent', null],
      ['btnBottomToggleRecord', 'btnQuickRecordAction', 'span:last-of-type']
    ];

    aliases.forEach(([dockId, legacyId, preferredSelector]) => {
      const control = document.getElementById(dockId);
      if (!control) return;

      let alias = document.getElementById(legacyId);
      if (!alias || !control.contains(alias)) {
        if (alias) return;
        alias = preferredSelector ? control.querySelector(preferredSelector) : null;
        if (!alias) {
          alias = document.createElement('span');
          alias.textContent = control.textContent.trim();
          control.textContent = '';
          control.appendChild(alias);
        }
        alias.id = legacyId;
        alias.dataset.workspaceDockAlias = 'true';
      }
      alias.classList.toggle('active', control.classList.contains('active'));
      alias.classList.toggle('recording-active', control.classList.contains('recording-active'));
    });

    const autoScrollButton = document.getElementById('btnBottomToggleAutoScroll');
    if (autoScrollButton) {
      autoScrollButton.setAttribute('aria-describedby', 'lblBottomScrollSpeed');
    }

    const transposeBadge = document.getElementById('lblBottomTranspose');
    let resetAlias = document.getElementById('btnTransposeReset');
    if (transposeBadge && !resetAlias) {
      resetAlias = document.createElement('span');
      resetAlias.id = 'btnTransposeReset';
      resetAlias.dataset.workspaceDockAlias = 'true';
      resetAlias.tabIndex = 0;
      resetAlias.role = 'button';
      resetAlias.setAttribute('aria-label', 'Restablecer transposición');
      const reset = (event) => {
        event.stopPropagation();
        this.setTranspose(0);
      };
      resetAlias.addEventListener('click', reset);
      resetAlias.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          reset(event);
        }
      });
      transposeBadge.textContent = '';
      transposeBadge.appendChild(resetAlias);
    }
    if (resetAlias) {
      resetAlias.textContent = (this.transposeSemitones > 0 ? '+' : '') + this.transposeSemitones;
    }

    this.updateAutoScrollControlsInDOM();
  }

  scheduleRecoveredSessionResume() {
    const resume = () => {
      if (!this.recoveryResumePending || !state.get('isPlayerReady')) return;
      this.recoveryResumePending = false;
      if (this.recoveryResumeTimer) clearTimeout(this.recoveryResumeTimer);
      this.recoveryResumeTimer = null;
      this.recoveryReadyUnsub?.();
      this.recoveryReadyUnsub = null;
      this.resumeRecoveredSession().catch((error) => {
        console.warn('[LyricsChordsView] No se pudo recuperar la sesión:', error);
      });
    };
    const waitForReady = () => {
      if (!this.recoveryResumePending) return;
      if (state.get('isPlayerReady')) resume();
      else this.recoveryResumeTimer = setTimeout(waitForReady, 250);
    };

    this.recoveryReadyUnsub = events.on('player:ready', resume);
    this.recoveryResumeTimer = setTimeout(waitForReady, 2500);
    this.registerUnsub(() => {
      this.recoveryReadyUnsub?.();
      this.recoveryReadyUnsub = null;
      if (this.recoveryResumeTimer) clearTimeout(this.recoveryResumeTimer);
      this.recoveryResumeTimer = null;
    });
  }

  async resumeRecoveredSession() {
    const session = this.recoveredSession;
    if (!session?.song?.title || !state.get('isPlayerReady')) return;

    state.set('activeSong', session.song);
    events.emit('ui:switchTab', 'player');
    await this.handleSongLoad(session.song, { force: true, restoredSession: session });

    if (session.song.data === undefined) return;
    this.recoveryScoreLoadPending = true;
    if (this.recoveryScoreLoadTimer) clearTimeout(this.recoveryScoreLoadTimer);
    this.recoveryScoreLoadTimer = setTimeout(() => {
      this.recoveryScoreLoadPending = false;
      this.recoveryScoreLoadTimer = null;
      state.set('activeSong', session.song);
    }, 8000);
    audioEngine.loadScoreToAlphaTab(session.song.data);
  }

  async handleSongLoad(song, options = {}) {
    if (!song?.title || song.title === 'Sin partitura') return;

    const incomingIdentity = this.getSongIdentity(song);
    const currentIdentity = this.getSongIdentity(this.currentSong);
    const isSameSong = incomingIdentity && incomingIdentity === currentIdentity;

    if (isSameSong && !options.force && normalizeLyrics(this.currentSong?.lyricsChords)) {
      this.currentSong = { ...song, ...this.currentSong };
      this.render();
      return;
    }

    if (this.currentSong && !isSameSong) this.saveSessionNow();
    const requestId = ++this.songLoadRequest;
    this.currentSong = { ...song };

    if (options.restoredSession) {
      this.applyRecoveredState(options.restoredSession);
    } else {
      const storedTheme = safeStorageGet('app_visual_theme');
      if (VALID_THEMES.has(storedTheme)) this.visualTheme = storedTheme;
      this.transposeSemitones = clamp(song.transposeSemitones ?? 0, -12, 12);
      this.capoFret = clamp(song.capoFret ?? song.capo ?? 0, 0, 12);
      this.viewMode = 'lyrics';
      this.activeSectionId = '';
      this.pendingScrollTop = 0;
    }

    this.currentVersionKey = options.versionKey || String(song.versionId ?? song.selectedVersionId ?? '');
    this.audioRecorder.dismiss();
    this.songMetronome.setSong(this.currentSong);

    try {
      if (!normalizeLyrics(this.currentSong.lyricsChords)) {
        const songSheet = await onlineSongProvider.getSongLyrics(this.currentSong.title, this.currentSong.artist);
        if (requestId !== this.songLoadRequest) return;
        this.currentSong.lyricsChords = normalizeLyrics(songSheet);
        this.currentSong.contentSource = typeof songSheet === 'string'
          ? 'curated_lyrics'
          : (songSheet?.source || 'generated_chord_guide');
      }
    } catch (error) {
      console.warn('Error obteniendo el contenido local de acordes:', error);
    }

    this.sections = this.extractSections(normalizeLyrics(this.currentSong.lyricsChords));
    this.render();
    this.syncContextualState();
    this.scheduleSessionSave();
  }

  applyRecoveredState(session) {
    this.transposeSemitones = clamp(session.transposeSemitones, -12, 12);
    this.capoFret = clamp(session.capoFret, 0, 12);
    this.fontSizeScale = clamp(session.fontSizeScale, 80, 180) || 100;
    this.currentInstrument = VALID_INSTRUMENTS.has(session.instrument) ? session.instrument : 'guitar';
    this.visualTheme = VALID_THEMES.has(session.visualTheme) ? session.visualTheme : 'paper';
    this.notationSystem = session.notationSystem === 'latin' ? 'latin' : 'anglo';
    this.hideChordsMode = Boolean(session.hideChordsMode);
    this.isSimplified = Boolean(session.isSimplified);
    this.viewMode = session.viewMode === 'score' && session.song?.data ? 'score' : 'lyrics';
    this.activeSectionId = session.activeSectionId || '';
    this.pendingScrollTop = session.scrollTop ?? 0;
    this.autoScrollIntent = Boolean(session.autoScroll?.isRunning);
    this.autoScroller.setSpeed(clamp(session.autoScroll?.speedPercent ?? 25, 1, 100));
    chordEngine.setInstrument(this.currentInstrument);
    safeStorageSet('lyrics_font_scale', this.fontSizeScale);
    safeStorageSet('app_instrument', this.currentInstrument);
    safeStorageSet('app_visual_theme', this.visualTheme);
    safeStorageSet('app_notation', this.notationSystem);
  }

  getSongIdentity(song) {
    if (!song?.title) return '';
    const version = song.versionId ?? song.selectedVersionId ?? song.versionName ?? '';
    return [song.id ?? '', song.title, song.artist ?? '', version]
      .map((part) => String(part).trim().toLocaleLowerCase())
      .join('::');
  }

  renderYouTubeCompanion() {
    if (!this.isYouTubePanelOpen || !this.currentSong) return '';
    const videoId = getSongYouTubeVideoId(this.currentSong);
    const searchUrl = buildYouTubeSearchUrl(this.currentSong);
    const externalWatchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : searchUrl;
    const title = `${this.currentSong.title || 'Canción'} de ${this.currentSong.artist || 'artista'}`;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    return `
      <div class="youtube-companion-overlay" id="youtubeCompanionOverlay" role="dialog" aria-modal="true" aria-labelledby="youtubeCompanionTitle">
        <section class="youtube-companion" id="youtubeCompanion" aria-labelledby="youtubeCompanionTitle">
          <div class="youtube-companion-header">
            <div>
              <span class="youtube-companion-kicker">YouTube Companion</span>
              <strong id="youtubeCompanionTitle">${videoId ? 'Vídeo Oficial Embebido' : 'Tocar con la original'}</strong>
            </div>
            <div class="youtube-companion-header-actions">
              <a href="${escapeHtml(externalWatchUrl)}" target="_blank" rel="noopener noreferrer" class="btn-youtube-external" id="btnYouTubeOpenExternal" title="Abrir en otra ventana">
                <span>↗ Abrir en YouTube</span>
              </a>
              <button type="button" class="youtube-companion-close" id="btnCloseYouTube" aria-label="Cerrar reproductor">×</button>
            </div>
          </div>
          ${isOffline ? `
            <div class="youtube-companion-offline-notice" role="status" style="padding: 10px; margin: 8px 0; background: rgba(255, 145, 0, 0.15); border: 1px solid rgba(255, 145, 0, 0.4); border-radius: 8px; color: #ff9100; font-size: 0.8rem; font-weight: 600;">
              📶 Sin conexión a internet. La reproducción de YouTube requiere conexión de red activa.
            </div>
          ` : ''}
          ${videoId ? `
            <div class="youtube-companion-frame">
              <iframe
                src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1"
                title="Vídeo de ${escapeHtml(title)}"
                loading="lazy"
                referrerpolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen></iframe>
            </div>
          ` : `
            <div class="youtube-no-video-card">
              <p class="youtube-no-video-desc">No hay vídeo oficial vinculado automáticamente para esta canción.</p>
              <a href="${escapeHtml(searchUrl)}" target="_blank" rel="noopener noreferrer" class="btn-youtube-search-primary">
                🔍 Buscar y ver en YouTube
              </a>
            </div>
          `}
          <form class="youtube-companion-form" id="youtubeCompanionForm">
            <label for="youtubeCompanionUrl">${videoId ? '⚙️ Cambiar vídeo o enlace manual:' : 'Enlace o ID de YouTube:'}</label>
            <div class="youtube-companion-input-row">
              <input id="youtubeCompanionUrl" name="youtubeUrl" type="url" inputmode="url" autocomplete="url"
                placeholder="https://youtu.be/..." aria-describedby="youtubeCompanionStatus">
              <button type="submit">${videoId ? 'Actualizar' : 'Reproducir'}</button>
            </div>
            <span id="youtubeCompanionStatus" class="youtube-companion-status" role="status" aria-live="polite"></span>
            <div class="youtube-companion-actions-footer">
              <a href="${escapeHtml(searchUrl)}" target="_blank" rel="noopener noreferrer" class="youtube-search-link">
                🔍 Buscar versión oficial en YouTube (nueva ventana)
              </a>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  renderSongMetronomePanel() {
    if (!this.isMetronomePanelOpen) return '';
    const m = this.songMetronome;
    const beatsPerMeasure = m.getBeatsPerMeasure();
    const title = `${this.currentSong?.title || 'Canción'} de ${this.currentSong?.artist || 'artista'}`;

    return `
      <div class="song-metronome-overlay" id="songMetronomeOverlay" role="dialog" aria-modal="true" aria-labelledby="songMetronomeTitle">
        <div class="song-metronome-dialog">
          <div class="song-metronome-header">
            <div class="song-metronome-title-box">
              <span class="song-metronome-icon" aria-hidden="true">⏱️</span>
              <div>
                <h3 id="songMetronomeTitle">Metrónomo de Ensayo</h3>
                <span class="song-metronome-subtitle">${escapeHtml(title)}</span>
              </div>
            </div>
            <button type="button" class="song-metronome-close" id="btnCloseSongMetronome" aria-label="Cerrar panel de metrónomo">×</button>
          </div>

          <div class="song-metronome-body">
            <div class="song-metro-bpm-hero">
              ${m.isCountIn ? `
                <div class="song-metro-countin-banner" id="songMetroCountInBanner" role="status" aria-live="assertive">
                  <span>Cuenta previa activa</span>
                </div>
              ` : ''}
              <span class="song-metro-tempo-text" id="songMetroTempoName">${escapeHtml(m.getTempoName())}</span>
              <span class="song-metro-bpm-number" id="songMetroBpmDisplay">${m.bpm}</span>

              <div class="song-metro-led-row" id="songMetroLedRow" role="group" aria-label="Pulsos del compás">
                ${Array.from({ length: beatsPerMeasure }).map((_, i) => `
                  <div class="song-metro-led ${i === 0 ? 'accent-marker' : ''} ${m.currentMeasureBeat === i && m.isRunning ? 'beat-pulse' : ''}" data-beat="${i}"></div>
                `).join('')}
              </div>
            </div>

            <div class="song-metro-stepper-row" role="group" aria-label="Ajuste de tempo">
              <button type="button" class="song-metro-step-btn" data-metro-delta="-5" aria-label="Reducir 5 BPM">−5</button>
              <button type="button" class="song-metro-step-btn" data-metro-delta="-1" aria-label="Reducir 1 BPM">−1</button>
              <input type="range" class="song-metro-slider" id="rngSongMetroBpm" min="30" max="280" value="${m.bpm}" aria-label="Control deslizante de BPM" />
              <button type="button" class="song-metro-step-btn" data-metro-delta="1" aria-label="Aumentar 1 BPM">+1</button>
              <button type="button" class="song-metro-step-btn" data-metro-delta="5" aria-label="Aumentar 5 BPM">+5</button>
            </div>

            <div class="song-metro-primary-actions">
              <button type="button" class="btn-metro-action-large btn-metro-play-large ${m.isRunning ? 'running' : ''}" id="btnDialogToggleMetronome" aria-pressed="${m.isRunning}">
                <span>${m.isRunning ? '⏹ Detener Metrónomo' : '▶ Iniciar Metrónomo'}</span>
              </button>
              <button type="button" class="btn-metro-action-large btn-metro-tap-large" id="btnDialogTapTempo" aria-label="Pulsar para calcular tempo">
                <span>🖐️ TAP TEMPO</span>
              </button>
            </div>

            <div class="song-metro-grid-options">
              <div class="song-metro-option-row">
                <span class="song-metro-option-label">Compás Rítmico</span>
                <div class="song-metro-pills" role="group" aria-label="Seleccionar compás">
                  ${['2/4', '3/4', '4/4', '6/8', '12/8'].map(ts => `
                    <button type="button" class="metro-pill ${m.timeSignature === ts ? 'active' : ''}" data-metro-signature="${ts}" aria-pressed="${m.timeSignature === ts}">${ts}</button>
                  `).join('')}
                </div>
              </div>

              <div class="song-metro-option-row">
                <span class="song-metro-option-label">Acento y Cuenta Previa (Count-In)</span>
                <div class="song-metro-pills" role="group" aria-label="Acento y cuenta previa">
                  <button type="button" class="metro-pill ${m.accent ? 'active' : ''}" id="btnDialogMetroAccent" aria-pressed="${m.accent}">
                    ${m.accent ? '🔔 Acento en pulso 1' : '🔕 Sin acento'}
                  </button>
                  ${[0, 1, 2, 4].map(c => `
                    <button type="button" class="metro-pill ${m.countInMeasures === c ? 'active' : ''}" data-metro-countin="${c}" aria-pressed="${m.countInMeasures === c}">
                      ${c === 0 ? 'Sin cuenta previa' : `${c} compás${c > 1 ? 'es' : ''}`}
                    </button>
                  `).join('')}
                </div>
              </div>

              <div class="song-metro-option-row">
                <span class="song-metro-option-label">Volumen del Click (${Math.round(m.volume * 100)}%)</span>
                <div class="song-metro-volume-row">
                  <span aria-hidden="true">🔈</span>
                  <input type="range" id="rngSongMetroVolume" min="0" max="100" value="${Math.round(m.volume * 100)}" aria-label="Volumen del metrónomo" />
                  <span aria-hidden="true">🔊</span>
                </div>
              </div>

              <div class="song-metro-option-row">
                <span class="song-metro-option-label">Timbre del Click</span>
                <div class="song-metro-pills" role="group" aria-label="Timbre del sonido">
                  <button type="button" class="metro-pill ${m.sound === 'woodblock' ? 'active' : ''}" data-metro-sound="woodblock" aria-pressed="${m.sound === 'woodblock'}">🪵 Madera</button>
                  <button type="button" class="metro-pill ${m.sound === 'digital' ? 'active' : ''}" data-metro-sound="digital" aria-pressed="${m.sound === 'digital'}">⚡ Digital</button>
                  <button type="button" class="metro-pill ${m.sound === 'drum' ? 'active' : ''}" data-metro-sound="drum" aria-pressed="${m.sound === 'drum'}">🥁 Bombo</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  handleMetronomeBeat({ beat, beatsPerMeasure, isAccent, isCountIn, countInCurrentBeat, countInMeasureNumber, countInTotalMeasures }) {
    events.emit('song:metronomeBeat', { beat, beatsPerMeasure, isAccent, isCountIn });

    const stageDot = this.container?.querySelector('#stageMetronomeBeatDot');
    if (stageDot) {
      stageDot.classList.remove('beat-pulse', 'beat-accent');
      void stageDot.offsetWidth;
      stageDot.classList.add(isAccent ? 'beat-accent' : 'beat-pulse');
    }

    const dialogLeds = this.container?.querySelectorAll('.song-metro-led');
    if (dialogLeds && dialogLeds.length > 0) {
      dialogLeds.forEach((led, idx) => {
        if (idx === beat) {
          led.classList.remove('beat-pulse', 'beat-accent');
          void led.offsetWidth;
          led.classList.add(isAccent ? 'beat-accent' : 'beat-pulse');
        } else {
          led.classList.remove('beat-pulse', 'beat-accent');
        }
      });
    }

    const countInBanner = this.container?.querySelector('#songMetroCountInBanner');
    if (countInBanner) {
      if (isCountIn) {
        countInBanner.textContent = `Cuenta previa: Compás ${countInMeasureNumber}/${countInTotalMeasures} · Pulso ${countInCurrentBeat}`;
      } else {
        countInBanner.remove();
      }
    }
  }

  handleMetronomeCountInComplete() {
    this.announce('¡Comienza la canción!');
    toast.show('¡Comienza la canción!', 'info', 1000);
  }

  updateMetronomeInDOM() {
    const isRunning = this.songMetronome.isRunning;
    const bpm = this.songMetronome.bpm;

    const stageToggle = this.container?.querySelector('#btnStageMetronomeToggle');
    if (stageToggle) {
      stageToggle.classList.toggle('active', isRunning);
      stageToggle.setAttribute('aria-pressed', String(isRunning));
      stageToggle.setAttribute('aria-label', isRunning ? 'Pausar metrónomo' : 'Iniciar metrónomo');
      const textSpan = stageToggle.querySelector('span:not(.stage-metro-dot)');
      if (textSpan) textSpan.textContent = isRunning ? '⏸' : '⏱️';
    }
    const stageBpm = this.container?.querySelector('#lblStageMetronomeBpm');
    if (stageBpm) {
      stageBpm.innerHTML = `${bpm} <small>BPM</small>`;
    }
    const stageDot = this.container?.querySelector('#stageMetronomeBeatDot');
    if (stageDot) {
      stageDot.classList.toggle('active', isRunning);
    }

    const dialogToggle = this.container?.querySelector('#btnDialogToggleMetronome');
    if (dialogToggle) {
      dialogToggle.classList.toggle('running', isRunning);
      dialogToggle.setAttribute('aria-pressed', String(isRunning));
      dialogToggle.innerHTML = `<span>${isRunning ? '⏹ Detener Metrónomo' : '▶ Iniciar Metrónomo'}</span>`;
    }
    const bpmDisplay = this.container?.querySelector('#songMetroBpmDisplay');
    if (bpmDisplay) bpmDisplay.textContent = String(bpm);

    const tempoName = this.container?.querySelector('#songMetroTempoName');
    if (tempoName) tempoName.textContent = this.songMetronome.getTempoName();

    const slider = this.container?.querySelector('#rngSongMetroBpm');
    if (slider && Number(slider.value) !== bpm) slider.value = String(bpm);

    const volSlider = this.container?.querySelector('#rngSongMetroVolume');
    if (volSlider && Number(volSlider.value) !== Math.round(this.songMetronome.volume * 100)) {
      volSlider.value = String(Math.round(this.songMetronome.volume * 100));
    }

    const topMetroBtn = this.container?.querySelector('#btnSongTopMetronome');
    if (topMetroBtn) {
      topMetroBtn.classList.toggle('is-active', isRunning);
      topMetroBtn.setAttribute('aria-pressed', String(isRunning));
      topMetroBtn.setAttribute('aria-label', `Metrónomo (${bpm} BPM)`);
      const bpmBadge = topMetroBtn.querySelector('.top-metro-bpm-badge');
      if (bpmBadge) bpmBadge.textContent = `${bpm} BPM`;
      const iconSpan = topMetroBtn.querySelector('span:first-of-type');
      if (iconSpan) iconSpan.textContent = isRunning ? '⏸' : '⏱️';
    }
  }

  getScrollElement() {
    return document.getElementById('score-viewport');
  }

  getScrollTop() {
    const scrollElement = this.getScrollElement();
    if (scrollElement) return scrollElement.scrollTop;
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  restoreScrollPosition(scrollTop) {
    const top = Math.max(0, Number(scrollTop) || 0);
    const scrollElement = this.getScrollElement();
    if (scrollElement) scrollElement.scrollTo({ top, behavior: 'auto' });
    else window.scrollTo({ top, behavior: 'auto' });
  }

  extractSections(rawLyrics) {
    if (!rawLyrics) return [];
    const counts = new Map();
    return rawLyrics.split(/\r?\n/).reduce((sections, rawLine) => {
      const line = rawLine.trim();
      if (!SECTION_PATTERN.test(line)) return sections;

      const baseLabel = line.slice(1, -1).trim();
      const normalized = baseLabel.toLocaleLowerCase();
      const occurrence = (counts.get(normalized) || 0) + 1;
      counts.set(normalized, occurrence);
      sections.push({
        id: `song-section-${sections.length + 1}`,
        label: occurrence > 1 ? `${baseLabel} ${occurrence}` : baseLabel
      });
      return sections;
    }, []);
  }

  applySectionAnchors() {
    const headers = Array.from(this.container?.querySelectorAll('.lyrics-section-header') || []);
    headers.forEach((header, index) => {
      const section = this.sections[index];
      if (!section) return;
      header.id = section.id;
      header.dataset.sectionId = section.id;
      header.tabIndex = -1;
    });
    this.updateSectionNavigationState();
  }

  navigateToSection(sectionId, shouldFocus = false) {
    const section = this.container?.querySelector(`#${sectionId}`);
    if (!section) return;
    this.activeSectionId = sectionId;
    section.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
    if (shouldFocus) section.focus({ preventScroll: true });
    this.updateSectionNavigationState();
    this.scheduleSessionSave();
  }

  updateActiveSectionFromScroll() {
    const headers = Array.from(this.container?.querySelectorAll('.lyrics-section-header[id]') || []);
    if (!headers.length) return;

    const scrollElement = this.getScrollElement();
    const rootTop = scrollElement?.getBoundingClientRect().top || 0;
    const threshold = rootTop + 170;
    let active = headers[0];
    for (const header of headers) {
      if (header.getBoundingClientRect().top <= threshold) active = header;
      else break;
    }

    if (active?.id && active.id !== this.activeSectionId) {
      this.activeSectionId = active.id;
      this.updateSectionNavigationState();
    }
  }

  updateSectionNavigationState() {
    this.container?.querySelectorAll('.song-section-link').forEach((button) => {
      const isActive = button.dataset.sectionId === this.activeSectionId;
      button.classList.toggle('active', isActive);
      if (isActive) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    });
  }

  getSongVersions() {
    if (!this.currentSong) return [];
    const candidates = [];
    const sourceCollections = [];
    if (Array.isArray(this.currentSong.versions)) sourceCollections.push(this.currentSong.versions);
    if (Array.isArray(this.currentSong.versionGroup)) sourceCollections.push(this.currentSong.versionGroup);
    if (Array.isArray(this.currentSong.versionGroup?.versions)) sourceCollections.push(this.currentSong.versionGroup.versions);
    if (Array.isArray(this.currentSong.versionGroup?.items)) sourceCollections.push(this.currentSong.versionGroup.items);

    const baseSong = { ...this.currentSong };
    delete baseSong.versions;
    const hasBaseContent = Boolean(normalizeLyrics(baseSong.lyricsChords) || baseSong.data);
    if (hasBaseContent) candidates.push(baseSong);
    sourceCollections.forEach((collection) => candidates.push(...collection));

    const seen = new Set();
    return candidates.reduce((versions, candidate, index) => {
      const song = (typeof candidate === 'string' || typeof candidate === 'number')
        ? { ...baseSong, versionId: String(candidate), versionName: String(candidate) }
        : { ...baseSong, ...(candidate || {}) };
      const key = String(
        song.versionId
        ?? song.selectedVersionId
        ?? candidate?.id
        ?? `${song.id || song.title}-${song.versionName || song.arrangement || index}`
      );
      if (seen.has(key)) return versions;
      seen.add(key);

      const detail = song.versionName || song.versionLabel || song.label || song.name
        || song.arrangement || song.difficulty || song.instrument;
      versions.push({
        key,
        label: normalizeLabel(detail, index === 0 ? 'Versión principal' : `Versión ${index + 1}`),
        song,
        raw: candidate
      });
      return versions;
    }, []);
  }

  getSelectedVersionKey(versions) {
    if (!versions.length) return '';
    if (this.currentVersionKey && versions.some((version) => version.key === this.currentVersionKey)) {
      return this.currentVersionKey;
    }
    const explicit = String(this.currentSong?.versionId ?? this.currentSong?.selectedVersionId ?? '');
    return versions.some((version) => version.key === explicit) ? explicit : versions[0].key;
  }

  async selectSongVersion(versionKey) {
    const versions = this.getSongVersions();
    const selected = versions.find((version) => version.key === versionKey);
    if (!selected) return;

    const versionsData = this.currentSong?.versions;
    const versionGroup = this.currentSong?.versionGroup;
    const nextSong = {
      ...this.currentSong,
      ...selected.song,
      versions: versionsData,
      versionGroup,
      versionId: selected.song.versionId ?? selected.key,
      selectedVersionId: selected.key
    };
    this.currentVersionKey = selected.key;

    state.set('activeSong', nextSong);
    events.emit('song:versionSelected', {
      song: nextSong,
      version: selected.raw,
      versionGroup
    });
    await this.handleSongLoad(nextSong, { force: true, versionKey: selected.key });
    this.announce(`Versión seleccionada: ${selected.label}`);
  }

  getTransposeRecommendation(rawLyrics) {
    const originalChords = ChordProParser.extractUniqueChords(rawLyrics, 0, 0);
    if (!originalChords.length) return null;

    const preferredRoots = {
      guitar: new Set(['C', 'D', 'E', 'G', 'A']),
      ukulele: new Set(['C', 'D', 'F', 'G', 'A']),
      piano: new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B'])
    }[this.currentInstrument];

    const scoreCandidate = (semitones) => originalChords.reduce((score, chord) => {
      const displayed = ChordProParser.transposeChord(chord, semitones, this.capoFret);
      const root = displayed.match(/^([A-G][#b]?)/)?.[1] || '';
      if (/[#b]/.test(root)) score += this.currentInstrument === 'piano' ? 1.4 : 2.4;
      if (preferredRoots && !preferredRoots.has(root.replace(/[#b]/g, ''))) score += 0.7;
      if (/\//.test(displayed)) score += 0.35;
      return score;
    }, Math.abs(semitones) * 0.08);

    const candidates = Array.from({ length: 13 }, (_, index) => index - 6)
      .map((semitones) => ({ semitones, score: scoreCandidate(semitones) }))
      .sort((a, b) => a.score - b.score || Math.abs(a.semitones) - Math.abs(b.semitones));
    const best = candidates[0];
    const currentScore = scoreCandidate(this.transposeSemitones);
    const recommendation = currentScore <= best.score + 0.25
      ? { semitones: this.transposeSemitones, score: currentScore }
      : best;

    const currentAccidentals = ChordProParser.extractUniqueChords(
      rawLyrics,
      this.transposeSemitones,
      this.capoFret
    ).filter((chord) => /[#b]/.test(chord.match(/^([A-G][#b]?)/)?.[1] || '')).length;
    const suggestedAccidentals = ChordProParser.extractUniqueChords(
      rawLyrics,
      recommendation.semitones,
      this.capoFret
    ).filter((chord) => /[#b]/.test(chord.match(/^([A-G][#b]?)/)?.[1] || '')).length;
    const instrumentName = ChordDiagramRenderer.getInstrumentDisplayName(this.currentInstrument);

    return {
      semitones: recommendation.semitones,
      isCurrent: recommendation.semitones === this.transposeSemitones,
      summary: recommendation.semitones === this.transposeSemitones
        ? 'La transposición actual ya ofrece una lectura clara para este instrumento.'
        : `La opción ${recommendation.semitones > 0 ? '+' : ''}${recommendation.semitones} puede simplificar la lectura de formas en ${instrumentName}.`,
      explanation: `Se comparan alteraciones y formas habituales de ${instrumentName.toLocaleLowerCase()}${this.capoFret ? ` con cejilla en el traste ${this.capoFret}` : ''}. Las alteraciones pasan de ${currentAccidentals} a ${suggestedAccidentals}. Esta sugerencia no analiza ni presupone el rango vocal.`
    };
  }

  syncContextualState() {
    events.emit('song:stateChanged', {
      transpose: this.transposeSemitones,
      isAutoScrolling: this.autoScroller.isRunning,
      autoScrollSpeed: this.autoScroller.speedPercent,
      isRecording: this.audioRecorder?.isRecording || false,
      isStageMode: this.isStageMode,
      activeSectionId: this.activeSectionId,
      metronome: this.songMetronome ? {
        isRunning: this.songMetronome.isRunning,
        bpm: this.songMetronome.bpm,
        timeSignature: this.songMetronome.timeSignature,
        isCountIn: this.songMetronome.isCountIn
      } : undefined
    });
  }

  setTranspose(semitones) {
    const nextValue = clamp(semitones, -12, 12);
    if (nextValue === this.transposeSemitones) return;
    this.transposeSemitones = nextValue;
    this.render();
    this.syncContextualState();
    this.scheduleSessionSave();
    this.announce(`Transposición ${nextValue > 0 ? '+' : ''}${nextValue}`);
  }

  setCapo(fret) {
    const nextFret = clamp(fret, 0, 12);
    if (nextFret === this.capoFret) return;
    this.capoFret = nextFret;
    this.render();
    this.scheduleSessionSave();
    this.announce(nextFret ? `Cejilla en traste ${nextFret}` : 'Cejilla desactivada');
  }

  setInstrument(instrument) {
    if (!VALID_INSTRUMENTS.has(instrument)) return;
    this.currentInstrument = instrument;
    safeStorageSet('app_instrument', instrument);
    chordEngine.setInstrument(instrument);
    this.isInstrumentMenuOpen = false;
    this.render();
    this.scheduleSessionSave();
    this.announce(`Instrumento: ${ChordDiagramRenderer.getInstrumentDisplayName(instrument)}`);
  }

  setNotationSystem(notation) {
    this.notationSystem = notation === 'latin' ? 'latin' : 'anglo';
    safeStorageSet('app_notation', this.notationSystem);
    this.render();
    this.scheduleSessionSave();
  }

  setVisualTheme(theme) {
    if (!VALID_THEMES.has(theme)) return;
    this.visualTheme = theme;
    safeStorageSet('app_visual_theme', theme);
    this.render();
    this.scheduleSessionSave();
    this.announce('Tema del visor actualizado');
  }

  setAutoScrollSpeed(value) {
    this.autoScroller.setSpeed(clamp(value, 1, 100));
    this.updateAutoScrollControlsInDOM();
    this.saveSessionNow();
  }

  toggleAutoScroll() {
    const shouldStop = this.autoScrollIntent || this.autoScroller.isRunning;
    this.autoScrollIntent = !shouldStop;
    if (shouldStop) this.autoScroller.stop('explicit');
    else if (this.isPlayerVisible) this.autoScroller.start();
    this.updateAutoScrollControlsInDOM();
    this.syncContextualState();
    this.saveSessionNow();
  }

  handleAutoScrollEnd() {
    this.autoScrollIntent = false;
    this.updateAutoScrollControlsInDOM();
    this.syncContextualState();
    this.saveSessionNow();
    this.announce('Fin de la canción');
    toast.show('Fin de la canción', 'info', 1800);
  }

  toggleRecording(wantVideo = false) {
    return this.audioRecorder.toggle(this.currentSong?.title || 'Ensayo', wantVideo);
  }

  async requestScreenWakeLock() {
    try {
      if ('wakeLock' in navigator && !this.wakeLockSentinel) {
        this.wakeLockSentinel = await navigator.wakeLock.request('screen');
        this.wakeLockSentinel.addEventListener('release', () => {
          this.wakeLockSentinel = null;
        }, { once: true });
      }
    } catch (error) {
      this.wakeLockSentinel = null;
    }
  }

  async releaseScreenWakeLock() {
    try {
      await this.wakeLockSentinel?.release();
    } catch (error) {
      // The browser may already have released it after losing visibility.
    }
    this.wakeLockSentinel = null;
  }

  enterStageMode() {
    if (this.isStageMode) return;
    this.isStageMode = true;
    this.requestScreenWakeLock();
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
    events.emit('ui:stageMode', true);
    this.render();
    this.syncContextualState();
  }

  exitStageMode() {
    if (!this.isStageMode) return;
    this.isStageMode = false;
    this.releaseScreenWakeLock();
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    events.emit('ui:stageMode', false);
    this.render();
    this.syncContextualState();
  }

  setViewMode(mode) {
    this.viewMode = mode === 'score' && this.currentSong?.data ? 'score' : 'lyrics';
    this.render();
    this.scheduleSessionSave();
  }

  applyViewModeDOM() {
    const alphatabElement = document.getElementById('alphatab');
    const lyricsContent = this.container?.querySelector('#lyricsBodyContent');
    if (alphatabElement) alphatabElement.style.display = this.viewMode === 'score' ? 'block' : 'none';
    if (lyricsContent) lyricsContent.style.display = this.viewMode === 'score' ? 'none' : 'block';
    if (this.viewMode === 'score') window.dispatchEvent(new Event('resize'));
  }

  setFontSizeScale(delta) {
    this.fontSizeScale = clamp(this.fontSizeScale + delta, 80, 180);
    safeStorageSet('lyrics_font_scale', this.fontSizeScale);
    this.updateFontSizeInDOM();
    const badge = this.container?.querySelector('#lblFontScalePercent');
    if (badge) badge.textContent = `${this.fontSizeScale}%`;
    this.scheduleSessionSave();
  }

  updateFontSizeInDOM() {
    const container = this.container?.querySelector('.lyrics-chords-container');
    const scale = this.fontSizeScale / 100;
    if (!container) return;
    container.style.setProperty('--lyrics-font-scale', String(scale));
    container.style.setProperty('--lyrics-font-size', `${1.12 * scale}rem`);
  }

  updateAutoScrollControlsInDOM() {
    const percentage = `${this.autoScroller.speedPercent}%`;
    const dockPercentage = document.getElementById('lblBottomScrollSpeed') || document.getElementById('lblAutoScrollPercent');
    const stagePercentage = this.container?.querySelector('#lblStageAutoScrollPercent');
    [dockPercentage, stagePercentage].filter(Boolean).forEach((element) => {
      if (element.textContent !== percentage) element.textContent = percentage;
    });

    const dockButton = document.getElementById('btnBottomToggleAutoScroll');
    const dockAlias = document.getElementById('btnToggleAutoScroll');
    [dockButton, dockAlias].filter(Boolean).forEach((element) => {
      element.classList.toggle('active', this.autoScroller.isRunning);
    });
    if (dockButton) dockButton.setAttribute('aria-pressed', String(this.autoScroller.isRunning));

    const stageButton = this.container?.querySelector('#btnStageToggleAutoScroll');
    if (stageButton) {
      stageButton.classList.toggle('active', this.autoScroller.isRunning);
      stageButton.setAttribute('aria-pressed', String(this.autoScroller.isRunning));
    }
  }

  updateRecordingTimerInDOM() {
    this.container?.querySelectorAll('.lbl-recording-time').forEach((label) => {
      label.textContent = this.audioRecorder.formatTime(this.audioRecorder.recordingDuration);
    });
  }

  async toggleLiveListening() {
    this.isOptionsMenuOpen = false;
    this.liveListeningError = '';

    if (this.isLiveListening) {
      this.isLiveListening = false;
      pitchDetector.stop();
      this.render();
      this.announce('Escucha activa detenida');
      return;
    }

    const started = await pitchDetector.start();
    this.isLiveListening = started === true;
    if (!this.isLiveListening) {
      this.liveListeningError = 'No se pudo iniciar la escucha. Revisa el permiso del micrófono.';
    }

    this.render();
    if (this.isLiveListening) {
      this.announce('Escucha activa iniciada');
    } else {
      this.announce(this.liveListeningError);
      toast.show(this.liveListeningError, 'error', 3200);
    }
  }

  handleLiveChordDetected(detectedNote) {
    const normalizedNote = String(detectedNote).replace(/\d+/g, '');
    const matchingBadge = Array.from(this.container?.querySelectorAll('.chord-badge') || [])
      .find((badge) => {
        const root = String(badge.dataset.chord || '').match(/^([A-G][#b]?)/)?.[1];
        return root === normalizedNote;
      });
    if (!matchingBadge) return;
    matchingBadge.classList.add('chord-detected-active');
    setTimeout(() => matchingBadge.isConnected && matchingBadge.classList.remove('chord-detected-active'), 900);
  }

  closeMenus(restoreFocus = false) {
    const focusId = this.isInstrumentMenuOpen ? 'btnInstrumentSelect' : 'btnMoreOptions';
    this.isInstrumentMenuOpen = false;
    this.isOptionsMenuOpen = false;
    this.render();
    if (restoreFocus) requestAnimationFrame(() => this.container?.querySelector(`#${focusId}`)?.focus());
  }

  announce(message) {
    requestAnimationFrame(() => {
      const liveRegion = this.container?.querySelector('#songWorkspaceLiveStatus');
      if (liveRegion) liveRegion.textContent = message;
      const workspace = this.container?.querySelector('.song-workspace');
      if (workspace) {
        workspace.classList.remove('workspace-updated');
        void workspace.offsetWidth;
        workspace.classList.add('workspace-updated');
      }
    });
  }

  createSessionSnapshot() {
    return {
      song: this.currentSong,
      scrollTop: this.getScrollTop(),
      fontSizeScale: this.fontSizeScale,
      transposeSemitones: this.transposeSemitones,
      capoFret: this.capoFret,
      instrument: this.currentInstrument,
      visualTheme: this.visualTheme,
      notationSystem: this.notationSystem,
      hideChordsMode: this.hideChordsMode,
      isSimplified: this.isSimplified,
      viewMode: this.viewMode,
      activeSectionId: this.activeSectionId,
      autoScroll: {
        isRunning: this.autoScrollIntent,
        speedPercent: this.autoScroller.speedPercent
      }
    };
  }

  scheduleSessionSave() {
    if (!this.currentSong?.title) return;
    this.sessionRecovery.schedule(this.createSessionSnapshot());
  }

  saveSessionNow() {
    if (!this.currentSong?.title) return;
    this.sessionRecovery.flush(this.createSessionSnapshot());
  }

  renderInstrumentMenu() {
    if (!this.isInstrumentMenuOpen) return '';
    const instruments = ['guitar', 'piano', 'ukulele'];
    return `
      <div class="instrument-dropdown-popup workspace-popup" id="instrumentDropdownPopup" role="menu" aria-label="Instrumento para los acordes">
        ${instruments.map((instrument) => `
          <button class="inst-option-card ${this.currentInstrument === instrument ? 'active' : ''}" data-inst="${instrument}" role="menuitemradio" aria-checked="${this.currentInstrument === instrument}">
            <strong>${escapeHtml(ChordDiagramRenderer.getInstrumentDisplayName(instrument))}</strong>
          </button>
        `).join('')}
      </div>
    `;
  }

  renderOptionsMenu(recommendation) {
    if (!this.isOptionsMenuOpen) return '';
    return `
      <div class="more-options-dropdown-popup workspace-popup" id="moreOptionsDropdownPopup" role="group" aria-label="Herramientas y configuración de canción">
        <div class="workspace-popup-heading">
          <strong>Herramientas</strong>
          <span>Ajustes secundarios del visor</span>
        </div>

        <div class="workspace-menu-actions">
          <button class="btn-menu-action" id="btnEnterStageMode">Modo atril</button>
          <button class="btn-menu-action" id="btnQuickRecordAction">Grabar toma</button>
          <button class="btn-menu-action" id="btnToggleSpeedTrainer">Modo ensayo</button>
          <button class="btn-menu-action" id="btnOpenTunerQuick">Abrir afinador</button>
          <button class="btn-menu-action ${this.isLiveListening ? 'active' : ''}" id="btnToggleLiveListen" aria-pressed="${this.isLiveListening}">
            ${this.isLiveListening ? 'Detener escucha activa' : 'Escucha activa'}
          </button>
          <button class="btn-menu-action ${this.isSimplified ? 'active' : ''}" id="btnToggleSimplified" aria-pressed="${this.isSimplified}">
            ${this.isSimplified ? 'Acordes originales' : 'Simplificar acordes'}
          </button>
          <button class="btn-menu-action ${this.hideChordsMode ? 'active' : ''}" id="btnToggleHideChords" aria-pressed="${this.hideChordsMode}">
            ${this.hideChordsMode ? 'Mostrar acordes' : 'Solo letra'}
          </button>
        </div>

        <div class="workspace-settings-grid">
          <label class="workspace-field" for="selSongCapo">
            <span>Cejilla</span>
            <select id="selSongCapo" class="sel-options-input">
              ${Array.from({ length: 13 }, (_, fret) => `<option value="${fret}" ${this.capoFret === fret ? 'selected' : ''}>${fret === 0 ? 'Sin cejilla' : `Traste ${fret}`}</option>`).join('')}
            </select>
          </label>
          <label class="workspace-field" for="selSongNotation">
            <span>Cifrado</span>
            <select id="selSongNotation" class="sel-options-input">
              <option value="anglo" ${this.notationSystem === 'anglo' ? 'selected' : ''}>C, D, E</option>
              <option value="latin" ${this.notationSystem === 'latin' ? 'selected' : ''}>Do, Re, Mi</option>
            </select>
          </label>
          <label class="workspace-field" for="selSongTheme">
            <span>Tema</span>
            <select id="selSongTheme" class="sel-options-input">
              <option value="paper" ${this.visualTheme === 'paper' ? 'selected' : ''}>Papel</option>
              <option value="oled" ${this.visualTheme === 'oled' ? 'selected' : ''}>OLED</option>
              <option value="amber" ${this.visualTheme === 'amber' ? 'selected' : ''}>Ámbar</option>
            </select>
          </label>
        </div>

        ${recommendation ? `
          <div class="transpose-recommendation" aria-labelledby="transposeRecommendationTitle">
            <strong id="transposeRecommendationTitle">Sugerencia instrumental</strong>
            <p>${escapeHtml(recommendation.summary)}</p>
            <details>
              <summary>Cómo se calcula</summary>
              <p>${escapeHtml(recommendation.explanation)}</p>
            </details>
            ${recommendation.isCurrent ? '' : `
              <button class="btn-apply-recommendation" id="btnApplyTransposeRecommendation" data-semitones="${recommendation.semitones}">
                Usar ${recommendation.semitones > 0 ? '+' : ''}${recommendation.semitones}
              </button>
            `}
          </div>
        ` : ''}

        <div class="options-viewmode-row" role="group" aria-label="Vista musical">
          <button class="btn-viewmode-choice ${this.viewMode === 'lyrics' ? 'active' : ''}" id="btnModeLyrics" aria-pressed="${this.viewMode === 'lyrics'}">Letra y acordes</button>
          ${this.currentSong?.data ? `<button class="btn-viewmode-choice ${this.viewMode === 'score' ? 'active' : ''}" id="btnModeScore" aria-pressed="${this.viewMode === 'score'}">Partitura</button>` : ''}
        </div>
      </div>
    `;
  }

  renderVersionSelector(versions) {
    if (versions.length < 2) return '';
    const selectedKey = this.getSelectedVersionKey(versions);
    return `
      <label class="song-version-field" for="selSongVersion">
        <span>Versión</span>
        <select id="selSongVersion" aria-label="Seleccionar versión de ${escapeHtml(this.currentSong?.title || 'la canción')}">
          ${versions.map((version) => `<option value="${escapeHtml(version.key)}" ${version.key === selectedKey ? 'selected' : ''}>${escapeHtml(version.label)}</option>`).join('')}
        </select>
      </label>
    `;
  }

  renderSectionNavigation() {
    if (!this.sections.length) return '';
    return `
      <nav class="song-section-nav" aria-label="Secciones de la canción">
        <span class="song-section-nav-label">Secciones</span>
        <div class="song-section-links">
          ${this.sections.map((section, index) => `
            <button class="song-section-link ${section.id === this.activeSectionId || (!this.activeSectionId && index === 0) ? 'active' : ''}" data-section-id="${section.id}" ${section.id === this.activeSectionId ? 'aria-current="location"' : ''}>
              ${escapeHtml(section.label)}
            </button>
          `).join('')}
        </div>
      </nav>
    `;
  }

  render() {
    if (!this.container) return;

    const scrollTop = this.pendingScrollTop ?? this.getScrollTop();
    const cycle = ++this.renderCycle;
    const title = this.currentSong?.title || 'Selecciona una canción';
    const artist = this.currentSong?.artist || 'Tabs & Chords PRO';
    const tuning = this.currentSong?.tuning || 'Standard E';
    const rawLyrics = normalizeLyrics(this.currentSong?.lyricsChords);
    const displayLyrics = this.isSimplified ? simplifyChordPro(rawLyrics) : rawLyrics;
    const safeLyrics = escapeHtml(displayLyrics);
    const contentSource = this.currentSong?.contentSource || 'curated_lyrics';
    const contentSourceLabel = contentSource === 'generated_chord_guide' ? 'Guía generada' : 'Letra curada';
    const versions = this.getSongVersions();
    const recommendation = this.getTransposeRecommendation(rawLyrics);
    const uniqueChords = ChordProParser.extractUniqueChords(rawLyrics, this.transposeSemitones, this.capoFret);
    const parsedHtml = ChordProParser.parseToHtml(safeLyrics, {
      semitones: this.transposeSemitones,
      capoFret: this.capoFret,
      notation: this.notationSystem,
      hideChords: this.hideChordsMode
    });

    this.container.innerHTML = `
      <div class="lyrics-chords-container song-workspace theme-${this.visualTheme} ${this.isStageMode ? 'stage-mode-view' : ''}" role="region" aria-label="Letra y acordes de ${escapeHtml(title)}">
        <span class="visually-hidden" id="songWorkspaceLiveStatus" role="status" aria-live="polite"></span>

        ${this.isStageMode ? `
          <div class="stage-floating-hud" role="toolbar" aria-label="Controles de atril">
            <button class="btn-stage-exit" id="btnExitStageMode">Salir de atril</button>
            <div class="stage-metronome-cluster" role="group" aria-label="Metrónomo en atril">
              <button type="button" class="btn-stage-metro-toggle ${this.songMetronome.isRunning ? 'active' : ''}" id="btnStageMetronomeToggle" aria-label="${this.songMetronome.isRunning ? 'Pausar metrónomo' : 'Iniciar metrónomo'}" aria-pressed="${this.songMetronome.isRunning}">
                <span class="stage-metro-dot ${this.songMetronome.isRunning ? 'active' : ''}" id="stageMetronomeBeatDot" aria-hidden="true"></span>
                <span>${this.songMetronome.isRunning ? '⏸' : '⏱️'}</span>
              </button>
              <button type="button" class="btn-stage-zoom-btn" id="btnStageMetronomeDecr" aria-label="Reducir tempo">−</button>
              <span class="stage-hud-bpm-badge" id="lblStageMetronomeBpm">${this.songMetronome.bpm} <small>BPM</small></span>
              <button type="button" class="btn-stage-zoom-btn" id="btnStageMetronomeIncr" aria-label="Aumentar tempo">+</button>
              <button type="button" class="btn-stage-zoom-btn btn-stage-tap" id="btnStageMetronomeTap" aria-label="Tap tempo">TAP</button>
            </div>
            <button class="btn-stage-record ${this.audioRecorder.isRecording ? 'recording-active' : ''}" id="btnStageRecord">
              <span>${this.audioRecorder.isRecording ? 'Detener toma' : 'Grabar ensayo'}</span>
              ${this.audioRecorder.isRecording ? `<span class="lbl-recording-time font-mono">${this.audioRecorder.formatTime(this.audioRecorder.recordingDuration)}</span>` : ''}
            </button>
            <button class="btn-stage-autoscroll ${this.autoScroller.isRunning ? 'active' : ''}" id="btnStageToggleAutoScroll" aria-pressed="${this.autoScroller.isRunning}">
              ${this.autoScroller.isRunning ? 'Pausar' : 'Auto-scroll'} <span id="lblStageAutoScrollPercent">${this.autoScroller.speedPercent}%</span>
            </button>
            <div class="stage-zoom-stepper" role="group" aria-label="Tamaño de letra">
              <button class="btn-stage-zoom-btn" id="btnStageFontDecr" aria-label="Reducir letra">A−</button>
              <span class="stage-hud-font-badge">${this.fontSizeScale}%</span>
              <button class="btn-stage-zoom-btn" id="btnStageFontIncr" aria-label="Aumentar letra">A+</button>
            </div>
          </div>
        ` : ''}

        <header class="lyrics-top-hud" role="toolbar" aria-label="Configuración de canción">
          <div class="lyrics-hud-actions-scrollable">
            <button type="button" class="btn-top-action-pill btn-workspace-back" id="btnBackToExplore" aria-label="Volver a explorar">
              <span aria-hidden="true">←</span>
              <span>Volver</span>
            </button>

            <button class="btn-instrument-select" id="btnInstrumentSelect" aria-haspopup="menu" aria-controls="instrumentDropdownPopup" aria-expanded="${this.isInstrumentMenuOpen}">
              <span class="workspace-control-label">Instrumento</span>
              <strong id="lblCurrentInstrument">${escapeHtml(ChordDiagramRenderer.getInstrumentDisplayName(this.currentInstrument))}</strong>
              <span class="dropdown-caret" aria-hidden="true">▾</span>
            </button>

            <div class="font-scaler-group" role="group" aria-label="Tamaño de letra">
              <button class="btn-font-scale-step" id="btnFontDecr" aria-label="Reducir letra">A−</button>
              <span class="font-scale-percent-badge" id="lblFontScalePercent" aria-live="polite">${this.fontSizeScale}%</span>
              <button class="btn-font-scale-step" id="btnFontIncr" aria-label="Aumentar letra">A+</button>
            </div>


            <button class="btn-top-action-pill" id="btnPrintPDF" aria-label="Imprimir o guardar como PDF">PDF</button>

            <button class="btn-top-action-pill btn-song-top-metro ${this.songMetronome.isRunning ? 'is-active' : ''}" id="btnSongTopMetronome" aria-label="Metrónomo (${this.songMetronome.bpm} BPM)" aria-pressed="${this.songMetronome.isRunning}">
              <span aria-hidden="true">${this.songMetronome.isRunning ? '⏸' : '⏱️'}</span>
              <span>Metrónomo</span>
              <span class="top-metro-bpm-badge font-mono">${this.songMetronome.bpm} BPM</span>
            </button>

            <button class="btn-top-action-pill btn-youtube-companion ${this.isYouTubePanelOpen ? 'is-active' : ''}" id="btnToggleYouTube" aria-controls="youtubeCompanion" aria-expanded="${this.isYouTubePanelOpen}">
              <span aria-hidden="true">▶</span>
              <span>Original</span>
            </button>

            <button class="btn-more-options" id="btnMoreOptions" aria-haspopup="true" aria-controls="moreOptionsDropdownPopup" aria-expanded="${this.isOptionsMenuOpen}">
              <span>Herramientas</span>
              <span class="dropdown-caret" aria-hidden="true">▾</span>
            </button>
          </div>
          ${this.renderInstrumentMenu()}
          ${this.renderOptionsMenu(recommendation)}
        </header>

        <div class="lyrics-header-main-title-block">
          <div class="workspace-title-row">
            <div>
              <h1 class="lyrics-song-title">${escapeHtml(title)}</h1>
              <span class="lyrics-song-artist">${escapeHtml(artist)}</span>
            </div>
            ${this.renderVersionSelector(versions)}
          </div>
          <div class="lyrics-song-meta-pills" aria-label="Datos de canción">
            <span class="meta-pill">${escapeHtml(tuning)}</span>
            <span class="meta-pill">${escapeHtml(contentSourceLabel)}</span>
            ${this.capoFret > 0 ? `<span class="meta-pill capo-active-pill">Cejilla ${this.capoFret}</span>` : ''}
            ${this.transposeSemitones !== 0 ? `<span class="meta-pill transpose-active-pill">Tono ${this.transposeSemitones > 0 ? '+' : ''}${this.transposeSemitones}</span>` : ''}
            ${this.showRestoredNotice ? '<span class="session-restored-chip" role="status">Sesión recuperada</span>' : ''}
            ${this.liveListeningError ? `<span class="listen-error-chip" role="alert">${escapeHtml(this.liveListeningError)}</span>` : ''}
          </div>
        </div>

        ${this.renderYouTubeCompanion()}
        ${this.renderSongMetronomePanel()}

        ${this.renderSectionNavigation()}

        ${this.audioRecorder.recordedUrl && !this.audioRecorder.isRecording ? `
          <div class="recording-playback-card">
            <div class="rec-card-meta">
              <strong>Toma grabada</strong>
              <audio controls src="${escapeHtml(this.audioRecorder.recordedUrl)}" class="rec-audio-element"></audio>
            </div>
            <div class="rec-card-actions">
              <button class="btn-rec-download" id="btnDownloadRecording">Descargar audio</button>
              <button class="btn-rec-dismiss" id="btnDismissRecording">Descartar</button>
            </div>
          </div>
        ` : ''}

        ${ChordDiagramRenderer.renderGallery(uniqueChords, {
          instrument: this.currentInstrument,
          notation: this.notationSystem,
          tempo: this.currentSong?.tempo || 120,
          timeSignature: this.currentSong?.timeSignature || '4/4'
        })}

        <div id="lyricsBodyContent" style="display: ${this.viewMode === 'score' ? 'none' : 'block'};">
          ${parsedHtml}
        </div>
      </div>
    `;

    this.pendingScrollTop = null;
    this.updateFontSizeInDOM();
    this.bindEvents();
    this.applyViewModeDOM();
    this.applySectionAnchors();
    this.syncBottomDockAliases();

    requestAnimationFrame(() => {
      if (cycle !== this.renderCycle) return;
      this.restoreScrollPosition(scrollTop);
      this.updateActiveSectionFromScroll();
    });

    if (this.showRestoredNotice) {
      clearTimeout(this.restoredNoticeTimer);
      this.restoredNoticeTimer = setTimeout(() => {
        this.showRestoredNotice = false;
        this.container?.querySelector('.session-restored-chip')?.remove();
      }, 3600);
    }
  }

  bindEvents() {
    this.container.querySelector('#btnBackToExplore')?.addEventListener('click', () => {
      events.emit('ui:switchTab', 'explore');
    });
    this.container.querySelector('#btnPrintPDF')?.addEventListener('click', () => window.print());
    this.container.querySelector('#btnSongTopMetronome')?.addEventListener('click', () => {
      this.isMetronomePanelOpen = !this.isMetronomePanelOpen;
      this.render();
      requestAnimationFrame(() => {
        if (this.isMetronomePanelOpen) this.container.querySelector('#rngSongMetroBpm')?.focus();
      });
    });
    this.container.querySelector('#btnToggleYouTube')?.addEventListener('click', () => {
      this.isYouTubePanelOpen = !this.isYouTubePanelOpen;
      this.render();
      requestAnimationFrame(() => {
        if (this.isYouTubePanelOpen) this.container.querySelector('#youtubeCompanionUrl')?.focus();
      });
    });
    this.container.querySelector('#btnCloseYouTube')?.addEventListener('click', () => {
      this.isYouTubePanelOpen = false;
      this.render();
      requestAnimationFrame(() => this.container.querySelector('#btnToggleYouTube')?.focus());
    });
    this.container.querySelector('#youtubeCompanionOverlay')?.addEventListener('click', (event) => {
      if (event.target.id === 'youtubeCompanionOverlay') {
        this.isYouTubePanelOpen = false;
        this.render();
        requestAnimationFrame(() => this.container.querySelector('#btnToggleYouTube')?.focus());
      }
    });
    this.container.querySelector('#youtubeCompanionForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = this.container.querySelector('#youtubeCompanionUrl');
      const status = this.container.querySelector('#youtubeCompanionStatus');
      const videoId = saveSongYouTubeVideoId(this.currentSong, input?.value);
      if (!videoId) {
        if (status) status.textContent = 'Introduce un enlace válido de YouTube.';
        input?.setAttribute('aria-invalid', 'true');
        input?.focus();
        return;
      }
      input?.removeAttribute('aria-invalid');
      this.render();
      requestAnimationFrame(() => this.container.querySelector('.youtube-companion iframe')?.focus());
      this.announce('Vídeo de YouTube preparado');
    });
    this.container.querySelector('#btnModeLyrics')?.addEventListener('click', () => this.setViewMode('lyrics'));
    this.container.querySelector('#btnModeScore')?.addEventListener('click', () => this.setViewMode('score'));

    this.container.querySelector('#btnStageRecord')?.addEventListener('click', () => this.toggleRecording());
    this.container.querySelector('#btnDownloadRecording')?.addEventListener('click', () => this.audioRecorder.download(this.currentSong?.title));
    this.container.querySelector('#btnDismissRecording')?.addEventListener('click', () => this.audioRecorder.dismiss());
    this.container.querySelector('#btnStageToggleAutoScroll')?.addEventListener('click', () => this.toggleAutoScroll());

    // Metrónomo en Modo Atril
    this.container.querySelector('#btnStageMetronomeToggle')?.addEventListener('click', () => {
      this.songMetronome.toggle();
    });
    this.container.querySelector('#btnStageMetronomeDecr')?.addEventListener('click', () => {
      this.songMetronome.stepBpm(-1);
    });
    this.container.querySelector('#btnStageMetronomeIncr')?.addEventListener('click', () => {
      this.songMetronome.stepBpm(1);
    });
    this.container.querySelector('#btnStageMetronomeTap')?.addEventListener('click', () => {
      this.songMetronome.handleTapTempo();
    });

    // Metrónomo en Panel Modal
    if (this.isMetronomePanelOpen) {
      this.container.querySelector('#btnCloseSongMetronome')?.addEventListener('click', () => {
        this.isMetronomePanelOpen = false;
        this.render();
      });

      this.container.querySelector('#songMetronomeOverlay')?.addEventListener('click', (event) => {
        if (event.target.id === 'songMetronomeOverlay') {
          this.isMetronomePanelOpen = false;
          this.render();
        }
      });

      this.container.querySelector('#btnDialogToggleMetronome')?.addEventListener('click', () => {
        this.songMetronome.toggle();
      });

      this.container.querySelector('#btnDialogTapTempo')?.addEventListener('click', () => {
        this.songMetronome.handleTapTempo();
      });

      this.container.querySelectorAll('[data-metro-delta]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.songMetronome.stepBpm(Number(btn.dataset.metroDelta));
        });
      });

      this.container.querySelector('#rngSongMetroBpm')?.addEventListener('input', (event) => {
        this.songMetronome.setBpm(Number(event.target.value));
      });

      this.container.querySelectorAll('[data-metro-signature]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.songMetronome.setTimeSignature(btn.dataset.metroSignature);
          this.render();
        });
      });

      this.container.querySelector('#btnDialogMetroAccent')?.addEventListener('click', () => {
        this.songMetronome.setAccent(!this.songMetronome.accent);
        this.render();
      });

      this.container.querySelectorAll('[data-metro-countin]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.songMetronome.setCountIn(Number(btn.dataset.metroCountin));
          this.render();
        });
      });

      this.container.querySelector('#rngSongMetroVolume')?.addEventListener('input', (event) => {
        this.songMetronome.setVolume(Number(event.target.value) / 100);
      });

      this.container.querySelectorAll('[data-metro-sound]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.songMetronome.setSound(btn.dataset.metroSound);
          this.render();
        });
      });
    }

    this.container.querySelector('#btnFontDecr')?.addEventListener('click', () => this.setFontSizeScale(-10));
    this.container.querySelector('#btnFontIncr')?.addEventListener('click', () => this.setFontSizeScale(10));
    this.container.querySelector('#btnStageFontDecr')?.addEventListener('click', () => this.setFontSizeScale(-10));
    this.container.querySelector('#btnStageFontIncr')?.addEventListener('click', () => this.setFontSizeScale(10));

    this.container.querySelector('#btnInstrumentSelect')?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.isInstrumentMenuOpen = !this.isInstrumentMenuOpen;
      this.isOptionsMenuOpen = false;
      this.render();
      requestAnimationFrame(() => {
        if (this.isInstrumentMenuOpen) this.container.querySelector('.inst-option-card')?.focus();
      });
    });

    this.container.querySelectorAll('.inst-option-card').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.setInstrument(button.dataset.inst);
      });
    });

    this.container.querySelector('#btnMoreOptions')?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.isOptionsMenuOpen = !this.isOptionsMenuOpen;
      this.isInstrumentMenuOpen = false;
      this.render();
      requestAnimationFrame(() => {
        if (this.isOptionsMenuOpen) this.container.querySelector('#btnToggleSpeedTrainer')?.focus();
      });
    });

    this.container.querySelector('#btnEnterStageMode')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.enterStageMode();
    });

    this.container.querySelector('#btnQuickRecordAction')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.toggleRecording();
    });

    this.container.querySelector('#btnToggleSpeedTrainer')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('ui:toggleSpeedTrainer');
      this.announce('Modo ensayo actualizado');
    });

    this.container.querySelector('#btnOpenTunerQuick')?.addEventListener('click', () => {
      this.isOptionsMenuOpen = false;
      this.render();
      events.emit('tuner:open');
    });

    this.container.querySelector('#btnToggleLiveListen')?.addEventListener('click', () => this.toggleLiveListening());

    this.container.querySelector('#btnToggleSimplified')?.addEventListener('click', () => {
      this.isSimplified = !this.isSimplified;
      safeStorageSet('app_simplified_chords', this.isSimplified);
      this.isOptionsMenuOpen = false;
      this.render();
      this.scheduleSessionSave();
      this.announce(this.isSimplified ? 'Acordes simplificados' : 'Acordes originales');
    });

    this.container.querySelector('#btnToggleHideChords')?.addEventListener('click', () => {
      this.hideChordsMode = !this.hideChordsMode;
      this.isOptionsMenuOpen = false;
      this.render();
      this.scheduleSessionSave();
    });

    this.container.querySelector('#selSongCapo')?.addEventListener('change', (event) => this.setCapo(event.target.value));
    this.container.querySelector('#selSongNotation')?.addEventListener('change', (event) => this.setNotationSystem(event.target.value));
    this.container.querySelector('#selSongTheme')?.addEventListener('change', (event) => this.setVisualTheme(event.target.value));
    this.container.querySelector('#selSongVersion')?.addEventListener('change', (event) => this.selectSongVersion(event.target.value));
    this.container.querySelector('#btnApplyTransposeRecommendation')?.addEventListener('click', (event) => {
      this.isOptionsMenuOpen = false;
      this.setTranspose(Number(event.currentTarget.dataset.semitones));
    });

    this.container.querySelectorAll('.song-section-link').forEach((button) => {
      button.addEventListener('click', () => this.navigateToSection(button.dataset.sectionId, true));
    });

    this.container.querySelector('#btnExitStageMode')?.addEventListener('click', () => this.exitStageMode());

    this.container.querySelectorAll('.chord-badge').forEach((badge) => {
      badge.addEventListener('click', (event) => {
        event.stopPropagation();
        const chordName = badge.dataset.chord || badge.dataset.originalChord;
        if (chordName) this.chordPopover.show(chordName, badge, this.currentInstrument, this.notationSystem);
      });
    });

    this.container.querySelectorAll('.song-chord-visual-card').forEach((card) => {
      card.addEventListener('click', () => {
        const chordName = card.dataset.originalChord || card.dataset.chord;
        if (!chordName) return;
        chordEngine.auditionChord(chordName, this.currentInstrument);
        const displayName = ChordProParser.formatChordDisplay(chordName, this.notationSystem);
        toast.show(`Sonando ${displayName}`, 'info', 600);
      });
    });
  }

  destroy() {
    this.saveSessionNow();
    this.autoScroller.stop('destroy');
    this.songMetronome.destroy();
    if (this.isLiveListening) pitchDetector.stop();
    this.releaseScreenWakeLock();
    this.dockObserver?.disconnect();
    this.dockObserver = null;
    if (this.scrollRaf) cancelAnimationFrame(this.scrollRaf);
    if (this.restoredNoticeTimer) clearTimeout(this.restoredNoticeTimer);
    if (this.recoveryResumeTimer) clearTimeout(this.recoveryResumeTimer);
    if (this.recoveryScoreLoadTimer) clearTimeout(this.recoveryScoreLoadTimer);
    this.sessionRecovery.destroy();
    super.destroy();
  }
}

export default LyricsChordsView;
