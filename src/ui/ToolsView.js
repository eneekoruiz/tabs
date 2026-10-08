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
import { trapModalFocus } from './ModalFocus.js';
import { foldControls } from './ProgressiveDisclosure.js';
import { MetronomeTool } from './tools/MetronomeTool.js';
import { TunerTool } from './tools/TunerTool.js';
import { ChordDictionaryTool } from './tools/ChordDictionaryTool.js';
import { EarTrainerTool } from './tools/EarTrainerTool.js';
import { CapoCalculatorTool } from './tools/CapoCalculatorTool.js';
import { CircleOfFifthsTool } from './tools/CircleOfFifthsTool.js';
import { VocalCoachTool } from './tools/VocalCoachTool.js';
import { AudioTranscriberTool } from './tools/AudioTranscriberTool.js';
import { PracticeAnalyticsTool } from './tools/PracticeAnalyticsTool.js';
import { StemSeparatorTool } from './tools/StemSeparatorTool.js';
import { PedalboardTool } from './tools/PedalboardTool.js';
import { SmartLooperTool } from './tools/SmartLooperTool.js';
import { SmartBandTool } from './tools/SmartBandTool.js';
import { ArcadeHighwayVisualizer } from './tools/ArcadeHighwayVisualizer.js';
import { BandRoomTool } from './tools/BandRoomTool.js';
import { StageAutomationTool } from './tools/StageAutomationTool.js';
import { SpatialXRHudView } from './SpatialXRHudView.js';

export class ToolsView extends Component {
  constructor(container) {
    super(container);
    this.audioCtx = null;
    this.activeToolModal = null;

    const getAudioCtx = () => this.getAudioContext();

    this.bandRoomTool = new BandRoomTool();
    this.stageAutomationTool = new StageAutomationTool();
    this.spatialXRHudView = new SpatialXRHudView();
    this.smartBandTool = new SmartBandTool();
    this.arcadeHighwayVisualizer = new ArcadeHighwayVisualizer();
    this.stemSeparatorTool = new StemSeparatorTool();
    this.pedalboardTool = new PedalboardTool();
    this.smartLooperTool = new SmartLooperTool();
    this.transcriberTool = new AudioTranscriberTool(getAudioCtx);
    this.analyticsTool = new PracticeAnalyticsTool();
    this.vocalCoachTool = new VocalCoachTool(getAudioCtx);
    this.metronomeTool = new MetronomeTool(getAudioCtx);
    this.tunerTool = new TunerTool(getAudioCtx);
    this.chordDictTool = new ChordDictionaryTool();
    this.earTrainerTool = new EarTrainerTool();
    this.capoCalcTool = new CapoCalculatorTool();
    this.circleTool = new CircleOfFifthsTool();

    this.initEvents();
    this._escapeHandler = event => {
      if (event.key === 'Escape' && this.activeToolModal && !event.defaultPrevented) { event.preventDefault(); this.closeModal(); }
    };
    document.addEventListener('keydown', this._escapeHandler);
    this.registerUnsub(() => document.removeEventListener('keydown', this._escapeHandler));
  }

