import fs from 'node:fs/promises';
import path from 'node:path';
import axe from 'axe-core';
import { Builder, By, until, logging } from 'selenium-webdriver';
import edge from 'selenium-webdriver/edge.js';

const baseUrl = process.env.SELENIUM_BASE_URL || 'http://127.0.0.1:3000';
const outputDir = process.env.SELENIUM_ARTIFACT_DIR
  || path.join(process.cwd(), 'test-results', 'selenium-visual');

const viewports = [
  { name: 'mobile-320', width: 320, height: 568, inspectSong: true },
  { name: 'mobile-390', width: 390, height: 844, inspectSong: true },
  { name: 'tablet-768', width: 768, height: 1024, inspectSong: true },
  { name: 'desktop-900', width: 900, height: 600, inspectSong: true, inspectTools: true },
  { name: 'desktop-1280', width: 1280, height: 800, inspectSong: true, inspectTools: true },
  { name: 'desktop-1440', width: 1440, height: 900, inspectSong: true },
  { name: 'desktop-1920', width: 1920, height: 1080, inspectSong: true, inspectTools: true }
];

await fs.mkdir(outputDir, { recursive: true });

const preferences = new logging.Preferences();
preferences.setLevel(logging.Type.BROWSER, logging.Level.SEVERE);

const options = new edge.Options();
options.addArguments('--headless=new', '--disable-gpu', '--window-position=0,0');
options.setLoggingPrefs(preferences);

const driver = await new Builder()
  .forBrowser('MicrosoftEdge')
  .setEdgeOptions(options)
  .build();

if (typeof driver.sendDevToolsCommand === 'function') {
  await driver.sendDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
    source: "localStorage.removeItem('tabs_chords_music_session_v1');"
  });
}

const report = {
  baseUrl,
  generatedAt: new Date().toISOString(),
  viewports: [],
  failures: []
};

async function saveScreenshot(name) {
  const filePath = path.join(outputDir, `${name}.png`);
  const png = await driver.takeScreenshot();
  await fs.writeFile(filePath, png, 'base64');
  return filePath;
}

async function inspectLayout() {
  return driver.executeScript(() => {
    const root = document.documentElement;
    const viewportWidth = window.innerWidth;
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) > 0
        && rect.width > 0
        && rect.height > 0
        && rect.bottom > 0
        && rect.top < window.innerHeight
        && rect.right > 0
        && rect.left < window.innerWidth
        && !element.closest('details:not([open])');
    };

    const overflowElements = [...document.querySelectorAll('body *')]
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || '',
          className: typeof element.className === 'string' ? element.className : '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter((item) => item.left < -2 || item.right > viewportWidth + 2)
      .slice(0, 20);

    const bottomOccluderTop = [...document.querySelectorAll('body *')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.position === 'fixed'
          && rect.bottom >= window.innerHeight - 1
          && rect.width >= window.innerWidth * 0.5
          && rect.top > window.innerHeight * 0.5;
      })
      .reduce((top, element) => Math.min(top, element.getBoundingClientRect().top), window.innerHeight);
    const blockedControls = [...document.querySelectorAll('button, input, select, textarea, [role="button"]')]
      .filter((element) => {
        if (!visible(element)) return false;
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        return centerX >= 0
          && centerX < window.innerWidth
          && rect.left >= 0
          && rect.right <= window.innerWidth
          && centerY >= 0
          && centerY < bottomOccluderTop
          && rect.top >= 0
          && rect.bottom <= bottomOccluderTop;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const x = Math.max(0, Math.min(viewportWidth - 1, rect.left + rect.width / 2));
        const y = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));
        const topElement = document.elementFromPoint(x, y);
        const isNativeRange = element.matches('input[type="range"]');
        const isScrollableContentUnderNav = Boolean(topElement?.closest('.bottom-nav-bar') && element.closest('.view-container'));
        const isModalOccluded = Boolean(topElement?.closest('[role="dialog"], [aria-modal="true"], .youtube-companion-overlay, .song-metronome-overlay'));
        const usable = isNativeRange
          || isScrollableContentUnderNav
          || isModalOccluded
          || Boolean(topElement && (topElement === element || element.contains(topElement)));
        return usable ? null : {
          tag: element.tagName.toLowerCase(),
          id: element.id || '',
          className: typeof element.className === 'string' ? element.className : '',
          coveredBy: topElement ? `${topElement.tagName.toLowerCase()}#${topElement.id || ''}.${typeof topElement.className === 'string' ? topElement.className : ''}` : 'none'
        };
      })
      .filter(Boolean)
      .slice(0, 20);

    return {
      viewportWidth,
      viewportHeight: window.innerHeight,
      documentWidth: root.scrollWidth,
      horizontalOverflow: root.scrollWidth > root.clientWidth + 2,
      overflowElements,
      blockedControls
    };
  });
}

async function waitForVisible(selector, timeout = 10_000) {
  await driver.wait(async () => {
    try {
      return await (await driver.findElement(By.css(selector))).isDisplayed();
    } catch {
      return false;
    }
  }, timeout);
  return driver.findElement(By.css(selector));
}

