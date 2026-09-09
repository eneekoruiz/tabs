import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.setTimeout(120000);
test.use({ serviceWorkers: 'block' });

test('catalogue shows evidence limits, filters actual chords and exports pending review', async ({ page }) => {
  await page.goto('/');
  await page.locator('.song-card').first().waitFor();
  await page.locator('.catalog-audit-panel summary').click();
  await expect(page.locator('#catalogQualitySummary')).toContainText('Ninguna está certificada');
  const download = page.waitForEvent('download');
  await page.locator('#btnExportCatalogAudit').click();
  expect((await download).suggestedFilename()).toBe('auditoria-catalogo.json');
  const all = await page.locator('#discoveryResultStatus').textContent();
  await page.locator('#catalogQualityFilter').selectOption('chords');
  await expect(page.locator('#discoveryResultStatus')).not.toHaveText(all);
  await expect(page.locator('.song-card').first()).toContainText('Letra y acordes · sin verificar');
  const audit = await new AxeBuilder({ page }).include('.catalog-audit-panel').include('.catalog-quality-filter').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(audit.violations).toEqual([]);
  await page.locator('#catalogQualityFilter').selectOption('verified');
  await expect(page.locator('.song-card')).toHaveCount(0);
  await expect(page.locator('.discovery-empty-state')).toBeVisible();
});

test('opening plain lyrics does not manufacture chords, score, BPM or extra saved copies', async ({ page }) => {
  await page.goto('/');
  await page.locator('.song-card').first().waitFor();
  const song = await page.evaluate(async () => {
    const { searchEngine } = await import('/src/data/SearchEngine.js');
    const s = searchEngine.catalogIndex.find(s => !s.quality.hasChords && !s.tempo && s.versionId === 'repository-sheet');
    return { title: s.title, artist: s.artist, lyrics: s.lyricsChords };
  });
  await page.locator('#exploreSearchInput').fill(`${song.title} ${song.artist}`);
  await page.getByRole('button', { name: `Abrir ${song.title} de ${song.artist}`, exact: true }).first().click();
  await expect(page.locator('.song-content-audit')).toContainText('No se añadirán acordes inventados');
  const stored = await page.evaluate(async () => {
    const { state } = await import('/src/core/State.js');
    const active = state.get('activeSong');
    return { lyrics: active.lyricsChords, tempo: active.tempo, data: active.data, versionId: active.versionId };
  });
  expect(stored.lyrics).toBe(song.lyrics);
  expect(stored.tempo).toBeNull();
  expect(stored.data).toBeFalsy();
  expect(stored.versionId).toBe('repository-sheet');
  await page.locator('#btnPlaySingToggle').click();
  await expect(page.locator('#karaokeSourceNote')).toContainText('sin acordes disponibles');
});

test('repository alternatives remain separately selectable and retain their supplied text', async ({ page }) => {
  await page.goto('/');
  await page.locator('.song-card').first().waitFor();
  const song = await page.evaluate(async () => {
    const { searchEngine } = await import('/src/data/SearchEngine.js');
    const s = searchEngine.catalogIndex.find(s => s.versionId === 'repository-text');
    return { title: s.title, artist: s.artist };
  });
  await page.locator('#exploreSearchInput').fill(`${song.title} ${song.artist}`);
  await expect(page.locator('#discoveryDetailPanel h2')).toHaveText(song.title);
  await expect(page.locator('#detailVersionSelect')).toBeVisible();
  const options = await page.locator('#detailVersionSelect option').allTextContents();
  expect(options.length).toBeGreaterThan(1);
  const index = options.findIndex(label => label.includes('alternativa'));
  expect(index).toBeGreaterThanOrEqual(0);
  await page.locator('#detailVersionSelect').selectOption(String(index));
  await page.locator('.btn-load-detail-song').click();
  await expect(page.locator('.lyrics-chords-container')).toBeVisible();
  const version = await page.evaluate(async () => (await import('/src/core/State.js')).state.get('activeSong').versionId);
  expect(version).toBe('repository-text');
});
