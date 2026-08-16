/**
 * @file SpeedTrainer.js
 * @description Entrenador de velocidad y acelerador gradual para práctica técnica en bucle con soporte a11y.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { audioEngine } from '../core/AudioEngine.js';
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
      events.on('playback:state', ({ state: pState }) => {
        if (pState === 'stopped') {
          this.resetTrainer();
        }
      })
    );
  }

  handleLoopIteration() {
    this.currentIteration++;

    if (this.currentIteration % this.stepInterval === 0) {
      if (this.currentSpeed < this.targetSpeed) {
        this.currentSpeed = Math.min(this.targetSpeed, +(this.currentSpeed + this.stepSpeed).toFixed(2));
        audioEngine.setPlaybackSpeed(this.currentSpeed);
        
        toast.show(`🚀 Speed Trainer: Velocidad aumentada a ${Math.round(this.currentSpeed * 100)}%`, 'info');
        this.render();
      } else if (this.currentSpeed >= this.targetSpeed) {
        toast.show('🏆 ¡Felicidades! Has completado la práctica a velocidad objetivo (100%)', 'success');
      }
    }
  }

  resetTrainer() {
    this.currentIteration = 0;
    if (this.enabled) {
      this.currentSpeed = this.startSpeed;
      audioEngine.setPlaybackSpeed(this.currentSpeed);
      this.render();
    }
  }

  toggle(enabled) {
    this.enabled = (enabled !== undefined) ? enabled : !this.enabled;
    if (this.enabled) {
      this.currentSpeed = this.startSpeed;
      this.currentIteration = 0;
      audioEngine.setPlaybackSpeed(this.currentSpeed);
      toast.show(`🎯 Speed Trainer activado (Iniciando al ${Math.round(this.startSpeed * 100)}%)`, 'success');
    } else {
      toast.show('Speed Trainer desactivado', 'info');
    }
    this.render();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="speedtrainer-panel" role="region" aria-label="Acelerador de práctica Speed Trainer">
        <div class="speedtrainer-header">
          <h2>⚡ Speed Trainer Pro</h2>
          <label class="switch-toggle" aria-label="Activar Speed Trainer">
            <input type="checkbox" id="stEnableCheckbox" ${this.enabled ? 'checked' : ''} aria-label="Interruptor de activación de Speed Trainer">
            <span class="slider round"></span>
          </label>
        </div>

        <div class="speedtrainer-body ${this.enabled ? 'active' : 'disabled'}">
          <div class="st-row">
            <label for="stStartSpeedSelect">Velocidad Inicial:</label>
            <select id="stStartSpeedSelect" ${!this.enabled ? 'disabled' : ''} aria-label="Velocidad inicial del entrenamiento">
              <option value="0.4" ${this.startSpeed === 0.4 ? 'selected' : ''}>40%</option>
              <option value="0.5" ${this.startSpeed === 0.5 ? 'selected' : ''}>50%</option>
              <option value="0.6" ${this.startSpeed === 0.6 ? 'selected' : ''}>60%</option>
              <option value="0.75" ${this.startSpeed === 0.75 ? 'selected' : ''}>75%</option>
              <option value="0.9" ${this.startSpeed === 0.9 ? 'selected' : ''}>90%</option>
            </select>
          </div>

          <div class="st-row">
            <label for="stTargetSpeedSelect">Velocidad Objetivo:</label>
            <select id="stTargetSpeedSelect" ${!this.enabled ? 'disabled' : ''} aria-label="Velocidad objetivo">
              <option value="1.0" ${this.targetSpeed === 1.0 ? 'selected' : ''}>100% (Normal)</option>
              <option value="1.1" ${this.targetSpeed === 1.1 ? 'selected' : ''}>110% (Fast)</option>
              <option value="1.25" ${this.targetSpeed === 1.25 ? 'selected' : ''}>125% (Super Fast)</option>
            </select>
          </div>

          <div class="st-row">
            <label for="stIntervalSelect">Incremento cada:</label>
            <select id="stIntervalSelect" ${!this.enabled ? 'disabled' : ''} aria-label="Intervalo de repeticiones para incremento">
              <option value="1" ${this.stepInterval === 1 ? 'selected' : ''}>1 repetición</option>
              <option value="2" ${this.stepInterval === 2 ? 'selected' : ''}>2 repeticiones</option>
              <option value="4" ${this.stepInterval === 4 ? 'selected' : ''}>4 repeticiones</option>
            </select>
          </div>

          <div class="st-status-display" aria-live="polite">
            <span>Velocidad actual: <strong>${Math.round(this.currentSpeed * 100)}%</strong></span>
            <span>Repetición: <strong>${this.currentIteration}</strong></span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const checkbox = this.container.querySelector('#stEnableCheckbox');
    if (checkbox) {
      checkbox.addEventListener('change', (e) => this.toggle(e.target.checked));
    }

    const startSelect = this.container.querySelector('#stStartSpeedSelect');
    if (startSelect) {
      startSelect.addEventListener('change', (e) => {
        this.startSpeed = parseFloat(e.target.value);
        this.currentSpeed = this.startSpeed;
        if (this.enabled) audioEngine.setPlaybackSpeed(this.currentSpeed);
      });
    }

    const targetSelect = this.container.querySelector('#stTargetSpeedSelect');
    if (targetSelect) {
      targetSelect.addEventListener('change', (e) => {
        this.targetSpeed = parseFloat(e.target.value);
      });
    }

    const intervalSelect = this.container.querySelector('#stIntervalSelect');
    if (intervalSelect) {
      intervalSelect.addEventListener('change', (e) => {
        this.stepInterval = parseInt(e.target.value, 10);
      });
    }
  }
}

export default SpeedTrainer;
