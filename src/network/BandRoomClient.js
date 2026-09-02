/**
 * @file BandRoomClient.js
 * @description Cliente WebRTC P2P para ensayos multijugador y sincronización sub-milisegundo.
 */

import { events } from '../core/EventBus.js';

export class BandRoomClient {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.isConnected = false;
    this.roomId = null;
    this.isHost = false;
  }

  /**
   * Crea una nueva sala de ensayo.
   * @returns {Promise<string>} roomId o un offer SDP para compartir.
   */
  async createRoom() {
    this.isHost = true;
    this._setupPeerConnection();
    
    this.dataChannel = this.peerConnection.createDataChannel('bandroom-sync');
    this._setupDataChannel();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // En un sistema real, esto iría a un servidor de señalización (Signaling Server)
    // Para P2P puro sin servidor, devolvemos el SDP (simulando roomId)
    const encodedOffer = btoa(JSON.stringify(this.peerConnection.localDescription));
    this.roomId = encodedOffer;
    return encodedOffer;
  }

  /**
   * Se une a una sala existente usando el offer SDP.
   * @param {string} encodedOffer 
   */
  async joinRoom(encodedOffer) {
    this.isHost = false;
    this._setupPeerConnection();

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this._setupDataChannel();
    };

    const offer = JSON.parse(atob(encodedOffer));
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    const encodedAnswer = btoa(JSON.stringify(this.peerConnection.localDescription));
    return encodedAnswer; // Debe ser devuelto al host
  }

  /**
   * El host recibe el answer del invitado.
   * @param {string} encodedAnswer 
   */
  async acceptGuest(encodedAnswer) {
    if (!this.isHost) return;
    const answer = JSON.parse(atob(encodedAnswer));
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  _setupPeerConnection() {
    // Servidores STUN públicos de Google para NAT traversal
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    this.peerConnection = new RTCPeerConnection(configuration);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Enviar a servidor de señalización.
        // Omitido en este mock/arquitectura base.
        console.log('[BandRoom] Nuevo ICE Candidate generado.');
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log(`[BandRoom] Estado conexión: ${this.peerConnection.connectionState}`);
      if (this.peerConnection.connectionState === 'connected') {
        this.isConnected = true;
        events.emit('bandroom:connected');
      } else if (this.peerConnection.connectionState === 'disconnected') {
        this.isConnected = false;
        events.emit('bandroom:disconnected');
      }
    };
  }

  _setupDataChannel() {
    this.dataChannel.onopen = () => {
      console.log('[BandRoom] DataChannel abierto.');
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleIncomingMessage(msg);
      } catch (e) {
        console.error('[BandRoom] Error al parsear mensaje P2P', e);
      }
    };
  }

  _handleIncomingMessage(msg) {
    switch (msg.type) {
      case 'SYNC_SCROLL':
        events.emit('ui:syncScroll', msg.payload);
        break;
      case 'SYNC_METRONOME':
        events.emit('metronome:sync', msg.payload);
        break;
      case 'SYNC_PLAY':
        events.emit('song:play', msg.payload);
        break;
      default:
        console.warn('[BandRoom] Mensaje desconocido:', msg);
    }
  }

  /**
   * Envía un evento a todos los peers conectados en la sala.
   * @param {string} type 
   * @param {Object} payload 
   */
  broadcast(type, payload) {
    if (!this.isConnected || !this.dataChannel || this.dataChannel.readyState !== 'open') return;
    this.dataChannel.send(JSON.stringify({ type, payload, timestamp: performance.now() }));
  }

  disconnect() {
    if (this.dataChannel) this.dataChannel.close();
    if (this.peerConnection) this.peerConnection.close();
    this.isConnected = false;
    events.emit('bandroom:disconnected');
  }
}

export const bandRoomClient = new BandRoomClient();
