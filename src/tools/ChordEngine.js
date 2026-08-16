/**
 * @file ChordEngine.js
 * @description Motor integral de acordes multi-instrumento:
 * - Guitarra (6 cuerdas)
 * - Ukelele (4 cuerdas G-C-E-A)
 * - Piano / Teclado (Visualizador preciso de teclas y notas)
 * - Síntesis acústica Web Audio de alta fidelidad con modelado físico y resonancia armónica.
 */

import { events } from '../core/EventBus.js';

// Base de datos de digitaciones estándar de GUITARRA (E A D G B e)
export const GUITAR_CHORDS = {
  'C': { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], baseFret: 1 },
  'D': { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], baseFret: 1 },
  'E': { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], baseFret: 1 },
  'F': { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], baseFret: 1, barres: [1] },
  'G': { frets: [3, 2, 0, 0, 3, 3], fingers: [2, 1, 0, 0, 3, 4], baseFret: 1 },
  'A': { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], baseFret: 1 },
  'B': { frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], baseFret: 1, barres: [2] },

  'Cm': { frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], baseFret: 3, barres: [3] },
  'Dm': { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], baseFret: 1 },
  'Em': { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], baseFret: 1 },
  'Fm': { frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], baseFret: 1, barres: [1] },
  'Gm': { frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], baseFret: 3, barres: [3] },
  'Am': { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], baseFret: 1 },
  'Bm': { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], baseFret: 2, barres: [2] },

  'C7': { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0], baseFret: 1 },
  'D7': { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], baseFret: 1 },
  'E7': { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], baseFret: 1 },
  'G7': { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], baseFret: 1 },
  'A7': { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0], baseFret: 1 },
  'B7': { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], baseFret: 1 },

  'Cmaj7': { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0], baseFret: 1 },
  'Fmaj7': { frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0], baseFret: 1 },
  'Gmaj7': { frets: [3, 2, 0, 0, 0, 2], fingers: [2, 1, 0, 0, 0, 3], baseFret: 1 },
  'Am7': { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0], baseFret: 1 },
  'Em7': { frets: [0, 2, 0, 0, 3, 3], fingers: [0, 1, 0, 0, 3, 4], baseFret: 1 },
  'Dsus4': { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 4], baseFret: 1 },
  'A7sus4': { frets: [-1, 0, 2, 0, 3, 0], fingers: [0, 0, 1, 0, 2, 0], baseFret: 1 },
  'Cadd9': { frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0], baseFret: 1 },
  'F#m': { frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], baseFret: 2, barres: [2] },
  'G#m': { frets: [4, 6, 6, 4, 4, 4], fingers: [1, 3, 4, 1, 1, 1], baseFret: 4, barres: [4] },
  'F#': { frets: [2, 4, 4, 3, 2, 2], fingers: [1, 3, 4, 2, 1, 1], baseFret: 2, barres: [2] },
  'G5': { frets: [3, 5, 5, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0], baseFret: 3 },
  'Bb5': { frets: [-1, 1, 3, 3, -1, -1], fingers: [0, 1, 3, 4, 0, 0], baseFret: 1 },
  'C5': { frets: [-1, 3, 5, 5, -1, -1], fingers: [0, 1, 3, 4, 0, 0], baseFret: 3 },
  'F5': { frets: [1, 3, 3, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0], baseFret: 1 },
  'Ab5': { frets: [4, 6, 6, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0], baseFret: 4 },
  'Db5': { frets: [-1, 4, 6, 6, -1, -1], fingers: [0, 1, 3, 4, 0, 0], baseFret: 4 },
};

