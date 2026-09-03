/**
 * @file ChordPopoverModal.js
 * @description Modal Popover interactivo flotante para acordes en letras.
 * Permite cambiar de instrumento (Guitarra, Piano, Ukelele), ver el diagrama SVG, escuchar el sonido acústico y cerrar con [X].
 */

import { chordEngine } from '../../tools/ChordEngine.js';
import { ChordProParser } from './ChordProParser.js';
import { toast } from '../Toast.js';
import { events } from '../../core/EventBus.js';

events.on('ui:closeAllOverlays', () => {
  const existing = document.getElementById('chordPopoverCard');
  if (existing) existing.remove();
});

export class ChordPopoverModal {
  constructor(options = {}) {
    this.currentChord = null;
    this.currentInstrument = options.instrument || 'guitar';
    this.notationSystem = options.notation || 'anglo';
    this.selectedVoicingIndex = 0;
    this.container = options.container || document.body;
    this.onClose = options.onClose || (() => {});
  }

  show(chordName, triggerEl, instrument = this.currentInstrument, notation = this.notationSystem) {
    this.currentChord = chordName;
    this.currentInstrument = instrument;
    this.notationSystem = notation;
    this.selectedVoicingIndex = 0;

    this.close();

    const formattedName = ChordProParser.formatChordDisplay(chordName, this.notationSystem);
    this.formattedName = formattedName;
    const svgDiagram = chordEngine.renderChordSVG(chordName, { 
      instrument: this.currentInstrument,
      voicingIndex: this.selectedVoicingIndex,
      displayName: this.formattedName
    });

    const popoverEl = document.createElement('div');
    popoverEl.id = 'chordPopoverCard';
    popoverEl.className = 'chord-popover-card active';
    popoverEl.setAttribute('role', 'dialog');
    popoverEl.setAttribute('aria-modal', 'true');
    popoverEl.setAttribute('aria-label', `Diagrama del acorde ${formattedName}`);

    popoverEl.innerHTML = `
      <div class="chord-popover-header">
        <div class="chord-popover-title-group">
          <span class="chord-popover-badge">DICCIONARIO DE VOICINGS</span>
          <h3 class="chord-popover-name">${formattedName}</h3>
        </div>
        <button class="btn-popover-x-close btn-popover-close" id="btnPopoverXClose" aria-label="Cerrar ventana" type="button">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <div class="popover-inst-tabs chord-popover-inst-tabs" role="tablist">
        <button class="btn-popover-inst ${this.currentInstrument === 'guitar' ? 'active' : ''}" data-popinst="guitar" type="button">
          <span class="inst-tab-icon">🎸</span>
          <span>Guitarra</span>
        </button>
        <button class="btn-popover-inst ${this.currentInstrument === 'piano' ? 'active' : ''}" data-popinst="piano" type="button">
          <span class="inst-tab-icon">🎹</span>
          <span>Piano</span>
        </button>
        <button class="btn-popover-inst ${this.currentInstrument === 'ukulele' ? 'active' : ''}" data-popinst="ukulele" type="button">
          <span class="inst-tab-icon">🏝️</span>
          <span>Ukelele</span>
        </button>
      </div>

      <div class="chord-popover-diagram" id="popoverDiagramBox">
        ${svgDiagram}
      </div>

      <div class="chord-popover-interactive-hint">
        <span>👆 Toca cualquier cuerda para escuchar su nota aislada</span>
      </div>

      <div class="chord-popover-voicings-section chord-popover-voicings" id="popoverVoicingsContainer">
        <!-- Renderizado dinámico de posiciones del mástil / inversiones -->
      </div>

      <div class="chord-popover-footer">
        <button class="btn-popover-audition" id="btnAuditionPopoverChord" type="button">
          <span class="popover-audio-icon">🔊</span>
          <span class="popover-audio-text">Escuchar Sonido Real</span>
        </button>
      </div>
    `;

    document.body.appendChild(popoverEl);

    // Renderizar la lista de posiciones / voicings para el instrumento actual
    this._renderVoicingsList(popoverEl);

    // Eventos
    popoverEl.querySelector('#btnPopoverXClose')?.addEventListener('click', () => {
      this.close();
    });

    popoverEl.querySelector('#btnAuditionPopoverChord')?.addEventListener('click', () => {
      chordEngine.auditionChord(this.currentChord, this.currentInstrument, this.selectedVoicingIndex);
      toast.show(`Sonando ${formattedName}`, 'info', 600);
    });

    popoverEl.querySelectorAll('.btn-popover-inst').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentInstrument = btn.dataset.popinst;
        this.selectedVoicingIndex = 0;
        popoverEl.querySelectorAll('.btn-popover-inst').forEach(b => b.classList.toggle('active', b === btn));
        
        const newSvg = chordEngine.renderChordSVG(this.currentChord, { 
          instrument: this.currentInstrument,
          voicingIndex: 0,
          displayName: this.formattedName
        });
        const box = popoverEl.querySelector('#popoverDiagramBox');
        if (box) box.innerHTML = newSvg;

        // Actualizar la lista de voicings / posiciones para el nuevo instrumento
        this._renderVoicingsList(popoverEl);

        // Habilitar pulsación interactiva cuerda a cuerda
        this._bindStringPlucking(popoverEl);

        // Audicionar el cambio
        chordEngine.auditionChord(this.currentChord, this.currentInstrument, 0);
      });
    });

    // Habilitar pulsación interactiva cuerda a cuerda al abrir
    this._bindStringPlucking(popoverEl);

    // Auto-audition al abrir
    chordEngine.auditionChord(this.currentChord, this.currentInstrument, this.selectedVoicingIndex);
  }

  _bindStringPlucking(popoverEl) {
    const box = popoverEl.querySelector('#popoverDiagramBox');
    if (!box) return;

    box.querySelectorAll('.chord-interactive-string').forEach(stringEl => {
      stringEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const s = parseInt(stringEl.dataset.stringIdx, 10);
        const res = chordEngine.pluckString(s, this.currentChord, this.currentInstrument, this.selectedVoicingIndex);

        // Feedback visual de vibración de la cuerda pulsada
        const line = stringEl.querySelector('.chord-string-line');
        if (line) {
          line.setAttribute('stroke', '#00e5ff');
          line.setAttribute('stroke-width', '3');
          setTimeout(() => {
            line.setAttribute('stroke', 'var(--chord-string-color, rgba(255, 255, 255, 0.85))');
            line.setAttribute('stroke-width', '1.6');
          }, 220);
        }

        if (res && res.muted) {
          toast.show(`Cuerda ${s + 1}: Muteada (✕)`, 'info', 600);
        } else if (res && res.freq) {
          const preference = ChordProParser.getAccidentalPreference();
          const names = preference === 'flats'
            ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
            : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          const midi = Math.round(69 + 12 * Math.log2(res.freq / 440));
          const rawNote = names[midi % 12];
          const oct = Math.floor(midi / 12) - 1;
          const displayNote = ChordProParser.formatChordDisplay(rawNote, this.notationSystem);
          toast.show(`Cuerda ${s + 1} (${res.fret === 0 ? 'Al aire' : `Traste ${res.fret}`}): ${displayNote}${oct} · ${Math.round(res.freq)} Hz`, 'info', 700);
        }
      });
    });
  }

  _renderVoicingsList(popoverEl) {
    const container = popoverEl.querySelector('#popoverVoicingsContainer');
    if (!container) return;
    const voicings = chordEngine.getVoicings(this.currentChord, this.currentInstrument);
    const isPiano = this.currentInstrument === 'piano';
    const currentVoicing = voicings[this.selectedVoicingIndex] || voicings[0];
    const currentName = currentVoicing?.name || (isPiano ? 'Posición Fundamental' : 'Posición 1');

    container.innerHTML = `
      <div class="voicings-accordion-wrap">
        <button class="voicings-fold-toggle btn-toggle-voicings-fold" id="btnToggleVoicingsFold" type="button" aria-expanded="false" title="Desplegar otras posiciones">
          <div class="voicings-fold-left">
            <span class="voicings-title-icon">${isPiano ? '🎹' : '📍'}</span>
            <span class="voicings-section-title">${isPiano ? 'Inversiones de Teclado' : 'Posiciones en el Mástil'}</span>
            <span class="voicings-current-pill" id="voicingsCurrentPill">${currentName}</span>
          </div>
          <div class="voicings-fold-right">
            <span class="voicings-more-text">Más opciones</span>
            <span class="voicings-chevron" id="voicingsFoldChevron">▾</span>
          </div>
        </button>
        <div class="voicings-collapsible-drawer is-folded" id="voicingsCollapsibleDrawer">
          <div class="voicings-cards-list voicings-scroll">
            ${voicings.map((v, i) => `
              <button class="btn-voicing-card btn-voicing ${this.selectedVoicingIndex === i ? 'active' : ''}" data-voicing="${i}" type="button">
                <div class="voicing-card-left">
                  <span class="voicing-number-badge">${i + 1}</span>
                  <div class="voicing-text-group">
                    <span class="voicing-name">${v.name || `Posición ${i + 1}`}</span>
                    <span class="voicing-detail">${v.detail || (v.baseFret ? `Traste ${v.baseFret}` : 'Posición estándar')}</span>
                  </div>
                </div>
                <span class="voicing-active-check">✓</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Toggle para plegar / desplegar
    const btnFoldToggle = container.querySelector('#btnToggleVoicingsFold');
    const drawer = container.querySelector('#voicingsCollapsibleDrawer');
    const chevron = container.querySelector('#voicingsFoldChevron');
    const moreText = container.querySelector('.voicings-more-text');

    btnFoldToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isFolded = drawer.classList.contains('is-folded');
      drawer.classList.toggle('is-folded', !isFolded);
      btnFoldToggle.setAttribute('aria-expanded', isFolded ? 'true' : 'false');
      if (chevron) chevron.style.transform = isFolded ? 'rotate(180deg)' : 'rotate(0deg)';
      if (moreText) moreText.textContent = isFolded ? 'Plegar' : 'Más opciones';
    });

    // Eventos de los botones de voicings
    container.querySelectorAll('.btn-voicing').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedVoicingIndex = parseInt(btn.dataset.voicing, 10) || 0;
        container.querySelectorAll('.btn-voicing').forEach(b => {
          b.classList.toggle('active', b === btn);
        });

        // Actualizar la píldora informativa del encabezado
        const pill = container.querySelector('#voicingsCurrentPill');
        if (pill && voicings[this.selectedVoicingIndex]) {
          pill.textContent = voicings[this.selectedVoicingIndex].name;
        }

        const box = popoverEl.querySelector('#popoverDiagramBox');
        if (box) {
          box.style.opacity = '0.3';
          setTimeout(() => {
            const newSvg = chordEngine.renderChordSVG(this.currentChord, { 
              instrument: this.currentInstrument, 
              voicingIndex: this.selectedVoicingIndex,
              displayName: this.formattedName
            });
            box.innerHTML = newSvg;
            box.style.opacity = '1';
            this._bindStringPlucking(popoverEl);
            chordEngine.auditionChord(this.currentChord, this.currentInstrument, this.selectedVoicingIndex);
            
            const activeV = voicings[this.selectedVoicingIndex];
            if (activeV) {
              toast.show(`${activeV.name} (${activeV.detail})`, 'info', 700);
            }
          }, 80);
        }
      });
    });
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
