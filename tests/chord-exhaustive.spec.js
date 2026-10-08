import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { chordEngine } from '../src/tools/ChordEngine.js';
import { ChordSvgRenderer } from '../src/tools/chord/ChordSvgRenderer.js';
import { ChordAudioSynthesizer } from '../src/tools/chord/ChordAudioSynthesizer.js';
import { GUITAR_CHORDS, UKULELE_CHORDS, PIANO_VOICINGS, ALTERNATE_GUITAR_VOICINGS, ALTERNATE_UKULELE_VOICINGS } from '../src/tools/chord/ChordDefinitions.js';
import { SmartScoreGenerator } from '../src/data/SmartScoreGenerator.js';
import { MEGA_CATALOG } from '../src/data/CatalogDataset.js';
import { UNIVERSAL_SONG_DATABASE } from '../src/data/lyrics/UniversalSongDatabase.js';
import { getKnownSongLyrics } from '../src/data/lyrics/KnownSongLyrics.js';
import { offlineUniversalLibrary } from '../src/data/catalog/OfflineUniversalLibraryEngine.js';

test.setTimeout(120000);
test.use({ serviceWorkers: 'block' });

// Independent oracle: no production parser, interval table, tuning, or validator is imported.
// Sources: https://viva.pressbooks.pub/openmusictheory/chapter/chord-symbols/
// https://www.fender.com/articles/setup/standard-tuning-how-eadgbe-came-to-be
// https://www.fender.com/articles/setup/how-to-tune-a-ukulele
const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pitchClass = note => ((natural[note[0]] + (note[1] === '#' ? 1 : note[1] === 'b' ? -1 : 0)) % 12 + 12) % 12;
const intervals = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], add9: [0, 4, 7, 2],
  '5': [0, 7], dim: [0, 3, 6], dim7: [0, 3, 6, 9], aug: [0, 4, 8], '+': [0, 4, 8],
  m7b5: [0, 3, 6, 10], '7#9': [0, 4, 7, 10, 3], '7b9': [0, 4, 7, 10, 1], '9': [0, 4, 7, 10, 2], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9],
  'm(maj7)': [0, 3, 7, 11], mmaj7: [0, 3, 7, 11], m9: [0, 3, 7, 10, 2], m11: [0, 3, 7, 10, 2, 5]
};
const tuning = { guitar: [40, 45, 50, 55, 59, 64], ukulele: [67, 60, 64, 69] };
const instruments = ['guitar', 'ukulele', 'piano'];
const chordToken = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;
const oracle = name => {
  const match = chordToken.exec(name);
  if (!match || !intervals[match[2]]) throw new Error('Unsupported oracle fixture: ' + name);
  const root = pitchClass(match[1]);
  const quality = intervals[match[2]];
  return { root, suffix: match[2] === '+' ? 'aug' : match[2] === 'm(maj7)' ? 'mmaj7' : match[2], bass: match[3] ? pitchClass(match[3]) : null,
    allowed: quality.map(interval => (root + interval) % 12),
    required: quality.filter(interval => !(interval === 7 && quality.length > 3)
      && !(match[2] === 'm11' && interval === 2)).map(interval => (root + interval) % 12) };
};
const midiFor = (shape, instrument) => instrument === 'piano'
  ? shape.map(note => 12 * (note.oct + 1) + pitchClass(note.key))
  : shape.frets.flatMap((fret, index) => fret < 0 ? [] : [tuning[instrument][index] + fret]);
