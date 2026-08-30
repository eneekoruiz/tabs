/**
 * @file PedalboardTool.js
 * @description Interfaz de Pedalera Virtual y Simulador de Amplificador con Smart Tone proactivo.
 * Pedales boutique con footswitches iluminados, knobs analógicos interactivos y medidor VU.
 */

import { Component } from '../Component.js';
import { events } from '../../core/EventBus.js';
import { state } from '../../core/State.js';
import { pedalboardEngine } from '../../audio/PedalboardEngine.js';
import { toast } from '../Toast.js';

export class PedalboardTool extends Component {
  constructor() {
    super(null);
    this.engine = pedalboardEngine;
    this.initEvents();
  }

  initEvents() {
    events.on('pedalboard:open', () => this.open('#pedalboard-modal-container'));
    events.on('song:loaded', (song) => {
      if (this.engine) {
        this.engine.detectToneForSong(song);
      }
    });
  }

  open(targetContainerSelector = '#pedalboard-modal-container') {
    let host = document.querySelector(targetContainerSelector);
    if (!host || host.offsetParent === null && targetContainerSelector === '#toolModalHost') {
      host = document.querySelector('#pedalboard-modal-container') || document.querySelector('#toolModalHost');
    }
    if (!host) return;

    this.currentHost = targetContainerSelector;

    // Detectar tono inteligente si hay canción activa y aún no se ha inicializado preset
    const currentSong = state.get('activeSong');
    if (currentSong && !this.engine.currentPreset) {
      this.engine.detectToneForSong(currentSong);
    }

    host.innerHTML = this.renderModal();
    this.attachListeners(host);
  }

  close(host) {
    if (host) host.innerHTML = '';
  }

