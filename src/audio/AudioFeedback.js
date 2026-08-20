/**
 * @file AudioFeedback.js
 * @description Gestor de Micro-Feedback de Audio sensorial ultraligero (Web Audio API sintetizado).
 * Inspirado en el estándar de Helen: ENHANCE-ui-audio-micro-feedback.
 * - Cero archivos externos (100% sintetizado en memoria con latencia cero).
 * - Envolventes ultra-cortas (30ms - 150ms) y sutiles (volumen 5% - 12%).
 * - Interruptor maestro de Mute con persistencia en localStorage.
 */

class AudioFeedbackManager {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('app_ui_sound_muted') === 'true';
    this.masterGain = 0.08; // 8% de volumen por defecto para máxima sutileza
  }

  _initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    localStorage.setItem('app_ui_sound_muted', String(this.isMuted));
  }

  getMuted() {
    return this.isMuted;
  }

  playClick() {
    if (this.isMuted) return;
    try {
      this._initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const now = this.ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.035);

      gain.gain.setValueAtTime(this.masterGain * 0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  playTabSwitch() {
    if (this.isMuted) return;
    try {
      this._initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const now = this.ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.045);

      gain.gain.setValueAtTime(this.masterGain * 0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.055);
    } catch (e) {}
  }

  playSuccess() {
    if (this.isMuted) return;
    try {
      this._initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [587.33, 880.00];

      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + (i * 0.05);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(this.masterGain * 0.8, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start);
        osc.stop(start + 0.13);
      });
    } catch (e) {}
  }

  playDismiss() {
    if (this.isMuted) return;
    try {
      this._initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const now = this.ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.04);

      gain.gain.setValueAtTime(this.masterGain * 0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.045);
    } catch (e) {}
  }
}

export const audioFeedback = new AudioFeedbackManager();
export default audioFeedback;
