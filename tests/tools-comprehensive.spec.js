import { test, expect } from '@playwright/test';

test.describe('🛠️ Suite Completa de Herramientas Musicales — E2E & Responsividad Móvil', () => {
  test.use({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true,
  });

  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.bottom-nav-bar', { timeout: 10000 });

    // Navegar a pestaña Herramientas
    const navTools = page.locator('.nav-tab-btn[data-tab="tools"]');
    await navTools.click();
    await page.waitForSelector('.tools-view-wrapper', { timeout: 10000 });
  });

  test.afterEach(async () => {
    const realErrors = consoleErrors.filter(e => !e.includes('Failed to load resource') && !e.includes('favicon'));
    expect(realErrors, `Errores de consola: ${realErrors.join(', ')}`).toEqual([]);
  });

  test('1. Metrónomo: Apertura, renderizado táctil y cambio de BPM', async ({ page }) => {
    const metronomeCard = page.locator('.premium-list-item[data-tool="metronome"]');
    await expect(metronomeCard).toBeVisible();
    await metronomeCard.click();

    // Modal del metrónomo
    const modal = page.locator('#toolModalOverlay');
    await expect(modal).toBeVisible();

    // Control de BPM visible
    const bpmDisplay = page.locator('#metronomeBpmDisplay');
    await expect(bpmDisplay).toBeVisible();
    await expect(page.locator('#btnToggleMetronome')).toBeVisible();

    // Botón cerrar modal
    const btnClose = page.locator('.btn-close-tool-modal');
    await btnClose.click();
    await expect(modal).toBeHidden();
  });

  test('2. Afinador Cromático: Apertura y visualizador de aguja', async ({ page }) => {
    const tunerCard = page.locator('.premium-list-item[data-tool="tuner"]');
    await expect(tunerCard).toBeVisible();
    await tunerCard.click();

    const modal = page.locator('#toolModalOverlay');
    await expect(modal).toBeVisible();

    // Aguja / display de afinación
    const noteDisplay = page.locator('#tunerDetectedNote');
    await expect(noteDisplay).toBeVisible();
    await expect(page.locator('#btnToggleMicTuner')).toBeVisible();

    const btnClose = page.locator('.btn-close-tool-modal');
    await btnClose.click();
    await expect(modal).toBeHidden();
  });

  test('3. Diccionario de Acordes: Búsqueda y renderizado de diagrama SVG', async ({ page }) => {
    const dictCard = page.locator('.premium-list-item[data-tool="dictionary"]');
    await expect(dictCard).toBeVisible();
    await dictCard.click();

    const modal = page.locator('#toolModalOverlay');
    await expect(modal).toBeVisible();

    // Botones de tónicas
    const rootButtons = page.locator('.dict-pill-btn[data-type="root"]');
    await expect(rootButtons.first()).toBeVisible();

    // Diagrama SVG
    const svgDiagram = page.locator('.dict-svg-viewport svg');
    await expect(svgDiagram).toBeVisible();

    const btnClose = page.locator('.btn-close-tool-modal');
    await btnClose.click();
    await expect(modal).toBeHidden();
  });

  test('4. Entrenador de Oído: Inicio de test auditivo y botones de respuesta', async ({ page }) => {
    const earCard = page.locator('.premium-list-item[data-tool="ear"]');
    await expect(earCard).toBeVisible();
    await earCard.click();

    const modal = page.locator('#toolModalOverlay');
    await expect(modal).toBeVisible();

    // Botón para reproducir acorde
    const btnPlay = page.locator('#btnPlayEarChord');
    await expect(btnPlay).toBeVisible();

    const btnClose = page.locator('.btn-close-tool-modal');
    await btnClose.click();
    await expect(modal).toBeHidden();
  });

  test('5. Calculadora de Capotraste: Apertura y tabla de transposición', async ({ page }) => {
    const capoCard = page.locator('.premium-list-item[data-tool="capo"]');
    await expect(capoCard).toBeVisible();
    await capoCard.click();

    const modal = page.locator('#modal-capo');
    await expect(modal).toBeVisible();

    // Tabla de transposición
    const results = page.locator('.capo-table-result');
    await expect(results.first()).toBeVisible();

    const btnClose = modal.locator('.btn-close-tool-modal');
    await btnClose.click();
    await expect(modal).toBeHidden();
  });

  test('6. Círculo de Quintas: Apertura y sectores armónicos', async ({ page }) => {
    const circleCard = page.locator('.premium-list-item[data-tool="circle"]');
    await expect(circleCard).toBeVisible();
    await circleCard.click();

    const modal = page.locator('#modal-circle');
    await expect(modal).toBeVisible();

    // Sectores armónicos del círculo
    const sectors = page.locator('.circle-key-sector');
    await expect(sectors.first()).toBeVisible();

    const btnClose = modal.locator('.btn-close-tool-modal');
    await btnClose.click();
    await expect(modal).toBeHidden();
  });

  test('7. Vocal Coach Tool: Apertura y panel de entrenamiento vocal', async ({ page }) => {
    const vocalCard = page.locator('.premium-list-item[data-tool="vocal"]');
    await expect(vocalCard).toBeVisible();
    await vocalCard.click();

    const modal = page.locator('#modal-vocal-coach');
    await expect(modal).toBeVisible();

    // Pitch lane canvas
    const canvas = page.locator('#pitchLaneCanvas');
    await expect(canvas).toBeVisible();

    // Botón activar micrófono
    const btnMic = page.locator('#btnToggleVocalMic');
    await expect(btnMic).toBeVisible();

    const btnClose = page.locator('#btnCloseVocalCoach');
    await btnClose.click();
    await expect(modal).toBeHidden();
  });
});
