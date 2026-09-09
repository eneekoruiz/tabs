import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ serviceWorkers: 'block' });
test.setTimeout(60000);

async function loadPractice(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('.song-card').first().waitFor();
  await page.evaluate(async () => {
    const { events } = await import('/src/core/EventBus.js');
    events.emit('ui:loadLyricsSong', { id: 'studio-fixture', title: 'Ensayo de sincronización', artist: 'Estudio', tempo: 120,
      lyricsChords: '[Verse]\n[C]Uno dos tres cuatro\n[G]Cinco seis siete ocho\n[C]Fin del ensayo' });
    events.emit('ui:switchTab', 'player');
  });
  await expect(page.locator('.lyrics-chords-container')).toBeVisible();
}

function silentWav(seconds = 12) {
  const dataSize = 8000 * seconds * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF'); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

test('karaoke: real audio clock, LRC import, tempo, seek, pause and persisted recovery', async ({ page }) => {
  await loadPractice(page);
  await page.locator('#btnPlaySingToggle').click();
  await expect(page.locator('#btnImportKaraokeBacking')).toBeEnabled();
  await page.locator('#karaokeBackingFile').setInputFiles({ name: 'ensayo.wav', mimeType: 'audio/wav', buffer: silentWav() });
  await expect(page.locator('#karaokeBackingStatus')).toContainText('ensayo.wav');
  await page.locator('#karaokeLyricsFile').setInputFiles({ name: 'ensayo.lrc', mimeType: 'text/plain', buffer: Buffer.from('[00:01.25]Primera frase\n[00:04.00]Segunda frase\n[00:09.50]Final') });
  await expect(page.locator('#karaokeTimingNote')).toContainText('tiempos aportados');
  await expect(page.locator('#karaokeTimingNote')).toContainText('sin evaluación de la melodía original');
  await page.locator('#karaokeTempo').fill('60');
  await page.locator('#karaokeTempo').press('Tab');
  await page.locator('#karaokeOffset').fill('0.5');
  await page.locator('#karaokeOffset').press('Tab');
  await page.locator('#karaokeSeek').fill('5');
  await expect(page.locator('#karaokeCurrentLine')).toHaveText('Segunda frase');
  await page.locator('#btnSingPlayPause').click();
  await expect.poll(() => page.evaluate(() => window.__ACTIVE_LYRICS_VIEW__.backing.currentTimeMs)).toBeGreaterThan(5100);
  const timing = await page.evaluate(() => {
    const v = window.__ACTIVE_LYRICS_VIEW__;
    return { difference: Math.abs(v.pitchLane.currentTime - v.backing.lyricTimeMs), rate: v.backing.media.audio.playbackRate,
      notes: v.pitchLane.targetBlocks.length, playing: v.backing.playing };
  });
  expect(timing.difference).toBeLessThan(120);
  expect(timing.rate).toBe(0.5); expect(timing.notes).toBe(0); expect(timing.playing).toBe(true);
  await page.locator('#btnSingPlayPause').click();
  const paused = await page.evaluate(() => window.__ACTIVE_LYRICS_VIEW__.backing.currentTimeMs);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__ACTIVE_LYRICS_VIEW__.backing.currentTimeMs)).toBeCloseTo(paused, 0);
  // An unrelated render must not reset the transport or the supplied cues.
  await page.locator('#btnFontIncr').click();
  expect(Math.abs(await page.evaluate(() => window.__PITCH_LANE_INSTANCE__.currentTime) - (paused - 500))).toBeLessThan(34);
  await loadPractice(page);
  await page.locator('#btnPlaySingToggle').click();
  await expect(page.locator('#karaokeBackingStatus')).toContainText('ensayo.wav');
  await expect(page.locator('#karaokeTempo')).toHaveValue('60');
  await expect(page.locator('#karaokeOffset')).toHaveValue('0.5');
  await expect(page.locator('#karaokeTimingNote')).toContainText('tiempos aportados');
  await page.locator('#karaokeSeek').fill('5');
  await page.locator('#btnFinishVocalSession').click();
  await page.locator('#btnScorecardRetry').click();
  expect(await page.evaluate(() => window.__ACTIVE_LYRICS_VIEW__.backing.currentTimeMs)).toBeLessThan(1000);
  await expect.poll(() => page.evaluate(() => window.__ACTIVE_LYRICS_VIEW__.backing.playing)).toBe(true);
});