  renderModal() {
    const isActive = this.engine.isActive;
    const p = this.engine.params;
    const currentSong = state.get('activeSong');

    return `
      <div class="modal-pedalboard-backdrop" role="dialog" aria-modal="true" aria-labelledby="pedalboardTitle">
        <div class="modal-pedalboard-card" id="modal-virtual-pedalboard">
          <!-- Cabecera de la Pedalera -->
          <div class="pedalboard-modal-header">
            <div class="pedalboard-title-group">
              <div class="pedalboard-badge">REALTIME DSP · <10MS ULTRA-LOW LATENCY</div>
              <h2 id="pedalboardTitle" class="pedalboard-modal-title">🎸 Virtual Pedalboard & Amp Simulator</h2>
              <p class="pedalboard-modal-subtitle">Conecta tu guitarra o canta por el micrófono con procesamiento analógico en tiempo real.</p>
            </div>
            <button class="btn-close-pedalboard" id="btnClosePedalboard" aria-label="Cerrar pedalera">✕</button>
          </div>

          <!-- Barra de Control Maestro e Input en Vivo -->
          <div class="pedalboard-input-bar">
            <div class="pedalboard-input-controls">
              <button class="btn-pedalboard-toggle-input ${isActive ? 'active' : ''}" id="btnToggleLiveAudioInput">
                <span class="mic-dot ${isActive ? 'pulse' : ''}"></span>
                ${isActive ? '🔴 ENTRADA EN VIVO ACTIVA' : '🎙️ ACTIVAR ENTRADA (GUITARRA / MIC)'}
              </button>
              <div class="pedalboard-level-meter-wrap">
                <span class="meter-label">SEÑAL:</span>
                <div class="pedalboard-meter-track">
                  <div class="pedalboard-meter-fill" id="pedalboardSignalMeter" style="width: 0%;"></div>
                </div>
              </div>
            </div>

            <!-- Smart Tone Banner -->
            <div class="smart-tone-status-pill">
              <span class="smart-tone-icon">⚡</span>
              <div class="smart-tone-text">
                <strong>Smart Tone Activo:</strong>
                <span>${this._getPresetDisplayName(this.engine.currentPreset)} ${currentSong?.title ? `(para "${currentSong.title}")` : ''}</span>
              </div>
            </div>
          </div>

          <!-- Selector de Presets Rápidos -->
          <div class="pedalboard-presets-bar">
            <span class="presets-label">Presets de Escenario:</span>
            <button class="btn-preset-chip ${this.engine.currentPreset === 'metal' ? 'active' : ''}" data-preset="metal">⚡ High-Gain Lead</button>
            <button class="btn-preset-chip ${this.engine.currentPreset === 'rock' ? 'active' : ''}" data-preset="rock">🎸 British Crunch</button>
            <button class="btn-preset-chip ${this.engine.currentPreset === 'blues' ? 'active' : ''}" data-preset="blues">🎷 Tube Blues</button>
            <button class="btn-preset-chip ${this.engine.currentPreset === 'jazz' ? 'active' : ''}" data-preset="jazz">☕ Velvet Jazz</button>
            <button class="btn-preset-chip ${this.engine.currentPreset === 'pop' ? 'active' : ''}" data-preset="pop">✨ Crystal Chorus</button>
            <button class="btn-preset-chip ${this.engine.currentPreset === 'acoustic' ? 'active' : ''}" data-preset="acoustic">🌲 Acoustic Shimmer</button>
          </div>

          <!-- Rack de Pedales Físicos Virtuales -->
          <div class="pedals-rack-container">
            <!-- 1. Noise Gate Pedal -->
            <div class="pedal-chassis pedal-noise-gate ${p.gateEnabled ? 'enabled' : 'bypassed'}">
              <div class="pedal-header">
                <span class="pedal-name">NOISE GATE</span>
                <div class="pedal-led ${p.gateEnabled ? 'led-on' : ''}"></div>
              </div>
              <div class="pedal-knobs-row">
                <div class="knob-group">
                  <label class="knob-label">THRESHOLD</label>
                  <input type="range" class="pedal-knob-slider" data-param="gateThreshold" min="-70" max="-20" step="1" value="${p.gateThreshold}">
                  <span class="knob-val">${p.gateThreshold} dB</span>
                </div>
              </div>
              <button class="pedal-footswitch" data-toggle="gateEnabled" aria-label="Bypass Noise Gate">
                <div class="footswitch-button"></div>
              </button>
            </div>

            <!-- 2. Overdrive / Amp Drive Pedal -->
            <div class="pedal-chassis pedal-overdrive ${p.driveEnabled ? 'enabled' : 'bypassed'}">
              <div class="pedal-header">
                <span class="pedal-name">TUBE DRIVE & AMP</span>
                <div class="pedal-led ${p.driveEnabled ? 'led-on' : ''}"></div>
              </div>
              <div class="pedal-knobs-row">
                <div class="knob-group">
                  <label class="knob-label">GAIN</label>
                  <input type="range" class="pedal-knob-slider" data-param="driveGain" min="0" max="10" step="0.2" value="${p.driveGain}">
                  <span class="knob-val">${p.driveGain}</span>
                </div>
                <div class="knob-group">
                  <label class="knob-label">TONE</label>
                  <input type="range" class="pedal-knob-slider" data-param="driveTone" min="0" max="10" step="0.2" value="${p.driveTone}">
                  <span class="knob-val">${p.driveTone}</span>
                </div>
              </div>
              <div class="pedal-switch-row">
                <select class="pedal-select-mode" data-param="driveType" aria-label="Tipo de saturación">
                  <option value="tube" ${p.driveType === 'tube' ? 'selected' : ''}>Válvulas (Warm)</option>
                  <option value="crunch" ${p.driveType === 'crunch' ? 'selected' : ''}>Crunch (Plexi)</option>
                  <option value="highgain" ${p.driveType === 'highgain' ? 'selected' : ''}>High-Gain (Lead)</option>
                  <option value="clean" ${p.driveType === 'clean' ? 'selected' : ''}>Clean Boost</option>
                </select>
              </div>
              <button class="pedal-footswitch" data-toggle="driveEnabled" aria-label="Bypass Overdrive">
                <div class="footswitch-button"></div>
              </button>
            </div>

            <!-- 3. EQ & Cab Sim 4x12 -->
            <div class="pedal-chassis pedal-equalizer ${p.cabSimEnabled ? 'enabled' : 'bypassed'}">
              <div class="pedal-header">
                <span class="pedal-name">4x12 CAB & EQ</span>
                <div class="pedal-led ${p.cabSimEnabled ? 'led-on' : ''}"></div>
              </div>
              <div class="pedal-knobs-row">
                <div class="knob-group">
                  <label class="knob-label">BASS</label>
                  <input type="range" class="pedal-knob-slider" data-param="eqBass" min="-10" max="10" step="1" value="${p.eqBass}">
                  <span class="knob-val">${p.eqBass > 0 ? '+' : ''}${p.eqBass}</span>
                </div>
                <div class="knob-group">
                  <label class="knob-label">MID</label>
                  <input type="range" class="pedal-knob-slider" data-param="eqMid" min="-10" max="10" step="1" value="${p.eqMid}">
                  <span class="knob-val">${p.eqMid > 0 ? '+' : ''}${p.eqMid}</span>
                </div>
                <div class="knob-group">
                  <label class="knob-label">TREBLE</label>
                  <input type="range" class="pedal-knob-slider" data-param="eqTreble" min="-10" max="10" step="1" value="${p.eqTreble}">
                  <span class="knob-val">${p.eqTreble > 0 ? '+' : ''}${p.eqTreble}</span>
                </div>
              </div>
              <button class="pedal-footswitch" data-toggle="cabSimEnabled" aria-label="Bypass Cab Sim">
                <div class="footswitch-button"></div>
              </button>
            </div>

            <!-- 4. Chorus Modulation Pedal -->
            <div class="pedal-chassis pedal-chorus ${p.chorusEnabled ? 'enabled' : 'bypassed'}">
              <div class="pedal-header">
                <span class="pedal-name">ANALOG CHORUS</span>
                <div class="pedal-led ${p.chorusEnabled ? 'led-on' : ''}"></div>
              </div>
              <div class="pedal-knobs-row">
                <div class="knob-group">
                  <label class="knob-label">RATE</label>
                  <input type="range" class="pedal-knob-slider" data-param="chorusRate" min="0.5" max="5.0" step="0.1" value="${p.chorusRate}">
                  <span class="knob-val">${p.chorusRate} Hz</span>
                </div>
                <div class="knob-group">
                  <label class="knob-label">MIX</label>
                  <input type="range" class="pedal-knob-slider" data-param="chorusMix" min="0" max="1" step="0.05" value="${p.chorusMix}">
                  <span class="knob-val">${Math.round(p.chorusMix * 100)}%</span>
                </div>
              </div>
              <button class="pedal-footswitch" data-toggle="chorusEnabled" aria-label="Bypass Chorus">
                <div class="footswitch-button"></div>
              </button>
            </div>

            <!-- 5. Delay Pedal -->
            <div class="pedal-chassis pedal-delay ${p.delayEnabled ? 'enabled' : 'bypassed'}">
              <div class="pedal-header">
                <span class="pedal-name">STEREO DELAY</span>
                <div class="pedal-led ${p.delayEnabled ? 'led-on' : ''}"></div>
              </div>
              <div class="pedal-knobs-row">
                <div class="knob-group">
                  <label class="knob-label">TIME</label>
                  <input type="range" class="pedal-knob-slider" data-param="delayTime" min="0.05" max="1.0" step="0.01" value="${p.delayTime}">
                  <span class="knob-val">${Math.round(p.delayTime * 1000)} ms</span>
                </div>
                <div class="knob-group">
                  <label class="knob-label">FEEDBACK</label>
                  <input type="range" class="pedal-knob-slider" data-param="delayFeedback" min="0" max="0.85" step="0.05" value="${p.delayFeedback}">
                  <span class="knob-val">${Math.round(p.delayFeedback * 100)}%</span>
                </div>
                <div class="knob-group">
                  <label class="knob-label">MIX</label>
                  <input type="range" class="pedal-knob-slider" data-param="delayMix" min="0" max="1" step="0.05" value="${p.delayMix}">
                  <span class="knob-val">${Math.round(p.delayMix * 100)}%</span>
                </div>
              </div>
              <button class="pedal-footswitch" data-toggle="delayEnabled" aria-label="Bypass Delay">
                <div class="footswitch-button"></div>
              </button>
            </div>

            <!-- 6. Convolver Reverb Pedal -->
            <div class="pedal-chassis pedal-reverb ${p.reverbEnabled ? 'enabled' : 'bypassed'}">
              <div class="pedal-header">
                <span class="pedal-name">SPACE REVERB</span>
                <div class="pedal-led ${p.reverbEnabled ? 'led-on' : ''}"></div>
              </div>
              <div class="pedal-knobs-row">
                <div class="knob-group">
                  <label class="knob-label">MIX</label>
                  <input type="range" class="pedal-knob-slider" data-param="reverbMix" min="0" max="1" step="0.05" value="${p.reverbMix}">
                  <span class="knob-val">${Math.round(p.reverbMix * 100)}%</span>
                </div>
              </div>
              <div class="pedal-switch-row">
                <select class="pedal-select-mode" data-param="reverbType" aria-label="Tipo de reverberación">
                  <option value="spring" ${p.reverbType === 'spring' ? 'selected' : ''}>Spring (Muelle)</option>
                  <option value="room" ${p.reverbType === 'room' ? 'selected' : ''}>Studio Room</option>
                  <option value="hall" ${p.reverbType === 'hall' ? 'selected' : ''}>Arena Hall</option>
                  <option value="shimmer" ${p.reverbType === 'shimmer' ? 'selected' : ''}>Shimmer Ambient</option>
                </select>
              </div>
              <button class="pedal-footswitch" data-toggle="reverbEnabled" aria-label="Bypass Reverb">
                <div class="footswitch-button"></div>
              </button>
            </div>
          </div>

          <!-- Pie de Acciones -->
          <div class="pedalboard-modal-footer">
            <div class="master-vol-slot">
              <label class="master-label">MASTER OUTPUT:</label>
              <input type="range" class="master-vol-slider" data-param="masterVolume" min="0" max="1.5" step="0.05" value="${p.masterVolume}">
              <span class="master-val" id="lblMasterVol">${Math.round(p.masterVolume * 100)}%</span>
            </div>
            <button class="btn-pedalboard-primary" id="btnPedalboardDone">Listo / Guardar Tono</button>
          </div>
        </div>
      </div>
    `;
  }

