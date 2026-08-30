/**
 * @file EarTrainerTool.js
 * @description Entrenador de Oído Armónico interactivo con niveles, puntuación, bloqueo de escucha y feedback interactivo.
 */

import { chordEngine } from '../../tools/ChordEngine.js';
import { audioFeedback } from '../../audio/AudioFeedback.js';
import { toast } from '../Toast.js';

export class EarTrainerTool {
  constructor() {
    this.score = 0;
    this.streak = 0;
    this.difficulty = 'easy'; // 'easy' | 'medium' | 'hard'
    this.currentQuestion = null;
    this.currentOptions = [];
    this.hasPlayed = false;
    this.isAudioPlaying = false;
    this.isAnswerChecking = false;
    this.timeoutIds = new Set();
    this.activeContainer = null;
    this.modalElement = null;
    this.closeButton = null;
    this.lifecycleObserver = null;
    this.handleClose = () => this.close();
  }

  schedule(callback, delay) {
    const timeoutId = setTimeout(() => {
      this.timeoutIds.delete(timeoutId);

      if (this.modalElement && !this.modalElement.isConnected) {
        this.close();
        return;
      }

      callback();
    }, delay);

    this.timeoutIds.add(timeoutId);
    return timeoutId;
  }

  clearTimeouts() {
    this.timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
    this.timeoutIds.clear();
  }

  bindLifecycle(container) {
    const modalElement = container?.querySelector('#toolModalOverlay') || null;
    if (this.activeContainer === container && this.modalElement === modalElement) {
      return;
    }

    this.unbindLifecycle();
    this.activeContainer = container || null;
    this.modalElement = modalElement;
    this.closeButton = modalElement?.querySelector('#btnCloseToolModal') || null;
    this.closeButton?.addEventListener('click', this.handleClose);

    const modalParent = modalElement?.parentNode;
    if (modalParent && typeof MutationObserver !== 'undefined') {
      this.lifecycleObserver = new MutationObserver(() => {
        if (!modalElement.isConnected) {
          this.close();
        }
      });
      this.lifecycleObserver.observe(modalParent, { childList: true });
    }
  }

  unbindLifecycle() {
    this.closeButton?.removeEventListener('click', this.handleClose);
    this.lifecycleObserver?.disconnect();
    this.closeButton = null;
    this.lifecycleObserver = null;
  }

  close() {
    this.clearTimeouts();
    this.unbindLifecycle();
    this.activeContainer = null;
    this.modalElement = null;
    this.currentQuestion = null;
    this.currentOptions = [];
    this.hasPlayed = false;
    this.isAudioPlaying = false;
    this.isAnswerChecking = false;
  }

  destroy() {
    this.close();
  }

  startTest(container) {
    this.clearTimeouts();
    this.bindLifecycle(container);

    const poolByDiff = {
      'easy': [
        { name: 'Do Mayor (C) — Tríada Brillante / Alegre', chord: 'C' },
        { name: 'La menor (Am) — Tríada Melancólica / Triste', chord: 'Am' },
        { name: 'Sol Mayor (G) — Tríada Abierta / Tónica', chord: 'G' },
        { name: 'Mi menor (Em) — Tríada Oscura / Profunda', chord: 'Em' },
        { name: 'Re Mayor (D) — Brillante', chord: 'D' },
        { name: 'Re menor (Dm) — Sentimental', chord: 'Dm' }
      ],
      'medium': [
        { name: 'Sol 7ma Dominante (G7) — Tensión de resolución', chord: 'G7' },
        { name: 'Do Mayor 7ma (Cmaj7) — Suave / Jazz / Nostalgia', chord: 'Cmaj7' },
        { name: 'La 7ma Dominante (A7) — Tono Bluesy', chord: 'A7' },
        { name: 'Re 7ma Dominante (D7) — Tensión', chord: 'D7' },
        { name: 'Fa Mayor 7ma (Fmaj7) — Ensoñador', chord: 'Fmaj7' },
        { name: 'La menor 7ma (Am7) — Menor Cálido', chord: 'Am7' }
      ],
      'hard': [
        { name: 'Si semidisminuido (Bm7b5)', chord: 'Bm7b5' },
        { name: 'Do Suspendido 4 (Csus4) — Abierto', chord: 'Csus4' },
        { name: 'Do Disminuido (Cdim) — Tensión dramática', chord: 'Cdim' },
        { name: 'Mi 7#9 (E7#9) — Funky Hendrix', chord: 'E7#9' },
        { name: 'Re Suspendido 2 (Dsus2) — Etéreo', chord: 'Dsus2' },
        { name: 'Do 9na (C9) — Colorido Funk / Soul', chord: 'C9' }
      ]
    };

    const pool = poolByDiff[this.difficulty] || poolByDiff['easy'];
    this.currentQuestion = pool[Math.floor(Math.random() * pool.length)];

    let choices = [this.currentQuestion];
    let attempts = 0;
    while (choices.length < 4 && attempts < 50) {
      const rnd = pool[Math.floor(Math.random() * pool.length)];
      if (!choices.some(c => c.chord === rnd.chord)) {
        choices.push(rnd);
      }
      attempts++;
    }
    this.currentOptions = choices.sort(() => Math.random() - 0.5);
    this.hasPlayed = false;
    this.isAnswerChecking = false;

    const feedbackBox = container?.querySelector('#earFeedbackContainer');
    if (feedbackBox) feedbackBox.innerHTML = '';

    this.updateUI(container);

    this.schedule(() => {
      this.playCurrentChord(container);
    }, 250);
  }

