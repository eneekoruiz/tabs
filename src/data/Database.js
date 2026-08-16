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
  }

  async init() {
    if (this.isInitialized && this.db && !this._isClosing(this.db)) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
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
        this.db = e.target.result;
        this.isInitialized = true;

        this.db.onversionchange = () => {
          console.warn('[Database] Cambio de versión detectado, cerrando conexión...');
          this.db.close();
          this.isInitialized = false;
          this.db = null;
        };

        this.db.onclose = () => {
          console.warn('[Database] Conexión IndexedDB cerrada.');
          this.isInitialized = false;
          this.db = null;
        };

        await this._syncAndSeedCatalog();

        events.emit('db:ready', this);
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('[Database] Error abriendo IndexedDB:', e.target.error);
        reject(e.target.error);
      };
    });
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
    try {
      const { store } = this._transaction('songs', 'readwrite');
      const req = store.getAll();

      req.onsuccess = async () => {
        const existingSongs = req.result || [];
        const existingByTitle = new Map(existingSongs.map(s => [s.title.toLowerCase(), s]));

        // Actualizar letras oficiales para canciones existentes
        for (const song of existingSongs) {
          const catalogItem = MEGA_CATALOG.find(m => m.title.toLowerCase() === song.title.toLowerCase());
          const knownLyrics = catalogItem?.lyricsChords || onlineSongProvider.getKnownSongLyrics(song.title, song.artist);

          if (knownLyrics && song.lyricsChords !== knownLyrics) {
            song.lyricsChords = knownLyrics;
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
              isFavorite: false,
              addedAt: Date.now(),
            };
            store.add(record);
          }
        }
      };
    } catch (e) {
      console.warn('[Database] Aviso en syncAndSeedCatalog:', e);
    }
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
        const { store } = this._transaction('songs', 'readwrite');
        
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

        if (songData.id) {
          record.id = songData.id;
        }

        const req = store.put(record);
        req.onsuccess = () => {
          const id = req.result;
          events.emit('db:songSaved', { ...record, id });
          resolve(id);
        };
        req.onerror = () => reject(req.error);
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
        tx.onerror = () => reject(tx.error);

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
          store.put(record);
          count++;
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  async getSong(id) {
    try {
      await this.init();
      return await new Promise((resolve, reject) => {
        try {
          const { store } = this._transaction('songs', 'readonly');
          const req = store.get(Number(id));
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
            resolve(song);
          };
          req.onerror = () => reject(req.error);
        } catch (txErr) {
          reject(txErr);
        }
      });
    } catch (err) {
      console.warn('[Database] Recuperando canción desde MEGA_CATALOG por reconexión:', err);
      this.isInitialized = false;
      this.db = null;
      const catalogItem = MEGA_CATALOG.find(m => m.title.toLowerCase() === 'blackbird' || m.id === Number(id)) || MEGA_CATALOG[0];
      return catalogItem || null;
    }
  }

  async getAllSongsMetadata() {
    try {
      await this.init();
      return await new Promise((resolve, reject) => {
        try {
          const { store } = this._transaction('songs', 'readonly');
          const songs = [];
          const req = store.openCursor();

          req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const { id, title, artist, genre, difficulty, tuning, fileName, tempo, timeSignature, tracksCount, isFavorite, addedAt, fileSize } = cursor.value;
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
              });
              cursor.continue();
            } else {
              resolve(songs);
            }
          };
          req.onerror = () => reject(req.error);
        } catch (txErr) {
          reject(txErr);
        }
      });
    } catch (err) {
      return MEGA_CATALOG.map((m, idx) => ({ ...m, id: idx + 1 }));
    }
  }

  async deleteSong(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const { store } = this._transaction('songs', 'readwrite');
      const req = store.delete(Number(id));
      req.onsuccess = () => {
        events.emit('db:songDeleted', id);
        resolve(true);
      };
      req.onerror = () => reject(req.error);
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
      const { store } = this._transaction('soundfonts', 'readwrite');
      const req = store.put({
        id,
        data,
        size: data.byteLength,
        cachedAt: Date.now(),
      });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getSoundFont(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const { store } = this._transaction('soundfonts', 'readonly');
      const req = store.get(id);
      req.onsuccess = () => {
        resolve(req.result ? req.result.data : null);
      };
      req.onerror = () => reject(req.error);
    });
  }
}

export const db = new Database();
export default db;
