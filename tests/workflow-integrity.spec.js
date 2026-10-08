import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
test.setTimeout(90000);

async function openApp(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('.song-card').first().waitFor();
  await expect.poll(() => page.evaluate(async () => {
    const { audioEngine } = await import('/src/core/AudioEngineV2.js');
    return Boolean(audioEngine.api?.score);
  }), { timeout: 60000 }).toBe(true);
}

test('backup preserves imported score bytes, typed view slices and arrangement data, with and without encryption', async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(async () => {
    const { db } = await import('/src/data/Database.js');
    const { backupSyncEngine } = await import('/src/data/BackupSyncEngine.js');
    const examples = [
      { title: 'Binary Guitar Pro', data: new Uint8Array([71, 80, 53, 0, 1, 255]).buffer },
      { title: 'Sliced score', data: new Uint8Array([99, 71, 80, 54, 88]).subarray(1, 4) },
      { title: 'Typed score', data: new Uint16Array([0x5047, 0x1234]) },
      { title: 'Blob score', data: new Blob([new Uint8Array([71, 80, 55])], { type: 'application/octet-stream' }) },
      { title: 'Text score', data: '\\title "Text score" . 0.1.4',
        versions: [{ versionId: 'one', data: new Uint8Array([1, 2, 3]).buffer }],
        versionGroup: { versions: [{ versionId: 'two', data: new Uint8Array([4, 5, 6]) }] } }
    ];
    for (const example of examples) await db.saveSong({ ...example, artist: 'Workflow regression' });
    async function bytes(data) {
      if (data instanceof Blob) return [...new Uint8Array(await data.arrayBuffer())];
      if (data instanceof ArrayBuffer) return [...new Uint8Array(data)];
      if (ArrayBuffer.isView(data)) return [...new Uint8Array(data.buffer, data.byteOffset, data.byteLength)];
      return data;
    }
    async function snapshot() {
      return Promise.all((await db.getAllSongs()).map(async song => ({
        title: song.title, type: Object.prototype.toString.call(song.data), bytes: await bytes(song.data),
        versions: await Promise.all((song.versions || []).map(v => bytes(v.data))),
        group: await Promise.all((song.versionGroup?.versions || []).map(v => bytes(v.data)))
      })));
    }
    const before = await snapshot();
    const cycles = [];
    const original = backupSyncEngine._triggerDownload;
    try {
      for (const password of [null, 'roundtrip-test-password']) {
        let blob;
        backupSyncEngine._triggerDownload = value => { blob = value; };
        const exported = await backupSyncEngine.exportFullBackup(password);
        const content = await blob.text();
        const parsed = JSON.parse(content);
        const imported = await backupSyncEngine.importFullBackup(content, password);
        cycles.push({ exported: exported.success, imported: imported.success,
          encrypted: Boolean(parsed.isEncrypted), after: await snapshot() });
      }
    } finally { backupSyncEngine._triggerDownload = original; }
    return { before, cycles };
  });
  expect(result.before[0].bytes).toEqual([71, 80, 53, 0, 1, 255]);
  expect(result.before[1].bytes).toEqual([71, 80, 54]);
  expect(result.cycles).toHaveLength(2);
  for (const [index, cycle] of result.cycles.entries()) {
    expect(cycle.exported).toBe(true);
    expect(cycle.imported).toBe(true);
    expect(cycle.encrypted).toBe(index === 1);
    expect(cycle.after).toEqual(result.before);
  }
});

test('invalid backup records do not overwrite earlier songs or report a successful unsupported score export', async ({ page }) => {
  await openApp(page);
  const result = await page.evaluate(async () => {
    const { db } = await import('/src/data/Database.js');
    const { backupSyncEngine } = await import('/src/data/BackupSyncEngine.js');
    const id = await db.saveSong({ title: 'Keep my score', artist: 'Workflow regression', data: new Uint8Array([1, 2, 3]).buffer });
    const imported = await backupSyncEngine.importFullBackup(JSON.stringify({
      signature: 'AGY_TABS_SECURE_V2', version: 2,
      data: { songs: [{ id, title: 'Overwrite me', data: 'replacement' }, { title: 'Lost legacy binary', data: {} }] }
    }));
    const retained = await db.getSong(id);
    await db.saveSong({ title: 'Unsupported data', data: { unknown: true } });
    const original = backupSyncEngine._triggerDownload;
    let downloads = 0;
    backupSyncEngine._triggerDownload = () => { downloads += 1; };
    let exported;
    try { exported = await backupSyncEngine.exportFullBackup(); }
    finally { backupSyncEngine._triggerDownload = original; }
    return { imported, retainedTitle: retained.title, retainedBytes: [...new Uint8Array(retained.data)], exported, downloads };
  });
  expect(result.imported.success).toBe(false);
  expect(result.retainedTitle).toBe('Keep my score');
  expect(result.retainedBytes).toEqual([1, 2, 3]);
  expect(result.exported.success).toBe(false);
  expect(result.downloads).toBe(0);
});

