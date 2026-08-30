/**
 * @file StageAutomationTool.js
 * @description Interfaz de Stage Automation (Control de Hardware MIDI Físico).
 * Permite mapear eventos MIDI Program Change (PC) y Control Change (CC) a compases específicos
 * para cambiar automáticamente de preset en pedaleras USB reales (Kemper, Helix, Quad Cortex).
 */

import { Component } from '../Component.js';
import { events } from '../../core/EventBus.js';
import { stageAutomationEngine } from '../../hardware/StageAutomationEngine.js';
import { toast } from '../Toast.js';

export class StageAutomationTool extends Component {
  constructor() {
    super(null);
    this.engine = stageAutomationEngine;
    this.initEvents();
  }

  initEvents() {
    events.on('stageAutomation:open', () => this.open('#stage-automation-modal-container'));
  }

  open(targetContainerSelector = '#stage-automation-modal-container') {
    let host = document.querySelector(targetContainerSelector);
    if (!host || host.offsetParent === null && targetContainerSelector === '#toolModalHost') {
      host = document.querySelector('#stage-automation-modal-container') || document.querySelector('#toolModalHost');
    }
    if (!host) return;

    this.currentHost = targetContainerSelector;
    this.engine.initMIDI();
    host.innerHTML = this.renderModal();
    this.attachListeners(host);
  }

  close(host) {
    if (host) host.innerHTML = '';
  }

