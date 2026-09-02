/**
 * @file HandsFreeController.js
 * @description Controlador de voz (Web Speech API) y gestos para mantener las manos en el instrumento.
 */

import { events } from '../core/EventBus.js';

export class HandsFreeController {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this._initSpeechRecognition();
  }

  _initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[HandsFreeController] Web Speech API no está soportada en este navegador.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'es-ES'; // Podría ser dinámico

    this.recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const command = event.results[last][0].transcript.trim().toLowerCase();
      console.log('[HandsFreeController] Comando de voz detectado:', command);
      this._parseCommand(command);
    };

    this.recognition.onerror = (event) => {
      console.error('[HandsFreeController] Error de reconocimiento:', event.error);
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        // Reiniciar automáticamente para continuous listening
        this.recognition.start();
      }
    };
  }

  start() {
    if (!this.recognition || this.isListening) return;
    this.isListening = true;
    this.recognition.start();
    console.log('[HandsFreeController] Escucha activa iniciada.');
    events.emit('handsFree:started');
  }

  stop() {
    if (!this.recognition || !this.isListening) return;
    this.isListening = false;
    this.recognition.stop();
    console.log('[HandsFreeController] Escucha detenida.');
    events.emit('handsFree:stopped');
  }

  _parseCommand(command) {
    if (command.includes('tocar') || command.includes('play')) {
      events.emit('song:play');
    } else if (command.includes('parar') || command.includes('stop')) {
      events.emit('song:pause');
    } else if (command.includes('subir tono') || command.includes('sube el tono')) {
      events.emit('song:transpose', 1);
    } else if (command.includes('bajar tono') || command.includes('baja el tono')) {
      events.emit('song:transpose', -1);
    } else if (command.includes('metrónomo')) {
      events.emit('metronome:toggle');
    }
  }
}

export const handsFreeController = new HandsFreeController();
