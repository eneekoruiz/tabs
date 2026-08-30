/**
 * @file GamificationEngine.js
 * @description Motor de Gamificación, Evaluación en Vivo y Puntuación Arcade (Guitar Hero / Synthesia Style).
 * Gestiona tolerancias temporales de impacto, multiplicadores de combo, ranking final (Platino/Oro/Plata/Bronce)
 * y disparadores de partículas luminosas.
 */

import { events } from '../core/EventBus.js';

export class GamificationEngine {
  constructor() {
    this.isActive = false;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;

    // Desglose de impactos
    this.perfectCount = 0;
    this.greatCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.totalNotes = 0;

    // Tolerancias de tiempo (milisegundos)
    this.TOLERANCE_PERFECT_MS = 45;
    this.TOLERANCE_GREAT_MS = 90;
    this.TOLERANCE_GOOD_MS = 150;

    // Tolerancias de afinación (cents)
    this.TOLERANCE_CENTS = 40;

    this.initEvents();
  }

  initEvents() {
    events.on('arcade:start', () => this.startSession());
    events.on('arcade:stop', () => this.stopSession());
  }

  startSession() {
    this.isActive = true;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;
    this.perfectCount = 0;
    this.greatCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.totalNotes = 0;

    events.emit('gamification:started', { score: 0, multiplier: 1, combo: 0 });
  }

  stopSession() {
    this.isActive = false;
  }

  /**
   * Evalúa el impacto de una nota pulsada o cantada contra una nota objetivo.
   * @param {number} timeDiffMs - Diferencia temporal en ms (0 = perfecto en el beat)
   * @param {number} pitchDiffCents - Diferencia de tono en cents (opcional)
   * @param {Object} noteInfo - Metadatos de la nota impactada (string, fret, midi, x, y)
   */
  evaluateHit(timeDiffMs, pitchDiffCents = 0, noteInfo = {}) {
    if (!this.isActive) return null;

    const absTime = Math.abs(timeDiffMs);
    const absPitch = Math.abs(pitchDiffCents);

    this.totalNotes += 1;
    let rating = 'MISS';
    let pts = 0;

    if (absTime <= this.TOLERANCE_PERFECT_MS && absPitch <= this.TOLERANCE_CENTS) {
      rating = 'PERFECT';
      pts = 100;
      this.perfectCount += 1;
    } else if (absTime <= this.TOLERANCE_GREAT_MS && absPitch <= (this.TOLERANCE_CENTS * 1.5)) {
      rating = 'GREAT';
      pts = 50;
      this.greatCount += 1;
    } else if (absTime <= this.TOLERANCE_GOOD_MS && absPitch <= (this.TOLERANCE_CENTS * 2.2)) {
      rating = 'GOOD';
      pts = 25;
      this.goodCount += 1;
    } else {
      rating = 'MISS';
      pts = 0;
      this.missCount += 1;
    }

    if (rating !== 'MISS') {
      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      // Cálculo de Multiplicador por racha
      if (this.combo >= 40) this.multiplier = 4;
      else if (this.combo >= 25) this.multiplier = 3;
      else if (this.combo >= 10) this.multiplier = 2;
      else this.multiplier = 1;

      const gainedScore = pts * this.multiplier;
      this.score += gainedScore;

      events.emit('gamification:hit', {
        rating,
        points: gainedScore,
        totalScore: this.score,
        combo: this.combo,
        multiplier: this.multiplier,
        noteInfo
      });
    } else {
      this.combo = 0;
      this.multiplier = 1;

      events.emit('gamification:miss', {
        rating: 'MISS',
        totalScore: this.score,
        combo: 0,
        multiplier: 1,
        noteInfo
      });
    }

    events.emit('gamification:scoreUpdated', {
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      multiplier: this.multiplier
    });

    return { rating, points: pts * this.multiplier, combo: this.combo, multiplier: this.multiplier };
  }

  /**
   * Registra una nota perdida por omisión (cuando cruza la línea sin ser tocada).
   */
  registerNoteMiss(noteInfo = {}) {
    if (!this.isActive) return;
    this.totalNotes += 1;
    this.missCount += 1;
    this.combo = 0;
    this.multiplier = 1;

    events.emit('gamification:miss', {
      rating: 'MISS',
      totalScore: this.score,
      combo: 0,
      multiplier: 1,
      noteInfo
    });

    events.emit('gamification:scoreUpdated', {
      score: this.score,
      combo: 0,
      maxCombo: this.maxCombo,
      multiplier: 1
    });
  }

  /**
   * Genera el informe final de resultados con calificación y rango.
   */
  getResults() {
    const hitsCount = this.perfectCount + this.greatCount + this.goodCount;
    const total = Math.max(1, this.totalNotes);
    
    // Precisión ponderada
    const accuracyPercent = Math.min(100, Math.max(0, Math.round(
      ((this.perfectCount * 1.0 + this.greatCount * 0.75 + this.goodCount * 0.5) / total) * 100
    )));

    // Determinación de Rango / Trofeo
    let rank = 'C';
    let rankTitle = 'Nivel Práctica';
    let rankColor = '#94a3b8';
    let rankBadge = '🥉';

    if (accuracyPercent >= 95) {
      rank = 'S+';
      rankTitle = 'Nivel Platino Legendario';
      rankColor = '#38bdf8';
      rankBadge = '💎';
    } else if (accuracyPercent >= 85) {
      rank = 'S';
      rankTitle = 'Nivel Oro de Estudio';
      rankColor = '#eab308';
      rankBadge = '🏆';
    } else if (accuracyPercent >= 75) {
      rank = 'A';
      rankTitle = 'Nivel Plata Escenario';
      rankColor = '#a855f7';
      rankBadge = '🥈';
    } else if (accuracyPercent >= 60) {
      rank = 'B';
      rankTitle = 'Nivel Bronce Club';
      rankColor = '#f97316';
      rankBadge = '🥉';
    }

    const result = {
      score: this.score,
      accuracyPercent,
      maxCombo: this.maxCombo,
      totalNotes: this.totalNotes,
      hitsCount,
      perfectCount: this.perfectCount,
      greatCount: this.greatCount,
      goodCount: this.goodCount,
      missCount: this.missCount,
      rank,
      rankTitle,
      rankColor,
      rankBadge
    };

    events.emit('gamification:completed', result);
    return result;
  }
}

export const gamificationEngine = new GamificationEngine();
export default gamificationEngine;
