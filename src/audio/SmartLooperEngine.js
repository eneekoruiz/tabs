/**
 * @file SmartLooperEngine.js
 * @description Motor de Smart Looper y Speed Trainer (Práctica en Bucle con Aceleración Progresiva).
 * Permite seleccionar rangos de compases o marcas de tiempo A-B y sincroniza la repetición
 * aumentando automáticamente la velocidad (+5% por ciclo) tras cada vuelta completada con éxito.
 */

import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { audioEngine } from '../core/AudioEngine.js';
import { practiceTrackerService } from '../data/PracticeTrackerService.js';
import { audioFeedback } from './AudioFeedback.js';

export class SmartLooperEngine {
  constructor() {
    this.isEnabled = false;
    this.startBar = 1;
    this.endBar = 4;
    this.startTime = 0; // en segundos (para backing track o lyrics)
    this.endTime = 10;

    // Configuración del Speed Trainer
    this.isSpeedTrainerActive = true;
    this.initialSpeed = 0.70; // 70%
    this.currentSpeed = 0.70;
    this.targetSpeed = 1.00;  // 100%
    this.stepIncrease = 0.05; // +5%
    this.cyclesPerStep = 1;

    // Métricas de la sesión de bucle
    this.currentCycle = 0;
    this.totalLoopsCompleted = 0;
    this.activeSongTitle = '';

    this.checkIntervalId = null;
    this.lastCheckedPosition = 0;
    this.initEvents();
  }

  initEvents() {
    // Escuchar cambios de compás o posición en la partitura / reproducción
    events.on('playback:state', ({ state: playState }) => {
      if (playState === 'playing' && this.isEnabled) {
        this._startLoopMonitor();
      } else {
        this._stopLoopMonitor();
      }
    });

    events.on('score:loaded', ({ score }) => {
      if (score && score.masterBars && score.masterBars.length > 0) {
        this.startBar = 1;
        this.endBar = Math.min(8, score.masterBars.length);
      }
    });
  }

  /**
   * Configura el rango de compases y activa el bucle
   */
  setBarRange(startBar, endBar) {
    this.startBar = Math.max(1, parseInt(startBar) || 1);
    this.endBar = Math.max(this.startBar, parseInt(endBar) || (this.startBar + 3));

    if (this.isEnabled) {
      this._applyToAudioEngine();
    }

    events.emit('looper:rangeChanged', {
      startBar: this.startBar,
      endBar: this.endBar,
      isEnabled: this.isEnabled
    });
  }

  /**
   * Configura el rango de tiempo en segundos (para backing tracks o audio libre)
   */
  setTimeRange(startSec, endSec) {
    this.startTime = Math.max(0, parseFloat(startSec) || 0);
    this.endTime = Math.max(this.startTime + 1, parseFloat(endSec) || (this.startTime + 10));

    events.emit('looper:timeRangeChanged', {
      startTime: this.startTime,
      endTime: this.endTime
    });
  }

  /**
   * Activa o desactiva el Smart Looper
   */
  toggleLooper(forceState = null) {
    this.isEnabled = forceState !== null ? forceState : !this.isEnabled;

    if (this.isEnabled) {
      this.currentCycle = 1;
      this.currentSpeed = this.initialSpeed;
      this._applyToAudioEngine();
      audioEngine.setPlaybackSpeed(this.currentSpeed);
      this._startLoopMonitor();
    } else {
      audioEngine.clearLoop();
      this._stopLoopMonitor();
    }

    events.emit('looper:stateChanged', {
      isEnabled: this.isEnabled,
      startBar: this.startBar,
      endBar: this.endBar,
      currentSpeed: this.currentSpeed,
      isSpeedTrainerActive: this.isSpeedTrainerActive,
      currentCycle: this.currentCycle
    });

    return this.isEnabled;
  }

  /**
   * Configuración del Speed Trainer (+5% por ciclo)
   */
  configureSpeedTrainer(initialSpeed = 0.70, targetSpeed = 1.00, stepIncrease = 0.05) {
    this.initialSpeed = Math.max(0.3, Math.min(1.5, initialSpeed));
    this.targetSpeed = Math.max(this.initialSpeed, Math.min(2.0, targetSpeed));
    this.stepIncrease = Math.max(0.01, Math.min(0.20, stepIncrease));
    this.currentSpeed = this.initialSpeed;

    events.emit('looper:speedTrainerConfigured', {
      initialSpeed: this.initialSpeed,
      targetSpeed: this.targetSpeed,
      stepIncrease: this.stepIncrease
    });
  }

  setSpeedTrainerEnabled(enabled) {
    this.isSpeedTrainerActive = !!enabled;
    events.emit('looper:speedTrainerToggled', this.isSpeedTrainerActive);
  }

  /**
   * Notificación cuando se completa un ciclo del bucle
   */
  handleLoopCycleCompleted() {
    this.totalLoopsCompleted++;
    this.currentCycle++;

    // Registrar en analíticas silenciosas
    const song = state.get('activeSong');
    if (song && song.title) {
      practiceTrackerService.recordSession({
        songTitle: song.title,
        minutes: 0.5,
        speedTrainerTarget: Math.round(this.currentSpeed * 100)
      });
    }

    // Si el Speed Trainer está activo, subir velocidad
    if (this.isSpeedTrainerActive && this.currentSpeed < this.targetSpeed) {
      const nextSpeed = Math.min(this.targetSpeed, Math.round((this.currentSpeed + this.stepIncrease) * 100) / 100);
      this.currentSpeed = nextSpeed;

      // Aplicar al motor de reproducción
      audioEngine.setPlaybackSpeed(this.currentSpeed);

      // Feedback sonoro motivacional
      audioFeedback.playSuccess();
    } else if (this.currentSpeed >= this.targetSpeed) {
      audioFeedback.playAchievement();
    }

    events.emit('looper:cycleCompleted', {
      cycleNumber: this.currentCycle,
      currentSpeed: this.currentSpeed,
      targetSpeed: this.targetSpeed,
      isTargetReached: this.currentSpeed >= this.targetSpeed
    });
  }

  _applyToAudioEngine() {
    if (audioEngine && audioEngine.api) {
      audioEngine.setLoopRange(this.startBar, this.endBar);
    }
  }

  _startLoopMonitor() {
    this._stopLoopMonitor();

    // Monitorear finalización de bucle por tiempo / ticks
    this.checkIntervalId = setInterval(() => {
      if (!this.isEnabled || !audioEngine.api) return;

      const playback = state.get('playback');
      if (playback.state !== 'playing') return;

      // Si AlphaTab vuelve al inicio del bucle, detectar ciclo
      const curTick = audioEngine.api.tickPosition;
      if (this.lastCheckedPosition > 0 && curTick < this.lastCheckedPosition - 1000) {
        this.handleLoopCycleCompleted();
      }
      this.lastCheckedPosition = curTick;
    }, 250);
  }

  _stopLoopMonitor() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    this.lastCheckedPosition = 0;
  }

  dispose() {
    this.toggleLooper(false);
  }
}

export const smartLooperEngine = new SmartLooperEngine();
export default smartLooperEngine;
