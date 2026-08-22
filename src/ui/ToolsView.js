/**
 * @file ToolsView.js
 * @description Suite Completa de Herramientas de Estudio del Músico Pro.
 * Orquesta 6 herramientas desacopladas con Principio de Responsabilidad Única (SRP):
 * 1. ⏱️ Metrónomo Web Audio de Precisión (MetronomeTool)
 * 2. 🎵 Afinador Cromático con Pitch Pipe (TunerTool)
 * 3. 📚 Diccionario de Acordes & Voicings (ChordDictionaryTool)
 * 4. 👂 Entrenador de Oído Armónico (EarTrainerTool)
 * 5. 🎸 Calculadora de Cejilla / Capotraste (CapoCalculatorTool)
 * 6. ⭕ Círculo de Quintas Interactivo (CircleOfFifthsTool)
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { chordEngine } from '../tools/ChordEngine.js';
import { toast } from './Toast.js';
import { MetronomeTool } from './tools/MetronomeTool.js';
import { TunerTool } from './tools/TunerTool.js';
import { ChordDictionaryTool } from './tools/ChordDictionaryTool.js';
import { EarTrainerTool } from './tools/EarTrainerTool.js';
import { CapoCalculatorTool } from './tools/CapoCalculatorTool.js';
import { CircleOfFifthsTool } from './tools/CircleOfFifthsTool.js';

export class ToolsView extends Component {
  constructor(container) {
    super(container);
    this.audioCtx = null;
    this.activeToolModal = null;

    const getAudioCtx = () => this.getAudioContext();

    this.metronomeTool = new MetronomeTool(getAudioCtx);
    this.tunerTool = new TunerTool(getAudioCtx);
    this.chordDictTool = new ChordDictionaryTool();
    this.earTrainerTool = new EarTrainerTool();
    this.capoCalcTool = new CapoCalculatorTool();
    this.circleTool = new CircleOfFifthsTool();

    this.initEvents();
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  initEvents() {
    this.registerUnsub(events.on('ui:openTool', (toolName) => {
      this.openToolModal(toolName);
    }));
  }

  openToolModal(toolName) {
    this.activeToolModal = toolName;
    const modalHost = this.container?.querySelector('#toolModalHost');
    if (!modalHost) return;

    switch (toolName) {
      case 'metronome':
        modalHost.innerHTML = this.metronomeTool.renderModal();
        this.bindMetronomeEvents();
        break;
      case 'tuner':
        modalHost.innerHTML = this.tunerTool.renderModal();
        this.bindTunerEvents();
        break;
      case 'dictionary':
        modalHost.innerHTML = this.chordDictTool.renderModal();
        this.bindDictEvents();
        break;
      case 'ear':
        modalHost.innerHTML = this.earTrainerTool.renderModal();
        this.bindEarEvents();
        this.earTrainerTool.startTest(this.container);
        break;
      case 'capo':
        modalHost.innerHTML = this.capoCalcTool.renderModal();
        this.bindCapoEvents();
        break;
      case 'circle':
        modalHost.innerHTML = this.circleTool.renderModal();
        this.bindCircleEvents();
        break;
      default:
        modalHost.innerHTML = '';
        this.activeToolModal = null;
    }

    modalHost.querySelectorAll('#btnCloseToolModal, .btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeModal();
      });
    });
  }

  closeModal() {
    if (this.activeToolModal === 'metronome') {
      this.metronomeTool.stop(this.container);
    }
    this.activeToolModal = null;
    const modalHost = this.container?.querySelector('#toolModalHost');
    if (modalHost) modalHost.innerHTML = '';
  }

  bindMetronomeEvents() {
    const host = this.container?.querySelector('#toolModalHost');
    if (!host) return;

    host.querySelector('#btnToggleMetronome')?.addEventListener('click', () => {
      this.metronomeTool.toggle(this.container);
    });

    host.querySelector('#btnTapTempo')?.addEventListener('click', () => {
      this.metronomeTool.handleTapTempo(this.container);
    });

    host.querySelectorAll('.btn-bpm-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.dataset.delta, 10);
        this.metronomeTool.setBpm(this.metronomeTool.bpm + delta, this.container);
      });
    });

    host.querySelector('#rngMetronomeBpm')?.addEventListener('input', (e) => {
      this.metronomeTool.setBpm(parseInt(e.target.value, 10), this.container);
    });

    host.querySelectorAll('.metro-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const param = btn.dataset.param;
        const val = btn.dataset.val;
        if (param) this.metronomeTool[param] = val;
        this.openToolModal('metronome');
      });
    });
  }

  bindTunerEvents() {
    const host = this.container?.querySelector('#toolModalHost');
    if (!host) return;

    host.querySelector('#selTuningPreset')?.addEventListener('change', (e) => {
      this.tunerTool.selectedTuning = e.target.value;
      this.openToolModal('tuner');
    });

    host.querySelectorAll('.tuner-string-card').forEach(card => {
      card.addEventListener('click', () => {
        const freq = parseFloat(card.dataset.freq);
        const note = card.dataset.note;
        this.tunerTool.playPitch(freq, note);
      });
    });
  }

  bindDictEvents() {
    const host = this.container?.querySelector('#toolModalHost');
    if (!host) return;

    host.querySelectorAll('.dict-inst-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.chordDictTool.instrument = btn.dataset.inst;
        this.openToolModal('dictionary');
      });
    });

    host.querySelectorAll('.dict-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const val = btn.dataset.val;
        if (type === 'root') this.chordDictTool.root = val;
        if (type === 'quality') this.chordDictTool.quality = val;
        this.openToolModal('dictionary');
      });
    });

    host.querySelector('#btnDictAudition')?.addEventListener('click', (e) => {
      const chord = e.currentTarget.dataset.chord;
      chordEngine.auditionChord(chord, this.chordDictTool.instrument);
      toast.show(`Sonando ${chord}`, 'info', 600);
    });
  }

  bindEarEvents() {
    const host = this.container?.querySelector('#toolModalHost');
    if (!host) return;

    host.querySelectorAll('.ear-diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.earTrainerTool.difficulty = btn.dataset.diff;
        this.openToolModal('ear');
      });
    });

    host.querySelector('#btnPlayEarChord')?.addEventListener('click', () => {
      this.earTrainerTool.playCurrentChord(this.container);
    });
  }

  bindCapoEvents() {
    const host = this.container?.querySelector('#toolModalHost');
    if (!host) return;

    host.querySelectorAll('.dict-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const val = btn.dataset.val;
        if (type === 'targetKey') this.capoCalcTool.targetKey = val;
        if (type === 'openShape') this.capoCalcTool.openShape = val;
        this.capoCalcTool.updateUI(this.container);
        this.openToolModal('capo');
      });
    });
  }

  bindCircleEvents() {
    const host = this.container?.querySelector('#toolModalHost');
    if (!host) return;

    host.querySelectorAll('.circle-key-sector, .circle-minor-sector').forEach(sector => {
      sector.addEventListener('click', () => {
        const key = sector.dataset.key;
        if (key) {
          this.circleTool.key = key;
          this.circleTool.updateUI(this.container);
        }
      });
    });
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="tools-view-container" role="main" aria-label="Herramientas del Músico Pro">
        
        <div class="tools-dashboard-header">
          <div class="tools-header-badge">ESTUDIO & PRÁCTICA PROFESIONAL</div>
          <h1 class="tools-main-title">Herramientas del Músico Pro</h1>
          <p class="tools-subtitle">Metrónomo de precisión, afinador cromático, entrenador auditivo, diccionario y armonía avanzada.</p>
        </div>

        <div class="tools-cards-grid">
          <!-- 1. METRÓNOMO -->
          <div class="tool-card-pro premium-list-item" data-tool="metronome" role="button" tabindex="0" aria-label="Abrir Metrónomo">
            <div class="tool-card-icon-box">⏱️</div>
            <div class="tool-card-body">
              <span class="tool-card-badge">TIEMPO REAL</span>
              <h2 class="tool-card-title">Metrónomo de Precisión</h2>
              <p class="tool-card-desc">Subdivisiones (3illos, semicorcheas), TAP tempo, acento del primer pulso y timbres clásicos.</p>
            </div>
            <button class="btn-open-tool-action">Abrir Metrónomo →</button>
          </div>

          <!-- 2. AFINADOR -->
          <div class="tool-card-pro premium-list-item" data-tool="tuner" role="button" tabindex="0" aria-label="Abrir Afinador">
            <div class="tool-card-icon-box">🎵</div>
            <div class="tool-card-body">
              <span class="tool-card-badge">DIAPASÓN</span>
              <h2 class="tool-card-title">Afinador & Diapasón</h2>
              <p class="tool-card-desc">Tonos de referencia para afinaciones Standard, Drop D, DADGAD, Open G, Bajo y Ukelele.</p>
            </div>
            <button class="btn-open-tool-action">Abrir Afinador →</button>
          </div>

          <!-- 3. DICCIONARIO DE ACORDES -->
          <div class="tool-card-pro premium-list-item" data-tool="dictionary" role="button" tabindex="0" aria-label="Abrir Diccionario de Acordes">
            <div class="tool-card-icon-box">📚</div>
            <div class="tool-card-body">
              <span class="tool-card-badge">VOICINGS</span>
              <h2 class="tool-card-title">Diccionario de Acordes</h2>
              <p class="tool-card-desc">Diagramas SVG interactivos de acordes mayores, menores, 7mas, maj7 y tensiones con audio arpegiado.</p>
            </div>
            <button class="btn-open-tool-action">Ver Diccionario →</button>
          </div>

          <!-- 4. ENTRENADOR DE OÍDO -->
          <div class="tool-card-pro premium-list-item" data-tool="ear" role="button" tabindex="0" aria-label="Abrir Entrenador de Oído">
            <div class="tool-card-icon-box">👂</div>
            <div class="tool-card-body">
              <span class="tool-card-badge">GAME / TEST</span>
              <h2 class="tool-card-title">Entrenador de Oído</h2>
              <p class="tool-card-desc">Desafía tu oído reconociendo tríadas, cuatríadas y acordes con tensiones por niveles de dificultad.</p>
            </div>
            <button class="btn-open-tool-action">Entrenar Oído →</button>
          </div>

          <!-- 5. CALCULADORA DE CEJILLA -->
          <div class="tool-card-pro premium-list-item" data-tool="capo" role="button" tabindex="0" aria-label="Abrir Calculadora de Cejilla">
            <div class="tool-card-icon-box">🎸</div>
            <div class="tool-card-body">
              <span class="tool-card-badge">TRANSPOSICIÓN</span>
              <h2 class="tool-card-title">Calculadora de Cejilla</h2>
              <p class="tool-card-desc">Calcula el traste óptico del capo para cantar en tu tono manteniendo posiciones abiertas.</p>
            </div>
            <button class="btn-open-tool-action">Calcular Capo →</button>
          </div>

          <!-- 6. CÍRCULO DE QUINTAS -->
          <div class="tool-card-pro premium-list-item" data-tool="circle" role="button" tabindex="0" aria-label="Abrir Círculo de Quintas">
            <div class="tool-card-icon-box">⭕</div>
            <div class="tool-card-body">
              <span class="tool-card-badge">COMPOSICIÓN</span>
              <h2 class="tool-card-title">Círculo de Quintas</h2>
              <p class="tool-card-desc">Visualiza armaduras, escalas relativas menores y familias armónicas de acordes I-IV-V-vi al instante.</p>
            </div>
            <button class="btn-open-tool-action">Ver Círculo →</button>
          </div>
        </div>

        <div id="toolModalHost"></div>
      </div>
    `;

    this.bindDashboardEvents();
  }

  bindDashboardEvents() {
    this.container.querySelectorAll('.tool-card-pro, .premium-list-item').forEach(card => {
      card.addEventListener('click', () => {
        const tool = card.dataset.tool;
        if (tool) this.openToolModal(tool);
      });
    });
  }
}

export default ToolsView;
