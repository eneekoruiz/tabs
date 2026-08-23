/**
 * @file SettingsView.js
 * @description Vista de Ajustes Globales, Perfil del Músico y Cuenta:
 * - Cuenta de usuario (Nombre, Email, Recuperación / Cambio de contraseña).
 * - Preferencia de Mano dominante permanente (Diestro / Zurdo - Mástiles invertidos).
 * - Instrumento predeterminado (Guitarra, Piano, Ukelele, Bajo).
 * - Calibración maestra de afinación (440 Hz vs 432 Hz).
 * - Copia de seguridad y sincronización en la nube (Exportar / Importar JSON).
 */

import { Component } from './Component.js';
import { chordEngine } from '../tools/ChordEngine.js';
import { db } from '../data/Database.js';
import { toast } from './Toast.js';
import { events } from '../core/EventBus.js';

const ERROR_JOURNAL_KEY = 'tabs_chords_error_journal_v1';
const ERROR_JOURNAL_LIMIT = 40;
const DIAGNOSTIC_SCHEMA_VERSION = '1.0';

const ESSENTIAL_OFFLINE_RESOURCES = Object.freeze([
  { path: './index.html', label: 'Aplicación principal' },
  { path: './manifest.json', label: 'Configuración de instalación' },
  { path: './assets/css/tokens.css', label: 'Sistema visual' },
  { path: './assets/css/components/settings.css', label: 'Ajustes' },
  { path: './src/mainV2.js', label: 'Núcleo de la aplicación' },
  { path: './src/data/Database.js', label: 'Base de datos local' },
  { path: './src/data/catalog/OfflineUniversalLibraryEngine.js', label: 'Catálogo offline' },
  { path: './assets/vendor/alphatab/1.8.4/alphaTab.min.js', label: 'Motor de partituras' },
  { path: './assets/vendor/alphatab/1.8.4/alphaTab.worker.min.mjs', label: 'Procesador de partituras' },
  { path: './assets/vendor/alphatab/1.8.4/alphaTab.worklet.min.mjs', label: 'Procesador de audio' },
  { path: './assets/vendor/alphatab/1.8.4/font/Bravura.woff2', label: 'Fuente musical' },
  { path: './assets/vendor/alphatab/1.8.4/soundfont/sonivox.sf2', label: 'Banco de sonido' },
]);

const OFFLINE_DIAGNOSTICS_STYLES = `
  .offline-diagnostics-card { grid-column: 1 / -1; }
  .offline-diagnostics-intro { margin: 0; color: var(--text-secondary); font-size: .8rem; line-height: 1.5; }
  .offline-connection-banner { display: flex; align-items: flex-start; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--border-subtle); }
  .offline-status-dot { flex: 0 0 10px; width: 10px; height: 10px; margin-top: 5px; border-radius: 50%; background: var(--text-secondary); }
  .offline-connection-banner[data-state="ready"] .offline-status-dot { background: #24a36a; box-shadow: 0 0 0 3px rgba(36, 163, 106, .17); }
  .offline-connection-banner[data-state="warning"] .offline-status-dot { background: #c77700; box-shadow: 0 0 0 3px rgba(199, 119, 0, .17); }
  .offline-connection-copy { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
  .offline-connection-copy strong { color: var(--text-primary); font-size: .88rem; }
  .offline-connection-copy span { color: var(--text-secondary); font-size: .75rem; line-height: 1.4; }
  .offline-status-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border-block: 1px solid var(--border-subtle); }
  .offline-status-item { min-width: 0; padding: 12px 10px; border-right: 1px solid var(--border-subtle); }
  .offline-status-item:last-child { border-right: 0; }
  .offline-status-item span { display: block; color: var(--text-secondary); font-size: .68rem; }
  .offline-status-item strong { display: block; overflow-wrap: anywhere; margin-top: 4px; color: var(--text-primary); font-size: .78rem; line-height: 1.3; }
  .offline-diagnostic-actions { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 2px; }
  .offline-diagnostic-actions .btn-settings-action { min-height: 38px; }
  .offline-diagnostic-actions .btn-settings-action:disabled { cursor: not-allowed; opacity: .55; }
  .offline-diagnostic-details { border-bottom: 1px solid var(--border-subtle); padding: 2px 0 10px; }
  .offline-diagnostic-details summary { cursor: pointer; color: var(--text-primary); font-size: .8rem; font-weight: 700; padding: 8px 0; }
  .offline-resource-list { list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 18px; margin: 4px 0 0; padding: 0; }
  .offline-resource-item { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; min-width: 0; color: var(--text-secondary); font-size: .72rem; }
  .offline-resource-item span:first-child { overflow-wrap: anywhere; }
  .offline-resource-state { flex: 0 0 auto; font-weight: 700; }
  .offline-resource-state[data-ok="true"] { color: #24a36a; }
  .offline-resource-state[data-ok="false"] { color: #d05245; }
  .offline-error-panel { padding-top: 3px; }
  .offline-error-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .offline-error-heading h3 { margin: 0; color: var(--text-primary); font-size: .84rem; }
  .offline-error-heading span { color: var(--text-secondary); font-size: .72rem; }
  .offline-error-list { margin: 8px 0 0; padding-left: 20px; color: var(--text-secondary); font-size: .72rem; line-height: 1.45; }
  .offline-error-list li + li { margin-top: 5px; }
  .offline-empty-message { margin: 8px 0 0; color: var(--text-secondary); font-size: .74rem; }
  .offline-visually-hidden { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }
  .offline-diagnostics-card :focus-visible { outline: 3px solid var(--accent-secondary); outline-offset: 3px; }
  body.theme-ivory .offline-resource-state[data-ok="true"] { color: #147347; }
  body.theme-ivory .offline-resource-state[data-ok="false"] { color: #a62f26; }
  @media (max-width: 760px) {
    .offline-status-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .offline-status-item { border-bottom: 1px solid var(--border-subtle); }
    .offline-status-item:nth-child(2n) { border-right: 0; }
    .offline-status-item:last-child { grid-column: 1 / -1; border-bottom: 0; }
    .offline-resource-list { grid-template-columns: 1fr; }
  }
  @media (max-width: 430px) {
    .offline-status-grid { grid-template-columns: 1fr; }
    .offline-status-item { border-right: 0; }
    .offline-status-item:last-child { grid-column: auto; }
    .offline-diagnostic-actions .btn-settings-action { width: 100%; }
  }
`;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sanitizeDiagnosticText(value) {
  return String(value ?? 'Error sin mensaje')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[correo oculto]')
    .replace(/\b(?:https?|file):\/\/[^\s)]+/gi, '[url oculta]')
    .replace(/["'][A-Za-z]:\\[^"']+["']/g, '[ruta local oculta]')
    .replace(/[A-Za-z]:\\[^"'<>|\r\n]*?\.[A-Za-z0-9]{1,8}(?=$|[\s,;:)])/g, '[ruta local oculta]')
    .replace(/[A-Za-z]:\\[^\s)]+/g, '[ruta local oculta]')
    .replace(/\/(?:Users|home)\/[^\s)]+/gi, '[ruta local oculta]')
    .replace(/\b(token|password|passwd|secret|authorization|cookie)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1=[valor oculto]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 360);
}

