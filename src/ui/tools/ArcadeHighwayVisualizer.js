/**
 * @file ArcadeHighwayVisualizer.js
 * @description Motor Gráfico Inmersivo "Synthesia / Guitar Hero" (Modo Arcade a 60 FPS).
 * Renderiza cascada de notas en perspectiva con Object Pooling de notas y partículas de neón,
 * conectado al motor de gamificación y escucha activa por micrófono.
 */

import { Component } from '../Component.js';
import { events } from '../../core/EventBus.js';
import { state } from '../../core/State.js';
import { gamificationEngine } from '../../audio/GamificationEngine.js';
import { vocalCoachEngine } from '../../audio/VocalCoachEngine.js';
import { toast } from '../Toast.js';

export class ArcadeHighwayVisualizer extends Component {
  constructor() {
    super(null);
    this.canvas = null;
    this.ctx = null;
    this.animFrameId = null;
    this.isRunning = false;
    this.isListeningMic = false;

    // Object Pools (Zero GC 60 FPS)
    this.NOTE_POOL_SIZE = 160;
    this.PARTICLE_POOL_SIZE = 240;
    this.notePool = [];
    this.particlePool = [];
    this._initObjectPools();

    // Estado del juego
    this.lastFrameTime = 0;
    this.songProgressMs = 0;
    this.scrollSpeed = 280; // Píxeles por segundo de caída
    this.streakFlash = 0;
    this.hitText = '';
    this.hitTextAlpha = 0;
    this.hitTextColor = '#38bdf8';

    // Mapeo cromático de notas Pro
    this.CHROMATIC_COLORS = {
      'C': '#ef4444',  // Rojo
      'C#': '#f43f5e', 'Db': '#f43f5e',
      'D': '#f97316',  // Naranja
      'D#': '#fb923c', 'Eb': '#fb923c',
      'E': '#eab308',  // Amarillo
      'F': '#10b981',  // Verde
      'F#': '#14b8a6', 'Gb': '#14b8a6',
      'G': '#06b6d4',  // Cian
      'G#': '#0284c7', 'Ab': '#0284c7',
      'A': '#3b82f6',  // Azul
      'A#': '#6366f1', 'Bb': '#6366f1',
      'B': '#a855f7'   // Púrpura
    };

    // Carriles de Cuerda (1 a 6)
    this.LANE_COUNT = 6;
    this.LANE_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];

