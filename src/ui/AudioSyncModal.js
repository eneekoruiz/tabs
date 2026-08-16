/**
 * @file AudioSyncModal.js
 * @description Modal flotante para cargar pistas de audio real (.mp3/.wav), calibrar el desfase (offset en ms)
 * y mezclar la pista de audio con la partitura interactiva.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { audioSyncEngine } from '../audio/AudioSyncEngine.js';
import { toast } from './Toast.js';

export class AudioSyncModal extends Component {
  constructor(container) {
    super(container);
    this.isOpen = false;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('ui:toggleAudioSync', () => {
        this.toggle();
      })
    );

    this.registerUnsub(
      events.on('ui:closeAllOverlays', () => {
        if (this.isOpen) this.toggle();
      })
    );

    this.registerUnsub(
      events.on('audioSync:loaded', () => {
        if (this.isOpen) this.render();
      })
    );
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.container) {
      this.container.classList.toggle('modal-open', this.isOpen);
      if (this.isOpen) {
        this.render();
      } else {
        this.container.innerHTML = '';
      }
    }
  }

  render() {
    if (!this.container || !this.isOpen) return;

    const isLoaded = audioSyncEngine.isLoaded;
    const fileName = audioSyncEngine.fileName || 'Ningún archivo cargado';
    const offset = audioSyncEngine.offsetMs;
    const volume = Math.round(audioSyncEngine.volume * 100);

    this.container.innerHTML = `
      <div class="modal-backdrop" id="audioSyncBackdrop">
        <div class="modal-card audio-sync-card" role="dialog" aria-label="Sincronización de Audio Real">
          <div class="modal-header">
            <div class="modal-title-group">
              <span class="modal-icon" aria-hidden="true">🎧</span>
              <h2>Sincronizar Audio Real (Backing Track)</h2>
            </div>
            <button class="btn-close-modal" id="btnCloseAudioSync" aria-label="Cerrar ventana de sincronización">✖</button>
          </div>

          <div class="audio-sync-body">
            <!-- Carga de Archivo de Audio -->
            <div class="sync-file-box">
              <label class="btn btn-primary btn-load-audio" aria-label="Seleccionar archivo MP3 o WAV">
                <span aria-hidden="true">📂</span> Cargar Audio (.mp3, .wav)
                <input type="file" id="syncFileInput" accept="audio/*" style="display: none;">
              </label>
              <span class="sync-filename-label" title="${fileName}">${fileName}</span>
            </div>

            <!-- Calibración del Desfase (Offset ms) -->
            <div class="tool-section">
              <div class="tool-section-label">
                <span>⏱️ Desfase de Sincronización (Offset):</span>
                <strong id="lblSyncOffsetVal">${offset > 0 ? '+' : ''}${offset} ms</strong>
              </div>
              <div class="offset-slider-row">
                <input type="range" id="syncOffsetSlider" min="-3000" max="3000" step="10" value="${offset}" class="slider-range-styled" aria-label="Ajustar desfase en milisegundos">
              </div>
              <div class="offset-quick-btns" role="group" aria-label="Ajuste fino de desfase">
                <button class="btn btn-secondary btn-offset-step" id="btnOffsetMinus50" aria-label="Restar 50 milisegundos">-50ms</button>
                <button class="btn btn-secondary btn-offset-step" id="btnOffsetZero" aria-label="Restablecer desfase a cero">0ms</button>
                <button class="btn btn-secondary btn-offset-step" id="btnOffsetPlus50" aria-label="Sumar 50 milisegundos">+50ms</button>
              </div>
            </div>

            <!-- Control de Volumen del Audio Real -->
            <div class="tool-section">
              <div class="tool-section-label">
                <span>🔊 Volumen de la Pista de Audio:</span>
                <strong id="lblSyncVolVal">${volume}%</strong>
              </div>
              <div class="sync-volume-row">
                <input type="range" id="syncVolSlider" min="0" max="100" value="${volume}" class="slider-range-styled" aria-label="Volumen del audio real">
                <button class="btn btn-secondary btn-mute-audio" id="btnMuteAudioSync" aria-label="Silenciar audio">
                  <span>${audioSyncEngine.isMuted ? '🔇' : '🔊'}</span>
                </button>
              </div>
            </div>

            <!-- Estado de Sincronización -->
            <div class="sync-status-indicator ${isLoaded ? 'sync-active' : ''}">
              <span class="sync-dot" aria-hidden="true"></span>
              <span>${isLoaded ? 'Pista de audio vinculada al motor de transporte' : 'Carga un archivo MP3/WAV para reemplazar la síntesis MIDI'}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btnCloseAudioSync')?.addEventListener('click', () => {
      this.toggle();
    });

    this.container.querySelector('#audioSyncBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'audioSyncBackdrop') this.toggle();
    });

    // Cargar archivo
    this.container.querySelector('#syncFileInput')?.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        await audioSyncEngine.loadAudioFile(file);
        toast.show(`Audio "${file.name}" cargado y sincronizado`, 'success');
        this.render();
      }
    });

    // Slider de Offset
    this.container.querySelector('#syncOffsetSlider')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      audioSyncEngine.setOffsetMs(val);
      const lbl = this.container?.querySelector('#lblSyncOffsetVal');
      if (lbl) lbl.textContent = `${val > 0 ? '+' : ''}${val} ms`;
    });

    // Botones rápidos de offset
    this.container.querySelector('#btnOffsetMinus50')?.addEventListener('click', () => {
      const cur = audioSyncEngine.offsetMs - 50;
      audioSyncEngine.setOffsetMs(cur);
      this.render();
    });

    this.container.querySelector('#btnOffsetPlus50')?.addEventListener('click', () => {
      const cur = audioSyncEngine.offsetMs + 50;
      audioSyncEngine.setOffsetMs(cur);
      this.render();
    });

    this.container.querySelector('#btnOffsetZero')?.addEventListener('click', () => {
      audioSyncEngine.setOffsetMs(0);
      this.render();
    });

    // Slider de Volumen
    this.container.querySelector('#syncVolSlider')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      audioSyncEngine.setVolume(val);
      const lbl = this.container?.querySelector('#lblSyncVolVal');
      if (lbl) lbl.textContent = `${Math.round(val * 100)}%`;
    });

    // Mute
    this.container.querySelector('#btnMuteAudioSync')?.addEventListener('click', () => {
      const isMuted = audioSyncEngine.toggleMute();
      this.render();
      toast.show(`Pista de audio ${isMuted ? 'silenciada' : 'activa'}`, 'info', 1000);
    });
  }
}

export default AudioSyncModal;