// Base de datos de digitaciones estándar de UKELELE (G C E A)
export const UKULELE_CHORDS = {
  'C': { frets: [0, 0, 0, 3], fingers: [0, 0, 0, 3], baseFret: 1 },
  'D': { frets: [2, 2, 2, 0], fingers: [1, 2, 3, 0], baseFret: 1 },
  'E': { frets: [4, 4, 4, 2], fingers: [2, 3, 4, 1], baseFret: 1, barres: [2] },
  'F': { frets: [2, 0, 1, 0], fingers: [2, 0, 1, 0], baseFret: 1 },
  'G': { frets: [0, 2, 3, 2], fingers: [0, 1, 3, 2], baseFret: 1 },
  'A': { frets: [2, 1, 0, 0], fingers: [2, 1, 0, 0], baseFret: 1 },
  'B': { frets: [4, 3, 2, 2], fingers: [3, 2, 1, 1], baseFret: 1, barres: [2] },

  'Cm': { frets: [0, 3, 3, 3], fingers: [0, 1, 2, 3], baseFret: 1, barres: [3] },
  'Dm': { frets: [2, 2, 1, 0], fingers: [2, 3, 1, 0], baseFret: 1 },
  'Em': { frets: [0, 4, 3, 2], fingers: [0, 3, 2, 1], baseFret: 1 },
  'Fm': { frets: [1, 0, 1, 3], fingers: [1, 0, 2, 4], baseFret: 1 },
  'Gm': { frets: [0, 2, 3, 1], fingers: [0, 2, 3, 1], baseFret: 1 },
  'Am': { frets: [2, 0, 0, 0], fingers: [2, 0, 0, 0], baseFret: 1 },
  'Bm': { frets: [4, 2, 2, 2], fingers: [3, 1, 1, 1], baseFret: 1, barres: [2] },

  'C7': { frets: [0, 0, 0, 1], fingers: [0, 0, 0, 1], baseFret: 1 },
  'D7': { frets: [2, 0, 2, 0], fingers: [1, 0, 2, 0], baseFret: 1 },
  'E7': { frets: [1, 2, 0, 2], fingers: [1, 2, 0, 3], baseFret: 1 },
  'G7': { frets: [0, 2, 1, 2], fingers: [0, 2, 1, 3], baseFret: 1 },
  'A7': { frets: [0, 1, 0, 0], fingers: [0, 1, 0, 0], baseFret: 1 },
  'B7': { frets: [2, 3, 2, 2], fingers: [1, 2, 1, 1], baseFret: 1, barres: [2] },

  'Cmaj7': { frets: [0, 0, 0, 2], fingers: [0, 0, 0, 1], baseFret: 1 },
  'Fmaj7': { frets: [2, 4, 1, 0], fingers: [2, 4, 1, 0], baseFret: 1 },
  'Gmaj7': { frets: [0, 2, 2, 2], fingers: [0, 1, 2, 3], baseFret: 1 },
  'Am7': { frets: [0, 0, 0, 0], fingers: [0, 0, 0, 0], baseFret: 1 },
  'Em7': { frets: [0, 2, 0, 2], fingers: [0, 1, 0, 2], baseFret: 1 },
  'Dsus4': { frets: [2, 2, 3, 0], fingers: [1, 2, 3, 0], baseFret: 1 },
  'A7sus4': { frets: [0, 2, 0, 0], fingers: [0, 2, 0, 0], baseFret: 1 },
  'Cadd9': { frets: [0, 2, 0, 3], fingers: [0, 1, 0, 2], baseFret: 1 },
  'F#m': { frets: [2, 1, 2, 0], fingers: [2, 1, 3, 0], baseFret: 1 },
  'G#m': { frets: [4, 3, 4, 2], fingers: [3, 2, 4, 1], baseFret: 1 },
  'F#': { frets: [3, 1, 2, 1], fingers: [3, 1, 2, 1], baseFret: 1, barres: [1] },
  'G5': { frets: [0, 2, 3, 5], fingers: [0, 1, 2, 4], baseFret: 1 },
  'Bb5': { frets: [3, 5, 6, -1], fingers: [1, 3, 4, 0], baseFret: 3 },
  'C5': { frets: [0, 0, 3, 3], fingers: [0, 0, 1, 2], baseFret: 1 },
  'F5': { frets: [5, 5, -1, -1], fingers: [1, 2, 0, 0], baseFret: 5 },
  'Ab5': { frets: [1, 3, -1, -1], fingers: [1, 3, 0, 0], baseFret: 1 },
  'Db5': { frets: [1, 1, 4, 4], fingers: [1, 1, 3, 4], baseFret: 1 },
};

