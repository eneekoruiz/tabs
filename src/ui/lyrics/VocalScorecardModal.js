/**
 * @file VocalScorecardModal.js
 * @description Tarjeta de rendimiento vocal post-interpretación (Simply Sing / Yousician style).
 * Muestra porcentaje de afinación global, medalla, notas extremas y apoyo respiratorio.
 */

export class VocalScorecardModal {
  static show({ songTitle = '', artist = '', sessionStats = {}, onRetry, onClose }) {
    const existing = document.getElementById('vocalScorecardModal');
    if (existing) existing.remove();

    const total = sessionStats.totalSingingFrames || 0;
    const inTune = sessionStats.inTuneFrames || 0;
    const accuracy = total > 0 ? Math.round((inTune / total) * 100) : 0;
    const stability = Math.round(sessionStats.stabilityScore || 100);
    const breath = Math.round(sessionStats.breathSupportScore || 100);
    const lowNote = sessionStats.lowestPitch?.noteWithOctave || '—';
    const highNote = sessionStats.highestPitch?.noteWithOctave || '—';

    let medalEmoji = '🥉';
    let medalTitle = 'Buen Calentamiento Vocal';
    let medalDesc = 'Has completado la interpretación. Mantén el caudal de aire continuo para centrar las notas.';
    let medalColor = '#f59e0b';

    if (accuracy >= 80 && stability >= 75) {
      medalEmoji = '🥇';
      medalTitle = '¡Afinación Maestra (Oro)!';
      medalDesc = 'Excelente colocación laríngea, apoyo diafragmático firme y afinación impecable a lo largo de la canción.';
      medalColor = '#fbbf24';
    } else if (accuracy >= 65) {
      medalEmoji = '🥈';
      medalTitle = 'Gran Control Vocal (Plata)';
      medalDesc = 'Buen control de la columna de aire y afinación consistente. Solo faltan pequeños ajustes en los cambios de registro.';
      medalColor = '#cbd5e1';
    }

    const modalEl = document.createElement('div');
    modalEl.id = 'vocalScorecardModal';
    modalEl.className = 'vocal-scorecard-overlay';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.innerHTML = `
      <div class="scorecard-card">
        <button class="btn-scorecard-close" id="btnScorecardClose" aria-label="Cerrar">✕</button>
        <div class="scorecard-badge">RESUMEN DE ENSAYO VOCAL</div>
        <div class="scorecard-medal-emoji">${medalEmoji}</div>
        <h2 class="scorecard-medal-title" style="color: ${medalColor}">${medalTitle}</h2>
        <p class="scorecard-song-name">${songTitle} ${artist ? `· ${artist}` : ''}</p>
        <p class="scorecard-desc">${medalDesc}</p>

        <div class="scorecard-stats-grid">
          <div class="scorecard-stat-box">
            <span class="stat-label">Afinación Global</span>
            <span class="stat-number ${accuracy >= 70 ? 'stat-good' : ''}">${accuracy}%</span>
            <span class="stat-sub">En tono perfecto</span>
          </div>
          <div class="scorecard-stat-box">
            <span class="stat-label">Estabilidad de Aire</span>
            <span class="stat-number">${stability}%</span>
            <span class="stat-sub">Vibrato controlado</span>
          </div>
          <div class="scorecard-stat-box">
            <span class="stat-label">Apoyo Respiratorio</span>
            <span class="stat-number">${breath}%</span>
            <span class="stat-sub">Presión diafragmática</span>
          </div>
          <div class="scorecard-stat-box">
            <span class="stat-label">Rango Empleado</span>
            <span class="stat-number stat-range">${lowNote} – ${highNote}</span>
            <span class="stat-sub">Tesitura de la toma</span>
          </div>
        </div>

        <div class="scorecard-actions">
          <button class="btn-scorecard-retry" id="btnScorecardRetry" type="button">↺ Cantar de Nuevo</button>
          <button class="btn-scorecard-done" id="btnScorecardDone" type="button">✓ Continuar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);

    modalEl.querySelector('#btnScorecardClose')?.addEventListener('click', () => {
      modalEl.remove();
      if (onClose) onClose();
    });
    modalEl.querySelector('#btnScorecardDone')?.addEventListener('click', () => {
      modalEl.remove();
      if (onClose) onClose();
    });
    modalEl.querySelector('#btnScorecardRetry')?.addEventListener('click', () => {
      modalEl.remove();
      if (onRetry) onRetry();
    });
  }
}

export default VocalScorecardModal;
