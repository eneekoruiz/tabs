/**
 * @file ChordDefinitions.js
 * @description Base de datos estática pre-verificada de digitaciones y voicings de acordes
 * para Guitarra (EADGBe), Ukelele (GCEA) y Piano. Cero alucinaciones algorítmicas.
 */

// Mapeo canónico de notación latina a anglosajona
export const LATIN_TO_ANGLO_MAP = Object.freeze({
  'DO': 'C',
  'RE': 'D',
  'MI': 'E',
  'FA': 'F',
  'SOL': 'G',
  'LA': 'A',
  'SI': 'B'
});

// Base de datos de digitaciones estándar y verificadas de GUITARRA (E A D G B e)
export const GUITAR_CHORDS = Object.freeze({
  // Mayores
  'C': { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], baseFret: 1 },
  'C#': { frets: [-1, 4, 6, 6, 6, 4], fingers: [0, 1, 2, 3, 4, 1], baseFret: 4, barres: [4] },
  'Db': { frets: [-1, 4, 6, 6, 6, 4], fingers: [0, 1, 2, 3, 4, 1], baseFret: 4, barres: [4] },
  'D': { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], baseFret: 1 },
  'D#': { frets: [-1, 6, 8, 8, 8, 6], fingers: [0, 1, 2, 3, 4, 1], baseFret: 6, barres: [6] },
  'Eb': { frets: [-1, 6, 8, 8, 8, 6], fingers: [0, 1, 2, 3, 4, 1], baseFret: 6, barres: [6] },
  'E': { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], baseFret: 1 },
  'F': { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], baseFret: 1, barres: [1] },
  'F#': { frets: [2, 4, 4, 3, 2, 2], fingers: [1, 3, 4, 2, 1, 1], baseFret: 2, barres: [2] },
  'Gb': { frets: [2, 4, 4, 3, 2, 2], fingers: [1, 3, 4, 2, 1, 1], baseFret: 2, barres: [2] },
  'G': { frets: [3, 2, 0, 0, 3, 3], fingers: [2, 1, 0, 0, 3, 4], baseFret: 1 },
  'G#': { frets: [4, 6, 6, 5, 4, 4], fingers: [1, 3, 4, 2, 1, 1], baseFret: 4, barres: [4] },
  'Ab': { frets: [4, 6, 6, 5, 4, 4], fingers: [1, 3, 4, 2, 1, 1], baseFret: 4, barres: [4] },
  'A': { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], baseFret: 1 },
  'A#': { frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], baseFret: 1, barres: [1] },
  'Bb': { frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], baseFret: 1, barres: [1] },
  'B': { frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], baseFret: 1, barres: [2] },

  // Menores
  'Cm': { frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], baseFret: 3, barres: [3] },
  'C#m': { frets: [-1, 4, 6, 6, 5, 4], fingers: [0, 1, 3, 4, 2, 1], baseFret: 4, barres: [4] },
  'Dbm': { frets: [-1, 4, 6, 6, 5, 4], fingers: [0, 1, 3, 4, 2, 1], baseFret: 4, barres: [4] },
  'Dm': { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], baseFret: 1 },
  'D#m': { frets: [-1, 6, 8, 8, 7, 6], fingers: [0, 1, 3, 4, 2, 1], baseFret: 6, barres: [6] },
  'Ebm': { frets: [-1, 6, 8, 8, 7, 6], fingers: [0, 1, 3, 4, 2, 1], baseFret: 6, barres: [6] },
  'Em': { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], baseFret: 1 },
  'Fm': { frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], baseFret: 1, barres: [1] },
  'F#m': { frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], baseFret: 2, barres: [2] },
  'Gbm': { frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], baseFret: 2, barres: [2] },
  'Gm': { frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], baseFret: 3, barres: [3] },
  'G#m': { frets: [4, 6, 6, 4, 4, 4], fingers: [1, 3, 4, 1, 1, 1], baseFret: 4, barres: [4] },
  'Abm': { frets: [4, 6, 6, 4, 4, 4], fingers: [1, 3, 4, 1, 1, 1], baseFret: 4, barres: [4] },
  'Am': { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], baseFret: 1 },
  'A#m': { frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1], baseFret: 1, barres: [1] },
  'Bbm': { frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1], baseFret: 1, barres: [1] },
  'Bm': { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], baseFret: 2, barres: [2] },

  // Séptimas Dominantes (7)
  'C7': { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0], baseFret: 1 },
  'C#7': { frets: [-1, 4, 3, 4, 2, -1], fingers: [0, 3, 2, 4, 1, 0], baseFret: 1 },
  'Db7': { frets: [-1, 4, 3, 4, 2, -1], fingers: [0, 3, 2, 4, 1, 0], baseFret: 1 },
  'D7': { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], baseFret: 1 },
  'D#7': { frets: [-1, 6, 5, 6, 4, -1], fingers: [0, 3, 2, 4, 1, 0], baseFret: 3 },
  'Eb7': { frets: [-1, 6, 5, 6, 4, -1], fingers: [0, 3, 2, 4, 1, 0], baseFret: 3 },
  'E7': { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], baseFret: 1 },
  'F7': { frets: [1, 3, 1, 2, 1, 1], fingers: [1, 3, 1, 2, 1, 1], baseFret: 1, barres: [1] },
  'F#7': { frets: [2, 4, 2, 3, 2, 2], fingers: [1, 3, 1, 2, 1, 1], baseFret: 2, barres: [2] },
  'G7': { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], baseFret: 1 },
  'G#7': { frets: [4, 6, 4, 5, 4, 4], fingers: [1, 3, 1, 2, 1, 1], baseFret: 4, barres: [4] },
  'Ab7': { frets: [4, 6, 4, 5, 4, 4], fingers: [1, 3, 1, 2, 1, 1], baseFret: 4, barres: [4] },
  'A7': { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0], baseFret: 1 },
  'A#7': { frets: [-1, 1, 3, 1, 3, 1], fingers: [0, 1, 3, 1, 4, 1], baseFret: 1, barres: [1] },
  'Bb7': { frets: [-1, 1, 3, 1, 3, 1], fingers: [0, 1, 3, 1, 4, 1], baseFret: 1, barres: [1] },
  'B7': { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], baseFret: 1 },

  // Maj7
  'Cmaj7': { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0], baseFret: 1 },
  'Dmaj7': { frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1], baseFret: 1, barres: [2] },
  'Emaj7': { frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0], baseFret: 1 },
  'Fmaj7': { frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0], baseFret: 1 },
  'Gmaj7': { frets: [3, 2, 0, 0, 0, 2], fingers: [2, 1, 0, 0, 0, 3], baseFret: 1 },
  'Amaj7': { frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0], baseFret: 1 },
  'Bbmaj7': { frets: [-1, 1, 3, 2, 3, 1], fingers: [0, 1, 3, 2, 4, 1], baseFret: 1, barres: [1] },
  'Bmaj7': { frets: [-1, 2, 4, 3, 4, 2], fingers: [0, 1, 3, 2, 4, 1], baseFret: 2, barres: [2] },

  // m7
  'Am7': { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0], baseFret: 1 },
  'Bm7': { frets: [-1, 2, 4, 2, 3, 2], fingers: [0, 1, 3, 1, 2, 1], baseFret: 2, barres: [2] },
  'Cm7': { frets: [-1, 3, 5, 3, 4, 3], fingers: [0, 1, 3, 1, 2, 1], baseFret: 3, barres: [3] },
  'Dm7': { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1], baseFret: 1, barres: [1] },
  'Em7': { frets: [0, 2, 0, 0, 3, 3], fingers: [0, 1, 0, 0, 3, 4], baseFret: 1 },
  'F#m7': { frets: [2, 4, 2, 2, 2, 2], fingers: [1, 3, 1, 1, 1, 1], baseFret: 2, barres: [2] },
  'Gm7': { frets: [3, 5, 3, 3, 3, 3], fingers: [1, 3, 1, 1, 1, 1], baseFret: 3, barres: [3] },

  // Suspendidos y Add
  'Csus4': { frets: [-1, 3, 3, 0, 1, 1], fingers: [0, 3, 4, 0, 1, 1], baseFret: 1 },
  'Dsus4': { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 4], baseFret: 1 },
  'Esus4': { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 1, 2, 3, 0, 0], baseFret: 1 },
  'Gsus4': { frets: [3, 3, 0, 0, 1, 3], fingers: [2, 3, 0, 0, 1, 4], baseFret: 1 },
  'Asus4': { frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 4, 0], baseFret: 1 },
  'Csus2': { frets: [-1, 3, 0, 0, 1, -1], fingers: [0, 3, 0, 0, 1, 0], baseFret: 1 },
  'Dsus2': { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0], baseFret: 1 },
  'Asus2': { frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0], baseFret: 1 },
  'A7sus4': { frets: [-1, 0, 2, 0, 3, 0], fingers: [0, 0, 1, 0, 2, 0], baseFret: 1 },
  'D7sus4': { frets: [-1, -1, 0, 2, 1, 3], fingers: [0, 0, 0, 2, 1, 4], baseFret: 1 },
  'Cadd9': { frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0], baseFret: 1 },

  // Power Chords (5)
  'C5': { frets: [-1, 3, 5, 5, -1, -1], fingers: [0, 1, 3, 4, 0, 0], baseFret: 3 },
  'D5': { frets: [-1, -1, 0, 2, 3, -1], fingers: [0, 0, 0, 1, 2, 0], baseFret: 1 },
  'E5': { frets: [0, 2, 2, -1, -1, -1], fingers: [0, 1, 2, 0, 0, 0], baseFret: 1 },
  'F5': { frets: [1, 3, 3, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0], baseFret: 1 },
  'G5': { frets: [3, 5, 5, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0], baseFret: 3 },
  'A5': { frets: [-1, 0, 2, 2, -1, -1], fingers: [0, 0, 1, 2, 0, 0], baseFret: 1 },
  'B5': { frets: [-1, 2, 4, 4, -1, -1], fingers: [0, 1, 3, 4, 0, 0], baseFret: 2 },
  'Bb5': { frets: [-1, 1, 3, 3, -1, -1], fingers: [0, 1, 3, 4, 0, 0], baseFret: 1 },
  'Ab5': { frets: [4, 6, 6, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0], baseFret: 4 },
  'Db5': { frets: [-1, 4, 6, 6, -1, -1], fingers: [0, 1, 3, 4, 0, 0], baseFret: 4 },

  // Especiales
  'Bm7b5': { frets: [-1, 2, 3, 2, 3, -1], fingers: [0, 1, 3, 2, 4, 0], baseFret: 1 },
  'Cdim': { frets: [-1, 3, 4, 5, 4, -1], fingers: [0, 1, 2, 4, 3, 0], baseFret: 1 },
  'E7#9': { frets: [0, 2, 0, 1, 3, 3], fingers: [0, 2, 0, 1, 3, 4], baseFret: 1 },
  'C9': { frets: [-1, 3, 2, 3, 3, -1], fingers: [0, 2, 1, 3, 4, 0], baseFret: 1 },
  'Bb6': { frets: [-1, 1, 3, 3, 3, 3], fingers: [0, 1, 2, 3, 4, 4], baseFret: 1, barres: [1] },
  'C#dim': { frets: [-1, 4, 5, 3, 5, 3], fingers: [0, 2, 4, 1, 3, 1], baseFret: 3 },
  'D#dim': { frets: [-1, -1, 1, 2, 1, 2], fingers: [0, 0, 1, 3, 2, 4], baseFret: 1 },
  'F#dim': { frets: [2, -1, 1, 2, 1, -1], fingers: [3, 0, 1, 4, 2, 0], baseFret: 1 },
  'G+': { frets: [3, 2, 1, 0, 0, 3], fingers: [3, 2, 1, 0, 0, 4], baseFret: 1 },
  'Gaug': { frets: [3, 2, 1, 0, 0, 3], fingers: [3, 2, 1, 0, 0, 4], baseFret: 1 },
  'Cadd9': { frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0], baseFret: 1 },
  'D/F#': { frets: [2, 0, 0, 2, 3, 2], fingers: [1, 0, 0, 2, 4, 3], baseFret: 1 },
  'C/G': { frets: [3, 3, 2, 0, 1, 0], fingers: [3, 4, 2, 0, 1, 0], baseFret: 1 },
  'G/B': { frets: [-1, 2, 0, 0, 3, 3], fingers: [0, 1, 0, 0, 3, 4], baseFret: 1 },
  'Am/G': { frets: [3, 0, 2, 2, 1, 0], fingers: [4, 0, 2, 3, 1, 0], baseFret: 1 },
  'F7/C': { frets: [-1, 3, 1, 2, 1, 1], fingers: [0, 3, 1, 2, 1, 1], baseFret: 1, barres: [1] },
  'Eb/G': { frets: [3, 1, 1, 3, 4, 3], fingers: [2, 1, 1, 3, 4, 3], baseFret: 1 },
  'D/A': { frets: [-1, 0, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], baseFret: 1 },
  'Bb/D': { frets: [-1, -1, 0, 3, 3, 1], fingers: [0, 0, 0, 2, 3, 1], baseFret: 1 }
});

