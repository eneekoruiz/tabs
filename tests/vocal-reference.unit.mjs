import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVocalReference } from '../src/audio/VocalReference.js';
import { VocalCoachEngine } from '../src/audio/VocalCoachEngine.js';
import { KaraokeBackingEngine } from '../src/audio/KaraokeBackingEngine.js';
const txt = '#TITLE:Test\n#ARTIST:Fixture\n#BPM:120\n#GAP:1000\n: 0 4 -3 One \n: 4 2 0 two\n- 8\nF 12 4 0 Spoken\nE\nignored';
test('UltraStar uses quadrupled beat units, C4 origin, GAP and unscored freestyle', () => {
 const ref = parseVocalReference(txt);
 assert.deepEqual(ref.vocalMelody.map(n => [n.startTime, n.duration, n.midi, n.isInterlude]), [[1000,500,57,false],[1500,250,60,false],[2500,500,60,true]]);
 assert.equal(ref.lyricCues[0].text, 'One two');
 assert.equal(ref.lyricCues[0].duration, 750);
 assert.equal(parseVocalReference(txt.replace('120','120,0')).vocalMelody[0].duration,500);
});
test('reject corrupt references atomically rather than discarding notes or unsupported timing', () => {
 for (const bad of ['{}', '{"units":"seconds","notes":[{"startTime":1,"duration":2,"midi":60}]}', '[null]', '[{"startTime":-1,"duration":2,"midi":60}]', '[{"startTime":1,"duration":0,"midi":60}]', '[{"startTime":0,"duration":2,"midi":60},{"startTime":1,"duration":2,"midi":64}]', txt.replace('#BPM:120','#BPM:0'), txt.replace('#GAP:1000','#RELATIVE:YES'), txt.replace(': 0 4 -3 One ','P2'), txt.replace(': 0 4 -3 One ','B 0 120'), txt.replace(': 0 4 -3 One ',': 0 0 -3 One ')]) assert.throws(() => parseVocalReference(bad), undefined, bad);
});
test('melody score counts missed notes, excludes gaps, and permits another octave', () => {
 const engine = new VocalCoachEngine(); engine.referenceMode = true; engine.setPlaybackActive(true); engine.setTargetNote(60);
 for (let i=0;i<30;i++) engine._handleVocalDetection({frequency:engine.midiToFrequency(72), clarity:1,rms:.1});
 assert.equal(engine.sessionStats.expectedReferenceFrames,30); assert.equal(engine.sessionStats.inTuneReferenceFrames,28);
 for (let i=0;i<30;i++) engine._handleSilence();
 assert.equal(engine.sessionStats.expectedReferenceFrames,60);
 engine.setTargetNote(null);
 for (let i=0;i<30;i++) engine._handleVocalDetection({frequency:440,clarity:1,rms:.1});
 assert.equal(engine.sessionStats.expectedReferenceFrames,60); assert.equal(engine.sessionStats.inTuneReferenceFrames,28);
});
test('reference import persists independently of audio and preserves previous notes on invalid input', async () => {
 let record; const store={get:async()=>record,updateSettings:async(_,p)=>{record={...record,...p}},close(){}};
 const engine=new KaraokeBackingEngine({store}); await engine.loadSong({title:'Test',artist:'Fixture',lyricsChords:'[C]One'});
 assert.equal(await engine.importReference(new Blob([txt])),true); const prior=structuredClone(record);
 assert.equal(await engine.importReference(new Blob(['[null]'])),false); assert.deepEqual(record,prior);
 await engine.removeFile(); assert.deepEqual(record.vocalMelody,prior.vocalMelody);
 const restored=new KaraokeBackingEngine({store}); await restored.loadSong({title:'Test',artist:'Fixture',lyricsChords:'[C]One'});
 assert.deepEqual(restored.song.vocalMelody,prior.vocalMelody); assert.equal(restored.timeline.timingIsEstimated,false);
 engine.destroy(); restored.destroy();
});

// Legacy octave adaptation is opt-in and preserves intervals; it cannot repair malformed timing.
test('legacy octave adaptation preserves intervals and keeps default strict import',()=>{
 const text='#TITLE:Legacy\n#ARTIST:Example\n#BPM:300\n#GAP:2000\n: 0 4 57 one\n: 4 4 59 two\nE';
 assert.throws(()=>parseVocalReference(text),/Nota inválida/);
 const adapted=parseVocalReference(text,{normalizeLegacyOctave:true});
 assert.equal(adapted.referenceInfo.octaveShiftSemitones,-60);
 assert.deepEqual(adapted.vocalMelody.map(n=>n.midi),[57,59]);
 assert.deepEqual(adapted.vocalMelody.map(n=>[n.startTime,n.duration]),[[2000,200],[2200,200]]);
});
