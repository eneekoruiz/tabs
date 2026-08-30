/**
 * @file StemSeparatorTool.js
 * @description Modal y Mezclador Multipista de Separación de Stems en 4 Pistas (Voz, Batería, Bajo, Guitarra).
 * Estilo Moises Studio con medidores VU en tiempo real, faders de volumen, Mute y Solo.
 */

import { Component } from '../Component.js';
import { events } from '../../core/EventBus.js';
import { stemSeparatorEngine } from '../../audio/StemSeparatorEngine.js';
import { toast } from '../Toast.js';

export class StemSeparatorTool extends Component {
  constructor() {
    super(null);
    this.engine = stemSeparatorEngine;
    this.currentFile = null;
    this.progressPercent = 0;
    this.progressText = '';
    this.isProcessing = false;
    this.hasStems = false;
    this.initEvents();
  }

  initEvents() {
    events.on('stems:open', () => this.open('#stems-modal-container'));
  }

  open(targetContainerSelector = '#stems-modal-container') {
    let host = document.querySelector(targetContainerSelector);
    if (!host || host.offsetParent === null && targetContainerSelector === '#toolModalHost') {
      host = document.querySelector('#stems-modal-container') || document.querySelector('#toolModalHost');
    }
    if (!host) return;

    host.innerHTML = this.renderModal();
    this.attachListeners(host);
  }

  close(host) {
    this.engine.stopPlayback();
    if (host) host.innerHTML = '';
  }

