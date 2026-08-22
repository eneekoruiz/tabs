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
  static renderGallery(uniqueChords, { instrument = 'guitar', notation = 'anglo', tempo = 120, timeSignature = '4/4' } = {}) {
    if (!uniqueChords || uniqueChords.length === 0) return '';

    const instName = this.getInstrumentDisplayName(instrument);

    return `
      <div class="song-chords-visual-gallery" role="region" aria-label="Diagramas de acordes de la canción">
        <div class="gallery-header-row">
          <div class="gallery-title-group">
            <span class="gallery-badge-studio">DIAGRAMAS DE LA CANCIÓN</span>
            <h2 class="gallery-heading">Acordes Utilizados (${instName})</h2>
          </div>
          <span class="gallery-tip">Toca cualquier diagrama para escuchar su sonido acústico</span>
        </div>

        <!-- Patrón de Rasgueo Recomendado -->
        <div class="gallery-strumming-bar">
          <div class="strum-badge-group">
            <span class="strum-badge">PATRÓN DE RASGUEO</span>
            <div class="strum-pattern-arrows" aria-label="Flechas de rasgueo">
              <span class="strum-arrow down" title="Golpe abajo">↓</span>
              <span class="strum-arrow down" title="Golpe abajo">↓</span>
              <span class="strum-arrow up" title="Golpe arriba">↑</span>
              <span class="strum-space"></span>
              <span class="strum-arrow up" title="Golpe arriba">↑</span>
              <span class="strum-arrow down" title="Golpe abajo">↓</span>
              <span class="strum-arrow up" title="Golpe arriba">↑</span>
            </div>
          </div>
          <div class="strum-tempo-pill">
            <span>♩ ${tempo} BPM</span>
            <span class="strum-dot-sep">•</span>
            <span>Compás ${timeSignature}</span>
          </div>
        </div>

        <div class="chords-visual-cards-grid">
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
                  <span class="chord-card-action-label">🔊 Tocar</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
}

export default ChordDiagramRenderer;
