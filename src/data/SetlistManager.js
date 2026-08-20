/**
 * @file SetlistManager.js
 * @description Gestor de repertorios (Setlists) para directos y ensayos.
 * Soporta creación, edición, ordenación de canciones y avance automático entre temas.
 */

import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { db } from './Database.js';
import { audioEngine } from '../core/AudioEngine.js';
import { toast } from '../ui/Toast.js';

class SetlistManager {
  constructor() {
    this.setlists = [];
    this.activeSetlistId = null;
    this.activeSongIndex = -1;
    this.autoAdvanceTimer = null;
    this.autoAdvanceDelay = 3; // Segundos entre temas en directo

    this.initEvents();
  }

  initEvents() {
    this.registerDatabaseEvents();

    // Avance automático cuando termina una partitura
    events.on('playback:finished', () => {
      this.handleSongFinished();
    });

    events.on('playback:state', ({ state: pState }) => {
      if (pState === 'stopped') {
        const curTime = state.get('playback').currentTime;
        const totTime = state.get('playback').totalTime;
        if (totTime > 0 && curTime >= totTime - 500) {
          this.handleSongFinished();
        }
      }
    });
  }

  registerDatabaseEvents() {
    events.on('db:ready', async () => {
      await this.loadAllSetlists();
    });
  }

  async loadAllSetlists() {
    try {
      await db.init();
      return new Promise((resolve) => {
        const tx = db._transaction('playlists', 'readonly');
        const req = tx.store.getAll();
        req.onsuccess = () => {
          this.setlists = req.result || [];
          if (this.setlists.length === 0) {
            // Crear setlist inicial por defecto para directos
            this.createSetlist('Repertorio Directo (Viernes)', [1, 2, 3]).then(created => {
              this.setlists = [created];
              events.emit('setlist:updated', this.setlists);
              resolve(this.setlists);
            });
          } else {
            events.emit('setlist:updated', this.setlists);
            resolve(this.setlists);
          }
        };
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      console.warn('[SetlistManager] Error cargando repertorios:', e);
      return [];
    }
  }

  async createSetlist(name, songIds = []) {
    await db.init();
    return new Promise((resolve, reject) => {
      const { store } = db._transaction('playlists', 'readwrite');
      const setlistRecord = {
        name: name.trim() || 'Nuevo Repertorio',
        songIds: songIds || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const req = store.add(setlistRecord);
      req.onsuccess = () => {
        setlistRecord.id = req.result;
        this.setlists.push(setlistRecord);
        events.emit('setlist:updated', this.setlists);
        toast.show(`Repertorio "${setlistRecord.name}" creado`, 'success');
        resolve(setlistRecord);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteSetlist(id) {
    await db.init();
    return new Promise((resolve, reject) => {
      const { store } = db._transaction('playlists', 'readwrite');
      const req = store.delete(Number(id));
      req.onsuccess = () => {
        this.setlists = this.setlists.filter(s => s.id !== Number(id));
        if (this.activeSetlistId === Number(id)) {
          this.activeSetlistId = null;
          this.activeSongIndex = -1;
        }
        events.emit('setlist:updated', this.setlists);
        toast.show('Repertorio eliminado', 'info');
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async addSongToSetlist(setlistId, songId) {
    const setlist = this.setlists.find(s => s.id === Number(setlistId));
    if (!setlist) return false;

    if (!setlist.songIds.includes(Number(songId))) {
      setlist.songIds.push(Number(songId));
      setlist.updatedAt = Date.now();
      await this.saveSetlist(setlist);
      toast.show('Canción añadida al repertorio', 'success');
      return true;
    }
    return false;
  }

  async removeSongFromSetlist(setlistId, songId) {
    const setlist = this.setlists.find(s => s.id === Number(setlistId));
    if (!setlist) return false;

    setlist.songIds = setlist.songIds.filter(id => id !== Number(songId));
    setlist.updatedAt = Date.now();
    await this.saveSetlist(setlist);
    toast.show('Canción eliminada del repertorio', 'info');
    return true;
  }

  async moveSong(setlistId, fromIndex, toIndex) {
    const setlist = this.setlists.find(s => s.id === Number(setlistId));
    if (!setlist || !setlist.songIds) return false;
    if (fromIndex < 0 || fromIndex >= setlist.songIds.length) return false;
    if (toIndex < 0 || toIndex >= setlist.songIds.length) return false;

    const [moved] = setlist.songIds.splice(fromIndex, 1);
    setlist.songIds.splice(toIndex, 0, moved);
    setlist.updatedAt = Date.now();
    await this.saveSetlist(setlist);
    return true;
  }

  async saveSetlist(setlist) {
    await db.init();
    return new Promise((resolve, reject) => {
      const { store } = db._transaction('playlists', 'readwrite');
      const req = store.put(setlist);
      req.onsuccess = () => {
        events.emit('setlist:updated', this.setlists);
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  }

  setActiveSetlist(setlistId, startIndex = 0) {
    this.activeSetlistId = Number(setlistId);
    this.activeSongIndex = startIndex;
    events.emit('setlist:activeChanged', {
      setlistId: this.activeSetlistId,
      songIndex: this.activeSongIndex,
    });
  }

  getActiveSetlist() {
    return this.setlists.find(s => s.id === this.activeSetlistId) || null;
  }

  async getNextSong() {
    const setlist = this.getActiveSetlist();
    if (!setlist || setlist.songIds.length === 0) return null;

    const nextIndex = this.activeSongIndex + 1;
    if (nextIndex < setlist.songIds.length) {
      const songId = setlist.songIds[nextIndex];
      return await db.getSong(songId);
    }
    return null;
  }

  async playNextSongInSetlist() {
    const setlist = this.getActiveSetlist();
    if (!setlist) return;

    if (this.activeSongIndex + 1 < setlist.songIds.length) {
      this.activeSongIndex++;
      const nextSongId = setlist.songIds[this.activeSongIndex];
      const nextSong = await db.getSong(nextSongId);

      if (nextSong && nextSong.data) {
        state.set('activeSong', { id: nextSong.id, title: nextSong.title, artist: nextSong.artist });
        audioEngine.load(nextSong.data);
        toast.show(`🎤 Siguiente tema: ${nextSong.title}`, 'info');
        events.emit('setlist:songChanged', { song: nextSong, index: this.activeSongIndex });
      }
    } else {
      toast.show('🎉 ¡Fin del repertorio en directo!', 'success');
    }
  }

  async playPreviousSongInSetlist() {
    const setlist = this.getActiveSetlist();
    if (!setlist) return;

    if (this.activeSongIndex > 0) {
      this.activeSongIndex--;
      const prevSongId = setlist.songIds[this.activeSongIndex];
      const prevSong = await db.getSong(prevSongId);

      if (prevSong && prevSong.data) {
        state.set('activeSong', { id: prevSong.id, title: prevSong.title, artist: prevSong.artist });
        audioEngine.load(prevSong.data);
        events.emit('setlist:songChanged', { song: prevSong, index: this.activeSongIndex });
      }
    }
  }

  handleSongFinished() {
    const setlist = this.getActiveSetlist();
    if (!setlist || this.activeSongIndex + 1 >= setlist.songIds.length) return;

    if (this.autoAdvanceTimer) clearTimeout(this.autoAdvanceTimer);

    toast.show(`Siguiente tema en ${this.autoAdvanceDelay}s...`, 'info', 3000);
    this.autoAdvanceTimer = setTimeout(() => {
      this.playNextSongInSetlist();
    }, this.autoAdvanceDelay * 1000);
  }
}

export const setlistManager = new SetlistManager();
export default setlistManager;