const assertNotes = (name, shape, instrument, context = '') => {
  const spec = oracle(name);
  const midi = midiFor(shape, instrument);
  const actual = midi.map(note => note % 12);
  const allowed = [...spec.allowed, ...(spec.bass === null ? [] : [spec.bass])];
  expect(midi.length, `${context} ${name} ${instrument}: sounding notes`).toBeGreaterThan(0);
  expect(actual.filter(pc => !allowed.includes(pc)), `${context} ${name} ${instrument}: foreign notes`).toEqual([]);
  let required = spec.required;
  if (shape.omittedRoot) {
    expect(instrument).toBe('ukulele');
    expect(['7', '9', '7#9', 'm9']).toContain(spec.suffix);
    required = required.filter(pc => pc !== spec.root);
  }
  expect(required.filter(pc => !actual.includes(pc)), `${context} ${name} ${instrument}: missing defining intervals`).toEqual([]);
  if (spec.bass !== null) expect(Math.min(...midi) % 12, `${context} ${name}: slash bass`).toBe(spec.bass);
  if (instrument !== 'piano') {
    expect(shape.frets).toHaveLength(tuning[instrument].length);
    for (const fret of shape.frets) {
      expect(Number.isInteger(fret)).toBe(true);
      expect(fret).toBeGreaterThanOrEqual(-1);
      expect(fret).toBeLessThanOrEqual(instrument === 'ukulele' ? 19 : 24);
      if (fret > 0) {
        expect(fret - shape.baseFret + 1, `${context} ${name}: hidden fret`).toBeGreaterThanOrEqual(1);
        expect(fret - shape.baseFret + 1, `${context} ${name}: hidden fret`).toBeLessThanOrEqual(5);
      }
    }
    const held = shape.frets.filter(fret => fret > 0);
    if (held.length) expect(Math.max(...held) - Math.min(...held), `${context} ${name}: fret reach`).toBeLessThanOrEqual(4);
  }
  return midi;
};
const musicalToken = /^[A-G][#b]?(?:(?:maj|min|dim|aug|sus|add|m|M|[#b]?\d|\+|\(|\)|°)*)(?:\/[A-G][#b]?)?$/;
const extract = text => [...String(text || '').matchAll(/\[([^\]\r\n]+)\]/g)]
  .map(match => match[1]).filter(name => musicalToken.test(name));
const allSymbols = new Set([...MEGA_CATALOG, ...Object.values(UNIVERSAL_SONG_DATABASE)]
  .flatMap(song => [...extract(song.lyricsChords || song.lyrics), ...(song.chords || [])]));
for (const song of offlineUniversalLibrary.searchIndex.values()) {
  for (const chord of extract(getKnownSongLyrics(song.title, song.artist))) allSymbols.add(chord);
  for (const chord of offlineUniversalLibrary.synthesizeSongSheet(song.title, song.artist).chords) allSymbols.add(chord);
}
const catalogChords = [...allSymbols].sort();

test('all static chord shapes and piano definitions match independent musical theory', async ({}, info) => {
  let checked = 0;
  for (const [instrument, db, alternate] of [
    ['guitar', GUITAR_CHORDS, false], ['ukulele', UKULELE_CHORDS, false], ['piano', PIANO_VOICINGS, false],
    ['guitar', ALTERNATE_GUITAR_VOICINGS, true], ['ukulele', ALTERNATE_UKULELE_VOICINGS, true]
  ]) {
    for (const [name, entries] of Object.entries(db)) {
      for (const shape of alternate ? entries : [entries]) {
        assertNotes(name, shape, instrument, 'Static definition');
        if (instrument !== 'piano') {
          expect(shape.fingers).toHaveLength(shape.frets.length);
          for (const [index, finger] of shape.fingers.entries()) {
            expect(Number.isInteger(finger)).toBe(true);
            expect(finger).toBeGreaterThanOrEqual(0);
            expect(finger).toBeLessThanOrEqual(4);
            expect(finger === 0, `${name}: open/muted finger`).toBe(shape.frets[index] <= 0);
          }
          for (let finger = 1; finger <= 4; finger++) {
            const frets = shape.frets.filter((_, index) => shape.fingers[index] === finger);
            expect(new Set(frets).size, `${name}: one finger cannot hold different frets`).toBeLessThanOrEqual(1);
          }
        }
        checked++;
      }
    }
  }
  await info.attach('static-chord-coverage', { body: JSON.stringify({ definitions: checked, catalogSymbols: catalogChords.length }), contentType: 'application/json' });
});

