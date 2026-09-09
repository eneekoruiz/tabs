const DB_NAME = 'tabs-chords-karaoke';
const STORE = 'backings';

export function karaokeSongKey(song, { legacy = false } = {}) {
  const normalize = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  const title = normalize(song?.title);
  const artist = normalize(song?.artist);
  const version = song?.recordingId || song?.versionId || (Number(song?.versionIndex) > 0 ? `version:${song.versionIndex}` : '');
  const suffix = !legacy && version ? `::version:${normalize(version)}` : '';
  if (title && artist) return JSON.stringify([artist, title]) + suffix;
  if (song?.id != null) return `id:${song.id}${suffix}`;
  if (title) return JSON.stringify(['', title]) + suffix;
  throw new Error('La cancion necesita un titulo o identificador estable.');
}

export class KaraokeBackingStore {
  async open() {
    if (this.connection) return this.connection;
    if (this.opening) return this.opening;
    this.opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      let blocked = false;
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' });
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        blocked = true;
        reject(new Error('Cierra las otras ventanas de la app y vuelve a importar la base.'));
      };
      request.onsuccess = () => {
        if (blocked) { request.result.close(); return; }
        this.connection = request.result;
        this.connection.onversionchange = () => this.close();
        resolve(this.connection);
      };
    }).finally(() => { this.opening = null; });
    return this.opening;
  }

  async transaction(mode, action) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('No se pudo guardar la base en este dispositivo.'));
      const request = action(tx.objectStore(STORE));
      request.onsuccess = () => { result = request.result; };
    });
  }

  get(song) { return this.transaction('readonly', store => store.get(karaokeSongKey(song))); }
  getLegacy(song) {
    const legacyKey = karaokeSongKey(song, { legacy: true });
    if (legacyKey === karaokeSongKey(song)) return Promise.resolve(null);
    return this.transaction('readonly', store => store.get(legacyKey));
  }
  put(song, record) {
    return this.transaction('readwrite', store => store.put({ ...record, key: karaokeSongKey(song) }));
  }
  remove(song) { return this.transaction('readwrite', store => store.delete(karaokeSongKey(song))); }
  async updateSettings(song, settings) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const request = store.get(karaokeSongKey(song));
      request.onsuccess = () => {
        store.put({ ...request.result, ...settings, key: karaokeSongKey(song) });
      };
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('No se pudo guardar el ajuste.'));
    });
  }
  close() { this.connection?.close(); this.connection = null; }
}
