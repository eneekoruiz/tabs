/**
 * @file BackupSyncEngine.js
 * @description Copias locales de canciones, analíticas y los ajustes incluidos.
 * Conserva los bytes de las partituras. El cifrado AES-GCM es opcional y requiere contraseña.
 */

import { db } from './Database.js';
import { practiceTrackerService } from './PracticeTrackerService.js';
import { events } from '../core/EventBus.js';
import { toast } from '../ui/Toast.js';

const BACKUP_SIGNATURE = 'AGY_TABS_SECURE_V2';
const BINARY_ENCODING = 'tabs-score-base64-v1';
const VIEW_TYPES = new Set(['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array',
  'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array']);

function encodeBytes(bytes) {
  let text = '';
  for (let start = 0; start < bytes.length; start += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(text);
}

async function serializeScore(data) {
  if (data == null || typeof data === 'string') return data;
  if (data instanceof Blob) {
    return { encoding: BINARY_ENCODING, type: 'Blob', mimeType: data.type,
      value: encodeBytes(new Uint8Array(await data.arrayBuffer())) };
  }
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data)
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return { encoding: BINARY_ENCODING, type: data instanceof ArrayBuffer ? 'ArrayBuffer' : data.constructor.name,
      value: encodeBytes(bytes) };
  }
  if (Array.isArray(data) && data.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) {
    return { encoding: BINARY_ENCODING, type: 'Uint8Array', value: encodeBytes(new Uint8Array(data)) };
  }
  throw new Error('La partitura contiene datos no compatibles con una copia de seguridad.');
}

function restoreScore(data) {
  if (data == null || typeof data === 'string') return data;
  if (Array.isArray(data) && data.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) {
    return new Uint8Array(data);
  }
  if (data?.encoding !== BINARY_ENCODING || typeof data.value !== 'string' ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data.value)) {
    throw new Error('La copia contiene una partitura sin bytes recuperables o con formato no compatible.');
  }
  const binary = atob(data.value);
  const bytes = Uint8Array.from(binary, value => value.charCodeAt(0));
  if (data.type === 'ArrayBuffer') return bytes.buffer;
  if (data.type === 'Blob') return new Blob([bytes], { type: typeof data.mimeType === 'string' ? data.mimeType : '' });
  if (data.type === 'DataView') return new DataView(bytes.buffer);
  if (VIEW_TYPES.has(data.type) && typeof globalThis[data.type] === 'function') return new globalThis[data.type](bytes.buffer);
  throw new Error('La copia contiene un tipo de partitura no compatible.');
}

async function serializeSong(song) {
  if (!song || typeof song !== 'object' || Array.isArray(song) || typeof song.title !== 'string' || !song.title.trim()) {
    throw new Error('La copia contiene una canción sin título válido.');
  }
  return { ...song, data: await serializeScore(song.data),
    ...(Array.isArray(song.versions) ? { versions: await Promise.all(song.versions.map(serializeSongVersion)) } : {}),
    ...(Array.isArray(song.versionGroup?.versions) ? { versionGroup: { ...song.versionGroup,
      versions: await Promise.all(song.versionGroup.versions.map(serializeSongVersion)) } } : {}) };
}

async function serializeSongVersion(version) {
  if (!version || typeof version !== 'object' || Array.isArray(version)) return version;
  return { ...version, data: await serializeScore(version.data) };
}

function restoreSongVersion(version) {
  if (!version || typeof version !== 'object' || Array.isArray(version)) return version;
  return { ...version, data: restoreScore(version.data) };
}

function restoreSong(song) {
  if (!song || typeof song !== 'object' || Array.isArray(song) || typeof song.title !== 'string' || !song.title.trim() ||
      (song.id != null && typeof song.id !== 'string' && typeof song.id !== 'number') ||
      (typeof song.id === 'number' && !Number.isFinite(song.id))) {
    throw new Error('La copia contiene una canción no válida.');
  }
  return { ...song, data: restoreScore(song.data),
    ...(Array.isArray(song.versions) ? { versions: song.versions.map(restoreSongVersion) } : {}),
    ...(Array.isArray(song.versionGroup?.versions) ? { versionGroup: { ...song.versionGroup,
      versions: song.versionGroup.versions.map(restoreSongVersion) } } : {}) };
}

export class BackupSyncEngine {
  constructor() {
    this.crypto = window.crypto && window.crypto.subtle ? window.crypto.subtle : null;
  }

  /**
   * Genera y descarga una copia de seguridad cifrada completa en un solo clic.
   * @param {string|null} password Contraseña opcional de usuario.
   */
  async exportFullBackup(password = null) {
    try {
      toast.show(password ? 'Generando copia de seguridad cifrada...' : 'Generando copia de seguridad...', 'info');
      if (password && !this.crypto) throw new Error('El cifrado no está disponible en este navegador.');

      // 1. Recopilar todas las canciones de IndexedDB
      const songs = await Promise.all((await db.getAllSongs()).map(serializeSong));

      // 2. Recopilar analíticas de práctica
      const analytics = practiceTrackerService.exportData();

      // 3. Recopilar ajustes y preferencias de usuario
      const settings = {
        userName: localStorage.getItem('user_name') || 'Músico PRO',
        userEmail: localStorage.getItem('user_email') || 'musico.pro@studio.com',
        isLeftHanded: localStorage.getItem('app_lefthanded') === 'true',
        defaultInstrument: localStorage.getItem('app_instrument') || 'guitar',
        masterTuning: localStorage.getItem('app_master_tuning') || '440',
        visualTheme: localStorage.getItem('app_visual_theme') || 'paper'
      };

      // 4. Construir payload consolidado
      const payload = {
        signature: BACKUP_SIGNATURE,
        version: 3,
        createdAt: new Date().toISOString(),
        device: navigator.userAgent,
        data: {
          songs,
          analytics,
          settings
        }
      };

      const jsonString = JSON.stringify(payload);
      let exportBlob;
      let filename;

      if (this.crypto && password) {
        // Cifrado AES-GCM 256-bit con contraseña
        const encryptedData = await this._encryptAESGCM(jsonString, password);
        exportBlob = new Blob([JSON.stringify(encryptedData)], { type: 'application/json' });
        filename = `TabsAndChords_Encrypted_Backup_${new Date().toISOString().split('T')[0]}.agytab`;
      } else {
        // Formato seguro con firma
        exportBlob = new Blob([jsonString], { type: 'application/json' });
        filename = `TabsAndChords_Full_Backup_${new Date().toISOString().split('T')[0]}.agytab`;
      }

      // Descargar archivo
      this._triggerDownload(exportBlob, filename);
      toast.show(`Backup creado con éxito (${songs.length} canciones)`, 'success');
      return { success: true, songCount: songs.length, filename };
    } catch (err) {
      console.error('[BackupSyncEngine] Error exportando backup:', err);
      toast.show('Error al generar la copia de seguridad', 'error');
      return { success: false, error: err.message };
    }
  }

