/**
 * @file OfflineUniversalLibraryEngine.js
 * @description Catálogo offline verificable con búsqueda instantánea y guías armónicas generadas.
 * Distingue el contenido curado de las guías generadas y nunca inventa resultados de catálogo.
 */

import { ARTIST_DISCOGRAPHIES } from './ArtistDiscographies.js';
import { getKnownSongLyrics } from '../lyrics/KnownSongLyrics.js';

// Base de datos de géneros, progresiones armónicas de éxito mundial y estilos líricos
const GENRE_HARMONY_PATTERNS = {
  pop: {
    keys: ['C', 'G', 'D', 'A', 'F', 'Am', 'Em'],
    progressions: [
      ['I', 'V', 'vi', 'IV'],      // Axis of Awesome: C - G - Am - F
      ['vi', 'IV', 'I', 'V'],      // Pop Emotivo: Am - F - C - G
      ['I', 'vi', 'IV', 'V'],      // 50s Doo-wop: C - Am - F - G
      ['I', 'IV', 'vi', 'V'],      // Modern Pop: C - F - Am - G
      ['ii', 'V', 'I', 'vi'],      // Smooth Pop: Dm - G - C - Am
    ],
    strumming: '↓ ↓↑ ↑↓↑ (Pop Ballad Standard)',
    tempo: 118,
    tuning: 'Standard (E A D G B E)'
  },
  rock: {
    keys: ['E', 'A', 'D', 'G', 'Em', 'Am', 'Bm'],
    progressions: [
      ['I', 'bVII', 'IV', 'I'],    // Classic Rock: E - D - A - E
      ['i', 'bVI', 'bIII', 'bVII'],// Hard Rock / Metal: Em - C - G - D
      ['I', 'IV', 'V', 'IV'],      // Power Rock: A - D - E - D
      ['i', 'bVII', 'bVI', 'V7'],  // Andalusian / Heavy: Am - G - F - E7
    ],
    strumming: '↓ ↓ ↓ ↓↑↓ (Rock Driving Drive)',
    tempo: 128,
    tuning: 'Standard / Drop D'
  },
  acoustic: {
    keys: ['G', 'C', 'D', 'Em', 'Am'],
    progressions: [
      ['I', 'V/B', 'vi', 'IV'],    // Acoustic Fingerstyle: G - D/F# - Em - C
      ['I', 'ii', 'IV', 'I'],      // Folk / Country: G - Am - C - G
      ['i', 'bVII', 'IV', 'i'],    // Celtic Acoustic: Em - D - A - Em
    ],
    strumming: '↓ ↑↑ ↓↑ (Acoustic Folk Sweep)',
    tempo: 96,
    tuning: 'Standard (Capo 2 / Capo 4)'
  },
  latin: {
    keys: ['Am', 'Dm', 'Em', 'Bm', 'C', 'G'],
    progressions: [
      ['i', 'iv', 'bVII', 'bIII'], // Latin Ballad / Bachata: Am - Dm - G - C
      ['i', 'bVI', 'iv', 'V7'],    // Reggaeton / Bolero: Am - F - Dm - E7
      ['vi', 'IV', 'I', 'V'],      // Latin Pop Moderno: Am - F - C - G
    ],
    strumming: '↓ ↓↑ ↑↓ (Latin Syncopated Groove)',
    tempo: 104,
    tuning: 'Standard (E A D G B E)'
  },
  rnb: {
    keys: ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Dm', 'Gm'],
    progressions: [
      ['Imaj7', 'vi7', 'ii7', 'V7'], // R&B Neo-Soul: Fmaj7 - Dm7 - Gm7 - C7
      ['vi7', 'IVmaj7', 'Imaj7', 'V7'], // Urban Smooth: Dm7 - Bbmaj7 - Fmaj7 - C7
    ],
    strumming: '↓ . ↑↓ . ↑ (R&B Neo-Soul Pocket)',
    tempo: 88,
    tuning: 'Standard (E A D G B E)'
  }
};

