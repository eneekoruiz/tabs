/**
 * @file AudioSpectrumVisualizer.js
 * @description Visualizador de Espectro de Frecuencias y Osciloscopio en Tiempo Real (FFT 60 FPS).
 * Muestra barras luminosas de ecualizador y espectrograma neon para cualquier salida de audio de la app.
 */

import { Component } from './Component.js';

export class AudioSpectrumVisualizer extends Component {
  constructor(container) {
    super(container);
    this.canvas = null;
    this.ctx = null;
    this.analyser = null;
    this.animFrameId = null;
    this.dataArray = null;
    this.isRendering = false;
  }

  setAudioNode(analyserNode) {
    this.analyser = analyserNode;
    if (this.analyser) {
      this.analyser.fftSize = 64;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
    }
  }

  render() {
    return `
      <div class="audio-spectrum-wrapper">
        <canvas id="audioSpectrumCanvas" class="audio-spectrum-canvas" width="220" height="32"></canvas>
      </div>
    `;
  }

  attachListeners() {
    this.canvas = this.container?.querySelector('#audioSpectrumCanvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.startLoop();
    }
  }

  startLoop() {
    this.isRendering = true;

    const draw = () => {
      if (!this.isRendering) return;
      this.drawSpectrum();
      this.animFrameId = requestAnimationFrame(draw);
    };

    draw();
  }

  drawSpectrum() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const barCount = 16;
    const barWidth = (w / barCount) - 2;

    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);
    }

    for (let i = 0; i < barCount; i++) {
      const val = this.dataArray ? (this.dataArray[i] / 255) : (0.1 + 0.15 * Math.sin(performance.now() * 0.005 + i));
      const barHeight = Math.max(3, val * h);
      const x = i * (barWidth + 2);
      const y = h - barHeight;

      const grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(0.7, '#ec4899');
      grad.addColorStop(1, '#eab308');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }
  }

  stop() {
    this.isRendering = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}

export default AudioSpectrumVisualizer;
