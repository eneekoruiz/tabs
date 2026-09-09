import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKaraokeTimeline, parseLrc } from '../src/audio/KaraokeTimeline.js';
import { KaraokeBackingEngine, buildChordBacking } from '../src/audio/KaraokeBackingEngine.js';
import { SongMetronomeCompanion } from '../src/ui/lyrics/SongMetronomeCompanion.js';
import { ChordProParser } from '../src/ui/lyrics/ChordProParser.js';
import { SessionRecovery } from '../src/data/SessionRecovery.js';

const song = () => ({ title: 'Timing fixture', artist: 'Test', tempo: 120, lyricsChords: '[Verse]\n[C]One two three four\n[G]Five six seven eight' });
const memoryStore = () => {
  let record;
  return { get: async () => record, put: async (_, value) => { record = structuredClone(value); },
    updateSettings: async (_, value) => { record = { ...record, ...structuredClone(value) }; }, close() {} };
};
const stubContext = () => {
  const starts = [];
  const param = { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
  return { currentTime: 0, state: 'running', starts, resume: async () => {}, close: async () => {},
    createOscillator: () => ({ frequency: { value: 0, setTargetAtTime(value) { this.value = value; } }, connect() {}, disconnect() {}, stop() {}, start(time) { starts.push(time); } }),
    createGain: () => ({ gain: { ...param }, connect() {}, disconnect() {} }) };
};

test('section labels add no time; chord-only intros and 3/4 bars do', () => {
  const timeline = buildKaraokeTimeline(song());
  assert.deepEqual(timeline.lyricLines.map(l => l.startTime), [0, 2000]);
  assert.deepEqual(timeline.chords.map(c => c.time), [0, 2000]);
  assert.equal(timeline.durationMs, 4000);
  const waltz = buildKaraokeTimeline({ tempo: 120, timeSignature: '3/4', lyricsChords: '[Intro]\n[C]\n[G]One two three' });
  assert.equal(waltz.lyricLines[0].startTime, 1500);
  assert.equal(waltz.durationMs, 3000);
});

test('untimed lyrics never invent harmony or claim supplied timings', () => {
  const timeline = buildKaraokeTimeline({ tempo: 120, lyrics: 'One two three four' });
  assert.equal(timeline.chords.length, 0);
  assert.equal(timeline.durationMs, 2000);
  assert.equal(timeline.timingIsEstimated, true);
  assert.equal(buildChordBacking({ lyrics: 'No chord annotations' }).length, 0);
});

test('slash bass, extensions, capo and Latin spelling remain musically consistent', () => {
  assert.equal(ChordProParser.transposeChord('C/E', 2), 'D/F#');
  assert.equal(ChordProParser.transposeChord('C/E', 2, 2), 'C/E');
  assert.equal(ChordProParser.transposeChord('Bbmaj7/F', -2), 'Abmaj7/D#');
  assert.equal(ChordProParser.formatChordDisplay('D/F#', 'latin'), 'Re/Fa#');
  assert.equal(ChordProParser.formatChordDisplay('Abmaj7/D#', 'latin', 'flats'), 'Labmaj7/Mib');
  assert.equal(ChordProParser.transposeChord('C/E', NaN), 'C/E');
  assert.deepEqual(ChordProParser.extractUniqueChords('[Cadd9]Uno [Daug/F#]dos'), ['Cadd9', 'Daug/F#']);
  const chord = buildChordBacking({ ...song(), lyricsChords: '[C/E]One' })[0];
  assert.equal(chord.chord, 'C/E');
  assert.ok(chord.frequencies[0] < Math.min(...chord.frequencies.slice(1)));
  assert.equal(chord.frequencies[0], 329.63 / 2);
});

test('imported lyric text and section headers are escaped, not interpreted as HTML', () => {
  const html = ChordProParser.parseToHtml('[<img/src=x/onerror=alert(1)>]\n[Cadd9]<svg/onload=alert(1)> & texto');
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<svg'));
  assert.ok(html.includes('&lt;svg/onload=alert(1)&gt;'));
  assert.ok(html.includes('data-chord="Cadd9"'));
});

test('transpose retunes synth voices without moving the clock, but never shifts imported audio', async () => {
  const engine = new KaraokeBackingEngine({ store: memoryStore() });
  await engine.loadSong(song());
  engine.context = stubContext(); engine.master = engine.context.createGain();
  await engine.play();
  const voice = [...engine.voices][0];
  const baseFrequency = voice.frequency.value;
  engine.context.currentTime = 0.75;
  engine.setTranspose(12);
  assert.equal(engine.currentTimeMs, 750);
  assert.equal(engine.playing, true);
  assert.equal(voice.frequency.value, baseFrequency * 2);
  engine.context.currentTime = 0.9; engine.schedule();
  assert.ok([...engine.voices].every(v => v.frequency.value === v.baseFrequency * 2));
  engine.pause(); engine.mode = 'local';
  engine.setTranspose(-12);
  assert.equal(engine.effectiveTranspose, 0);
  assert.equal(engine.playbackRate, 1);
  engine.setTranspose(99);
  assert.equal(engine.transposeSemitones, 12);
  engine.destroy();
});

test('session recovery preserves exact arrangement, supplied cues, melody and binary score', () => {
  const storage = new Map();
  const recovery = new SessionRecovery({ getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) });
  const current = { ...song(), versionId: 'acoustic', data: new Uint8Array([1, 2, 255]),
    lyricCues: [{ startTime: 1000, duration: 2000, text: 'One' }],
    vocalMelody: [null, { startTime: 1000, duration: 500, midi: 60, text: 'One' }, { startTime: -1, midi: 200 }] };
  assert.equal(recovery.flush({ song: current, transposeSemitones: 2, capoFret: 1 }), true);
  const restored = recovery.read();
  assert.equal(restored.song.versionId, 'acoustic');
  assert.equal(restored.song.lyricsChords, current.lyricsChords);
  assert.deepEqual(restored.song.data, current.data);
  assert.deepEqual(restored.song.lyricCues, current.lyricCues);
  assert.equal(restored.song.vocalMelody.length, 1);
  assert.equal(restored.transposeSemitones, 2);
  assert.equal(new SessionRecovery(null).flush({ song: current }), false);
});

