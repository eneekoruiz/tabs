import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

async function openOnline(page) {
  await page.goto('/');
  const selector = page.locator('#readyKaraokeChoice');
  await expect(selector.locator('option[value^="online:"]').first()).toBeAttached({ timeout: 30_000 });
  await selector.selectOption('online:I5mHTcJ5GfY');
  await expect(page.locator('#btnTryReadyKaraoke')).toHaveText('Abrir karaoke online');
  await page.locator('#btnTryReadyKaraoke').click();
  await expect(page.locator('#onlineKaraokeIframe')).toBeVisible({ timeout: 30_000 });
}
for (const width of [375, 768, 1440]) test('online karaoke stays in the song page with essential controls at ' + width + 'px', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width, height: 667 });
  await page.route('https://**youtube**/**', route => route.abort());
  await openOnline(page);
  const iframe = page.locator('#onlineKaraokeIframe');
  await expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  const bounds = await iframe.boundingBox();
  expect(bounds.width).toBeGreaterThanOrEqual(200);
  expect(bounds.height).toBeGreaterThanOrEqual(200);
  const mic = await page.locator('#btnKaraokeMic').boundingBox();
  expect(mic.y).toBeGreaterThanOrEqual(0);
  expect(mic.y + mic.height).toBeLessThanOrEqual(667);
  await expect(page.locator('#btnSingPlayPause')).toBeHidden();
  await expect(page.locator('#btnToggleScoreView')).toBeHidden();
  await expect(page.locator('.karaoke-lyrics')).toBeHidden();
  await expect(page.locator('#pitchLaneCanvas')).toBeHidden();
  const audit = await new AxeBuilder({ page }).include('#singStageWorkspace').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(audit.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('online-karaoke.png'), fullPage: true });
  await page.locator('#btnCloseOnlineKaraoke').click();
  await expect(iframe).toHaveCount(0);
  await expect(page.locator('#btnOpenOnlineKaraoke')).toBeFocused();
  await expect(page.locator('#pitchLaneCanvas')).toBeVisible();
  await expect(page.locator('#btnSingPlayPause')).toBeDisabled();
});

test('every online association matches title AND artist; wrong artists and guessed instrumentals are rejected', async ({ page }, info) => {
  await page.goto('/tests/fixtures/audio-harness.html');
  const result = await page.evaluate(async () => {
    const { getOnlineKaraokeCatalog, findOnlineKaraoke } = await import('/src/data/OnlineKaraokeCatalog.js');
    const { getSongKaraokeVideoId, findKnownYouTubeVideoId } = await import('/src/ui/lyrics/YouTubeCompanion.js');
    const data = await getOnlineKaraokeCatalog();
    for (const song of data.matches) {
      if ((await findOnlineKaraoke(song))?.videoId !== song.videoId) throw Error(song.title);
      if (await findOnlineKaraoke({ ...song, artist: 'An unrelated artist' })) throw Error('Wrong artist matched');
    }
    return { checked: data.matches.length, listed: data.listedSongs.length, queenInstrumental: getSongKaraokeVideoId({title:'Bohemian Rhapsody',artist:'Queen'}), wrongOriginal:findKnownYouTubeVideoId('Perfect','An unrelated artist') };
  });
  expect(result.checked).toBe(195);
  expect(result.listed).toBe(1819);
  expect(result.queenInstrumental).toBe('');
  expect(result.wrongOriginal).toBe('');
  await info.attach('online-associations.json', { body: JSON.stringify(result), contentType: 'application/json' });
});

test('provider playback errors produce an actionable message and the player is destroyed on navigation (API contract simulation)', async ({ page }) => {
  await page.addInitScript(() => {
    window.__providerDestroyed = 0;
    window.YT = { Player: class { constructor(iframe, config) { queueMicrotask(() => config.events.onError({data:101})); } destroy() { window.__providerDestroyed++; } } };
  });
  await page.route('https://**youtube**/**', route => route.abort());
  await openOnline(page);
  await expect(page.locator('#onlineKaraokeStatus')).toContainText('código 101');
  await expect(page.getByRole('link', { name: 'Abrir en YouTube si el vídeo no se reproduce' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=I5mHTcJ5GfY');
  await page.locator('#btnPlaySingToggle').click();
  await expect(page.locator('#onlineKaraokeIframe')).toHaveCount(0);
  expect(await page.evaluate(() => window.__providerDestroyed)).toBe(1);
});

test('recorded human voice gives free pitch while online karaoke does not invent a melody score', async ({}, info) => {
  test.setTimeout(90_000);
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + path.resolve('tests/fixtures/real-audio/vocadito_1.wav') + '%noloop'] });
  try {
    const context = await browser.newContext({ permissions: ['microphone'], viewport: {width:375,height:667}, serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.route('https://**youtube**/**', route => route.abort());
        await page.goto(new URL('/', info.project.use.baseURL).href);
    await expect(page.locator('#readyKaraokeChoice option[value^="online:"]').first()).toBeAttached({timeout:30_000});
    await page.locator('#readyKaraokeChoice').selectOption('online:I5mHTcJ5GfY');
    await page.locator('#btnTryReadyKaraoke').click();
    await expect(page.locator('#onlineKaraokeIframe')).toBeVisible({timeout:30_000});
    await page.evaluate(async()=>{const {events}=await import('/src/core/EventBus.js');window.__humanFrames=[];events.on('vocalCoach:pitch',p=>window.__humanFrames.push(p.frequency));});
    await page.locator('#btnKaraokeMic').click();
    await expect.poll(()=>page.evaluate(()=>window.__humanFrames.length),{timeout:25_000}).toBeGreaterThan(30);
    const evidence=await page.evaluate(async()=>{const {vocalCoachEngine:e}=await import('/src/audio/VocalCoachEngine.js');const tracks=e.mediaStream.getTracks();return {samples:window.__humanFrames.length,stats:e.sessionStats,reference:e.referenceMode,target:e.targetNote,testing:Boolean(window.__IS_TESTING__),tracks:tracks.map(t=>t.readyState)};});
    expect(evidence.stats.totalSingingFrames).toBe(0);
    expect(evidence.stats.expectedReferenceFrames).toBe(0);
    expect(evidence.reference).toBe(false); expect(evidence.target).toBeNull(); expect(evidence.testing).toBe(false);
    await expect(page.locator('#singerPitchNoteLabel')).toContainText('Afinación libre');
    await page.locator('#btnPlaySingToggle').click();
    expect(await page.evaluate(async()=>{const {vocalCoachEngine:e}=await import('/src/audio/VocalCoachEngine.js');return e.isRunning;})).toBe(false);
    await expect(page.locator('#onlineKaraokeIframe')).toHaveCount(0);
    await info.attach('real-voice-online.json',{body:JSON.stringify(evidence),contentType:'application/json'});
  } finally { await browser.close(); }
});
