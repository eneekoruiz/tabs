import { test, expect } from '@playwright/test';

// Lista de viewports estándar para auditoría de responsividad completa
const VIEWPORTS = [
  { name: 'Móvil Pequeño (iPhone SE - 375x667)', width: 375, height: 667, isMobile: true },
  { name: 'Móvil Estándar (iPhone 13 - 390x844)', width: 390, height: 844, isMobile: true },
  { name: 'Móvil Grande / Android (Pixel 7 - 412x915)', width: 412, height: 915, isMobile: true },
  { name: 'Tablet Vertical (iPad Mini - 768x1024)', width: 768, height: 1024, isMobile: false },
  { name: 'Tablet Horizontal (iPad Pro - 1024x1366)', width: 1024, height: 1366, isMobile: false },
  { name: 'Portátil Estándar (1280x800)', width: 1280, height: 800, isMobile: false },
  { name: 'Pantalla Ancha FHD (1920x1080)', width: 1920, height: 1080, isMobile: false },
];

test.describe('📱 Auditoría E2E de Responsividad Multidispositivo (Cero Desbordamientos & Cero Textos Cortados)', () => {

  for (const vp of VIEWPORTS) {
    test.describe(`Dispositivo: ${vp.name}`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
      });

      let consoleErrors = [];

      test.beforeEach(async ({ page }) => {
        consoleErrors = [];
        page.on('console', msg => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', err => consoleErrors.push(err.message));

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.bottom-nav-bar');
      });

      test.afterEach(async () => {
        const realErrors = consoleErrors.filter(e => !e.includes('Failed to load resource') && !e.includes('favicon'));
        expect(realErrors, `Errores de consola en ${vp.name}: ${realErrors.join(', ')}`).toEqual([]);
      });

      test(`1. Vista Explorar sin desbordamiento horizontal en ${vp.width}px`, async ({ page }) => {
        const exploreView = page.locator('#explore-view-container');
        await expect(exploreView).toBeVisible();

        // Verificar que no hay barra de scroll horizontal en la ventana principal
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasHorizontalScroll, `Scroll horizontal no deseado detectado en Explorar (${vp.name})`).toBe(false);
      });

      test(`2. Vista Mis Tabs sin elementos partidos en ${vp.width}px`, async ({ page }) => {
        const navLibrary = page.locator('.nav-tab-btn[data-tab="library"]');
        await navLibrary.click();

        const libraryContainer = page.locator('#library-container');
        await expect(libraryContainer).toBeVisible();

        const hasHorizontalScroll = await page.evaluate(() => {
          const el = document.getElementById('library-container');
          return el ? el.scrollWidth > el.clientWidth : false;
        });
        expect(hasHorizontalScroll, `Desbordamiento en vista Biblioteca (${vp.name})`).toBe(false);
      });

      test(`3. Vista Herramientas responsiva en ${vp.width}px`, async ({ page }) => {
        const navTools = page.locator('.nav-tab-btn[data-tab="tools"]');
        await navTools.click();

        const toolsView = page.locator('#tools-view-container');
        await expect(toolsView).toBeVisible();

        const hasHorizontalScroll = await page.evaluate(() => {
          const el = document.getElementById('tools-view-container');
          return el ? el.scrollWidth > el.clientWidth : false;
        });
        expect(hasHorizontalScroll, `Desbordamiento en vista Herramientas (${vp.name})`).toBe(false);
      });

      test(`4. Tarjetas de Ajustes 100% legibles sin desbordar en ${vp.width}px`, async ({ page }) => {
        const navSettings = page.locator('.nav-tab-btn[data-tab="settings"]');
        await navSettings.click();

        const settingsView = page.locator('#settings-view-container');
        await expect(settingsView).toBeVisible();

        const hasHorizontalScroll = await page.evaluate(() => {
          const el = document.getElementById('settings-view-container');
          return el ? el.scrollWidth > el.clientWidth : false;
        });
        expect(hasHorizontalScroll, `Tarjetas de Ajustes desbordadas en (${vp.name})`).toBe(false);
      });

      test(`5. Visor de Canción (Blackbird) sin texto ni acordes cortados en ${vp.width}px`, async ({ page }) => {
        const searchInput = page.locator('#exploreSearchInput');
        await searchInput.fill('Blackbird');

        const songCard = page.locator('.song-card', { hasText: /Blackbird/i }).locator('.btn-load-explore-song').first();
        await songCard.waitFor({ state: 'visible', timeout: 10000 });
        await songCard.click();

        const lyricsContainer = page.locator('.lyrics-chords-container');
        await expect(lyricsContainer).toBeVisible({ timeout: 10000 });

        // Verificar que las líneas de letra no se desbordan horizontalmente del viewport
        const hasOverflow = await page.evaluate(() => {
          const container = document.querySelector('.lyrics-chords-container');
          return container ? container.scrollWidth > window.innerWidth : false;
        });
        expect(hasOverflow, `Desbordamiento en visor de canción (${vp.name})`).toBe(false);
      });

    });
  }

});
