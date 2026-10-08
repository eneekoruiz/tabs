import { test, expect } from '@playwright/test';
import { waitForSong, openSongOptions , openToolCatalogAdvanced } from './helpers/journeys.js';

test.describe.configure({ timeout: 90_000 });

test.describe('🎙️ Transcripción IA, Analíticas y Backup Blindado - Suite E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Configurar permisos de micrófono y mock de Web Audio antes de cargar
    await page.addInitScript(() => {
      // Browser MediaRecorder must produce a decodable capture, not arbitrary bytes.
      window.qaCaptureSources = [];
      navigator.mediaDevices.getUserMedia = async () => {
        const context = new AudioContext();
        await context.resume();
        const destination = context.createMediaStreamDestination();
        const gain = context.createGain();
        gain.gain.value = 0.15;
        gain.connect(destination);
        const oscillators = [261.6256, 329.6276, 391.9954].map(frequency => {
          const oscillator = context.createOscillator();
          oscillator.frequency.value = frequency;
          oscillator.connect(gain);
          oscillator.start();
          return oscillator;
        });
        window.qaCaptureSources.push({ context, oscillators });
        return destination.stream;
      };
    });

    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
  });

  test('1. Apertura del Transcriptor IA (Magic Scratchpad) desde Herramientas', async ({ page }) => {
    // Ir a pestaña de Herramientas
    await page.click('button[data-tab="tools"]');
    await openToolCatalogAdvanced(page);
    await page.waitForTimeout(300);

    // Click en la tarjeta de Transcripción IA
    const card = page.locator('.premium-list-item[data-tool="transcriber"]');
    await expect(card).toBeVisible();
    await card.locator('[data-preview-action="open-full"]').click();

    // Comprobar modal
    const modal = page.locator('#modal-audio-transcriber');
    await expect(modal).toBeVisible();
    await expect(page.locator('.transcriber-badge')).toContainText('ANÁLISIS LOCAL DE AUDIO');
    await expect(page.locator('#transcriptionWaveCanvas')).toBeVisible();
    await expect(page.locator('#btnToggleTranscribeRec')).toBeVisible();

    // Cerrar modal
    await page.click('#btnCloseTranscriber');
    await expect(modal).not.toBeVisible();
  });

  test('2. Grabación y Transcripción DSP de Audio a Acordes y Carga en Visor', async ({ page }) => {
    // Abrir transcriptor
    await page.click('button[data-tab="tools"]');
    await openToolCatalogAdvanced(page);
    await page.click('.premium-list-item[data-tool="transcriber"] [data-preview-action="open-full"]');

    // Iniciar grabación en vivo
    const btnRec = page.locator('#btnToggleTranscribeRec');
    await btnRec.click();
    // Require encoded browser audio rather than assuming a fixed delay produced it.
    await expect.poll(() => page.evaluate(async () => {
      const { audioTranscriptionEngine } = await import('/src/audio/AudioTranscriptionEngine.js');
      return audioTranscriptionEngine.audioChunks.reduce((bytes, chunk) => bytes + chunk.size, 0);
    }), { timeout: 15000 }).toBeGreaterThan(1000);

    // Verificar estado de grabación
    await expect(page.locator('#lblWaveStatus')).toContainText('Grabando');
    await expect(btnRec).toContainText('Detener');

    // Detener grabación para transcribir
    await btnRec.click();
    await page.waitForTimeout(600);

    // Verificar timeline de acordes y resultados
    const results = page.locator('#transcriptionResultsSection');
    await expect(results).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#lblDetectedKey')).not.toBeEmpty();

    const chordCards = page.locator('.chord-timeline-card');
    const count = await chordCards.count();
    expect(count).toBeGreaterThan(0);
    const capture = await page.evaluate(async () => {
      const { audioTranscriptionEngine: engine } = await import('/src/audio/AudioTranscriptionEngine.js');
      return { bytes: engine.recordedBlob.size, chords: engine.isRecording, stream: engine.mediaStream };
    });
    expect(capture.bytes).toBeGreaterThan(1000);
    expect(capture.chords).toBe(false);
    expect(capture.stream).toBeNull();

    // Cargar en visor de canción
    await page.click('#btnLoadInSongViewer');
    await page.waitForTimeout(500);

    // Debe abrir la canción transcrita en la vista de acordes
    await expect(page.locator('#lyricsBodyContent')).toBeVisible();
    await expect(page.locator('.lyrics-song-title')).toContainText('Idea Transcrita');
  });

  test('3. Panel de Rendimiento & Analíticas del Músico (Dashboard)', async ({ page }) => {
    // Ir a pestaña de Herramientas y abrir Analíticas
    await page.click('button[data-tab="tools"]');
    await openToolCatalogAdvanced(page);
    await page.click('.premium-list-item[data-tool="analytics"] [data-preview-action="open-full"]');

    const modal = page.locator('#modal-practice-analytics');
    await expect(modal).toBeVisible();
    await expect(page.locator('.analytics-badge')).toContainText('PRACTICE INTELLIGENCE');

    // Verificar KPIs
    await expect(page.locator('#lblKpiTotalHours')).toBeVisible();
    await expect(page.locator('#lblKpiStreak')).toContainText('Días');

    // Verificar gráfico semanal con 7 columnas
    const bars = page.locator('.bar-chart-col');
    await expect(bars).toHaveCount(7);

    // Verificar mapa de calor de 30 días
    const heatmapCells = page.locator('.heatmap-cell');
    await expect(heatmapCells).toHaveCount(30);

    await page.locator('#toolAdvanced > summary').click();
    // Verificar lista de top canciones y logros
    await expect(page.locator('.top-song-row').first()).toBeVisible();
    await expect(page.locator('.milestone-badge-card').first()).toBeVisible();

    // Cerrar modal
    await page.click('#btnCloseAnalytics');
    await expect(modal).not.toBeVisible();
  });

  test('4. Respaldo Cifrado y Sincronización (Exportación / Importación 1-Clic)', async ({ page }) => {
    // Ir a pestaña de Ajustes
    await page.click('button[data-tab="settings"]');
    await page.locator('#settingsAdvanced > summary').click();
    await page.waitForTimeout(300);

    // Verificar botón de exportar respaldo blindado
    const btnExport = page.locator('#btnExportBackup');
    await expect(btnExport).toBeVisible();

    // Verificar acceso al dashboard desde Ajustes
    const btnDashboard = page.locator('#btnOpenAnalyticsFromSettings');
    await expect(btnDashboard).toBeVisible();
    await btnDashboard.click();

    // Debe abrir el modal de analíticas
    await expect(page.locator('#modal-practice-analytics')).toBeVisible();
    await page.click('#btnCloseAnalytics');
    await expect(page.locator('#modal-practice-analytics')).not.toBeVisible();

    // Probar restauración con payload seguro estructurado
    const restoreResult = await page.evaluate(async () => {
      const payload = {
        signature: 'AGY_TABS_SECURE_V2',
        version: 2.0,
        createdAt: new Date().toISOString(),
        data: {
          songs: [
            {
              id: 999,
              title: 'Canción Restaurada de Backup',
              artist: 'Artista Test',
              lyricsChords: '[C] [G] [Am] [F]'
            }
          ],
          analytics: {
            stats: { totalPracticeMinutes: 300, currentStreakDays: 5, bestStreakDays: 10, songsPracticed: {} },
            sessions: [],
            milestones: []
          },
          settings: {
            userName: 'Músico Restaurado PRO',
            userEmail: 'restaurado@studio.com'
          }
        }
      };
      return await window.backupSyncEngine.importFullBackup(JSON.stringify(payload));
    });

    expect(restoreResult.success).toBe(true);
    expect(restoreResult.restoredSongs).toBe(1);

    // Verificar que el perfil refleje los datos restaurados
    await page.click('button[data-tab="explore"]');
    await page.click('button[data-tab="settings"]');
    await page.locator('#settingsAdvanced > summary').click();
    await expect(page.locator('.settings-user-name')).toContainText('Músico Restaurado PRO');
  });

  test('5. Acceso Rápido a Transcripción y Analíticas desde el Menú de Opciones de Canción', async ({ page }) => {
    // Abrir una canción del catálogo
    const songCard = page.locator('.song-card .btn-select-song').first();
    await songCard.click();
    await waitForSong(page);
    await page.waitForTimeout(500);

    // Abrir menú de opciones
    await openSongOptions(page, { advanced: true });
    await page.waitForTimeout(200);

    // Abrir Transcriptor desde Opciones
    await page.click('#btnOpenTranscriberQuick');
    await expect(page.locator('#modal-audio-transcriber')).toBeVisible();
    await page.click('#btnCloseTranscriber');
    await expect(page.locator('#modal-audio-transcriber')).not.toBeVisible();

    // Abrir Analíticas desde Opciones
    await openSongOptions(page, { advanced: true });
    await page.click('#btnOpenAnalyticsQuick');
    await expect(page.locator('#modal-practice-analytics')).toBeVisible();
    await page.click('#btnCloseAnalytics');
  });

});
