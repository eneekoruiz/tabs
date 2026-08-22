/**
 * @file main.js
 * @description Punto de entrada principal (Bootstrap) de Tabs & Chords PRO.
 * Inicializa arquitectura Mobile-First: BottomNav, HomeView (Explorar), ToolsView (Afinador de Oído & Acordes IA),
 * LibraryExplorer (Mis Tabs), AudioEngine, GigMode y Exporter.
 */

import { events } from './core/EventBus.js';

// Suprimir warnings inofensivos de AlphaTab en consola
const originalWarn = console.warn;
console.warn = function(...args) {
  if (args[0] && typeof args[0] === 'string' && (
    args[0].includes('AlphaTab skipped rendering because of width=0') ||
    args[0].includes('AlphaTab container was invisible while autosizing')
  )) return;
  originalWarn.apply(console, args);
};

import { state } from './core/State.js';
import { audioEngine } from './core/AudioEngine.js';
import { db } from './data/Database.js';
import { metadataParser } from './data/MetadataParser.js';
import { TransportBar } from './ui/TransportBar.js';
import { LibraryExplorer } from './ui/LibraryExplorer.js';
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
import { HomeView } from './ui/HomeView.js';
import { ToolsView } from './ui/ToolsView.js';
import './ui/KeyboardShortcuts.js';
import { toast } from './ui/Toast.js';

class App {
  constructor() {
    this.components = {};
  }

  async start() {
    console.log('🚀 [Tabs & Chords PRO] Iniciando aplicación Mobile-First (Ultimate Guitar UX)...');

    try {
      // 1. Inicializar la persistencia IndexedDB y poblar Mega-Catalog
      await db.init();

      // 2. Montar Vistas y Componentes Mobile-First
      this.components.bottomNav = new BottomNav('#bottom-nav-container');

      this.components.homeView = new HomeView('#explore-view-container');
      await this.components.homeView.loadExploreData();

      this.components.toolsView = new ToolsView('#tools-view-container');
      this.components.toolsView.render();

      this.components.transport = new TransportBar('#transport-container');
      this.components.transport.render();

      this.components.library = new LibraryExplorer('#library-container');
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

      // Inicializar estado de navegación en Explorar (Home)
      this.components.bottomNav.setActiveTab('explore');

      // 3. Inicializar el motor de Audio AlphaTab
      const alphaTabContainer = document.getElementById('alphatab');
      const scoreViewport = document.getElementById('score-viewport');
      await audioEngine.init(alphaTabContainer, scoreViewport);

      // 4. Configurar eventos globales y Drag & Drop
      this.setupGlobalEvents();
      this.setupDragAndDrop();

      // 5. Registrar Service Worker para PWA Offline si aplica
      this.registerServiceWorker();

      toast.show('Tabs & Chords PRO listo (Navegación Inferior Mobile-First)', 'success');
    } catch (error) {
      console.error('❌ [Tabs & Chords PRO] Error crítico durante el arranque:', error);
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

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let reg of registrations) {
          reg.unregister();
          console.log('🧹 [PWA] Service Worker desregistrado permanentemente.');
        }
      });
      if ('caches' in window) {
        caches.keys().then((keys) => {
          for (let k of keys) caches.delete(k);
        });
      }
    }
  }
}

function bootstrapAppMain() {
  const app = new App();
  app.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapAppMain);
} else {
  bootstrapAppMain();
}