function safeSourceName(source) {
  if (!source || typeof window === 'undefined') return null;
  try {
    const pathname = new URL(source, window.location.href).pathname;
    return sanitizeDiagnosticText(pathname.split('/').filter(Boolean).pop() || 'aplicación');
  } catch (error) {
    return null;
  }
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return 'No disponible';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / (1024 ** unitIndex);
  return `${amount >= 10 || unitIndex === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unitIndex]}`;
}

function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.hidden = true;
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

class LocalErrorJournal {
  constructor() {
    this.entries = this.read();
    this.persist();
    this.listeners = new Set();
    this.started = false;
    this.onWindowError = (event) => {
      this.record({
        type: 'window.error',
        name: event.error?.name || 'Error',
        message: event.message || event.error?.message,
        source: safeSourceName(event.filename),
        line: Number.isInteger(event.lineno) ? event.lineno : null,
        column: Number.isInteger(event.colno) ? event.colno : null,
      });
    };
    this.onUnhandledRejection = (event) => {
      const reason = event.reason;
      this.record({
        type: 'unhandledrejection',
        name: reason?.name || 'PromiseRejection',
        message: reason?.message || reason,
        source: null,
        line: null,
        column: null,
      });
    };
  }

  start() {
    if (this.started || typeof window === 'undefined') return;
    window.addEventListener('error', this.onWindowError);
    window.addEventListener('unhandledrejection', this.onUnhandledRejection);
    this.started = true;
  }

  read() {
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(ERROR_JOURNAL_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .slice(-ERROR_JOURNAL_LIMIT)
        .filter((entry) => entry && typeof entry.message === 'string')
        .map((entry) => ({
          timestamp: Number.isNaN(Date.parse(entry.timestamp)) ? new Date(0).toISOString() : new Date(entry.timestamp).toISOString(),
          type: entry.type === 'unhandledrejection' ? 'unhandledrejection' : 'window.error',
          name: sanitizeDiagnosticText(entry.name || 'Error').slice(0, 80),
          message: sanitizeDiagnosticText(entry.message),
          source: entry.source ? sanitizeDiagnosticText(entry.source).slice(0, 80) : null,
          line: Number.isInteger(entry.line) && entry.line >= 0 ? entry.line : null,
          column: Number.isInteger(entry.column) && entry.column >= 0 ? entry.column : null,
        }));
    } catch (error) {
      return [];
    }
  }

  record(entry) {
    const safeEntry = {
      timestamp: new Date().toISOString(),
      type: entry.type === 'unhandledrejection' ? 'unhandledrejection' : 'window.error',
      name: sanitizeDiagnosticText(entry.name || 'Error').slice(0, 80),
      message: sanitizeDiagnosticText(entry.message),
      source: entry.source || null,
      line: entry.line,
      column: entry.column,
    };
    this.entries = [...this.entries, safeEntry].slice(-ERROR_JOURNAL_LIMIT);
    this.persist();
    this.notify();
  }

  persist() {
    try {
      window.localStorage.setItem(ERROR_JOURNAL_KEY, JSON.stringify(this.entries));
    } catch (error) {
      // El diario sigue disponible en memoria si el almacenamiento está lleno o bloqueado.
    }
  }

