/**
 * @file TunerTool.js
 * @description Afinador Cromático con Pitch Pipe multi-afinación (Standard, Drop D, DADGAD, Open G, Bajo, Ukelele).
 */

import { toast } from '../Toast.js';

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
    this.selectedTuning = 'standard';
    this.frequency = 440;
    this.activeOsc = null;
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

  renderModal() {
    const tuning = TUNINGS_DATA[this.selectedTuning] || TUNINGS_DATA.standard;
    return `
      <div class="tool-modal-overlay active" id="toolModalOverlay">
        <div class="tool-modal-dialog">
          <div class="tool-modal-header">
            <div class="tool-modal-title">
              <span class="tool-modal-icon">🎵</span>
              <div>
                <span class="tool-badge-studio">AFINACIÓN & REFERENCIA ACÚSTICA</span>
                <h2>Afinador & Diapasón de Cuerdas</h2>
              </div>
            </div>
            <button class="btn-close-tool-modal" id="btnCloseToolModal">✕</button>
          </div>

          <div class="tool-panoramic-layout">
            <div class="tool-panoramic-main">
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

            <div class="tool-panoramic-side">
              <div class="tuner-side-info-card">
                <div class="tuner-side-header">
                  <span class="tool-badge-studio">GUÍA PRÁCTICA</span>
                  <h3>¿Cómo afinar de oído?</h3>
                </div>
                <p class="tuner-instruction-text">
                  1. Pulsa la cuerda que deseas afinar en la columna izquierda para escuchar su tono de referencia senoidal.<br><br>
                  2. Toca la misma cuerda en tu instrumento y ajusta la clavija hasta que el batimiento acústico desaparezca.<br><br>
                  3. Si escuchas oscilaciones rápidas ("wah-wah"), la afinación está cerca pero desafinada. Cuando el sonido sea completamente liso, la cuerda estará perfecta.
                </p>
                <div class="tuner-ref-freq-pill">
                  <span>Calibración: A4 = 440.0 Hz (Estándar de Concierto ISO)</span>
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
