import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const alphaTab = createRequire(import.meta.url)('@coderline/alphatab');
const parseScore = tex => {
  const importer = new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(tex, new alphaTab.Settings());
  try { return importer.readScore(); } catch (error) {
    throw new Error(JSON.stringify({ parser: error.parserDiagnostics?.items, semantic: error.semanticDiagnostics?.items }));
  }
};
import { AudioTranscriptionEngine } from '../src/audio/AudioTranscriptionEngine.js';

const roots = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const tuning = [0,64,59,55,50,45,40];

test('transcriber scores preserve all 36 detectable chord pitch classes', () => {
  const engine = new AudioTranscriptionEngine();
  for (let root = 0; root < 12; root++) {
    for (const [suffix, intervals] of [['',[0,4,7]],['m',[0,3,7]],['7',[0,4,7,10]]]) {
      const chord = roots[root] + suffix;
      const tex = engine._generateAlphaTex([{chord}]);
      const notes = [...tex.matchAll(/(\d+)\.(\d+)/g)].map(m => (Number(m[1]) + tuning[Number(m[2])]) % 12);
      assert.ok(notes.length >= 3, chord + ' missing voicing');
      const expected = [...new Set(intervals.map(n => (root + n) % 12))].sort((a,b)=>a-b);
      const actual = [...new Set(notes)].sort((a,b)=>a-b);
      assert.ok(actual.every(note => expected.includes(note)), chord + ' added a foreign note');
      // Guitar sevenths may omit the fifth; root, third and seventh define the chord.
      const required = suffix === '7' ? [0,4,10] : intervals;
      for (const interval of required) assert.ok(actual.includes((root + interval) % 12), chord + ' missing defining interval');
      assert.match(tex, /Acompañamiento aproximado/);
      const score = parseScore(tex);
      assert.equal(score.tracks.length, 1);
      const beats = score.tracks[0].staves[0].bars[0].voices[0].beats;
      assert.deepEqual([...new Set(beats.flatMap(beat => beat.notes.map(note => note.realValue % 12)))].sort((a,b)=>a-b), actual);
      assert.equal(beats.reduce((duration, beat) => duration + 1 / beat.duration, 0), 1);
    }
  }
});

test('unsupported transcription chord remains a rest', () => {
  const engine = new AudioTranscriptionEngine();
  const tex = engine._generateAlphaTex([{chord:'H7'}]);
  assert.match(tex, /:1 r/);
  assert.equal(parseScore(tex).tracks[0].staves[0].bars[0].voices[0].beats[0].notes.length, 0);
  assert.equal(engine._generateChordPro([{chord:'C'}]).split('\n')[0], '{title: Transcripción Automática}');
  assert.equal(typeof engine._createFallbackBuffer, 'undefined');
});
