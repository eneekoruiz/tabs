/**
 * @file ChordSvgRenderer.js
 * @description Generador visual SVG para diagramas de Guitarra, Ukelele y Piano.
 * Adaptado a Modo Oscuro / Claro con variables CSS semánticas de alto contraste.
 */

import { 
  GUITAR_CHORDS, 
  UKULELE_CHORDS, 
  PIANO_VOICINGS, 
  ALTERNATE_GUITAR_VOICINGS,
  ALTERNATE_UKULELE_VOICINGS,
  CHROMATIC_SCALE_SHARPS, CHROMATIC_SCALE_FLATS
} from './ChordDefinitions.js';
import { normalizeChordName, parseChord, notePitchClass, mod12, validStringVoicing, STRING_TUNINGS } from './ChordTheory.js';
import { escapeHTML } from '../../utils/sanitize.js';

const voicingCache = new Map();

export class ChordSvgRenderer {
  static normalizeChordKey(chordName) { return normalizeChordName(chordName); }

  static simplifyChord(chord) {
    const spec = parseChord(chord);
    return spec ? spec.root + (spec.suffix.startsWith('m') && !spec.suffix.startsWith('maj') ? 'm' : '') : normalizeChordName(chord);
  }

  static getEnharmonic(root) {
    const pc = notePitchClass(root);
    if (pc === null) return null;
    return CHROMATIC_SCALE_SHARPS[pc] === root ? CHROMATIC_SCALE_FLATS[pc] : CHROMATIC_SCALE_SHARPS[pc];
  }

  static _stringVoicings(chordName, instrument) {
    const spec = parseChord(chordName);
    if (!spec || !STRING_TUNINGS[instrument]) return [];
    const cacheKey = instrument + ':' + spec.key;
    if (voicingCache.has(cacheKey)) return voicingCache.get(cacheKey);
    const db = instrument === 'ukulele' ? UKULELE_CHORDS : GUITAR_CHORDS;
    const alternates = instrument === 'ukulele' ? ALTERNATE_UKULELE_VOICINGS : ALTERNATE_GUITAR_VOICINGS;
    const enhKey = this.getEnharmonic(spec.root) + spec.suffix + (spec.bass ? '/' + spec.bass : '');
    const rows = [];
    const add = shape => {
      if (!validStringVoicing(shape, spec, instrument) || rows.some(row => row.frets.join(',') === shape.frets.join(','))) return;
      const positive = shape.frets.filter(fret => fret > 0);
      const baseFret = positive.length && Math.max(...positive) > 5 ? Math.min(...positive) : (shape.baseFret || 1);
      rows.push({ ...shape, baseFret, name: shape.name || 'Posición Principal',
        detail: shape.detail || ('Traste ' + baseFret + (shape.omittedRoot ? ' · Sin fundamental' : '')), index: rows.length });
    };
    for (const shape of alternates[spec.key] || alternates[enhKey] || []) add(shape);
    add(db[spec.key] || db[enhKey]);
    if (spec.bass) {
      if (!rows.length) add(this._findSlashVoicing(spec, instrument));
    } else if (rows.length < 3) {
      // Move a known shape of the SAME quality. Extensions are never silently removed.
      for (const [key, template] of Object.entries(db)) {
        const templateSpec = parseChord(key);
        if (!templateSpec || templateSpec.bass || templateSpec.suffix !== spec.suffix) continue;
        const shift = mod12(spec.rootPc - templateSpec.rootPc);
        for (const amount of [shift, shift + 12]) {
          const frets = template.frets.map(fret => fret < 0 ? -1 : fret + amount);
          const positive = frets.filter(fret => fret > 0);
          if (!positive.length || Math.max(...positive) - Math.min(...positive) > 4) continue;
          add({ frets, fingers: amount === 0 ? template.fingers : [], omittedRoot: template.omittedRoot,
            baseFret: Math.min(...positive), name: amount === 0 ? 'Posición Principal' : 'Forma Transportada',
            detail: 'Trastes ' + Math.min(...positive) + ' - ' + Math.max(...positive) });
          if (rows.length >= 3) break;
        }
        if (rows.length >= 3) break;
      }
    }
    // Resolve an exact same-quality shape when stored templates cannot be moved.
    if (!rows.length) add(this._findSlashVoicing(spec, instrument));
    voicingCache.set(cacheKey, rows);
    return rows;
  }

