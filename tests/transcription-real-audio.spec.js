import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';

test('transcription of a real voice and guitar recording stays finite and renders its actual detected chords', async ({ page }, info) => {
  test.setTimeout(240000);
  await page.goto('/tests/fixtures/audio-harness.html');
  await page.addScriptTag({ url: '/assets/vendor/alphatab/1.8.4/alphaTab.min.js' });
  const result = await page.evaluate(async () => {
    const { AudioTranscriptionEngine } = await import('/src/audio/AudioTranscriptionEngine.js');
    const engine = new AudioTranscriptionEngine();
    try {
      const bytes = await (await fetch('/tests/fixtures/real-audio/Karissa_Hobbs_-_Lets_Go_Fishin.ogg')).arrayBuffer();
      const audio = await engine.getAudioContext().decodeAudioData(bytes);
      const result = await engine.transcribeAudioBuffer(audio);
      const importer = new alphaTab.importer.AlphaTexImporter();
      importer.initFromString(result.alphaTex, new alphaTab.Settings());
      const score = importer.readScore();
      return { duration: result.duration, chords: result.chords, bars: score.masterBars.length, key: result.detectedKey };
    } finally { await engine.audioCtx.close(); }
  });
  expect(result.duration).toBeGreaterThan(132);
  expect(result.chords.length).toBeGreaterThan(0);
  expect(result.bars).toBe(result.chords.length);
  for (const chord of result.chords) {
    expect(Number.isFinite(chord.startTime) && Number.isFinite(chord.endTime) && Number.isFinite(chord.confidence)).toBe(true);
    expect(chord.endTime).toBeGreaterThan(chord.startTime);
    expect(chord.endTime).toBeLessThanOrEqual(result.duration + .01);
    expect(chord.confidence).toBeGreaterThanOrEqual(0);
    expect(chord.confidence).toBeLessThanOrEqual(1);
  }
  // This verifies transport and rendering; there is no independent chord annotation for this song.
  await info.attach('real-song-transcription.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
});

test('browser records an actual human voice file for transcription and releases every capture track', async ({}, info) => {
  test.setTimeout(120000);
  const browser = await chromium.launch({ args: [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--use-file-for-fake-audio-capture=' + path.resolve('tests/fixtures/real-audio/vocadito_1.wav') + '%noloop'
  ] });
  try {
    const context = await browser.newContext({ permissions: ['microphone'] });
    const page = await context.newPage();
    await page.goto(new URL('/tests/fixtures/audio-harness.html', info.project.use.baseURL).href);
    const started = await page.evaluate(async () => {
      const { AudioTranscriptionEngine } = await import('/src/audio/AudioTranscriptionEngine.js');
      window.recordedTranscriber = new AudioTranscriptionEngine();
      const started = await window.recordedTranscriber.startLiveRecording();
      window.recordedTracks = window.recordedTranscriber.mediaStream.getTracks();
      return started;
    });
    expect(started).toBe(true);
    await expect.poll(() => page.evaluate(() => window.recordedTranscriber.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0)), { timeout: 20000 }).toBeGreaterThan(16000);
    const result = await page.evaluate(async () => {
      const engine = window.recordedTranscriber;
      const transcription = await engine.stopLiveRecording();
      const result = { bytes: engine.recordedBlob.size, duration: transcription.duration,
        recording: engine.isRecording, streamReleased: engine.mediaStream === null,
        tracks: window.recordedTracks.map(track => track.readyState), testingFlag: Boolean(window.__IS_TESTING__) };
      await engine.audioCtx.close();
      result.context = engine.audioCtx.state;
      return result;
    });
    expect(result.bytes).toBeGreaterThan(16000);
    expect(result.duration).toBeGreaterThan(1);
    expect(result.recording).toBe(false);
    expect(result.streamReleased).toBe(true);
    expect(result.tracks).toEqual(['ended']);
    expect(result.context).toBe('closed');
    expect(result.testingFlag).toBe(false);
    await info.attach('real-human-transcription-capture.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  } finally { await browser.close(); }
});
