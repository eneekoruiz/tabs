/**
 * @file Database.js
 * @description Capa de persistencia local IndexedDB con soporte para letras y acordes (lyricsChords)
 * y re-conexión automática ante fallos de conexión.
 */

import { events } from '../core/EventBus.js';
import { MEGA_CATALOG } from './CatalogDataset.js';
import { onlineSongProvider } from './OnlineSongProvider.js';

const DB_NAME = 'TabsAndChordsDB';
const DB_VERSION = 2;

class Database {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  async init() {
    if (this.isInitialized && this.db && !this._isClosing(this.db)) {
      return this.db;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    const initializationPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('songs')) {
          const songStore = db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
          songStore.createIndex('title', 'title', { unique: false });
          songStore.createIndex('artist', 'artist', { unique: false });
          songStore.createIndex('genre', 'genre', { unique: false });
          songStore.createIndex('difficulty', 'difficulty', { unique: false });
          songStore.createIndex('isFavorite', 'isFavorite', { unique: false });
          songStore.createIndex('addedAt', 'addedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('soundfonts')) {
          db.createObjectStore('soundfonts', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = async (e) => {
        const openedDb = e.target.result;
        this.db = openedDb;
        this.isInitialized = false;

        openedDb.onversionchange = () => {
          console.warn('[Database] Cambio de versión detectado, cerrando conexión...');
          openedDb.close();
          if (this.db === openedDb) {
            this.isInitialized = false;
            this.db = null;
          }
        };

        openedDb.onclose = () => {
          console.warn('[Database] Conexión IndexedDB cerrada.');
          if (this.db === openedDb) {
            this.isInitialized = false;
            this.db = null;
          }
        };

        try {
          await this._syncAndSeedCatalog();
          this.isInitialized = true;

          events.emit('db:ready', this);
          resolve(openedDb);
        } catch (error) {
          console.error('[Database] Error sincronizando el catálogo:', error);
          this.isInitialized = false;
          if (this.db === openedDb) {
            this.db = null;
          }
          openedDb.close();
          reject(error);
        }
      };

      request.onerror = (e) => {
        console.error('[Database] Error abriendo IndexedDB:', e.target.error);
        this.isInitialized = false;
        this.db = null;
        reject(e.target.error);
      };
    });

    this.initializationPromise = initializationPromise;
    try {
      return await initializationPromise;
    } finally {
      if (this.initializationPromise === initializationPromise) {
        this.initializationPromise = null;
      }
    }
  }

  _isClosing(db) {
    try {
      return !db || !db.objectStoreNames;
    } catch (e) {
      return true;
    }
  }

