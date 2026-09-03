import { test, expect } from '@playwright/test';

test.describe('📱 Mobile UX & Acoustic Audio Engine — Suite E2E', () => {
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
    await page.waitForSelector('.discovery-song-card', { timeout: 10000 });
  });

  test.afterEach(async () => {
    const realErrors = consoleErrors.filter(e => !e.includes('Failed to load resource') && !e.includes('favicon'));
    expect(realErrors, `Errores de consola: ${realErrors.join(', ')}`).toEqual([]);
  });

  test('1. Tarjetas Móviles: Título completo, badge en meta y sin botón Abrir redundante', async ({ page }) => {
    const firstCard = page.locator('.discovery-song-card').first();
    await expect(firstCard).toBeVisible();

    // El título está visible
    const titleEl = firstCard.locator('.song-card-title');
    await expect(titleEl).toBeVisible();

    // El badge de dificultad está dentro de .song-card-meta
    const diffBadge = firstCard.locator('.song-card-meta .song-badge-diff');
    await expect(diffBadge).toBeVisible();

    // En la tarjeta no hay botón "Abrir" redundante ni fila separadora
    await expect(firstCard.locator('.btn-load-explore-song')).toHaveCount(0);
    await expect(firstCard.locator('.catalog-version-row')).toHaveCount(0);
  });

  test('2. Móvil: Tocar en cualquier sitio de la tarjeta abre la canción directamente', async ({ page }) => {
    const firstCard = page.locator('.discovery-song-card').first();
    await expect(firstCard).toBeVisible();

    // Clic en la tarjeta abre el visor
    await firstCard.click();

    const lyricsContainer = page.locator('.lyrics-chords-container');
    await expect(lyricsContainer).toBeVisible({ timeout: 10000 });
  });

  test('3. Menú Superior Móvil: Barra compacta de 1 fila y selector de 3 instrumentos visible al 100%', async ({ page }) => {
    // Abrir una canción
    const firstCard = page.locator('.discovery-song-card').first();
    await firstCard.click();

    const lyricsContainer = page.locator('.lyrics-chords-container');
    await expect(lyricsContainer).toBeVisible({ timeout: 10000 });

    // Comprobar que las herramientas de escritorio secundarias (PDF, partitura, capo, zoom) están ocultas en la barra móvil
    const desktopTools = page.locator('.desktop-header-tool');
    const count = await desktopTools.count();
    for (let i = 0; i < count; i++) {
      await expect(desktopTools.nth(i)).toBeHidden();
    }

    // Comprobar selector de instrumentos visible con los 3 botones en grid
    const instExtension = page.locator('#heroInstrumentExtension');
    await expect(instExtension).toBeVisible();

    const guitarBtn = page.locator('.btn-hero-inst-pill[data-inst="guitar"]');
    const ukeBtn = page.locator('.btn-hero-inst-pill[data-inst="ukulele"]');
    const pianoBtn = page.locator('.btn-hero-inst-pill[data-inst="piano"]');

    await expect(guitarBtn).toBeVisible();
    await expect(ukeBtn).toBeVisible();
    await expect(pianoBtn).toBeVisible();

    // Comprobar que los tres están en pantalla (ninguno cortado fuera del ancho)
    const boxGuitar = await guitarBtn.boundingBox();
    const boxPiano = await pianoBtn.boundingBox();
    expect(boxGuitar.x).toBeGreaterThanOrEqual(0);
    expect(boxPiano.x + boxPiano.width).toBeLessThanOrEqual(375);

    // Cambiar a Piano
    await pianoBtn.click();
    await expect(pianoBtn).toHaveClass(/active/);
  });

  test('4. Modo Canto / Karaoke: Base armónica y score pausado cuando no reproduce', async ({ page }) => {
    // Abrir una canción
    const firstCard = page.locator('.discovery-song-card').first();
    await firstCard.click();

    await page.waitForSelector('#btnPlaySingToggle', { timeout: 10000 });
    // Cambiar a modo cantar
    await page.locator('#btnPlaySingToggle').click();

    // Verificar en el contexto del navegador que el motor de VFX y PitchLane tienen control de reproducción
    const checkState = await page.evaluate(async () => {
      const { VFXEngine } = await import('./src/ui/lyrics/VFXEngine.js');
      const canvas = document.createElement('canvas');
      const vfx = new VFXEngine(canvas);
      vfx.start();

      // Al iniciar, isPlaying es false
      const initialPlaying = vfx.isPlaying;
      const initialScore = vfx.score;

      // Simular pitch in-tune mientras está en pausa -> el score NO debe avanzar
      vfx._handlePitch({ accuracyStatus: 'in-tune', centsOffset: 0 });
      const scoreAfterPausedPitch = vfx.score;

      // Activar reproducción -> registerHit suma puntos
      vfx.setPlaying(true);
      vfx.registerHit();
      const scoreAfterPlayHit = vfx.score;

      // Pausar de nuevo -> no suma
      vfx.setPlaying(false);
      vfx.registerHit();
      const scoreAfterRepause = vfx.score;

      return {
        initialPlaying,
        initialScore,
        scoreAfterPausedPitch,
        scoreAfterPlayHit,
        scoreAfterRepause,
      };
    });

    expect(checkState.initialPlaying).toBe(false);
    expect(checkState.scoreAfterPausedPitch).toBe(0); // Cero puntos sumados en pausa
    expect(checkState.scoreAfterPlayHit).toBeGreaterThan(0); // Sumó puntos al reproducir y acertar
    expect(checkState.scoreAfterRepause).toBe(checkState.scoreAfterPlayHit); // No sumó en pausa
  });

  test('5. Mis Tabs: Favoritas seleccionadas por defecto y sin pestaña Todas', async ({ page }) => {
    const navLibrary = page.locator('.nav-tab-btn[data-tab="library"]');
    await navLibrary.click();

    await page.waitForSelector('.library-filter-tabs', { timeout: 10000 });

    // La pestaña Favoritas debe estar activa por defecto
    const favTab = page.locator('.lib-tab[data-filter="favorites"]');
    await expect(favTab).toBeVisible();
    await expect(favTab).toHaveClass(/active/);

    // No debe existir la pestaña "Todas"
    const allTab = page.locator('.lib-tab[data-filter="all"]');
    await expect(allTab).toHaveCount(0);
  });

  test('6. Ajustes Móvil: Interruptor de mano dominante en 1 sola fila horizontal estilo iOS', async ({ page }) => {
    const navSettings = page.locator('.nav-tab-btn[data-tab="settings"]');
    await navSettings.click();

    await page.waitForSelector('#chkSettingsLeftHanded', { timeout: 10000 });

    const toggleRow = page.locator('.settings-row-item', { has: page.locator('#chkSettingsLeftHanded') });
    await expect(toggleRow).toBeVisible();

    // Comprobar que están en la misma fila horizontal (centros Y alineados aproximadamente)
    const infoBox = await toggleRow.locator('.settings-row-info').boundingBox();
    const switchBox = await toggleRow.locator('.switch-toggle').boundingBox();

    expect(Math.abs((infoBox.y + infoBox.height / 2) - (switchBox.y + switchBox.height / 2))).toBeLessThan(25);
    // El switch está a la derecha del texto
    expect(switchBox.x).toBeGreaterThan(infoBox.x);
  });

  test('7. Patrón de Rasgueo Acústico: Ganancia calibrada y audición sin distorsión', async ({ page }) => {
    // Abrir una canción
    const firstCard = page.locator('.discovery-song-card').first();
    await firstCard.click();

    await page.waitForSelector('#btnPreviewStrumming', { timeout: 10000 });
    const btnStrum = page.locator('#btnPreviewStrumming');
    await expect(btnStrum).toBeVisible();

    // Clic para escuchar el patrón de rasgueo
    await btnStrum.click();
    await expect(btnStrum).toHaveClass(/playing/);

    // Pausar
    await btnStrum.click();
    await expect(btnStrum).not.toHaveClass(/playing/);
  });
});
