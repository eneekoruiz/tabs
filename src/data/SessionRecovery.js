/**
 * Persists the last music workspace without coupling it to the database layer.
 * Score payloads are normalized to JSON-safe data so the exact arrangement can
 * be loaded back into AudioEngineV2 after the player becomes ready.
 */

const STORAGE_KEY = 'tabs_chords_music_session_v1';
const SCHEMA_VERSION = 1;
const MAX_LYRICS_LENGTH = 600000;
const MAX_SCORE_BYTES = 2000000;
const MAX_VERSIONS = 24;

const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const boundedString = (value, maxLength = 500) => {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLength);
};

const bytesToBase64 = (bytes) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return globalThis.btoa(binary);
};

const base64ToBytes = (value) => {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const sanitizeScoreData = (data) => {
  if (typeof data === 'string') {
    return data.length <= MAX_LYRICS_LENGTH ? data : undefined;
  }

  let bytes = null;
  if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
  else if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  else if (Array.isArray(data)) bytes = new Uint8Array(data);

  if (!bytes || bytes.byteLength === 0 || bytes.byteLength > MAX_SCORE_BYTES) return undefined;
  try {
    return { encoding: 'base64', value: bytesToBase64(bytes) };
  } catch (error) {
    console.warn('[SessionRecovery] No se pudo serializar la partitura:', error);
    return undefined;
  }
};

const restoreScoreData = (data) => {
  if (typeof data === 'string') return data;
  if (data?.encoding !== 'base64' || typeof data.value !== 'string') return undefined;
  try {
    const bytes = base64ToBytes(data.value);
    return bytes.byteLength <= MAX_SCORE_BYTES ? bytes : undefined;
  } catch (error) {
    console.warn('[SessionRecovery] No se pudo reconstruir la partitura:', error);
    return undefined;
  }
};

const restoreVersionData = (version) => {
  if (!version || typeof version !== 'object') return version;
  return { ...version, data: restoreScoreData(version.data) };
};

const restoreSongData = (song) => {
  if (!song || typeof song !== 'object') return song;
  const versionGroup = song.versionGroup && typeof song.versionGroup === 'object'
    ? {
        ...song.versionGroup,
        versions: Array.isArray(song.versionGroup.versions)
          ? song.versionGroup.versions.map(restoreVersionData)
          : song.versionGroup.versions
      }
    : song.versionGroup;

  return {
    ...song,
    data: restoreScoreData(song.data),
    versions: Array.isArray(song.versions) ? song.versions.map(restoreVersionData) : song.versions,
    versionGroup
  };
};

const sanitizeVersion = (version, index) => {
  if (typeof version === 'string' || typeof version === 'number') {
    return { versionId: String(version), versionName: String(version) };
  }
  if (!version || typeof version !== 'object' || Array.isArray(version)) return null;

  return {
    id: version.id ?? null,
    versionId: version.versionId ?? version.id ?? `version-${index + 1}`,
    versionName: boundedString(
      version.versionName || version.label || version.name || version.arrangement || version.version,
      120
    ),
    title: boundedString(version.title, 240),
    artist: boundedString(version.artist, 240),
    album: boundedString(version.album, 240),
    tuning: boundedString(version.tuning, 80),
    instrument: boundedString(version.instrument, 40),
    difficulty: boundedString(version.difficulty, 80),
    tempo: finiteNumber(version.tempo, 0),
    timeSignature: boundedString(version.timeSignature, 20),
    capo: Math.max(0, Math.min(12, finiteNumber(version.capo ?? version.capoFret, 0))),
    contentSource: boundedString(version.contentSource, 80),
    lyricsChords: boundedString(
      version.lyricsChords || version.chordpro || version.lyrics,
      MAX_LYRICS_LENGTH
    ),
    data: sanitizeScoreData(version.data)
  };
};

const sanitizeVersionGroup = (versionGroup) => {
  if (typeof versionGroup === 'string' || typeof versionGroup === 'number') {
    return String(versionGroup);
  }
  if (Array.isArray(versionGroup)) {
    return {
      id: null,
      name: '',
      versions: versionGroup.slice(0, MAX_VERSIONS).map(sanitizeVersion).filter(Boolean)
    };
  }
  if (!versionGroup || typeof versionGroup !== 'object') return null;

  const versions = Array.isArray(versionGroup.versions)
    ? versionGroup.versions.slice(0, MAX_VERSIONS).map(sanitizeVersion).filter(Boolean)
    : undefined;

  return {
    id: versionGroup.id ?? versionGroup.groupId ?? null,
    name: boundedString(versionGroup.name || versionGroup.label, 120),
    versions
  };
};

const sanitizeSong = (song) => {
  if (!song || typeof song !== 'object') return null;

  const title = boundedString(song.title, 240);
  if (!title) return null;

  const versions = Array.isArray(song.versions)
    ? song.versions.slice(0, MAX_VERSIONS).map(sanitizeVersion).filter(Boolean)
    : undefined;

  return {
    id: song.id ?? null,
    versionId: song.versionId ?? song.selectedVersionId ?? null,
    versionName: boundedString(song.versionName || song.versionLabel || song.arrangement, 120),
    title,
    artist: boundedString(song.artist, 240),
    album: boundedString(song.album, 240),
    tuning: boundedString(song.tuning, 80),
    tempo: finiteNumber(song.tempo, 0),
    timeSignature: boundedString(song.timeSignature, 20),
    contentSource: boundedString(song.contentSource, 80),
    lyricsChords: boundedString(
      song.lyricsChords || song.chordpro || song.lyrics,
      MAX_LYRICS_LENGTH
    ),
    data: sanitizeScoreData(song.data),
    versions,
    versionGroup: sanitizeVersionGroup(song.versionGroup)
  };
};

export class SessionRecovery {
  constructor(storage = globalThis.localStorage, debounceMs = 180) {
    this.storage = storage;
    this.debounceMs = debounceMs;
    this.pendingSnapshot = null;
    this.saveTimer = null;
  }

  read() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (parsed?.schemaVersion !== SCHEMA_VERSION || !parsed.song?.title) return null;
      return { ...parsed, song: restoreSongData(parsed.song) };
    } catch (error) {
      console.warn('[SessionRecovery] No se pudo leer la sesión guardada:', error);
      return null;
    }
  }

  schedule(snapshot) {
    this.pendingSnapshot = snapshot;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), this.debounceMs);
  }

  flush(snapshot = this.pendingSnapshot) {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.pendingSnapshot = null;
    if (!snapshot?.song) return false;

    const song = sanitizeSong(snapshot.song);
    if (!song) return false;

    const payload = {
      schemaVersion: SCHEMA_VERSION,
      savedAt: Date.now(),
      song,
      scrollTop: Math.max(0, finiteNumber(snapshot.scrollTop, 0)),
      fontSizeScale: Math.max(80, Math.min(180, finiteNumber(snapshot.fontSizeScale, 100))),
      transposeSemitones: Math.max(-12, Math.min(12, finiteNumber(snapshot.transposeSemitones, 0))),
      capoFret: Math.max(0, Math.min(12, finiteNumber(snapshot.capoFret, 0))),
      instrument: boundedString(snapshot.instrument, 40) || 'guitar',
      visualTheme: boundedString(snapshot.visualTheme, 40) || 'paper',
      notationSystem: snapshot.notationSystem === 'latin' ? 'latin' : 'anglo',
      hideChordsMode: Boolean(snapshot.hideChordsMode),
      isSimplified: Boolean(snapshot.isSimplified),
      viewMode: snapshot.viewMode === 'score' ? 'score' : 'lyrics',
      activeSectionId: boundedString(snapshot.activeSectionId, 120),
      autoScroll: {
        isRunning: Boolean(snapshot.autoScroll?.isRunning),
        speedPercent: Math.max(1, Math.min(100, finiteNumber(snapshot.autoScroll?.speedPercent, 25)))
      }
    };

    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.warn('[SessionRecovery] No se pudo guardar la sesión:', error);
      return false;
    }
  }

  clear() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.pendingSnapshot = null;
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('[SessionRecovery] No se pudo borrar la sesión:', error);
    }
  }

  destroy() {
    if (this.pendingSnapshot) this.flush();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
}

export default SessionRecovery;