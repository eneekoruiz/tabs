import { ChordSvgRenderer } from '../tools/chord/ChordSvgRenderer.js';
import { parseChord, mod12 } from '../tools/chord/ChordTheory.js';

// AlphaTex quoted metadata does not accept arbitrary command syntax from imported text.
const safeText = value => String(value).replace(/[\\\x00-\x1f\x7f]/g, ' ').replace(/"/g, "'").replace(/\s+/g, ' ').trim();

export class SmartScoreGenerator {
  static generate(song = {}) {
    if (!song || typeof song !== 'object') song = {};
    const title = safeText(song.title || 'Sin título');
    const artist = safeText(song.artist || 'Artista desconocido');
    const declaredTempo = Number(song.tempo);
    const tempo = Number.isFinite(declaredTempo) && declaredTempo >= 20 && declaredTempo <= 300 ? Math.round(declaredTempo) : 120;
    const meter = /^(\d{1,2})\/(1|2|4|8|16)$/.exec(String(song.timeSignature || '4/4'));
    const numerator = meter && Number(meter[1]) >= 1 && Number(meter[1]) <= 12 ? Number(meter[1]) : 4;
    const denominator = meter && Number(meter[1]) >= 1 && Number(meter[1]) <= 12 ? Number(meter[2]) : 4;
    const segments = [];
    const text = String(song.lyricsChords || song.lyrics || '');
    for (const match of text.matchAll(/\[([^\]\r\n]+)\]/g)) {
      const spec = parseChord(match[1]);
      if (spec) segments.push({ spec, chord: ChordSvgRenderer.getGuitarChord(spec.key) });
      // Unknown chord-like symbols retain a rhythmic rest instead of inventing harmony.
      else if (/^[A-G][#b]?(?:\d|m|M|sus|add|aug|dim|\+|\/)/.test(match[1])) segments.push({ spec: null, chord: null });
    }
    if (!segments.length) segments.push({ spec: null, chord: null });

    let tex = '\\title "' + title + '" \\artist "' + artist + '" \\subtitle "Acompañamiento aproximado de práctica" \\tempo ' + tempo + ' .\n\n';
    tex += '\\track "Guitarra Rítmica"\n\\tuning E4 B3 G3 D3 A2 E2\n\\instrument acousticguitar\n.\n';
    for (const [index, segment] of segments.entries()) {
      const notes = segment.chord?.frets.flatMap((fret, string) => fret < 0 ? [] : [fret + '.' + (6 - string)]) || [];
      if (index === 0) tex += '\\ts ' + numerator + ' ' + denominator + ' ';
      if (!notes.length) {
        tex += Array.from({ length: numerator }, () => ':' + denominator + ' r').join(' ') + ' |\n';
        continue;
      }
      const full = '(' + notes.join(' ') + ')';
      if (numerator === 3 && denominator === 4) {
        tex += ':4 ' + full + ' :8 ' + full + ' :8 ' + full + ' :8 ' + full + ' :8 ' + full + ' |\n';
      } else if (numerator === 4 && denominator === 4 && song.genre === 'Acoustic') {
        const root = notes[0];
        const rest = '(' + notes.slice(1).join(' ') + ')';
        tex += ':4 ' + root + ' :8 ' + rest + ' :8 ' + rest + ' :4 ' + root + ' :4 ' + rest + ' |\n';
      } else if (numerator === 4 && denominator === 4) {
        tex += ':4 ' + full + ' :8 ' + full + ' :8 ' + full + ' :4 ' + full + ' :8 ' + full + ' :8 ' + full + ' |\n';
      } else {
        tex += Array.from({ length: numerator }, () => ':' + denominator + ' ' + full).join(' ') + ' |\n';
      }
    }

    tex += '\n\\track "Bajo"\n\\tuning G2 D2 A1 E1\n\\instrument fingeredbass\n.\n';
    for (const [index, segment] of segments.entries()) {
      if (index === 0) tex += '\\ts ' + numerator + ' ' + denominator + ' ';
      // The lowest bass string is E1 (MIDI 28), independent of guitar string numbering.
      const pc = segment.spec?.bassPc ?? segment.spec?.rootPc;
      const note = segment.chord && pc !== undefined ? mod12(pc - 4) + '.4' : 'r';
      const duration = numerator === 4 && denominator === 4 ? 8 : denominator;
      const count = duration === 8 && denominator === 4 ? numerator * 2 : numerator;
      tex += Array.from({ length: count }, () => ':' + duration + ' ' + note).join(' ') + ' |\n';
    }
    return tex;
  }
}
