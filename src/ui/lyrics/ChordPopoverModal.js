/**
 * @file ChordPopoverModal.js
 * @description Modal Popover interactivo flotante para acordes en letras.
 * Permite cambiar de instrumento (Guitarra, Piano, Ukelele), ver el diagrama SVG, escuchar el sonido acústico y cerrar con [X].
 */

import { chordEngine } from '../../tools/ChordEngine.js';
import { ChordProParser } from './ChordProParser.js';
import { toast } from '../Toast.js';

export class ChordPopoverModal {
  constructor(options = {}) {
    this.currentChord = null;
    this.currentInstrument = options.instrument || 'guitar';
    this.notationSystem = options.notation || 'anglo';
    this.container = options.container || document.body;
    this.onClose = options.onClose || (() => {});
  }

  show(chordName, triggerEl, instrument = this.currentInstrument, notation = this.notationSystem) {
    this.currentChord = chordName;
    this.currentInstrument = instrument;
    this.notationSystem = notation;

    this.close();

    const formattedName = ChordProParser.formatChordDisplay(chordName, this.notationSystem);
    const svgDiagram = chordEngine.renderChordSVG(chordName, { instrument: this.currentInstrument });

    const popoverEl = document.createElement('div');
    popoverEl.id = 'chordPopoverCard';
    popoverEl.className = 'chord-popover-card active';
    popoverEl.setAttribute('role', 'dialog');
    popoverEl.setAttribute('aria-modal', 'true');
    popoverEl.setAttribute('aria-label', `Diagrama del acorde ${formattedName}`);

    popoverEl.innerHTML = `
      <div class="chord-popover-header">
        <div class="chord-popover-title-group">
          <span class="chord-popover-badge">DIAGRAMA DEL ACORDE</span>
          <h3 class="chord-popover-name">${formattedName}</h3>
        </div>
        <button class="btn-popover-close" id="btnPopoverXClose" aria-label="Cerrar ventana">✕</button>
      </div>

      <div class="chord-popover-inst-tabs">
        <button class="btn-popover-inst ${this.currentInstrument === 'guitar' ? 'active' : ''}" data-popinst="guitar">Guitarra</button>
        <button class="btn-popover-inst ${this.currentInstrument === 'piano' ? 'active' : ''}" data-popinst="piano">Piano</button>
        <button class="btn-popover-inst ${this.currentInstrument === 'ukulele' ? 'active' : ''}" data-popinst="ukulele">Ukelele</button>
      </div>

      <div class="chord-popover-diagram" id="popoverDiagramBox">
        ${svgDiagram}
      </div>

      <div class="chord-popover-footer">
        <button class="btn-popover-audition" id="btnAuditionPopoverChord">
          <span class="popover-audio-icon">🔊</span>
          <span>Escuchar Acorde</span>
        </button>
      </div>
    `;

    document.body.appendChild(popoverEl);

    // Eventos
    popoverEl.querySelector('#btnPopoverXClose')?.addEventListener('click', () => {
      this.close();
    });

    popoverEl.querySelector('#btnAuditionPopoverChord')?.addEventListener('click', () => {
      chordEngine.auditionChord(this.currentChord, this.currentInstrument);
      toast.show(`Sonando ${formattedName}`, 'info', 600);
    });

    popoverEl.querySelectorAll('.btn-popover-inst').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentInstrument = btn.dataset.popinst;
        popoverEl.querySelectorAll('.btn-popover-inst').forEach(b => b.classList.toggle('active', b === btn));
        const newSvg = chordEngine.renderChordSVG(this.currentChord, { instrument: this.currentInstrument });
        const box = popoverEl.querySelector('#popoverDiagramBox');
        if (box) box.innerHTML = newSvg;
      });
    });

    // Auto-audition al abrir
    chordEngine.auditionChord(this.currentChord, this.currentInstrument);
  }

  close() {
    const existing = document.getElementById('chordPopoverCard');
    if (existing) {
      existing.remove();
      this.onClose();
    }
  }
}

export default ChordPopoverModal;