  renderModal() {
    const outputs = this.engine.midiOutputs;
    const selectedId = this.engine.selectedOutputId;
    const isEnabled = this.engine.isEnabled;
    const mappings = Array.from(this.engine.automationMap.entries());

    return `
      <div class="modal-stage-backdrop" role="dialog" aria-modal="true" aria-labelledby="stageTitle">
        <div class="modal-stage-card" id="modal-stage-automation">
          <!-- Header -->
          <div class="stage-header">
            <div class="stage-title-group">
              <span class="stage-badge">WEB MIDI API · HARDWARE USB CONTROL</span>
              <h2 id="stageTitle" class="stage-title">🎛️ Stage Automation</h2>
              <p class="stage-subtitle">Cambio automático de efectos en pedaleras físicas USB (Kemper, Helix, Quad Cortex) según el compás de la partitura.</p>
            </div>
            <button class="btn-close-stage" id="btnCloseStage" aria-label="Cerrar Stage Automation">✕</button>
          </div>

          <!-- Body -->
          <div class="stage-body">
            <!-- 1. Selección de Dispositivo MIDI USB -->
            <div class="stage-section-card">
              <h3 class="section-title">1. Dispositivo MIDI Físico de Salida (USB)</h3>
              <div class="midi-select-row">
                <select class="midi-device-select" id="selMidiOutput">
                  ${outputs.length === 0 ? '<option value="">⚠️ No se detectaron pedaleras USB (Conecta Kemper/Helix por USB)</option>' : ''}
                  ${outputs.map(o => `<option value="${o.id}" ${o.id === selectedId ? 'selected' : ''}>${o.name} (${o.manufacturer})</option>`).join('')}
                </select>
                <button class="btn-stage-toggle ${isEnabled ? 'active' : ''}" id="btnToggleStageAuto">
                  ${isEnabled ? '🟢 Automatización ACTIVA' : '⚪ Automatización INACTIVA'}
                </button>
              </div>
            </div>

            <!-- 2. Añadir Mapeo de Compás -->
            <div class="stage-section-card">
              <h3 class="section-title">2. Programar Cambio de Preset por Compás</h3>
              <div class="stage-add-form">
                <div class="form-group">
                  <label for="numTargetBar">Compás</label>
                  <input type="number" id="numTargetBar" min="1" max="500" value="1" class="form-input-short">
                </div>

                <div class="form-group">
                  <label for="selCmdType">Tipo Comando</label>
                  <select id="selCmdType" class="form-select">
                    <option value="PC">Program Change (PC - Cambio de Preset)</option>
                    <option value="CC">Control Change (CC - Activar Pedal/Efecto)</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="numCmdNumber">Número (0-127)</label>
                  <input type="number" id="numCmdNumber" min="0" max="127" value="5" class="form-input-short">
                </div>

                <div class="form-group">
                  <label for="txtPresetLabel">Nombre del Preset</label>
                  <input type="text" id="txtPresetLabel" placeholder="Ej: Solo Lead High Gain" class="form-input-text">
                </div>

                <button class="btn-stage-action primary" id="btnAddStageMapping">+ Guardar Mapeo</button>
              </div>
            </div>

            <!-- 3. Lista de Mapeos Programados -->
            <div class="stage-section-card">
              <h3 class="section-title">3. Tabla de Automatizaciones Mapeadas (${mappings.length})</h3>
              <div class="mappings-table-wrapper">
                ${mappings.length === 0 ? '<p class="empty-mappings-text">No hay automatizaciones programadas para esta canción. Añade la primera arriba.</p>' : `
                  <table class="stage-mappings-table">
                    <thead>
                      <tr>
                        <th>Compás</th>
                        <th>Tipo</th>
                        <th>Comando</th>
                        <th>Nombre Preset</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${mappings.map(([barNum, cmdList]) => cmdList.map(cmd => `
                        <tr>
                          <td><strong>Compás ${barNum}</strong></td>
                          <td><span class="cmd-type-tag ${cmd.type}">${cmd.type}</span></td>
                          <td>Channel ${cmd.channel} · #${cmd.number}</td>
                          <td><strong>${cmd.presetName}</strong></td>
                          <td>
                            <button class="btn-test-cmd" data-bar="${barNum}" data-id="${cmd.id}">⚡ Probar</button>
                            <button class="btn-del-cmd" data-bar="${barNum}" data-id="${cmd.id}">✕</button>
                          </td>
                        </tr>
                      `).join('')).join('')}
                    </tbody>
                  </table>
                `}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  attachListeners(container) {
    const card = container.querySelector('#modal-stage-automation');
    if (!card) return;

    card.querySelector('#btnCloseStage')?.addEventListener('click', () => this.close(container));

    // Cambiar dispositivo
    card.querySelector('#selMidiOutput')?.addEventListener('change', (e) => {
      this.engine.selectOutputDevice(e.target.value);
    });

    // Toggle Automatización
    card.querySelector('#btnToggleStageAuto')?.addEventListener('click', () => {
      const active = this.engine.toggleAutomation();
      card.querySelector('#btnToggleStageAuto').classList.toggle('active', active);
      card.querySelector('#btnToggleStageAuto').textContent = active ? '🟢 Automatización ACTIVA' : '⚪ Automatización INACTIVA';
      toast.show(active ? 'Stage Automation activado. Los compases cambiarán los presets MIDI.' : 'Stage Automation en pausa.', 'info');
    });

    // Añadir Mapeo
    card.querySelector('#btnAddStageMapping')?.addEventListener('click', () => {
      const bar = card.querySelector('#numTargetBar').value;
      const type = card.querySelector('#selCmdType').value;
      const number = card.querySelector('#numCmdNumber').value;
      const label = card.querySelector('#txtPresetLabel').value;

      this.engine.addBarMapping(bar, {
        type,
        number: parseInt(number, 10),
        presetName: label || `Compás ${bar} ${type} #${number}`
      });

      toast.show(`Mapeo guardado: Compás ${bar} -> ${type} #${number}`, 'success');
      this.open(this.currentHost || '#stage-automation-modal-container');
    });

    // Probar o Borrar mapeo
    card.querySelectorAll('.btn-test-cmd').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const bar = parseInt(e.target.dataset.bar, 10);
        const id = parseFloat(e.target.dataset.id);
        const cmds = this.engine.automationMap.get(bar) || [];
        const cmd = cmds.find(c => c.id === id);
        if (cmd) {
          this.engine.sendMIDICommand(cmd);
          toast.show(`Comando MIDI ${cmd.type} #${cmd.number} enviado a pedalera`, 'info');
        }
      });
    });

    card.querySelectorAll('.btn-del-cmd').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const bar = parseInt(e.target.dataset.bar, 10);
        const id = parseFloat(e.target.dataset.id);
        this.engine.removeBarMapping(bar, id);
        this.open(this.currentHost || '#stage-automation-modal-container');
      });
    });
  }
}

export const stageAutomationTool = new StageAutomationTool();
export default stageAutomationTool;