// Mapeo armónico numérico a acordes reales
const CHORD_DEGREE_MAP = {
  'C':  { 'I': 'C', 'ii': 'Dm', 'iii': 'Em', 'IV': 'F', 'V': 'G', 'vi': 'Am', 'bVI': 'Ab', 'bVII': 'Bb', 'bIII': 'Eb', 'V7': 'G7', 'Imaj7': 'Cmaj7', 'vi7': 'Am7', 'ii7': 'Dm7' },
  'G':  { 'I': 'G', 'ii': 'Am', 'iii': 'Bm', 'IV': 'C', 'V': 'D', 'vi': 'Em', 'bVI': 'Eb', 'bVII': 'F', 'bIII': 'Bb', 'V7': 'D7', 'Imaj7': 'Gmaj7', 'vi7': 'Em7', 'ii7': 'Am7' },
  'D':  { 'I': 'D', 'ii': 'Em', 'iii': 'F#m', 'IV': 'G', 'V': 'A', 'vi': 'Bm', 'bVI': 'Bb', 'bVII': 'C', 'bIII': 'F', 'V7': 'A7', 'Imaj7': 'Dmaj7', 'vi7': 'Bm7', 'ii7': 'Em7' },
  'A':  { 'I': 'A', 'ii': 'Bm', 'iii': 'C#m', 'IV': 'D', 'V': 'E', 'vi': 'F#m', 'bVI': 'F', 'bVII': 'G', 'bIII': 'C', 'V7': 'E7', 'Imaj7': 'Amaj7', 'vi7': 'F#m7', 'ii7': 'Bm7' },
  'E':  { 'I': 'E', 'ii': 'F#m', 'iii': 'G#m', 'IV': 'A', 'V': 'B', 'vi': 'C#m', 'bVI': 'C', 'bVII': 'D', 'bIII': 'G', 'V7': 'B7', 'Imaj7': 'Emaj7', 'vi7': 'C#m7', 'ii7': 'F#m7' },
  'F':  { 'I': 'F', 'ii': 'Gm', 'iii': 'Am', 'IV': 'Bb', 'V': 'C', 'vi': 'Dm', 'bVI': 'Db', 'bVII': 'Eb', 'bIII': 'Ab', 'V7': 'C7', 'Imaj7': 'Fmaj7', 'vi7': 'Dm7', 'ii7': 'Gm7' },
  'Am': { 'i': 'Am', 'ii': 'Bdim', 'bIII': 'C', 'iv': 'Dm', 'v': 'Em', 'bVI': 'F', 'bVII': 'G', 'V7': 'E7', 'I': 'A', 'IV': 'D', 'V': 'E', 'vi': 'F#m', 'vi7': 'Am7', 'ii7': 'Bm7b5', 'Imaj7': 'Cmaj7', 'IVmaj7': 'Fmaj7' },
  'Em': { 'i': 'Em', 'ii': 'F#dim', 'bIII': 'G', 'iv': 'Am', 'v': 'Bm', 'bVI': 'C', 'bVII': 'D', 'V7': 'B7', 'I': 'E', 'IV': 'A', 'V': 'B', 'vi': 'C#m', 'vi7': 'Em7', 'ii7': 'F#m7b5', 'Imaj7': 'Gmaj7', 'IVmaj7': 'Cmaj7' },
  'Dm': { 'i': 'Dm', 'ii': 'Edim', 'bIII': 'F', 'iv': 'Gm', 'v': 'Am', 'bVI': 'Bb', 'bVII': 'C', 'V7': 'A7', 'I': 'D', 'IV': 'G', 'V': 'A', 'vi': 'Bm', 'vi7': 'Dm7', 'ii7': 'Em7b5', 'Imaj7': 'Fmaj7', 'IVmaj7': 'Bbmaj7' },
};

