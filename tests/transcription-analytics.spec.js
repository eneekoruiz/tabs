import { test, expect } from '@playwright/test';

test.describe('🎙️ Transcripción IA, Analíticas y Backup Blindado - Suite E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Configurar permisos de micrófono y mock de Web Audio antes de cargar
    await page.addInitScript(() => {
      // Mock de getUserMedia
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

      // Mock de MediaRecorder
      window.MediaRecorder = class MockMediaRecorder {
        constructor(stream) {
          this.stream = stream;
          this.state = 'inactive';
          this.ondataavailable = null;
          this.onstop = null;
        }
        start() {
          this.state = 'recording';
          setTimeout(() => {
            if (this.ondataavailable) {
              const dummyChunk = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'audio/webm' });
              this.ondataavailable({ data: dummyChunk });
            }
          }, 100);
        }
        stop() {
          this.state = 'inactive';
          if (this.onstop) this.onstop();
        }
      };
    });

    await page.goto('http://localhost:3000/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
  });

  test('1. Apertura del Transcriptor IA (Magic Scratchpad) desde Herramientas', async ({ page }) => {
    // Ir a pestaña de Herramientas
    await page.click('button[data-tab="tools"]');
    await page.waitForTimeout(300);

    // Click en la tarjeta de Transcripción IA
    const card = page.locator('.premium-list-item[data-tool="transcriber"]');
    await expect(card).toBeVisible();
    await card.click();

    // Comprobar modal
    const modal = page.locator('#modal-audio-transcriber');
    await expect(modal).toBeVisible();
    await expect(page.locator('.transcriber-badge')).toContainText('MAGIC SCRATCHPAD');
    await expect(page.locator('#transcriptionWaveCanvas')).toBeVisible();
    await expect(page.locator('#btnToggleTranscribeRec')).toBeVisible();

    // Cerrar modal
    await page.click('#btnCloseTranscriber');
    await expect(modal).not.toBeVisible();
  });

  test('2. Grabación y Transcripción DSP de Audio a Acordes y Carga en Visor', async ({ page }) => {
    // Abrir transcriptor
    await page.click('button[data-tab="tools"]');
    await page.click('.premium-list-item[data-tool="transcriber"]');

    // Iniciar grabación en vivo
    const btnRec = page.locator('#btnToggleTranscribeRec');
    await btnRec.click();
    await page.waitForTimeout(400);

    // Verificar estado de grabación
    await expect(page.locator('#lblWaveStatus')).toContainText('Grabando');
    await expect(btnRec).toContainText('Detener');

    // Detener grabación para transcribir
    await btnRec.click();
    await page.waitForTimeout(600);

    // Verificar timeline de acordes y resultados
    const results = page.locator('#transcriptionResultsSection');
    await expect(results).toBeVisible();
    await expect(page.locator('#lblDetectedKey')).not.toBeEmpty();

    const chordCards = page.locator('.chord-timeline-card');
    const count = await chordCards.count();
    expect(count).toBeGreaterThan(0);

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
    await page.click('.premium-list-item[data-tool="analytics"]');

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
    await expect(page.locator('.settings-user-name')).toContainText('Músico Restaurado PRO');
  });

  test('5. Acceso Rápido a Transcripción y Analíticas desde el Menú de Opciones de Canción', async ({ page }) => {
    // Abrir una canción del catálogo
    const songCard = page.locator('.btn-load-explore-song').first();
    await songCard.click();
    await page.waitForTimeout(500);

    // Abrir menú de opciones
    await page.click('#btnMoreOptions');
    await page.waitForTimeout(200);

    // Abrir Transcriptor desde Opciones
    await page.click('#btnOpenTranscriberQuick');
    await expect(page.locator('#modal-audio-transcriber')).toBeVisible();
    await page.click('#btnCloseTranscriber');
    await expect(page.locator('#modal-audio-transcriber')).not.toBeVisible();

    // Abrir Analíticas desde Opciones
    await page.click('#btnMoreOptions');
    await page.click('#btnOpenAnalyticsQuick');
    await expect(page.locator('#modal-practice-analytics')).toBeVisible();
    await page.click('#btnCloseAnalytics');
  });

});
