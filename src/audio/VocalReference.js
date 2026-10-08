/** Timed monophonic references. Own parser following UltraStar format v1 (MIT spec).
 * https://github.com/UltraStar-Deluxe/format
 * Audio paths in headers are metadata only: they are never fetched or executed.
 */
const MAX_MS = 6 * 60 * 60 * 1000;
const MAX_NOTES = 20000;
function validateNotes(notes) {
  if (!Array.isArray(notes) || !notes.length || notes.length > MAX_NOTES) throw new Error('La referencia debe contener entre 1 y 20000 notas.');
  const clean = notes.map((n, i) => {
    if (!n || !Number.isFinite(n.startTime) || n.startTime < 0 || !Number.isFinite(n.duration) || n.duration <= 0 || n.startTime + n.duration > MAX_MS || !Number.isInteger(n.midi) || n.midi < 24 || n.midi > 108) throw new Error('Nota inválida en posición ' + (i + 1) + '. Usa tiempos en milisegundos y notas MIDI 24–108.');
    return { startTime: n.startTime, duration: n.duration, midi: n.midi, text: String(n.text || '').slice(0, 2048), isInterlude: Boolean(n.isInterlude) };
  }).sort((a, b) => a.startTime - b.startTime);
  for (let i = 1; i < clean.length; i++) if (clean[i].startTime < clean[i-1].startTime + clean[i-1].duration - 0.002) throw new Error('Las notas se solapan. Importa una sola voz.');
  if (!clean.some(n => !n.isInterlude)) throw new Error('No hay notas afinables en esta referencia.');
  return clean;
}
const referenceInfo = data => ({ title: String(data.title || '').slice(0,240), artist: String(data.artist || '').slice(0,240), sourceType: data.sourceType === 'community_transcription' ? 'community_transcription' : 'user_import', sourceUrl: /^https:\/\/github\.com\//.test(data.sourceUrl || '') ? String(data.sourceUrl).slice(0,2000) : '', revision: String(data.revision || '').slice(0,40), verification: 'unverified_recording', octaveShiftSemitones: Number.isInteger(data.octaveShiftSemitones) && data.octaveShiftSemitones % 12 === 0 ? data.octaveShiftSemitones : 0 });
export function parseVocalReference(text, { normalizeLegacyOctave = false } = {}) {
  if (typeof text !== 'string' || !text.trim() || text.length > 1024 * 1024) throw new Error('Elige una referencia UltraStar TXT o JSON no vacía de hasta 1 MB.');
  text = text.replace(/^\uFEFF/, '');
  if (/^\s*[\[{]/.test(text)) {
    let data;
    try { data = JSON.parse(text); } catch (_) { throw new Error('El JSON de referencia no es válido.'); }
    if (data.units && data.units !== 'milliseconds') throw new Error('El JSON debe usar units: milliseconds.');
    return { vocalMelody: validateNotes(Array.isArray(data) ? data : data.notes), lyricCues: null, source: 'json', title: String(data.title || ''), artist: String(data.artist || ''), referenceInfo: referenceInfo(data) };
  }
  const headers = new Map(), rows = [], phrases = [];
  let phrase = [], body = false;
  const endPhrase = () => { if (phrase.length) phrases.push(phrase); phrase = []; };
  for (const raw of text.split(/\r\n|\n|\r/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line === 'E') break;
    if (line.startsWith('#')) {
      if (body) throw new Error('Hay una cabecera dentro de las notas.');
      const h = line.match(/^#([^:]+):(.*)$/);
      if (!h) throw new Error('Cabecera UltraStar inválida.');
      const key = h[1].trim().toUpperCase();
      if (headers.has(key)) throw new Error('Cabecera duplicada: ' + key);
      headers.set(key, h[2].trim());
      continue;
    }
    body = true;
    if (/^P\d/.test(line)) throw new Error('Las referencias de varias voces aún no están disponibles. Exporta una sola voz.');
    if (/^-\s+-?\d+(?:\s+-?\d+)?$/.test(line)) { endPhrase(); continue; }
    const n = raw.trimStart().match(/^([:*FRG])\s+(-?\d+)\s+(\d+)\s+(-?\d+)\s(.*)$/);
    if (!n) throw new Error('Línea UltraStar no compatible o inválida: ' + line.slice(0, 40));
    const note = { beat: Number(n[2]), length: Number(n[3]), pitch: Number(n[4]), text: n[5], isInterlude: /[FRG]/.test(n[1]) };
    if (note.length <= 0) throw new Error('Las notas deben tener duración positiva.');
    rows.push(note); phrase.push(note);
    if (rows.length > MAX_NOTES) throw new Error('La referencia supera 20000 notas.');
  }
  endPhrase();
  const version = headers.get('VERSION');
  if (version && !/^1\.\d+\.\d+$/.test(version)) throw new Error('Versión UltraStar no compatible.');
  if (/^yes$/i.test(headers.get('RELATIVE') || '')) throw new Error('El formato UltraStar relativo no está disponible. Exporta tiempos absolutos.');
  if ([...headers.keys()].some(k => /^P[2-9]$/.test(k))) throw new Error('Importa una referencia de una sola voz.');
  const decimal = (value, fallback) => value === undefined || value === '' ? fallback : (/^-?\d+(?:[.,]\d+)?$/.test(value) ? Number(value.replace(',', '.')) : NaN);
  const bpm = decimal(headers.get('BPM'), NaN), gap = decimal(headers.get('GAP'), 0);
  if (!(bpm > 0 && bpm <= 2000) || !Number.isFinite(gap)) throw new Error('BPM o GAP UltraStar inválido.');
  const beatMs = 60000 / (bpm * 4);
  let octaveShiftSemitones = 0;
  const pitches = rows.filter(n => !n.isInterlude).map(n => 60+n.pitch);
  if (normalizeLegacyOctave && !version && pitches.length && pitches.every(p => p >= -67 && p <= 187)) {
    const low = Math.min(...pitches), high = Math.max(...pitches);
    if (low < 24 || high > 108) octaveShiftSemitones = 12 * Math.round((60-(low+high)/2)/12);
  }
  // Optional legacy adaptation moves the entire chart by octaves only. It does
  // not repair intervals, timings, overlaps or malformed files. Scoring permits
  // any sung octave; the original chart and chosen shift remain traceable.
  const timed = n => ({ startTime: gap + n.beat * beatMs, duration: n.length * beatMs, midi: n.isInterlude ? 60 : 60 + n.pitch + octaveShiftSemitones, text: n.text, isInterlude: n.isInterlude });
  const vocalMelody = validateNotes(rows.map(timed));
  const lyricCues = phrases.map(p => ({ startTime: timed(p[0]).startTime, duration: timed(p.at(-1)).startTime + timed(p.at(-1)).duration - timed(p[0]).startTime, text: p.map(n => n.text).join('') }));
  return { vocalMelody, lyricCues, source: 'ultrastar', title: headers.get('TITLE') || '', artist: headers.get('ARTIST') || '', referenceInfo: referenceInfo({title:headers.get('TITLE'),artist:headers.get('ARTIST'),octaveShiftSemitones}) };
}
