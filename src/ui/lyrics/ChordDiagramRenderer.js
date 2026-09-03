/**
 * @file ChordDiagramRenderer.js
 * @description Generador visual de diagramas de acordes SVG para guitarra, piano y ukelele,
 * y renderizado de la galería de acordes y patrones de rasgueo.
 */

import { chordEngine } from '../../tools/ChordEngine.js';
import { ChordProParser } from './ChordProParser.js';

export class ChordDiagramRenderer {
  /**
   * Obtiene el nombre en español del instrumento.
   * @param {string} inst
   * @returns {string}
   */
  static getInstrumentDisplayName(inst) {
    switch (inst) {
      case 'piano': return 'Piano';
      case 'ukulele': return 'Ukelele';
      default: return 'Guitarra';
    }
  }

  /**
   * Genera el HTML de la galería visual de diagramas de acordes al inicio de la partitura.
   * @param {string[]} uniqueChords
   * @param {Object} options
   * @returns {string}
   */
  /**
   * Genera el bloque de patrón de rasgueo y la barra compacta de acordes utilizados con galería colapsable.
   * @param {string[]} uniqueChords
   * @param {Object} options
   * @returns {string}
   */
  static renderGallery(uniqueChords, { instrument = 'guitar', notation = 'anglo', tempo = 120, timeSignature = '4/4' } = {}) {
    if (!uniqueChords || uniqueChords.length === 0) return '';

    const instName = this.getInstrumentDisplayName(instrument);

    return `
      <div class="song-meta-rhythm-strip" role="region" aria-label="Ritmo y acordes de la canción">
        <!-- 1. Patrón de Rasgueo Principal (Horizontal, Limpio y Elegante) -->
        <div class="strumming-pattern-card" role="region" aria-label="Patrón de rasgueo">
          <div class="strum-left-group">
            <span class="strum-badge">PATRÓN DE RASGUEO</span>
            <div class="strum-pattern-arrows" aria-label="Secuencia de rasgueo: abajo abajo arriba, arriba abajo arriba">
              <span class="strum-arrow down" title="Golpe abajo">↓</span>
              <span class="strum-arrow down" title="Golpe abajo">↓</span>
              <span class="strum-arrow up" title="Golpe arriba">↑</span>
              <span class="strum-gap-spacer"></span>
              <span class="strum-arrow up" title="Golpe arriba">↑</span>
              <span class="strum-arrow down" title="Golpe abajo">↓</span>
              <span class="strum-arrow up" title="Golpe arriba">↑</span>
            </div>
          </div>

          <div class="strum-right-group">
            <div class="strum-tempo-badge">
              <span>♩ ${tempo} BPM</span>
              <span class="strum-dot-sep">•</span>
              <span>${timeSignature}</span>
            </div>
            <button class="btn-audition-strumming" id="btnPreviewStrumming" data-tempo="${tempo}" type="button" aria-label="Escuchar patrón de rasgueo">
              <span class="strum-play-icon">▶</span>
              <span class="strum-play-label">Escuchar</span>
            </button>
          </div>
        </div>

        <!-- 2. Acordes Utilizados (Fila compacta e interactiva con selector de diagramas) -->
        <div class="song-used-chords-bar">
          <div class="used-chords-label-group">
            <span class="used-chords-title">Acordes Utilizados (${instName}):</span>
            <div class="used-chords-chips-row">
              ${uniqueChords.map(chordName => {
                const formattedName = ChordProParser.formatChordDisplay(chordName, notation);
                return `
                  <button class="used-chord-pill chord-badge" data-chord="${chordName}" data-original-chord="${chordName}" title="Ver diagrama y escuchar ${formattedName}">
                    <strong>${formattedName}</strong>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Botón desplegable para ver diagramas completos si se desea -->
          <details class="chords-diagrams-accordion">
            <summary class="btn-toggle-diagrams-summary">
              <span>👁️ Ver diagramas de acordes (${uniqueChords.length})</span>
              <span class="summary-caret">▾</span>
            </summary>
            <div class="chords-visual-cards-grid" style="margin-top: 14px;">
              ${uniqueChords.map(chordName => {
                const formattedName = ChordProParser.formatChordDisplay(chordName, notation);
                const svgDiagram = chordEngine.renderChordSVG(chordName, { instrument });
                return `
                  <div class="song-chord-visual-card" data-chord="${chordName}" data-original-chord="${chordName}" role="button" aria-label="Escuchar y ver acorde ${formattedName}">
                    <div class="chord-card-diagram-box">
                      ${svgDiagram}
                    </div>
                    <div class="chord-card-footer">
                      <span class="chord-card-name">${formattedName}</span>
                      <span class="chord-card-action-label">🔊 Sonar</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </details>
        </div>
      </div>
    `;
  }
}

export default ChordDiagramRenderer;
