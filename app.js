/**
 * =========================================================================================
 * Tabs & Chords - Visor y Reproductor PRO (PoC)
 * =========================================================================================
 * Motor: AlphaTab (Web Audio + Canvas/SVG Rendering + General MIDI Synth)
 * Propósito: Leer archivos locales de Guitar Pro (.gp3, .gp4, .gp5, .gpx) y reproducir audio
 * =========================================================================================
 */

// 1. Referencias al DOM
const elements = {
  container: document.getElementById('alphatab'),
  viewport: document.getElementById('viewport'),
  fileInput: document.getElementById('fileInput'),
  playPauseBtn: document.getElementById('playPauseBtn'),
  playIcon: document.getElementById('playIcon'),
  playText: document.getElementById('playText'),
  stopBtn: document.getElementById('stopBtn'),
  loadDemoBtn: document.getElementById('loadDemoBtn'),
  currentTime: document.getElementById('currentTime'),
  totalTime: document.getElementById('totalTime'),
  statusIndicator: document.getElementById('statusIndicator'),
  statusText: document.getElementById('statusText'),
  songTitle: document.getElementById('songTitle'),
  songArtist: document.getElementById('songArtist'),
  songExtra: document.getElementById('songExtra'),
};

/**
 * 2. Configuración e Inicialización de la API de AlphaTab
 * 
 * ¿Por qué esta configuración?
 * - `core.fontDirectory`: AlphaTab necesita cargar fuentes tipográficas musicales (Bravura / signos de tablatura).
 *   Al usar el CDN, apuntamos a la carpeta 'dist/font/' para evitar glifos rotos.
 * - `player.enablePlayer: true`: Activa el subsistema de audio basado en Web Audio API y sintetizador MIDI por software.
 * - `player.soundFont`: Ruta absoluta al archivo SoundFont (.sf2). Es la "paleta de instrumentos" muestreados
 *   que el sintetizador usa para reproducir guitarras, bajos, baterías, etc.
 * - `player.scrollElement`: Vincula el contenedor que tiene scroll (viewport) con el cursor de AlphaTab
 *   para que la pantalla siga automáticamente la música durante la reproducción.
 */
const alphaTabSettings = {
  core: {
    fontDirectory: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/font/',
    logLevel: alphaTab.LogLevel.Warning,
  },
  display: {
    layoutMode: alphaTab.LayoutMode.Page, // Modo página vertical (estándar de lectura en Guitar Pro)
    staveProfile: alphaTab.StaveProfile.Default, // Muestra notación estándar + tablatura
  },
  player: {
    enablePlayer: true,
    // SoundFont oficial y activo provisto por el CDN de AlphaTab (SoniVox General MIDI)
    soundFont: 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2',
    scrollElement: elements.viewport,
    scrollMode: alphaTab.ScrollMode.Continuous,
  },
};

// Instanciamos el controlador principal de AlphaTab
const api = new alphaTab.AlphaTabApi(elements.container, alphaTabSettings);

// =========================================================================================
// 3. Suscripción a Eventos de AlphaTab (Sincronización de UI y Audio)
// =========================================================================================

/**
 * Evento: Progreso de carga del SoundFont (.sf2)
 * Los SoundFonts pueden pesar entre 5MB y 30MB; es crítico informar al usuario del progreso.
 */
api.soundFontLoad.on((e) => {
  const percent = Math.floor((e.loaded / e.total) * 100);
  setStatus(`Descargando SoundFont: ${isNaN(percent) ? 'en curso...' : percent + '%'}`, 'loading');
});

/**
 * Evento: SoundFont cargado en memoria de Web Audio
 */
api.soundFontLoaded.on(() => {
  setStatus('SoundFont listo. Abre un archivo GP para tocar.', 'ready');
});

/**
 * Evento: Partitura cargada y analizada correctamente
 * Se extraen los metadatos (Título, Artista, Tempo, Pistas) para mostrarlos en la UI.
 */
api.scoreLoaded.on((score) => {
  elements.songTitle.textContent = score.title || 'Canción sin título';
  elements.songArtist.textContent = score.artist ? `— ${score.artist}` : 'Artista desconocido';
  
  // Extraer información adicional (Tempo, tonalidad, compases)
  const tempo = score.tempo || 120;
  const tracksCount = score.tracks ? score.tracks.length : 1;
  elements.songExtra.innerHTML = `
    <span><strong>Tempo:</strong> ♩ ${tempo} BPM</span>
    <span><strong>Pistas:</strong> ${tracksCount}</span>
  `;

  setStatus('Partitura cargada correctamente', 'ready');
});

/**
 * Evento: El reproductor está listo para sonar (Partitura + SoundFont + Web Audio listos)
 * En este punto habilitamos los botones de transporte (Play / Stop).
 */
api.playerReady.on(() => {
  elements.playPauseBtn.disabled = false;
  elements.stopBtn.disabled = false;
  setStatus('Listo para reproducir', 'ready');
});

/**
 * Evento: Cambio de estado de la reproducción (Playing, Paused, Stopped)
 * Actualiza la apariencia y texto del botón Play/Pause.
 */