    this.initEvents();
  }

  _initObjectPools() {
    for (let i = 0; i < this.NOTE_POOL_SIZE; i++) {
      this.notePool.push({
        id: i,
        active: false,
        lane: 0,
        fret: 0,
        pitchName: 'E',
        timeMs: 0,
        durationMs: 400,
        y: -100,
        height: 40,
        color: '#38bdf8',
        hit: false,
        missed: false
      });
    }

    for (let i = 0; i < this.PARTICLE_POOL_SIZE; i++) {
      this.particlePool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 4,
        color: '#fff',
        alpha: 1.0,
        life: 0.5
      });
    }
  }

  initEvents() {
    events.on('arcade:open', () => this.open('#arcade-mode-modal-container'));

    // Escuchar detecciones de pitch en vivo del micrófono
    events.on('vocalCoach:pitch', (pitchData) => {
      if (this.isRunning && this.isListeningMic && pitchData.note) {
        this._handleLiveMicInput(pitchData.note, pitchData.cents);
      }
    });

    // Escuchar aciertos / fallos para efectos visuales
    events.on('gamification:hit', ({ rating, noteInfo }) => {
      this._triggerHitFeedback(rating, noteInfo);
    });

    events.on('gamification:miss', ({ noteInfo }) => {
      this._triggerMissFeedback(noteInfo);
    });
  }

  open(targetContainerSelector = '#arcade-mode-modal-container') {
    let host = document.querySelector(targetContainerSelector);
    if (!host || host.offsetParent === null && targetContainerSelector === '#toolModalHost') {
      host = document.querySelector('#arcade-mode-modal-container') || document.querySelector('#toolModalHost');
    }
    if (!host) return;

    this.currentHost = targetContainerSelector;
    host.innerHTML = this.renderModal();
    this.attachListeners(host);
    this.startHighway();
  }

  close(host) {
    this.stopHighway();
    if (host) host.innerHTML = '';
  }

  renderModal() {
    const currentSong = state.get('activeSong');
    return `
      <div class="modal-arcade-backdrop" id="modal-arcade-view" role="dialog" aria-modal="true" aria-labelledby="arcadeTitle">
        <!-- Canvas Principal a Pantalla Completa -->
        <div class="arcade-canvas-wrapper">
          <canvas id="arcadeHighwayCanvas" class="arcade-highway-canvas"></canvas>

          <!-- HUD Superior -->
          <div class="arcade-hud-top">
            <div class="arcade-score-badge">
              <span class="hud-label">SCORE</span>
              <span class="hud-value" id="lblArcadeScore">000,000</span>
            </div>

            <div class="arcade-song-title-pill">
              <span class="arcade-live-dot"></span>
              <span id="arcadeSongName">${currentSong?.title || 'Highway Jam'}</span>
              <span class="arcade-tempo-badge">${currentSong?.tempo || 120} BPM</span>
            </div>

            <div class="arcade-combo-badge" id="arcadeComboBadge">
              <span class="combo-mult" id="lblArcadeMultiplier">1X</span>
              <div class="combo-info">
                <span class="combo-streak" id="lblArcadeCombo">0 COMBO</span>
                <span class="combo-label">STREAK</span>
              </div>
            </div>
          </div>

          <!-- Banner Flotante de Feedback (PERFECT / GREAT / MISS) -->
          <div class="arcade-hit-feedback" id="arcadeHitFeedback" style="opacity: 0;">PERFECT!</div>

          <!-- HUD Inferior con Controles Rápidos -->
          <div class="arcade-hud-bottom">
            <div class="arcade-bottom-actions">
              <button class="btn-arcade-control" id="btnToggleArcadeMic" aria-label="Activar Escucha por Micrófono">
                🎙️ Escucha Micrófono: <strong id="lblMicStatus">OFF</strong>
              </button>
              <button class="btn-arcade-control btn-arcade-autoplay" id="btnArcadeAutoTest" aria-label="Simulación de demostración">
                ⚡ Modo Demostración
              </button>
              <button class="btn-arcade-control btn-arcade-exit" id="btnExitArcade" aria-label="Salir del modo Arcade">
                ✕ Salir
              </button>
            </div>
          </div>

          <!-- Pantalla de Resultados Finales (Oculta hasta terminar canción) -->
          <div class="arcade-results-overlay" id="arcadeResultsOverlay" style="display: none;">
            <div class="arcade-results-card">
              <div class="results-trophy-slot" id="resultsRankBadge">💎</div>
              <h2 class="results-rank-title" id="resultsRankTitle">NIVEL PLATINO LEGENDARIO</h2>
              <div class="results-score-highlight" id="resultsFinalScore">124,500 PTS</div>

              <div class="results-stats-grid">
                <div class="stat-box">
                  <span class="stat-val" id="resAccuracy">98%</span>
                  <span class="stat-lbl">PRECISIÓN</span>
                </div>
                <div class="stat-box">
                  <span class="stat-val" id="resMaxCombo">45</span>
                  <span class="stat-lbl">MÁXIMO COMBO</span>
                </div>
                <div class="stat-box">
                  <span class="stat-val" id="resPerfects">38</span>
                  <span class="stat-lbl">PERFECTOS</span>
                </div>
                <div class="stat-box">
                  <span class="stat-val" id="resMisses">1</span>
                  <span class="stat-lbl">FALLOS</span>
                </div>
              </div>

              <div class="results-actions-row">
                <button class="btn-results-action primary" id="btnRetryArcade">Reintentar Canción</button>
                <button class="btn-results-action secondary" id="btnCloseResults">Volver a Tabs</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  attachListeners(container) {
    const card = container.querySelector('#modal-arcade-view');
    if (!card) return;

    this.canvas = card.querySelector('#arcadeHighwayCanvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this._resizeCanvas();
      window.addEventListener('resize', this._boundResize = () => this._resizeCanvas());
    }

    // Salir
    card.querySelector('#btnExitArcade')?.addEventListener('click', () => this.close(container));
    card.querySelector('#btnCloseResults')?.addEventListener('click', () => this.close(container));

    // Reintentar
    card.querySelector('#btnRetryArcade')?.addEventListener('click', () => {
      card.querySelector('#arcadeResultsOverlay').style.display = 'none';
      this.startHighway();
    });

    // Micrófono
    const btnMic = card.querySelector('#btnToggleArcadeMic');
    btnMic?.addEventListener('click', async () => {
      this.isListeningMic = !this.isListeningMic;
      const lbl = card.querySelector('#lblMicStatus');
      if (this.isListeningMic) {
        try {
          await vocalCoachEngine.start();
          btnMic.classList.add('active');
          if (lbl) lbl.textContent = 'ON';
          toast.show('🎤 Escucha en vivo activada. Toca las notas para puntuar.', 'success');
        } catch (e) {
          this.isListeningMic = false;
          toast.show('Error al acceder al micrófono: ' + e.message, 'error');
        }
      } else {
        vocalCoachEngine.stop();
        btnMic.classList.remove('active');
        if (lbl) lbl.textContent = 'OFF';
      }
    });

    // Modo Demostración
    card.querySelector('#btnArcadeAutoTest')?.addEventListener('click', () => {
      this._triggerAutoHitDemo();
      toast.show('⚡ Modo Demo: Acierto automático simulado.', 'info', 1000);
    });

    // Clics / Toques en los carriles inferiores para interacción táctil directa
    this.canvas?.addEventListener('pointerdown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const laneWidth = this.canvas.width / this.LANE_COUNT;
      const clickedLane = Math.floor(clickX / laneWidth);
      this._handleLaneStrike(clickedLane);
    });
  }

  _resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = this.canvas.parentElement.clientWidth || window.innerWidth;
    this.canvas.height = this.canvas.parentElement.clientHeight || window.innerHeight;
  }

  startHighway() {
    gamificationEngine.startSession();
    this.isRunning = true;
    this.songProgressMs = 0;
    this.lastFrameTime = performance.now();
    this._populateInitialNotes();

    this.startLoop();
  }

  stopHighway() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    gamificationEngine.stopSession();
    if (this._boundResize) {
      window.removeEventListener('resize', this._boundResize);
    }
  }

  _populateInitialNotes() {
    // Limpiar notas activas
    this.notePool.forEach(n => { n.active = false; n.hit = false; n.missed = false; });

    // Generar secuencia rítmica de notas para demostración o desde AlphaTab
    const pitches = ['E', 'A', 'D', 'G', 'B', 'C', 'F', 'E'];
    for (let i = 0; i < 35; i++) {
      const poolNote = this.notePool[i];
      if (poolNote) {
        poolNote.active = true;
        poolNote.lane = i % this.LANE_COUNT;
        poolNote.fret = (i * 2) % 7;
        poolNote.pitchName = pitches[i % pitches.length];
        poolNote.timeMs = 1200 + (i * 650); // Espaciado rítmico
        poolNote.durationMs = 300 + ((i % 3) * 150);
        poolNote.color = this.CHROMATIC_COLORS[poolNote.pitchName] || '#38bdf8';
        poolNote.hit = false;
        poolNote.missed = false;
      }
    }
  }

  startLoop() {
    const loop = (currentTime) => {
      if (!this.isRunning) return;
      const deltaTime = (currentTime - this.lastFrameTime) / 1000;
      this.lastFrameTime = currentTime;

      this.update(deltaTime);
      this.render();

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  update(deltaTime) {
    this.songProgressMs += deltaTime * 1000;

    const strikeLineY = this.canvas.height - 110;
    const laneWidth = this.canvas.width / this.LANE_COUNT;

    // 1. Actualizar Notas del Pool
    let allFinished = true;
    for (let i = 0; i < this.NOTE_POOL_SIZE; i++) {
      const note = this.notePool[i];
      if (!note.active) continue;
      allFinished = false;

      // Calcular posición Y en función del tiempo
      const timeUntilHit = (note.timeMs - this.songProgressMs) / 1000;
      note.y = strikeLineY - (timeUntilHit * this.scrollSpeed);
      note.height = Math.max(30, (note.durationMs / 1000) * this.scrollSpeed);

      // Comprobar si la nota se pasó sin impactar (Miss)
      if (note.y > strikeLineY + 60 && !note.hit && !note.missed) {
        note.missed = true;
        gamificationEngine.registerNoteMiss({ lane: note.lane, fret: note.fret, pitch: note.pitchName });
      }

      // Desactivar notas fuera de pantalla
      if (note.y > this.canvas.height + 150) {
        note.active = false;
      }
    }

    // 2. Actualizar Partículas
    for (let i = 0; i < this.PARTICLE_POOL_SIZE; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;
      p.x += p.vx * deltaTime * 60;
      p.y += p.vy * deltaTime * 60;
      p.alpha -= deltaTime * 2.0;
      if (p.alpha <= 0) p.active = false;
    }

    // 3. Desvanecer texto de feedback
    if (this.hitTextAlpha > 0) {
      this.hitTextAlpha -= deltaTime * 1.5;
    }

    // Actualizar HUD
    this._updateHUD();

    // Comprobar fin de canción
    if (allFinished && this.songProgressMs > 3000) {
      this.showResultsScreen();
    }
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Fondo degradado Arcade Cyberpunk
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a0a10');
    grad.addColorStop(0.7, '#12131c');
    grad.addColorStop(1, '#1b1d28');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const laneWidth = w / this.LANE_COUNT;
    const strikeLineY = h - 110;

    // Dibujar Carriles y Cuerdas
    for (let i = 0; i < this.LANE_COUNT; i++) {
      const x = i * laneWidth;

      // Fondo del carril sutil
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(x, 0, laneWidth, h);

      // Línea divisoria de cuerda
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + laneWidth / 2, 0);
      ctx.lineTo(x + laneWidth / 2, h);
      ctx.stroke();

      // Indicador inferior de cuerda
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.LANE_NAMES[i] || `C${i + 1}`, x + laneWidth / 2, h - 30);
    }

    // Dibujar Línea de Impacto ("Target Strike Line") con Neón
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, strikeLineY);
    ctx.lineTo(w, strikeLineY);
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset blur

    // Dianas de impacto en cada carril
    for (let i = 0; i < this.LANE_COUNT; i++) {
      const targetX = i * laneWidth + laneWidth / 2;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.beginPath();
      ctx.arc(targetX, strikeLineY, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Dibujar Notas que Caen
    for (let i = 0; i < this.NOTE_POOL_SIZE; i++) {
      const note = this.notePool[i];
      if (!note.active || note.hit) continue;

      const noteX = note.lane * laneWidth + 10;
      const noteWidth = laneWidth - 20;

      // Color y cuerpo de la píldora de nota
      ctx.fillStyle = note.missed ? 'rgba(100, 116, 139, 0.5)' : note.color;
      ctx.shadowColor = note.color;
      ctx.shadowBlur = note.missed ? 0 : 10;

      // Redondear bordes de la nota
      ctx.beginPath();
      ctx.roundRect(noteX, note.y - note.height, noteWidth, note.height, 12);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Letra del tono o traste
      ctx.fillStyle = '#000';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${note.pitchName}${note.fret > 0 ? ` [${note.fret}]` : ''}`, noteX + noteWidth / 2, note.y - 8);
    }

    // Dibujar Partículas de Neón
    for (let i = 0; i < this.PARTICLE_POOL_SIZE; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;

      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Dibujar Texto Flotante de Feedback (PERFECT / GREAT)
    if (this.hitTextAlpha > 0) {
      ctx.save();
      ctx.fillStyle = this.hitTextColor;
      ctx.globalAlpha = Math.min(1.0, this.hitTextAlpha);
      ctx.font = '900 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = this.hitTextColor;
      ctx.shadowBlur = 18;
      ctx.fillText(this.hitText, w / 2, strikeLineY - 60);
      ctx.restore();
    }
  }

  _spawnParticles(x, y, color, count = 16) {
    let spawned = 0;
    for (let i = 0; i < this.PARTICLE_POOL_SIZE && spawned < count; i++) {
      const p = this.particlePool[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - 1.5;
        p.size = 2 + Math.random() * 4;
        p.color = color;
        p.alpha = 1.0;
        spawned++;
      }
    }
  }

  _handleLaneStrike(lane) {
    const strikeLineY = this.canvas.height - 110;
    const laneWidth = this.canvas.width / this.LANE_COUNT;
    const hitX = lane * laneWidth + laneWidth / 2;

    // Buscar la nota más cercana en este carril
    let closestNote = null;
    let minDistance = Infinity;

    for (let i = 0; i < this.NOTE_POOL_SIZE; i++) {
      const n = this.notePool[i];
      if (n.active && n.lane === lane && !n.hit && !n.missed) {
        const dist = Math.abs(n.y - strikeLineY);
        if (dist < minDistance && dist < 120) {
          minDistance = dist;
          closestNote = n;
        }
      }
    }

    if (closestNote) {
      closestNote.hit = true;
      const timeDiffMs = ((closestNote.y - strikeLineY) / this.scrollSpeed) * 1000;
      gamificationEngine.evaluateHit(timeDiffMs, 0, {
        lane,
        fret: closestNote.fret,
        pitch: closestNote.pitchName,
        x: hitX,
        y: strikeLineY,
        color: closestNote.color
      });
    } else {
      gamificationEngine.evaluateHit(999, 999, { lane, x: hitX, y: strikeLineY });
    }
  }

  _handleLiveMicInput(detectedNote, cents) {
    // Si el usuario canta/toca una nota por micrófono, buscar coincidencia en diana activa
    const strikeLineY = this.canvas.height - 110;
    const cleanDetected = detectedNote.replace(/[0-9]/g, '');

    for (let i = 0; i < this.NOTE_POOL_SIZE; i++) {
      const n = this.notePool[i];
      if (n.active && !n.hit && !n.missed && n.pitchName === cleanDetected) {
        const dist = Math.abs(n.y - strikeLineY);
        if (dist < 100) {
          n.hit = true;
          const timeDiffMs = ((n.y - strikeLineY) / this.scrollSpeed) * 1000;
          gamificationEngine.evaluateHit(timeDiffMs, cents, {
            lane: n.lane,
            fret: n.fret,
            pitch: n.pitchName,
            color: n.color
          });
          break;
        }
      }
    }
  }

  _triggerAutoHitDemo() {
    const strikeLineY = this.canvas.height - 110;
    for (let i = 0; i < this.NOTE_POOL_SIZE; i++) {
      const n = this.notePool[i];
      if (n.active && !n.hit && !n.missed) {
        n.hit = true;
        gamificationEngine.evaluateHit(0, 0, {
          lane: n.lane,
          fret: n.fret,
          pitch: n.pitchName,
          color: n.color
        });
        break;
      }
    }
  }

  _triggerHitFeedback(rating, noteInfo) {
    this.hitText = rating === 'PERFECT' ? '🌟 PERFECT!' : (rating === 'GREAT' ? '✨ GREAT!' : '👍 GOOD');
    this.hitTextColor = rating === 'PERFECT' ? '#eab308' : (rating === 'GREAT' ? '#10b981' : '#38bdf8');
    this.hitTextAlpha = 1.0;

    const laneWidth = this.canvas ? this.canvas.width / this.LANE_COUNT : 60;
    const x = noteInfo.x || (noteInfo.lane ? noteInfo.lane * laneWidth + laneWidth / 2 : (this.canvas ? this.canvas.width / 2 : 150));
    const y = noteInfo.y || (this.canvas ? this.canvas.height - 110 : 300);

    this._spawnParticles(x, y, noteInfo.color || this.hitTextColor, rating === 'PERFECT' ? 24 : 12);
  }

  _triggerMissFeedback(noteInfo) {
    this.hitText = 'MISS';
    this.hitTextColor = '#ef4444';
    this.hitTextAlpha = 0.8;
  }

  _updateHUD() {
    const host = document.querySelector('#modal-arcade-view');
    if (!host) return;

    const scoreEl = host.querySelector('#lblArcadeScore');
    const comboEl = host.querySelector('#lblArcadeCombo');
    const multEl = host.querySelector('#lblArcadeMultiplier');

    if (scoreEl) scoreEl.textContent = gamificationEngine.score.toLocaleString('es-ES').padStart(7, '0');
    if (comboEl) comboEl.textContent = `${gamificationEngine.combo} COMBO`;
    if (multEl) multEl.textContent = `${gamificationEngine.multiplier}X`;
  }

  showResultsScreen() {
    this.stopHighway();
    const results = gamificationEngine.getResults();
    const host = document.querySelector('#modal-arcade-view');
    if (!host) return;

    const overlay = host.querySelector('#arcadeResultsOverlay');
    if (!overlay) return;

    host.querySelector('#resultsRankBadge').textContent = results.rankBadge;
    host.querySelector('#resultsRankTitle').textContent = `${results.rank} · ${results.rankTitle}`;
    host.querySelector('#resultsRankTitle').style.color = results.rankColor;
    host.querySelector('#resultsFinalScore').textContent = `${results.score.toLocaleString('es-ES')} PTS`;

    host.querySelector('#resAccuracy').textContent = `${results.accuracyPercent}%`;
    host.querySelector('#resMaxCombo').textContent = `${results.maxCombo}`;
    host.querySelector('#resPerfects').textContent = `${results.perfectCount}`;
    host.querySelector('#resMisses').textContent = `${results.missCount}`;

    overlay.style.display = 'flex';
  }
}

export const arcadeHighwayVisualizer = new ArcadeHighwayVisualizer();
export default arcadeHighwayVisualizer;
