/**
 * @file SearchEngine.js
 * @description Motor de búsqueda e indexación en memoria ultra-rápido (<5ms).
 * Soporta búsqueda de texto completo normalizado, filtros por género, dificultad, favoritos,
 * y paginación para soportar catálogos infinitos sin sobrecargar el DOM.
 */

import { db } from './Database.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';

class SearchEngine {
  constructor() {
    this.index = [];
    this.isLoaded = false;
  }

  async reloadIndex() {
    try {
      this.index = await db.getAllSongsMetadata();
      this.isLoaded = true;
      state.set('library', { totalSongs: this.index.length });
      events.emit('search:indexReady', { count: this.index.length });
      return this.index;
    } catch (err) {
      console.error('[SearchEngine] Error cargando índice en memoria:', err);
      return [];
    }
  }

  normalize(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/gi, ' ')
      .trim();
  }

  /**
   * Búsqueda multi-criterio con filtrado por género, dificultad y paginación.
   * @param {Object} options
   * @param {string} [options.query='']
   * @param {string} [options.filter='all'] - 'all' | 'favorites'
   * @param {string} [options.genre='all'] - 'all' | 'Rock' | 'Metal' | 'Blues' | 'Acoustic' | 'Classical' | 'Pop' | 'Jazz'
   * @param {string} [options.difficulty='all'] - 'all' | 'Principiante' | 'Intermedio' | 'Avanzado' | 'Experto'
   * @param {string} [options.sortBy='title']
   * @param {number} [options.page=1]
   * @param {number} [options.pageSize=50]
   * @returns {{ results: Array<Object>, totalCount: number, totalPages: number }}
   */
  search({ query = '', filter = 'all', genre = 'all', difficulty = 'all', sortBy = 'title', page = 1, pageSize = 50 } = {}) {
    if (!this.isLoaded) return { results: [], totalCount: 0, totalPages: 0 };

    let results = this.index;

    // 1. Filtro de Favoritos
    if (filter === 'favorites') {
      results = results.filter((song) => song.isFavorite);
    }

    // 2. Filtro de Género
    if (genre && genre !== 'all') {
      results = results.filter((song) => (song.genre || '').toLowerCase() === genre.toLowerCase());
    }

    // 3. Filtro de Dificultad
    if (difficulty && difficulty !== 'all') {
      results = results.filter((song) => (song.difficulty || '').toLowerCase() === difficulty.toLowerCase());
    }

    // 4. Búsqueda de Texto Completo
    const normalizedQuery = this.normalize(query);
    if (normalizedQuery) {
      const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

      results = results.filter((song) => {
        const targetString = this.normalize(`${song.title} ${song.artist} ${song.genre} ${song.tuning} ${song.fileName}`);
        return queryTokens.every((token) => targetString.includes(token));
      });
    }

    // 5. Ordenación
    results.sort((a, b) => {
      if (sortBy === 'artist') {
        const artistCmp = (a.artist || '').localeCompare(b.artist || '');
        if (artistCmp !== 0) return artistCmp;
        return (a.title || '').localeCompare(b.title || '');
      } else if (sortBy === 'recent') {
        return (b.addedAt || 0) - (a.addedAt || 0);
      } else if (sortBy === 'difficulty') {
        const diffRank = { 'Principiante': 1, 'Intermedio': 2, 'Avanzado': 3, 'Experto': 4 };
        return (diffRank[a.difficulty] || 2) - (diffRank[b.difficulty] || 2);
      } else {
        return (a.title || '').localeCompare(b.title || '');
      }
    });

    const totalCount = results.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    return {
      results: paginatedResults,
      totalCount,
      totalPages,
    };
  }

  getGenresList() {
    const genres = new Set(['Rock', 'Metal', 'Blues', 'Acoustic', 'Classical', 'Pop', 'Jazz']);
    for (const song of this.index) {
      if (song.genre) genres.add(song.genre);
    }
    return Array.from(genres);
  }
}

export const searchEngine = new SearchEngine();
export default searchEngine;