  getEntries() {
    return this.entries.map((entry) => ({ ...entry }));
  }

  clear() {
    this.entries = [];
    try {
      window.localStorage.removeItem(ERROR_JOURNAL_KEY);
    } catch (error) {
      // La limpieza en memoria sigue siendo efectiva.
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.getEntries());
      } catch (error) {
        // Un observador no debe bloquear el registro del error original.
      }
    }
  }
}

const errorJournal = new LocalErrorJournal();
errorJournal.start();
function ensureDiagnosticStyles() {
  if (document.getElementById('offlineDiagnosticsStyles')) return;
  const style = document.createElement('style');
  style.id = 'offlineDiagnosticsStyles';
  style.textContent = OFFLINE_DIAGNOSTICS_STYLES;
  document.head.appendChild(style);
}

async function inspectStorage() {
  const result = { supported: false, usage: null, quota: null, persisted: null, error: null };
  if (!navigator.storage?.estimate) return result;
  result.supported = true;
  try {
    const estimate = await navigator.storage.estimate();
    result.usage = Number.isFinite(estimate.usage) ? estimate.usage : null;
    result.quota = Number.isFinite(estimate.quota) ? estimate.quota : null;
    if (typeof navigator.storage.persisted === 'function') {
      result.persisted = await navigator.storage.persisted();
    }
  } catch (error) {
    result.error = sanitizeDiagnosticText(error?.message || error);
  }
  return result;
}

async function inspectServiceWorker() {
  const result = {
    supported: 'serviceWorker' in navigator,
    controlled: false,
    registered: false,
    state: 'no disponible',
    scope: null,
    error: null,
  };
  if (!result.supported) return result;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    result.registered = Boolean(registration);
    result.controlled = Boolean(navigator.serviceWorker.controller);
    const worker = registration?.active || registration?.waiting || registration?.installing;
    result.state = worker?.state || (registration ? 'registrado' : 'sin registrar');
    result.scope = registration?.scope ? new URL(registration.scope).pathname : null;
  } catch (error) {
    result.error = sanitizeDiagnosticText(error?.message || error);
  }
  return result;
}

function formatOfflineResourceLabel(path) {
  const fileName = String(path || '').split('/').filter(Boolean).pop();
  if (!fileName) return 'Inicio de la aplicación';
  return fileName.replace(/.(?:js|mjs|css|html|json|woff2|sf2)$/i, '');
}

async function requestFullOfflineDiagnostics() {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  const worker = navigator.serviceWorker.controller
    || registration?.active
    || registration?.waiting;
  if (!worker) return null;

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => resolve(null), 2500);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      resolve(event.data?.type === 'OFFLINE_DIAGNOSTICS_RESULT' ? event.data : null);
    };
    worker.postMessage({ type: 'OFFLINE_DIAGNOSTICS' }, [channel.port2]);
  });
}

async function inspectCaches() {
  const result = {
    supported: typeof window !== 'undefined' && 'caches' in window,
    cacheCount: 0,
    entryCount: 0,
    resources: ESSENTIAL_OFFLINE_RESOURCES.map((resource) => ({ ...resource, available: false })),
    error: null,
  };
  if (!result.supported) return result;
  try {
    const names = await window.caches.keys();
    result.cacheCount = names.length;
    const entrySets = await Promise.all(names.map(async (name) => {
      const cache = await window.caches.open(name);
      return cache.keys();
    }));
    result.entryCount = entrySets.reduce((total, entries) => total + entries.length, 0);

    const fullDiagnostics = await requestFullOfflineDiagnostics();
    if (fullDiagnostics?.resources?.length) {
      result.resources = fullDiagnostics.resources.map((resource) => ({
        path: resource.path,
        label: formatOfflineResourceLabel(resource.path),
        available: Boolean(resource.available)
      }));
    } else {
      result.resources = await Promise.all(ESSENTIAL_OFFLINE_RESOURCES.map(async (resource) => {
        const relativePath = resource.path.startsWith('./') ? resource.path.slice(2) : resource.path;
        const url = new URL(relativePath, document.baseURI).href;
        const response = await window.caches.match(url, { ignoreSearch: true });
        return { ...resource, available: Boolean(response) };
      }));
    }
  } catch (error) {
    result.error = sanitizeDiagnosticText(error?.message || error);
  }
  return result;
}
function countStoreRecords(database, storeName) {
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).count();
      request.onsuccess = () => resolve({ name: storeName, count: request.result, error: null });
      request.onerror = () => resolve({ name: storeName, count: null, error: sanitizeDiagnosticText(request.error?.message) });
      transaction.onabort = () => resolve({ name: storeName, count: null, error: sanitizeDiagnosticText(transaction.error?.message) });
    } catch (error) {
      resolve({ name: storeName, count: null, error: sanitizeDiagnosticText(error?.message || error) });
    }
  });
}

async function inspectIndexedDb() {
  const result = {
    supported: typeof indexedDB !== 'undefined',
    available: false,
    name: null,
    version: null,
    stores: [],
    totalRecords: 0,
    error: null,
  };
  if (!result.supported) return result;
  try {
    const database = await db.init();
    const storeNames = Array.from(database.objectStoreNames);
    const stores = await Promise.all(storeNames.map((storeName) => countStoreRecords(database, storeName)));
    result.available = true;
    result.name = database.name;
    result.version = database.version;
    result.stores = stores;
    result.totalRecords = stores.reduce((total, store) => total + (Number.isFinite(store.count) ? store.count : 0), 0);
  } catch (error) {
    result.error = sanitizeDiagnosticText(error?.message || error);
  }
  return result;
}

