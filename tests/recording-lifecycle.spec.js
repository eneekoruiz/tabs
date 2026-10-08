import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';

test('real human rehearsal recording blocks a second take while finalizing and produces decodable nonempty audio', async ({}, info) => {
  test.setTimeout(120000);
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--use-file-for-fake-audio-capture=' + path.resolve('tests/fixtures/real-audio/vocadito_1.wav') + '%noloop'] });
  try {
    const context = await browser.newContext({ permissions: ['microphone'] });
    const page = await context.newPage();
    await page.goto(new URL('/tests/fixtures/audio-harness.html', info.project.use.baseURL).href);
    expect(await page.evaluate(async () => {
      const { GigRecorder } = await import('/src/audio/GigRecorder.js');
      window.rehearsal = new GigRecorder();
      const started = await window.rehearsal.startRecording({ title: 'Voz humana real' });
      window.rehearsalTracks = window.rehearsal.stream.getTracks();
      return started;
    })).toBe(true);
    await expect.poll(() => page.evaluate(() => window.rehearsal.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0)), { timeout: 20000 }).toBeGreaterThan(16000);
    const stop = await page.evaluate(async () => {
      const stopped = window.rehearsal.stopRecording();
      const second = await window.rehearsal.startRecording({ title: 'Intento antes del cierre' });
      return { stopped, second };
    });
    expect(stop).toEqual({ stopped: true, second: false });
    await expect.poll(() => page.evaluate(() => window.rehearsal.latestRecordingBlob?.size || 0), { timeout: 15000 }).toBeGreaterThan(16000);
    const result = await page.evaluate(async () => {
      const recorder = window.rehearsal, ctx = new AudioContext();
      try {
        const audio = await ctx.decodeAudioData(await recorder.latestRecordingBlob.arrayBuffer());
        let sum = 0; for (const sample of audio.getChannelData(0)) sum += sample * sample;
        return { duration: audio.duration, rms: Math.sqrt(sum / audio.length), bytes: recorder.latestRecordingBlob.size,
          tracks: window.rehearsalTracks.map(track => track.readyState), finalizing: recorder.isFinalizing,
          recording: recorder.isRecording, streamReleased: recorder.stream === null };
      } finally { await ctx.close(); URL.revokeObjectURL(recorder.latestAudioUrl); }
    });
    expect(result.duration).toBeGreaterThan(1);
    expect(result.rms).toBeGreaterThan(.0001);
    expect(result.tracks).toEqual(['ended']);
    expect(result.finalizing).toBe(false);
    expect(result.recording).toBe(false);
    expect(result.streamReleased).toBe(true);
    await info.attach('human-rehearsal-recording.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  } finally { await browser.close(); }
});