// Base de datos de digitaciones estándar y verificadas de UKELELE (G C E A)
export const UKULELE_CHORDS = Object.freeze({
  // Mayores
  'C': { frets: [0, 0, 0, 3], fingers: [0, 0, 0, 3], baseFret: 1 },
  'C#': { frets: [1, 1, 1, 4], fingers: [1, 1, 1, 4], baseFret: 1, barres: [1] },
  'Db': { frets: [1, 1, 1, 4], fingers: [1, 1, 1, 4], baseFret: 1, barres: [1] },
  'D': { frets: [2, 2, 2, 0], fingers: [1, 2, 3, 0], baseFret: 1 },
  'D#': { frets: [3, 3, 3, 1], fingers: [2, 3, 4, 1], baseFret: 1, barres: [1] },
  'Eb': { frets: [3, 3, 3, 1], fingers: [2, 3, 4, 1], baseFret: 1, barres: [1] },
  // Voicing estándar por excelencia: 4-4-4-2 (B E G# B)
  'E': { frets: [4, 4, 4, 2], fingers: [2, 3, 4, 1], baseFret: 1, barres: [2] },
  'F': { frets: [2, 0, 1, 0], fingers: [2, 0, 1, 0], baseFret: 1 },
  'F#': { frets: [3, 1, 2, 1], fingers: [3, 1, 2, 1], baseFret: 1, barres: [1] },
  'Gb': { frets: [3, 1, 2, 1], fingers: [3, 1, 2, 1], baseFret: 1, barres: [1] },
  'G': { frets: [0, 2, 3, 2], fingers: [0, 1, 3, 2], baseFret: 1 },
  'G#': { frets: [5, 3, 4, 3], fingers: [3, 1, 2, 1], baseFret: 3, barres: [3] },
  'Ab': { frets: [5, 3, 4, 3], fingers: [3, 1, 2, 1], baseFret: 3, barres: [3] },
  'A': { frets: [2, 1, 0, 0], fingers: [2, 1, 0, 0], baseFret: 1 },
  'A#': { frets: [3, 2, 1, 1], fingers: [3, 2, 1, 1], baseFret: 1, barres: [1] },
  'Bb': { frets: [3, 2, 1, 1], fingers: [3, 2, 1, 1], baseFret: 1, barres: [1] },
  'B': { frets: [4, 3, 2, 2], fingers: [3, 2, 1, 1], baseFret: 1, barres: [2] },

  // Menores
  'Cm': { frets: [0, 3, 3, 3], fingers: [0, 1, 2, 3], baseFret: 1, barres: [3] },
  'C#m': { frets: [1, 1, 0, 4], fingers: [1, 1, 0, 4], baseFret: 1 },
  'Dbm': { frets: [1, 1, 0, 4], fingers: [1, 1, 0, 4], baseFret: 1 },
  'Dm': { frets: [2, 2, 1, 0], fingers: [2, 3, 1, 0], baseFret: 1 },
  'D#m': { frets: [3, 3, 2, 1], fingers: [3, 4, 2, 1], baseFret: 1 },
  'Ebm': { frets: [3, 3, 2, 1], fingers: [3, 4, 2, 1], baseFret: 1 },
  'Em': { frets: [0, 4, 3, 2], fingers: [0, 3, 2, 1], baseFret: 1 },
  'Fm': { frets: [1, 0, 1, 3], fingers: [1, 0, 2, 4], baseFret: 1 },
  'F#m': { frets: [2, 1, 2, 0], fingers: [2, 1, 3, 0], baseFret: 1 },
  'Gbm': { frets: [2, 1, 2, 0], fingers: [2, 1, 3, 0], baseFret: 1 },
  'Gm': { frets: [0, 2, 3, 1], fingers: [0, 2, 3, 1], baseFret: 1 },
  'G#m': { frets: [4, 3, 4, 2], fingers: [3, 2, 4, 1], baseFret: 1 },
  'Abm': { frets: [4, 3, 4, 2], fingers: [3, 2, 4, 1], baseFret: 1 },
  'Am': { frets: [2, 0, 0, 0], fingers: [2, 0, 0, 0], baseFret: 1 },
  'A#m': { frets: [3, 1, 1, 1], fingers: [3, 1, 1, 1], baseFret: 1, barres: [1] },
  'Bbm': { frets: [3, 1, 1, 1], fingers: [3, 1, 1, 1], baseFret: 1, barres: [1] },
  'Bm': { frets: [4, 2, 2, 2], fingers: [3, 1, 1, 1], baseFret: 1, barres: [2] },

  // Séptimas Dominantes (7)
  'C7': { frets: [0, 0, 0, 1], fingers: [0, 0, 0, 1], baseFret: 1 },
  'C#7': { frets: [1, 1, 1, 2], fingers: [1, 1, 1, 2], baseFret: 1, barres: [1] },
  'Db7': { frets: [1, 1, 1, 2], fingers: [1, 1, 1, 2], baseFret: 1, barres: [1] },
  'D7': { frets: [2, 0, 2, 0], fingers: [1, 0, 2, 0], baseFret: 1 },
  'D#7': { frets: [3, 3, 3, 4], fingers: [1, 1, 1, 2], baseFret: 3, barres: [3] },
  'Eb7': { frets: [3, 3, 3, 4], fingers: [1, 1, 1, 2], baseFret: 3, barres: [3] },
  'E7': { frets: [1, 2, 0, 2], fingers: [1, 2, 0, 3], baseFret: 1 },
  'F7': { frets: [2, 3, 1, 0], fingers: [2, 3, 1, 0], baseFret: 1 },
  'F#7': { frets: [3, 4, 2, 1], fingers: [3, 4, 2, 1], baseFret: 1 },
  'Gb7': { frets: [3, 4, 2, 1], fingers: [3, 4, 2, 1], baseFret: 1 },
  'G7': { frets: [0, 2, 1, 2], fingers: [0, 2, 1, 3], baseFret: 1 },
  'G#7': { frets: [1, 3, 2, 3], fingers: [1, 3, 2, 4], baseFret: 1 },
  'Ab7': { frets: [1, 3, 2, 3], fingers: [1, 3, 2, 4], baseFret: 1 },
  'A7': { frets: [0, 1, 0, 0], fingers: [0, 1, 0, 0], baseFret: 1 },
  'A#7': { frets: [1, 2, 1, 1], fingers: [1, 2, 1, 1], baseFret: 1, barres: [1] },
  'Bb7': { frets: [1, 2, 1, 1], fingers: [1, 2, 1, 1], baseFret: 1, barres: [1] },
  'B7': { frets: [2, 3, 2, 2], fingers: [1, 2, 1, 1], baseFret: 1, barres: [2] },

  // Maj7
  'Cmaj7': { frets: [0, 0, 0, 2], fingers: [0, 0, 0, 1], baseFret: 1 },
  'Dmaj7': { frets: [2, 2, 2, 4], fingers: [1, 1, 1, 3], baseFret: 1, barres: [2] },
  'Ebmaj7': { frets: [3, 3, 3, 5], fingers: [1, 1, 1, 3], baseFret: 1, barres: [3] },
  'Emaj7': { frets: [1, 3, 0, 2], fingers: [1, 3, 0, 2], baseFret: 1 },
  'Fmaj7': { frets: [2, 4, 1, 0], fingers: [2, 4, 1, 0], baseFret: 1 },
  'Gmaj7': { frets: [0, 2, 2, 2], fingers: [0, 1, 2, 3], baseFret: 1 },
  'Amaj7': { frets: [1, 1, 0, 0], fingers: [1, 2, 0, 0], baseFret: 1 },
  'Bbmaj7': { frets: [3, 2, 1, 0], fingers: [3, 2, 1, 0], baseFret: 1 },
  'Bmaj7': { frets: [3, 3, 2, 2], fingers: [2, 3, 1, 1], baseFret: 1, barres: [2] },

  // m7
  'Am7': { frets: [0, 0, 0, 0], fingers: [0, 0, 0, 0], baseFret: 1 },
  'Bm7': { frets: [2, 2, 2, 2], fingers: [1, 1, 1, 1], baseFret: 1, barres: [2] },
  'Cm7': { frets: [3, 3, 3, 3], fingers: [1, 1, 1, 1], baseFret: 1, barres: [3] },
  'Dm7': { frets: [2, 2, 1, 3], fingers: [2, 3, 1, 4], baseFret: 1 },
  'Em7': { frets: [0, 2, 0, 2], fingers: [0, 1, 0, 2], baseFret: 1 },
  'Fm7': { frets: [1, 3, 1, 3], fingers: [1, 3, 2, 4], baseFret: 1 },
  'Gm7': { frets: [0, 2, 1, 1], fingers: [0, 2, 1, 1], baseFret: 1, barres: [1] },
  'Bbm7': { frets: [1, 1, 1, 1], fingers: [1, 1, 1, 1], baseFret: 1, barres: [1] },

  // Suspendidos y Add
  'Csus4': { frets: [0, 0, 1, 3], fingers: [0, 0, 1, 3], baseFret: 1 },
  'Dsus4': { frets: [2, 2, 3, 0], fingers: [1, 2, 3, 0], baseFret: 1 },
  'Esus4': { frets: [4, 4, 0, 0], fingers: [1, 2, 0, 0], baseFret: 1 },
  'Gsus4': { frets: [0, 2, 3, 3], fingers: [0, 1, 2, 3], baseFret: 1 },
  'Asus4': { frets: [2, 2, 0, 0], fingers: [1, 2, 0, 0], baseFret: 1 },
  'Csus2': { frets: [0, 2, 3, 3], fingers: [0, 1, 2, 3], baseFret: 1 },
  'Dsus2': { frets: [2, 2, 2, 5], fingers: [1, 1, 1, 4], baseFret: 1 },
  'Gsus2': { frets: [0, 2, 3, 0], fingers: [0, 1, 2, 0], baseFret: 1 },
  'Asus2': { frets: [2, 4, 0, 0], fingers: [1, 3, 0, 0], baseFret: 1 },
  'A7sus4': { frets: [0, 2, 0, 0], fingers: [0, 2, 0, 0], baseFret: 1 },
  'D7sus4': { frets: [0, 2, 1, 3], fingers: [0, 2, 1, 3], baseFret: 1 },
  'Cadd9': { frets: [0, 2, 0, 3], fingers: [0, 1, 0, 2], baseFret: 1 },

  // Power Chords (5)
  'C5': { frets: [0, 0, 3, 3], fingers: [0, 0, 1, 2], baseFret: 1 },
  'D5': { frets: [2, 2, -1, -1], fingers: [1, 2, 0, 0], baseFret: 1 },
  'E5': { frets: [4, 4, -1, -1], fingers: [1, 2, 0, 0], baseFret: 1 },
  'F5': { frets: [5, 5, -1, -1], fingers: [1, 2, 0, 0], baseFret: 5 },
  'G5': { frets: [0, 2, 3, 5], fingers: [0, 1, 2, 4], baseFret: 1 },
  'A5': { frets: [2, 4, -1, -1], fingers: [1, 3, 0, 0], baseFret: 1 },
  'Bb5': { frets: [3, 5, 6, -1], fingers: [1, 3, 4, 0], baseFret: 3 },
  'Ab5': { frets: [1, 3, -1, -1], fingers: [1, 3, 0, 0], baseFret: 1 },
  'Db5': { frets: [1, 1, 4, 4], fingers: [1, 1, 3, 4], baseFret: 1 },

  // Especiales
  'Bm7b5': { frets: [2, 3, 2, 3], fingers: [1, 3, 2, 4], baseFret: 1 },
  'Cdim': { frets: [2, 3, 2, 3], fingers: [1, 3, 2, 4], baseFret: 1 },
  'E7#9': { frets: [1, 2, 0, 2], fingers: [1, 2, 0, 3], baseFret: 1 },
  'C9': { frets: [0, 2, 0, 1], fingers: [0, 2, 0, 1], baseFret: 1 }
});

