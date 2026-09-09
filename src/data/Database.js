/**
 * Local persistence. Opening the database never rewrites or deletes user songs.
 */
import { events } from '../core/EventBus.js';
import { assessSong } from './catalog/CatalogQuality.js';

const DB_NAME = 'TabsAndChordsDB';
const DB_VERSION = 2;

function recordId(id) {
  return typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id;
}

function songRecord(input, existing = {}) {
  const song = { ...existing, ...input };
  const tempo = Number(song.tempo);
  return {
    ...song,
    title: song.title || song.fileName || 'Sin titulo',
    artist: song.artist || 'Artista desconocido',
    genre: song.genre || '',
    difficulty: song.difficulty || null,
    tuning: song.tuning || '',
    fileName: song.fileName || '',
    fileSize: song.data?.byteLength ?? song.data?.size ?? song.data?.length ?? song.fileSize ?? 0,
    tempo: Number.isFinite(tempo) && tempo > 0 ? tempo : null,
    tempoSource: song.tempoSource || (tempo > 0 ? 'user_supplied' : 'unknown'),
    timeSignature: song.timeSignature || null,
    tracksCount: song.tracksCount ?? null,
    lyricsChords: song.lyricsChords || '',
    contentSource: song.contentSource || (song.data || song.lyricsChords ? 'user_supplied' : 'metadata_only'),
    isFavorite: Boolean(song.isFavorite),
    addedAt: song.addedAt ?? Date.now(),
    lastOpenedAt: song.lastOpenedAt ?? null,
  };
}

