/**
 * @file PitchLaneCanvas.js
 * @description Motor visual de Pitch Lane 2D en Canvas — Simply Sing style.
 * Dibuja la estela de la voz del cantante en tiempo real sobre una escala cromática.
 * Verde = afinado (±15 c), Naranja = casi (16-40 c), Rojo = desafinado (>40 c).
 * Target: 60 FPS estables con requestAnimationFrame.
 */

import { events } from '../../core/EventBus.js';
import { VFXEngine } from './VFXEngine.js';
import { vocalCoachEngine } from '../../audio/VocalCoachEngine.js';
import { buildKaraokeTimeline } from '../../audio/KaraokeTimeline.js';

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
    this.karaokeAccompEnabled = true;
    this._lastAccompBlock = null;

    this._setupCanvas();
    this._bindResize();
  }

  setTargetLyrics(chordProText, tempo = 72, songMeta = {}) {
    this.targetBlocks = [];
    const timeline = buildKaraokeTimeline({ ...songMeta, tempo, lyricsChords: chordProText });
    this.lyricLines = timeline.lyricLines;
    this.timingIsEstimated = timeline.timingIsEstimated;
    // Only explicitly supplied vocal notes can become pitch targets.
    if (Array.isArray(songMeta.vocalMelody)) {
      this.targetBlocks = songMeta.vocalMelody.filter(c =>
        c && Number.isFinite(c.startTime) && c.startTime >= 0 && Number.isFinite(c.duration) && c.duration > 0 &&
        Number.isFinite(c.midi) && c.midi >= 36 && c.midi <= 96
      ).map(c => ({ ...c, originalMidi: c.midi, text: c.text || '' }))
        .sort((a, b) => a.startTime - b.startTime);
    }
    this._hasCompleted = false;
    this.setTranspose(this.transposeSemitones || 0, true);
    vocalCoachEngine.setTargetNote(null);
  }

  setTranspose(semitones, force = false) {
    if (!force && semitones === this.transposeSemitones) return;
    this.transposeSemitones = semitones;
    this.targetBlocks.forEach(block => {
      block.midi = block.originalMidi + semitones;
      block.noteName = NOTE_NAMES[Math.round(block.midi) % 12];
    });
    this._lastAccompBlock = null;
    vocalCoachEngine.setTargetNote(null);
  }

  play() {
    this.isPlaying = true;
    this.lastTimestamp = performance.now();
    if (this.vfxEngine) this.vfxEngine.setPlaying(true);
    try { vocalCoachEngine.setPlaybackActive(true); } catch (_) {}
  }

  pause() {
    this.isPlaying = false;
    if (this.vfxEngine) this.vfxEngine.setPlaying(false);
    try { vocalCoachEngine.setPlaybackActive(false); } catch (_) {}
  }

  seek(timeMs) {
    this.currentTime = timeMs;
    this.trail = [];
    this._lastAccompBlock = null;
    vocalCoachEngine.setTargetNote(null);
    this._hasCompleted = false;
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
      if (!this.isPlaying) return;
      const now = this.currentTime;
      const abs = Math.abs(pitch.centsOffset ?? 0);
      const acc = abs <= 15 ? 'in-tune' : abs <= 40 ? 'near-tune' : 'out-tune';
      this.trail.push({
        time: now,
        midi: pitch.midi + (pitch.cents || 0) / 100,
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

      if (typeof window !== 'undefined' && window.__IS_TESTING__) {
        window.__VOCAL_STATE__ = {
          isHit: acc === 'in-tune',
          currentMidi: pitch.midi,
          accuracy: acc,
          trailLength: this.trail.length
        };
      }
    });

    this._silenceUnsub = events.on('vocalCoach:silence', () => {
      if (!this.isPlaying || this.trail.at(-1)?.silence) return;
      // Punto nulo para romper la polilínea (nueva frase)
      this.trail.push({ time: this.currentTime, silence: true });
      if (this.trail.length > 400) this.trail.shift();
    });

    if (this.vfxEngine) this.vfxEngine.start();
    this._loop(performance.now());
  }

  /** Detiene el bucle y libera los listeners. */
  stop() {
    this.isRunning = false;
    this.isPlaying = false;
    try { vocalCoachEngine.setPlaybackActive(false); } catch (_) {}
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.vfxEngine) this.vfxEngine.stop();
    this.vfxCanvas.remove();
    this._pitchUnsub?.();
    this._silenceUnsub?.();
    this._resizeObs?.disconnect();
    vocalCoachEngine.setTargetNote(null);
  }

  _loop(timestamp) {
    if (!this.isRunning) return;
    
    if (this.lastTimestamp === undefined) {
      this.lastTimestamp = timestamp;
    }
    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    if (this.isPlaying) {
      this.currentTime = this.options.clock ? this.options.clock() : this.currentTime + delta;

      // Detección de finalización de la canción (al superar el último bloque lírico + 1.5s)
      if (!this.options.clock && this.targetBlocks.length > 0) {
        const lastBlock = this.targetBlocks[this.targetBlocks.length - 1];
        const songEndTime = (lastBlock.startTime + lastBlock.duration) + 1500;
        if (this.currentTime >= songEndTime && !this._hasCompleted) {
          this._hasCompleted = true;
          this.pause();
          events.emit('pitchLane:songCompleted');
        }
      }

      // Actualizar nota objetivo para el evaluador de afinación vocal (sin interferir con acordes sintéticos)
      if (this.targetBlocks.length > 0) {
        const activeBlock = this.targetBlocks.find(
          b => b.startTime <= this.currentTime && (b.startTime + b.duration) >= this.currentTime
        );
        if (activeBlock !== this._lastAccompBlock) {
          this._lastAccompBlock = activeBlock;
          vocalCoachEngine.setTargetNote(activeBlock && !activeBlock.isInterlude ? activeBlock.midi : null);
        }
      }
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
      
      if (this.isPlaying && isCurrentBlock && !block.isInterlude && this.trail.length > 0) {
        const lastPt = this.trail[this.trail.length - 1];
        if (!lastPt.silence) {
          // Evaluar afinación considerando octavas naturales (ej. voz masculina octava 3 vs objetivo octava 4)
          const absDiff = Math.abs(lastPt.midi - block.midi);
          const isNoteMatch = absDiff <= 0.35 && this.currentTime - lastPt.time < 150;
          if (isNoteMatch) {
            hitSuccess = true;
            block.hitFrames = (block.hitFrames || 0) + 1;
            // Registrar acierto en VFXEngine cada 8 frames de afinación sostenida
            if (this.vfxEngine && this.isPlaying && block.hitFrames % 8 === 0) {
              this.vfxEngine.registerHit();
            }
          }
        }
      }
      
      // Dibujar "Píldora"
      if (block.isInterlude) {
        // Interludio instrumental (Intro)
        ctx.fillStyle = 'rgba(147, 51, 234, 0.25)'; // Púrpura elegante
        ctx.fillRect(startX, y - blockHeight/2, endX - startX, blockHeight);
        ctx.fillStyle = 'rgba(216, 180, 254, 0.9)';
        const centerX = startX + (endX - startX) / 2;
        ctx.fillText(block.text, centerX, y);
      } else {
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
        if (block.noteName && block.noteName !== 'Intro') {
          ctx.font = '700 12px system-ui, sans-serif';
          ctx.fillStyle = 'rgba(255, 215, 0, 0.9)'; // Dorado
          ctx.fillText(block.noteName, centerX, y - blockHeight/2 - 10);
          ctx.font = '800 24px system-ui, sans-serif'; // Restaurar font original
        }
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
    const dpr  = Math.min(2, window.devicePixelRatio || 1);
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
      const dpr  = Math.min(2, window.devicePixelRatio || 1);
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