for (const name of catalogChords) {
  test(`catalog chord ${name}: every offered position and all 25 transpositions`, () => {
    const spec = oracle(name);
    for (let shift = -12; shift <= 12; shift++) {
      const transposed = chordEngine.transposeChord(name, shift);
      const expected = oracle(transposed);
      expect(expected.root).toBe(((spec.root + shift) % 12 + 12) % 12);
      expect(expected.suffix).toBe(spec.suffix);
      if (spec.bass !== null) expect(expected.bass).toBe(((spec.bass + shift) % 12 + 12) % 12);
      for (const instrument of instruments) {
        const rows = chordEngine.getVoicings(transposed, instrument);
        expect(rows.length, `${transposed} ${instrument}: available`).toBeGreaterThan(0);
        if (instrument !== 'piano') expect(new Set(rows.map(row => row.frets.join(','))).size).toBe(rows.length);
        rows.forEach((_, index) => assertNotes(transposed, chordEngine.getChord(transposed, instrument, index), instrument, `Transpose ${shift}, position ${index}`));
      }
    }
  });
}

test('dictionary: all 12 roots, eight offered qualities and three instruments retain defining notes', async ({}, info) => {
  let voicings = 0;
  for (const root of ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']) {
    for (const suffix of ['', 'm', '7', 'maj7', 'm7', 'sus4', 'dim', 'add9']) {
      for (const instrument of instruments) {
        const name = root + suffix;
        const rows = chordEngine.getVoicings(name, instrument);
        expect(rows.length, `${name} ${instrument}`).toBeGreaterThan(0);
        rows.forEach((_, index) => { assertNotes(name, chordEngine.getChord(name, instrument, index), instrument); voicings++; });
      }
    }
  }
  await info.attach('dictionary-coverage', { body: JSON.stringify({ combinations: 12 * 8 * 3, voicings }), contentType: 'application/json' });
});

test('Latin notation, Unicode accidentals, enharmonics, malformed symbols and returned-data isolation', () => {
  for (const [alias, canonical] of [['Mi', 'E'], ['FAaug', 'Faug'], ['Faadd9', 'Fadd9'], ['Faaug/La', 'Faug/A'], ['Solm', 'Gm'], ['Re/Fa#', 'D/F#'], ['Do Mayor', 'C'], ['Si menor', 'Bm'], ['F♯maj7', 'F#maj7'], ['Mib7', 'Eb7'], ['C♭', 'B'], ['E#', 'F']]) {
    for (const instrument of instruments) {
      const aliasNotes = midiFor(chordEngine.getChord(alias, instrument), instrument);
      const canonicalNotes = midiFor(chordEngine.getChord(canonical, instrument), instrument);
      expect(aliasNotes).toEqual(canonicalNotes);
    }
  }
  for (const invalid of [null, undefined, '', 'H', 'Cbanana', 'C13', 'Cmaj7garbage', '[C]', 'C//E', 'C/D/E', 'not a chord', {}, []]) {
    for (const instrument of instruments) {
      expect(chordEngine.getChord(invalid, instrument)).toBeNull();
      expect(chordEngine.getVoicings(invalid, instrument)).toEqual([]);
      expect(chordEngine.renderChordSVG(invalid, { instrument })).toContain('Acorde no disponible');
    }
  }
  expect(chordEngine.getChord('C', 'violin')).toBeNull();
  for (const offset of [NaN, Infinity, -Infinity, 0.5, undefined]) expect(chordEngine.transposeChord('D/F#', offset)).toBe('D/F#');
  const original = chordEngine.getChord('C');
  const handedOut = chordEngine.getChord('C');
  handedOut.frets[0] = 24;
  chordEngine.getVoicings('C')[0].frets[1] = 24;
  expect(chordEngine.getChord('C')).toEqual(original);
});

