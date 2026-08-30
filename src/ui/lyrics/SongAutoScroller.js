/**
 * @file SongAutoScroller.js
 * @description Smooth song auto-scroll with explicit lifecycle and end detection.
 */

const END_EPSILON_PX = 2;
const END_CONFIRMATION_FRAMES = 3;
const EMPTY_CONTENT_CONFIRMATION_FRAMES = 15;

export class SongAutoScroller {
  constructor(options = {}) {
    this.speedPercent = Math.max(1, Math.min(100, Number(options.initialSpeed) || 35));
    this.isRunning = false;
    this.rafId = null;
    this.lastTimestamp = null;
    this.endCandidateFrames = 0;
    this.hasAnnouncedEnd = false;
    this.onStateChange = options.onStateChange || (() => {});
    this.onEnd = options.onEnd || (() => {});
  }

  setSpeed(percent) {
    this.speedPercent = Math.max(1, Math.min(100, Number(percent) || 1));
    this.emitState('speed');
  }

  stepSpeed(delta) {
    this.setSpeed(this.speedPercent + Number(delta || 0));
  }

  toggle() {
    if (this.isRunning) this.stop('explicit');
    else this.start();
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.endCandidateFrames = 0;
    this.hasAnnouncedEnd = false;

    const step = (timestamp) => {
      if (!this.isRunning) return;

      const elapsed = Math.max(0, Math.min(64, timestamp - this.lastTimestamp));
      this.lastTimestamp = timestamp;
      const metrics = this.readScrollMetrics();

      if (this.confirmEnd(metrics)) {
        this.finishAtEnd();
        return;
      }

      const pixelsPerSecond = 6 + (this.speedPercent / 100) * 234;
      const distance = (pixelsPerSecond * elapsed) / 1000;
      this.writeScrollTop(metrics, Math.min(metrics.maxScrollTop, metrics.scrollTop + distance));
      this.rafId = requestAnimationFrame(step);
    };

    this.rafId = requestAnimationFrame(step);
    this.emitState('start');
  }

  stop(reason = 'explicit') {
    const wasRunning = this.isRunning;
    this.isRunning = false;
    this.lastTimestamp = null;
    this.endCandidateFrames = 0;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (wasRunning) this.emitState(reason);
  }

  pause() {
    this.stop('view-hidden');
  }

  finishAtEnd() {
    if (this.hasAnnouncedEnd) return;
    this.hasAnnouncedEnd = true;
    this.stop('end');
    this.onEnd({ speedPercent: this.speedPercent });
  }

  confirmEnd(metrics) {
    const contentIsEmpty = metrics.maxScrollTop <= END_EPSILON_PX;
    const isAtEnd = !contentIsEmpty && metrics.scrollTop >= metrics.maxScrollTop - END_EPSILON_PX;

    if (!contentIsEmpty && !isAtEnd) {
      this.endCandidateFrames = 0;
      return false;
    }

    this.endCandidateFrames += 1;
    const requiredFrames = contentIsEmpty
      ? EMPTY_CONTENT_CONFIRMATION_FRAMES
      : END_CONFIRMATION_FRAMES;
    return this.endCandidateFrames >= requiredFrames;
  }

  readScrollMetrics() {
    const target = document.getElementById('score-viewport');
    if (target) {
      return {
        target,
        scrollTop: target.scrollTop,
        maxScrollTop: Math.max(0, target.scrollHeight - target.clientHeight)
      };
    }

    const root = document.scrollingElement || document.documentElement;
    return {
      target: window,
      scrollTop: window.scrollY || root.scrollTop || 0,
      maxScrollTop: Math.max(0, root.scrollHeight - window.innerHeight)
    };
  }

  writeScrollTop(metrics, top) {
    if (metrics.target === window) window.scrollTo({ top, behavior: 'auto' });
    else metrics.target.scrollTop = top;
  }

  emitState(reason) {
    this.onStateChange({
      isRunning: this.isRunning,
      speedPercent: this.speedPercent,
      reason
    });
  }

  scrollToTop() {
    const target = document.getElementById('score-viewport') || window;
    if (target.scrollTo) target.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

export default SongAutoScroller;