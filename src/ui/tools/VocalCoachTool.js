/**
 * @file VocalCoachTool.js
 * @description Suite de Asistencia Vocal & Pitch Lane en tiempo real (Vocal Coach).
 * Implementa visualizador Pitch Lane (Canvas fluido continuo), análisis de estabilidad,
 * medidor de apoyo respiratorio, tessitura y burbuja de consejos didácticos en directo.
 */

import { events } from '../../core/EventBus.js';
import { vocalCoachEngine } from '../../audio/VocalCoachEngine.js';
import { toast } from '../Toast.js';

export class VocalCoachTool {
  constructor(getAudioContextFn) {
    this.getAudioContext = getAudioContextFn || (() => null);
    this.isListening = false;
    this.selectedTargetNote = 'A4';
    this.activeExercise = 'free'; // 'free' | 'sustain' | 'scale5' | 'siren'
    this.canvas = null;
    this.ctx = null;
    this.pitchPoints = []; // Historial de puntos { x, y, midi, cents, accuracyStatus } para Pitch Lane
    this.animFrameId = null;
    this.exerciseTimer = null;
    this.exerciseScore = 0;

    this.initEvents();
  }

  initEvents() {
    events.on('vocalCoach:pitch', (pitch) => {
      this.updateHUD(pitch);
      this.addPitchPoint(pitch);
    });

    events.on('vocalCoach:silence', (data) => {
      this.updateSilenceHUD(data);
    });

    events.on('vocalCoach:tip', (tip) => {
      this.updateTip(tip);
    });
  }

  open(targetContainerSelector = '#toolModalHost') {
    let host = document.querySelector(targetContainerSelector);
    if (!host) {
      host = document.querySelector('#vocal-coach-container') || document.querySelector('#toolModalHost');
    }
    if (!host) return;
    host.innerHTML = this.renderModal();
    this.attachListeners(host);
  }

  close(host) {
    this.stop();
    if (host) host.innerHTML = '';
  }

