import { KaraokeBackingStore, karaokeSongKey } from '../data/KaraokeBackingStore.js';
import { PIANO_VOICINGS, NOTE_FREQ } from '../tools/chord/ChordDefinitions.js';
import { buildKaraokeTimeline, parseLrc, getKaraokeTempo } from './KaraokeTimeline.js';

const bounded = (value, min, max, fallback = min) => Number.isFinite(Number(value))
  ? Math.min(max, Math.max(min, Number(value))) : fallback;

// Chords and lyrics share one score-time timeline; harmony is never a vocal target.
export function buildChordBacking(song) {
  return buildKaraokeTimeline(song).chords.map(event => {
    const chord = event.chord.replace(/\/.*$/, '');
    const root = chord.match(/^[A-G][#b]?/)?.[0] || chord;
    const quality = chord.slice(root.length);
    // Prefer the exact verified voicing, then fall back to a verified root
    // voicing. This keeps generated practice audio musical for chords such as
    // add9, slash chords and uncommon extensions without inventing notes.
    const voicing = PIANO_VOICINGS[chord]
      || PIANO_VOICINGS[`${root}${/^(m(?!aj)|min)/.test(quality) ? 'm' : ''}`]
      || PIANO_VOICINGS[root]
      || [];
    const frequencies = voicing.map(note => NOTE_FREQ[note.key] * 2 ** (note.oct - 4)).filter(Number.isFinite);
    const bass = event.chord.match(/\/([A-G][#b]?)$/)?.[1];
    if (bass && frequencies.length && NOTE_FREQ[bass]) {
      let bassFrequency = NOTE_FREQ[bass] / 2;
      while (bassFrequency >= Math.min(...frequencies)) bassFrequency /= 2;
      frequencies.unshift(bassFrequency);
    }
    return {
      ...event,
      chord: event.chord,
      frequencies,
    };
  });
}

export class KaraokeBackingEngine {
  constructor({ store = new KaraokeBackingStore(), onChange = () => {}, onEnded = () => {} } = {}) {
    this.store = store;
    this.onChange = onChange;
    this.onEnded = onEnded;
    this.mode = 'local';
    this.volume = 0.65;
    this.offsetMs = 0;
    this.record = null;
    this.legacyRecord = null;
    this.media = null;
    this.generation = 0;
    this.transportGeneration = 0;
    this.playing = false;
    this.loading = false;
    this.error = '';
    this.position = 0;
    this.chords = [];
    this.voices = new Set();
    this.baseTempoBpm = 72;
    this.tempoBpm = 72;
    this.transposeSemitones = 0;
    this.chordSource = 'none';
  }

  get ready() { return !this.loading && (this.mode === 'local' ? Boolean(this.media) : this.durationMs > 0); }
  get playbackRate() { return this.tempoBpm / this.baseTempoBpm; }
  // Imported recordings keep their original pitch; only our synthesized voices transpose.
  get effectiveTranspose() { return this.mode === 'synth' ? this.transposeSemitones : 0; }
  get durationMs() {
    if (this.mode === 'local') return this.media ? this.media.audio.duration * 1000 : 0;
    return this.timeline?.durationMs || 0;
  }
  get currentTimeMs() {
    if (this.mode === 'local') return (this.media?.audio.currentTime || 0) * 1000;
    return Math.min(this.durationMs, this.position + (this.playing ? (this.context.currentTime - this.startedAt) * 1000 * this.playbackRate : 0));
  }
  get lyricTimeMs() { return this.currentTimeMs - (this.mode === 'local' ? this.offsetMs : 0); }
  notify() { this.onChange(this); }

  loadSong(song) {
    const key = karaokeSongKey(song);
    if (this.songKey === key && this.song === song) return this.songLoadPromise || Promise.resolve();
    this.songLoadPromise = this.loadSongData(song, key);
    return this.songLoadPromise;
  }

  async loadSongData(song, key) {
    const token = ++this.generation;
    this.pause();
    this.cancelCandidate?.();
    this.releaseMedia();
    this.song = song;
    this.songKey = key;
    this.record = null;
    this.legacyRecord = null;
    this.mode = 'local';
    this.position = 0;
    this.offsetMs = 0;
    this.volume = 0.65;
    this.baseTempoBpm = getKaraokeTempo(song?.tempo);
    this.tempoBpm = this.baseTempoBpm;
    this.transposeSemitones = 0;
    const chordText = String(song?.lyricsChords || song?.chordpro || '');
    this.chordSource = song?.contentSource === 'generated_chord_guide' || song?.isGenerated
      ? 'approximate'
      : (/\[[A-G][#b]?[^\]\s]*\]/.test(chordText) ? 'song' : 'approximate');
    this.chords = buildChordBacking(song);
    this.timeline = buildKaraokeTimeline(song);
    this.loading = true;
    this.error = '';
    this.notify();
    try {
      const record = await this.store.get(song);
      if (token !== this.generation) return;
      if (!record) {
        const legacy = await this.store.getLegacy?.(song);
        if (token !== this.generation) return;
        if (legacy?.blob || legacy?.lyricCues?.length) this.legacyRecord = legacy;
      }
      this.volume = bounded(record?.volume, 0, 1, 0.65);
      this.tempoBpm = bounded(record?.tempoBpm, 40, 220, this.baseTempoBpm);
      if (record?.lyricCues?.length) {
        song.lyricCues = record.lyricCues;
        this.timeline = buildKaraokeTimeline(song);
        this.chords = buildChordBacking(song);
      }
      if (record?.blob) {
        const media = await this.prepareMedia(record.blob);
        if (token !== this.generation) { this.releaseMedia(media); return; }
        this.record = record;
        this.media = media;
        this.volume = bounded(record.volume, 0, 1, 0.65);
        this.offsetMs = bounded(record.offsetMs, -600000, 600000);
        this.attachMedia();
      } else {
        // A song without an imported file starts with its tempo-aware
        // generated backing, so singing mode is useful on first launch.
        this.mode = 'synth';
      }
    } catch (error) {
      if (token === this.generation && error.name !== 'AbortError') {
        this.mode = 'synth';
        this.error = 'No se pudo recuperar la base guardada. Puedes practicar con la guía o volver a importarla.';
      }
    } finally {
      if (token === this.generation) { this.loading = false; this.notify(); }
    }
  }

  prepareMedia(blob) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const media = { audio, url: URL.createObjectURL(blob) };
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        audio.onloadedmetadata = audio.onerror = null;
        if (this.cancelCandidate === cancel) this.cancelCandidate = null;
        if (error) { this.releaseMedia(media); reject(error); }
        else resolve(media);
      };
      const cancel = () => finish(new DOMException('Carga cancelada', 'AbortError'));
      this.cancelCandidate = cancel;
      const timer = setTimeout(() => finish(new Error('El audio no responde. Prueba otro archivo.')), 15000);
      audio.preload = 'auto';
      audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) && audio.duration > 0
        ? null : new Error('El archivo no contiene una pista de audio reproducible.'));
      audio.onerror = () => finish(new Error('Formato de audio no compatible o archivo danado. Prueba WAV o MP3.'));
      audio.src = media.url;
      audio.load();
    });
  }

  async useLegacyRecording() {
    if (!this.legacyRecord || this.loading || !this.song) return false;
    const song = this.song;
    const token = this.generation;
    this.pause(); this.loading = true; this.notify();
    try {
      // Explicit association: retain the old unassigned record as a recoverable copy.
      await this.store.put(song, this.legacyRecord);
      if (token !== this.generation) return false;
      const transpose = this.transposeSemitones;
      await this.loadSongData(song, this.songKey);
      if (this.song !== song) return false;
      this.setTranspose(transpose);
      return !this.error;
    } catch (_) {
      if (token === this.generation) this.error = 'No se pudo asociar la base anterior. El archivo se conserva.';
      return false;
    } finally {
      if (this.song === song) { this.loading = false; this.notify(); }
    }
  }

  attachMedia() {
    const audio = this.media.audio;
    audio.volume = this.volume;
    audio.preservesPitch = true;
    audio.playbackRate = this.playbackRate;
    audio.ontimeupdate = () => this.notify();
    audio.onended = () => { this.pause(); this.onEnded(); };
    audio.onerror = () => { this.pause(); this.error = 'No se puede reproducir esta base. Vuelve a importarla.'; this.notify(); };
  }

  async importFile(file) {
    if (!this.song || this.loading) return false;
    if (!(file instanceof Blob) || !file.size || file.size > 100 * 1024 * 1024) {
      this.error = 'Elige un archivo de audio no vacio de hasta 100 MB.';
      this.notify();
      return false;
    }
    this.pause();
    const token = ++this.generation;
    const song = this.song;
    this.loading = true;
    this.error = '';
    this.notify();
    let media;
    try {
      media = await this.prepareMedia(file);
      if (token !== this.generation) return false;
      const record = { blob: file, name: file.name || 'Base local', volume: this.volume, offsetMs: 0,
        tempoBpm: this.tempoBpm, lyricCues: this.song.lyricCues || [] };
      await this.store.put(song, record);
      if (token !== this.generation) return false;
      this.releaseMedia();
      this.media = media;
      media = null;
      this.record = record;
      this.mode = 'local';
      this.offsetMs = 0;
      this.attachMedia();
      return true;
    } catch (error) {
      if (token === this.generation && error.name !== 'AbortError') {
        this.error = error.name === 'QuotaExceededError'
          ? 'No hay espacio disponible. La base anterior se conserva.' : error.message;
      }
      return false;
    } finally {
      if (media) this.releaseMedia(media);
      if (token === this.generation) { this.loading = false; this.notify(); }
    }
  }

  async removeFile() {
    if (!this.song || this.loading) return false;
    this.pause();
    const token = ++this.generation;
    this.loading = true;
    this.notify();
    try {
      // Removing an audio track must not remove separately imported lyrics.
      await this.store.updateSettings(this.song, { blob: null, name: null, offsetMs: 0 });
      if (token !== this.generation) return false;
      this.releaseMedia();
      this.record = null;
      this.mode = 'synth';
      this.position = 0;
      this.offsetMs = 0;
      this.error = '';
      return true;
    } catch (error) { if (token === this.generation) this.error = error.message; return false; }
    finally { if (token === this.generation) { this.loading = false; this.notify(); } }
  }

  setMode(mode) {
    if (!['local', 'synth'].includes(mode) || this.loading) return;
    this.pause();
    this.mode = mode;
    this.error = '';
    this.seek(0);
  }

  setTempoBpm(value) {
    const next = bounded(value, 40, 220, this.tempoBpm);
    const wasPlaying = this.playing;
    this.pause();
    this.tempoBpm = next;
    if (this.media) this.media.audio.playbackRate = this.playbackRate;
    if (wasPlaying) void this.play();
    this.notify();
  }

  setTranspose(value) {
    const next = Math.round(bounded(value, -12, 12, this.transposeSemitones));
    if (next === this.transposeSemitones) return;
    this.transposeSemitones = next;
    // Retune sounding and queued chord voices without restarting the transport.
    // The neutral count pulse deliberately stays at its original frequency.
    for (const voice of this.voices) {
      if (Number.isFinite(voice.baseFrequency)) {
        voice.frequency.setTargetAtTime(voice.baseFrequency * 2 ** (next / 12), this.context.currentTime, 0.012);
      }
    }
    this.notify();
  }

  async play() {
    if (!this.ready) return false;
    if (this.playing) return true;
    this.error = '';
    if (this.currentTimeMs >= this.durationMs) this.seek(0);
    const token = ++this.transportGeneration;
    try {
      if (this.mode === 'local') {
        await this.media.audio.play();
      } else {
        if (!this.context || this.context.state === 'closed') {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          this.context = new AudioCtx();
          this.master = this.context.createGain();
          this.master.connect(this.context.destination);
        }
        await this.context.resume();
        if (token !== this.transportGeneration) return false;
        this.master.gain.value = this.volume;
        this.startedAt = this.context.currentTime;
        this.nextBeat = Math.ceil(this.position / this.getBeatMs());
      }
      if (token !== this.transportGeneration) return false;
      this.playing = true;
      if (this.mode === 'synth') {
        this.schedule();
        this.timer = setInterval(() => this.schedule(), 25);
      }
      this.notify();
      return true;
    } catch (error) {
      if (token !== this.transportGeneration) return false;
      this.pause();
      this.error = error.name === 'NotAllowedError' ? 'Pulsa reproducir para autorizar el audio.' : 'No se pudo iniciar el audio. Vuelve a intentarlo.';
      this.notify();
      return false;
    }
  }

  pause() {
    if (this.mode === 'synth') this.position = this.currentTimeMs;
    this.transportGeneration++;
    this.playing = false;
    this.media?.audio.pause();
    clearInterval(this.timer);
    for (const voice of this.voices) { try { voice.stop(); } catch (_) {} }
    this.voices.clear();
    this.notify();
  }
  seek(ms) {
    const position = bounded(ms, 0, this.durationMs);
    if (this.mode === 'local' && this.media) this.media.audio.currentTime = position / 1000;
    else {
      const wasPlaying = this.playing;
      this.pause();
      this.position = position;
      if (wasPlaying) void this.play();
    }
    this.notify();
  }
  setVolume(value) {
    this.volume = bounded(value, 0, 1, this.volume);
    if (this.media) this.media.audio.volume = this.volume;
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.02);
    this.notify();
  }
  setOffsetMs(value) { this.offsetMs = bounded(value, -600000, 600000); this.notify(); }
  async saveSettings() {
    if (!this.song) return;
    const token = this.generation;
    try { await this.store.updateSettings(this.song, { volume: this.volume, offsetMs: this.offsetMs, tempoBpm: this.tempoBpm }); }
    catch (_) { if (token === this.generation) { this.error = 'No se pudo guardar el ajuste para la siguiente sesion.'; this.notify(); } }
  }

  async importLyrics(file) {
    if (!this.song || this.loading) return false;
    const song = this.song;
    const token = this.generation;
    this.loading = true;
    this.notify();
    try {
      if (!file?.size || file.size > 1024 * 1024) throw new Error('Elige un archivo LRC no vacío de hasta 1 MB.');
      const lyricCues = parseLrc(await file.text(), this.durationMs);
      if (token !== this.generation) return false;
      await this.store.updateSettings(song, { lyricCues });
      if (token !== this.generation) return false;
      this.pause();
      song.lyricCues = lyricCues;
      this.timeline = buildKaraokeTimeline(song);
      this.chords = buildChordBacking(song);
      this.error = '';
      this.notify();
      return true;
    } catch (error) {
      if (token === this.generation) { this.error = error.message; this.notify(); }
      return false;
    } finally {
      if (token === this.generation) { this.loading = false; this.notify(); }
    }
  }

  schedule() {
    if (!this.playing) return;
    const time = this.currentTimeMs;
    if (time >= this.durationMs) { this.pause(); this.onEnded(); return; }
    const beatMs = this.getBeatMs();
    // Do not replay missed beats after a background/throttled interval.
    this.nextBeat = Math.max(this.nextBeat, Math.ceil((time - 25 * this.playbackRate) / beatMs));
    while (this.nextBeat * beatMs < Math.min(this.durationMs, time + 120 * this.playbackRate)) {
      const beatTime = this.nextBeat * beatMs;
      const chord = this.chords.find(c => beatTime >= c.time && beatTime < c.time + c.duration);
      const beat = this.nextBeat++ % Math.ceil(this.timeline.beatsPerBar);
      const when = this.context.currentTime + Math.max(0, beatTime - time) / (1000 * this.playbackRate);
      const notes = chord ? (beat === 0 ? chord.frequencies : [chord.frequencies[beat % chord.frequencies.length]]) : [beat === 0 ? 880 : 660];
      notes.filter(Number.isFinite).forEach((frequency, index) => {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const start = when + index * 0.018;
        const end = start + (chord ? Math.min(1.8, beatMs / (1000 * this.playbackRate) * 2) : 0.06);
        osc.type = 'triangle';
        if (chord) osc.baseFrequency = frequency;
        osc.frequency.value = frequency * (chord ? 2 ** (this.transposeSemitones / 12) : 1);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.055, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(gain);
        gain.connect(this.master);
        this.voices.add(osc);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); this.voices.delete(osc); };
        osc.start(start);
        osc.stop(end + 0.02);
      });
    }
    this.notify();
  }

  getBeatMs() {
    return this.timeline?.beatMs || 60000 / this.baseTempoBpm;
  }

  releaseMedia(media = this.media) {
    if (!media) return;
    media.audio.onended = media.audio.ontimeupdate = media.audio.onerror = media.audio.onloadedmetadata = null;
    media.audio.pause();
    media.audio.removeAttribute('src');
    media.audio.load();
    URL.revokeObjectURL(media.url);
    if (this.media === media) this.media = null;
  }
  destroy() {
    this.generation++;
    this.pause();
    this.cancelCandidate?.();
    this.releaseMedia();
    this.context?.close().catch(() => {});
    this.store.close();
    this.onChange = this.onEnded = () => {};
  }
}
