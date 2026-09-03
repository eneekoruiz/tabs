import { test, expect } from '@playwright/test';

// Setup DOM mock before importing UI modules
let domElements = {};
if (typeof global.document === 'undefined') {
  global.document = {
    createElement: (tag) => {
      const el = {
        id: '',
        className: '',
        innerHTML: '',
        attributes: {},
        listeners: {},
        setAttribute: (k, v) => { el.attributes[k] = v; },
        getAttribute: (k) => el.attributes[k] || null,
        addEventListener: (evt, fn) => { el.listeners[evt] = fn; },
        querySelector: (sel) => {
          const id = sel.replace('#', '');
          return {
            click: () => {
              if (el.listeners['click']) el.listeners['click']();
            },
            addEventListener: (evt, fn) => { el.listeners[`${id}_${evt}`] = fn; }
          };
        },
        querySelectorAll: () => [],
        remove: () => {
          if (el.id) delete domElements[el.id];
        }
      };
      return el;
    },
    getElementById: (id) => domElements[id] || null,
    body: {
      appendChild: (el) => {
        if (el.id) domElements[el.id] = el;
      }
    }
  };
}

if (typeof global.window === 'undefined') {
  global.window = {
    open: () => null,
    scrollBy: () => {}
  };
}

import { ChordSvgRenderer } from '../src/tools/chord/ChordSvgRenderer.js';
import { ChordAudioSynthesizer } from '../src/tools/chord/ChordAudioSynthesizer.js';
import { VocalScorecardModal } from '../src/ui/lyrics/VocalScorecardModal.js';
import { exporter } from '../src/data/Exporter.js';

