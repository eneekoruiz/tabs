/**
 * @file EventBus.js
 * @description Sistema de publicación/suscripción (Pub/Sub) para desacoplar completamente
 * el motor de audio, la base de datos y los componentes de interfaz de usuario.
 */

class EventBus {
  constructor() {
    this.events = new Map();
  }

  /**
   * Suscribe un callback a un evento específico.
   * @param {string} event - Nombre del evento.
   * @param {Function} callback - Función a ejecutar cuando ocurra el evento.
   * @returns {Function} Función para cancelar la suscripción (unsubscribe).
   */
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Suscribe un callback que se ejecutará una sola vez.
   * @param {string} event 
   * @param {Function} callback 
   */
  once(event, callback) {
    const wrapper = (payload) => {
      callback(payload);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  /**
   * Desuscribe un callback de un evento.
   * @param {string} event 
   * @param {Function} callback 
   */
  off(event, callback) {
    if (!this.events.has(event)) return;
    this.events.get(event).delete(callback);
    if (this.events.get(event).size === 0) {
      this.events.delete(event);
    }
  }

  /**
   * Emite un evento a todos sus suscriptores de forma segura y no bloqueante.
   * @param {string} event - Nombre del evento.
   * @param {*} [payload] - Datos adjuntos al evento.
   */
  emit(event, payload = null) {
    if (!this.events.has(event)) return;
    
    // Iteramos sobre una copia para evitar problemas de concurrencia
    const listeners = Array.from(this.events.get(event));
    for (const callback of listeners) {
      try {
        callback(payload);
      } catch (error) {
        console.error(`[EventBus] Error procesando listener para "${event}":`, error);
      }
    }
  }

  /**
   * Limpia todos los eventos registrados.
   */
  clear() {
    this.events.clear();
  }
}

// Exportamos una instancia singleton global para todo el proyecto
export const events = new EventBus();
export default EventBus;
