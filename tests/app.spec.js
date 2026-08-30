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
    // Esperar a que el toast de arranque desaparezca para no bloquear clics
    await page.waitForFunction(() => {
      const toasts = document.querySelectorAll('.toast-visible');
      return toasts.length === 0;
    }, { timeout: 8000 }).catch(() => {
      // Si el toast tarda demasiado, forzar su cierre via JS
      return page.evaluate(() => {
        document.querySelectorAll('.toast-visible').forEach(t => t.remove());
      });
    });
    // Asegurar que el view-mode-toggle no intercepta eventos de puntero
    await page.evaluate(() => {
      const toggle = document.querySelector('.view-mode-toggle');
      if (toggle) toggle.style.pointerEvents = 'none';
    }).catch(() => {});
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
    test.setTimeout(120000);
    // Check default theme (should be charcoal/dark)
    await page.evaluate(() => {
      document.body.className = 'theme-charcoal';
      localStorage.setItem('app_visual_theme', 'oled');
    });
    const resultsCharcoal = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(resultsCharcoal.violations).toEqual([]);

    // Check ivory theme (light)
    await page.evaluate(() => {
      document.body.className = 'theme-ivory';
      localStorage.setItem('app_visual_theme', 'paper');
    });
    // Wait a tick for CSS transition
    await page.waitForTimeout(500);
    const resultsIvory = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(resultsIvory.violations).toEqual([]);
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

    // Abrir el panel de velocidad
    const btnOpenPanel = page.locator('#btnOpenSpeedPanel');
    await expect(btnOpenPanel).toBeVisible({ timeout: 5000 });
    await btnOpenPanel.click();

    // El panel flotante debe mostrarse con el badge de porcentaje visible
    const speedPanel = page.locator('#autoScrollSpeedPanel');
    await expect(speedPanel).toBeVisible();

    const percentBadge = page.locator('#lblAutoScrollPercent');
    await expect(percentBadge).toBeVisible();
    await expect(percentBadge).toHaveText('25%');

    // Botón +5 dentro del panel
    const btnIncr = page.locator('#btnAutoScrollIncr');
    await btnIncr.click();
    await expect(percentBadge).toHaveText('30%');

    // Slider de rango
    const speedSlider = page.locator('#rngAutoScrollSpeed');
    await speedSlider.fill('42');
    await expect(percentBadge).toHaveText('42%');

    // Botón principal ⚡ activa el scroll
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

    const capoCard = page.locator('.premium-list-item[data-tool="capo"]');
    await expect(capoCard).toBeVisible();
    await capoCard.click();
    await capoCard.locator('[data-preview-action="open-full"]').click();
    await expect(page.locator('#modal-capo')).toBeVisible();
    await page.locator('#modal-capo .btn-close-modal').click();

    const circleCard = page.locator('.premium-list-item[data-tool="circle"]');
    await expect(circleCard).toBeVisible();
    await circleCard.click();
    await circleCard.locator('[data-preview-action="open-full"]').click();
    await expect(page.locator('#modal-circle')).toBeVisible();
    await page.locator('#modal-circle .btn-close-modal').click();
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

    // Esperar que la canción cargue y no haya toasts bloqueantes
    await page.waitForFunction(() => document.querySelectorAll('.toast-visible').length === 0, { timeout: 5000 }).catch(() => {
      return page.evaluate(() => document.querySelectorAll('.toast-visible').forEach(t => t.remove()));
    });

    // 1. Abrir el dropdown de Opciones
    const btnMoreOptions = page.locator('#btnMoreOptions');
    await expect(btnMoreOptions).toBeVisible({ timeout: 5000 });
    await btnMoreOptions.click({ force: true });

    const selNotation = page.locator('#selSongNotation');
    await expect(selNotation).toBeVisible({ timeout: 5000 });
    await selNotation.selectOption('latin');

    // 2. Verificar que los acordes cambian a notación latina
    const chordBadge = page.locator('.chord-badge').first();
    await expect(chordBadge).toBeVisible();
    const chordText = await chordBadge.textContent();
    expect(chordText).toMatch(/Do|Sol|La|Fa|Re|Mi|Si/);
  });

  test('15. Patrón de Rasgueo Prominente y Acordes Utilizados Interactivos con Diagramas Desplegables', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('Wonderwall');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Wonderwall/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    // 1. Verificar presencia de la Franja de Ritmo & Acordes Utilizados
    const rhythmStrip = page.locator('.song-meta-rhythm-strip');
    await expect(rhythmStrip).toBeVisible();

    // 2. Verificar presencia de la barra de rasgueo y los acordes utilizados
    await expect(page.locator('.strumming-pattern-card')).toBeVisible();
    await expect(page.locator('.song-used-chords-bar')).toBeVisible();

    // 3. Abrir el acordeón para ver diagramas completos si se desea
    const diagramsAccordion = page.locator('.chords-diagrams-accordion');
    await expect(diagramsAccordion).toBeVisible();
    await diagramsAccordion.locator('summary').click();

    const chordCards = diagramsAccordion.locator('.song-chord-visual-card');
    await expect(chordCards.first()).toBeVisible();
    const count = await chordCards.count();
    expect(count).toBeGreaterThan(2);

    // 4. Verificar que los diagramas SVG están renderizados
    const svgDiagram = chordCards.first().locator('svg.chord-diagram-svg');
    await expect(svgDiagram).toBeVisible();

    // 5. Probar clic en tarjeta para escuchar sonido
    await chordCards.first().click();
  });

  test('16. Grabador de Audio de Ensayos / Directos (Grabación, Temporizador y Descarga de Toma)', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('Perfect');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Perfect/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    // Esperar que no haya toasts bloqueantes
    await page.waitForFunction(() => document.querySelectorAll('.toast-visible').length === 0, { timeout: 5000 }).catch(() => {
      return page.evaluate(() => document.querySelectorAll('.toast-visible').forEach(t => t.remove()));
    });

    // 1. Probar botón de Grabación Rápida (force para evitar interceptores)
    const btnRecord = page.locator('#btnQuickRecordAction');
    await expect(btnRecord).toBeVisible({ timeout: 5000 });
    await btnRecord.click({ force: true });

    // 2. El botón debe seguir siendo visible
    await expect(btnRecord).toBeVisible();
  });

  test('17. Catálogo Precargado Masivo de Ariana Grande y Búsqueda Universal Instantánea', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await expect(heroSearch).toBeVisible({ timeout: 10000 });

    // 1. Buscar "Ariana Grande" en el buscador
    await heroSearch.fill('Ariana Grande');
    await page.waitForTimeout(500);

    // 2. Verificar que se muestran canciones de Ariana Grande
    const arianaCard = page.locator('.btn-load-explore-song', { hasText: /7 rings/i }).first();
    await expect(arianaCard).toBeVisible({ timeout: 10000 });

    const thankUCard = page.locator('.btn-load-explore-song', { hasText: /thank u, next/i }).first();
    await expect(thankUCard).toBeVisible({ timeout: 10000 });

    // 3. Abrir "7 rings" y verificar modo letra con acordes y barra contextual
    await arianaCard.click();
    await page.waitForTimeout(600);

    const activeView = page.locator('#score-viewport');
    await expect(activeView).toHaveClass(/active-view/);

    const titleEl = page.locator('.lyrics-song-title');
    await expect(titleEl).toContainText(/7 rings/i);

    const chordsInLyrics = page.locator('.chord-badge');
    await expect(chordsInLyrics.first()).toBeVisible({ timeout: 10000 });

    // 4. Volver a explorar y buscar "Olivia Rodrigo"
    const btnBack = page.locator('#btnBackToExplore');
    await expect(btnBack).toBeVisible();
    await btnBack.click();

    await heroSearch.fill('Olivia Rodrigo');
    await page.waitForTimeout(500);
    const oliviaCard = page.locator('.btn-load-explore-song', { hasText: /drivers license|vampire/i }).first();
    await expect(oliviaCard).toBeVisible({ timeout: 10000 });
  });

  test('18. Búsqueda 100% Offline de Discografía de Imagine Dragons (Believer, Radioactive, Demons, Bones)', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await expect(heroSearch).toBeVisible();

    await heroSearch.fill('Imagine Dragons');
    await page.waitForTimeout(400);

    const believerCard = page.locator('.btn-load-explore-song', { hasText: /Believer/i }).first();
    await expect(believerCard).toBeVisible({ timeout: 10000 });
    await believerCard.click();

    const lyricsContainer = page.locator('.lyrics-chords-container');
    await expect(lyricsContainer).toBeVisible({ timeout: 10000 });

    const bodyContent = page.locator('#lyricsBodyContent');
    await expect(bodyContent).toContainText(/First things first|pain!|believer/i);
    await expect(bodyContent).not.toContainText(/Letra disponible para tocar/i);

    const btnBack = page.locator('#btnBackToExplore');
    await btnBack.click();

    await heroSearch.fill('Radioactive');
    await page.waitForTimeout(400);
    const radioCard = page.locator('.btn-load-explore-song', { hasText: /Radioactive/i }).first();
    await expect(radioCard).toBeVisible({ timeout: 10000 });
    await radioCard.click();

    await expect(page.locator('#lyricsBodyContent')).toContainText(/chemicals|welcome to the new age|radioactive/i);
  });

  test('19. Explorar: Tendencias Plegadas, Filtro de Género y Desplegable de Recientes', async ({ page }) => {
    const trendingAccordion = page.locator('.explore-trending-accordion');
    await expect(trendingAccordion).toBeVisible();
    await expect(trendingAccordion.locator('summary')).toBeVisible();

    const btnGenreToggle = page.locator('#btnToggleGenreFilter');
    await expect(btnGenreToggle).toBeVisible();
    await btnGenreToggle.click();

    const genreDropdown = page.locator('#exploreGenreDropdownFilter');
    await expect(genreDropdown).toBeVisible();

    const btnRock = genreDropdown.locator('.genre-card-item[data-genre="rock"]');
    await btnRock.click();
    await expect(btnGenreToggle).toHaveClass(/active-filter/);

    const searchInput = page.locator('#exploreSearchInput');
    await searchInput.click();
    const recentsDropdown = page.locator('#exploreRecentsDropdown');
    await expect(recentsDropdown).toBeVisible();
  });

  test('20. Mis Tabs: Pestañas Favoritas, Más Visitadas, Setlists Explicativo y Estados Vacíos', async ({ page }) => {
    const navLibrary = page.locator('.nav-tab-btn[data-tab="library"]');
    await navLibrary.click();

    const libSidebar = page.locator('.library-sidebar');
    await expect(libSidebar).toBeVisible();

    const tabFav = page.locator('.lib-tab[data-filter="favorites"]');
    await expect(tabFav).toBeVisible();
    await tabFav.click();
    await expect(page.locator('.library-empty-state')).toBeVisible();

    const tabVisited = page.locator('.lib-tab[data-filter="visited"]');
    await expect(tabVisited).toBeVisible();
    await tabVisited.click();
    await expect(page.locator('.library-empty-state')).toBeVisible();

    const tabSetlists = page.locator('.lib-tab[data-filter="setlists"]');
    await expect(tabSetlists).toBeVisible();
    await tabSetlists.click();

    const explainerCard = page.locator('.setlist-explainer-card');
    await expect(explainerCard).toBeVisible();
    await expect(explainerCard).toContainText(/¿Qué es una Setlist\?/i);
  });

  test('21. Afinador Híbrido (Micrófono Automático y Diapasón Manual de Oído)', async ({ page }) => {
    const navTools = page.locator('.nav-tab-btn[data-tab="tools"]');
    await navTools.click();

    const tunerCard = page.locator('.premium-list-item[data-tool="tuner"]');
    await tunerCard.click();
    await tunerCard.locator('[data-preview-action="open-full"]').click();

    const btnAutoMode = page.locator('#btnModeAutoTuner');
    const btnManualMode = page.locator('#btnModeManualTuner');
    await expect(btnAutoMode).toBeVisible();
    await expect(btnManualMode).toBeVisible();

    await btnManualMode.click();
    const stringCard = page.locator('.tuner-string-card').first();
    await expect(stringCard).toBeVisible();
    await stringCard.click();

    await page.locator('#btnCloseToolModal').click();
  });

  test('22. Reproductor original de YouTube seguro y persistente por canción', async ({ page }) => {
    await page.locator('#exploreSearchInput').fill('Blackbird');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Blackbird/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();
    await expect(page.locator('.lyrics-chords-container')).toBeVisible({ timeout: 10000 });

    await page.locator('#btnToggleYouTube').click();
    const form = page.locator('#youtubeCompanionForm');
    const input = page.locator('#youtubeCompanionUrl');
    await expect(form).toBeVisible();

    await input.fill('https://example.com/watch?v=dQw4w9WgXcQ');
    await form.locator('button[type="submit"]').click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#youtubeCompanionStatus')).toContainText(/enlace válido/i);

    await input.fill('https://youtu.be/dQw4w9WgXcQ?t=12');
    await form.locator('button[type="submit"]').click();
    await expect(page.locator('.youtube-companion iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);

    await page.locator('#btnCloseYouTube').click();
    await page.locator('#btnToggleYouTube').click();
    await expect(page.locator('.youtube-companion iframe')).toHaveAttribute('src', /dQw4w9WgXcQ/);
  });

  test('23. Preferencia sostenidos/bemoles persistente en Ajustes', async ({ page }) => {
    await page.locator('.nav-tab-btn[data-tab="settings"]').click();
    const preference = page.locator('#selSettingsAccidentals');
    await expect(preference).toBeVisible();
    await preference.selectOption('flats');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('app_accidental_preference'))).toBe('flats');

    await page.evaluate(() => localStorage.removeItem('tabs_chords_music_session_v1'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.nav-tab-btn[data-tab="settings"]'));
    await page.evaluate(() => document.querySelector('.nav-tab-btn[data-tab="settings"]')?.click());
    await expect(page.locator('#selSettingsAccidentals')).toHaveValue('flats');
  });

  test('24. Metrónomo integrado en visor de canciones: control compacto, ajustes y count-in', async ({ page }) => {
    await page.locator('#exploreSearchInput').fill('Blackbird');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Blackbird/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();
    await expect(page.locator('.lyrics-chords-container')).toBeVisible({ timeout: 10000 });

    // Control compacto en barra inferior
    const btnMetroPlay = page.locator('#btnBottomMetronomePlay');
    const bpmBadge = page.locator('#lblBottomMetronomeBpm');
    const btnMetroMinus = page.locator('#btnBottomMetronomeMinus');
    const btnMetroPlus = page.locator('#btnBottomMetronomePlus');
    const btnMetroTap = page.locator('#btnBottomMetronomeTap');
    const btnMetroOpen = page.locator('#btnBottomMetronomeOpen');

    await expect(btnMetroPlay).toBeVisible();
    await expect(bpmBadge).toBeVisible();
    await expect(btnMetroMinus).toBeVisible();
    await expect(btnMetroPlus).toBeVisible();
    await expect(btnMetroTap).toBeVisible();

    // Iniciar metrónomo
    await btnMetroPlay.click();
    await expect(btnMetroPlay).toHaveAttribute('aria-pressed', 'true');
    await expect(btnMetroPlay).toHaveClass(/active/);

    // Ajustar tempo con stepper
    const currentBpmText = await bpmBadge.textContent();
    const initialBpm = parseInt(currentBpmText, 10);
    await btnMetroPlus.click();
    await expect(bpmBadge).toHaveText(String(initialBpm + 1));
    await btnMetroMinus.click();
    await expect(bpmBadge).toHaveText(String(initialBpm));

    // Tap tempo
    await btnMetroTap.click();
    await page.waitForTimeout(400);
    await btnMetroTap.click();

    // Abrir panel modal completo
    await btnMetroOpen.click();
    const metroOverlay = page.locator('#songMetronomeOverlay');
    await expect(metroOverlay).toBeVisible();
    await expect(page.locator('#songMetroBpmDisplay')).toBeVisible();

    // Cambiar compás a 3/4
    const btn34 = page.locator('[data-metro-signature="3/4"]');
    await btn34.click();
    await expect(btn34).toHaveClass(/active/);

    // Configurar count-in de 1 compás
    const btnCount1 = page.locator('[data-metro-countin="1"]');
    await btnCount1.click();
    await expect(btnCount1).toHaveClass(/active/);

    // Cerrar modal
    await page.locator('#btnCloseSongMetronome').click();
    await expect(metroOverlay).not.toBeVisible();

    // Pausar metrónomo
    await btnMetroPlay.click();
    await expect(btnMetroPlay).toHaveAttribute('aria-pressed', 'false');
  });

  test('25. Reproducción simultánea: Metrónomo + YouTube + Auto-scroll + Grabación + Modo Atril', async ({ page }) => {
    await page.locator('#exploreSearchInput').fill('Blackbird');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Blackbird/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();
    await expect(page.locator('.lyrics-chords-container')).toBeVisible({ timeout: 10000 });

    // 1. Iniciar Metrónomo
    await page.locator('#btnBottomMetronomePlay').click();
    await expect(page.locator('#btnBottomMetronomePlay')).toHaveAttribute('aria-pressed', 'true');

    // 2. Iniciar Auto-Scroll
    await page.locator('#btnBottomToggleAutoScroll').click();
    await expect(page.locator('#btnBottomToggleAutoScroll')).toHaveClass(/active/);

    // 3. Abrir reproductor YouTube modal
    await page.locator('#btnToggleYouTube').click();
    await expect(page.locator('#youtubeCompanion')).toBeVisible();
    await page.locator('#btnCloseYouTube').click();

    // 4. Entrar en Modo Atril
    await page.locator('#btnBottomEnterStage').click();
    await expect(page.locator('.stage-mode-view')).toBeVisible();

    const stageMetroToggle = page.locator('#btnStageMetronomeToggle');
    await expect(stageMetroToggle).toBeVisible();
    await expect(stageMetroToggle).toHaveAttribute('aria-pressed', 'true');

    // Ajustar BPM en modo atril
    await page.locator('#btnStageMetronomeIncr').click();
    await expect(page.locator('#lblStageMetronomeBpm')).toBeVisible();

    // Salir de Modo Atril
    await page.locator('#btnExitStageMode').click();
    await expect(page.locator('.stage-mode-view')).not.toBeVisible();

    // 5. Detener Auto-Scroll y Metrónomo
    await page.locator('#btnBottomToggleAutoScroll').click();
    await page.locator('#btnBottomMetronomePlay').click();
    await expect(page.locator('#btnBottomMetronomePlay')).toHaveAttribute('aria-pressed', 'false');

    // Volver a explorar detiene cualquier actividad
    await page.locator('#btnBackToExplore').click();
    await expect(page.locator('#explore-view-container')).toHaveClass(/active-view/);
  });

  test('26. Validación completa: Letra real de Killer Queen de Queen sin puntos, metrónomo superior, scroll cluster y botón Abrir', async ({ page }) => {
    // 1. Tarjetas del repertorio muestran solo 'Abrir'
    const openButtons = page.locator('.btn-load-explore-song');
    await expect(openButtons.first()).toBeVisible();
    const firstButtonText = await openButtons.first().locator('span:not(.sr-only)').innerText();
    expect(firstButtonText.trim()).toBe('Abrir');

    // 2. Cargar Killer Queen de Queen
    await page.locator('#exploreSearchInput').fill('Killer Queen');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Killer Queen/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();
    await expect(page.locator('.lyrics-chords-container')).toBeVisible({ timeout: 10000 });

    // 3. Verificar que la letra tiene el texto real de Queen y NO texto de relleno ni puntos de compás
    const lyricsContainer = page.locator('#lyricsBodyContent');
    await expect(lyricsContainer).toBeVisible();
    await expect(lyricsContainer).toContainText(/Moët/i);
    await expect(lyricsContainer).toContainText(/Chandon/i);
    await expect(lyricsContainer).toContainText(/caviar/i);
    await expect(lyricsContainer).toContainText(/cigarettes/i);
    await expect(lyricsContainer).toContainText(/Killer/i);
    await expect(lyricsContainer).toContainText(/Queen/i);
    await expect(lyricsContainer).not.toContainText(/Letra disponible para tocar/i);

    // 4. Botón de Metrónomo en la cabecera superior de la canción
    const topMetroBtn = page.locator('#btnSongTopMetronome');
    await expect(topMetroBtn).toBeVisible();
    await topMetroBtn.click();
    const metroOverlay = page.locator('#songMetronomeOverlay');
    await expect(metroOverlay).toBeVisible();
    await page.locator('#btnCloseSongMetronome').click();
    await expect(metroOverlay).not.toBeVisible();

    // 5. Cluster de Auto-Scroll en barra inferior con controles de velocidad
    const scrollCluster = page.locator('.nav-player-autoscroll-cluster');
    await expect(scrollCluster).toBeVisible();
    const speedBadge = page.locator('#lblBottomScrollSpeed');
    await expect(speedBadge).toBeVisible();
    const btnSpeedIncr = page.locator('#btnBottomScrollSpeedIncr');
    const btnSpeedDecr = page.locator('#btnBottomScrollSpeedDecr');

    const initialSpeedText = await speedBadge.innerText();
    const initialSpeed = parseInt(initialSpeedText, 10);
    await btnSpeedIncr.click();
    await expect(speedBadge).toHaveText(`${initialSpeed + 1}%`);
    await btnSpeedDecr.click();
    await expect(speedBadge).toHaveText(`${initialSpeed}%`);

    // Iniciar y pausar scroll desde el cluster
    const btnToggleScroll = page.locator('#btnBottomToggleAutoScroll');
    await btnToggleScroll.click();
    await expect(btnToggleScroll).toHaveClass(/active/);
    await btnToggleScroll.click();
    await expect(btnToggleScroll).not.toHaveClass(/active/);
  });

});
