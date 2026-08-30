/**
 * @file DrumKitVisualizer.js
 * @description Visualizador interactivo de Batería (Drum Kit) para pistas de percusión.
 * Detecta notas MIDI del mapa estándar de batería (General MIDI Drum Map) y anima los pads en tiempo real.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';

export class DrumKitVisualizer extends Component {
  constructor(container) {
    super(container);
    this.isOpen = false;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('playback:beat', (beat) => {
        this.highlightDrumHits(beat);
      })
    );

    this.registerUnsub(
      events.on('ui:toggleDrums', () => {
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

  highlightDrumHits(beat) {
    if (!beat || !beat.notes || beat.notes.length === 0) return;

    for (const note of beat.notes) {
      const midi = note.midiNumber || (note.fret || 36);
      this.triggerDrumPad(midi);
    }
  }

  triggerDrumPad(midi) {
    let padId = null;

    if ([35, 36].includes(midi)) padId = 'drumKick';
    else if ([38, 40].includes(midi)) padId = 'drumSnare';
    else if ([42, 44].includes(midi)) padId = 'drumHiHatClosed';
    else if ([46].includes(midi)) padId = 'drumHiHatOpen';
    else if ([41, 43].includes(midi)) padId = 'drumFloorTom';
    else if ([45, 47, 48, 50].includes(midi)) padId = 'drumHighTom';
    else if ([49, 57].includes(midi)) padId = 'drumCrash';
    else if ([51, 59].includes(midi)) padId = 'drumRide';

    if (padId) {
      const padEl = this.container?.querySelector(`#${padId}`);
      if (padEl) {
        padEl.classList.add('pad-hit');
        setTimeout(() => padEl.classList.remove('pad-hit'), 150);
      }
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="drum-visualizer-wrapper" role="region" aria-label="Visualizador de batería interactivo">
        <div class="drum-header">
          <span class="drum-title">🥁 Batería & Percusión Interactiva</span>
          <button class="btn-close-visualizer" id="btnCloseDrums" aria-label="Cerrar batería">✖</button>
        </div>

        <div class="drum-kit-layout">
          <!-- Platillos Superiores -->
          <div class="drum-cymbals-row">
            <div class="drum-pad cymbal-pad" id="drumCrash" title="Crash (MIDI 49)">
              <span>Crash</span>
            </div>
            <div class="drum-pad cymbal-pad" id="drumHiHatOpen" title="Hi-Hat Abierto (MIDI 46)">
              <span>Hi-Hat O</span>
            </div>
            <div class="drum-pad cymbal-pad" id="drumHiHatClosed" title="Hi-Hat Cerrado (MIDI 42)">
              <span>Hi-Hat C</span>
            </div>
            <div class="drum-pad cymbal-pad" id="drumRide" title="Ride (MIDI 51)">
              <span>Ride</span>
            </div>
          </div>

          <!-- Tambores Centrales e Inferiores -->
          <div class="drum-toms-row">
            <div class="drum-pad tom-pad" id="drumHighTom" title="Tom Aéreo (MIDI 48)">
              <span>Tom 1</span>
            </div>
            <div class="drum-pad snare-pad" id="drumSnare" title="Caja / Snare (MIDI 38)">
              <span>Caja</span>
            </div>
            <div class="drum-pad tom-pad" id="drumFloorTom" title="Goliat / Floor Tom (MIDI 41)">
              <span>Goliat</span>
            </div>
          </div>

          <!-- Bombo Central -->
          <div class="drum-kick-row">
            <div class="drum-pad kick-pad" id="drumKick" title="Bombo / Bass Drum (MIDI 36)">
              <span>Bombo (Kick)</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btnCloseDrums')?.addEventListener('click', () => {
      this.toggle();
    });

    this.container.querySelectorAll('.drum-pad').forEach(pad => {
      pad.addEventListener('click', () => {
        pad.classList.add('pad-hit');
        setTimeout(() => pad.classList.remove('pad-hit'), 150);
      });
    });
  }
}

export default DrumKitVisualizer;
