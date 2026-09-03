/**
 * @file KeyboardShortcuts.js
 * @description Gestor de atajos de teclado globales y pedales Bluetooth 100% a prueba de colisiones.
 * Garantiza que cuando el usuario esté escribiendo, buscando canciones/artistas o en cualquier campo de texto,
 * NINGÚN atajo interfiera con la escritura.
 */

import { events } from '../core/EventBus.js';
import { audioEngine } from '../core/AudioEngine.js';
import { setlistManager } from '../data/SetlistManager.js';
import { state } from '../core/State.js';
import { toast } from './Toast.js';

class KeyboardShortcuts {
  constructor() {
    this.bindGlobalKeys();
  }

  /**
   * Comprueba de forma exhaustiva si el usuario está escribiendo o interactuando con un campo de texto.
   * @param {KeyboardEvent} e
   * @returns {boolean}
   */
  isUserTyping(e) {
    if (e.isComposing) return true;

    let target = e.target;
    let activeEl = document.activeElement;

    // Si el evento original viene de un shadow root
    if (e.composedPath && typeof e.composedPath === 'function') {
      const path = e.composedPath();
      if (path && path.length > 0) {
        target = path[0];
      }
    }

    const isInputEl = (el) => {
      if (!el) return false;
      if (el.isContentEditable || (el.getAttribute && el.getAttribute('contenteditable') === 'true')) return true;
      const tag = (el.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return true;
      if (el.closest && el.closest('input, textarea, select, [contenteditable="true"]')) return true;
      return false;
    };

    if (isInputEl(target)) return true;
    if (isInputEl(activeEl)) return true;

    return false;
  }

  bindGlobalKeys() {
    window.addEventListener('keydown', (e) => {
      // 0. ESC -> Cerrar cualquier modal u overlay abierto o salir de búsqueda
      if (e.code === 'Escape' || e.key === 'Escape') {
        if (this.isUserTyping(e)) {
          if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
          }
        }
        events.emit('ui:closeAllOverlays');
        return;
      }

      // SI EL USUARIO ESTÁ ESCRIBIENDO, SALIR INMEDIATAMENTE (CERO COLISIONES)
      if (this.isUserTyping(e)) {
        return;
      }

      // Si hay teclas modificadoras activas (excepto combinaciones específicas como Ctrl+B), permitir comportamiento nativo (copiar, pegar, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
          e.preventDefault();
          events.emit('ui:toggleLibrary');
        }
        return;
      }

      // 1. Soporte de Pedales Bluetooth y Navegación de Página (Page Down / Page Up)
      if (e.code === 'PageDown') {
        e.preventDefault();
        const lyricsContainer = document.querySelector('.lyrics-chords-container');
        if (lyricsContainer) {
          window.scrollBy({ top: 420, behavior: 'smooth' });
          toast.show('Pedal: Página Abajo 📄', 'info', 600);
          return;
        }
        const viewport = document.getElementById('score-viewport');
        if (viewport) {
          viewport.scrollBy({ top: 350, behavior: 'smooth' });
        }
        return;
      }
      if (e.code === 'PageUp') {
        e.preventDefault();
        const lyricsContainer = document.querySelector('.lyrics-chords-container');
        if (lyricsContainer) {
          window.scrollBy({ top: -420, behavior: 'smooth' });
          toast.show('Pedal: Página Arriba 📄', 'info', 600);
          return;
        }
        const viewport = document.getElementById('score-viewport');
        if (viewport) {
          viewport.scrollBy({ top: -350, behavior: 'smooth' });
        }
        return;
      }

      // 2. Play / Pause / Auto-Scroll -> Barra espaciadora (solo fuera de inputs)
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        const isLyricsView = !!document.querySelector('.lyrics-chords-container');
        if (isLyricsView) {
          events.emit('song:toggleAutoScroll');
        } else {
          audioEngine.playPause();
        }
        return;
      }

      // 3. Stop & Rebobinar -> Enter o Home (solo fuera de inputs)
      if (e.code === 'Enter' || e.code === 'Home') {
        e.preventDefault();
        audioEngine.stop();
        toast.show('⏹ Detenido al inicio', 'info', 800);
        return;
      }

