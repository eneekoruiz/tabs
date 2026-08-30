/**
 * @file MetronomeTool.js
 * @description Metrónomo Web Audio de Precisión con subdivisiones, compases, sonidos, TAP tempo y feedback visual.
 */

import { audioFeedback } from '../../audio/AudioFeedback.js';
import { toast } from '../Toast.js';

export class MetronomeTool {
  constructor(getAudioContext) {
    this.getAudioContext = getAudioContext;
    this.bpm = parseInt(localStorage.getItem('metronome_bpm'), 10) || 120;
    this.timeSignature = '4/4';
    this.subdivision = 'quarter'; // 'quarter' | 'eighth' | 'triplet' | 'sixteenth'
    this.sound = 'woodblock'; // 'woodblock' | 'digital' | 'drum'
    this.accent = true;
    this.flash = true;
    this.isRunning = false;
    this.nextNoteTime = 0.0;
    this.currentBeat = 0;
    this.schedulerTimer = null;
    this.tapTimes = [];
  }

  setBpm(bpm, container) {
    this.bpm = Math.max(30, Math.min(280, bpm));
    localStorage.setItem('metronome_bpm', this.bpm);
    const bpmVal = container?.querySelector('#metronomeBpmDisplay');
    const bpmSlider = container?.querySelector('#rngMetronomeBpm');
    if (bpmVal) bpmVal.textContent = String(this.bpm);
    if (bpmSlider) bpmSlider.value = this.bpm;
  }

