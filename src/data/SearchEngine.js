/**
 * @file SearchEngine.js
 * @description Motor de búsqueda local con normalización, tolerancia a erratas,
 * filtros combinables y agrupación de versiones por canción y artista.
 */

import { db } from './Database.js';
import { offlineUniversalLibrary } from './catalog/OfflineUniversalLibraryEngine.js';
import { getKnownSongLyrics } from './lyrics/KnownSongLyrics.js';
import { MEGA_CATALOG } from './CatalogDataset.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';

import { KNOWN_SONG_METADATA, POPURRI_PRIORITY, resolveSongMetadata } from './catalog/SongMetadataResolver.js';

class SearchEngine {
  constructor() {
    this.index = [];
    this.catalogIndex = [];
    this.isLoaded = false;
    this.loadingPromise = null;
    this.searchDocuments = new WeakMap();
  }

  async ensureIndex() {
    if (this.isLoaded) return this.index;
    if (!this.loadingPromise) {
      this.loadingPromise = this.reloadIndex().finally(() => {
        this.loadingPromise = null;
      });
    }
    return this.loadingPromise;
  }

  async reloadIndex() {
    try {
      const localSongs = await db.getAllSongsMetadata();
      const localGroups = new Set(localSongs.map((song) => this.getGroupKey(song)));
      const catalogSongs = [];

      const megaMap = new Map();
      if (Array.isArray(MEGA_CATALOG)) {
        for (const m of MEGA_CATALOG) {
          const k = `${(m.title || '').toLowerCase()} --- ${(m.artist || '').toLowerCase()}`;
          megaMap.set(k, m);
        }
      }

      for (const item of offlineUniversalLibrary.searchIndex.values()) {
        const groupKey = this.getGroupKey(item);
        if (localGroups.has(groupKey)) continue;
        const hasCuratedLyrics = Boolean(getKnownSongLyrics(item.title, item.artist));
        const mega = megaMap.get(`${(item.title || '').toLowerCase()} --- ${(item.artist || '').toLowerCase()}`);
        const meta = resolveSongMetadata(item.title, item.artist, item.genre, (s) => this.hash(s));

        catalogSongs.push({
          id: `catalog_${this.hash(groupKey)}`,
          title: item.title,
          artist: item.artist,
          genre: mega?.genre || item.genre || 'Pop',
          tuning: mega?.tuning || 'Standard E',
          tempo: Number(mega?.tempo || meta.tempo),
          difficulty: mega?.difficulty || meta.difficulty,
          isFavorite: false,
          isCatalogEntry: true,
          isOfflineReady: true,
          hasCuratedLyrics,
          contentKind: hasCuratedLyrics ? 'curated_lyrics' : 'generated_chord_guide',
          contentSource: hasCuratedLyrics ? 'curated_lyrics' : 'generated_chord_guide',
        });
      }

      // Asegurar que localSongs también tengan difficulty y tempo consistentes
      localSongs.forEach((song) => {
        if (!song.difficulty || !song.tempo || song.tempo === 120) {
          const meta = resolveSongMetadata(song.title, song.artist, song.genre, (s) => this.hash(s));
          if (!song.difficulty) song.difficulty = meta.difficulty;
          if (!song.tempo || song.tempo === 120) song.tempo = meta.tempo;
        }
      });

      this.index = localSongs;
      this.catalogIndex = catalogSongs;
      this.searchDocuments = new WeakMap();
      [...this.index, ...this.catalogIndex].forEach((song) => this.searchDocuments.set(song, this.createSearchDocument(song)));
      this.isLoaded = true;
      state.set('library', { totalSongs: this.index.length });
      events.emit('search:indexReady', { count: this.index.length, catalogCount: this.catalogIndex.length });
      return this.index;
    } catch (err) {
      console.error('[SearchEngine] Error cargando índice en memoria:', err);
      this.isLoaded = false;
      return [];
    }
  }

