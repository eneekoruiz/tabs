/**
 * @file ChordModal.js
 * @description Modal interactivo de Diccionario de Acordes con vista previa de sonido y soporte para zurdos.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { chordEngine } from '../tools/ChordEngine.js';

export class ChordModal extends Component {
  constructor(container) {
    super(container);
    this.isOpen = false;
    this.selectedRoot = 'C';
    this.selectedType = '';
    this.isLeftHanded = false;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('ui:toggleChordModal', (chordName) => {
        if (chordName) {
          const match = chordName.match(/^([A-G][#b]?)(.*)$/);
          if (match) {
            this.selectedRoot = match[1];
            this.selectedType = match[2];
          }
        }
        this.toggle();
      })
    );

    this.registerUnsub(
      events.on('ui:closeAllOverlays', () => {
        if (this.isOpen) this.toggle();
      })
    );

    this.registerUnsub(
      events.on('chord:leftHandedToggled', (isLH) => {
        this.isLeftHanded = isLH;
        if (this.isOpen) this.render();
      })
    );
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.container) {
      this.container.classList.toggle('modal-open', this.isOpen);
      if (this.isOpen) {
        this.render();
      }
    }
  }

  getCurrentChordName() {
    return `${this.selectedRoot}${this.selectedType}`;
  }

  render() {
    if (!this.container) return;

    const chordName = this.getCurrentChordName();
    const roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const types = [
      { label: 'Mayor', val: '' },
      { label: 'Menor (m)', val: 'm' },
      { label: 'Séptima (7)', val: '7' },
      { label: 'Maj7', val: 'maj7' },
      { label: 'Sus4', val: 'sus4' },
      { label: 'Add9', val: 'add9' },
    ];

    const chordSVG = chordEngine.renderChordSVG(chordName, { isLeftHanded: this.isLeftHanded });

    this.container.innerHTML = `
      <div class="modal-backdrop" id="chordModalBackdrop">
        <div class="modal-card chord-modal-card" role="dialog" aria-label="Diccionario de acordes">
          <!-- Cabecera -->
          <div class="modal-header">
            <div class="modal-title-group">
              <span class="modal-icon" aria-hidden="true">📖</span>
              <h2>Diccionario de Acordes</h2>
            </div>
            <button class="btn-close-modal" id="btnCloseChordModal" aria-label="Cerrar diccionario">✖</button>
          </div>

          <!-- Selector de Raíz y Tipo -->
          <div class="chord-selector-section">
            <div class="chord-roots-grid" role="group" aria-label="Nota raíz">
              ${roots.map(r => `
                <button class="btn-root ${this.selectedRoot === r ? 'active' : ''}" data-root="${r}" aria-pressed="${this.selectedRoot === r}">
                  ${r}
                </button>
              `).join('')}
            </div>

            <div class="chord-types-row" role="group" aria-label="Tipo de acorde">
              ${types.map(t => `
                <button class="btn-type ${this.selectedType === t.val ? 'active' : ''}" data-type="${t.val}" aria-pressed="${this.selectedType === t.val}">
                  ${t.label}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Visualizador del Diagrama SVG -->
          <div class="chord-diagram-preview" id="chordDiagramContainer">
            ${chordSVG}
          </div>

          <!-- Acciones y Modo Zurdos -->
          <div class="chord-modal-footer">
            <button id="btnAuditionChord" class="btn btn-primary btn-audition" aria-label="Escuchar rasgueo del acorde">
              <span aria-hidden="true">🔊</span> Escuchar Acorde
            </button>

            <label class="lh-toggle-label" title="Invertir diagramas para zurdos">
              <input type="checkbox" id="chkLeftHanded" ${this.isLeftHanded ? 'checked' : ''} aria-label="Modo zurdos">
              <span>🖐️ Modo Zurdos</span>
            </label>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btnCloseChordModal')?.addEventListener('click', () => {
      this.toggle();
    });

    this.container.querySelector('#chordModalBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'chordModalBackdrop') {
        this.toggle();
      }
    });

    // Selección de Raíz
    this.container.querySelectorAll('.btn-root').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectedRoot = e.target.dataset.root;
        this.render();
      });
    });

    // Selección de Tipo
    this.container.querySelectorAll('.btn-type').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectedType = e.target.dataset.type;
        this.render();
      });
    });

    // Escuchar Acorde
    this.container.querySelector('#btnAuditionChord')?.addEventListener('click', () => {
      chordEngine.auditionChord(this.getCurrentChordName());
    });

    // Modo Zurdos
    this.container.querySelector('#chkLeftHanded')?.addEventListener('change', (e) => {
      chordEngine.setLeftHanded(e.target.checked);
    });
  }
}

export default ChordModal;