const audioContext = () => ({ currentTime: 0, state: 'running', destination: {},
  createGain: () => ({ gain: { value: 0 }, connect() {} }), createDelay: () => ({ delayTime: { value: 0 }, connect() {} }) });
const freqMidi = freq => 69 + 12 * Math.log2(freq / 440);

test('all catalog voicings: audition, arpeggio and individual plucks produce the displayed pitches', async ({}, info) => {
  const originals = { piano: ChordAudioSynthesizer._synthPianoNote, string: ChordAudioSynthesizer._synthStringNote, mute: ChordAudioSynthesizer._synthMutedClick };
  let captured = [];
  let checkedNotes = 0;
  let voicings = 0;
  ChordAudioSynthesizer._synthPianoNote = (_, frequency) => captured.push(frequency);
  ChordAudioSynthesizer._synthStringNote = (_, frequency) => captured.push(frequency);
  ChordAudioSynthesizer._synthMutedClick = () => {};
  const assertFrequencies = expected => {
    expect(captured).toHaveLength(expected.length);
    captured.forEach((frequency, index) => { expect(freqMidi(frequency)).toBeCloseTo(expected[index], 2); checkedNotes++; });
  };
  try {
    for (const name of catalogChords) for (const instrument of instruments) {
      const rows = chordEngine.getVoicings(name, instrument);
      for (const [index] of rows.entries()) {
        const shape = chordEngine.getChord(name, instrument, index);
        const expected = midiFor(shape, instrument);
        captured = [];
        ChordAudioSynthesizer.audition(audioContext(), name, instrument, index);
        assertFrequencies(expected);
        captured = [];
        const notes = ChordAudioSynthesizer.arpeggiate(audioContext(), name, instrument, index);
        assertFrequencies(instrument === 'piano' ? [...expected].sort((a, b) => a - b) : expected);
        expect(notes).toHaveLength(expected.length);
        if (instrument !== 'piano') {
          for (let string = 0; string < shape.frets.length; string++) {
            captured = [];
            const result = ChordAudioSynthesizer.pluckString(audioContext(), string, name, instrument, index);
            expect(result.muted).toBe(shape.frets[string] < 0);
            if (!result.muted) assertFrequencies([tuning[instrument][string] + shape.frets[string]]);
          }
        }
        voicings++;
      }
    }
    for (const instrument of instruments) {
      captured = [];
      ChordAudioSynthesizer.audition(audioContext(), 'C13', instrument);
      expect(captured).toEqual([]);
      expect(ChordAudioSynthesizer.arpeggiate(audioContext(), 'C13', instrument)).toEqual([]);
    }
    for (const string of [-1, 6, 1.5, NaN, undefined]) expect(ChordAudioSynthesizer.pluckString(audioContext(), string, 'C')).toBeNull();
    expect(ChordAudioSynthesizer.playPianoNote(audioContext(), 'H', 4)).toBeNull();
    expect(ChordAudioSynthesizer.playPianoNote(audioContext(), 'C', NaN)).toBeNull();
  } finally {
    ChordAudioSynthesizer._synthPianoNote = originals.piano;
    ChordAudioSynthesizer._synthStringNote = originals.string;
    ChordAudioSynthesizer._synthMutedClick = originals.mute;
  }
  await info.attach('audio-pitch-coverage', { body: JSON.stringify({ voicings, checkedNotes }), contentType: 'application/json' });
});

const alphaTab = createRequire(import.meta.url)('@coderline/alphatab');
const parseScore = song => {
  const importer = new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(SmartScoreGenerator.generate(song), new alphaTab.Settings());
  return importer.readScore();
};