  renderModal() {
    const isMicActive = vocalCoachEngine.isRunning;
    const target = vocalCoachEngine.targetNote;
    const targetDisplay = target ? `${target.latin || target.note} (${target.noteWithOctave})` : 'Afinación Libre';
    const lowest = vocalCoachEngine.sessionStats.lowestPitch?.noteWithOctave || '—';
    const highest = vocalCoachEngine.sessionStats.highestPitch?.noteWithOctave || '—';

    return `
      <div class="vocal-coach-modal-overlay" id="modal-vocal-coach" role="dialog" aria-modal="true" aria-label="Asistente Vocal y Pitch Lane">
        <div class="vocal-coach-container-card">
          
          <!-- Encabezado Pro con micro-badges y cierre -->
          <div class="vocal-header">
            <div class="vocal-title-group">
              <div class="vocal-badge-live">
                <span class="vocal-pulse-dot ${isMicActive ? 'active' : ''}"></span>
                <span>VOCAL COACH DSP · EN DIRECTO</span>
              </div>
              <h2 class="vocal-modal-title">Asistente Vocal & Pitch Lane</h2>
            </div>
            <button class="btn-close-modal" id="btnCloseVocalCoach" aria-label="Cerrar Asistente Vocal">✕</button>
          </div>

          <!-- Barra de Controles de Sesión y Micrófono -->
          <div class="vocal-control-bar">
            <button class="btn-vocal-mic-toggle ${isMicActive ? 'recording' : ''}" id="btnToggleVocalMic" aria-label="${isMicActive ? 'Detener micrófono' : 'Activar micrófono'}">
              <span class="mic-icon">${isMicActive ? '⏹️' : '🎙️'}</span>
              <span>${isMicActive ? 'Detener Escucha' : 'Activar Micrófono'}</span>
            </button>

            <!-- Selector de Modo de Ejercicio -->
            <div class="vocal-mode-pills" role="tablist" aria-label="Modos de entrenamiento">
              <button class="vocal-pill-btn ${this.activeExercise === 'free' ? 'active' : ''}" data-exercise="free">Libre / Canción</button>
              <button class="vocal-pill-btn ${this.activeExercise === 'sustain' ? 'active' : ''}" data-exercise="sustain">Sostener Tono (5s)</button>
              <button class="vocal-pill-btn ${this.activeExercise === 'scale5' ? 'active' : ''}" data-exercise="scale5">Escala 5 Tonos</button>
            </div>

            <!-- Diapasón Tono de Referencia -->
            <button class="btn-vocal-pitchpipe" id="btnAuditionTargetTone" title="Escuchar tono de referencia">
              <span>🔊 Tono Guía</span>
            </button>
          </div>

          <!-- PITCH LANE VISUALIZER (Canvas Continuo en Tiempo Real) -->
          <div class="pitch-lane-viewport">
            <div class="pitch-lane-guides">
              <span class="lane-label top">Agudos (C5)</span>
              <span class="lane-label mid">Centro (${targetDisplay})</span>
              <span class="lane-label bot">Graves (C3)</span>
            </div>
            <canvas id="pitchLaneCanvas" class="pitch-lane-canvas" width="680" height="200"></canvas>
            
            <div class="pitch-lane-cursor-line"></div>
          </div>

          <!-- HUD DE RENDIMIENTO VOCAL (Nota, Aguja de Cents, Apoyo y Estabilidad) -->
          <div class="vocal-hud-grid">
            <!-- 1. Tarjeta Nota Cantada -->
            <div class="vocal-hud-card note-card" id="hudNoteCard">
              <span class="hud-label">Nota Detectada</span>
              <div class="hud-note-display">
                <span class="hud-main-note" id="lblVocalCurrentNote">—</span>
                <span class="hud-octave" id="lblVocalOctave"></span>
              </div>
              <span class="hud-freq-sub" id="lblVocalFreq">0.0 Hz</span>
            </div>

            <!-- 2. Aguja de Desviación en Cents -->
            <div class="vocal-hud-card cents-card">
              <div class="cents-header">
                <span class="hud-label">Afinación de Precisión</span>
                <span class="cents-offset-badge" id="lblVocalCentsBadge">0 cents</span>
              </div>
              <div class="cents-meter-track">
                <div class="cents-in-tune-zone"></div>
                <div class="cents-needle" id="vocalCentsNeedle" style="left: 50%;"></div>
              </div>
              <div class="cents-labels">
                <span>-50 (Bajo)</span>
                <span class="center-mark">0</span>
                <span>+50 (Alto)</span>
              </div>
            </div>

            <!-- 3. Medidores de Salud Vocal & Estabilidad -->
            <div class="vocal-hud-card metrics-card">
              <div class="metric-row">
                <span class="metric-name">🌬️ Apoyo Diafragma:</span>
                <div class="metric-bar-wrap">
                  <div class="metric-bar-fill breath" id="barBreathSupport" style="width: 90%;"></div>
                </div>
                <span class="metric-val" id="lblBreathVal">90%</span>
              </div>
              <div class="metric-row">
                <span class="metric-name">✨ Estabilidad:</span>
                <div class="metric-bar-wrap">
                  <div class="metric-bar-fill stability" id="barStability" style="width: 95%;"></div>
                </div>
                <span class="metric-val" id="lblStabilityVal">95%</span>
              </div>
              <div class="metric-row tessitura-row">
                <span class="metric-name">🎼 Rango Sesión:</span>
                <span class="tessitura-badge" id="lblTessitura">${lowest} → ${highest}</span>
              </div>
            </div>
          </div>

          <!-- BURBUJA DE CONSEJOS DIDÁCTICOS DEL VOCAL COACH (TIEMPO REAL) -->
          <div class="vocal-coach-advice-box" id="vocalCoachAdviceBox">
            <div class="advice-avatar">👨‍🏫</div>
            <div class="advice-body">
              <span class="advice-title">Consejo Didáctico en Vivo:</span>
              <p class="advice-text" id="lblVocalCoachTipText">${vocalCoachEngine.currentTip}</p>
            </div>
          </div>

          <!-- Selector Rápido de Tono Objetivo (Matching Pitch) -->
          <div class="vocal-target-selector-bar">
            <span class="target-label">Nota Objetivo:</span>
            <div class="target-notes-row" role="group" aria-label="Seleccionar nota objetivo">
              ${['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'E4', 'G4', 'A4', 'C5'].map(n => `
                <button class="btn-target-note-chip ${this.selectedTargetNote === n ? 'active' : ''}" data-note="${n}">${n}</button>
              `).join('')}
            </div>
          </div>

        </div>
      </div>
    `;
  }

