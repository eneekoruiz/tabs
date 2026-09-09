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
    this._scrollHandler = null;
    this._clickOutsideHandler = null;
    this._keydownHandler = null;
    this.popoverEl = null;
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
    this.popoverEl = popoverEl;

    popoverEl.innerHTML = `
      <div class="chord-popover-header">
        <div class="chord-popover-title-group">
          <span class="chord-popover-badge">DICCIONARIO DE VOICINGS</span>
          <h3 class="chord-popover-name">${formattedName}</h3>
        </div>
        <button class="btn-popover-x-close btn-popover-close" id="btnPopoverXClose" aria-label="Cerrar ventana (Esc)" title="Cerrar ventana (Esc)" type="button">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <div class="popover-inst-tabs chord-popover-inst-tabs" role="tablist">
        <button class="btn-popover-inst ${this.currentInstrument === 'guitar' ? 'active' : ''}" data-popinst="guitar" type="button" title="Guitarra (Tecla G)">
          <span class="inst-tab-icon">🎸</span>
          <span>Guitarra</span>
        </button>
        <button class="btn-popover-inst ${this.currentInstrument === 'piano' ? 'active' : ''}" data-popinst="piano" type="button" title="Piano (Tecla P)">
          <span class="inst-tab-icon">🎹</span>
          <span>Piano</span>
        </button>
        <button class="btn-popover-inst ${this.currentInstrument === 'ukulele' ? 'active' : ''}" data-popinst="ukulele" type="button" title="Ukelele (Tecla U)">
          <span class="inst-tab-icon">🏝️</span>
          <span>Ukelele</span>
        </button>
      </div>

      <div class="chord-popover-diagram" id="popoverDiagramBox">
        ${svgDiagram}
      </div>

      <!-- Stepper rápido de posiciones / inversiones -->
      <div class="popover-voicing-stepper" id="popoverVoicingStepper">
        <button class="btn-voicing-step btn-voicing-prev" id="btnVoicingPrev" type="button" aria-label="Posición anterior" title="Posición anterior (←)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="voicing-stepper-info">
          <span class="voicing-stepper-title" id="voicingStepperTitle">Posición 1</span>
          <span class="voicing-stepper-sub" id="voicingStepperSub">Posición fundamental</span>
        </div>
        <button class="btn-voicing-step btn-voicing-next" id="btnVoicingNext" type="button" aria-label="Siguiente posición" title="Siguiente posición (→)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <div class="chord-popover-interactive-hint">
        <span>${this.currentInstrument === 'piano' ? '👆 Toca cualquier tecla para escuchar su nota aislada' : '👆 Toca cualquier cuerda para escuchar su nota aislada'}</span>
      </div>

      <div class="chord-popover-voicings-section chord-popover-voicings" id="popoverVoicingsContainer">
        <!-- Renderizado dinámico de posiciones del mástil / inversiones -->
      </div>

      <div class="chord-popover-footer">
        <button class="btn-popover-audio btn-popover-audition btn-popover-strum" id="btnAuditionPopoverChord" type="button" title="Rasguear acorde completo (Espacio)">
          <span class="popover-audio-icon">🔊</span>
          <span class="popover-audio-text">Rasguear</span>
        </button>
        <button class="btn-popover-audio btn-popover-arpeggio" id="btnArpeggiatePopoverChord" type="button" title="Arpegiar nota a nota con notas iluminadas (Tecla A)">
          <span class="popover-audio-icon">🎶</span>
          <span class="popover-audio-text">Arpegiar</span>
        </button>
      </div>
    `;

    document.body.appendChild(popoverEl);

    // Renderizar la lista de posiciones / voicings para el instrumento actual
    this._renderVoicingsList(popoverEl);
    this._updateVoicingDisplay(popoverEl, false);

    // Eventos de cierre y audio
    popoverEl.querySelector('#btnPopoverXClose')?.addEventListener('click', () => {
      this.close();
    });

    popoverEl.querySelector('#btnAuditionPopoverChord')?.addEventListener('click', () => {
      this.audition();
    });

    popoverEl.querySelector('#btnArpeggiatePopoverChord')?.addEventListener('click', () => {
      this.arpeggiate();
    });

    // Eventos de stepper rápido
    popoverEl.querySelector('#btnVoicingPrev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._stepVoicing(-1);
    });

    popoverEl.querySelector('#btnVoicingNext')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._stepVoicing(1);
    });

    popoverEl.querySelectorAll('.btn-popover-inst').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._switchInstrument(btn.dataset.popinst);
      });
    });

    // Habilitar pulsación interactiva cuerda a cuerda o tecla a tecla al abrir
    this._bindInteractiveElements(popoverEl);

    // Auto-cierre al hacer scroll en la letra/página
    this._attachScrollDismiss(popoverEl);

    // Auto-cierre al hacer clic fuera del modal
    this._attachClickOutside(popoverEl);

    // Atajos de teclado (Esc, flechas, barra espaciadora, tecla A, etc.)
    this._attachKeydown(popoverEl);

    // Auto-audition al abrir
    chordEngine.auditionChord(this.currentChord, this.currentInstrument, this.selectedVoicingIndex);
  }

  audition() {
    chordEngine.auditionChord(this.currentChord, this.currentInstrument, this.selectedVoicingIndex);
    toast.show(`Sonando ${this.formattedName}`, 'info', 600);
  }

  arpeggiate() {
    const arpeggioBtn = this.popoverEl?.querySelector('#btnArpeggiatePopoverChord');
    if (arpeggioBtn) arpeggioBtn.classList.add('is-arpeggiating');

    toast.show(`🎶 Arpegiando ${this.formattedName}...`, 'info', 700);

    const box = this.popoverEl?.querySelector('#popoverDiagramBox');

    chordEngine.arpeggiateChord(this.currentChord, this.currentInstrument, this.selectedVoicingIndex, (note, idx, total) => {
      if (!box) return;

      if (this.currentInstrument === 'piano') {
        const keyEl = box.querySelector(`.chord-interactive-key[data-note="${note.key}"][data-oct="${note.oct}"]`)
          || box.querySelector(`.chord-interactive-key[data-note="${note.key}"]`);
        if (keyEl) {
          const rect = keyEl.querySelector('.piano-key-rect');
          if (rect) {
            const prevFill = rect.getAttribute('fill');
            rect.setAttribute('fill', '#00e5ff');
            rect.style.filter = 'drop-shadow(0 0 12px #00e5ff)';
            setTimeout(() => {
              rect.setAttribute('fill', prevFill);
              rect.style.filter = '';
            }, 220);
          }
        }
      } else {
        const stringEl = box.querySelector(`.chord-interactive-string[data-string-idx="${note.stringIndex}"]`);
        if (stringEl) {
          const line = stringEl.querySelector('.chord-string-line');
          if (line) {
            line.setAttribute('stroke', '#00e5ff');
            line.setAttribute('stroke-width', '3.5');
            line.style.filter = 'drop-shadow(0 0 6px #00e5ff)';
            setTimeout(() => {
              line.setAttribute('stroke', 'var(--chord-string-color, rgba(255, 255, 255, 0.85))');
              line.setAttribute('stroke-width', '1.6');
              line.style.filter = '';
            }, 220);
          }
        }
      }

      if (idx === total - 1 && arpeggioBtn) {
        setTimeout(() => {
          arpeggioBtn.classList.remove('is-arpeggiating');
        }, 350);
      }
    });
  }

  _switchInstrument(inst) {
    if (!this.popoverEl || this.currentInstrument === inst) return;
    this.currentInstrument = inst;
    this.selectedVoicingIndex = 0;
    this.popoverEl.querySelectorAll('.btn-popover-inst').forEach(b => b.classList.toggle('active', b.dataset.popinst === inst));

    const newSvg = chordEngine.renderChordSVG(this.currentChord, {
      instrument: this.currentInstrument,
      voicingIndex: 0,
      displayName: this.formattedName
    });
    const box = this.popoverEl.querySelector('#popoverDiagramBox');
    if (box) box.innerHTML = newSvg;

    const hintSpan = this.popoverEl.querySelector('.chord-popover-interactive-hint span');
    if (hintSpan) {
      hintSpan.textContent = this.currentInstrument === 'piano'
        ? '👆 Toca cualquier tecla para escuchar su nota aislada'
        : '👆 Toca cualquier cuerda para escuchar su nota aislada';
    }

    this._renderVoicingsList(this.popoverEl);
    this._updateVoicingDisplay(this.popoverEl, false);
    this._bindInteractiveElements(this.popoverEl);
    chordEngine.auditionChord(this.currentChord, this.currentInstrument, 0);
  }

  _stepVoicing(delta) {
    if (!this.popoverEl) return;
    const voicings = chordEngine.getVoicings(this.currentChord, this.currentInstrument);
    if (!voicings || voicings.length <= 1) return;

    this.selectedVoicingIndex = (this.selectedVoicingIndex + delta + voicings.length) % voicings.length;
    this._updateVoicingDisplay(this.popoverEl, true);
    chordEngine.auditionChord(this.currentChord, this.currentInstrument, this.selectedVoicingIndex);

    const activeV = voicings[this.selectedVoicingIndex];
    if (activeV) {
      toast.show(`${activeV.name} (${activeV.detail || ''})`, 'info', 700);
    }
  }

  _updateVoicingDisplay(popoverEl, updateSvg = true) {
    if (!popoverEl) return;
    const voicings = chordEngine.getVoicings(this.currentChord, this.currentInstrument);
    const curr = voicings[this.selectedVoicingIndex] || voicings[0] || { name: 'Posición Fundamental', detail: '' };

    // Actualizar stepper
    const titleEl = popoverEl.querySelector('#voicingStepperTitle');
    const subEl = popoverEl.querySelector('#voicingStepperSub');
    if (titleEl) {
      titleEl.textContent = `${curr.name} (${this.selectedVoicingIndex + 1}/${voicings.length})`;
    }
    if (subEl) {
      subEl.textContent = curr.detail || (this.currentInstrument === 'piano' ? 'Inversión armónica' : 'Posición mástil');
    }

    // Actualizar pill en acordeón
    const pill = popoverEl.querySelector('#voicingsCurrentPill');
    if (pill) pill.textContent = curr.name;

    // Actualizar clase activa en la lista del acordeón
    popoverEl.querySelectorAll('.btn-voicing').forEach(btn => {
      const idx = parseInt(btn.dataset.voicing, 10);
      btn.classList.toggle('active', idx === this.selectedVoicingIndex);
    });

    if (updateSvg) {
      const box = popoverEl.querySelector('#popoverDiagramBox');
      if (box) {
        box.style.opacity = '0.35';
        setTimeout(() => {
          const newSvg = chordEngine.renderChordSVG(this.currentChord, {
            instrument: this.currentInstrument,
            voicingIndex: this.selectedVoicingIndex,
            displayName: this.formattedName
          });
          box.innerHTML = newSvg;
          box.style.opacity = '1';
          this._bindInteractiveElements(popoverEl);
        }, 60);
      }
    }
  }

  _bindInteractiveElements(popoverEl) {
    const box = popoverEl.querySelector('#popoverDiagramBox');
    if (!box) return;

    // Cuerdas de guitarra / ukelele
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

    // Teclas de piano interactivas (pulsación aislada)
    box.querySelectorAll('.chord-interactive-key').forEach(keyEl => {
      keyEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const note = keyEl.dataset.note;
        const oct = parseInt(keyEl.dataset.oct, 10) || 4;
        const res = chordEngine.playPianoKey(note, oct);

        // Feedback visual de pulsación de la tecla
        const rect = keyEl.querySelector('.piano-key-rect');
        if (rect) {
          const prevFill = rect.getAttribute('fill');
          rect.setAttribute('fill', '#00e5ff');
          rect.style.filter = 'drop-shadow(0 0 10px #00e5ff)';
          setTimeout(() => {
            rect.setAttribute('fill', prevFill);
            rect.style.filter = '';
          }, 220);
        }

        if (res && res.freq) {
          const displayNote = ChordProParser.formatChordDisplay(res.note, this.notationSystem);
          toast.show(`Tecla ${displayNote}${res.octave} · ${Math.round(res.freq)} Hz`, 'info', 650);
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
        this._updateVoicingDisplay(popoverEl, true);
        chordEngine.auditionChord(this.currentChord, this.currentInstrument, this.selectedVoicingIndex);
        const activeV = voicings[this.selectedVoicingIndex];
        if (activeV) {
          toast.show(`${activeV.name} (${activeV.detail || ''})`, 'info', 700);
        }
      });
    });
  }

  _attachScrollDismiss(popoverEl) {
    this._detachScrollDismiss();

    const openTime = performance.now();
    this._scrollHandler = (e) => {
      // Ignorar scrolls inmediatos producidos durante el montaje (primeros 180ms)
      if (performance.now() - openTime < 180) return;

      // Si el scroll se realiza dentro del modal (p.ej. explorando la lista de inversiones), NO cerrar
      if (e.target && popoverEl && popoverEl.contains(e.target)) {
        return;
      }

      // Cerrar automáticamente al deslizar en la ventana o letra porque se sobreentiende
      // que el usuario ya miró la nota y continúa tocando/leyendo
      this.close();
    };

    window.addEventListener('scroll', this._scrollHandler, { capture: true, passive: true });
  }

  _detachScrollDismiss() {
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler, { capture: true });
      this._scrollHandler = null;
    }
  }

  _attachClickOutside(popoverEl) {
    this._detachClickOutside();
    const openTime = performance.now();
    this._clickOutsideHandler = (e) => {
      // Período de gracia inicial de 160ms para evitar que el clic de apertura cierre el modal
      if (performance.now() - openTime < 160) return;

      // Si el clic ocurrió dentro del modal o sobre un badge de acorde, ignorar
      if (e.target && (popoverEl.contains(e.target) || e.target.closest('.chord-badge, .used-chord-pill'))) {
        return;
      }

      this.close();
    };

    document.addEventListener('pointerdown', this._clickOutsideHandler, { capture: true });
  }

  _detachClickOutside() {
    if (this._clickOutsideHandler) {
      document.removeEventListener('pointerdown', this._clickOutsideHandler, { capture: true });
      this._clickOutsideHandler = null;
    }
  }

  _attachKeydown(popoverEl) {
    this._detachKeydown();
    this._keydownHandler = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        this._stepVoicing(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        this._stepVoicing(-1);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.audition();
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this.arpeggiate();
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        this._switchInstrument('guitar');
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        this._switchInstrument('piano');
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        this._switchInstrument('ukulele');
      }
    };

    window.addEventListener('keydown', this._keydownHandler);
  }

  _detachKeydown() {
    if (this._keydownHandler) {
      window.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }
  }

  close() {
    this._detachScrollDismiss();
    this._detachClickOutside();
    this._detachKeydown();
    const existing = document.getElementById('chordPopoverCard');
    if (existing) {
      existing.remove();
      this.popoverEl = null;
      this.onClose();
    }
  }
}

export default ChordPopoverModal;
