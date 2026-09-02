/**
 * @file mainV2.js
 * @description Bootstrap V2 con soporte para Vista de Letra con Acordes interactivos (Ultimate Guitar UX).
 */

// Suprimir warnings inofensivos de AlphaTab en consola
const originalWarn = console.warn;
console.warn = function(...args) {
  if (args[0] && typeof args[0] === 'string' && (
    args[0].includes('AlphaTab skipped rendering because of width=0') ||
    args[0].includes('AlphaTab container was invisible while autosizing')
  )) return;
  originalWarn.apply(console, args);
};

import { events } from './core/EventBus.js';
import { state } from './core/State.js';
import { audioEngine } from './core/AudioEngineV2.js';
import { db } from './data/Database.js';
import { metadataParser } from './data/MetadataParser.js';
import { TransportBar } from './ui/TransportBar.js';
import { LibraryExplorerV2 } from './ui/LibraryExplorerV2.js';
import { CommandPalette } from './ui/CommandPalette.js';
import { Mixer } from './ui/Mixer.js';
import { Fretboard } from './ui/Fretboard.js';
import { SpeedTrainer } from './ui/SpeedTrainer.js';
import { TunerScoreFollower } from './ui/TunerScoreFollower.js';
import { ProToolbox } from './ui/ProToolbox.js';
import { ChordModal } from './ui/ChordModal.js';
import { GigMode } from './ui/GigMode.js';
import { PianoVisualizer } from './ui/PianoVisualizer.js';
import { DrumKitVisualizer } from './ui/DrumKitVisualizer.js';
import { AudioSyncModal } from './ui/AudioSyncModal.js';
import { ExportModal } from './ui/ExportModal.js';
import { BottomNav } from './ui/BottomNav.js';
import { HomeViewV2 } from './ui/HomeViewV2.js';
import { ToolsView } from './ui/ToolsView.js';
import { SettingsView } from './ui/SettingsView.js';
import { LyricsChordsView } from './ui/LyricsChordsView.js';
import { SongImporterModal } from './ui/SongImporterModal.js';
import { practiceTrackerService } from './data/PracticeTrackerService.js';
import { backupSyncEngine } from './data/BackupSyncEngine.js';
import { audioTranscriptionEngine } from './audio/AudioTranscriptionEngine.js';
import { stemSeparatorEngine } from './audio/StemSeparatorEngine.js';
import { pedalboardEngine } from './audio/PedalboardEngine.js';
import { smartLooperEngine } from './audio/SmartLooperEngine.js';
import { smartBandEngine } from './audio/SmartBandEngine.js';
import { gamificationEngine } from './audio/GamificationEngine.js';
import { bandRoomEngine } from './net/BandRoomEngine.js';
import { stageAutomationEngine } from './hardware/StageAutomationEngine.js';
import { spatialXRHudView } from './ui/SpatialXRHudView.js';
import { stemSeparatorTool } from './ui/tools/StemSeparatorTool.js';
import { pedalboardTool } from './ui/tools/PedalboardTool.js';
import { smartLooperTool } from './ui/tools/SmartLooperTool.js';
import { smartBandTool } from './ui/tools/SmartBandTool.js';
import { arcadeHighwayVisualizer } from './ui/tools/ArcadeHighwayVisualizer.js';
import { bandRoomTool } from './ui/tools/BandRoomTool.js';
import { stageAutomationTool } from './ui/tools/StageAutomationTool.js';
import './ui/KeyboardShortcuts.js';
import { toast } from './ui/Toast.js';

function applyStoredTheme() {
  let theme = 'paper';
  try {
    theme = localStorage.getItem('app_visual_theme') || 'paper';
    if (!localStorage.getItem('app_visual_theme')) localStorage.setItem('app_visual_theme', theme);
  } catch {
    // The default remains usable when storage is restricted.
  }

  document.body.classList.remove('theme-ivory', 'theme-charcoal', 'theme-amber');
  if (theme === 'oled') document.body.classList.add('theme-charcoal');
  else if (theme === 'amber') document.body.classList.add('theme-amber');
  else document.body.classList.add('theme-ivory');
}