  static _findSlashVoicing(spec, instrument) {
    const tuning = STRING_TUNINGS[instrument];
    const allowed = [...spec.pitches, spec.bassPc];
    let best = null;
    let bestCost = Infinity;
    for (let base = 1; base <= 16; base++) {
      const choices = tuning.map(open => [-1, 0, ...Array.from({ length: 5 }, (_, offset) => base + offset)]
        .filter(fret => fret < 0 || allowed.includes(mod12(open + fret))));
      const visit = (frets, index) => {
        if (index < tuning.length) {
          for (const fret of choices[index]) visit([...frets, fret], index + 1);
          return;
        }
        const positive = frets.filter(fret => fret > 0);
        const shape = { frets, fingers: [], baseFret: positive.length ? Math.min(...positive) : 1 };
        if (!validStringVoicing(shape, spec, instrument)) return;
        const cost = frets.filter(fret => fret < 0).length * 20 + Math.max(0, ...frets) + (positive.length ? Math.max(...positive) - Math.min(...positive) : 0);
        if (cost < bestCost) { best = shape; bestCost = cost; }
      };
      visit([], 0);
    }
    return best;
  }

  static getVoicings(chordName, instrument = 'guitar') {
    if (instrument !== 'piano') return this._stringVoicings(chordName, instrument).map(shape => this._copyShape(shape));
    const spec = parseChord(chordName);
    if (!spec) return [];
    if (spec.bass) return [{ index: 0, name: 'Bajo indicado', detail: spec.bass + ' en el bajo' }];
    return Array.from({ length: Math.min(3, spec.intervals.length) }, (_, index) => ({ index,
      name: ['Posición Fundamental', '1ª Inversión', '2ª Inversión'][index], detail: 'Se conservan todas las notas del acorde' }));
  }

  static getGuitarChord(chordName, voicingIndex = 0) {
    return this._copyShape(this._stringVoicings(chordName, 'guitar')[voicingIndex]);
  }

  static getUkuleleChord(chordName, voicingIndex = 0) {
    return this._copyShape(this._stringVoicings(chordName, 'ukulele')[voicingIndex]);
  }

  static _copyShape(shape) {
    return shape ? { ...shape, frets: [...shape.frets], fingers: [...(shape.fingers || [])],
      ...(shape.barres ? { barres: [...shape.barres] } : {}) } : null;
  }

  static getPianoChord(chordName, voicingIndex = 0) {
    const spec = parseChord(chordName);
    if (!spec || !Number.isInteger(voicingIndex) || !this.getVoicings(chordName, 'piano')[voicingIndex]) return null;
    const enhKey = this.getEnharmonic(spec.root) + spec.suffix;
    const stored = PIANO_VOICINGS[spec.key] || (!spec.bass && PIANO_VOICINGS[enhKey]);
    let midi = stored ? stored.map(note => 12 * (note.oct + 1) + notePitchClass(note.key))
      : spec.intervals.map(interval => 60 + spec.rootPc + interval);
    midi.sort((a, b) => a - b);
    if (spec.bass) {
      const bass = 60 + spec.bassPc;
      midi = [bass, ...midi.map(note => { while (note <= bass) note += 12; return note; })].sort((a, b) => a - b);
    } else {
      for (let index = 0; index < voicingIndex; index++) midi.push(midi.shift() + 12);
      midi.sort((a, b) => a - b);
    }
    return midi.map(note => ({ key: CHROMATIC_SCALE_SHARPS[mod12(note)], oct: Math.floor(note / 12) - 1 }));
  }

