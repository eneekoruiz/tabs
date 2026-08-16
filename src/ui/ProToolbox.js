/**
 * @file ProToolbox.js
 * @description Panel flotante modal de Herramientas PRO (Arsenal PRO):
 * - Transposición Inteligente (+/- 12 semitonos)
 * - Cejilla (Capo)
 * - Simplificador de Acordes
 * - Modo Zurdos (Left-Handed)
 * - Toggle de Mástil Interactivo (On/Off)
 * - Sincronización de Audio Real (.mp3/.wav)
 * - Visualizadores Multi-Instrumento (Piano, Batería)
 * - Exportaciones de publicación (PDF, MIDI, MusicXML)
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { audioEngine } from '../core/AudioEngine.js';
import { chordEngine } from '../tools/ChordEngine.js';
import { toast } from './Toast.js';

export class ProToolbox extends Component {
  constructor(container) {
    super(container);
    this.isOpen = false;
    this.currentTranspose = 0;
    this.currentCapo = 0;
    this.isSimplified = false;
    this.isLeftHanded = false;
    this.isFretboardVisible = false;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('ui:toggleToolbox', () => {
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
        const fretboardEl = document.querySelector('.fretboard-grid');
        if (fretboardEl) {
          fretboardEl.classList.toggle('fretboard-left-handed', isLH);
        }
      })
    );
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.container) {
      this.container.classList.toggle('toolbox-open', this.isOpen);
      if (this.isOpen) this.render();
    }
  }

  setTranspose(semitones) {
    this.currentTranspose = Math.max(-12, Math.min(12, semitones));
    
    if (audioEngine.api && audioEngine.api.settings) {
      if (audioEngine.api.settings.player) {
        audioEngine.api.settings.player.transpositionPitch = this.currentTranspose;
      }
    }

    events.emit('transpose:changed', this.currentTranspose);
    state.set('activeSong', {
      transposedSemitones: this.currentTranspose,
    });

    const lbl = this.container?.querySelector('#lblTransposeVal');
    if (lbl) {
      lbl.textContent = `${this.currentTranspose > 0 ? '+' : ''}${this.currentTranspose} st`;
    }

    toast.show(`🎯 Transposición: ${this.currentTranspose > 0 ? '+' : ''}${this.currentTranspose} semitonos`, 'info', 1200);
  }

  setCapo(fret) {
    this.currentCapo = Math.max(0, Math.min(12, fret));
    
    if (audioEngine.score && audioEngine.score.tracks && audioEngine.score.tracks[0]) {
      audioEngine.score.tracks[0].capo = this.currentCapo;
      if (audioEngine.api) {
        audioEngine.api.render();
      }
    }

    events.emit('capo:changed', this.currentCapo);
    toast.show(`🎸 Cejilla (Capo) en Traste ${this.currentCapo === 0 ? 'Desactivada' : this.currentCapo}`, 'info', 1200);
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="toolbox-card" role="dialog" aria-label="Herramientas profesionales del músico">
        <div class="toolbox-header">
          <div class="toolbox-title-group">
            <span class="toolbox-icon" aria-hidden="true">🛠️</span>
            <h2>Arsenal de Estudio & Ajustes</h2>
          </div>
          <button class="btn-close-toolbox" id="btnCloseToolbox" aria-label="Cerrar panel de herramientas">✖</button>
        </div>

        <div class="toolbox-body">
          <!-- 1. Transposición Inteligente (-12 a +12 semitonos) -->
          <div class="tool-section">
            <div class="tool-section-label">
              <span>🎯 Transposición de Tono:</span>
              <strong id="lblTransposeVal">${this.currentTranspose > 0 ? '+' : ''}${this.currentTranspose} st</strong>
            </div>
            <div class="transpose-control-row" role="group" aria-label="Controles de transposición">
              <button class="btn btn-secondary btn-transpose" id="btnTransposeDown" aria-label="Bajar un semitono">-1</button>
              <button class="btn btn-secondary btn-transpose-reset" id="btnTransposeReset" aria-label="Restablecer tono original">0</button>
              <button class="btn btn-secondary btn-transpose" id="btnTransposeUp" aria-label="Subir un semitono">+1</button>
            </div>
          </div>

          <!-- 2. Herramienta de Cejilla (Capo Tool) -->
          <div class="tool-section">
            <div class="tool-section-label">
              <label for="selCapoFret">🎸 Cejilla (Capo):</label>
              <strong id="lblCapoVal">${this.currentCapo === 0 ? 'Sin Capo' : `Traste ${this.currentCapo}`}</strong>
            </div>
            <select id="selCapoFret" class="select-styled" aria-label="Seleccionar traste para la cejilla">
              <option value="0" ${this.currentCapo === 0 ? 'selected' : ''}>Sin Capo (Standard)</option>
              ${Array.from({ length: 12 }, (_, i) => `
                <option value="${i + 1}" ${this.currentCapo === i + 1 ? 'selected' : ''}>Traste ${i + 1}</option>
              `).join('')}
            </select>
          </div>

          <!-- 3. Activar / Desactivar Mástil Interactivo (Fretboard Toggle) -->
          <div class="tool-toggle-row">
            <div class="toggle-text">
              <span id="lblFretboardToggleTitle">🎸 Mástil Interactivo</span>
              <span class="toggle-sub">Muestra u oculta el diapasón animado de la guitarra</span>
            </div>
            <div class="switch-toggle">
              <input type="checkbox" id="chkFretboardToggle" ${this.isFretboardVisible ? 'checked' : ''} aria-labelledby="lblFretboardToggleTitle">
              <span class="slider round"></span>
            </div>
          </div>

          <!-- 4. Toggles de Práctica & Zurdos -->
          <div class="tool-toggle-row">
            <div class="toggle-text">
              <span id="lblSimplifyTitle">🎼 Simplificador de Acordes</span>
              <span class="toggle-sub">Convierte acordes complejos a triadas básicas</span>
            </div>
            <div class="switch-toggle">
              <input type="checkbox" id="chkSimplifyChords" ${this.isSimplified ? 'checked' : ''} aria-labelledby="lblSimplifyTitle">
              <span class="slider round"></span>
            </div>
          </div>

          <div class="tool-toggle-row">
            <div class="toggle-text">
              <span id="lblLeftHandedTitle">🖐️ Modo Zurdos (Left-Handed)</span>
              <span class="toggle-sub">Invierte el mástil y diagramas de acordes</span>
            </div>
            <div class="switch-toggle">
              <input type="checkbox" id="chkLeftHandedMode" ${this.isLeftHanded ? 'checked' : ''} aria-labelledby="lblLeftHandedTitle">
              <span class="slider round"></span>
            </div>
          </div>

          <!-- 5. Visualizadores e Instrumentos -->
          <div class="toolbox-tools-grid">
            <button id="btnToolAudioSync" class="btn btn-secondary btn-grid-item" aria-label="Sincronizar audio real">
              <span aria-hidden="true">🎧</span> Audio Sync
            </button>
            <button id="btnToolPiano" class="btn btn-secondary btn-grid-item" aria-label="Abrir teclado de piano">
              <span aria-hidden="true">🎹</span> Piano
            </button>
            <button id="btnToolDrums" class="btn btn-secondary btn-grid-item" aria-label="Abrir batería interactiva">
              <span aria-hidden="true">🥁</span> Batería
            </button>
            <button id="btnToolMixer" class="btn btn-secondary btn-grid-item" aria-label="Abrir mezclador">
              <span aria-hidden="true">🎚️</span> Mezclador (X)
            </button>
            <button id="btnToolChords" class="btn btn-secondary btn-grid-item" aria-label="Abrir diccionario de acordes">
              <span aria-hidden="true">📖</span> Acordes (D)
            </button>
          </div>

          <!-- 6. Exportaciones de Publicación -->
          <div class="toolbox-actions-grid">
            <button id="btnOpenExportModal" class="btn btn-primary btn-action" style="grid-column: 1 / -1;" aria-label="Abrir opciones de exportación">
              <span aria-hidden="true">📤</span> Exportar Partitura (PDF / MIDI / XML)
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btnCloseToolbox')?.addEventListener('click', () => {
      this.toggle();
    });

    // Transposición
    this.container.querySelector('#btnTransposeDown')?.addEventListener('click', () => {
      this.setTranspose(this.currentTranspose - 1);
    });

    this.container.querySelector('#btnTransposeUp')?.addEventListener('click', () => {
      this.setTranspose(this.currentTranspose + 1);
    });

    this.container.querySelector('#btnTransposeReset')?.addEventListener('click', () => {
      this.setTranspose(0);
    });

    // Capo
    this.container.querySelector('#selCapoFret')?.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      this.setCapo(val);
      const lbl = this.container?.querySelector('#lblCapoVal');
      if (lbl) lbl.textContent = val === 0 ? 'Sin Capo' : `Traste ${val}`;
    });

    // Mástil Interactivo Toggle
    this.container.querySelector('#chkFretboardToggle')?.addEventListener('change', (e) => {
      this.isFretboardVisible = e.target.checked;
      events.emit('ui:toggleFretboard', this.isFretboardVisible);
      toast.show(`🎸 Mástil ${this.isFretboardVisible ? 'activado' : 'oculto'}`, 'info');
    });

    // Simplificador de acordes
    this.container.querySelector('#chkSimplifyChords')?.addEventListener('change', (e) => {
      this.isSimplified = e.target.checked;
      chordEngine.setSimplified(this.isSimplified);
      toast.show(`🎼 Simplificador ${this.isSimplified ? 'activado' : 'desactivado'}`, 'info');
    });

    // Modo Zurdos
    this.container.querySelector('#chkLeftHandedMode')?.addEventListener('change', (e) => {
      this.isLeftHanded = e.target.checked;
      chordEngine.setLeftHanded(this.isLeftHanded);
      toast.show(`🖐️ Modo Zurdos ${this.isLeftHanded ? 'activado' : 'desactivado'}`, 'info');
    });

    // Módulos
    this.container.querySelector('#btnToolAudioSync')?.addEventListener('click', () => {
      events.emit('ui:toggleAudioSync');
    });

    this.container.querySelector('#btnToolPiano')?.addEventListener('click', () => {
      events.emit('ui:togglePiano');
    });

    this.container.querySelector('#btnToolDrums')?.addEventListener('click', () => {
      events.emit('ui:toggleDrums');
    });

    this.container.querySelector('#btnToolMixer')?.addEventListener('click', () => {
      events.emit('ui:toggleMixer');
    });

    this.container.querySelector('#btnToolChords')?.addEventListener('click', () => {
      events.emit('ui:toggleChordModal');
    });

    this.container.querySelector('#btnOpenExportModal')?.addEventListener('click', () => {
      events.emit('ui:toggleExportModal');
    });
  }
}

export default ProToolbox;
