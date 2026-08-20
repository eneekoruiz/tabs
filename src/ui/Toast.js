/**
 * @file Toast.js
 * @description Sistema de notificaciones flotantes (Toasts) con soporte de accesibilidad.
 */

import { events } from '../core/EventBus.js';
import { audioFeedback } from '../audio/AudioFeedback.js';

class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    let el = document.getElementById('toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-container';
      el.className = 'toast-container';
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', 'Notificaciones del sistema');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    this.container = el;

    events.on('toast:show', ({ message, type, duration }) => {
      this.show(message, type, duration);
    });
  }

  show(message, type = 'info', duration = 3500) {
    if (!this.container) return;

    if (type === 'success') {
      audioFeedback.playSuccess();
    } else if (type === 'error') {
      audioFeedback.playDismiss();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');
    
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };

    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[type] || '🔔'}</span>
      <span class="toast-message">${message}</span>
    `;

    this.container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

export const toast = new ToastManager();
export default toast;
