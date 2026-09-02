/**
 * @file VersionPickerModal.js
 * @description Pantalla intermedia de selección de versión cuando una canción tiene más de un arreglo disponible.
 */

import { events } from '../../core/EventBus.js';

export class VersionPickerModal {
  static instance = null;

  /**
   * Abre la pantalla intermedia de versiones si hay > 1 versiones.
   * Si solo hay 1 versión, ejecuta directamente el callback de selección.
   * @param {Object} options 
   * @param {string} options.title 
   * @param {string} options.artist 
   * @param {Array<Object>} options.versions 
   * @param {Function} options.onSelect 
   */
  static open({ title, artist, versions = [], onSelect }) {
    if (!versions || versions.length <= 1) {
      if (typeof onSelect === 'function') {
        onSelect(versions[0] || { title, artist });
      } else {
        events.emit('ui:loadLyricsSong', versions[0] || { title, artist });
      }
      return;
    }

    if (this.instance) {
      this.instance.close();
    }

    this.instance = new VersionPickerModal({ title, artist, versions, onSelect });
    this.instance.mount();
  }

  constructor({ title, artist, versions, onSelect }) {
    this.title = title || 'Canción';
    this.artist = artist || 'Artista';
    this.versions = versions;
    this.onSelect = onSelect;
    this.overlay = null;

    this.ensureStyles();
  }

  ensureStyles() {
    if (document.querySelector('link[data-version-picker-styles]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../../../assets/css/components/version-picker.css', import.meta.url).href;
    link.dataset.versionPickerStyles = 'true';
    document.head.appendChild(link);
  }

  mount() {
    const overlay = document.createElement('div');
    overlay.className = 'version-picker-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `Versiones disponibles para ${this.title}`);

    overlay.innerHTML = `
      <div class="version-picker-card">
        <div class="version-picker-header">
          <div class="version-picker-title-group">
            <span class="version-picker-badge">PANTALLA INTERMEDIA DE SELECCIÓN</span>
            <h2 class="version-picker-title">${this.escapeHTML(this.title)}</h2>
            <span class="version-picker-artist">— ${this.escapeHTML(this.artist)}</span>
          </div>
          <button type="button" class="btn-close-version-picker" id="btnCloseVersionPicker" aria-label="Cerrar ventana">✕</button>
        </div>

        <div class="version-picker-prompt">
          Esta canción cuenta con ${this.versions.length} versiones. Elige la versión que deseas interpretar:
        </div>

        <div class="version-picker-list">
          ${this.versions.map((ver, idx) => {
            const label = ver.versionLabel || `Versión ${idx + 1}`;
            const tuning = ver.tuning || 'Standard E';
            const diff = ver.difficulty || 'Estándar';
            const source = ver.contentSource === 'curated_lyrics' ? 'Letra Curada Oficial' : (ver.contentSource || 'Arreglo Local');
            const numStr = String(idx + 1).padStart(2, '0');
            return `
              <div class="version-item-card" data-version-index="${idx}">
                <span class="version-item-number" aria-hidden="true">${numStr}</span>
                <div class="version-item-info">
                  <div class="version-item-label">
                    <span>${this.escapeHTML(label)}</span>
                    <span class="version-item-tag">v${idx + 1}</span>
                  </div>
                  <div class="version-item-meta">
                    <span>🎸 ${this.escapeHTML(tuning)}</span>
                    <span>📊 ${this.escapeHTML(diff)}</span>
                    <span>✨ ${this.escapeHTML(source)}</span>
                  </div>
                </div>
                <button type="button" class="btn-select-version-action">Abrir</button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlay = overlay;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.overlay) return;

    this.overlay.querySelector('#btnCloseVersionPicker')?.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.overlay.querySelectorAll('.version-item-card').forEach((card) => {
      card.addEventListener('click', () => {
        const idx = Number(card.dataset.versionIndex);
        const selected = this.versions[idx];
        this.close();
        if (typeof this.onSelect === 'function') {
          this.onSelect(selected, idx);
        } else {
          events.emit('ui:loadLyricsSong', selected);
          events.emit('ui:switchTab', 'player');
        }
      });
    });
  }

  close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    VersionPickerModal.instance = null;
  }

  escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[m]);
  }
}

export default VersionPickerModal;
