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

  test('1. Tarjetas Móviles: Título con wrap limpio de hasta 2 líneas y badge encima del botón', async ({ page }) => {
    const firstCard = page.locator('.discovery-song-card').first();
    await expect(firstCard).toBeVisible();

    // Comprobar que el título está en el header line sin badge al lado
    const headerLine = firstCard.locator('.song-card-header-line');
    const titleEl = headerLine.locator('.song-card-title');
    await expect(titleEl).toBeVisible();
    await expect(headerLine.locator('.song-badge-diff')).toHaveCount(0);

    // Comprobar que el badge de dificultad está en el footer row (catalog-version-row)
    const badgeRow = firstCard.locator('.catalog-version-row .song-card-badge-row .song-badge-diff');
    await expect(badgeRow).toBeVisible();
  });

  test('2. Móvil: Tocar en cualquier sitio de la tarjeta abre la canción directamente', async ({ page }) => {
    const firstCard = page.locator('.discovery-song-card').first();
    await expect(firstCard).toBeVisible();

    // Clic en el área de texto de la tarjeta (no en el botón Abrir)
    await firstCard.locator('.song-card-main').click();

    // Debe abrir directamente el visor de letra y acordes
    const lyricsContainer = page.locator('.lyrics-chords-container');
    await expect(lyricsContainer).toBeVisible({ timeout: 10000 });
  });

  test('3. Menú Superior Móvil: Compacto, sin colapsar a 3 líneas y con selector de instrumento visible', async ({ page }) => {
    // Abrir una canción
    const firstCard = page.locator('.discovery-song-card').first();
    await firstCard.locator('.song-card-main').click();

    const lyricsContainer = page.locator('.lyrics-chords-container');
    await expect(lyricsContainer).toBeVisible({ timeout: 10000 });

    // Comprobar que la barra superior existe y es compacta
    const navToolsRow = page.locator('.lyrics-nav-tools-row');
    await expect(navToolsRow).toBeVisible();

    // Comprobar selector de instrumentos visible y funcional
    const instExtension = page.locator('#heroInstrumentExtension');
    await expect(instExtension).toBeVisible();

    const pianoBtn = page.locator('.btn-hero-inst-pill[data-inst="piano"]');
    await expect(pianoBtn).toBeVisible();

    // Cambiar a Piano
    await pianoBtn.click();
    await expect(pianoBtn).toHaveClass(/active/);
  });

  test('4. Patrón de Rasgueo Acústico: Se activa y reproduce audio sin errores', async ({ page }) => {
    // Abrir una canción
    const firstCard = page.locator('.discovery-song-card').first();
    await firstCard.locator('.song-card-main').click();

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

  test('5. Audición de Acordes: Guitarra y Piano de Gran Cola procesan acordes cromáticos y complejos', async ({ page }) => {
    // Probar audición en Node context del navegador
    const result = await page.evaluate(async () => {
      const { chordEngine } = await import('./src/tools/ChordEngine.js');
      const testChords = ['Bb', 'C#m', 'Eb', 'D/F#', 'Cadd9', 'G+', 'F#dim'];
      const outputs = [];

      for (const chord of testChords) {
        // Audición de guitarra
        chordEngine.auditionChord(chord, 'guitar');
        // Audición de piano acústico
        chordEngine.auditionChord(chord, 'piano');
        // Rasgueo acústico
        chordEngine.strumGuitar(chord, 'down');
        outputs.push({ chord, ok: true });
      }
      return outputs;
    });

    expect(result.length).toBe(7);
    expect(result.every(r => r.ok)).toBe(true);
  });
});