  playCurrentChord(container) {
    if (!this.currentQuestion || this.isAudioPlaying || this.isAnswerChecking) return;

    this.isAudioPlaying = true;
    this.updateStatusBox('playing', container);

    const grid = container?.querySelector('#earAnswersGrid');
    if (grid) {
      grid.querySelectorAll('.btn-ear-answer').forEach(btn => {
        btn.disabled = true;
        btn.classList.add('ear-locked');
      });
    }

    const playBtn = container?.querySelector('#btnPlayEarChord');
    if (playBtn) {
      playBtn.classList.add('playing');
      playBtn.disabled = true;
    }

    chordEngine.auditionChord(this.currentQuestion.chord, 'guitar');

    this.schedule(() => {
      this.isAudioPlaying = false;
      this.hasPlayed = true;
      this.updateStatusBox('ready', container);

      if (playBtn) {
        playBtn.classList.remove('playing');
        playBtn.disabled = false;
      }

      if (grid && !this.isAnswerChecking) {
        grid.querySelectorAll('.btn-ear-answer').forEach(btn => {
          btn.disabled = false;
          btn.classList.remove('ear-locked');
        });
      }
    }, 1100);
  }

  updateStatusBox(state, container) {
    const statusBox = container?.querySelector('#earStatusBox');
    if (!statusBox) return;

    if (state === 'playing') {
      statusBox.innerHTML = `
        <div class="ear-audio-status playing">
          <span class="ear-wave-bar"></span>
          <span class="ear-wave-bar"></span>
          <span class="ear-wave-bar"></span>
          <span>🎧 Reproduciendo acorde con atención...</span>
        </div>
      `;
    } else if (state === 'ready') {
      statusBox.innerHTML = `
        <div class="ear-audio-status ready">
          <span>👉 ¿Qué acorde has escuchado? Elige una opción:</span>
        </div>
      `;
    } else {
      statusBox.innerHTML = '';
    }
  }

  checkAnswer(selectedChord, container) {
    if (!this.currentQuestion || this.isAudioPlaying || this.isAnswerChecking) {
      return;
    }

    if (!this.hasPlayed) {
      toast.show('Escucha el acorde primero antes de responder', 'warning', 1200);
      const playBtn = container?.querySelector('#btnPlayEarChord');
      if (playBtn) {
        playBtn.classList.add('pulse-hint');
        this.schedule(() => playBtn.classList.remove('pulse-hint'), 800);
      }
      return;
    }

    this.isAnswerChecking = true;

    const grid = container?.querySelector('#earAnswersGrid');
    if (grid) {
      grid.querySelectorAll('.btn-ear-answer').forEach(btn => {
        btn.disabled = true;
      });
    }

    const isCorrect = selectedChord === this.currentQuestion.chord;
    const feedbackBox = container?.querySelector('#earFeedbackContainer');

    if (grid) {
      grid.querySelectorAll('.btn-ear-answer').forEach(btn => {
        if (btn.dataset.chord === this.currentQuestion.chord) {
          btn.classList.add('ear-correct');
        } else if (btn.dataset.chord === selectedChord && !isCorrect) {
          btn.classList.add('ear-wrong');
        }
      });
    }

    if (isCorrect) {
      this.score += 10;
      this.streak++;
      audioFeedback.hapticInTune();
      audioFeedback.playSuccess();

      const bonusText = this.streak >= 2 ? ` 🔥 ¡Racha de ${this.streak} seguidos!` : '';
      if (feedbackBox) {
        feedbackBox.innerHTML = `
          <div class="ear-feedback-card success">
            <span class="feedback-icon">🎉</span>
            <div class="feedback-text">
              <strong>¡CORRECTO! Acorde Identificado</strong>
              <p>Era <b>${this.currentQuestion.name}</b> (+10 Pts)${bonusText}</p>
            </div>
          </div>
        `;
      }

      toast.show(`¡Correcto! ${this.currentQuestion.name} (+10 pts)`, 'success', 1400);

      this.schedule(() => {
        this.startTest(container);
      }, 1400);
    } else {
      this.streak = 0;
      audioFeedback.playDismiss();

      if (feedbackBox) {
        feedbackBox.innerHTML = `
          <div class="ear-feedback-card error">
            <span class="feedback-icon">❌</span>
            <div class="feedback-text">
              <strong>No era esa opción</strong>
              <p>Pulsaste <em>${selectedChord}</em>, pero sonaba <b>${this.currentQuestion.name}</b></p>
            </div>
          </div>
        `;
      }

      toast.show(`Incorrecto. Era ${this.currentQuestion.name}`, 'error', 1800);

      this.schedule(() => {
        chordEngine.auditionChord(this.currentQuestion.chord, 'guitar');
      }, 400);

      this.schedule(() => {
        this.startTest(container);
      }, 2200);
    }

    const scoreEl = container?.querySelector('#earScoreDisplay');
    const streakEl = container?.querySelector('#earStreakDisplay');
    if (scoreEl) scoreEl.textContent = this.score;
    if (streakEl) streakEl.textContent = this.streak;
  }