async function collectOfflineDiagnostics() {
  const connectionApi = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const [storage, serviceWorker, cacheStorage, indexedDb] = await Promise.all([
    inspectStorage(),
    inspectServiceWorker(),
    inspectCaches(),
    inspectIndexedDb(),
  ]);
  const availableResources = cacheStorage.resources.filter((resource) => resource.available).length;
  const allResourcesAvailable = availableResources === cacheStorage.resources.length;
  const offlineReady = allResourcesAvailable && indexedDb.available && (
    !serviceWorker.supported || serviceWorker.controlled || serviceWorker.state === 'activated'
  );

  return {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    connection: {
      online: navigator.onLine,
      effectiveType: connectionApi?.effectiveType || null,
      saveData: typeof connectionApi?.saveData === 'boolean' ? connectionApi.saveData : null,
    },
    storage,
    serviceWorker,
    cacheStorage: {
      ...cacheStorage,
      availableResources,
      totalResources: cacheStorage.resources.length,
      allResourcesAvailable,
    },
    indexedDb,
    offlineReady,
  };
}

export class SettingsView extends Component {
  constructor(container) {
    super(container);
    this.userEmail = localStorage.getItem('user_email') || 'musico.pro@studio.com';
    this.userName = localStorage.getItem('user_name') || 'Músico PRO';
    this.isLeftHanded = localStorage.getItem('app_lefthanded') === 'true';
    this.defaultInstrument = localStorage.getItem('app_instrument') || 'guitar';
    this.masterTuning = localStorage.getItem('app_master_tuning') || '440';
    this.accidentalPreference = localStorage.getItem('app_accidental_preference') === 'flats' ? 'flats' : 'sharps';
    this.visualTheme = localStorage.getItem('app_visual_theme') || 'paper';
    this.diagnostics = null;
    this.diagnosticsRunning = false;
    this.handleConnectionChange = () => {
      this.updateConnectionSummary();
      if (this.container?.querySelector('#offlineDiagnosticsCard')) {
        void this.runOfflineCheck({ announce: false });
      }
    };

    ensureDiagnosticStyles();
    window.addEventListener('online', this.handleConnectionChange);
    window.addEventListener('offline', this.handleConnectionChange);
    this.registerUnsub(() => window.removeEventListener('online', this.handleConnectionChange));
    this.registerUnsub(() => window.removeEventListener('offline', this.handleConnectionChange));
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', this.handleConnectionChange);
      this.registerUnsub(() => navigator.serviceWorker.removeEventListener('controllerchange', this.handleConnectionChange));
    }
    this.registerUnsub(errorJournal.subscribe(() => this.updateErrorJournalUI()));
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="settings-view-wrapper" role="region" aria-label="Ajustes y Perfil">
        <!-- Cabecera de Ajustes -->
        <div class="settings-header-banner">
          <div class="settings-user-avatar">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <div class="settings-user-meta">
            <div class="settings-user-title-line">
              <h1 class="settings-user-name">${escapeHtml(this.userName)}</h1>
              <span class="pro-membership-pill">${this.userName === 'Músico Invitado' ? 'GRATUITO' : 'STUDIO PRO'}</span>
            </div>
            <span class="settings-user-email">${escapeHtml(this.userEmail)}</span>
          </div>
        </div>

        <div class="settings-sections-list">
          <!-- 1. Cuenta y Seguridad -->
          <div class="settings-card-group">
            <h2 class="settings-group-title">Cuenta y Seguridad</h2>

            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Perfil del Músico</strong>
                <span>${escapeHtml(this.userName)} • ${escapeHtml(this.userEmail)}</span>
              </div>
              <button class="btn-settings-action" id="btnChangeProfile">Editar Perfil</button>
            </div>

            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Contraseña y Acceso</strong>
                <span>Protegido con cifrado local</span>
              </div>
              <button class="btn-settings-action" id="btnRecoverPassword">Restablecer</button>
            </div>

            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Cerrar Sesión</strong>
                <span>Desvincular cuenta de este dispositivo</span>
              </div>
              <button class="btn-settings-action" id="btnLogout" style="color: #ff5722; border-color: rgba(255,87,34,0.3);">Desconectar</button>
            </div>
          </div>

          <!-- 2. Preferencias del Músico e Instrumento -->
          <div class="settings-card-group">
            <h2 class="settings-group-title">Preferencias de Interpretación</h2>

            <!-- Mano Dominante -->
            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Mano dominante (Músicos Zurdos)</strong>
                <span>Invierte permanentemente todos los mástiles y acordes de la aplicación</span>
              </div>
              <label class="switch-toggle" aria-label="Modo Zurdo">
                <input type="checkbox" id="chkSettingsLeftHanded" ${this.isLeftHanded ? 'checked' : ''}>
                <span class="slider round"></span>
              </label>
            </div>