test('generated practice scores: parsed real guitar/bass pitches and exact bar duration across every catalog chord', async ({}, info) => {
  let scores = 0;
  let checkedNotes = 0;
  for (const chord of catalogChords) for (const timeSignature of ['4/4', '3/4', '6/8', '2/4', '5/4', '7/8', '3/2', '4/16']) {
    for (const genre of ['Acoustic', 'Rock']) {
      const score = parseScore({ title: 'Practice fixture', artist: 'Audit', lyricsChords: `[${chord}]Fixture`, timeSignature, genre });
      const [numerator, denominator] = timeSignature.split('/').map(Number);
      const spec = oracle(chord);
      expect(score.tracks).toHaveLength(2);
      expect(score.masterBars).toHaveLength(1);
      expect(score.masterBars[0].timeSignatureNumerator).toBe(numerator);
      expect(score.masterBars[0].timeSignatureDenominator).toBe(denominator);
      for (const [trackIndex, track] of score.tracks.entries()) {
        const beats = track.staves[0].bars[0].voices[0].beats;
        expect(beats.reduce((sum, beat) => sum + 1 / beat.duration, 0)).toBeCloseTo(numerator / denominator, 8);
        const notes = beats.flatMap(beat => beat.notes.map(note => note.realValue));
        expect(notes.length).toBeGreaterThan(0);
        if (trackIndex === 0) {
          expect([...new Set(notes)].sort((a, b) => a - b), `${chord}: actual AlphaTab pitches match the verified fingering`)
            .toEqual([...new Set(midiFor(chordEngine.getChord(chord, 'guitar'), 'guitar'))].sort((a, b) => a - b));
          const allowed = [...spec.allowed, ...(spec.bass === null ? [] : [spec.bass])];
          expect(notes.filter(note => !allowed.includes(note % 12)), `${chord}: parsed guitar pitch`).toEqual([]);
          expect(spec.required.filter(pc => !notes.some(note => note % 12 === pc)), `${chord}: extension retained`).toEqual([]);
        } else {
          const pc = spec.bass ?? spec.root;
          expect(notes.every(note => note % 12 === pc), `${chord}: bass pitch from actual bass tuning`).toBe(true);
          expect(notes.every(note => note >= 28 && note <= 39)).toBe(true);
        }
        checkedNotes += notes.length;
      }
      scores++;
    }
  }
  await info.attach('practice-score-coverage', { body: JSON.stringify({ scores, checkedNotes }), contentType: 'application/json' });
});

test('practice score absence, unavailable chords, corrupt metadata and command injection keep honest rests and boundaries', () => {
  for (const song of [null, {}, { lyricsChords: 'Plain words' }, { lyricsChords: '[C13]Unavailable' }]) {
    const score = parseScore(song);
    expect(score.tracks).toHaveLength(2);
    expect(score.masterBars).toHaveLength(1);
    for (const track of score.tracks) expect(track.staves[0].bars[0].voices[0].beats.every(beat => beat.isRest && beat.notes.length === 0)).toBe(true);
  }
  const score = parseScore({ title: 'A"\\track "Injected"\n\\tempo 999 .', artist: '\\instrument 99\r\nEvil',
    tempo: Infinity, timeSignature: '4/4 \\track "Injected"', lyricsChords: '[C]One[C13]Unavailable[D/F#]Three' });
  expect(score.tracks).toHaveLength(2);
  expect(score.masterBars).toHaveLength(3);
  expect(score.masterBars[0].timeSignatureNumerator).toBe(4);
  expect(score.masterBars[0].timeSignatureDenominator).toBe(4);
  for (const track of score.tracks) expect(track.staves[0].bars[1].voices[0].beats.every(beat => beat.isRest)).toBe(true);
  expect(score.title).not.toContain('\n');
});

