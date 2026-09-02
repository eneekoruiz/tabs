/**
 * @file PitchLaneCanvas.js
 * @description Motor visual de Pitch Lane 2D en Canvas — Simply Sing style.
 * Dibuja la estela de la voz del cantante en tiempo real sobre una escala cromática.
 * Verde = afinado (±15 c), Naranja = casi (16-40 c), Rojo = desafinado (>40 c).
 * Target: 60 FPS estables con requestAnimationFrame.
 */

import { events } from '../../core/EventBus.js';
import { VFXEngine } from './VFXEngine.js';

const NOTE_NAMES    = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const COLOR_IN_TUNE   = '#22c55e';
const COLOR_NEAR_TUNE = '#f59e0b';
const COLOR_OUT_TUNE  = '#ef4444';
const HISTORY_MS      = 4000; // ms de historia visible
const MIDI_MIN        = 36;   // C2
const MIDI_MAX        = 84;   // C6
const MIDI_RANGE      = MIDI_MAX - MIDI_MIN;

export class PitchLaneCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ showNoteLabels?: boolean, trailWidth?: number }} options
   */
  constructor(canvas, options = {}) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.options = { showNoteLabels: true, trailWidth: 4, ...options };

    this.isRunning   = false;
    this.animFrameId = null;
    this._dpr        = 1;

    // Crear canvas overlay para VFX
    this.vfxCanvas = document.createElement('canvas');
    this.vfxCanvas.style.position = 'absolute';
    this.vfxCanvas.style.top = '0';
    this.vfxCanvas.style.left = '0';
    this.vfxCanvas.style.width = '100%';
    this.vfxCanvas.style.height = '100%';
    this.vfxCanvas.style.pointerEvents = 'none';
    this.vfxCanvas.style.zIndex = '10';
    this.canvas.parentElement.appendChild(this.vfxCanvas);
    
    this.vfxEngine = new VFXEngine(this.vfxCanvas);

    /** @type {Array<{time:number, midi:number|null, note:string, octave:string|number, accuracyStatus:string}|{time:number, silence:true}>} */
    this.trail = [];

    this._pitchUnsub   = null;
    this._silenceUnsub = null;
    this._resizeObs    = null;

    /** @type {Array<{startTime:number, duration:number, midi:number, text:string}>} */
    this.targetBlocks = [];
    this.targetStartTime = 0;

    this._setupCanvas();
    this._bindResize();
  }

  setTargetLyrics(chordProText, tempo = 120) {
    if (!chordProText) return;
    this.targetBlocks = [];
    
    // Parseo avanzado: Extraer la estructura real de acordes y letra
    // Usaremos el acorde activo más reciente como referencia armónica (Fundamental/Root)
    const tokens = chordProText.split(/(\[.*?\]|\s+)/).filter(Boolean);
    
    let currentMidi = 60; // Por defecto C4 (Midi 60)
    let currentNoteName = 'C';
    let timeCursor = 2000; // Empezar en 2 segundos relativos a currentTime
    const msPerBeat = (60 / tempo) * 1000;
    
    // Diccionario de conversión de nombre de nota a MIDI (Octava 4)
    const baseMidi = { 'C': 60, 'C#': 61, 'Db': 61, 'D': 62, 'D#': 63, 'Eb': 63, 'E': 64, 'F': 65, 'F#': 66, 'Gb': 66, 'G': 67, 'G#': 68, 'Ab': 68, 'A': 69, 'A#': 70, 'Bb': 70, 'B': 71 };

    tokens.forEach(token => {
      const t = token.trim();
      if (!t) return;
      
      if (t.startsWith('[') && t.endsWith(']')) {
        // Es un acorde real de la canción
        const chordName = t.slice(1, -1);
        const rootMatch = chordName.match(/^[A-G][#b]?/);
        if (rootMatch && baseMidi[rootMatch[0]]) {
          currentMidi = baseMidi[rootMatch[0]];
          currentNoteName = rootMatch[0];
        }
      } else {
        // Es una palabra o sílaba real
        const duration = msPerBeat * (t.length > 4 ? 1 : 0.5);
        const gap = msPerBeat * 0.25;
        
        this.targetBlocks.push({
          startTime: timeCursor,
          duration: duration,
          midi: currentMidi,
          noteName: currentNoteName,
          text: t
        });
        timeCursor += duration + gap;
      }
    });
  }

  play() {
    this.isPlaying = true;
    this.lastTimestamp = performance.now();
  }

  pause() {
    this.isPlaying = false;
  }

  seek(timeMs) {
    this.currentTime = timeMs;
  }

  /** Inicia la escucha de eventos y el bucle de renderizado. */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPlaying = false;
    this.currentTime = 0;
    this.lastTimestamp = performance.now();
    this.trail = [];

    this._pitchUnsub = events.on('vocalCoach:pitch', (pitch) => {
      if (!this.isPlaying) return; // Solo guardar rastro si está reproduciendo
      const now = this.currentTime;
      const abs = Math.abs(pitch.centsOffset ?? 0);
      const acc = abs <= 15 ? 'in-tune' : abs <= 40 ? 'near-tune' : 'out-tune';
      this.trail.push({
        time: now,
        midi: pitch.midi,
        note: pitch.note ?? '?',
        octave: pitch.octave ?? '',
        accuracyStatus: acc,
      });
      // Prevenir fugas de memoria limitando el buffer
      if (this.trail.length > 400) {
        this.trail.shift();
      }
      // Purgar puntos más viejos que el horizonte visible
      const cutoff = now - HISTORY_MS - 200;
      while (this.trail.length && this.trail[0].time < cutoff) this.trail.shift();
    });

    this._silenceUnsub = events.on('vocalCoach:silence', () => {
      if (!this.isPlaying) return;
      // Punto nulo para romper la polilínea (nueva frase)
      this.trail.push({ time: this.currentTime, silence: true });
    });

    if (this.vfxEngine) this.vfxEngine.start();
    this._loop(performance.now());
  }

  /** Detiene el bucle y libera los listeners. */
  stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.vfxEngine) this.vfxEngine.stop();
    this._pitchUnsub?.();
    this._silenceUnsub?.();
    this._resizeObs?.disconnect();
  }

  _loop(timestamp) {
    if (!this.isRunning) return;
    
    if (this.lastTimestamp === undefined) {
      this.lastTimestamp = timestamp;
    }
    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    if (this.isPlaying) {
      this.currentTime += delta;
    }

    this._draw();
    this.animFrameId = requestAnimationFrame((ts) => this._loop(ts));
  }

  // ── Renderizado ────────────────────────────────────────────────────────────

  _draw() {
    const { canvas, ctx } = this;
    const dpr    = this._dpr;
    // Dimensiones lógicas (sin DPR) para que el posicionamiento sea correcto
    const W      = canvas.width  / dpr;
    const H      = canvas.height / dpr;
    
    // Usamos el reloj interno en lugar de performance.now()
    const now    = this.currentTime;
    
    const LABEL  = this.options.showNoteLabels ? 32 : 0;
    const DRAW_W = W - LABEL;

    ctx.save();
    ctx.scale(dpr, dpr);

    // ── Fondo ──
    ctx.fillStyle = 'rgba(8, 5, 18, 0.97)';
    ctx.fillRect(0, 0, W, H);

    // ── Helpers de coordenadas ──
    // El presente está en el centro.
    // Izquierda (LABEL) = now - HISTORY_MS/2
    // Centro (LABEL + DRAW_W/2) = now
    // Derecha (W) = now + HISTORY_MS/2
    const midiToY = (midi) => (1 - (midi - MIDI_MIN) / MIDI_RANGE) * H;
    const timeToX = (t)    => {
      const msOffset = t - now; // Negativo=pasado, Positivo=futuro
      // Mapear offset de [-2000, +2000] a [LABEL, W]
      return LABEL + (msOffset / (HISTORY_MS/2) + 1) * (DRAW_W / 2);
    };

    // ── Grid de notas ──
    for (let m = MIDI_MIN; m <= MIDI_MAX; m++) {
      const noteName = NOTE_NAMES[m % 12];
      const isC      = noteName === 'C';
      const isSharp  = noteName.includes('#');
      const y        = midiToY(m);

      ctx.strokeStyle = isC
        ? 'rgba(255,255,255,0.18)'
        : isSharp
          ? 'rgba(255,255,255,0.03)'
          : 'rgba(255,255,255,0.07)';
      ctx.lineWidth = isC ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(LABEL, y);
      ctx.lineTo(W, y);
      ctx.stroke();

      // Etiqueta de octava (C2, C3, C4, C5, C6)
      if (isC && LABEL > 0) {
        const oct = Math.floor(m / 12) - 1;
        ctx.fillStyle    = 'rgba(255,255,255,0.4)';
        ctx.font         = '700 9px system-ui, sans-serif';
        ctx.textAlign    = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`C${oct}`, LABEL - 3, y);
      }
    }

    // ── Línea vertical "cursor" (ahora) ──
    const cursorX = timeToX(now);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Notas Objetivo & Letras (Target Blocks) ──
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = '800 24px system-ui, sans-serif';
    
    for (let i = 0; i < this.targetBlocks.length; i++) {
      const block = this.targetBlocks[i];
      const startX = timeToX(block.startTime);
      const endX   = timeToX(block.startTime + block.duration);
      
      // Solo dibujar si está en el viewport
      if (endX < 0 || startX > W) continue;
      
      const y = midiToY(block.midi);
      const blockHeight = 36;
      
      // Hit Detection: ¿El usuario está cantando esta nota correctamente AHORA MISMO?
      let hitSuccess = false;
      let isCurrentBlock = (startX <= cursorX && endX >= cursorX);
      
      if (isCurrentBlock && this.trail.length > 0) {
        const lastPt = this.trail[this.trail.length - 1];
        // Tolerancia de 1 semitono para detectar el "Hit"
        if (!lastPt.silence && Math.abs(lastPt.midi - block.midi) <= 1.0) {
          hitSuccess = true;
          block.hitFrames = (block.hitFrames || 0) + 1;
        }
      }
      
      // Dibujar "Píldora"
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      if (isCurrentBlock) {
        if (hitSuccess) {
          ctx.fillStyle = 'rgba(0, 255, 128, 0.7)'; // Neón Verde "Hit"
          ctx.shadowColor = 'rgba(0, 255, 128, 0.8)';
          ctx.shadowBlur = 15;
          
          if (block.hitFrames === 15) {
             import('../Toast.js').then(({ toast }) => toast.show('¡Perfecto! 🎤', 'success', 1000));
          }
        } else {
          ctx.fillStyle = 'rgba(0, 122, 255, 0.4)'; // Azul normal
        }
      }
      
      ctx.fillRect(startX, y - blockHeight/2, endX - startX, blockHeight);
      ctx.shadowBlur = 0; // Resetear sombra para los textos
      
      // Dibujar Letra encima
      ctx.fillStyle = startX <= cursorX && endX >= cursorX ? '#fff' : 'rgba(255,255,255,0.8)';
      const centerX = startX + (endX - startX) / 2;
      ctx.fillText(block.text, centerX, y);

      // Dibujar Nota (Ej: 'C#')
      if (block.noteName) {
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255, 215, 0, 0.9)'; // Dorado
        ctx.fillText(block.noteName, centerX, y - blockHeight/2 - 10);
        ctx.font = '800 24px system-ui, sans-serif'; // Restaurar font original
      }
    }

    // ── Estela de la voz ──
    if (this.trail.length < 2) { ctx.restore(); return; }

    let seg = [];
    let col = COLOR_IN_TUNE;
    let lastPt = null;

    const flush = (color, path) => {
      if (path.length < 2) return;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur  = 10;
      ctx.strokeStyle = color;
      ctx.lineWidth   = this.options.trailWidth;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
      ctx.restore();
    };

    for (let i = 0; i < this.trail.length; i++) {
      const pt = this.trail[i];
      const x  = timeToX(pt.time);
      if (x < LABEL) continue;

      // Silencio: romper polilínea
      if (pt.silence) {
        flush(col, seg);
        seg = [];
        lastPt = null;
        continue;
      }

      const y = midiToY(pt.midi);
      const c = pt.accuracyStatus === 'in-tune'
        ? COLOR_IN_TUNE
        : pt.accuracyStatus === 'near-tune'
          ? COLOR_NEAR_TUNE
          : COLOR_OUT_TUNE;
          
      // Exponer estado al DOM para tests E2E
      if (window.__IS_TESTING__) {
        window.__VOCAL_STATE__ = {
          isHit: c === COLOR_IN_TUNE,
          currentMidi: pt.midi,
          accuracy: pt.accuracyStatus,
          trailLength: this.trail.length
        };
      }

      // Cambio de color → cerrar segmento anterior y abrir uno nuevo
      if (c !== col && seg.length > 0) {
        flush(col, seg);
        seg = [lastPt ?? { x, y }];
        col = c;
      }
      col = c;
      seg.push({ x, y });
      lastPt = { x, y };

      // Punto más reciente: dibujar círculo + etiqueta
      if (i === this.trail.length - 1) {
        flush(col, seg);
        seg = [];

        // Glow dot
        ctx.save();
        ctx.shadowColor = c;
        ctx.shadowBlur  = 20;
        ctx.fillStyle   = c;
        ctx.beginPath();
        ctx.arc(x, y, this.options.trailWidth + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Etiqueta de nota (A4, C#3…)
        const noteLabel = `${pt.note}${pt.octave}`;
        if (x + 30 < W) {
          ctx.fillStyle    = c;
          ctx.font         = '800 11px system-ui, sans-serif';
          ctx.textAlign    = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(noteLabel, x + 8, y);
        }
      }
    }
    flush(col, seg);
    ctx.restore();
  }

  // ── Setup y resize ─────────────────────────────────────────────────────────

  _setupCanvas() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr  = window.devicePixelRatio || 1;
    this._dpr  = dpr;
    const rect = parent.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.canvas.width  = Math.round(rect.width  * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.canvas.style.width  = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  _bindResize() {
    if (!window.ResizeObserver) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this._resizeObs = new ResizeObserver(() => {
      const dpr  = window.devicePixelRatio || 1;
      this._dpr  = dpr;
      const rect = parent.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.canvas.width  = Math.round(rect.width  * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
      this.canvas.style.width  = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
    });
    this._resizeObs.observe(parent);
  }
}

export default PitchLaneCanvas;
