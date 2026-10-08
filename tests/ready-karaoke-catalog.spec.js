import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const packs=JSON.parse(fs.readFileSync(new URL('../assets/practice/index.json',import.meta.url),'utf8')).packs;
test.use({serviceWorkers:'block'});
for(const pack of packs) for(const kind of Object.keys(pack.files)) test('real package: '+pack.artist+' / '+pack.title+' / '+kind,async({page},info)=>{
 test.setTimeout(60000);
 await page.goto('/tests/fixtures/audio-harness.html');
 const result=await page.evaluate(async({id,instrumental})=>{
  const {loadReadyKaraoke}=await import('/src/data/ReadyKaraokePractice.js');
  const {KaraokeBackingEngine}=await import('/src/audio/KaraokeBackingEngine.js');
  const song=await loadReadyKaraoke({packId:id,instrumental});
  const engine=window.__packageEngine=new KaraokeBackingEngine();
  await engine.loadSong(song);
  const context=new AudioContext({sampleRate:44100});
  try{
   const audio=await context.decodeAudioData(await engine.record.blob.arrayBuffer());
   let sum=0;const signal=audio.getChannelData(0);
   for(let i=0;i<signal.length;i+=7){if(!Number.isFinite(signal[i]))throw Error('Nonfinite recording');sum+=signal[i]*signal[i];}
   const button=document.createElement('button');button.id='playRealPackage';button.textContent='Reproducir';button.onclick=()=>{window.__packageStarted=engine.play();};document.body.append(button);
   return {seconds:audio.duration,channels:audio.numberOfChannels,rms:Math.sqrt(sum/Math.ceil(signal.length/7)),notes:song.vocalMelody.length,noteEnd:Math.max(...song.vocalMelody.map(n=>n.startTime+n.duration)),lyrics:song.lyricCues.length,versionId:song.versionId,mode:engine.mode,ready:engine.ready};
  }finally{await context.close();}
 },{id:pack.id,instrumental:kind==='instrumental'});
 expect(result.ready).toBe(true);expect(result.mode).toBe('local');expect(result.notes).toBe(pack.notes);
 expect(result.seconds).toBeGreaterThan(30);expect(result.channels).toBeGreaterThanOrEqual(1);expect(result.rms).toBeGreaterThan(.0001);
 expect(result.noteEnd).toBeLessThanOrEqual(result.seconds*1000+100);expect(result.lyrics).toBeGreaterThan(5);
 expect(result.versionId).toContain(kind);
 await page.locator('#playRealPackage').click();expect(await page.evaluate(()=>window.__packageStarted)).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__packageEngine.currentTimeMs),{timeout:15000}).toBeGreaterThan(250);
 await page.evaluate(()=>window.__packageEngine.pause());const paused=await page.evaluate(()=>window.__packageEngine.currentTimeMs);
 await page.waitForTimeout(100);expect(Math.abs(await page.evaluate(()=>window.__packageEngine.currentTimeMs)-paused)).toBeLessThan(10);
 const sought=await page.evaluate(()=>{window.__packageEngine.seek(5000);return window.__packageEngine.lyricTimeMs;});expect(sought).toBeCloseTo(5000,0);
 await page.evaluate(()=>window.__packageEngine.destroy());await info.attach('real-package.json',{body:JSON.stringify({id:pack.id,kind,...result}),contentType:'application/json'});
});
