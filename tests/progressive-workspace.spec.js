import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openTool, waitForSong } from './helpers/journeys.js';
import fs from 'node:fs/promises';
import path from 'node:path';
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
async function audit(page,name,info) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), name+' overflow').toBe(true);
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  await info.attach(name+'-accessibility.json',{body:JSON.stringify(result.violations,null,2),contentType:'application/json'});
  expect(result.violations,name+' accessibility').toEqual([]);
  await page.screenshot({path:info.outputPath(name+'.png')});
}
for(const width of [375,768,1440])test('essentials and advanced controls across every screen at '+width+'px',async({page},info)=>{
  test.setTimeout(180000);await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await expect(page.locator('.discovery-song-card').first()).toBeVisible({timeout:30000});
  await expect(page.locator('#exploreSearchInput')).toBeVisible();await expect(page.locator('#exploreAdvanced')).not.toHaveAttribute('open','');
  await audit(page,'home',info);
  await page.locator('#exploreAdvanced > summary').focus();await page.locator('#exploreAdvanced > summary').press('Space');await expect(page.locator('#btnModeArtists')).toBeVisible();
  await page.locator('#publicVocalCatalog > summary').click();await page.locator('#publicVocalSearch').fill('Adele');await expect(page.locator('#publicVocalResults')).toContainText('Hello');
  await page.locator('.nav-tab-btn[data-tab="library"]').click();await expect(page.locator('#libSearchInput')).toBeVisible();await audit(page,'library',info);
  await page.locator('.nav-tab-btn[data-tab="tools"]').click();await expect(page.locator('.essential-tools [data-tool]')).toHaveCount(4);await expect(page.locator('#toolsAdvanced')).not.toHaveAttribute('open','');await audit(page,'tools',info);
  await openTool(page,'metronome');await expect(page.locator('#btnToggleMetronome')).toBeVisible();expect(await page.locator('#toolModalHost > div').evaluate(e=>getComputedStyle(e).position)).toBe('static');await audit(page,'metronome',info);
  await page.locator('#toolAdvanced > summary').click();await expect(page.locator('.metro-pill-btn').first()).toBeVisible();await page.locator('#btnCloseToolModal').click();await expect(page.locator('[data-tool="metronome"] [data-preview-action]')).toBeFocused();
  await openTool(page,'dictionary');await page.locator('#selDictRoot').focus();await page.locator('#selDictRoot').selectOption('D');await page.locator('#selDictQuality').focus();await page.locator('#selDictQuality').selectOption('m7');await expect(page.locator('.dict-chord-title-big')).toHaveText('Dm7');await expect(page.locator('#selDictQuality')).toBeFocused();await expect(page.locator('.dict-svg-viewport svg')).toBeVisible();await audit(page,'dictionary',info);await page.locator('#btnCloseToolModal').click();
  await page.locator('.nav-tab-btn[data-tab="settings"]').click();await expect(page.locator('#selSettingsDefaultInst')).toBeVisible();await expect(page.locator('#selSettingsMasterTuning')).toBeHidden();await audit(page,'settings',info);await page.locator('#settingsAdvanced > summary').click();await expect(page.locator('#selSettingsMasterTuning')).toBeVisible();await page.locator('#selSettingsMasterTuning').selectOption('432');await expect(page.locator('#selSettingsMasterTuning')).toHaveValue('432');
  await page.locator('.nav-tab-btn[data-tab="explore"]').click();await page.locator('.discovery-song-card').first().click();await waitForSong(page);await audit(page,'song',info);
  await page.locator('#btnMoreOptions').click();expect(await page.locator('#lyricsToolsBottomSheetOverlay').evaluate(e=>getComputedStyle(e).position)).toBe('static');await page.locator('#songReadingOptions > summary').click();await expect(page.locator('#selCapoQuick')).toBeVisible();await page.locator('#btnCloseToolsSheet').click();await expect(page.locator('#btnMoreOptions')).toBeFocused();
  await page.locator('#btnPlaySingToggle').click();await expect(page.locator('#karaokeSecondaryDrawer')).not.toHaveAttribute('open','');await expect(page.locator('#btnKaraokeMic')).toBeVisible();await expect(page.locator('#btnImportKaraokeBacking')).toBeVisible();await audit(page,'karaoke',info);
  await page.locator('#karaokeSecondaryDrawer > summary').click();await expect(page.locator('#karaokeTolerance')).toBeVisible();await expect(page.locator('#btnImportVocalReference')).toBeVisible();expect(errors).toEqual([]);
});
test('all bundled public references parse with valid timing and retain traceable provenance',async({page},info)=>{
  test.setTimeout(120000);await page.goto('/tests/fixtures/audio-harness.html');
  const result=await page.evaluate(async()=>{
    const {getPublicVocalReferences,loadPublicVocalReference}=await import('/src/data/PublicVocalReferences.js');const {parseVocalReference}=await import('/src/audio/VocalReference.js');const refs=await getPublicVocalReferences();let notes=0;
    for(const ref of refs){const file=await loadPublicVocalReference(ref),parsed=parseVocalReference(await file.text());if(parsed.vocalMelody.length!==ref.noteCount||parsed.referenceInfo.sourceType!=='community_transcription'||!parsed.referenceInfo.sourceUrl)throw Error(ref.title);notes+=parsed.vocalMelody.length;}return {references:refs.length,notes};
  });expect(result.references).toBeGreaterThan(500);expect(result.notes).toBeGreaterThan(100000);await info.attach('public-reference-summary.json',{body:JSON.stringify(result),contentType:'application/json'});
});
test('ready licensed song plays with supplied notes, lyrics, instrumental and recovery',async({page},info)=>{
  test.setTimeout(120000);await page.goto('/');await page.locator('#btnTryReadyKaraoke').click();await expect(page.locator('#pitchLaneCanvas')).toBeVisible({timeout:30000});await expect(page.locator('#karaokeBackingStatus')).toContainText('Shearer');
  await expect.poll(()=>page.evaluate(()=>window.__PITCH_LANE_INSTANCE__?.targetBlocks.length)).toBe(373);await expect.poll(()=>page.evaluate(()=>window.__ACTIVE_LYRICS_VIEW__.backing.ready)).toBe(true);
  const duration=await page.evaluate(()=>window.__ACTIVE_LYRICS_VIEW__.backing.durationMs);expect(duration).toBeGreaterThan(180000);await page.locator('#btnSingPlayPause').click();await expect.poll(()=>page.evaluate(()=>window.__ACTIVE_LYRICS_VIEW__.backing.currentTimeMs),{timeout:30000}).toBeGreaterThan(2100);await expect(page.locator('#karaokeCurrentLine')).not.toHaveText('Introducción instrumental');await page.locator('#btnSingPlayPause').click();
  await page.locator('#karaokeSecondaryDrawer > summary').click();await page.locator('[data-practice-audio="instrumental"]').click();await expect(page.locator('#karaokeBackingStatus')).toContainText('instrumental',{timeout:30000});const instrumentalDuration=await page.evaluate(()=>window.__ACTIVE_LYRICS_VIEW__.backing.durationMs);expect(Math.abs(duration-instrumentalDuration)).toBeLessThan(100);
  await page.reload();await page.locator('[data-resume-snapshot]').click();await expect(page.locator('#pitchLaneCanvas')).toBeVisible();await expect(page.locator('#karaokeBackingStatus')).toContainText('instrumental');await expect.poll(()=>page.evaluate(()=>window.__PITCH_LANE_INSTANCE__?.targetBlocks.length)).toBe(373);await info.attach('ready-song.json',{body:JSON.stringify({duration,instrumentalDuration,notes:373}),contentType:'application/json'});
});
