/**
 * @file SmartBandTool.js
 * @description Interfaz de Acompañamiento Generativo IA (The Smart Band).
 * Permite seleccionar estilos de banda (Rock, Jazz, Funk, Pop), progresiones armónicas,
 * mezclar pistas de Batería y Bajo y sincronizar el tempo.
 */

import { Component } from '../Component.js';
import { events } from '../../core/EventBus.js';
import { state } from '../../core/State.js';
import { smartBandEngine } from '../../audio/SmartBandEngine.js';
import { toast } from '../Toast.js';

export class SmartBandTool extends Component {
  constructor() {
    super(null);
    this.engine = smartBandEngine;
    this.initEvents();
  }

  initEvents() {
    events.on('smartBand:open', () => this.open('#smart-band-modal-container'));
  }

  open(targetContainerSelector = '#smart-band-modal-container') {
    let host = document.querySelector(targetContainerSelector);
    if (!host || host.offsetParent === null && targetContainerSelector === '#toolModalHost') {
      host = document.querySelector('#smart-band-modal-container') || document.querySelector('#toolModalHost');
    }
    if (!host) return;

    this.currentHost = targetContainerSelector;
    host.innerHTML = this.renderModal();
    this.attachListeners(host);
  }

  close(host) {
    this.engine.stop();
    if (host) host.innerHTML = '';
  }

