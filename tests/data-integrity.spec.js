import { test, expect } from '@playwright/test';
import { searchEngine } from '../src/data/SearchEngine.js';
import { CircleOfFifthsTool } from '../src/ui/tools/CircleOfFifthsTool.js';
import { ChordProParser } from '../src/ui/lyrics/ChordProParser.js';
import {
  buildYouTubeSearchUrl,
  extractYouTubeVideoId,
  getSongYouTubeVideoId,
  saveSongYouTubeVideoId
} from '../src/ui/lyrics/YouTubeCompanion.js';

test.describe('Integridad musical y agrupación', () => {
  test('agrupa versiones sin perder contenido ni inventar dificultad', () => {
    const versions = [
      { id: 1, title: 'Tema', artist: 'Artista', versionName: 'Estudio', tempo: 91, lyricsChords: '[C]LETRA-ESTUDIO', data: '\\tempo 91' },
      { id: 2, title: 'Tema', artist: 'Artista', versionName: 'Directo', tempo: 137, lyricsChords: '[G]LETRA-DIRECTO', data: '\\tempo 137' },
    ];

    const [group] = searchEngine.groupSongs(versions);

    expect(group.versionCount).toBe(2);
    expect(group.versions.map((version) => version.tempo)).toEqual([91, 137]);
    expect(group.versions.map((version) => version.lyricsChords)).toEqual(['[C]LETRA-ESTUDIO', '[G]LETRA-DIRECTO']);
    expect(group.versions.map((version) => version.data)).toEqual(['\\tempo 91', '\\tempo 137']);
    expect(group.versions.some((version) => version.difficulty === 'Sin clasificar')).toBe(false);
  });

  test('marca las tres mayores y las tres menores de cada familia armónica', () => {
    const circle = new CircleOfFifthsTool();
    const keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

    for (const key of keys) {
      const svg = circle.renderCircleSVG(key);
      expect((svg.match(/circle-key-sector[^\"]*harmonic-family/g) || []).length, key).toBe(3);
      expect((svg.match(/circle-minor-sector[^\"]*harmonic-family/g) || []).length, key).toBe(3);
      expect((svg.match(/circle-minor-sector[^\"]*relative-minor/g) || []).length, key).toBe(1);
    }
  });
  test('respeta sostenidos y bemoles, incluidos bajos invertidos', () => {
    expect(ChordProParser.formatChordDisplay('C#m/G#', 'anglo', 'flats')).toBe('Dbm/Ab');
    expect(ChordProParser.formatChordDisplay('Dbm/Ab', 'anglo', 'sharps')).toBe('C#m/G#');
    expect(ChordProParser.formatChordDisplay('C#m', 'latin', 'flats')).toBe('Rebm');
  });

  test('valida y recuerda vídeos de YouTube por canción y versión', () => {
    const memory = new Map();
    const storage = {
      getItem: (key) => memory.get(key) || null,
      setItem: (key, value) => memory.set(key, value)
    };
    const studio = { id: 'tema', title: 'Tema', artist: 'Artista', versionId: 'studio' };
    const live = { ...studio, versionId: 'live' };

    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=12')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBe('');
    expect(saveSongYouTubeVideoId(studio, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', storage)).toBe('dQw4w9WgXcQ');
    expect(getSongYouTubeVideoId(studio, storage)).toBe('dQw4w9WgXcQ');
    expect(getSongYouTubeVideoId(live, storage)).toBe('');
    expect(buildYouTubeSearchUrl(studio)).toContain('Artista%20Tema%20official%20audio');
  });

  test('inicializa metrónomo con song.tempo y persiste ajustes por canción y versión', async () => {
    const { SongMetronomeCompanion, songMetronomeStorageKey } = await import('../src/ui/lyrics/SongMetronomeCompanion.js');
    const memory = new Map();
    const storage = {
      getItem: (key) => memory.get(key) || null,
      setItem: (key, value) => memory.set(key, String(value))
    };

    const songStudio = {
      id: 'believer',
      title: 'Believer',
      artist: 'Imagine Dragons',
      versionId: 'studio',
      tempo: 125,
      timeSignature: '4/4'
    };

    const songAcoustic = {
      id: 'believer',
      title: 'Believer',
      artist: 'Imagine Dragons',
      versionId: 'acoustic',
      tempo: 96,
      timeSignature: '4/4'
    };

    // 1. Inicialización desde song.tempo
    const metroStudio = new SongMetronomeCompanion({ song: songStudio, storage });
    expect(metroStudio.bpm).toBe(125);
    expect(metroStudio.timeSignature).toBe('4/4');

    // 2. Modificar BPM y ajustes en versión Studio
    metroStudio.setBpm(130);
    metroStudio.setTimeSignature('3/4');
    metroStudio.setAccent(false);
    metroStudio.setCountIn(2);
    metroStudio.setVolume(0.9);

    // 3. Verificar persistencia en storage sin mutar el objeto de la canción original
    expect(songStudio.tempo).toBe(125); // Inmutable
    const savedStudioKey = songMetronomeStorageKey(songStudio);
    const savedStudioData = JSON.parse(storage.getItem(savedStudioKey));
    expect(savedStudioData.bpm).toBe(130);
    expect(savedStudioData.timeSignature).toBe('3/4');
    expect(savedStudioData.accent).toBe(false);
    expect(savedStudioData.countInMeasures).toBe(2);

    // 4. Versión acústica debe mantener sus propios BPM
    const metroAcoustic = new SongMetronomeCompanion({ song: songAcoustic, storage });
    expect(metroAcoustic.bpm).toBe(96);
    expect(metroAcoustic.timeSignature).toBe('4/4');

    // 5. Stepper y límites (clamp)
    metroAcoustic.stepBpm(10);
    expect(metroAcoustic.bpm).toBe(106);
    metroAcoustic.setBpm(350);
    expect(metroAcoustic.bpm).toBe(280); // Max clamp
    metroAcoustic.setBpm(10);
    expect(metroAcoustic.bpm).toBe(30); // Min clamp
  });
});
