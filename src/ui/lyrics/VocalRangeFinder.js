/**
 * @file VocalRangeFinder.js
 * @description Modal guiado "Encuentra tu Rango Vocal" con rigor científico y acústico.
 * Basado en la pedagogía vocal clásica (Richard Miller - The Structure of Singing,
 * Dr. Ingo Titze - Principles of Voice Production y el sistema alemán Fach).
 *
 * Características:
 * - Clasificación diferenciada para Voces Femeninas (Soprano, Mezzo-Soprano, Contralto)
 *   y Voces Masculinas (Tenor, Barítono, Bajo).
 * - Cálculo de zonas de transición (Primo & Secondo Passaggio) y Tesitura cómoda.
 * - Filtrado estadístico robusto (percentiles P10 y P90) para eliminar transitorios y ruido de micrófono.
 * - 100% Legal & GDPR Compliance: Procesamiento puramente acústico en RAM del navegador
 *   (Web Audio API). Ningún audio, grabación ni dato biométrico sale jamás del dispositivo.
 */

import { events } from '../../core/EventBus.js';

export const FEMALE_RANGES = [
  {
    id: 'soprano',
    category: 'female',
    label: 'Soprano',
    emoji: '🎶',
    desc: 'La voz femenina más aguda y brillante. Gran facilidad en el registro de cabeza y agilidades líricas.',
    minMidi: 60, // C4 (261 Hz)
    maxMidi: 84, // C6 (1046 Hz)
    tessitura: 'Sol4 – La5 (392 Hz – 880 Hz)',
    primoPassaggio: 'Mi♭4 (Eb4 · 311 Hz)',
    secondoPassaggio: 'Fa#5 (F#5 · 740 Hz)',
    gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
    color: '#a78bfa'
  },
  {
    id: 'mezzo',
    category: 'female',
    label: 'Mezzo-Soprano',
    emoji: '🎵',
    desc: 'Voz femenina intermedia. Timbre cálido, aterciopelado, con un centro robusto y armónicos ricos.',
    minMidi: 57, // A3 (220 Hz)
    maxMidi: 81, // A5 (880 Hz)
    tessitura: 'Mi4 – Fa5 (330 Hz – 698 Hz)',
    primoPassaggio: 'Mi4 (E4 · 330 Hz)',
    secondoPassaggio: 'Mi5 (E5 · 659 Hz)',
    gradient: 'linear-gradient(135deg, #4338ca, #818cf8)',
    color: '#818cf8'
  },
  {
    id: 'contralto',
    category: 'female',
    label: 'Contralto',
    emoji: '🎤',
    desc: 'La voz femenina más grave y noble. Timbre profundo, gran resonancia de pecho y riqueza tímbrica.',
    minMidi: 53, // F3 (174 Hz)
    maxMidi: 77, // F5 (698 Hz)
    tessitura: 'Do4 – Re5 (261 Hz – 587 Hz)',
    primoPassaggio: 'Re4 (D4 · 293 Hz)',
    secondoPassaggio: 'Re5 (D5 · 587 Hz)',
    gradient: 'linear-gradient(135deg, #0369a1, #38bdf8)',
    color: '#38bdf8'
  }
];

export const MALE_RANGES = [
  {
    id: 'tenor',
    category: 'male',
    label: 'Tenor',
    emoji: '🎙️',
    desc: 'La voz masculina más aguda. Timbre brillante, dinámico y con gran facilidad en el registro agudo.',
    minMidi: 48, // C3 (130 Hz)
    maxMidi: 72, // C5 (523 Hz)
    tessitura: 'Sol3 – La4 (196 Hz – 440 Hz)',
    primoPassaggio: 'Do#4 (C#4 · 277 Hz)',
    secondoPassaggio: 'Fa#4 (F#4 · 370 Hz)',
    gradient: 'linear-gradient(135deg, #059669, #34d399)',
    color: '#34d399'
  },
  {
    id: 'baritono',
    category: 'male',
    label: 'Barítono',
    emoji: '🎼',
    desc: 'Voz masculina intermedia. El equilibrio perfecto entre calidez melódica, potencia y resonancia.',
    minMidi: 43, // G2 (98 Hz)
    maxMidi: 67, // G4 (392 Hz)
    tessitura: 'Mi3 – Mi4 (164 Hz – 330 Hz)',
    primoPassaggio: 'Si♭3 (Bb3 · 233 Hz)',
    secondoPassaggio: 'Mi♭4 (Eb4 · 311 Hz)',
    gradient: 'linear-gradient(135deg, #b45309, #fbbf24)',
    color: '#fbbf24'
  },
  {
    id: 'bajo',
    category: 'male',
    label: 'Bajo',
    emoji: '🥁',
    desc: 'La voz masculina más grave y rotunda. Timbre oscuro, solemne y gran resonancia sub-armónica.',
    minMidi: 40, // E2 (82 Hz)
    maxMidi: 64, // E4 (329 Hz)
    tessitura: 'Do3 – Do4 (130 Hz – 261 Hz)',
    primoPassaggio: 'La3 (A3 · 220 Hz)',
    secondoPassaggio: 'Re4 (D4 · 293 Hz)',
    gradient: 'linear-gradient(135deg, #b91c1c, #f87171)',
    color: '#f87171'
  }
];

