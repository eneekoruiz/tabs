/**
 * @file GigRecorder.js
 * @description Grabador de ensayos con captura y limpieza segura de audio/vídeo.
 */

import { events } from '../core/EventBus.js';
import { toast } from '../ui/Toast.js';

export class GigRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.isVideoRecording = false;
    this.isPreparing = false;
    this.startTime = 0;
    this.timerInterval = null;
    this.currentDuration = 0;
    this.latestRecordingBlob = null;
    this.latestAudioUrl = null;
    this.latestRecordingIsVideo = false;
    this.requestId = 0;
    this.recordingMimeType = '';
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
  }

  async startRecording(songMeta = {}, withCamera = false) {
    if (this.isRecording || this.isPreparing) return false;

    const requestId = ++this.requestId;
    this.isPreparing = true;
    this.isVideoRecording = Boolean(withCamera);
    events.emit('recorder:requesting', { isVideo: this.isVideoRecording, songMeta });

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('La captura multimedia no está disponible en este dispositivo.');
      }

      const constraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      };
      if (withCamera) {
        constraints.video = {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (requestId !== this.requestId) {
        this.stopStream(stream);
        return false;
      }

      this.stream = stream;
      this.isVideoRecording = Boolean(withCamera && stream.getVideoTracks().length);
      events.emit('recorder:streamReady', {
        stream,
        isVideo: this.isVideoRecording,
        songMeta
      });

      this.audioChunks = [];
      this.recordingMimeType = this.pickMimeType(this.isVideoRecording);
      this.mediaRecorder = this.recordingMimeType
        ? new MediaRecorder(stream, { mimeType: this.recordingMimeType })
        : new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onerror = (event) => {
        const error = event.error || new Error('La grabación se interrumpió.');
        this.handleRuntimeError(error, songMeta);
      };

      this.mediaRecorder.onstop = () => this.finalizeRecording(songMeta);
      this.mediaRecorder.start(250);
      this.isPreparing = false;
      this.isRecording = true;
      this.startTime = Date.now();
      this.currentDuration = 0;

      this.timerInterval = setInterval(() => {
        this.currentDuration = Math.floor((Date.now() - this.startTime) / 1000);
        const tick = {
          duration: this.currentDuration,
          formatted: this.formatTime(this.currentDuration),
          isVideo: this.isVideoRecording
        };
        events.emit('recorder:tick', tick);
        this.onProgress?.(tick.duration);
      }, 1000);

      events.emit('recorder:started', {
        songMeta,
        stream,
        isVideo: this.isVideoRecording
      });
      return true;
    } catch (error) {
      if (requestId !== this.requestId) return false;
      this.handleRuntimeError(error, songMeta, Boolean(withCamera));
      return false;
    }
  }

  pickMimeType(isVideo) {
    const candidates = isVideo
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      : ['audio/webm;codecs=opus', 'audio/webm'];
    if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  stopRecording() {
    if (this.isPreparing) {
      this.cancelPendingRecording();
      return false;
    }
    if (!this.isRecording || !this.mediaRecorder) return false;

    this.currentDuration = Math.max(
      this.currentDuration,
      Math.floor((Date.now() - this.startTime) / 1000)
    );
    this.isRecording = false;
    events.emit('recorder:stopping', {
      duration: this.currentDuration,
      isVideo: this.isVideoRecording
    });
    this.clearTimer();

    if (this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
    this.cleanupStream();
    return true;
  }

  cancelPendingRecording() {
    if (!this.isPreparing) return false;
    this.requestId += 1;
    this.isPreparing = false;
    this.isRecording = false;
    this.isVideoRecording = false;
    this.clearTimer();
    this.cleanupStream();
    events.emit('recorder:cancelled');
    return true;
  }

  finalizeRecording(songMeta) {
    const isVideo = this.isVideoRecording;
    this.isPreparing = false;
    this.isRecording = false;
    this.clearTimer();
    this.cleanupStream();
    const type = this.mediaRecorder?.mimeType
      || this.recordingMimeType
      || (isVideo ? 'video/webm' : 'audio/webm');
    this.latestRecordingBlob = new Blob(this.audioChunks, { type });
    if (this.latestAudioUrl) URL.revokeObjectURL(this.latestAudioUrl);
    this.latestAudioUrl = URL.createObjectURL(this.latestRecordingBlob);
    this.latestRecordingIsVideo = isVideo;

    const result = {
      blob: this.latestRecordingBlob,
      url: this.latestAudioUrl,
      duration: this.currentDuration,
      isVideo,
      songMeta
    };
    this.mediaRecorder = null;
    this.audioChunks = [];
    events.emit('recorder:finished', result);
    this.onComplete?.(result.blob, result.url, result.isVideo);
  }

  handleRuntimeError(error, songMeta = {}, requestedVideo = this.isVideoRecording) {
    console.error('[GigRecorder] Error accediendo a dispositivos de grabación:', error);
    this.requestId += 1;
    this.isPreparing = false;
    this.isRecording = false;
    this.clearTimer();
    this.cleanupStream();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null;
      try { this.mediaRecorder.stop(); } catch (_) {}
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isVideoRecording = false;
    events.emit('recorder:error', { error, songMeta, isVideo: Boolean(requestedVideo) });
    if (this.onError) {
      this.onError(error);
    } else {
      toast.show(
        requestedVideo
          ? 'No se pudo acceder a la cámara y al micrófono.'
          : 'No se pudo acceder al micrófono.',
        'warning'
      );
    }
  }

  clearTimer() {
    if (!this.timerInterval) return;
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  }

  stopStream(stream) {
    stream?.getTracks?.().forEach((track) => {
      try {
        track.stop();
      } catch (error) {
        console.warn('[GigRecorder] No se pudo detener una pista:', error);
      }
    });
  }

  cleanupStream() {
    this.stopStream(this.stream);
    this.stream = null;
  }

  downloadRecording(songTitle = 'Toma_Ensayo') {
    if (!this.latestAudioUrl) {
      toast.show('No hay ninguna grabación disponible para descargar.', 'warning');
      return;
    }

    const cleanTitle = songTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = this.latestRecordingBlob?.type.includes('mp4') ? 'mp4' : 'webm';
    const prefix = this.latestRecordingIsVideo ? 'Video_Ensayo' : 'Audio_Ensayo';
    const anchor = document.createElement('a');
    anchor.href = this.latestAudioUrl;
    anchor.download = 'TabsAndChords_' + prefix + '_' + cleanTitle + '_' + new Date().toISOString().slice(0, 10) + '.' + ext;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    toast.show(
      'Descargando ' + (this.latestRecordingIsVideo ? 'video' : 'audio') + ' de la toma...',
      'success',
      1000
    );
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
  }
}

export const gigRecorder = new GigRecorder();
export default gigRecorder;