  renderModal() {
    const isPlaying = this.engine.isPlaying;
    const style = this.engine.style;
    const bpm = this.engine.bpm;
    const chords = this.engine.chordProgression;
    const currentSong = state.get('activeSong');

    return `
      <div class="modal-smartband-backdrop" role="dialog" aria-modal="true" aria-labelledby="smartBandTitle">
        <div class="modal-smartband-card" id="modal-smart-band">
          <!-- Cabecera -->
          <div class="smartband-modal-header">
            <div class="smartband-title-group">
              <div class="smartband-badge">GENERATIVE AI JAM · LIVE WEB AUDIO DSP</div>
              <h2 id="smartBandTitle" class="smartband-modal-title">🎷 The Smart Band</h2>
              <p class="smartband-modal-subtitle">Tu banda de acompañamiento virtual en vivo: Batería y Bajo generativos sincronizados a tus acordes.</p>
            </div>
            <button class="btn-close-smartband" id="btnCloseSmartBand" aria-label="Cerrar Smart Band">✕</button>
          </div>

          <!-- Cuerpo -->
          <div class="smartband-modal-body">
            <!-- 1. Progresión Armónica Activa -->
            <div class="smartband-section-card">
              <div class="section-card-header">
                <h3 class="section-title">1. Progresión de Acordes de la Canción</h3>
                <span class="song-ref-badge">${currentSong?.title || 'Jam Libre'}</span>
              </div>
              <div class="chords-chips-row" id="smartBandChordsRow">
                ${chords.map((chord, idx) => `
                  <div class="chord-chip ${idx === this.engine.currentChordIndex ? 'active' : ''}" data-index="${idx}">
                    <span class="chord-name">${chord}</span>
                    <span class="chord-sub">Compás ${idx + 1}</span>
                  </div>
                `).join('')}
              </div>
              <div class="quick-progressions-row">
                <span class="quick-lbl">Presets Populares:</span>
                <button class="btn-prog-preset" data-prog="Am,F,C,G">Am - F - C - G (Pop Épico)</button>
                <button class="btn-prog-preset" data-prog="C,G,Am,F">C - G - Am - F (4 Chords)</button>
                <button class="btn-prog-preset" data-prog="Dm7,G7,Cmaj7,A7">Dm7 - G7 - Cmaj7 (Jazz)</button>
                <button class="btn-prog-preset" data-prog="E7,A7,B7,E7">E7 - A7 - B7 (Blues Rock)</button>
              </div>
            </div>

            <!-- 2. Selector de Estilo de la Banda -->
            <div class="smartband-section-card">
              <h3 class="section-title">2. Estilo de Acompañamiento Musical</h3>
              <div class="styles-grid">
                <button class="btn-style-card ${style === 'rock' ? 'active' : ''}" data-style="rock">
                  <span class="style-icon">🎸</span>
                  <div class="style-info">
                    <strong>Rock Power</strong>
                    <span>Driving 8th Bass + Solid Rock Beat</span>
                  </div>
                </button>

                <button class="btn-style-card ${style === 'jazz' ? 'active' : ''}" data-style="jazz">
                  <span class="style-icon">🎷</span>
                  <div class="style-info">
                    <strong>Jazz Swing</strong>
                    <span>Walking Bass + Swing Ride Cymbal</span>
                  </div>
                </button>

                <button class="btn-style-card ${style === 'funk' ? 'active' : ''}" data-style="funk">
                  <span class="style-icon">🕺</span>
                  <div class="style-info">
                    <strong>Funk Groove</strong>
                    <span>Slap Bass + 16th Ghost Notes</span>
                  </div>
                </button>

                <button class="btn-style-card ${style === 'pop' ? 'active' : ''}" data-style="pop">
                  <span class="style-icon">🎹</span>
                  <div class="style-info">
                    <strong>Pop Ballad</strong>
                    <span>Arpeggiated Bass + Half-Time Beat</span>
                  </div>
                </button>

                <button class="btn-style-card ${style === 'metronome' ? 'active' : ''}" data-style="metronome">
                  <span class="style-icon">⏱️</span>
                  <div class="style-info">
                    <strong>Click Dinámico</strong>
                    <span>Metrónomo de Estudio con Acento</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- 3. Mezclador de la Banda y Tempo -->
            <div class="smartband-mixer-row">
              <!-- Batería -->
              <div class="band-channel-box">
                <div class="channel-meta">
                  <span class="channel-name">🥁 BATERÍA</span>
                  <button class="btn-chan-mute ${this.engine.drumsMuted ? 'active' : ''}" id="btnMuteDrums">M</button>
                </div>
                <input type="range" class="chan-slider" id="rngDrumsVol" min="0" max="1" step="0.05" value="${this.engine.drumsVolume}">
                <span class="chan-vol-lbl" id="lblDrumsVol">${Math.round(this.engine.drumsVolume * 100)}%</span>
              </div>

              <!-- Bajo -->
              <div class="band-channel-box">
                <div class="channel-meta">
                  <span class="channel-name">🎸 BAJO</span>
                  <button class="btn-chan-mute ${this.engine.bassMuted ? 'active' : ''}" id="btnMuteBass">M</button>
                </div>
                <input type="range" class="chan-slider" id="rngBassVol" min="0" max="1" step="0.05" value="${this.engine.bassVolume}">
                <span class="chan-vol-lbl" id="lblBassVol">${Math.round(this.engine.bassVolume * 100)}%</span>
              </div>

              <!-- Tempo y Pulso -->
              <div class="band-tempo-box">
                <div class="tempo-header">
                  <span class="tempo-name">TEMPO BPM</span>
                  <span class="tempo-val" id="lblSmartBandBpm">${bpm}</span>
                </div>
                <input type="range" class="tempo-slider" id="rngSmartBandBpm" min="50" max="220" value="${bpm}">
                <div class="beat-indicators-row">
                  <div class="beat-dot" id="beatDot-1"></div>
                  <div class="beat-dot" id="beatDot-2"></div>
                  <div class="beat-dot" id="beatDot-3"></div>
                  <div class="beat-dot" id="beatDot-4"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Pie de Acciones -->
          <div class="smartband-modal-footer">
            <button class="btn-smartband-action secondary" id="btnSmartBandStop">Detener</button>
            <button class="btn-smartband-action primary ${isPlaying ? 'is-playing' : ''}" id="btnToggleSmartBand">
              ${isPlaying ? '⏸️ Pausar Banda' : '▶️ Iniciar Smart Band'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  attachListeners(container) {
    const card = container.querySelector('#modal-smart-band');
    if (!card) return;

    // Cerrar
    card.querySelector('#btnCloseSmartBand')?.addEventListener('click', () => this.close(container));

    // Play / Pause
    const toggleBtn = card.querySelector('#btnToggleSmartBand');
    toggleBtn?.addEventListener('click', () => {
      const isNowPlaying = this.engine.toggle();
      this.open(this.currentHost || '#smart-band-modal-container');
      if (isNowPlaying) {
        toast.show(`¡The Smart Band tocando en estilo ${this.engine.style.toUpperCase()} a ${this.engine.bpm} BPM!`, 'success');
      }
    });

    card.querySelector('#btnSmartBandStop')?.addEventListener('click', () => {
      this.engine.stop();
      this.open(this.currentHost || '#smart-band-modal-container');
    });

    // Presets de Progresión
    card.querySelectorAll('.btn-prog-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const prog = e.target.dataset.prog.split(',');
        this.engine.setProgression(prog);
        this.open(this.currentHost || '#smart-band-modal-container');
        toast.show(`Progresión cargada: ${prog.join(' - ')}`, 'info');
      });
    });

    // Selector de Estilo
    card.querySelectorAll('.btn-style-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cardBtn = e.target.closest('.btn-style-card');
        const st = cardBtn.dataset.style;
        this.engine.setStyle(st);
        this.open(this.currentHost || '#smart-band-modal-container');
      });
    });

    // Mutes
    card.querySelector('#btnMuteDrums')?.addEventListener('click', () => {
      const muted = this.engine.toggleDrumsMute();
      card.querySelector('#btnMuteDrums').classList.toggle('active', muted);
    });

    card.querySelector('#btnMuteBass')?.addEventListener('click', () => {
      const muted = this.engine.toggleBassMute();
      card.querySelector('#btnMuteBass').classList.toggle('active', muted);
    });

    // Sliders de Volumen
    card.querySelector('#rngDrumsVol')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.engine.setDrumsVolume(val);
      const lbl = card.querySelector('#lblDrumsVol');
      if (lbl) lbl.textContent = `${Math.round(val * 100)}%`;
    });

    card.querySelector('#rngBassVol')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.engine.setBassVolume(val);
      const lbl = card.querySelector('#lblBassVol');
      if (lbl) lbl.textContent = `${Math.round(val * 100)}%`;
    });

    // Slider de Tempo
    card.querySelector('#rngSmartBandBpm')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      this.engine.setTempo(val);
      const lbl = card.querySelector('#lblSmartBandBpm');
      if (lbl) lbl.textContent = `${val}`;
    });

    // Escuchar pulso y actualizar dots
    events.on('smartBand:step', ({ step, isQuarterBeat, beatNumber }) => {
      if (isQuarterBeat) {
        for (let i = 1; i <= 4; i++) {
          const dot = card.querySelector(`#beatDot-${i}`);
          if (dot) dot.classList.toggle('active', i === beatNumber);
        }
      }
    });
  }
}

export const smartBandTool = new SmartBandTool();
export default smartBandTool;
