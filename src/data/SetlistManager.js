/**
 * @file SetlistManager.js
 * @description Persistencia y flujo seguro de repertorios y sesiones de ensayo.
 */

import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { db } from './Database.js';
import { audioEngine } from '../core/AudioEngineV2.js';
import { toast } from '../ui/Toast.js';

const DEFAULT_COUNT_IN_SECONDS = 3;
const MAX_COUNT_IN_SECONDS = 30;
const MAX_CAPO_FRET = 24;

class SetlistManager {
  constructor() {
    this.setlists = [];
    this.activeSetlistId = null;
    this.activeSongIndex = -1;
    this.activeMode = null;
    this.manualAdvance = false;
    this.autoAdvanceTimer = null;
    this.autoAdvanceDelay = 3;
    this.countdownTimer = null;
    this.countdownResolve = null;
    this.rehearsalSession = null;
    this.writeQueues = new Map();
    this.unsubscribeCallbacks = [];
    this.isDestroyed = false;
    this.lastFinishedAt = 0;
    this.initEvents();
  }

  initEvents() {
    this.registerDatabaseEvents();
    this.unsubscribeCallbacks.push(events.on('playback:finished', () => this.handleSongFinished()));
    this.unsubscribeCallbacks.push(
      events.on('playback:state', ({ state: playbackState }) => {
        if (playbackState !== 'stopped') return;
        const playback = state.get('playback');
        if (playback.totalTime > 0 && playback.currentTime >= playback.totalTime - 500) {
          this.handleSongFinished();
        }
      })
    );
  }

  registerDatabaseEvents() {
    this.unsubscribeCallbacks.push(
      events.on('db:ready', async () => {
        await this.loadAllSetlists();
      })
    );
  }

  clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  normalizeSongMetadata(metadata = {}) {
    const rawCapo = metadata.capo;
    const parsedCapo = rawCapo === '' || rawCapo === null || rawCapo === undefined
      ? null
      : Number(rawCapo);
    const capo = Number.isInteger(parsedCapo) && parsedCapo >= 0 && parsedCapo <= MAX_CAPO_FRET
      ? parsedCapo
      : null;
    const rawDuration = Number(metadata.durationSeconds);
    const durationSeconds = Number.isFinite(rawDuration) && rawDuration > 0
      ? Math.round(rawDuration)
      : null;

    return {
      capo,
      tuning: typeof metadata.tuning === 'string' ? metadata.tuning.trim().slice(0, 80) : '',
      durationSeconds,
    };
  }

  normalizeSetlist(record = {}) {
    const songIds = [];
    const seenIds = new Set();
    for (const rawId of Array.isArray(record.songIds) ? record.songIds : []) {
      const songId = Number(rawId);
      if (!Number.isInteger(songId) || songId < 0 || seenIds.has(songId)) continue;
      seenIds.add(songId);
      songIds.push(songId);
    }

    const sourceMetadata = record.songMetadata && typeof record.songMetadata === 'object'
      ? record.songMetadata
      : {};
    const songMetadata = {};
    for (const songId of songIds) {
      songMetadata[String(songId)] = this.normalizeSongMetadata(sourceMetadata[String(songId)]);
    }

    const rawCountIn = Number(record.rehearsal?.countInSeconds);
    const countInSeconds = Number.isInteger(rawCountIn)
      ? Math.min(MAX_COUNT_IN_SECONDS, Math.max(0, rawCountIn))
      : DEFAULT_COUNT_IN_SECONDS;

    return {
      ...record,
      name: typeof record.name === 'string' && record.name.trim()
        ? record.name.trim().slice(0, 100)
        : 'Nuevo Repertorio',
      songIds,
      songMetadata,
      rehearsal: { countInSeconds, manualAdvance: true },
      createdAt: Number(record.createdAt) || Date.now(),
      updatedAt: Number(record.updatedAt) || Date.now(),
    };
  }

  emitUpdated() {
    events.emit('setlist:updated', this.setlists);
  }