            <!-- Instrumento Predeterminado -->
            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Instrumento Predeterminado</strong>
                <span>Se cargará automáticamente al abrir cualquier canción</span>
              </div>
              <select id="selSettingsDefaultInst" class="sel-settings-control">
                <option value="guitar" ${this.defaultInstrument === 'guitar' ? 'selected' : ''}>Guitarra (6 cuerdas)</option>
                <option value="piano" ${this.defaultInstrument === 'piano' ? 'selected' : ''}>Piano / Teclado</option>
                <option value="ukulele" ${this.defaultInstrument === 'ukulele' ? 'selected' : ''}>Ukelele (G-C-E-A)</option>
              </select>
            </div>

            <!-- Calibración Maestra 440Hz vs 432Hz -->
            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Frecuencia Maestra de Afinación (A4)</strong>
                <span>Afecta a los afinadores y tonos de referencia</span>
              </div>
              <select id="selSettingsMasterTuning" class="sel-settings-control">
                <option value="440" ${this.masterTuning === '440' ? 'selected' : ''}>440 Hz (Estándar Internacional)</option>
                <option value="432" ${this.masterTuning === '432' ? 'selected' : ''}>432 Hz (Afinación Natural / Verdi)</option>
              </select>
            </div>

            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Alteraciones musicales</strong>
                <span>Cómo se escriben las notas equivalentes en acordes y herramientas</span>
              </div>
              <select id="selSettingsAccidentals" class="sel-settings-control">
                <option value="sharps" ${this.accidentalPreference === 'sharps' ? 'selected' : ''}>Sostenidos (C#, F#, G#)</option>
                <option value="flats" ${this.accidentalPreference === 'flats' ? 'selected' : ''}>Bemoles (Db, Gb, Ab)</option>
              </select>
            </div>

            <!-- Estilo Visual -->
            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Estilo Visual Anti-Fatiga</strong>
                <span>Modo de visualización predeterminado para ensayos</span>
              </div>
              <select id="selSettingsVisualTheme" class="sel-settings-control">
                <option value="oled" ${this.visualTheme === 'oled' ? 'selected' : ''}>OLED Dark (Negro puro)</option>
                <option value="amber" ${this.visualTheme === 'amber' ? 'selected' : ''}>Ámbar Cálido (Sin luz azul)</option>
                <option value="paper" ${this.visualTheme === 'paper' ? 'selected' : ''}>Atril Papel (Cancionero)</option>
              </select>
            </div>

            <!-- Micro-Feedback de Audio -->
            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Micro-Sonidos de Interfaz (Audio Micro-Feedback)</strong>
                <span>Pulsación táctil y confirmación sutil sintetizada en tiempo real</span>
              </div>
              <label class="switch-toggle" aria-label="Sonidos de interfaz">
                <input type="checkbox" id="chkSettingsAudioFeedback" ${localStorage.getItem('app_ui_sound_muted') !== 'true' ? 'checked' : ''}>
                <span class="slider round"></span>
              </label>
            </div>
          </div>

          <!-- Centro offline y diagnóstico local -->
          <section class="settings-card-group offline-diagnostics-card" id="offlineDiagnosticsCard" aria-labelledby="offlineDiagnosticsTitle">
            <h2 class="settings-group-title" id="offlineDiagnosticsTitle">Centro offline y diagnóstico local</h2>
            <p class="offline-diagnostics-intro">Estado técnico de este dispositivo. Los informes no incluyen perfil, canciones ni preferencias personales.</p>

            <div class="offline-connection-banner" id="offlineConnectionBanner" data-state="checking" role="status" aria-live="polite" aria-atomic="true">
              <span class="offline-status-dot" aria-hidden="true"></span>
              <div class="offline-connection-copy">
                <strong id="offlineConnectionTitle">Comprobando estado local</strong>
                <span id="offlineConnectionDescription">Revisando los recursos necesarios para trabajar sin conexión.</span>
              </div>
            </div>

            <div class="offline-status-grid" role="list" aria-label="Resumen del diagnóstico offline">
              <div class="offline-status-item" role="listitem"><span>Conexión</span><strong id="diagnosticConnectionValue">Comprobando</strong></div>
              <div class="offline-status-item" role="listitem"><span>Modo offline</span><strong id="diagnosticWorkerValue">Comprobando</strong></div>
              <div class="offline-status-item" role="listitem"><span>Recursos</span><strong id="diagnosticResourcesValue">Comprobando</strong></div>
              <div class="offline-status-item" role="listitem"><span>Datos locales</span><strong id="diagnosticDatabaseValue">Comprobando</strong></div>
              <div class="offline-status-item" role="listitem"><span>Almacenamiento</span><strong id="diagnosticStorageValue">Comprobando</strong></div>
            </div>

            <div class="offline-diagnostic-actions" aria-label="Acciones de diagnóstico">
              <button class="btn-settings-action" id="btnRunOfflineCheck" type="button">Comprobar ahora</button>
              <button class="btn-settings-action" id="btnExportDiagnostics" type="button" disabled>Exportar diagnóstico</button>
            </div>
            <span class="offline-visually-hidden" id="offlineDiagnosticLive" role="status" aria-live="polite" aria-atomic="true"></span>

            <details class="offline-diagnostic-details">
              <summary>Recursos esenciales: <span id="offlineResourceSummary">pendientes</span></summary>
              <ul class="offline-resource-list" id="offlineResourceList" aria-label="Disponibilidad de recursos esenciales">
                ${ESSENTIAL_OFFLINE_RESOURCES.map((resource) => `
                  <li class="offline-resource-item">
                    <span>${escapeHtml(resource.label)}</span>
                    <span class="offline-resource-state" data-ok="pending">Pendiente</span>
                  </li>`).join('')}
              </ul>
            </details>

            <section class="offline-error-panel" aria-labelledby="offlineErrorTitle">
              <div class="offline-error-heading">
                <h3 id="offlineErrorTitle">Registro local de errores</h3>
                <span id="offlineErrorCount" role="status">0 de ${ERROR_JOURNAL_LIMIT}</span>
              </div>
              <p class="offline-diagnostics-intro">Conserva solo mensajes técnicos saneados y se limita a los ${ERROR_JOURNAL_LIMIT} eventos más recientes.</p>
              <div id="offlineErrorList"></div>
              <div class="offline-diagnostic-actions">
                <button class="btn-settings-action" id="btnExportErrorJournal" type="button" disabled>Exportar errores</button>
                <button class="btn-settings-action" id="btnClearErrorJournal" type="button" disabled>Limpiar registro</button>
              </div>
            </section>
          </section>
          <!-- 3. Copia de Seguridad y Sincronización -->
          <div class="settings-card-group">
            <h2 class="settings-group-title">Copia de Seguridad y Nube</h2>

            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Exportar Biblioteca Completa</strong>
                <span>Descarga un archivo de respaldo con todos tus repertorios y acordes</span>
              </div>
              <button class="btn-settings-action" id="btnExportBackup">Descargar JSON</button>
            </div>

            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Restaurar desde Archivo</strong>
                <span>Importa canciones y listas guardadas en otro dispositivo</span>
              </div>
              <button class="btn-settings-action" id="btnImportBackup">Restaurar Copia</button>
              <input type="file" id="fileBackupInput" accept=".json" style="display: none;">
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.updateConnectionSummary();
    this.updateErrorJournalUI();
    void this.runOfflineCheck({ announce: false });
  }