test.describe('Certificación de 4 Mejoras Maestras de Nivel Profesional', () => {

  test('1. Pluck Cuerda a Cuerda Interactivo: Exactitud de Frecuencias y Notas Muteadas', () => {
    // Mock Web Audio Context
    const mockCtx = {
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      createGain: () => ({
        connect: () => {},
        gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }
      }),
      createDelay: () => ({
        delayTime: { value: 0 },
        connect: () => {}
      }),
      createBiquadFilter: () => ({
        type: 'lowpass',
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        Q: { value: 0 },
        connect: () => {}
      }),
      createOscillator: () => ({
        type: 'sine',
        frequency: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        detune: { value: 0 },
        connect: () => {},
        start: () => {},
        stop: () => {}
      }),
      createBuffer: () => ({
        getChannelData: () => new Float32Array(100)
      }),
      createBufferSource: () => ({
        buffer: null,
        connect: () => {},
        start: () => {}
      })
    };

    // Caso A: Acorde E (Mi Mayor) en Guitarra -> Frets: [0, 2, 2, 1, 0, 0]
    // Cuerda 0: E2 (82.41 Hz)
    const string0 = ChordAudioSynthesizer.pluckString(mockCtx, 0, 'E', 'guitar', 0);
    expect(string0.muted).toBe(false);
    expect(Math.round(string0.freq * 100) / 100).toBe(82.41);

    // Cuerda 3: Traste 1 sobre Sol (G3 = 196 Hz -> 196 * 2^(1/12) = 207.65 Hz [G#3])
    const string3 = ChordAudioSynthesizer.pluckString(mockCtx, 3, 'E', 'guitar', 0);
    expect(string3.muted).toBe(false);
    expect(Math.round(string3.freq * 100) / 100).toBe(207.65);

    // Caso B: Acorde C en Guitarra -> Frets: [-1, 3, 2, 0, 1, 0] (6ª cuerda muteada)
    const stringMuted = ChordAudioSynthesizer.pluckString(mockCtx, 0, 'C', 'guitar', 0);
    expect(stringMuted.muted).toBe(true);

    // Caso C: Ukelele Acorde C -> Frets: [0, 0, 0, 3] (A4 al traste 3 = C5 = 523.25 Hz)
    const ukeString3 = ChordAudioSynthesizer.pluckString(mockCtx, 3, 'C', 'ukulele', 0);
    expect(ukeString3.muted).toBe(false);
    expect(Math.round(ukeString3.freq * 100) / 100).toBe(523.25);
  });

  test('2. SVG Interactivo: Elementos de pulsación táctil/clic con hit-areas amplias', () => {
    const guitarSvg = ChordSvgRenderer.renderGuitar('Am');
    expect(guitarSvg).toContain('class="chord-interactive-string"');
    expect(guitarSvg).toContain('class="chord-string-hitarea"');
    expect(guitarSvg).toContain('data-string-idx="0"');
    expect(guitarSvg).toContain('data-string-idx="5"');

    const ukeSvg = ChordSvgRenderer.renderUkulele('C');
    expect(ukeSvg).toContain('class="chord-interactive-string"');
    expect(ukeSvg).toContain('class="chord-string-hitarea"');
    expect(ukeSvg).toContain('data-string-idx="3"');
  });

  test('3. Resumen y Puntuación Vocal (Scorecard): Lógica y Medallero', () => {
    // Caso Oro (>=80% afinación, >=75% estabilidad)
    VocalScorecardModal.show({
      songTitle: 'Bohemian Rhapsody',
      artist: 'Queen',
      sessionStats: {
        totalSingingFrames: 100,
        inTuneFrames: 92,
        stabilityScore: 88,
        breathSupportScore: 90,
        lowestPitch: { noteWithOctave: 'F3', midi: 53 },
        highestPitch: { noteWithOctave: 'Bb4', midi: 70 }
      }
    });

    const modal = global.document.getElementById('vocalScorecardModal');
    expect(modal).toBeTruthy();
    expect(modal.innerHTML).toContain('¡Afinación Maestra (Oro)!');
    expect(modal.innerHTML).toContain('92%');
    expect(modal.innerHTML).toContain('F3 – Bb4');
    modal.remove();

    // Caso Bronce (<65%)
    VocalScorecardModal.show({
      songTitle: 'Test Song',
      sessionStats: {
        totalSingingFrames: 100,
        inTuneFrames: 45,
        stabilityScore: 60,
        breathSupportScore: 60
      }
    });

    const bronzeModal = global.document.getElementById('vocalScorecardModal');
    expect(bronzeModal.innerHTML).toContain('Buen Calentamiento Vocal');
    expect(bronzeModal.innerHTML).toContain('45%');
    bronzeModal.remove();
  });

  test('4. Exportador de Cancionero Completo en PDF: Estructura de Portada, Índice y Repertorio', () => {
    let openedHtml = '';
    const originalOpen = global.window.open;
    global.window.open = () => {
      return {
        document: {
          open: () => {},
          write: (h) => { openedHtml = h; },
          close: () => {}
        }
      };
    };

    const songs = [
      { title: 'Imagine', artist: 'John Lennon', chords: ['C', 'Cmaj7', 'F', 'Am', 'Dm', 'G'], lyricsChords: 'Imagine there\'s no heaven', key: 'C', tempo: 76, capo: 0 },
      { title: 'Let It Be', artist: 'The Beatles', chords: ['C', 'G', 'Am', 'F'], lyricsChords: 'When I find myself in times of trouble', key: 'C', tempo: 72, capo: 0 },
      { title: 'Wonderwall', artist: 'Oasis', chords: ['Em7', 'G', 'Dsus4', 'A7sus4'], lyricsChords: 'Today is gonna be the day', key: 'Em', tempo: 87, capo: 2 }
    ];

    const result = exporter.exportSongbookPDF({
      title: 'Cancionero Acústico de Ensayo',
      songs,
      instrument: 'guitar'
    });

    expect(result).toBe(true);
    expect(openedHtml).toContain('Cancionero Acústico de Ensayo');
    expect(openedHtml).toContain('3</strong> Canciones preparadas');
    expect(openedHtml).toContain('Índice del Repertorio');
    expect(openedHtml).toContain('Imagine');
    expect(openedHtml).toContain('Let It Be');
    expect(openedHtml).toContain('Wonderwall');
    expect(openedHtml).toContain('page-break');

    global.window.open = originalOpen;
  });

});
