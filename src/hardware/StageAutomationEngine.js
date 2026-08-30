/**
 * @file StageAutomationEngine.js
 * @description Motor de Stage Automation y Control de Hardware Físico mediante Web MIDI API.
 * Automatiza el envío de órdenes Program Change (PC) y Control Change (CC) vía USB a pedaleras
 * de escenario reales (Kemper, Line 6 Helix, Quad Cortex) según el compás de la partitura.
 */

import { events } from '../core/EventBus.js';

export class StageAutomationEngine {
  constructor() {
    this.midiAccess = null;
    this.midiOutputs = [];
    this.selectedOutputId = null;
    this.isEnabled = false;

    // Mapa de Automatización de Escenario: Compás (number) -> Array de Comandos MIDI
    // Comando: { type: 'PC' | 'CC', channel: 1..16, number: 0..127, value: 0..127, presetName: 'High-Gain Lead' }
    this.automationMap = new Map();
    this.lastTriggeredBar = -1;

    this.initEvents();
  }

  async initMIDI() {
    if (this.midiAccess) return true;
    try {
      if (navigator.requestMIDIAccess) {
        this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        this._updateMIDIOutputs();
        this.midiAccess.onstatechange = () => this._updateMIDIOutputs();
        return true;
      }
    } catch (e) {
      console.warn('[StageAutomationEngine] Web MIDI API no accesible o mockeado:', e);
    }
    return false;
  }

  _updateMIDIOutputs() {
    this.midiOutputs = [];
    if (this.midiAccess && this.midiAccess.outputs) {
      for (const output of this.midiAccess.outputs.values()) {
        this.midiOutputs.push({
          id: output.id,
          name: output.name || `Puerto MIDI ${output.id}`,
          manufacturer: output.manufacturer || 'Hardware Generico'
        });
      }
    }

    if (this.midiOutputs.length > 0 && !this.selectedOutputId) {
      this.selectedOutputId = this.midiOutputs[0].id;
    }

    events.emit('stageAutomation:devicesUpdated', { outputs: this.midiOutputs, selectedId: this.selectedOutputId });
  }

  initEvents() {
    events.on('playback:time', ({ currentBar }) => {
      if (this.isEnabled && currentBar !== this.lastTriggeredBar) {
        this.lastTriggeredBar = currentBar;
        this._executeBarAutomation(currentBar);
      }
    });

    events.on('playback:state', ({ state }) => {
      if (state === 'stopped') {
        this.lastTriggeredBar = -1;
      }
    });
  }

  selectOutputDevice(outputId) {
    this.selectedOutputId = outputId;
    events.emit('stageAutomation:deviceSelected', { selectedId: outputId });
  }

  addBarMapping(barNumber, command) {
    const bar = Math.max(1, parseInt(barNumber, 10));
    if (!this.automationMap.has(bar)) {
      this.automationMap.set(bar, []);
    }
    const cmdList = this.automationMap.get(bar);
    cmdList.push({
      id: Date.now() + Math.random(),
      type: command.type || 'PC', // 'PC' | 'CC'
      channel: command.channel || 1, // 1..16
      number: command.number || 0,   // 0..127 (Program # o Controller #)
      value: command.value || 127,   // 0..127 (solo para CC)
      presetName: command.presetName || `Preset Compás ${bar}`
    });
    events.emit('stageAutomation:mappingChanged', { map: Array.from(this.automationMap.entries()) });
  }

  removeBarMapping(barNumber, commandId) {
    if (this.automationMap.has(barNumber)) {
      let list = this.automationMap.get(barNumber);
      list = list.filter(c => c.id !== commandId);
      if (list.length === 0) this.automationMap.delete(barNumber);
      else this.automationMap.set(barNumber, list);

      events.emit('stageAutomation:mappingChanged', { map: Array.from(this.automationMap.entries()) });
    }
  }

  _executeBarAutomation(barNumber) {
    const commands = this.automationMap.get(barNumber);
    if (!commands || commands.length === 0) return;

    commands.forEach(cmd => {
      this.sendMIDICommand(cmd);
    });
  }

  /**
   * Envía un comando MIDI físico directo a la pedalera USB seleccionada.
   */
  sendMIDICommand(cmd) {
    const channel = (cmd.channel - 1) & 0x0F;
    let bytes = [];

    if (cmd.type === 'PC') {
      // 0xC0 = Program Change
      const status = 0xC0 | channel;
      bytes = [status, cmd.number & 0x7F];
    } else if (cmd.type === 'CC') {
      // 0xB0 = Control Change
      const status = 0xB0 | channel;
      bytes = [status, cmd.number & 0x7F, cmd.value & 0x7F];
    }

    // Enviar vía Web MIDI API si hay un puerto abierto
    if (this.midiAccess && this.selectedOutputId) {
      const output = this.midiAccess.outputs.get(this.selectedOutputId);
      if (output) {
        try {
          output.send(bytes);
        } catch (e) {
          console.warn('[StageAutomation] Error enviando bytes MIDI:', e);
        }
      }
    }

    events.emit('stageAutomation:midiSent', {
      cmd,
      bytes,
      timestamp: performance.now(),
      targetDevice: this.selectedOutputId
    });
  }

  toggleAutomation(forceState) {
    this.isEnabled = typeof forceState === 'boolean' ? forceState : !this.isEnabled;
    events.emit('stageAutomation:stateChanged', { isEnabled: this.isEnabled });
    return this.isEnabled;
  }
}

export const stageAutomationEngine = new StageAutomationEngine();
export default stageAutomationEngine;
