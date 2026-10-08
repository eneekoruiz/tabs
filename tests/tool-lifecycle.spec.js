import { test, expect } from '@playwright/test';
import { openToolCatalogAdvanced } from './helpers/journeys.js';

for (const width of [375, 768, 1440]) {
  test.describe(`Tool lifecycle at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });

    test.beforeEach(async ({ page }) => {
      await page.route('**/lifecycle-test.html', route => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html lang="es"><head><link rel="stylesheet" href="/assets/css/design-system.css"></head><body><div id="lifecycle-tools"></div></body></html>',
      }));
      await page.goto('/lifecycle-test.html');
      await page.evaluate(async () => {
        const { ToolsView } = await import('/src/ui/ToolsView.js');
        window.lifecycleTools = new ToolsView('#lifecycle-tools');
        window.lifecycleTools.render();
        window.lifecycleStreams = [];
        window.lifecycleCreateStream = async () => {
          const context = new AudioContext();
          const oscillator = context.createOscillator();
          const destination = context.createMediaStreamDestination();
          oscillator.connect(destination);
          oscillator.start();
          window.lifecycleStreams.push(destination.stream);
          window.lifecycleAudioSource = { context, oscillator };
          return destination.stream;
        };
        navigator.mediaDevices.getUserMedia = window.lifecycleCreateStream;
        window.lifecycleErrors = [];
        window.addEventListener('error', event => window.lifecycleErrors.push(event.message));
        window.addEventListener('unhandledrejection', event => window.lifecycleErrors.push(String(event.reason)));
      });
    });

    test.afterEach(async ({ page }) => {
      expect(await page.evaluate(() => window.lifecycleErrors)).toEqual([]);
      await page.evaluate(() => {
        window.lifecycleTools.closeModal();
        window.lifecycleAudioSource?.oscillator.stop();
        window.lifecycleAudioSource?.context.close();
        window.lifecycleTools.destroy();
      });
    });

    test('microphone button starts capture and close ends the track and detection loop', async ({ page }) => {
      const trigger = page.locator('[data-tool="tuner"] [data-preview-action="open-full"]');
      await trigger.click();
      await page.locator('#btnToggleMicTuner').click();
      await expect(page.locator('#btnToggleMicTuner')).toHaveClass(/active/);
      expect(await page.evaluate(() => window.lifecycleStreams[0].getAudioTracks()[0].readyState)).toBe('live');
      await page.locator('#btnCloseToolModal').click();
      await expect(page.locator('#toolModalOverlay')).toHaveCount(0);
      expect(await page.evaluate(async () => {
        const { pitchDetector } = await import('/src/audio/PitchDetector.js');
        return {
          track: window.lifecycleStreams[0].getAudioTracks()[0].readyState,
          running: pitchDetector.isRunning,
          frame: pitchDetector.animationFrameId,
          listening: window.lifecycleTools.tunerTool.isListening,
          subscription: window.lifecycleTools.tunerTool.unsubPitch,
        };
      })).toEqual({ track: 'ended', running: false, frame: null, listening: false, subscription: null });
      await expect(trigger).toBeFocused();
    });

    test('changing tools stops capture and the previous metronome', async ({ page }) => {
      await page.locator('[data-tool="tuner"] [data-preview-action="open-full"]').click();
      await page.locator('#btnToggleMicTuner').click();
      await expect(page.locator('#btnToggleMicTuner')).toHaveClass(/active/);
      await page.evaluate(() => window.lifecycleTools.openToolModal('metronome'));
      expect(await page.evaluate(() => window.lifecycleStreams[0].getAudioTracks()[0].readyState)).toBe('ended');
      await page.locator('#btnToggleMetronome').click();
      await expect(page.locator('#btnToggleMetronome')).toHaveClass(/active/);
      await page.evaluate(() => window.lifecycleTools.openToolModal('dictionary'));
      expect(await page.evaluate(() => window.lifecycleTools.metronomeTool.isRunning)).toBe(false);
      await expect(page.locator('.dict-svg-viewport svg')).toBeVisible();
    });

    test('manual tone is disconnected on Escape and changing modes ends microphone capture', async ({ page }) => {
      await page.locator('[data-tool="tuner"] [data-preview-action="open-full"]').click();
      await page.locator('#btnToggleMicTuner').click();
      await expect(page.locator('#btnToggleMicTuner')).toHaveClass(/active/);
      await page.locator('.tuner-mode-tab-btn[data-mode="manual"]').click();
      expect(await page.evaluate(() => window.lifecycleStreams[0].getAudioTracks()[0].readyState)).toBe('ended');
      await page.locator('.tuner-string-card').first().click();
      expect(await page.evaluate(() => Boolean(window.lifecycleTools.tunerTool.activeOsc))).toBe(true);
      await page.keyboard.press('Escape');
      expect(await page.evaluate(() => window.lifecycleTools.tunerTool.activeOsc)).toBeNull();
      await expect(page.locator('#toolModalOverlay')).toHaveCount(0);
    });

    test('closing during microphone permission cancels a stream returned later', async ({ page }) => {
      await page.evaluate(() => {
        window.lifecyclePermissionRequests = 0;
        navigator.mediaDevices.getUserMedia = () => {
          window.lifecyclePermissionRequests++;
          return new Promise(resolve => { window.lifecycleResolvePermission = resolve; });
        };
      });
      await page.locator('[data-tool="tuner"] [data-preview-action="open-full"]').click();
      await page.locator('#btnToggleMicTuner').click();
      await expect.poll(() => page.evaluate(() => window.lifecyclePermissionRequests)).toBe(1);
      await expect(page.locator('#btnToggleMicTuner')).toBeDisabled();
      await page.locator('#btnCloseToolModal').click();
      await page.evaluate(async () => window.lifecycleResolvePermission(await window.lifecycleCreateStream()));
      await expect.poll(() => page.evaluate(() => window.lifecycleStreams[0].getAudioTracks()[0].readyState)).toBe('ended');
      expect(await page.evaluate(async () => {
        const { pitchDetector } = await import('/src/audio/PitchDetector.js');
        return { running: pitchDetector.isRunning, stream: pitchDetector.mediaStream, context: pitchDetector.audioContext };
      })).toEqual({ running: false, stream: null, context: null });
      await expect(page.locator('#toolModalOverlay')).toHaveCount(0);
    });

    test('two simultaneous starts share one permission request and both cancel on close', async ({ page }) => {
      await page.locator('[data-tool="tuner"] [data-preview-action="open-full"]').click();
      await page.evaluate(async () => {
        const { pitchDetector } = await import('/src/audio/PitchDetector.js');
        window.lifecyclePermissionRequests = 0;
        navigator.mediaDevices.getUserMedia = () => {
          window.lifecyclePermissionRequests++;
          return new Promise(resolve => { window.lifecycleResolvePermission = resolve; });
        };
        window.lifecycleConcurrentStarts = [pitchDetector.start(), pitchDetector.start()];
      });
      await expect.poll(() => page.evaluate(() => window.lifecyclePermissionRequests)).toBe(1);
      await page.locator('#btnCloseToolModal').click();
      const results = await page.evaluate(async () => {
        window.lifecycleResolvePermission(await window.lifecycleCreateStream());
        return Promise.all(window.lifecycleConcurrentStarts);
      });
      expect(results).toEqual([false, false]);
      expect(await page.evaluate(async () => {
        const { pitchDetector } = await import('/src/audio/PitchDetector.js');
        return { running: pitchDetector.isRunning, track: window.lifecycleStreams[0].getAudioTracks()[0].readyState };
      })).toEqual({ running: false, track: 'ended' });
    });

    test('BandRoom describes the local tab demo and keeps its room controls', async ({ page }) => {
      await openToolCatalogAdvanced(page);
      const card = page.locator('[data-tool="bandroom"]');
      await expect(card).toContainText('Controles compartidos en este navegador');
      await card.locator('[data-preview-action="open-full"]').click();
      const modal = page.locator('#modal-band-room');
      await expect(modal).toContainText('No conecta equipos remotos ni transmite audio');
      await expect(modal.locator('#btnCreateRoom')).toBeVisible();
      await expect(modal.locator('#btnJoinRoom')).toBeVisible();
      await expect(modal.locator('#txtRoomCodeInput')).toHaveAccessibleName('Código de sala local');
      await modal.locator('#btnCloseBandRoom').click();
      await expect(modal).toHaveCount(0);
    });
  });
}
