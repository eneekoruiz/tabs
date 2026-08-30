import { test, expect } from '@playwright/test';

const FALLBACK_BASE_URL = 'http://127.0.0.1:3000';
const APP_SHELL = '.bottom-nav-bar';
const SEARCH_INPUT = '#exploreSearchInput';
const LOCAL_CATALOG_RESULT = '.btn-load-explore-song';
const KNOWN_OFFLINE_SONG = 'Blackbird';

test.use({ serviceWorkers: 'allow' });

test.describe('Paridad offline del catalogo', () => {
  test('conserva el shell, el service worker y la busqueda local sin red', async ({ page, context, baseURL }) => {
    test.setTimeout(60_000);

    const appOrigin = new URL(baseURL || FALLBACK_BASE_URL).origin;

    // The app must boot and search without relying on the AlphaTab CDN or any API.
    await page.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.origin === appOrigin || requestUrl.protocol === 'data:' || requestUrl.protocol === 'blob:') {
        await route.continue();
        return;
      }
      await route.abort('blockedbyclient');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(APP_SHELL)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(SEARCH_INPUT)).toBeVisible();

    const serviceWorkerCapability = await page.evaluate(() => ({
      supported: 'serviceWorker' in navigator,
      secureContext: window.isSecureContext,
    }));

    expect(serviceWorkerCapability.secureContext).toBe(true);
    expect(serviceWorkerCapability.supported).toBe(true);

    const registrationScope = await page.evaluate(async () => {
      const ready = navigator.serviceWorker.ready;
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('El service worker no se activo a tiempo')), 15_000);
      });
      const current = await Promise.race([ready, timeout]);
      return current.scope;
    });

    expect(new URL(registrationScope).origin).toBe(appOrigin);

    await expect.poll(
      () => page.evaluate(async () => {
        const current = await navigator.serviceWorker.getRegistration();
        return current?.active?.state || '';
      }),
      { timeout: 30_000, message: 'El service worker debe completar el precache y activarse' },
    ).toBe('activated');

    const activatedWorker = await page.evaluate(async () => {
      const current = await navigator.serviceWorker.getRegistration();
      return {
        scriptURL: current?.active?.scriptURL || '',
        state: current?.active?.state || '',
      };
    });

    expect(new URL(activatedWorker.scriptURL).pathname).toBe('/sw.js');
    expect(activatedWorker.state).toBe('activated');

    // clients.claim() should normally control the first page. Reload once online if
    // activation won the race, then require a controller before simulating offline.
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator(APP_SHELL)).toBeVisible({ timeout: 15_000 });
    }
    await expect.poll(
      () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      { timeout: 10_000, message: 'La pagina debe quedar controlada por el service worker' },
    ).toBe(true);

    await expect.poll(
      () => page.evaluate(async () => {
        const requiredPaths = [
          '/index.html',
          '/src/mainV2.js',
          '/src/data/catalog/OfflineUniversalLibraryEngine.js',
        ];
        const cacheNames = await caches.keys();
        const cachedRequests = (
          await Promise.all(cacheNames.map(async (name) => (await caches.open(name)).keys()))
        ).flat();
        const cachedPaths = new Set(cachedRequests.map((request) => new URL(request.url).pathname));
        return requiredPaths.every((path) => cachedPaths.has(path));
      }),
      { timeout: 10_000, message: 'El shell y el catalogo local deben estar precargados' },
    ).toBe(true);

    const fullOfflineDiagnostic = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const worker = navigator.serviceWorker.controller || registration?.active;
      if (!worker) return null;
      return new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => reject(new Error('Diagnóstico offline sin respuesta')), 5000);
        channel.port1.onmessage = (event) => {
          clearTimeout(timeout);
          resolve(event.data);
        };
        worker.postMessage({ type: 'OFFLINE_DIAGNOSTICS' }, [channel.port2]);
      });
    });

    expect(fullOfflineDiagnostic?.type).toBe('OFFLINE_DIAGNOSTICS_RESULT');
    expect(fullOfflineDiagnostic.resources.length).toBeGreaterThanOrEqual(100);
    expect(fullOfflineDiagnostic.resources.filter((resource) => !resource.available)).toEqual([]);

    const searchInput = page.locator(SEARCH_INPUT);
    await searchInput.fill(KNOWN_OFFLINE_SONG);
    await expect(
      page.locator(LOCAL_CATALOG_RESULT + ':visible', { hasText: new RegExp(KNOWN_OFFLINE_SONG, 'i') }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });

      await expect(page.locator(APP_SHELL)).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.nav-tab-btn[data-tab="explore"]')).toBeVisible();
      await expect(page.locator(SEARCH_INPUT)).toBeVisible();

      await page.locator(SEARCH_INPUT).fill(KNOWN_OFFLINE_SONG);
      await expect(
        page.locator(LOCAL_CATALOG_RESULT + ':visible', { hasText: new RegExp(KNOWN_OFFLINE_SONG, 'i') }).first(),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.setOffline(false);
    }
  });
});
