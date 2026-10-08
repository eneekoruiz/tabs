import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { seekKaraoke } from './helpers/journeys.js';
const fixtures = path.resolve('tests/fixtures/real-audio');
test('recorded human song agrees with independent annotated F0 at three signal levels', async ({page}, testInfo) => {
 test.setTimeout(90000); await page.goto('/tests/fixtures/audio-harness.html');
 const results=await page.evaluate(async()=>{
  const {VocalCoachEngine}=await import('/src/audio/VocalCoachEngine.js');
  const {decodePcmWav,parseF0Csv,evaluateRecordedPitch}=await import('/tests/helpers/AudioCorpus.js');
  const bytes=new Uint8Array(await (await fetch('/tests/fixtures/real-audio/vocadito_1.wav')).arrayBuffer());
  const signal=decodePcmWav(bytes), reference=parseF0Csv(await (await fetch('/tests/fixtures/real-audio/vocadito_1_f0.csv')).text());
  return [0.5,1,2].map(gain=>{const scaled={...signal,samples:Float32Array.from(signal.samples,v=>v*gain)}; const result=evaluateRecordedPitch(new VocalCoachEngine(),scaled,reference); delete result.framesData; return {gain,...result};});
 });
 await testInfo.attach('annotated-recorded-human-pitch.json',{body:JSON.stringify(results,null,2),contentType:'application/json'});
 for(const r of results){expect(r.referenceVoicedFrames).toBeGreaterThan(2000);expect(r.precisionWithin50Cents).toBeGreaterThan(.98);expect(r.medianAbsoluteCents).toBeLessThan(5);expect(r.falseVoicedFrames/r.unvoicedFrames).toBeLessThan(.01);expect(r.within50Cents).toBeGreaterThan(r.gain===.5?.80:.90);}
});
test('20 sustained human recordings survive actual WebAudio decoding and detector boundaries',async({page},testInfo)=>{
 test.setTimeout(90000); await page.goto('/tests/fixtures/audio-harness.html');
 const names=(await fs.readdir(fixtures)).filter(n=>n.startsWith('martin-')&&n.endsWith('.wav'));
 const results=await page.evaluate(async(names)=>{
  const {VocalCoachEngine}=await import('/src/audio/VocalCoachEngine.js'); const engine=new VocalCoachEngine(); const ctx=new AudioContext(); const rows=[];
  for(const name of names){ const bytes=await (await fetch('/tests/fixtures/real-audio/'+encodeURIComponent(name))).arrayBuffer(); const audio=await ctx.decodeAudioData(bytes); let accepted=0;
   for(let offset=0;offset+2048<=audio.length;offset+=441){const d=engine.detectVocalPitch(audio.getChannelData(0).subarray(offset,offset+2048),audio.sampleRate);if(d&&d.clarity>.88){if(!Number.isFinite(d.frequency)||d.frequency<80||d.frequency>1100)throw Error(name); accepted++;}}
   rows.push({name,seconds:audio.duration,accepted});
  } await ctx.close(); return rows;
 },names);
 expect(results).toHaveLength(20); expect(results.every(r=>r.seconds>.5)).toBe(true); expect(results.filter(r=>r.accepted>10).length).toBeGreaterThanOrEqual(17);
 // File names specify intended notes, not independent F0 truth; no accuracy claim from them.
 await testInfo.attach('human-sustained-notes.json',{body:JSON.stringify(results,null,2),contentType:'application/json'});
});
test('real recorded singing passes Chromium media capture and releases the microphone',async({},testInfo)=>{
 test.setTimeout(60000); const browser=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+path.join(fixtures,'vocadito_1.wav')+'%noloop']});
 try {const context=await browser.newContext({permissions:['microphone']});const page=await context.newPage(); await page.goto(new URL('/tests/fixtures/audio-harness.html',testInfo.project.use.baseURL).href);
  const started=await page.evaluate(async()=>{const {vocalCoachEngine:e}=await import('/src/audio/VocalCoachEngine.js');const {events}=await import('/src/core/EventBus.js');window.__recordedCapture=[];window.__captureEngine=e;events.on('vocalCoach:pitch',p=>window.__recordedCapture.push({midi:p.midi,frequency:p.frequency}));e.setPlaybackActive(true);return e.start();});expect(started).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__recordedCapture.length),{timeout:20000}).toBeGreaterThan(30);
  await expect.poll(()=>page.evaluate(()=>new Set(window.__recordedCapture.map(p=>p.midi)).size),{timeout:15000}).toBeGreaterThan(2);
  const result=await page.evaluate(async()=>{const e=window.__captureEngine,tracks=e.mediaStream.getTracks(),ctx=e.audioContext;e.stop();await new Promise(r=>setTimeout(r,50));return {testingFlag:Boolean(window.__IS_TESTING__),samples:window.__recordedCapture,trackStates:tracks.map(t=>t.readyState),context:ctx.state,running:e.isRunning};});
  expect(result.testingFlag).toBe(false); expect(result.trackStates).toEqual(['ended']);expect(result.context).toBe('closed');expect(result.running).toBe(false);
  await testInfo.attach('recorded-media-capture.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
 } finally{await browser.close();}
});
for(const width of [375,768,1440])test('real song import, timed melody, seek, pause and reload at '+width+'px',async({page},testInfo)=>{
 test.setTimeout(120000);await page.setViewportSize({width,height:900});await page.goto('/');await expect(page.locator('.discovery-song-card').first()).toBeVisible({timeout:30000});await page.locator('.discovery-song-card').first().click();await expect(page.locator('#btnPlaySingToggle')).toBeVisible({timeout:30000});await page.locator('#btnPlaySingToggle').click();await expect(page.locator('#pitchLaneCanvas')).toBeVisible();
 await page.locator('#karaokeBackingFile').setInputFiles(path.join(fixtures,'Karissa_Hobbs_-_Lets_Go_Fishin.ogg'));await expect(page.locator('#karaokeBackingStatus')).toContainText('Karissa',{timeout:30000});
 const reference={units:'milliseconds',notes:[{startTime:1000,duration:1000,midi:60,text:'Controlled target'}]};
 await page.locator('#vocalReferenceFile').setInputFiles({name:'controlled-reference.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(reference))});
 await expect.poll(()=>page.evaluate(()=>window.__PITCH_LANE_INSTANCE__?.targetBlocks.length)).toBe(1);
 await seekKaraoke(page,3);await page.locator('#btnSingPlayPause').click();await expect.poll(()=>page.evaluate(()=>window.__ACTIVE_LYRICS_VIEW__.backing.currentTimeMs),{timeout:15000}).toBeGreaterThan(3100);
 await page.locator('#btnSingPlayPause').click();const paused=await page.evaluate(()=>window.__ACTIVE_LYRICS_VIEW__.backing.currentTimeMs);await page.waitForTimeout(300);expect(Math.abs(await page.evaluate(()=>window.__ACTIVE_LYRICS_VIEW__.backing.currentTimeMs)-paused)).toBeLessThan(20);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.reload();await page.locator('[data-resume-snapshot]').click();await expect(page.locator('#pitchLaneCanvas')).toBeVisible({timeout:30000});await expect(page.locator('#karaokeBackingStatus')).toContainText('Karissa',{timeout:30000});await expect.poll(()=>page.evaluate(()=>window.__PITCH_LANE_INSTANCE__?.targetBlocks.length)).toBe(1);
 // This JSON target checks reference transport/persistence, not this recording's original melody.
 await testInfo.attach('song-transport.json',{body:JSON.stringify({width,paused}),contentType:'application/json'});
});

test('real vocal and guitar audio produces finite filter bands, WAV export and a transport that stops at the end',async({page},info)=>{
 test.setTimeout(90000);await page.goto('/tests/fixtures/audio-harness.html');
 const result=await page.evaluate(async()=>{
  const {StemSeparatorEngine}=await import('/src/audio/StemSeparatorEngine.js');
  const engine=new StemSeparatorEngine();const response=await fetch('/tests/fixtures/real-audio/Karissa_Hobbs_-_Lets_Go_Fishin.ogg');
  if(!response.ok)throw Error('Missing real song');
  const bands=await engine.separateStems(await response.arrayBuffer());const rows=Object.entries(bands).map(([name,buffer])=>{
   let sum=0;const samples=buffer.getChannelData(0);for(const x of samples){if(!Number.isFinite(x))throw Error(name+' nonfinite');sum+=x*x;}
   return {name,seconds:buffer.duration,channels:buffer.numberOfChannels,rms:Math.sqrt(sum/samples.length)};
  });
  engine.setStemSolo('bass',true);const exported=engine.exportToWav('mix');const wav=await engine.audioContext.decodeAudioData(await exported.arrayBuffer());
  engine.play(engine.duration-.15);await new Promise(r=>setTimeout(r,600));
  const ended={playing:engine.isPlaying,frame:engine.animationFrameId,sources:Object.keys(engine.sourceNodes).length};
  engine.play(0);engine.stopPlayback();const stopped=engine.isPlaying;await engine.audioContext.close();
  return {rows,exportBytes:exported.size,exportSeconds:wav.duration,ended,stopped};
 });
 expect(result.rows).toHaveLength(4);for(const row of result.rows){expect(row.seconds).toBeGreaterThan(130);expect(row.channels).toBe(2);expect(row.rms).toBeGreaterThan(.0001);}
 expect(result.exportBytes).toBeGreaterThan(1000000);expect(Math.abs(result.exportSeconds-result.rows[0].seconds)).toBeLessThan(.001);
 expect(result.ended).toEqual({playing:false,frame:null,sources:0});expect(result.stopped).toBe(false);
 await info.attach('real-song-filter-transport.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
});
