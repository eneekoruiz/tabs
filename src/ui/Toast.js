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
    if (typeof document === 'undefined') return;
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

    // Deduplicar notificaciones idénticas activas
    const existing = this.container.querySelectorAll('.toast');
    existing.forEach((el) => {
      if (el.querySelector('.toast-message')?.textContent === message) {
        el.remove();
      }
    });

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

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = icons[type] || '🔔';

    const msgSpan = document.createElement('span');
    msgSpan.className = 'toast-message';
    msgSpan.textContent = String(message ?? '');

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);

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
