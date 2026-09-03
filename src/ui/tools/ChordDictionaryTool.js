/**
 * @file ChordDictionaryTool.js
 * @description Diccionario de Acordes con Voicings, audio arpegiado y selector de tensiones.
 */

import { chordEngine } from '../../tools/ChordEngine.js';
import { ChordProParser } from '../lyrics/ChordProParser.js';
import { toast } from '../Toast.js';

export class ChordDictionaryTool {
  constructor() {
    this.root = 'C';
    this.quality = 'maj7';
    this.instrument = 'guitar';
  }

  renderModal() {
    const pref = ChordProParser.getAccidentalPreference();
    const roots = pref === 'flats'
      ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
      : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    this.root = ChordProParser.spellAccidentals(this.root, pref);

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
    const svgDiagram = chordEngine.renderChordSVG(chordName, { instrument: this.instrument, displayName: chordName });

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
                  <div class="dict-group-header-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <label class="metro-param-label" style="margin: 0;">Tónica / Fundamental</label>
                    <div class="accidental-segmented-control" style="display: inline-flex; background: rgba(255,255,255,0.06); border-radius: 8px; padding: 2px; border: 1px solid var(--border-subtle, rgba(255,255,255,0.12));">
                      <button class="btn-dict-accidental ${pref === 'sharps' ? 'active' : ''}" data-accidental="sharps" type="button" style="padding: 2px 8px; font-size: 11px; font-weight: 700; border: none; border-radius: 6px; cursor: pointer; background: ${pref === 'sharps' ? 'var(--accent-primary, #ff5722)' : 'transparent'}; color: #fff;">♯ Sostenidos</button>
                      <button class="btn-dict-accidental ${pref === 'flats' ? 'active' : ''}" data-accidental="flats" type="button" style="padding: 2px 8px; font-size: 11px; font-weight: 700; border: none; border-radius: 6px; cursor: pointer; background: ${pref === 'flats' ? 'var(--accent-primary, #ff5722)' : 'transparent'}; color: #fff;">♭ Bemoles</button>
                    </div>
                  </div>
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
