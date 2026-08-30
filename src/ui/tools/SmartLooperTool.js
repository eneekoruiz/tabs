/**
 * @file SmartLooperTool.js
 * @description Modal y herramienta interactiva de Smart Looper y Speed Trainer para práctica de pasajes en bucle.
 * Permite seleccionar compases A-B y activar aceleración automática progresiva (+5% por ciclo).
 */

import { Component } from '../Component.js';
import { events } from '../../core/EventBus.js';
import { state } from '../../core/State.js';
import { smartLooperEngine } from '../../audio/SmartLooperEngine.js';
import { toast } from '../Toast.js';

export class SmartLooperTool extends Component {
  constructor() {
    super(null);
    this.engine = smartLooperEngine;
    this.initEvents();
  }

  initEvents() {
    events.on('looper:open', () => this.open('#looper-modal-container'));
  }

  open(targetContainerSelector = '#looper-modal-container') {
    let host = document.querySelector(targetContainerSelector);
    if (!host || host.offsetParent === null && targetContainerSelector === '#toolModalHost') {
      host = document.querySelector('#looper-modal-container') || document.querySelector('#toolModalHost');
    }
    if (!host) return;

    this.currentHost = targetContainerSelector;

    host.innerHTML = this.renderModal();
    this.attachListeners(host);
  }

  close(host) {
    if (host) host.innerHTML = '';
  }

