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

  setTargetLyrics(chordProText, tempo = 72) {
    if (!chordProText) return;
    this.targetBlocks = [];

    const cleanTempo = Number(tempo) && Number(tempo) >= 35 && Number(tempo) <= 240 ? Number(tempo) : 72;
    const msPerBeat = (60 / cleanTempo) * 1000;

    const NOTE_TO_SEMITONE = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    const SEMITONE_TO_NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Selección armónica con mínima distancia de conducción de voces (evita saltos bruscos antinaturales)
    const getNearestChordTone = (chordName, prevMidi = 60) => {
      const match = chordName.match(/^([A-G][#b]?)(m|min|maj|7|sus|dim|aug)?/i);
      if (!match) return prevMidi;
      const rootStr = match[1].charAt(0).toUpperCase() + (match[1].slice(1) || '');
      const quality = (match[2] || '').toLowerCase();
      const semitone = NOTE_TO_SEMITONE[rootStr] ?? 0;
      const isMinor = quality.startsWith('m') && !quality.startsWith('maj');
      const third = (semitone + (isMinor ? 3 : 4)) % 12;
      const fifth = (semitone + 7) % 12;

      const pitchClasses = [semitone, third, fifth];
      let bestMidi = prevMidi;
      let minDistance = Infinity;

      // Mantener en el registro vocal natural (C3 a C5 aprox, centrado en 60)
      for (let oct = 3; oct <= 4; oct++) {
        for (const pc of pitchClasses) {
          const candidateMidi = (oct + 1) * 12 + pc;
          if (candidateMidi < 48 || candidateMidi > 74) continue;
          const dist = Math.abs(candidateMidi - prevMidi);
          if (dist < minDistance) {
            minDistance = dist;
            bestMidi = candidateMidi;
          }
        }
      }
      return bestMidi;
    };

    let currentMidi = 60; // C4 inicial
    let currentNoteName = 'C';
    let timeCursor = 0; // Iniciar en 0
    let inIntro = false;

    const lines = chordProText.split(/\r?\n/);

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l].trim();
      if (!line) {
        if (!inIntro) timeCursor += msPerBeat * 1.5;
        continue;
      }

      // Detectar secciones como [Intro], [Verse], [Chorus], [Bridge], [Outro]
      if (/^\[(intro|verse|estribillo|chorus|coro|bridge|puente|outro|pre-chorus|pre-coro)[^\]]*\]$/i.test(line)) {
        const isIntro = /intro/i.test(line);
        if (isIntro) {
          inIntro = true;
          // Intro instrumental: 8 tiempos (2 compases a tempo real)
          const introDur = msPerBeat * 8;
          this.targetBlocks.push({
            startTime: timeCursor,
            duration: introDur,
            midi: 60,
            noteName: 'Intro',
            text: '🎹 Intro Instrumental',
            isInterlude: true
          });
          timeCursor += introDur;
        } else {
          inIntro = false;
          // Pausa entre estrofas: 1 compás (4 tiempos) de descanso
          timeCursor += msPerBeat * 2.5;
        }
        continue;
      }

      // Línea de solo acordes instrumentales (ej: "[C] [Dm] [Am] [F]")
      const isOnlyChords = /^(\s*\[[^\]]+\]\s*)+$/.test(line);
      if (isOnlyChords) {
        if (inIntro) {
          // Dentro de la intro ya está contabilizado en el bloque Intro
          continue;
        }
        const chordMatches = line.match(/\[[^\]]+\]/g) || [];
        timeCursor += chordMatches.length * msPerBeat * 1;
        continue;
      }

      inIntro = false;

      // Línea cantada con acordes y letra
      const tokens = line.split(/(\[[^\]]+\]|\s+)/).filter(Boolean);
      const wordsInLine = [];

      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i].trim();
        if (!tok) continue;
        if (tok.startsWith('[') && tok.endsWith(']')) {
          const chordName = tok.slice(1, -1);
          currentMidi = getNearestChordTone(chordName, currentMidi);
          currentNoteName = SEMITONE_TO_NAME[currentMidi % 12];
        } else {
          wordsInLine.push(tok);
        }
      }

      for (let w = 0; w < wordsInLine.length; w++) {
        const word = wordsInLine[w];
        const isLastWord = w === wordsInLine.length - 1;
        const hasPunctuation = /[,.?!:;]$/.test(word);

        let durationBeats = 0.85;
        if (word.length > 5) durationBeats = 1.25;
        if (hasPunctuation) durationBeats = 1.6;
        if (isLastWord) durationBeats = 2.0;

        const duration = msPerBeat * durationBeats;
        const gap = msPerBeat * (hasPunctuation ? 0.5 : 0.2);

        this.targetBlocks.push({
          startTime: timeCursor,
          duration: duration,
          midi: currentMidi,
          noteName: currentNoteName,
          text: word
        });

        timeCursor += duration + gap;
      }

      // Pausa natural de respiración al final de cada verso (1.5 a 2.5 segundos)
      timeCursor += msPerBeat * 2.0;
    }

    // Garantizar que el 100% de las canciones tengan cuenta atrás / intro instrumental previo
    if (this.targetBlocks.length > 0 && !this.targetBlocks[0].isInterlude) {
      const prepDur = msPerBeat * 4;
      for (const block of this.targetBlocks) {
        block.startTime += prepDur;
      }
      this.targetBlocks.unshift({
        startTime: 0,
        duration: prepDur,
        midi: 60,
        noteName: 'Intro',
        text: '🎹 Cuenta Atrás',
        isInterlude: true
      });
    }
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
      if (!this.isPlaying && !(typeof window !== 'undefined' && window.__IS_TESTING__)) return; // Solo guardar rastro si está reproduciendo o en modo test
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
      if (!this.isPlaying && !(typeof window !== 'undefined' && window.__IS_TESTING__)) return;
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
      
      if (isCurrentBlock && !block.isInterlude && this.trail.length > 0) {
        const lastPt = this.trail[this.trail.length - 1];
        if (!lastPt.silence) {
          // Evaluar afinación considerando octavas naturales (ej. voz masculina octava 3 vs objetivo octava 4)
          const absDiff = Math.abs(lastPt.midi - block.midi);
          const pitchClassDiff = Math.abs((Math.round(lastPt.midi) % 12) - (block.midi % 12));
          const isNoteMatch = (absDiff <= 1.2) || (pitchClassDiff === 0 || pitchClassDiff === 11 || pitchClassDiff === 1);
          if (isNoteMatch) {
            hitSuccess = true;
            block.hitFrames = (block.hitFrames || 0) + 1;
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
