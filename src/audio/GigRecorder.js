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
    this.isVideoRecording = false;
    this.startTime = 0;
    this.timerInterval = null;
    this.currentDuration = 0;
    this.latestRecordingBlob = null;
    this.latestAudioUrl = null;
  }

  async startRecording(songMeta = {}, withCamera = false) {
    if (this.isRecording) return;

    try {
      this.isVideoRecording = withCamera;
      const constraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      };

      if (withCamera) {
        constraints.video = {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };
      }

      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (camErr) {
        if (withCamera) {
          console.warn('[GigRecorder] No se pudo acceder a la cámara, reintentando solo con audio:', camErr);
          this.isVideoRecording = false;
          this.stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
          });
        } else {
          throw camErr;
        }
      }

      this.audioChunks = [];
      let mimeType = 'audio/webm';
      if (this.isVideoRecording) {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          mimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          mimeType = 'video/webm;codecs=vp8,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        }
      } else {
        mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
      }

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const type = this.isVideoRecording ? 'video/webm' : 'audio/webm';
        this.latestRecordingBlob = new Blob(this.audioChunks, { type });
        if (this.latestAudioUrl) {
          URL.revokeObjectURL(this.latestAudioUrl);
        }
        this.latestAudioUrl = URL.createObjectURL(this.latestRecordingBlob);

        events.emit('recorder:finished', {
          blob: this.latestRecordingBlob,
          url: this.latestAudioUrl,
          duration: this.currentDuration,
          isVideo: this.isVideoRecording,
          songMeta
        });
      };

      this.mediaRecorder.start(250);
      this.isRecording = true;
      this.startTime = Date.now();
      this.currentDuration = 0;

      this.timerInterval = setInterval(() => {
        this.currentDuration = Math.floor((Date.now() - this.startTime) / 1000);
        events.emit('recorder:tick', { 
          duration: this.currentDuration, 
          formatted: this.formatTime(this.currentDuration),
          isVideo: this.isVideoRecording 
        });
      }, 1000);

      events.emit('recorder:started', { 
        songMeta, 
        stream: this.stream, 
        isVideo: this.isVideoRecording 
      });

      toast.show(
        this.isVideoRecording ? '📹 Grabando ensayo con cámara y audio...' : '🎙️ Grabando ensayo en alta fidelidad...', 
        'info', 
        1200
      );
    } catch (err) {
      console.error('[GigRecorder] Error accediendo a dispositivos de grabación:', err);
      toast.show('No se pudo acceder al micrófono/cámara para grabar.', 'warning');
      this.isRecording = false;
      this.isVideoRecording = false;
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
    const ext = this.isVideoRecording ? 'webm' : 'webm';
    const prefix = this.isVideoRecording ? 'Video_Ensayo' : 'Audio_Ensayo';
    const a = document.createElement('a');
    a.href = this.latestAudioUrl;
    a.download = `TabsAndChords_${prefix}_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.show(`Descargando ${this.isVideoRecording ? 'video' : 'audio'} de la toma...`, 'success', 1000);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

export const gigRecorder = new GigRecorder();
export default gigRecorder;