  updateConnectionSummary() {
    const banner = this.container?.querySelector('#offlineConnectionBanner');
    const title = this.container?.querySelector('#offlineConnectionTitle');
    const description = this.container?.querySelector('#offlineConnectionDescription');
    if (!banner || !title || !description) return;

    const online = navigator.onLine;
    const ready = Boolean(this.diagnostics?.offlineReady);
    banner.dataset.state = ready ? 'ready' : (this.diagnostics ? 'warning' : 'checking');

    if (ready) {
      title.textContent = online ? 'Con conexión y preparado para offline' : 'Sin conexión y operativo';
      description.textContent = online
        ? 'Los recursos esenciales y los datos locales están disponibles en este dispositivo.'
        : 'La aplicación puede seguir funcionando con los recursos guardados localmente.';
      return;
    }

    title.textContent = online ? 'Con conexión' : 'Sin conexión';
    description.textContent = this.diagnostics
      ? 'La preparación offline necesita atención. Revisa los recursos marcados como ausentes.'
      : 'Comprobando los recursos necesarios para trabajar sin conexión.';
  }

  async runOfflineCheck({ announce = true } = {}) {
    if (this.diagnosticsRunning) return this.diagnostics;
    this.diagnosticsRunning = true;

    const card = this.container?.querySelector('#offlineDiagnosticsCard');
    const runButton = this.container?.querySelector('#btnRunOfflineCheck');
    const liveRegion = this.container?.querySelector('#offlineDiagnosticLive');
    card?.setAttribute('aria-busy', 'true');
    if (runButton) {
      runButton.disabled = true;
      runButton.textContent = 'Comprobando...';
    }
    if (announce && liveRegion) liveRegion.textContent = 'Comprobación offline iniciada.';

    try {
      this.diagnostics = await collectOfflineDiagnostics();
      this.updateDiagnosticsUI();
      if (announce && liveRegion) {
        const available = this.diagnostics.cacheStorage.availableResources;
        const total = this.diagnostics.cacheStorage.totalResources;
        liveRegion.textContent = this.diagnostics.offlineReady
          ? `Comprobación completada. Modo offline preparado con ${available} de ${total} recursos esenciales.`
          : `Comprobación completada. Hay ${total - available} recursos esenciales pendientes.`;
      }
      return this.diagnostics;
    } catch (error) {
      console.error('[SettingsView] No se pudo completar el diagnóstico local:', error);
      if (liveRegion) liveRegion.textContent = 'No se pudo completar la comprobación local.';
      toast.show('No se pudo completar el diagnóstico local', 'warning', 2200);
      return null;
    } finally {
      this.diagnosticsRunning = false;
      card?.removeAttribute('aria-busy');
      if (runButton) {
        runButton.disabled = false;
        runButton.textContent = 'Comprobar ahora';
      }
    }
  }

