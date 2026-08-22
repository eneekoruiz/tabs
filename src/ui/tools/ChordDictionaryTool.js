/**
 * @file ChordDictionaryTool.js
 * @description Diccionario de Acordes con Voicings, audio arpegiado y selector de tensiones.
 */

import { chordEngine } from '../../tools/ChordEngine.js';
import { toast } from '../Toast.js';

export class ChordDictionaryTool {
  constructor() {
    this.root = 'C';
    this.quality = 'maj7';
    this.instrument = 'guitar';
  }

  renderModal() {
    const roots = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const qualities = [
      { id: 'maj', label: 'Mayor (M)' },
      { id: 'min', label: 'Menor (m)' },
      { id: '7', label: 'Dominante (7)' },
      { id: 'maj7', label: 'Mayor 7 (maj7)' },
      { id: 'm7', label: 'Menor 7 (m7)' },
      { id: 'sus4', label: 'Suspendido (sus4)' },
      { id: 'dim', label: 'Disminuido (dim)' },
      { id: 'add9', label: 'Añadida 9 (add9)' }
    ];

    const chordName = `${this.root}${this.quality === 'maj' ? '' : (this.quality === 'min' ? 'm' : this.quality)}`;
    const svgDiagram = chordEngine.renderChordSVG(chordName, { instrument: this.instrument });

    return `
      <div class="tool-modal-overlay active" id="toolModalOverlay">
        <div class="tool-modal-dialog">
          <div class="tool-modal-header">
            <div class="tool-modal-title">
              <span class="tool-modal-icon">📚</span>
              <div>
                <span class="tool-badge-studio">ARMONÍA & DICCIONARIO</span>
                <h2>Diccionario Visual de Acordes</h2>
              </div>
            </div>
            <button class="btn-close-tool-modal" id="btnCloseToolModal">✕</button>
          </div>

          <div class="tool-panoramic-layout">
            <div class="tool-panoramic-main">
              <div class="dict-control-panel">
                <div class="dict-inst-selector">
                  <button class="dict-inst-btn ${this.instrument === 'guitar' ? 'active' : ''}" data-inst="guitar">🎸 Guitarra</button>
                  <button class="dict-inst-btn ${this.instrument === 'piano' ? 'active' : ''}" data-inst="piano">🎹 Piano</button>
                  <button class="dict-inst-btn ${this.instrument === 'ukulele' ? 'active' : ''}" data-inst="ukulele">🏝️ Ukelele</button>
                </div>

                <div class="dict-group">
                  <label class="metro-param-label">Tónica / Fundamental</label>
                  <div class="dict-pill-grid">
                    ${roots.map(r => `
                      <button class="dict-pill-btn ${this.root === r ? 'active' : ''}" data-type="root" data-val="${r}">${r}</button>
                    `).join('')}
                  </div>
                </div>

                <div class="dict-group">
                  <label class="metro-param-label">Tipo de Acorde / Tensión</label>
                  <div class="dict-pill-grid">
                    ${qualities.map(q => `
                      <button class="dict-pill-btn ${this.quality === q.id ? 'active' : ''}" data-type="quality" data-val="${q.id}">${q.label}</button>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>

            <div class="tool-panoramic-side">
              <div class="dict-preview-card">
                <div class="dict-preview-header">
                  <span class="dict-chord-title-big">${chordName}</span>
                  <button class="btn-dict-audition" id="btnDictAudition" data-chord="${chordName}">
                    <span>🔊 Escuchar Acorde</span>
                  </button>
                </div>

                <div class="dict-svg-viewport">
                  ${svgDiagram}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

export default ChordDictionaryTool;
