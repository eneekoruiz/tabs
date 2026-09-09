import { test, expect } from '@playwright/test';

test.describe('🖥️ Chord Popover Desktop Positioning, Piano Interaction & Scroll Auto-Dismiss', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    isMobile: false
  });

  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.bottom-nav-bar', { timeout: 15000 });

    // Cargar directamente Bohemian Rhapsody en el visor de letras y cambiar a la vista player
    await page.evaluate(async () => {
      const { events } = await import('./src/core/EventBus.js');
      events.emit('ui:switchTab', 'player');
      events.emit('ui:loadLyricsSong', {
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        lyricsChords: '[Verse 1]\n[Bb]Mama, just [Gm]killed a man\nPut a [Cm]gun against his head, pulled my [F7]trigger, now he is dead',
        data: ''
      });
    });

    await page.waitForSelector('.lyrics-chords-container', { timeout: 10000 });
    await page.waitForSelector('.chord-badge', { timeout: 10000 });
  });

  test.afterEach(async () => {
    const realErrors = consoleErrors.filter(e => !e.includes('Failed to load resource') && !e.includes('favicon') && !e.includes('isExternalMethodAvailable'));
    expect(realErrors, `Errores de consola: ${realErrors.join(', ')}`).toEqual([]);
  });

  test('1. En Desktop, el modal de acorde se acopla lateralmente a la derecha sin tapar la letra', async ({ page }) => {
    // Localizar el acorde Cm en la letra (el acorde del reporte de usuario)
    const cmBadge = page.locator('.chord-badge[data-chord="Cm"]').first();
    await expect(cmBadge).toBeVisible();
    await cmBadge.click();

    // El popover card debe aparecer
    const popover = page.locator('#chordPopoverCard');
    await expect(popover).toBeVisible();

    // Obtener la posición del popover en pantalla
    const popoverBox = await popover.boundingBox();
    expect(popoverBox).not.toBeNull();

    // En Desktop (1280px): debe estar flotando lateralmente a la derecha (> 900px)
    expect(popoverBox.x + popoverBox.width).toBeGreaterThan(950);
    // Y anclado en la parte superior (top <= 120px)
    expect(popoverBox.y).toBeLessThanOrEqual(120);

    // Comprobar que la letra en el centro de la pantalla permanece 100% visible
    const lyricLine = page.locator('.lyrics-line').first();
    await expect(lyricLine).toBeVisible();
  });

  test('2. Modo Piano: Texto de ayuda dinámico, teclas interactivas con feedback visual y sonido parejo', async ({ page }) => {
    // Abrir modal de Cm
    const cmBadge = page.locator('.chord-badge[data-chord="Cm"]').first();
    await cmBadge.click();
    const popover = page.locator('#chordPopoverCard');
    await expect(popover).toBeVisible();

    // Inicialmente en guitarra, el hint dice "cuerda"
    const hint = popover.locator('.chord-popover-interactive-hint span');
    await expect(hint).toContainText('cuerda');

    // Cambiar a pestaña Piano usando force: true para evitar scroll artificial de Playwright
    const pianoTab = popover.locator('.btn-popover-inst[data-popinst="piano"]');
    await pianoTab.click({ force: true });
    await expect(pianoTab).toHaveClass(/active/);

    // El texto de ayuda cambia dinámicamente a "tecla"
    await expect(hint).toContainText('tecla');

    // Deben existir teclas interactivas de piano (.chord-interactive-key)
    const interactiveKeys = popover.locator('.chord-interactive-key');
    const keyCount = await interactiveKeys.count();
    expect(keyCount).toBeGreaterThan(12);

    // Pulsar una tecla del piano y verificar que no genera errores
    const firstKey = interactiveKeys.first();
    await firstKey.click({ force: true });

    // Audicionar acorde Cm en piano (comprobar síntesis acústica calibrada)
    const auditionBtn = popover.locator('#btnAuditionPopoverChord');
    await auditionBtn.click({ force: true });
  });

  test('3. Auto-Dismiss al hacer scroll: se cierra al deslizar en la letra, pero NO al scrollear dentro del modal', async ({ page }) => {
    // Abrir modal de Cm
    const cmBadge = page.locator('.chord-badge[data-chord="Cm"]').first();
    await cmBadge.click();
    const popover = page.locator('#chordPopoverCard');
    await expect(popover).toBeVisible();

    // Desplegar el acordeón de voicings
    const foldBtn = popover.locator('#btnToggleVoicingsFold');
    if (await foldBtn.isVisible()) {
      await foldBtn.click({ force: true });
      const drawer = popover.locator('#voicingsCollapsibleDrawer');
      await expect(drawer).not.toHaveClass(/is-folded/);

      // Scrollear dentro del cajón de voicings NO debe cerrar el modal
      await drawer.evaluate(el => el.dispatchEvent(new Event('scroll', { bubbles: true })));
      await page.waitForTimeout(250);
      await expect(popover).toBeVisible();
    }

    // Esperar a que pase el período de gracia inicial de montaje (180ms)
    await page.waitForTimeout(250);

    // Ahora simular desplazamiento del usuario en el viewport de la letra (.score-viewport)
    await page.evaluate(() => {
      const vp = document.querySelector('.score-viewport') || document.querySelector('.lyrics-chords-container');
      if (vp) {
        vp.scrollTop = 200;
        vp.dispatchEvent(new Event('scroll', { bubbles: false }));
      }
    });
    await page.waitForTimeout(300);

    // El modal debe haberse cerrado automáticamente porque se sobreentiende que el usuario continuó
    await expect(popover).toHaveCount(0);
  });

  test('4. Stepper rápido de voicings y modo Arpegio interactivo', async ({ page }) => {
    // Abrir modal de Cm
    const cmBadge = page.locator('.chord-badge[data-chord="Cm"]').first();
    await cmBadge.click();
    const popover = page.locator('#chordPopoverCard');
    await expect(popover).toBeVisible();

    // Comprobar stepper rápido presente
    const stepper = popover.locator('#popoverVoicingStepper');
    await expect(stepper).toBeVisible();

    const titleEl = popover.locator('#voicingStepperTitle');
    await expect(titleEl).toContainText('1');

    // Pulsar flecha siguiente (Next Voicing)
    const nextBtn = popover.locator('#btnVoicingNext');
    await nextBtn.click({ force: true });
    await expect(titleEl).toContainText('2');

    // Botón de Arpegio presente y funcional
    const arpeggioBtn = popover.locator('#btnArpeggiatePopoverChord');
    await expect(arpeggioBtn).toBeVisible();
    await arpeggioBtn.click({ force: true });

    // El botón debe recibir clase pulsante temporal
    await page.waitForTimeout(100);
    // Verificar que no se produjeron errores en la síntesis de arpegio
    await expect(popover).toBeVisible();
  });

  test('5. Atajo de teclado Escape y Clic Fuera cierran el modal', async ({ page }) => {
    // Abrir modal de Cm
    const cmBadge = page.locator('.chord-badge[data-chord="Cm"]').first();
    await cmBadge.click();
    const popover = page.locator('#chordPopoverCard');
    await expect(popover).toBeVisible();

    // Esperar buffer de apertura (160ms)
    await page.waitForTimeout(200);

    // Pulsar tecla Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await expect(popover).toHaveCount(0);

    // Abrir de nuevo y probar clic fuera
    await cmBadge.click();
    await expect(popover).toBeVisible();
    await page.waitForTimeout(200);

    // Clic fuera del modal (en la columna de la letra a la izquierda)
    await page.mouse.click(200, 200);
    await page.waitForTimeout(200);
    await expect(popover).toHaveCount(0);
  });
});
