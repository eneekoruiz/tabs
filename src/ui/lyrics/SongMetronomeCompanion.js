/**
 * @file SongMetronomeCompanion.js
 * @description Gestor y motor de metrónomo integrado en el visor de canciones.
 * Reutiliza el Web Audio API global compartido y sintetiza pulsos rítmicos exactos con lookahead.
 * Soporta persistencia por canción y versión, compases, acento, volumen, count-in y tap tempo.
 */

import { chordEngine } from '../../tools/ChordEngine.js';
import { audioFeedback } from '../../audio/AudioFeedback.js';

const MIN_BPM = 30;
const MAX_BPM = 280;
const VALID_SIGNATURES = new Set(['2/4', '3/4', '4/4', '6/8', '12/8']);
const VALID_SUBDIVISIONS = new Set(['quarter', 'eighth', 'triplet', 'sixteenth']);
const VALID_SOUNDS = new Set(['woodblock', 'digital', 'drum']);

export function songMetronomeStorageKey(song) {
  const identity = [
    song?.id || '',
    song?.title || '',
    song?.artist || '',
    song?.versionId || song?.selectedVersionId || song?.versionName || ''
  ].map(part => String(part).trim().toLowerCase()).join('::');
  return `app_song_metronome:${encodeURIComponent(identity)}`;
}

export class SongMetronomeCompanion {
  constructor(options = {}) {
    this.currentSong = options.song || null;
    this.storage = options.storage || globalThis.localStorage;
    this.onStateChange = options.onStateChange || (() => {});
    this.onBeat = options.onBeat || (() => {});
    this.onCountInComplete = options.onCountInComplete || (() => {});

    this.bpm = 120;
    this.timeSignature = '4/4';
    this.subdivision = 'quarter';
    this.sound = 'woodblock';
    this.accent = true;
    this.volume = 0.8;
    this.countInMeasures = 0;

    this.isRunning = false;
    this.isCountIn = false;
    this.countInRemainingBeats = 0;
    this.countInTotalBeats = 0;

    this.nextNoteTime = 0.0;
    this.currentSubBeat = 0;
    this.currentMeasureBeat = 0;
    this.schedulerTimer = null;
    this.tapTimes = [];

    if (this.currentSong) {
      this.loadSettings(this.currentSong);
    }
  }

  getAudioContext() {
    return chordEngine.getAudioContext();
  }

  setSong(song) {
    if (this.isRunning) {
      this.stop('song_switch');
    }
    this.currentSong = song || null;
    this.loadSettings(this.currentSong);
    this.emitState();
  }

  loadSettings(song) {
    if (!song) {
      this.bpm = 120;
      this.timeSignature = '4/4';
      this.subdivision = 'quarter';
      this.sound = 'woodblock';
      this.accent = true;
      this.volume = 0.8;
      this.countInMeasures = 0;
      return;
    }

    let defaultBpm = 120;
    const songTempo = Number(song.tempo);
    if (Number.isFinite(songTempo) && songTempo >= MIN_BPM && songTempo <= MAX_BPM) {
      defaultBpm = Math.round(songTempo);
    }

    const defaultSignature = VALID_SIGNATURES.has(song.timeSignature) ? song.timeSignature : '4/4';

    try {
      const raw = this.storage?.getItem(songMetronomeStorageKey(song));
      if (raw) {
        const parsed = JSON.parse(raw);
        this.bpm = this.clampBpm(parsed.bpm ?? defaultBpm);
        this.timeSignature = VALID_SIGNATURES.has(parsed.timeSignature) ? parsed.timeSignature : defaultSignature;
        this.subdivision = VALID_SUBDIVISIONS.has(parsed.subdivision) ? parsed.subdivision : 'quarter';
        this.sound = VALID_SOUNDS.has(parsed.sound) ? parsed.sound : 'woodblock';
        this.accent = parsed.accent !== undefined ? Boolean(parsed.accent) : true;
        this.volume = Math.max(0, Math.min(1, Number(parsed.volume) || 0.8));
        this.countInMeasures = [0, 1, 2, 4].includes(Number(parsed.countInMeasures)) ? Number(parsed.countInMeasures) : 0;
        return;
      }
    } catch {}

    this.bpm = defaultBpm;
    this.timeSignature = defaultSignature;
    this.subdivision = 'quarter';
    this.sound = 'woodblock';
    this.accent = true;
    this.volume = 0.8;
    this.countInMeasures = 0;
  }