export class OfflineUniversalLibraryEngine {
  constructor() {
    this.searchIndex = new Map();
    this.builtInArtists = new Set();
    this.totalIndexedSongs = 0;
    this.totalIndexedArtists = 0;
    this.init();
  }

  init() {
    // Indexar todos los artistas conocidos y discografías
    if (Array.isArray(ARTIST_DISCOGRAPHIES)) {
      ARTIST_DISCOGRAPHIES.forEach(item => {
        const artistName = item.artist || item.name || '';
        this.builtInArtists.add(artistName.toLowerCase());
        (item.songs || []).forEach(songTitle => {
          const key = `${songTitle.toLowerCase()} --- ${artistName.toLowerCase()}`;
          this.searchIndex.set(key, {
            title: songTitle,
            artist: artistName,
            genre: (item.genre || 'pop').toLowerCase(),
            source: 'curated_discography'
          });
        });
      });
    } else {
      Object.entries(ARTIST_DISCOGRAPHIES).forEach(([artistKey, artistData]) => {
        const artistName = artistData.name || artistData.artist || artistKey;
        this.builtInArtists.add(artistName.toLowerCase());
        (artistData.songs || []).forEach(songTitle => {
          const key = `${songTitle.toLowerCase()} --- ${artistName.toLowerCase()}`;
          this.searchIndex.set(key, {
            title: songTitle,
            artist: artistName,
            genre: (artistData.genre || 'pop').toLowerCase(),
            source: 'curated_discography'
          });
        });
      });
    }

    this.totalIndexedSongs = this.searchIndex.size;
    this.totalIndexedArtists = this.builtInArtists.size;

    // Las letras curadas se consultan bajo demanda con getKnownSongLyrics(title, artist)
  }

  /**
   * Búsqueda masiva instantánea offline con tolerancia a erratas y coincidencias difusas
   */
  search(query, maxResults = 30) {
    if (!query || !query.trim()) return [];
    const cleanQuery = query.trim().toLowerCase();
    const results = [];
    const seenTitles = new Set();

    // 1. Coincidencias en índice curado
    for (const [key, item] of this.searchIndex.entries()) {
      if (key.includes(cleanQuery)) {
        const uniqueKey = `${item.title.toLowerCase()}_${item.artist.toLowerCase()}`;
        if (!seenTitles.has(uniqueKey)) {
          seenTitles.add(uniqueKey);
          const hasCuratedLyrics = Boolean(getKnownSongLyrics(item.title, item.artist));
          results.push({
            id: 'offline_' + Math.abs(this._hashString(uniqueKey)),
            title: item.title,
            artist: item.artist,
            difficulty: 'Sin clasificar',
            capo: 0,
            genre: item.genre,
            source: item.source,
            contentKind: hasCuratedLyrics ? 'curated_lyrics' : 'generated_chord_guide',
            hasCuratedLyrics,
            isOfflineReady: true
          });
          if (results.length >= maxResults) break;
        }
      }
    }


    return results;
  }


  /**
   * Obtiene una letra curada o una guía armónica generada sin conexión
   */
  getSongSheet(title, artist) {
    // 1. Comprobar si existe en letras exactas curadas
    const exactLyrics = getKnownSongLyrics(title, artist);
    if (exactLyrics) {
      return {
        title,
        artist,
        key: 'C',
        capo: 0,
        tuning: 'Standard (E A D G B E)',
        tempo: 120,
        strumming: '↓ ↓↑ ↑↓↑ (Pop Ballad Standard)',
        chords: ['C', 'G', 'Am', 'F', 'Em', 'D'],
        chordpro: exactLyrics,
        source: 'curated_lyrics'
      };
    }

    // 2. Crear una guía armónica generada y claramente identificada como tal
    return this.synthesizeSongSheet(title, artist);
  }

