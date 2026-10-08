import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { offlineUniversalLibrary } from '../src/data/catalog/OfflineUniversalLibraryEngine.js';
const records=[...offlineUniversalLibrary.searchIndex.values()];
const batchSize=500;
for(let offset=0;offset<records.length;offset+=batchSize){
 test('catalog songs '+(offset+1)+'–'+Math.min(offset+batchSize,records.length)+': actual lookup, karaoke and parsed practice score',async({page},testInfo)=>{
  test.setTimeout(240000);await page.goto('/tests/fixtures/audio-harness.html');await page.addScriptTag({url:'/assets/vendor/alphatab/1.8.4/alphaTab.min.js'});
  const result=await page.evaluate(async({records,offset})=>{
   const {offlineUniversalLibrary:library}=await import('/src/data/catalog/OfflineUniversalLibraryEngine.js');
   const {KaraokeBackingEngine,buildChordBacking}=await import('/src/audio/KaraokeBackingEngine.js');
   const {buildKaraokeTimeline}=await import('/src/audio/KaraokeTimeline.js');
   const {SmartScoreGenerator}=await import('/src/data/SmartScoreGenerator.js');
   const {ChordProParser}=await import('/src/ui/lyrics/ChordProParser.js');
   const failures=[],rows=[];let parsedScores=0, scenarios=0;
   const assert=(condition,message)=>{if(!condition)throw Error(message);};
   for(const [index,record] of records.entries()){
    const row={index:offset+index,title:record.title,artist:record.artist};
    try{
     const sheet=library.getSongSheet(record.title,record.artist);
     if(!sheet){row.available=false;rows.push(row);scenarios++;continue;}
     assert(sheet.title===record.title&&sheet.artist===record.artist,'Identity changed');
     const song={...sheet,lyricsChords:sheet.chordpro};row.available=true;row.chords=ChordProParser.extractUniqueChords(song.lyricsChords);row.hasOriginalScore=Boolean(song.data);row.hasVocalReference=Boolean(song.vocalMelody?.length);
     for(const transpose of [-2,0,2]){
      const shifted={...song,lyricsChords:song.lyricsChords.replace(/\[([^\]]+)\]/g,(marker,chord)=>row.chords.includes(chord)?'['+ChordProParser.transposeChord(chord,transpose)+']':marker)};
      const timeline=buildKaraokeTimeline(shifted);
      assert(Number.isFinite(timeline.durationMs)&&timeline.durationMs>=0,'Nonfinite duration');assert(timeline.timingIsEstimated===true,'Invented supplied timing');
      assert(timeline.chords.every(c=>Number.isFinite(c.time)&&c.time>=0&&Number.isFinite(c.duration)&&c.duration>0),'Invalid chord timing');
      assert(timeline.lyricLines.every(l=>Number.isFinite(l.startTime)&&Number.isFinite(l.duration)&&l.duration>0),'Invalid lyric timing');
      const backing=buildChordBacking(shifted);assert(backing.every(c=>c.frequencies.every(f=>Number.isFinite(f)&&f>0)),'Invalid backing frequencies');
      const engine=new KaraokeBackingEngine({store:{get:async()=>null,close(){}}});await engine.loadSong(shifted);assert(engine.mode==='local'&&!engine.ready&&!engine.loading,'Song without recording started implicit music');engine.setMode('synth');assert(engine.mode==='synth'&&engine.ready===(engine.timeline.durationMs>0),'Explicit practice guide readiness does not match available timing');assert(!engine.song.vocalMelody?.length,'Invented vocal melody');engine.seek(0);engine.setTempoBpm(60);engine.setTranspose(transpose);assert(Number.isFinite(engine.currentTimeMs),'Invalid clock');engine.destroy();scenarios++;
      // These are explicitly labelled chord practice accompaniments, not original scores.
      if(transpose===0||row.chords.length){const tex=SmartScoreGenerator.generate(shifted);const importer=new alphaTab.importer.AlphaTexImporter();importer.initFromString(tex,new alphaTab.Settings());const score=importer.readScore();assert(score.tracks.length===2&&score.masterBars.length>=1,'Practice score failed to parse');assert(score.subTitle.includes('aproximado'),'Practice provenance missing');assert(score.masterBars.every(b=>b.timeSignatureNumerator===4&&b.timeSignatureDenominator===4),'Wrong meter');for(const track of score.tracks)for(const staff of track.staves)for(const bar of staff.bars)for(const voice of bar.voices)for(const beat of voice.beats)for(const note of beat.notes)assert(Number.isFinite(note.realValue)&&note.realValue>=0&&note.realValue<=127,'Invalid score pitch');parsedScores++;}
     }
    }catch(error){failures.push({...row,error:String(error.message)});}
    rows.push(row);
   }
   return {rows,failures,parsedScores,scenarios};
  },{records:records.slice(offset,offset+batchSize),offset});
  await fs.mkdir(path.resolve('reports/catalog-exhaustive'),{recursive:true});await fs.writeFile(path.resolve('reports/catalog-exhaustive','batch-'+String(offset).padStart(5,'0')+'.json'),JSON.stringify(result,null,2));
  await testInfo.attach('catalog-summary.json',{body:JSON.stringify({rows:result.rows.length,scenarios:result.scenarios,parsedScores:result.parsedScores,failures:result.failures},null,2),contentType:'application/json'});
  expect(result.rows).toHaveLength(Math.min(batchSize,records.length-offset));expect(result.failures).toEqual([]);
 });
}
