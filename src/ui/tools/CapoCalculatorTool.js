/**
 * @file CapoCalculatorTool.js
 * @description Calculadora de Cejilla / Capotraste con tabla de transposición automática de acordes.
 */

import { chordEngine } from '../../tools/ChordEngine.js';
import { ChordProParser } from '../lyrics/ChordProParser.js';

export class CapoCalculatorTool {
  constructor() {
    this.targetKey = 'Eb';
    this.openShape = 'C';
  }

  calculateFret(targetKey, openShape) {
    const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

    const cleanTarget = flatMap[targetKey] || targetKey;
    const cleanShape = flatMap[openShape] || openShape.replace('m', '');

    const targetIdx = chromatic.indexOf(cleanTarget);
    const shapeIdx = chromatic.indexOf(cleanShape);

    if (targetIdx === -1 || shapeIdx === -1) return 0;

    let fret = targetIdx - shapeIdx;
    if (fret < 0) fret += 12;
    return fret;
  }

  getTranspositionTable(targetKey, openShape, capoFret) {
    const shapeChords = {
      'C': { I: 'C', ii: 'Dm', IV: 'F', V: 'G', vi: 'Am' },
      'G': { I: 'G', ii: 'Am', IV: 'C', V: 'D', vi: 'Em' },
      'D': { I: 'D', ii: 'Em', IV: 'G', V: 'A', vi: 'Bm' },
      'E': { I: 'E', ii: 'F#m', IV: 'A', V: 'B', vi: 'C#m' },
      'A': { I: 'A', ii: 'Bm', IV: 'D', V: 'E', vi: 'F#m' },
      'Am': { I: 'Am', ii: 'Bdim', IV: 'Dm', V: 'E', vi: 'C' },
      'Em': { I: 'Em', ii: 'F#dim', IV: 'Am', V: 'B', vi: 'G' },
      'Dm': { I: 'Dm', ii: 'Edim', IV: 'Gm', V: 'A', vi: 'F' },
    };

    const shapes = shapeChords[openShape] || shapeChords['C'];
    const rows = Object.entries(shapes).map(([degree, chord]) => {
      const transposed = chordEngine.transposeChord(chord, capoFret);
      return `
        <tr>
          <td class="capo-table-degree">${degree}</td>
          <td class="capo-table-shape">${chord}</td>
          <td class="capo-table-result">${transposed}</td>
        </tr>
      `;
    }).join('');

    return `
      <table class="capo-transposition-table">
        <thead>
          <tr>
            <th>Grado</th>
            <th>Digitación que tocas</th>
            <th>Suena como</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  updateUI(container) {
    const fret = this.calculateFret(this.targetKey, this.openShape);
    const resultBox = container?.querySelector('#capoResultFretDisplay');
    const descBox = container?.querySelector('#capoResultDescription');
    const tableBox = container?.querySelector('#capoTranspositionTable');

    if (resultBox) {
      resultBox.textContent = fret === 0 ? 'Sin cejilla (Traste 0)' : `Traste ${fret}`;
    }
    if (descBox) {
      descBox.textContent = `Coloca la cejilla en el traste ${fret} y toca posiciones de [${this.openShape}]. Sonará en tono de [${this.targetKey}].`;
    }
    if (tableBox) {
      tableBox.innerHTML = this.getTranspositionTable(this.targetKey, this.openShape, fret);
    }
  }

  renderModal() {
    const pref = ChordProParser.getAccidentalPreference();
    const targetKeys = pref === 'flats'
      ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
      : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    this.targetKey = ChordProParser.spellAccidentals(this.targetKey, pref);
    const openShapes = ['C', 'G', 'D', 'E', 'A', 'Am', 'Em', 'Dm'];
    const fret = this.calculateFret(this.targetKey, this.openShape);

    return `
      <div class="tool-modal-overlay active" id="modal-capo">
        <div class="tool-modal-dialog">
          <div class="tool-modal-header">
            <div class="tool-modal-title">
              <span class="tool-modal-icon">🎸</span>
              <div>
                <span class="tool-badge-studio">TRANSPOSICIÓN & CEJILLA</span>
                <h2>Calculadora de Cejilla / Capo</h2>
              </div>
            </div>
            <button class="btn-close-tool-modal btn-close-modal" id="btnCloseToolModal">✕</button>
          </div>

          <div class="tool-panoramic-layout">
            <div class="tool-panoramic-main">
              <div class="capo-input-grid">
                <div class="capo-selector-box">
                  <label class="metro-param-label">1. ¿En qué tono quieres que suene? (Tono Real)</label>
                  <div class="dict-pill-grid">
                    ${targetKeys.map(k => `
                      <button class="dict-pill-btn ${this.targetKey === k ? 'active' : ''}" data-type="targetKey" data-val="${k}">${k}</button>
                    `).join('')}
                  </div>
                </div>

                <div class="capo-selector-box">
                  <label class="metro-param-label">2. ¿Con qué digitaciones quieres tocar? (Forma)</label>
                  <div class="dict-pill-grid">
                    ${openShapes.map(s => `
                      <button class="dict-pill-btn ${this.openShape === s ? 'active' : ''}" data-type="openShape" data-val="${s}">${s}</button>
                    `).join('')}
                  </div>
                </div>
              </div>

              <div class="capo-result-card">
                <span class="capo-result-badge">POSICIÓN EXACTA RECOMENDADA</span>
                <span class="capo-result-fret-big" id="capoResultFretDisplay">${fret === 0 ? 'Sin cejilla (Traste 0)' : `Traste ${fret}`}</span>
                <p class="capo-result-desc" id="capoResultDescription">
                  Coloca la cejilla en el traste ${fret} y toca posiciones de [${this.openShape}]. Sonará en tono de [${this.targetKey}].
                </p>
              </div>
            </div>

            <div class="tool-panoramic-side">
              <div class="capo-table-wrapper" id="capoTranspositionTable">
                ${this.getTranspositionTable(this.targetKey, this.openShape, fret)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

export default CapoCalculatorTool;