  /**
   * Sincroniza y actualiza todas las canciones de IndexedDB con las letras oficiales reales.
   */
  async _syncAndSeedCatalog() {
    return new Promise((resolve, reject) => {
      try {
        const { tx, store } = this._transaction('songs', 'readwrite');
        const req = store.getAll();

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Error sincronizando el catálogo.'));
        tx.onabort = () => reject(tx.error || new Error('Sincronización del catálogo abortada.'));

        req.onerror = () => reject(req.error || new Error('No se pudo leer el catálogo local.'));
        req.onsuccess = () => {
          try {
            const existingSongs = req.result || [];
            const existingByTitle = new Map(existingSongs.map(s => [s.title.toLowerCase(), s]));

            // Actualizar letras oficiales para canciones existentes
            for (const song of existingSongs) {
              const catalogItem = MEGA_CATALOG.find(m => m.title.toLowerCase() === song.title.toLowerCase());
              const knownLyrics = catalogItem?.lyricsChords || onlineSongProvider.getKnownSongLyrics(song.title, song.artist);
              const contentSource = song.contentSource || (knownLyrics ? 'curated_lyrics' : 'generated_chord_guide');

              if ((knownLyrics && song.lyricsChords !== knownLyrics) || song.contentSource !== contentSource) {
                if (knownLyrics) song.lyricsChords = knownLyrics;
                song.contentSource = contentSource;
                if (catalogItem?.data) song.data = catalogItem.data;
                store.put(song);
              }
            }

            // Insertar canciones faltantes del catálogo
            for (const item of MEGA_CATALOG) {
              if (!existingByTitle.has(item.title.toLowerCase())) {
                const record = {
                  title: item.title,
                  artist: item.artist,
                  genre: item.genre || 'Rock',
                  difficulty: item.difficulty || 'Intermedio',
                  tuning: item.tuning || 'Standard E',
                  fileName: `${item.title}.alphatex`,
                  tempo: item.tempo || 120,
                  timeSignature: item.timeSignature || '4/4',
                  tracksCount: item.tracksCount || 1,
                  data: item.data,
                  lyricsChords: item.lyricsChords || '',
                  contentSource: item.contentSource || (item.lyricsChords ? 'curated_lyrics' : 'generated_chord_guide'),
                  isFavorite: false,
                  addedAt: Date.now(),
                };
                store.add(record);
              }
            }
          } catch (error) {
            try {
              tx.abort();
            } catch (abortError) {
              console.warn('[Database] No se pudo abortar la sincronización:', abortError);
            }
            reject(error);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  _transaction(storeName, mode = 'readonly') {
    if (!this.db || this._isClosing(this.db)) {
      throw new Error('Database no conectada.');
    }
    const tx = this.db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    return { tx, store };
  }

  async saveSong(songData) {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const { tx, store } = this._transaction('songs', 'readwrite');

        const record = {
          title: songData.title || songData.fileName || 'Sin título',
          artist: songData.artist || 'Artista desconocido',
          genre: songData.genre || 'Rock',
          difficulty: songData.difficulty || 'Intermedio',
          tuning: songData.tuning || 'Standard E',
          fileName: songData.fileName || 'tablatura.gp',
          fileSize: songData.data ? (songData.data.byteLength || songData.data.length || 0) : 0,
          tempo: songData.tempo || 120,
          timeSignature: songData.timeSignature || '4/4',
          tracksCount: songData.tracksCount || 1,
          data: songData.data,
          lyricsChords: songData.lyricsChords || '',
          isFavorite: songData.isFavorite || false,
          addedAt: songData.addedAt || Date.now(),
          lastOpenedAt: Date.now(),
        };

        if (songData.contentSource) {
          record.contentSource = songData.contentSource;
        }

        if (songData.id) {
          record.id = songData.id;
        }

        let savedId = null;
        const req = store.put(record);
        req.onsuccess = () => { savedId = req.result; };
        req.onerror = () => reject(req.error || new Error('No se pudo guardar la canción.'));
        tx.oncomplete = () => {
          events.emit('db:songSaved', { ...record, id: savedId });
          resolve(savedId);
        };
        tx.onerror = () => reject(tx.error || new Error('Error guardando la canción.'));
        tx.onabort = () => reject(tx.error || new Error('Guardado de canción abortado.'));
      } catch (err) {
        reject(err);
      }
    });
  }

  async saveSongsBatch(songsArray) {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const { tx, store } = this._transaction('songs', 'readwrite');
        let count = 0;

        tx.oncomplete = () => {
          events.emit('db:batchSaved', { count });
          resolve(count);
        };
        tx.onerror = () => reject(tx.error || new Error('Error guardando el lote de canciones.'));
        tx.onabort = () => reject(tx.error || new Error('Guardado del lote abortado.'));

        for (const song of songsArray) {
          const record = {
            title: song.title || song.fileName || 'Sin título',
            artist: song.artist || 'Desconocido',
            genre: song.genre || 'Rock',
            difficulty: song.difficulty || 'Intermedio',
            tuning: song.tuning || 'Standard E',
            fileName: song.fileName || 'tab.gp',
            fileSize: song.data ? (song.data.byteLength || song.data.length || 0) : 0,
            tempo: song.tempo || 120,
            timeSignature: song.timeSignature || '4/4',
            tracksCount: song.tracksCount || 1,
            data: song.data,
            lyricsChords: song.lyricsChords || '',
            isFavorite: !!song.isFavorite,
            addedAt: Date.now(),
            lastOpenedAt: null,
          };
          if (song.contentSource) {
            record.contentSource = song.contentSource;
          }
          store.put(record);
          count++;
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  async getSong(id) {
    const numericId = Number(id);
    const catalogMatch = Number.isInteger(numericId) && numericId > 0
      ? MEGA_CATALOG.find(item => Number(item.id) === numericId) || MEGA_CATALOG[numericId - 1] || null
      : null;
    const catalogSong = catalogMatch
      ? {
          ...catalogMatch,
          contentSource: catalogMatch.contentSource || (catalogMatch.lyricsChords ? 'curated_lyrics' : 'generated_chord_guide'),
        }
      : null;

    try {
      await this.init();
      return await new Promise((resolve, reject) => {
        try {
          const { tx, store } = this._transaction('songs', 'readonly');
          let result = catalogSong;

          tx.oncomplete = () => resolve(result);
          tx.onerror = () => reject(tx.error || new Error('Error leyendo la canción.'));
          tx.onabort = () => reject(tx.error || new Error('Lectura de canción abortada.'));

          const req = store.get(numericId);
          req.onsuccess = () => {
            const song = req.result || null;
            if (song) {
              const catalogItem = MEGA_CATALOG.find(m => m.title.toLowerCase() === song.title.toLowerCase());
              const officialLyrics = catalogItem?.lyricsChords || onlineSongProvider.getKnownSongLyrics(song.title, song.artist);

              if (officialLyrics) {
                song.lyricsChords = officialLyrics;
              }
              if (catalogItem?.data && (!song.data || typeof song.data !== 'string' || song.data.length < 5)) {
                song.data = catalogItem.data;
              }
            }
            result = song || catalogSong;
          };
          req.onerror = () => reject(req.error || new Error('No se pudo leer la canción.'));
        } catch (txErr) {
          reject(txErr);
        }
      });
    } catch (err) {
      console.warn('[Database] Error en getSong, usando fallback:', err);
      return catalogSong;
    }
  }

  async recordSongVisit(song) {
    if (!song) return;
    try {
      const visits = JSON.parse(localStorage.getItem('app_recent_visited_songs') || '[]');
      const existing = visits.find(v => (v.title.toLowerCase() === song.title.toLowerCase() && (v.artist || '').toLowerCase() === (song.artist || '').toLowerCase()));
      const currentPlayCount = existing ? (existing.playCount || 1) + 1 : 1;

      const filtered = visits.filter(v => !(v.title.toLowerCase() === song.title.toLowerCase() && (v.artist || '').toLowerCase() === (song.artist || '').toLowerCase()));
      filtered.unshift({
        id: song.id,
        title: song.title,
        artist: song.artist,
        genre: song.genre || 'Pop',
        tuning: song.tuning || 'Standard E',
        tempo: song.tempo || 120,
        difficulty: song.difficulty || 'Intermedio',
        lastOpenedAt: Date.now(),
        playCount: currentPlayCount
      });
      localStorage.setItem('app_recent_visited_songs', JSON.stringify(filtered.slice(0, 40)));
    } catch(e) {}
  }

  getRecentVisitedSongs() {
    try {
      return JSON.parse(localStorage.getItem('app_recent_visited_songs') || '[]');
    } catch(e) { return []; }
  }

  getMostVisitedSongs() {
    try {
      const songs = this.getRecentVisitedSongs();
      return [...songs].sort((a, b) => (b.playCount || 1) - (a.playCount || 1));
    } catch(e) { return []; }
  }

  async getAllSongs() {
    try {
      await this.init();
      return await new Promise((resolve, reject) => {
        try {
          const { tx, store } = this._transaction('songs', 'readonly');
          let songs = MEGA_CATALOG;

          tx.oncomplete = () => resolve(songs);
          tx.onerror = () => reject(tx.error || new Error('Error leyendo el catálogo local.'));
          tx.onabort = () => reject(tx.error || new Error('Lectura del catálogo abortada.'));

          const req = store.getAll();
          req.onsuccess = () => { songs = req.result || MEGA_CATALOG; };
          req.onerror = () => reject(req.error || new Error('No se pudo leer el catálogo local.'));
        } catch (e) {
          reject(e);
        }
      });
    } catch (err) {
      return MEGA_CATALOG;
    }
  }

  async getAllSongsMetadata() {
    try {
      await this.init();
      return await new Promise((resolve, reject) => {
        try {
          const { tx, store } = this._transaction('songs', 'readonly');
          const songs = [];

          tx.oncomplete = () => resolve(songs);
          tx.onerror = () => reject(tx.error || new Error('Error leyendo los metadatos.'));
          tx.onabort = () => reject(tx.error || new Error('Lectura de metadatos abortada.'));

          const req = store.openCursor();
          req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const { id, title, artist, genre, difficulty, tuning, fileName, tempo, timeSignature, tracksCount, isFavorite, addedAt, fileSize, contentSource } = cursor.value;
              songs.push({
                id,
                title,
                artist,
                genre: genre || 'Rock',
                difficulty: difficulty || 'Intermedio',
                tuning: tuning || 'Standard E',
                fileName,
                tempo,
                timeSignature,
                tracksCount,
                isFavorite,
                addedAt,
                fileSize,
                contentSource,
              });
              cursor.continue();
            }
          };
          req.onerror = () => reject(req.error || new Error('No se pudieron leer los metadatos.'));
        } catch (txErr) {
          reject(txErr);
        }
      });
    } catch (err) {
      return MEGA_CATALOG.map((m, idx) => ({
        ...m,
        id: idx + 1,
        contentSource: m.contentSource || (m.lyricsChords ? 'curated_lyrics' : 'generated_chord_guide'),
      }));
    }
  }

  async deleteSong(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const { tx, store } = this._transaction('songs', 'readwrite');
      const req = store.delete(Number(id));
      req.onerror = () => reject(req.error || new Error('No se pudo eliminar la canción.'));
      tx.oncomplete = () => {
        events.emit('db:songDeleted', id);
        resolve(true);
      };
      tx.onerror = () => reject(tx.error || new Error('Error eliminando la canción.'));
      tx.onabort = () => reject(tx.error || new Error('Eliminación de canción abortada.'));
    });
  }

  async toggleFavorite(id) {
    const song = await this.getSong(id);
    if (!song) return false;
    song.isFavorite = !song.isFavorite;
    await this.saveSong(song);
    events.emit('db:favoriteToggled', { id, isFavorite: song.isFavorite });
    return song.isFavorite;
  }

  async saveSoundFont(id, data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const { tx, store } = this._transaction('soundfonts', 'readwrite');
      const req = store.put({
        id,
        data,
        size: data.byteLength,
        cachedAt: Date.now(),
      });
      req.onerror = () => reject(req.error || new Error('No se pudo guardar el SoundFont.'));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('Error guardando el SoundFont.'));
      tx.onabort = () => reject(tx.error || new Error('Guardado de SoundFont abortado.'));
    });
  }

  async getSoundFont(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const { tx, store } = this._transaction('soundfonts', 'readonly');
      let soundFont = null;

      tx.oncomplete = () => resolve(soundFont);
      tx.onerror = () => reject(tx.error || new Error('Error leyendo el SoundFont.'));
      tx.onabort = () => reject(tx.error || new Error('Lectura de SoundFont abortada.'));

      const req = store.get(id);
      req.onsuccess = () => {
        soundFont = req.result ? req.result.data : null;
      };
      req.onerror = () => reject(req.error || new Error('No se pudo leer el SoundFont.'));
    });
  }
}

export const db = new Database();
export default db;