  renderModal() {
    const isPlaying = this.engine.isPlaying;

    return `
      <div class="modal-stems-backdrop" role="dialog" aria-modal="true" aria-labelledby="stemsTitle">
        <div class="modal-stems-card" id="modal-stem-separator">
          <!-- Cabecera Studio -->
          <div class="stems-modal-header">
            <div class="stems-header-title-group">
              <div class="stems-badge-ai">NEURAL DSP · 4-TRACK ISOLATION</div>
              <h2 id="stemsTitle" class="stems-modal-title">🎛️ Stem Separator Pro (Moises AI Style)</h2>
              <p class="stems-modal-subtitle">Aísla o silencia la Voz, Batería, Bajo y Guitarras en cualquier archivo de audio de forma 100% offline.</p>
            </div>
            <button class="btn-close-stems" id="btnCloseStems" aria-label="Cerrar separador">✕</button>
          </div>

          <!-- Cuerpo Principal -->
          <div class="stems-modal-body">
            ${!this.hasStems && !this.isProcessing ? `
              <!-- Dropzone para importar audio -->
              <div class="stems-upload-zone" id="stemsDropzone">
                <div class="stems-upload-icon">🎵</div>
                <h3>Arrastra un archivo de audio o selecciónalo</h3>
                <p>Formatos soportados: MP3, WAV, M4A, OGG, FLAC (Hasta 20 MB)</p>
                <div class="stems-upload-actions">
                  <input type="file" id="stemsFileInput" accept="audio/*" style="display: none;">
                  <button class="btn-stems-select-file" id="btnSelectStemsFile">Seleccionar Archivo de Audio</button>
                  <button class="btn-stems-demo-file" id="btnLoadDemoStems">Cargar Pista Demo de Estudio</button>
                </div>
              </div>
            ` : ''}

            ${this.isProcessing ? `
              <!-- Barra de Progreso de Separación -->
              <div class="stems-processing-view">
                <div class="stems-spinner-ring"></div>
                <h3 class="stems-proc-title">Procesando Separación Espectral...</h3>
                <p class="stems-proc-step" id="lblStemsProcStep">${this.progressText || 'Iniciando descomposición armónico-percusiva...'}</p>
                <div class="stems-progress-track">
                  <div class="stems-progress-fill" id="stemsProgressFill" style="width: ${this.progressPercent}%;"></div>
                </div>
                <span class="stems-proc-percent" id="lblStemsProcPercent">${this.progressPercent}%</span>
              </div>
            ` : ''}

            ${this.hasStems ? `
              <!-- Mezclador de 4 Canales (Stems Mixer Console) -->
              <div class="stems-console-wrapper">
                <!-- Barra de Transporte -->
                <div class="stems-transport-bar">
                  <button class="btn-stems-play-pause" id="btnStemsPlayPause" aria-label="${isPlaying ? 'Pausar' : 'Reproducir'}">
                    ${isPlaying ? '⏸️ Pausa' : '▶️ Reproducir'}
                  </button>
                  <div class="stems-timeline-container">
                    <span class="stems-time-label" id="lblStemsCurrentTime">00:00</span>
                    <input type="range" id="stemsTimelineScrubber" min="0" max="${Math.round(this.engine.duration || 100)}" value="0" step="0.1" class="stems-timeline-slider">
                    <span class="stems-time-label" id="lblStemsTotalTime">${this._formatTime(this.engine.duration)}</span>
                  </div>
                </div>

                <!-- Parrilla de 4 Canales -->
                <div class="stems-channels-grid">
                  <!-- 1. Canal Voz (Vocals) -->
                  <div class="stem-channel-strip stem-channel-vocals" data-stem="vocals">
                    <div class="stem-channel-header">
                      <span class="stem-icon">🎤</span>
                      <strong class="stem-name">Voz</strong>
                    </div>
                    <div class="stem-meter-slot">
                      <div class="stem-vu-meter" id="meter-vocals" style="height: 0%;"></div>
                    </div>
                    <div class="stem-fader-slot">
                      <input type="range" class="stem-volume-fader" data-stem="vocals" min="0" max="1.5" step="0.05" value="${this.engine.trackVolumes.vocals}">
                      <span class="stem-vol-text" id="volText-vocals">${Math.round(this.engine.trackVolumes.vocals * 100)}%</span>
                    </div>
                    <div class="stem-channel-buttons">
                      <button class="btn-stem-mute ${this.engine.trackMutes.vocals ? 'active' : ''}" data-stem="vocals" aria-label="Silenciar Voz">M</button>
                      <button class="btn-stem-solo ${this.engine.trackSolos.vocals ? 'active' : ''}" data-stem="vocals" aria-label="Solo Voz">S</button>
                    </div>
                  </div>

                  <!-- 2. Canal Batería (Drums) -->
                  <div class="stem-channel-strip stem-channel-drums" data-stem="drums">
                    <div class="stem-channel-header">
                      <span class="stem-icon">🥁</span>
                      <strong class="stem-name">Batería</strong>
                    </div>
                    <div class="stem-meter-slot">
                      <div class="stem-vu-meter" id="meter-drums" style="height: 0%;"></div>
                    </div>
                    <div class="stem-fader-slot">
                      <input type="range" class="stem-volume-fader" data-stem="drums" min="0" max="1.5" step="0.05" value="${this.engine.trackVolumes.drums}">
                      <span class="stem-vol-text" id="volText-drums">${Math.round(this.engine.trackVolumes.drums * 100)}%</span>
                    </div>
                    <div class="stem-channel-buttons">
                      <button class="btn-stem-mute ${this.engine.trackMutes.drums ? 'active' : ''}" data-stem="drums" aria-label="Silenciar Batería">M</button>
                      <button class="btn-stem-solo ${this.engine.trackSolos.drums ? 'active' : ''}" data-stem="drums" aria-label="Solo Batería">S</button>
                    </div>
                  </div>

                  <!-- 3. Canal Bajo (Bass) -->
                  <div class="stem-channel-strip stem-channel-bass" data-stem="bass">
                    <div class="stem-channel-header">
                      <span class="stem-icon">🎸</span>
                      <strong class="stem-name">Bajo</strong>
                    </div>
                    <div class="stem-meter-slot">
                      <div class="stem-vu-meter" id="meter-bass" style="height: 0%;"></div>
                    </div>
                    <div class="stem-fader-slot">
                      <input type="range" class="stem-volume-fader" data-stem="bass" min="0" max="1.5" step="0.05" value="${this.engine.trackVolumes.bass}">
                      <span class="stem-vol-text" id="volText-bass">${Math.round(this.engine.trackVolumes.bass * 100)}%</span>
                    </div>
                    <div class="stem-channel-buttons">
                      <button class="btn-stem-mute ${this.engine.trackMutes.bass ? 'active' : ''}" data-stem="bass" aria-label="Silenciar Bajo">M</button>
                      <button class="btn-stem-solo ${this.engine.trackSolos.bass ? 'active' : ''}" data-stem="bass" aria-label="Solo Bajo">S</button>
                    </div>
                  </div>

                  <!-- 4. Canal Guitarras / Armónicos (Guitar) -->
                  <div class="stem-channel-strip stem-channel-guitar" data-stem="guitar">
                    <div class="stem-channel-header">
                      <span class="stem-icon">⚡</span>
                      <strong class="stem-name">Guitarra / Otros</strong>
                    </div>
                    <div class="stem-meter-slot">
                      <div class="stem-vu-meter" id="meter-guitar" style="height: 0%;"></div>
                    </div>
                    <div class="stem-fader-slot">
                      <input type="range" class="stem-volume-fader" data-stem="guitar" min="0" max="1.5" step="0.05" value="${this.engine.trackVolumes.guitar}">
                      <span class="stem-vol-text" id="volText-guitar">${Math.round(this.engine.trackVolumes.guitar * 100)}%</span>
                    </div>
                    <div class="stem-channel-buttons">
                      <button class="btn-stem-mute ${this.engine.trackMutes.guitar ? 'active' : ''}" data-stem="guitar" aria-label="Silenciar Guitarra">M</button>
                      <button class="btn-stem-solo ${this.engine.trackSolos.guitar ? 'active' : ''}" data-stem="guitar" aria-label="Solo Guitarra">S</button>
                    </div>
                  </div>
                </div>

                <!-- Acciones Rápidas de Músico -->
                <div class="stems-quick-presets">
                  <span class="preset-label">Preajustes Rápidos de Jam:</span>
                  <button class="btn-stem-preset" id="btnPresetMuteGuitar">🎸 Mute Guitarra (Toca tú el Solo)</button>
                  <button class="btn-stem-preset" id="btnPresetMuteVocals">🎤 Modo Karaoke (Solo Instrumental)</button>
                  <button class="btn-stem-preset" id="btnPresetSoloBassDrums">🥁 Solo Base Rítmica (Bajo + Batería)</button>
                  <button class="btn-stem-preset" id="btnPresetResetAll">🔄 Restablecer Todo</button>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Pie de Acciones -->
          <div class="stems-modal-footer">
            ${this.hasStems ? `
              <button class="btn-stems-action secondary" id="btnStemsExportWav">💾 Exportar Mezcla WAV</button>
              <button class="btn-stems-action secondary" id="btnStemsLoadAnother">📁 Cargar Otro Audio</button>
              <button class="btn-stems-action primary" id="btnStemsPlayWithSong">🎸 Abrir en Visor y Tocar Encima</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  attachListeners(container) {
    const card = container.querySelector('#modal-stem-separator');
    if (!card) return;

    // Cerrar
    card.querySelector('#btnCloseStems')?.addEventListener('click', () => {
      this.close(container);
    });

    // Subir archivo
    const fileInput = card.querySelector('#stemsFileInput');
    const selectBtn = card.querySelector('#btnSelectStemsFile');
    const demoBtn = card.querySelector('#btnLoadDemoStems');
    const dropzone = card.querySelector('#stemsDropzone');

    selectBtn?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this._processFile(e.target.files[0], container);
      }
    });

    demoBtn?.addEventListener('click', () => {
      this._generateDemoTrackAndProcess(container);
    });

    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this._processFile(e.dataTransfer.files[0], container);
        }
      });
    }

    // Controles de Transporte
    const playPauseBtn = card.querySelector('#btnStemsPlayPause');
    playPauseBtn?.addEventListener('click', () => {
      if (this.engine.isPlaying) {
        this.engine.pause();
        playPauseBtn.innerHTML = '▶️ Reproducir';
      } else {
        this.engine.play();
        playPauseBtn.innerHTML = '⏸️ Pausa';
      }
    });

    const scrubber = card.querySelector('#stemsTimelineScrubber');
    scrubber?.addEventListener('input', (e) => {
      const sec = parseFloat(e.target.value);
      this.engine.seek(sec);
    });

    // Faders de Volumen
    card.querySelectorAll('.stem-volume-fader').forEach(fader => {
      fader.addEventListener('input', (e) => {
        const stem = e.target.dataset.stem;
        const val = parseFloat(e.target.value);
        this.engine.setStemVolume(stem, val);
        const textEl = card.querySelector(`#volText-${stem}`);
        if (textEl) textEl.textContent = `${Math.round(val * 100)}%`;
      });
    });

    // Botones de Mute
    card.querySelectorAll('.btn-stem-mute').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stem = e.target.dataset.stem;
        const newState = !this.engine.trackMutes[stem];
        this.engine.setStemMute(stem, newState);
        btn.classList.toggle('active', newState);
      });
    });

    // Botones de Solo
    card.querySelectorAll('.btn-stem-solo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stem = e.target.dataset.stem;
        const newState = !this.engine.trackSolos[stem];
        this.engine.setStemSolo(stem, newState);
        card.querySelectorAll('.btn-stem-solo').forEach(b => {
          b.classList.toggle('active', this.engine.trackSolos[b.dataset.stem]);
        });
      });
    });

    // Presets rápidos
    card.querySelector('#btnPresetMuteGuitar')?.addEventListener('click', () => {
      this.engine.setStemMute('guitar', true);
      this.engine.setStemMute('vocals', false);
      this.engine.setStemMute('drums', false);
      this.engine.setStemMute('bass', false);
      this.open('#stems-modal-container');
      toast.show('Guitarra silenciada: ¡Toca tú el Solo!', 'info');
    });

    card.querySelector('#btnPresetMuteVocals')?.addEventListener('click', () => {
      this.engine.setStemMute('vocals', true);
      this.engine.setStemMute('guitar', false);
      this.engine.setStemMute('drums', false);
      this.engine.setStemMute('bass', false);
      this.open('#stems-modal-container');
      toast.show('Voz silenciada: Modo Backing Track / Karaoke activo', 'info');
    });

    card.querySelector('#btnPresetSoloBassDrums')?.addEventListener('click', () => {
      this.engine.setStemMute('vocals', true);
      this.engine.setStemMute('guitar', true);
      this.engine.setStemMute('drums', false);
      this.engine.setStemMute('bass', false);
      this.open('#stems-modal-container');
      toast.show('Base rítmica aislada (Batería + Bajo)', 'info');
    });

    card.querySelector('#btnPresetResetAll')?.addEventListener('click', () => {
      ['vocals', 'drums', 'bass', 'guitar'].forEach(name => {
        this.engine.setStemVolume(name, 1.0);
        this.engine.setStemMute(name, false);
        this.engine.setStemSolo(name, false);
      });
      this.open('#stems-modal-container');
      toast.show('Mezclador restablecido a balance original', 'info');
    });

    // Exportar WAV
    card.querySelector('#btnStemsExportWav')?.addEventListener('click', () => {
      const blob = this.engine.exportToWav('mix');
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stems_mix_${Date.now()}.wav`;
        a.click();
        URL.revokeObjectURL(url);
        toast.show('Mezcla de Stems descargada con éxito', 'success');
      }
    });

    // Cargar otro
    card.querySelector('#btnStemsLoadAnother')?.addEventListener('click', () => {
      this.engine.stopPlayback();
      this.hasStems = false;
      this.open('#stems-modal-container');
    });

    // Abrir en visor
    card.querySelector('#btnStemsPlayWithSong')?.addEventListener('click', () => {
      this.close(container);
      events.emit('ui:switchTab', 'player');
      toast.show('Pista de acompañamiento lista para ensayar', 'success');
    });

    // Escuchar medidores y tiempo en tiempo real
    events.on('stems:timeUpdate', ({ currentTime, duration, levels }) => {
      const curTimeEl = card.querySelector('#lblStemsCurrentTime');
      const scrub = card.querySelector('#stemsTimelineScrubber');
      if (curTimeEl) curTimeEl.textContent = this._formatTime(currentTime);
      if (scrub && !scrub.matches(':active')) scrub.value = currentTime;

      if (levels) {
        Object.entries(levels).forEach(([name, lvl]) => {
          const meterEl = card.querySelector(`#meter-${name}`);
          if (meterEl) meterEl.style.height = `${lvl}%`;
        });
      }
    });
  }

  async _processFile(file, container) {
    this.isProcessing = true;
    this.hasStems = false;
    this.open('#stems-modal-container');

    try {
      await this.engine.separateStems(file, (percent, text) => {
        this.progressPercent = percent;
        this.progressText = text;
        const fill = document.querySelector('#stemsProgressFill');
        const pText = document.querySelector('#lblStemsProcPercent');
        const sText = document.querySelector('#lblStemsProcStep');
        if (fill) fill.style.width = `${percent}%`;
        if (pText) pText.textContent = `${percent}%`;
        if (sText) sText.textContent = text;
      });

      this.isProcessing = false;
      this.hasStems = true;
      this.open('#stems-modal-container');
      toast.show('Pistas separadas en 4 canales con éxito', 'success');
    } catch (err) {
      this.isProcessing = false;
      this.open('#stems-modal-container');
      toast.show('Error al procesar el archivo: ' + err.message, 'error');
    }
  }

  async _generateDemoTrackAndProcess(container) {
    // Generar un AudioBuffer polifónico de demo con bajo, acordes de guitarra y percusión sintética
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const duration = 12; // 12 seg
    const sampleRate = ctx.sampleRate;
    const numSamples = duration * sampleRate;
    const buffer = ctx.createBuffer(2, numSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const chords = [
      [261.63, 329.63, 392.00], // C
      [196.00, 246.94, 293.66], // G
      [220.00, 261.63, 329.63], // Am
      [174.61, 220.00, 261.63]  // F
    ];

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const chordIdx = Math.floor(t / 3) % chords.length;
      const chordFreqs = chords[chordIdx];

      // Bajo
      const bassFreq = chordFreqs[0] / 2;
      const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.4;

      // Guitarra acústica estéreo
      let guitarL = 0, guitarR = 0;
      chordFreqs.forEach((freq, idx) => {
        const strum = Math.sin(2 * Math.PI * freq * t) * Math.exp(-((t % 0.75) * 4));
        if (idx % 2 === 0) guitarL += strum * 0.2;
        else guitarR += strum * 0.2;
      });

      // Batería sintética (Kick + Snare)
      const beat = t % 1.0;
      let drum = 0;
      if (beat < 0.15) drum += Math.sin(2 * Math.PI * 60 * (1 - beat / 0.15) * t) * 0.6; // Kick
      if (beat > 0.5 && beat < 0.65) drum += (Math.random() * 2 - 1) * Math.exp(-(beat - 0.5) * 20) * 0.4; // Snare

      // Voz melódica central
      const vocalFreq = chordFreqs[1] * (1 + 0.01 * Math.sin(2 * Math.PI * 5 * t));
      const vocal = Math.sin(2 * Math.PI * vocalFreq * t) * 0.35;

      left[i] = (bass + guitarL + drum * 0.8 + vocal * 0.5);
      right[i] = (bass + guitarR + drum * 0.8 + vocal * 0.5);
    }

    const wavBlob = this.engine._audioBufferToWav(buffer);
    await this._processFile(wavBlob, container);
  }

  _formatTime(sec) {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const remSec = s % 60;
    return `${m.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;
  }
}

export const stemSeparatorTool = new StemSeparatorTool();
export default stemSeparatorTool;
