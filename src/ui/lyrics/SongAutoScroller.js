/**
 * @file SongAutoScroller.js
 * @description Gestor de auto-scroll fluido con control porcentual y optimización con requestAnimationFrame.
 */

export class SongAutoScroller {
  constructor(options = {}) {
    this.speedPercent = options.initialSpeed || 35;
    this.isRunning = false;
    this.rafId = null;
    this.lastTimestamp = null;
    this.onStateChange = options.onStateChange || (() => {});
  }

  setSpeed(percent) {
    this.speedPercent = Math.max(1, Math.min(100, percent));
    this.onStateChange({ isRunning: this.isRunning, speedPercent: this.speedPercent });
  }

  stepSpeed(delta) {
    this.setSpeed(this.speedPercent + delta);
  }

  toggle() {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();

    const step = (timestamp) => {
      if (!this.isRunning) return;

      const elapsed = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;

      // Velocidad calibrada: 1% = 6px/segundo, 100% = 240px/segundo
      const pixelsPerSecond = 6 + (this.speedPercent / 100) * 234;
      const distance = (pixelsPerSecond * elapsed) / 1000;

      const scrollEl = document.getElementById('score-viewport') || window;
      if (scrollEl.scrollBy) {
        scrollEl.scrollBy({ top: distance, behavior: 'auto' });
      } else if (window.scrollBy) {
        window.scrollBy(0, distance);
      }

      this.rafId = requestAnimationFrame(step);
    };

    this.rafId = requestAnimationFrame(step);
    this.onStateChange({ isRunning: true, speedPercent: this.speedPercent });
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.onStateChange({ isRunning: false, speedPercent: this.speedPercent });
  }

  scrollToTop() {
    const scrollEl = document.getElementById('score-viewport') || window;
    if (scrollEl.scrollTo) {
      scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

export default SongAutoScroller;
