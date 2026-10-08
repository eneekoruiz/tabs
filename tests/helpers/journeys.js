import { expect } from '@playwright/test';

// Catalog resolution can include the local index and score initialization.
// Wait for the result of the user action instead of racing a fixed delay.
export async function waitForSong(page) {
  await expect(page.locator('.lyrics-chords-container')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.lyrics-song-title')).not.toHaveText('Selecciona una canción');
}

export async function openSongOptions(page, { advanced = false } = {}) {
  await waitForSong(page);
  await page.locator('#btnMoreOptions').click();
  const reading = page.locator('#songReadingOptions');
  if (await reading.count() && !(await reading.evaluate(element => element.open))) await reading.locator('summary').click();
  if (advanced) {
    const details = page.locator('.song-advanced-options');
    if (!(await details.evaluate(element => element.open))) await details.locator('summary').click();
  }
}

export async function openTool(page, name) {
  if (!['metronome','tuner','dictionary','vocal'].includes(name)) {
    const advanced = page.locator('#toolsAdvanced');
    if (!(await advanced.evaluate(element => element.open))) await advanced.locator('summary').click();
  }
  await page.locator(`[data-tool="${name}"] [data-preview-action="open-full"]`).click();
}

export async function openToolCatalogAdvanced(page) {
  const advanced = page.locator('#toolsAdvanced');
  if (!(await advanced.evaluate(element => element.open))) await advanced.locator('summary').click();
}

export async function openKaraokeOptions(page) {
  const drawer=page.locator('#karaokeSecondaryDrawer');
  if (!(await drawer.evaluate(el=>el.open))) await drawer.locator('summary').click();
}
export async function seekKaraoke(page, seconds) {
  const range=page.locator('#karaokeSeek');
  await expect(range).toBeEnabled();
  await range.evaluate((element, value) => {
    element.value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, seconds);
  // Verify native keyboard seeking as well as the slider input event.
  await range.focus(); await range.press('ArrowRight'); await range.press('ArrowLeft');
  await expect(range).toHaveValue(String(seconds));
}

export async function useGeneratedGuide(page){await openKaraokeOptions(page);await page.locator('input[name="karaokeSource"][value="synth"]').check();}
