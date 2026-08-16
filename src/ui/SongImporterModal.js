/**
 * @file SongImporterModal.js
 * @description Modal interactivo para Importar y Añadir CUALQUIER Canción con Letra y Acordes.
 * Permite buscar canciones o pegar letras con acordes en formato libre/ChordPro y guardarlas en la app.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { db } from '../data/Database.js';
import { searchEngine } from '../data/SearchEngine.js';
import { toast } from './Toast.js';

export class SongImporterModal extends Component {
  constructor(container) {
    super(container);
    this.isOpen = false;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('ui:openSongImporter', (initialTitle = '') => {
        this.open(initialTitle);
      })
    );
  }

  open(initialTitle = '') {
    this.isOpen = true;
    this.render(initialTitle);
  }

  close() {
    this.isOpen = false;
    if (this.container) this.container.innerHTML = '';
  }

  render(initialTitle = '') {
    if (!this.container || !this.isOpen) return;

    this.container.innerHTML = `
      <div class="importer-backdrop" role="dialog" aria-modal="true" aria-label="Añadir nueva canción con letra y acordes">
        <div class="importer-modal-card">
          <div class="importer-header">
            <h2 class="importer-title">✨ Añadir / Importar Cualquier Canción</h2>
            <button class="btn-close-importer" id="btnCloseImporter" aria-label="Cerrar ventana">✕</button>
          </div>

          <p class="importer-description">
            Escribe el título, artista y pega la letra con los acordes (ej. <code>[G] [D] [Em] [C]</code> o letra con acordes encima). ¡Se guardará y estará lista para tocar con Auto-Scroll y diagramas!
          </p>

          <form id="songImporterForm" class="importer-form">
            <div class="importer-row">
              <div class="importer-field">
                <label for="importTitle">Título de la Canción *</label>
                <input type="text" id="importTitle" required placeholder="Ej. Despacito, Creep, La Flaca..." value="${initialTitle}">
              </div>
              <div class="importer-field">
                <label for="importArtist">Artista / Grupo *</label>
                <input type="text" id="importArtist" required placeholder="Ej. Luis Fonsi, Radiohead, Jarabe de Palo...">
              </div>
            </div>

            <div class="importer-row">
              <div class="importer-field">
                <label for="importGenre">Género</label>
                <select id="importGenre">
                  <option value="Rock">Rock</option>
                  <option value="Pop" selected>Pop</option>
                  <option value="Acoustic">Acústico</option>
                  <option value="Metal">Metal</option>
                  <option value="Blues">Blues</option>
                  <option value="Jazz">Jazz</option>
                  <option value="Classical">Clásica</option>
                </select>
              </div>
              <div class="importer-field">
                <label for="importTempo">Tempo (BPM)</label>
                <input type="number" id="importTempo" min="40" max="260" value="110">
              </div>
            </div>

            <div class="importer-field">
              <label for="importLyrics">Letra con Acordes (Formato ChordPro o texto con acordes) *</label>
              <textarea id="importLyrics" rows="8" required placeholder="[Verse 1]
[G]Pega aquí la letra de tu canción favorita
[D]Los acordes entre corchetes [Em]aparecerán interactivos [C]sobre cada palabra..."></textarea>
            </div>

            <div class="importer-actions">
              <button type="button" class="btn btn-secondary" id="btnCancelImport">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="btnSubmitImport">🎸 Guardar y Abrir Canción</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#btnCloseImporter')?.addEventListener('click', () => this.close());
    this.container.querySelector('#btnCancelImport')?.addEventListener('click', () => this.close());

    this.container.querySelector('#songImporterForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = this.container.querySelector('#importTitle').value.trim();
      const artist = this.container.querySelector('#importArtist').value.trim();
      const genre = this.container.querySelector('#importGenre').value;
      const tempo = parseInt(this.container.querySelector('#importTempo').value, 10) || 120;
      const lyricsChords = this.container.querySelector('#importLyrics').value.trim();

      if (!title || !artist || !lyricsChords) {
        toast.show('Por favor completa el título, artista y letra con acordes', 'warning');
        return;
      }

      // Crear transcripción AlphaTex mínima para el motor de audio
      const alphaTexData = `\\title "${title}" \\artist "${artist}" \\tempo ${tempo} . :4 (3.6 2.5 0.4 0.3) :4 (0.4 2.3 3.2) :4 (0.5 2.4 2.3) :4 (3.5 2.4 0.3 1.2) |`;

      const newSong = {
        title,
        artist,
        genre,
        difficulty: 'Intermedio',
        tuning: 'Standard E',
        tempo,
        timeSignature: '4/4',
        tracksCount: 3,
        lyricsChords,
        data: alphaTexData,
        isFavorite: false,
        addedAt: Date.now(),
      };

      try {
        const id = await db.saveSong(newSong);
        newSong.id = id;
        await searchEngine.reloadIndex();

        toast.show(`🎉 Canción "${title}" añadida con éxito!`, 'success');
        this.close();

        // Cargar inmediatamente la canción importada en el reproductor
        events.emit('ui:loadLyricsSong', newSong);
        events.emit('ui:switchTab', 'player');
      } catch (err) {
        console.error('[SongImporter] Error guardando canción:', err);
        toast.show('Error al guardar la canción: ' + err.message, 'error');
      }
    });
  }
}

export default SongImporterModal;
