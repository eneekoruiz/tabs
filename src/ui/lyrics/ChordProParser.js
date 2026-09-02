/**
 * @file ChordProParser.js
 * @description Parser y formateador de letras con acordes interactivos (ChordPro).
 * Soporta transposición cromática, cejillas (capo) y notación anglo/latina (Do, Re, Mi).
 */

const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const LATIN_MAP = {
  'C': 'Do', 'C#': 'Do#', 'Db': 'Reb',
  'D': 'Re', 'D#': 'Re#', 'Eb': 'Mib',
  'E': 'Mi',
  'F': 'Fa', 'F#': 'Fa#', 'Gb': 'Solb',
  'G': 'Sol', 'G#': 'Sol#', 'Ab': 'Lab',
  'A': 'La', 'A#': 'La#', 'Bb': 'Sib',
  'B': 'Si'
};

export class ChordProParser {
  static getAccidentalPreference() {
    try {
      return globalThis.localStorage?.getItem('app_accidental_preference') === 'flats' ? 'flats' : 'sharps';
    } catch {
      return 'sharps';
    }
  }

  static spellAccidentals(chord, preference = this.getAccidentalPreference()) {
    if (!chord) return '';
    const notes = preference === 'flats' ? NOTES_FLAT : NOTES_SHARP;
    return String(chord).split('/').map((part) => part.replace(/^([A-G][#b]?)/, (match, note) => {
      let index = NOTES_SHARP.indexOf(note);
      if (index < 0) index = NOTES_FLAT.indexOf(note);
      return index < 0 ? match : notes[index];
    })).join('/');
  }

  /**
   * Transpone un acorde un número de semitonos teniendo en cuenta la cejilla.
   * @param {string} chordName 
   * @param {number} semitones 
   * @param {number} [capoFret=0] 
   * @returns {string}
   */
  static transposeChord(chordName, semitones, capoFret = 0) {
    const totalSemitones = semitones - capoFret;
    if (totalSemitones === 0 || !chordName) return chordName;

    const match = chordName.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return chordName;

    const root = match[1];
    const suffix = match[2];

    let idx = NOTES_SHARP.indexOf(root);
    let useSharps = true;
    if (idx === -1) {
      idx = NOTES_FLAT.indexOf(root);
      useSharps = false;
    }
    if (idx === -1) return chordName;

    let newIdx = (idx + totalSemitones) % 12;
    if (newIdx < 0) newIdx += 12;

    const newRoot = useSharps ? NOTES_SHARP[newIdx] : NOTES_FLAT[newIdx];
    return `${newRoot}${suffix}`;
  }

  /**
   * Extrae la lista única de acordes de un texto ChordPro.
   * @param {string} rawText 
   * @param {number} semitones 
   * @param {number} capoFret 
   * @returns {string[]}
   */
  static extractUniqueChords(rawText, semitones = 0, capoFret = 0) {
    if (typeof rawText === 'object' && rawText !== null) {
      rawText = rawText.chordpro || rawText.lyrics || rawText.text || '';
    }
    if (!rawText || typeof rawText !== 'string') return [];
    const chords = new Set();
    const regex = /\[([A-G0-9#b\/\+msusdimmaj]+)\]/g;
    let match;
    while ((match = regex.exec(rawText)) !== null) {
      if (match[1]) {
        const transposed = this.transposeChord(match[1], semitones, capoFret);
        chords.add(transposed);
      }
    }
    return Array.from(chords);
  }

  /**
   * Formatea un acorde según el sistema de notación (anglo o latino).
   * @param {string} chord 
   * @param {'anglo'|'latin'} notation 
   * @returns {string}
   */
  static formatChordDisplay(chord, notation = 'anglo', accidentalPreference = this.getAccidentalPreference()) {
    if (!chord) return '';
    const spelledChord = this.spellAccidentals(chord, accidentalPreference);
    if (notation !== 'latin') return spelledChord;

    const match = spelledChord.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return spelledChord;

    const root = match[1];
    const suffix = match[2];
    const latinRoot = LATIN_MAP[root] || root;
    return `${latinRoot}${suffix}`;
  }

  /**
   * Parsea un texto ChordPro y genera el HTML interactivo con botones de acordes.
   * @param {string} rawText 
   * @param {Object} options 
   * @returns {string}
   */
  static parseToHtml(rawText, { semitones = 0, capoFret = 0, notation = 'anglo', hideChords = false } = {}) {
    if (typeof rawText === 'object' && rawText !== null) {
      rawText = rawText.chordpro || rawText.lyrics || rawText.text || '';
    }
    if (!rawText || typeof rawText !== 'string') return '<p class="lyrics-empty">Cargando letra oficial...</p>';

    const lines = rawText.split('\n');
    let html = '<div class="lyrics-content-body" id="lyricsContentBodyInner">';

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (/^\[(Intro|Verse|Chorus|Bridge|Outro|Solo|Pre-Chorus|Estribillo|Verso)[^\]]*\]$/i.test(line)) {
        const sectionName = line.replace(/[\[\]]/g, '');
        html += `<div class="lyrics-section-header">${sectionName}</div>`;
        continue;
      }

      if (line === '') {
        html += '<div class="lyrics-spacer" style="height: 14px;"></div>';
        continue;
      }

      html += '<div class="lyrics-line">';

      const regex = /\[([A-G0-9#b\/\+msusdimmaj]+)\]|([^\[]+)/g;
      let match;
      let currentChord = null;

      while ((match = regex.exec(rawLine)) !== null) {
        if (match[1]) {
          const transposed = this.transposeChord(match[1], semitones, capoFret);
          if (currentChord) {
            const displayChord = this.formatChordDisplay(currentChord, notation);
            html += `
              <div class="lyrics-chord-word-pair">
                ${!hideChords ? `<button class="chord-badge btn-chord-popover" data-chord="${currentChord}" data-original-chord="${currentChord}" aria-label="Ver acorde ${displayChord}">${displayChord}</button>` : ''}
                <span class="lyrics-word">&nbsp;&nbsp;&nbsp;&nbsp;</span>
              </div>
            `;
          }
          currentChord = transposed;
        } else if (match[2]) {
          const textPart = match[2];
          const words = textPart.split(/(\s+)/);
          for (const w of words) {
            const trimmedWord = w.trim();
            if (trimmedWord === '') {
              html += `<span class="lyrics-space" style="display: inline-block; width: 6px;"></span>`;
            } else if (/^\.+$/.test(trimmedWord)) {
              // Filtrar puntos de ritmo o compás para que no se muestren como letras sueltas
              html += `<span class="lyrics-space" style="display: inline-block; width: 8px;"></span>`;
            } else {
              const displayChord = currentChord ? this.formatChordDisplay(currentChord, notation) : '';
              html += `
                <div class="lyrics-chord-word-pair">
                  ${!hideChords && currentChord ? `<button class="chord-badge btn-chord-popover" data-chord="${currentChord}" data-original-chord="${currentChord}" aria-label="Ver acorde ${displayChord}">${displayChord}</button>` : (!hideChords ? '<span class="chord-placeholder" style="height: 20px; display: block;"></span>' : '')}
                  <span class="lyrics-word">${w}</span>
                </div>
              `;
              currentChord = null;
            }
          }
        }
      }

      if (currentChord) {
        const displayChord = this.formatChordDisplay(currentChord, notation);
        html += `
          <div class="lyrics-chord-word-pair">
            ${!hideChords ? `<button class="chord-badge btn-chord-popover" data-chord="${currentChord}" data-original-chord="${currentChord}" aria-label="Ver acorde ${displayChord}">${displayChord}</button>` : ''}
            <span class="lyrics-word">&nbsp;</span>
          </div>
        `;
      }

      html += '</div>';
    }

    html += '</div>';
    return html;
  }
}

export default ChordProParser;
