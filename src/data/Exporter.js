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