export class Database {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  async init() {
    if (this.isInitialized && this.db) return this.db;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('songs')) {
          const songs = database.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
          for (const field of ['title', 'artist', 'genre', 'difficulty', 'isFavorite', 'addedAt']) {
            songs.createIndex(field, field, { unique: false });
          }
        }
        if (!database.objectStoreNames.contains('soundfonts')) database.createObjectStore('soundfonts', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('playlists')) database.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true });
        if (!database.objectStoreNames.contains('settings')) database.createObjectStore('settings', { keyPath: 'key' });
      };
      request.onsuccess = () => {
        const database = request.result;
        this.db = database;
        this.isInitialized = true;
        const disconnect = () => {
          if (this.db === database) {
            this.db = null;
            this.isInitialized = false;
          }
        };
        database.onversionchange = () => { database.close(); disconnect(); };
        database.onclose = disconnect;
        events.emit('db:ready', this);
        resolve(database);
      };
      request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento local.'));
      request.onblocked = () => events.emit('db:blocked');
    });
    try {
      return await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  _transaction(storeName, mode = 'readonly') {
    if (!this.db) throw new Error('Database no conectada.');
    try {
      const tx = this.db.transaction(storeName, mode);
      return { tx, store: tx.objectStore(storeName) };
    } catch (error) {
      if (error.name === 'InvalidStateError') {
        this.db = null;
        this.isInitialized = false;
      }
      throw error;
    }
  }

  async saveSong(songData) {
    await this.init();
    const saved = await new Promise((resolve, reject) => {
      const { tx, store } = this._transaction('songs', 'readwrite');
      let record;
      let id;
      tx.oncomplete = () => resolve({ ...record, id });
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('No se pudo guardar la cancion.'));
      const put = (existing) => {
        try {
          record = songRecord(songData, existing);
          if (songData.id !== undefined && songData.id !== null) record.id = recordId(songData.id);
          else delete record.id;
          const request = store.put(record);
          request.onsuccess = () => { id = request.result; };
        } catch (error) {
          tx.abort();
          reject(error);
        }
      };
      if (songData.id !== undefined && songData.id !== null) {
        const request = store.get(recordId(songData.id));
        request.onsuccess = () => put(request.result);
      } else put();
    });
    events.emit('db:songSaved', saved);
    return saved.id;
  }

  async saveSongsBatch(songsArray) {
    if (!Array.isArray(songsArray)) throw new TypeError('Se esperaba una lista de canciones.');
    await this.init();
    const count = await new Promise((resolve, reject) => {
      const { tx, store } = this._transaction('songs', 'readwrite');
      tx.oncomplete = () => resolve(songsArray.length);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('No se pudo guardar el lote.'));
      try {
        for (const song of songsArray) {
          const record = songRecord(song);
          if (record.id !== undefined && record.id !== null) record.id = recordId(record.id);
          else delete record.id;
          store.put(record);
        }
      } catch (error) {
        // A synchronous clone error must roll back earlier writes in the same batch.
        tx.abort();
        reject(error);
      }
    });
    events.emit('db:batchSaved', { count });
    return count;
  }

  async _read(storeName, id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const { tx, store } = this._transaction(storeName);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('No se pudo leer el almacenamiento local.'));
      const request = id === undefined ? store.getAll() : store.get(id);
      request.onsuccess = () => { result = request.result; };
    });
  }

  async getSong(id) {
    if (id === undefined || id === null || id === '') return null;
    return (await this._read('songs', recordId(id))) || null;
  }

  async getAllSongs() {
    return (await this._read('songs')) || [];
  }

  async getAllSongsMetadata() {
    await this.init();
    return new Promise((resolve, reject) => {
      const { tx, store } = this._transaction('songs');
      const songs = [];
      tx.oncomplete = () => resolve(songs);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('No se pudieron leer los metadatos.'));
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const { data, lyricsChords, ...metadata } = cursor.value;
        songs.push({
          ...metadata,
          quality: assessSong(cursor.value),
          hasLyrics: Boolean(lyricsChords?.trim()),
          hasScore: Boolean(data?.byteLength || data?.size || data?.length),
          isOfflineReady: Boolean(lyricsChords?.trim() || data?.byteLength || data?.size || data?.length),
          contentSource: metadata.contentSource || (data || lyricsChords ? 'user_supplied' : 'metadata_only'),
        });
        cursor.continue();
      };
    });
  }

  async deleteSong(id) {
    await this.init();
    await new Promise((resolve, reject) => {
      const { tx, store } = this._transaction('songs', 'readwrite');
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('No se pudo eliminar la cancion.'));
      store.delete(recordId(id));
    });
    events.emit('db:songDeleted', id);
    return true;
  }

  async toggleFavorite(id) {
    const song = await this.getSong(id);
    if (!song) return false;
    const isFavorite = !song.isFavorite;
    await this.saveSong({ ...song, isFavorite });
    events.emit('db:favoriteToggled', { id, isFavorite });
    return isFavorite;
  }

  async recordSongVisit(song) {
    if (!song) return;
    try {
      const visits = this.getRecentVisitedSongs();
      const sameSong = entry => entry.title === song.title && entry.artist === song.artist && entry.id === song.id;
      const existing = visits.find(sameSong);
      const { title, artist, genre, tuning, tempo, difficulty, id, contentSource } = song;
      visits.unshift({
        id, title, artist, genre, tuning, tempo, difficulty, contentSource,
        lastOpenedAt: Date.now(), playCount: (existing?.playCount || 0) + 1,
      });
      localStorage.setItem('app_recent_visited_songs', JSON.stringify([visits[0], ...visits.slice(1).filter(entry => !sameSong(entry))].slice(0, 40)));
    } catch (error) {
      console.warn('[Database] No se pudo guardar la visita:', error);
    }
  }

  getRecentVisitedSongs() {
    try {
      const visits = JSON.parse(localStorage.getItem('app_recent_visited_songs') || '[]');
      return Array.isArray(visits) ? visits.filter(entry => entry && typeof entry.title === 'string') : [];
    } catch { return []; }
  }

  getMostVisitedSongs() {
    return [...this.getRecentVisitedSongs()].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
  }

  async saveSoundFont(id, data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const { tx, store } = this._transaction('soundfonts', 'readwrite');
      tx.oncomplete = () => resolve(true);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('No se pudo guardar el SoundFont.'));
      store.put({ id, data, size: data.byteLength, cachedAt: Date.now() });
    });
  }

  async getSoundFont(id) {
    return (await this._read('soundfonts', id))?.data || null;
  }
}

export const db = new Database();
export default db;