// Notas reales por acorde de Piano
export const PIANO_VOICINGS = Object.freeze({
  // C
  'C': [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }],
  'Cm': [{ key: 'C', oct: 4 }, { key: 'Eb', oct: 4 }, { key: 'G', oct: 4 }],
  'C7': [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'Bb', oct: 4 }],
  'Cmaj7': [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'B', oct: 4 }],
  'Cadd9': [{ key: 'C', oct: 4 }, { key: 'D', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }],
  'Csus4': [{ key: 'C', oct: 4 }, { key: 'F', oct: 4 }, { key: 'G', oct: 4 }],
  'Csus2': [{ key: 'C', oct: 4 }, { key: 'D', oct: 4 }, { key: 'G', oct: 4 }],
  'Cdim': [{ key: 'C', oct: 4 }, { key: 'Eb', oct: 4 }, { key: 'Gb', oct: 4 }],
  'Caug': [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G#', oct: 4 }],
  'C6': [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'A', oct: 4 }],
  'C5': [{ key: 'C', oct: 4 }, { key: 'G', oct: 4 }],

  // C# / Db
  'C#': [{ key: 'C#', oct: 4 }, { key: 'F', oct: 4 }, { key: 'G#', oct: 4 }],
  'Db': [{ key: 'Db', oct: 4 }, { key: 'F', oct: 4 }, { key: 'Ab', oct: 4 }],
  'C#m': [{ key: 'C#', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G#', oct: 4 }],
  'Dbm': [{ key: 'Db', oct: 4 }, { key: 'E', oct: 4 }, { key: 'Ab', oct: 4 }],
  'C#7': [{ key: 'C#', oct: 4 }, { key: 'F', oct: 4 }, { key: 'G#', oct: 4 }, { key: 'B', oct: 4 }],
  'Db7': [{ key: 'Db', oct: 4 }, { key: 'F', oct: 4 }, { key: 'Ab', oct: 4 }, { key: 'B', oct: 4 }],
  'C#dim': [{ key: 'C#', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }],
  'Db5': [{ key: 'Db', oct: 4 }, { key: 'Ab', oct: 4 }],

  // D
  'D': [{ key: 'D', oct: 4 }, { key: 'F#', oct: 4 }, { key: 'A', oct: 4 }],
  'Dm': [{ key: 'D', oct: 4 }, { key: 'F', oct: 4 }, { key: 'A', oct: 4 }],
  'D7': [{ key: 'D', oct: 4 }, { key: 'F#', oct: 4 }, { key: 'A', oct: 4 }, { key: 'C', oct: 5 }],
  'Dmaj7': [{ key: 'D', oct: 4 }, { key: 'F#', oct: 4 }, { key: 'A', oct: 4 }, { key: 'C#', oct: 5 }],
  'Dm7': [{ key: 'D', oct: 4 }, { key: 'F', oct: 4 }, { key: 'A', oct: 4 }, { key: 'C', oct: 5 }],
  'Dsus4': [{ key: 'D', oct: 4 }, { key: 'G', oct: 4 }, { key: 'A', oct: 4 }],
  'Dsus2': [{ key: 'D', oct: 4 }, { key: 'E', oct: 4 }, { key: 'A', oct: 4 }],
  'Ddim': [{ key: 'D', oct: 4 }, { key: 'F', oct: 4 }, { key: 'Ab', oct: 4 }],

  // D# / Eb
  'D#': [{ key: 'D#', oct: 4 }, { key: 'G', oct: 4 }, { key: 'A#', oct: 4 }],
  'Eb': [{ key: 'Eb', oct: 4 }, { key: 'G', oct: 4 }, { key: 'Bb', oct: 4 }],
  'D#m': [{ key: 'D#', oct: 4 }, { key: 'F#', oct: 4 }, { key: 'A#', oct: 4 }],
  'Ebm': [{ key: 'Eb', oct: 4 }, { key: 'Gb', oct: 4 }, { key: 'Bb', oct: 4 }],
  'Eb7': [{ key: 'Eb', oct: 4 }, { key: 'G', oct: 4 }, { key: 'Bb', oct: 4 }, { key: 'Db', oct: 5 }],
  'D#dim': [{ key: 'D#', oct: 4 }, { key: 'F#', oct: 4 }, { key: 'A', oct: 4 }],
  'Ebmaj7': [{ key: 'Eb', oct: 4 }, { key: 'G', oct: 4 }, { key: 'Bb', oct: 4 }, { key: 'D', oct: 5 }],

  // E
  'E': [{ key: 'E', oct: 4 }, { key: 'G#', oct: 4 }, { key: 'B', oct: 4 }],
  'Em': [{ key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'B', oct: 4 }],
  'Em7': [{ key: 'E', oct: 4 }, { key: 'G', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }],
  'E7': [{ key: 'E', oct: 4 }, { key: 'G#', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }],
  'Emaj7': [{ key: 'E', oct: 4 }, { key: 'G#', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D#', oct: 5 }],
  'Esus4': [{ key: 'E', oct: 4 }, { key: 'A', oct: 4 }, { key: 'B', oct: 4 }],
  'E7#9': [{ key: 'E', oct: 4 }, { key: 'G#', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }, { key: 'G', oct: 5 }],

  // F
  'F': [{ key: 'F', oct: 4 }, { key: 'A', oct: 4 }, { key: 'C', oct: 5 }],
  'Fm': [{ key: 'F', oct: 4 }, { key: 'Ab', oct: 4 }, { key: 'C', oct: 5 }],
  'F7': [{ key: 'F', oct: 4 }, { key: 'A', oct: 4 }, { key: 'C', oct: 5 }, { key: 'Eb', oct: 5 }],
  'Fmaj7': [{ key: 'F', oct: 4 }, { key: 'A', oct: 4 }, { key: 'C', oct: 5 }, { key: 'E', oct: 5 }],
  'Fm7': [{ key: 'F', oct: 4 }, { key: 'Ab', oct: 4 }, { key: 'C', oct: 5 }, { key: 'Eb', oct: 5 }],
  'F5': [{ key: 'F', oct: 4 }, { key: 'C', oct: 5 }],

  // F# / Gb
  'F#': [{ key: 'F#', oct: 4 }, { key: 'A#', oct: 4 }, { key: 'C#', oct: 5 }],
  'Gb': [{ key: 'Gb', oct: 4 }, { key: 'Bb', oct: 4 }, { key: 'Db', oct: 5 }],
  'F#m': [{ key: 'F#', oct: 4 }, { key: 'A', oct: 4 }, { key: 'C#', oct: 5 }],
  'Gbm': [{ key: 'Gb', oct: 4 }, { key: 'A', oct: 4 }, { key: 'Db', oct: 5 }],
  'F#7': [{ key: 'F#', oct: 4 }, { key: 'A#', oct: 4 }, { key: 'C#', oct: 5 }, { key: 'E', oct: 5 }],
  'F#dim': [{ key: 'F#', oct: 4 }, { key: 'A', oct: 4 }, { key: 'C', oct: 5 }],

  // G
  'G': [{ key: 'G', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }],
  'Gm': [{ key: 'G', oct: 4 }, { key: 'Bb', oct: 4 }, { key: 'D', oct: 5 }],
  'G7': [{ key: 'G', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F', oct: 5 }],
  'Gmaj7': [{ key: 'G', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F#', oct: 5 }],
  'Gm7': [{ key: 'G', oct: 4 }, { key: 'Bb', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F', oct: 5 }],
  'Gsus4': [{ key: 'G', oct: 4 }, { key: 'C', oct: 5 }, { key: 'D', oct: 5 }],
  'G+': [{ key: 'G', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D#', oct: 5 }],
  'Gaug': [{ key: 'G', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D#', oct: 5 }],
  'G5': [{ key: 'G', oct: 4 }, { key: 'D', oct: 5 }],

  // G# / Ab
  'G#': [{ key: 'G#', oct: 4 }, { key: 'C', oct: 5 }, { key: 'D#', oct: 5 }],
  'Ab': [{ key: 'Ab', oct: 4 }, { key: 'C', oct: 5 }, { key: 'Eb', oct: 5 }],
  'G#m': [{ key: 'G#', oct: 4 }, { key: 'B', oct: 4 }, { key: 'D#', oct: 5 }],
  'Abm': [{ key: 'Ab', oct: 4 }, { key: 'B', oct: 4 }, { key: 'Eb', oct: 5 }],
  'Ab7': [{ key: 'Ab', oct: 4 }, { key: 'C', oct: 5 }, { key: 'Eb', oct: 5 }, { key: 'Gb', oct: 5 }],
  'Ab5': [{ key: 'Ab', oct: 4 }, { key: 'Eb', oct: 5 }],

  // A
  'A': [{ key: 'A', oct: 4 }, { key: 'C#', oct: 5 }, { key: 'E', oct: 5 }],
  'Am': [{ key: 'A', oct: 4 }, { key: 'C', oct: 5 }, { key: 'E', oct: 5 }],
  'Am7': [{ key: 'A', oct: 4 }, { key: 'C', oct: 5 }, { key: 'E', oct: 5 }, { key: 'G', oct: 5 }],
  'A7': [{ key: 'A', oct: 4 }, { key: 'C#', oct: 5 }, { key: 'E', oct: 5 }, { key: 'G', oct: 5 }],
  'Amaj7': [{ key: 'A', oct: 4 }, { key: 'C#', oct: 5 }, { key: 'E', oct: 5 }, { key: 'G#', oct: 5 }],
  'A7sus4': [{ key: 'A', oct: 4 }, { key: 'D', oct: 5 }, { key: 'E', oct: 5 }, { key: 'G', oct: 5 }],
  'Asus4': [{ key: 'A', oct: 4 }, { key: 'D', oct: 5 }, { key: 'E', oct: 5 }],
  'Asus2': [{ key: 'A', oct: 4 }, { key: 'B', oct: 4 }, { key: 'E', oct: 5 }],

  // A# / Bb
  'A#': [{ key: 'A#', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F', oct: 5 }],
  'Bb': [{ key: 'Bb', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F', oct: 5 }],
  'A#m': [{ key: 'A#', oct: 4 }, { key: 'C#', oct: 5 }, { key: 'F', oct: 5 }],
  'Bbm': [{ key: 'Bb', oct: 4 }, { key: 'Db', oct: 5 }, { key: 'F', oct: 5 }],
  'A#7': [{ key: 'A#', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F', oct: 5 }, { key: 'G#', oct: 5 }],
  'Bb7': [{ key: 'Bb', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F', oct: 5 }, { key: 'Ab', oct: 5 }],
  'A#m7': [{ key: 'A#', oct: 4 }, { key: 'C#', oct: 5 }, { key: 'F', oct: 5 }, { key: 'G#', oct: 5 }],
  'Bbm7': [{ key: 'Bb', oct: 4 }, { key: 'Db', oct: 5 }, { key: 'F', oct: 5 }, { key: 'Ab', oct: 5 }],
  'A#maj7': [{ key: 'A#', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F', oct: 5 }, { key: 'A', oct: 5 }],
  'Bbmaj7': [{ key: 'Bb', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F', oct: 5 }, { key: 'A', oct: 5 }],
  'A#6': [{ key: 'A#', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F', oct: 5 }, { key: 'G', oct: 5 }],
  'Bb6': [{ key: 'Bb', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F', oct: 5 }, { key: 'G', oct: 5 }],
  'A#5': [{ key: 'A#', oct: 4 }, { key: 'F', oct: 5 }],
  'Bb5': [{ key: 'Bb', oct: 4 }, { key: 'F', oct: 5 }],

  // B
  'B': [{ key: 'B', oct: 4 }, { key: 'D#', oct: 5 }, { key: 'F#', oct: 5 }],
  'Bm': [{ key: 'B', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F#', oct: 5 }],
  'Bm7': [{ key: 'B', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F#', oct: 5 }, { key: 'A', oct: 5 }],
  'Bm7b5': [{ key: 'B', oct: 4 }, { key: 'D', oct: 5 }, { key: 'F', oct: 5 }, { key: 'A', oct: 5 }],
  'B7': [{ key: 'B', oct: 4 }, { key: 'D#', oct: 5 }, { key: 'F#', oct: 5 }, { key: 'A', oct: 5 }],
  'Bmaj7': [{ key: 'B', oct: 4 }, { key: 'D#', oct: 5 }, { key: 'F#', oct: 5 }, { key: 'A#', oct: 5 }],
  'Bsus4': [{ key: 'B', oct: 4 }, { key: 'E', oct: 5 }, { key: 'F#', oct: 5 }]
});

// Voicings / Posiciones alternativas verificadas para GUITARRA
export const ALTERNATE_GUITAR_VOICINGS = Object.freeze({
  'A': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 2 · Resonancia clásica', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], baseFret: 1 },
    { name: 'Con Cejilla (Traste 5)', detail: 'Traste 5 · Forma de E con cejilla', frets: [5, 7, 7, 6, 5, 5], fingers: [1, 3, 4, 2, 1, 1], baseFret: 5, barres: [5] },
    { name: 'Tríada Aguda (Traste 9)', detail: 'Trastes 7 - 9 · Registro solista', frets: [-1, -1, 7, 6, 5, 5], fingers: [0, 0, 3, 2, 1, 1], baseFret: 5, barres: [5] }
  ],
  'Am': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 2 · Tonalidad menor clásica', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], baseFret: 1 },
    { name: 'Con Cejilla (Traste 5)', detail: 'Traste 5 · Forma de Em con cejilla', frets: [5, 7, 7, 5, 5, 5], fingers: [1, 3, 4, 1, 1, 1], baseFret: 5, barres: [5] },
    { name: 'Registro Melódico (Traste 8)', detail: 'Trastes 7 - 10 · Para arpegios', frets: [-1, -1, 7, 9, 10, 8], fingers: [0, 0, 1, 2, 4, 3], baseFret: 7 }
  ],
  'A7': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 2 · Dominante clásica', frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0], baseFret: 1 },
    { name: 'Con Cejilla (Traste 5)', detail: 'Traste 5 · Forma de E7 con cejilla', frets: [5, 7, 5, 6, 5, 5], fingers: [1, 3, 1, 2, 1, 1], baseFret: 5, barres: [5] },
    { name: 'Registro Agudo (Traste 12)', detail: 'Traste 12 · Forma de A7 en octava', frets: [-1, 12, 14, 12, 14, 12], fingers: [0, 1, 3, 1, 4, 1], baseFret: 12, barres: [12] }
  ],
  'B': [
    { name: 'Con Cejilla (Traste 2)', detail: 'Traste 2 · Forma de A transportada', frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], baseFret: 1, barres: [2] },
    { name: 'Con Cejilla (Traste 7)', detail: 'Traste 7 · Forma de E transportada', frets: [7, 9, 9, 8, 7, 7], fingers: [1, 3, 4, 2, 1, 1], baseFret: 7, barres: [7] },
    { name: 'Tríada Alta (Traste 9)', detail: 'Trastes 9 - 11 · Primeras cuerdas', frets: [-1, -1, 9, 8, 7, 7], fingers: [0, 0, 3, 2, 1, 1], baseFret: 7, barres: [7] }
  ],
  'Bm': [
    { name: 'Con Cejilla (Traste 2)', detail: 'Traste 2 · Forma de Am clásica', frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], baseFret: 2, barres: [2] },
    { name: 'Con Cejilla (Traste 7)', detail: 'Traste 7 · Forma de Em transportada', frets: [7, 9, 9, 7, 7, 7], fingers: [1, 3, 4, 1, 1, 1], baseFret: 7, barres: [7] },
    { name: 'Registro Agudo (Traste 9)', detail: 'Trastes 9 - 12 · Arpegios agudos', frets: [-1, -1, 9, 11, 12, 10], fingers: [0, 0, 1, 3, 4, 2], baseFret: 9 }
  ],
  'B7': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 2 · Posición abierta tradicional', frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], baseFret: 1 },
    { name: 'Con Cejilla (Traste 2)', detail: 'Traste 2 · Forma transportable A7', frets: [-1, 2, 4, 2, 4, 2], fingers: [0, 1, 3, 1, 4, 1], baseFret: 2, barres: [2] },
    { name: 'Con Cejilla (Traste 7)', detail: 'Traste 7 · Forma transportable E7', frets: [7, 9, 7, 8, 7, 7], fingers: [1, 3, 1, 2, 1, 1], baseFret: 7, barres: [7] }
  ],
  'C': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 3 · Sonido cálido estándar', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], baseFret: 1 },
    { name: 'Con Cejilla (Traste 3)', detail: 'Traste 3 · Forma de A con cejilla', frets: [-1, 3, 5, 5, 5, 3], fingers: [0, 1, 2, 3, 4, 1], baseFret: 3, barres: [3] },
    { name: 'Cejilla Alta (Traste 8)', detail: 'Traste 8 · Forma de E en agudo', frets: [8, 10, 10, 9, 8, 8], fingers: [1, 3, 4, 2, 1, 1], baseFret: 8, barres: [8] }
  ],
  'Cm': [
    { name: 'Con Cejilla (Traste 3)', detail: 'Traste 3 · Forma de Am clásica', frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], baseFret: 3, barres: [3] },
    { name: 'Con Cejilla (Traste 8)', detail: 'Traste 8 · Forma de Em transportada', frets: [8, 10, 10, 8, 8, 8], fingers: [1, 3, 4, 1, 1, 1], baseFret: 8, barres: [8] },
    { name: 'Registro Agudo (Traste 10)', detail: 'Trastes 10 - 13 · Para solos y arpegios', frets: [-1, -1, 10, 12, 13, 11], fingers: [0, 0, 1, 3, 4, 2], baseFret: 10 }
  ],
  'C7': [
    { name: 'Posición Abierta', detail: 'Traste 0 - 3 · Con 7ª menor en cuerda 3', frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0], baseFret: 1 },
    { name: 'Con Cejilla (Traste 3)', detail: 'Traste 3 · Forma transportable de A7', frets: [-1, 3, 5, 3, 5, 3], fingers: [0, 1, 3, 1, 4, 1], baseFret: 3, barres: [3] },
    { name: 'Cejilla Alta (Traste 8)', detail: 'Traste 8 · Forma de E7 en agudo', frets: [8, 10, 8, 9, 8, 8], fingers: [1, 3, 1, 2, 1, 1], baseFret: 8, barres: [8] }
  ],
  'D': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 3 · Sonido brillante', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], baseFret: 1 },
    { name: 'Con Cejilla (Traste 5)', detail: 'Traste 5 · Forma de A con cejilla', frets: [-1, 5, 7, 7, 7, 5], fingers: [0, 1, 2, 3, 4, 1], baseFret: 5, barres: [5] },
    { name: 'Cejilla Alta (Traste 10)', detail: 'Traste 10 · Forma de E', frets: [10, 12, 12, 11, 10, 10], fingers: [1, 3, 4, 2, 1, 1], baseFret: 10, barres: [10] }
  ],
  'Dm': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 3 · Sonido melancólico abierto', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], baseFret: 1 },
    { name: 'Con Cejilla (Traste 5)', detail: 'Traste 5 · Forma de Am con cejilla', frets: [-1, 5, 7, 7, 6, 5], fingers: [0, 1, 3, 4, 2, 1], baseFret: 5, barres: [5] },
    { name: 'Cejilla Alta (Traste 10)', detail: 'Traste 10 · Forma de Em transportada', frets: [10, 12, 12, 10, 10, 10], fingers: [1, 3, 4, 1, 1, 1], baseFret: 10, barres: [10] }
  ],
  'D7': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 2 · Forma de triángulo invertido', frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], baseFret: 1 },
    { name: 'Con Cejilla (Traste 5)', detail: 'Traste 5 · Forma de A7 con cejilla', frets: [-1, 5, 7, 5, 7, 5], fingers: [0, 1, 3, 1, 4, 1], baseFret: 5, barres: [5] },
    { name: 'Cejilla Alta (Traste 10)', detail: 'Traste 10 · Forma de E7 con cejilla', frets: [10, 12, 10, 11, 10, 10], fingers: [1, 3, 1, 2, 1, 1], baseFret: 10, barres: [10] }
  ],
  'E': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 2 · Máxima resonancia abierta', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], baseFret: 1 },
    { name: 'Con Cejilla (Traste 7)', detail: 'Traste 7 · Forma de A con cejilla', frets: [-1, 7, 9, 9, 9, 7], fingers: [0, 1, 2, 3, 4, 1], baseFret: 7, barres: [7] },
    { name: 'Tríada Alta (Traste 9)', detail: 'Trastes 9 - 12 · Sonido campana', frets: [-1, -1, 9, 9, 9, 12], fingers: [0, 0, 1, 1, 1, 4], baseFret: 9, barres: [9] }
  ],
  'Em': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 2 · Sonido profundo', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], baseFret: 1 },
    { name: 'Con Cejilla (Traste 7)', detail: 'Traste 7 · Forma de Am con cejilla', frets: [-1, 7, 9, 9, 8, 7], fingers: [0, 1, 3, 4, 2, 1], baseFret: 7, barres: [7] },
    { name: 'Cejilla Alta (Traste 12)', detail: 'Traste 12 · Forma de Em en octava', frets: [12, 14, 14, 12, 12, 12], fingers: [1, 3, 4, 1, 1, 1], baseFret: 12, barres: [12] }
  ],
  'E7': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 2 · Blues tradicional', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], baseFret: 1 },
    { name: 'Con Cejilla (Traste 7)', detail: 'Traste 7 · Forma de A7 con cejilla', frets: [-1, 7, 9, 7, 9, 7], fingers: [0, 1, 3, 1, 4, 1], baseFret: 7, barres: [7] },
    { name: 'Tríada Aguda (Traste 9)', detail: 'Trastes 9 - 10 · Primeras cuerdas', frets: [-1, -1, 9, 9, 9, 10], fingers: [0, 0, 1, 1, 1, 2], baseFret: 9, barres: [9] }
  ],
  'F': [
    { name: 'Con Cejilla (Traste 1)', detail: 'Traste 1 · Cejilla completa en fa mayor', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], baseFret: 1, barres: [1] },
    { name: 'Con Cejilla (Traste 8)', detail: 'Traste 8 · Forma de A con cejilla', frets: [-1, 8, 10, 10, 10, 8], fingers: [0, 1, 2, 3, 4, 1], baseFret: 8, barres: [8] },
    { name: 'Registro Agudo (Traste 10)', detail: 'Trastes 10 - 13 · Registro alto', frets: [-1, -1, 10, 10, 10, 13], fingers: [0, 0, 1, 1, 1, 4], baseFret: 10, barres: [10] }
  ],
  'Fm': [
    { name: 'Con Cejilla (Traste 1)', detail: 'Traste 1 · Cejilla menor completa', frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], baseFret: 1, barres: [1] },
    { name: 'Con Cejilla (Traste 8)', detail: 'Traste 8 · Forma de Am con cejilla', frets: [-1, 8, 10, 10, 9, 8], fingers: [0, 1, 3, 4, 2, 1], baseFret: 8, barres: [8] },
    { name: 'Registro Agudo (Traste 13)', detail: 'Traste 13 · Forma de Em en octava alta', frets: [13, 15, 15, 13, 13, 13], fingers: [1, 3, 4, 1, 1, 1], baseFret: 13, barres: [13] }
  ],
  'F7': [
    { name: 'Con Cejilla (Traste 1)', detail: 'Traste 1 · Cejilla de séptima completa', frets: [1, 3, 1, 2, 1, 1], fingers: [1, 3, 1, 2, 1, 1], baseFret: 1, barres: [1] },
    { name: 'Con Cejilla (Traste 8)', detail: 'Traste 8 · Forma de A7 con cejilla', frets: [-1, 8, 10, 8, 10, 8], fingers: [0, 1, 3, 1, 4, 1], baseFret: 8, barres: [8] },
    { name: 'Registro Agudo (Traste 10)', detail: 'Trastes 10 - 12 · Agudo de blues', frets: [-1, -1, 10, 12, 11, 12], fingers: [0, 0, 1, 3, 2, 4], baseFret: 10 }
  ],
  'F#': [
    { name: 'Con Cejilla (Traste 2)', detail: 'Traste 2 · Forma de E con cejilla', frets: [2, 4, 4, 3, 2, 2], fingers: [1, 3, 4, 2, 1, 1], baseFret: 2, barres: [2] },
    { name: 'Con Cejilla (Traste 9)', detail: 'Traste 9 · Forma de A con cejilla', frets: [-1, 9, 11, 11, 11, 9], fingers: [0, 1, 2, 3, 4, 1], baseFret: 9, barres: [9] },
    { name: 'Registro Agudo (Traste 11)', detail: 'Trastes 11 - 14 · Sonido solista', frets: [-1, -1, 11, 11, 11, 14], fingers: [0, 0, 1, 1, 1, 4], baseFret: 11, barres: [11] }
  ],
  'F#m': [
    { name: 'Con Cejilla (Traste 2)', detail: 'Traste 2 · Forma de Em con cejilla', frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], baseFret: 2, barres: [2] },
    { name: 'Con Cejilla (Traste 9)', detail: 'Traste 9 · Forma de Am con cejilla', frets: [-1, 9, 11, 11, 10, 9], fingers: [0, 1, 3, 4, 2, 1], baseFret: 9, barres: [9] },
    { name: 'Registro Agudo (Traste 4)', detail: 'Trastes 4 - 7 · Primeras cuerdas', frets: [-1, -1, 4, 6, 7, 5], fingers: [0, 0, 1, 3, 4, 2], baseFret: 4 }
  ],
  'G': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 3 · Resonancia acústica', frets: [3, 2, 0, 0, 3, 3], fingers: [2, 1, 0, 0, 3, 4], baseFret: 1 },
    { name: 'Con Cejilla (Traste 3)', detail: 'Traste 3 · Forma de E con cejilla', frets: [3, 5, 5, 4, 3, 3], fingers: [1, 3, 4, 2, 1, 1], baseFret: 3, barres: [3] },
    { name: 'Con Cejilla (Traste 10)', detail: 'Traste 10 · Forma de A con cejilla', frets: [-1, 10, 12, 12, 12, 10], fingers: [0, 1, 2, 3, 4, 1], baseFret: 10, barres: [10] }
  ],
  'Gm': [
    { name: 'Con Cejilla (Traste 3)', detail: 'Traste 3 · Forma de Em con cejilla', frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], baseFret: 3, barres: [3] },
    { name: 'Con Cejilla (Traste 10)', detail: 'Traste 10 · Forma de Am con cejilla', frets: [-1, 10, 12, 12, 11, 10], fingers: [0, 1, 3, 4, 2, 1], baseFret: 10, barres: [10] },
    { name: 'Registro Agudo (Traste 5)', detail: 'Trastes 5 - 8 · Primeras cuerdas', frets: [-1, -1, 5, 7, 8, 6], fingers: [0, 0, 1, 3, 4, 2], baseFret: 5 }
  ],
  'G7': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 3 · Folk y blues estándar', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], baseFret: 1 },
    { name: 'Con Cejilla (Traste 3)', detail: 'Traste 3 · Forma de E7 con cejilla', frets: [3, 5, 3, 4, 3, 3], fingers: [1, 3, 1, 2, 1, 1], baseFret: 3, barres: [3] },
    { name: 'Con Cejilla (Traste 10)', detail: 'Traste 10 · Forma de A7 con cejilla', frets: [-1, 10, 12, 10, 12, 10], fingers: [0, 1, 3, 1, 4, 1], baseFret: 10, barres: [10] }
  ],
  'A#': [
    { name: 'Con Cejilla (Traste 1)', detail: 'Traste 1 · Forma de A transportada', frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], baseFret: 1, barres: [1] },
    { name: 'Con Cejilla (Traste 6)', detail: 'Traste 6 · Forma de E con cejilla', frets: [6, 8, 8, 7, 6, 6], fingers: [1, 3, 4, 2, 1, 1], baseFret: 6, barres: [6] },
    { name: 'Registro Agudo (Traste 8)', detail: 'Trastes 8 - 11 · Solos y arpegios', frets: [-1, -1, 8, 10, 11, 10], fingers: [0, 0, 1, 3, 4, 2], baseFret: 8 }
  ],
  'Bb': [
    { name: 'Con Cejilla (Traste 1)', detail: 'Traste 1 · Forma de A transportada', frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], baseFret: 1, barres: [1] },
    { name: 'Con Cejilla (Traste 6)', detail: 'Traste 6 · Forma de E con cejilla', frets: [6, 8, 8, 7, 6, 6], fingers: [1, 3, 4, 2, 1, 1], baseFret: 6, barres: [6] },
    { name: 'Registro Agudo (Traste 8)', detail: 'Trastes 8 - 11 · Solos y arpegios', frets: [-1, -1, 8, 10, 11, 10], fingers: [0, 0, 1, 3, 4, 2], baseFret: 8 }
  ],
  'A#7': [
    { name: 'Con Cejilla (Traste 1)', detail: 'Traste 1 · Forma de A7 con cejilla', frets: [-1, 1, 3, 1, 3, 1], fingers: [0, 1, 3, 1, 4, 1], baseFret: 1, barres: [1] },
    { name: 'Con Cejilla (Traste 6)', detail: 'Traste 6 · Forma de E7 con cejilla', frets: [6, 8, 6, 7, 6, 6], fingers: [1, 3, 1, 2, 1, 1], baseFret: 6, barres: [6] },
    { name: 'Registro Agudo (Traste 8)', detail: 'Trastes 8 - 10 · Tríada de séptima', frets: [-1, -1, 8, 10, 9, 10], fingers: [0, 0, 1, 3, 2, 4], baseFret: 8 }
  ],
  'Bb7': [
    { name: 'Con Cejilla (Traste 1)', detail: 'Traste 1 · Forma de A7 con cejilla', frets: [-1, 1, 3, 1, 3, 1], fingers: [0, 1, 3, 1, 4, 1], baseFret: 1, barres: [1] },
    { name: 'Con Cejilla (Traste 6)', detail: 'Traste 6 · Forma de E7 con cejilla', frets: [6, 8, 6, 7, 6, 6], fingers: [1, 3, 1, 2, 1, 1], baseFret: 6, barres: [6] },
    { name: 'Registro Agudo (Traste 8)', detail: 'Trastes 8 - 10 · Tríada de séptima', frets: [-1, -1, 8, 10, 9, 10], fingers: [0, 0, 1, 3, 2, 4], baseFret: 8 }
  ]
});

// Voicings / Posiciones alternativas verificadas para UKELELE
export const ALTERNATE_UKULELE_VOICINGS = Object.freeze({
  'A': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 2 · Posición tradicional', frets: [2, 1, 0, 0], fingers: [2, 1, 0, 0], baseFret: 1 },
    { name: 'Con Cejilla (Traste 4)', detail: 'Trastes 4 - 6 · Sonido dulce y cerrado', frets: [6, 4, 5, 4], fingers: [3, 1, 2, 1], baseFret: 4, barres: [4] },
    { name: 'Registro Agudo (Traste 9)', detail: 'Trastes 7 - 9 · Registro brillante', frets: [9, 9, 9, 7], fingers: [3, 3, 3, 1], baseFret: 7, barres: [7] }
  ],
  'Am': [
    { name: 'Posición Abierta', detail: 'Traste 2 en cuerda 4 · Un solo dedo', frets: [2, 0, 0, 0], fingers: [2, 0, 0, 0], baseFret: 1 },
    { name: 'Con Cejilla (Traste 5)', detail: 'Trastes 5 - 7 · Sonido suave', frets: [5, 4, 5, 3], fingers: [3, 2, 4, 1], baseFret: 3, barres: [3] },
    { name: 'Registro Alto (Traste 9)', detail: 'Trastes 9 · Sonido campana', frets: [9, 9, 8, 7], fingers: [3, 4, 2, 1], baseFret: 7 }
  ],
  'C': [
    { name: 'Posición Abierta', detail: 'Traste 3 en cuerda 1 · Un solo dedo', frets: [0, 0, 0, 3], fingers: [0, 0, 0, 3], baseFret: 1 },
    { name: 'Con Cejilla (Traste 3)', detail: 'Trastes 3 - 5 · Forma de A', frets: [5, 4, 3, 3], fingers: [3, 2, 1, 1], baseFret: 3, barres: [3] },
    { name: 'Registro Agudo (Traste 7)', detail: 'Trastes 7 - 9 · Para punteos', frets: [9, 7, 8, 7], fingers: [3, 1, 2, 1], baseFret: 7, barres: [7] }
  ],
  'C7': [
    { name: 'Posición Abierta', detail: 'Traste 1 en cuerda 1 · Sencillo y abierto', frets: [0, 0, 0, 1], fingers: [0, 0, 0, 1], baseFret: 1 },
    { name: 'Con Cejilla (Traste 3)', detail: 'Trastes 3 - 5 · Forma cerrada de 7ª', frets: [3, 4, 3, 3], fingers: [1, 2, 1, 1], baseFret: 3, barres: [3] },
    { name: 'Registro Agudo (Traste 7)', detail: 'Trastes 7 - 10 · Registro solista', frets: [9, 7, 8, 10], fingers: [3, 1, 2, 4], baseFret: 7 }
  ],
  'D': [
    { name: 'Posición Abierta', detail: 'Trastes 2 en cuerdas 4, 3 y 2', frets: [2, 2, 2, 0], fingers: [1, 2, 3, 0], baseFret: 1 },
    { name: 'Con Cejilla (Traste 5)', detail: 'Trastes 5 - 7 · Forma cerrada', frets: [7, 6, 5, 5], fingers: [3, 2, 1, 1], baseFret: 5, barres: [5] },
    { name: 'Registro Agudo (Traste 9)', detail: 'Traste 9 · Sonido campana', frets: [11, 9, 10, 9], fingers: [3, 1, 2, 1], baseFret: 9, barres: [9] }
  ],
  'D7': [
    { name: 'Posición Abierta', detail: 'Trastes 2-0-2-0 · Tonalidad clásica hawaiana', frets: [2, 0, 2, 0], fingers: [1, 0, 2, 0], baseFret: 1 },
    { name: 'Con Cejilla (Traste 2)', detail: 'Traste 2 · Forma de barra 2-2-2-3', frets: [2, 2, 2, 3], fingers: [1, 1, 1, 2], baseFret: 1, barres: [2] },
    { name: 'Registro Agudo (Traste 5)', detail: 'Trastes 5 - 7 · Séptima brillante', frets: [5, 6, 5, 5], fingers: [1, 2, 1, 1], baseFret: 5, barres: [5] }
  ],
  'E': [
    { name: 'Posición Estándar', detail: 'Trastes 2 - 4 · Voicing canónico 4-4-4-2', frets: [4, 4, 4, 2], fingers: [2, 3, 4, 1], baseFret: 1, barres: [2] },
    { name: 'Abierta Alternativa', detail: 'Trastes 1 - 4 · Sin cejilla completa 1-4-0-2', frets: [1, 4, 0, 2], fingers: [1, 4, 0, 2], baseFret: 1 },
    { name: 'Con Cejilla (Traste 4)', detail: 'Trastes 4 - 7 · Forma de C', frets: [4, 4, 4, 7], fingers: [1, 1, 1, 4], baseFret: 4, barres: [4] }
  ],
  'Em': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 4 · Escalera melódica', frets: [0, 4, 3, 2], fingers: [0, 3, 2, 1], baseFret: 1 },
    { name: 'Con Cejilla (Traste 7)', detail: 'Trastes 7 · Forma cerrada', frets: [9, 7, 7, 7], fingers: [3, 1, 1, 1], baseFret: 7, barres: [7] },
    { name: 'Registro Alto (Traste 7)', detail: 'Trastes 7 - 10 · Tonalidad aguda', frets: [9, 7, 7, 10], fingers: [2, 1, 1, 4], baseFret: 7, barres: [7] }
  ],
  'G': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 3 · Forma triangular', frets: [0, 2, 3, 2], fingers: [0, 1, 3, 2], baseFret: 1 },
    { name: 'Con Cejilla (Traste 7)', detail: 'Traste 7 · Forma de C', frets: [7, 7, 7, 10], fingers: [1, 1, 1, 4], baseFret: 7, barres: [7] },
    { name: 'Registro Melódico (Traste 5)', detail: 'Trastes 5 - 7 · Para solos', frets: [7, 7, 7, 5], fingers: [3, 3, 3, 1], baseFret: 5, barres: [5] }
  ],
  'G7': [
    { name: 'Posición Abierta', detail: 'Trastes 0 - 2 · Triángulo invertido estándar', frets: [0, 2, 1, 2], fingers: [0, 2, 1, 3], baseFret: 1 },
    { name: 'Con Cejilla (Traste 7)', detail: 'Trastes 7 · Forma cerrada con 7ª', frets: [7, 7, 7, 8], fingers: [1, 1, 1, 2], baseFret: 7, barres: [7] },
    { name: 'Registro Agudo (Traste 10)', detail: 'Trastes 10 - 12 · Séptima alta', frets: [10, 11, 10, 10], fingers: [1, 2, 1, 1], baseFret: 10, barres: [10] }
  ]
});

export const CHROMATIC_SCALE_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const CHROMATIC_SCALE_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const NOTE_FREQ = {
  'C': 261.63, 'C#': 277.18, 'Db': 277.18, 'D': 293.66, 'D#': 311.13, 'Eb': 311.13,
  'E': 329.63, 'F': 349.23, 'F#': 369.99, 'Gb': 369.99, 'G': 392.00, 'G#': 415.30,
  'Ab': 415.30, 'A': 440.00, 'A#': 466.16, 'Bb': 466.16, 'B': 493.88
};
