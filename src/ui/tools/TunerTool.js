/**
 * @file TunerTool.js
 * @description Afinador Profesional con dos modos claros:
 * 1. Afinador Automático por Micrófono (Detección cromática en tiempo real con aguja de cents y estado).
 * 2. Afinador Manual de Oído (Diapasón senoidal puro con cuerdas interactivas y múltiples afinaciones).
 */

import { toast } from '../Toast.js';
import { pitchDetector } from '../../audio/PitchDetector.js';
import { events } from '../../core/EventBus.js';
import { ChordProParser } from '../lyrics/ChordProParser.js';

export const TUNINGS_DATA = {
  standard: { name: 'Guitarra Estándar (E A D G B E)', strings: [{ note: 'E4', freq: 329.63, stringNum: 1 }, { note: 'B3', freq: 246.94, stringNum: 2 }, { note: 'G3', freq: 196.00, stringNum: 3 }, { note: 'D3', freq: 146.83, stringNum: 4 }, { note: 'A2', freq: 110.00, stringNum: 5 }, { note: 'E2', freq: 82.41, stringNum: 6 }] },
  dropD: { name: 'Drop D (D A D G B E)', strings: [{ note: 'E4', freq: 329.63, stringNum: 1 }, { note: 'B3', freq: 246.94, stringNum: 2 }, { note: 'G3', freq: 196.00, stringNum: 3 }, { note: 'D3', freq: 146.83, stringNum: 4 }, { note: 'A2', freq: 110.00, stringNum: 5 }, { note: 'D2', freq: 73.42, stringNum: 6 }] },
  dadgad: { name: 'DADGAD Folk Céltico', strings: [{ note: 'D4', freq: 293.66, stringNum: 1 }, { note: 'A3', freq: 220.00, stringNum: 2 }, { note: 'G3', freq: 196.00, stringNum: 3 }, { note: 'D3', freq: 146.83, stringNum: 4 }, { note: 'A2', freq: 110.00, stringNum: 5 }, { note: 'D2', freq: 73.42, stringNum: 6 }] },
  openG: { name: 'Open G (D G D G B D)', strings: [{ note: 'D4', freq: 293.66, stringNum: 1 }, { note: 'B3', freq: 246.94, stringNum: 2 }, { note: 'G3', freq: 196.00, stringNum: 3 }, { note: 'D3', freq: 146.83, stringNum: 4 }, { note: 'G2', freq: 98.00, stringNum: 5 }, { note: 'D2', freq: 73.42, stringNum: 6 }] },
  bass: { name: 'Bajo Eléctrico 4C (E A D G)', strings: [{ note: 'G2', freq: 98.00, stringNum: 1 }, { note: 'D2', freq: 73.42, stringNum: 2 }, { note: 'A1', freq: 55.00, stringNum: 3 }, { note: 'E1', freq: 41.20, stringNum: 4 }] },
  ukulele: { name: 'Ukelele Soprano (G C E A)', strings: [{ note: 'A4', freq: 440.00, stringNum: 1 }, { note: 'E4', freq: 329.63, stringNum: 2 }, { note: 'C4', freq: 261.63, stringNum: 3 }, { note: 'G4', freq: 392.00, stringNum: 4 }] },
};

export class TunerTool {
  constructor(getAudioContext) {
    this.getAudioContext = getAudioContext;
    this.mode = 'auto'; // 'auto' (Micrófono) | 'manual' (Oído / Pitch pipe)
    this.selectedTuning = 'standard';
    this.frequency = 440;
    this.activeOsc = null;
    this.isListening = false;
    this.unsubPitch = null;
  }

  playPitch(freq, noteName) {
    const ctx = this.getAudioContext();
    if (this.activeOsc) {
      try { this.activeOsc.stop(); } catch (e) {}
      this.activeOsc = null;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.7, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.0);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 3.0);
    this.activeOsc = osc;

