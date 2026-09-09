/**
 * @file VocalScorecardModal.js
 * @description Tarjeta de rendimiento vocal post-interpretación (Simply Sing / Yousician style).
 * Muestra porcentaje de afinación global, medalla, notas extremas y apoyo respiratorio con datos 100% reales.
 */
import { escapeHTML } from '../../utils/sanitize.js';
import { trapModalFocus } from '../ModalFocus.js';

export class VocalScorecardModal {
  static show({ songTitle = '', artist = '', sessionStats = {}, hasMelodyReference = false, onRetry, onClose }) {
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
        medalDesc = 'Tu voz se mantuvo muy cerca del tono objetivo durante la mayor parte del ensayo.';
        medalColor = '#fbbf24';
      } else if (accuracy >= 60) {
        medalEmoji = '🥈';
        medalTitle = 'Gran Control Vocal (Plata)';
        medalDesc = 'Buen control del tono. Puedes ganar precisión en los cambios de registro y en las entradas.';
        medalColor = '#cbd5e1';
      } else {
        medalEmoji = '🥉';
        medalTitle = 'Ensayo Vocal en Proceso (Bronce)';
        medalDesc = 'Hay margen para centrar más las notas. Baja el tempo y usa la guía como referencia de entrada.';
        medalColor = '#f59e0b';
      }
    }

    const previousFocus = document.activeElement;
    const safeTitle = escapeHTML(songTitle);
    const safeArtist = escapeHTML(artist);
    const modalEl = document.createElement('div');
    modalEl.id = 'vocalScorecardModal';
    modalEl.className = 'vocal-scorecard-overlay';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-labelledby', 'scorecardTitle');
    modalEl.innerHTML = `
      <div class="scorecard-card">
        <button class="btn-scorecard-close" id="btnScorecardClose" aria-label="Cerrar">✕</button>
        <div class="scorecard-badge">RESUMEN DE ENSAYO VOCAL</div>
        <div class="scorecard-medal-emoji">${medalEmoji}</div>
        <h2 id="scorecardTitle" class="scorecard-medal-title" style="color: ${medalColor}">${escapeHTML(medalTitle)}</h2>
        <p class="scorecard-song-name">${safeTitle} ${safeArtist ? `· ${safeArtist}` : ''}</p>
        <p class="scorecard-desc">${escapeHTML(medalDesc)}</p>
        <p class="scorecard-reference-note">${hasMelodyReference
          ? 'Referencia vocal aportada; en los intervalos sin nota se mide afinación cromática.'
          : 'Afinación cromática: compara tu voz con la nota más cercana. No evalúa la melodía original de la canción.'}</p>

        <div class="scorecard-stats-grid">
          <div class="scorecard-stat-box">
            <span class="stat-label">${hasMelodyReference ? 'Afinación medida' : 'Afinación cromática'}</span>
            <span class="stat-number ${accuracy >= 70 ? 'stat-good' : ''}">${accuracy}%</span>
            <span class="stat-sub">${hasSufficientData ? 'Dentro del margen de afinación' : 'Sin muestras de voz'}</span>
          </div>
          <div class="scorecard-stat-box">
            <span class="stat-label">Estabilidad de tono</span>
            <span class="stat-number">${stability != null ? `${stability}%` : '—'}</span>
            <span class="stat-sub">${stability != null ? 'Variación medida' : 'Sin datos'}</span>
          </div>
          <div class="scorecard-stat-box">
            <span class="stat-label">Consistencia de señal</span>
            <span class="stat-number">${breath != null ? `${breath}%` : '—'}</span>
            <span class="stat-sub">${breath != null ? 'Nivel de voz medido' : 'Sin datos'}</span>
          </div>
          <div class="scorecard-stat-box">
            <span class="stat-label">Rango Empleado</span>
            <span class="stat-number stat-range">${escapeHTML(lowNote)} – ${escapeHTML(highNote)}</span>
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

    let releaseFocus;
    const close = (retry = false) => {
      releaseFocus?.(false);
      modalEl.remove();
      previousFocus?.focus?.({ preventScroll: true });
      if (retry) onRetry?.();
      else onClose?.();
    };
    modalEl.querySelector('#btnScorecardClose')?.addEventListener('click', () => close());
    modalEl.querySelector('#btnScorecardDone')?.addEventListener('click', () => close());
    modalEl.querySelector('#btnScorecardRetry')?.addEventListener('click', () => close(true));
    modalEl.addEventListener('click', event => { if (event.target === modalEl) close(); });
    releaseFocus = trapModalFocus(modalEl, { onClose: () => close() });
  }
}

export default VocalScorecardModal;
