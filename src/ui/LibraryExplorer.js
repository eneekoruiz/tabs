/**
 * @file LibraryExplorer.js
 * @description Panel lateral de Biblioteca y Gestor de Setlists / Repertorios de directo.
 * Mobile-First & Desktop UI: Carga inmediata y conmutación automática al reproductor limpio.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { db } from '../data/Database.js';
import { searchEngine } from '../data/SearchEngine.js';
import { metadataParser } from '../data/MetadataParser.js';
import { setlistManager } from '../data/SetlistManager.js';
import { audioEngine } from '../core/AudioEngine.js';
import { toast } from './Toast.js';

export class LibraryExplorer extends Component {
  constructor(container) {
    super(container);
    this.searchQuery = '';
    this.activeFilter = 'all'; // 'all' | 'favorites' | 'setlists'
    this.activeGenre = 'all';
    this.isOpen = true;
    this.songs = [];
    this.setlists = [];

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('db:ready', async () => {
        await this.loadLibrary();
      })
    );

    this.registerUnsub(
      events.on('db:songSaved', async () => {
        await this.loadLibrary();
      })
    );

    this.registerUnsub(
      events.on('db:batchSaved', async () => {
        await this.loadLibrary();
        toast.show('Importación completada con éxito', 'success');
      })
    );

    this.registerUnsub(
      events.on('db:songDeleted', async () => {
        await this.loadLibrary();
        toast.show('Canción eliminada de la biblioteca', 'info');
      })
    );

    this.registerUnsub(
      events.on('setlist:updated', (setlists) => {
        this.setlists = setlists;
        if (this.activeFilter === 'setlists') this.render();
      })
    );

    this.registerUnsub(
      events.on('ui:toggleLibrary', () => {
        this.toggle();
      })
    );
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.container) {
      this.container.classList.toggle('library-closed', !this.isOpen);
    }
  }

  async loadLibrary() {
    await searchEngine.reloadIndex();
    this.setlists = setlistManager.setlists;
    this.filterAndRender();
  }

  filterAndRender() {
    const { results } = searchEngine.search({
      query: this.searchQuery,
      filter: this.activeFilter === 'favorites' ? 'favorites' : 'all',
      genre: this.activeGenre,
    });
    this.songs = results;
    this.render();
  }

  render() {
    if (!this.container) return;

    const totalCount = searchEngine.index.length;
    const genres = ['all', 'Rock', 'Metal', 'Blues', 'Acoustic', 'Classical', 'Pop', 'Jazz'];

    this.container.innerHTML = `
      <aside class="library-sidebar ${this.isOpen ? '' : 'library-closed'}" aria-label="Biblioteca de canciones y repertorios">
        <!-- Cabecera de la Biblioteca -->
        <div class="library-header">
          <div class="library-title-row">
            <span class="lib-icon" aria-hidden="true">📚</span>
            <h2>Catálogo & Setlists</h2>
            <span class="lib-count-badge" aria-label="${totalCount} canciones">${totalCount}</span>
          </div>

          <!-- Buscador Ultrarrápido -->
          <div class="library-search-box">
            <span class="search-icon" aria-hidden="true">🔍</span>
            <input type="text" id="libSearchInput" placeholder="Buscar artista, canción, género..." value="${this.searchQuery}" aria-label="Buscar artista o canción">
            ${this.searchQuery ? '<button id="btnClearSearch" class="btn-clear-search" aria-label="Limpiar búsqueda">✖</button>' : ''}
          </div>

          <!-- Chips de Género Musical (visibles en modo canciones) -->
          ${this.activeFilter !== 'setlists' ? `
            <div class="library-genre-chips" role="group" aria-label="Filtro de géneros">
              ${genres.map(g => `
                <button class="genre-chip ${this.activeGenre === g ? 'active' : ''}" data-genre="${g}" aria-pressed="${this.activeGenre === g}">
                  ${g === 'all' ? 'Todos' : g}
                </button>
              `).join('')}
            </div>
          ` : ''}

          <!-- Pestañas de Filtro (Todas, Favoritas, Setlists) -->
          <div class="library-filter-tabs" role="tablist" aria-label="Filtros de biblioteca">
            <button class="lib-tab ${this.activeFilter === 'all' ? 'active' : ''}" data-filter="all" role="tab" aria-selected="${this.activeFilter === 'all'}">Todas</button>
            <button class="lib-tab ${this.activeFilter === 'favorites' ? 'active' : ''}" data-filter="favorites" role="tab" aria-selected="${this.activeFilter === 'favorites'}">⭐ Favoritas</button>
            <button class="lib-tab ${this.activeFilter === 'setlists' ? 'active' : ''}" data-filter="setlists" role="tab" aria-selected="${this.activeFilter === 'setlists'}">🎤 Setlists</button>
          </div>

          <!-- Botones de Importación o Crear Setlist -->
          <div class="library-import-actions">
            ${this.activeFilter === 'setlists' ? `
              <button id="btnCreateSetlist" class="btn btn-import btn-demo-quick" aria-label="Crear nuevo repertorio">
                <span aria-hidden="true">➕</span> Nuevo Setlist
              </button>
            ` : `
              <label class="btn btn-import" title="Importar archivos .gp3, .gp4, .gp5, .gpx" aria-label="Importar archivos de tablatura">
                <span aria-hidden="true">📄</span> + Archivo
                <input type="file" id="libFileInput" accept=".gp,.gp3,.gp4,.gp5,.gpx,.xml,.mxl" multiple style="display: none;">
              </label>

              <label class="btn btn-import" title="Importar carpeta con partituras" aria-label="Importar carpeta completa con partituras">
                <span aria-hidden="true">📁</span> + Carpeta
                <input type="file" id="libFolderInput" webkitdirectory directory multiple style="display: none;">
              </label>

              <button id="btnLibDemo" class="btn btn-import btn-demo-quick" title="Cargar Riff Demo" aria-label="Cargar riff de demostración">
                <span aria-hidden="true">⚡</span> Demo
              </button>
            `}
          </div>
        </div>

        <!-- Lista de Contenido (Canciones o Setlists) -->
        <div class="library-song-list" role="region" aria-label="Lista de contenido">
          ${this.activeFilter === 'setlists' ? this.renderSetlistsList() : this.renderSongsList()}
        </div>
      </aside>
    `;

    this.bindEvents();
  }

  renderSetlistsList() {
    if (!this.setlists || this.setlists.length === 0) {
      return `
        <div class="library-empty-state">
          <span class="empty-icon" aria-hidden="true">🎤</span>
          <p>No tienes repertorios creados.</p>
          <span class="empty-sub">Haz clic en "+ Nuevo Setlist" para armar tu lista de temas</span>
        </div>
      `;
    }

    return this.setlists.map(setlist => `
      <div class="setlist-card ${setlistManager.activeSetlistId === setlist.id ? 'setlist-card-active' : ''}" data-id="${setlist.id}">
        <div class="setlist-card-main">
          <span class="setlist-card-title">🎤 ${setlist.name}</span>
          <span class="setlist-card-count">${setlist.songIds ? setlist.songIds.length : 0} canciones</span>
        </div>

        <div class="setlist-card-actions">
          <button class="btn-play-setlist" data-id="${setlist.id}" aria-label="Reproducir repertorio ${setlist.name}" title="Cargar repertorio">
            <span>▶ Activar</span>
          </button>
          <button class="btn-del-setlist" data-id="${setlist.id}" aria-label="Eliminar repertorio ${setlist.name}" title="Eliminar">
            <span aria-hidden="true">🗑️</span>
          </button>
        </div>
      </div>
    `).join('');
  }

  renderSongsList() {
    if (this.songs.length === 0) {
      return `
        <div class="library-empty-state">
          <span class="empty-icon" aria-hidden="true">🎸</span>
          <p>${this.searchQuery ? 'No se encontraron coincidencias.' : 'Aún no tienes canciones en este filtro.'}</p>
          <span class="empty-sub">Arrastra archivos o carpetas .gp aquí</span>
        </div>
      `;
    }

    return this.songs.map(song => {
      const diffClass = `diff-${(song.difficulty || 'Intermedio').toLowerCase()}`;
      return `
        <div class="song-card ${state.get('activeSong').id === song.id ? 'song-card-active' : ''}" data-id="${song.id}">
          <button class="song-card-main" data-id="${song.id}" aria-label="Cargar ${song.title} de ${song.artist}">
            <span class="song-card-title">${song.title}</span>
            <span class="song-card-artist">${song.artist}</span>
            <span class="song-card-meta">
              <span class="genre-badge">${song.genre || 'Rock'}</span>
              <span class="diff-badge ${diffClass}">${song.difficulty || 'Intermedio'}</span>
              <span>♩ ${song.tempo || 120} BPM</span>
            </span>
          </button>

          <div class="song-card-actions">
            <button class="btn-add-setlist" data-id="${song.id}" aria-label="Añadir ${song.title} a repertorio" title="Añadir a Setlist">
              <span aria-hidden="true">➕</span>
            </button>
            <button class="btn-fav-song ${song.isFavorite ? 'fav-active' : ''}" data-id="${song.id}" aria-label="Marcar ${song.title} como favorita" title="Favorito">
              <span aria-hidden="true">${song.isFavorite ? '⭐' : '☆'}</span>
            </button>
            <button class="btn-del-song" data-id="${song.id}" aria-label="Eliminar ${song.title} de la biblioteca" title="Eliminar">
              <span aria-hidden="true">🗑️</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  bindEvents() {
    const searchInput = this.container.querySelector('#libSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.filterAndRender();
      });
    }

    const clearSearch = this.container.querySelector('#btnClearSearch');
    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        this.searchQuery = '';
        this.filterAndRender();
      });
    }

    // Chips de género
    this.container.querySelectorAll('.genre-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        this.activeGenre = e.target.dataset.genre;
        this.filterAndRender();
      });
    });

    // Pestañas
    this.container.querySelectorAll('.lib-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.activeFilter = e.target.dataset.filter;
        this.filterAndRender();
      });
    });

    // Crear Setlist
    this.container.querySelector('#btnCreateSetlist')?.addEventListener('click', async () => {
      const name = prompt('Nombre del nuevo repertorio / setlist:', 'Concierto En Vivo');
      if (name) {
        await setlistManager.createSetlist(name);
        this.setlists = setlistManager.setlists;
        this.render();
      }
    });

    // Activar Setlist
    this.container.querySelectorAll('.btn-play-setlist').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id, 10);
        setlistManager.setActiveSetlist(id, 0);
        const setlist = setlistManager.getActiveSetlist();
        if (setlist && setlist.songIds.length > 0) {
          await this.loadSongById(setlist.songIds[0]);
          toast.show(`Repertorio "${setlist.name}" activado`, 'success');
        }
        this.render();
      });
    });

    // Eliminar Setlist
    this.container.querySelectorAll('.btn-del-setlist').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id, 10);
        if (confirm('¿Eliminar este repertorio?')) {
          await setlistManager.deleteSetlist(id);
        }
      });
    });

    // Añadir canción a Setlist
    this.container.querySelectorAll('.btn-add-setlist').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const songId = parseInt(btn.dataset.id, 10);
        if (setlistManager.setlists.length === 0) {
          const created = await setlistManager.createSetlist('Mi Repertorio');
          await setlistManager.addSongToSetlist(created.id, songId);
        } else {
          const targetSetlist = setlistManager.getActiveSetlist() || setlistManager.setlists[0];
          await setlistManager.addSongToSetlist(targetSetlist.id, songId);
        }
      });
    });

    // Importación de archivos
    this.container.querySelector('#libFileInput')?.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        toast.show(`Importando ${e.target.files.length} archivo(s)...`, 'info');
        await metadataParser.processFilesBatch(e.target.files);
      }
    });

    // Importación de carpeta completa
    this.container.querySelector('#libFolderInput')?.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        toast.show(`Importando carpeta con ${e.target.files.length} elementos...`, 'info');
        await metadataParser.processFilesBatch(e.target.files);
      }
    });

    // Demo riff
    this.container.querySelector('#btnLibDemo')?.addEventListener('click', () => {
      const demoAlphaTex = '\\title "Smoke on the Water"\n\\artist "Deep Purple"\n\\tempo 112\n.\n:8 0.6 3.5 5.5 | 0.6 3.5 6.5 5.5.4 | 0.6 3.5 5.5 3.5 0.6.2 |\n:8 0.6 3.5 5.5 | 0.6 3.5 6.5 5.5.4 | 0.6 3.5 5.5 3.5 0.6.2 |';
      
      const titleEl = document.getElementById('songInfoTitle');
      const artistEl = document.getElementById('songInfoArtist');
      if (titleEl) titleEl.textContent = 'Smoke on the Water';
      if (artistEl) artistEl.textContent = '— Deep Purple';

      const playBtn = document.getElementById('btnPlayPause');
      const stopBtn = document.getElementById('btnStop');
      if (playBtn) playBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = false;

      state.set('activeSong', { title: 'Smoke on the Water', artist: 'Deep Purple' });
      events.emit('ui:switchTab', 'player');
      audioEngine.load(demoAlphaTex);
    });

    // Cargar canción
    this.container.querySelectorAll('.song-card-main').forEach(el => {
      el.addEventListener('click', async () => {
        const id = parseInt(el.dataset.id, 10);
        await this.loadSongById(id);
      });
    });

    // Toggle Favorito
    this.container.querySelectorAll('.btn-fav-song').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        await db.toggleFavorite(id);
        await this.loadLibrary();
      });
    });

    // Eliminar canción
    this.container.querySelectorAll('.btn-del-song').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        if (confirm('¿Eliminar esta partitura de tu biblioteca offline?')) {
          await db.deleteSong(id);
        }
      });
    });
  }

  async loadSongById(id) {
    try {
      const song = await db.getSong(id);
      if (!song || !song.data) {
        toast.show('No se pudieron leer los datos de la partitura', 'error');
        return;
      }

      toast.show(`Cargando "${song.title}"...`, 'info');
      state.set('activeSong', { id: song.id, title: song.title, artist: song.artist });
      
      const titleEl = document.getElementById('songInfoTitle');
      const artistEl = document.getElementById('songInfoArtist');
      if (titleEl) titleEl.textContent = song.title;
      if (artistEl) artistEl.textContent = `— ${song.artist}`;

      const playBtn = document.getElementById('btnPlayPause');
      const stopBtn = document.getElementById('btnStop');
      if (playBtn) playBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = false;

      events.emit('ui:switchTab', 'player');
      audioEngine.loadScoreToAlphaTab(song.data);
      this.render();
    } catch (err) {
      console.error('[LibraryExplorer] Error cargando canción por ID:', err);
      toast.show('Error al abrir la partitura seleccionada', 'error');
    }
  }
}

export default LibraryExplorer;