  attachListeners(container) {
    const card = container.querySelector('#modal-virtual-pedalboard');
    if (!card) return;

    // Cerrar
    card.querySelector('#btnClosePedalboard')?.addEventListener('click', () => this.close(container));
    card.querySelector('#btnPedalboardDone')?.addEventListener('click', () => this.close(container));

    // Activar / Desactivar entrada de micrófono / guitarra
    const liveBtn = card.querySelector('#btnToggleLiveAudioInput');
    liveBtn?.addEventListener('click', async () => {
      try {
        if (this.engine.isActive) {
          this.engine.stopLiveInput();
          liveBtn.classList.remove('active');
          liveBtn.innerHTML = '<span class="mic-dot"></span> 🎙️ ACTIVAR ENTRADA (GUITARRA / MIC)';
          toast.show('Entrada de audio desactivada', 'info');
        } else {
          await this.engine.startLiveInput();
          liveBtn.classList.add('active');
          liveBtn.innerHTML = '<span class="mic-dot pulse"></span> 🔴 ENTRADA EN VIVO ACTIVA';
          toast.show('¡Procesador DSP activo! Toca tu guitarra o canta.', 'success');
        }
      } catch (err) {
        toast.show('Error accediendo al micrófono: ' + err.message, 'error');
      }
    });

    // Escuchar medidor de señal
    events.on('pedalboard:meter', ({ level }) => {
      const meter = card.querySelector('#pedalboardSignalMeter');
      if (meter) meter.style.width = `${level}%`;
    });

    // Presets
    card.querySelectorAll('.btn-preset-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = e.target.dataset.preset;
        this.engine.applyPreset(preset);
        this.open(this.currentHost || '#pedalboard-modal-container');
        toast.show(`Preset cargado: ${this._getPresetDisplayName(preset)}`, 'info');
      });
    });

    // Footswitches (Bypass)
    card.querySelectorAll('.pedal-footswitch').forEach(sw => {
      sw.addEventListener('click', (e) => {
        const param = sw.dataset.toggle;
        const currentVal = this.engine.params[param];
        this.engine.setParam(param, !currentVal);
        const chassis = sw.closest('.pedal-chassis');
        if (chassis) {
          chassis.classList.toggle('enabled', !currentVal);
          chassis.classList.toggle('bypassed', currentVal);
          const led = chassis.querySelector('.pedal-led');
          if (led) led.classList.toggle('led-on', !currentVal);
        }
      });
    });

    // Sliders / Knobs
    card.querySelectorAll('.pedal-knob-slider, .master-vol-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const param = e.target.dataset.param;
        const val = parseFloat(e.target.value);
        this.engine.setParam(param, val);
        const label = e.target.nextElementSibling;
        if (label && label.classList.contains('knob-val')) {
          if (param === 'chorusMix' || param === 'delayMix' || param === 'reverbMix') {
            label.textContent = `${Math.round(val * 100)}%`;
          } else if (param === 'delayTime') {
            label.textContent = `${Math.round(val * 1000)} ms`;
          } else if (param === 'chorusRate') {
            label.textContent = `${val} Hz`;
          } else if (param === 'gateThreshold') {
            label.textContent = `${val} dB`;
          } else {
            label.textContent = `${val}`;
          }
        }
      });
    });

    // Selectores de Modo
    card.querySelectorAll('.pedal-select-mode').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const param = e.target.dataset.param;
        this.engine.setParam(param, e.target.value);
      });
    });
  }

  _getPresetDisplayName(name) {
    const names = {
      metal: '⚡ High-Gain Lead',
      rock: '🎸 British Crunch',
      blues: '🎷 Warm Tube Blues',
      jazz: '☕ Velvet Jazz Clean',
      pop: '✨ Crystal Chorus & Delay',
      acoustic: '🌲 Acoustic Shimmer'
    };
    return names[name] || '🎸 British Crunch';
  }
}

export const pedalboardTool = new PedalboardTool();
export default pedalboardTool;
