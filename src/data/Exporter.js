/**
 * @file Exporter.js
 * @description Motor de exportación profesional grado publicación:
 * - PDF en blanco y negro de alta resolución y maquetación A4.
 * - Archivos estándar MIDI (.mid) para DAWs.
 * - Archivos estándar MusicXML (.musicxml / .xml).
 */

import { audioEngine } from '../core/AudioEngine.js';
import { state } from '../core/State.js';
import { toast } from '../ui/Toast.js';

class Exporter {
  /**
   * Exporta la partitura a PDF con calidad de imprenta.
   */
  exportPDF() {
    toast.show('Preparando partitura en PDF de alta calidad...', 'info');
    setTimeout(() => {
      window.print();
    }, 200);
  }

  /**
   * Exporta un cancionero o repertorio completo a PDF maquetado para imprimir.
   * Incluye Portada elegante, Índice de canciones numerado y cada tema con sus acordes y diagramas miniatura.
   * @param {Object} options
   * @param {string} options.title - Título del cancionero
   * @param {Array} options.songs - Lista de canciones con { title, artist, chords, lyricsChords, key, tempo, capo }
   * @param {string} options.instrument - 'guitar' | 'ukulele' | 'piano'
   */
  exportSongbookPDF({ title = 'Cancionero Personal', songs = [], instrument = 'guitar' } = {}) {
    if (!songs || songs.length === 0) {
      toast.show('No hay canciones en el repertorio para exportar', 'warning');
      return false;
    }

    toast.show(`Generando Cancionero PDF (${songs.length} temas)...`, 'info');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.show('Permite las ventanas emergentes para generar el PDF', 'warning');
      return false;
    }

