/**
 * @file VocalRangeFinder.js
 * @description Modal guiado "Encuentra tu Rango Vocal".
 * Fase 1 (3 s): canta la nota más GRAVE cómoda.
 * Fase 2 (3 s): canta la nota más AGUDA cómoda.
 * Resultado: clasificación (Soprano/Mezzo/Contralto/Tenor/Barítono/Bajo) con
 * gráfico de barras vertical estilo Simply Sing.
 */

import { events } from '../../core/EventBus.js';

const VOCAL_RANGES = [
  { id: 'soprano',   label: 'Soprano',       emoji: '🎶', desc: 'La voz femenina más aguda',   minMidi: 60, maxMidi: 84, gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#a78bfa' },
  { id: 'mezzo',     label: 'Mezzo-Soprano', emoji: '🎵', desc: 'Voz femenina intermedia',     minMidi: 57, maxMidi: 81, gradient: 'linear-gradient(135deg,#4338ca,#818cf8)', color: '#818cf8' },
  { id: 'contralto', label: 'Contralto',     emoji: '🎤', desc: 'La voz femenina más grave',   minMidi: 53, maxMidi: 77, gradient: 'linear-gradient(135deg,#0369a1,#38bdf8)', color: '#38bdf8' },
  { id: 'tenor',     label: 'Tenor',         emoji: '🎙️', desc: 'La voz masculina más aguda', minMidi: 48, maxMidi: 72, gradient: 'linear-gradient(135deg,#059669,#34d399)', color: '#34d399' },
  { id: 'baritono',  label: 'Barítono',      emoji: '🎼', desc: 'Voz masculina intermedia',    minMidi: 43, maxMidi: 67, gradient: 'linear-gradient(135deg,#b45309,#fbbf24)', color: '#fbbf24' },
  { id: 'bajo',      label: 'Bajo',          emoji: '🥁', desc: 'La voz masculina más grave',  minMidi: 40, maxMidi: 64, gradient: 'linear-gradient(135deg,#b91c1c,#f87171)', color: '#f87171' },
];

const CAPTURE_MS = 3000;

export class VocalRangeFinder {
  static instance = null;

  /**
   * @param {{ vocalCoachEngine: import('../../audio/VocalCoachEngine.js').VocalCoachEngine }} options
   */
  static open({ vocalCoachEngine }) {
    if (this.instance) this.instance.close();
    this.instance = new VocalRangeFinder(vocalCoachEngine);
    this.instance.mount();
  }

  constructor(engine) {
    this.engine   = engine;
    this.overlay  = null;
    this.rafId    = null;
    this.capturedLow  = null; // { midi, note, octave }
    this.capturedHigh = null;
    this._pitchUnsub  = null;
    this._lowBuf  = [];  // MIDI readings during low capture
    this._highBuf = [];
  }

  mount() {
    this._ensureStyles();
    const overlay = document.createElement('div');
    overlay.className = 'vrf-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Encuentra tu rango vocal');
    overlay.innerHTML = this._tplIntro();
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this._bindClose();
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  _tplIntro() {
    return `
      <div class="vrf-card">
        <button class="vrf-close" id="vrfClose" aria-label="Cerrar">✕</button>
        <div class="vrf-badge">CALIBRACIÓN VOCAL</div>
        <h2 class="vrf-title">Encuentra tu<br>Rango Vocal</h2>
        <p class="vrf-subtitle">Test rápido en 2 pasos para clasificar tu tipo de voz con precisión.</p>
        <div class="vrf-steps-preview">
          <div class="vrf-step-item">
            <span class="vrf-step-num">1</span>
            <div>
              <strong>Nota más GRAVE</strong>
              <span>Canta tu nota baja cómoda (3 s)</span>
            </div>
          </div>
          <div class="vrf-step-item">
            <span class="vrf-step-num">2</span>
            <div>
              <strong>Nota más AGUDA</strong>
              <span>Canta tu nota alta cómoda (3 s)</span>
            </div>
          </div>
        </div>
        <div class="vrf-scale-preview">
          ${VOCAL_RANGES.map(r => `
            <div class="vrf-range-row">
              <span class="vrf-range-label">${r.emoji} ${r.label}</span>
              <div class="vrf-range-bar-bg">
                <div class="vrf-range-bar-fill" style="background:${r.gradient}"></div>
              </div>
            </div>
          `).join('')}
        </div>
        <button class="vrf-btn-start" id="vrfStartBtn">🎤 Iniciar Test</button>
      </div>
    `;
  }

  _tplCapture(stepLabel, instruction) {
    return `
      <div class="vrf-card">
        <button class="vrf-close" id="vrfClose" aria-label="Cerrar">✕</button>
        <div class="vrf-badge vrf-badge-live">🔴 ${stepLabel}</div>
        <h2 class="vrf-title vrf-title-sm">${instruction}</h2>
        <div class="vrf-capture-bar-wrap">
          <div class="vrf-capture-bar" id="vrfCaptureBar"></div>
        </div>
        <div class="vrf-live-note-big" id="vrfLiveNote">—</div>
        <div class="vrf-live-hz" id="vrfLiveHz">0 Hz</div>
        <p class="vrf-hint">Mantén la nota estable y cómoda durante todo el tiempo</p>
      </div>
    `;
  }

  _tplResult() {
    const r = this._classify();
    const lowName  = this._midiName(this.capturedLow?.midi);
    const highName = this._midiName(this.capturedHigh?.midi);
    return `
      <div class="vrf-card vrf-card-result">
        <button class="vrf-close" id="vrfClose" aria-label="Cerrar">✕</button>
        <div class="vrf-badge">TU RANGO VOCAL</div>
        <div class="vrf-result-emoji">${r.emoji}</div>
        <div class="vrf-result-label" style="color:${r.color}">${r.label}</div>
        <p class="vrf-result-desc">${r.desc}</p>
        <p class="vrf-result-range">Rango detectado: <strong>${lowName} – ${highName}</strong></p>
        <div class="vrf-result-bars">
          ${VOCAL_RANGES.map(rv => {
            const active = rv.id === r.id;
            return `
              <div class="vrf-bar-row ${active ? 'vrf-bar-row-active' : ''}">
                <span class="vrf-bar-label">${rv.label}</span>
                <div class="vrf-bar-track">
                  <div class="vrf-bar-fill"
                    style="background:${active ? rv.gradient : 'rgba(255,255,255,0.08)'};
                           width:${active ? '100%' : '24%'};
                           transition: width 0.7s cubic-bezier(0.16,1,0.3,1) ${active ? '0.1s' : '0s'}">
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <button class="vrf-btn-retry" id="vrfRetryBtn">↺ Revisar de nuevo</button>
      </div>
    `;
  }

  // ─── Captura ──────────────────────────────────────────────────────────────

  async _startCapture(phase) {
    if (!this.engine.isRunning) {
      try { await this.engine.start(); } catch (e) { console.warn('[VRF] engine start error', e); }
    }

    const stepLabel   = phase === 'low' ? 'PASO 1 DE 2' : 'PASO 2 DE 2';
    const instruction = phase === 'low'
      ? 'Canta tu nota más <em>GRAVE</em> cómoda'
      : 'Ahora canta tu nota más <em>AGUDA</em> cómoda';
    this.overlay.innerHTML = this._tplCapture(stepLabel, instruction);
    this._bindClose();

    const barEl  = this.overlay.querySelector('#vrfCaptureBar');
    const noteEl = this.overlay.querySelector('#vrfLiveNote');
    const hzEl   = this.overlay.querySelector('#vrfLiveHz');

    if (phase === 'low')  this._lowBuf  = [];
    else                  this._highBuf = [];

    // Listener de pitch
    this._pitchUnsub?.();
    this._pitchUnsub = events.on('vocalCoach:pitch', (p) => {
      if (noteEl) noteEl.textContent = `${p.note}${p.octave ?? ''}`;
      if (hzEl)   hzEl.textContent   = `${Math.round(p.frequency)} Hz`;
      if (phase === 'low')  this._lowBuf.push(p.midi);
      else                  this._highBuf.push(p.midi);
    });

    // Barra de progreso animada con rAF
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, (elapsed / CAPTURE_MS) * 100);
      if (barEl) barEl.style.width = `${pct}%`;

      if (elapsed < CAPTURE_MS) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this._pitchUnsub?.();
        if (phase === 'low') {
          this.capturedLow = this._bestPitch(this._lowBuf, 'low');
          this._startCapture('high');
        } else {
          this.capturedHigh = this._bestPitch(this._highBuf, 'high');
          this._showResult();
        }
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  _bestPitch(buf, mode) {
    if (!buf.length) return null;
    const midi = mode === 'low' ? Math.min(...buf) : Math.max(...buf);
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    return { midi, note: names[midi % 12], octave: Math.floor(midi / 12) - 1 };
  }

  _showResult() {
    this.overlay.innerHTML = this._tplResult();
    this._bindClose();
    this.overlay.querySelector('#vrfRetryBtn')?.addEventListener('click', () => this._retry());
  }

  _retry() {
    cancelAnimationFrame(this.rafId);
    this._pitchUnsub?.();
    this.capturedLow  = null;
    this.capturedHigh = null;
    this._lowBuf  = [];
    this._highBuf = [];
    this.overlay.innerHTML = this._tplIntro();
    this._bindClose();
  }

  // ─── Clasificación ────────────────────────────────────────────────────────

  _classify() {
    const lo  = this.capturedLow?.midi  ?? 48;
    const hi  = this.capturedHigh?.midi ?? 72;
    const mid = (lo + hi) / 2;
    let best = VOCAL_RANGES[0], bestDist = Infinity;
    for (const r of VOCAL_RANGES) {
      const dist = Math.abs((r.minMidi + r.maxMidi) / 2 - mid);
      if (dist < bestDist) { bestDist = dist; best = r; }
    }
    return best;
  }

  _midiName(midi) {
    if (midi == null) return '—';
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
  }

  // ─── Plomería ─────────────────────────────────────────────────────────────

  _bindClose() {
    this.overlay.querySelector('#vrfClose')?.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    this.overlay.querySelector('#vrfStartBtn')?.addEventListener('click', () => this._startCapture('low'));
  }

  close() {
    cancelAnimationFrame(this.rafId);
    this._pitchUnsub?.();
    this.overlay?.remove();
    this.overlay = null;
    VocalRangeFinder.instance = null;
  }

  _ensureStyles() {
    if (document.querySelector('link[data-vrf-styles]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../../../assets/css/components/vocal-range-finder.css', import.meta.url).href;
    link.dataset.vrfStyles = 'true';
    document.head.appendChild(link);
  }
}

export default VocalRangeFinder;
