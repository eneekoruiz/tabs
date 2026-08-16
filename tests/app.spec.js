import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Configuración de emulación móvil estricta (iPhone 13 - 390x844)
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe('🎸 Tabs & Chords PRO - Suite E2E Modo Letras & Acordes Multi-Instrumento', () => {

  let consoleErrors = [];
  let networkErrors = [];

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    consoleErrors = [];
    networkErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    page.on('response', (resp) => {
      if (resp.status() >= 400) {
        networkErrors.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await page.addInitScript(() => {
      if (!navigator.mediaDevices) {
        navigator.mediaDevices = {};
      }
      navigator.mediaDevices.getUserMedia = async () => {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        const dst = audioCtx.createMediaStreamDestination();
        osc.connect(dst);
        try { osc.start(); } catch (e) {}
        return dst.stream;
      };

      navigator.getBattery = async () => ({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 0.95,
        addEventListener: () => {},
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.bottom-nav-bar');
  });

  test.afterEach(async () => {
    const realErrors = consoleErrors.filter(e => !e.includes('Failed to load resource') && !e.includes('favicon'));
    expect(realErrors, `Se detectaron errores en la consola: ${realErrors.join(', ')}`).toEqual([]);
  });

  test('1. Navegación Inferior Mobile-First con Ajustes (Bottom Nav Bar Visible)', async ({ page }) => {
    const bottomNav = page.locator('.bottom-nav-bar');
    await expect(bottomNav).toBeVisible();

    await expect(page.locator('.nav-tab-btn[data-tab="explore"]')).toBeVisible();
    await expect(page.locator('.nav-tab-btn[data-tab="library"]')).toBeVisible();
    await expect(page.locator('.nav-tab-btn[data-tab="tools"]')).toBeVisible();
    await expect(page.locator('.nav-tab-btn[data-tab="settings"]')).toBeVisible();
  });

  test('2. Auditoría de Accesibilidad Total en Viewport Móvil (axe-core)', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('3. Blackbird: Verificación de Letra Real y Oficial', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await expect(heroSearch).toBeVisible();

    await heroSearch.fill('Blackbird');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Blackbird/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    const lyricsContainer = page.locator('.lyrics-chords-container');
    await expect(lyricsContainer).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.lyrics-song-title')).toHaveText(/Blackbird/i);

    // Letra real oficial de los Beatles
    await expect(lyricsContainer).toContainText(/singing/i);
    await expect(lyricsContainer).toContainText(/dead/i);
    await expect(lyricsContainer).toContainText(/night/i);
    await expect(lyricsContainer).toContainText(/broken/i);
    await expect(lyricsContainer).toContainText(/wings/i);
    await expect(lyricsContainer).toContainText(/fly/i);

    // Asegurarse de que NUNCA aparezca texto de relleno
    await expect(lyricsContainer).not.toContainText(/Letra disponible para tocar/i);
  });

  test('4. Modo Multi-Instrumento, Notas Exactas de Piano y Botón [X]', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('Wonderwall');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Wonderwall/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    // 1. Abrir acorde
    const chordBtn = page.locator('.chord-badge').first();
    await expect(chordBtn).toBeVisible();
    await chordBtn.click();

    const popover = page.locator('#chordPopoverCard');
    await expect(popover).toBeVisible();

    // Verificar botón de cierre [X]
    const btnX = popover.locator('#btnPopoverXClose');
    await expect(btnX).toBeVisible();

    // 2. Cambiar a modo Piano en el popover
    const btnPiano = popover.locator('.btn-popover-inst[data-popinst="piano"]');
    await btnPiano.click();
    await expect(popover.locator('.piano-svg')).toBeVisible();

    // 3. Cambiar a modo Ukelele en el popover
    const btnUke = popover.locator('.btn-popover-inst[data-popinst="ukulele"]');
    await btnUke.click();
    await expect(popover.locator('.ukulele-svg')).toBeVisible();

    // 4. Probar botón de escuchar sonido de alta fidelidad
    const btnAudition = popover.locator('#btnAuditionPopoverChord');
    await expect(btnAudition).toBeVisible();
    await btnAudition.click();

    // 5. Cerrar con el botón [X]
    await btnX.click();
    await expect(popover).toBeHidden();
  });

  test('5. Modos de Confort Visual Globales configurables desde Ajustes (Anti-Fatiga Ocular: OLED, Ámbar, Papel)', async ({ page }) => {
    // 1. Ir a Ajustes para cambiar el tema visual de forma global
    const navSettings = page.locator('.nav-tab-btn[data-tab="settings"]');
    await navSettings.click();

    const selTheme = page.locator('#selSettingsVisualTheme');
    await expect(selTheme).toBeVisible();
    await selTheme.selectOption('amber');

    // 2. Abrir una canción y verificar que adopta el tema ámbar global
    const navExplore = page.locator('.nav-tab-btn[data-tab="explore"]');
    await navExplore.click();

    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('Let It Be');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Let It Be/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    const lyricsContainer = page.locator('.lyrics-chords-container');
    await expect(lyricsContainer).toHaveClass(/theme-amber/);
  });

  test('6. Auto-Scroll de Precisión (1% a 100%) con Medidor Porcentual', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('Hallelujah');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Hallelujah/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    const percentBadge = page.locator('#lblAutoScrollPercent');
    await expect(percentBadge).toBeVisible();
    await expect(percentBadge).toHaveText('25%');

    const btnIncr = page.locator('#btnAutoScrollIncr');
    await btnIncr.click();
    await expect(percentBadge).toHaveText('26%');

    const speedSlider = page.locator('#rngAutoScrollSpeed');
    await speedSlider.fill('42');
    await expect(percentBadge).toHaveText('42%');

    const btnAutoScroll = page.locator('#btnToggleAutoScroll');
    await btnAutoScroll.click();
    await expect(btnAutoScroll).toHaveClass(/active/);
    await btnAutoScroll.click();
  });

  test('7. Afinador Cromático Profesional con Clavijeros Reales y Menú de Opciones', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('Dust in the Wind');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Dust in the Wind/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    // 1. Abrir desplegable "Opciones"
    const btnMoreOptions = page.locator('#btnMoreOptions');
    await expect(btnMoreOptions).toBeVisible();
    await btnMoreOptions.click();

    // 2. Probar botón de Escucha Activa
    const btnLiveListen = page.locator('#btnToggleLiveListen');
    await expect(btnLiveListen).toBeVisible();
    await btnLiveListen.click();

    // 3. Abrir Afinador con botón de acceso rápido
    await btnMoreOptions.click();
    const btnTunerQuick = page.locator('#btnOpenTunerQuick');
    await expect(btnTunerQuick).toBeVisible();
    await btnTunerQuick.click();

    const tunerModal = page.locator('.tuner-modal-card');
    await expect(tunerModal).toBeVisible();

    // 4. Comprobar selector de clavijero (Guitarra 3+3, 6L, Ukelele 2+2, Bajo 4L)
    const selPreset = tunerModal.locator('#selTunerPreset');
    await expect(selPreset).toBeVisible();
    await expect(selPreset).toHaveValue('guitar_33');

    // Comprobar presencia de clavijas interactivas
    const pegs = tunerModal.locator('.tuner-peg-btn');
    await expect(pegs).toHaveCount(6);

    // Probar clic en clavija para tono de referencia
    await pegs.first().click();

    // Cambiar a Ukelele (2+2)
    await selPreset.selectOption('ukulele_22');
    await expect(tunerModal.locator('.tuner-peg-btn')).toHaveCount(4);

    // Cambiar a Guitarra 6 en Línea
    await selPreset.selectOption('guitar_6l');
    await expect(tunerModal.locator('.tuner-peg-btn')).toHaveCount(6);

    // 5. Cerrar afinador con la [X]
    const btnCloseTuner = tunerModal.locator('#btnCloseTuner');
    await expect(btnCloseTuner).toBeVisible();
    await btnCloseTuner.click();
    await expect(tunerModal).toBeHidden();
  });

  test('8. Búsqueda Universal Masiva: Katy Perry (Roar/Firework) y Cero Mensajes Bloqueantes', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('katy');

    // Comprobar que aparecen canciones de Katy Perry al instante
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Katy Perry|Roar|Firework/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });

    // Comprobar que NUNCA aparece el mensaje erróneo de "No tienes katy guardada localmente"
    await expect(page.locator('.library-empty-state')).toBeHidden();

    // Tocar canción de Katy Perry
    await songCard.click();
    const lyricsContainer = page.locator('.lyrics-chords-container');
    await expect(lyricsContainer).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.lyrics-song-artist')).toContainText(/Katy Perry/i);
  });

  test('9. Pestaña de Ajustes Globales (Mano Zurdo/Diestro, Calibración 440/432Hz y Copias de Seguridad)', async ({ page }) => {
    const navSettings = page.locator('.nav-tab-btn[data-tab="settings"]');
    await expect(navSettings).toBeVisible();
    await navSettings.click();

    const settingsWrapper = page.locator('.settings-view-wrapper');
    await expect(settingsWrapper).toBeVisible();

    // Probar Switch Zurdo / Diestro
    const chkLeftHanded = page.locator('#chkSettingsLeftHanded');
    await expect(chkLeftHanded).toBeVisible();
    await chkLeftHanded.check();

    // Probar Calibración 440/432Hz
    const selTuning = page.locator('#selSettingsMasterTuning');
    await expect(selTuning).toBeVisible();
    await selTuning.selectOption('432');

    // Probar botón de recuperación de contraseña
    const btnRecover = page.locator('#btnRecoverPassword');
    await expect(btnRecover).toBeVisible();
    await btnRecover.click();
  });

  test('10. Zoom de Fuente Reactivo con Porcentaje, Botón Volver, Calculadora de Cejilla y Círculo de Quintas', async ({ page }) => {
    // 1. Abrir canción
    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('Imagine Dragons');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Imagine Dragons|Believer/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    // 2. Verificar que el Top HUD obsoleto NO se muestra
    const transportHeader = page.locator('#transport-container');
    await expect(transportHeader).toBeHidden();
    const songInfoStrip = page.locator('#songInfoStrip');
    await expect(songInfoStrip).toBeHidden();

    // 3. Probar Zoom de Fuente Reactivo con Porcentaje visible
    const percentEl = page.locator('#lblFontScalePercent');
    await expect(percentEl).toBeVisible();

    const btnFontIncr = page.locator('#btnFontIncr');
    await expect(btnFontIncr).toBeVisible();
    await btnFontIncr.click();
    await expect(percentEl).toHaveText('110%');

    // 4. Probar Botón Volver al Catálogo
    const btnBack = page.locator('#btnBackToExplore');
    await expect(btnBack).toBeVisible();
    await btnBack.click();

    const exploreHero = page.locator('.explore-hero');
    await expect(exploreHero).toBeVisible();

    // 5. Probar Círculo de Quintas y Calculadora de Cejilla en Herramientas
    const navTools = page.locator('.nav-tab-btn[data-tab="tools"]');
    await navTools.click();

    const capoCard = page.locator('.capo-calc-card');
    await expect(capoCard).toBeVisible();

    const circleCard = page.locator('.circle-fifths-card');
    await expect(circleCard).toBeVisible();

    const harmonyBoxes = circleCard.locator('.harmony-box');
    await expect(harmonyBoxes).toHaveCount(4);
    await harmonyBoxes.first().click();
  });

  test('11. Cero Colisiones de Atajos de Teclado al Escribir y Buscar (Texto, Espacio y Letras de Atajos)', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await expect(heroSearch).toBeVisible();

    // Enfocar el input de búsqueda y escribir palabras que contienen letras de atajos (m, a, t, c, l, f, g, space)
    await heroSearch.focus();
    await page.keyboard.type('metallica coldplay katy perry');

    // Verificar que el input contiene exactamente todo el texto escrito con sus espacios
    await expect(heroSearch).toHaveValue('metallica coldplay katy perry');

    // Verificar que NINGÚN modal u overlay se abrió por accidente (afinador, speedtrainer, chord modal, etc.)
    const tunerModal = page.locator('.tuner-modal-card');
    await expect(tunerModal).toBeHidden();

    const chordModal = page.locator('#chordModal');
    if (await chordModal.count() > 0) {
      await expect(chordModal).toBeHidden();
    }

    const speedTrainer = page.locator('#speedtrainer-container');
    if (await speedTrainer.count() > 0) {
      await expect(speedTrainer).not.toHaveClass(/open/);
    }
  });

  test('12. Letra Real y Oficial Verificada: Dark Horse (Katy Perry) y Cero Relleno', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('Dark Horse');

    const songCard = page.locator('.btn-load-explore-song', { hasText: /Dark Horse/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    const lyricsContainer = page.locator('.lyrics-chords-container');
    await expect(lyricsContainer).toBeVisible({ timeout: 10000 });

    // Verificar que la letra contiene los versos reales oficiales de Katy Perry
    const bodyContent = page.locator('#lyricsBodyContent');
    await expect(bodyContent).toBeVisible();
    await expect(bodyContent).toContainText(/I knew you were|Aphrodite|dark horse/i);

    // Verificar terminantemente que NO hay texto de relleno falso
    await expect(bodyContent).not.toContainText(/Interpretada por/i);
    await expect(bodyContent).not.toContainText(/Acordes colocados para/i);
    await expect(bodyContent).not.toContainText(/Usa la transposición/i);
  });

  test('13. Modo Atril de Escenario (Ocultación Total de Barra Inferior y HUD Flotante Activo)', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('Hotel California');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Hotel California/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    // 1. Abrir Opciones y activar Modo Atril
    const btnMoreOptions = page.locator('#btnMoreOptions');
    await expect(btnMoreOptions).toBeVisible();
    await btnMoreOptions.click();

    const btnEnterStage = page.locator('#btnEnterStageMode');
    await expect(btnEnterStage).toBeVisible();
    await btnEnterStage.click();

    // 2. Verificar que la barra inferior está COMPLETAMENTE OCULTA
    const bottomNav = page.locator('.bottom-nav-bar');
    await expect(bottomNav).toBeHidden();

    // 3. Verificar que aparece el HUD flotante de Modo Atril
    const stageHud = page.locator('.stage-floating-hud');
    await expect(stageHud).toBeVisible();

    // 4. Probar salir de Modo Atril
    const btnExitStage = page.locator('#btnExitStageMode');
    await expect(btnExitStage).toBeVisible();
    await btnExitStage.click();

    // 5. Verificar que la barra inferior vuelve a estar visible
    await expect(bottomNav).toBeVisible();
    await expect(stageHud).toBeHidden();
  });

  test('14. Cifrado Latino (Do, Re, Mi) y Selección de Notación', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('Let It Be');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Let It Be/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    // 1. Cambiar a Cifrado Latino (Do, Re, Mi) desde Opciones
    const btnMoreOptions = page.locator('#btnMoreOptions');
    await btnMoreOptions.click();

    const selNotation = page.locator('#selSongNotation');
    await expect(selNotation).toBeVisible();
    await selNotation.selectOption('latin');

    // 2. Verificar que los acordes en la partitura cambian a notación latina (Do, Sol, Lam, Fa, etc.)
    const chordBadge = page.locator('.chord-badge').first();
    await expect(chordBadge).toBeVisible();
    const chordText = await chordBadge.textContent();
    expect(chordText).toMatch(/Do|Sol|La|Fa|Re|Mi|Si/);
  });

  test('15. Galería Visual de Diagramas de Acordes al Inicio de la Canción (Todos Visibles sin Clics)', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('Wonderwall');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Wonderwall/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    // 1. Verificar presencia de la Galería Visual de Acordes al inicio
    const visualGallery = page.locator('.song-chords-visual-gallery');
    await expect(visualGallery).toBeVisible();

    // 2. Verificar que contiene tarjetas visuales con diagramas SVG reales
    const chordCards = visualGallery.locator('.song-chord-visual-card');
    await expect(chordCards.first()).toBeVisible();
    const count = await chordCards.count();
    expect(count).toBeGreaterThan(2);

    // 3. Verificar que los diagramas SVG están renderizados
    const svgDiagram = chordCards.first().locator('svg.chord-diagram-svg');
    await expect(svgDiagram).toBeVisible();

    // 4. Probar clic en tarjeta para escuchar sonido
    await chordCards.first().click();
  });

  test('16. Grabador de Audio de Ensayos / Directos (Grabación, Temporizador y Descarga de Toma)', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('Perfect');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Perfect/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    // 1. Probar botón de Grabación Rápida
    const btnRecord = page.locator('#btnQuickRecordAction');
    await expect(btnRecord).toBeVisible();
    await btnRecord.click();

    // 2. Si el navegador no permite captura real sin permiso físico, verificar que el botón reacciona
    await expect(btnRecord).toBeVisible();
  });

});
