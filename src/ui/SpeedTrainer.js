/**
 * @file SpeedTrainer.js
 * @description Sesion de ensayo con cuenta de entrada, bucle y progresion gradual.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { audioEngine } from '../core/AudioEngineV2.js';
import { toast } from './Toast.js';

export class SpeedTrainer extends Component {
  constructor(container) {
    super(container);
    this.enabled = false;
    this.startSpeed = 0.6;
    this.targetSpeed = 1.0;
    this.stepSpeed = 0.05;
    this.stepInterval = 2;
    this.currentSpeed = 0.6;
    this.currentIteration = 0;
    this.lastLoopTick = -1;
    this.countInBeats = 4;
    this.countdownValue = 0;
    this.countdownTimer = null;
    this.metronomeEnabled = true;
    this.loopEnabled = true;
    this.loopStartBar = 1;
    this.loopEndBar = 4;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('playback:time', ({ currentTick }) => {
        if (!this.enabled) return;

        const loopState = state.get('loop');
        if (!loopState.enabled) return;

        if (this.lastLoopTick > 0 && currentTick < this.lastLoopTick - 1000) {
          this.handleLoopIteration();
        }
        this.lastLoopTick = currentTick;
      })
    );

    this.registerUnsub(
      events.on('playback:state', ({ state: playbackState }) => {
        if (playbackState === 'stopped') {
          this.cancelCountIn();
          this.resetTrainer();
        }
      })
    );
  }

  handleLoopIteration() {
    this.currentIteration += 1;

    if (this.currentIteration % this.stepInterval !== 0) {
      this.updateStatus();
      return;
    }

    if (this.currentSpeed < this.targetSpeed) {
      this.currentSpeed = Math.min(this.targetSpeed, +(this.currentSpeed + this.stepSpeed).toFixed(2));
      audioEngine.setPlaybackSpeed(this.currentSpeed);
      toast.show(`Velocidad aumentada al ${Math.round(this.currentSpeed * 100)}%`, 'info');
    }
    this.updateStatus();
  }

  resetTrainer() {
    this.currentIteration = 0;
    this.lastLoopTick = -1;
    if (this.enabled) {
      this.currentSpeed = this.startSpeed;
      audioEngine.setPlaybackSpeed(this.currentSpeed);
      this.updateStatus();
    }
  }

  restorePlaybackDefaults() {
    audioEngine.clearLoop();
    audioEngine.setMetronome(false);
    audioEngine.setPlaybackSpeed(1);
    this.lastLoopTick = -1;
    this.currentIteration = 0;
  }

  toggle(enabled) {
    this.enabled = enabled !== undefined ? enabled : !this.enabled;
    this.cancelCountIn();
    if (this.enabled) {
      this.currentSpeed = this.startSpeed;
      this.currentIteration = 0;
      audioEngine.setPlaybackSpeed(this.currentSpeed);
    } else {
      this.restorePlaybackDefaults();
    }
    this.render();
  }

  cancelCountIn() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.countdownValue = 0;
  }

  applyPracticeSetup() {
    audioEngine.setPlaybackSpeed(this.currentSpeed);
    audioEngine.setMetronome(this.metronomeEnabled);
    if (this.loopEnabled) {
      audioEngine.setLoopRange(this.loopStartBar, this.loopEndBar);
      audioEngine.seekToBar(this.loopStartBar);
    } else {
      audioEngine.clearLoop();
    }
  }

  startPractice() {
    if (!this.enabled) return;
    if (!audioEngine.api) {
      toast.show('Abre una partitura antes de iniciar el ensayo', 'warning');
      return;
    }

    this.cancelCountIn();
    audioEngine.pause();
    this.applyPracticeSetup();

    if (this.countInBeats === 0) {
      audioEngine.play();
      return;
    }

    const songTempo = Number(state.get('activeSong')?.tempo) || 120;
    const beatDuration = Math.round(60000 / Math.max(40, Math.min(240, songTempo)));
    this.countdownValue = this.countInBeats;
    this.updateStatus();

    this.countdownTimer = setInterval(() => {
      this.countdownValue -= 1;
      if (this.countdownValue <= 0) {
        this.cancelCountIn();
        this.updateStatus('En curso');
        audioEngine.play();
        return;
      }
      this.updateStatus();
    }, beatDuration);
  }

  updateStatus(statusText) {
    const speed = this.container?.querySelector('[data-practice-speed]');
    const iteration = this.container?.querySelector('[data-practice-iteration]');
    const live = this.container?.querySelector('[data-practice-live]');
    if (speed) speed.textContent = `${Math.round(this.currentSpeed * 100)}%`;
    if (iteration) iteration.textContent = String(this.currentIteration);
    if (live) {
      live.textContent = statusText || (this.countdownValue > 0 ? `Entrada en ${this.countdownValue}` : 'Preparado');
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <section class="speedtrainer-panel" role="dialog" aria-modal="false" aria-labelledby="practiceTitle">
        <div class="speedtrainer-header">
          <div>
            <h2 id="practiceTitle">Modo ensayo</h2>
            <p class="speedtrainer-subtitle">Cuenta de entrada, bucle y aumento progresivo</p>
          </div>
          <div class="speedtrainer-header-actions">
            <label class="switch-toggle" aria-label="Activar modo ensayo">
              <input type="checkbox" id="stEnableCheckbox" ${this.enabled ? 'checked' : ''}>
              <span class="slider round"></span>
            </label>
            <button type="button" class="btn-close-practice" id="btnClosePractice" aria-label="Cerrar modo ensayo">×</button>
          </div>
        </div>

        <div class="speedtrainer-body ${this.enabled ? 'active' : 'disabled'}">
          <div class="practice-grid">
            <label class="st-row" for="stStartSpeedSelect">
              <span>Inicio</span>
              <select id="stStartSpeedSelect" ${!this.enabled ? 'disabled' : ''}>
                ${[0.4, 0.5, 0.6, 0.75, 0.9].map((value) => `<option value="${value}" ${this.startSpeed === value ? 'selected' : ''}>${Math.round(value * 100)}%</option>`).join('')}
              </select>
            </label>

            <label class="st-row" for="stTargetSpeedSelect">
              <span>Objetivo</span>
              <select id="stTargetSpeedSelect" ${!this.enabled ? 'disabled' : ''}>
                ${[1, 1.1, 1.25].map((value) => `<option value="${value}" ${this.targetSpeed === value ? 'selected' : ''}>${Math.round(value * 100)}%</option>`).join('')}
              </select>
            </label>

            <label class="st-row" for="stIntervalSelect">
              <span>Subir cada</span>
              <select id="stIntervalSelect" ${!this.enabled ? 'disabled' : ''}>
                ${[1, 2, 4].map((value) => `<option value="${value}" ${this.stepInterval === value ? 'selected' : ''}>${value} ${value === 1 ? 'vuelta' : 'vueltas'}</option>`).join('')}
              </select>
            </label>

            <label class="st-row" for="stCountInSelect">
              <span>Entrada</span>
              <select id="stCountInSelect" ${!this.enabled ? 'disabled' : ''}>
                ${[0, 2, 4, 8].map((value) => `<option value="${value}" ${this.countInBeats === value ? 'selected' : ''}>${value === 0 ? 'Sin cuenta' : `${value} pulsos`}</option>`).join('')}
              </select>
            </label>
          </div>

          <fieldset class="practice-loop-fields" ${!this.enabled ? 'disabled' : ''}>
            <legend>Bucle por compases</legend>
            <label><input type="checkbox" id="stLoopEnabled" ${this.loopEnabled ? 'checked' : ''}> Activar</label>
            <label>Desde <input type="number" id="stLoopStart" min="1" value="${this.loopStartBar}"></label>
            <label>Hasta <input type="number" id="stLoopEnd" min="1" value="${this.loopEndBar}"></label>
            <label><input type="checkbox" id="stMetronomeEnabled" ${this.metronomeEnabled ? 'checked' : ''}> Metrónomo</label>
          </fieldset>

          <div class="st-status-display" aria-live="polite">
            <span>Velocidad <strong data-practice-speed>${Math.round(this.currentSpeed * 100)}%</strong></span>
            <span>Vueltas <strong data-practice-iteration>${this.currentIteration}</strong></span>
            <span data-practice-live>${this.countdownValue > 0 ? `Entrada en ${this.countdownValue}` : 'Preparado'}</span>
          </div>

          <div class="practice-actions">
            <button type="button" class="btn-practice-start" id="btnStartPractice" ${!this.enabled ? 'disabled' : ''}>Iniciar ensayo</button>
            <button type="button" class="btn-practice-cancel" id="btnCancelPractice" ${!this.enabled ? 'disabled' : ''}>Detener</button>
          </div>
        </div>
      </section>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#stEnableCheckbox')?.addEventListener('change', (event) => this.toggle(event.target.checked));
    this.container.querySelector('#btnClosePractice')?.addEventListener('click', () => {
      this.cancelCountIn();
      this.enabled = false;
      this.restorePlaybackDefaults();
      events.emit('ui:toggleSpeedTrainer');
    });

    this.container.querySelector('#stStartSpeedSelect')?.addEventListener('change', (event) => {
      this.startSpeed = Number(event.target.value);
      this.currentSpeed = this.startSpeed;
      audioEngine.setPlaybackSpeed(this.currentSpeed);
      this.updateStatus();
    });
    this.container.querySelector('#stTargetSpeedSelect')?.addEventListener('change', (event) => {
      this.targetSpeed = Number(event.target.value);
    });
    this.container.querySelector('#stIntervalSelect')?.addEventListener('change', (event) => {
      this.stepInterval = Number(event.target.value);
    });
    this.container.querySelector('#stCountInSelect')?.addEventListener('change', (event) => {
      this.countInBeats = Number(event.target.value);
    });
    this.container.querySelector('#stLoopEnabled')?.addEventListener('change', (event) => {
      this.loopEnabled = event.target.checked;
    });
    this.container.querySelector('#stMetronomeEnabled')?.addEventListener('change', (event) => {
      this.metronomeEnabled = event.target.checked;
    });
    this.container.querySelector('#stLoopStart')?.addEventListener('change', (event) => {
      this.loopStartBar = Math.max(1, Number(event.target.value) || 1);
      if (this.loopEndBar < this.loopStartBar) this.loopEndBar = this.loopStartBar;
    });
    this.container.querySelector('#stLoopEnd')?.addEventListener('change', (event) => {
      this.loopEndBar = Math.max(this.loopStartBar, Number(event.target.value) || this.loopStartBar);
    });
    this.container.querySelector('#btnStartPractice')?.addEventListener('click', () => this.startPractice());
    this.container.querySelector('#btnCancelPractice')?.addEventListener('click', () => {
      this.cancelCountIn();
      audioEngine.stop();
      this.updateStatus('Detenido');
    });
  }

  destroy() {
    this.cancelCountIn();
    this.enabled = false;
    this.restorePlaybackDefaults();
    super.destroy();
  }
}

export default SpeedTrainer;