class AppV2 {
  constructor() {
    this.components = {};
    window.practiceTrackerService = practiceTrackerService;
    window.backupSyncEngine = backupSyncEngine;
    window.audioTranscriptionEngine = audioTranscriptionEngine;
    window.stemSeparatorEngine = stemSeparatorEngine;
    window.pedalboardEngine = pedalboardEngine;
    window.smartLooperEngine = smartLooperEngine;
    window.smartBandEngine = smartBandEngine;
    window.gamificationEngine = gamificationEngine;
    window.bandRoomEngine = bandRoomEngine;
    window.stageAutomationEngine = stageAutomationEngine;
    window.spatialXRHudView = spatialXRHudView;
    window.stemSeparatorTool = stemSeparatorTool;
    window.pedalboardTool = pedalboardTool;
    window.smartLooperTool = smartLooperTool;
    window.smartBandTool = smartBandTool;
    window.arcadeHighwayVisualizer = arcadeHighwayVisualizer;
    window.bandRoomTool = bandRoomTool;
    window.stageAutomationTool = stageAutomationTool;
  }

  async start() {
    console.log('🚀 [Tabs & Chords PRO V2] Iniciando sistema con Modo Letra & Acordes, Transcripción IA y Analíticas...');

    try {
      await db.init();

      this.components.bottomNav = new BottomNav('#bottom-nav-container');

      this.components.homeView = new HomeViewV2('#explore-view-container');
      await this.components.homeView.loadExploreData();

      this.components.toolsView = new ToolsView('#tools-view-container');
      this.components.toolsView.render();

      this.components.settingsView = new SettingsView('#settings-view-container');
      this.components.settingsView.render();

      this.components.transport = new TransportBar('#transport-container');
      this.components.transport.render();

      this.components.lyricsChords = new LyricsChordsView('#lyrics-chords-container');
      this.components.lyricsChords.render();

      this.components.songImporter = new SongImporterModal('#song-importer-container');

      this.components.library = new LibraryExplorerV2('#library-container');
      await this.components.library.loadLibrary();

      this.components.mixer = new Mixer('#mixer-container');
      this.components.mixer.render();

      this.components.fretboard = new Fretboard('#fretboard-container');
      this.components.fretboard.render();

      this.components.piano = new PianoVisualizer('#piano-container');
      this.components.drums = new DrumKitVisualizer('#drums-container');

      this.components.speedTrainer = new SpeedTrainer('#speedtrainer-container');
      this.components.speedTrainer.render();

      this.components.tuner = new TunerScoreFollower('#tuner-container');
      this.components.tuner.render();

      this.components.toolbox = new ProToolbox('#pro-toolbox-container');
      this.components.toolbox.render();

      this.components.chordModal = new ChordModal('#chord-modal-container');
      this.components.audioSync = new AudioSyncModal('#audio-sync-modal-container');
      this.components.exportModal = new ExportModal('#export-modal-container');
      this.components.gigMode = new GigMode('#gig-mode-container');

      this.components.bottomNav.setActiveTab('explore');

      const alphaTabContainer = document.getElementById('alphatab');
      const scoreViewport = document.getElementById('score-viewport');
      await audioEngine.init(alphaTabContainer, scoreViewport);

      this.setupGlobalEvents();
      this.setupDragAndDrop();

    } catch (error) {
      console.error('❌ [Tabs & Chords PRO V2] Error crítico durante el arranque:', error);
      toast.show('Error iniciando el sistema: ' + error.message, 'error');
    }
  }

