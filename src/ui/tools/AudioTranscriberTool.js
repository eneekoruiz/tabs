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
    this.operationId = 0;
    this.isPreparing = false;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(events.on('transcriber:open', () => this.open('#transcription-modal-container')));
    this.registerUnsub(events.on('transcriber:error', ({ error }) => {
      if (this.isRecording && this.host?.querySelector('#modal-audio-transcriber')) {
        this.isRecording = false;
        this._showError(this.host, error);
        this._setBusy(this.host, false);
      }
    }));
  }

  open(targetContainerSelector = '#transcription-modal-container') {
    let host = document.querySelector(targetContainerSelector);
    if (!host || host.offsetParent === null && targetContainerSelector === '#toolModalHost') {
      host = document.querySelector('#transcription-modal-container') || document.querySelector('#toolModalHost');
    }
    if (!host) return;
    this.host = host;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    host.innerHTML = this.renderModal();
    this.attachListeners(host);
  }

  close(host) {
    this.operationId++;
    this.stopPreview();
    this.engine.cancelRecording();
    this.isRecording = false;
    this.isProcessing = false;
    this.isPreparing = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (host) host.innerHTML = '';
    this.host = null;
  }

  renderModal() {
    return `
      <div class="transcriber-modal-overlay" id="modal-audio-transcriber" role="dialog" aria-label="Transcripción de Audio a Acordes">
        <div class="transcriber-modal-card">
          <!-- CABECERA -->
          <div class="transcriber-header">
            <div class="transcriber-title-group">
              <span class="transcriber-badge">ANÁLISIS LOCAL DE AUDIO</span>
              <h2 class="transcriber-title">Transcripción de Audio a Acordes</h2>
              <p class="transcriber-subtitle">Estimación de acordes para revisar de oído. Las mezclas completas y la voz sola pueden dar resultados imprecisos.</p>
            </div>
            <button class="btn-close-transcriber" id="btnCloseTranscriber" aria-label="Cerrar Transcriptor">✕</button>
          </div>

          <!-- LIENZO DE VISUALIZACIÓN DE ONDA -->
          <div class="transcriber-wave-viewport">
            <canvas id="transcriptionWaveCanvas" class="transcription-wave-canvas" width="680" height="140"></canvas>
            <div class="transcriber-wave-overlay-info" id="waveStatusOverlay">
              <span class="wave-status-text" id="lblWaveStatus" role="status" aria-live="polite">${this.isRecording ? '🔴 Grabando idea...' : 'Listo para grabar o importar audio'}</span>
            </div>
          </div>

          <!-- CONTROLES DE CAPTURA -->
          <div class="transcriber-action-bar">
            <button class="btn-transcriber-rec ${this.isRecording ? 'recording' : ''}" id="btnToggleTranscribeRec">
              <span class="rec-pulsing-dot"></span>
              <span id="lblTranscribeRec">${this.isRecording ? 'Detener y Analizar' : '🎙️ Grabar con Micrófono'}</span>
            </button>

            <label class="btn-transcriber-upload" for="fileAudioUpload" id="lblAudioUpload" role="button" tabindex="0">
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
          <span>No se han detectado acordes con suficiente señal. Prueba una toma instrumental más clara.</span>
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
    card.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.close(container);
    });
    card.querySelector('#btnCloseTranscriber')?.focus();
    card.querySelector('#lblAudioUpload')?.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        card.querySelector('#fileAudioUpload').click();
      }
    });

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
    card.querySelector('#btnCopyChordPro')?.addEventListener('click', async () => {
      if (this.lastTranscription?.chordPro) {
        try {
          await navigator.clipboard.writeText(this.lastTranscription.chordPro);
          toast.show('Progresión ChordPro copiada al portapapeles', 'success');
        } catch {
          toast.show('No se pudo copiar al portapapeles.', 'warning');
        }
      }
    });
  }

  async _handleStartRecording(container) {
    if (this.isPreparing || this.isProcessing) return;
    const operationId = ++this.operationId;
    this.stopPreview();
    this.isPreparing = true;
    this._setBusy(container, true);
    try {
      const started = await this.engine.startLiveRecording();
      if (!started || operationId !== this.operationId) return;
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
      this._showError(container, err);
    } finally {
      if (operationId === this.operationId) {
        this.isPreparing = false;
        this._setBusy(container, false);
      }
    }
  }

  async _handleStopRecording(container) {
    if (this.isProcessing) return;
    const operationId = ++this.operationId;
    this.isProcessing = true;
    this.isRecording = false;
    this._setBusy(container, true);
    const progressBox = container.querySelector('#transcriberProgressBox');
    const status = container.querySelector('#lblWaveStatus');
    if (progressBox) progressBox.style.display = 'flex';
    if (status) status.textContent = 'Procesando espectrograma...';

    try {
      const result = await this.engine.stopLiveRecording();
      if (operationId !== this.operationId) return;
      if (result) {
        this.lastTranscription = result;
        this._updateResultsUI(container);
      }
    } catch (error) {
      if (operationId === this.operationId) this._showError(container, error);
    } finally {
      if (operationId === this.operationId) {
        this.isProcessing = false;
        this._setBusy(container, false);
        if (progressBox) progressBox.style.display = 'none';
      }
    }
  }

  async _handleFileUpload(file, container) {
    if (this.isRecording || this.isPreparing || this.isProcessing) return;
    const operationId = ++this.operationId;
    this.stopPreview();
    this.isProcessing = true;
    this._setBusy(container, true);
    const progressBox = container.querySelector('#transcriberProgressBox');
    if (progressBox) progressBox.style.display = 'flex';

    try {
      const result = await this.engine.transcribeAudioBlob(file);
      if (operationId !== this.operationId) return;
      if (progressBox) progressBox.style.display = 'none';
      if (result) {
        this.lastTranscription = result;
        this._updateResultsUI(container);
        toast.show(`Archivo procesado: ${result.chords.length} acordes detectados`, 'success');
      }
    } catch (err) {
      if (operationId === this.operationId) this._showError(container, err);
    } finally {
      if (operationId === this.operationId) {
        this.isProcessing = false;
        this._setBusy(container, false);
        if (progressBox) progressBox.style.display = 'none';
        const input = container.querySelector('#fileAudioUpload');
        if (input) input.value = '';
      }
    }
  }

  _updateResultsUI(container) {
    const hasChords = Boolean(this.lastTranscription?.chords.length);
    container.querySelectorAll('.transcription-export-bar button, #btnPlayTranscriptionPreview').forEach(button => {
      button.disabled = !hasChords;
    });
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
    if (!this.lastTranscription?.chords.length) return;

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
    if (!this.lastTranscription?.chords.length) return;

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

    try {
      await db.saveSong(record);
      toast.show('Canción guardada en Mis Tabs', 'success');
    } catch {
      toast.show('No se pudo guardar la transcripción. Revisa el espacio disponible.', 'error');
    }
  }

  _setBusy(container, busy) {
    const button = container.querySelector('#btnToggleTranscribeRec');
    if (button) button.disabled = busy;
    const input = container.querySelector('#fileAudioUpload');
    if (input) input.disabled = busy || this.isRecording;
    container.querySelector('#modal-audio-transcriber')?.setAttribute('aria-busy', String(busy));
    container.querySelector('#lblAudioUpload')?.setAttribute('aria-disabled', String(busy || this.isRecording));
  }

  _showError(container, error) {
    if (error.name === 'AbortError') return;
    const status = container.querySelector('#lblWaveStatus');
    if (status) status.textContent = error.message || 'No se pudo analizar el audio.';
    const label = container.querySelector('#lblTranscribeRec');
    if (label) label.textContent = 'Grabar con Micrófono';
    container.querySelector('#btnToggleTranscribeRec')?.classList.remove('recording');
  }

  destroy() {
    this.close(this.host);
    super.destroy();
  }

  _startWaveformLoop() {
    const draw = () => {
      if (!this.canvas?.isConnected) return;
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

        const analyser = this.isRecording ? this.engine.analyserNode : null;
        if (analyser && this.waveData?.length !== analyser.fftSize) this.waveData = new Float32Array(analyser.fftSize);
        if (analyser) analyser.getFloatTimeDomainData(this.waveData);
        const points = 128;
        const sliceWidth = width / points;
        let x = 0;

        for (let i = 0; i <= points; i++) {
          const sample = analyser ? this.waveData[Math.min(this.waveData.length - 1, Math.floor(i * this.waveData.length / points))] : 0;
          const y = height / 2 + sample * height * 0.45;
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
