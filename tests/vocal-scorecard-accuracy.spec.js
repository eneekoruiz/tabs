import { test, expect } from '@playwright/test';

test.describe('🎤 Validación de Precisión Vocal y Resumen de Ensayo (Anti-Datos Inventados)', () => {
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
  });

  test.afterEach(async () => {
    const realErrors = consoleErrors.filter(e => !e.includes('Failed to load resource') && !e.includes('favicon'));
    expect(realErrors, `Errores de consola: ${realErrors.join(', ')}`).toEqual([]);
  });

  test('1. Sin cantar: sessionStats permanece en 0 y el scorecard muestra "Sin Canto Detectado"', async ({ page }) => {
    // Abrir una canción
    const card = page.locator('.discovery-song-card').first();
    await card.click();
    await page.waitForSelector('#btnPlaySingToggle', { timeout: 10000 });

    // Cambiar a modo cantar
    await page.locator('#btnPlaySingToggle').click();
    await page.waitForSelector('#pitchLaneCanvas', { timeout: 10000 });

    // Verificar en el contexto del navegador que el motor no inventa estadísticas
    const statsEvaluation = await page.evaluate(async () => {
      const { vocalCoachEngine } = await import('./src/audio/VocalCoachEngine.js');
      vocalCoachEngine.resetSessionStats();

      // Estado inicial limpio
      const initialTotal = vocalCoachEngine.sessionStats.totalSingingFrames;
      const initialInTune = vocalCoachEngine.sessionStats.inTuneFrames;
      const isPlaybackActiveInitial = vocalCoachEngine.isPlaybackActive;

      // Simular ruido ambiental suave (RMS bajo = 0.008, no debe pasar)
      const mockNoiseBuffer = new Float32Array(1024).fill(0.005);
      const noiseDetection = vocalCoachEngine.detectVocalPitch(mockNoiseBuffer, 44100);

      // Simular intento de detección con reproducción pausada
      vocalCoachEngine.setPlaybackActive(false);
      vocalCoachEngine._handleVocalDetection({
        frequency: 440,
        clarity: 0.95,
        rms: 0.03, // volumen alto pero reproducción pausada
      });

      const totalAfterPausedSound = vocalCoachEngine.sessionStats.totalSingingFrames;

      return {
        initialTotal,
        initialInTune,
        isPlaybackActiveInitial,
        noiseDetection,
        totalAfterPausedSound,
      };
    });

    // Validar que el ruido ambiental se descarta
    expect(statsEvaluation.initialTotal).toBe(0);
    expect(statsEvaluation.initialInTune).toBe(0);
    expect(statsEvaluation.isPlaybackActiveInitial).toBe(false);
    expect(statsEvaluation.noiseDetection).toBeNull();
    // Sonido recibido en pausa NO suma estadísticas de ensayo
    expect(statsEvaluation.totalAfterPausedSound).toBe(0);

    // Abrir scorecard sin haber cantado y verificar que NO dice "33%" ni "100%"
    await page.evaluate(async () => {
      const { VocalScorecardModal } = await import('./src/ui/lyrics/VocalScorecardModal.js');
      VocalScorecardModal.show({
        songTitle: 'Test Song',
        artist: 'Artist',
        sessionStats: {
          totalSingingFrames: 0,
          inTuneFrames: 0,
          stabilityScore: null,
          breathSupportScore: null,
          lowestPitch: null,
          highestPitch: null,
        },
      });
    });

    const modal = page.locator('#vocalScorecardModal');
    await expect(modal).toBeVisible();

    // Comprobar que el título es honesto y no inventado
    const title = page.locator('.scorecard-medal-title');
    await expect(title).toHaveText('Sin Canto Detectado');

    // Comprobar afinación 0% y valores sin datos
    const accuracy = page.locator('.scorecard-stat-box .stat-number').first();
    await expect(accuracy).toHaveText('0%');

    const stability = page.locator('.scorecard-stat-box .stat-number').nth(1);
    await expect(stability).toHaveText('—');

    const breath = page.locator('.scorecard-stat-box .stat-number').nth(2);
    await expect(breath).toHaveText('—');

    const range = page.locator('.scorecard-stat-box .stat-number').nth(3);
    await expect(range).toHaveText('— – —');

    // Cerrar modal
    await page.locator('#btnScorecardClose').click();
    await expect(modal).toBeHidden();
  });

  test('2. Canto real con afinación genuina: Calcula métricas proporcionales y reales', async ({ page }) => {
    const calculation = await page.evaluate(async () => {
      const { vocalCoachEngine } = await import('./src/audio/VocalCoachEngine.js');
      vocalCoachEngine.resetSessionStats();
      vocalCoachEngine.setPlaybackActive(true);
      vocalCoachEngine.setTargetNote('A4'); // 440 Hz

      // Simular frames de canto real sostenido
      // Los 2 primeros confirman el inicio de voz (filtro anti-ruido transitorio)
      // 26 frames in-tune (440 Hz) y 6 frames desafinados (465 Hz) -> 24 confirmados in-tune de 30 confirmados = 80%
      for (let i = 0; i < 26; i++) {
        vocalCoachEngine._handleVocalDetection({
          frequency: 440,
          clarity: 0.95,
          rms: 0.04,
        });
      }
      for (let i = 0; i < 6; i++) {
        vocalCoachEngine._handleVocalDetection({
          frequency: 465,
          clarity: 0.92,
          rms: 0.035,
        });
      }

      const total = vocalCoachEngine.sessionStats.totalSingingFrames;
      const inTune = vocalCoachEngine.sessionStats.inTuneFrames;
      const calculatedPct = Math.round((inTune / total) * 100);

      return {
        total,
        inTune,
        calculatedPct,
        stability: vocalCoachEngine.sessionStats.stabilityScore,
        breath: vocalCoachEngine.sessionStats.breathSupportScore,
      };
    });

    expect(calculation.total).toBe(30); // 32 frames procesados - 2 de confirmación inicial = 30
    expect(calculation.inTune).toBe(24);
    expect(calculation.calculatedPct).toBe(80); // 80% real y auténtico
    expect(calculation.stability).toBeGreaterThan(0);
    expect(calculation.breath).toBeGreaterThan(0);
  });
});