  static renderGuitar(chordName, isLeftHanded = false, voicingIndex = 0, displayName = null) {
    const chord = this.getGuitarChord(chordName, voicingIndex);
    if (!chord) return `<div class="chord-not-found">Acorde no disponible</div>`;

    const label = escapeHTML(displayName || chordName);
    const width = 150;
    const height = 175;
    const startX = 25;
    const startY = 36;
    const stringGap = 20;
    const fretGap = 24;
    const numStrings = 6;
    const numFrets = 5;

    let frets = [...chord.frets];
    let fingers = [...(chord.fingers || [])];

    if (isLeftHanded) {
      frets.reverse();
      fingers.reverse();
    }

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="chord-diagram-svg guitar-svg" role="img" aria-label="Diagrama de guitarra ${label}">
        <text x="${width / 2}" y="20" text-anchor="middle" class="chord-diagram-title" fill="var(--text-primary, #ffffff)" font-weight="900" font-size="14">${label} (Guitarra)</text>

        ${chord.baseFret > 1 
          ? `<text x="10" y="${startY + 16}" fill="var(--accent-secondary, #00e5ff)" font-size="11" font-weight="bold">${chord.baseFret}fr</text>`
          : `<line x1="${startX}" y1="${startY}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY}" stroke="var(--chord-nut-color, var(--text-primary, #ffffff))" stroke-width="4" stroke-linecap="round"/>`
        }

        <!-- Trastes -->
        ${Array.from({ length: numFrets + 1 }, (_, f) => `
          <line class="chord-fret-line" x1="${startX}" y1="${startY + f * fretGap}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY + f * fretGap}" stroke="var(--chord-fret-color, rgba(255, 255, 255, 0.45))" stroke-width="1.5"/>
        `).join('')}

        <!-- Cuerdas Interactivas con Pluck Cuerda a Cuerda -->
        ${Array.from({ length: numStrings }, (_, s) => {
          const x = startX + s * stringGap;
          const fret = frets[s];
          return `
            <g class="chord-interactive-string" data-string-idx="${isLeftHanded ? numStrings - 1 - s : s}" data-fret="${fret}" style="cursor: pointer;">
              <line class="chord-string-line" x1="${x}" y1="${startY}" x2="${x}" y2="${startY + numFrets * fretGap}" stroke="var(--chord-string-color, rgba(255, 255, 255, 0.85))" stroke-width="1.6"/>
              <rect class="chord-string-hitarea" x="${x - 8}" y="${startY - 14}" width="16" height="${numFrets * fretGap + 22}" fill="transparent" pointer-events="all"/>
            </g>
          `;
        }).join('')}

        <!-- Marcadores Mute / Open -->
        ${frets.map((fret, s) => {
          const x = startX + s * stringGap;
          if (fret === -1) return `<text x="${x}" y="${startY - 6}" text-anchor="middle" fill="var(--status-danger, #ff5252)" font-size="12" font-weight="bold">✕</text>`;
          if (fret === 0) return `<circle cx="${x}" cy="${startY - 10}" r="3.5" fill="none" stroke="var(--status-success, #22c55e)" stroke-width="2"/>`;
          return '';
        }).join('')}

        <!-- Puntos y dedos -->
        ${frets.map((fret, s) => {
          if (fret > 0) {
            const displayFret = fret - (chord.baseFret > 1 ? chord.baseFret - 1 : 0);
            if (displayFret >= 1 && displayFret <= numFrets) {
              const cx = startX + s * stringGap;
              const cy = startY + (displayFret - 0.5) * fretGap;
              const finger = fingers[s] || '';
              return `
                <circle cx="${cx}" cy="${cy}" r="6.5" class="chord-finger-dot" fill="var(--accent-primary, #ff5722)"/>
                ${finger ? `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="900">${finger}</text>` : ''}
              `;
            }
          }
          return '';
        }).join('')}
      </svg>
    `;
  }

  /**
   * Renderiza SVG de Ukelele con colores semánticos compatibles con modo oscuro
   * @param {string} chordName
   * @param {boolean} isLeftHanded
   * @param {number} voicingIndex
   * @returns {string}
   */
  static renderUkulele(chordName, isLeftHanded = false, voicingIndex = 0, displayName = null) {
    const chord = this.getUkuleleChord(chordName, voicingIndex);
    if (!chord) return `<div class="chord-not-found">Acorde no disponible</div>`;

    const label = escapeHTML(displayName || chordName);
    const width = 150;
    const height = 175;
    const startX = 35;
    const startY = 36;
    const stringGap = 26;
    const fretGap = 24;
    const numStrings = 4;
    const numFrets = 5;

    let frets = [...chord.frets];
    let fingers = [...(chord.fingers || [])];

    if (isLeftHanded) {
      frets.reverse();
      fingers.reverse();
    }

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="chord-diagram-svg ukulele-svg" role="img" aria-label="Diagrama de ukelele ${label}">
        <text x="${width / 2}" y="20" text-anchor="middle" class="chord-diagram-title" fill="var(--text-primary, #ffffff)" font-weight="900" font-size="14">${label} (Ukelele)</text>

        ${chord.baseFret > 1 
          ? `<text x="18" y="${startY + 16}" fill="var(--accent-secondary, #00e5ff)" font-size="11" font-weight="bold">${chord.baseFret}fr</text>`
          : `<line x1="${startX}" y1="${startY}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY}" stroke="var(--chord-nut-color, var(--text-primary, #ffffff))" stroke-width="4" stroke-linecap="round"/>`
        }

        <!-- Trastes -->
        ${Array.from({ length: numFrets + 1 }, (_, f) => `
          <line class="chord-fret-line" x1="${startX}" y1="${startY + f * fretGap}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY + f * fretGap}" stroke="var(--chord-fret-color, rgba(255, 255, 255, 0.45))" stroke-width="1.5"/>
        `).join('')}

        <!-- Cuerdas Interactivas con Pluck Cuerda a Cuerda -->
        ${Array.from({ length: numStrings }, (_, s) => {
          const x = startX + s * stringGap;
          const fret = frets[s];
          return `
            <g class="chord-interactive-string" data-string-idx="${isLeftHanded ? numStrings - 1 - s : s}" data-fret="${fret}" style="cursor: pointer;">
              <line class="chord-string-line" x1="${x}" y1="${startY}" x2="${x}" y2="${startY + numFrets * fretGap}" stroke="var(--chord-string-color, rgba(255, 255, 255, 0.85))" stroke-width="1.6"/>
              <rect class="chord-string-hitarea" x="${x - 8}" y="${startY - 14}" width="16" height="${numFrets * fretGap + 22}" fill="transparent" pointer-events="all"/>
            </g>
          `;
        }).join('')}

        <!-- Marcadores Mute / Open -->
        ${frets.map((fret, s) => {
          const x = startX + s * stringGap;
          if (fret === -1) return `<text x="${x}" y="${startY - 6}" text-anchor="middle" fill="var(--status-danger, #ff5252)" font-size="12" font-weight="bold">✕</text>`;
          if (fret === 0) return `<circle cx="${x}" cy="${startY - 10}" r="3.5" fill="none" stroke="var(--status-success, #22c55e)" stroke-width="2"/>`;
          return '';
        }).join('')}

        <!-- Puntos y dedos -->
        ${frets.map((fret, s) => {
          if (fret > 0) {
            const displayFret = fret - (chord.baseFret > 1 ? chord.baseFret - 1 : 0);
            if (displayFret >= 1 && displayFret <= numFrets) {
              const cx = startX + s * stringGap;
              const cy = startY + (displayFret - 0.5) * fretGap;
              const finger = fingers[s] || '';
              return `
                <circle cx="${cx}" cy="${cy}" r="7" class="chord-finger-dot" fill="var(--accent-secondary, #00e5ff)"/>
                ${finger ? `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#090d16" font-size="9" font-weight="900">${finger}</text>` : ''}
              `;
            }
          }
          return '';
        }).join('')}
      </svg>
    `;
  }