  getSetlist(setlistId) {
    return this.setlists.find((setlist) => setlist.id === Number(setlistId)) || null;
  }

  async loadAllSetlists() {
    try {
      await db.init();
      if (!db.db || !db.db.objectStoreNames.contains('playlists')) {
        this.setlists = [];
        this.emitUpdated();
        return [];
      }

      const records = await new Promise((resolve, reject) => {
        const { tx, store } = db._transaction('playlists', 'readonly');
        let result = [];
        const request = store.getAll();
        request.onsuccess = () => { result = request.result || []; };
        request.onerror = () => reject(request.error || new Error('No se pudieron leer los repertorios.'));
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || new Error('Error leyendo los repertorios.'));
        tx.onabort = () => reject(tx.error || new Error('Lectura de repertorios cancelada.'));
      });

      this.setlists = records.map((record) => this.normalizeSetlist(record));
      this.emitUpdated();
      return this.setlists;
    } catch (error) {
      console.warn('[SetlistManager] Error cargando repertorios:', error);
      this.setlists = [];
      this.emitUpdated();
      return [];
    }
  }

  async createSetlist(name, songIds = [], { silent = false } = {}) {
    await db.init();
    const setlistRecord = this.normalizeSetlist({
      name,
      songIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const created = await new Promise((resolve, reject) => {
      const { tx, store } = db._transaction('playlists', 'readwrite');
      const request = store.add(setlistRecord);
      let createdId = null;
      request.onsuccess = () => { createdId = request.result; };
      request.onerror = () => reject(request.error || new Error('No se pudo crear el repertorio.'));
      tx.oncomplete = () => resolve({ ...setlistRecord, id: createdId });
      tx.onerror = () => reject(tx.error || new Error('Error creando el repertorio.'));
      tx.onabort = () => reject(tx.error || new Error('Creación de repertorio cancelada.'));
    });

    this.setlists.push(created);
    this.emitUpdated();
    if (!silent) toast.show(`Repertorio "${created.name}" creado`, 'success');
    return created;
  }

  async deleteSetlist(id) {
    const numericId = Number(id);
    await this.waitForPendingWrites(numericId);
    await db.init();
    await new Promise((resolve, reject) => {
      const { tx, store } = db._transaction('playlists', 'readwrite');
      const request = store.delete(numericId);
      request.onerror = () => reject(request.error || new Error('No se pudo eliminar el repertorio.'));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('Error eliminando el repertorio.'));
      tx.onabort = () => reject(tx.error || new Error('Eliminación de repertorio cancelada.'));
    });

    this.setlists = this.setlists.filter((setlist) => setlist.id !== numericId);
    if (this.activeSetlistId === numericId) this.stopActiveSetlist();
    this.emitUpdated();
    toast.show('Repertorio eliminado', 'info');
    return true;
  }

  enqueueWrite(setlistId, operation) {
    const numericId = Number(setlistId);
    const previous = this.writeQueues.get(numericId) || Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    const tracked = next.finally(() => {
      if (this.writeQueues.get(numericId) === tracked) this.writeQueues.delete(numericId);
    });
    this.writeQueues.set(numericId, tracked);
    return tracked;
  }

  async waitForPendingWrites(setlistId) {
    const pending = this.writeQueues.get(Number(setlistId));
    if (pending) await pending;
  }

  async persistRecord(setlist) {
    await db.init();
    const record = this.clone(this.normalizeSetlist(setlist));
    return new Promise((resolve, reject) => {
      const { tx, store } = db._transaction('playlists', 'readwrite');
      const request = store.put(record);
      request.onerror = () => reject(request.error || new Error('No se pudo guardar el repertorio.'));
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error || new Error('Error guardando el repertorio.'));
      tx.onabort = () => reject(tx.error || new Error('Guardado de repertorio cancelado.'));
    });
  }

  async updateSetlist(setlistId, mutate) {
    const numericId = Number(setlistId);
    let operationResult = false;
    await this.enqueueWrite(numericId, async () => {
      const current = this.getSetlist(numericId);
      if (!current) return;
      const draft = this.clone(this.normalizeSetlist(current));
      operationResult = await mutate(draft);
      if (operationResult === false) return;
      draft.updatedAt = Date.now();
      const persisted = await this.persistRecord(draft);
      const currentIndex = this.setlists.findIndex((setlist) => setlist.id === numericId);
      if (currentIndex !== -1) this.setlists.splice(currentIndex, 1, persisted);
      this.emitUpdated();
    });
    return operationResult;
  }

  async saveSetlist(setlist) {
    if (!setlist?.id) return false;
    return this.updateSetlist(setlist.id, (draft) => {
      Object.assign(draft, this.normalizeSetlist(setlist));
      return true;
    });
  }

  async renameSetlist(setlistId, name) {
    const cleanName = typeof name === 'string' ? name.trim().slice(0, 100) : '';
    if (!cleanName) return false;
    return this.updateSetlist(setlistId, (draft) => {
      draft.name = cleanName;
      return true;
    });
  }

  async addSongToSetlist(setlistId, songId, metadata = {}) {
    const numericSongId = Number(songId);
    if (!Number.isInteger(numericSongId) || numericSongId < 0) return false;
    const added = await this.updateSetlist(setlistId, (draft) => {
      if (draft.songIds.includes(numericSongId)) return false;
      draft.songIds.push(numericSongId);
      draft.songMetadata[String(numericSongId)] = this.normalizeSongMetadata(metadata);
      return true;
    });
    if (added) toast.show('Canción añadida al repertorio', 'success');
    return added;
  }

  async removeSongFromSetlist(setlistId, songId) {
    const numericSetlistId = Number(setlistId);
    const numericSongId = Number(songId);
    const setlistBefore = this.getSetlist(numericSetlistId);
    const removedIndex = setlistBefore?.songIds.indexOf(numericSongId) ?? -1;
    const removed = await this.updateSetlist(numericSetlistId, (draft) => {
      const index = draft.songIds.indexOf(numericSongId);
      if (index === -1) return false;
      draft.songIds.splice(index, 1);
      delete draft.songMetadata[String(numericSongId)];
      return true;
    });

    if (!removed) return false;
    if (this.activeSetlistId === numericSetlistId) {
      const active = this.getActiveSetlist();
      if (active.songIds.length === 0) {
        this.stopActiveSetlist();
      } else {
        if (removedIndex < this.activeSongIndex) this.activeSongIndex -= 1;
        else if (removedIndex === this.activeSongIndex) {
          this.activeSongIndex = Math.min(this.activeSongIndex, active.songIds.length - 1);
        }
        this.syncRehearsalIndex();
        this.emitActiveChanged();
      }
    }
    toast.show('Canción eliminada del repertorio', 'info');
    return true;
  }

  async moveSong(setlistId, fromIndex, toIndex) {
    const numericSetlistId = Number(setlistId);
    const setlistBefore = this.getSetlist(numericSetlistId);
    if (!setlistBefore) return false;
    const from = Number(fromIndex);
    const to = Number(toIndex);
    if (!Number.isInteger(from) || !Number.isInteger(to)) return false;
    if (from < 0 || from >= setlistBefore.songIds.length) return false;
    if (to < 0 || to >= setlistBefore.songIds.length || from === to) return false;
    const activeSongId = this.activeSetlistId === numericSetlistId
      ? setlistBefore.songIds[this.activeSongIndex]
      : null;

    const moved = await this.updateSetlist(numericSetlistId, (draft) => {
      const [songId] = draft.songIds.splice(from, 1);
      draft.songIds.splice(to, 0, songId);
      return true;
    });
    if (moved && activeSongId !== null) {
      this.activeSongIndex = this.getActiveSetlist().songIds.indexOf(activeSongId);
      this.syncRehearsalIndex();
      this.emitActiveChanged();
    }
    return moved;
  }

  async updateSongMetadata(setlistId, songId, metadata) {
    const numericSongId = Number(songId);
    return this.updateSetlist(setlistId, (draft) => {
      if (!draft.songIds.includes(numericSongId)) return false;
      draft.songMetadata[String(numericSongId)] = this.normalizeSongMetadata(metadata);
      return true;
    });
  }

  async updateRehearsalSettings(setlistId, settings = {}) {
    return this.updateSetlist(setlistId, (draft) => {
      const rawCountIn = Number(settings.countInSeconds);
      draft.rehearsal = {
        countInSeconds: Number.isInteger(rawCountIn)
          ? Math.min(MAX_COUNT_IN_SECONDS, Math.max(0, rawCountIn))
          : draft.rehearsal.countInSeconds,
        manualAdvance: true,
      };
      return true;
    });
  }

  getSongMetadata(setlistId, songId) {
    const setlist = this.getSetlist(setlistId);
    if (!setlist) return this.normalizeSongMetadata();
    return this.normalizeSongMetadata(setlist.songMetadata?.[String(Number(songId))]);
  }

  getDurationSummary(setlistId) {
    const setlist = this.getSetlist(setlistId);
    if (!setlist) {
      return { knownSeconds: 0, knownCount: 0, unknownCount: 0, totalCount: 0, isComplete: true };
    }
    let knownSeconds = 0;
    let knownCount = 0;
    for (const songId of setlist.songIds) {
      const duration = this.getSongMetadata(setlist.id, songId).durationSeconds;
      if (duration !== null) {
        knownSeconds += duration;
        knownCount += 1;
      }
    }
    return {
      knownSeconds,
      knownCount,
      unknownCount: setlist.songIds.length - knownCount,
      totalCount: setlist.songIds.length,
      isComplete: knownCount === setlist.songIds.length,
    };
  }

  getTransitionWarnings(setlistId, index, songsById = new Map()) {
    const setlist = this.getSetlist(setlistId);
    if (!setlist || index <= 0 || index >= setlist.songIds.length) return [];
    const previousId = setlist.songIds[index - 1];
    const currentId = setlist.songIds[index];
    const previousMeta = this.getSongMetadata(setlistId, previousId);
    const currentMeta = this.getSongMetadata(setlistId, currentId);
    const previousSong = songsById.get(previousId) || null;
    const currentSong = songsById.get(currentId) || null;
    const previousTuning = previousMeta.tuning || previousSong?.tuning || '';
    const currentTuning = currentMeta.tuning || currentSong?.tuning || '';
    const warnings = [];

    if (previousTuning && currentTuning && previousTuning !== currentTuning) {
      warnings.push(`Afinación: ${previousTuning} → ${currentTuning}`);
    }
    if (previousMeta.capo !== null && currentMeta.capo !== null && previousMeta.capo !== currentMeta.capo) {
      warnings.push(`Capo: ${previousMeta.capo === 0 ? 'sin capo' : `traste ${previousMeta.capo}`} → ${currentMeta.capo === 0 ? 'sin capo' : `traste ${currentMeta.capo}`}`);
    } else if (currentMeta.capo !== null && previousMeta.capo === null && currentMeta.capo > 0) {
      warnings.push(`Preparar capo en traste ${currentMeta.capo}`);
    }
    return warnings;
  }

  setActiveSetlist(setlistId, startIndex = 0, { mode = 'performance', manualAdvance = false } = {}) {
    const setlist = this.getSetlist(setlistId);
    if (!setlist) return false;
    this.cancelAutoAdvance();
    this.cancelCountdown(false);
    if (mode !== 'rehearsal') this.rehearsalSession = null;
    this.activeSetlistId = Number(setlistId);
    this.activeSongIndex = setlist.songIds.length
      ? Math.min(Math.max(Number(startIndex) || 0, 0), setlist.songIds.length - 1)
      : -1;
    this.activeMode = mode;
    this.manualAdvance = Boolean(manualAdvance);
    this.emitActiveChanged();
    return true;
  }

  emitActiveChanged() {
    events.emit('setlist:activeChanged', {
      setlistId: this.activeSetlistId,
      songIndex: this.activeSongIndex,
      mode: this.activeMode,
      manualAdvance: this.manualAdvance,
    });
  }

  stopActiveSetlist() {
    this.cancelAutoAdvance();
    this.cancelCountdown(false);
    this.activeSetlistId = null;
    this.activeSongIndex = -1;
    this.activeMode = null;
    this.manualAdvance = false;
    this.rehearsalSession = null;
    this.emitActiveChanged();
    events.emit('setlist:rehearsalUpdated', null);
  }

  getActiveSetlist() {
    return this.getSetlist(this.activeSetlistId);
  }

  syncRehearsalIndex() {
    if (this.rehearsalSession) this.rehearsalSession.index = this.activeSongIndex;
  }

  emitRehearsalUpdated() {
    events.emit('setlist:rehearsalUpdated', this.rehearsalSession ? { ...this.rehearsalSession } : null);
  }

  async startRehearsal(setlistId, startIndex = 0, countInSeconds = null) {
    const setlist = this.getSetlist(setlistId);
    if (!setlist || setlist.songIds.length === 0) return null;
    const configured = countInSeconds === null ? setlist.rehearsal.countInSeconds : Number(countInSeconds);
    const countIn = Number.isInteger(configured)
      ? Math.min(MAX_COUNT_IN_SECONDS, Math.max(0, configured))
      : DEFAULT_COUNT_IN_SECONDS;

    this.setActiveSetlist(setlist.id, startIndex, { mode: 'rehearsal', manualAdvance: true });
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.rehearsalSession = {
      token,
      setlistId: setlist.id,
      index: this.activeSongIndex,
      status: countIn > 0 ? 'countdown' : 'ready',
      remaining: countIn,
      total: countIn,
    };
    this.emitRehearsalUpdated();
    if (countIn === 0) {
      return { songId: setlist.songIds[this.activeSongIndex], index: this.activeSongIndex };
    }

    return new Promise((resolve) => {
      this.countdownResolve = resolve;
      const tick = () => {
        if (!this.rehearsalSession || this.rehearsalSession.token !== token || this.isDestroyed) {
          this.finishCountdown(null);
          return;
        }
        if (this.rehearsalSession.remaining <= 0) {
          this.rehearsalSession.status = 'ready';
          this.emitRehearsalUpdated();
          this.finishCountdown({ songId: setlist.songIds[this.activeSongIndex], index: this.activeSongIndex });
          return;
        }
        this.emitRehearsalUpdated();
        this.countdownTimer = setTimeout(() => {
          this.countdownTimer = null;
          if (this.rehearsalSession?.token === token) this.rehearsalSession.remaining -= 1;
          tick();
        }, 1000);
      };
      tick();
    });
  }

  finishCountdown(result) {
    if (this.countdownTimer !== null) clearTimeout(this.countdownTimer);
    this.countdownTimer = null;
    const resolve = this.countdownResolve;
    this.countdownResolve = null;
    if (resolve) resolve(result);
  }

  cancelCountdown(emit = true) {
    const wasCountingDown = this.rehearsalSession?.status === 'countdown';
    this.finishCountdown(null);
    if (wasCountingDown && this.rehearsalSession) {
      this.rehearsalSession.status = 'cancelled';
      this.rehearsalSession.remaining = 0;
      if (emit) this.emitRehearsalUpdated();
    }
  }

  endRehearsal() {
    if (this.activeMode !== 'rehearsal') return false;
    this.stopActiveSetlist();
    return true;
  }

  async selectActiveSong(index) {
    const setlist = this.getActiveSetlist();
    const targetIndex = Number(index);
    if (!setlist || !Number.isInteger(targetIndex)) return null;
    if (targetIndex < 0 || targetIndex >= setlist.songIds.length) return null;
    const expectedSetlistId = this.activeSetlistId;
    const song = await db.getSong(setlist.songIds[targetIndex]);
    if (!song || this.activeSetlistId !== expectedSetlistId || this.isDestroyed) return null;

    this.cancelAutoAdvance();
    this.activeSongIndex = targetIndex;
    if (this.rehearsalSession) {
      this.rehearsalSession.index = targetIndex;
      this.rehearsalSession.status = 'ready';
      this.rehearsalSession.remaining = 0;
      this.emitRehearsalUpdated();
    }
    this.emitActiveChanged();
    events.emit('setlist:songChanged', { song, index: targetIndex, manual: true });
    return { song, index: targetIndex };
  }

  async getNextSong() {
    const setlist = this.getActiveSetlist();
    if (!setlist || setlist.songIds.length === 0) return null;
    const nextIndex = this.activeSongIndex + 1;
    return nextIndex < setlist.songIds.length ? db.getSong(setlist.songIds[nextIndex]) : null;
  }

  async loadSongInPlayer(index, directionLabel = '') {
    const selected = await this.selectActiveSong(index);
    if (!selected?.song?.data) return false;
    if (!audioEngine.isInitialized || !audioEngine.api) {
      toast.show('El reproductor todavía no está listo', 'warning');
      return false;
    }
    const { song } = selected;
    state.set('activeSong', { id: song.id, title: song.title, artist: song.artist });
    audioEngine.load(song.data);
    if (directionLabel) toast.show(`${directionLabel}: ${song.title}`, 'info');
    return true;
  }

  async playNextSongInSetlist() {
    const setlist = this.getActiveSetlist();
    if (!setlist) return false;
    if (this.activeSongIndex + 1 >= setlist.songIds.length) {
      toast.show('Fin del repertorio', 'success');
      return false;
    }
    return this.loadSongInPlayer(this.activeSongIndex + 1, 'Siguiente tema');
  }

  async playPreviousSongInSetlist() {
    if (!this.getActiveSetlist() || this.activeSongIndex <= 0) return false;
    return this.loadSongInPlayer(this.activeSongIndex - 1, 'Tema anterior');
  }

  handleSongFinished() {
    const now = Date.now();
    if (now - this.lastFinishedAt < 350) return;
    this.lastFinishedAt = now;
    this.cancelAutoAdvance();
    const setlist = this.getActiveSetlist();
    if (this.isDestroyed || !setlist || this.activeSongIndex + 1 >= setlist.songIds.length) return;

    if (this.manualAdvance) {
      if (this.rehearsalSession) {
        this.rehearsalSession.status = 'awaiting-manual';
        this.emitRehearsalUpdated();
      }
      events.emit('setlist:manualAdvanceRequired', {
        setlistId: setlist.id,
        songIndex: this.activeSongIndex,
      });
      toast.show('Tema terminado. Avanza cuando estés listo.', 'info');
      return;
    }

    const expectedSetlistId = this.activeSetlistId;
    const expectedSongIndex = this.activeSongIndex;
    toast.show(`Siguiente tema en ${this.autoAdvanceDelay}s...`, 'info', 3000);
    this.autoAdvanceTimer = setTimeout(() => {
      this.autoAdvanceTimer = null;
      if (this.isDestroyed || this.activeSetlistId !== expectedSetlistId || this.activeSongIndex !== expectedSongIndex) return;
      this.playNextSongInSetlist();
    }, this.autoAdvanceDelay * 1000);
  }

  cancelAutoAdvance() {
    if (this.autoAdvanceTimer !== null) clearTimeout(this.autoAdvanceTimer);
    this.autoAdvanceTimer = null;
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.cancelAutoAdvance();
    this.cancelCountdown(false);
    this.unsubscribeCallbacks.splice(0).forEach((unsubscribe) => unsubscribe());
    this.writeQueues.clear();
    this.activeSetlistId = null;
    this.activeSongIndex = -1;
    this.activeMode = null;
    this.rehearsalSession = null;
  }
}

export const setlistManager = new SetlistManager();
export default setlistManager;
