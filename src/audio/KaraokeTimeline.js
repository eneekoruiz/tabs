// All times are milliseconds in the original song, independent of playback speed.
const CHORD = /\[([A-G][#b]?(?:(?:maj|min|dim|aug|sus|add|m|M|\d|\+|\(|\)|°)*)(?:\/[A-G][#b]?)?)\]/g;

export function getKaraokeTempo(value) {
  const tempo = Number(value);
  return Number.isFinite(tempo) && tempo >= 40 && tempo <= 220 ? tempo : 72;
}

export function validLyricCues(cues) {
  return Array.isArray(cues) ? cues.filter(c => c && Number.isFinite(c.startTime) && c.startTime >= 0 &&
    Number.isFinite(c.duration) && c.duration > 0 && typeof c.text === 'string')
    .map(c => ({ startTime: c.startTime, duration: c.duration, text: c.text.trim() }))
    .sort((a, b) => a.startTime - b.startTime) : [];
}

export function buildKaraokeTimeline(song = {}) {
  const beatMs = 60000 / getKaraokeTempo(song.tempo);
  const signature = String(song.timeSignature || '4/4').match(/^(\d+)\/(\d+)$/);
  const beatsPerBar = signature ? Math.max(1, Math.min(12, Number(signature[1]) * 4 / Number(signature[2]))) : 4;
  const barMs = beatMs * beatsPerBar;
  const lines = [];
  const chords = [];
  let cursor = 0;
  const source = String(song.lyricsChords || song.chordpro || song.lyrics || '');
  for (const raw of source.split(/\r?\n/)) {
    if (!raw.trim() || /^\s*\{.*\}\s*$/.test(raw)) continue;
    const markers = [...raw.matchAll(CHORD)];
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    // Section labels do not introduce phantom bars; chord-only lines do.
    if (!text && !markers.length) continue;
    const words = text ? text.split(/\s+/).length : 0;
    const bars = Math.max(1, markers.length, Math.ceil(words / beatsPerBar));
    const duration = bars * barMs;
    if (text) lines.push({ startTime: cursor, duration, text });
    markers.forEach((match, i) => chords.push({
      time: cursor + i * duration / markers.length,
      duration: duration / markers.length,
      chord: match[1],
    }));
    cursor += duration;
  }
  const supplied = validLyricCues(song.lyricCues);
  const lyricLines = supplied.length ? supplied : lines;
  const durationMs = Math.max(cursor, ...lyricLines.map(c => c.startTime + c.duration), 0);
  // Hold existing harmony through unciphered lines. No invented chord progression.
  chords.forEach((chord, i) => { chord.duration = (chords[i + 1]?.time ?? durationMs) - chord.time; });
  return { beatMs, beatsPerBar, chords, lyricLines, durationMs, timingIsEstimated: !supplied.length };
}

export function parseLrc(source, durationMs = 0) {
  const entries = [];
  const offset = Number(String(source).match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0);
  for (const line of String(source).split(/\r?\n/)) {
    const tags = [...line.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
    const text = line.replace(/\[[^\]]*\]/g, '').trim();
    for (const tag of tags) entries.push({
      startTime: Math.max(0, Number(tag[1]) * 60000 + Number(tag[2]) * 1000 + Number((tag[3] || '').padEnd(3, '0')) + offset), text,
    });
  }
  if (!entries.some(e => e.text)) throw new Error('No encontramos tiempos. Usa un archivo LRC con líneas como [00:12.50]Tu letra.');
  entries.sort((a, b) => a.startTime - b.startTime);
  const merged = [];
  for (const entry of entries) {
    const previous = merged.at(-1);
    if (previous?.startTime === entry.startTime) previous.text = [previous.text, entry.text].filter(Boolean).join(' · ');
    else merged.push({ ...entry });
  }
  return merged.map((entry, i) => ({ ...entry,
    duration: Math.max(1, (merged[i + 1]?.startTime ?? (durationMs > entry.startTime ? durationMs : entry.startTime + 4000)) - entry.startTime),
  }));
}