  saveSettings(song = this.currentSong) {
    if (!song) return;
    try {
      const payload = {
        bpm: this.bpm,
        timeSignature: this.timeSignature,
        subdivision: this.subdivision,
        sound: this.sound,
        accent: this.accent,
        volume: this.volume,
        countInMeasures: this.countInMeasures
      };
      this.storage?.setItem(songMetronomeStorageKey(song), JSON.stringify(payload));
    } catch (err) {
      console.warn('[SongMetronomeCompanion] No se pudo persistir ajustes del metronomo:', err);
    }
  }

  clampBpm(value) {
    const num = Number(value) || 120;
    return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(num)));
  }

  setBpm(value) {
    this.bpm = this.clampBpm(value);
    this.saveSettings();
    this.emitState('bpm');
  }

  stepBpm(delta) {
    this.setBpm(this.bpm + Number(delta || 0));
  }

  setTimeSignature(ts) {
    if (VALID_SIGNATURES.has(ts)) {
      this.timeSignature = ts;
      this.saveSettings();
      this.emitState('timeSignature');
    }
  }

  setSubdivision(sub) {
    if (VALID_SUBDIVISIONS.has(sub)) {
      this.subdivision = sub;
      this.saveSettings();
      this.emitState('subdivision');
    }
  }

  setSound(sound) {
    if (VALID_SOUNDS.has(sound)) {
      this.sound = sound;
      this.saveSettings();
      this.emitState('sound');
    }
  }

  setAccent(accent) {
    this.accent = Boolean(accent);
    this.saveSettings();
    this.emitState('accent');
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    this.saveSettings();
    this.emitState('volume');
  }

  setCountIn(measures) {
    const m = Number(measures);
    this.countInMeasures = [0, 1, 2, 4].includes(m) ? m : 0;
    this.saveSettings();
    this.emitState('countIn');
  }

  handleTapTempo() {
    const now = performance.now();
    this.tapTimes.push(now);
    if (this.tapTimes.length > 5) this.tapTimes.shift();

    audioFeedback.hapticTap();

    if (this.tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this.tapTimes.length; i++) {
        intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
      }
      const validIntervals = intervals.filter(t => t > 200 && t < 2500);
      if (validIntervals.length > 0) {
        const avg = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
        const calculated = Math.round(60000 / avg);
        this.setBpm(calculated);
      }
    }
  }

  toggle() {
    if (this.isRunning) {
      this.stop('user_toggle');
    } else {
      this.start();
    }
  }

  start() {
    if (this.isRunning) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.isRunning = true;
    this.currentSubBeat = 0;
    this.currentMeasureBeat = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;

    const beatsPerMeasure = this.getBeatsPerMeasure();

    if (this.countInMeasures > 0) {
      this.isCountIn = true;
      this.countInTotalBeats = beatsPerMeasure * this.countInMeasures;
      this.countInRemainingBeats = this.countInTotalBeats;
    } else {
      this.isCountIn = false;
      this.countInTotalBeats = 0;
      this.countInRemainingBeats = 0;
    }

    const schedule = () => {
      if (!this.isRunning) return;

      while (this.nextNoteTime < ctx.currentTime + 0.1) {
        this.scheduleNote(this.nextNoteTime);

        let subFactor = 1;
        if (this.subdivision === 'eighth') subFactor = 0.5;
        else if (this.subdivision === 'triplet') subFactor = 1 / 3;
        else if (this.subdivision === 'sixteenth') subFactor = 0.25;

        const secondsPerSubBeat = (60.0 / this.bpm) * subFactor;
        this.nextNoteTime += secondsPerSubBeat;
        this.currentSubBeat++;
      }
    };

    this.schedulerTimer = setInterval(schedule, 25);
    this.emitState('start');
  }

  stop(reason = 'explicit') {
    const wasRunning = this.isRunning;
    this.isRunning = false;
    this.isCountIn = false;
    this.countInRemainingBeats = 0;

    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    this.currentSubBeat = 0;
    this.currentMeasureBeat = 0;

    if (wasRunning) {
      this.emitState(reason);
    }
  }

  getBeatsPerMeasure() {
    const top = parseInt(this.timeSignature.split('/')[0], 10);
    return Number.isFinite(top) && top > 0 ? top : 4;
  }

  scheduleNote(time) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const beatsPerMeasure = this.getBeatsPerMeasure();

    let subDivisionsPerBeat = 1;
    if (this.subdivision === 'eighth') subDivisionsPerBeat = 2;
    else if (this.subdivision === 'triplet') subDivisionsPerBeat = 3;
    else if (this.subdivision === 'sixteenth') subDivisionsPerBeat = 4;

    const isMainBeat = (this.currentSubBeat % subDivisionsPerBeat) === 0;
    const measureBeat = Math.floor(this.currentSubBeat / subDivisionsPerBeat) % beatsPerMeasure;
    const isAccent = isMainBeat && measureBeat === 0 && this.accent;

    let isCountInNote = false;
    let countInCurrentBeat = 0;
    let countInMeasureNumber = 1;

    if (this.isCountIn) {
      if (isMainBeat) {
        isCountInNote = true;
        countInCurrentBeat = (this.countInTotalBeats - this.countInRemainingBeats) % beatsPerMeasure + 1;
        countInMeasureNumber = Math.floor((this.countInTotalBeats - this.countInRemainingBeats) / beatsPerMeasure) + 1;
        this.countInRemainingBeats--;

        if (this.countInRemainingBeats <= 0) {
          this.isCountIn = false;
          setTimeout(() => {
            if (this.isRunning) {
              this.onCountInComplete();
            }
          }, Math.max(0, (time - ctx.currentTime) * 1000));
        }
      }
    }

    this.playClickSound(ctx, time, isAccent, isMainBeat, isCountInNote);

    if (isMainBeat) {
      const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
      setTimeout(() => {
        if (!this.isRunning) return;
        this.currentMeasureBeat = measureBeat;
        this.onBeat({
          beat: measureBeat,
          beatsPerMeasure,
          isAccent,
          isCountIn: isCountInNote,
          countInCurrentBeat,
          countInMeasureNumber,
          countInTotalMeasures: this.countInMeasures
        });
      }, delayMs);
    }
  }

  playClickSound(ctx, time, isAccent, isMainBeat, isCountIn) {
    if (this.volume <= 0.001) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const baseVol = this.volume;

      if (isCountIn) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isAccent ? 1800 : 1200, time);
        gain.gain.setValueAtTime(baseVol * 0.9, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        osc.start(time);
        osc.stop(time + 0.045);
        return;
      }

      if (this.sound === 'woodblock') {
        osc.type = 'sine';
        osc.frequency.value = isAccent ? 1400 : (isMainBeat ? 900 : 600);
        gain.gain.setValueAtTime(isAccent ? baseVol : (isMainBeat ? baseVol * 0.7 : baseVol * 0.35), time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        osc.start(time);
        osc.stop(time + 0.045);
      } else if (this.sound === 'digital') {
        osc.type = 'square';
        osc.frequency.value = isAccent ? 2000 : (isMainBeat ? 1000 : 700);
        gain.gain.setValueAtTime(isAccent ? baseVol * 0.6 : (isMainBeat ? baseVol * 0.35 : baseVol * 0.15), time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
        osc.start(time);
        osc.stop(time + 0.035);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isAccent ? 180 : (isMainBeat ? 110 : 80), time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.07);
        gain.gain.setValueAtTime(isAccent ? baseVol : baseVol * 0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
        osc.start(time);
        osc.stop(time + 0.085);
      }
    } catch {}
  }

  getTempoName(bpm = this.bpm) {
    if (bpm < 60) return 'Largo / Grave';
    if (bpm < 76) return 'Adagio (Lento)';
    if (bpm < 108) return 'Andante (Al paso)';
    if (bpm < 120) return 'Moderato';
    if (bpm < 156) return 'Allegro (Rápido)';
    if (bpm < 200) return 'Vivace / Presto';
    return 'Prestissimo';
  }

  emitState(reason = 'update') {
    this.onStateChange({
      isRunning: this.isRunning,
      bpm: this.bpm,
      timeSignature: this.timeSignature,
      subdivision: this.subdivision,
      sound: this.sound,
      accent: this.accent,
      volume: this.volume,
      countInMeasures: this.countInMeasures,
      isCountIn: this.isCountIn,
      reason
    });
  }

  destroy() {
    this.stop('destroy');
    this.onStateChange = () => {};
    this.onBeat = () => {};
    this.onCountInComplete = () => {};
  }
}

export default SongMetronomeCompanion;
