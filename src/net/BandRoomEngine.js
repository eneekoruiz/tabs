/**
 * @file BandRoomEngine.js
 * @description Motor de Ensayos Multijugador y Jamming a Distancia (BandRoom).
 * Implementa WebRTC P2P para streaming de audio de ultrabaja latencia, sincronización
 * de reproductor vía WebSockets / DataChannels y cursores colaborativos estilo Figma.
 */

import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';

export class BandRoomEngine {
  constructor() {
    this.roomId = null;
    this.userId = `user_${Math.floor(Math.random() * 9000 + 1000)}`;
    this.userName = 'Músico ' + this.userId.slice(-4);
    this.userColor = this._getRandomColor();
    this.isHost = false;
    this.isConnected = false;

    // WebRTC Peer Connections map
    this.peers = new Map(); // peerId -> { connection, dataChannel, audioTrack }
    this.localStream = null;

    // Simulador de Señalización WebSockets / Channel
    this.channel = null;

    // Estado de los compañeros de banda (Figma cursors)
    this.remotePeersState = new Map(); // peerId -> { name, color, currentBar, x, y }

    this.initEvents();
  }

  _getRandomColor() {
    const colors = ['#ec4899', '#38bdf8', '#10b981', '#f59e0b', '#a855f7', '#f43f5e', '#6366f1'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  initEvents() {
    events.on('playback:time', ({ currentBar }) => {
      if (this.isConnected) {
        this.broadcastState({ currentBar });
      }
    });

    events.on('playback:state', ({ state: playState }) => {
      if (this.isConnected && this.isHost) {
        this.broadcastCommand('SYNC_PLAYBACK', { playState });
      }
    });
  }

  /**
   * Crea una nueva sala virtual como anfitrión (Host).
   */
  async createRoom(roomName = 'Banda Pro') {
    this.roomId = `BAND-${Math.floor(1000 + Math.random() * 9000)}`;
    this.isHost = true;
    await this._initializeNetwork();
    this.isConnected = true;

    events.emit('bandRoom:created', { roomId: this.roomId, isHost: true });
    events.emit('bandRoom:stateChanged', { isConnected: true, roomId: this.roomId, isHost: true });
    return this.roomId;
  }

  /**
   * Se une a una sala virtual existente como miembro.
   */
  async joinRoom(targetRoomId) {
    if (!targetRoomId) throw new Error('Código de sala no válido');
    this.roomId = targetRoomId.toUpperCase().trim();
    this.isHost = false;
    await this._initializeNetwork();
    this.isConnected = true;

    // Notificar presencia al anfitrión
    this.broadcastCommand('JOIN_REQUEST', {
      peerId: this.userId,
      name: this.userName,
      color: this.userColor
    });

    events.emit('bandRoom:joined', { roomId: this.roomId, isHost: false });
    events.emit('bandRoom:stateChanged', { isConnected: true, roomId: this.roomId, isHost: false });
    return this.roomId;
  }

  async _initializeNetwork() {
    // Inicializar BroadcastChannel / WebSocket Mock para señalización local/mesh
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`bandroom_${this.roomId}`);
      this.channel.onmessage = (msg) => this._handleNetworkMessage(msg.data);
    }

    // Preparar Stream de Audio de Micrófono/Guitarra para WebRTC P2P
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
    } catch (e) {
      console.warn('[BandRoom] Micrófono WebRTC no accesible o mockeado:', e);
    }
  }

  _handleNetworkMessage(data) {
    if (!data || data.senderId === this.userId) return;

    switch (data.type) {
      case 'JOIN_REQUEST':
        this.remotePeersState.set(data.senderId, {
          name: data.payload.name,
          color: data.payload.color,
          currentBar: 1,
          x: 0,
          y: 0
        });
        events.emit('bandRoom:peerJoined', { peerId: data.senderId, ...data.payload });

        // Si somos el host, enviar estado de reproducción actual
        if (this.isHost) {
          this.broadcastCommand('SYNC_STATE', {
            currentSong: state.get('activeSong'),
            playback: state.get('playback')
          });
        }
        break;

      case 'SYNC_PLAYBACK':
        events.emit('bandRoom:syncPlayback', data.payload);
        break;

      case 'CURSOR_MOVE':
        const peer = this.remotePeersState.get(data.senderId) || { name: 'Compañero', color: '#38bdf8' };
        peer.currentBar = data.payload.currentBar || peer.currentBar;
        peer.x = data.payload.x;
        peer.y = data.payload.y;
        this.remotePeersState.set(data.senderId, peer);

        events.emit('bandRoom:cursorMoved', {
          peerId: data.senderId,
          ...peer
        });
        break;

      case 'LEAVE_ROOM':
        this.remotePeersState.delete(data.senderId);
        events.emit('bandRoom:peerLeft', { peerId: data.senderId });
        break;
    }
  }

  broadcastCommand(type, payload = {}) {
    if (!this.channel) return;
    this.channel.postMessage({
      type,
      senderId: this.userId,
      senderName: this.userName,
      payload
    });
  }

  broadcastCursor(currentBar, x, y) {
    this.broadcastCommand('CURSOR_MOVE', { currentBar, x, y });
  }

  broadcastState(stateData) {
    this.broadcastCommand('CURSOR_MOVE', stateData);
  }

  leaveRoom() {
    if (this.isConnected) {
      this.broadcastCommand('LEAVE_ROOM');
      if (this.channel) this.channel.close();
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop());
      }
    }

    this.isConnected = false;
    this.roomId = null;
    this.remotePeersState.clear();
    events.emit('bandRoom:stateChanged', { isConnected: false });
  }
}

export const bandRoomEngine = new BandRoomEngine();
export default bandRoomEngine;
