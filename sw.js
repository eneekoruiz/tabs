/**
 * @file sw.js
 * @description Service Worker para funcionamiento 100% Offline y PWA Installable.
 */

const CACHE_NAME = 'tabs-chords-pro-v3';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/css/tokens.css',
  './assets/css/layout.css',
  './assets/css/components/analytics-dashboard.css',
  './assets/css/components/arcade-mode.css',
  './assets/css/components/audio-sync.css',
  './assets/css/components/band-room.css',
  './assets/css/components/bottom-nav.css',
  './assets/css/components/chord-diagram.css',
  './assets/css/components/command-palette.css',
  './assets/css/components/discovery-workspace.css',
  './assets/css/components/experience-refinement.css',
  './assets/css/components/export-modal.css',
  './assets/css/components/fretboard.css',
  './assets/css/components/gig-mode.css',
  './assets/css/components/library.css',
  './assets/css/components/lyrics-chords.css',
  './assets/css/components/mixer.css',
  './assets/css/components/multi-instrument.css',
  './assets/css/components/pedalboard.css',
  './assets/css/components/pro-toolbox.css',
  './assets/css/components/recording-preview.css',
  './assets/css/components/setlist-studio.css',
  './assets/css/components/settings.css',
  './assets/css/components/smart-band.css',
  './assets/css/components/smart-looper.css',
  './assets/css/components/song-importer.css',
  './assets/css/components/song-metronome.css',
  './assets/css/components/song-workspace.css',
  './assets/css/components/spatial-xr.css',
  './assets/css/components/speedtrainer.css',
  './assets/css/components/stage-automation.css',
  './assets/css/components/stems-mixer.css',
  './assets/css/components/toast.css',
  './assets/css/components/tool-previews.css',
  './assets/css/components/tools-panoramic.css',
  './assets/css/components/tools-premium.css',
  './assets/css/components/transcriber.css',
  './assets/css/components/transport.css',
  './assets/css/components/tuner.css',
  './assets/css/components/vocal-coach.css',
  './assets/css/components/vocal-range-finder.css',
  './assets/css/components/version-picker.css',
  './assets/vendor/alphatab/1.8.4/alphaTab.min.js',
  './assets/vendor/alphatab/1.8.4/alphaTab.worker.min.mjs',
  './assets/vendor/alphatab/1.8.4/alphaTab.worklet.min.mjs',
  './assets/vendor/alphatab/1.8.4/font/Bravura.woff2',
  './assets/vendor/alphatab/1.8.4/soundfont/sonivox.sf2',
  './src/mainV2.js',
  './src/audio/AudioFeedback.js',
  './src/audio/AudioSyncEngine.js',
  './src/audio/AudioTranscriptionEngine.js',
  './src/audio/GamificationEngine.js',
  './src/audio/GigRecorder.js',
  './src/audio/PedalboardEngine.js',
  './src/audio/PitchDetector.js',
  './src/audio/SmartBandEngine.js',
  './src/audio/SmartLooperEngine.js',
  './src/audio/StemSeparatorEngine.js',
  './src/audio/VocalCoachEngine.js',
  './src/core/AudioEngine.js',
  './src/core/AudioEngineV2.js',
  './src/core/EventBus.js',
  './src/core/State.js',
  './src/data/BackupSyncEngine.js',
  './src/data/CatalogDataset.js',
  './src/data/Database.js',
  './src/data/Exporter.js',
  './src/data/MetadataParser.js',
  './src/data/OnlineSongProvider.js',
  './src/data/PracticeTrackerService.js',
  './src/data/SearchEngine.js',
  './src/data/SessionRecovery.js',
  './src/data/SetlistManager.js',
  './src/data/SoundFontCache.js',
  './src/data/catalog/AcousticCatalog.js',
  './src/data/catalog/ArtistDiscographies.js',
  './src/data/catalog/OfflineUniversalLibraryEngine.js',
  './src/data/catalog/PopCatalog.js',
  './src/data/catalog/RockCatalog.js',
  './src/data/lyrics/KnownSongLyrics.js',
  './src/data/lyrics/LyricsHarmonizer.js',
  './src/hardware/StageAutomationEngine.js',
  './src/net/BandRoomEngine.js',
  './src/tools/ChordEngine.js',
  './src/tools/chord/ChordAudioSynthesizer.js',
  './src/tools/chord/ChordDefinitions.js',
  './src/tools/chord/ChordSvgRenderer.js',
  './src/ui/AudioSpectrumVisualizer.js',
  './src/ui/AudioSyncModal.js',
  './src/ui/BottomNav.js',
  './src/ui/ChordModal.js',
  './src/ui/CommandPalette.js',
  './src/ui/Component.js',
  './src/ui/DrumKitVisualizer.js',
  './src/ui/ExportModal.js',
  './src/ui/Fretboard.js',
  './src/ui/GigMode.js',
  './src/ui/HomeView.js',
  './src/ui/HomeViewV2.js',
  './src/ui/KeyboardShortcuts.js',
  './src/ui/LibraryExplorer.js',
  './src/ui/LibraryExplorerV2.js',
  './src/ui/LyricsChordsView.js',
  './src/ui/Mixer.js',
  './src/ui/PianoVisualizer.js',
  './src/ui/ProToolbox.js',
  './src/ui/SettingsView.js',
  './src/ui/SongImporterModal.js',
  './src/ui/SpatialXRHudView.js',
  './src/ui/SpeedTrainer.js',
  './src/ui/Toast.js',
  './src/ui/ToolsView.js',
  './src/ui/TransportBar.js',
  './src/ui/TunerScoreFollower.js',
  './src/ui/lyrics/ChordDiagramRenderer.js',
  './src/ui/lyrics/ChordPopoverModal.js',
  './src/ui/lyrics/ChordProParser.js',
  './src/ui/lyrics/SongAudioRecorder.js',
  './src/ui/lyrics/SongAutoScroller.js',
  './src/ui/lyrics/SongMetronomeCompanion.js',
  './src/ui/lyrics/YouTubeCompanion.js',
  './src/ui/lyrics/VersionPickerModal.js',
  './src/ui/lyrics/VocalRangeFinder.js',
  './src/ui/lyrics/PitchLaneCanvas.js',
  './src/ui/tools/ArcadeHighwayVisualizer.js',
  './src/ui/tools/AudioTranscriberTool.js',
  './src/ui/tools/BandRoomTool.js',
  './src/ui/tools/CapoCalculatorTool.js',
  './src/ui/tools/ChordDictionaryTool.js',
  './src/ui/tools/CircleOfFifthsTool.js',
  './src/ui/tools/EarTrainerTool.js',
  './src/ui/tools/MetronomeTool.js',
  './src/ui/tools/PedalboardTool.js',
  './src/ui/tools/PracticeAnalyticsTool.js',
  './src/ui/tools/SmartBandTool.js',
  './src/ui/tools/SmartLooperTool.js',
  './src/ui/tools/StageAutomationTool.js',
  './src/ui/tools/StemSeparatorTool.js',
  './src/ui/tools/TunerTool.js',
  './src/ui/tools/VocalCoachTool.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll falla si un recurso 404 → usamos add individual con catch
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch(() => {
            console.warn('[SW] No se pudo cachear:', url);
          })
        )
      );
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Solo interceptar GET. Ignorar chrome-extension, data URIs, etc.
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Estrategia: Network-First para HTML y JS (siempre frescos),
  //             Cache-First para assets estáticos (CSS, fonts, woff2, sf2)
  const isAsset = /\.(css|woff2?|ttf|eot|png|jpg|jpeg|svg|ico|sf2|mjs)(\?.*)?$/.test(url.pathname);

  if (isAsset) {
    // Cache-First: responde inmediatamente desde caché, si falla → red
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return res;
        }).catch(() => new Response('', { status: 408, statusText: 'Offline' }));
      })
    );
  } else {
    // Network-First: intenta red, si falla usa caché, si tampoco → fallback HTML
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() =>
        caches.match(e.request).then((cached) => {
          if (cached) return cached;
          // Fallback SPA: devolver index.html para navegación offline
          return caches.match('./index.html').then((fallback) =>
            fallback || new Response('<h1>Sin conexión</h1>', {
              status: 503,
              headers: { 'Content-Type': 'text/html' }
            })
          );
        })
      )
    );
  }
});
