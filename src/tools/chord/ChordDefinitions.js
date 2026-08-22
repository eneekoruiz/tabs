/**
 * @file ChordDefinitions.js
 * @description Base de datos de digitaciones y voicings de acordes para Guitarra, Ukelele y Piano.
 */

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
  'Csus4': { frets: [-1, 3, 3, 0, 1, 1], fingers: [0, 3, 4, 0, 1, 1], baseFret: 1 },
  'Dsus2': { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0], baseFret: 1 },
  'Esus4': { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 1, 2, 3, 0, 0], baseFret: 1 },
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
  'Bm7b5': { frets: [-1, 2, 3, 2, 3, -1], fingers: [0, 1, 3, 2, 4, 0], baseFret: 1 },
  'Cdim': { frets: [-1, 3, 4, 5, 4, -1], fingers: [0, 1, 2, 4, 3, 0], baseFret: 1 },
  'E7#9': { frets: [0, 2, 0, 1, 3, 3], fingers: [0, 2, 0, 1, 3, 4], baseFret: 1 },
  'C9': { frets: [-1, 3, 2, 3, 3, -1], fingers: [0, 2, 1, 3, 4, 0], baseFret: 1 },
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
  'Csus4': { frets: [0, 0, 1, 3], fingers: [0, 0, 1, 3], baseFret: 1 },
  'Dsus2': { frets: [2, 2, 2, 5], fingers: [1, 1, 1, 4], baseFret: 1 },
  'Bm7b5': { frets: [2, 3, 2, 3], fingers: [1, 3, 2, 4], baseFret: 1 },
  'Cdim': { frets: [2, 3, 2, 0], fingers: [1, 3, 2, 0], baseFret: 1 },
  'E7#9': { frets: [1, 2, 0, 2], fingers: [1, 2, 0, 3], baseFret: 1 },
  'C9': { frets: [0, 2, 0, 1], fingers: [0, 2, 0, 1], baseFret: 1 },
};

// Notas reales por acorde de Piano
export const PIANO_VOICINGS = {
  'C': [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }],
  'Cm': [{ key: 'C', oct: 4 }, { key: 'Eb', oct: 4 }, { key: 'G', oct: 4 }],
  'C7': [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'Bb', oct: 4 }],
  'Cmaj7': [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'B', oct: 4 }],
  'Cadd9': [{ key: 'C', oct: 4 }, { key: 'D', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }],
  'Csus4': [{ key: 'C', oct: 4 }, { key: 'F', oct: 4 }, { key: 'G', oct: 4 }],
  'C9': [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'Bb', oct: 4 }, { key: 'D', oct: 5 }],
  'Cdim': [{ key: 'C', oct: 4 }, { key: 'Eb', oct: 4 }, { key: 'Gb', oct: 4 }],

  'D': [{ key: 'D', oct: 4 }, { key: 'F#', oct: 4 }, { key: 'A', oct: 4 }],
  'Dm': [{ key: 'D', oct: 4 }, { key: 'F', oct: 4 }, { key: 'A', oct: 4 }],
  'D7': [{ key: 'D', oct: 4 }, { key: 'F#', oct: 4 }, { key: 'A', oct: 4 }, { key: 'C', oct: 5 }],
  'Dsus4': [{ key: 'D', oct: 4 }, { key: 'G', oct: 4 }, { key: 'A', oct: 4 }],
  'Dsus2': [{ key: 'D', oct: 4 }, { key: 'E', oct: 4 }, { key: 'A', oct: 4 }],

  'E': [{ key: 'E', oct: 4 }, { key: 'G#', oct: 4 }, { key: 'B', oct: 4 }],
  'Em': [{ key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'B', oct: 4 }],
  'Em7': [{ key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }],
  'E7': [{ key: 'E', oct: 4 }, { key: 'G#', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }],
  'E7#9': [{ key: 'E', oct: 4 }, { key: 'G#', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }, { key: 'G', oct: 5 }],

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
  'Bm7b5': [{ key: 'B', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F', oct: 5 }, { key: 'A', oct: 5 }],
  'B7': [{ key: 'B', oct: 4 }, { key: 'D#', oct: 5 }, { key: 'F#', oct: 5 }, { key: 'A', oct: 5 }],
  'G#m': [{ key: 'G#', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D#', oct: 5 }],
  'Bb5': [{ key: 'Bb', oct: 4 }, { key: 'F', oct: 5 }],
  'C5': [{ key: 'C', oct: 4 }, { key: 'G', oct: 4 }],
  'F5': [{ key: 'F', oct: 4 }, { key: 'C', oct: 5 }],
  'Ab5': [{ key: 'Ab', oct: 4 }, { key: 'Eb', oct: 5 }],
  'Db5': [{ key: 'Db', oct: 4 }, { key: 'Ab', oct: 4 }]
};

export const CHROMATIC_SCALE_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const CHROMATIC_SCALE_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const NOTE_FREQ = {
  'C': 261.63, 'C#': 277.18, 'Db': 277.18, 'D': 293.66, 'D#': 311.13, 'Eb': 311.13,
  'E': 329.63, 'F': 349.23, 'F#': 369.99, 'Gb': 369.99, 'G': 392.00, 'G#': 415.30,
  'Ab': 415.30, 'A': 440.00, 'A#': 466.16, 'Bb': 466.16, 'B': 493.88
};