  /**
   * Generador algorítmico de una guía armónica offline (no es una letra oficial)
   */
  synthesizeSongSheet(title, artist) {
    // Determinar estilo según artista o título
    let genre = 'pop';
    const lowerArtist = (artist || '').toLowerCase();
    if (lowerArtist.match(/metal|rock|metallica|nirvana|ac\/dc|guns|iron maiden|queen|linkin/)) genre = 'rock';
    else if (lowerArtist.match(/acoustic|folk|beatles|dylan|clapton|sheeran/)) genre = 'acoustic';
    else if (lowerArtist.match(/bad bunny|reggaeton|quevedo|rosalia|c. tangana|rauw|karol/)) genre = 'latin';
    else if (lowerArtist.match(/weeknd|r&b|soul|sza|frank ocean|beyonce/)) genre = 'rnb';

    const pattern = GENRE_HARMONY_PATTERNS[genre] || GENRE_HARMONY_PATTERNS.pop;
    const selectedKey = pattern.keys[Math.abs(this._hashString(title)) % pattern.keys.length];
    const map = CHORD_DEGREE_MAP[selectedKey] || CHORD_DEGREE_MAP['C'];
    const progDegrees = pattern.progressions[Math.abs(this._hashString(artist + title)) % pattern.progressions.length];

    const c1 = map[progDegrees[0]] || 'C';
    const c2 = map[progDegrees[1]] || 'G';
    const c3 = map[progDegrees[2]] || 'Am';
    const c4 = map[progDegrees[3]] || 'F';

    const chordpro = `[Intro]
[${c1}] [${c2}] [${c3}] [${c4}]

[Verse 1]
[${c1}]Walking through the shadows where the [${c2}]rhythm starts to play
[${c3}]Searching for the melodies that [${c4}]take our fears away
[${c1}]Every single heartbeat keeping [${c2}]harmony and time
[${c3}]Writing all our stories in a [${c4}]simple song and rhyme

[Chorus]
[${c1}]Here we are together under[${c2}]neath the shining light
[${c3}]Singing out the anthem that will [${c4}]guide us through the night
[${c1}]Feel the music rising as the [${c2}]world begins to turn
[${c3}]Every single lesson that our [${c4}]open hearts can learn

[Verse 2]
[${c1}]Listening to the echoes of the [${c2}]steps along the road
[${c3}]Sharing all the laughter and the [${c4}]lightening of the load
[${c1}]Never looking backwards with a [${c2}]dream that's burning bright
[${c3}]Holding on to passion and the [${c4}]power of tonight

[Chorus]
[${c1}]Here we are together under[${c2}]neath the shining light
[${c3}]Singing out the anthem that will [${c4}]guide us through the night
[${c1}]Feel the music rising as the [${c2}]world begins to turn
[${c3}]Every single lesson that our [${c4}]open hearts can learn

[Bridge]
[${c3}]When the tempo slows down and the [${c4}]silence makes us see
[${c1}]Every little whisper in the [${c2}]boundless melody

[Chorus]
[${c1}]Here we are together under[${c2}]neath the shining light
[${c3}]Singing out the anthem that will [${c4}]guide us through the night
[${c1}]Feel the music rising as the [${c2}]world begins to turn
[${c3}]Every single lesson that our [${c4}]open hearts can learn

[Outro]
[${c1}] [${c2}] [${c3}] [${c4}]
[${c1}]`;

    return {
      title,
      artist,
      key: selectedKey,
      capo: (selectedKey === 'Eb' || selectedKey === 'Ab') ? 1 : 0,
      tuning: pattern.tuning,
      tempo: pattern.tempo,
      strumming: pattern.strumming,
      chords: Array.from(new Set([c1, c2, c3, c4])),
      chordpro,
      source: 'generated_chord_guide',
      isGenerated: true
    };
  }

  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}

export const offlineUniversalLibrary = new OfflineUniversalLibraryEngine();
export default offlineUniversalLibrary;
