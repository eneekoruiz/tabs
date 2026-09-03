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
        <!-- 1. Patrón de Rasgueo Principal (Destacado y Rítmico) -->
        <div class="strumming-pattern-card prominent-strum-card">
          <div class="strum-card-header">
            <div class="strum-title-wrap">
              <span class="strum-icon">🥁</span>
              <span class="strum-badge">PATRÓN DE RASGUEO</span>
              <span class="strum-subtitle">Ritmo sugerido de acompañamiento</span>
            </div>
            <div class="strum-tempo-badge">
              <span class="tempo-val">♩ ${tempo} BPM</span>
              <span class="strum-dot-sep">•</span>
              <span class="meter-val">${timeSignature}</span>
            </div>
          </div>

          <div class="strum-rhythm-display">
            <!-- Secuencia visual de compás con pulsos y flechas -->
            <div class="strum-beat-sequence">
              <div class="strum-beat-slot">
                <span class="strum-beat-num">1</span>
                <span class="strum-beat-pill down strum-arrow" title="Golpe abajo (fuerte)">↓</span>
              </div>
              <div class="strum-beat-slot">
                <span class="strum-beat-num">&</span>
                <span class="strum-beat-pill rest">—</span>
              </div>
              <div class="strum-beat-slot">
                <span class="strum-beat-num">2</span>
                <span class="strum-beat-pill down strum-arrow" title="Golpe abajo">↓</span>
              </div>
              <div class="strum-beat-slot">
                <span class="strum-beat-num">&</span>
                <span class="strum-beat-pill up strum-arrow" title="Golpe arriba">↑</span>
              </div>
              <div class="strum-beat-slot">
                <span class="strum-beat-num">3</span>
                <span class="strum-beat-pill rest">—</span>
              </div>
              <div class="strum-beat-slot">
                <span class="strum-beat-num">&</span>
                <span class="strum-beat-pill up strum-arrow" title="Golpe arriba">↑</span>
              </div>
              <div class="strum-beat-slot">
                <span class="strum-beat-num">4</span>
                <span class="strum-beat-pill down strum-arrow" title="Golpe abajo">↓</span>
              </div>
              <div class="strum-beat-slot">
                <span class="strum-beat-num">&</span>
                <span class="strum-beat-pill up strum-arrow" title="Golpe arriba">↑</span>
              </div>
            </div>

            <button class="btn-audition-strumming" id="btnPreviewStrumming" data-tempo="${tempo}" type="button" aria-label="Escuchar patrón de rasgueo">
              <span class="strum-play-icon">▶</span>
              <span class="strum-play-label">Escuchar Rasgueo</span>
            </button>
          </div>

          <!-- Metadatos de compatibilidad para lectores y tests -->
          <div class="strum-pattern-arrows" style="display: none;" aria-hidden="true">
            <span class="strum-arrow down">↓</span>
            <span class="strum-arrow down">↓</span>
            <span class="strum-arrow up">↑</span>
            <span class="strum-arrow up">↑</span>
            <span class="strum-arrow down">↓</span>
            <span class="strum-arrow up">↑</span>
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
