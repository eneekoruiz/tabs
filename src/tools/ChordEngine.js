/**
 * @file ChordEngine.js
 * @description Motor integral de acordes multi-instrumento (Guitarra, Ukelele, Piano).
 * Arquitectura modular SRP desacoplada: definiciones, renderizado SVG y síntesis de audio Karplus-Strong.
 */

import { events } from '../core/EventBus.js';
import {
  GUITAR_CHORDS,
  UKULELE_CHORDS,
  PIANO_VOICINGS,
  CHROMATIC_SCALE_SHARPS,
  CHROMATIC_SCALE_FLATS
} from './chord/ChordDefinitions.js';
import { ChordSvgRenderer } from './chord/ChordSvgRenderer.js';
import { ChordAudioSynthesizer } from './chord/ChordAudioSynthesizer.js';

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

  getChord(chordName, instrument = this.currentInstrument) {
    if (instrument === 'ukulele') {
      return ChordSvgRenderer.getUkuleleChord(chordName);
    }
    return ChordSvgRenderer.getGuitarChord(chordName);
  }

  simplifyChord(chord) {
    return ChordSvgRenderer.simplifyChord(chord);
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
      return ChordSvgRenderer.renderPiano(chordName);
    } else if (instrument === 'ukulele') {
      return ChordSvgRenderer.renderUkulele(chordName, isLeftHanded);
    }
    return ChordSvgRenderer.renderGuitar(chordName, isLeftHanded);
  }

  auditionChord(chordName, instrument = this.currentInstrument) {
    try {
      const ctx = this.getAudioContext();
      ChordAudioSynthesizer.audition(ctx, chordName, instrument);
    } catch (err) {
      console.warn('[ChordEngine] Error reproduciendo audio:', err);
    }
  }
}

export const chordEngine = new ChordEngine();
export default chordEngine;
