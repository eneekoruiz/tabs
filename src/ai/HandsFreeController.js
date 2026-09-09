/**
 * @file HandsFreeController.js
 * @description Controlador de voz (Web Speech API) y gestos para mantener las manos en el instrumento.
 */

import { events } from '../core/EventBus.js';

export class HandsFreeController {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.manualStop = false;
    this.permissionDenied = false;
    this.restartTimer = null;
    this.permissionWarningShown = false;
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
      const error = event?.error || 'unknown';
      if (error === 'not-allowed' || error === 'service-not-allowed') {
        this.permissionDenied = true;
        this.isListening = false;
        clearTimeout(this.restartTimer);
        if (!this.permissionWarningShown) {
          this.permissionWarningShown = true;
          console.warn('[HandsFreeController] El navegador no ha concedido permiso para la escucha activa.');
          events.emit('handsFree:permissionDenied');
        }
        return;
      }
      // Los errores transitorios no deben llenar la consola mientras el
      // reconocimiento intenta recuperarse en segundo plano.
      console.warn('[HandsFreeController] Reconocimiento temporalmente no disponible:', error);
    };

    this.recognition.onend = () => {
      if (!this.isListening || this.manualStop || this.permissionDenied) return;
      // Algunos motores finalizan la sesión aunque continuous sea true.
      // Reintentamos con una pequeña pausa para evitar carreras start/stop.
      clearTimeout(this.restartTimer);
      this.restartTimer = setTimeout(() => {
        if (!this.isListening || this.manualStop || this.permissionDenied) return;
        try { this.recognition.start(); } catch (_) { /* ya estaba iniciada */ }
      }, 180);
    };
  }

  start() {
    if (!this.recognition || this.isListening) return;
    this.manualStop = false;
    this.permissionDenied = false;
    this.permissionWarningShown = false;
    this.isListening = true;
    try {
      this.recognition.start();
    } catch (error) {
      this.isListening = false;
      console.warn('[HandsFreeController] No se pudo iniciar la escucha activa:', error?.message || error);
      return;
    }
    console.log('[HandsFreeController] Escucha activa iniciada.');
    events.emit('handsFree:started');
  }

  stop() {
    if (!this.recognition || !this.isListening) return;
    this.manualStop = true;
    this.isListening = false;
    clearTimeout(this.restartTimer);
    try { this.recognition.stop(); } catch (_) { /* ya estaba detenida */ }
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