  normalize(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  hash(text) {
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 16777619);
    }
    return (value >>> 0).toString(36);
  }

  getGroupKey(song) {
    return `${this.normalize(song?.artist || 'Artista desconocido')}::${this.normalize(song?.title || 'Sin título')}`;
  }

  getContentSource(song) {
    if (song?.contentSource) return song.contentSource;
    if (song?.contentKind) return song.contentKind;
    return song?.hasCuratedLyrics ? 'curated_lyrics' : 'generated_chord_guide';
  }

  getVersionLabel(song, fallbackIndex = 0) {
    const explicitLabel = [song?.versionLabel, song?.versionName, song?.arrangement, song?.tabType, song?.version]
      .find((value) => value !== undefined && value !== null && String(value).trim());
    if (explicitLabel) return String(explicitLabel).trim();

    const fileLabel = String(song?.fileName || '').replace(/\.[^.]+$/, '').trim();
    if (fileLabel && this.normalize(fileLabel) !== this.normalize(song?.title)) return fileLabel;
    return `Versión ${fallbackIndex + 1}`;
  }

  createSearchDocument(song) {
    const fields = {
      title: this.normalize(song.title),
      artist: this.normalize(song.artist),
      genre: this.normalize(song.genre),
      tuning: this.normalize(song.tuning),
      fileName: this.normalize(song.fileName),
      version: this.normalize(this.getVersionLabel(song)),
    };
    const all = Object.values(fields).filter(Boolean).join(' ');
    return { ...fields, all, words: all.split(/\s+/).filter(Boolean) };
  }

  editDistanceWithin(left, right, maximum) {
    if (left === right) return 0;
    if (Math.abs(left.length - right.length) > maximum) return maximum + 1;

    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row += 1) {
      const current = [row];
      let rowMinimum = current[0];
      for (let column = 1; column <= right.length; column += 1) {
        const substitution = previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1);
        current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, substitution);
        rowMinimum = Math.min(rowMinimum, current[column]);
      }
      if (rowMinimum > maximum) return maximum + 1;
      previous = current;
    }
    return previous[right.length];
  }

  scoreToken(token, document) {
    if (document.title === token) return 44;
    if (document.artist === token) return 40;
    if (document.title.startsWith(token)) return 36;
    if (document.artist.startsWith(token)) return 34;
    if (document.all.includes(token)) return 28;

    let bestScore = 0;
    for (const word of document.words) {
      if (word.startsWith(token) || (token.length >= 4 && token.startsWith(word))) {
        bestScore = Math.max(bestScore, 24);
        continue;
      }
      const maximum = token.length <= 4 ? 1 : 2;
      const distance = this.editDistanceWithin(token, word, maximum);
      if (distance <= maximum) bestScore = Math.max(bestScore, 20 - (distance * 5));
    }
    return bestScore;
  }

  scoreSong(song, normalizedQuery) {
    if (!normalizedQuery) return 0;
    const document = this.searchDocuments.get(song) || this.createSearchDocument(song);
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    let score = 0;
    for (const token of tokens) {
      const tokenScore = this.scoreToken(token, document);
      if (tokenScore === 0) return -1;
      score += tokenScore;
    }
    if (document.title === normalizedQuery) score += 100;
    else if (document.title.startsWith(normalizedQuery)) score += 70;
    else if (document.title.includes(normalizedQuery)) score += 50;
    if (document.artist === normalizedQuery) score += 90;
    else if (document.artist.startsWith(normalizedQuery)) score += 60;
    else if (document.artist.includes(normalizedQuery)) score += 45;
    if (song.isFavorite) score += 3;
    return score;
  }

  compareSongs(left, right, sortBy, hasQuery) {
    if (hasQuery && left.__searchScore !== right.__searchScore) return right.__searchScore - left.__searchScore;
    if (sortBy === 'popular' || (!sortBy && !hasQuery)) {
      const leftKey = `${(left.title || '').toLowerCase()} ${(left.artist || '').toLowerCase()}`.trim();
      const rightKey = `${(right.title || '').toLowerCase()} ${(right.artist || '').toLowerCase()}`.trim();
      const leftRank = POPURRI_PRIORITY.indexOf(leftKey);
      const rightRank = POPURRI_PRIORITY.indexOf(rightKey);

      if (leftRank !== -1 && rightRank !== -1) return leftRank - rightRank;
      if (leftRank !== -1) return -1;
      if (rightRank !== -1) return 1;

      if (Boolean(left.hasCuratedLyrics) !== Boolean(right.hasCuratedLyrics)) {
        return left.hasCuratedLyrics ? -1 : 1;
      }
      const hLeft = Math.abs(this.hash((left.artist || '') + (left.title || ''))) % 997;
      const hRight = Math.abs(this.hash((right.artist || '') + (right.title || ''))) % 997;
      return hLeft - hRight;
    }
    if (sortBy === 'artist') {
      return (left.artist || '').localeCompare(right.artist || '', 'es', { sensitivity: 'base' })
        || (left.title || '').localeCompare(right.title || '', 'es', { sensitivity: 'base' });
    }
    if (sortBy === 'recent') return (right.addedAt || 0) - (left.addedAt || 0);
    if (sortBy === 'difficulty') {
      const rank = { Principiante: 1, Intermedio: 2, Avanzado: 3, Experto: 4 };
      const leftRank = rank[left.difficulty];
      const rightRank = rank[right.difficulty];
      if (leftRank === undefined && rightRank === undefined) return 0;
      if (leftRank === undefined) return 1;
      if (rightRank === undefined) return -1;
      return leftRank - rightRank;
    }
    return (left.title || '').localeCompare(right.title || '', 'es', { sensitivity: 'base' })
      || (left.artist || '').localeCompare(right.artist || '', 'es', { sensitivity: 'base' });
  }

  groupSongs(songs) {
    const grouped = new Map();
    for (const song of songs) {
      const groupKey = this.getGroupKey(song);
      if (!grouped.has(groupKey)) grouped.set(groupKey, []);
      grouped.get(groupKey).push(song);
    }

    return Array.from(grouped.entries()).map(([groupKey, groupedSongs]) => {
      const orderedVersions = [...groupedSongs].sort((left, right) => {
        const leftId = Number(left.id);
        const rightId = Number(right.id);
        if (Number.isFinite(leftId) && Number.isFinite(rightId)) return leftId - rightId;
        if (Number.isFinite(leftId)) return -1;
        if (Number.isFinite(rightId)) return 1;
        return String(left.id || '').localeCompare(String(right.id || ''));
      });
      const versions = orderedVersions.map((song, versionIndex) => ({
        ...song,
        versionGroup: groupKey,
        versionIndex,
        versionLabel: this.getVersionLabel(song, versionIndex),
        contentSource: this.getContentSource(song),
      }));
      const primaryVersion = versions[0];
      return {
        ...primaryVersion,
        isSongGroup: true,
        groupKey,
        versionGroup: groupKey,
        versionCount: versions.length,
        versions,
        primaryVersion,
        isFavorite: versions.some((version) => Boolean(version.isFavorite)),
        contentSources: [...new Set(versions.map((version) => version.contentSource))],
        genres: [...new Set(versions.map((version) => version.genre).filter(Boolean))],
        __searchScore: Math.max(...versions.map((version) => version.__searchScore || 0)),
      };
    });
  }

  getFacets(songs = this.index) {
    const genres = new Map();
    let favoriteCount = 0;
    let curatedCount = 0;
    let generatedCount = 0;
    const knownGenreLabels = {
      rock: 'Rock', pop: 'Pop', metal: 'Metal', blues: 'Blues', jazz: 'Jazz',
      acoustic: 'Acoustic', classical: 'Classical', indie: 'Indie', latin: 'Latin',
      country: 'Country', 'r b': 'R&B', folk: 'Folk',
    };
    for (const song of songs) {
      const rawGenre = String(song.genre || 'Sin género').trim();
      const genreKey = this.normalize(rawGenre) || 'sin genero';
      const currentGenre = genres.get(genreKey);
      const name = currentGenre?.name || knownGenreLabels[genreKey] || rawGenre;
      genres.set(genreKey, { name, count: (currentGenre?.count || 0) + 1 });
      if (song.isFavorite) favoriteCount += 1;
      if (this.getContentSource(song) === 'curated_lyrics') curatedCount += 1;
      else generatedCount += 1;
    }
    return {
      favoriteCount,
      curatedCount,
      generatedCount,
      genres: Array.from(genres.values())
        .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })),
    };
  }

  search({ query = '', filter = 'all', genre = 'all', difficulty = 'all', contentSource = 'all', sortBy = 'popular', groupBySong = false, includeCatalog = false, page = 1, pageSize = 50 } = {}) {
    if (!this.isLoaded) {
      return { results: [], groups: [], totalCount: 0, totalVersions: 0, totalPages: 1, facets: this.getFacets([]) };
    }

    const normalizedQuery = this.normalize(query);
    const sourceIndex = includeCatalog ? [...this.index, ...this.catalogIndex] : this.index;
    let results = sourceIndex.filter((song) => {
      if (filter === 'favorites' && !song.isFavorite) return false;
      if (genre !== 'all' && this.normalize(song.genre) !== this.normalize(genre)) return false;
      if (difficulty !== 'all' && this.normalize(song.difficulty) !== this.normalize(difficulty)) return false;
      if (contentSource !== 'all' && this.getContentSource(song) !== contentSource) return false;
      return true;
    });
    results = results
      .map((song) => ({ ...song, __searchScore: this.scoreSong(song, normalizedQuery) }))
      .filter((song) => !normalizedQuery || song.__searchScore >= 0)
      .sort((left, right) => this.compareSongs(left, right, sortBy, Boolean(normalizedQuery)));

    const groups = this.groupSongs(results)
      .sort((left, right) => this.compareSongs(left, right, sortBy, Boolean(normalizedQuery)));
    const collection = groupBySong ? groups : results;
    const safePageSize = Math.max(1, pageSize);
    const totalCount = collection.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (safePage - 1) * safePageSize;
    return {
      results: collection.slice(startIndex, startIndex + safePageSize),
      groups,
      totalCount,
      totalVersions: results.length,
      totalPages,
      facets: this.getFacets(sourceIndex),
    };
  }

  getGenresList() {
    return this.getFacets().genres.map(({ name }) => name);
  }
}

export const searchEngine = new SearchEngine();
export default searchEngine;