  updateUI(container) {
    const scoreEl = container?.querySelector('#earScoreDisplay');
    const streakEl = container?.querySelector('#earStreakDisplay');
    const grid = container?.querySelector('#earAnswersGrid');

    if (scoreEl) scoreEl.textContent = this.score;
    if (streakEl) streakEl.textContent = this.streak;

    if (grid && this.currentOptions) {
      grid.innerHTML = this.currentOptions.map(opt => `
        <button class="btn-ear-answer${!this.hasPlayed || this.isAudioPlaying ? ' ear-locked' : ''}" data-chord="${opt.chord}" ${!this.hasPlayed || this.isAudioPlaying ? 'disabled' : ''}>
          <strong>${opt.chord}</strong>
          <small style="display:block; font-size:0.75rem; font-weight:normal; opacity:0.7; margin-top:4px;">${opt.name.split('(')[1]?.replace(')', '') || ''}</small>
        </button>
      `).join('');

      grid.querySelectorAll('.btn-ear-answer').forEach(btn => {
        btn.addEventListener('click', () => {
          this.checkAnswer(btn.dataset.chord, container);
        });
      });
    }
  }

  renderModal() {
    return `
      <div class="tool-modal-overlay active" id="toolModalOverlay">
        <div class="tool-modal-dialog">
          <div class="tool-modal-header">
            <div class="tool-modal-title">
              <span class="tool-modal-icon">👂</span>
              <div>
                <span class="tool-badge-studio">ENTRENAMIENTO AUDITIVO</span>
                <h2>Entrenador de Oído Armónico</h2>
              </div>
            </div>
            <button class="btn-close-tool-modal" id="btnCloseToolModal">✕</button>
          </div>

          <div class="tool-panoramic-layout">
            <div class="tool-panoramic-main">
              <div class="ear-score-strip">
                <div class="ear-score-badge">
                  <span class="ear-badge-lbl">Puntos</span>
                  <strong id="earScoreDisplay">${this.score}</strong>
                </div>
                <div class="ear-score-badge streak">
                  <span class="ear-badge-lbl">Racha</span>
                  <strong id="earStreakDisplay">🔥 ${this.streak}</strong>
                </div>
                <div class="ear-difficulty-selector">
                  <button class="ear-diff-btn ${this.difficulty === 'easy' ? 'active' : ''}" data-diff="easy">Fácil</button>
                  <button class="ear-diff-btn ${this.difficulty === 'medium' ? 'active' : ''}" data-diff="medium">Medio</button>
                  <button class="ear-diff-btn ${this.difficulty === 'hard' ? 'active' : ''}" data-diff="hard">Pro</button>
                </div>
              </div>

              <div class="ear-playback-center">
                <button class="btn-play-ear-chord" id="btnPlayEarChord">
                  <span class="ear-play-icon">🎧</span>
                  <span>Escuchar Acorde</span>
                </button>
                <div id="earStatusBox" class="ear-status-box"></div>
              </div>

              <div id="earFeedbackContainer"></div>

              <div class="ear-answers-grid" id="earAnswersGrid">
                <!-- Se poblará dinámicamente -->
              </div>
            </div>

            <div class="tool-panoramic-side">
              <div class="ear-guide-card">
                <div class="ear-guide-header">
                  <span class="tool-badge-studio">CONSEJOS AUDITIVOS</span>
                  <h3>¿Cómo reconocer acordes?</h3>
                </div>
                <ul class="ear-tips-list">
                  <li><strong>Mayores (M):</strong> Suenan brillantes, abiertos y alegres.</li>
                  <li><strong>Menores (m):</strong> Transmiten melancolía, introspección y dramatismo.</li>
                  <li><strong>Dominantes (7):</strong> Contienen tensión acústica que pide resolver.</li>
                  <li><strong>Maj7:</strong> Tono suave, aterciopelado y jazzístico.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

export default EarTrainerTool;