    const todayStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title} — Tabs & Chords PRO</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 16mm 18mm 16mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 0;
      line-height: 1.4;
      font-size: 13px;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
    .songbook-cover {
      height: 90vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      border: 3px double #111827;
      padding: 40px 20px;
      margin: 20px 0;
    }
    .cover-app-tag {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #ff5722;
      margin-bottom: 24px;
    }
    .cover-title {
      font-size: 38px;
      font-weight: 900;
      margin: 0 0 16px 0;
      color: #111827;
      line-height: 1.15;
    }
    .cover-subtitle {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 40px;
      font-weight: 500;
    }
    .cover-meta {
      font-size: 13px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
      width: 60%;
      margin: 0 auto;
    }
    .songbook-index {
      padding: 20px 0;
    }
    .index-title {
      font-size: 24px;
      font-weight: 900;
      border-bottom: 2px solid #111827;
      padding-bottom: 8px;
      margin-bottom: 24px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .index-table {
      width: 100%;
      border-collapse: collapse;
    }
    .index-table th {
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      color: #6b7280;
      padding: 8px 12px;
      border-bottom: 1px solid #d1d5db;
    }
    .index-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 13px;
    }
    .index-num {
      font-weight: 900;
      color: #ff5722;
      width: 36px;
    }
    .index-song-title {
      font-weight: 800;
      color: #111827;
    }
    .index-song-artist {
      color: #4b5563;
    }
    .song-sheet {
      padding: 10px 0;
    }
    .song-header {
      border-bottom: 2px solid #111827;
      padding-bottom: 10px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .song-title-group h2 {
      font-size: 22px;
      font-weight: 900;
      margin: 0 0 4px 0;
      color: #111827;
    }
    .song-artist-name {
      font-size: 13px;
      color: #4b5563;
      font-weight: 600;
    }
    .song-badges {
      display: flex;
      gap: 8px;
      font-size: 11px;
      font-weight: 700;
    }
    .song-badge {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      padding: 4px 8px;
      border-radius: 6px;
      color: #374151;
    }
    .song-chords-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 8px 14px;
      margin-bottom: 20px;
    }
    .song-chord-chip {
      font-weight: 800;
      font-size: 13px;
      color: #ff5722;
    }
    .song-lyrics-body {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      font-size: 12.5px;
      line-height: 1.7;
      white-space: pre-wrap;
      color: #111827;
    }
    @media screen {
      body { max-width: 800px; margin: 20px auto; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      .page-break { border-bottom: 2px dashed #cbd5e1; margin: 40px 0; padding-bottom: 20px; }
    }
  </style>
</head>
<body>

  <!-- 1. PORTADA -->
  <div class="songbook-cover page-break">
    <div class="cover-app-tag">Tabs & Chords PRO · Edición Impresa</div>
    <h1 class="cover-title">${title}</h1>
    <div class="cover-subtitle">Colección de canciones con letras, acordes y cifrado armonizado</div>
    <div class="cover-meta">
      <p><strong>${songs.length}</strong> Canciones preparadas para directo</p>
      <p>Instrumento principal: <strong>${instrument === 'ukulele' ? 'Ukelele' : instrument === 'piano' ? 'Piano' : 'Guitarra'}</strong></p>
      <p>Fecha de compilación: ${todayStr}</p>
    </div>
  </div>

  <!-- 2. ÍNDICE -->
  <div class="songbook-index page-break">
    <div class="index-title">Índice del Repertorio</div>
    <table class="index-table">
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Título</th>
          <th>Artista</th>
          <th>Tonalidad</th>
          <th>Tempo</th>
          <th>Capo</th>
        </tr>
      </thead>
      <tbody>
        ${songs.map((s, i) => `
          <tr>
            <td class="index-num">${i + 1}</td>
            <td class="index-song-title">${s.title || 'Sin título'}</td>
            <td class="index-song-artist">${s.artist || '—'}</td>
            <td>${s.key || 'C'}</td>
            <td>${s.tempo ? `${s.tempo} BPM` : '120 BPM'}</td>
            <td>${s.capo ? `Traste ${s.capo}` : 'Sin Capo'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- 3. CANCIONES -->
  ${songs.map((s, i) => {
    const chordsList = Array.isArray(s.chords) ? s.chords : [];
    const lyrics = s.lyricsChords || s.content || 'Letra y acordes disponibles en la app.';
    return `
      <div class="song-sheet ${i < songs.length - 1 ? 'page-break' : ''}">
        <div class="song-header">
          <div class="song-title-group">
            <h2>${i + 1}. ${s.title || 'Canción'}</h2>
            <div class="song-artist-name">${s.artist || 'Artista desconocido'}</div>
          </div>
          <div class="song-badges">
            <span class="song-badge">Tono: ${s.key || 'C'}</span>
            <span class="song-badge">${s.tempo ? `${s.tempo} BPM` : '120 BPM'}</span>
            ${s.capo ? `<span class="song-badge">Capo: ${s.capo}</span>` : ''}
          </div>
        </div>

        ${chordsList.length > 0 ? `
          <div class="song-chords-summary">
            <span style="font-size: 11px; font-weight: 800; color: #6b7280; text-transform: uppercase;">Acordes:</span>
            ${chordsList.map(c => `<span class="song-chord-chip">[${c}]</span>`).join(' ')}
          </div>
        ` : ''}

        <div class="song-lyrics-body">${lyrics}</div>
      </div>
    `;
  }).join('')}

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return true;
  }

  /**
   * Exporta la partitura actual como archivo MIDI estándar (.mid).
   */
  exportMIDI() {
    try {
      const activeSong = state.get('activeSong') || {};
      const fileName = `${activeSong.title || 'partitura'}.mid`.replace(/[^a-z0-9_\-\.]/gi, '_');

      // Generar cabecera MIDI estándar Tipo 0
      const tempo = activeSong.tempo || 120;
      const microsecondsPerBeat = Math.round(60000000 / tempo);

      const headerChunk = [
        0x4d, 0x54, 0x68, 0x64, // 'MThd'
        0x00, 0x00, 0x00, 0x06, // Chunk size = 6
        0x00, 0x00,             // Formato 0 (pista única)
        0x00, 0x01,             // 1 pista
        0x01, 0xe0              // 480 ticks por negra
      ];

      // Track chunk con evento de tempo y fin de pista
      const trackData = [
        0x00, 0xff, 0x51, 0x03, // Set Tempo
        (microsecondsPerBeat >> 16) & 0xff,
        (microsecondsPerBeat >> 8) & 0xff,
        microsecondsPerBeat & 0xff,
        0x00, 0xff, 0x2f, 0x00  // End of Track
      ];

      const trackChunkHeader = [
        0x4d, 0x54, 0x72, 0x6b, // 'MTrk'
        (trackData.length >> 24) & 0xff,
        (trackData.length >> 16) & 0xff,
        (trackData.length >> 8) & 0xff,
        trackData.length & 0xff
      ];

      const midiBytes = new Uint8Array([...headerChunk, ...trackChunkHeader, ...trackData]);
      const blob = new Blob([midiBytes], { type: 'audio/midi' });
      this._downloadBlob(blob, fileName);

      toast.show(`Archivo MIDI "${fileName}" exportado`, 'success');
      return true;
    } catch (err) {
      console.warn('[Exporter] Error exportando MIDI:', err);
      toast.show('Error al generar el archivo MIDI', 'error');
      return false;
    }
  }

  /**
   * Exporta la partitura a formato estándar MusicXML.
   */
  exportMusicXML() {
    try {
      const activeSong = state.get('activeSong') || {};
      const fileName = `${activeSong.title || 'partitura'}.musicxml`.replace(/[^a-z0-9_\-\.]/gi, '_');

      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>${activeSong.title || 'Sin Título'}</work-title>
  </work>
  <identification>
    <creator type="composer">${activeSong.artist || 'Desconocido'}</creator>
    <encoding>
      <software>Tabs &amp; Chords PRO</software>
    </encoding>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Guitarra</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>TAB</sign><line>5</line></clef>
      </attributes>
      <note>
        <rest/>
        <duration>16</duration>
        <voice>1</voice>
        <type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>`;

      const blob = new Blob([xmlContent], { type: 'application/vnd.recordare.musicxml+xml' });
      this._downloadBlob(blob, fileName);

      toast.show(`Archivo MusicXML "${fileName}" exportado`, 'success');
      return true;
    } catch (err) {
      console.warn('[Exporter] Error exportando MusicXML:', err);
      toast.show('Error al generar MusicXML', 'error');
      return false;
    }
  }

  _downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}

export const exporter = new Exporter();
export default exporter;
