/**
 * @file ToolsView.js
 * @description Suite Completa de Herramientas de Estudio del Músico:
 * - ⏱️ Metrónomo Web Audio de Alta Precisión con reloj lookahead (Cero deriva de BPM).
 * - 🎙️ Afinador Cromático con Clavijero Físico y Detección Automática.
 * - 🔄 Círculo de Quintas y Armonía Modular.
 * - 🎯 Entrenador de Oído Armónico.
 * - 🎸 Calculadora Armónica de Cejilla / Capotraste.
 * - 🎼 Visualizador de Escalas Musicales.
 * - 🎚️ Diapasón Acústico (Pitch Pipe).
 * - 🔍 Diccionario de Acordes Multi-Instrumento.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { chordEngine } from '../tools/ChordEngine.js';
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

    // Herramientas armónicas
    this.selectedScaleKey = 'A';
    this.selectedScaleType = 'pentatonic_minor';
    this.circleSelectedKey = 'C';
    this.capoOriginalKey = 'Eb';
    this.capoOpenShape = 'C';
    this.earScore = 0;
    this.earCurrentQuestion = null;

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
    // Eventos
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

  /**
   * Planificador Lookahead Web Audio de ultra-precisión (Chris Wilson Lookahead Clock).
   * Elimina cualquier desfase o retraso por eventos de renderizado en el navegador.
   */
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

    osc.type = isAccent ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(isAccent ? 0.35 : 0.2, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.00001, time + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.055);

    // Actualización visual sincronizada en el DOM
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

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.0);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 2.1);
    } catch (e) {}
  }

  getScaleNotes(root, type) {
    const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const rootIdx = chromatic.indexOf(root);
    if (rootIdx === -1) return [root];

    const intervals = {
      'pentatonic_minor': [0, 3, 5, 7, 10],
      'pentatonic_major': [0, 2, 4, 7, 9],
      'blues': [0, 3, 5, 6, 7, 10],
      'major': [0, 2, 4, 5, 7, 9, 11],
      'minor_natural': [0, 2, 3, 5, 7, 8, 10],
      'dorian': [0, 2, 3, 5, 7, 9, 10],
    };

    const pattern = intervals[type] || intervals['pentatonic_minor'];
    return pattern.map(i => chromatic[(rootIdx + i) % 12]);
  }

  getHarmonizedChords(key) {
    const harmonyMap = {
      'C': { I: 'C', ii: 'Dm', iii: 'Em', IV: 'F', V: 'G', vi: 'Am', rel: 'Am' },
      'G': { I: 'G', ii: 'Am', iii: 'Bm', IV: 'C', V: 'D', vi: 'Em', rel: 'Em' },
      'D': { I: 'D', ii: 'Em', iii: 'F#m', IV: 'G', V: 'A', vi: 'Bm', rel: 'Bm' },
      'A': { I: 'A', ii: 'Bm', iii: 'C#m', IV: 'D', V: 'E', vi: 'F#m', rel: 'F#m' },
      'E': { I: 'E', ii: 'F#m', iii: 'G#m', IV: 'A', V: 'B', vi: 'C#m', rel: 'C#m' },
      'B': { I: 'B', ii: 'C#m', iii: 'D#m', IV: 'E', V: 'F#', vi: 'G#m', rel: 'G#m' },
      'F': { I: 'F', ii: 'Gm', iii: 'Am', IV: 'Bb', V: 'C', vi: 'Dm', rel: 'Dm' },
      'Bb': { I: 'Bb', ii: 'Cm', iii: 'Dm', IV: 'Eb', V: 'F', vi: 'Gm', rel: 'Gm' },
    };
    return harmonyMap[key] || harmonyMap['C'];
  }

  calculateCapoFret(targetKey, openShape) {
    const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

    const cleanTarget = flatMap[targetKey] || targetKey;
    const cleanShape = flatMap[openShape] || openShape;

    const targetIdx = chromatic.indexOf(cleanTarget);
    const shapeIdx = chromatic.indexOf(cleanShape);

    if (targetIdx === -1 || shapeIdx === -1) return 0;

    let fret = targetIdx - shapeIdx;
    if (fret < 0) fret += 12;
    return fret;
  }

  
  generateRandomChords(correctChord) {
    const pool = [
      { name: 'C Mayor', chord: 'C' }, { name: 'A menor', chord: 'Am' },
      { name: 'G7 Dominante', chord: 'G7' }, { name: 'Fmaj7', chord: 'Fmaj7' },
      { name: 'D menor', chord: 'Dm' }, { name: 'E Mayor', chord: 'E' },
      { name: 'B semidisminuido', chord: 'Bm7b5' }, { name: 'A Mayor', chord: 'A' }
    ];
    let choices = [correctChord];
    while(choices.length < 4) {
      const rnd = pool[Math.floor(Math.random() * pool.length)];
      if (!choices.some(c => c.chord === rnd.chord)) {
        choices.push(rnd);
      }
    }
    return choices.sort(() => Math.random() - 0.5);
  }

  startEarTest() {
    const pool = [
      { name: 'C Mayor', chord: 'C' }, { name: 'A menor', chord: 'Am' },
      { name: 'G7 Dominante', chord: 'G7' }, { name: 'Fmaj7', chord: 'Fmaj7' },
      { name: 'D menor', chord: 'Dm' }, { name: 'E Mayor', chord: 'E' }
    ];
    this.earCurrentQuestion = pool[Math.floor(Math.random() * pool.length)];
    this.earCurrentOptions = this.generateRandomChords(this.earCurrentQuestion);
    
    chordEngine.auditionChord(this.earCurrentQuestion.chord, 'guitar');
    toast.show('Escucha atentamente y elige el acorde...', 'info', 1000);
    this.updateEarTrainerUI();
  }

  updateEarTrainerUI() {
    const grid = this.container?.querySelector('#earAnswersGrid');
    if (!grid || !this.earCurrentOptions) return;
    grid.innerHTML = this.earCurrentOptions.map(opt => 
      `<button class="btn-ear-choice" data-chord="${opt.chord}">${opt.name}</button>`
    ).join('');
    
    grid.querySelectorAll('.btn-ear-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        this.checkEarAnswer(btn.dataset.chord);
      });
    });
  }

  checkEarAnswer(userChoice) {
    if (!this.earCurrentQuestion) {
      this.startEarTest();
      return;
    }
    if (userChoice === this.earCurrentQuestion.chord) {
      this.earScore += 10;
      toast.show(`¡Correcto! Era ${this.earCurrentQuestion.name} (+10 pts)`, 'success', 1200);
    } else {
      toast.show(`Incorrecto. Era ${this.earCurrentQuestion.name}`, 'warning', 1200);
    }
    const scoreEl = this.container?.querySelector('#lblEarScore');
    if (scoreEl) scoreEl.textContent = `${this.earScore} pts`;
    setTimeout(() => {
      this.startEarTest();
    }, 1400);
  }

  render() {

    if (!this.container) return;

    const scaleNotes = this.getScaleNotes(this.selectedScaleKey, this.selectedScaleType);
    const chords = this.getHarmonizedChords(this.circleSelectedKey);
    const capoFret = this.calculateCapoFret(this.capoOriginalKey, this.capoOpenShape);

    this.container.innerHTML = `
      <div class="tools-view-wrapper" id="toolsViewWrapper" role="region" aria-label="Herramientas del Músico">
        <div class="tools-header-banner" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 class="tools-main-title">Herramientas de Estudio</h1>
            <p class="tools-main-subtitle">Afinador, metrónomo de precisión, círculo de quintas, calculadora de cejilla y escalas.</p>
          </div>
          <button id="btnToolsFullscreen" class="btn-tools-fullscreen" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
            <span>Pantalla Completa</span>
          </button>
        </div>

        <div class="tools-grid-layout">
          <!-- 1. METRÓNOMO DE ALTA PRECISIÓN (Cero Drift) -->
          <div class="tool-glass-card metronome-card">
            <div class="tool-card-head" style="cursor:pointer;" onclick="this.parentElement.classList.toggle('collapsed')">
    
              <div class="tool-card-title-group">
                <svg class="tool-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm1 5h-2v6h6v-2h-4V7z"/>
                </svg>
                <h2>Metrónomo de Estudio</h2>
              
    <div style="display:flex; gap:8px;">
      <button class="btn-card-fullscreen" title="Pantalla Completa" onclick="event.stopPropagation(); this.closest('.tool-glass-card').requestFullscreen()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
      </button>
      <span class="collapse-icon">▼</span>
    </div>
  </div>
            </div>

            <div class="metronome-display-section">
              <div class="metronome-bpm-readout">
                <span class="bpm-large-number" id="metronomeBpmDisplay">${this.metronomeBpm}</span>
                <span class="bpm-unit-label">BPM</span>
              </div>

              <div class="metronome-dots-row" id="metronomeDotsRow" role="group" aria-label="Indicadores de pulso">
                <span class="metronome-beat-dot accent"></span>
                <span class="metronome-beat-dot"></span>
                <span class="metronome-beat-dot"></span>
                <span class="metronome-beat-dot"></span>
              </div>
            </div>

            <div class="metronome-controls-row">
              <button class="btn-bpm-step" id="btnBpmMinus5" aria-label="Bajar 5 BPM">-5</button>
              <button class="btn-bpm-step" id="btnBpmMinus1" aria-label="Bajar 1 BPM">-1</button>
              <input type="range" class="bpm-range-slider" id="rngMetronomeBpm" min="40" max="260" value="${this.metronomeBpm}" aria-label="Ajustar tempo">
              <button class="btn-bpm-step" id="btnBpmPlus1" aria-label="Subir 1 BPM">+1</button>
              <button class="btn-bpm-step" id="btnBpmPlus5" aria-label="Subir 5 BPM">+5</button>
            </div>

            <div class="metronome-actions-row">
              <button class="btn-metronome-play ${this.isMetronomeRunning ? 'active' : ''}" id="btnToggleMetronome">
                ${this.isMetronomeRunning ? 'Detener' : 'Iniciar Metrónomo'}
              </button>
              <button class="btn-tap-tempo" id="btnTapTempo" aria-label="Calcular BPM tocando al ritmo">
                TAP Tempo
              </button>
            </div>
          </div>

          <!-- 2. AFINADOR CROMÁTICO CON CLAVIJERO REAL -->
          <div class="tool-glass-card tuner-card">
            <div class="tool-card-head" style="cursor:pointer;" onclick="this.parentElement.classList.toggle('collapsed')">
    
              <div class="tool-card-title-group">
                <svg class="tool-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zM17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
                <h2>Afinador Cromático</h2>
              
    <div style="display:flex; gap:8px;">
      <button class="btn-card-fullscreen" title="Pantalla Completa" onclick="event.stopPropagation(); this.closest('.tool-glass-card').requestFullscreen()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
      </button>
      <span class="collapse-icon">▼</span>
    </div>
  </div>
            </div>

            <p class="tool-card-description">
              Detección de afinación en vivo con clavijeros físicos para Guitarra (3+3 / 6L), Ukelele (2+2) y Bajo.
            </p>

            <button class="btn-open-full-tuner" id="btnOpenFullTuner">
              Abrir Afinador Cromático
            </button>
          </div>

          <!-- 3. CALCULADORA ARMÓNICA DE CEJILLA / CAPOTRASTE -->
          <div class="tool-glass-card capo-calc-card">
            <div class="tool-card-head" style="cursor:pointer;" onclick="this.parentElement.classList.toggle('collapsed')">
    
              <div class="tool-card-title-group">
                <svg class="tool-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                </svg>
                <h2>Calculadora de Cejilla (Capo)</h2>
              
    <div style="display:flex; gap:8px;">
      <button class="btn-card-fullscreen" title="Pantalla Completa" onclick="event.stopPropagation(); this.closest('.tool-glass-card').requestFullscreen()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
      </button>
      <span class="collapse-icon">▼</span>
    </div>
  </div>
            </div>

            <p class="tool-card-description">Toca canciones en cualquier tono utilizando posiciones de acordes abiertos sencillos:</p>

            <div class="capo-calc-inputs-row">
              <div>
                <label for="selCapoTarget">Tono que quieres cantar:</label>
                <select id="selCapoTarget" class="sel-scale-input">
                  ${['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => `
                    <option value="${k}" ${this.capoOriginalKey === k ? 'selected' : ''}>Tonalidad de ${k}</option>
                  `).join('')}
                </select>
              </div>

              <div>
                <label for="selCapoShape">Posición de acordes abiertos:</label>
                <select id="selCapoShape" class="sel-scale-input">
                  ${['C', 'G', 'D', 'A', 'E', 'Am', 'Em'].map(s => `
                    <option value="${s}" ${this.capoOpenShape === s ? 'selected' : ''}>Acordes de ${s}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="capo-calc-result-box">
              <span class="capo-result-label">Coloca el Capotraste en:</span>
              <strong class="capo-result-fret">${capoFret === 0 ? 'Sin cejilla (Al aire)' : `Traste ${capoFret}`}</strong>
            </div>
          </div>

          <!-- 4. CÍRCULO DE QUINTAS & ACORDES DE LA TONALIDAD -->
          <div class="tool-glass-card circle-fifths-card">
            <div class="tool-card-head" style="cursor:pointer;" onclick="this.parentElement.classList.toggle('collapsed')">
    
              <div class="tool-card-title-group">
                <svg class="tool-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
                <h2>Círculo de Quintas & Armonía</h2>
              
    <div style="display:flex; gap:8px;">
      <button class="btn-card-fullscreen" title="Pantalla Completa" onclick="event.stopPropagation(); this.closest('.tool-glass-card').requestFullscreen()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
      </button>
      <span class="collapse-icon">▼</span>
    </div>
  </div>
            </div>

            <div class="circle-keys-row">
              <label for="selCircleKey">Tonalidad:</label>
              <select id="selCircleKey" class="sel-scale-input">
                ${['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb'].map(k => `
                  <option value="${k}" ${this.circleSelectedKey === k ? 'selected' : ''}>Tonalidad de ${k} Mayor (${chords.rel} menor)</option>
                `).join('')}
              </select>
            </div>

            <div class="harmonized-chords-grid">
              <div class="harmony-box" data-chord="${chords.I}">
                <span class="harmony-degree">I (Tónica)</span>
                <strong>${chords.I}</strong>
              </div>
              <div class="harmony-box" data-chord="${chords.IV}">
                <span class="harmony-degree">IV (Subdominante)</span>
                <strong>${chords.IV}</strong>
              </div>
              <div class="harmony-box" data-chord="${chords.V}">
                <span class="harmony-degree">V (Dominante)</span>
                <strong>${chords.V}</strong>
              </div>
              <div class="harmony-box" data-chord="${chords.vi}">
                <span class="harmony-degree">vi (Relativo menor)</span>
                <strong>${chords.vi}</strong>
              </div>
            </div>
          </div>

          <!-- 5. ENTRENADOR DE OÍDO (EAR TRAINER) -->
          <div class="tool-glass-card ear-trainer-card">
            <div class="tool-card-head" style="cursor:pointer;" onclick="this.parentElement.classList.toggle('collapsed')">
    
              <div class="tool-card-title-group">
                <svg class="tool-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                <h2>Entrenador de Oído</h2>
              
    <div style="display:flex; gap:8px;">
      <button class="btn-card-fullscreen" title="Pantalla Completa" onclick="event.stopPropagation(); this.closest('.tool-glass-card').requestFullscreen()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
      </button>
      <span class="collapse-icon">▼</span>
    </div>
  </div>
              <span class="tool-badge-score" id="lblEarScore">${this.earScore} pts</span>
            </div>

            <p class="tool-card-description">
              Escucha el acorde y adivina cuál es. Mejora tu agilidad musical.
            </p>

            <button class="btn-ear-listen-again" id="btnEarPlayAgain">
              Reproducir Acorde
            </button>

            <div class="ear-answers-grid" id="earAnswersGrid">
              <!-- Renderizado dinámicamente -->
            </div>
          </div>

          <!-- 6. GENERADOR DE ESCALAS -->
          <div class="tool-glass-card scales-card">
            <div class="tool-card-head" style="cursor:pointer;" onclick="this.parentElement.classList.toggle('collapsed')">
    
              <div class="tool-card-title-group">
                <svg class="tool-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                <h2>Generador de Escalas</h2>
              
    <div style="display:flex; gap:8px;">
      <button class="btn-card-fullscreen" title="Pantalla Completa" onclick="event.stopPropagation(); this.closest('.tool-glass-card').requestFullscreen()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
      </button>
      <span class="collapse-icon">▼</span>
    </div>
  </div>
            </div>

            <div class="scale-selectors-row">
              <select id="selScaleRoot" class="sel-scale-input">
                ${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => `
                  <option value="${k}" ${this.selectedScaleKey === k ? 'selected' : ''}>Tono: ${k}</option>
                `).join('')}
              </select>

              <select id="selScaleType" class="sel-scale-input">
                <option value="pentatonic_minor" ${this.selectedScaleType === 'pentatonic_minor' ? 'selected' : ''}>Pentatónica Menor</option>
                <option value="pentatonic_major" ${this.selectedScaleType === 'pentatonic_major' ? 'selected' : ''}>Pentatónica Mayor</option>
                <option value="blues" ${this.selectedScaleType === 'blues' ? 'selected' : ''}>Escala de Blues</option>
                <option value="major" ${this.selectedScaleType === 'major' ? 'selected' : ''}>Escala Mayor (Jónica)</option>
                <option value="minor_natural" ${this.selectedScaleType === 'minor_natural' ? 'selected' : ''}>Menor Natural (Eólica)</option>
                <option value="dorian" ${this.selectedScaleType === 'dorian' ? 'selected' : ''}>Modo Dórico</option>
              </select>
            </div>

            <div class="scale-notes-display-box" id="scaleNotesDisplayBox">
              ${scaleNotes.map(n => `<span class="scale-note-pill">${n}</span>`).join('')}
            </div>
          </div>

          <!-- 7. DIAPASÓN ACÚSTICO (PITCH PIPE) -->
          <div class="tool-glass-card pitch-pipe-card">
            <div class="tool-card-head" style="cursor:pointer;" onclick="this.parentElement.classList.toggle('collapsed')">
    
              <div class="tool-card-title-group">
                <svg class="tool-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
                <h2>Diapasón Acústico</h2>
              
    <div style="display:flex; gap:8px;">
      <button class="btn-card-fullscreen" title="Pantalla Completa" onclick="event.stopPropagation(); this.closest('.tool-glass-card').requestFullscreen()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
      </button>
      <span class="collapse-icon">▼</span>
    </div>
  </div>
            </div>

            <div class="pitch-pipe-grid">
              ${[
                { note: 'E2', hz: 82.41 },
                { note: 'A2', hz: 110.00 },
                { note: 'D3', hz: 146.83 },
                { note: 'G3', hz: 196.00 },
                { note: 'B3', hz: 246.94 },
                { note: 'E4', hz: 329.63 },
                { note: 'A4', hz: 440.00 }
              ].map(p => `
                <button class="btn-pitch-pipe-key" data-hz="${p.hz}">
                  <strong>${p.note}</strong>
                  <span>${Math.round(p.hz)} Hz</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- 8. DICCIONARIO DE ACORDES -->
          <div class="tool-glass-card chord-finder-card">
            <div class="tool-card-head" style="cursor:pointer;" onclick="this.parentElement.classList.toggle('collapsed')">
    
              <div class="tool-card-title-group">
                <svg class="tool-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                <h2>Diccionario de Acordes</h2>
              
    <div style="display:flex; gap:8px;">
      <button class="btn-card-fullscreen" title="Pantalla Completa" onclick="event.stopPropagation(); this.closest('.tool-glass-card').requestFullscreen()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
      </button>
      <span class="collapse-icon">▼</span>
    </div>
  </div>
            </div>

            <div class="quick-chord-search-row">
              <input type="text" id="inputQuickChord" class="input-quick-chord" placeholder="Ej: Cmaj7, Dm7, F#m..." value="Cmaj7" aria-label="Buscar acorde">
              <button id="btnQuickChordLookup" class="btn-quick-chord-lookup">Ver Acorde</button>
            </div>

            <div id="quickChordPreviewBox" class="quick-chord-preview-box">
              ${chordEngine.renderChordSVG('Cmaj7', { instrument: 'guitar' })}
            </div>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
    if (!this.earCurrentQuestion) { this.startEarTest(); }
  }

  bindEvents() {
    // Fullscreen Tools
    this.container.querySelector('#btnToolsFullscreen')?.addEventListener('click', () => {
      const wrapper = document.getElementById('toolsViewWrapper');
      if (!document.fullscreenElement) {
        wrapper.requestFullscreen().catch(err => console.warn(err));
        wrapper.style.padding = '30px';
        wrapper.style.overflowY = 'auto';
        wrapper.style.background = '#0a0a0f';
      } else {
        document.exitFullscreen();
        wrapper.style.padding = '';
        wrapper.style.overflowY = '';
        wrapper.style.background = '';
      }
    });

    // Metrónomo: Slider
    const bpmSlider = this.container.querySelector('#rngMetronomeBpm');
    if (bpmSlider) {
      bpmSlider.addEventListener('input', (e) => {
        this.setMetronomeBpm(parseInt(e.target.value, 10));
      });
    }

    // Metrónomo: Pulsadores
    this.container.querySelector('#btnBpmMinus5')?.addEventListener('click', () => this.setMetronomeBpm(this.metronomeBpm - 5));
    this.container.querySelector('#btnBpmMinus1')?.addEventListener('click', () => this.setMetronomeBpm(this.metronomeBpm - 1));
    this.container.querySelector('#btnBpmPlus1')?.addEventListener('click', () => this.setMetronomeBpm(this.metronomeBpm + 1));
    this.container.querySelector('#btnBpmPlus5')?.addEventListener('click', () => this.setMetronomeBpm(this.metronomeBpm + 5));

    this.container.querySelector('#btnToggleMetronome')?.addEventListener('click', () => this.toggleMetronome());
    this.container.querySelector('#btnTapTempo')?.addEventListener('click', () => this.handleTapTempo());

    // Afinador
    this.container.querySelector('#btnOpenFullTuner')?.addEventListener('click', () => {
      events.emit('ui:toggleTuner');
    });

    // Calculadora de Cejilla
    this.container.querySelector('#selCapoTarget')?.addEventListener('change', (e) => {
      this.capoOriginalKey = e.target.value;
      this.render();
    });

    this.container.querySelector('#selCapoShape')?.addEventListener('change', (e) => {
      this.capoOpenShape = e.target.value;
      this.render();
    });

    // Círculo de Quintas
    this.container.querySelector('#selCircleKey')?.addEventListener('change', (e) => {
      this.circleSelectedKey = e.target.value;
      this.render();
    });

    this.container.querySelectorAll('.harmony-box').forEach(box => {
      box.addEventListener('click', () => {
        const chord = box.dataset.chord;
        chordEngine.auditionChord(chord, 'guitar');
        toast.show(`Sonando ${chord}`, 'info', 600);
      });
    });

    // Entrenador de Oído
    this.container.querySelector('#btnEarPlayAgain')?.addEventListener('click', () => {
      if (!this.earCurrentQuestion) {
        this.startEarTest();
      } else {
        chordEngine.auditionChord(this.earCurrentQuestion.chord, 'guitar');
      }
    });

    this.container.querySelectorAll('.btn-ear-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        this.checkEarAnswer(btn.dataset.chord);
      });
    });

    // Escalas
    this.container.querySelector('#selScaleRoot')?.addEventListener('change', (e) => {
      this.selectedScaleKey = e.target.value;
      this.render();
    });

    this.container.querySelector('#selScaleType')?.addEventListener('change', (e) => {
      this.selectedScaleType = e.target.value;
      this.render();
    });

    // Diapasón / Pitch Pipe
    this.container.querySelectorAll('.btn-pitch-pipe-key').forEach(btn => {
      btn.addEventListener('click', () => {
        const hz = parseFloat(btn.dataset.hz);
        this.playPitchPipe(hz);
        toast.show(`Sonando ${Math.round(hz)} Hz`, 'info', 600);
      });
    });

    // Diccionario de acordes
    this.container.querySelector('#btnQuickChordLookup')?.addEventListener('click', () => {
      const chord = this.container.querySelector('#inputQuickChord')?.value || 'C';
      const preview = this.container.querySelector('#quickChordPreviewBox');
      if (preview) {
        preview.innerHTML = chordEngine.renderChordSVG(chord, { instrument: 'guitar' });
        chordEngine.auditionChord(chord, 'guitar');
      }
    });
  }
}

export default ToolsView;
