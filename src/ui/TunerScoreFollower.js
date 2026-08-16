/**
 * @file TunerScoreFollower.js
 * @description Afinador Cromático Profesional Estilo Ultimate Guitar con Clavijero Visual Interactivo:
 * - Selección de Instrumento y Clavijero: Guitarra 3+3, Guitarra 6 en Línea, Ukelele 2+2, Bajo 4L.
 * - Modo Automático Real: Detecta automáticamente qué cuerda estás tocando sin tener que seleccionarla.
 * - Modo Manual / Oído: Clavijas interactivas que sintetizan el tono de referencia exacto.
 * - Aguja de precisión sub-hertzio (+/- 50 cents, frecuencia en Hz y nota objetivo).
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { pitchDetector } from '../audio/PitchDetector.js';
import { toast } from './Toast.js';

// Configuraciones de Clavijeros e Instrumentos
export const TUNER_PRESETS = {
  'guitar_33': {
    name: 'Guitarra (3+3 Clásica / Acústica)',
    type: 'split',
    strings: [
      { num: 6, note: 'E', octave: 2, freq: 82.41, side: 'left' },
      { num: 5, note: 'A', octave: 2, freq: 110.00, side: 'left' },
      { num: 4, note: 'D', octave: 3, freq: 146.83, side: 'left' },
      { num: 3, note: 'G', octave: 3, freq: 196.00, side: 'right' },
      { num: 2, note: 'B', octave: 3, freq: 246.94, side: 'right' },
      { num: 1, note: 'E', octave: 4, freq: 329.63, side: 'right' },
    ]
  },
  'guitar_6l': {
    name: 'Guitarra (6 en Línea / Fender)',
    type: 'inline',
    strings: [
      { num: 6, note: 'E', octave: 2, freq: 82.41, side: 'left' },
      { num: 5, note: 'A', octave: 2, freq: 110.00, side: 'left' },
      { num: 4, note: 'D', octave: 3, freq: 146.83, side: 'left' },
      { num: 3, note: 'G', octave: 3, freq: 196.00, side: 'left' },
      { num: 2, note: 'B', octave: 3, freq: 246.94, side: 'left' },
      { num: 1, note: 'E', octave: 4, freq: 329.63, side: 'left' },
    ]
  },
  'ukulele_22': {
    name: 'Ukelele (2+2 G-C-E-A)',
    type: 'split',
    strings: [
      { num: 4, note: 'G', octave: 4, freq: 392.00, side: 'left' },
      { num: 3, note: 'C', octave: 4, freq: 261.63, side: 'left' },
      { num: 2, note: 'E', octave: 4, freq: 329.63, side: 'right' },
      { num: 1, note: 'A', octave: 4, freq: 440.00, side: 'right' },
    ]
  },
  'bass_4l': {
    name: 'Bajo (4 Cuerdas E-A-D-G)',
    type: 'inline',
    strings: [
      { num: 4, note: 'E', octave: 1, freq: 41.20, side: 'left' },
      { num: 3, note: 'A', octave: 1, freq: 55.00, side: 'left' },
      { num: 2, note: 'D', octave: 2, freq: 73.42, side: 'left' },
      { num: 1, note: 'G', octave: 2, freq: 98.00, side: 'left' },
    ]
  }
};

export class TunerScoreFollower extends Component {
  constructor(container) {
    super(container);
    this.isOpen = false;
    this.isListening = false;
    this.currentPresetKey = 'guitar_33';
    this.isAutoDetectMode = true; // true: detección automática continua de cuerda
    this.currentPitch = null;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('tuner:pitch', (pitch) => {
        this.currentPitch = pitch;
        this.updateTunerDisplay(pitch);
      })
    );

    this.registerUnsub(
      events.on('tuner:silence', () => {
        this.clearTunerDisplay();
      })
    );

    this.registerUnsub(
      events.on('ui:toggleTuner', () => {
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
      this.container.classList.toggle('tuner-open', this.isOpen);
      if (this.isOpen) {
        this.render();
        if (!this.isListening) {
          this.startMic();
        }
      } else {
        this.stopMic();
      }
    }
  }

  async startMic() {
    try {
      await pitchDetector.start();
      this.isListening = pitchDetector.isRunning;
      this.render();
    } catch (err) {
      this.isListening = false;
      toast.show('🎙️ Micrófono no activo. Puedes pulsar las clavijas para afinar de oído.', 'info', 1500);
      this.render();
    }
  }

  stopMic() {
    pitchDetector.stop();
    this.isListening = false;
    this.render();
  }

  playReferencePitch(freq) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.0);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 2.2);
    } catch (e) {}
  }

  render() {
    if (!this.container) return;

    const preset = TUNER_PRESETS[this.currentPresetKey];

    this.container.innerHTML = `
      <div class="tuner-backdrop" role="dialog" aria-modal="true" aria-label="Afinador Cromático Profesional">
        <div class="tuner-modal-card">
          <!-- Cabecera -->
          <div class="tuner-header">
            <div class="tuner-title-group">
              <span class="tuner-icon" aria-hidden="true">🎙️</span>
              <h2>Afinador Cromático</h2>
            </div>
            <button class="btn-close-tuner" id="btnCloseTuner" aria-label="Cerrar afinador">✕</button>
          </div>

          <!-- Selector de Instrumento y Clavijero -->
          <div class="tuner-instrument-select-bar">
            <label for="selTunerPreset">Instrumento / Clavijero:</label>
            <select id="selTunerPreset" class="sel-tuner-preset">
              <option value="guitar_33" ${this.currentPresetKey === 'guitar_33' ? 'selected' : ''}>Guitarra (3+3 Clásica / Acústica)</option>
              <option value="guitar_6l" ${this.currentPresetKey === 'guitar_6l' ? 'selected' : ''}>Guitarra (6 en Línea / Fender)</option>
              <option value="ukulele_22" ${this.currentPresetKey === 'ukulele_22' ? 'selected' : ''}>Ukelele (2+2 G-C-E-A)</option>
              <option value="bass_4l" ${this.currentPresetKey === 'bass_4l' ? 'selected' : ''}>Bajo (4 Cuerdas E-A-D-G)</option>
            </select>
          </div>

          <!-- Alternador de Modo: Automático vs Manual -->
          <div class="tuner-mode-pill-bar" role="group" aria-label="Modo de afinación">
            <button class="btn-tuner-mode-tab ${this.isAutoDetectMode ? 'active' : ''}" id="btnModeAutoDetect">
              ⚡ Detección Automática
            </button>
            <button class="btn-tuner-mode-tab ${!this.isAutoDetectMode ? 'active' : ''}" id="btnModeManualTone">
              🖐️ Afinar de Oído
            </button>
          </div>

          <!-- Dial Principal del Afinador con Aguja Fluida -->
          <div class="tuner-gauge-section">
            <div class="tuner-note-display" id="tunerNoteDisplay">
              <span class="tuner-note-letter" id="tunerNoteLetter">--</span>
              <span class="tuner-octave-number" id="tunerOctave"></span>
            </div>

            <div class="tuner-needle-track" aria-label="Desviación de afinación">
              <div class="needle-center-mark"></div>
              <div class="needle-indicator" id="tunerNeedle" style="left: 50%;"></div>
            </div>

            <div class="tuner-cents-readout">
              <span id="tunerCentsVal">0 cents</span>
              <span id="tunerStatusText" class="tuner-status-badge">Toca cualquier cuerda</span>
              <span id="tunerFreqVal">0.0 Hz</span>
            </div>
          </div>

          <!-- Clavijero Visual Interactivo (Headstock con Clavijas Reales) -->
          <div class="tuner-headstock-container ${preset.type === 'split' ? 'headstock-split' : 'headstock-inline'}">
            <div class="headstock-pegs-col left-pegs">
              ${preset.strings.filter(s => s.side === 'left').map(s => `
                <button class="tuner-peg-btn" data-freq="${s.freq}" data-note="${s.note}${s.octave}" data-num="${s.num}">
                  <span class="peg-num">${s.num}ª</span>
                  <span class="peg-note">${s.note}</span>
                  <span class="peg-hz">${Math.round(s.freq)}Hz</span>
                </button>
              `).join('')}
            </div>

            <div class="headstock-neck-visual">
              <div class="headstock-nut"></div>
            </div>

            ${preset.type === 'split' ? `
              <div class="headstock-pegs-col right-pegs">
                ${preset.strings.filter(s => s.side === 'right').map(s => `
                  <button class="tuner-peg-btn" data-freq="${s.freq}" data-note="${s.note}${s.octave}" data-num="${s.num}">
                    <span class="peg-num">${s.num}ª</span>
                    <span class="peg-note">${s.note}</span>
                    <span class="peg-hz">${Math.round(s.freq)}Hz</span>
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Botones de Acción -->
          <div class="tuner-actions">
            <button id="btnToggleMic" class="btn ${this.isListening ? 'btn-secondary' : 'btn-primary'}" style="width: 100%;">
              <span>${this.isListening ? '⏹ Pausar Micrófono' : '🎙️ Activar Micrófono'}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btnCloseTuner')?.addEventListener('click', () => this.toggle());

    this.container.querySelector('#selTunerPreset')?.addEventListener('change', (e) => {
      this.currentPresetKey = e.target.value;
      this.render();
    });

    this.container.querySelector('#btnModeAutoDetect')?.addEventListener('click', () => {
      this.isAutoDetectMode = true;
      toast.show('⚡ Modo Automático: Escuchando cualquier cuerda', 'info', 1000);
      this.render();
      if (!this.isListening) this.startMic();
    });

    this.container.querySelector('#btnModeManualTone')?.addEventListener('click', () => {
      this.isAutoDetectMode = false;
      toast.show('🖐️ Modo Oído: Pulsa cada clavija para escuchar su tono', 'info', 1000);
      this.render();
    });

    this.container.querySelector('#btnToggleMic')?.addEventListener('click', () => {
      if (this.isListening) {
        this.stopMic();
      } else {
        this.startMic();
      }
    });

    // Clic en clavija -> Reproducir tono de referencia (Afinar de oído)
    this.container.querySelectorAll('.tuner-peg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const freq = parseFloat(btn.dataset.freq);
        const note = btn.dataset.note;
        this.playReferencePitch(freq);
        toast.show(`🔊 Tono de referencia: ${note} (${Math.round(freq)} Hz)`, 'info', 800);
      });
    });
  }

  updateTunerDisplay(pitch) {
    if (!this.container) return;

    const letterEl = this.container.querySelector('#tunerNoteLetter');
    const octaveEl = this.container.querySelector('#tunerOctave');
    const needleEl = this.container.querySelector('#tunerNeedle');
    const centsEl = this.container.querySelector('#tunerCentsVal');
    const freqEl = this.container.querySelector('#tunerFreqVal');
    const statusEl = this.container.querySelector('#tunerStatusText');

    if (letterEl) letterEl.textContent = pitch.note;
    if (octaveEl) octaveEl.textContent = pitch.octave;
    if (centsEl) centsEl.textContent = `${pitch.cents > 0 ? '+' : ''}${pitch.cents} cents`;
    if (freqEl) freqEl.textContent = `${pitch.frequency.toFixed(1)} Hz`;

    if (needleEl) {
      const clampedCents = Math.max(-50, Math.min(50, pitch.cents));
      const percentage = 50 + (clampedCents / 50) * 50;
      needleEl.style.left = `${percentage}%`;

      const inTune = Math.abs(pitch.cents) <= 5;
      needleEl.classList.toggle('needle-in-tune', inTune);
      letterEl?.classList.toggle('note-in-tune', inTune);

      if (statusEl) {
        if (inTune) {
          statusEl.textContent = '✨ ¡AFINADO!';
          statusEl.style.color = '#00e676';
        } else if (pitch.cents < -5) {
          statusEl.textContent = '▲ Sube la clavija';
          statusEl.style.color = '#ff9100';
        } else {
          statusEl.textContent = '▼ Baja la clavija';
          statusEl.style.color = '#ff5252';
        }
      }

      // En modo automático: Detectar qué cuerda del clavijero es la más cercana e iluminarla
      const currentNoteWithOct = `${pitch.note}${pitch.octave}`;
      this.container.querySelectorAll('.tuner-peg-btn').forEach(btn => {
        const isPegMatched = btn.dataset.note === currentNoteWithOct || (pitch.note === btn.dataset.note.slice(0, -1));
        btn.classList.toggle('peg-active', isPegMatched);
        btn.classList.toggle('peg-in-tune', isPegMatched && inTune);
      });
    }
  }

  clearTunerDisplay() {
    if (!this.container) return;
    const needleEl = this.container.querySelector('#tunerNeedle');
    if (needleEl) needleEl.classList.remove('needle-in-tune');
  }
}

export default TunerScoreFollower;
