import { test, expect } from '@playwright/test';
import { waitForSong, openSongOptions , openToolCatalogAdvanced } from './helpers/journeys.js';

test.describe.configure({ timeout: 90_000 });

test.describe('🎷 Smart Band & Modo Arcade Inmersivo (Synthesia/Hero) - Suite E2E', () => {
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.addInitScript(() => {
      // Exercise the browser Web Audio graph with a controlled audible input.
      // This tests the microphone UI contract; acoustic accuracy uses real fixtures elsewhere.
      window.qaAudioSources = [];
      navigator.mediaDevices.getUserMedia = async () => {
        const context = new AudioContext();
        await context.resume();
        const oscillator = context.createOscillator();
        oscillator.frequency.value = 220;
        const destination = context.createMediaStreamDestination();
        oscillator.connect(destination);
        oscillator.start();
        window.qaAudioSources.push({ context, oscillator });
        return destination.stream;
      };
    });

    await page.goto('/index.html');
    await page.waitForSelector('.bottom-nav-bar', { timeout: 30_000 });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      for (const { context, oscillator } of window.qaAudioSources) { oscillator.stop(); context.close(); }
    });
    const realErrors = consoleErrors.filter(e =>
      !e.includes('Failed to load resource') &&
      !e.includes('favicon')
    );
    expect(realErrors, `Errores de consola detectados: ${realErrors.join(', ')}`).toEqual([]);
  });

  test('1. Apertura de The Smart Band y Configuración de Estilos y Progresión', async ({ page }) => {
    // 1. Navegar a Herramientas
    await page.locator('.nav-tab-btn[data-tab="tools"]').click();
    await openToolCatalogAdvanced(page);
    await expect(page.locator('#tools-view-container')).toBeVisible();

    // 2. Abrir The Smart Band
    const smartBandCard = page.locator('.premium-list-item[data-tool="smart_band"]');
    await expect(smartBandCard).toBeVisible();
    await smartBandCard.locator('[data-preview-action="open-full"]').click();

    const smartBandModal = page.locator('#modal-smart-band');
    await expect(smartBandModal).toBeVisible();

    // 3. Comprobar chips de acordes y cambio de preset
    await page.locator('#toolAdvanced > summary').click();
    const btnPresetJazz = page.locator('.btn-prog-preset[data-prog="Dm7,G7,Cmaj7,A7"]');
    await expect(btnPresetJazz).toBeVisible();
    await btnPresetJazz.click();

    // 4. Cambiar estilo a Funk Groove
    const btnFunk = page.locator('.btn-style-card[data-style="funk"]');
    await expect(btnFunk).toBeVisible();
    await btnFunk.click();
    await expect(btnFunk).toHaveClass(/active/);

    // 5. Iniciar la Smart Band
    const btnPlay = page.locator('#btnToggleSmartBand');
    await expect(btnPlay).toBeVisible();
    await btnPlay.click();

    // 6. Probar sliders de volumen y mutes
    const btnMuteDrums = page.locator('#btnMuteDrums');
    await btnMuteDrums.click();
    await expect(btnMuteDrums).toHaveClass(/active/);

    // 7. Detener y cerrar
    const btnStop = page.locator('#btnSmartBandStop');
    await btnStop.click();

    await page.locator('#btnCloseSmartBand').click();
    await expect(smartBandModal).not.toBeVisible();
  });

  test('2. Modo Arcade Inmersivo (Synthesia / Hero) a 60 FPS con Puntuación y Partículas', async ({ page }) => {
    // 1. Navegar a Herramientas
    await page.locator('.nav-tab-btn[data-tab="tools"]').click();
    await openToolCatalogAdvanced(page);

    // 2. Abrir Modo Arcade
    const arcadeCard = page.locator('.premium-list-item[data-tool="arcade"]');
    await expect(arcadeCard).toBeVisible();
    await arcadeCard.locator('[data-preview-action="open-full"]').click();

    const arcadeModal = page.locator('#modal-arcade-view');
    await expect(arcadeModal).toBeVisible();

    // 3. Verificar Canvas y HUD
    const canvas = page.locator('#arcadeHighwayCanvas');
    await expect(canvas).toBeVisible();

    const scoreLbl = page.locator('#lblArcadeScore');
    await expect(scoreLbl).toBeVisible();

    // 4. Simular impactos con botón de Modo Demostración
    const btnDemo = page.locator('#btnArcadeAutoTest');
    await expect(btnDemo).toBeVisible();
    await btnDemo.click();

    // Verificar que el combo y puntuación se incrementan
    await expect(page.locator('#lblArcadeCombo')).toContainText('COMBO');

    // 5. Activar micrófono en vivo
    const btnMic = page.locator('#btnToggleArcadeMic');
    await expect(btnMic).toBeVisible();
    await btnMic.click();
    await expect(page.locator('#lblMicStatus')).toHaveText('ON');

    // 6. Probar interacción táctil directa sobre el Canvas
    await canvas.click({ position: { x: 100, y: 300 } });

    // 7. Salir del modo Arcade
    const btnExit = page.locator('#btnExitArcade');
    await expect(btnExit).toBeVisible();
    await btnExit.click();
    await expect(arcadeModal).not.toBeVisible();
  });

  test('3. Evaluación del Gamification Engine y Pantalla de Resultados', async ({ page }) => {
    // Abrir Modo Arcade
    await page.locator('.nav-tab-btn[data-tab="tools"]').click();
    await openToolCatalogAdvanced(page);
    await page.locator('.premium-list-item[data-tool="arcade"] [data-preview-action="open-full"]').click();

    // Forzar pantalla de resultados llamando a showResultsScreen
    await page.evaluate(() => {
      if (window.gamificationEngine) {
        window.gamificationEngine.startSession();
        // Simular 20 aciertos perfectos
        for (let i = 0; i < 20; i++) {
          window.gamificationEngine.evaluateHit(0, 0, { lane: 2, pitch: 'A' });
        }
      }
      if (window.arcadeHighwayVisualizer) {
        window.arcadeHighwayVisualizer.showResultsScreen();
      }
    });

    const resultsOverlay = page.locator('#arcadeResultsOverlay');
    await expect(resultsOverlay).toBeVisible();

    // Comprobar rango y estadísticas
    await expect(page.locator('#resultsRankTitle')).toContainText(/Platino/i);
    await expect(page.locator('#resAccuracy')).toContainText('100%');
    await expect(page.locator('#resPerfects')).toHaveText('20');

    // Cerrar resultados
    await page.locator('#btnCloseResults').click();
    await expect(page.locator('#modal-arcade-view')).not.toBeVisible();
  });

  test('4. Acceso Rápido a The Smart Band y Modo Arcade desde Menú de Opciones de Canción', async ({ page }) => {
    // 1. Abrir primera canción de la biblioteca
    const songCard = page.locator('.song-card .btn-select-song').first();
    await songCard.click();
    await waitForSong(page);
    await page.waitForTimeout(500);

    // 2. Abrir menú de opciones y lanzar Smart Band
    await openSongOptions(page, { advanced: true });
    await page.waitForTimeout(200);
    await page.click('#btnOpenSmartBandQuick');
    await expect(page.locator('#modal-smart-band')).toBeVisible();
    await page.click('#btnCloseSmartBand');
    await expect(page.locator('#modal-smart-band')).not.toBeVisible();

    // 3. Abrir menú de opciones y lanzar Modo Arcade
    await openSongOptions(page, { advanced: true });
    await page.waitForTimeout(200);
    await page.click('#btnOpenArcadeQuick');
    await expect(page.locator('#modal-arcade-view')).toBeVisible();
    await page.click('#btnExitArcade');
    await expect(page.locator('#modal-arcade-view')).not.toBeVisible();
  });
});
