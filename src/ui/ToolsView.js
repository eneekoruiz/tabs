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

    modalHost.querySelectorAll('#btnCloseToolModal, .btn-close-modal, #btnCloseVocalCoach, #btnCloseTranscriber, #btnCloseAnalytics').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeModal();
      });
    });
  }

  closeModal() {
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
      <div class="tools-view-wrapper" role="main" aria-label="Herramientas del Músico Pro">
        
        <div class="view-header">
          <div class="view-header-badge">STUDIO & PRACTICE PRO</div>
          <h1>Herramientas del Músico</h1>
          <p>Entrenamiento vocal, metrónomo de precisión, afinador, entrenamiento auditivo y armonía.</p>
        </div>

        <div class="tools-premium-list">
          <!-- 0000A. BANDROOM MULTIJUGADOR -->
          <div class="premium-list-item flagship-tool" data-tool="bandroom" role="button" tabindex="0" aria-label="Abrir BandRoom Multijugador">
            <div class="premium-icon" style="background: linear-gradient(135deg, #38bdf8, #0284c7); color: white;">👥</div>
            <div class="premium-content">
              <div class="premium-badge-row">
                <span class="tool-badge-pro">WEBRTC P2P</span>
                <span class="tool-badge-dsp">FIGMA CURSORS</span>
              </div>
              <h3>BandRoom Multijugador</h3>
              <p>Ensayo virtual a distancia con transmisión de audio en tiempo real y cursores colaborativos estilo Figma.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 0000B. STAGE AUTOMATION (MIDI USB) -->
          <div class="premium-list-item flagship-tool" data-tool="stage" role="button" tabindex="0" aria-label="Abrir Stage Automation Control MIDI">
            <div class="premium-icon" style="background: linear-gradient(135deg, #f59e0b, #b45309); color: white;">🎛️</div>
            <div class="premium-content">
              <div class="premium-badge-row">
                <span class="tool-badge-pro">WEB MIDI API</span>
                <span class="tool-badge-dsp">STAGE RIG CONTROL</span>
              </div>
              <h3>Stage Automation</h3>
              <p>Controla tu pedalera USB física (Kemper, Helix, Quad Cortex): cambia presets de distorsión automáticamente por compás.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 0000C. SPATIAL COMPUTING (WEBXR AR) -->
          <div class="premium-list-item flagship-tool" data-tool="spatial" role="button" tabindex="0" aria-label="Abrir Spatial Computing HUD">
            <div class="premium-icon" style="background: linear-gradient(135deg, #a855f7, #ec4899); color: white;">🥽</div>
            <div class="premium-content">
              <div class="premium-badge-row">
                <span class="tool-badge-pro">WEBXR AR/VR</span>
                <span class="tool-badge-dsp">GLASS HUD</span>
              </div>
              <h3>Spatial Computing HUD</h3>
              <p>Entorno de realidad aumentada Glassmorphism para flotar la partitura y afinador en visores tipo Vision Pro.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>
          <!-- 000A. THE SMART BAND (GENERATIVE JAMMING IA) -->
          <div class="premium-list-item flagship-tool" data-tool="smart_band" role="button" tabindex="0" aria-label="Abrir The Smart Band Acompañamiento Generativo">
            <div class="premium-icon" style="background: linear-gradient(135deg, #ec4899, #f43f5e); color: white;">🎷</div>
            <div class="premium-content">
              <div class="premium-badge-row">
                <span class="tool-badge-pro">GENERATIVE AI JAM</span>
                <span class="tool-badge-dsp">AUTO BASS & DRUMS</span>
              </div>
              <h3>The Smart Band</h3>
              <p>Banda virtual en tiempo real: Genera patrones de batería y bajo que se adaptan a tus acordes y tempo.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 000B. MODO ARCADE (SYNTHESIA / GUITAR HERO 60 FPS) -->
          <div class="premium-list-item flagship-tool" data-tool="arcade" role="button" tabindex="0" aria-label="Abrir Modo Inmersivo Synthesia y Arcade Hero">
            <div class="premium-icon" style="background: linear-gradient(135deg, #a855f7, #6366f1); color: white;">🎮</div>
            <div class="premium-content">
              <div class="premium-badge-row">
                <span class="tool-badge-pro">SYNTHESIA / HERO</span>
                <span class="tool-badge-dsp">60 FPS GAMIFICATION</span>
              </div>
              <h3>Modo Arcade Inmersivo</h3>
              <p>Cascada de notas 3D estilo Guitar Hero/Synthesia con puntuación en directo, combos y efectos de neón.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 00A. SEPARADOR DE STEMS (MOISES AI) -->
          <div class="premium-list-item flagship-tool" data-tool="stems" role="button" tabindex="0" aria-label="Abrir Separador de Pistas Stems">
            <div class="premium-icon" style="background: linear-gradient(135deg, #38bdf8, #818cf8); color: black;">🎛️</div>
            <div class="premium-content">
              <div class="premium-badge-row">
                <span class="tool-badge-pro">MOISES AI STYLE</span>
                <span class="tool-badge-dsp">4-TRACK ISOLATION</span>
              </div>
              <h3>Separador de Pistas (Stems)</h3>
              <p>Aísla o silencia Voz, Batería, Bajo y Guitarras en cualquier canción para crear tus backing tracks.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 00B. VIRTUAL PEDALBOARD & SMART TONE -->
          <div class="premium-list-item flagship-tool" data-tool="pedalboard" role="button" tabindex="0" aria-label="Abrir Pedalera Virtual y Simulador de Amplis">
            <div class="premium-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: black;">🎸</div>
            <div class="premium-content">
              <div class="premium-badge-row">
                <span class="tool-badge-pro">SMART TONE AI</span>
                <span class="tool-badge-dsp">LIVE NEURAL DSP</span>
              </div>
              <h3>Pedalera Virtual & Amp Simulator</h3>
              <p>Procesamiento de guitarra y voz en tiempo real con Overdrive a válvulas, Cab Sim 4x12, Delay y Reverb.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 00C. SMART LOOPER & SPEED TRAINER -->
          <div class="premium-list-item flagship-tool" data-tool="looper" role="button" tabindex="0" aria-label="Abrir Smart Looper y Speed Trainer">
            <div class="premium-icon" style="background: linear-gradient(135deg, #10b981, #059669); color: black;">🔁</div>
            <div class="premium-content">
              <div class="premium-badge-row">
                <span class="tool-badge-pro">PRACTICE LOOP</span>
                <span class="tool-badge-dsp">+5% SPEED TRAINER</span>
              </div>
              <h3>Smart Looper & Speed Trainer</h3>
              <p>Practica compases A-B en bucle continuo con aceleración automática progresiva tras cada vuelta.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 0A. TRANSCRIPCIÓN IA (MAGIC SCRATCHPAD) -->
          <div class="premium-list-item flagship-tool" data-tool="transcriber" role="button" tabindex="0" aria-label="Abrir Transcripción de Audio a Acordes">
            <div class="premium-icon" style="background: linear-gradient(135deg, #00b0ff, #00e5ff); color: black;">✨</div>
            <div class="premium-content">
              <div class="premium-badge-row">
                <span class="tool-badge-pro">MAGIC SCRATCHPAD</span>
                <span class="tool-badge-dsp">FFT CHROMAGRAM</span>
              </div>
              <h3>Transcripción de Audio a Acordes</h3>
              <p>Graba con tu micrófono o sube audio para extraer la progresión y tablatura en segundos.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 0B. ANALÍTICAS Y PROGRESIÓN -->
          <div class="premium-list-item" data-tool="analytics" role="button" tabindex="0" aria-label="Abrir Panel de Analíticas y Progresión">
            <div class="premium-icon" style="background: linear-gradient(135deg, #ff9100, #ff6d00); color: white;">📊</div>
            <div class="premium-content">
              <div class="premium-badge-row">
                <span class="tool-badge-pro">STUDIO INTELLIGENCE</span>
              </div>
              <h3>Panel de Rendimiento & Hábito</h3>
              <p>Seguimiento de racha, tiempo de práctica diario, hitos del Speed Trainer y canciones más ensayadas.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 0C. VOCAL COACH (FLAGSHIP) -->
          <div class="premium-list-item flagship-tool" data-tool="vocal" role="button" tabindex="0" aria-label="Abrir Asistente Vocal y Pitch Lane">
            <div class="premium-icon" style="background: linear-gradient(135deg, #ff5722, #e64a19); color: white;">🎙️</div>
            <div class="premium-content">
              <div class="premium-badge-row">
                <span class="tool-badge-pro">PRO FEATURE</span>
                <span class="tool-badge-dsp">YIN DSP ENGINE</span>
              </div>
              <h3>Vocal Coach & Pitch Lane</h3>
              <p>Visualizador Pitch Lane en directo, detección de apoyo diafragmático, estabilidad y consejos didácticos.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 1. METRÓNOMO -->
          <div class="premium-list-item" data-tool="metronome" role="button" tabindex="0" aria-label="Abrir Metrónomo">
            <div class="premium-icon" style="background: #da7756; color: white;">⏱️</div>
            <div class="premium-content">
              <h3>Metrónomo de Precisión</h3>
              <p>Subdivisiones, TAP tempo, acento del primer pulso y timbres clásicos.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 2. AFINADOR -->
          <div class="premium-list-item" data-tool="tuner" role="button" tabindex="0" aria-label="Abrir Afinador">
            <div class="premium-icon" style="background: #5a6b5c; color: white;">🎵</div>
            <div class="premium-content">
              <h3>Afinador & Diapasón</h3>
              <p>Tonos de referencia para Standard, Drop D, DADGAD, Open G y Ukelele.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 3. DICCIONARIO DE ACORDES -->
          <div class="premium-list-item" data-tool="dictionary" role="button" tabindex="0" aria-label="Abrir Diccionario de Acordes">
            <div class="premium-icon" style="background: #d99a4e; color: white;">📚</div>
            <div class="premium-content">
              <h3>Diccionario de Acordes</h3>
              <p>Diagramas SVG interactivos de acordes con audio arpegiado.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 4. ENTRENADOR DE OÍDO -->
          <div class="premium-list-item" data-tool="ear" role="button" tabindex="0" aria-label="Abrir Entrenador de Oído">
            <div class="premium-icon" style="background: #625a6b; color: white;">👂</div>
            <div class="premium-content">
              <h3>Entrenador de Oído</h3>
              <p>Desafía tu oído reconociendo acordes y tensiones armónicas.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 5. CALCULADORA DE CEJILLA -->
          <div class="premium-list-item" data-tool="capo" role="button" tabindex="0" aria-label="Abrir Calculadora de Cejilla">
            <div class="premium-icon" style="background: #5a8e8b; color: white;">🎸</div>
            <div class="premium-content">
              <h3>Calculadora de Cejilla</h3>
              <p>Calcula el traste óptico del capo para cantar en tu tono.</p>
            </div>
            <div class="premium-arrow">→</div>
          </div>

          <!-- 6. CÍRCULO DE QUINTAS -->
          <div class="premium-list-item" data-tool="circle" role="button" tabindex="0" aria-label="Abrir Círculo de Quintas">
            <div class="premium-icon" style="background: #8b5a6b; color: white;">⭕</div>
            <div class="premium-content">
              <h3>Círculo de Quintas</h3>
              <p>Visualiza armaduras, escalas relativas y familias armónicas.</p>
            </div>
            <div class="premium-arrow">→</div>
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