  /**
   * Renderiza SVG de Teclado de Piano con colores semánticos compatibles con modo oscuro
   * @param {string} chordName
   * @param {number} voicingIndex
   * @returns {string}
   */
  static renderPiano(chordName, voicingIndex = 0, displayName = null) {
    const voicing = this.getPianoChord(chordName, voicingIndex);
    if (!voicing) return '<div class="chord-not-found">Acorde no disponible</div>';

    const label = escapeHTML(displayName || chordName);
    const width = 20 + 7 * 13.5 * Math.max(2, Math.max(...voicing.map(note => note.oct)) - Math.min(...voicing.map(note => note.oct)) + 1);
    const height = 110;
    const startX = 10;
    const startY = 24;
    const whiteKeyWidth = 13.5;
    const whiteKeyHeight = 75;
    const blackKeyWidth = 9;
    const blackKeyHeight = 46;

    const firstOctave = Math.min(...voicing.map(note => note.oct));
    const lastOctave = Math.max(firstOctave + 1, ...voicing.map(note => note.oct));
    const whiteKeys = [];
    const blackKeys = [];
    for (let oct = firstOctave; oct <= lastOctave; oct++) {
      for (const note of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) whiteKeys.push({ note, oct });
      for (const [note, pos] of [['C#', 0], ['D#', 1], ['F#', 3], ['G#', 4], ['A#', 5]])
        blackKeys.push({ note, oct, pos: pos + (oct - firstOctave) * 7 });
    }

    const isWhiteActive = (k) => voicing.some(v => v.key === k.note && (v.oct === k.oct || (!v.oct && k.oct === 4)));
    const isBlackActive = (k) => voicing.some(v => {
      const vKey = v.key === 'Db' ? 'C#' : (v.key === 'Eb' ? 'D#' : (v.key === 'Gb' ? 'F#' : (v.key === 'Ab' ? 'G#' : (v.key === 'Bb' ? 'A#' : v.key))));
      return vKey === k.note && (v.oct === k.oct || (!v.oct && k.oct === 4));
    });

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="chord-diagram-svg piano-svg" role="img" aria-label="Diagrama de teclado ${label}">
        <text x="${width / 2}" y="15" text-anchor="middle" class="chord-diagram-title" fill="var(--text-primary, #ffffff)" font-weight="900" font-size="12">${label} (Piano)</text>

        ${whiteKeys.map((k, i) => {
          const x = startX + i * whiteKeyWidth;
          const active = isWhiteActive(k);
          return `
            <g class="chord-interactive-key chord-piano-key" data-note="${k.note}" data-oct="${k.oct}" data-active="${active}" style="cursor: pointer;">
              <rect class="piano-key-rect" x="${x}" y="${startY}" width="${whiteKeyWidth}" height="${whiteKeyHeight}" rx="2" fill="${active ? 'var(--accent-primary, #ff5722)' : 'var(--piano-white-key, #ffffff)'}" stroke="var(--border-strong, #444444)" stroke-width="1.5"/>
              ${active ? `
                <circle cx="${x + whiteKeyWidth / 2}" cy="${startY + whiteKeyHeight - 12}" r="4" fill="#100d1c"/>
                <text x="${x + whiteKeyWidth / 2}" y="${startY + whiteKeyHeight - 9.5}" text-anchor="middle" fill="#ffffff" font-size="6.5" font-weight="900">${k.note}</text>
              ` : `
                <text x="${x + whiteKeyWidth / 2}" y="${startY + whiteKeyHeight - 4}" text-anchor="middle" fill="#222222" font-size="6" font-weight="700">${k.note}</text>
              `}
            </g>
          `;
        }).join('')}

        ${blackKeys.map((k) => {
          const x = startX + (k.pos + 1) * whiteKeyWidth - (blackKeyWidth / 2);
          const active = isBlackActive(k);
          return `
            <g class="chord-interactive-key chord-piano-key chord-piano-black-key" data-note="${k.note}" data-oct="${k.oct}" data-active="${active}" style="cursor: pointer;">
              <rect class="piano-key-rect" x="${x}" y="${startY}" width="${blackKeyWidth}" height="${blackKeyHeight}" rx="2" fill="${active ? 'var(--accent-primary, #ff5722)' : 'var(--piano-black-key, #141420)'}" stroke="var(--border-strong, #333333)" stroke-width="1"/>
              ${active ? `
                <circle cx="${x + blackKeyWidth / 2}" cy="${startY + blackKeyHeight - 10}" r="3.5" fill="#100d1c"/>
                <text x="${x + blackKeyWidth / 2}" y="${startY + blackKeyHeight - 7.5}" text-anchor="middle" fill="#ffffff" font-size="5.5" font-weight="900">${k.note}</text>
              ` : ''}
            </g>
          `;
        }).join('')}
      </svg>
    `;
  }
}

export default ChordSvgRenderer;