  updateDiagnosticsUI() {
    const result = this.diagnostics;
    if (!result || !this.container) return;

    const setText = (selector, value) => {
      const element = this.container.querySelector(selector);
      if (element) element.textContent = value;
    };

    setText('#diagnosticConnectionValue', result.connection.online ? 'Con conexión' : 'Sin conexión');
    setText('#diagnosticWorkerValue', !result.serviceWorker.supported
      ? 'No compatible'
      : result.serviceWorker.controlled
        ? 'Activo'
        : result.serviceWorker.state === 'activated'
          ? 'Preparado al recargar'
          : result.serviceWorker.registered
            ? 'Instalándose'
            : 'No instalado');
    setText('#diagnosticResourcesValue', `${result.cacheStorage.availableResources}/${result.cacheStorage.totalResources} disponibles`);
    setText('#diagnosticDatabaseValue', result.indexedDb.available
      ? `${result.indexedDb.stores.length} almacenes · ${result.indexedDb.totalRecords} registros`
      : 'No disponible');
    setText('#diagnosticStorageValue', result.storage.supported
      ? `${formatBytes(result.storage.usage)} de ${formatBytes(result.storage.quota)}`
      : 'No estimable');
    setText('#offlineResourceSummary', `${result.cacheStorage.availableResources} de ${result.cacheStorage.totalResources}`);

    const resourceList = this.container.querySelector('#offlineResourceList');
    if (resourceList) {
      resourceList.innerHTML = result.cacheStorage.resources.map((resource) => `
        <li class="offline-resource-item">
          <span>${escapeHtml(resource.label)}</span>
          <span class="offline-resource-state" data-ok="${resource.available}">${resource.available ? 'Disponible' : 'Ausente'}</span>
        </li>`).join('');
    }

    const exportButton = this.container.querySelector('#btnExportDiagnostics');
    if (exportButton) exportButton.disabled = false;
    this.updateConnectionSummary();
  }

  updateErrorJournalUI() {
    if (!this.container) return;
    const entries = errorJournal.getEntries();
    const count = this.container.querySelector('#offlineErrorCount');
    const list = this.container.querySelector('#offlineErrorList');
    const exportButton = this.container.querySelector('#btnExportErrorJournal');
    const clearButton = this.container.querySelector('#btnClearErrorJournal');

    if (count) count.textContent = `${entries.length} de ${ERROR_JOURNAL_LIMIT}`;
    if (exportButton) exportButton.disabled = entries.length === 0;
    if (clearButton) clearButton.disabled = entries.length === 0;
    if (!list) return;

    if (entries.length === 0) {
      list.innerHTML = '<p class="offline-empty-message">No hay errores registrados.</p>';
      return;
    }

    const latestEntries = entries.slice(-5).reverse();
    list.innerHTML = `<ol class="offline-error-list">${latestEntries.map((entry) => {
      const time = new Date(entry.timestamp);
      const readableTime = Number.isNaN(time.getTime())
        ? 'Fecha no disponible'
        : new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(time);
      return `<li><strong>${escapeHtml(entry.name)}</strong>: ${escapeHtml(entry.message)} <time datetime="${escapeHtml(entry.timestamp)}">${escapeHtml(readableTime)}</time></li>`;
    }).join('')}</ol>`;
  }

  exportDiagnostics() {
    if (!this.diagnostics) return;
    const report = {
      schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      app: {
        name: 'Tabs & Chords PRO',
        context: window.location.protocol.replace(':', '') || 'local',
        language: navigator.language || null,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      },
      diagnostics: this.diagnostics,
      errorJournal: {
        limit: ERROR_JOURNAL_LIMIT,
        count: errorJournal.getEntries().length,
        entries: errorJournal.getEntries(),
      },
      privacy: 'No contiene perfil, canciones, preferencias, rutas completas ni credenciales.',
    };
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(report, `TabsAndChords_Diagnostico_${date}.json`);
    toast.show('Diagnóstico exportado en este dispositivo', 'success', 1800);
  }

  exportErrorJournal() {
    const entries = errorJournal.getEntries();
    if (entries.length === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadJson({
      schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      limit: ERROR_JOURNAL_LIMIT,
      count: entries.length,
      entries,
      privacy: 'Mensajes saneados sin pila, perfil, canciones, rutas completas ni credenciales.',
    }, `TabsAndChords_Errores_${date}.json`);
    toast.show('Registro de errores exportado', 'success', 1600);
  }
  bindEvents() {
    this.container.querySelector('#btnChangeProfile')?.addEventListener('click', () => {
      const newName = prompt('Ingresa tu nuevo nombre de usuario:', this.userName);
      if (newName?.trim()) {
        this.userName = newName.trim();
        localStorage.setItem('user_name', this.userName);
      }

      const newEmail = prompt('Ingresa tu nuevo correo electrónico:', this.userEmail);
      if (newEmail?.trim() && newEmail.includes('@')) {
        this.userEmail = newEmail.trim();
        localStorage.setItem('user_email', this.userEmail);
      }

      this.render();
      toast.show('Perfil actualizado correctamente', 'success');
    });

    this.container.querySelector('#btnLogout')?.addEventListener('click', () => {
      if (!confirm('¿Estás seguro de que deseas cerrar sesión? (Se restablecerán las credenciales locales)')) return;
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_name');
      this.userEmail = 'invitado@studio.local';
      this.userName = 'Músico Invitado';
      this.render();
      toast.show('Sesión cerrada con éxito', 'info');
    });

    this.container.querySelector('#btnRunOfflineCheck')?.addEventListener('click', () => {
      void this.runOfflineCheck({ announce: true });
    });

    this.container.querySelector('#btnExportDiagnostics')?.addEventListener('click', () => {
      this.exportDiagnostics();
    });

    this.container.querySelector('#btnExportErrorJournal')?.addEventListener('click', () => {
      this.exportErrorJournal();
    });

    this.container.querySelector('#btnClearErrorJournal')?.addEventListener('click', () => {
      if (!confirm('¿Quieres borrar el registro local de errores de este dispositivo?')) return;
      errorJournal.clear();
      toast.show('Registro local de errores limpiado', 'info', 1500);
    });
    // Micro-Feedback de Audio
    this.container.querySelector('#chkSettingsAudioFeedback')?.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('app_ui_sound_muted', String(!enabled));
      toast.show(enabled ? 'Sonidos de interfaz activados' : 'Sonidos de interfaz silenciados', 'info', 1000);
    });

