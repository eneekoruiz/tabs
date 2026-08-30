/**
 * @file SoundFontCache.js
 * @description Gestor de caché permanente del SoundFont para funcionamiento 100% Offline.
 * Carga el archivo de instrumentos (SF2) incluido y lo persiste en IndexedDB/Blob URL.
 */

import { db } from './Database.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';

const DEFAULT_SF2_URL = './assets/vendor/alphatab/1.8.4/soundfont/sonivox.sf2';
const SOUNDFONT_CACHE_KEY = 'sonivox_default_sf2';

class SoundFontCache {
  constructor() {
    this.blobUrl = null;
    this.arrayBuffer = null;
  }

  /**
   * Obtiene la fuente del SoundFont: o bien desde IndexedDB local (offline)
   * o bien leyéndolo del paquete local y persistiendo el binario.
   * @param {string} [assetUrl] - Ruta opcional si se usa un SoundFont personalizado
   * @returns {Promise<string|ArrayBuffer>}
   */
  async getSoundFontSource(assetUrl = DEFAULT_SF2_URL) {
    try {
      // 1. Intentar cargar desde IndexedDB (Caché local offline)
      const cachedData = await db.getSoundFont(SOUNDFONT_CACHE_KEY);
      
      if (cachedData && cachedData.byteLength > 0) {
        console.log('[SoundFontCache] Cargado instantáneamente desde IndexedDB local (Offline Mode).');
        this.arrayBuffer = cachedData;
        
        // Creamos un Blob URL en memoria para AlphaTab
        const blob = new Blob([cachedData], { type: 'audio/x-soundfont' });
        this.blobUrl = URL.createObjectURL(blob);
        
        state.set('isSoundFontLoaded', true);
        state.set('isOfflineReady', true);
        events.emit('soundfont:ready', { source: 'cache', size: cachedData.byteLength });
        return this.arrayBuffer;
      }

      // 2. Si no está en IndexedDB, cargar el recurso empaquetado y guardarlo
      console.log('[SoundFontCache] SoundFont no encontrado en IndexedDB. Cargando recurso local...');
      events.emit('soundfont:downloadStart');

      const response = await fetch(assetUrl);
      if (!response.ok) {
        throw new Error(`Fallo HTTP al descargar SoundFont: ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;

        if (total > 0) {
          const progress = Math.floor((loaded / total) * 100);
          events.emit('soundfont:downloadProgress', { loaded, total, progress });
        }
      }

      // Unir los chunks en un único Uint8Array / ArrayBuffer
      const combined = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      this.arrayBuffer = combined.buffer;

      // 3. Persistir en IndexedDB en segundo plano
      await db.saveSoundFont(SOUNDFONT_CACHE_KEY, this.arrayBuffer);
      console.log(`[SoundFontCache] SoundFont guardado con éxito en IndexedDB (${(loaded / 1024 / 1024).toFixed(2)} MB).`);

      state.set('isSoundFontLoaded', true);
      state.set('isOfflineReady', true);
      events.emit('soundfont:ready', { source: 'bundle', size: this.arrayBuffer.byteLength });
      events.emit('soundfont:cached', { size: this.arrayBuffer.byteLength });

      return this.arrayBuffer;
    } catch (error) {
      console.error('[SoundFontCache] Error al preparar el SoundFont; se usará el recurso local directo:', error);
      // El consumidor puede cargar directamente el mismo recurso local
      return assetUrl;
    }
  }

  /**
   * Limpia recursos en memoria.
   */
  destroy() {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
    this.arrayBuffer = null;
  }
}

export const soundFontCache = new SoundFontCache();
export default soundFontCache;