test('LRC preserves decimal precision, repeated timestamps, gaps and literal text', () => {
  const cues = parseLrc('[ar:Fixture]\n[00:01.25][00:08.005]One & two\n[00:04.500]\n[00:10.00]End', 12000);
  assert.deepEqual(cues.map(c => c.startTime), [1250, 4500, 8005, 10000]);
  assert.equal(cues[0].duration, 3250);
  assert.equal(cues[1].text, '');
  assert.equal(cues.at(-1).duration, 2000);
  assert.throws(() => parseLrc('plain untimed text'), /LRC/);
  const timeline = buildKaraokeTimeline({ ...song(), lyricCues: cues });
  assert.equal(timeline.timingIsEstimated, false);
  assert.deepEqual(timeline.lyricLines, cues);
});

test('synth transport keeps musical position across tempo changes, pause and seek', async () => {
  const engine = new KaraokeBackingEngine({ store: memoryStore() });
  await engine.loadSong(song());
  engine.context = stubContext(); engine.master = engine.context.createGain();
  await engine.play();
  engine.context.currentTime = 0.75;
  assert.equal(engine.currentTimeMs, 750);
  engine.setTempoBpm(60);
  await Promise.resolve();
  assert.equal(engine.currentTimeMs, 750);
  engine.context.currentTime = 1.75;
  assert.equal(engine.lyricTimeMs, 1250);
  engine.pause();
  engine.context.currentTime = 10;
  assert.equal(engine.currentTimeMs, 1250);
  engine.seek(2500);
  await engine.play();
  engine.context.currentTime = 11;
  assert.equal(engine.currentTimeMs, 3000);
  engine.seek(engine.durationMs);
  engine.pause();
  await engine.play();
  assert.equal(engine.currentTimeMs, 0);
  engine.destroy();
});

