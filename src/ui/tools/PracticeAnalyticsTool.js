/**
 * @file PracticeAnalyticsTool.js
 * @description Panel de Analíticas y Progresión del Músico (Practice Dashboard):
 * - Resumen de métricas de práctica y racha (Streak).
 * - Gráficos de barras SVG de constancia semanal.
 * - Matriz de calor mensual de 30 días.
 * - Top canciones más ensayadas con niveles de maestría y velocidad máxima.
 * - Vitrina de insignias y logros desbloqueados.
 */

import { Component } from '../Component.js';
import { events } from '../../core/EventBus.js';
import { practiceTrackerService } from '../../data/PracticeTrackerService.js';
import { toast } from '../Toast.js';

export class PracticeAnalyticsTool extends Component {
  constructor() {
    super(null);
    this.service = practiceTrackerService;
    this.initEvents();
  }

  initEvents() {
    events.on('analytics:open', () => this.open('#analytics-modal-container'));
  }

  open(targetContainerSelector = '#analytics-modal-container') {
    let host = document.querySelector(targetContainerSelector);
    if (!host || host.offsetParent === null && targetContainerSelector === '#toolModalHost') {
      host = document.querySelector('#analytics-modal-container') || document.querySelector('#toolModalHost');
    }
    if (!host) return;

    host.innerHTML = this.renderModal();
    this.attachListeners(host);
  }

  close(host) {
    if (host) host.innerHTML = '';
  }

  renderModal() {
    const summary = this.service.getStatsSummary();
    const weeklyData = this.service.getWeeklyActivity();
    const heatmapData = this.service.getMonthHeatmap();
    const topSongs = this.service.getTopSongs(4);
    const milestones = this.service.getMilestones();

    return `
      <div class="analytics-modal-overlay" id="modal-practice-analytics" role="dialog" aria-label="Panel de Analíticas del Músico">
        <div class="analytics-modal-card">
          <!-- CABECERA -->
          <div class="analytics-header">
            <div class="analytics-title-group">
              <span class="analytics-badge">PRACTICE INTELLIGENCE · STUDIO DASHBOARD</span>
              <h2 class="analytics-title">Panel de Rendimiento y Hábito</h2>
              <p class="analytics-subtitle">Estadísticas reales de constancia, velocidad y repertorio dominado.</p>
            </div>
            <button class="btn-close-analytics" id="btnCloseAnalytics" aria-label="Cerrar Panel">✕</button>
          </div>

          <!-- TARJETAS DE MÉTRICAS CLAVE -->
          <div class="analytics-kpi-grid">
            <div class="kpi-card">
              <span class="kpi-icon">⏳</span>
              <div class="kpi-data">
                <span class="kpi-value" id="lblKpiTotalHours">${summary.totalHours} h</span>
                <span class="kpi-label">Tiempo Total</span>
              </div>
            </div>

            <div class="kpi-card highlight-streak">
              <span class="kpi-icon">🔥</span>
              <div class="kpi-data">
                <span class="kpi-value" id="lblKpiStreak">${summary.currentStreak} Días</span>
                <span class="kpi-label">Racha Activa (Récord: ${summary.bestStreak}d)</span>
              </div>
            </div>

            <div class="kpi-card">
              <span class="kpi-icon">🎼</span>
              <div class="kpi-data">
                <span class="kpi-value" id="lblKpiSongs">${summary.totalSongs}</span>
                <span class="kpi-label">Temas Ensayados</span>
              </div>
            </div>

            <div class="kpi-card">
              <span class="kpi-icon">⚡</span>
              <div class="kpi-data">
                <span class="kpi-value" id="lblKpiToday">${summary.activeTodayMinutes} m</span>
                <span class="kpi-label">Sesión de Hoy</span>
              </div>
            </div>
          </div>

          <!-- GRÁFICO SEMANAL DE PRÁCTICA (SVG) -->
          <div class="analytics-section-card">
            <div class="section-card-header">
              <h3>📊 Constancia Semanal (Minutos por Día)</h3>
            </div>
            <div class="weekly-bar-chart-container">
              ${this._renderWeeklyBarChart(weeklyData)}
            </div>
          </div>

          <!-- MATRIZ DE CALOR 30 DÍAS -->
          <div class="analytics-section-card">
            <div class="section-card-header">
              <h3>🗓️ Mapa de Actividad (Últimos 30 Días)</h3>
              <div class="heatmap-legend">
                <span class="legend-box lvl-0"></span><span>0m</span>
                <span class="legend-box lvl-1"></span><span>10m</span>
                <span class="legend-box lvl-2"></span><span>20m</span>
                <span class="legend-box lvl-3"></span><span>30m+</span>
              </div>
            </div>
            <div class="month-heatmap-grid" id="monthHeatmapGrid">
              ${heatmapData.map(h => `<div class="heatmap-cell lvl-${h.level}" title="${h.date}: ${h.minutes} min"></div>`).join('')}
            </div>
          </div>

          <!-- CANCIONES MÁS ENSAYADAS & HITOS -->
          <div class="analytics-split-row">
            <!-- Top Canciones -->
            <div class="analytics-section-card split-half">
              <div class="section-card-header">
                <h3>🏆 Canciones Más Tocadas</h3>
              </div>
              <div class="top-songs-list">
                ${topSongs.map((s, idx) => `
                  <div class="top-song-row">
                    <span class="song-rank">#${idx + 1}</span>
                    <div class="song-meta-col">
                      <strong class="song-row-title">${s.title}</strong>
                      <span class="song-row-sub">${s.artist} · ${s.count} ensayos · Max BPM: ${s.maxBpm}</span>
                    </div>
                    <span class="song-row-time">${s.totalMinutes}m</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Insignias y Logros -->
            <div class="analytics-section-card split-half">
              <div class="section-card-header">
                <h3>🎖️ Insignias y Logros</h3>
              </div>
              <div class="milestones-grid">
                ${milestones.map(m => `
                  <div class="milestone-badge-card ${m.unlocked ? 'unlocked' : 'locked'}">
                    <span class="milestone-icon">${m.icon}</span>
                    <div class="milestone-text">
                      <strong>${m.title}</strong>
                      <span>${m.desc}</span>
                      ${m.unlocked ? `<span class="milestone-date">✓ ${m.date || 'Desbloqueado'}</span>` : '<span class="milestone-locked-tag">🔒 Bloqueado</span>'}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  _renderWeeklyBarChart(data) {
    const maxMinutes = Math.max(45, ...data.map(d => d.minutes));

    return `
      <div class="bar-chart-flex">
        ${data.map(d => {
          const heightPercent = Math.max(6, Math.round((d.minutes / maxMinutes) * 100));
          return `
            <div class="bar-chart-col ${d.isToday ? 'is-today' : ''}">
              <span class="bar-value-label">${d.minutes > 0 ? `${d.minutes}m` : ''}</span>
              <div class="bar-track">
                <div class="bar-fill" style="height: ${heightPercent}%;"></div>
              </div>
              <span class="bar-day-name">${d.dayName}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  attachListeners(container) {
    const card = container.querySelector('#modal-practice-analytics');
    if (!card) return;

    card.querySelector('#btnCloseAnalytics')?.addEventListener('click', () => {
      this.close(container);
    });
  }
}
