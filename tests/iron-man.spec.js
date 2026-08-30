import { test, expect } from '@playwright/test';

test.describe('⚡ Fase Iron Man: Stage Automation, WebRTC Jamming y WebXR - Suite E2E', () => {
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.addInitScript(() => {
      // Mock de Web Audio, WebRTC y Web MIDI API
      class MockAudioContext {
        constructor() {
          this.state = 'running';
          this.currentTime = 0;
          this.sampleRate = 44100;
          this.destination = {};
        }
        createGain() { return { gain: { value: 1, setValueAtTime: () => {}, setTargetAtTime: () => {} }, connect: () => {} }; }
        resume() { return Promise.resolve(); }
        close() { return Promise.resolve(); }
      }

      window.AudioContext = MockAudioContext;
      window.webkitAudioContext = MockAudioContext;

      // Mock de Web MIDI API
      const mockOutput = {
        id: 'kemper-profiler-1',
        name: 'Kemper Profiler USB MIDI',
        manufacturer: 'Kemper Digital',
        send: (bytes) => { window._lastSentMidiBytes = bytes; }
      };

      navigator.requestMIDIAccess = async () => ({
        outputs: new Map([['kemper-profiler-1', mockOutput]])
      });

      // Mock de BroadcastChannel para WebRTC Signal Channel
      class MockBroadcastChannel {
        constructor(name) { this.name = name; }
        postMessage(data) {}
        close() {}
      }
      window.BroadcastChannel = MockBroadcastChannel;
    });

    await page.goto('http://localhost:3000/index.html');
    await page.waitForSelector('.bottom-nav-bar', { timeout: 10000 });
  });

  test.afterEach(async () => {
    const realErrors = consoleErrors.filter(e =>
      !e.includes('Failed to load resource') &&
      !e.includes('favicon') &&
      !e.includes('AlphaTab')
    );
    expect(realErrors, `Errores de consola detectados: ${realErrors.join(', ')}`).toEqual([]);
  });

  test('1. BandRoom Multijugador P2P: Creación de Sala y Conexión de Miembros', async ({ page }) => {
    // 1. Navegar a Herramientas
    await page.locator('.nav-tab-btn[data-tab="tools"]').click();

    // 2. Abrir BandRoom
    const bandRoomCard = page.locator('.premium-list-item[data-tool="bandroom"]');
    await expect(bandRoomCard).toBeVisible();
    await bandRoomCard.click();

    const bandRoomModal = page.locator('#modal-band-room');
    await expect(bandRoomModal).toBeVisible();

    // 3. Crear Sala P2P como Anfitrión
    const btnCreate = page.locator('#btnCreateRoom');
    await expect(btnCreate).toBeVisible();
    await btnCreate.click();

    // Comprobar código de sala generado
    const codeDisplay = page.locator('#lblRoomIdCode');
    await expect(codeDisplay).toBeVisible();
    await expect(codeDisplay).toContainText('BAND-');

    // 4. Abandonar Sala y Cerrar Modal
    await page.locator('#btnLeaveRoom').click();
    await page.locator('#btnCloseBandRoom').click();
    await expect(bandRoomModal).not.toBeVisible();
  });

  test('2. Stage Automation: Configuración de Pedaleras USB MIDI y Mapeo de Presets por Compás', async ({ page }) => {
    // 1. Navegar a Herramientas
    await page.locator('.nav-tab-btn[data-tab="tools"]').click();

    // 2. Abrir Stage Automation
    const stageCard = page.locator('.premium-list-item[data-tool="stage"]');
    await expect(stageCard).toBeVisible();
    await stageCard.click();

    const stageModal = page.locator('#modal-stage-automation');
    await expect(stageModal).toBeVisible();

    // 3. Activar automatización
    const btnToggle = page.locator('#btnToggleStageAuto');
    await expect(btnToggle).toBeVisible();
    await btnToggle.click();
    await expect(btnToggle).toHaveClass(/active/);

    // 4. Mapear cambio de preset en Compás 16
    await page.locator('#numTargetBar').fill('16');
    await page.locator('#numCmdNumber').fill('7');
    await page.locator('#txtPresetLabel').fill('Solo Lead High Gain Helix');
    await page.locator('#btnAddStageMapping').click();

    // 5. Verificar que se ha añadido a la tabla y probar envío
    const tableRow = page.locator('.stage-mappings-table tbody tr').first();
    await expect(tableRow).toBeVisible();
    await expect(tableRow).toContainText('Compás 16');
    await expect(tableRow).toContainText('Solo Lead High Gain Helix');

    const btnTest = page.locator('.btn-test-cmd').first();
    await btnTest.click();

    // Cerrar modal
    await page.locator('#btnCloseStage').click();
    await expect(stageModal).not.toBeVisible();
  });

  test('3. Spatial Computing HUD (WebXR AR): Vista Flotante Cristalina Glassmorphic', async ({ page }) => {
    // 1. Navegar a Herramientas
    await page.locator('.nav-tab-btn[data-tab="tools"]').click();

    // 2. Abrir Spatial Computing HUD
    const spatialCard = page.locator('.premium-list-item[data-tool="spatial"]');
    await expect(spatialCard).toBeVisible();
    await spatialCard.click();

    const spatialBackdrop = page.locator('.modal-spatial-backdrop');
    await expect(spatialBackdrop).toBeVisible();

    // 3. Probar slider de opacidad cristalina
    const slider = page.locator('#rngSpatialOpacity');
    await expect(slider).toBeVisible();
    await slider.fill('0.4');

    // 4. Activar vista flotante AR
    const btnXR = page.locator('#btnToggleXR');
    await expect(btnXR).toBeVisible();
    await btnXR.click();

    await expect(spatialBackdrop).toHaveClass(/xr-active/);

    // Salir del modo AR y cerrar
    await btnXR.click();
    await page.locator('#btnCloseSpatial').click();
    await expect(spatialBackdrop).not.toBeVisible();
  });

  test('4. Acceso Rápido a BandRoom, Stage Automation y Spatial XR desde Opciones de Canción', async ({ page }) => {
    // 1. Abrir primera canción
    const songCard = page.locator('.btn-load-explore-song').first();
    await songCard.click();
    await page.waitForTimeout(500);

    // 2. Probar BandRoom desde Opciones
    await page.click('#btnMoreOptions');
    await page.waitForTimeout(200);
    await page.click('#btnOpenBandRoomQuick');
    await expect(page.locator('#modal-band-room')).toBeVisible();
    await page.click('#btnCloseBandRoom');

    // 3. Probar Stage Automation desde Opciones
    await page.click('#btnMoreOptions');
    await page.waitForTimeout(200);
    await page.click('#btnOpenStageQuick');
    await expect(page.locator('#modal-stage-automation')).toBeVisible();
    await page.click('#btnCloseStage');

    // 4. Probar Spatial XR desde Opciones
    await page.click('#btnMoreOptions');
    await page.waitForTimeout(200);
    await page.click('#btnOpenSpatialQuick');
    await expect(page.locator('.modal-spatial-backdrop')).toBeVisible();
    await page.click('#btnCloseSpatial');
  });
});