test('backing beat scheduling follows tempo, without a burst of missed beats', async () => {
  const engine = new KaraokeBackingEngine({ store: memoryStore() });
  await engine.loadSong({ ...song(), lyricsChords: Array(20).fill('[C]One two three four').join('\n') });
  engine.context = stubContext(); engine.master = engine.context.createGain();
  engine.setTempoBpm(60);
  await engine.play();
  engine.context.starts.length = 0;
  engine.context.currentTime = 0.9;
  engine.schedule();
  assert.ok(engine.context.starts.some(t => Math.abs(t - 1) < 0.001));
  engine.context.starts.length = 0;
  engine.context.currentTime = 12;
  engine.schedule();
  assert.ok(engine.context.starts.length <= 4, 'resume must not replay accumulated beats');
  engine.destroy();
});

test('local playback uses audio time at every speed and preserves lyric offset', async () => {
  const engine = new KaraokeBackingEngine({ store: memoryStore() });
  await engine.loadSong(song());
  const audio = { currentTime: 3, duration: 10, volume: 1, pause() {}, play: async () => {}, removeAttribute() {}, load() {} };
  engine.media = { audio, url: 'blob:test' }; engine.mode = 'local'; engine.attachMedia();
  engine.setOffsetMs(1000);
  engine.setTempoBpm(60);
  assert.equal(audio.playbackRate, 0.5);
  assert.equal(audio.preservesPitch, true);
  assert.equal(engine.lyricTimeMs, 2000);
  engine.seek(5000);
  assert.equal(audio.currentTime, 5);
  assert.equal(engine.lyricTimeMs, 4000);
  engine.destroy();
});

test('duplicate song loads share one pending retrieval', async () => {
  let finish;
  let reads = 0;
  const engine = new KaraokeBackingEngine({ store: { get: () => { reads++; return new Promise(resolve => { finish = resolve; }); }, close() {} } });
  const current = song();
  const first = engine.loadSong(current), second = engine.loadSong(current);
  assert.equal(first, second);
  assert.equal(reads, 1);
  finish(undefined); await second;
  assert.equal(engine.ready, true);
  engine.destroy();
});

test('saved tempo, mute and LRC survive reload and removal of audio', async () => {
  const store = memoryStore();
  const engine = new KaraokeBackingEngine({ store });
  await engine.loadSong(song());
  engine.setTempoBpm(80); engine.setVolume(0); await engine.saveSettings();
  assert.equal(await engine.importLyrics(new Blob(['[00:01.00]One\n[00:03.00]Two'])), true);
  await engine.removeFile();
  const restored = new KaraokeBackingEngine({ store });
  await restored.loadSong(song());
  assert.equal(restored.tempoBpm, 80);
  assert.equal(restored.volume, 0);
  assert.equal(restored.song.lyricCues[0].startTime, 1000);
  engine.destroy(); restored.destroy();
});

test('count-in completes after the full final beat, never at its beginning', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let completed = 0;
  const metronome = new SongMetronomeCompanion({ onCountInComplete: () => completed++ });
  metronome.getAudioContext = () => ({ currentTime: 0 });
  metronome.isRunning = metronome.isCountIn = true;
  metronome.volume = 0;
  metronome.countInTotalBeats = metronome.countInRemainingBeats = 4;
  for (let beat = 0; beat < 4; beat++) { metronome.currentSubBeat = beat; metronome.scheduleNote(beat * 0.5); }
  context.mock.timers.tick(1500);
  assert.equal(completed, 0);
  context.mock.timers.tick(500);
  assert.equal(completed, 1);
  metronome.destroy();
});

test('stopping cancels pending beats before a new metronome run', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let beats = 0;
  const metronome = new SongMetronomeCompanion({ onBeat: () => beats++ });
  metronome.getAudioContext = () => ({ currentTime: 0 });
  metronome.isRunning = true; metronome.volume = 0;
  metronome.scheduleNote(0.5);
  metronome.stop(); metronome.isRunning = true;
  context.mock.timers.tick(1000);
  assert.equal(beats, 0);
  metronome.destroy();
});

test('6/8 count-in shares quarter-note BPM convention and preserves mute', () => {
  const metronome = new SongMetronomeCompanion({ song: { ...song(), timeSignature: '6/8' },
    storage: { getItem: () => JSON.stringify({ volume: 0 }) } });
  assert.equal(metronome.getBeatsPerMeasure() * metronome.getBeatSeconds(), 1.5);
  assert.equal(metronome.volume, 0);
  metronome.destroy();
});
