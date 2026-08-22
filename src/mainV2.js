/**
 * @file mainV2.js
 * @description Bootstrap V2 con soporte para Vista de Letra con Acordes interactivos (Ultimate Guitar UX).
 */

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
import './ui/KeyboardShortcuts.js';
import { toast } from './ui/Toast.js';

class AppV2 {
  constructor() {
    this.components = {};
  }

  async start() {
    console.log('🚀 [Tabs & Chords PRO V2] Iniciando sistema con Modo Letra & Acordes y Catálogo Extendido...');

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

      toast.show('Tabs & Chords PRO listo (Modo Letra con Acordes activo)', 'success');
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
    // Previene el zoom involuntario por doble toque en móviles/tablets, pero permite el gesto de pellizco (pinch-to-zoom)
    let lastTouchEndTime = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      // Solo intercepta toques simples rápidos repetidos (doble clic táctil)
      if (e.touches && e.touches.length <= 1 && (now - lastTouchEndTime) <= 280) {
        // No interferir con inputs de texto normales
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
        }
      }
      lastTouchEndTime = now;
    }, { passive: false });

    // Evitar zoom con rueda del ratón involuntaria salvo si se pulsa Ctrl explícitamente
    document.addEventListener('dblclick', (e) => {
      if (e.target.closest('.chord-badge, .btn-popover-inst, button, .lyrics-line, .lyrics-chords-container')) {
        e.preventDefault();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new AppV2();
  app.setupGestureControls();
  app.start();
});
