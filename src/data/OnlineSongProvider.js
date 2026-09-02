/**
 * @file OnlineSongProvider.js
 * @description Proveedor del catálogo local y de guías de acordes disponibles sin conexión.
 * Integra el índice de discografías incluido y distingue letras curadas de guías generadas.
 */

import { offlineUniversalLibrary } from './catalog/OfflineUniversalLibraryEngine.js';
import { getKnownSongLyrics } from './lyrics/KnownSongLyrics.js';
import { LyricsHarmonizer } from './lyrics/LyricsHarmonizer.js';

export class OnlineSongProvider {
  constructor() {
    this.cache = new Map();
    this.lyricsCache = new Map();
  }

  /**
   * Búsqueda instantánea sobre el catálogo incluido en la aplicación
   */
  async searchOnline(query, limit = 30) {
    if (!query || !query.trim()) return [];
    const cleanQuery = query.trim();
    const cacheKey = `search_${cleanQuery.toLowerCase()}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Obtener únicamente resultados que existen en el índice local verificable
    const offlineResults = offlineUniversalLibrary.search(cleanQuery, limit).map(s => ({
      ...s,
      isOfflineReady: true
    }));

    // Almacenar en caché y devolver
    this.cache.set(cacheKey, offlineResults);
    return offlineResults;
  }

  /**
   * Obtiene el contenido ChordPro incluido o generado localmente
   */
  async fetchLyricsAndChords(title, artist) {
    const sheet = await this.getSongLyrics(title, artist);
    if (!sheet) return '';
    return typeof sheet === 'string' ? sheet : (sheet.chordpro || sheet.lyrics || '');
  }

  async getSongLyrics(title, artist) {
    if (!title) return null;
    const cacheKey = `${title.toLowerCase()}_${(artist || '').toLowerCase()}`;

    if (this.lyricsCache.has(cacheKey)) {
      return this.lyricsCache.get(cacheKey);
    }

    // 1. Obtener partitura completa desde el motor offline universal
    const offlineSheet = offlineUniversalLibrary.getSongSheet(title, artist);
    const hasValidText = offlineSheet && 
      typeof offlineSheet.chordpro === 'string' && 
      offlineSheet.chordpro.trim().length > 10 && 
      !/^\s*(\[\w+\]|\.|\s)*$/.test(offlineSheet.chordpro);

    if (hasValidText) {
      this.lyricsCache.set(cacheKey, offlineSheet);
      return offlineSheet;
    }

    // 2. Si no estuviera (fallback seguro), armonizar algoritmo offline con letra legible en español
    const fallbackSheet = LyricsHarmonizer.createDynamicSongSheet(title, artist);
    this.lyricsCache.set(cacheKey, fallbackSheet);
    return fallbackSheet;
  }

  getCatalogStats() {
    return {
      songs: offlineUniversalLibrary.totalIndexedSongs,
      artists: offlineUniversalLibrary.totalIndexedArtists
    };
  }
  getKnownSongLyrics(title, artist) {
    return getKnownSongLyrics(title, artist);
  }

  smartHarmonizeLyrics(rawText, title, artist) {
    return LyricsHarmonizer.harmonize(rawText, title, artist);
  }
}

export const onlineSongProvider = new OnlineSongProvider();
export default onlineSongProvider;