  destroy() {
    this.closeModal(false);
    this.audioCtx?.close().catch(() => {});
    super.destroy();
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
      const origin = document.querySelector('.nav-tab-btn.active')?.dataset.tab || (document.querySelector('#score-viewport.active-player-view') ? 'player' : null);
      events.emit('ui:switchTab', 'tools');
      this.openToolModal(toolName);
      this._toolReturnTab = origin && origin !== 'tools' ? origin : null;
    }));
  }

  openToolModal(toolName) {
    const modalHost = this.container?.querySelector('#toolModalHost');
    if (!modalHost) return;
    if (this.activeToolModal && this.activeToolModal !== toolName) {
      this.closeModal(false);
    }
    this._inlineObserver?.disconnect();
    this._inlineObserver = null;
    if (this._toolCloseHandler) modalHost.removeEventListener('click', this._toolCloseHandler);
    this._toolFocusCleanup?.(false);
    this._toolFocusCleanup = null;
    if (this.activeToolModal !== toolName || !this._toolLauncher) this._toolLauncher = document.activeElement;
    const previousFocusId = modalHost.contains(document.activeElement) ? document.activeElement.id : null;
    this.activeToolModal = toolName;
    const inline = !['arcade', 'spatial'].includes(toolName);
    const externalIds = { bandroom:'bandroom-modal-container', stage:'stage-automation-modal-container', smart_band:'smart-band-modal-container', stems:'stems-modal-container', pedalboard:'pedalboard-modal-container', looper:'looper-modal-container', transcriber:'transcription-modal-container', analytics:'analytics-modal-container' };
    if (inline && externalIds[toolName]) {
      const host = document.getElementById(externalIds[toolName]);
      if (host && host.parentElement !== modalHost) {
        this._externalToolHost = { host, parent:host.parentElement, next:host.nextSibling };
        modalHost.append(host);
      }
    }
    modalHost.classList.toggle('inline-tool-host', inline);

    switch (toolName) {
      case 'bandroom':
        this.bandRoomTool.open('#bandroom-modal-container');
        break;
      case 'stage':
        this.stageAutomationTool.open('#stage-automation-modal-container');
        break;
      case 'spatial':
        this.spatialXRHudView.open('#spatial-xr-modal-container');
        break;
      case 'smart_band':
        this.smartBandTool.open('#smart-band-modal-container');
        break;
      case 'arcade':
        this.arcadeHighwayVisualizer.open('#arcade-mode-modal-container');
        break;
      case 'stems':
        this.stemSeparatorTool.open('#stems-modal-container');
        break;
      case 'pedalboard':
        this.pedalboardTool.open('#pedalboard-modal-container');
        break;
      case 'looper':
        this.smartLooperTool.open('#looper-modal-container');
        break;
      case 'transcriber':
        this.transcriberTool.open('#transcription-modal-container');
        break;
      case 'analytics':
        this.analyticsTool.open('#analytics-modal-container');
        break;
      case 'vocal':
        modalHost.innerHTML = this.vocalCoachTool.renderModal();
        this.vocalCoachTool.attachListeners(this.container);
        break;
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

    this._toolCloseHandler = event => {
      if (event.target.closest('#btnCloseToolModal, .btn-close-modal, [id^="btnClose"]')) this.closeModal();
    };
    modalHost.addEventListener('click', this._toolCloseHandler);
    if (modalHost.firstElementChild) {
      if (inline) {
        this._prepareInlineTool(modalHost, toolName);
        this._inlineObserver = new MutationObserver(() => this._prepareInlineTool(modalHost, toolName));
        this._inlineObserver.observe(modalHost, {childList:true,subtree:true});
        this._toolFocusCleanup = restore => { if (restore !== false) this._toolLauncher?.focus?.({ preventScroll: true }); };
        (previousFocusId ? modalHost.querySelector('#' + CSS.escape(previousFocusId)) : modalHost.querySelector('button, input, select'))?.focus({ preventScroll: true });
      } else this._toolFocusCleanup = trapModalFocus(modalHost.firstElementChild, { onClose: () => this.closeModal() });
    }
  }

  _prepareInlineTool(host, name) {
    host.querySelectorAll('[aria-modal], [role="dialog"]').forEach(node => {
      node.removeAttribute('aria-modal');
      if (node.getAttribute('role') === 'dialog') node.setAttribute('role', 'region');
    });
    const panel = host.firstElementChild;
    if (!panel) return;
    panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Herramienta abierta');
    if (host.querySelector('#toolAdvanced')) return;
    if (name === 'smart_band') {
      const grid = host.querySelector('.styles-grid');
      if (grid && !host.querySelector('#essentialBandStyle')) {
        const label = document.createElement('label'); label.className='dict-essential-selects'; label.textContent='Estilo';
        const select=document.createElement('select'); select.id='essentialBandStyle'; select.setAttribute('aria-label','Estilo de acompañamiento');
        grid.querySelectorAll('[data-style]').forEach(button=>{
          const option=document.createElement('option'); option.value=button.dataset.style; option.textContent=button.querySelector('strong')?.textContent || button.textContent.trim(); option.selected=button.classList.contains('active'); select.append(option);
        });
        select.addEventListener('change',()=> { host.querySelector('[data-style="'+CSS.escape(select.value)+'"]')?.click(); queueMicrotask(()=>host.querySelector('#essentialBandStyle')?.focus()); });
        label.append(select); grid.before(label);
      }
    }
    const options = {
      metronome:['.tool-panoramic-side','.tool-panoramic-layout','Compás, subdivisión y sonido',this.metronomeTool],
      tuner:['.tool-panoramic-side','.tool-panoramic-layout','Guía y ajustes',this.tunerTool],
      dictionary:['.dict-group','.tool-panoramic-layout','Botones de notas y tipos',this.chordDictTool],
      vocal:['.metrics-card, .vocal-coach-advice-box, .vocal-target-selector-bar, .vocal-mode-pills','.vocal-coach-container-card','Ejercicios y más mediciones',this.vocalCoachTool],
      ear:['.tool-panoramic-side','.tool-panoramic-layout','Guía para reconocer acordes',this.earTrainerTool],
      capo:['.tool-panoramic-side','.tool-panoramic-layout','Tabla de transposición',this.capoCalcTool],
      circle:['.tool-panoramic-side','.tool-panoramic-layout','Guía de armonía',this.circleTool],
      looper:['.looper-section-card:nth-child(2)','.looper-modal-body','Aumentar velocidad por vuelta',this.smartLooperTool],
      analytics:['.analytics-section-card:nth-of-type(4), .analytics-split-row','.analytics-modal-card','Actividad y logros',this.analyticsTool],
      pedalboard:['.pedals-rack-container','.modal-pedalboard-card','Ajustar cada efecto',this.pedalboardTool],
      smart_band:['.quick-progressions-row, .band-channel-box, .styles-grid','.smartband-modal-body','Progresiones y mezcla',this.smartBandTool],
      stems:['.stems-quick-presets','.stems-modal-body','Preajustes de las bandas',this.stemSeparatorTool]
    };
    const config = options[name];
    if (config) {
      const [selector,parent,label,owner] = config;
      foldControls(host, [...host.querySelectorAll(selector)], {id:'toolAdvanced',label,owner,parent:host.querySelector(parent)||panel});
    }
  }

  closeModal(restoreFocus = true) {
    this._inlineObserver?.disconnect(); this._inlineObserver = null;
    if (this.activeToolModal === 'vocal') {
      this.vocalCoachTool.stop();
      this.vocalCoachTool.close(document.querySelector('#vocal-coach-container'));
    } else if (this.activeToolModal === 'bandroom') {
      this.bandRoomTool.close(document.querySelector('#bandroom-modal-container'));
    } else if (this.activeToolModal === 'stage') {
      this.stageAutomationTool.close(document.querySelector('#stage-automation-modal-container'));
    } else if (this.activeToolModal === 'spatial') {
      this.spatialXRHudView.close(document.querySelector('#spatial-xr-modal-container'));
    } else if (this.activeToolModal === 'smart_band') {
      this.smartBandTool.close(document.querySelector('#smart-band-modal-container'));
    } else if (this.activeToolModal === 'arcade') {
      this.arcadeHighwayVisualizer.close(document.querySelector('#arcade-mode-modal-container'));
    } else if (this.activeToolModal === 'stems') {
      this.stemSeparatorTool.close(document.querySelector('#stems-modal-container'));
    } else if (this.activeToolModal === 'pedalboard') {
      this.pedalboardTool.close(document.querySelector('#pedalboard-modal-container'));
    } else if (this.activeToolModal === 'looper') {
      this.smartLooperTool.close(document.querySelector('#looper-modal-container'));
    } else if (this.activeToolModal === 'transcriber') {
      this.transcriberTool.close(document.querySelector('#transcription-modal-container'));
    } else if (this.activeToolModal === 'analytics') {
      this.analyticsTool.close(document.querySelector('#analytics-modal-container'));
    } else if (this.activeToolModal === 'metronome') {
      this.metronomeTool.stop(this.container);
    } else if (this.activeToolModal === 'tuner') {
      this.tunerTool.stopMicrophone(this.container);
      this.tunerTool.stopTone();
    } else if (this.activeToolModal === 'ear') {
      this.earTrainerTool.close();
    }
    this.activeToolModal = null;
    const modalHost = this.container?.querySelector('#toolModalHost');
    if (this._externalToolHost) {
      const {host,parent,next}=this._externalToolHost;
      parent?.insertBefore(host,next?.parentNode === parent ? next : null);
      this._externalToolHost=null;
    }
    if (modalHost) modalHost.innerHTML = '';
    const returnTab = this._toolReturnTab; this._toolReturnTab = null;
    if (restoreFocus && returnTab) events.emit('ui:switchTab', returnTab);
    this._toolFocusCleanup?.(restoreFocus);
    this._toolFocusCleanup = null;
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

    host.querySelector('#btnToggleMicTuner')?.addEventListener('click', () => {
      this.tunerTool.toggleMicrophone(this.container);
    });

    host.querySelectorAll('.tuner-mode-tab-btn').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.mode === 'manual') this.tunerTool.stopMicrophone(this.container);
        else this.tunerTool.stopTone();
        this.tunerTool.mode = button.dataset.mode || 'auto';
        this.openToolModal('tuner');
      });
    });

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

    for (const [id, property] of [['selDictRoot','root'], ['selDictQuality','quality']]) host.querySelector('#' + id)?.addEventListener('change', event => { this.chordDictTool[property] = event.target.value; this.openToolModal('dictionary'); });

    host.querySelectorAll('.dict-inst-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.chordDictTool.instrument = btn.dataset.inst;
        this.openToolModal('dictionary');
      });
    });

    host.querySelectorAll('.btn-dict-accidental').forEach(btn => {
      btn.addEventListener('click', () => {
        const pref = btn.dataset.accidental;
        localStorage.setItem('app_accidental_preference', pref);
        events.emit('settings:accidentalsChanged', pref);
        this.openToolModal('dictionary');
        toast.show(pref === 'flats' ? 'Notas unificadas en bemoles (♭)' : 'Notas unificadas en sostenidos (♯)', 'info', 800);
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
    const tools = [
      ['metronome', '⏱', 'Metrónomo', 'Tempo y pulso para practicar.'],
      ['tuner', '♬', 'Afinador', 'Escucha el micrófono o una nota guía.'],
      ['dictionary', '♯', 'Acordes', 'Diagramas y escucha por instrumento.'],
      ['vocal', '🎙', 'Entrenamiento vocal', 'Observa tu tono y practica afinación.'],
      ['ear', '◉', 'Entrenamiento de oído', 'Reconoce intervalos y acordes.'],
      ['capo', '↔', 'Calculadora de cejilla', 'Cambia el tono y la posición del capo.'],
      ['circle', '◎', 'Círculo de quintas', 'Explora tonalidades y relaciones.'],
      ['looper', '↻', 'Bucles de práctica', 'Repite compases de una partitura cargada.'],
      ['analytics', '▥', 'Resumen de práctica', 'Tiempo, hábitos e instrumentos.'],
      ['transcriber', '♫', 'Audio a acordes', 'Estima acordes desde una grabación.'],
      ['stems', '≋', 'Mezcla por bandas', 'Filtrado aproximado; no aísla fuentes reales.'],
      ['smart_band', '🥁', 'Acompañamiento', 'Bajo y batería generados para ensayar.'],
      ['pedalboard', '🎸', 'Pedalera virtual', 'Efectos de audio con el micrófono.'],
      ['arcade', '🎮', 'Vista arcade', 'Visualiza las notas de una partitura.'],
      ['bandroom', '⇄', 'Ensayo entre pestañas', 'Controles compartidos en este navegador.'],
      ['stage', '⌘', 'Control MIDI', 'Presets de un dispositivo conectado.'],
      ['spatial', '▣', 'Vista flotante', 'Consulta el contenido de tu canción.']
    ];
    const cards = list => list.map(([id, symbol, name, desc]) => `<article class="premium-list-item" data-tool="${id}" aria-label="Abrir ${name}"><span class="premium-icon" aria-hidden="true">${symbol}</span><div class="premium-content"><h3>${name}</h3><p>${desc}</p><button type="button" class="tool-preview-action" data-preview-action="open-full" aria-label="Abrir ${name}">Abrir</button></div></article>`).join('');
    this.container.innerHTML = `
      <div class="tools-view-wrapper tools-surface" role="region" aria-label="Herramientas de práctica">
        <header class="view-header"><h1>Herramientas del Músico</h1><p>Elige una tarea y practica aquí mismo.</p></header>
        <div id="toolModalHost"></div>
        <div class="tools-catalog-section">
          <div class="tools-command-bar" role="search"><label class="tools-search-field"><span aria-hidden="true">⌕</span><input id="toolsSearchInput" type="search" placeholder="Buscar herramienta" aria-label="Buscar una herramienta"></label><span id="toolsSearchSummary" class="tools-search-summary">Cuatro esenciales para empezar</span></div>
          <section class="tools-category-group" aria-label="Herramientas esenciales"><div class="tools-premium-list essential-tools">${cards(tools.slice(0,4))}</div></section>
          <details id="toolsAdvanced" class="app-disclosure" ${this.toolsAdvancedOpen ? 'open' : ''}><summary>Más herramientas y opciones avanzadas</summary><section class="tools-category-group app-disclosure-body" aria-label="Herramientas avanzadas"><div class="tools-premium-list">${cards(tools.slice(4))}</div></section></details>
        </div>
      </div>`;
    this.bindDashboardEvents();
  }

  bindDashboardEvents() {
    const search = this.container.querySelector('#toolsSearchInput');
    const cards = [...this.container.querySelectorAll('.premium-list-item, .tool-card-pro')];
    const groups = [...this.container.querySelectorAll('.tools-category-group')];
    const summary = this.container.querySelector('#toolsSearchSummary');
    const advanced = this.container.querySelector('#toolsAdvanced');
    advanced?.addEventListener('toggle', () => { if (!search?.value.trim()) this.toolsAdvancedOpen = advanced.open; });
    const filter = () => {
      const query = String(search?.value || '').trim().toLocaleLowerCase('es');
      let visible = 0;
      cards.forEach(card => {
        const matches = !query || card.textContent.toLocaleLowerCase('es').includes(query);
        card.hidden = !matches;
        if (matches) visible += 1;
      });
      groups.forEach(group => {
        group.hidden = !group.querySelector('.premium-list-item:not([hidden]), .tool-card-pro:not([hidden])');
      });
      if (advanced) advanced.open = Boolean(query) || Boolean(this.toolsAdvancedOpen);
      if (summary) summary.textContent = query ? `${visible} herramienta${visible === 1 ? '' : 's'} encontrada${visible === 1 ? '' : 's'}` : 'Cuatro esenciales para empezar';
    };
    search?.addEventListener('input', filter);

    this.container.querySelectorAll('.tool-card-pro, .premium-list-item').forEach(card => {
      card.setAttribute('role', 'group');
      card.removeAttribute('tabindex');
      // Toda tarjeta debe tener una acción explícita además del área clicable.
      // Esto mejora descubribilidad, teclado y uso táctil sin duplicar el modal.
      if (!card.querySelector('[data-preview-action="open-full"]') && card.dataset.tool) {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'tool-preview-action';
        action.dataset.previewAction = 'open-full';
        action.textContent = 'Abrir herramienta';
        action.setAttribute('aria-label', `Abrir ${card.getAttribute('aria-label')?.replace(/^Abrir\s+/i, '') || card.dataset.tool}`);
        card.querySelector('.premium-content, .tool-card-content')?.append(action);
      }
      card.addEventListener('click', (event) => {
        if (event.target.closest('[data-preview-action="open-full"]')) return;
        if (card.dataset.tool) this.openToolModal(card.dataset.tool);
      });
      card.addEventListener('keydown', (event) => {
        if (event.target !== card) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        const tool = card.dataset.tool;
        if (tool) this.openToolModal(tool);
      });
      card.querySelector('[data-preview-action="open-full"]')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const tool = card.dataset.tool;
        if (tool) this.openToolModal(tool);
      });
    });
  }
}

export default ToolsView;
