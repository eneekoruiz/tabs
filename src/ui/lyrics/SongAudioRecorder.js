/**
 * @file SongAudioRecorder.js
 * @description Gestor de grabación de ensayos de audio y vídeo con MediaRecorder y cámara web.
 */

import { gigRecorder } from '../../audio/GigRecorder.js';
import { toast } from '../Toast.js';

export class SongAudioRecorder {
  constructor(options = {}) {
    this.isRecording = false;
    this.recordWithCamera = false;
    this.recordingDuration = 0;
    this.recordedUrl = null;
    this.isCameraPipVisible = false;
    this.onStateChange = options.onStateChange || (() => {});

    this.initRecorderEvents();
  }

  initRecorderEvents() {
    gigRecorder.onProgress = (seconds) => {
      this.recordingDuration = seconds;
      this.onStateChange({
        isRecording: true,
        duration: seconds,
        url: this.recordedUrl,
        isVideo: this.recordWithCamera
      });
    };

    gigRecorder.onComplete = (blob, url, isVideo) => {
      this.isRecording = false;
      this.recordedUrl = url;
      this.recordWithCamera = isVideo;
      toast.show(isVideo ? '📹 Vídeo de ensayo guardado' : '🎙️ Grabación de ensayo completada', 'success');
      this.onStateChange({
        isRecording: false,
        duration: this.recordingDuration,
        url: this.recordedUrl,
        isVideo
      });
    };

    gigRecorder.onError = (err) => {
      this.isRecording = false;
      toast.show('Error al acceder al micrófono/cámara: ' + err.message, 'error');
      this.onStateChange({ isRecording: false, duration: 0, url: null, isVideo: false });
    };
  }

  async toggle(songTitle = 'Ensayo') {
    if (this.isRecording) {
      gigRecorder.stopRecording();
    } else {
      const ok = await gigRecorder.startRecording({
        video: this.recordWithCamera,
        title: songTitle
      });
      if (ok) {
        this.isRecording = true;
        this.recordedUrl = null;
        if (this.recordWithCamera) {
          this.isCameraPipVisible = true;
        }
        toast.show(this.recordWithCamera ? '📹 Grabando con cámara activada' : '🎙️ Grabando ensayo en directo...', 'info');
        this.onStateChange({
          isRecording: true,
          duration: 0,
          url: null,
          isVideo: this.recordWithCamera
        });
      }
    }
  }

  download(songTitle = 'Ensayo') {
    gigRecorder.downloadRecording(songTitle);
  }

  dismiss() {
    this.recordedUrl = null;
    this.recordingDuration = 0;
    this.onStateChange({ isRecording: false, duration: 0, url: null, isVideo: false });
  }

  formatTime(seconds) {
    return gigRecorder.formatTime(seconds);
  }
}

export default SongAudioRecorder;
