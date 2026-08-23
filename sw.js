/**
 * PWA service worker with a complete, versioned offline application shell.
 */

const CACHE_PREFIX = 'tabs-chords-pro-';
const CACHE_NAME = `${CACHE_PREFIX}v3.0.3`;
const APP_SHELL = './index.html';

const PRECACHE_ASSETS = Object.freeze([
  './',
  APP_SHELL,
  './manifest.json',
  './assets/icons/app-icon-192.png',
  './assets/icons/app-icon-512.png',
  './assets/css/tokens.css',
  './assets/css/layout.css',
  './assets/css/components/audio-sync.css',
  './assets/css/components/bottom-nav.css',
  './assets/css/components/chord-diagram.css',
  './assets/css/components/command-palette.css',
  './assets/css/components/export-modal.css',
  './assets/css/components/fretboard.css',
  './assets/css/components/gig-mode.css',
  './assets/css/components/library.css',
  './assets/css/components/lyrics-chords.css',
  './assets/css/components/mixer.css',
  './assets/css/components/multi-instrument.css',
  './assets/css/components/pro-toolbox.css',
  './assets/css/components/settings.css',
  './assets/css/components/song-importer.css',
  './assets/css/components/speedtrainer.css',
  './assets/css/components/toast.css',
  './assets/css/components/tools-panoramic.css',
  './assets/css/components/tools-premium.css',
  './assets/css/components/transport.css',
  './assets/css/components/tuner.css',
  './assets/css/components/discovery-workspace.css',
  './assets/css/components/setlist-studio.css',
  './assets/css/components/song-workspace.css',
  './assets/css/components/song-metronome.css',
  './assets/css/components/experience-refinement.css',
  './assets/css/components/recording-preview.css',
  './assets/css/components/tool-previews.css',
  './assets/vendor/alphatab/1.8.4/alphaTab.min.js',
  './assets/vendor/alphatab/1.8.4/alphaTab.worker.min.mjs',
  './assets/vendor/alphatab/1.8.4/alphaTab.worklet.min.mjs',
  './assets/vendor/alphatab/1.8.4/font/Bravura.woff2',
  './assets/vendor/alphatab/1.8.4/soundfont/sonivox.sf2',
  './src/mainV2.js',
  './src/audio/AudioFeedback.js',
  './src/audio/AudioSyncEngine.js',
  './src/audio/GigRecorder.js',
  './src/audio/PitchDetector.js',
  './src/core/AudioEngine.js',
  './src/core/AudioEngineV2.js',
  './src/core/EventBus.js',
  './src/core/State.js',
  './src/data/CatalogDataset.js',
  './src/data/Database.js',
  './src/data/Exporter.js',
  './src/data/MetadataParser.js',
  './src/data/OnlineSongProvider.js',
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
  './src/tools/ChordEngine.js',
  './src/tools/chord/ChordAudioSynthesizer.js',
  './src/tools/chord/ChordDefinitions.js',
  './src/tools/chord/ChordSvgRenderer.js',
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
  './src/ui/tools/CapoCalculatorTool.js',
  './src/ui/tools/ChordDictionaryTool.js',
  './src/ui/tools/CircleOfFifthsTool.js',
  './src/ui/tools/EarTrainerTool.js',
  './src/ui/tools/MetronomeTool.js',
  './src/ui/tools/TunerTool.js'
]);

async function precacheApplication() {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(PRECACHE_ASSETS.map(async (asset) => {
    const request = new Request(asset, { cache: 'reload' });
    const response = await fetch(request);
    if (!response.ok) {
      throw new Error(`${asset}: HTTP ${response.status}`);
    }
    await cache.put(request, response);
  }));

  const failures = results
    .map((result, index) => result.status === 'rejected' ? PRECACHE_ASSETS[index] : null)
    .filter(Boolean);

  if (failures.length > 0) {
    throw new Error(`Offline precache incomplete: ${failures.join(', ')}`);
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'OFFLINE_DIAGNOSTICS') return;
  const replyPort = event.ports?.[0];
  if (!replyPort) return;

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const resources = await Promise.all(PRECACHE_ASSETS.map(async (path) => ({
      path,
      available: Boolean(await cache.match(path, { ignoreSearch: true }))
    })));
    replyPort.postMessage({
      type: 'OFFLINE_DIAGNOSTICS_RESULT',
      cacheName: CACHE_NAME,
      resources
    });
  })().catch((error) => {
    replyPort.postMessage({
      type: 'OFFLINE_DIAGNOSTICS_RESULT',
      error: String(error?.message || error),
      resources: []
    });
  }));
});

self.addEventListener('install', (event) => {
  event.waitUntil(precacheApplication().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) {
      event.waitUntil(
        fetch(request)
          .then(async (response) => {
            if (response.ok) {
              const cache = await caches.open(CACHE_NAME);
              await cache.put(request, response.clone());
            }
          })
          .catch(() => undefined)
      );
      return cached;
    }

    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (request.mode === 'navigate') {
        return caches.match(APP_SHELL, { ignoreSearch: true });
      }
      return new Response('Recurso no disponible sin conexion.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});