// Notas reales por acorde de Piano
export const PIANO_VOICINGS = {
  'C': [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }],
  'Cm': [{ key: 'C', oct: 4 }, { key: 'Eb', oct: 4 }, { key: 'G', oct: 4 }],
  'C7': [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'Bb', oct: 4 }],
  'Cmaj7': [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'B', oct: 4 }],
  'Cadd9': [{ key: 'C', oct: 4 }, { key: 'D', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }],

  'D': [{ key: 'D', oct: 4 }, { key: 'F#', oct: 4 }, { key: 'A', oct: 4 }],
  'Dm': [{ key: 'D', oct: 4 }, { key: 'F', oct: 4 }, { key: 'A', oct: 4 }],
  'D7': [{ key: 'D', oct: 4 }, { key: 'F#', oct: 4 }, { key: 'A', oct: 4 }, { key: 'C', oct: 5 }],
  'Dsus4': [{ key: 'D', oct: 4 }, { key: 'G', oct: 4 }, { key: 'A', oct: 4 }],

  'E': [{ key: 'E', oct: 4 }, { key: 'G#', oct: 4 }, { key: 'B', oct: 4 }],
  'Em': [{ key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'B', oct: 4 }],
  'Em7': [{ key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }],
  'E7': [{ key: 'E', oct: 4 }, { key: 'G#', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }],

  'F': [{ key: 'F', oct: 4 }, { key: 'A', oct: 4 }, { key: 'C', oct: 5 }],
  'Fm': [{ key: 'F', oct: 4 }, { key: 'Ab', oct: 4 }, { key: 'C', oct: 5 }],
  'Fmaj7': [{ key: 'F', oct: 4 }, { key: 'A', oct: 4 }, { key: 'C', oct: 5 }, { key: 'E', oct: 5 }],
  'F#m': [{ key: 'F#', oct: 4 }, { key: 'A', oct: 4 }, { key: 'C#', oct: 5 }],
  'F#': [{ key: 'F#', oct: 4 }, { key: 'A#', oct: 4 }, { key: 'C#', oct: 5 }],

  'G': [{ key: 'G', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }],
  'Gm': [{ key: 'G', oct: 4 }, { key: 'Bb', oct: 4 }, { key: 'D', oct: 5 }],
  'G7': [{ key: 'G', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F', oct: 5 }],
  'Gmaj7': [{ key: 'G', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F#', oct: 5 }],
  'G5': [{ key: 'G', oct: 4 }, { key: 'D', oct: 5 }],

  'A': [{ key: 'A', oct: 4 }, { key: 'C#', oct: 5 }, { key: 'E', oct: 5 }],
  'Am': [{ key: 'A', oct: 4 }, { key: 'C', oct: 5 }, { key: 'E', oct: 5 }],
  'Am7': [{ key: 'A', oct: 4 }, { key: 'C', oct: 5 }, { key: 'E', oct: 5 }, { key: 'G', oct: 5 }],
  'A7': [{ key: 'A', oct: 4 }, { key: 'C#', oct: 5 }, { key: 'E', oct: 5 }, { key: 'G', oct: 5 }],
  'A7sus4': [{ key: 'A', oct: 4 }, { key: 'D', oct: 5 }, { key: 'E', oct: 5 }, { key: 'G', oct: 5 }],

  'B': [{ key: 'B', oct: 4 }, { key: 'D#', oct: 5 }, { key: 'F#', oct: 5 }],
  'Bm': [{ key: 'B', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F#', oct: 5 }],
  'B7': [{ key: 'B', oct: 4 }, { key: 'D#', oct: 5 }, { key: 'F#', oct: 5 }, { key: 'A', oct: 5 }],
  'G#m': [{ key: 'G#', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D#', oct: 5 }],
  'Bb5': [{ key: 'Bb', oct: 4 }, { key: 'F', oct: 5 }],
  'C5': [{ key: 'C', oct: 4 }, { key: 'G', oct: 4 }],
  'F5': [{ key: 'F', oct: 4 }, { key: 'C', oct: 5 }],
  'Ab5': [{ key: 'Ab', oct: 4 }, { key: 'Eb', oct: 5 }],
  'Db5': [{ key: 'Db', oct: 4 }, { key: 'Ab', oct: 4 }]
};

const CHROMATIC_SCALE_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHROMATIC_SCALE_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

class ChordEngine {
  constructor() {
    this.currentInstrument = 'guitar'; // 'guitar' | 'piano' | 'ukulele'
    this.isLeftHanded = false;
    this.audioCtx = null;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  setInstrument(inst) {
    if (['guitar', 'piano', 'ukulele'].includes(inst)) {
      this.currentInstrument = inst;
      events.emit('chord:instrumentChanged', this.currentInstrument);
    }
  }

  getChord(chordName, instrument = this.currentInstrument) {
    if (!chordName) return null;
    const name = chordName.trim();
    const db = instrument === 'ukulele' ? UKULELE_CHORDS : GUITAR_CHORDS;

    if (db[name]) return db[name];
    const simplified = this.simplifyChord(name);
    return db[simplified] || db['C'];
  }

  simplifyChord(chord) {
    if (!chord) return 'C';
    const clean = chord.trim();
    const baseChord = clean.split('/')[0];
    const match = baseChord.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return baseChord;

    const [, root, extension] = match;
    if (extension.startsWith('m') && !extension.startsWith('maj')) {
      return `${root}m`;
    }
    return root;
  }

  transposeChord(chord, semitones) {
    if (!chord || semitones === 0) return chord;
    const match = chord.trim().match(/^([A-G][#b]?)(.*)$/);
    if (!match) return chord;

    const [, root, suffix] = match;
    let index = CHROMATIC_SCALE_SHARPS.indexOf(root);
    let scale = CHROMATIC_SCALE_SHARPS;

    if (index === -1) {
      index = CHROMATIC_SCALE_FLATS.indexOf(root);
      scale = CHROMATIC_SCALE_FLATS;
    }
    if (index === -1) return chord;

    let newIndex = (index + semitones) % 12;
    if (newIndex < 0) newIndex += 12;

    const newRoot = scale[newIndex];
    return `${newRoot}${suffix}`;
  }

  getChordSvg(chordName, instrument = this.currentInstrument) {
    return this.renderChordSVG(chordName, { instrument });
  }

  renderChordSVG(chordName, { instrument = this.currentInstrument, isLeftHanded = this.isLeftHanded } = {}) {
    if (instrument === 'piano') {
      return this.renderPianoSVG(chordName);
    } else if (instrument === 'ukulele') {
      return this.renderUkuleleSVG(chordName, { isLeftHanded });
    }
    return this.renderGuitarSVG(chordName, { isLeftHanded });
  }

  renderGuitarSVG(chordName, { isLeftHanded = this.isLeftHanded } = {}) {
    const chord = this.getChord(chordName, 'guitar');
    if (!chord) return `<div class="chord-not-found">Acorde no disponible</div>`;

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
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="chord-diagram-svg guitar-svg" role="img" aria-label="Diagrama de guitarra ${chordName}">
        <text x="${width / 2}" y="20" text-anchor="middle" class="chord-diagram-title" fill="#ff5722" font-weight="900" font-size="14">${chordName} (Guitarra)</text>

        ${chord.baseFret > 1 
          ? `<text x="10" y="${startY + 16}" fill="#00e5ff" font-size="11" font-weight="bold">${chord.baseFret}fr</text>`
          : `<line x1="${startX}" y1="${startY}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY}" stroke="#ffffff" stroke-width="4"/>`
        }

        ${Array.from({ length: numFrets + 1 }, (_, f) => `
          <line x1="${startX}" y1="${startY + f * fretGap}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY + f * fretGap}" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
        `).join('')}

        ${Array.from({ length: numStrings }, (_, s) => `
          <line x1="${startX + s * stringGap}" y1="${startY}" x2="${startX + s * stringGap}" y2="${startY + numFrets * fretGap}" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
        `).join('')}

        ${frets.map((fret, s) => {
          const x = startX + s * stringGap;
          if (fret === -1) return `<text x="${x}" y="${startY - 6}" text-anchor="middle" fill="#ff5252" font-size="11" font-weight="bold">✕</text>`;
          if (fret === 0) return `<circle cx="${x}" cy="${startY - 10}" r="3.5" fill="none" stroke="#00e676" stroke-width="2"/>`;
          return '';
        }).join('')}

        ${frets.map((fret, s) => {
          if (fret > 0) {
            const displayFret = fret - (chord.baseFret > 1 ? chord.baseFret - 1 : 0);
            if (displayFret >= 1 && displayFret <= numFrets) {
              const cx = startX + s * stringGap;
              const cy = startY + (displayFret - 0.5) * fretGap;
              const finger = fingers[s] || '';
              return `
                <circle cx="${cx}" cy="${cy}" r="7" fill="#ff5722"/>
                ${finger ? `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="900">${finger}</text>` : ''}
              `;
            }
          }
          return '';
        }).join('')}
      </svg>
    `;
  }

  renderUkuleleSVG(chordName, { isLeftHanded = this.isLeftHanded } = {}) {
    const chord = this.getChord(chordName, 'ukulele');
    if (!chord) return `<div class="chord-not-found">Acorde no disponible</div>`;

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
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="chord-diagram-svg ukulele-svg" role="img" aria-label="Diagrama de ukelele ${chordName}">
        <text x="${width / 2}" y="20" text-anchor="middle" fill="#00e5ff" font-weight="900" font-size="14">${chordName} (Ukelele)</text>

        ${chord.baseFret > 1 
          ? `<text x="14" y="${startY + 16}" fill="#ff5722" font-size="11" font-weight="bold">${chord.baseFret}fr</text>`
          : `<line x1="${startX}" y1="${startY}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY}" stroke="#ffd600" stroke-width="4"/>`
        }

        ${Array.from({ length: numFrets + 1 }, (_, f) => `
          <line x1="${startX}" y1="${startY + f * fretGap}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY + f * fretGap}" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
        `).join('')}

        ${Array.from({ length: numStrings }, (_, s) => `
          <line x1="${startX + s * stringGap}" y1="${startY}" x2="${startX + s * stringGap}" y2="${startY + numFrets * fretGap}" stroke="rgba(255,214,0,0.6)" stroke-width="2"/>
        `).join('')}

        ${frets.map((fret, s) => {
          const x = startX + s * stringGap;
          if (fret === -1) return `<text x="${x}" y="${startY - 6}" text-anchor="middle" fill="#ff5252" font-size="11" font-weight="bold">✕</text>`;
          if (fret === 0) return `<circle cx="${x}" cy="${startY - 10}" r="3.5" fill="none" stroke="#00e676" stroke-width="2"/>`;
          return '';
        }).join('')}

        ${frets.map((fret, s) => {
          if (fret > 0) {
            const displayFret = fret - (chord.baseFret > 1 ? chord.baseFret - 1 : 0);
            if (displayFret >= 1 && displayFret <= numFrets) {
              const cx = startX + s * stringGap;
              const cy = startY + (displayFret - 0.5) * fretGap;
              const finger = fingers[s] || '';
              return `
                <circle cx="${cx}" cy="${cy}" r="7.5" fill="#00e5ff"/>
                ${finger ? `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#000000" font-size="9" font-weight="900">${finger}</text>` : ''}
              `;
            }
          }
          return '';
        }).join('')}
      </svg>
    `;
  }

  renderPianoSVG(chordName) {
    const cleanName = this.simplifyChord(chordName);
    const activeVoicing = PIANO_VOICINGS[chordName] || PIANO_VOICINGS[cleanName] || [
      { key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }
    ];

    const width = 230;
    const height = 150;
    const startX = 10;
    const startY = 32;
    const whiteKeyWidth = 21;
    const whiteKeyHeight = 96;
    const blackKeyWidth = 13;
    const blackKeyHeight = 58;

    const whiteKeys = [
      { note: 'C', oct: 4 },
      { note: 'D', oct: 4 },
      { note: 'E', oct: 4 },
      { note: 'F', oct: 4 },
      { note: 'G', oct: 4 },
      { note: 'A', oct: 4 },
      { note: 'B', oct: 4 },
      { note: 'C', oct: 5 },
      { note: 'D', oct: 5 },
      { note: 'E', oct: 5 },
    ];

    const blackKeys = [
      { note: 'C#', alt: 'Db', oct: 4, pos: 0 },
      { note: 'D#', alt: 'Eb', oct: 4, pos: 1 },
      { note: 'F#', alt: 'Gb', oct: 4, pos: 3 },
      { note: 'G#', alt: 'Ab', oct: 4, pos: 4 },
      { note: 'A#', alt: 'Bb', oct: 4, pos: 5 },
      { note: 'C#', alt: 'Db', oct: 5, pos: 7 },
      { note: 'D#', alt: 'Eb', oct: 5, pos: 8 },
    ];

    const isWhiteActive = (wKey) => {
      return activeVoicing.find(v => v.key === wKey.note && v.oct === wKey.oct);
    };

    const isBlackActive = (bKey) => {
      return activeVoicing.find(v => (v.key === bKey.note || v.key === bKey.alt) && v.oct === bKey.oct);
    };

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="chord-diagram-svg piano-svg" role="img" aria-label="Diagrama de piano ${chordName}">
        <text x="${width / 2}" y="20" text-anchor="middle" fill="#ffd600" font-weight="900" font-size="14">${chordName} (Piano)</text>

        <!-- Teclas Blancas -->
        ${whiteKeys.map((k, idx) => {
          const x = startX + idx * whiteKeyWidth;
          const active = isWhiteActive(k);
          return `
            <rect x="${x}" y="${startY}" width="${whiteKeyWidth}" height="${whiteKeyHeight}" rx="4" fill="${active ? '#ff5722' : '#f8f8fa'}" stroke="#333340" stroke-width="1.5"/>
            ${active ? `
              <circle cx="${x + whiteKeyWidth / 2}" cy="${startY + whiteKeyHeight - 16}" r="5.5" fill="#ffffff"/>
              <text x="${x + whiteKeyWidth / 2}" y="${startY + whiteKeyHeight - 13}" text-anchor="middle" fill="#ff5722" font-size="8" font-weight="900">${k.note}</text>
            ` : `
              <text x="${x + whiteKeyWidth / 2}" y="${startY + whiteKeyHeight - 8}" text-anchor="middle" fill="#9999a0" font-size="7" font-weight="600">${k.note}</text>
            `}
          `;
        }).join('')}

        <!-- Teclas Negras -->
        ${blackKeys.map((k) => {
          const x = startX + (k.pos + 1) * whiteKeyWidth - (blackKeyWidth / 2);
          const active = isBlackActive(k);
          return `
            <rect x="${x}" y="${startY}" width="${blackKeyWidth}" height="${blackKeyHeight}" rx="3" fill="${active ? '#00e5ff' : '#14141c'}" stroke="#000000" stroke-width="1.5"/>
            ${active ? `
              <circle cx="${x + blackKeyWidth / 2}" cy="${startY + blackKeyHeight - 12}" r="4" fill="#000000"/>
              <text x="${x + blackKeyWidth / 2}" y="${startY + blackKeyHeight - 9.5}" text-anchor="middle" fill="#00e5ff" font-size="6.5" font-weight="900">${k.note}</text>
            ` : ''}
          `;
        }).join('')}
      </svg>
    `;
  }

  /**
   * Síntesis acústica de acordes realista con calidez de madera, armónicos orgánicos y transitorios de pulsación.
   */
  auditionChord(chordName, instrument = this.currentInstrument) {
    try {
      const ctx = this.getAudioContext();

      if (instrument === 'piano') {
        // Síntesis de Piano de Cola con armónicos complejos y resonancia de caja
        const cleanName = this.simplifyChord(chordName);
        const voicing = PIANO_VOICINGS[chordName] || PIANO_VOICINGS[cleanName] || [
          { key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }
        ];

        const noteFreqMap = {
          'C': 261.63, 'C#': 277.18, 'Db': 277.18,
          'D': 293.66, 'D#': 311.13, 'Eb': 311.13,
          'E': 329.63,
          'F': 349.23, 'F#': 369.99, 'Gb': 369.99,
          'G': 392.00, 'G#': 415.30, 'Ab': 415.30,
          'A': 440.00, 'A#': 466.16, 'Bb': 466.16,
          'B': 493.88
        };

        voicing.forEach((v, idx) => {
          let baseFreq = noteFreqMap[v.key] || 261.63;
          if (v.oct === 5) baseFreq *= 2;

          const startTime = ctx.currentTime + idx * 0.018;

          // Filtro cálido de resonancia de madera
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(3200, startTime);
          filter.frequency.exponentialRampToValueAtTime(600, startTime + 1.8);

          // Armónicos del piano (1x, 2x, 3x, 4x)
          [
            { mult: 1.0, gain: 0.28, type: 'triangle' },
            { mult: 2.0, gain: 0.12, type: 'sine' },
            { mult: 3.0, gain: 0.05, type: 'sine' },
            { mult: 4.0, gain: 0.02, type: 'sine' },
          ].forEach(h => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = h.type;
            osc.frequency.setValueAtTime(baseFreq * h.mult, startTime);

            gain.gain.setValueAtTime(0.0001, startTime);
            gain.gain.linearRampToValueAtTime(h.gain, startTime + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.00001, startTime + 2.2);

            osc.connect(gain);
            gain.connect(filter);

            osc.start(startTime);
            osc.stop(startTime + 2.3);
          });

          filter.connect(ctx.destination);
        });
      } else if (instrument === 'ukulele') {
        // Síntesis de Ukelele de Cuerdas de Nylon (G4 C4 E4 A4)
        const chord = this.getChord(chordName, 'ukulele');
        if (!chord) return;
        const ukeBaseFreqs = [392.00, 261.63, 329.63, 440.00];

        chord.frets.forEach((fret, stringIdx) => {
          if (fret === -1) return;
          const noteFreq = ukeBaseFreqs[stringIdx] * Math.pow(2, fret / 12);
          const startTime = ctx.currentTime + stringIdx * 0.03;

          // Filtro para brillo de nylon y ataque percusivo
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(noteFreq * 2.2, startTime);
          filter.Q.setValueAtTime(1.8, startTime);

          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'triangle';
          osc1.frequency.setValueAtTime(noteFreq, startTime);

          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(noteFreq * 2, startTime);

          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(0.24, startTime + 0.006);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.3);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(startTime);
          osc2.start(startTime);
          osc1.stop(startTime + 1.4);
          osc2.stop(startTime + 1.4);
        });
      } else {
        // Síntesis de Guitarra Acústica de 6 Cuerdas con resonancia orgánica
        const chord = this.getChord(chordName, 'guitar');
        if (!chord) return;
        const baseFreqs = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];

        chord.frets.forEach((fret, stringIdx) => {
          if (fret === -1) return;
          const noteFreq = baseFreqs[stringIdx] * Math.pow(2, fret / 12);
          const startTime = ctx.currentTime + stringIdx * 0.035;

          // Cuerpo de guitarra acústica (Filtro con resonancia cálida)
          const bodyFilter = ctx.createBiquadFilter();
          bodyFilter.type = 'lowpass';
          bodyFilter.frequency.setValueAtTime(2800, startTime);
          bodyFilter.frequency.exponentialRampToValueAtTime(450, startTime + 1.5);

          // Oscilador 1: Fundamental acústica
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'triangle';
          osc1.frequency.setValueAtTime(noteFreq, startTime);

          gain1.gain.setValueAtTime(0.0001, startTime);
          gain1.gain.linearRampToValueAtTime(0.22, startTime + 0.008);
          gain1.gain.exponentialRampToValueAtTime(0.00001, startTime + 2.0);

          // Oscilador 2: Armónico de cuerda entorchada
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(noteFreq * 2.01, startTime);

          gain2.gain.setValueAtTime(0.0001, startTime);
          gain2.gain.linearRampToValueAtTime(0.08, startTime + 0.005);
          gain2.gain.exponentialRampToValueAtTime(0.00001, startTime + 1.2);

          osc1.connect(gain1);
          osc2.connect(gain2);

          gain1.connect(bodyFilter);
          gain2.connect(bodyFilter);
          bodyFilter.connect(ctx.destination);

          osc1.start(startTime);
          osc2.start(startTime);
          osc1.stop(startTime + 2.1);
          osc2.stop(startTime + 2.1);
        });
      }
    } catch (err) {
      console.warn('[ChordEngine] Error reproduciendo audio:', err);
    }
  }
}

export const chordEngine = new ChordEngine();
export default chordEngine;
