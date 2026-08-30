/**
 * @file AudioTranscriberTool.js
 * @description Herramienta UI de Transcripción Mágica de Audio a Acordes y Tablaturas ("Magic Scratchpad"):
 * - Visualizador de onda / espectro en tiempo real en Canvas.
 * - Grabación directa con micrófono o carga de archivos de audio locales.
 * - Timeline de acordes detectados con pre-escucha y edición.
 * - Carga instantánea en el visor de partituras/acordes de la aplicación y guardado en Mis Tabs.
 */

import { Component } from '../Component.js';
import { events } from '../../core/EventBus.js';
import { audioTranscriptionEngine } from '../../audio/AudioTranscriptionEngine.js';
import { chordEngine } from '../../tools/ChordEngine.js';
import { db } from '../../data/Database.js';
import { toast } from '../Toast.js';

export class AudioTranscriberTool extends Component {
  constructor(audioContextGetter = null) {
    super(null);
    this.audioContextGetter = audioContextGetter;
    this.engine = audioTranscriptionEngine;
    this.isRecording = false;
    this.isProcessing = false;
    this.lastTranscription = null;
    this.isPlayingPreview = false;
    this.previewTimeoutId = null;
    this.animationId = null;

    this.initEvents();
  }

  initEvents() {
    events.on('transcriber:open', () => this.open('#transcription-modal-container'));
  }

  open(targetContainerSelector = '#transcription-modal-container') {
    let host = document.querySelector(targetContainerSelector);
    if (!host || host.offsetParent === null && targetContainerSelector === '#toolModalHost') {
      host = document.querySelector('#transcription-modal-container') || document.querySelector('#toolModalHost');
    }
    if (!host) return;

    host.innerHTML = this.renderModal();
    this.attachListeners(host);
  }

  close(host) {
    this.stopPreview();
    if (this.isRecording) {
      this.engine.stopLiveRecording();
      this.isRecording = false;
    }
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (host) host.innerHTML = '';
  }

