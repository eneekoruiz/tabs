import { LATIN_TO_ANGLO_MAP, CHROMATIC_SCALE_SHARPS, CHROMATIC_SCALE_FLATS } from './ChordDefinitions.js';

// Semitone intervals from the named root. Unknown qualities are deliberately unsupported.
const INTERVALS = Object.freeze({
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10], '5': [0, 7], sus2: [0, 2, 7], sus4: [0, 5, 7],
  '7sus4': [0, 5, 7, 10], add9: [0, 4, 7, 14], '9': [0, 4, 7, 10, 14],
  '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], dim: [0, 3, 6], dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10], aug: [0, 4, 8], '7#9': [0, 4, 7, 10, 15], '7b9': [0, 4, 7, 10, 13],
  mmaj7: [0, 3, 7, 11], m9: [0, 3, 7, 10, 14], m11: [0, 3, 7, 10, 14, 17]
});
export const STRING_TUNINGS = Object.freeze({ guitar: [40, 45, 50, 55, 59, 64], ukulele: [67, 60, 64, 69] });
export const mod12 = value => ((value % 12) + 12) % 12;

export function notePitchClass(note) {
  const match = /^([A-G])([#b]?)$/.exec(String(note));
  if (!match) return null;
  return mod12({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0));
}

export function normalizeChordName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/♯/g, '#').replace(/♭/g, 'b').split('/').map(part => {
    let name = part.trim().replace(/^(DO|RE|MI|FA|SOL|LA|SI)([#b]?)(?=$|m(?:in|aj)?|M7|aug|dim|sus|add|[0-9+°]|\s+(?:mayor|menor)$)/i,
      (_, root, accidental) => LATIN_TO_ANGLO_MAP[root.toUpperCase()] + accidental);
    name = name.replace(/\s+mayor$/i, '').replace(/\s+menor$/i, 'm');
    return name.replace(/^([a-g])/, root => root.toUpperCase());
  }).join('/');
}

export function parseChord(value) {
  const name = normalizeChordName(value);
  const match = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(name);
  if (!match) return null;
  const suffix = match[2].replace(/^maj/i, 'maj').replace(/^min/i, 'm').replace(/^M7$/, 'maj7')
    .replace(/^(sus|add|aug|dim)/i, quality => quality.toLowerCase()).replace(/^m\(?maj7\)?$/i, 'mmaj7')
    .replace(/^\+$/, 'aug').replace(/^°/, 'dim');
  const intervals = INTERVALS[suffix];
  if (!intervals) return null;
  const rootPc = notePitchClass(match[1]);
  const bassPc = match[3] ? notePitchClass(match[3]) : null;
  const pitches = intervals.map(interval => mod12(rootPc + interval));
  // A perfect fifth may be omitted in extended string voicings; defining alterations may not.
  const required = intervals.filter(interval => !(interval === 7 && intervals.length > 3)
    && !(suffix === 'm11' && interval === 14)).map(interval => mod12(rootPc + interval));
  return { name, root: match[1], rootPc, suffix, bass: match[3] || null, bassPc, intervals, pitches,
    required, key: `${match[1]}${suffix}${match[3] ? `/${match[3]}` : ''}` };
}

export function chordPitches(chord, instrument) {
  if (!chord || !STRING_TUNINGS[instrument]) return [];
  return chord.frets.flatMap((fret, index) => fret >= 0 ? [STRING_TUNINGS[instrument][index] + fret] : []);
}

export function validStringVoicing(shape, spec, instrument) {
  const tuning = STRING_TUNINGS[instrument];
  if (!shape || !spec || shape.frets?.length !== tuning?.length) return false;
  if (shape.frets.some(fret => !Number.isInteger(fret) || fret < -1 || fret > (instrument === 'ukulele' ? 19 : 24))) return false;
  const fretted = shape.frets.filter(fret => fret > 0);
  if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > 4) return false;
  const midi = chordPitches(shape, instrument);
  const pcs = midi.map(mod12);
  const allowed = [...spec.pitches, ...(spec.bassPc === null ? [] : [spec.bassPc])];
  const required = shape.omittedRoot ? spec.required.filter(pc => pc !== spec.rootPc) : spec.required;
  return midi.length > 0 && pcs.every(pc => allowed.includes(pc)) && required.every(pc => pcs.includes(pc))
    && (spec.bassPc === null || mod12(Math.min(...midi)) === spec.bassPc);
}

export function transposeChordName(value, semitones) {
  const spec = parseChord(value);
  if (!spec || !Number.isInteger(semitones)) return value;
  const scale = spec.root.includes('b') ? CHROMATIC_SCALE_FLATS : CHROMATIC_SCALE_SHARPS;
  const root = scale[mod12(spec.rootPc + semitones)];
  const bassScale = spec.bass?.includes('b') ? CHROMATIC_SCALE_FLATS : CHROMATIC_SCALE_SHARPS;
  return `${root}${spec.suffix}${spec.bass ? `/${bassScale[mod12(spec.bassPc + semitones)]}` : ''}`;
}
