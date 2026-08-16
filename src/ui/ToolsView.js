import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { chordEngine } from '../tools/ChordEngine.js';
import { audioEngine } from '../core/AudioEngineV2.js';
import { toast } from './Toast.js';

export class ToolsView extends Component {
  constructor(container) {
    super(container);
    this.metronomeBpm = parseInt(localStorage.getItem('metronome_bpm'), 10) || 120;
    this.metronomeTimeSignature = '4/4';
    this.isMetronomeRunning = false;
    this.audioCtx = null;
    this.nextNoteTime = 0.0;
    this.currentBeat = 0;
    this.schedulerTimer = null;
    this.tapTimes = [];
    this.activeToolModal = null; // Track which tool is open

    // Ear Trainer state
    this.earCurrentQuestion = null;
    this.earScore = 0;
    this.earStreak = 0;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  setMetronomeBpm(bpm) {
    this.metronomeBpm = Math.max(40, Math.min(260, bpm));
    localStorage.setItem('metronome_bpm', this.metronomeBpm);
    const bpmVal = this.container?.querySelector('#metronomeBpmDisplay');
    const bpmSlider = this.container?.querySelector('#rngMetronomeBpm');
    if (bpmVal) bpmVal.textContent = String(this.metronomeBpm);
    if (bpmSlider) bpmSlider.value = this.metronomeBpm;
  }

  handleTapTempo() {
    const now = performance.now();
    this.tapTimes.push(now);
    if (this.tapTimes.length > 4) this.tapTimes.shift();

    if (this.tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this.tapTimes.length; i++) {
        intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 40 && calculatedBpm <= 260) {
        this.setMetronomeBpm(calculatedBpm);
        toast.show(`TAP Tempo: ${calculatedBpm} BPM`, 'info', 600);
      }
    }
  }

  toggleMetronome() {
    this.isMetronomeRunning = !this.isMetronomeRunning;
    if (this.isMetronomeRunning) {
      this.startMetronome();
      toast.show(`Metrónomo: ${this.metronomeBpm} BPM`, 'info', 700);
    } else {
      this.stopMetronome();
      toast.show('Metrónomo detenido', 'info', 700);
    }
    this.updateMetronomeUI();
  }

  startMetronome() {
    const ctx = this.getAudioContext();
    this.currentBeat = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;

    const schedule = () => {
      while (this.nextNoteTime < ctx.currentTime + 0.1) {
        this.scheduleBeat(this.currentBeat, this.nextNoteTime);
        const secondsPerBeat = 60.0 / this.metronomeBpm;
        this.nextNoteTime += secondsPerBeat;
        this.currentBeat++;
      }
    };

    this.schedulerTimer = setInterval(schedule, 25);
  }

  stopMetronome() {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.currentBeat = 0;
  }

  scheduleBeat(beatNumber, time) {
    const ctx = this.getAudioContext();
    const totalBeats = parseInt(this.metronomeTimeSignature.split('/')[0], 10) || 4;
    const isAccent = (beatNumber % totalBeats) === 0;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.value = isAccent ? 1200 : 800;
    gain.gain.setValueAtTime(isAccent ? 1 : 0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.055);

    const delay = Math.max(0, (time - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (!this.isMetronomeRunning) return;
      const leds = this.container?.querySelectorAll('.metronome-beat-dot');
      if (leds && leds.length > 0) {
        leds.forEach((led, idx) => {
          const active = idx === (beatNumber % totalBeats);
          led.classList.toggle('active', active);
          led.classList.toggle('accent', active && isAccent);
        });
      }
    }, delay);
  }

  updateMetronomeUI() {
    const btn = this.container?.querySelector('#btnToggleMetronome');
    if (btn) {
      btn.classList.toggle('active', this.isMetronomeRunning);
      btn.innerHTML = this.isMetronomeRunning ? 'Detener' : 'Iniciar Metrónomo';
    }
  }