  handleTapTempo(container) {
    const now = performance.now();
    this.tapTimes.push(now);
    if (this.tapTimes.length > 4) this.tapTimes.shift();

    audioFeedback.hapticTap();

    if (this.tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this.tapTimes.length; i++) {
        intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 30 && calculatedBpm <= 280) {
        this.setBpm(calculatedBpm, container);
        toast.show(`TAP Tempo: ${calculatedBpm} BPM`, 'info', 600);
      }
    }
  }

  toggle(container) {
    this.isRunning = !this.isRunning;
    if (this.isRunning) {
      this.start(container);
      toast.show(`Metrónomo: ${this.bpm} BPM (${this.timeSignature})`, 'info', 800);
    } else {
      this.stop(container);
      toast.show('Metrónomo detenido', 'info', 700);
    }
    this.updateUI(container);
  }

  start(container) {
    const ctx = this.getAudioContext();
    this.currentBeat = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;

    const schedule = () => {
      while (this.nextNoteTime < ctx.currentTime + 0.1) {
        this.scheduleBeat(this.currentBeat, this.nextNoteTime, container);
        
        let subMultiplier = 1;
        if (this.subdivision === 'eighth') subMultiplier = 0.5;
        else if (this.subdivision === 'triplet') subMultiplier = 1 / 3;
        else if (this.subdivision === 'sixteenth') subMultiplier = 0.25;

        const secondsPerBeat = (60.0 / this.bpm) * subMultiplier;
        this.nextNoteTime += secondsPerBeat;
        this.currentBeat++;
      }
    };

    this.schedulerTimer = setInterval(schedule, 25);
  }

  stop(container) {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.currentBeat = 0;
    const leds = container?.querySelectorAll('.metronome-beat-dot');
    if (leds) leds.forEach(l => l.classList.remove('active', 'accent'));
  }

  scheduleBeat(beatNumber, time, container) {
    const ctx = this.getAudioContext();
    const beatsPerMeasure = parseInt(this.timeSignature.split('/')[0], 10) || 4;
    
    let subFactor = 1;
    if (this.subdivision === 'eighth') subFactor = 2;
    else if (this.subdivision === 'triplet') subFactor = 3;
    else if (this.subdivision === 'sixteenth') subFactor = 4;

    const isMainBeat = (beatNumber % subFactor) === 0;
    const measureBeat = Math.floor(beatNumber / subFactor) % beatsPerMeasure;
    const isAccent = isMainBeat && measureBeat === 0 && this.accent;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (this.sound === 'woodblock') {
      osc.type = 'sine';
      osc.frequency.value = isAccent ? 1400 : (isMainBeat ? 900 : 600);
      gain.gain.setValueAtTime(isAccent ? 1.0 : (isMainBeat ? 0.7 : 0.35), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
      osc.start(time);
      osc.stop(time + 0.045);
    } else if (this.sound === 'digital') {
      osc.type = 'square';
      osc.frequency.value = isAccent ? 2000 : (isMainBeat ? 1000 : 700);
      gain.gain.setValueAtTime(isAccent ? 0.6 : (isMainBeat ? 0.35 : 0.15), time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
      osc.start(time);
      osc.stop(time + 0.035);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isAccent ? 180 : (isMainBeat ? 110 : 80), time);
      osc.frequency.exponentialRampToValueAtTime(30, time + 0.07);
      gain.gain.setValueAtTime(isAccent ? 1.0 : 0.6, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
      osc.start(time);
      osc.stop(time + 0.085);
    }

    if (isMainBeat && this.flash) {
      const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
      setTimeout(() => {
        const leds = container?.querySelectorAll('.metronome-beat-dot');
        if (leds && leds.length > 0) {
          leds.forEach((led, idx) => {
            if (idx === measureBeat) {
              led.classList.add(isAccent ? 'accent' : 'active');
            } else {
              led.classList.remove('active', 'accent');
            }
          });
        }
      }, delayMs);
    }
  }

  updateUI(container) {
    const btn = container?.querySelector('#btnToggleMetronome');
    if (btn) {
      btn.innerHTML = this.isRunning
        ? '<span>⏹ Detener Metrónomo</span>'
        : '<span>▶ Iniciar Metrónomo</span>';
      btn.classList.toggle('active', this.isRunning);
    }
  }

  renderModal() {
    const beatsPerMeasure = parseInt(this.timeSignature.split('/')[0], 10) || 4;
    return `
      <div class="tool-modal-overlay active" id="toolModalOverlay">
        <div class="tool-modal-dialog">
          <div class="tool-modal-header">
            <div class="tool-modal-title">
              <span class="tool-modal-icon">⏱️</span>
              <div>
                <span class="tool-badge-studio">TEMPO & RITMO DE ESTUDIO</span>
                <h2>Metrónomo de Precisión Pro</h2>
              </div>
            </div>
            <button class="btn-close-tool-modal" id="btnCloseToolModal">✕</button>
          </div>

          <div class="tool-panoramic-layout">
            <div class="tool-panoramic-main">
              <div class="metronome-visual-bpm-box">
                <span class="metronome-tempo-name">${this.getTempoName(this.bpm)}</span>
                <span class="metronome-bpm-big" id="metronomeBpmDisplay">${this.bpm}</span>
                <span class="metronome-bpm-label">BPM (Pulsos por Minuto)</span>
              </div>

              <div class="metronome-led-strip">
                ${Array.from({ length: beatsPerMeasure }).map((_, i) => `
                  <div class="metronome-beat-dot ${i === 0 ? 'accent' : ''}" data-beat="${i}"></div>
                `).join('')}
              </div>

              <div class="metronome-stepper-row">
                <button class="btn-bpm-step" data-delta="-5">-5</button>
                <button class="btn-bpm-step" data-delta="-1">-1</button>
                <input type="range" class="bpm-slider-full" id="rngMetronomeBpm" min="30" max="280" value="${this.bpm}">
                <button class="btn-bpm-step" data-delta="1">+1</button>
                <button class="btn-bpm-step" data-delta="5">+5</button>
              </div>

              <div class="metronome-action-cluster">
                <button class="btn-metronome-main ${this.isRunning ? 'active' : ''}" id="btnToggleMetronome">
                  <span>${this.isRunning ? '⏹ Detener Metrónomo' : '▶ Iniciar Metrónomo'}</span>
                </button>
                <button class="btn-tap-tempo" id="btnTapTempo">
                  <span>🖐️ TAP TEMPO</span>
                </button>
              </div>
            </div>

            <div class="tool-panoramic-side">
              <div class="metronome-side-controls">
                <div class="metro-param-group">
                  <label class="metro-param-label">Compás Rítmico</label>
                  <div class="metro-pill-grid">
                    ${['2/4', '3/4', '4/4', '6/8', '12/8'].map(ts => `
                      <button class="metro-pill-btn ${this.timeSignature === ts ? 'active' : ''}" data-param="timeSignature" data-val="${ts}">${ts}</button>
                    `).join('')}
                  </div>
                </div>

                <div class="metro-param-group">
                  <label class="metro-param-label">Subdivisión de Pulso</label>
                  <div class="metro-pill-grid">
                    <button class="metro-pill-btn ${this.subdivision === 'quarter' ? 'active' : ''}" data-param="subdivision" data-val="quarter">♩ Negras</button>
                    <button class="metro-pill-btn ${this.subdivision === 'eighth' ? 'active' : ''}" data-param="subdivision" data-val="eighth">♫ Corcheas</button>
                    <button class="metro-pill-btn ${this.subdivision === 'triplet' ? 'active' : ''}" data-param="subdivision" data-val="triplet">3️⃣ Tresillos</button>
                    <button class="metro-pill-btn ${this.subdivision === 'sixteenth' ? 'active' : ''}" data-param="subdivision" data-val="sixteenth">♬ Semicorcheas</button>
                  </div>
                </div>

                <div class="metro-param-group">
                  <label class="metro-param-label">Timbre del Click</label>
                  <div class="metro-pill-grid">
                    <button class="metro-pill-btn ${this.sound === 'woodblock' ? 'active' : ''}" data-param="sound" data-val="woodblock">🪵 Clave Madera</button>
                    <button class="metro-pill-btn ${this.sound === 'digital' ? 'active' : ''}" data-param="sound" data-val="digital">⚡ Digital Beep</button>
                    <button class="metro-pill-btn ${this.sound === 'drum' ? 'active' : ''}" data-param="sound" data-val="drum">🥁 Bombo / Rim</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getTempoName(bpm) {
    if (bpm < 60) return 'Largo / Grave';
    if (bpm < 76) return 'Adagio (Lento y expresivo)';
    if (bpm < 108) return 'Andante (Al paso)';
    if (bpm < 120) return 'Moderato (Tiempo medio)';
    if (bpm < 156) return 'Allegro (Rápido y alegre)';
    if (bpm < 200) return 'Vivace / Presto';
    return 'Prestissimo (Máxima velocidad)';
  }
}

export default MetronomeTool;
