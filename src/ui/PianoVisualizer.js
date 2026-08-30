/**
 * @file PianoVisualizer.js
 * @description Visualizador interactivo de Teclado de Piano (Piano Roll / Keyboard).
 * Renderiza teclas blancas y negras e ilumina las notas en tiempo real según el compás y beat reproducido.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';

export class PianoVisualizer extends Component {
  constructor(container) {
    super(container);
    this.startMidi = 36; // C2
    this.numKeys = 49;   // 4 octavas completas (C2 a C6)
    this.activeMidiNotes = new Set();
    this.isOpen = false;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('playback:beat', (beat) => {
        this.highlightBeatNotes(beat);
      })
    );

    this.registerUnsub(
      events.on('playback:state', ({ state: pState }) => {
        if (pState === 'stopped') {
          this.clearNotes();
        }
      })
    );

    this.registerUnsub(
      events.on('ui:togglePiano', () => {
        this.toggle();
      })
    );
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.container) {
      this.container.classList.toggle('visualizer-open', this.isOpen);
      if (this.isOpen) this.render();
    }
  }

  highlightBeatNotes(beat) {
    this.clearNotes();
    if (!beat || !beat.notes || beat.notes.length === 0) return;

    for (const note of beat.notes) {
      // Estimar o leer número MIDI de la nota
      const midi = note.midiNumber || (40 + (note.fret || 0) + ((note.string || 1) * 5));
      this.activeMidiNotes.add(midi);

      const keyEl = this.container?.querySelector(`.piano-key[data-midi="${midi}"]`);
      if (keyEl) {
        keyEl.classList.add('key-active');
      }
    }
  }

  clearNotes() {
    this.activeMidiNotes.clear();
    if (!this.container) return;
    this.container.querySelectorAll('.key-active').forEach(el => el.classList.remove('key-active'));
  }

  isBlackKey(midi) {
    const noteInOctave = midi % 12;
    return [1, 3, 6, 8, 10].includes(noteInOctave); // C#, D#, F#, G#, A#
  }

  render() {
    if (!this.container) return;

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    let keysHtml = '';
    for (let i = 0; i < this.numKeys; i++) {
      const midi = this.startMidi + i;
      const isBlack = this.isBlackKey(midi);
      const noteName = noteNames[midi % 12];
      const octave = Math.floor(midi / 12) - 1;

      keysHtml += `
        <div class="piano-key ${isBlack ? 'black-key' : 'white-key'} ${this.activeMidiNotes.has(midi) ? 'key-active' : ''}" data-midi="${midi}" title="${noteName}${octave} (MIDI ${midi})">
          ${!isBlack ? `<span class="piano-note-label">${noteName}${octave}</span>` : ''}
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="piano-visualizer-wrapper" role="region" aria-label="Teclado de piano interactivo">
        <div class="piano-header">
          <span class="piano-title">🎹 Teclado de Piano Interactivo (${this.numKeys} teclas)</span>
          <button class="btn-close-visualizer" id="btnClosePiano" aria-label="Cerrar piano">✖</button>
        </div>
        <div class="piano-keyboard-scroll">
          <div class="piano-keyboard-track">
            ${keysHtml}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btnClosePiano')?.addEventListener('click', () => {
      this.toggle();
    });

    // Clic en teclas para emitir sonido de muestra
    this.container.querySelectorAll('.piano-key').forEach(keyEl => {
      keyEl.addEventListener('click', () => {
        const midi = parseInt(keyEl.dataset.midi, 10);
        this.playSampleTone(midi);
        keyEl.classList.add('key-active');
        setTimeout(() => keyEl.classList.remove('key-active'), 300);
      });
    });
  }

  playSampleTone(midi) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const freq = 440 * Math.pow(2, (midi - 69) / 12);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.85);
    } catch (e) {}
  }
}

export default PianoVisualizer;
