/**
 * @file GigRecorder.js
 * @description Grabador de Ensayos y Actuaciones en Directo (Studio & Stage Takes):
 * - Captura de audio de alta fidelidad con Web Audio & MediaRecorder.
 * - Temporizador en tiempo real con indicador pulsante.
 * - Generación de Blob de audio para descarga (.webm / .wav).
 * - Almacenamiento local de tomas y ensayos en IndexedDB.
 */

import { events } from '../core/EventBus.js';
import { db } from '../data/Database.js';
import { toast } from '../ui/Toast.js';

export class GigRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.startTime = 0;
    this.timerInterval = null;
    this.currentDuration = 0;
    this.latestRecordingBlob = null;
    this.latestAudioUrl = null;
  }

  async startRecording(songMeta = {}) {
    if (this.isRecording) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });

      this.audioChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.latestRecordingBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        if (this.latestAudioUrl) {
          URL.revokeObjectURL(this.latestAudioUrl);
        }
        this.latestAudioUrl = URL.createObjectURL(this.latestRecordingBlob);

        events.emit('recorder:finished', {
          blob: this.latestRecordingBlob,
          url: this.latestAudioUrl,
          duration: this.currentDuration,
          songMeta
        });
      };

      this.mediaRecorder.start(250);
      this.isRecording = true;
      this.startTime = Date.now();
      this.currentDuration = 0;

      this.timerInterval = setInterval(() => {
        this.currentDuration = Math.floor((Date.now() - this.startTime) / 1000);
        events.emit('recorder:tick', { duration: this.currentDuration, formatted: this.formatTime(this.currentDuration) });
      }, 1000);

      events.emit('recorder:started', { songMeta });
      toast.show('🎙️ Grabando ensayo en alta fidelidad...', 'info', 1000);
    } catch (err) {
      console.error('[GigRecorder] Error accediendo al micrófono:', err);
      toast.show('No se pudo acceder al micrófono para grabar.', 'warning');
      this.isRecording = false;
    }
  }

  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;

    this.mediaRecorder.stop();
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.isRecording = false;
    toast.show('Grabación finalizada con éxito', 'success', 1200);
  }

  downloadRecording(songTitle = 'Toma_Ensayo') {
    if (!this.latestAudioUrl) {
      toast.show('No hay ninguna grabación disponible para descargar.', 'warning');
      return;
    }

    const cleanTitle = songTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const a = document.createElement('a');
    a.href = this.latestAudioUrl;
    a.download = `TabsAndChords_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.show('Descargando archivo de audio...', 'success', 1000);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

export const gigRecorder = new GigRecorder();
export default gigRecorder;