test('dialogs trap focus, close with Escape and return to their trigger', async ({ page }) => {
  await loadPractice(page);
  await page.locator('#btnSongTopMetronome').click();
  await expect(page.locator('#btnCloseSongMetronome')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#btnSongMetroToggle')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#btnCloseSongMetronome')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#songMetronomeOverlay')).toBeHidden();
  await expect(page.locator('#btnSongTopMetronome')).toBeFocused();
  await page.locator('#btnToggleYouTube').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#youtubeCompanion')).toBeHidden();
  await expect(page.locator('#btnToggleYouTube')).toBeFocused();
});

test('transpose follows synth and supplied melody; exact practice session resumes after reload', async ({ page }) => {
  await loadPractice(page);
  await page.evaluate(async () => {
    const { events } = await import('/src/core/EventBus.js');
    events.emit('ui:loadLyricsSong', { id: 'studio-fixture', versionId: 'acoustic',
      title: 'Ensayo de sincronización', artist: 'Estudio', tempo: 120,
      lyricsChords: '[Verse]\n' + Array(30).fill('[C/E]Versión acústica guardada').join('\n'),
      vocalMelody: [{ startTime: 0, duration: 60000, midi: 60, text: 'Voz' }] });
  });
  await expect(page.locator('.lyrics-word').filter({ hasText: 'acústica' }).first()).toBeVisible();
  await page.locator('#btnPlaySingToggle').click();
  await page.locator('#btnSingPlayPause').click();
  await expect.poll(() => page.evaluate(() => window.__ACTIVE_LYRICS_VIEW__.backing.playing)).toBe(true);
  await page.locator('#btnMoreOptions').click();
  await page.locator('#btnSongTransposeUp').click();
  await page.locator('#btnSongTransposeUp').press('Enter');
  const music = await page.evaluate(() => {
    const v = window.__ACTIVE_LYRICS_VIEW__;
    return { transpose: v.backing.transposeSemitones, playing: v.backing.playing,
      midi: v.pitchLane.targetBlocks[0].midi, frequencies: [...v.backing.voices].map(o => o.frequency.value / o.baseFrequency) };
  });
  expect(music.transpose).toBe(2);
  expect(music.playing).toBe(true);
  expect(music.midi).toBe(62);
  expect(music.frequencies.length).toBeGreaterThan(0);
  for (const ratio of music.frequencies) expect(ratio).toBeCloseTo(2 ** (2 / 12), 2);
  await page.keyboard.press('Escape');
  await expect(page.locator('#lyricsToolsBottomSheetOverlay')).toBeHidden();
  await page.evaluate(() => {
    const v = window.__ACTIVE_LYRICS_VIEW__;
    v.setCapo(2); v.pauseSinging(); v.savePracticeSession();
  });
  expect(await page.evaluate(() => window.__ACTIVE_LYRICS_VIEW__.pitchLane.targetBlocks[0].midi)).toBe(62);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-resume-snapshot="true"]').click();
  await expect(page.locator('.lyrics-word').filter({ hasText: 'acústica' }).first()).toBeVisible();
  await page.locator('#btnPlaySingToggle').click();
  await expect.poll(() => page.evaluate(() => window.__ACTIVE_LYRICS_VIEW__.backing.ready)).toBe(true);
  const recovered = await page.evaluate(() => {
    const v = window.__ACTIVE_LYRICS_VIEW__;
    return { transpose: v.transposeSemitones, capo: v.capoFret, midi: v.pitchLane.targetBlocks[0].midi,
      version: v.currentSong.versionId, playing: v.backing.playing };
  });
  expect(recovered).toEqual({ transpose: 2, capo: 2, midi: 62, version: 'acoustic', playing: false });
  // A local recording and its vocal reference stay at original pitch.
  await page.locator('#karaokeBackingFile').setInputFiles({ name: 'original.wav', mimeType: 'audio/wav', buffer: silentWav() });
  await expect(page.locator('#karaokeSourceNote')).toContainText('no se transponen');
  expect(await page.evaluate(() => window.__ACTIVE_LYRICS_VIEW__.pitchLane.targetBlocks[0].midi)).toBe(60);
  await page.locator('[name="karaokeSource"][value="synth"]').check();
  expect(await page.evaluate(() => window.__ACTIVE_LYRICS_VIEW__.pitchLane.targetBlocks[0].midi)).toBe(62);
});

for (const width of [375, 834, 1440]) {
  test(`studio layout ${width}px: no clipped controls and readable themes`, async ({ page }, testInfo) => {
    // Multiple contrast audits, screenshots and theme changes need their own budget.
    testInfo.setTimeout(120000);
    await page.setViewportSize({ width, height: 960 });
    await loadPractice(page);
    const bounds = await page.locator('.lyrics-header-tools-group').evaluate(element => [...element.querySelectorAll('button, select')]
      .filter(node => node.getClientRects().length).map(node => ({ id: node.id, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right })));
    for (const control of bounds) {
      expect(control.left, control.id).toBeGreaterThanOrEqual(0);
      expect(control.right, control.id).toBeLessThanOrEqual(width);
    }
    await page.screenshot({ path: testInfo.outputPath('player.png') });
    await page.locator('#btnPlaySingToggle').click();
    await expect(page.locator('#karaokeTimingNote')).toContainText('avance estimado');
    const transportBounds = await page.locator('.sing-floating-hud').boundingBox();
    expect(transportBounds.x).toBeGreaterThanOrEqual(0);
    expect(transportBounds.x + transportBounds.width).toBeLessThanOrEqual(width);
    const audit = await new AxeBuilder({ page }).include('#karaokeAudioCompanion').include('.sing-floating-hud').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('karaoke.png') });
    await page.locator('#btnMoreOptions').click();
    await expect(page.locator('#btnCloseToolsSheet')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#btnToggleHideChords')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#btnCloseToolsSheet')).toBeFocused();
    const optionsAudit = await new AxeBuilder({ page }).include('#lyricsToolsBottomSheetOverlay').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(optionsAudit.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('options.png') });
    await page.keyboard.press('Escape');
    await expect(page.locator('#btnMoreOptions')).toBeFocused();
    if (width === 1440) {
      for (const theme of ['theme-charcoal', 'theme-amber']) {
        await page.evaluate(theme => { document.body.className = theme; }, theme);
        await page.waitForTimeout(250);
        const darkAudit = await new AxeBuilder({ page }).include('#karaokeAudioCompanion').include('.sing-floating-hud').withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(darkAudit.violations, theme).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath(`${theme}.png`) });
      }
    }
  });
}

test('tool catalogue has accessible buttons and keyboard-operated dialogs', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('.song-card').first().waitFor();
  await page.locator('.nav-tab-btn[data-tab="tools"]').click();
  const audit = await new AxeBuilder({ page }).include('.tools-view-wrapper').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(audit.violations).toEqual([]);
  const open = page.locator('[data-tool="metronome"] button');
  await open.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#toolModalOverlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#toolModalOverlay')).toHaveCount(0);
  await expect(open).toBeFocused();
});