  setupGlobalEvents() {
    events.on('score:loaded', ({ score }) => {
      const titleEl = document.getElementById('songInfoTitle');
      const artistEl = document.getElementById('songInfoArtist');
      const detailsEl = document.getElementById('songInfoDetails');

      if (titleEl) titleEl.textContent = score.title || 'Sin título';
      if (artistEl) artistEl.textContent = score.artist ? `— ${score.artist}` : '';
      if (detailsEl) {
        detailsEl.innerHTML = `
          <span>♩ ${score.tempo || 120} BPM</span>
          <span>🎼 ${score.tracks?.length || 1} pistas</span>
        `;
      }
    });

    events.on('ui:toggleSpeedTrainer', () => {
      const stContainer = document.getElementById('speedtrainer-container');
      if (stContainer) {
        stContainer.classList.toggle('open');
      }
    });

    events.on('ui:toggleFretboard', (forceState) => {
      const fbContainer = document.getElementById('fretboard-container');
      if (fbContainer) {
        if (typeof forceState === 'boolean') {
          fbContainer.style.display = forceState ? 'block' : 'none';
        } else {
          const isHidden = fbContainer.style.display === 'none' || !fbContainer.style.display;
          fbContainer.style.display = isHidden ? 'block' : 'none';
        }
      }
    });
  }

  setupDragAndDrop() {
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = e.dataTransfer.files;
        toast.show(`Procesando ${files.length} archivo(s)...`, 'info');
        
        await metadataParser.processFilesBatch(files);

        if (files.length === 1) {
          const singleFile = files[0];
          if (singleFile.type.startsWith('audio/')) {
            events.emit('ui:toggleAudioSync');
            import('./audio/AudioSyncEngine.js').then(({ audioSyncEngine }) => {
              audioSyncEngine.loadAudioFile(singleFile);
            });
          } else {
            const buffer = await singleFile.arrayBuffer();
            audioEngine.load(buffer);
          }
        }
      }
    });
  }

  setupGestureControls() {
    // Evitar zoom involuntario en botones de interfaz con doble clic
    document.addEventListener('dblclick', (e) => {
      if (e.target.closest('.chord-badge, .btn-popover-inst, button, .lyrics-line, .lyrics-chords-container, .nav-tab-btn')) {
        e.preventDefault();
      }
    });
  }
}

function showCrashRecovery() {
  const container = document.getElementById('app-shell') || document.body;
  if (document.querySelector('.crash-recovery-overlay')) return;
  const card = document.createElement('div');
  card.className = 'crash-recovery-overlay';
  card.style.cssText = 'position:fixed;inset:0;background:#0d0e12;color:#fff;display:flex;align-items:center;justify-content:center;z-index:999999;padding:24px;font-family:sans-serif;text-align:center;';
  card.innerHTML = `
    <div style="max-width:420px;background:#181a20;border:1px solid rgba(255,255,255,0.1);padding:32px;border-radius:20px;box-shadow:0 20px 50px rgba(0,0,0,0.5);">
      <div style="font-size:3rem;margin-bottom:12px;">🎸</div>
      <h2 style="font-size:1.3rem;margin:0 0 8px 0;font-weight:800;">Tabs & Chords PRO</h2>
      <p style="font-size:0.9rem;color:#a0a5b0;margin:0 0 24px 0;line-height:1.4;">Hubo un problema temporal al cargar la aplicación. Puedes reiniciar o restablecer la caché.</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-direction:column;">
        <button id="btnCrashReload" style="background:#ff5722;color:#fff;border:none;padding:12px 20px;border-radius:12px;font-weight:700;font-size:0.95rem;cursor:pointer;">Reiniciar aplicación</button>
        <button id="btnCrashReset" style="background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.15);padding:10px 16px;border-radius:12px;font-weight:600;font-size:0.85rem;cursor:pointer;">Limpiar caché y reintentar</button>
      </div>
    </div>
  `;
  container.appendChild(card);
  card.querySelector('#btnCrashReload')?.addEventListener('click', () => window.location.reload());
  card.querySelector('#btnCrashReset')?.addEventListener('click', async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      localStorage.clear();
    } catch {}
    window.location.reload();
  });
}

function bootstrapApp() {
  try {
    applyStoredTheme();
    const app = new AppV2();
    app.setupGestureControls();
    app.start();
  } catch (err) {
    console.error('[Bootstrap] Error crítico:', err);
    showCrashRecovery();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}