      // 4. Compás Anterior / Siguiente -> Flecha Izquierda / Derecha
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const curBar = state.get('playback')?.currentBar || 1;
        audioEngine.seekToBar(Math.max(1, curBar - 1));
        return;
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        const curBar = state.get('playback')?.currentBar || 1;
        audioEngine.seekToBar(curBar + 1);
        return;
      }

      // 5. Ajustar Velocidad de Auto-Scroll en Letras o Pista en Partitura -> Flecha Arriba / Abajo
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        const isLyricsView = !!document.querySelector('.lyrics-chords-container');
        if (isLyricsView) {
          events.emit('song:stepAutoScroll', 5);
          return;
        }
        const curTrack = state.get('activeTrackIndex') || 0;
        audioEngine.selectVisualTrack(Math.max(0, curTrack - 1));
        return;
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        const isLyricsView = !!document.querySelector('.lyrics-chords-container');
        if (isLyricsView) {
          events.emit('song:stepAutoScroll', -5);
          return;
        }
        const curTrack = state.get('activeTrackIndex') || 0;
        const total = (state.get('tracksState') || []).length;
        audioEngine.selectVisualTrack(Math.min(total - 1, curTrack + 1));
        return;
      }

      // 6. Atajos de Letras Únicas para Músicos
      switch (e.key.toLowerCase()) {
        case 'g': // Modo Directo / Gig Mode
          e.preventDefault();
          events.emit('ui:toggleGigMode');
          break;

        case 'n': // Siguiente canción en Setlist
          e.preventDefault();
          setlistManager.playNextSongInSetlist();
          break;

        case 'm': // Metrónomo
          e.preventDefault();
          const met = state.get('metronome') || {};
          audioEngine.setMetronome(!met.enabled);
          toast.show(`Metrónomo ${!met.enabled ? 'Activado' : 'Desactivado'}`, 'info', 1000);
          break;

        case 'c': // Count-in (Claqueta previa)
          e.preventDefault();
          const metC = state.get('metronome') || {};
          audioEngine.setCountIn(!metC.countIn);
          toast.show(`Cuenta atrás ${!metC.countIn ? 'Activada' : 'Desactivada'}`, 'info', 1000);
          break;

        case 'l': // Loop A-B
          e.preventDefault();
          const loop = state.get('loop') || {};
          if (loop.enabled) {
            audioEngine.clearLoop();
            toast.show('Bucle desactivado', 'info', 1000);
          } else {
            const currentBar = state.get('playback')?.currentBar || 1;
            audioEngine.setLoopRange(currentBar, currentBar + 3);
            toast.show(`Bucle fijado: Compases ${currentBar} a ${currentBar + 3}`, 'success', 1200);
          }
          break;

        case 'x': // Consola Mezclador
          e.preventDefault();
          events.emit('ui:toggleMixer');
          break;

        case 'f': // Mástil de Guitarra
          e.preventDefault();
          events.emit('ui:toggleFretboard');
          break;

        case 't': // Speed Trainer
          e.preventDefault();
          events.emit('ui:toggleSpeedTrainer');
          break;

        case 'a': // Afinador Cromático & Escucha Activa
          e.preventDefault();
          events.emit('ui:toggleTuner');
          break;

        case 'p': // Arsenal PRO (Transposición, Capo, Simplificador)
        case 'h': // Herramientas
          e.preventDefault();
          events.emit('ui:toggleToolbox');
          break;

        case 'd': // Diccionario de Acordes
          e.preventDefault();
          events.emit('ui:toggleChordModal');
          break;

        case '[': // Reducir Velocidad -5%
          e.preventDefault();
          const curSpeedDown = state.get('playback')?.playbackSpeed || 1.0;
          audioEngine.setPlaybackSpeed(Math.max(0.25, curSpeedDown - 0.05));
          toast.show(`Velocidad: ${Math.round((curSpeedDown - 0.05) * 100)}%`, 'info', 800);
          break;

        case ']': // Aumentar Velocidad +5%
          e.preventDefault();
          const curSpeedUp = state.get('playback')?.playbackSpeed || 1.0;
          audioEngine.setPlaybackSpeed(Math.min(2.0, curSpeedUp + 0.05));
          toast.show(`Velocidad: ${Math.round((curSpeedUp + 0.05) * 100)}%`, 'info', 800);
          break;
      }
    });
  }
}

export const keyboardShortcuts = new KeyboardShortcuts();
export default keyboardShortcuts;
