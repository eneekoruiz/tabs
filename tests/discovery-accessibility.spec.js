import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

test('startup demo never overwrites the last real music session', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(async () => {
    const { state } = await import('/src/core/State.js');
    return state.get('isScoreLoaded');
  }), { timeout: 30000 }).toBe(true);
  await page.locator('.song-card').first().waitFor();
  expect(await page.evaluate(() => localStorage.getItem('tabs_chords_music_session_v1'))).toBeNull();
  await page.evaluate(async () => {
    const { SessionRecovery } = await import('/src/data/SessionRecovery.js');
    new SessionRecovery().flush({ song: { id: 'saved-real-song', title: 'Mi ensayo guardado', artist: 'Mi repertorio',
      lyricsChords: '[C]Una sesión real', versionId: 'acoustic' }, transposeSemitones: 3, capoFret: 2 });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(async () => {
    const { state } = await import('/src/core/State.js');
    return state.get('isScoreLoaded');
  }), { timeout: 30000 }).toBe(true);
  await page.locator('[data-resume-snapshot="true"]').waitFor();
  await expect(page.locator('[data-resume-snapshot="true"]')).toContainText('Mi ensayo guardado');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tabs_chords_music_session_v1')));
  expect(saved.song.title).toBe('Mi ensayo guardado');
  expect(saved.song.versionId).toBe('acoustic');
  expect(saved.transposeSemitones).toBe(3);
  expect(saved.capoFret).toBe(2);
});

for (const width of [375, 768, 1440]) {
  test(`discovery keyboard, contrast and layout at ${width}px`, async ({ page }, testInfo) => {
    testInfo.setTimeout(180000);
    await page.setViewportSize({ width, height: 960 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('.song-card').first().waitFor();

    const search = page.getByRole('searchbox', { name: 'Buscar en el catálogo' });
    await search.fill('Queen');
    await search.press('Enter');
    await expect(page.locator('#discoveryResultStatus')).not.toContainText('Buscando');
    await page.locator('#btnClearExploreSearch').click();
    await expect(search).toHaveValue('');
    await expect(search).toBeFocused();
    const recents = page.locator('#exploreRecentsDropdown');
    await expect(recents).toBeVisible();
    expect(await recents.evaluate(e => Boolean(e.closest('#exploreSearchBoxWrapper')))).toBe(true);
    const searchBounds = await search.boundingBox();
    const recentBounds = await recents.boundingBox();
    expect(Math.abs(searchBounds.x - recentBounds.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(searchBounds.width - recentBounds.width)).toBeLessThanOrEqual(1);
    const recentSearch = recents.locator('.recent-search-button').first();
    await recentSearch.focus();
    await recentSearch.press('Escape');
    await expect(search).toBeFocused();
    await expect(recents).toBeHidden();
    await search.press('Tab');
    await expect(page.locator('#btnImportYouTubeAI')).toBeFocused();
    const addBounds = await page.locator('#btnImportYouTubeAI').boundingBox();
    expect(addBounds.width).toBeGreaterThanOrEqual(44);
    expect(addBounds.height).toBeGreaterThanOrEqual(44);

    await page.locator('#exploreAdvanced > summary').click();
    await page.locator('#btnModeArtists').click();
    const artist = page.getByRole('button', { name: 'Explorar Queen', exact: true });
    await artist.focus();
    await artist.press('Enter');
    const back = page.getByRole('button', { name: /Volver a Artistas/ });
    await expect(back).toBeFocused();
    await expect(search).toHaveValue('Queen');
    await back.press('Space');
    await expect(artist).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('artists.png') });
    await page.locator('#btnModeSongs').click();

    for (const view of ['explore', 'library', 'settings']) {
      const nav = page.locator(`.nav-tab-btn[data-tab="${view}"]`);
      await nav.focus();
      await nav.press('Enter');
      await expect(nav).toBeFocused();
      await expect(nav).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('.nav-tab-btn[aria-current]')).toHaveCount(1);
      if (view === 'library') {
        const file = page.locator('#libFileInput');
        await file.focus();
        await expect(file).toBeFocused();
      }
      for (const theme of ['ivory', 'charcoal', 'amber']) {
        await page.evaluate(theme => { document.body.className = `theme-${theme}`; }, theme);
        const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(audit.violations, `${view} / ${theme}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
    await expect(page.getByLabel('Instrumento Predeterminado', { exact: true })).toBeVisible();
    await page.locator('#settingsAdvanced > summary').click();
    await expect(page.getByLabel('Frecuencia Maestra de Afinación (A4)', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Notación de Alteraciones', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Estilo Visual Anti-Fatiga', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
