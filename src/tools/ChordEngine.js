/**
 * @file ChordEngine.js
 * @description Motor integral de acordes multi-instrumento (Guitarra, Ukelele, Piano).
 * Definiciones de acordes, renderizado SVG y síntesis Web Audio.
 */

import { events } from '../core/EventBus.js';
import {
  GUITAR_CHORDS,
  UKULELE_CHORDS,
  PIANO_VOICINGS
} from './chord/ChordDefinitions.js';
import { ChordSvgRenderer } from './chord/ChordSvgRenderer.js';
import { ChordAudioSynthesizer } from './chord/ChordAudioSynthesizer.js';
import { transposeChordName } from './chord/ChordTheory.js';

export { GUITAR_CHORDS, UKULELE_CHORDS, PIANO_VOICINGS };

class ChordEngine {
  constructor() {
    this.currentInstrument = 'guitar';
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

  getChord(chordName, instrument = this.currentInstrument, voicingIndex = 0) {
    if (instrument === 'piano') return ChordSvgRenderer.getPianoChord(chordName, voicingIndex);
    if (instrument === 'ukulele') {
      return ChordSvgRenderer.getUkuleleChord(chordName, voicingIndex);
    }
    return instrument === 'guitar' ? ChordSvgRenderer.getGuitarChord(chordName, voicingIndex) : null;
  }

  simplifyChord(chord) {
    return ChordSvgRenderer.simplifyChord(chord);
  }

  transposeChord(chord, semitones) {
    if (!chord || semitones === 0) return chord;
    return transposeChordName(chord, semitones);
  }

  getVoicings(chordName, instrument = this.currentInstrument) {
    return ChordSvgRenderer.getVoicings(chordName, instrument);
  }

  getChordSvg(chordName, instrument = this.currentInstrument, voicingIndex = 0) {
    return this.renderChordSVG(chordName, { instrument, voicingIndex });
  }

  renderChordSVG(chordName, { instrument = this.currentInstrument, isLeftHanded = this.isLeftHanded, voicingIndex = 0, displayName = null } = {}) {
    if (!['guitar', 'ukulele', 'piano'].includes(instrument)) return '<div class="chord-not-found">Instrumento no disponible</div>';
    if (instrument === 'piano') {
      return ChordSvgRenderer.renderPiano(chordName, voicingIndex, displayName);
    } else if (instrument === 'ukulele') {
      return ChordSvgRenderer.renderUkulele(chordName, isLeftHanded, voicingIndex, displayName);
    }
    return ChordSvgRenderer.renderGuitar(chordName, isLeftHanded, voicingIndex, displayName);
  }

  auditionChord(chordName, instrument = this.currentInstrument, voicingIndex = 0) {
    try {
      const ctx = this.getAudioContext();
      ChordAudioSynthesizer.audition(ctx, chordName, instrument, voicingIndex);
    } catch (err) {
      console.warn('[ChordEngine] Error reproduciendo audio:', err);
    }
  }

  arpeggiateChord(chordName, instrument = this.currentInstrument, voicingIndex = 0, onNoteCallback = null) {
    try {
      const ctx = this.getAudioContext();
      return ChordAudioSynthesizer.arpeggiate(ctx, chordName, instrument, voicingIndex, onNoteCallback);
    } catch (err) {
      console.warn('[ChordEngine] Error arpegiando acorde:', err);
      return [];
    }
  }

  strumGuitar(chordName = 'C', stroke = 'down', tempo = 120, voicingIndex = 0) {
    try {
      const ctx = this.getAudioContext();
      ChordAudioSynthesizer.strumGuitar(ctx, chordName, stroke, tempo, voicingIndex);
    } catch (err) {
      console.warn('[ChordEngine] Error en rasgueo acústico:', err);
    }
  }

  pluckString(stringIndex, chordName = this.currentChord, instrument = this.currentInstrument, voicingIndex = 0) {
    try {
      const ctx = this.getAudioContext();
      return ChordAudioSynthesizer.pluckString(ctx, stringIndex, chordName, instrument, voicingIndex);
    } catch (err) {
      console.warn('[ChordEngine] Error pulsando cuerda aislada:', err);
      return null;
    }
  }

  playPianoKey(noteName, octave = 4) {
    try {
      const ctx = this.getAudioContext();
      return ChordAudioSynthesizer.playPianoNote(ctx, noteName, octave);
    } catch (err) {
      console.warn('[ChordEngine] Error pulsando tecla de piano:', err);
      return null;
    }
  }
}

export const chordEngine = new ChordEngine();
export default chordEngine;