  renderModal() {
    const isEnabled = this.engine.isEnabled;
    const isSpeedTrainer = this.engine.isSpeedTrainerActive;
    const currentSong = state.get('activeSong');
    const totalBars = (state.get('score')?.masterBars?.length) || 32;

    return `
      <div class="modal-looper-backdrop" role="dialog" aria-modal="true" aria-labelledby="looperTitle">
        <div class="modal-looper-card" id="modal-smart-looper">
          <!-- Cabecera -->
          <div class="looper-modal-header">
            <div class="looper-title-group">
              <div class="looper-badge">PRACTICE INTELLIGENCE · SPEED ESCALATION</div>
              <h2 id="looperTitle" class="looper-modal-title">🔁 Smart Looper & Speed Trainer</h2>
              <p class="looper-modal-subtitle">Practica compases difíciles en bucle continuo y sube la velocidad un 5% automáticamente tras cada vuelta.</p>
            </div>
            <button class="btn-close-looper" id="btnCloseLooper" aria-label="Cerrar looper">✕</button>
          </div>

          <!-- Cuerpo -->
          <div class="looper-modal-body">
            <!-- Selector de Rango A-B (Compases) -->
            <div class="looper-section-card">
              <h3 class="section-card-title">1. Rango de Compases a Repetir (Bucle A-B)</h3>
              <div class="looper-bars-row">
                <div class="bar-input-group">
                  <label for="looperStartBar">Compás Inicial (A):</label>
                  <div class="stepper-box">
                    <button class="btn-step-bar" id="btnDecrStartBar">-</button>
                    <input type="number" id="looperStartBar" min="1" max="${totalBars}" value="${this.engine.startBar}" class="bar-num-input">
                    <button class="btn-step-bar" id="btnIncrStartBar">+</button>
                  </div>
                </div>

                <div class="looper-arrow-sep">➔</div>

                <div class="bar-input-group">
                  <label for="looperEndBar">Compás Final (B):</label>
                  <div class="stepper-box">
                    <button class="btn-step-bar" id="btnDecrEndBar">-</button>
                    <input type="number" id="looperEndBar" min="1" max="${totalBars}" value="${this.engine.endBar}" class="bar-num-input">
                    <button class="btn-step-bar" id="btnIncrEndBar">+</button>
                  </div>
                </div>
              </div>

              <!-- Atajos de Compases Rápidos -->
              <div class="looper-quick-bars">
                <span class="quick-bars-label">Selección Rápida:</span>
                <button class="btn-quick-bars" data-start="1" data-end="4">Compases 1-4</button>
                <button class="btn-quick-bars" data-start="5" data-end="8">Compases 5-8</button>
                <button class="btn-quick-bars" data-start="9" data-end="16">Compases 9-16 (Solo)</button>
                <button class="btn-quick-bars" data-start="17" data-end="${totalBars}">Final (${totalBars})</button>
              </div>
            </div>

            <!-- Speed Trainer Switch & Configuración -->
            <div class="looper-section-card ${isSpeedTrainer ? 'trainer-active' : ''}">
              <div class="trainer-header-line">
                <div class="trainer-title-group">
                  <h3 class="section-card-title">2. Speed Trainer (+5% Automático por Vuelta)</h3>
                  <p class="trainer-desc">Incrementa la velocidad de reproducción de forma adaptativa tras cada ciclo completado sin fallos.</p>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="chkEnableSpeedTrainer" ${isSpeedTrainer ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="trainer-speeds-grid">
                <div class="trainer-speed-col">
                  <label>Velocidad Inicial:</label>
                  <div class="speed-pill-selector">
                    <button class="btn-speed-pill ${this.engine.initialSpeed === 0.60 ? 'active' : ''}" data-speed="0.60">60%</button>
                    <button class="btn-speed-pill ${this.engine.initialSpeed === 0.70 ? 'active' : ''}" data-speed="0.70">70%</button>
                    <button class="btn-speed-pill ${this.engine.initialSpeed === 0.80 ? 'active' : ''}" data-speed="0.80">80%</button>
                    <button class="btn-speed-pill ${this.engine.initialSpeed === 0.90 ? 'active' : ''}" data-speed="0.90">90%</button>
                  </div>
                </div>

                <div class="trainer-speed-col">
                  <label>Velocidad Objetivo:</label>
                  <div class="speed-pill-selector">
                    <button class="btn-target-pill ${this.engine.targetSpeed === 1.00 ? 'active' : ''}" data-target="1.00">100%</button>
                    <button class="btn-target-pill ${this.engine.targetSpeed === 1.10 ? 'active' : ''}" data-target="1.10">110%</button>
                    <button class="btn-target-pill ${this.engine.targetSpeed === 1.20 ? 'active' : ''}" data-target="1.20">120%</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Monitor de Progreso en Vivo -->
            <div class="looper-status-display">
              <div class="status-indicator ${isEnabled ? 'running' : 'idle'}"></div>
              <div class="status-meta">
                <strong class="status-title">${isEnabled ? '🔥 BUCLE ACTIVO Y SINCRONIZADO' : '⏸️ LOOPER EN ESPERA'}</strong>
                <span class="status-subtitle" id="lblLooperLiveStatus">
                  ${isEnabled ? `Vuelta actual: ${this.engine.currentCycle} · Velocidad: ${Math.round(this.engine.currentSpeed * 100)}% BPM` : 'Configura el rango y presiona Activar para iniciar.'}
                </span>
              </div>
            </div>
          </div>

          <!-- Pie de Acciones -->
          <div class="looper-modal-footer">
            <button class="btn-looper-action secondary" id="btnLooperReset">Restablecer Bucle</button>
            <button class="btn-looper-action primary ${isEnabled ? 'is-active' : ''}" id="btnLooperToggle">
              ${isEnabled ? '⏹️ Detener Bucle A-B' : '▶️ Activar Bucle & Speed Trainer'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  attachListeners(container) {
    const card = container.querySelector('#modal-smart-looper');
    if (!card) return;

    // Cerrar
    card.querySelector('#btnCloseLooper')?.addEventListener('click', () => this.close(container));

    // Steppers de compases
    const startInp = card.querySelector('#looperStartBar');
    const endInp = card.querySelector('#looperEndBar');

    card.querySelector('#btnDecrStartBar')?.addEventListener('click', () => {
      if (startInp) {
        startInp.value = Math.max(1, parseInt(startInp.value) - 1);
        this._updateRange();
      }
    });

    card.querySelector('#btnIncrStartBar')?.addEventListener('click', () => {
      if (startInp) {
        startInp.value = parseInt(startInp.value) + 1;
        this._updateRange();
      }
    });

    card.querySelector('#btnDecrEndBar')?.addEventListener('click', () => {
      if (endInp) {
        endInp.value = Math.max(parseInt(startInp?.value || 1), parseInt(endInp.value) - 1);
        this._updateRange();
      }
    });

    card.querySelector('#btnIncrEndBar')?.addEventListener('click', () => {
      if (endInp) {
        endInp.value = parseInt(endInp.value) + 1;
        this._updateRange();
      }
    });

    startInp?.addEventListener('change', () => this._updateRange());
    endInp?.addEventListener('change', () => this._updateRange());

    // Selección rápida de compases
    card.querySelectorAll('.btn-quick-bars').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const start = parseInt(e.target.dataset.start);
        const end = parseInt(e.target.dataset.end);
        if (startInp) startInp.value = start;
        if (endInp) endInp.value = end;
        this._updateRange();
      });
    });

    // Speed Trainer Toggle
    card.querySelector('#chkEnableSpeedTrainer')?.addEventListener('change', (e) => {
      this.engine.setSpeedTrainerEnabled(e.target.checked);
      card.querySelector('.looper-section-card:nth-child(2)')?.classList.toggle('trainer-active', e.target.checked);
    });

    // Píldoras de velocidad inicial
    card.querySelectorAll('.btn-speed-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sp = parseFloat(e.target.dataset.speed);
        this.engine.configureSpeedTrainer(sp, this.engine.targetSpeed, this.engine.stepIncrease);
        card.querySelectorAll('.btn-speed-pill').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.speed) === sp));
      });
    });

    // Píldoras de velocidad objetivo
    card.querySelectorAll('.btn-target-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tgt = parseFloat(e.target.dataset.target);
        this.engine.configureSpeedTrainer(this.engine.initialSpeed, tgt, this.engine.stepIncrease);
        card.querySelectorAll('.btn-target-pill').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.target) === tgt));
      });
    });

    // Botón principal de Activar / Desactivar
    const toggleBtn = card.querySelector('#btnLooperToggle');
    toggleBtn?.addEventListener('click', () => {
      this._updateRange();
      const newState = this.engine.toggleLooper();
      this.open('#looper-modal-container');
      if (newState) {
        toast.show(`Smart Looper activo: Compases ${this.engine.startBar} a ${this.engine.endBar} al ${Math.round(this.engine.currentSpeed * 100)}%`, 'success');
      } else {
        toast.show('Bucle detenido', 'info');
      }
    });

    // Restablecer
    card.querySelector('#btnLooperReset')?.addEventListener('click', () => {
      this.engine.toggleLooper(false);
      this.engine.setBarRange(1, 4);
      this.engine.configureSpeedTrainer(0.70, 1.00, 0.05);
      this.open('#looper-modal-container');
      toast.show('Looper restablecido', 'info');
    });

    // Escuchar actualizaciones de ciclo
    events.on('looper:cycleCompleted', ({ cycleNumber, currentSpeed, targetSpeed, isTargetReached }) => {
      const statusEl = card.querySelector('#lblLooperLiveStatus');
      if (statusEl) {
        statusEl.textContent = `Vuelta ${cycleNumber} completada · Velocidad actual: ${Math.round(currentSpeed * 100)}% BPM ${isTargetReached ? '(¡Objetivo alcanzado! 🏆)' : ''}`;
      }
    });
  }

  _updateRange() {
    const card = document.querySelector('#modal-smart-looper');
    if (!card) return;
    const startInp = card.querySelector('#looperStartBar');
    const endInp = card.querySelector('#looperEndBar');
    const s = parseInt(startInp?.value || 1);
    const e = parseInt(endInp?.value || 4);
    this.engine.setBarRange(s, e);
  }
}

export const smartLooperTool = new SmartLooperTool();
export default smartLooperTool;