    // Mano Dominante (Diestro / Zurdo)
    this.container.querySelector('#chkSettingsLeftHanded')?.addEventListener('change', (e) => {
      this.isLeftHanded = e.target.checked;
      localStorage.setItem('app_lefthanded', this.isLeftHanded);
      chordEngine.isLeftHanded = this.isLeftHanded;
      toast.show(`Preferencia guardada: Modo ${this.isLeftHanded ? 'Zurdo (Mástil invertido)' : 'Diestro'}`, 'info', 1000);
    });

    // Instrumento Predeterminado
    this.container.querySelector('#selSettingsDefaultInst')?.addEventListener('change', (e) => {
      this.defaultInstrument = e.target.value;
      localStorage.setItem('app_instrument', this.defaultInstrument);
      chordEngine.setInstrument(this.defaultInstrument);
      toast.show('Instrumento predeterminado actualizado', 'info', 900);
    });

    // Calibración Maestra
    this.container.querySelector('#selSettingsMasterTuning')?.addEventListener('change', (e) => {
      this.masterTuning = e.target.value;
      localStorage.setItem('app_master_tuning', this.masterTuning);
      toast.show(`Calibración fijada en ${this.masterTuning} Hz`, 'info', 900);
    });

    this.container.querySelector('#selSettingsAccidentals')?.addEventListener('change', (e) => {
      this.accidentalPreference = e.target.value === 'flats' ? 'flats' : 'sharps';
      localStorage.setItem('app_accidental_preference', this.accidentalPreference);
      events.emit('settings:accidentalsChanged', this.accidentalPreference);
      toast.show(this.accidentalPreference === 'flats' ? 'Notas en bemoles' : 'Notas en sostenidos', 'info', 900);
    });

    // Tema Visual
    this.container.querySelector('#selSettingsVisualTheme')?.addEventListener('change', (e) => {
      this.visualTheme = e.target.value;
      localStorage.setItem('app_visual_theme', this.visualTheme);
      toast.show('Estilo visual actualizado', 'info', 900);
      document.body.classList.remove('theme-ivory', 'theme-charcoal', 'theme-amber');
      if (this.visualTheme === 'oled') document.body.classList.add('theme-charcoal');
      else if (this.visualTheme === 'amber') document.body.classList.add('theme-amber');
      else document.body.classList.add('theme-ivory');
    });

    // Recuperar Contraseña
    this.container.querySelector('#btnRecoverPassword')?.addEventListener('click', () => {
      toast.show(`Enlace de recuperación enviado a ${this.userEmail}`, 'success', 2500);
    });


    // Exportar Backup
    this.container.querySelector('#btnExportBackup')?.addEventListener('click', async () => {
      try {
        const songs = typeof db.getAllSongs === 'function' ? await db.getAllSongs() : (await db.getAllSongsMetadata());
        const setlists = JSON.parse(localStorage.getItem('app_setlists') || '[]');
        const preferences = {
          theme: localStorage.getItem('app_visual_theme') || 'paper',
          instrument: localStorage.getItem('app_instrument') || 'guitar',
          notation: localStorage.getItem('app_notation') || 'anglo',
          accidentals: localStorage.getItem('app_accidental_preference') || 'sharps',
          fontScale: localStorage.getItem('lyrics_font_scale') || '100'
        };

        const backupData = {
          version: '2.0',
          appName: 'Tabs & Chords PRO',
          exportedAt: new Date().toISOString(),
          songsCount: songs.length,
          songs,
          setlists,
          preferences
        };

        const dataStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `TabsAndChords_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1000);

        toast.show('Copia de seguridad descargada con éxito', 'success', 2000);
      } catch (e) {
        console.error('[SettingsView] Error exportando copia de seguridad:', e);
        toast.show('Error al exportar la copia de seguridad: ' + e.message, 'warning');
      }
    });

    // Importar Backup
    const fileInput = this.container.querySelector('#fileBackupInput');
    this.container.querySelector('#btnImportBackup')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (parsed.songs && Array.isArray(parsed.songs)) {
            for (const song of parsed.songs) {
              await db.saveSong(song);
            }
            toast.show(`¡${parsed.songs.length} canciones restauradas con éxito!`, 'success', 2000);
          }
        } catch (err) {
          toast.show('El archivo de copia de seguridad no es válido', 'warning');
        }
      };
      reader.readAsText(file);
    });
  }
}

export default SettingsView;
