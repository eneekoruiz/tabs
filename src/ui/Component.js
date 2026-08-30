/**
 * @file Component.js
 * @description Clase base para componentes de interfaz de usuario desacoplados.
 */

export class Component {
  /**
   * @param {HTMLElement|string} container - Elemento DOM o selector donde se monta el componente
   */
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.unsubscribers = [];
  }

  /**
   * Método de renderizado a sobrescribir por los componentes hijos.
   */
  render() {}

  /**
   * Registra un cleanup para desuscribir eventos al destruir el componente.
   * @param {Function} unsub 
   */
  registerUnsub(unsub) {
    if (typeof unsub === 'function') {
      this.unsubscribers.push(unsub);
    }
  }

  /**
   * Destruye el componente y limpia suscripciones.
   */
  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

export default Component;
