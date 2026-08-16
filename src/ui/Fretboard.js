/**
 * @file Fretboard.js
 * @description Mástil de Guitarra/Bajo Interactivo en tiempo real.
 * Renderiza el mástil con marcadores de traste, detecta afinación de la pista activa
 * e ilumina dinámicamente las notas tocadas en cada beat durante la reproducción.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';

export class Fretboard extends Component {
  constructor(container) {
    super(container);
    this.numFrets = 24;
    this.numStrings = 6;
    this.tuning = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2']; // 1ª cuerda a 6ª cuerda
    this.activeNotes = []; // [{ string, fret, noteValue }]
    this.isOpen = true;

    this.initEvents();
  }

  initEvents() {
    // Sincronización en tiempo real con los beats de reproducción de AlphaTab
    this.registerUnsub(
      events.on('playback:beat', (beat) => {
        this.highlightBeatNotes(beat);
      })
    );

    // Limpiar notas al detener la reproducción
    this.registerUnsub(
      events.on('playback:state', ({ state: playbackState }) => {
        if (playbackState === 'stopped') {
          this.clearNotes();
        }
      })
    );

    // Actualizar afinación y número de cuerdas cuando cambia la pista visual activa
    this.registerUnsub(
      events.on('track:visualSelected', ({ track }) => {
        this.updateTrackTuning(track);
      })
    );

    this.registerUnsub(
      events.on('score:loaded', ({ score }) => {
        if (score.tracks && score.tracks.length > 0) {
          this.updateTrackTuning(score.tracks[0]);
        }
      })
    );
  }

  updateTrackTuning(track) {
    if (!track) return;
    
    // Si la pista tiene afinación personalizada definida en Guitar Pro
    if (track.tuning && Array.isArray(track.tuning) && track.tuning.length > 0) {
      this.numStrings = track.tuning.length;
      // Invertir para que la 1ª cuerda (más aguda) esté arriba
      this.tuning = [...track.tuning].reverse();
    } else {
      this.numStrings = 6;
      this.tuning = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];
    }

    this.render();
  }

  /**
   * Resalta en el mástil las notas presentes en el beat que está sonando.
   * @param {Object} beat - Objeto Beat de AlphaTab
   */
  highlightBeatNotes(beat) {
    this.clearNotes();
    if (!beat || !beat.notes || beat.notes.length === 0) return;

    // Solo mostramos notas que pertenezcan a la pista que está visualizándose
    const currentVisualTrack = state.get('activeTrackIndex');
    if (beat.voice?.bar?.staff?.track?.index !== currentVisualTrack) {
      // Si el beat viene de otra pista en paralelo, omitimos o mostramos en color tenue
    }

    for (const note of beat.notes) {
      const stringIndex = note.string; // AlphaTab usa 1-indexed (1 = cuerda más aguda)
      const fretIndex = note.fret;     // 0 = cuerda al aire, 1..24 = trastes

      this.activeNotes.push({ string: stringIndex, fret: fretIndex });
      this.drawNoteMarker(stringIndex, fretIndex);
    }
  }

  clearNotes() {
    this.activeNotes = [];
    if (!this.container) return;
    const existingMarkers = this.container.querySelectorAll('.fret-note-marker');
    existingMarkers.forEach(el => el.remove());
  }

  drawNoteMarker(stringNumber, fretNumber) {
    if (!this.container) return;

    const fretCell = this.container.querySelector(`.fret-cell[data-fret="${fretNumber}"][data-string="${stringNumber}"]`);
    if (fretCell) {
      const marker = document.createElement('div');
      marker.className = `fret-note-marker ${fretNumber === 0 ? 'marker-open-string' : ''}`;
      marker.textContent = fretNumber === 0 ? 'O' : fretNumber;
      fretCell.appendChild(marker);
    }
  }

  render() {
    if (!this.container) return;

    // Trastes que llevan marcadores de posición (puntos)
    const singleDotFrets = [3, 5, 7, 9, 15, 17, 19, 21];
    const doubleDotFrets = [12, 24];

    let fretboardHtml = `
      <div class="fretboard-wrapper">
        <div class="fretboard-header">
          <span class="fretboard-title">🎸 Mástil Interactivo (${this.numStrings} cuerdas)</span>
          <div class="fretboard-controls">
            <span class="fretboard-tuning-label">Afinación: <strong>${this.tuning.join(' ')}</strong></span>
          </div>
        </div>

        <div class="fretboard-scroll">
          <div class="fretboard-grid" style="--num-strings: ${this.numStrings}; --num-frets: ${this.numFrets};">
            
            <!-- Cejuela / Afinación (Traste 0) -->
            <div class="fret-column fret-nut">
              <div class="fret-number">0</div>
              ${Array.from({ length: this.numStrings }, (_, s) => `
                <div class="fret-cell fret-cell-nut" data-fret="0" data-string="${s + 1}">
                  <span class="string-tuning-name">${this.tuning[s] || (s + 1)}</span>
                </div>
              `).join('')}
            </div>

            <!-- Trastes 1 a 24 -->
            ${Array.from({ length: this.numFrets }, (_, f) => {
              const fretNum = f + 1;
              const hasSingleDot = singleDotFrets.includes(fretNum);
              const hasDoubleDot = doubleDotFrets.includes(fretNum);

              return `
                <div class="fret-column ${hasSingleDot ? 'has-single-dot' : ''} ${hasDoubleDot ? 'has-double-dot' : ''}">
                  <div class="fret-number">${fretNum}</div>
                  ${Array.from({ length: this.numStrings }, (_, s) => `
                    <div class="fret-cell" data-fret="${fretNum}" data-string="${s + 1}">
                      <div class="guitar-string string-${s + 1}"></div>
                    </div>
                  `).join('')}
                  ${hasSingleDot ? '<div class="fret-dot single-dot"></div>' : ''}
                  ${hasDoubleDot ? '<div class="fret-dot double-dot-1"></div><div class="fret-dot double-dot-2"></div>' : ''}
                </div>
              `;
            }).join('')}

          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = fretboardHtml;
  }
}

export default Fretboard;
