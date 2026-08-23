/**
 * @file ToolsView.js
 * @description Herramientas de estudio con vistas rápidas y modales completos.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { chordEngine } from '../tools/ChordEngine.js';
import { toast } from './Toast.js';
import { MetronomeTool } from './tools/MetronomeTool.js';
import { TunerTool, TUNINGS_DATA } from './tools/TunerTool.js';
import { ChordDictionaryTool } from './tools/ChordDictionaryTool.js';
import { EarTrainerTool } from './tools/EarTrainerTool.js';
import { CapoCalculatorTool } from './tools/CapoCalculatorTool.js';
import { CircleOfFifthsTool } from './tools/CircleOfFifthsTool.js';

const PREVIEW_STYLESHEET = 'assets/css/components/tool-previews.css?v=20260823';
const TOOL_NAMES = {
  metronome: 'Metrónomo de precisión',
  tuner: 'Afinador y diapasón',
  dictionary: 'Diccionario de acordes',
  ear: 'Entrenador de oído',
  capo: 'Calculadora de cejilla',
  circle: 'Círculo de quintas'
};

const CHORD_ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const CHORD_QUALITIES = [
  { value: 'maj', label: 'Mayor' },
  { value: 'min', label: 'Menor' },
  { value: '7', label: 'Dominante 7' },
  { value: 'maj7', label: 'Mayor 7' },
  { value: 'm7', label: 'Menor 7' },
  { value: 'sus4', label: 'Suspendido 4' },
  { value: 'dim', label: 'Disminuido' },
  { value: 'add9', label: 'Añadida 9' }
];
const CAPO_SHAPES = ['C', 'G', 'D', 'E', 'A', 'Am', 'Em', 'Dm'];
const CIRCLE_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

export class ToolsView extends Component {
  constructor(container) {
    super(container);
    this.audioCtx = null;
    this.activeToolModal = null;
    this.expandedPreview = null;
    this.modalReturnFocus = null;

    const getAudioCtx = () => this.getAudioContext();

    this.metronomeTool = new MetronomeTool(getAudioCtx);
    this.tunerTool = new TunerTool(getAudioCtx);
    this.chordDictTool = new ChordDictionaryTool();
    this.earTrainerTool = new EarTrainerTool();
    this.capoCalcTool = new CapoCalculatorTool();
    this.circleTool = new CircleOfFifthsTool();

    this.handleContainerKeydown = this.handleContainerKeydown.bind(this);
    this.container?.addEventListener('keydown', this.handleContainerKeydown);
    this.ensurePreviewStylesheet();
    this.initEvents();
  }

  ensurePreviewStylesheet() {
    if (document.querySelector('link[data-tool-previews]')) return;
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = PREVIEW_STYLESHEET;
    stylesheet.dataset.toolPreviews = 'true';
    document.head.appendChild(stylesheet);
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

  openToolModal(toolName, trigger = null) {
    this.activeToolModal = toolName;
    this.modalReturnFocus = trigger || document.activeElement;
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
        return;
    }

    this.setModalBackgroundState(true, modalHost);

    const overlay = modalHost.querySelector('.tool-modal-overlay');
    const dialog = modalHost.querySelector('.tool-modal-dialog') || overlay;
    if (dialog) {
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-label', TOOL_NAMES[toolName] || 'Herramienta completa');
    }

    modalHost.querySelectorAll('#btnCloseToolModal, .btn-close-modal').forEach((button) => {
      button.setAttribute('aria-label', `Cerrar ${TOOL_NAMES[toolName] || 'herramienta'}`);
      button.addEventListener('click', () => this.closeModal());
    });

    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) this.closeModal();
    });

    requestAnimationFrame(() => {
      modalHost.querySelector('#btnCloseToolModal, .btn-close-modal')?.focus();
    });
  }

  closeModal({ restoreFocus = true } = {}) {
    if (this.activeToolModal === 'metronome') {
      this.metronomeTool.isRunning = false;
      this.metronomeTool.stop(this.container);
    }
    if (this.activeToolModal === 'tuner' && this.tunerTool.isListening) {
      this.tunerTool.stopMicrophone(this.container);
    }
    if (this.activeToolModal === 'ear') {
      this.earTrainerTool.close();
    }

    const closedTool = this.activeToolModal;
    this.setModalBackgroundState(false);
    this.activeToolModal = null;
    const modalHost = this.container?.querySelector('#toolModalHost');
    if (modalHost) modalHost.innerHTML = '';
    if (closedTool && this.expandedPreview === closedTool) {
      this.refreshPreview(closedTool, this.modalReturnFocus);
    }

    const returnFocus = this.modalReturnFocus;
    this.modalReturnFocus = null;
    if (restoreFocus && returnFocus?.isConnected) {
      requestAnimationFrame(() => returnFocus.focus());
    }
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

    host.querySelectorAll('.btn-bpm-step').forEach((button) => {
      button.addEventListener('click', () => {
        const delta = Number.parseInt(button.dataset.delta, 10);
        if (Number.isFinite(delta)) {
          this.metronomeTool.setBpm(this.metronomeTool.bpm + delta, this.container);
        }
      });
    });

    host.querySelector('#rngMetronomeBpm')?.addEventListener('input', (event) => {
      this.metronomeTool.setBpm(Number.parseInt(event.target.value, 10), this.container);
    });

    host.querySelectorAll('.metro-pill-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const param = button.dataset.param;
        const value = button.dataset.val;
        if (param) this.metronomeTool[param] = value;
        this.openToolModal('metronome', this.modalReturnFocus);
      });
    });
  }

  bindTunerEvents() {
    const host = this.container?.querySelector('#toolModalHost');
    if (!host) return;

    host.querySelector('#btnModeAutoTuner')?.addEventListener('click', () => {
      this.tunerTool.mode = 'auto';
      this.openToolModal('tuner', this.modalReturnFocus);
    });

    host.querySelector('#btnModeManualTuner')?.addEventListener('click', () => {
      if (this.tunerTool.isListening) this.tunerTool.stopMicrophone(this.container);
      this.tunerTool.mode = 'manual';
      this.openToolModal('tuner', this.modalReturnFocus);
    });

    host.querySelector('#btnToggleMicTuner')?.addEventListener('click', async () => {
      await this.tunerTool.toggleMicrophone(host);
    });

    host.querySelector('#selTuningPreset')?.addEventListener('change', (event) => {
      this.tunerTool.selectedTuning = event.target.value;
      this.openToolModal('tuner', this.modalReturnFocus);
    });

    host.querySelectorAll('.tuner-string-card').forEach((card) => {
      card.addEventListener('click', () => {
        const frequency = Number.parseFloat(card.dataset.freq);
        const calibratedFrequency = frequency * (this.tunerTool.frequency / 440);
        this.tunerTool.playPitch(calibratedFrequency, card.dataset.note);
      });
    });
  }

  bindDictEvents() {
    const host = this.container?.querySelector('#toolModalHost');
    if (!host) return;

    host.querySelectorAll('.dict-inst-btn').forEach((button) => {
      button.addEventListener('click', () => {
        this.chordDictTool.instrument = button.dataset.inst;
        this.openToolModal('dictionary', this.modalReturnFocus);
      });
    });

    host.querySelectorAll('.dict-pill-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.dataset.type;
        const value = button.dataset.val;
        if (type === 'root') this.chordDictTool.root = value;
        if (type === 'quality') this.chordDictTool.quality = value;
        this.openToolModal('dictionary', this.modalReturnFocus);
      });
    });

    host.querySelector('#btnDictAudition')?.addEventListener('click', (event) => {
      const chord = event.currentTarget.dataset.chord;
      chordEngine.auditionChord(chord, this.chordDictTool.instrument);
      toast.show(`Sonando ${chord}`, 'info', 600);
    });
  }

  bindEarEvents() {
    const host = this.container?.querySelector('#toolModalHost');
    if (!host) return;

    host.querySelectorAll('.ear-diff-btn').forEach((button) => {
      button.addEventListener('click', () => {
        this.earTrainerTool.difficulty = button.dataset.diff;
        this.openToolModal('ear', this.modalReturnFocus);
      });
    });

    host.querySelector('#btnPlayEarChord')?.addEventListener('click', () => {
      this.earTrainerTool.playCurrentChord(this.container);
    });
  }

  bindCapoEvents() {
    const host = this.container?.querySelector('#toolModalHost');
    if (!host) return;

    host.querySelectorAll('.dict-pill-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.dataset.type;
        const value = button.dataset.val;
        if (type === 'targetKey') this.capoCalcTool.targetKey = value;
        if (type === 'openShape') this.capoCalcTool.openShape = value;
        this.capoCalcTool.updateUI(this.container);
        this.openToolModal('capo', this.modalReturnFocus);
      });
    });
  }

  bindCircleEvents() {
    const host = this.container?.querySelector('#toolModalHost');
    if (!host) return;

    const selectKey = (event) => {
      const target = event.target.closest('.circle-key-sector, .circle-minor-sector, .circle-key-label, [data-key]');
      if (!target?.dataset.key) return;
      this.circleTool.key = target.dataset.key;
      this.circleTool.updateUI(this.container);
    };

    host.onclick = selectKey;
    host.onkeydown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (!event.target.closest('[data-key]')) return;
      event.preventDefault();
      selectKey(event);
    };
  }

  getChordName() {
    const quality = this.chordDictTool.quality;
    const suffix = quality === 'maj' ? '' : (quality === 'min' ? 'm' : quality);
    return `${this.chordDictTool.root}${suffix}`;
  }

  renderOptions(options, selected) {
    return options.map((option) => {
      const value = typeof option === 'string' ? option : option.value;
      const label = typeof option === 'string' ? option : option.label;
      return `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`;
    }).join('');
  }

  renderPreview(toolName) {
    switch (toolName) {
      case 'metronome': {
        const beats = Number.parseInt(this.metronomeTool.timeSignature.split('/')[0], 10) || 4;
        return `
          <div class="tool-preview-status" aria-live="polite">
            <span class="tool-preview-kicker">Tempo actual</span>
            <strong class="tool-preview-primary">${this.metronomeTool.bpm} BPM</strong>
            <span>${this.metronomeTool.isRunning ? 'En marcha' : 'Preparado'} · ${this.metronomeTool.timeSignature}</span>
          </div>
          <div class="tool-preview-beats" aria-hidden="true">
            ${Array.from({ length: beats }, (_, index) => `<span class="metronome-beat-dot ${index === 0 && this.metronomeTool.isRunning ? 'active accent' : ''}"></span>`).join('')}
          </div>
          <div class="tool-preview-controls tool-preview-controls--tempo" aria-label="Controles rápidos del metrónomo">
            <button type="button" class="tool-preview-icon-button" data-preview-action="metronome-bpm-down" aria-label="Reducir un BPM">−</button>
            <button type="button" class="tool-preview-main-button ${this.metronomeTool.isRunning ? 'is-active' : ''}" data-preview-action="metronome-toggle">
              ${this.metronomeTool.isRunning ? 'Detener' : 'Iniciar'}
            </button>
            <button type="button" class="tool-preview-icon-button" data-preview-action="metronome-bpm-up" aria-label="Aumentar un BPM">+</button>
            <button type="button" class="tool-preview-secondary-button" data-preview-action="metronome-tap">TAP</button>
          </div>
          ${this.renderExpandButton(toolName)}
        `;
      }

      case 'tuner': {
        const isAuto = this.tunerTool.mode === 'auto';
        const tuningName = TUNINGS_DATA[this.tunerTool.selectedTuning]?.name || TUNINGS_DATA.standard.name;
        const status = isAuto
          ? 'Listo para escuchar. Amplía para activar el micrófono.'
          : 'Notas listas. Amplía para elegir afinación y cuerda.';
        return `
          <div class="tool-preview-status" aria-live="polite">
            <span class="tool-preview-kicker">Modo preparado</span>
            <strong class="tool-preview-primary">${isAuto ? 'Escuchar micrófono' : 'Notas de referencia'}</strong>
            <span>${status}</span>
          </div>
          <div class="tool-preview-segmented" role="group" aria-label="Modo del afinador">
            <button type="button" data-preview-action="tuner-mode-auto" aria-pressed="${isAuto}">Escuchar micrófono</button>
            <button type="button" data-preview-action="tuner-mode-manual" aria-pressed="${!isAuto}">Notas de referencia</button>
          </div>
          <div class="tool-preview-calibration">
            <span><strong>A4 ${this.tunerTool.frequency} Hz</strong><small>${tuningName}</small></span>
            <div class="tool-preview-stepper" aria-label="Calibración del afinador">
              <button type="button" data-preview-action="tuner-calibration-down" aria-label="Reducir calibración un hercio">−</button>
              <button type="button" data-preview-action="tuner-calibration-up" aria-label="Aumentar calibración un hercio">+</button>
            </div>
          </div>
          ${this.renderExpandButton(toolName, 'Abrir configuración completa')}
        `;
      }

      case 'dictionary': {
        const chordName = this.getChordName();
        return `
          <div class="tool-preview-status" aria-live="polite">
            <span class="tool-preview-kicker">Acorde seleccionado</span>
            <strong class="tool-preview-primary tool-preview-primary--chord">${chordName}</strong>
            <span>${this.chordDictTool.instrument === 'guitar' ? 'Guitarra' : this.chordDictTool.instrument}</span>
          </div>
          <div class="tool-preview-field-row">
            <label>Fundamental
              <select data-preview-control="dictionary-root" aria-label="Fundamental del acorde">
                ${this.renderOptions(CHORD_ROOTS, this.chordDictTool.root)}
              </select>
            </label>
            <label>Tipo
              <select data-preview-control="dictionary-quality" aria-label="Tipo de acorde">
                ${this.renderOptions(CHORD_QUALITIES, this.chordDictTool.quality)}
              </select>
            </label>
          </div>
          ${this.renderExpandButton(toolName)}
        `;
      }

      case 'ear': {
        const difficultyLabels = { easy: 'Fácil', medium: 'Medio', hard: 'Pro' };
        return `
          <div class="tool-preview-status" aria-live="polite">
            <span class="tool-preview-kicker">Sesión de oído</span>
            <strong class="tool-preview-primary">${this.earTrainerTool.score} puntos</strong>
            <span>${difficultyLabels[this.earTrainerTool.difficulty]} · Racha ${this.earTrainerTool.streak}</span>
          </div>
          <div class="tool-preview-segmented" role="group" aria-label="Dificultad del entrenamiento">
            ${Object.entries(difficultyLabels).map(([value, label]) => `
              <button type="button" data-preview-action="ear-difficulty-${value}" aria-pressed="${this.earTrainerTool.difficulty === value}">${label}</button>
            `).join('')}
          </div>
          <p class="tool-preview-note">El ejercicio comienza únicamente al ampliar la herramienta.</p>
          ${this.renderExpandButton(toolName, 'Comenzar entrenamiento completo')}
        `;
      }

      case 'capo': {
        const fret = this.capoCalcTool.calculateFret(this.capoCalcTool.targetKey, this.capoCalcTool.openShape);
        return `
          <div class="tool-preview-status" aria-live="polite">
            <span class="tool-preview-kicker">Posición recomendada</span>
            <strong class="tool-preview-primary">${fret === 0 ? 'Sin cejilla' : `Traste ${fret}`}</strong>
            <span>Forma ${this.capoCalcTool.openShape} · Suena en ${this.capoCalcTool.targetKey}</span>
          </div>
          <div class="tool-preview-field-row">
            <label>Tono final
              <select data-preview-control="capo-target" aria-label="Tono final">
                ${this.renderOptions(CHORD_ROOTS, this.capoCalcTool.targetKey)}
              </select>
            </label>
            <label>Forma abierta
              <select data-preview-control="capo-shape" aria-label="Forma abierta">
                ${this.renderOptions(CAPO_SHAPES, this.capoCalcTool.openShape)}
              </select>
            </label>
          </div>
          ${this.renderExpandButton(toolName)}
        `;
      }

      case 'circle': {
        const harmony = this.circleTool.getHarmonizedChords(this.circleTool.key);
        return `
          <div class="tool-preview-status" aria-live="polite">
            <span class="tool-preview-kicker">Familia armónica</span>
            <strong class="tool-preview-primary">${this.circleTool.key} mayor · ${harmony.rel} menor</strong>
            <span>I ${harmony.I} · IV ${harmony.IV} · V ${harmony.V}</span>
          </div>
          <label class="tool-preview-key-select">Tonalidad
            <select data-preview-control="circle-key" aria-label="Tonalidad del círculo de quintas">
              ${this.renderOptions(CIRCLE_KEYS, this.circleTool.key)}
            </select>
          </label>
          <div class="tool-preview-harmony" aria-label="Acordes menores de la familia">
            <span>ii ${harmony.ii}</span><span>iii ${harmony.iii}</span><span>vi ${harmony.vi}</span>
          </div>
          ${this.renderExpandButton(toolName)}
        `;
      }

      default:
        return '';
    }
  }

  renderExpandButton(toolName, label = 'Abrir herramienta completa') {
    return `
      <button type="button" class="tool-preview-expand" data-preview-action="open-full" aria-haspopup="dialog" aria-label="${label}: ${TOOL_NAMES[toolName]}">
        <span aria-hidden="true">⛶</span> ${label}
      </button>
    `;
  }

  togglePreview(toolName) {
    if (!TOOL_NAMES[toolName]) return;
    if (this.expandedPreview === toolName) {
      this.closePreview({ restoreFocus: false });
      return;
    }

    this.closePreview({ restoreFocus: false });
    const card = this.container?.querySelector(`.premium-list-item[data-tool="${toolName}"]`);
    const toggle = card?.querySelector('[data-tool-toggle]');
    const panel = card?.querySelector('.tool-preview-panel');
    if (!card || !toggle || !panel) return;

    this.expandedPreview = toolName;
    card.classList.add('is-preview-open');
    toggle.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    panel.innerHTML = this.renderPreview(toolName);
  }

  closePreview({ restoreFocus = false } = {}) {
    if (!this.expandedPreview) return;
    const toolName = this.expandedPreview;
    const card = this.container?.querySelector(`.premium-list-item[data-tool="${toolName}"]`);
    const toggle = card?.querySelector('[data-tool-toggle]');
    const panel = card?.querySelector('.tool-preview-panel');

    if (toolName === 'metronome' && this.metronomeTool.isRunning && this.activeToolModal !== 'metronome') {
      this.metronomeTool.isRunning = false;
      this.metronomeTool.stop(this.container);
    }

    card?.classList.remove('is-preview-open');
    toggle?.setAttribute('aria-expanded', 'false');
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = '';
    }
    this.expandedPreview = null;
    if (restoreFocus) toggle?.focus();
  }

  refreshPreview(toolName, focusSource = null) {
    if (this.expandedPreview !== toolName) return;
    const panel = this.container?.querySelector(`#tool-preview-${toolName}`);
    if (!panel || panel.hidden) return;

    const focusAction = focusSource?.dataset?.previewAction;
    const focusControl = focusSource?.dataset?.previewControl;
    panel.innerHTML = this.renderPreview(toolName);

    if (focusAction || focusControl) {
      const selector = focusAction
        ? `[data-preview-action="${focusAction}"]`
        : `[data-preview-control="${focusControl}"]`;
      requestAnimationFrame(() => panel.querySelector(selector)?.focus());
    }
  }

  handlePreviewAction(event, toolName) {
    const button = event.target.closest('[data-preview-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.previewAction;

    if (action === 'open-full') {
      this.openToolModal(toolName, button);
      return;
    }

    switch (action) {
      case 'metronome-bpm-down':
        this.metronomeTool.setBpm(this.metronomeTool.bpm - 1, this.container);
        break;
      case 'metronome-bpm-up':
        this.metronomeTool.setBpm(this.metronomeTool.bpm + 1, this.container);
        break;
      case 'metronome-toggle':
        this.metronomeTool.toggle(this.container);
        break;
      case 'metronome-tap':
        this.metronomeTool.handleTapTempo(this.container);
        break;
      case 'tuner-mode-auto':
        if (this.tunerTool.isListening) this.tunerTool.stopMicrophone(this.container);
        this.tunerTool.mode = 'auto';
        break;
      case 'tuner-mode-manual':
        if (this.tunerTool.isListening) this.tunerTool.stopMicrophone(this.container);
        this.tunerTool.mode = 'manual';
        break;
      case 'tuner-calibration-down':
        this.tunerTool.frequency = Math.max(430, this.tunerTool.frequency - 1);
        break;
      case 'tuner-calibration-up':
        this.tunerTool.frequency = Math.min(450, this.tunerTool.frequency + 1);
        break;
      case 'ear-difficulty-easy':
      case 'ear-difficulty-medium':
      case 'ear-difficulty-hard':
        this.earTrainerTool.difficulty = action.replace('ear-difficulty-', '');
        break;
      default:
        return;
    }

    this.refreshPreview(toolName, button);
  }

  handlePreviewChange(event, toolName) {
    const control = event.target.closest('[data-preview-control]');
    if (!control) return;
    event.stopPropagation();
    const value = control.value;

    switch (control.dataset.previewControl) {
      case 'dictionary-root':
        if (CHORD_ROOTS.includes(value)) this.chordDictTool.root = value;
        break;
      case 'dictionary-quality':
        if (CHORD_QUALITIES.some((quality) => quality.value === value)) this.chordDictTool.quality = value;
        break;
      case 'capo-target':
        if (CHORD_ROOTS.includes(value)) this.capoCalcTool.targetKey = value;
        break;
      case 'capo-shape':
        if (CAPO_SHAPES.includes(value)) this.capoCalcTool.openShape = value;
        break;
      case 'circle-key':
        if (CIRCLE_KEYS.includes(value)) this.circleTool.key = value;
        break;
      default:
        return;
    }

    this.refreshPreview(toolName, control);
  }
  getModalFocusableElements() {
    const modal = this.container?.querySelector('#toolModalHost [role="dialog"]');
    if (!modal) return [];
    return Array.from(modal.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
  }

  setModalBackgroundState(isOpen, modalHost = null) {
    if (!isOpen) {
      (this.modalInertSnapshot || []).forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      this.modalInertSnapshot = [];
      document.body.classList.remove('tool-modal-open');
      return;
    }

    if (this.modalInertSnapshot?.length) return;
    const host = modalHost || this.container?.querySelector('#toolModalHost');
    if (!host) return;
    this.modalInertSnapshot = [];

    let branch = host;
    while (branch?.parentElement && branch.parentElement !== document.documentElement) {
      Array.from(branch.parentElement.children).forEach((sibling) => {
        if (sibling === branch || !(sibling instanceof HTMLElement)) return;
        this.modalInertSnapshot.push({
          element: sibling,
          inert: sibling.inert,
          ariaHidden: sibling.getAttribute('aria-hidden')
        });
        sibling.inert = true;
        sibling.setAttribute('aria-hidden', 'true');
      });
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    document.body.classList.add('tool-modal-open');
  }

  handleContainerKeydown(event) {
    if (event.key === 'Tab' && this.activeToolModal) {
      const focusable = this.getModalFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !focusable.includes(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !focusable.includes(active))) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    if (event.key !== 'Escape') return;
    if (this.activeToolModal) {
      event.preventDefault();
      event.stopPropagation();
      this.closeModal();
      return;
    }
    if (this.expandedPreview) {
      event.preventDefault();
      event.stopPropagation();
      this.closePreview({ restoreFocus: true });
    }
  }

  renderToolCard({ tool, icon, title, description }) {
    const previewId = `tool-preview-${tool}`;
    return `
      <article class="premium-list-item" data-tool="${tool}">
        <div class="tool-card-summary" data-tool-toggle role="button" tabindex="0"
             aria-expanded="false" aria-controls="${previewId}"
             aria-label="Mostrar vista rápida de ${title}">
          <div class="premium-icon" aria-hidden="true">${icon}</div>
          <div class="premium-content">
            <h3>${title}</h3>
            <p>${description}</p>
          </div>
          <div class="premium-arrow" aria-hidden="true">⌄</div>
        </div>
        <div class="tool-preview-panel" id="${previewId}" aria-label="Vista rápida de ${title}" hidden></div>
      </article>
    `;
  }

  render() {
    if (!this.container) return;
    this.ensurePreviewStylesheet();
    this.closeModal({ restoreFocus: false });
    this.expandedPreview = null;

    const tools = [
      {
        tool: 'metronome', icon: '⏱️', title: 'Metrónomo de precisión',
        description: 'Tempo, subdivisiones, TAP y acento del primer pulso.'
      },
      {
        tool: 'tuner', icon: '🎵', title: 'Afinador y diapasón',
        description: 'Escucha por micrófono o notas de referencia para varias afinaciones.'
      },
      {
        tool: 'dictionary', icon: '📚', title: 'Diccionario de acordes',
        description: 'Diagramas interactivos, voicings y reproducción arpegiada.'
      },
      {
        tool: 'ear', icon: '👂', title: 'Entrenador de oído',
        description: 'Reconocimiento de acordes con dificultad y puntuación progresivas.'
      },
      {
        tool: 'capo', icon: '🎸', title: 'Calculadora de cejilla',
        description: 'Encuentra el traste adecuado para tocar formas cómodas en tu tono.'
      },
      {
        tool: 'circle', icon: '⭕', title: 'Círculo de quintas',
        description: 'Tonalidades relativas y familias armónicas mayores y menores.'
      }
    ];

    this.container.innerHTML = `
      <div class="tools-view-wrapper" role="main" aria-label="Herramientas del músico Pro">
        <div class="view-header">
          <h1>Herramientas Pro</h1>
          <p>Controles rápidos para practicar; amplía solo cuando necesites el estudio completo.</p>
        </div>
        <div class="tools-premium-list" aria-label="Herramientas disponibles">
          ${tools.map((tool) => this.renderToolCard(tool)).join('')}
        </div>
        <div id="toolModalHost" aria-live="polite"></div>
      </div>
    `;

    this.bindDashboardEvents();
  }

  bindDashboardEvents() {
    this.container.querySelectorAll('.premium-list-item').forEach((card) => {
      const tool = card.dataset.tool;
      const toggle = card.querySelector('[data-tool-toggle]');
      const panel = card.querySelector('.tool-preview-panel');

      toggle?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.togglePreview(tool);
      });

      toggle?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        this.togglePreview(tool);
      });

      panel?.addEventListener('click', (event) => this.handlePreviewAction(event, tool));
      panel?.addEventListener('change', (event) => this.handlePreviewChange(event, tool));
    });
  }

  destroy() {
    this.container?.removeEventListener('keydown', this.handleContainerKeydown);
    if (this.metronomeTool.isRunning) {
      this.metronomeTool.isRunning = false;
      this.metronomeTool.stop(this.container);
    }
    if (this.tunerTool.isListening) this.tunerTool.stopMicrophone(this.container);
    this.earTrainerTool.destroy();
    this.setModalBackgroundState(false);
    super.destroy();
  }
}

export default ToolsView;
