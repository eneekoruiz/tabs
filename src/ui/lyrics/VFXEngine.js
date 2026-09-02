/**
 * @file VFXEngine.js
 * @description Motor de Gamificación (WebGL / Canvas2D) para renderizar partículas, combos y feedback visual.
 */

import { events } from '../../core/EventBus.js';

export class VFXEngine {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.animationFrameId = null;
    this.isActive = false;

    this.width = 0;
    this.height = 0;

    this._resize = this._resize.bind(this);
    this._loop = this._loop.bind(this);

    window.addEventListener('resize', this._resize);
    this._resize();
  }

  _resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    
    // Soporte para pantallas Retina / High-DPI
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.combo = 0;
    this.score = 0;
    this._loop();

    // Suscribirse a eventos de pitch para generar partículas
    events.on('vocalCoach:pitch', this._handlePitch.bind(this));
    events.on('vocalCoach:silence', this._handleSilence.bind(this));
  }

  stop() {
    this.isActive = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.particles = [];
  }

  _handlePitch(pitchData) {
    if (!this.isActive) return;

    if (pitchData.accuracyStatus === 'in-tune') {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.score += 10 * Math.floor(1 + this.combo / 50);

      // Si hay un cambio de combo importante, generar explosión de chispas
      if (this.combo % 50 === 0) {
        this.spawnExplosion(this.width / 2, this.height / 2, '#FFD700', 30);
      } else {
        // Partículas constantes de rastro
        this.spawnParticle(this.width / 2, this.height / 2, '#00e676');
      }
    } else {
      // Fallo rompe el combo
      this.combo = 0;
    }
  }

  _handleSilence() {
    if (!this.isActive) return;
    // El silencio prolongado también rompe el combo
    if (this.combo > 0) {
      this.combo = 0;
    }
  }

  spawnParticle(x, y, color) {
    this.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 1.0,
      decay: 0.02 + Math.random() * 0.02,
      color,
      size: 2 + Math.random() * 3
    });
  }

  spawnExplosion(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 1.0,
        decay: 0.01 + Math.random() * 0.03,
        color,
        size: 3 + Math.random() * 4
      });
    }
  }

  _loop() {
    if (!this.isActive) return;

    this.ctx.clearRect(0, 0, this.width, this.height);

    // Dibujar UI Gamificada (Score y Combo)
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 24px system-ui';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`SCORE: ${this.score}`, this.width - 20, 40);

    if (this.combo > 10) {
      this.ctx.fillStyle = '#FFD700';
      this.ctx.font = 'bold 32px system-ui';
      this.ctx.textAlign = 'center';
      
      // Efecto pulso para el combo
      const scale = 1 + Math.sin(Date.now() / 100) * 0.1;
      this.ctx.save();
      this.ctx.translate(this.width / 2, 60);
      this.ctx.scale(scale, scale);
      this.ctx.fillText(`${this.combo}x COMBO!`, 0, 0);
      this.ctx.restore();
    }

    // Actualizar y dibujar partículas (Efecto Bloom aproximado)
    this.ctx.globalCompositeOperation = 'lighter';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life;
      this.ctx.fill();
    }
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.globalAlpha = 1.0;

    this.animationFrameId = requestAnimationFrame(this._loop);
  }
}
