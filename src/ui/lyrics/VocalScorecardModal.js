/**
 * @file VocalScorecardModal.js
 * @description Tarjeta de rendimiento vocal post-interpretación (Simply Sing / Yousician style).
 * Muestra porcentaje de afinación global, medalla, notas extremas y apoyo respiratorio con datos 100% reales.
 */

export class VocalScorecardModal {
  static show({ songTitle = '', artist = '', sessionStats = {}, onRetry, onClose }) {
    const existing = document.getElementById('vocalScorecardModal');
    if (existing) existing.remove();

    const total = sessionStats.totalSingingFrames || 0;
    const inTune = sessionStats.inTuneFrames || 0;
    // Se requieren al menos ~25 frames sostenidos (~0.5s) para considerar que el usuario cantó de verdad
    const hasSufficientData = total >= 25;

    const accuracy = hasSufficientData ? Math.max(0, Math.min(100, Math.round((inTune / total) * 100))) : 0;
    const stability = hasSufficientData && typeof sessionStats.stabilityScore === 'number' ? sessionStats.stabilityScore : null;
    const breath = hasSufficientData && typeof sessionStats.breathSupportScore === 'number' ? sessionStats.breathSupportScore : null;
    const lowNote = hasSufficientData && sessionStats.lowestPitch ? sessionStats.lowestPitch.noteWithOctave : '—';
    const highNote = hasSufficientData && sessionStats.highestPitch ? sessionStats.highestPitch.noteWithOctave : '—';

    let medalEmoji = '🎤';
    let medalTitle = 'Sin Canto Detectado';
    let medalDesc = 'No se ha registrado canto suficiente durante la reproducción. Activa el micrófono y canta las notas de la canción.';
    let medalColor = '#94a3b8';

    if (hasSufficientData) {
      if (accuracy >= 80 && (stability == null || stability >= 70)) {
        medalEmoji = '🥇';
        medalTitle = '¡Afinación Maestra (Oro)!';
        medalDesc = 'Excelente colocación laríngea, apoyo diafragmático firme y afinación impecable a lo largo de la canción.';
        medalColor = '#fbbf24';
      } else if (accuracy >= 60) {
        medalEmoji = '🥈';
        medalTitle = 'Gran Control Vocal (Plata)';
        medalDesc = 'Buen control de la columna de aire y afinación consistente. Solo faltan pequeños ajustes en los cambios de registro.';
        medalColor = '#cbd5e1';
      } else {
        medalEmoji = '🥉';
        medalTitle = 'Ensayo Vocal en Proceso (Bronce)';
        medalDesc = 'Se han registrado notas fuera de tono. Mantén el caudal de aire continuo y apóyate en los tonos guía para centrar las notas.';
        medalColor = '#f59e0b';
      }
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
            <span class="stat-sub">${hasSufficientData ? 'En tono perfecto' : 'Sin muestras de voz'}</span>
          </div>
          <div class="scorecard-stat-box">
            <span class="stat-label">Estabilidad de Aire</span>
            <span class="stat-number">${stability != null ? `${stability}%` : '—'}</span>
            <span class="stat-sub">${stability != null ? 'Vibrato controlado' : 'Sin datos'}</span>
          </div>
          <div class="scorecard-stat-box">
            <span class="stat-label">Apoyo Respiratorio</span>
            <span class="stat-number">${breath != null ? `${breath}%` : '—'}</span>
            <span class="stat-sub">${breath != null ? 'Presión diafragmática' : 'Sin datos'}</span>
          </div>
          <div class="scorecard-stat-box">
            <span class="stat-label">Rango Empleado</span>
            <span class="stat-number stat-range">${lowNote} – ${highNote}</span>
            <span class="stat-sub">${hasSufficientData ? 'Tesitura de la toma' : 'Sin tesitura'}</span>
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