  /**
   * Importa y restaura una copia de seguridad cifrada.
   * @param {File|string} fileOrContent Archivo o texto del backup.
   * @param {string|null} password Contraseña si el archivo fue cifrado.
   */
  async importFullBackup(fileOrContent, password = null) {
    try {
      toast.show('Validando y restaurando datos...', 'info');

      let rawText;
      if (fileOrContent instanceof File || fileOrContent instanceof Blob) {
        rawText = await fileOrContent.text();
      } else {
        rawText = String(fileOrContent);
      }

      let parsed = JSON.parse(rawText);

      // Si viene con cifrado AES-GCM
      if (parsed.isEncrypted && parsed.ciphertext) {
        if (!password) {
          throw new Error('Este archivo está protegido con contraseña. Ingresa tu clave para continuar.');
        }
        const decryptedJson = await this._decryptAESGCM(parsed, password);
        parsed = JSON.parse(decryptedJson);
      }

      // This identifies the file format; authentication is supplied only by AES-GCM.
      if (parsed.signature !== BACKUP_SIGNATURE || ![2, 3].includes(parsed.version)) {
        throw new Error('Formato de copia de seguridad no válido o corrupto.');
      }

      const { songs, analytics, settings } = parsed.data || {};
      if (!Array.isArray(songs) || (analytics != null && (typeof analytics !== 'object' || Array.isArray(analytics))) ||
          (settings != null && (typeof settings !== 'object' || Array.isArray(settings)))) {
        throw new Error('La estructura de la copia de seguridad no es válida.');
      }
      if (analytics && ((analytics.stats != null && (typeof analytics.stats !== 'object' || Array.isArray(analytics.stats))) ||
          (analytics.sessions != null && !Array.isArray(analytics.sessions)) ||
          (analytics.milestones != null && !Array.isArray(analytics.milestones)))) {
        throw new Error('Las analíticas de la copia no son válidas.');
      }
      // Validate every score before opening the write transaction. A malformed later
      // record must not leave earlier songs overwritten by an incomplete restore.
      const restoredSongs = songs.map(restoreSong);

      // 1. Restaurar canciones en IndexedDB
      const restoredCount = restoredSongs.length ? await db.saveSongsBatch(restoredSongs) : 0;

      // 2. Restaurar analíticas de práctica
      if (analytics) {
        practiceTrackerService.importData(analytics);
      }

      // 3. Restaurar ajustes de usuario
      if (settings) {
        if (settings.userName) localStorage.setItem('user_name', settings.userName);
        if (settings.userEmail) localStorage.setItem('user_email', settings.userEmail);
        if (settings.isLeftHanded !== undefined) localStorage.setItem('app_lefthanded', String(settings.isLeftHanded));
        if (settings.defaultInstrument) localStorage.setItem('app_instrument', settings.defaultInstrument);
        if (settings.masterTuning) localStorage.setItem('app_master_tuning', settings.masterTuning);
        if (settings.visualTheme) localStorage.setItem('app_visual_theme', settings.visualTheme);
      }

      events.emit('db:backupRestored', { songCount: restoredCount });
      events.emit('settings:updated');
      toast.show(`Restauración completada: ${restoredCount} canciones recuperadas`, 'success');

      return {
        success: true,
        restoredSongs: restoredCount,
        restoredAnalytics: !!analytics,
        restoredSettings: !!settings
      };
    } catch (err) {
      console.error('[BackupSyncEngine] Error importando backup:', err);
      toast.show(`Error al restaurar: ${err.message}`, 'error');
      return { success: false, error: err.message };
    }
  }

  // --- MÉTODOS CRIPTOGRÁFICOS AES-GCM ---

  async _encryptAESGCM(plaintext, password) {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await this.crypto.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const key = await this.crypto.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const ciphertext = await this.crypto.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plaintext)
    );

    return {
      isEncrypted: true,
      salt: Array.from(salt),
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(ciphertext))
    };
  }

  async _decryptAESGCM(encryptedObj, password) {
    const enc = new TextEncoder();
    const dec = new TextDecoder();

    const salt = new Uint8Array(encryptedObj.salt);
    const iv = new Uint8Array(encryptedObj.iv);
    const ciphertext = new Uint8Array(encryptedObj.ciphertext);

    const keyMaterial = await this.crypto.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const key = await this.crypto.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await this.crypto.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return dec.decode(decrypted);
  }

  _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export const backupSyncEngine = new BackupSyncEngine();
