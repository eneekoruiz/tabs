/**
 * @file MidiController.js
 * @description Gestor de la Web MIDI API para controlar el avance de la canción o tocar en modo Arcade.
 */

import { events } from '../core/EventBus.js';

export class MidiController {
  constructor() {
    this.midiAccess = null;
    this.inputs = [];
    this.isActive = false;
    this._handleMidiMessage = this._handleMidiMessage.bind(this);
    this._handleStateChange = this._handleStateChange.bind(this);
  }

  /**
   * Solicita acceso a los dispositivos MIDI conectados.
   */
  async initialize() {
    if (!navigator.requestMIDIAccess) {
      console.warn('[MidiController] Web MIDI API no está soportada en este navegador.');
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this.midiAccess.onstatechange = this._handleStateChange;
      this._scanInputs();
      this.isActive = true;
      console.log('[MidiController] Inicializado correctamente.');
      return true;
    } catch (err) {
      console.error('[MidiController] Permiso MIDI denegado o error de hardware:', err);
      return false;
    }
  }

  /**
   * Escanea las entradas MIDI disponibles y les añade el listener.
   * @private
   */
  _scanInputs() {
    if (!this.midiAccess) return;
    
    this.inputs = [];
    for (const input of this.midiAccess.inputs.values()) {
      this.inputs.push(input);
      input.onmidimessage = this._handleMidiMessage;
      console.log(`[MidiController] Conectado a: ${input.name}`);
    }
  }

  /**
   * Maneja cambios de conexión de hardware (plug/unplug).
   * @param {MIDIConnectionEvent} event 
   * @private
   */
  _handleStateChange(event) {
    console.log(`[MidiController] Puerto ${event.port.name} ha cambiado a estado: ${event.port.state}`);
    this._scanInputs();
    events.emit('midi:stateChange', {
      name: event.port.name,
      state: event.port.state,
      type: event.port.type
    });
  }

  /**
   * Parsea y distribuye los mensajes MIDI.
   * @param {MIDIMessageEvent} message 
   * @private
   */
  _handleMidiMessage(message) {
    const data = message.data;
    const command = data[0] >> 4;
    const channel = data[0] & 0xf;
    const note = data[1];
    const velocity = data.length > 2 ? data[2] : 0;

    // Command 9 es Note On (si velocity > 0)
    // Command 8 es Note Off
    if (command === 9 && velocity > 0) {
      events.emit('midi:noteOn', { channel, note, velocity });
    } else if (command === 8 || (command === 9 && velocity === 0)) {
      events.emit('midi:noteOff', { channel, note, velocity: 0 });
    }
  }

  /**
   * Detiene la escucha MIDI y limpia referencias.
   */
  destroy() {
    this.isActive = false;
    if (this.midiAccess) {
      this.midiAccess.onstatechange = null;
      for (const input of this.inputs) {
        input.onmidimessage = null;
      }
    }
    this.inputs = [];
    this.midiAccess = null;
  }
}

// Exportamos un Singleton para toda la app
export const midiController = new MidiController();