  attachListeners(container) {
    if (!container) return;

    // Canvas Pitch Lane
    this.canvas = container.querySelector('#pitchLaneCanvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.startPitchLaneLoop();
    }

    // Botón micrófono
    container.querySelector('#btnToggleVocalMic')?.addEventListener('click', async () => {
      if (vocalCoachEngine.isRunning) {
        vocalCoachEngine.stop();
        this.isListening = false;
        toast.show('Micrófono desactivado', 'info', 800);
      } else {
        await vocalCoachEngine.start();
        this.isListening = vocalCoachEngine.isRunning;
        if (this.isListening) {
          toast.show('🎙️ Vocal Coach escuchando...', 'success', 1000);
        }
      }
      this.refreshControls(container);
    });

    // Píldoras de Ejercicio
    container.querySelectorAll('.vocal-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ex = btn.dataset.exercise;
        if (ex) this.setExercise(ex, container);
      });
    });

    // Tono de referencia
    container.querySelector('#btnAuditionTargetTone')?.addEventListener('click', () => {
      const target = vocalCoachEngine.targetNote;
      const freq = target ? target.freq : 440;
      vocalCoachEngine.playReferenceTone(freq, 2.0);
      toast.show(`Sonando ${target ? target.noteWithOctave : 'A4 440Hz'}`, 'info', 1000);
    });

    // Chips de notas objetivo
    container.querySelectorAll('.btn-target-note-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const note = chip.dataset.note;
        this.selectedTargetNote = note;
        vocalCoachEngine.setTargetNote(note);
        container.querySelectorAll('.btn-target-note-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        toast.show(`Nota objetivo: ${note}`, 'info', 600);
      });
    });

    // Establecer nota objetivo por defecto
    vocalCoachEngine.setTargetNote(this.selectedTargetNote);
  }

  refreshControls(container) {
    const btnMic = container.querySelector('#btnToggleVocalMic');
    const pulseDot = container.querySelector('.vocal-pulse-dot');
    const isRunning = vocalCoachEngine.isRunning;

    if (btnMic) {
      btnMic.classList.toggle('recording', isRunning);
      btnMic.querySelector('span:last-child').textContent = isRunning ? 'Detener Escucha' : 'Activar Micrófono';
      btnMic.querySelector('.mic-icon').textContent = isRunning ? '⏹️' : '🎙️';
    }
    if (pulseDot) {
      pulseDot.classList.toggle('active', isRunning);
    }
  }

  setExercise(exerciseKey, container) {
    this.activeExercise = exerciseKey;
    container.querySelectorAll('.vocal-pill-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.exercise === exerciseKey);
    });

    if (exerciseKey === 'sustain') {
      toast.show('🎯 Sostén el tono en verde durante 5 segundos continuos', 'info', 2000);
    } else if (exerciseKey === 'scale5') {
      toast.show('🎼 Canta la escala Do-Re-Mi-Fa-Sol subiendo y bajando', 'info', 2000);
    }
  }

  startPitchLaneLoop() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    const render = () => {
      this.drawPitchLane();
      this.animFrameId = requestAnimationFrame(render);
    };
    render();
  }

  stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    vocalCoachEngine.stop();
    this.isListening = false;
  }

  addPitchPoint(pitch) {
    if (!this.canvas) return;

    // Rango MIDI visible en el canvas: MIDI 48 (C3 = 130Hz) a MIDI 72 (C5 = 523Hz)
    const minMidi = 45;
    const maxMidi = 75;
    const midiVal = pitch.midi + (pitch.centsOffset / 100);

    const normalizedY = (midiVal - minMidi) / (maxMidi - minMidi);
    const clampedY = Math.max(0, Math.min(1, 1 - normalizedY)); // 0 arriba (agudos), 1 abajo (graves)
    const yPos = clampedY * this.canvas.height;

    this.pitchPoints.push({
      y: yPos,
      accuracyStatus: pitch.accuracyStatus,
      cents: pitch.centsOffset,
      rms: pitch.rms,
      time: Date.now(),
    });

    if (this.pitchPoints.length > 250) {
      this.pitchPoints.shift();
    }
  }

  drawPitchLane() {
    if (!this.canvas || !this.ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.ctx.clearRect(0, 0, w, h);

    // 1. Fondo y rejilla de semitonos
    this.ctx.fillStyle = 'rgba(10, 12, 16, 0.95)';
    this.ctx.fillRect(0, 0, w, h);

    // Líneas horizontales de guía
    this.ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const lineY = (h / 6) * i;
      this.ctx.strokeStyle = i === 3 ? 'rgba(0, 229, 255, 0.3)' : 'rgba(255, 255, 255, 0.05)';
      this.ctx.beginPath();
      this.ctx.moveTo(0, lineY);
      this.ctx.lineTo(w, lineY);
      this.ctx.stroke();
    }

    // Línea de cursor de tiempo presente
    const cursorX = w * 0.85;
    this.ctx.strokeStyle = 'rgba(255, 87, 34, 0.5)';
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(cursorX, 0);
    this.ctx.lineTo(cursorX, h);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // 2. Dibujar estela continua de afinación (Pitch Stream)
    if (this.pitchPoints.length >= 2) {
      const step = (w * 0.85) / 200;

      for (let i = 1; i < this.pitchPoints.length; i++) {
        const p1 = this.pitchPoints[i - 1];
        const p2 = this.pitchPoints[i];

        const x1 = cursorX - (this.pitchPoints.length - i) * step;
        const x2 = cursorX - (this.pitchPoints.length - 1 - i) * step;

        if (x1 < 0) continue;

        let strokeColor = '#00e676'; // Emerald in-tune
        if (p2.accuracyStatus === 'flat') strokeColor = '#ffb300'; // Amber flat
        else if (p2.accuracyStatus === 'sharp') strokeColor = '#f50057'; // Ruby sharp

        this.ctx.beginPath();
        this.ctx.moveTo(x1, p1.y);
        this.ctx.lineTo(x2, p2.y);
        this.ctx.lineWidth = 3.5;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = strokeColor;
        this.ctx.shadowColor = strokeColor;
        this.ctx.shadowBlur = 8;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
      }
    }
  }

  updateHUD(pitch) {
    const noteEl = document.getElementById('lblVocalCurrentNote');
    const octEl = document.getElementById('lblVocalOctave');
    const freqEl = document.getElementById('lblVocalFreq');
    const centsBadge = document.getElementById('lblVocalCentsBadge');
    const needle = document.getElementById('vocalCentsNeedle');
    const barBreath = document.getElementById('barBreathSupport');
    const lblBreath = document.getElementById('lblBreathVal');
    const barStab = document.getElementById('barStability');
    const lblStab = document.getElementById('lblStabilityVal');
    const lblTess = document.getElementById('lblTessitura');
    const noteCard = document.getElementById('hudNoteCard');

    if (noteEl) noteEl.textContent = pitch.latin || pitch.note;
    if (octEl) octEl.textContent = pitch.octave;
    if (freqEl) freqEl.textContent = `${pitch.frequency} Hz`;

    // Cents offset & needle (-50 a +50 mapeado a 0% - 100%)
    const clampedCents = Math.max(-50, Math.min(50, pitch.centsOffset));
    const needlePercent = ((clampedCents + 50) / 100) * 100;

    if (centsBadge) {
      centsBadge.textContent = `${pitch.centsOffset > 0 ? '+' : ''}${pitch.centsOffset} cents`;
      centsBadge.className = `cents-offset-badge ${pitch.accuracyStatus}`;
    }

    if (needle) {
      needle.style.left = `${needlePercent}%`;
    }

    if (noteCard) {
      noteCard.className = `vocal-hud-card note-card ${pitch.accuracyStatus}`;
    }

    // Métricas
    if (barBreath && lblBreath) {
      barBreath.style.width = `${pitch.breathSupport}%`;
      lblBreath.textContent = `${pitch.breathSupport}%`;
    }
    if (barStab && lblStab) {
      barStab.style.width = `${pitch.stability}%`;
      lblStab.textContent = `${pitch.stability}%`;
    }
    if (lblTess && pitch.sessionStats) {
      const low = pitch.sessionStats.lowestPitch?.noteWithOctave || '—';
      const high = pitch.sessionStats.highestPitch?.noteWithOctave || '—';
      lblTess.textContent = `${low} → ${high}`;
    }
  }

  updateSilenceHUD(data) {
    const noteEl = document.getElementById('lblVocalCurrentNote');
    const octEl = document.getElementById('lblVocalOctave');
    const centsBadge = document.getElementById('lblVocalCentsBadge');
    const needle = document.getElementById('vocalCentsNeedle');
    const noteCard = document.getElementById('hudNoteCard');

    if (noteEl) noteEl.textContent = '—';
    if (octEl) octEl.textContent = '';
    if (centsBadge) {
      centsBadge.textContent = 'Silencio';
      centsBadge.className = 'cents-offset-badge';
    }
    if (needle) needle.style.left = '50%';
    if (noteCard) noteCard.className = 'vocal-hud-card note-card';
  }

  updateTip(tip) {
    const tipText = document.getElementById('lblVocalCoachTipText');
    if (tipText) {
      tipText.textContent = tip;
      tipText.classList.add('highlight');
      setTimeout(() => tipText.classList.remove('highlight'), 400);
    }
  }
}

export default VocalCoachTool;
