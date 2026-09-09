// Presence is not authenticity. Automated checks never certify an original recording.
const CHORD = /\[([A-G][#b]?(?:(?:maj|min|dim|aug|sus|add|m|M|\d|\+|\(|\)|°)*)(?:\/[A-G][#b]?)?)\]/g;
const PLACEHOLDER = /interpretada por|acordes colocados para|letra (?:completa )?(?:no disponible|pendiente)|lorem ipsum|gu[ií]a arm[oó]nica instrumental/i;

export function lyricText(song = {}) {
  return String(song.lyricsChords || song.chordpro || song.lyrics || '');
}

export function plainLyricText(text) {
  return String(text).replace(/\{[^}]*\}/g, '').replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ').trim();
}

export function assessSong(song = {}, { audioAvailable = false, durationMs = 0 } = {}) {
  const text = lyricText(song);
  const plain = plainLyricText(text);
  const words = plain.match(/[\p{L}\p{N}]+/gu) || [];
  const chords = [...text.matchAll(CHORD)].map(match => match[1]);
  const generated = Boolean(song.isGenerated || /generated|harmoniz|universal_online_harvested/i.test(song.contentSource || song.source || ''));
  const placeholder = PLACEHOLDER.test(text);
  const hasLyrics = words.length > 0 && !placeholder;
  const tempo = Number(song.tempo);
  const hasTempo = Number.isFinite(tempo) && tempo > 0 && tempo <= 400;
  const cues = Array.isArray(song.lyricCues) ? song.lyricCues : [];
  const invalidCues = cues.some((cue, index) => !cue || !Number.isFinite(cue.startTime) || cue.startTime < 0 ||
    !Number.isFinite(cue.duration) || cue.duration <= 0 || typeof cue.text !== 'string' ||
    (index > 0 && cue.startTime < cues[index - 1]?.startTime) ||
    (durationMs > 0 && cue.startTime + cue.duration > durationMs + 100));
  const hasTiming = cues.length > 0 && !invalidCues;
  const melody = Array.isArray(song.vocalMelody) ? song.vocalMelody : [];
  const hasMelody = melody.length > 0 && melody.every(note => note && Number.isFinite(note.midi) &&
    note.midi >= 36 && note.midi <= 96 && Number.isFinite(note.startTime) && note.startTime >= 0 &&
    Number.isFinite(note.duration) && note.duration > 0);
  const issues = [];
  if (!hasLyrics) issues.push(placeholder ? 'PLACEHOLDER_TEXT' : 'MISSING_LYRICS');
  else if (words.length < 40) issues.push('SHORT_TEXT_REVIEW');
  if (!chords.length) issues.push('MISSING_CHORDS');
  if (generated) issues.push('GENERATED_HARMONY');
  if (!hasTempo) issues.push('MISSING_TEMPO');
  if (!song.provenance?.lyrics?.sourceUrl) issues.push('LYRICS_SOURCE_UNDOCUMENTED');
  if (!song.provenance?.chords?.sourceUrl) issues.push('CHORDS_SOURCE_UNDOCUMENTED');
  if (!song.provenance?.tempo?.sourceUrl) issues.push('TEMPO_SOURCE_UNDOCUMENTED');
  if (!song.rights?.lyrics) issues.push('LYRICS_RIGHTS_UNDOCUMENTED');
  if (!audioAvailable) issues.push('NO_OFFLINE_RECORDING');
  if (!hasTiming) issues.push(invalidCues ? 'INVALID_TIMING' : 'MISSING_TIMING');
  if (!hasMelody) issues.push('MISSING_VOCAL_MELODY');
  // Declared flags, a plausible BPM and an LRC file are not a musical review.
  issues.push('AUTHENTICITY_UNVERIFIED');
  return {
    schemaVersion: 1, hasLyrics, hasChords: chords.length > 0, chordCount: chords.length,
    wordCount: words.length, hasTempo, tempo: hasTempo ? tempo : null,
    hasTiming, hasMelody, audioAvailable, generated, placeholder,
    offlineTextAvailable: hasLyrics, karaokeAssetsPresent: audioAvailable && hasTiming,
    authenticity: 'unverified', completeness: 'unverified', issues,
    label: placeholder ? 'Contenido a revisar' : !hasLyrics ? 'Sin letra' : generated
      ? 'Acordes generados · no originales' : chords.length ? 'Letra y acordes · sin verificar' : 'Solo letra · sin verificar',
  };
}

export function summarizeQuality(songs) {
  const summary = { records: songs.length, withLyrics: 0, withChords: 0, withTempo: 0,
    withTiming: 0, withVocalMelody: 0, withOfflineAudio: 0, generated: 0, verified: 0, issues: {} };
  for (const song of songs) {
    const quality = song.quality || assessSong(song);
    for (const [field, target] of Object.entries({ hasLyrics: 'withLyrics', hasChords: 'withChords', hasTempo: 'withTempo',
      hasTiming: 'withTiming', hasMelody: 'withVocalMelody', audioAvailable: 'withOfflineAudio', generated: 'generated' })) {
      if (quality[field]) summary[target]++;
    }
    quality.issues.forEach(issue => { summary.issues[issue] = (summary.issues[issue] || 0) + 1; });
  }
  return summary;
}