async function clickFresh(selector, timeout = 10_000) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const element = await waitForVisible(selector, timeout);
    try {
      await driver.executeScript((el) => el.scrollIntoView({ block: 'nearest', inline: 'center' }), element);
      await new Promise((resolve) => setTimeout(resolve, 80));
      await element.click();
      return;
    } catch (error) {
      lastError = error;
      if (error?.name === 'ElementClickInterceptedError' || error?.name === 'ElementNotInteractableError') {
        try {
          await driver.executeScript((el) => el.click(), element);
          return;
        } catch {}
      }
      if (error?.name !== 'StaleElementReferenceError') throw error;
    }
  }
  throw lastError;
}
async function clickSongByText(text, timeout = 10_000) {
  const locator = By.xpath("//button[contains(@class, 'btn-load-explore-song') and contains(., '" + text + "')]");
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const element = await driver.wait(async () => {
      const matches = await driver.findElements(locator);
      for (const match of matches) {
        try {
          if (await match.isDisplayed()) return match;
        } catch {
          // The result grid can re-render while the search debounce settles.
        }
      }
      return false;
    }, timeout);
    try {
      await element.click();
      return;
    } catch (error) {
      lastError = error;
      if (error?.name !== 'StaleElementReferenceError') throw error;
    }
  }
  throw lastError;
}
async function runAxe() {
  await driver.executeScript(axe.source);
  return driver.executeAsyncScript((done) => {
    globalThis.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
    }).then((results) => done({
      violations: results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        targets: violation.nodes.flatMap((node) => node.target).slice(0, 12)
      }))
    })).catch((error) => done({ error: String(error) }));
  });
}

try {
  for (const viewport of viewports) {
    await driver.manage().window().setRect({
      width: viewport.width,
      height: viewport.height,
      x: 0,
      y: 0
    });
    if (typeof driver.sendDevToolsCommand === 'function') {
      await driver.sendDevToolsCommand('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.width < 600
      });
    }
    await driver.get(baseUrl);
        await waitForVisible('.bottom-nav-bar', 20_000);

    const homeScreenshot = await saveScreenshot(`${viewport.name}-home`);
    const homeLayout = await inspectLayout();
    const homeAxe = await runAxe();
    const viewportResult = {
      ...viewport,
      homeScreenshot,
      homeLayout,
      homeAxe,
      browserErrors: []
    };

    if (viewport.inspectTools) {
      await driver.executeScript(() => { document.querySelectorAll('.view-container').forEach((view) => view.classList.remove('active-view')); document.querySelector('#tools-view-container')?.classList.add('active-view'); });
      await waitForVisible('.tools-premium-list', 10_000);
      viewportResult.toolsScreenshot = await saveScreenshot(`${viewport.name}-tools`);
      viewportResult.toolsLayout = await inspectLayout();
      viewportResult.toolsAxe = await runAxe();
      viewportResult.toolsFitsViewport = await driver.executeScript(() => {
        const view = document.querySelector('#tools-view-container');
        return Boolean(view && view.scrollHeight <= view.clientHeight + 2);
      });
    }

    if (viewport.inspectSong) {
      if (viewport.inspectTools) await clickFresh('.nav-tab-btn[data-tab="explore"]');
      const search = await waitForVisible('#exploreSearchInput', 10_000);
      await search.clear();
      await search.sendKeys('Blackbird');
      await clickSongByText('Blackbird', 10_000);
      await waitForVisible('.lyrics-chords-container', 15_000);
      const fontIncrease = await waitForVisible('#btnFontIncr', 10_000);
      await driver.executeScript(
        (element) => element.closest('.font-scaler-group')?.scrollIntoView({ block: 'nearest', inline: 'start' }),
        fontIncrease
      );
      await new Promise((resolve) => setTimeout(resolve, 350));
      await fontIncrease.click();
      await new Promise((resolve) => setTimeout(resolve, 1_100));

      await clickFresh('#btnToggleYouTube', 10_000);
      await waitForVisible('#youtubeCompanion', 10_000);

      viewportResult.songScreenshot = await saveScreenshot(`${viewport.name}-song`);
      viewportResult.songLayout = await inspectLayout();
      viewportResult.songAxe = await runAxe();
    }

    try {
      viewportResult.browserErrors = (await driver.manage().logs().get(logging.Type.BROWSER))
        .filter((entry) => entry.level.name === 'SEVERE')
        .map((entry) => entry.message);
    } catch {
      viewportResult.browserErrors = [];
    }

    report.viewports.push(viewportResult);

    const checks = [
      ['home horizontal overflow', homeLayout.horizontalOverflow],
      ['home blocked controls', homeLayout.blockedControls.length > 0],
      ['home accessibility', Boolean(homeAxe.error) || homeAxe.violations.length > 0],
      ['browser errors', viewportResult.browserErrors.length > 0]
    ];
    if (viewport.inspectSong) {
      checks.push(
        ['song horizontal overflow', viewportResult.songLayout.horizontalOverflow],
        ['song blocked controls', viewportResult.songLayout.blockedControls.length > 0],
        ['song accessibility', Boolean(viewportResult.songAxe.error) || viewportResult.songAxe.violations.length > 0]
      );
    }
    if (viewport.inspectTools) {
      checks.push(
        ['tools horizontal overflow', viewportResult.toolsLayout.horizontalOverflow],
        ['tools blocked controls', viewportResult.toolsLayout.blockedControls.length > 0],
        ['tools accessibility', Boolean(viewportResult.toolsAxe.error) || viewportResult.toolsAxe.violations.length > 0],
        ['tools require page scroll', !viewportResult.toolsFitsViewport]
      );
    }
    for (const [check, failed] of checks) {
      if (failed) report.failures.push(`${viewport.name}: ${check}`);
    }
  }
} finally {
  await driver.quit();
}

const reportPath = path.join(outputDir, 'report.json');
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

if (report.failures.length > 0) {
  console.error(JSON.stringify({ reportPath, failures: report.failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ reportPath, screenshots: report.viewports.flatMap((item) => [item.homeScreenshot, item.songScreenshot].filter(Boolean)) }, null, 2));
}