test('every catalog SVG: visible frets, actual string indices, inversion notes and safely escaped labels', async ({ page }) => {
  await page.goto('/');
  const evidence = await page.evaluate(async names => {
    const { chordEngine } = await import('/src/tools/ChordEngine.js');
    const results = [];
    for (const name of names) for (const instrument of ['guitar', 'ukulele', 'piano']) {
      for (const [index] of chordEngine.getVoicings(name, instrument).entries()) {
        for (const left of instrument === 'piano' ? [false] : [false, true]) {
          const host = document.createElement('div');
          host.innerHTML = chordEngine.renderChordSVG(name, { instrument, voicingIndex: index, isLeftHanded: left, displayName: '<img src=x onerror=alert(1)>"' });
          const svg = host.querySelector('svg');
          const shape = chordEngine.getChord(name, instrument, index);
          results.push({ name, instrument, index, left, hasSvg: Boolean(svg), injectedElements: host.querySelectorAll('img, script').length,
            strings: [...host.querySelectorAll('.chord-interactive-string')].map(node => ({ index: Number(node.dataset.stringIdx), fret: Number(node.dataset.fret) })),
            dots: host.querySelectorAll('.chord-finger-dot').length,
            expectedDots: shape.frets?.filter(fret => fret > 0).length,
            expectedFrets: shape.frets,
            active: [...host.querySelectorAll('[data-active="true"]')].map(node => ({ key: node.dataset.note, oct: Number(node.dataset.oct) })),
            expectedPiano: instrument === 'piano' ? shape : null });
        }
      }
    }
    return results;
  }, catalogChords);
  for (const row of evidence) {
    expect(row.hasSvg, `${row.name} ${row.instrument}`).toBe(true);
    expect(row.injectedElements).toBe(0);
    if (row.instrument === 'piano') expect(row.active.map(note => 12 * (note.oct + 1) + pitchClass(note.key)).sort((a, b) => a - b))
      .toEqual(row.expectedPiano.map(note => 12 * (note.oct + 1) + pitchClass(note.key)).sort((a, b) => a - b));
    else {
      expect(row.dots).toBe(row.expectedDots);
      expect(row.strings.map(string => row.expectedFrets[string.index])).toEqual(row.strings.map(string => string.fret));
    }
  }
});

for (const width of [375, 768, 1440]) {
  test(`real chord popover at ${width}px: extensions, keyboard instrument switches, inversions and string interaction`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('.bottom-nav-bar').waitFor();
    await page.evaluate(async () => {
      const { events } = await import('/src/core/EventBus.js');
      events.emit('ui:switchTab', 'player');
      events.emit('ui:loadLyricsSong', { title: 'Chord audit fixture', artist: 'Audit', lyricsChords: '[Cmaj7]First [D/F#]second [Dsus2]third [F#maj7]fourth', data: '' });
    });
    await page.locator('.chord-badge[data-chord="Cmaj7"]').first().click();
    const popover = page.locator('#chordPopoverCard');
    await expect(popover).toBeVisible();
    await popover.locator('[data-popinst="piano"]').focus();
    await page.keyboard.press('Enter');
    await expect(popover.locator('.piano-svg')).toBeVisible();
    await expect(popover.locator('[data-active="true"]')).toHaveCount(4);
    await popover.locator('#btnVoicingNext').click();
    await expect(popover.locator('[data-active="true"]')).toHaveCount(4);
    const active = await popover.locator('[data-active="true"]').evaluateAll(nodes => nodes.map(node => ({ key: node.dataset.note, oct: Number(node.dataset.oct) })));
    expect(active.map(note => 12 * (note.oct + 1) + pitchClass(note.key)).sort((a, b) => a - b)).toEqual([64, 67, 71, 72]);
    await popover.locator('[data-popinst="ukulele"]').click();
    await expect(popover.locator('.chord-interactive-string')).toHaveCount(4);
    await popover.locator('.chord-interactive-string').first().click();
    const svg = await popover.locator('.chord-diagram-svg').boundingBox();
    expect(svg.x).toBeGreaterThanOrEqual(0);
    expect(svg.x + svg.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