export const ALL_VOCAL_RANGES = [...FEMALE_RANGES, ...MALE_RANGES];

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
    this.capturedLow  = null; // { midi, note, octave, freq }
    this.capturedHigh = null;
    this._pitchUnsub  = null;
    this._lowBuf  = [];  // Lecturas MIDI en fase grave
    this._highBuf = [];  // Lecturas MIDI en fase aguda
    this.selectedGender = 'female'; // 'female' | 'male'
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
        <div class="vrf-badge">CIENCIA VOCAL & PEDAGOGÍA ACÚSTICA</div>
        <h2 class="vrf-title">Calibra tu<br>Rango Vocal</h2>
        <p class="vrf-subtitle">Análisis acústico en 2 pasos basado en la física del sonido y el sistema Fach internacional.</p>
        
        <!-- Selector de Tipo de Voz Femenina / Masculina -->
        <div class="vrf-gender-selector" role="group" aria-label="Tipo de voz">
          <button type="button" class="btn-vrf-gender ${this.selectedGender === 'female' ? 'active' : ''}" data-gender="female">
            👩 Voz Femenina
          </button>
          <button type="button" class="btn-vrf-gender ${this.selectedGender === 'male' ? 'active' : ''}" data-gender="male">
            👨 Voz Masculina
          </button>
        </div>

        <div class="vrf-steps-preview">
          <div class="vrf-step-item">
            <span class="vrf-step-num">1</span>
            <div>
              <strong>Nota más GRAVE sostenida</strong>
              <span>Canta tu tono bajo cómodo durante 3 s (voz de pecho)</span>
            </div>
          </div>
          <div class="vrf-step-item">
            <span class="vrf-step-num">2</span>
            <div>
              <strong>Nota más AGUDA sostenida</strong>
              <span>Canta tu tono alto cómodo durante 3 s (sin forzar la garganta)</span>
            </div>
          </div>
        </div>

        <div class="vrf-scale-preview" id="vrfScalePreview">
          ${this._renderScalePreviewList()}
        </div>

        <button class="vrf-btn-start" id="vrfStartBtn">🎤 Iniciar Calibración</button>

        <!-- Compliance & Privacidad RGPD -->
        <div class="vrf-privacy-footnote">
          <span class="privacy-icon">🛡️</span>
          <span><strong>Privacidad 100% On-Device (RGPD compliant):</strong> El análisis se procesa en tiempo real en la memoria RAM del navegador. Ningún audio sale jamás de tu dispositivo.</span>
        </div>
      </div>
    `;
  }

  _renderScalePreviewList() {
    const list = this.selectedGender === 'female' ? FEMALE_RANGES : MALE_RANGES;
    return list.map(r => `
      <div class="vrf-range-row">
        <span class="vrf-range-label">${r.emoji} ${r.label}</span>
        <div class="vrf-range-bar-bg">
          <div class="vrf-range-bar-fill" style="background:${r.gradient}"></div>
        </div>
      </div>
    `).join('');
  }

  _tplCapture(stepLabel, instruction, phase) {
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
        <p class="vrf-hint">${phase === 'low' ? 'Mantén un tono bajo continuo y natural en voz de pecho' : 'Mantén un tono alto cómodo y estable'}</p>
      </div>
    `;
  }

  _tplResult() {
    const r = this._classify();
    const lowName  = this._midiName(this.capturedLow?.midi);
    const highName = this._midiName(this.capturedHigh?.midi);
    const lowHz    = Math.round(this.capturedLow?.freq ?? 0);
    const highHz   = Math.round(this.capturedHigh?.freq ?? 0);
    const list     = this.selectedGender === 'female' ? FEMALE_RANGES : MALE_RANGES;

    return `
      <div class="vrf-card vrf-card-result">
        <button class="vrf-close" id="vrfClose" aria-label="Cerrar">✕</button>
        <div class="vrf-badge">RESULTADO ACÚSTICO FACH</div>
        <div class="vrf-result-emoji">${r.emoji}</div>
        <div class="vrf-result-label" style="color:${r.color}">${r.label}</div>
        <p class="vrf-result-desc">${r.desc}</p>

        <!-- Toggle rápido para contrastar Femenino / Masculino -->
        <div class="vrf-result-gender-toggle">
          <button type="button" class="btn-res-gender ${this.selectedGender === 'female' ? 'active' : ''}" data-gender="female">
            👩 Clasificación Femenina
          </button>
          <button type="button" class="btn-res-gender ${this.selectedGender === 'male' ? 'active' : ''}" data-gender="male">
            👨 Clasificación Masculina
          </button>
        </div>

        <div class="vrf-metrics-grid">
          <div class="vrf-metric-card">
            <span class="metric-title">Rango Extremo</span>
            <span class="metric-val">${lowName} – ${highName}</span>
            <span class="metric-sub">${lowHz} Hz – ${highHz} Hz</span>
          </div>
          <div class="vrf-metric-card">
            <span class="metric-title">Tesitura Óptima</span>
            <span class="metric-val">${r.tessitura}</span>
            <span class="metric-sub">Zona de máxima resonancia</span>
          </div>
          <div class="vrf-metric-card">
            <span class="metric-title">Primo Passaggio</span>
            <span class="metric-val">${r.primoPassaggio}</span>
            <span class="metric-sub">Transición pecho / mixta</span>
          </div>
          <div class="vrf-metric-card">
            <span class="metric-title">Secondo Passaggio</span>
            <span class="metric-val">${r.secondoPassaggio}</span>
            <span class="metric-sub">Transición mixta / cabeza</span>
          </div>
        </div>

        <div class="vrf-result-bars">
          ${list.map(rv => {
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

        <button class="vrf-btn-retry" id="vrfRetryBtn">↺ Calibrar de nuevo</button>

        <div class="vrf-privacy-footnote" style="margin-top: 14px;">
          <span>⚖️ <strong>Fundamentación Teórica:</strong> Fórmulas acústicas normalizadas ISO 16:1975 (A4=440Hz). Datos 100% locales en tu navegador.</span>
        </div>
      </div>
    `;
  }

  // ─── Captura y Análisis DSP ────────────────────────────────────────────────

  async _startCapture(phase) {
    if (!this.engine.isRunning) {
      try { await this.engine.start(); } catch (e) { console.warn('[VRF] engine start error', e); }
    }

    const stepLabel   = phase === 'low' ? 'PASO 1 DE 2: TONO MÁS GRAVE' : 'PASO 2 DE 2: TONO MÁS AGUDO';
    const instruction = phase === 'low'
      ? 'Canta tu nota más <em>GRAVE</em> cómoda'
      : 'Ahora canta tu nota más <em>AGUDA</em> cómoda';
    this.overlay.innerHTML = this._tplCapture(stepLabel, instruction, phase);
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
      if (p.midi >= 36 && p.midi <= 88) {
        if (phase === 'low')  this._lowBuf.push({ midi: p.midi, freq: p.frequency });
        else                  this._highBuf.push({ midi: p.midi, freq: p.frequency });
      }
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

  /**
   * Filtrado estadístico robusto para descartar transitorios y chasquidos de micrófono.
   * Utiliza el percentil 12 para la nota más grave y el percentil 88 para la más aguda.
   */
  _bestPitch(buf, mode) {
    if (!buf || !buf.length) {
      const defaultMidi = mode === 'low' ? 57 : 72;
      return { midi: defaultMidi, freq: 440 * Math.pow(2, (defaultMidi - 69) / 12), note: 'A', octave: 3 };
    }

    const sorted = [...buf].sort((a, b) => a.midi - b.midi);

    let idx;
    if (mode === 'low') {
      idx = Math.floor(sorted.length * 0.12);
    } else {
      idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.88));
    }

    const item = sorted[idx];
    const midi = item.midi;
    const freq = item.freq;
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    return {
      midi,
      freq,
      note: names[midi % 12],
      octave: Math.floor(midi / 12) - 1
    };
  }

  _showResult() {
    this.overlay.innerHTML = this._tplResult();
    this._bindClose();
    this._bindResultEvents();
  }

  _bindResultEvents() {
    this.overlay.querySelector('#vrfRetryBtn')?.addEventListener('click', () => this._retry());

    this.overlay.querySelectorAll('.btn-res-gender').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = btn.dataset.gender;
        if (g && g !== this.selectedGender) {
          this.selectedGender = g;
          this._showResult();
        }
      });
    });
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

  /**
   * Clasificación acústica euclídea normalizada según el rango Fach activo.
   */
  _classify() {
    const list = this.selectedGender === 'female' ? FEMALE_RANGES : MALE_RANGES;
    const lo  = this.capturedLow?.midi  ?? (this.selectedGender === 'female' ? 57 : 45);
    const hi  = this.capturedHigh?.midi ?? (this.selectedGender === 'female' ? 77 : 65);
    const mid = (lo + hi) / 2;

    let best = list[0];
    let bestDist = Infinity;
    for (const r of list) {
      const center = (r.minMidi + r.maxMidi) / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = r;
      }
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

    this.overlay.querySelectorAll('.btn-vrf-gender').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = btn.dataset.gender;
        if (g) {
          this.selectedGender = g;
          this.overlay.querySelectorAll('.btn-vrf-gender').forEach(b => b.classList.toggle('active', b.dataset.gender === g));
          const previewEl = this.overlay.querySelector('#vrfScalePreview');
          if (previewEl) previewEl.innerHTML = this._renderScalePreviewList();
        }
      });
    });
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
