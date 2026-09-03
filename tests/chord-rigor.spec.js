import { test, expect } from '@playwright/test';
import { chordEngine } from '../src/tools/ChordEngine.js';
import { UKULELE_CHORDS, GUITAR_CHORDS } from '../src/tools/chord/ChordDefinitions.js';

test.describe('Rigor Musical Estricto — Failsafe Chord Library (Zero Hallucinations)', () => {
  test('Llamada al acorde E (Mi Mayor) en Ukelele devuelve el voicing determinista correcto', () => {
    const ukuleleE = chordEngine.getChord('E', 'ukulele');
    expect(ukuleleE).toBeDefined();
    // La digitación canónica real de Mi Mayor en Ukelele (G C E A) es 4-4-4-2
    expect(ukuleleE.frets).toEqual([4, 4, 4, 2]);
    expect(ukuleleE.fingers).toEqual([2, 3, 4, 1]);
    expect(ukuleleE.baseFret).toBe(1);
    expect(ukuleleE.barres).toContain(2);
  });

  test('Llamada al acorde en notación latina "Mi" en Ukelele mapea deterministamente a E', () => {
    const ukuleleMi = chordEngine.getChord('Mi', 'ukulele');
    expect(ukuleleMi).toBeDefined();
    expect(ukuleleMi.frets).toEqual([4, 4, 4, 2]);
  });

  test('Llamada al acorde E en Guitarra devuelve voicing estándar (0-2-2-1-0-0)', () => {
    const guitarE = chordEngine.getChord('E', 'guitar');
    expect(guitarE).toBeDefined();
    expect(guitarE.frets).toEqual([0, 2, 2, 1, 0, 0]);
    expect(guitarE.fingers).toEqual([0, 2, 3, 1, 0, 0]);
  });

  test('Diccionario no alucina digitaciones imposibles para acordes comunes', () => {
    const chordsToCheck = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Em', 'Am', 'Dm', 'G7', 'C7'];
    for (const ch of chordsToCheck) {
      const uke = chordEngine.getChord(ch, 'ukulele');
      expect(uke).toBeDefined();
      expect(Array.isArray(uke.frets)).toBe(true);
      expect(uke.frets.length).toBe(4);
      // Ningún traste debe ser un número negativo salvo -1 (mute)
      uke.frets.forEach(f => expect(f).toBeGreaterThanOrEqual(-1));
    }
  });
});
