import { escapeHTML } from '../../utils/sanitize.js';
/**
 * @file BandRoomTool.js
 * @description Demo local de controles y cursores compartidos entre pestañas.
 * Usa BroadcastChannel en el mismo navegador y origen; no transmite audio.
 */

import { Component } from '../Component.js';
import { events } from '../../core/EventBus.js';
import { bandRoomEngine } from '../../net/BandRoomEngine.js';
import { toast } from '../Toast.js';

export class BandRoomTool extends Component {
  constructor() {
    super(null);
    this.engine = bandRoomEngine;
    this.initEvents();
  }

  initEvents() {
    events.on('bandRoom:open', () => this.open('#bandroom-modal-container'));
  }

  open(targetContainerSelector = '#bandroom-modal-container') {
    let host = document.querySelector(targetContainerSelector);
    if (!host || host.offsetParent === null && targetContainerSelector === '#toolModalHost') {
      host = document.querySelector('#bandroom-modal-container') || document.querySelector('#toolModalHost');
    }
    if (!host) return;

    this.currentHost = targetContainerSelector;
    host.innerHTML = this.renderModal();
    this.attachListeners(host);
  }

  close(host) {
    if (host) host.innerHTML = '';
  }

  renderModal() {
    const isConnected = this.engine.isConnected;
    const roomId = this.engine.roomId;
    const isHost = this.engine.isHost;
    const peers = Array.from(this.engine.remotePeersState.values());

    return `
      <div class="modal-bandroom-backdrop" role="dialog" aria-modal="true" aria-labelledby="bandRoomTitle">
        <div class="modal-bandroom-card" id="modal-band-room">
          <!-- Header -->
          <div class="bandroom-header">
            <div class="bandroom-title-group">
              <span class="bandroom-badge">DEMO LOCAL · PESTAÑAS DEL MISMO NAVEGADOR</span>
              <h2 id="bandRoomTitle" class="bandroom-title">👥 BandRoom entre pestañas</h2>
              <p class="bandroom-subtitle">Comparte controles de reproducción y cursores entre pestañas de esta aplicación en el mismo navegador. No conecta equipos remotos ni transmite audio.</p>
            </div>
            <button class="btn-close-bandroom" id="btnCloseBandRoom" aria-label="Cerrar BandRoom">✕</button>
          </div>

          <!-- Body -->
          <div class="bandroom-body">
            ${!isConnected ? `
              <!-- Pantalla de Conexión a Sala -->
              <div class="bandroom-setup-grid">
                <div class="setup-box">
                  <h3>👑 Crear Sala Local (Anfitrión)</h3>
                  <p>Abre otra pestaña de esta aplicación y usa el código para probar los controles y cursores compartidos.</p>
                  <button class="btn-bandroom-action primary" id="btnCreateRoom">Crear Sala Local</button>
                </div>

                <div class="setup-box">
                  <h3>🎸 Unirme a una Sala Existente</h3>
                  <p>Introduce el código de la sala abierta en otra pestaña de este navegador.</p>
                  <div class="join-input-row">
                    <input type="text" class="room-code-input" id="txtRoomCodeInput" aria-label="Código de sala local" placeholder="Ej: BAND-4821" maxlength="10">
                    <button class="btn-bandroom-action secondary" id="btnJoinRoom">Unirse</button>
                  </div>
                </div>
              </div>
            ` : `
              <!-- Sala Activa -->
              <div class="bandroom-active-status">
                <div class="active-room-header">
                  <div class="room-code-display">
                    <span class="code-lbl">CÓDIGO DE SALA:</span>
                    <strong class="code-val" id="lblRoomIdCode">${roomId}</strong>
                  </div>
                  <span class="host-badge">${isHost ? '👑 Eres el Anfitrión' : '👥 Miembro de la Banda'}</span>
                  <button class="btn-bandroom-action danger" id="btnLeaveRoom">Abandonar Sala</button>
                </div>

                <div class="peers-list-section">
                  <h4 class="peers-title">Miembros Conectados en Tiempo Real (${peers.length + 1}):</h4>
                  <div class="peers-grid">
                    <!-- Tu propio avatar -->
                    <div class="peer-avatar-card self">
                      <div class="avatar-circle" style="background: ${this.engine.userColor};">${escapeHTML(this.engine.userName.slice(0, 2))}</div>
                      <div class="peer-meta">
                        <strong>${escapeHTML(this.engine.userName)} (Tú)</strong>
                        <span>Compás Actual: <em class="peer-bar-num">1</em></span>
                      </div>
                    </div>

                    <!-- Avatares de compañeros -->
                    ${peers.map(p => `
                      <div class="peer-avatar-card">
                        <div class="avatar-circle" style="background: ${/^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#555555'};">${escapeHTML(p.name.slice(0, 2))}</div>
                        <div class="peer-meta">
                          <strong>${escapeHTML(p.name)}</strong>
                          <span>Compás Actual: <em class="peer-bar-num">${p.currentBar || 1}</em></span>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  attachListeners(container) {
    const card = container.querySelector('#modal-band-room');
    if (!card) return;

    card.querySelector('#btnCloseBandRoom')?.addEventListener('click', () => this.close(container));

    // Crear Sala
    card.querySelector('#btnCreateRoom')?.addEventListener('click', async () => {
      try {
        const id = await this.engine.createRoom();
        toast.show(`Sala local creada: usa ${id} en otra pestaña`, 'success');
        this.open(this.currentHost || '#bandroom-modal-container');
      } catch (e) {
        toast.show('Error al crear sala: ' + e.message, 'error');
      }
    });

    // Unirse a Sala
    card.querySelector('#btnJoinRoom')?.addEventListener('click', async () => {
      const code = card.querySelector('#txtRoomCodeInput')?.value;
      if (!code) {
        toast.show('Introduce un código de sala válido', 'warning');
        return;
      }
      try {
        await this.engine.joinRoom(code);
        toast.show(`¡Conectado a la sala ${code.toUpperCase()}!`, 'success');
        this.open(this.currentHost || '#bandroom-modal-container');
      } catch (e) {
        toast.show('Error al unirse: ' + e.message, 'error');
      }
    });

    // Abandonar Sala
    card.querySelector('#btnLeaveRoom')?.addEventListener('click', () => {
      this.engine.leaveRoom();
      toast.show('Has abandonado la sala', 'info');
      this.open(this.currentHost || '#bandroom-modal-container');
    });
  }
}

export const bandRoomTool = new BandRoomTool();
export default bandRoomTool;