  renderModal() {
    return `
      <div class="transcriber-modal-overlay" id="modal-audio-transcriber" role="dialog" aria-label="Transcripción de Audio a Acordes">
        <div class="transcriber-modal-card">
          <!-- CABECERA -->
          <div class="transcriber-header">
            <div class="transcriber-title-group">
              <span class="transcriber-badge">AI DSP · MAGIC SCRATCHPAD</span>
              <h2 class="transcriber-title">Transcripción de Audio a Acordes</h2>
              <p class="transcriber-subtitle">Graba un acorde o idea con tu guitarra o sube un archivo para extraer la progresión automáticamente.</p>
            </div>
            <button class="btn-close-transcriber" id="btnCloseTranscriber" aria-label="Cerrar Transcriptor">✕</button>
          </div>

          <!-- LIENZO DE VISUALIZACIÓN DE ONDA -->
          <div class="transcriber-wave-viewport">
            <canvas id="transcriptionWaveCanvas" class="transcription-wave-canvas" width="680" height="140"></canvas>
            <div class="transcriber-wave-overlay-info" id="waveStatusOverlay">
              <span class="wave-status-text" id="lblWaveStatus">${this.isRecording ? '🔴 Grabando idea...' : 'Listo para grabar o importar audio'}</span>
            </div>
          </div>

          <!-- CONTROLES DE CAPTURA -->
          <div class="transcriber-action-bar">
            <button class="btn-transcriber-rec ${this.isRecording ? 'recording' : ''}" id="btnToggleTranscribeRec">
              <span class="rec-pulsing-dot"></span>
              <span id="lblTranscribeRec">${this.isRecording ? 'Detener y Analizar' : '🎙️ Grabar con Micrófono'}</span>
            </button>

            <label class="btn-transcriber-upload" for="fileAudioUpload" id="lblAudioUpload">
              <span>📁 Subir Archivo Audio</span>
              <input type="file" id="fileAudioUpload" accept="audio/*,video/*" style="display: none;" />
            </label>
          </div>

          <!-- ESTADO DE PROCESAMIENTO -->
          <div class="transcriber-progress-box" id="transcriberProgressBox" style="display: none;">
            <div class="transcriber-spinner"></div>
            <span class="transcriber-progress-msg">Analizando espectro FFT y extrayendo cromagrama armónico...</span>
          </div>

          <!-- RESULTADOS: TIMELINE DE ACORDES DETECTADOS -->
          <div class="transcription-results-section" id="transcriptionResultsSection" style="display: ${this.lastTranscription ? 'block' : 'none'};">
            <div class="results-header-row">
              <div class="results-meta-badge">
                <span>Tonalidad Estimada:</span>
                <strong id="lblDetectedKey">${this.lastTranscription?.detectedKey || 'C Mayor'}</strong>
              </div>
              <div class="results-actions-right">
                <button class="btn-transcribe-preview" id="btnPlayTranscriptionPreview">
                  <span>${this.isPlayingPreview ? '⏸ Pausar' : '▶ Pre-escucha'}</span>
                </button>
              </div>
            </div>

            <!-- CHORD TIMELINE CARDS -->
            <div class="chord-timeline-grid" id="chordTimelineGrid">
              ${this._renderChordTimelineCards(this.lastTranscription?.chords || [])}
            </div>

            <!-- BOTONES DE EXPORTACIÓN Y CARGA -->
            <div class="transcription-export-bar">
              <button class="btn-transcribe-load" id="btnLoadInSongViewer">
                <span>🎵 Abrir en Visor de Acordes</span>
              </button>
              <button class="btn-transcribe-save" id="btnSaveToMyTabs">
                <span>💾 Guardar en Mis Tabs</span>
              </button>
              <button class="btn-transcribe-copy" id="btnCopyChordPro">
                <span>📋 Copiar ChordPro</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  _renderChordTimelineCards(chords) {
    if (!chords || chords.length === 0) {
      return `
        <div class="chord-card-empty">
          <span>🎙️ Canta o toca una progresión (ej. C - G - Am - F) para ver los acordes aquí.</span>
        </div>
      `;
    }

    return chords.map((c, i) => `
      <div class="chord-timeline-card" data-index="${i}">
        <span class="chord-card-time">${c.startTime.toFixed(1)}s - ${c.endTime.toFixed(1)}s</span>
        <div class="chord-card-name">${c.chord}</div>
        <div class="chord-card-confidence">
          <span class="confidence-bar" style="width: ${Math.round(c.confidence * 100)}%;"></span>
          <span class="confidence-val">${Math.round(c.confidence * 100)}%</span>
        </div>
      </div>
    `).join('');
  }

  attachListeners(container) {
    const card = container.querySelector('#modal-audio-transcriber');
    if (!card) return;

    this.canvas = card.querySelector('#transcriptionWaveCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this._startWaveformLoop();

    // Botón Cerrar
    card.querySelector('#btnCloseTranscriber')?.addEventListener('click', () => {
      this.close(container);
    });

    // Botón Grabar / Detener
    card.querySelector('#btnToggleTranscribeRec')?.addEventListener('click', async () => {
      if (this.isRecording) {
        await this._handleStopRecording(container);
      } else {
        await this._handleStartRecording(container);
      }
    });

    // Carga de Archivo
    card.querySelector('#fileAudioUpload')?.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        await this._handleFileUpload(file, container);
      }
    });

    // Botón Pre-escucha
    card.querySelector('#btnPlayTranscriptionPreview')?.addEventListener('click', () => {
      this._togglePreview(container);
    });

    // Botón Cargar en Visor de Acordes
    card.querySelector('#btnLoadInSongViewer')?.addEventListener('click', () => {
      this._loadInSongViewer();
      this.close(container);
    });

    // Botón Guardar en Mis Tabs
    card.querySelector('#btnSaveToMyTabs')?.addEventListener('click', async () => {
      await this._saveToMyTabs();
    });

    // Botón Copiar ChordPro
    card.querySelector('#btnCopyChordPro')?.addEventListener('click', () => {
      if (this.lastTranscription?.chordPro) {
        navigator.clipboard.writeText(this.lastTranscription.chordPro);
        toast.show('Progresión ChordPro copiada al portapapeles', 'success');
      }
    });
  }

  async _handleStartRecording(container) {
    try {
      await this.engine.startLiveRecording();
      this.isRecording = true;
      const btn = container.querySelector('#btnToggleTranscribeRec');
      const lbl = container.querySelector('#lblTranscribeRec');
      const status = container.querySelector('#lblWaveStatus');
      if (btn) btn.classList.add('recording');
      if (lbl) lbl.textContent = 'Detener y Analizar';
      if (status) status.textContent = '🔴 Grabando idea en vivo... ¡Toca tus acordes!';
    } catch (err) {
      console.warn('[AudioTranscriberTool] Error iniciando grabación:', err);
      toast.show('No se pudo acceder al micrófono', 'error');
    }
  }

  async _handleStopRecording(container) {
    const progressBox = container.querySelector('#transcriberProgressBox');
    const status = container.querySelector('#lblWaveStatus');
    if (progressBox) progressBox.style.display = 'flex';
    if (status) status.textContent = 'Procesando espectrograma...';

    const result = await this.engine.stopLiveRecording();
    this.isRecording = false;

    if (progressBox) progressBox.style.display = 'none';
    if (result) {
      this.lastTranscription = result;
      this._updateResultsUI(container);
      toast.show(`¡Transcripción completada! ${result.chords.length} acordes identificados`, 'success');
    }
  }

  async _handleFileUpload(file, container) {
    const progressBox = container.querySelector('#transcriberProgressBox');
    if (progressBox) progressBox.style.display = 'flex';

    try {
      const result = await this.engine.transcribeAudioBlob(file);
      if (progressBox) progressBox.style.display = 'none';
      if (result) {
        this.lastTranscription = result;
        this._updateResultsUI(container);
        toast.show(`Archivo procesado: ${result.chords.length} acordes detectados`, 'success');
      }
    } catch (err) {
      if (progressBox) progressBox.style.display = 'none';
      toast.show('Error al procesar el archivo de audio', 'error');
    }
  }

  _updateResultsUI(container) {
    const resultsSec = container.querySelector('#transcriptionResultsSection');
    const keyEl = container.querySelector('#lblDetectedKey');
    const gridEl = container.querySelector('#chordTimelineGrid');
    const status = container.querySelector('#lblWaveStatus');
    const btnRec = container.querySelector('#btnToggleTranscribeRec');
    const lblRec = container.querySelector('#lblTranscribeRec');

    if (btnRec) btnRec.classList.remove('recording');
    if (lblRec) lblRec.textContent = '🎙️ Grabar Nueva Idea';
    if (status) status.textContent = `Transcripción lista (${this.lastTranscription.chords.length} acordes)`;

    if (resultsSec) resultsSec.style.display = 'block';
    if (keyEl) keyEl.textContent = this.lastTranscription.detectedKey;
    if (gridEl) gridEl.innerHTML = this._renderChordTimelineCards(this.lastTranscription.chords);
  }

  _togglePreview(container) {
    if (this.isPlayingPreview) {
      this.stopPreview();
      const btn = container.querySelector('#btnPlayTranscriptionPreview');
      if (btn) btn.innerHTML = '<span>▶ Pre-escucha</span>';
    } else {
      this.isPlayingPreview = true;
      const btn = container.querySelector('#btnPlayTranscriptionPreview');
      if (btn) btn.innerHTML = '<span>⏸ Pausar</span>';
      this._playChordSequence(0, container);
    }
  }

  _playChordSequence(index, container) {
    if (!this.isPlayingPreview || !this.lastTranscription || index >= this.lastTranscription.chords.length) {
      this.stopPreview();
      const btn = container.querySelector('#btnPlayTranscriptionPreview');
      if (btn) btn.innerHTML = '<span>▶ Pre-escucha</span>';
      return;
    }

    const chordObj = this.lastTranscription.chords[index];
    chordEngine.playChord(chordObj.chord, 'guitar');

    // Resaltar tarjeta activa
    container.querySelectorAll('.chord-timeline-card').forEach((c, idx) => {
      if (idx === index) c.classList.add('playing');
      else c.classList.remove('playing');
    });

    const durMs = Math.max(600, chordObj.duration * 1000);
    this.previewTimeoutId = setTimeout(() => {
      this._playChordSequence(index + 1, container);
    }, durMs);
  }

  stopPreview() {
    this.isPlayingPreview = false;
    if (this.previewTimeoutId) {
      clearTimeout(this.previewTimeoutId);
      this.previewTimeoutId = null;
    }
  }

  _loadInSongViewer() {
    if (!this.lastTranscription) return;

    const newSong = {
      title: 'Idea Transcrita ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      artist: 'Grabación de Estudio',
      genre: 'Acústico / Creación',
      difficulty: 'Fácil',
      tuning: 'Standard E',
      lyricsChords: this.lastTranscription.chordPro,
      data: this.lastTranscription.alphaTex,
      addedAt: Date.now()
    };

    events.emit('song:loaded', newSong);
    events.emit('ui:switchTab', 'player');
    toast.show('Idea cargada en el visor de acordes', 'success');
  }

  async _saveToMyTabs() {
    if (!this.lastTranscription) return;

    const record = {
      title: 'Idea Transcrita ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      artist: 'Grabación de Estudio',
      genre: 'Creación',
      difficulty: 'Fácil',
      tuning: 'Standard E',
      lyricsChords: this.lastTranscription.chordPro,
      data: this.lastTranscription.alphaTex,
      addedAt: Date.now()
    };

    await db.saveSong(record);
    toast.show('Canción guardada en Mis Tabs', 'success');
  }

  _startWaveformLoop() {
    const draw = () => {
      if (this.ctx && this.canvas) {
        const width = this.canvas.width;
        const height = this.canvas.height;
        this.ctx.fillStyle = '#090b10';
        this.ctx.fillRect(0, 0, width, height);

        // Línea central
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, height / 2);
        this.ctx.lineTo(width, height / 2);
        this.ctx.stroke();

        // Dibujar onda activa o pulso
        this.ctx.strokeStyle = this.isRecording ? '#ff3d00' : '#00e5ff';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();

        const points = 64;
        const sliceWidth = width / points;
        let x = 0;
        const time = Date.now() * 0.004;

        for (let i = 0; i <= points; i++) {
          const amp = this.isRecording ? (25 + Math.sin(i * 0.5 + time * 3) * 18) : (8 + Math.sin(i * 0.2 + time) * 5);
          const y = height / 2 + Math.sin(i * 0.4 + time * 2) * amp;
          if (i === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
          x += sliceWidth;
        }
        this.ctx.stroke();
      }
      this.animationId = requestAnimationFrame(draw);
    };
    draw();
  }
}
