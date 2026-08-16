/**
 * @file ToolsView.js
 * @description Suite Completa de Herramientas de Estudio del Músico Pro:
 * 1. ⏱️ Metrónomo Web Audio de Precisión con subdivisiones, compases, sonidos y TAP tempo.
 * 2. 🎵 Afinador Cromático con Pitch Pipe multi-afinación (Drop D, Open G, DADGAD, Bajo, Ukelele).
 * 3. 📚 Diccionario de Acordes con Voicings, audio arpegiado y selector de tensiones.
 * 4. 👂 Entrenador de Oído Armónico interactivo con niveles y puntuación.
 * 5. 🎸 Calculadora de Cejilla / Capotraste con tabla de transposición automática.
 * 6. ⭕ Círculo de Quintas y Mapa de Progresiones Armónicas con acordes audibles.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { chordEngine } from '../tools/ChordEngine.js';
import { toast } from './Toast.js';

export class ToolsView extends Component {
  constructor(container) {
    super(container);
    
    // Metrónomo
    this.metronomeBpm = parseInt(localStorage.getItem('metronome_bpm'), 10) || 120;
    this.metronomeTimeSignature = '4/4';
    this.metronomeSubdivision = 'quarter'; // 'quarter' | 'eighth' | 'triplet' | 'sixteenth'
    this.metronomeSound = 'woodblock'; // 'woodblock' | 'digital' | 'drum'
    this.metronomeAccent = true;
    this.metronomeFlash = true;
    this.isMetronomeRunning = false;
    this.nextNoteTime = 0.0;
    this.currentBeat = 0;
    this.schedulerTimer = null;
    this.tapTimes = [];
    this.audioCtx = null;

    // Afinador
    this.selectedTuning = 'standard';
    this.tunerFrequency = 440;
    this.activePitchOsc = null;

    // Diccionario
    this.dictRoot = 'C';
    this.dictQuality = 'maj7';
    this.dictInstrument = 'guitar';

    // Entrenador de Oído
    this.earScore = 0;
    this.earStreak = 0;
    this.earDifficulty = 'easy'; // 'easy' | 'medium' | 'hard'
    this.earCurrentQuestion = null;

    // Cejilla
    this.capoTargetKey = 'Eb';
    this.capoOpenShape = 'C';

    // Círculo de Quintas
    this.circleKey = 'C';

    // Modal activo
    this.activeToolModal = null;
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

  // =========================================================================
  // 1. METRÓNOMO PRO
  // =========================================================================

  setMetronomeBpm(bpm) {
    this.metronomeBpm = Math.max(30, Math.min(280, bpm));
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
      if (calculatedBpm >= 30 && calculatedBpm <= 280) {
        this.setMetronomeBpm(calculatedBpm);
        toast.show(`TAP Tempo: ${calculatedBpm} BPM`, 'info', 600);
      }
    }
  }

  toggleMetronome() {
    this.isMetronomeRunning = !this.isMetronomeRunning;
    if (this.isMetronomeRunning) {
      this.startMetronome();
      toast.show(`Metrónomo: ${this.metronomeBpm} BPM (${this.metronomeTimeSignature})`, 'info', 800);
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
        
        let subMultiplier = 1;
        if (this.metronomeSubdivision === 'eighth') subMultiplier = 0.5;
        else if (this.metronomeSubdivision === 'triplet') subMultiplier = 1 / 3;
        else if (this.metronomeSubdivision === 'sixteenth') subMultiplier = 0.25;

        const secondsPerBeat = (60.0 / this.metronomeBpm) * subMultiplier;
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
    const beatsPerMeasure = parseInt(this.metronomeTimeSignature.split('/')[0], 10) || 4;
    
    let subFactor = 1;
    if (this.metronomeSubdivision === 'eighth') subFactor = 2;
    else if (this.metronomeSubdivision === 'triplet') subFactor = 3;
    else if (this.metronomeSubdivision === 'sixteenth') subFactor = 4;

    const totalSubBeats = beatsPerMeasure * subFactor;
    const isMainBeat = (beatNumber % subFactor) === 0;
    const measureBeat = Math.floor(beatNumber / subFactor) % beatsPerMeasure;
    const isAccent = isMainBeat && measureBeat === 0 && this.metronomeAccent;

    // Generar sonido según el tipo
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (this.metronomeSound === 'woodblock') {
      osc.type = 'sine';
      osc.frequency.value = isAccent ? 1400 : (isMainBeat ? 900 : 600);
      gain.gain.setValueAtTime(isAccent ? 1.0 : (isMainBeat ? 0.7 : 0.35), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
      osc.start(time);
      osc.stop(time + 0.045);
    } else if (this.metronomeSound === 'digital') {
      osc.type = 'square';
      osc.frequency.value = isAccent ? 2000 : (isMainBeat ? 1000 : 700);
      gain.gain.setValueAtTime(isAccent ? 0.6 : (isMainBeat ? 0.35 : 0.15), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
      osc.start(time);
      osc.stop(time + 0.035);
    } else {
      // Drum Kick / Rimshot
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isAccent ? 180 : (isMainBeat ? 110 : 80), time);
      osc.frequency.exponentialRampToValueAtTime(30, time + 0.07);
      gain.gain.setValueAtTime(isAccent ? 1.0 : 0.6, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      osc.start(time);
      osc.stop(time + 0.085);
    }

    // Actualización visual reactiva
    const delay = Math.max(0, (time - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (!this.isMetronomeRunning) return;
      
      if (isMainBeat) {
        const leds = this.container?.querySelectorAll('.metronome-beat-dot');
        if (leds && leds.length > 0) {
          leds.forEach((led, idx) => {
            const active = idx === measureBeat;
            led.classList.toggle('active', active);
            led.classList.toggle('accent', active && isAccent);
          });
        }
      }

      if (this.metronomeFlash && isAccent) {
        const readout = this.container?.querySelector('.metronome-bpm-readout');
        if (readout) {
          readout.style.transform = 'scale(1.04)';
          setTimeout(() => { readout.style.transform = 'scale(1)'; }, 70);
        }
      }
    }, delay);
  }

  updateMetronomeUI() {
    const btn = this.container?.querySelector('#btnToggleMetronome');
    if (btn) {
      btn.classList.toggle('active', this.isMetronomeRunning);
      btn.textContent = this.isMetronomeRunning ? '⏹ Detener' : '▶ Iniciar Metrónomo';
    }
  }

  // =========================================================================
  // 2. AFINADOR CROMÁTICO & PITCH PIPE
  // =========================================================================

  getTuningPresets() {
    return {
      'standard': {
        name: 'Guitarra Estándar (E A D G B E)',
        strings: [
          { note: 'E2', freq: 82.41, label: '6ª Cuerda (E)' },
          { note: 'A2', freq: 110.00, label: '5ª Cuerda (A)' },
          { note: 'D3', freq: 146.83, label: '4ª Cuerda (D)' },
          { note: 'G3', freq: 196.00, label: '3ª Cuerda (G)' },
          { note: 'B3', freq: 246.94, label: '2ª Cuerda (B)' },
          { note: 'E4', freq: 329.63, label: '1ª Cuerda (e)' }
        ]
      },
      'drop_d': {
        name: 'Drop D (D A D G B E)',
        strings: [
          { note: 'D2', freq: 73.42, label: '6ª Cuerda (D)' },
          { note: 'A2', freq: 110.00, label: '5ª Cuerda (A)' },
          { note: 'D3', freq: 146.83, label: '4ª Cuerda (D)' },
          { note: 'G3', freq: 196.00, label: '3ª Cuerda (G)' },
          { note: 'B3', freq: 246.94, label: '2ª Cuerda (B)' },
          { note: 'E4', freq: 329.63, label: '1ª Cuerda (e)' }
        ]
      },
      'open_g': {
        name: 'Open G (D G D G B D)',
        strings: [
          { note: 'D2', freq: 73.42, label: '6ª Cuerda (D)' },
          { note: 'G2', freq: 98.00, label: '5ª Cuerda (G)' },
          { note: 'D3', freq: 146.83, label: '4ª Cuerda (D)' },
          { note: 'G3', freq: 196.00, label: '3ª Cuerda (G)' },
          { note: 'B3', freq: 246.94, label: '2ª Cuerda (B)' },
          { note: 'D4', freq: 293.66, label: '1ª Cuerda (D)' }
        ]
      },
      'dadgad': {
        name: 'DADGAD Celta',
        strings: [
          { note: 'D2', freq: 73.42, label: '6ª Cuerda (D)' },
          { note: 'A2', freq: 110.00, label: '5ª Cuerda (A)' },
          { note: 'D3', freq: 146.83, label: '4ª Cuerda (D)' },
          { note: 'G3', freq: 196.00, label: '3ª Cuerda (G)' },
          { note: 'A3', freq: 220.00, label: '2ª Cuerda (A)' },
          { note: 'D4', freq: 293.66, label: '1ª Cuerda (D)' }
        ]
      },
      'bass': {
        name: 'Bajo 4 Cuerdas (E A D G)',
        strings: [
          { note: 'E1', freq: 41.20, label: '4ª Cuerda (E)' },
          { note: 'A1', freq: 55.00, label: '3ª Cuerda (A)' },
          { note: 'D2', freq: 73.42, label: '2ª Cuerda (D)' },
          { note: 'G2', freq: 98.00, label: '1ª Cuerda (G)' }
        ]
      },
      'ukulele': {
        name: 'Ukelele Estándar (G C E A)',
        strings: [
          { note: 'G4', freq: 392.00, label: '4ª Cuerda (G)' },
          { note: 'C4', freq: 261.63, label: '3ª Cuerda (C)' },
          { note: 'E4', freq: 329.63, label: '2ª Cuerda (E)' },
          { note: 'A4', freq: 440.00, label: '1ª Cuerda (A)' }
        ]
      }
    };
  }

  playPitchPipe(freq, duration = 2.5) {
    try {
      const ctx = this.getAudioContext();
      
      // Calibrar según la frecuencia base elegida (440 vs 432)
      const adjustedFreq = freq * (this.tunerFrequency / 440.0);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = adjustedFreq;

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch (err) {
      console.warn('Audio no disponible para diapasón:', err);
    }
  }

  renderTunerStrings() {
    const presets = this.getTuningPresets();
    const current = presets[this.selectedTuning] || presets['standard'];
    const container = this.container?.querySelector('#tunerStringsGrid');
    if (!container) return;

    container.innerHTML = current.strings.map(s => `
      <button class="btn-tuner-pitch" data-freq="${s.freq}" data-note="${s.note}">
        <span class="pitch-note-name">${s.note}</span>
        <span class="pitch-string-desc">${s.label}</span>
        <span class="pitch-freq-tag">${(s.freq * (this.tunerFrequency / 440.0)).toFixed(1)} Hz</span>
      </button>
    `).join('');

    container.querySelectorAll('.btn-tuner-pitch').forEach(btn => {
      btn.addEventListener('click', () => {
        const freq = parseFloat(btn.dataset.freq);
        const note = btn.dataset.note;
        this.playPitchPipe(freq);
        toast.show(`Diapasón: ${note} (${freq.toFixed(1)} Hz)`, 'info', 700);
        
        // Efecto visual de nota activa
        const readout = this.container?.querySelector('#tunerCurrentNoteReadout');
        if (readout) readout.textContent = note;
      });
    });
  }

  // =========================================================================
  // 3. DICCIONARIO DE ACORDES & VOICINGS
  // =========================================================================

  updateChordDictionary() {
    const chordName = `${this.dictRoot}${this.dictQuality === 'maj' ? '' : this.dictQuality}`;
    const previewBox = this.container?.querySelector('#quickChordPreviewBox');
    const titleBox = this.container?.querySelector('#dictChordTitle');
    
    if (titleBox) titleBox.textContent = `Acorde: ${chordName} (${this.dictInstrument === 'guitar' ? 'Guitarra' : this.dictInstrument === 'piano' ? 'Piano' : 'Ukelele'})`;
    
    if (previewBox) {
      previewBox.innerHTML = chordEngine.renderChordSVG(chordName, { instrument: this.dictInstrument });
    }
  }

  auditionCurrentChord() {
    const chordName = `${this.dictRoot}${this.dictQuality === 'maj' ? '' : this.dictQuality}`;
    chordEngine.auditionChord(chordName, this.dictInstrument);
    toast.show(`Sonando ${chordName}...`, 'info', 700);
  }

  // =========================================================================
  // 4. ENTRENADOR DE OÍDO ARMÓNICO
  // =========================================================================

  startEarTest() {
    const poolByDiff = {
      'easy': [
        { name: 'C Mayor (Brillante / Alegre)', chord: 'C' },
        { name: 'A menor (Melancólico / Triste)', chord: 'Am' },
        { name: 'G Mayor (Abierto / Tónico)', chord: 'G' },
        { name: 'E menor (Oscuro / Profundo)', chord: 'Em' },
        { name: 'D Mayor (Brillante)', chord: 'D' },
        { name: 'D menor (Sentimental)', chord: 'Dm' }
      ],
      'medium': [
        { name: 'G7 Dominante (Tensión de resolución)', chord: 'G7' },
        { name: 'Cmaj7 (Suave / Jazz / Nostalgia)', chord: 'Cmaj7' },
        { name: 'A7 Dominante (Bluesy)', chord: 'A7' },
        { name: 'D7 Dominante', chord: 'D7' },
        { name: 'Fmaj7 (Ensoñador)', chord: 'Fmaj7' },
        { name: 'Am7 (Menor suave)', chord: 'Am7' }
      ],
      'hard': [
        { name: 'B semidisminuido (Bm7b5)', chord: 'Bm7b5' },
        { name: 'Csus4 (Suspensión abierta)', chord: 'Csus4' },
        { name: 'Cdim Disminuido (Tensión dramática)', chord: 'Cdim' },
        { name: 'E7#9 (Acorde Hendrix / Funky)', chord: 'E7#9' },
        { name: 'Dsus2 (Etéreo / Moderno)', chord: 'Dsus2' },
        { name: 'C9 (Colorido Funk / Soul)', chord: 'C9' }
      ]
    };

    const pool = poolByDiff[this.earDifficulty] || poolByDiff['easy'];
    this.earCurrentQuestion = pool[Math.floor(Math.random() * pool.length)];

    // Generar 4 opciones con 1 correcta
    let choices = [this.earCurrentQuestion];
    while (choices.length < 4) {
      const rnd = pool[Math.floor(Math.random() * pool.length)];
      if (!choices.some(c => c.chord === rnd.chord)) {
        choices.push(rnd);
      }
    }
    this.earCurrentOptions = choices.sort(() => Math.random() - 0.5);

    this.playCurrentEarQuestion();
    this.updateEarTrainerUI();
  }

  playCurrentEarQuestion() {
    if (!this.earCurrentQuestion) return;
    chordEngine.auditionChord(this.earCurrentQuestion.chord, 'guitar');
  }

  checkEarAnswer(selectedChord) {
    if (!this.earCurrentQuestion) {
      this.startEarTest();
      return;
    }

    if (selectedChord === this.earCurrentQuestion.chord) {
      this.earScore += 10;
      this.earStreak++;
      toast.show(`¡Correcto! Era ${this.earCurrentQuestion.name} (+10 pts)`, 'success', 1000);
      setTimeout(() => this.startEarTest(), 800);
    } else {
      this.earStreak = 0;
      toast.show(`Incorrecto. Era ${this.earCurrentQuestion.name}`, 'error', 1500);
      setTimeout(() => this.startEarTest(), 1200);
    }
    this.updateEarTrainerUI();
  }

  updateEarTrainerUI() {
    const scoreEl = this.container?.querySelector('#earScoreDisplay');
    const streakEl = this.container?.querySelector('#earStreakDisplay');
    const grid = this.container?.querySelector('#earAnswersGrid');

    if (scoreEl) scoreEl.textContent = this.earScore;
    if (streakEl) streakEl.textContent = this.earStreak;

    if (grid && this.earCurrentOptions) {
      grid.innerHTML = this.earCurrentOptions.map(opt => `
        <button class="btn-ear-answer" data-chord="${opt.chord}">
          <strong>${opt.chord}</strong>
          <small style="display:block; font-size:0.75rem; font-weight:normal; opacity:0.7; margin-top:4px;">${opt.name.split('(')[1]?.replace(')', '') || ''}</small>
        </button>
      `).join('');

      grid.querySelectorAll('.btn-ear-answer').forEach(btn => {
        btn.addEventListener('click', () => {
          this.checkEarAnswer(btn.dataset.chord);
        });
      });
    }
  }

  // =========================================================================
  // 5. CALCULADORA DE CEJILLA (CAPO)
  // =========================================================================

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

  updateCapoUI() {
    const fret = this.calculateCapoFret(this.capoTargetKey, this.capoOpenShape);
    const resultBox = this.container?.querySelector('#capoResultFretDisplay');
    const descBox = this.container?.querySelector('#capoResultDescription');

    if (resultBox) {
      resultBox.textContent = fret === 0 ? 'Sin cejilla (Traste 0)' : `Traste ${fret}`;
    }
    if (descBox) {
      descBox.textContent = `Pon la cejilla en el traste ${fret} y toca las posiciones de acordes de la familia de [${this.capoOpenShape}]. El resultado sonará exactamente en tono de [${this.capoTargetKey}].`;
    }
  }

  // =========================================================================
  // 6. CÍRCULO DE QUINTAS & ARMONÍA MODULAR
  // =========================================================================

  getHarmonizedChords(key) {
    const harmonyMap = {
      'C': { I: 'C', ii: 'Dm', iii: 'Em', IV: 'F', V: 'G7', vi: 'Am', dim: 'Bdim', rel: 'Am', v_of_v: 'D7' },
      'G': { I: 'G', ii: 'Am', iii: 'Bm', IV: 'C', V: 'D7', vi: 'Em', dim: 'F#dim', rel: 'Em', v_of_v: 'A7' },
      'D': { I: 'D', ii: 'Em', iii: 'F#m', IV: 'G', V: 'A7', vi: 'Bm', dim: 'C#dim', rel: 'Bm', v_of_v: 'E7' },
      'A': { I: 'A', ii: 'Bm', iii: 'C#m', IV: 'D', V: 'E7', vi: 'F#m', dim: 'G#dim', rel: 'F#m', v_of_v: 'B7' },
      'E': { I: 'E', ii: 'F#m', iii: 'G#m', IV: 'A', V: 'B7', vi: 'C#m', dim: 'D#dim', rel: 'C#m', v_of_v: 'F#7' },
      'B': { I: 'B', ii: 'C#m', iii: 'D#m', IV: 'E', V: 'F#7', vi: 'G#m', dim: 'A#dim', rel: 'G#m', v_of_v: 'C#7' },
      'F': { I: 'F', ii: 'Gm', iii: 'Am', IV: 'Bb', V: 'C7', vi: 'Dm', dim: 'Edim', rel: 'Dm', v_of_v: 'G7' },
      'Bb': { I: 'Bb', ii: 'Cm', iii: 'Dm', IV: 'Eb', V: 'F7', vi: 'Gm', dim: 'Adim', rel: 'Gm', v_of_v: 'C7' },
      'Eb': { I: 'Eb', ii: 'Fm', iii: 'Gm', IV: 'Ab', V: 'Bb7', vi: 'Cm', dim: 'Ddim', rel: 'Cm', v_of_v: 'F7' }
    };
    return harmonyMap[key] || harmonyMap['C'];
  }

  updateCircleUI() {
    const harmony = this.getHarmonizedChords(this.circleKey);
    const container = this.container?.querySelector('#circleDegreesGrid');
    if (!container) return;

    const degrees = [
      { deg: 'I (Tónica)', chord: harmony.I, role: 'Punto de reposo' },
      { deg: 'IV (Subdominante)', chord: harmony.IV, role: 'Movimiento suave' },
      { deg: 'V (Dominante)', chord: harmony.V, role: 'Tensión máxima' },
      { deg: 'vi (Relativo Menor)', chord: harmony.vi, role: 'Color melancólico' },
      { deg: 'ii (Subdominante m)', chord: harmony.ii, role: 'Preparación de cadencia' },
      { deg: 'V / V (Dominante Secundario)', chord: harmony.v_of_v, role: 'Modulación brillante' }
    ];

    container.innerHTML = degrees.map(d => `
      <button class="harmony-degree-card" data-chord="${d.chord}">
        <span class="harmony-degree-label">${d.deg}</span>
        <strong class="harmony-chord-name">${d.chord}</strong>
        <small class="harmony-role-desc">${d.role}</small>
      </button>
    `).join('');

    container.querySelectorAll('.harmony-degree-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const chord = btn.dataset.chord;
        chordEngine.auditionChord(chord, 'guitar');
        toast.show(`Sonando grado armónico: ${chord}`, 'info', 700);
      });
    });
  }

  // =========================================================================
  // MODAL NAVIGATION
  // =========================================================================

  openToolModal(toolId) {
    this.activeToolModal = toolId;
    const modals = this.container.querySelectorAll('.tool-modal-overlay');
    modals.forEach(m => m.classList.remove('active'));

    const target = this.container.querySelector(`#modal-${toolId}`);
    if (target) {
      target.classList.add('active');
    }

    // Inicializar sub-estados específicos de cada herramienta
    if (toolId === 'tuner') {
      this.renderTunerStrings();
    } else if (toolId === 'dictionary') {
      this.updateChordDictionary();
    } else if (toolId === 'ear' && !this.earCurrentQuestion) {
      this.startEarTest();
    } else if (toolId === 'capo') {
      this.updateCapoUI();
    } else if (toolId === 'circle') {
      this.updateCircleUI();
    }
  }

  closeToolModal() {
    this.activeToolModal = null;
    const modals = this.container.querySelectorAll('.tool-modal-overlay');
    modals.forEach(m => m.classList.remove('active'));
  }

  // =========================================================================
  // RENDER PRINCIPAL
  // =========================================================================

  render() {
    this.container.innerHTML = `
      <div id="toolsViewWrapper" class="tools-view-wrapper">
        <header class="view-header">
          <h1>Herramientas Pro</h1>
          <p>Suite completa de utilidades de estudio, armonía y directo</p>
        </header>

        <!-- Menu Principal en Lista Premium -->
        <div class="tools-premium-list">
          
          <div class="premium-list-item" data-tool="metronome">
            <div class="premium-icon" style="background: linear-gradient(135deg, #FF5722, #FF9800);">⏱️</div>
            <div class="premium-content">
              <h3>Metrónomo de Precisión</h3>
              <p>Reloj lookahead, acentos, subdivisiones y TAP tempo</p>
            </div>
            <div class="premium-arrow">›</div>
          </div>

          <div class="premium-list-item" data-tool="tuner">
            <div class="premium-icon" style="background: linear-gradient(135deg, #00C853, #64DD17);">🎵</div>
            <div class="premium-content">
              <h3>Afinador & Diapasón Acústico</h3>
              <p>Presets Drop D, Open G, DADGAD, Bajo, Ukelele y 432/440Hz</p>
            </div>
            <div class="premium-arrow">›</div>
          </div>

          <div class="premium-list-item" data-tool="dictionary">
            <div class="premium-icon" style="background: linear-gradient(135deg, #2196F3, #00BCD4);">📚</div>
            <div class="premium-content">
              <h3>Diccionario de Acordes</h3>
              <p>Voicings multi-instrumento, audio arpegiado y tensiones</p>
            </div>
            <div class="premium-arrow">›</div>
          </div>

          <div class="premium-list-item" data-tool="ear">
            <div class="premium-icon" style="background: linear-gradient(135deg, #9C27B0, #E91E63);">👂</div>
            <div class="premium-content">
              <h3>Entrenador de Oído</h3>
              <p>Reconocimiento auditivo de tríadas, 7mas y tensiones</p>
            </div>
            <div class="premium-arrow">›</div>
          </div>

          <div class="premium-list-item" data-tool="capo">
            <div class="premium-icon" style="background: linear-gradient(135deg, #607D8B, #9E9E9E);">🎸</div>
            <div class="premium-content">
              <h3>Calculadora de Cejilla</h3>
              <p>Transpositor instantáneo de trastes y digitaciones</p>
            </div>
            <div class="premium-arrow">›</div>
          </div>

          <div class="premium-list-item" data-tool="circle">
            <div class="premium-icon" style="background: linear-gradient(135deg, #FFC107, #FF9800);">⭕</div>
            <div class="premium-content">
              <h3>Círculo de Quintas & Armonía</h3>
              <p>Mapa interactivo de grados, relativos y dominantes</p>
            </div>
            <div class="premium-arrow">›</div>
          </div>

        </div>

        <!-- ================================================================= -->
        <!-- MODALES DE PANTALLA COMPLETA 100% OPERATIVOS                     -->
        <!-- ================================================================= -->

        <!-- 1. MODAL METRÓNOMO -->
        <div id="modal-metronome" class="tool-modal-overlay">
          <div class="tool-modal-header">
            <button class="btn-close-modal">‹ Volver</button>
            <h2>Metrónomo de Precisión</h2>
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
              <input type="range" class="bpm-range-slider" id="rngMetronomeBpm" min="30" max="280" value="${this.metronomeBpm}">
              <button class="btn-bpm-step" id="btnBpmPlus1">+1</button>
              <button class="btn-bpm-step" id="btnBpmPlus5">+5</button>
            </div>

            <div class="metronome-actions-row">
              <button class="btn-metronome-play ${this.isMetronomeRunning ? 'active' : ''}" id="btnToggleMetronome">
                ${this.isMetronomeRunning ? '⏹ Detener' : '▶ Iniciar Metrónomo'}
              </button>
              <button class="btn-tap-tempo" id="btnTapTempo">TAP Tempo</button>
            </div>

            <div class="pro-options-card">
              <h3>⚙️ Configuración del Compás y Sonido</h3>
              <div class="pro-grid">
                
                <label class="pro-label">
                  <span>Métrica / Compás</span>
                  <select id="selMetronomeTimeSig">
                    <option value="4/4" selected>4/4 (Estándar)</option>
                    <option value="3/4">3/4 (Vals)</option>
                    <option value="6/8">6/8 (Compuesto)</option>
                    <option value="2/4">2/4 (Marcha)</option>
                    <option value="5/4">5/4 (Impar)</option>
                    <option value="7/8">7/8 (Progresivo)</option>
                  </select>
                </label>

                <label class="pro-label">
                  <span>Subdivisiones</span>
                  <select id="selMetronomeSubdiv">
                    <option value="quarter" selected>Negras (1x)</option>
                    <option value="eighth">Corcheas (2x)</option>
                    <option value="triplet">Tresillos (3x)</option>
                    <option value="sixteenth">Semicorcheas (4x)</option>
                  </select>
                </label>

                <label class="pro-label">
                  <span>Sonido del Click</span>
                  <select id="selMetronomeSound">
                    <option value="woodblock" selected>Woodblock Acústico</option>
                    <option value="digital">Digital Beep</option>
                    <option value="drum">Batería (Kick / Rim)</option>
                  </select>
                </label>

                <label class="pro-label">
                  <span>Acento 1er Tiempo</span>
                  <input type="checkbox" id="chkMetronomeAccent" checked>
                </label>

              </div>
            </div>

            <div class="tool-info-box">
              <h4>💡 Consejo de Estudio Pro</h4>
              <p>Practica pasajes difíciles reduciendo el BPM al 60% de la velocidad real. Cuando toques 3 repeticiones limpias consecutivas, sube de 5 en 5 BPM usando los botones de paso rápido.</p>
            </div>

          </div>
        </div>

        <!-- 2. MODAL AFINADOR -->
        <div id="modal-tuner" class="tool-modal-overlay">
          <div class="tool-modal-header">
            <button class="btn-close-modal">‹ Volver</button>
            <h2>Afinador & Diapasón Acústico</h2>
          </div>
          <div class="tool-modal-body">
            
            <div style="text-align: center; margin-bottom: 24px;">
              <div id="tunerCurrentNoteReadout" style="font-size: 4rem; font-weight: 900; color: var(--accent-primary); line-height: 1;">A4</div>
              <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 6px;">Toca una cuerda para escuchar su frecuencia exacta de referencia</p>
            </div>

            <div class="pro-options-card" style="margin-top: 0; margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0;">Preset de Instrumento</h3>
                <select id="selTuningPreset" style="background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 6px 12px; border-radius: 8px; font-weight: 600;">
                  <option value="standard" selected>Guitarra Estándar (E A D G B E)</option>
                  <option value="drop_d">Drop D (D A D G B E)</option>
                  <option value="open_g">Open G (D G D G B D)</option>
                  <option value="dadgad">DADGAD Celta</option>
                  <option value="bass">Bajo 4 Cuerdas (E A D G)</option>
                  <option value="ukulele">Ukelele Estándar (G C E A)</option>
                </select>
              </div>

              <!-- Cuerdas interactivas -->
              <div id="tunerStringsGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;"></div>
            </div>

            <div class="pro-options-card">
              <h3>Calibración de Frecuencia Base</h3>
              <div style="display: flex; gap: 10px;">
                <button class="btn-pro-preset ${this.tunerFrequency === 440 ? 'active' : ''}" id="btnFreq440" style="flex:1;">Estándar Internacional (440 Hz)</button>
                <button class="btn-pro-preset ${this.tunerFrequency === 432 ? 'active' : ''}" id="btnFreq432" style="flex:1;">Frecuencia Natural (432 Hz)</button>
              </div>
            </div>

            <div class="tool-info-box">
              <h4>💡 Cómo Afinar de Oído</h4>
              <p>Pulsa la cuerda que deseas afinar en la pantalla para escuchar el tono puro generado por Web Audio. Toca la misma cuerda en tu instrumento y ajusta la clavija hasta que la ondulación sonora ("batimento") desaparezca por completo.</p>
            </div>

          </div>
        </div>

        <!-- 3. MODAL DICCIONARIO DE ACORDES -->
        <div id="modal-dictionary" class="tool-modal-overlay">
          <div class="tool-modal-header">
            <button class="btn-close-modal">‹ Volver</button>
            <h2>Diccionario de Acordes & Voicings</h2>
          </div>
          <div class="tool-modal-body">
            
            <div style="display: flex; gap: 10px; margin-bottom: 16px;">
              <select id="selDictInstrument" style="background: var(--bg-surface-solid); color: var(--text-primary); border: 1px solid var(--border-strong); padding: 12px; border-radius: 12px; font-weight: 700; font-size: 0.95rem;">
                <option value="guitar" selected>🎸 Guitarra</option>
                <option value="piano">🎹 Piano</option>
                <option value="ukulele">🪕 Ukelele</option>
              </select>
              <button id="btnAuditionDictChord" style="flex: 1; background: var(--accent-primary); color: #ffffff; border: none; border-radius: 12px; font-weight: 800; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                🔊 Escuchar Acorde
              </button>
            </div>

            <!-- Selector de Raíz (Root) -->
            <div class="pro-options-card" style="margin-top: 0; margin-bottom: 14px;">
              <h3 style="margin-bottom: 10px;">1. Nota Fundamental (Raíz)</h3>
              <div id="dictRootButtons" style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(r => `
                  <button class="pro-badge ${r === this.dictRoot ? 'active' : ''}" data-root="${r}">${r}</button>
                `).join('')}
              </div>
            </div>

            <!-- Selector de Cualidad / Tensiones -->
            <div class="pro-options-card" style="margin-top: 0; margin-bottom: 16px;">
              <h3 style="margin-bottom: 10px;">2. Tipo de Acorde & Tensiones</h3>
              <div id="dictQualityButtons" style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${[
                  { id: 'maj', label: 'Mayor (Tríada)' },
                  { id: 'm', label: 'Menor (m)' },
                  { id: '7', label: 'Dominante (7)' },
                  { id: 'maj7', label: 'Mayor Séptima (maj7)' },
                  { id: 'm7', label: 'Menor Séptima (m7)' },
                  { id: 'sus4', label: 'Suspendido (sus4)' },
                  { id: 'sus2', label: 'Suspendido (sus2)' },
                  { id: 'dim', label: 'Disminuido (dim)' },
                  { id: 'm7b5', label: 'Semidisminuido (ø)' },
                  { id: '9', label: 'Novena (9)' },
                  { id: 'add9', label: 'Añadida (add9)' }
                ].map(q => `
                  <button class="pro-badge ${q.id === this.dictQuality ? 'active' : ''}" data-quality="${q.id}">${q.label}</button>
                `).join('')}
              </div>
            </div>

            <!-- Previsualización Gráfica SVG -->
            <div style="background: var(--bg-surface-solid); border: 1px solid var(--border-subtle); border-radius: 16px; padding: 20px; text-align: center;">
              <h3 id="dictChordTitle" style="margin: 0 0 16px 0; font-size: 1.15rem; color: var(--text-primary);">Acorde: Cmaj7</h3>
              <div id="quickChordPreviewBox" style="min-height: 220px; display: flex; align-items: center; justify-content: center;"></div>
            </div>

          </div>
        </div>

        <!-- 4. MODAL ENTRENADOR DE OÍDO -->
        <div id="modal-ear" class="tool-modal-overlay">
          <div class="tool-modal-header">
            <button class="btn-close-modal">‹ Volver</button>
            <h2>Entrenador de Oído Armónico</h2>
          </div>
          <div class="tool-modal-body">
            
            <div style="display: flex; justify-content: space-around; background: var(--bg-surface-solid); border: 1px solid var(--border-subtle); padding: 18px; border-radius: 16px; margin-bottom: 20px;">
              <div style="text-align: center;">
                <div style="font-size: 0.78rem; font-weight: 700; opacity: 0.6; letter-spacing: 0.5px;">PUNTUACIÓN</div>
                <div style="font-size: 2.2rem; font-weight: 900; color: var(--accent-primary);" id="earScoreDisplay">0</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 0.78rem; font-weight: 700; opacity: 0.6; letter-spacing: 0.5px;">RACHA SEGUIDA</div>
                <div style="font-size: 2.2rem; font-weight: 900; color: #00e676;" id="earStreakDisplay">0</div>
              </div>
            </div>

            <div style="display: flex; gap: 8px; margin-bottom: 16px;">
              <button class="btn-pro-preset ${this.earDifficulty === 'easy' ? 'active' : ''}" id="btnEarDiffEasy" style="flex:1;">Nivel 1 (Mayor / Menor)</button>
              <button class="btn-pro-preset ${this.earDifficulty === 'medium' ? 'active' : ''}" id="btnEarDiffMed" style="flex:1;">Nivel 2 (7mas & Dominantes)</button>
              <button class="btn-pro-preset ${this.earDifficulty === 'hard' ? 'active' : ''}" id="btnEarDiffHard" style="flex:1;">Nivel 3 (Avanzado)</button>
            </div>

            <button id="btnPlayEarChord" style="width: 100%; padding: 22px; background: var(--bg-surface-solid); border: 2px solid var(--accent-primary); border-radius: 16px; color: var(--text-primary); font-size: 1.25rem; font-weight: 800; cursor: pointer; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 4px 20px rgba(255, 87, 34, 0.15);">
              🔊 Reproducir Acorde Otra Vez
            </button>

            <div id="earAnswersGrid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;"></div>

            <div class="tool-info-box">
              <h4>💡 Cómo Desarrollar Oído Armónico</h4>
              <p>Concéntrate en la emoción que te transmite el acorde: los acordes <strong>Mayores</strong> suenan luminosos y estables; los <strong>Menores</strong> tienen melancolía introspectiva; las <strong>7mas Dominantes</strong> generan tensión y ganas de resolver; y los <strong>maj7</strong> transmiten una atmósfera suave estilo Bossa Nova / Jazz.</p>
            </div>

          </div>
        </div>

        <!-- 5. MODAL CALCULADORA DE CEJILLA -->
        <div id="modal-capo" class="tool-modal-overlay">
          <div class="tool-modal-header">
            <button class="btn-close-modal">‹ Volver</button>
            <h2>Calculadora Armónica de Cejilla (Capo)</h2>
          </div>
          <div class="tool-modal-body">
            
            <div style="background: var(--bg-surface-solid); border: 1px solid var(--border-subtle); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 20px;">
              <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Coloca el Capotraste en:</span>
              <div id="capoResultFretDisplay" style="font-size: 3.5rem; font-weight: 900; color: var(--accent-primary); margin: 8px 0;">Traste 3</div>
              <p id="capoResultDescription" style="font-size: 0.95rem; color: var(--text-secondary); margin: 0; line-height: 1.5;"></p>
            </div>

            <div class="pro-options-card">
              <h3>Parámetros de Transposición</h3>
              <div class="pro-grid">
                
                <label class="pro-label">
                  <span>1. Tonalidad que quieres cantar:</span>
                  <select id="selCapoTargetKey">
                    ${['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => `
                      <option value="${k}" ${k === this.capoTargetKey ? 'selected' : ''}>Tonalidad de ${k}</option>
                    `).join('')}
                  </select>
                </label>

                <label class="pro-label">
                  <span>2. Forma de acordes abiertos:</span>
                  <select id="selCapoOpenShape">
                    ${['C', 'A', 'G', 'E', 'D', 'Am', 'Em', 'Dm'].map(s => `
                      <option value="${s}" ${s === this.capoOpenShape ? 'selected' : ''}>Posición de [${s}]</option>
                    `).join('')}
                  </select>
                </label>

              </div>
            </div>

            <div class="tool-info-box">
              <h4>💡 ¿Por qué usar Cejilla / Capotraste?</h4>
              <p>El capotraste te permite cantar en tu rango vocal perfecto (por ejemplo, en Mi bemol o Fa sostenido) sin tener que tocar incómodos acordes con cejilla en todos los compases. Al colocar el capo, aprovechas la resonancia y facilidad de los acordes abiertos (C, G, D, Em).</p>
            </div>

          </div>
        </div>

        <!-- 6. MODAL CÍRCULO DE QUINTAS -->
        <div id="modal-circle" class="tool-modal-overlay">
          <div class="tool-modal-header">
            <button class="btn-close-modal">‹ Volver</button>
            <h2>Círculo de Quintas & Mapa de Armonía</h2>
          </div>
          <div class="tool-modal-body">
            
            <div class="pro-options-card" style="margin-top: 0; margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                <h3 style="margin: 0;">Selecciona Tonalidad Central:</h3>
                <select id="selCircleKey" style="background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-strong); padding: 8px 14px; border-radius: 10px; font-weight: 800;">
                  ${['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb'].map(k => `
                    <option value="${k}" ${k === this.circleKey ? 'selected' : ''}>Tonalidad de ${k}</option>
                  `).join('')}
                </select>
              </div>

              <!-- Grados Armónicos -->
              <div id="circleDegreesGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;"></div>
            </div>

            <div class="tool-info-box">
              <h4>💡 Cómo Componer y Acompañar usando el Círculo</h4>
              <p>Los acordes más cercanos entre sí en el círculo de quintas suenan naturalmente armónicos y fluidos. La progresión más famosa de la música moderna (<strong>I - V - vi - IV</strong>) utiliza exactamente los acordes principales que ves en esta pantalla. Pulsa cualquiera de las tarjetas para escuchar su función sonora.</p>
            </div>

          </div>
        </div>

      </div>
    `;

    this.bindEvents();
  }

  // =========================================================================
  // BINDING DE EVENTOS INTERACTIVOS
  // =========================================================================

  bindEvents() {
    // 1. Abrir modales
    this.container.querySelectorAll('.premium-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const toolId = item.dataset.tool;
        this.openToolModal(toolId);
      });
    });

    // 2. Cerrar modales
    this.container.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeToolModal();
      });
    });

    // 3. Metrónomo
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

    this.container.querySelector('#selMetronomeTimeSig')?.addEventListener('change', (e) => {
      this.metronomeTimeSignature = e.target.value;
      const totalDots = parseInt(this.metronomeTimeSignature.split('/')[0], 10) || 4;
      const dotsRow = this.container.querySelector('#metronomeDotsRow');
      if (dotsRow) {
        dotsRow.innerHTML = Array.from({ length: totalDots }).map((_, idx) => `
          <span class="metronome-beat-dot ${idx === 0 ? 'accent' : ''}"></span>
        `).join('');
      }
    });

    this.container.querySelector('#selMetronomeSubdiv')?.addEventListener('change', (e) => {
      this.metronomeSubdivision = e.target.value;
    });

    this.container.querySelector('#selMetronomeSound')?.addEventListener('change', (e) => {
      this.metronomeSound = e.target.value;
    });

    this.container.querySelector('#chkMetronomeAccent')?.addEventListener('change', (e) => {
      this.metronomeAccent = e.target.checked;
    });

    // 4. Afinador
    this.container.querySelector('#selTuningPreset')?.addEventListener('change', (e) => {
      this.selectedTuning = e.target.value;
      this.renderTunerStrings();
    });

    this.container.querySelector('#btnFreq440')?.addEventListener('click', () => {
      this.tunerFrequency = 440;
      this.container.querySelector('#btnFreq440').classList.add('active');
      this.container.querySelector('#btnFreq432').classList.remove('active');
      this.renderTunerStrings();
      toast.show('Calibración establecida en 440 Hz', 'info', 600);
    });

    this.container.querySelector('#btnFreq432')?.addEventListener('click', () => {
      this.tunerFrequency = 432;
      this.container.querySelector('#btnFreq432').classList.add('active');
      this.container.querySelector('#btnFreq440').classList.remove('active');
      this.renderTunerStrings();
      toast.show('Calibración establecida en 432 Hz', 'info', 600);
    });

    // 5. Diccionario
    this.container.querySelector('#selDictInstrument')?.addEventListener('change', (e) => {
      this.dictInstrument = e.target.value;
      this.updateChordDictionary();
    });

    this.container.querySelector('#btnAuditionDictChord')?.addEventListener('click', () => {
      this.auditionCurrentChord();
    });

    this.container.querySelectorAll('#dictRootButtons .pro-badge').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('#dictRootButtons .pro-badge').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.dictRoot = btn.dataset.root;
        this.updateChordDictionary();
      });
    });

    this.container.querySelectorAll('#dictQualityButtons .pro-badge').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('#dictQualityButtons .pro-badge').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.dictQuality = btn.dataset.quality;
        this.updateChordDictionary();
      });
    });

    // 6. Entrenador de Oído
    this.container.querySelector('#btnPlayEarChord')?.addEventListener('click', () => {
      this.playCurrentEarQuestion();
    });

    this.container.querySelector('#btnEarDiffEasy')?.addEventListener('click', () => {
      this.earDifficulty = 'easy';
      this.container.querySelector('#btnEarDiffEasy').classList.add('active');
      this.container.querySelector('#btnEarDiffMed').classList.remove('active');
      this.container.querySelector('#btnEarDiffHard').classList.remove('active');
      this.startEarTest();
    });

    this.container.querySelector('#btnEarDiffMed')?.addEventListener('click', () => {
      this.earDifficulty = 'medium';
      this.container.querySelector('#btnEarDiffEasy').classList.remove('active');
      this.container.querySelector('#btnEarDiffMed').classList.add('active');
      this.container.querySelector('#btnEarDiffHard').classList.remove('active');
      this.startEarTest();
    });

    this.container.querySelector('#btnEarDiffHard')?.addEventListener('click', () => {
      this.earDifficulty = 'hard';
      this.container.querySelector('#btnEarDiffEasy').classList.remove('active');
      this.container.querySelector('#btnEarDiffMed').classList.remove('active');
      this.container.querySelector('#btnEarDiffHard').classList.add('active');
      this.startEarTest();
    });

    // 7. Cejilla
    this.container.querySelector('#selCapoTargetKey')?.addEventListener('change', (e) => {
      this.capoTargetKey = e.target.value;
      this.updateCapoUI();
    });

    this.container.querySelector('#selCapoOpenShape')?.addEventListener('change', (e) => {
      this.capoOpenShape = e.target.value;
      this.updateCapoUI();
    });

    // 8. Círculo de Quintas
    this.container.querySelector('#selCircleKey')?.addEventListener('change', (e) => {
      this.circleKey = e.target.value;
      this.updateCircleUI();
    });
  }
}