    toast.show(`Sonando ${noteName} (${freq.toFixed(1)} Hz)`, 'info', 1000);
  }

  async toggleMicrophone(container) {
    if (this.isListening) {
      this.stopMicrophone(container);
    } else {
      await this.startMicrophone(container);
    }
  }

  async startMicrophone(container) {
    try {
      const started = await pitchDetector.start();
      this.isListening = Boolean(started && pitchDetector.isRunning);
      if (!this.isListening) return;
      toast.show('Micrófono activo: toca una cuerda para afinar', 'success', 1500);

      const btn = container?.querySelector('#btnToggleMicTuner');
      if (btn) {
        btn.classList.add('active');
        btn.innerHTML = '<span>Dejar de escuchar</span>';
      }

      this.unsubPitch = events.on('tuner:pitch', (pitch) => {
        this.updateAutoTunerUI(pitch, container);
      });
    } catch (e) {
      console.warn('Error accediendo al micrófono:', e);
      toast.show('No se pudo acceder al micrófono: ' + e.message, 'warning');
    }
  }

  stopMicrophone(container) {
    pitchDetector.stop();
    this.isListening = false;
    if (this.unsubPitch) {
      this.unsubPitch();
      this.unsubPitch = null;
    }
    const btn = container?.querySelector('#btnToggleMicTuner');
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = '<span>Escuchar mi instrumento</span>';
    }
    toast.show('Afinador por micrófono detenido', 'info', 800);
  }

  updateAutoTunerUI(pitch, container) {
    const detectedNote = pitch?.noteWithOctave || (pitch?.note ? pitch.note + (pitch.octave ?? '') : '');
    if (!detectedNote) return;

    const noteEl = container?.querySelector('#tunerDetectedNote');
    const freqEl = container?.querySelector('#tunerDetectedFreq');
    const centsEl = container?.querySelector('#tunerDetectedCents');
    const meterNeedle = container?.querySelector('#tunerMeterNeedle');
    const statusPill = container?.querySelector('#tunerStatusPill');

    if (noteEl) noteEl.textContent = ChordProParser.formatChordDisplay(detectedNote);
    if (freqEl) freqEl.textContent = `${pitch.frequency.toFixed(1)} Hz`;

    const cents = pitch.cents || 0;
    if (centsEl) {
      centsEl.textContent = `${cents > 0 ? '+' : ''}${cents} cents`;
    }

    if (meterNeedle) {
      const clampCents = Math.max(-50, Math.min(50, cents));
      meterNeedle.style.transform = `translateX(${clampCents * 2}%)`;
    }

    if (statusPill) {
      if (Math.abs(cents) <= 5) {
        statusPill.className = 'tuner-status-pill in-tune';
        statusPill.textContent = '✨ ¡AFINADO PERFECTO!';
      } else if (cents < -5) {
        statusPill.className = 'tuner-status-pill flat';
        statusPill.textContent = '⬇️ GRAVE (Apretar cuerda)';
      } else {
        statusPill.className = 'tuner-status-pill sharp';
        statusPill.textContent = '⬆️ AGUDO (Aflojar cuerda)';
      }
    }
  }

  renderModal() {
    const tuning = TUNINGS_DATA[this.selectedTuning] || TUNINGS_DATA.standard;
    return `
      <div class="tool-modal-overlay active" id="toolModalOverlay">
        <div class="tool-modal-dialog">
          <div class="tool-modal-header">
            <div class="tool-modal-title">
              <span class="tool-modal-icon">🎵</span>
              <div>
                <span class="tool-badge-studio">AFINACIÓN PROFESIONAL</span>
                <h2>Afinador de Instrumentos Pro</h2>
              </div>
            </div>
            <button class="btn-close-tool-modal" id="btnCloseToolModal" aria-label="Cerrar afinador">✕</button>
          </div>

          <!-- Pestañas de Selección de Modo (Automático vs Manual de Oído) -->
          <div class="tuner-mode-switcher" role="tablist">
            <button class="tuner-mode-tab-btn ${this.mode === 'auto' ? 'active' : ''}" data-mode="auto" id="btnModeAutoTuner" role="tab" aria-selected="${this.mode === 'auto'}" aria-controls="autoTunerSection">
              Escuchar micrófono
            </button>
            <button class="tuner-mode-tab-btn ${this.mode === 'manual' ? 'active' : ''}" data-mode="manual" id="btnModeManualTuner" role="tab" aria-selected="${this.mode === 'manual'}" aria-controls="manualTunerSection">
              Notas de referencia
            </button>
          </div>

          <div class="tool-panoramic-layout">
            <!-- MODO 1: AFINADOR AUTOMÁTICO POR MICRÓFONO -->
            <div class="tool-panoramic-main" id="autoTunerSection" role="tabpanel" aria-labelledby="btnModeAutoTuner" style="display: ${this.mode === 'auto' ? 'flex' : 'none'};">
              <div class="auto-tuner-card">
                <div class="tuner-status-pill ready" id="tunerStatusPill">
                  ${this.isListening ? 'Escuchando tu instrumento' : 'Micrófono apagado'}
                </div>

                <div class="tuner-detected-note-box">
                  <span class="tuner-note-huge font-mono" id="tunerDetectedNote">--</span>
                  <span class="tuner-freq-badge" id="tunerDetectedFreq">0.0 Hz</span>
                  <span class="tuner-cents-badge" id="tunerDetectedCents">0 cents</span>
                </div>

                <!-- Barra Visual de Afinación Centimétrica -->
                <div class="tuner-meter-track">
                  <div class="meter-center-mark"></div>
                  <div class="tuner-meter-needle" id="tunerMeterNeedle"></div>
                </div>
                <div class="meter-scale-labels">
                  <span>-50 (Grave)</span>
                  <span class="in-tune-mark">0 (Perfecto)</span>
                  <span>+50 (Agudo)</span>
                </div>

                <button class="btn-toggle-mic-main ${this.isListening ? 'active' : ''}" id="btnToggleMicTuner">
                  <span>${this.isListening ? 'Dejar de escuchar' : 'Escuchar mi instrumento'}</span>
                </button>
              </div>
            </div>

            <!-- MODO 2: AFINADOR MANUAL DE OÍDO (DIAPASÓN) -->
            <div class="tool-panoramic-main" id="manualTunerSection" role="tabpanel" aria-labelledby="btnModeManualTuner" style="display: ${this.mode === 'manual' ? 'flex' : 'none'};">
              <div class="tuner-main-box">
                <label class="metro-param-label" style="text-align: center; margin-bottom: 8px;">Afinación del Instrumento</label>
                <div class="tuner-preset-selector">
                  <select id="selTuningPreset" class="tuner-select-full">
                    ${Object.entries(TUNINGS_DATA).map(([k, v]) => `
                      <option value="${k}" ${this.selectedTuning === k ? 'selected' : ''}>${v.name}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="tuner-strings-vertical-rack" id="tunerStringsRack">
                ${tuning.strings.map(s => `
                  <button class="tuner-string-card" data-freq="${s.freq}" data-note="${s.note}">
                    <div class="string-card-left">
                      <span class="string-badge-num">Cuerda ${s.stringNum}</span>
                      <span class="string-note-big">${s.note}</span>
                    </div>
                    <div class="string-card-right">
                      <span class="string-freq-label">${s.freq.toFixed(1)} Hz</span>
                      <span class="string-action-btn">🔊 Escuchar Tono</span>
                    </div>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Panel Lateral con Guía Plegada -->
            <div class="tool-panoramic-side">
              <div class="tuner-side-info-card">
                <div class="tuner-side-header">
                  <span class="tool-badge-studio">CONSEJOS PRO</span>
                  <h3>Guía de Afinación</h3>
                </div>
                <details class="tuner-guide-details" open>
                  <summary class="tuner-guide-summary">¿Cómo afinar correctamente? ▾</summary>
                  <p class="tuner-instruction-text" style="margin-top: 10px;">
                    <strong>Escuchar micrófono:</strong> toca una cuerda al aire y ajusta hasta centrar la aguja.<br><br>
                    <strong>Notas de referencia:</strong> pulsa una cuerda y compárala de oído con tu instrumento.
                  </p>
                </details>
                <div class="tuner-ref-freq-pill" style="margin-top: 14px;">
                  <span>Calibración: A4 = 440.0 Hz (Estándar ISO)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

export default TunerTool;