  playPitchPipe(freq) {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.5);
      osc.stop(ctx.currentTime + 2.5);
    } catch (err) {
      console.warn('Audio no disponible', err);
    }
  }

  generateRandomChords(count) {
    const roots = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const qualities = ['maj', 'm', '7', 'maj7', 'm7'];
    const chords = [];
    while (chords.length < count) {
      const r = roots[Math.floor(Math.random() * roots.length)];
      const q = qualities[Math.floor(Math.random() * qualities.length)];
      const chord = r + q;
      if (!chords.includes(chord)) chords.push(chord);
    }
    return chords;
  }

  startEarTest() {
    this.earScore = 0;
    this.earStreak = 0;
    this.nextEarQuestion();
  }

  nextEarQuestion() {
    const options = this.generateRandomChords(4);
    const correctIdx = Math.floor(Math.random() * options.length);
    this.earCurrentQuestion = {
      correct: options[correctIdx],
      options: options
    };
    this.updateEarTrainerUI();
  }

  playCurrentEarQuestion() {
    if (!this.earCurrentQuestion) return;
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440; // placeholder tone
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
      osc.stop(ctx.currentTime + 1.5);
    } catch(err){}
  }

  checkEarAnswer(chord) {
    if (!this.earCurrentQuestion) return;
    if (chord === this.earCurrentQuestion.correct) {
      this.earScore += 10;
      this.earStreak++;
      toast.show('¡Correcto! +10 pts', 'success', 1000);
      setTimeout(() => this.nextEarQuestion(), 600);
    } else {
      this.earStreak = 0;
      toast.show(`Incorrecto. Era ${this.earCurrentQuestion.correct}`, 'error', 1500);
      setTimeout(() => this.nextEarQuestion(), 600);
    }
  }

  updateEarTrainerUI() {
    const grid = this.container?.querySelector('#earAnswersGrid');
    const scoreEl = this.container?.querySelector('#earScoreDisplay');
    const streakEl = this.container?.querySelector('#earStreakDisplay');
    
    if (scoreEl) scoreEl.textContent = this.earScore;
    if (streakEl) streakEl.textContent = this.earStreak;

    if (grid && this.earCurrentQuestion) {
      grid.innerHTML = this.earCurrentQuestion.options.map(c => `
        <button class="btn-ear-answer" data-chord="${c}">${c}</button>
      `).join('');

      grid.querySelectorAll('.btn-ear-answer').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.checkEarAnswer(e.target.dataset.chord);
        });
      });
    }
  }

  openToolModal(toolId) {
    this.activeToolModal = toolId;
    const modals = this.container.querySelectorAll('.tool-modal-overlay');
    modals.forEach(m => m.classList.remove('active'));
    
    const target = this.container.querySelector(`#modal-${toolId}`);
    if (target) {
      target.classList.add('active');
    }
  }

  closeToolModal() {
    this.activeToolModal = null;
    const modals = this.container.querySelectorAll('.tool-modal-overlay');
    modals.forEach(m => m.classList.remove('active'));
  }

  render() {
    this.container.innerHTML = `
      <div id="toolsViewWrapper" class="tools-view-wrapper">
        <header class="view-header">
          <h1>Herramientas Pro</h1>
          <p>Utilidades avanzadas de estudio y directo</p>
        </header>

        <!-- Premium List Menu -->
        <div class="tools-premium-list">
          <div class="premium-list-item" data-tool="metronome">
            <div class="premium-icon" style="background: linear-gradient(135deg, #FF5722, #FF9800);">⏱️</div>
            <div class="premium-content">
              <h3>Metrónomo de Precisión</h3>
              <p>Acentos, subdivisiones y tap tempo</p>
            </div>
            <div class="premium-arrow">›</div>
          </div>
          
          <div class="premium-list-item" data-tool="tuner">
            <div class="premium-icon" style="background: linear-gradient(135deg, #00C853, #64DD17);">🎵</div>
            <div class="premium-content">
              <h3>Afinador Cromático</h3>
              <p>Presets Drop D, Open G y Noise Gate</p>
            </div>
            <div class="premium-arrow">›</div>
          </div>

          <div class="premium-list-item" data-tool="dictionary">
            <div class="premium-icon" style="background: linear-gradient(135deg, #2196F3, #00BCD4);">📚</div>
            <div class="premium-content">
              <h3>Diccionario de Acordes</h3>
              <p>Voicings avanzados, inversiones y 7mas</p>
            </div>
            <div class="premium-arrow">›</div>
          </div>

          <div class="premium-list-item" data-tool="ear">
            <div class="premium-icon" style="background: linear-gradient(135deg, #9C27B0, #E91E63);">👂</div>
            <div class="premium-content">
              <h3>Entrenador de Oído</h3>
              <p>Mejora tu percepción armónica relativa</p>
            </div>
            <div class="premium-arrow">›</div>
          </div>

          <div class="premium-list-item" data-tool="capo">
            <div class="premium-icon" style="background: linear-gradient(135deg, #607D8B, #9E9E9E);">🎸</div>
            <div class="premium-content">
              <h3>Calculadora de Cejilla</h3>
              <p>Transpositor instantáneo de trastes</p>
            </div>
            <div class="premium-arrow">›</div>
          </div>

          <div class="premium-list-item" data-tool="circle">
            <div class="premium-icon" style="background: linear-gradient(135deg, #FFC107, #FF9800);">⭕</div>
            <div class="premium-content">
              <h3>Círculo de Quintas</h3>
              <p>Armonía y dominantes secundarios</p>
            </div>
            <div class="premium-arrow">›</div>
          </div>
        </div>

        <!-- ============================================== -->
        <!-- TOOL MODALS (Appears as full screen overlays) -->
        <!-- ============================================== -->

        <!-- Modal: Metronome -->
        <div id="modal-metronome" class="tool-modal-overlay">
          <div class="tool-modal-header">
            <button class="btn-close-modal">‹ Volver</button>
            <h2>Metrónomo</h2>
          </div>
          <div class="tool-modal-body">
            <div class="metronome-display-section">
              <div class="metronome-bpm-readout">
                <span class="bpm-large-number" id="metronomeBpmDisplay">${this.metronomeBpm}</span>
                <span class="bpm-unit-label">BPM</span>
              </div>
              <div class="metronome-dots-row" id="metronomeDotsRow">
                <span class="metronome-beat-dot accent"></span>
                <span class="metronome-beat-dot"></span>
                <span class="metronome-beat-dot"></span>
                <span class="metronome-beat-dot"></span>
              </div>
            </div>
            <div class="metronome-controls-row">
              <button class="btn-bpm-step" id="btnBpmMinus5">-5</button>
              <button class="btn-bpm-step" id="btnBpmMinus1">-1</button>
              <input type="range" class="bpm-range-slider" id="rngMetronomeBpm" min="40" max="260" value="${this.metronomeBpm}">
              <button class="btn-bpm-step" id="btnBpmPlus1">+1</button>
              <button class="btn-bpm-step" id="btnBpmPlus5">+5</button>
            </div>
            <div class="metronome-actions-row">
              <button class="btn-metronome-play ${this.isMetronomeRunning ? 'active' : ''}" id="btnToggleMetronome">
                ${this.isMetronomeRunning ? 'Detener' : 'Iniciar Metrónomo'}
              </button>
              <button class="btn-tap-tempo" id="btnTapTempo">TAP Tempo</button>
            </div>
            
            <div class="pro-options-card">
              <h3>Opciones Avanzadas</h3>
              <div class="pro-grid">
                <label class="pro-label"><span>Acentuar 1er Tiempo</span><input type="checkbox" checked></label>
                <label class="pro-label">
                  <span>Subdivisiones</span>
                  <select><option>Negras</option><option>Corcheas</option><option>Tresillos</option><option>Semicorcheas</option></select>
                </label>
                <label class="pro-label"><span>Flash Visual</span><input type="checkbox"></label>
                <label class="pro-label">
                  <span>Sonido</span>
                  <select><option>Woodblock</option><option>Digital</option><option>Batería</option></select>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal: Tuner -->
        <div id="modal-tuner" class="tool-modal-overlay">
          <div class="tool-modal-header">
            <button class="btn-close-modal">‹ Volver</button>
            <h2>Afinador</h2>
          </div>
          <div class="tool-modal-body" style="text-align:center;">
            <div style="font-size:4rem; font-weight:800; color:var(--primary-color); margin: 30px 0;">E</div>
            <p style="opacity:0.6;">Toque una cuerda...</p>
            <div class="pro-options-card" style="text-align:left;">
              <h3>Presets de Afinación</h3>
              <div class="pro-grid">
                <button class="btn-pro-preset">Standard (E)</button>
                <button class="btn-pro-preset">Drop D</button>
                <button class="btn-pro-preset">Open G</button>
                <button class="btn-pro-preset">DADGAD</button>
                <button class="btn-pro-preset">Bajo</button>
                <button class="btn-pro-preset">Ukelele</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal: Chord Dictionary -->
        <div id="modal-dictionary" class="tool-modal-overlay">
          <div class="tool-modal-header">
            <button class="btn-close-modal">‹ Volver</button>
            <h2>Diccionario</h2>
          </div>
          <div class="tool-modal-body">
            <div class="quick-chord-search-row" style="display:flex; gap:10px; margin-bottom:20px;">
              <input type="text" id="inputQuickChord" class="input-quick-chord" placeholder="Ej: Cmaj7" value="Cmaj7" style="flex:1; padding:12px; border-radius:8px; border:none; background:rgba(255,255,255,0.05); color:#fff; font-size:1.1rem;">
              <button id="btnQuickChordLookup" style="padding:12px 20px; border-radius:8px; border:none; background:var(--primary-color); color:#fff; font-weight:bold;">Ver</button>
            </div>
            <div id="quickChordPreviewBox" style="background:#fff; border-radius:12px; padding:20px; min-height:200px;">
              ${chordEngine.renderChordSVG('Cmaj7', { instrument: 'guitar' })}
            </div>
            <div class="pro-options-card">
              <h3>Explorador de Voicings</h3>
              <div class="pro-grid">
                <div style="grid-column: span 2;">
                  <p style="font-size:0.8rem; opacity:0.6; margin-bottom:10px;">Tensiones</p>
                  <div style="display:flex; flex-wrap:wrap; gap:8px;">
                    <span class="pro-badge">7</span><span class="pro-badge">maj7</span><span class="pro-badge">9</span><span class="pro-badge">11</span><span class="pro-badge">sus4</span><span class="pro-badge">dim</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal: Ear Trainer -->
        <div id="modal-ear" class="tool-modal-overlay">
          <div class="tool-modal-header">
            <button class="btn-close-modal">‹ Volver</button>
            <h2>Entrenador de Oído</h2>
          </div>
          <div class="tool-modal-body">
            <div class="ear-trainer-scoreboard" style="display:flex; justify-content:space-around; background:rgba(255,255,255,0.03); padding:15px; border-radius:12px; margin-bottom:20px;">
              <div style="text-align:center;">
                <div style="font-size:0.8rem; opacity:0.6;">PUNTUACIÓN</div>
                <div style="font-size:1.8rem; font-weight:800; color:var(--primary-color);" id="earScoreDisplay">0</div>
              </div>
              <div style="text-align:center;">
                <div style="font-size:0.8rem; opacity:0.6;">RACHA</div>
                <div style="font-size:1.8rem; font-weight:800; color:#00C853;" id="earStreakDisplay">0</div>
              </div>
            </div>
            <button class="btn-ear-play" id="btnPlayEarChord" style="width:100%; padding:20px; background:rgba(255,255,255,0.05); border-radius:12px; border:none; color:#fff; font-size:1.2rem; margin-bottom:20px;">
              ▶ Reproducir Acorde
            </button>
            <div class="ear-trainer-answers" id="earAnswersGrid" style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
              <!-- Answers injected here -->
            </div>
          </div>
        </div>

        <!-- Modal: Capo -->
        <div id="modal-capo" class="tool-modal-overlay">
          <div class="tool-modal-header">
            <button class="btn-close-modal">‹ Volver</button>
            <h2>Cejilla</h2>
          </div>
          <div class="tool-modal-body" style="text-align:center; padding-top:50px; opacity:0.7;">
            <p>Calculadora de transporte en desarrollo.</p>
          </div>
        </div>

        <!-- Modal: Circle -->
        <div id="modal-circle" class="tool-modal-overlay">
          <div class="tool-modal-header">
            <button class="btn-close-modal">‹ Volver</button>
            <h2>Quintas</h2>
          </div>
          <div class="tool-modal-body" style="text-align:center; padding-top:50px; opacity:0.7;">
            <p>Visor interactivo en desarrollo.</p>
          </div>
        </div>

      </div>
    `;

    this.bindEvents();
    if (!this.earCurrentQuestion) { this.startEarTest(); }
  }

  bindEvents() {
    // Open Modals
    this.container.querySelectorAll('.premium-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const toolId = item.dataset.tool;
        this.openToolModal(toolId);
      });
    });

    // Close Modals
    this.container.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeToolModal();
      });
    });

    // Metronome Handlers
    const bpmSlider = this.container.querySelector('#rngMetronomeBpm');
    if (bpmSlider) {
      bpmSlider.addEventListener('input', (e) => this.setMetronomeBpm(parseInt(e.target.value, 10)));
    }
    this.container.querySelector('#btnBpmMinus5')?.addEventListener('click', () => this.setMetronomeBpm(this.metronomeBpm - 5));
    this.container.querySelector('#btnBpmMinus1')?.addEventListener('click', () => this.setMetronomeBpm(this.metronomeBpm - 1));
    this.container.querySelector('#btnBpmPlus1')?.addEventListener('click', () => this.setMetronomeBpm(this.metronomeBpm + 1));
    this.container.querySelector('#btnBpmPlus5')?.addEventListener('click', () => this.setMetronomeBpm(this.metronomeBpm + 5));
    this.container.querySelector('#btnToggleMetronome')?.addEventListener('click', () => this.toggleMetronome());
    this.container.querySelector('#btnTapTempo')?.addEventListener('click', () => this.handleTapTempo());

    // Chord Lookup
    this.container.querySelector('#btnQuickChordLookup')?.addEventListener('click', () => {
      const q = this.container.querySelector('#inputQuickChord').value.trim() || 'Cmaj7';
      const box = this.container.querySelector('#quickChordPreviewBox');
      box.innerHTML = chordEngine.renderChordSVG(q, { instrument: 'guitar' });
    });

    // Ear Trainer Play
    this.container.querySelector('#btnPlayEarChord')?.addEventListener('click', () => {
      this.playCurrentEarQuestion();
    });
  }
}
