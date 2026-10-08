/**
 * @file ExportModal.js
 * @description Modal flotante para exportación profesional grado publicación (PDF, MIDI, MusicXML).
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { exporter } from '../data/Exporter.js';

export class ExportModal extends Component {
  constructor(container) {
    super(container);
    this.isOpen = false;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('ui:toggleExportModal', () => {
        this.toggle();
      })
    );

    this.registerUnsub(
      events.on('ui:closeAllOverlays', () => {
        if (this.isOpen) this.toggle();
      })
    );
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.container) {
      this.container.classList.toggle('modal-open', this.isOpen);
      if (this.isOpen) {
        this.render();
      } else {
        this.container.innerHTML = '';
      }
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="modal-backdrop" id="exportModalBackdrop">
        <div class="modal-card export-modal-card" role="dialog" aria-label="Exportar partitura">
          <div class="modal-header">
            <div class="modal-title-group">
              <span class="modal-icon" aria-hidden="true">📤</span>
              <h2>Exportar partitura</h2>
            </div>
            <button class="btn-close-modal" id="btnCloseExportModal" aria-label="Cerrar ventana de exportación">✖</button>
          </div>

          <div class="export-modal-body">
            <!-- Opción PDF -->
            <button class="export-option-card" id="btnExportOptionPdf" aria-label="Exportar o imprimir partitura en PDF">
              <div class="export-option-icon" aria-hidden="true">📄</div>
              <div class="export-option-info">
                <span class="export-option-title">Imprimir o guardar PDF</span>
                <span class="export-option-desc">Abre la impresión del navegador; selecciona guardar como PDF si está disponible.</span>
              </div>
              <span class="export-badge">PDF</span>
            </button>

            <!-- Opción MIDI -->
            <button class="export-option-card" id="btnExportOptionMidi" aria-label="Exportar archivo MIDI estándar">
              <div class="export-option-icon" aria-hidden="true">🎹</div>
              <div class="export-option-info">
                <span class="export-option-title">Archivo MIDI Estándar (.mid)</span>
                <span class="export-option-desc">Exporta las pistas y notas para abrirlas en Logic Pro, Ableton Live, FL Studio o Reaper.</span>
              </div>
              <span class="export-badge">MIDI</span>
            </button>

            <!-- Opción MusicXML -->
            <button class="export-option-card" id="btnExportOptionXml" disabled aria-label="Exportación MusicXML no disponible">
              <div class="export-option-icon" aria-hidden="true">🎼</div>
              <div class="export-option-info">
                <span class="export-option-title">Formato MusicXML (.xml)</span>
                <span class="export-option-desc">La exportación MusicXML todavía no está disponible.</span>
              </div>
              <span class="export-badge">XML</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btnCloseExportModal')?.addEventListener('click', () => {
      this.toggle();
    });

    this.container.querySelector('#exportModalBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'exportModalBackdrop') this.toggle();
    });

    this.container.querySelector('#btnExportOptionPdf')?.addEventListener('click', () => {
      this.toggle();
      exporter.exportPDF();
    });

    this.container.querySelector('#btnExportOptionMidi')?.addEventListener('click', () => {
      this.toggle();
      exporter.exportMIDI();
    });

    this.container.querySelector('#btnExportOptionXml')?.addEventListener('click', () => {
      this.toggle();
      exporter.exportMusicXML();
    });
  }
}

export default ExportModal;
