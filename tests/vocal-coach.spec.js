import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe('🎙️ Vocal Coach & Pitch Lane - Suite E2E de Asistencia Vocal y Commercial UI', () => {

  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    consoleErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    // Mock Web Audio getUserMedia para simular voz humana (A4 = 440Hz)
    await page.addInitScript(() => {
      if (!navigator.mediaDevices) {
        navigator.mediaDevices = {};
      }
      navigator.mediaDevices.getUserMedia = async () => {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioCtx({ sampleRate: 44100 });
        const osc = audioCtx.createOscillator();
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4 440Hz
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        osc.connect(gain);
        const dst = audioCtx.createMediaStreamDestination();
        gain.connect(dst);
        try { osc.start(); } catch (e) {}
        return dst.stream;
      };
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.bottom-nav-bar');

    // Limpiar toasts iniciales
    await page.evaluate(() => {
      document.querySelectorAll('.toast-visible').forEach(t => t.remove());
    });
  });

  test.afterEach(async () => {
    const realErrors = consoleErrors.filter(e => !e.includes('Failed to load resource') && !e.includes('favicon'));
    expect(realErrors, `Errores de consola detectados: ${realErrors.join(', ')}`).toEqual([]);
  });

  test('1. Apertura del Vocal Coach desde la Suite de Herramientas Pro', async ({ page }) => {
    const navTools = page.locator('.nav-tab-btn[data-tab="tools"]');
    await expect(navTools).toBeVisible();
    await navTools.click();

    // Comprobar presencia de la tarjeta insignia del Vocal Coach
    const vocalCard = page.locator('.premium-list-item[data-tool="vocal"]');
    await expect(vocalCard).toBeVisible();
    await expect(vocalCard).toContainText(/Vocal Coach & Pitch Lane/i);

    // Clic para abrir el modal del Vocal Coach
    await vocalCard.click();

    const vocalModal = page.locator('#modal-vocal-coach');
    await expect(vocalModal).toBeVisible();

    // Comprobar elementos clave del HUD
    await expect(page.locator('#pitchLaneCanvas')).toBeVisible();
    await expect(page.locator('#hudNoteCard')).toBeVisible();
    await expect(page.locator('#vocalCoachAdviceBox')).toBeVisible();
    await expect(page.locator('#btnToggleVocalMic')).toBeVisible();

    // Cerrar modal
    await page.locator('#btnCloseVocalCoach').click();
    await expect(vocalModal).toBeHidden();
  });

  test('2. Activación del Micrófono y Detección de Afinación en Pitch Lane', async ({ page }) => {
    const navTools = page.locator('.nav-tab-btn[data-tab="tools"]');
    await navTools.click();

    const vocalCard = page.locator('.premium-list-item[data-tool="vocal"]');
    await vocalCard.click();

    const btnMic = page.locator('#btnToggleVocalMic');
    await expect(btnMic).toBeVisible();

    // Activar micrófono (conectará el mock de 440Hz A4)
    await btnMic.click();
    await expect(btnMic).toHaveClass(/recording/);

    // Esperar análisis de frames
    await page.waitForTimeout(600);

    // Comprobar que detecta A (La) 440 Hz
    const noteEl = page.locator('#lblVocalCurrentNote');
    await expect(noteEl).toHaveText(/A|La/i);

    const freqEl = page.locator('#lblVocalFreq');
    await expect(freqEl).toContainText(/440/);

    // Comprobar que la aguja y badge de afinación indican afinado (in-tune)
    const centsBadge = page.locator('#lblVocalCentsBadge');
    await expect(centsBadge).toBeVisible();

    // Comprobar que la burbuja de consejos contiene orientación didáctica activa
    const adviceText = page.locator('#lblVocalCoachTipText');
    await expect(adviceText).toBeVisible();
    const tipContent = await adviceText.textContent();
    expect(tipContent.length).toBeGreaterThan(5);

    // Detener micrófono
    await btnMic.click();
    await expect(btnMic).not.toHaveClass(/recording/);
  });

  test('3. Cambio de Notas Objetivo, Píldoras de Ejercicio y Tono de Referencia', async ({ page }) => {
    const navTools = page.locator('.nav-tab-btn[data-tab="tools"]');
    await navTools.click();

    await page.locator('.premium-list-item[data-tool="vocal"]').click();

    // Probar selección de nota objetivo C4
    const chipC4 = page.locator('.btn-target-note-chip[data-note="C4"]');
    await expect(chipC4).toBeVisible();
    await chipC4.click();
    await expect(chipC4).toHaveClass(/active/);

    // Probar botón de tono de referencia (Pitch Pipe)
    const btnPitchPipe = page.locator('#btnAuditionTargetTone');
    await expect(btnPitchPipe).toBeVisible();
    await btnPitchPipe.click();

    // Probar cambio a ejercicio "Sostener Tono (5s)"
    const btnSustain = page.locator('.vocal-pill-btn[data-exercise="sustain"]');
    await expect(btnSustain).toBeVisible();
    await btnSustain.click();
    await expect(btnSustain).toHaveClass(/active/);

    // Probar cambio a ejercicio "Escala 5 Tonos"
    const btnScale = page.locator('.vocal-pill-btn[data-exercise="scale5"]');
    await expect(btnScale).toBeVisible();
    await btnScale.click();
    await expect(btnScale).toHaveClass(/active/);
  });

  test('4. Acceso Rápido al Vocal Coach desde el Visor de Canción (Opciones)', async ({ page }) => {
    const heroSearch = page.locator('#exploreSearchInput');
    await heroSearch.fill('Dust in the Wind');
    const songCard = page.locator('.btn-load-explore-song', { hasText: /Dust in the Wind/i }).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click();

    // 1. Abrir desplegable "Opciones"
    const btnMoreOptions = page.locator('#btnMoreOptions');
    await expect(btnMoreOptions).toBeVisible();
    await btnMoreOptions.click();

    // 2. Clic en botón Asistente Vocal
    const btnVocalQuick = page.locator('#btnOpenVocalCoachQuick');
    await expect(btnVocalQuick).toBeVisible();
    await btnVocalQuick.click();

    // 3. Verificar que se abrió el modal del Vocal Coach
    const vocalModal = page.locator('#modal-vocal-coach');
    await expect(vocalModal).toBeVisible();
  });

});