api.playerStateChanged.on((args) => {
  // AlphaTab PlayerState enum: 0 = Stopped, 1 = Playing, 2 = Paused
  if (args.state === alphaTab.synth.PlayerState.Playing) {
    elements.playIcon.textContent = '⏸';
    elements.playText.textContent = 'Pause';
    elements.playPauseBtn.classList.replace('btn-primary', 'btn-secondary');
  } else {
    elements.playIcon.textContent = '▶';
    elements.playText.textContent = 'Play';
    elements.playPauseBtn.classList.replace('btn-secondary', 'btn-primary');
  }
});

/**
 * Evento: Progreso de la posición de reproducción (Time Tracker)
 * Formatea los milisegundos a mm:ss tanto para el tiempo transcurrido como para el total.
 */
api.playerPositionChanged.on((args) => {
  elements.currentTime.textContent = formatTime(args.currentTime);
  elements.totalTime.textContent = formatTime(args.endTime);
});

/**
 * Evento: Notificación de renderizado de la partitura
 */
api.renderStarted.on(() => {
  setStatus('Renderizando partitura...', 'loading');
});

api.renderFinished.on(() => {
  if (api.isReadyForPlayback) {
    setStatus('Listo', 'ready');
  }
});

/**
 * Evento: Gestión de errores de carga o decodificación
 */
api.error.on((error) => {
  console.error('AlphaTab Error:', error);
  setStatus(`Error: ${error.message || 'No se pudo procesar el archivo'}`, 'error');
});

// =========================================================================================
// 4. Lógica de Carga de Archivos Locales (.gp3, .gp4, .gp5, .gpx, .gp)
// =========================================================================================

/**
 * Procesa un archivo File usando la API nativa de FileReader / ArrayBuffer
 * AlphaTab acepta directamente buffers binarios (ArrayBuffer o Uint8Array) en su método api.load()
 */
async function loadGuitarProFile(file) {
  if (!file) return;

  setStatus(`Leyendo archivo "${file.name}"...`, 'loading');

  try {
    // Leemos el archivo local como ArrayBuffer binario
    const arrayBuffer = await file.arrayBuffer();

    // Cargamos el buffer directamente en AlphaTab
    // AlphaTab detecta automáticamente el formato interno (.gp3, .gp4, .gp5, .gpx, .gp, MusicXML)
    api.load(arrayBuffer);
  } catch (err) {
    console.error('Error al leer el archivo local:', err);
    setStatus('Error al leer el archivo seleccionado', 'error');
  }
}

// Listener para el <input type="file">
elements.fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    loadGuitarProFile(file);
  }
});

// Soporte Drag & Drop: permite arrastrar un archivo .gp directamente sobre el navegador
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    loadGuitarProFile(e.dataTransfer.files[0]);
  }
});

// =========================================================================================
// 5. Control de Transporte (Play / Pause / Stop / Demo)
// =========================================================================================

// Botón Play / Pause
elements.playPauseBtn.addEventListener('click', () => {
  api.playPause();
});

// Botón Stop (detiene y regresa al inicio)
elements.stopBtn.addEventListener('click', () => {
  api.stop();
});

// Botón Demo Riff (Riff de prueba en formato AlphaTex para probar sin necesidad de tener un .gp a mano)
elements.loadDemoBtn.addEventListener('click', () => {
  setStatus('Cargando Demo Riff...', 'loading');
  
  // AlphaTex es la sintaxis de texto plano propia de AlphaTab
  const demoAlphaTex = `
    \\title "Rock Riff Demo (PoC)"
    \\artist "AlphaTab Player"
    \\tempo 130
    .
    :8 0.6 3.6 | 5.6 0.6 3.6 6.6 5.6.4 | 0.6 3.6 5.6 3.6 0.6.2 |
    :8 0.6 3.6 | 5.6 0.6 3.6 6.6 5.6.4 | 0.6 3.6 5.6 3.6 0.6.2 |
  `;

  api.load(demoAlphaTex);
});

// Atajo de teclado: Barra espaciadora para Play / Pause (estilo Guitar Pro / DAWs)
window.addEventListener('keydown', (e) => {
  // Evitamos activar el atajo si el usuario está interactuando con un input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (e.code === 'Space') {
    e.preventDefault(); // Evita el scroll default del navegador
    if (!elements.playPauseBtn.disabled) {
      api.playPause();
    }
  }
});

// =========================================================================================
// 6. Funciones Utilitarias (Helpers)
// =========================================================================================

/**
 * Actualiza el indicador visual de estado en la barra superior
 * @param {string} text - Mensaje a mostrar
 * @param {'loading' | 'ready' | 'error'} state - Estado visual
 */
function setStatus(text, state = 'loading') {
  elements.statusText.textContent = text;
  elements.statusIndicator.className = `status-pill status-${state}`;
}

/**
 * Convierte milisegundos en formato de tiempo mm:ss
 * @param {number} milliseconds
 * @returns {string} tiempo formateado (ej. "03:45")
 */
function formatTime(milliseconds) {
  if (isNaN(milliseconds) || milliseconds < 0) return '00:00';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