test('search title import and printed songbook preserve literal text without injected elements', async ({ page }) => {
  await openApp(page);
  const payload = '"><img src=x onerror="window.__importInjection=1">';
  await page.locator('#exploreSearchInput').fill(payload);
  await page.locator('#exploreSearchInput').press('Enter');
  await page.locator('#btnOpenSongImporterHero').click();
  await expect(page.locator('#importTitle')).toHaveValue(payload);
  expect(await page.locator('.importer-modal-card img').count()).toBe(0);
  expect(await page.evaluate(() => window.__importInjection)).toBeUndefined();
  const printed = await page.evaluate(async payload => {
    const { exporter } = await import('/src/data/Exporter.js');
    const original = window.open;
    let html = '';
    window.open = () => ({ document: { open() {}, write(value) { html = value; }, close() {} } });
    let success;
    try {
      success = exporter.exportSongbookPDF({ title: payload, songs: [{ title: payload, artist: payload,
        key: payload, tempo: payload, capo: payload, chords: [payload], lyricsChords: '<script>window.opener.__printInjection=1</script>' }] });
    } finally { window.open = original; }
    const document = new DOMParser().parseFromString(html, 'text/html');
    return { success, images: document.querySelectorAll('img').length, scripts: document.querySelectorAll('script').length,
      title: document.querySelector('.cover-title').textContent, lyrics: document.querySelector('.song-lyrics-body').textContent };
  }, payload);
  expect(printed.success).toBe(true);
  expect(printed.images).toBe(0);
  expect(printed.scripts).toBe(1); // Only the application's own print-on-load script.
  expect(printed.title).toBe(payload);
  expect(printed.lyrics).toBe('<script>window.opener.__printInjection=1</script>');
});

function midiNotes(bytes) {
  const notes = [];
  const endEvents = [];
  let cursor = 14;
  while (cursor < bytes.length) {
    const length = bytes.readUInt32BE(cursor + 4);
    const end = cursor + 8 + length;
    cursor += 8;
    let tick = 0;
    let running = 0;
    const variable = () => { let value = 0; let byte; do { byte = bytes[cursor++]; value = (value << 7) | (byte & 127); } while (byte & 128); return value; };
    while (cursor < end) {
      tick += variable();
      let status = bytes[cursor];
      if (status & 128) { cursor += 1; if (status < 240) running = status; }
      else status = running;
      if (status === 255) { const type = bytes[cursor++]; const size = variable(); if (type === 47) endEvents.push(tick); cursor += size; }
      else if (status === 240 || status === 247) cursor += variable();
      else { const key = bytes[cursor++]; if ((status & 240) !== 192 && (status & 240) !== 208) { const velocity = bytes[cursor++]; if ((status & 240) === 144 && velocity > 0) notes.push({ key, tick, velocity }); } }
    }
  }
  return { notes, endEvents };
}

test('MIDI export contains the loaded score notes and MusicXML reports unavailable without a placeholder download', async ({ page }) => {
  await openApp(page);
  await page.evaluate(async () => {
    const { audioEngine } = await import('/src/core/AudioEngineV2.js');
    audioEngine.api.tex('\\title "Export note reference"\n\\artist "Workflow regression"\n\\tempo 120\n.\n0.6.4 2.6.4 3.6.4 5.6.4 |');
  });
  await expect.poll(() => page.evaluate(async () => {
    const { audioEngine } = await import('/src/core/AudioEngineV2.js');
    return audioEngine.api?.score?.title;
  })).toBe('Export note reference');
  const downloaded = page.waitForEvent('download');
  expect(await page.evaluate(async () => (await import('/src/data/Exporter.js')).exporter.exportMIDI())).toBe(true);
  const download = await downloaded;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  expect(bytes.subarray(0, 4).toString()).toBe('MThd');
  const parsed = midiNotes(bytes);
  expect(parsed.notes.map(note => note.key)).toEqual([40, 42, 43, 45]);
  expect(parsed.notes.map(note => note.tick)).toEqual([0, 960, 1920, 2880]);
  expect(parsed.endEvents[0]).toBeGreaterThan(parsed.notes.at(-1).tick);
  const unavailable = await page.evaluate(async () => {
    const { exporter } = await import('/src/data/Exporter.js');
    const original = exporter._downloadBlob;
    let downloads = 0;
    exporter._downloadBlob = () => { downloads += 1; };
    let result;
    try { result = exporter.exportMusicXML(); } finally { exporter._downloadBlob = original; }
    const { events } = await import('/src/core/EventBus.js');
    events.emit('ui:toggleExportModal');
    return { result, downloads };
  });
  expect(unavailable).toEqual({ result: false, downloads: 0 });
  await expect(page.locator('#btnExportOptionXml')).toBeDisabled();
});
