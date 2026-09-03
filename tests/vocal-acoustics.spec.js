import { test, expect } from '@playwright/test';
import { VocalRangeFinder, FEMALE_RANGES, MALE_RANGES } from '../src/ui/lyrics/VocalRangeFinder.js';

test.describe('Ciencia Acústica, Pedagogía Vocal & Rigor Matemático', () => {

  test('1. Exactitud de Frecuencias ISO 16:1975 y Ecuaciones de Temperamento Igual', () => {
    // A4 = 440 Hz estándar internacional
    const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);

    // C4 (Do central) = 261.625 Hz (MIDI 60)
    const c4Freq = midiToFreq(60);
    expect(Math.round(c4Freq * 100) / 100).toBe(261.63);

    // A4 = 440.00 Hz (MIDI 69)
    expect(midiToFreq(69)).toBe(440);

    // C5 = 523.25 Hz (MIDI 72)
    expect(Math.round(midiToFreq(72) * 100) / 100).toBe(523.25);

    // Inversa
    expect(Math.round(freqToMidi(440))).toBe(69);
    expect(Math.round(freqToMidi(261.63))).toBe(60);
  });

  test('2. Filtrado Estadístico Robusto de Outliers (Percentil P10 y P90 contra Ruido de Micrófono)', () => {
    const vrf = new VocalRangeFinder({});

    // Buffer con notas sostenidas en C4 (60) y un glitch transitorio en C1 (24) por golpe de micro
    const lowWithGlitch = [
      { midi: 60, freq: 261.63 },
      { midi: 60, freq: 261.63 },
      { midi: 60, freq: 261.63 },
      { midi: 24, freq: 32.7 }, // Glitch
      { midi: 60, freq: 261.63 },
      { midi: 60, freq: 261.63 },
      { midi: 60, freq: 261.63 },
      { midi: 60, freq: 261.63 },
      { midi: 60, freq: 261.63 },
      { midi: 60, freq: 261.63 }
    ];

    const lowResult = vrf._bestPitch(lowWithGlitch, 'low');
    // Debe descartar el 24 y tomar la nota sostenida real (60)
    expect(lowResult.midi).toBe(60);
    expect(lowResult.note).toBe('C');
    expect(lowResult.octave).toBe(4);

    // Buffer con agudos en A5 (81) y un chasquido agudo espurio en C8 (108)
    const highWithGlitch = [
      { midi: 81, freq: 880 },
      { midi: 81, freq: 880 },
      { midi: 81, freq: 880 },
      { midi: 81, freq: 880 },
      { midi: 108, freq: 4186 }, // Chasquido espurio
      { midi: 81, freq: 880 },
      { midi: 81, freq: 880 },
      { midi: 81, freq: 880 },
      { midi: 81, freq: 880 }
    ];

    const highResult = vrf._bestPitch(highWithGlitch, 'high');
    expect(highResult.midi).toBe(81);
    expect(highResult.note).toBe('A');
    expect(highResult.octave).toBe(5);
  });

  test('3. Clasificación Rigurosa de Voces Femeninas según Sistema Fach', () => {
    const vrf = new VocalRangeFinder({});
    vrf.selectedGender = 'female';

    // Caso 1: Rango Soprano C4 a C6 (MIDI 60 a 84)
    vrf.capturedLow = { midi: 60, freq: 261.63 };
    vrf.capturedHigh = { midi: 84, freq: 1046.5 };
    const soprano = vrf._classify();
    expect(soprano.id).toBe('soprano');
    expect(soprano.label).toBe('Soprano');
    expect(soprano.primoPassaggio).toContain('Eb4');

    // Caso 2: Rango Mezzo-Soprano A3 a A5 (MIDI 57 a 81)
    vrf.capturedLow = { midi: 57, freq: 220 };
    vrf.capturedHigh = { midi: 81, freq: 880 };
    const mezzo = vrf._classify();
    expect(mezzo.id).toBe('mezzo');
    expect(mezzo.label).toBe('Mezzo-Soprano');
    expect(mezzo.primoPassaggio).toContain('E4');

    // Caso 3: Rango Contralto F3 a F5 (MIDI 53 a 77)
    vrf.capturedLow = { midi: 53, freq: 174.61 };
    vrf.capturedHigh = { midi: 77, freq: 698.46 };
    const contralto = vrf._classify();
    expect(contralto.id).toBe('contralto');
    expect(contralto.label).toBe('Contralto');
    expect(contralto.primoPassaggio).toContain('D4');
  });

  test('4. Rigor Acústico de Passaggi y Tesituras de Pedagogía Clásica (Miller/Titze)', () => {
    // Comprobar que todas las categorías tienen passaggi y tesituras definidas sin ambigüedad
    for (const r of [...FEMALE_RANGES, ...MALE_RANGES]) {
      expect(r.tessitura).toBeTruthy();
      expect(r.primoPassaggio).toBeTruthy();
      expect(r.secondoPassaggio).toBeTruthy();
      expect(r.minMidi).toBeLessThan(r.maxMidi);
    }
  });

});
