import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessSong, summarizeQuality } from '../src/data/catalog/CatalogQuality.js';
import { karaokeSongKey } from '../src/data/KaraokeBackingStore.js';
import { KaraokeBackingEngine } from '../src/audio/KaraokeBackingEngine.js';

test('presence and claimed verification never certify authenticity', () => {
  const result = assessSong({ lyrics: '[Verse]\nOne two three', tempo: 120, verified: true, isOfflineReady: true });
  assert.equal(result.hasLyrics, true);
  assert.equal(result.hasChords, false);
  assert.equal(result.audioAvailable, false);
  assert.equal(result.authenticity, 'unverified');
  assert.equal(summarizeQuality([{ quality: result }]).verified, 0);
});
test('valid chords are not section labels; generated harmony stays flagged', () => {
  assert.equal(assessSong({ lyrics: '[Chorus]\n[Bridge]\nA song' }).hasChords, false);
  assert.equal(assessSong({ lyrics: '[Cadd9]A [G/B]song' }).chordCount, 2);
  assert.equal(assessSong({ lyrics: '[C]A song', source: 'universal_online_harvested' }).generated, true);
  assert.equal(assessSong({ lyrics: 'Letra pendiente' }).hasLyrics, false);
});
test('invalid and out-of-audio timestamps do not count as ready', () => {
  const song = { lyrics: 'A song', lyricCues: [{ startTime: 1000, duration: 2000, text: 'A song' }] };
  assert.equal(assessSong(song, { audioAvailable: true, durationMs: 2000 }).karaokeAssetsPresent, false);
  assert.equal(assessSong(song, { audioAvailable: true, durationMs: 3000 }).karaokeAssetsPresent, true);
  assert.equal(assessSong({ ...song, lyricCues: [null] }).hasTiming, false);
});
test('different recording versions cannot share audio, LRC or session keys', () => {
  const song = { title: 'Same song', artist: 'Same artist' };
  assert.notEqual(karaokeSongKey({ ...song, versionId: 'studio' }), karaokeSongKey({ ...song, versionId: 'live' }));
  assert.notEqual(karaokeSongKey({ ...song, recordingId: 'take1' }), karaokeSongKey({ ...song, recordingId: 'take2' }));
  assert.equal(karaokeSongKey(song), karaokeSongKey({ ...song, versionId: 'live' }, { legacy: true }));
});
test('unassigned legacy timings require explicit association and remain recoverable', async () => {
  const legacy = { lyricCues: [{ startTime: 3000, duration: 1000, text: 'Old take' }], tempoBpm: 80 };
  let current;
  const engine = new KaraokeBackingEngine({ store: { get: async () => current,
    getLegacy: async () => legacy, put: async (_, value) => { current = value; }, close() {} } });
  await engine.loadSong({ title: 'Fixture', artist: 'Test', versionId: 'live', lyricsChords: '[C]One two three four' });
  assert.equal(engine.song.lyricCues, undefined);
  assert.equal(engine.legacyRecord, legacy);
  assert.equal(await engine.useLegacyRecording(), true);
  assert.equal(engine.song.lyricCues[0].startTime, 3000);
  assert.equal(legacy.lyricCues[0].text, 'Old take');
  engine.destroy();
});
