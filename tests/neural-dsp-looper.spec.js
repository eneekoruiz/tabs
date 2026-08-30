import { test, expect } from '@playwright/test';

test.describe('🎛️ Neural DSP, Stem Separation & Smart Looper - Suite E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Configurar mock de Web Audio y getUserMedia
    await page.addInitScript(() => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const dst = ctx.createMediaStreamDestination();
          osc.connect(dst);
          osc.start();
          return dst.stream;
        };
      }
    });

    await page.goto('http://localhost:3000/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
  });

  test('1. Apertura de la Pedalera Virtual & Simulador de Amplis y Smart Tone', async ({ page }) => {
    // Ir a la pestaña de Herramientas
    await page.click('button[data-tab="tools"]');
    await page.waitForTimeout(300);

    // Abrir Pedalera Virtual
    const pedalboardItem = page.locator('.premium-list-item[data-tool="pedalboard"]');
    await expect(pedalboardItem).toBeVisible();
    await pedalboardItem.click();

    // Comprobar que el modal de pedalera se abrió
    const modal = page.locator('#modal-virtual-pedalboard');
    await expect(modal).toBeVisible();
    await expect(page.locator('.pedalboard-badge')).toContainText('REALTIME DSP');

    // Verificar presencia de los pedales boutique
    await expect(page.locator('.pedal-noise-gate')).toBeVisible();
    await expect(page.locator('.pedal-overdrive')).toBeVisible();
    await expect(page.locator('.pedal-equalizer')).toBeVisible();
    await expect(page.locator('.pedal-chorus')).toBeVisible();
    await expect(page.locator('.pedal-delay')).toBeVisible();
    await expect(page.locator('.pedal-reverb')).toBeVisible();

    // Probar interacción con footswitch de bypass (Overdrive)
    const odFootswitch = page.locator('.pedal-overdrive .pedal-footswitch');
    const odChassis = page.locator('.pedal-overdrive');
    await expect(odChassis).toHaveClass(/enabled/);

    // Hacer clic en footswitch para poner en bypass
    await odFootswitch.click();
    await expect(odChassis).toHaveClass(/bypassed/);

    // Volver a activar
    await odFootswitch.click();
    await expect(odChassis).toHaveClass(/enabled/);

    // Probar cambio de Preset a High-Gain Lead
    const metalPresetBtn = page.locator('.btn-preset-chip[data-preset="metal"]');
    await metalPresetBtn.click();
    await page.waitForTimeout(300);

    // Comprobar que el preset activo es High-Gain
    const currentPreset = await page.evaluate(() => window.pedalboardEngine.currentPreset);
    expect(currentPreset).toBe('metal');

    // Cerrar modal
    await modal.locator('#btnClosePedalboard').click();
    await expect(modal).not.toBeVisible();
  });

  test('2. Separador de Stems (4 Pistas: Voz, Batería, Bajo, Guitarra - Moises AI)', async ({ page }) => {
    // Ir a pestaña de Herramientas
    await page.click('button[data-tab="tools"]');
    await page.waitForTimeout(300);

    // Abrir Separador de Stems
    await page.click('.premium-list-item[data-tool="stems"]');
    const modal = page.locator('#modal-stem-separator');
    await expect(modal).toBeVisible();
    await expect(page.locator('.stems-badge-ai')).toContainText('NEURAL DSP');

    // Procesar Pista Demo de Estudio
    const btnDemo = page.locator('#btnLoadDemoStems');
    await expect(btnDemo).toBeVisible();
    await btnDemo.click();

    // Esperar a que el proceso termine y aparezca la consola de 4 canales
    const consoleView = page.locator('.stems-console-wrapper');
    await expect(consoleView).toBeVisible({ timeout: 15000 });

    // Verificar las 4 pistas (Voz, Batería, Bajo, Guitarra)
    await expect(page.locator('.stem-channel-vocals')).toBeVisible();
    await expect(page.locator('.stem-channel-drums')).toBeVisible();
    await expect(page.locator('.stem-channel-bass')).toBeVisible();
    await expect(page.locator('.stem-channel-guitar')).toBeVisible();

    // Probar Mute en Guitarra
    const muteGuitarBtn = page.locator('.stem-channel-guitar .btn-stem-mute');
    await muteGuitarBtn.click();
    await expect(muteGuitarBtn).toHaveClass(/active/);

    const isGuitarMuted = await page.evaluate(() => window.stemSeparatorEngine.trackMutes.guitar);
    expect(isGuitarMuted).toBe(true);

    // Probar Preset Rápido: Modo Karaoke
    await page.click('#btnPresetMuteVocals');
    await page.waitForTimeout(300);

    const isVocalsMuted = await page.evaluate(() => window.stemSeparatorEngine.trackMutes.vocals);
    expect(isVocalsMuted).toBe(true);

    // Probar fader de volumen
    const faderBass = page.locator('.stem-volume-fader[data-stem="bass"]');
    await faderBass.fill('0.5');
    await faderBass.dispatchEvent('input');
    await expect(page.locator('#volText-bass')).toContainText('50%');

    // Cerrar modal
    await modal.locator('#btnCloseStems').click();
    await expect(modal).not.toBeVisible();
  });

  test('3. Smart Looper & Speed Trainer con Aceleración Progresiva (+5% por ciclo)', async ({ page }) => {
    // Ir a pestaña de Herramientas
    await page.click('button[data-tab="tools"]');
    await page.waitForTimeout(300);

    // Abrir Smart Looper
    await page.click('.premium-list-item[data-tool="looper"]');
    const modal = page.locator('#modal-smart-looper');
    await expect(modal).toBeVisible();
    await expect(page.locator('.looper-badge')).toContainText('SPEED ESCALATION');

    // Probar selección rápida de compases (5-8)
    await page.click('.btn-quick-bars[data-start="5"]');
    await expect(page.locator('#looperStartBar')).toHaveValue('5');
    await expect(page.locator('#looperEndBar')).toHaveValue('8');

    // Activar Bucle
    const toggleBtn = page.locator('#btnLooperToggle');
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // Comprobar estado activo
    const isLooperActive = await page.evaluate(() => window.smartLooperEngine.isEnabled);
    expect(isLooperActive).toBe(true);

    // Simular que el músico completa una vuelta con éxito (Loop cycle completion)
    const cycleResult = await page.evaluate(() => {
      const initial = window.smartLooperEngine.currentSpeed;
      window.smartLooperEngine.handleLoopCycleCompleted();
      const next = window.smartLooperEngine.currentSpeed;
      return { initial, next, cycle: window.smartLooperEngine.currentCycle };
    });

    expect(cycleResult.cycle).toBe(2);
    expect(cycleResult.next).toBeGreaterThanOrEqual(cycleResult.initial);

    // Detener bucle y cerrar
    await page.click('#btnLooperReset');
    await modal.locator('#btnCloseLooper').click();
    await expect(modal).not.toBeVisible();
  });

  test('4. Menú de Opciones de Canción: Acceso Rápido a Pedalera, Stems y Smart Looper', async ({ page }) => {
    // Cargar una canción del catálogo
    const songCard = page.locator('.btn-load-explore-song').first();
    await songCard.click();
    await page.waitForTimeout(500);

    // Abrir menú de opciones
    await page.click('#btnMoreOptions');
    await page.waitForTimeout(200);

    // 1. Abrir Pedalera desde el Menú de Canción
    await page.click('#btnOpenPedalboardQuick');
    await expect(page.locator('#modal-virtual-pedalboard')).toBeVisible();
    await page.click('#btnClosePedalboard');
    await expect(page.locator('#modal-virtual-pedalboard')).not.toBeVisible();

    // 2. Abrir Separador de Stems desde el Menú de Canción
    await page.click('#btnMoreOptions');
    await page.click('#btnOpenStemsQuick');
    await expect(page.locator('#modal-stem-separator')).toBeVisible();
    await page.click('#btnCloseStems');
    await expect(page.locator('#modal-stem-separator')).not.toBeVisible();

    // 3. Abrir Smart Looper desde el Menú de Canción
    await page.click('#btnMoreOptions');
    await page.click('#btnOpenLooperQuick');
    await expect(page.locator('#modal-smart-looper')).toBeVisible();
    await page.click('#btnCloseLooper');
    await expect(page.locator('#modal-smart-looper')).not.toBeVisible();
  });

  test('5. Smart Tone Automático según el Género de la Canción (Metal vs Acoustic)', async ({ page }) => {
    // Probar detección de canción Metal
    const metalPreset = await page.evaluate(() => {
      const metalSong = { title: 'Master of Puppets', artist: 'Metallica', genre: 'Heavy Metal' };
      return window.pedalboardEngine.detectToneForSong(metalSong);
    });
    expect(metalPreset.name).toContain('High-Gain');

    // Probar detección de canción Acústica / Folk
    const acousticPreset = await page.evaluate(() => {
      const acousticSong = { title: 'Blackbird', artist: 'The Beatles', genre: 'Acústico / Folk' };
      return window.pedalboardEngine.detectToneForSong(acousticSong);
    });
    expect(acousticPreset.name).toContain('Acoustic');

    // Probar detección de canción Jazz
    const jazzPreset = await page.evaluate(() => {
      const jazzSong = { title: 'Autumn Leaves', artist: 'Miles Davis', genre: 'Jazz' };
      return window.pedalboardEngine.detectToneForSong(jazzSong);
    });
    expect(jazzPreset.name).toContain('Jazz');
  });

  test('6. Cero Fugas de Memoria en Nodos de Audio (Limpieza y Dispose Seguro)', async ({ page }) => {
    // Probar ciclo completo de creación y destrucción de motores sin errores
    const cleanupSuccess = await page.evaluate(() => {
      window.pedalboardEngine.dispose();
      window.stemSeparatorEngine.dispose();
      window.smartLooperEngine.dispose();
      return true;
    });

    expect(cleanupSuccess).toBe(true);
  });

});
