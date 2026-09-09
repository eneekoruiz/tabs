/**
 * @file OnlineSongProvider.js
 * @description Proveedor del catálogo local y de guías de acordes disponibles sin conexión.
 * Integra el índice de discografías incluido y distingue letras curadas de guías generadas.
 */

import { offlineUniversalLibrary } from './catalog/OfflineUniversalLibraryEngine.js';
import { getKnownSongLyrics } from './lyrics/KnownSongLyrics.js';
import { LyricsHarmonizer } from './lyrics/LyricsHarmonizer.js';
import { assessSong } from './catalog/CatalogQuality.js';

export class OnlineSongProvider {
  constructor() {
    this.cache = new Map();
    this.lyricsCache = new Map();
  }

  /**
   * Búsqueda instantánea sobre el catálogo incluido en la aplicación y recolector online continuo
   */
  async searchOnline(query, limit = 30) {
    if (!query || !query.trim()) return [];
    const cleanQuery = query.trim();
    const cacheKey = `search_${cleanQuery.toLowerCase()}_${limit}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Obtener únicamente resultados que existen en el índice local verificable
    const offlineResults = offlineUniversalLibrary.search(cleanQuery, limit).map(s => ({
      ...s
    }));

    // Si encontramos suficientes resultados en el catálogo local offline, devolverlos de inmediato
    if (offlineResults.length >= 8) {
      this.cache.set(cacheKey, offlineResults);
      return offlineResults;
    }

    // Búsqueda en recolector online dinámico para descubrir más canciones por el camino
    try {
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanQuery)}`);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list)) {
          const seen = new Set(offlineResults.map(r => `${(r.title || '').toLowerCase()}_${(r.artist || '').toLowerCase()}`));
          for (const item of list) {
            if (!item.trackName || !item.artistName) continue;
            const uKey = `${item.trackName.toLowerCase()}_${item.artistName.toLowerCase()}`;
            if (!seen.has(uKey)) {
              seen.add(uKey);
              offlineResults.push({
                id: `online_${Math.abs(item.id || Date.now())}`,
                title: item.trackName,
                artist: item.artistName,
                album: item.albumName || '',
                duration: item.duration || null,
                recordingId: `lrclib:${item.id}`,
                source: 'online_metadata',
                contentKind: 'metadata_only',
                hasCuratedLyrics: false,
                isOfflineReady: false,
                provenance: { metadata: { provider: 'LRCLIB', sourceUrl: `https://lrclib.net/api/get/${item.id}` } }
              });
              if (offlineResults.length >= limit) break;
            }
          }
        }
      }
    } catch (e) {
      // En modo sin conexión, fallar silenciosamente y servir los resultados locales
    }

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

    // 1. Obtener partitura completa desde el motor offline universal (letras reales curadas)
    const offlineSheet = offlineUniversalLibrary.getSongSheet(title, artist);
    if (offlineSheet) {
      const normalizedSheet = { ...offlineSheet, quality: assessSong(offlineSheet) };
      this.lyricsCache.set(cacheKey, normalizedSheet);
      return normalizedSheet;
    }

    // Discovery metadata is not permission to bulk copy lyrics. Missing content
    // stays missing until explicitly imported or supplied by a licensed provider.

    this.lyricsCache.set(cacheKey, null);
    return null;
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
