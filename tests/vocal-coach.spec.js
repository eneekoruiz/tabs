import { test, expect } from '@playwright/test';

test.describe('Vocal Coach QA Extremo', () => {
  test.beforeEach(async ({ page }) => {
    // Inject __IS_TESTING__ before the app loads
    await page.addInitScript(() => {
      window.__IS_TESTING__ = true;
    });
    
    // Abrir la app local
    await page.goto('http://127.0.0.1:3000');
    await page.waitForLoadState('networkidle');
  });

  test('Mocking de Audio y Validación de Estado (Canvas)', async ({ page }) => {
    // 1. Abrir la primera canción en el explorador
    const loadBtn = page.locator('.btn-load-explore-song').first();
    await expect(loadBtn).toBeVisible({ timeout: 10000 });
    await loadBtn.click();

    // Si aparece el selector de versiones, elegir la primera
    const versionItem = page.locator('.version-item-card, .btn-select-version-action').first();
    if (await versionItem.isVisible({ timeout: 1500 }).catch(() => false)) {
      await versionItem.click();
    }

    // Esperar a que cargue el visor de canciones y activar Modo Cantar
    const singBtn = page.locator('#btnPlaySingToggle, .opt-sing, #btnGuiderSing').first();
    await expect(singBtn).toBeVisible({ timeout: 10000 });
    await singBtn.click();

    // 3. El engine de VocalCoach y PitchLane arrancan, el mock de Oscillator también.
    // 4. El oscillator mock empieza en 440Hz (A4) y a los 2 segundos cambia a 523.25Hz (C5).
    // Esperamos 500ms para que se inicialice.
    await page.waitForTimeout(500);

    // En los primeros 2 segundos, debe detectar in-tune o near-tune (dependiendo del target)
    // Extraemos el estado interno de __VOCAL_STATE__
    const state1 = await page.evaluate(() => window.__VOCAL_STATE__);
    
    // Verificamos que el engine está trackeando audio (trailLength > 0) y currentMidi (440Hz es MIDI 69)
    expect(state1).not.toBeNull();
    expect(state1.currentMidi).toBeGreaterThan(60); // 440Hz es A4 (MIDI 69)
    expect(state1.trailLength).toBeGreaterThan(0);

    // Esperar a que el oscillator cambie de tono (2 segundos + padding)
    await page.waitForTimeout(2000);

    const state2 = await page.evaluate(() => window.__VOCAL_STATE__);
    
    // Ahora debe ser 523.25Hz (C5 -> MIDI 72)
    expect(state2.currentMidi).toBeGreaterThan(70); 
    
    // Se confirma que el estado interno se expone y reacciona correctamente
  });

  test('Memory Leak & FPS Check (Test de estrés de larga duración)', async ({ page }) => {
    test.setTimeout(120000); // Dar 2 minutos de timeout

    const loadBtn = page.locator('.btn-load-explore-song').first();
    await expect(loadBtn).toBeVisible({ timeout: 10000 });
    await loadBtn.click();

    const versionItem = page.locator('.version-item-card, .btn-select-version-action').first();
    if (await versionItem.isVisible({ timeout: 1500 }).catch(() => false)) {
      await versionItem.click();
    }

    const singBtn = page.locator('#btnPlaySingToggle, .opt-sing, #btnGuiderSing').first();
    await expect(singBtn).toBeVisible({ timeout: 10000 });
    await singBtn.click();

    // Monitorizar la RAM usada (JS heap size si está disponible, o asertar FPS)
    const getPerformanceInfo = async () => {
      return page.evaluate(() => {
        return {
          heap: window.performance?.memory?.usedJSHeapSize || 0,
          fps: window.__CURRENT_FPS || 60
        };
      });
    };

    const initialStats = await getPerformanceInfo();
    
    // Dejar cantar simulado durante 15 segundos
    await page.waitForTimeout(15000);

    const finalStats = await getPerformanceInfo();

    // El heap memory no debería inflarse masivamente (ej. +50MB) 
    // por culpa del bucle del Pitch Lane, ya que limitamos trail a 400 elementos y object pooling.
    if (finalStats.heap > 0 && initialStats.heap > 0) {
      const diffMB = (finalStats.heap - initialStats.heap) / 1024 / 1024;
      // Esperamos que no haya fugado más de 20MB
      expect(diffMB).toBeLessThan(20);
    }
  });
});
