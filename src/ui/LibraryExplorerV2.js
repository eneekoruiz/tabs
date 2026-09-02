/**
 * @file LibraryExplorerV2.js
 * @description Biblioteca local y estudio accesible de repertorios.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { db } from '../data/Database.js';
import onlineSongProvider from '../data/OnlineSongProvider.js';
import { SmartScoreGenerator } from '../data/SmartScoreGenerator.js';
import { searchEngine } from '../data/SearchEngine.js';
import { metadataParser } from '../data/MetadataParser.js';
import { setlistManager } from '../data/SetlistManager.js';
import { audioEngine } from '../core/AudioEngineV2.js';
import { toast } from './Toast.js';

const SETLIST_STYLESHEET_ID = 'setlistStudioStyles';
const REHEARSAL_DOCK_ID = 'setlistRehearsalDock';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0 && seconds > 0) return `${minutes} min ${seconds} s`;
  if (minutes > 0) return `${minutes} min`;
  return `${seconds} s`;
}

export class LibraryExplorerV2 extends Component {
  constructor(container) {
    super(container);
    this.searchQuery = '';
    this.activeFilter = 'all';
    this.activeGenre = 'all';
    this.isOpen = true;
    this.songs = [];
    this.setlists = [];
    this.setlistSongs = new Map();
    this.expandedSetlists = new Set();
    this.openSongDetails = new Set();
    this.keyboardMove = null;
    this.draggedSong = null;
    this.isCreatingSetlist = false;
    this.editingSetlistId = null;
    this.rehearsalStatus = null;
    this.isNavigatingRehearsal = false;

    this.ensureStylesheet();
    this.ensureRehearsalDock();
    this.initEvents();
    this.loadLibrary();
  }

  ensureStylesheet() {
    if (document.getElementById(SETLIST_STYLESHEET_ID)) return;
    const link = document.createElement('link');
    link.id = SETLIST_STYLESHEET_ID;
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/setlist-studio.css';
    document.head.appendChild(link);

    if ('serviceWorker' in navigator) {
      const warmRuntimeCache = () => fetch(link.href, { cache: 'reload' }).catch(() => undefined);
      if (navigator.serviceWorker.controller) {
        warmRuntimeCache();
      } else {
        navigator.serviceWorker.ready.then(() => {
          if (navigator.serviceWorker.controller) warmRuntimeCache();
          else navigator.serviceWorker.addEventListener('controllerchange', warmRuntimeCache, { once: true });
        }).catch(() => undefined);
      }
    }
  }

  ensureRehearsalDock() {
    document.getElementById(REHEARSAL_DOCK_ID)?.remove();
    this.rehearsalDock = document.createElement('section');
    this.rehearsalDock.id = REHEARSAL_DOCK_ID;
    this.rehearsalDock.className = 'setlist-rehearsal-dock';
    this.rehearsalDock.hidden = true;
    this.rehearsalDock.setAttribute('aria-label', 'Control del ensayo de repertorio');
    this.rehearsalDock.addEventListener('click', (event) => this.handleRehearsalDockClick(event));
    document.body.appendChild(this.rehearsalDock);
  }

  initEvents() {
    this.registerUnsub(events.on('db:ready', async () => this.loadLibrary()));
    this.registerUnsub(events.on('db:songSaved', async () => this.loadLibrary()));
    this.registerUnsub(events.on('db:batchSaved', async () => {
      await this.loadLibrary();
      toast.show('Importación completada con éxito', 'success');
    }));
    this.registerUnsub(events.on('db:songDeleted', async () => {
      await this.loadLibrary();
      toast.show('Canción eliminada de la biblioteca', 'info');
    }));
    this.registerUnsub(events.on('setlist:updated', async (setlists) => {
      this.setlists = setlists || [];
      await this.hydrateSetlistSongs(this.setlists);
      if (this.activeFilter === 'setlists') this.render();
      this.updateRehearsalDock();
    }));
    this.registerUnsub(events.on('setlist:activeChanged', () => {
      if (this.activeFilter === 'setlists') this.render();
      this.updateRehearsalDock();
    }));
    this.registerUnsub(events.on('setlist:rehearsalUpdated', (session) => {
      this.rehearsalStatus = session;
      this.updateRehearsalDock();
      this.updateInlineRehearsalStatus();
    }));
    this.registerUnsub(events.on('setlist:manualAdvanceRequired', () => {
      this.announce('Tema terminado. El avance está esperando tu confirmación.');
      this.updateRehearsalDock();
    }));
    this.registerUnsub(events.on('ui:toggleLibrary', () => this.toggle()));
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.container?.classList.toggle('library-closed', !this.isOpen);
  }

  async loadLibrary() {
    await searchEngine.reloadIndex();
    this.setlists = setlistManager.setlists;
    await this.hydrateSetlistSongs(this.setlists);
    this.filterAndRender();
    this.updateRehearsalDock();
  }

  async hydrateSetlistSongs(setlists = this.setlists) {
    const songIds = new Set(setlists.flatMap((setlist) => setlist.songIds || []));
    await Promise.all([...songIds].map(async (songId) => {
      if (this.setlistSongs.has(songId)) return;
      try {
        this.setlistSongs.set(songId, await db.getSong(songId));
      } catch (error) {
        console.warn(`[LibraryExplorerV2] No se pudo cargar la canción ${songId}:`, error);
        this.setlistSongs.set(songId, null);
      }
    }));
  }

  filterAndRender() {
    if (this.activeFilter === 'visited') {
      const visited = db.getMostVisitedSongs ? db.getMostVisitedSongs() : [];
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        this.songs = visited.filter((song) =>
          song.title.toLowerCase().includes(query) ||
          (song.artist || '').toLowerCase().includes(query)
        );
      } else {
        this.songs = visited;
      }
    } else {
      const { results } = searchEngine.search({
        query: this.searchQuery,
        filter: this.activeFilter === 'favorites' ? 'favorites' : 'all',
        genre: this.activeGenre,
      });
      this.songs = results;
    }
    this.render();
  }

  render() {
    if (!this.container) return;
    const totalCount = searchEngine.index.length;
    const genres = ['all', 'Rock', 'Metal', 'Blues', 'Acoustic', 'Classical', 'Pop', 'Jazz'];

    this.container.innerHTML = `
      <aside class="library-sidebar ${this.isOpen ? '' : 'library-closed'}" aria-label="Biblioteca de canciones y repertorios">
        <div class="library-header">
          <div class="library-title-row">
            <span class="lib-icon" aria-hidden="true">📚</span>
            <h2>Mis Tabs & Repertorio</h2>
            <span class="lib-count-badge" aria-label="${totalCount} canciones">${totalCount}</span>
          </div>

          <div class="library-search-box">
            <span class="search-icon" aria-hidden="true">🔍</span>
            <input type="text" id="libSearchInput" placeholder="Buscar canción o artista" value="${escapeHtml(this.searchQuery)}" aria-label="Buscar artista o canción">
            ${this.searchQuery ? '<button id="btnClearSearch" class="btn-clear-search" aria-label="Limpiar búsqueda">✕</button>' : ''}
          </div>

          <div class="library-filter-tabs" role="tablist" aria-label="Filtros de biblioteca">
            <button class="lib-tab ${this.activeFilter === 'favorites' ? 'active' : ''}" data-filter="favorites" role="tab" aria-selected="${this.activeFilter === 'favorites'}">⭐ Favoritas</button>
            <button class="lib-tab ${this.activeFilter === 'visited' ? 'active' : ''}" data-filter="visited" role="tab" aria-selected="${this.activeFilter === 'visited'}">🔥 Más Visitadas</button>
            <button class="lib-tab ${this.activeFilter === 'setlists' ? 'active' : ''}" data-filter="setlists" role="tab" aria-selected="${this.activeFilter === 'setlists'}">📋 Setlists</button>
            <button class="lib-tab ${this.activeFilter === 'all' ? 'active' : ''}" data-filter="all" role="tab" aria-selected="${this.activeFilter === 'all'}">📂 Todas</button>
          </div>

          ${this.activeFilter === 'all' ? `
            <div class="library-genre-chips" role="group" aria-label="Filtro de géneros">
              ${genres.map((genre) => `
                <button class="genre-chip ${this.activeGenre === genre ? 'active' : ''}" data-genre="${genre}" aria-pressed="${this.activeGenre === genre}">
                  ${genre === 'all' ? 'Todos' : genre}
                </button>
              `).join('')}
            </div>
          ` : ''}

          <div class="library-import-actions">
            ${this.activeFilter === 'setlists' ? `
              <button id="btnCreateSetlist" class="btn btn-import btn-demo-quick" aria-expanded="${this.isCreatingSetlist}" aria-controls="setlistCreatePanel">
                <span aria-hidden="true">+</span> Nuevo repertorio
              </button>
            ` : `
              <label class="btn btn-import" title="Importar archivos Guitar Pro" aria-label="Importar partitura">
                <span aria-hidden="true">+</span> Importar partitura
                <input type="file" id="libFileInput" accept=".gp,.gp3,.gp4,.gp5,.gpx,.xml,.mxl" multiple hidden>
              </label>
            `}
          </div>
        </div>

        <div class="library-song-list" role="region" aria-label="Lista de contenido">
          ${this.activeFilter === 'setlists' ? this.renderSetlistsList() : this.renderSongsList()}
        </div>
        <div class="sr-only" id="setlistStudioAnnouncements" aria-live="polite" aria-atomic="true"></div>
      </aside>
    `;
    this.bindEvents();
  }

  renderSetlistsList() {
    if (this.setlists.length > 0 && this.expandedSetlists.size === 0) {
      this.expandedSetlists.add(this.setlists[0].id);
    }

    const explainerHtml = `
      <div class="setlist-explainer-card">
        <span class="explainer-icon" aria-hidden="true">ⓘ</span>
        <div class="explainer-body">
          <strong>¿Qué es una Setlist?</strong>
          <p>El orden de temas preparado para un concierto o ensayo, con sus cambios técnicos y tiempos reales.</p>
        </div>
      </div>
    `;
    const createForm = this.isCreatingSetlist ? this.renderCreateSetlistForm() : '';

    if (!this.setlists.length) {
      return `
        ${explainerHtml}
        ${createForm}
        <div class="library-empty-state">
          <span class="empty-icon" aria-hidden="true">🎤</span>
          <p class="empty-title">Aún no hay repertorios.</p>
          <span class="empty-sub">Crea el primero para ordenar tus canciones.</span>
          <button class="btn-empty-action" id="btnEmptyCreateSetlist">Crear repertorio</button>
        </div>
      `;
    }

    return `
      ${explainerHtml}
      ${createForm}
      <div class="setlist-studio-stack">
        ${this.setlists.map((setlist) => this.renderSetlistCard(setlist)).join('')}
      </div>
    `;
  }

  renderCreateSetlistForm() {
    return `
      <form class="setlist-inline-form" id="setlistCreatePanel" aria-label="Nuevo repertorio">
        <label for="setlistNewName">Nombre del repertorio</label>
        <div class="setlist-inline-form-row">
          <input id="setlistNewName" name="name" type="text" maxlength="100" autocomplete="off" required placeholder="Ej. Sala pequeña · Viernes">
          <button class="setlist-primary-action" type="submit">Crear</button>
          <button class="setlist-icon-action" type="button" data-action="cancel-create" aria-label="Cancelar">✕</button>
        </div>
      </form>
    `;
  }

  renderSetlistCard(setlist) {
    const isExpanded = this.expandedSetlists.has(setlist.id);
    const isActive = setlistManager.activeSetlistId === setlist.id;
    const isRehearsing = isActive && setlistManager.activeMode === 'rehearsal';
    const songCount = setlist.songIds.length;
    const durationSummary = setlistManager.getDurationSummary(setlist.id);
    const durationLabel = this.formatDurationSummary(durationSummary);
    const bodyId = `setlistStudioBody-${setlist.id}`;

    return `
      <article class="setlist-card setlist-studio-card ${isActive ? 'setlist-card-active' : ''}" data-id="${setlist.id}">
        <header class="setlist-studio-header">
          <button class="setlist-studio-toggle" type="button" data-action="toggle-setlist" data-id="${setlist.id}" aria-expanded="${isExpanded}" aria-controls="${bodyId}">
            <span class="setlist-studio-title">${escapeHtml(setlist.name)}</span>
            <span class="setlist-studio-summary">${pluralize(songCount, 'canción', 'canciones')} · ${escapeHtml(durationLabel)}</span>
          </button>
          <div class="setlist-studio-header-actions">
            <button class="setlist-icon-action" type="button" data-action="rename-setlist" data-id="${setlist.id}" aria-label="Cambiar nombre de ${escapeHtml(setlist.name)}" title="Cambiar nombre">✎</button>
            <button class="btn-del-setlist setlist-icon-action danger" type="button" data-action="delete-setlist" data-id="${setlist.id}" aria-label="Eliminar ${escapeHtml(setlist.name)}" title="Eliminar">🗑</button>
          </div>
        </header>

        ${this.editingSetlistId === setlist.id ? `
          <form class="setlist-inline-form setlist-rename-form" data-setlist-rename-form="${setlist.id}">
            <label for="setlistRename-${setlist.id}">Nombre del repertorio</label>
            <div class="setlist-inline-form-row">
              <input id="setlistRename-${setlist.id}" name="name" type="text" maxlength="100" required value="${escapeHtml(setlist.name)}">
              <button class="setlist-primary-action" type="submit">Guardar</button>
              <button class="setlist-icon-action" type="button" data-action="cancel-rename" aria-label="Cancelar">✕</button>
            </div>
          </form>
        ` : ''}

        <div class="setlist-studio-body" id="${bodyId}" ${isExpanded ? '' : 'hidden'}>
          <div class="setlist-rehearsal-toolbar">
            <label for="setlistCountIn-${setlist.id}">Cuenta atrás</label>
            <select id="setlistCountIn-${setlist.id}" data-action="count-in" data-id="${setlist.id}" aria-label="Cuenta atrás antes del ensayo">
              ${[0, 3, 5, 10].map((seconds) => `
                <option value="${seconds}" ${setlist.rehearsal.countInSeconds === seconds ? 'selected' : ''}>${seconds === 0 ? 'Sin cuenta' : `${seconds} s`}</option>
              `).join('')}
            </select>
            <button class="btn-play-setlist setlist-primary-action" type="button" data-action="start-rehearsal" data-id="${setlist.id}" ${songCount ? '' : 'disabled'}>
              ${isRehearsing ? 'Reiniciar ensayo' : 'Iniciar ensayo'}
            </button>
            <span class="setlist-manual-badge">Avance manual</span>
          </div>
          <div class="setlist-inline-rehearsal-state" data-inline-rehearsal="${setlist.id}" aria-live="polite">
            ${isRehearsing ? this.getRehearsalStatusText() : ''}
          </div>
          ${songCount ? `
            <ol class="setlist-song-order" aria-label="Orden de canciones de ${escapeHtml(setlist.name)}">
              ${setlist.songIds.map((songId, index) => this.renderSetlistSong(setlist, songId, index)).join('')}
            </ol>
          ` : `
            <div class="setlist-studio-empty">Añade canciones desde la pestaña Todas.</div>
          `}
        </div>
      </article>
    `;
  }

  renderSetlistSong(setlist, songId, index) {
    const song = this.setlistSongs.get(songId);
    const metadata = setlistManager.getSongMetadata(setlist.id, songId);
    const warnings = setlistManager.getTransitionWarnings(setlist.id, index, this.setlistSongs);
    const detailKey = `${setlist.id}:${songId}`;
    const detailsOpen = this.openSongDetails.has(detailKey);
    const isGrabbed = this.keyboardMove?.setlistId === setlist.id && this.keyboardMove?.index === index;
    const durationMinutes = metadata.durationSeconds === null ? '' : Math.floor(metadata.durationSeconds / 60);
    const durationSeconds = metadata.durationSeconds === null ? '' : metadata.durationSeconds % 60;
    const title = song?.title || `Canción no disponible (${songId})`;
    const artist = song?.artist || 'No se encuentra en la biblioteca';
    const tuning = metadata.tuning || song?.tuning || '';

    return `
      <li class="setlist-song-item" data-setlist-id="${setlist.id}" data-song-id="${songId}" data-index="${index}">
        ${warnings.length ? `
          <div class="setlist-transition-warning" role="note">
            <strong>Cambio antes del tema ${index + 1}</strong>
            <span>${warnings.map(escapeHtml).join(' · ')}</span>
          </div>
        ` : ''}
        <div class="setlist-song-row" data-drop-target="true">
          <button class="setlist-drag-handle" type="button" draggable="true" data-action="keyboard-move" aria-label="Reordenar ${escapeHtml(title)}" aria-grabbed="${isGrabbed}" title="Reordenar">↕</button>
          <span class="setlist-song-position" aria-hidden="true">${index + 1}</span>
          <div class="setlist-song-identity">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(artist)}</span>
            <div class="setlist-song-badges">
              ${metadata.durationSeconds !== null ? `<span>${escapeHtml(formatDuration(metadata.durationSeconds))}</span>` : '<span class="unknown">Duración sin definir</span>'}
              ${metadata.capo !== null ? `<span>${metadata.capo === 0 ? 'Sin capo' : `Capo ${metadata.capo}`}</span>` : ''}
              ${tuning ? `<span>${escapeHtml(tuning)}</span>` : ''}
            </div>
          </div>
          <div class="setlist-song-actions">
            <button class="setlist-icon-action" type="button" data-action="move-up" aria-label="Subir ${escapeHtml(title)}" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button class="setlist-icon-action" type="button" data-action="move-down" aria-label="Bajar ${escapeHtml(title)}" ${index === setlist.songIds.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="setlist-icon-action danger" type="button" data-action="remove-song" aria-label="Quitar ${escapeHtml(title)} del repertorio">🗑</button>
          </div>
        </div>
        <details class="setlist-song-details" data-detail-key="${detailKey}" ${detailsOpen ? 'open' : ''}>
          <summary>Datos de ensayo</summary>
          <form class="setlist-metadata-form" data-metadata-form="true">
            <label>
              Capo
              <select name="capo">
                <option value="" ${metadata.capo === null ? 'selected' : ''}>Sin definir</option>
                <option value="0" ${metadata.capo === 0 ? 'selected' : ''}>Sin capo</option>
                ${Array.from({ length: 12 }, (_, fret) => fret + 1).map((fret) => `<option value="${fret}" ${metadata.capo === fret ? 'selected' : ''}>Traste ${fret}</option>`).join('')}
              </select>
            </label>
            <label>
              Afinación
              <input name="tuning" type="text" maxlength="80" value="${escapeHtml(metadata.tuning)}" placeholder="${song?.tuning ? `Actual: ${escapeHtml(song.tuning)}` : 'Sin definir'}">
            </label>
            <fieldset>
              <legend>Duración</legend>
              <label><span>min</span><input name="durationMinutes" type="number" inputmode="numeric" min="0" max="599" value="${durationMinutes}"></label>
              <label><span>seg</span><input name="durationSeconds" type="number" inputmode="numeric" min="0" max="59" value="${durationSeconds}"></label>
            </fieldset>
            <button class="setlist-secondary-action" type="submit">Guardar datos</button>
          </form>
        </details>
      </li>
    `;
  }

  formatDurationSummary(summary) {
    if (summary.totalCount === 0 || summary.knownCount === 0) return 'Duración sin definir';
    if (summary.isComplete) return `${formatDuration(summary.knownSeconds)} en total`;
    return `${formatDuration(summary.knownSeconds)} conocidos · ${pluralize(summary.unknownCount, 'tema sin duración', 'temas sin duración')}`;
  }

  renderSongsList() {
    if (this.songs.length === 0) {
      if (this.activeFilter === 'favorites') {
        return this.renderEmptySongs('⭐', 'No tienes canciones favoritas aún.', 'Marca una canción como favorita para verla aquí.');
      }
      if (this.activeFilter === 'visited') {
        return this.renderEmptySongs('🔥', 'Aún no has visitado ninguna canción.', 'Las canciones que abras aparecerán aquí.');
      }
      return this.renderEmptySongs(
        '🎸',
        this.searchQuery ? `No hay resultados para "${escapeHtml(this.searchQuery)}".` : 'No hay canciones en esta sección.',
        'Importa una partitura o explora el catálogo offline.'
      );
    }

    return this.songs.map((song) => {
      const difficulty = song.difficulty || '';
      const difficultyClass = difficulty
        ? `diff-${String(difficulty).toLowerCase().replace(/[^a-z0-9_-]/g, '')}`
        : '';
      const metadata = [
        song.genre ? `<span class="genre-badge">${escapeHtml(song.genre)}</span>` : '',
        difficulty ? `<span class="diff-badge ${difficultyClass}">${escapeHtml(difficulty)}</span>` : '',
      ].filter(Boolean).join('');

      return `
        <div class="song-card ${state.get('activeSong').id === song.id ? 'song-card-active' : ''}" data-id="${song.id}">
          <button class="song-card-main" data-id="${song.id}" aria-label="Cargar ${escapeHtml(song.title)} de ${escapeHtml(song.artist)}">
            <span class="song-card-title">${escapeHtml(song.title)}</span>
            <span class="song-card-artist">${escapeHtml(song.artist || 'Artista sin definir')}</span>
            ${metadata ? `<span class="song-card-meta">${metadata}</span>` : ''}
          </button>
          <div class="song-card-actions">
            <button class="btn-add-setlist" data-id="${song.id}" aria-label="Añadir ${escapeHtml(song.title)} a repertorio" title="Añadir a repertorio"><span aria-hidden="true">＋</span></button>
            <button class="btn-fav-song ${song.isFavorite ? 'fav-active' : ''}" data-id="${song.id}" aria-label="Marcar ${escapeHtml(song.title)} como favorita" title="Favorito"><span aria-hidden="true">${song.isFavorite ? '★' : '☆'}</span></button>
            <button class="btn-del-song" data-id="${song.id}" aria-label="Eliminar ${escapeHtml(song.title)} de la biblioteca" title="Eliminar"><span aria-hidden="true">🗑</span></button>
          </div>
        </div>
      `;
    }).join('');
  }

  renderEmptySongs(icon, title, subtitle) {
    return `
      <div class="library-empty-state">
        <span class="empty-icon" aria-hidden="true">${icon}</span>
        <p class="empty-title">${title}</p>
        <span class="empty-sub">${subtitle}</span>
        <button class="btn-empty-action" id="btnEmptyGoExplore">Explorar canciones</button>
      </div>
    `;
  }

  bindEvents() {
    const searchInput = this.container.querySelector('#libSearchInput');
    searchInput?.addEventListener('input', (event) => {
      this.searchQuery = event.target.value;
      const caret = event.target.selectionStart;
      this.filterAndRender();
      const nextInput = this.container.querySelector('#libSearchInput');
      nextInput?.focus();
      nextInput?.setSelectionRange(caret, caret);
    });

    this.container.querySelector('#btnClearSearch')?.addEventListener('click', () => {
      this.searchQuery = '';
      this.filterAndRender();
      this.container.querySelector('#libSearchInput')?.focus();
    });
    this.container.querySelectorAll('.genre-chip').forEach((chip) => {
      chip.addEventListener('click', (event) => {
        this.activeGenre = event.currentTarget.dataset.genre;
        this.filterAndRender();
      });
    });
    this.container.querySelectorAll('.lib-tab').forEach((tab) => {
      tab.addEventListener('click', async (event) => {
        this.activeFilter = event.currentTarget.dataset.filter;
        if (this.activeFilter === 'setlists') await this.hydrateSetlistSongs();
        this.filterAndRender();
      });
    });
    this.container.querySelector('#btnEmptyGoExplore')?.addEventListener('click', () => events.emit('ui:switchTab', 'explore'));
    this.container.querySelector('#btnCreateSetlist')?.addEventListener('click', () => this.toggleCreateSetlist());
    this.container.querySelector('#btnEmptyCreateSetlist')?.addEventListener('click', () => this.toggleCreateSetlist(true));
    this.container.querySelector('#libFileInput')?.addEventListener('change', async (event) => {
      if (!event.target.files?.length) return;
      toast.show(`Importando ${event.target.files.length} archivo(s)...`, 'info');
      await metadataParser.processFilesBatch(event.target.files);
    });

    if (this.activeFilter === 'setlists') this.bindSetlistEvents();
    else this.bindSongEvents();
  }

  toggleCreateSetlist(forceOpen = false) {
    this.isCreatingSetlist = forceOpen || !this.isCreatingSetlist;
    this.render();
    if (this.isCreatingSetlist) this.container.querySelector('#setlistNewName')?.focus();
  }

  bindSetlistEvents() {
    this.container.querySelector('#setlistCreatePanel')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = new FormData(event.currentTarget).get('name');
      if (!String(name || '').trim()) return;
      const created = await setlistManager.createSetlist(String(name));
      this.isCreatingSetlist = false;
      this.expandedSetlists.add(created.id);
      this.render();
      this.container.querySelector(`[data-action="toggle-setlist"][data-id="${created.id}"]`)?.focus();
    });
    this.container.querySelector('[data-action="cancel-create"]')?.addEventListener('click', () => {
      this.isCreatingSetlist = false;
      this.render();
    });

    this.container.querySelectorAll('[data-action="toggle-setlist"]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.id);
        if (this.expandedSetlists.has(id)) this.expandedSetlists.delete(id);
        else this.expandedSetlists.add(id);
        this.render();
        this.container.querySelector(`[data-action="toggle-setlist"][data-id="${id}"]`)?.focus();
      });
    });
    this.container.querySelectorAll('[data-action="rename-setlist"]').forEach((button) => {
      button.addEventListener('click', () => {
        this.editingSetlistId = Number(button.dataset.id);
        this.expandedSetlists.add(this.editingSetlistId);
        this.render();
        this.container.querySelector(`#setlistRename-${this.editingSetlistId}`)?.select();
      });
    });
    this.container.querySelectorAll('[data-setlist-rename-form]').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = Number(form.dataset.setlistRenameForm);
        const name = new FormData(form).get('name');
        if (await setlistManager.renameSetlist(id, String(name || ''))) {
          this.editingSetlistId = null;
          this.render();
          this.container.querySelector(`[data-action="toggle-setlist"][data-id="${id}"]`)?.focus();
        }
      });
    });
    this.container.querySelectorAll('[data-action="cancel-rename"]').forEach((button) => {
      button.addEventListener('click', () => {
        this.editingSetlistId = null;
        this.render();
      });
    });
    this.container.querySelectorAll('[data-action="delete-setlist"]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (confirm('¿Eliminar este repertorio?')) await setlistManager.deleteSetlist(Number(button.dataset.id));
      });
    });
    this.container.querySelectorAll('[data-action="count-in"]').forEach((select) => {
      select.addEventListener('change', async () => {
        await setlistManager.updateRehearsalSettings(Number(select.dataset.id), { countInSeconds: Number(select.value) });
      });
    });
    this.container.querySelectorAll('[data-action="start-rehearsal"]').forEach((button) => {
      button.addEventListener('click', async () => this.startRehearsal(Number(button.dataset.id)));
    });
    this.container.querySelectorAll('.setlist-song-item').forEach((item) => this.bindSetlistSongEvents(item));
  }

  bindSetlistSongEvents(item) {
    const setlistId = Number(item.dataset.setlistId);
    const songId = Number(item.dataset.songId);
    const index = Number(item.dataset.index);
    item.querySelector('[data-action="move-up"]')?.addEventListener('click', () => this.moveSetlistSong(setlistId, index, index - 1));
    item.querySelector('[data-action="move-down"]')?.addEventListener('click', () => this.moveSetlistSong(setlistId, index, index + 1));
    item.querySelector('[data-action="remove-song"]')?.addEventListener('click', async () => {
      if (confirm('¿Quitar esta canción del repertorio?')) await setlistManager.removeSongFromSetlist(setlistId, songId);
    });

    const details = item.querySelector('.setlist-song-details');
    details?.addEventListener('toggle', () => {
      if (details.open) this.openSongDetails.add(details.dataset.detailKey);
      else this.openSongDetails.delete(details.dataset.detailKey);
    });
    item.querySelector('[data-metadata-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const minutes = Number(data.get('durationMinutes'));
      const seconds = Number(data.get('durationSeconds'));
      const hasDuration = data.get('durationMinutes') !== '' || data.get('durationSeconds') !== '';
      const validMinutes = Number.isFinite(minutes) ? Math.max(0, Math.min(599, Math.round(minutes))) : 0;
      const validSeconds = Number.isFinite(seconds) ? Math.max(0, Math.min(59, Math.round(seconds))) : 0;
      await setlistManager.updateSongMetadata(setlistId, songId, {
        capo: data.get('capo'),
        tuning: data.get('tuning'),
        durationSeconds: hasDuration ? (validMinutes * 60) + validSeconds : null,
      });
      toast.show('Datos de ensayo guardados', 'success');
    });

    const handle = item.querySelector('[data-action="keyboard-move"]');
    handle?.addEventListener('click', () => this.toggleKeyboardMove(setlistId, index));
    handle?.addEventListener('keydown', (event) => this.handleKeyboardMove(event, setlistId, index));
    handle?.addEventListener('dragstart', (event) => {
      this.draggedSong = { setlistId, index };
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `${setlistId}:${index}`);
      item.classList.add('is-dragging');
    });
    handle?.addEventListener('dragend', () => {
      this.draggedSong = null;
      item.classList.remove('is-dragging');
      this.container.querySelectorAll('.is-drag-over').forEach((row) => row.classList.remove('is-drag-over'));
    });
    const dropTarget = item.querySelector('[data-drop-target]');
    dropTarget?.addEventListener('dragover', (event) => {
      if (this.draggedSong?.setlistId !== setlistId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      dropTarget.classList.add('is-drag-over');
    });
    dropTarget?.addEventListener('dragleave', () => dropTarget.classList.remove('is-drag-over'));
    dropTarget?.addEventListener('drop', async (event) => {
      event.preventDefault();
      dropTarget.classList.remove('is-drag-over');
      if (!this.draggedSong || this.draggedSong.setlistId !== setlistId) return;
      await this.moveSetlistSong(setlistId, this.draggedSong.index, index);
      this.draggedSong = null;
    });
  }

  async moveSetlistSong(setlistId, fromIndex, toIndex) {
    if (toIndex < 0) return;
    const moved = await setlistManager.moveSong(setlistId, fromIndex, toIndex);
    if (!moved) return;
    this.announce(`Canción movida a la posición ${toIndex + 1}.`);
    setTimeout(() => {
      this.container.querySelector(`.setlist-song-item[data-setlist-id="${setlistId}"][data-index="${toIndex}"] .setlist-drag-handle`)?.focus();
    }, 0);
  }

  toggleKeyboardMove(setlistId, index) {
    if (this.keyboardMove?.setlistId === setlistId && this.keyboardMove?.index === index) {
      this.keyboardMove = null;
      this.announce(`Posición ${index + 1} confirmada.`);
    } else {
      this.keyboardMove = { setlistId, index };
      this.announce(`Canción seleccionada en la posición ${index + 1}.`);
    }
    this.render();
    this.container.querySelector(`.setlist-song-item[data-setlist-id="${setlistId}"][data-index="${index}"] .setlist-drag-handle`)?.focus();
  }

  async handleKeyboardMove(event, setlistId, index) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.toggleKeyboardMove(setlistId, index);
      return;
    }
    if (event.key === 'Escape' && this.keyboardMove) {
      event.preventDefault();
      this.keyboardMove = null;
      this.announce('Reordenación cancelada.');
      this.render();
      return;
    }
    if (!this.keyboardMove || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const targetIndex = index + (event.key === 'ArrowUp' ? -1 : 1);
    const setlist = setlistManager.getSetlist(setlistId);
    if (!setlist || targetIndex < 0 || targetIndex >= setlist.songIds.length) return;
    this.keyboardMove.index = targetIndex;
    await this.moveSetlistSong(setlistId, index, targetIndex);
  }

  bindSongEvents() {
    this.container.querySelectorAll('.song-card-main').forEach((element) => {
      element.addEventListener('click', async () => this.loadSongById(Number(element.dataset.id)));
    });
    this.container.querySelectorAll('.btn-add-setlist').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const songId = Number(button.dataset.id);
        if (setlistManager.setlists.length === 0) {
          const created = await setlistManager.createSetlist('Mi Repertorio');
          await setlistManager.addSongToSetlist(created.id, songId);
        } else {
          const target = setlistManager.getActiveSetlist() || setlistManager.setlists[0];
          const added = await setlistManager.addSongToSetlist(target.id, songId);
          if (!added) toast.show('La canción ya está en ese repertorio', 'info');
        }
      });
    });
    this.container.querySelectorAll('.btn-fav-song').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        await db.toggleFavorite(Number(button.dataset.id));
        await this.loadLibrary();
      });
    });
    this.container.querySelectorAll('.btn-del-song').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (confirm('¿Eliminar esta partitura de tu biblioteca offline?')) await db.deleteSong(Number(button.dataset.id));
      });
    });
  }

  async startRehearsal(setlistId) {
    const setlist = setlistManager.getSetlist(setlistId);
    if (!setlist?.songIds.length) return;
    this.expandedSetlists.add(setlistId);
    const ready = await setlistManager.startRehearsal(setlistId, 0, setlist.rehearsal.countInSeconds);
    if (!ready) return;
    await this.loadSongById(ready.songId, { showToast: false, switchToPlayer: true });
    toast.show(`Ensayo iniciado: ${setlist.name}`, 'success');
    this.updateRehearsalDock();
  }

  async handleRehearsalDockClick(event) {
    const button = event.target.closest('[data-rehearsal-action]');
    if (!button || this.isNavigatingRehearsal) return;
    const action = button.dataset.rehearsalAction;
    if (action === 'end') {
      setlistManager.endRehearsal();
      toast.show('Ensayo finalizado', 'info');
      return;
    }
    if (action === 'open') {
      const setlist = setlistManager.getActiveSetlist();
      const songId = setlist?.songIds[setlistManager.activeSongIndex];
      if (songId !== undefined) await this.loadSongById(songId, { showToast: false });
      return;
    }
    if (action === 'previous') await this.navigateRehearsal(-1);
    if (action === 'next') await this.navigateRehearsal(1);
  }

  async navigateRehearsal(direction) {
    const targetIndex = setlistManager.activeSongIndex + direction;
    this.isNavigatingRehearsal = true;
    this.updateRehearsalDock();
    try {
      const selected = await setlistManager.selectActiveSong(targetIndex);
      if (!selected) return;
      await this.loadSongById(selected.song.id, { showToast: false, switchToPlayer: true });
      toast.show(`${direction > 0 ? 'Siguiente' : 'Anterior'}: ${selected.song.title}`, 'info');
    } finally {
      this.isNavigatingRehearsal = false;
      this.updateRehearsalDock();
    }
  }

  getRehearsalStatusText() {
    const session = this.rehearsalStatus || setlistManager.rehearsalSession;
    if (!session) return '';
    if (session.status === 'countdown') return `Entramos en ${session.remaining}`;
    if (session.status === 'awaiting-manual') return 'Tema terminado · esperando avance manual';
    if (session.status === 'cancelled') return 'Cuenta atrás cancelada';
    return 'Ensayo activo';
  }

  updateInlineRehearsalStatus() {
    const setlistId = setlistManager.activeSetlistId;
    if (setlistId === null) return;
    const status = this.container?.querySelector(`[data-inline-rehearsal="${setlistId}"]`);
    if (status) status.textContent = this.getRehearsalStatusText();
  }

  updateRehearsalDock() {
    if (!this.rehearsalDock) return;
    const setlist = setlistManager.getActiveSetlist();
    if (!setlist || setlistManager.activeMode !== 'rehearsal') {
      document.body.classList.remove('setlist-rehearsal-active');
      this.rehearsalDock.hidden = true;
      this.rehearsalDock.innerHTML = '';
      return;
    }

    const index = setlistManager.activeSongIndex;
    const songId = setlist.songIds[index];
    const song = this.setlistSongs.get(songId);
    const session = this.rehearsalStatus || setlistManager.rehearsalSession;
    const isCounting = session?.status === 'countdown';
    const statusText = isCounting
      ? `Entramos en ${session.remaining}`
      : session?.status === 'awaiting-manual'
        ? 'Listo para avanzar'
        : `Tema ${index + 1} de ${setlist.songIds.length}`;

    document.body.classList.add('setlist-rehearsal-active');
    this.rehearsalDock.hidden = false;
    this.rehearsalDock.innerHTML = `
      <div class="rehearsal-dock-copy" aria-live="polite" aria-atomic="true">
        <span class="rehearsal-dock-kicker">${escapeHtml(setlist.name)}</span>
        <strong>${isCounting ? escapeHtml(statusText) : escapeHtml(song?.title || 'Canción no disponible')}</strong>
        <span>${isCounting ? 'La partitura se abrirá al terminar' : escapeHtml(statusText)}</span>
      </div>
      <div class="rehearsal-dock-actions">
        <button type="button" data-rehearsal-action="previous" aria-label="Tema anterior" title="Tema anterior" ${isCounting || index <= 0 || this.isNavigatingRehearsal ? 'disabled' : ''}>←</button>
        <button type="button" data-rehearsal-action="open" aria-label="Abrir tema actual" title="Abrir tema actual" ${isCounting || this.isNavigatingRehearsal ? 'disabled' : ''}>↗</button>
        <button type="button" data-rehearsal-action="next" aria-label="Tema siguiente" title="Tema siguiente" ${isCounting || index >= setlist.songIds.length - 1 || this.isNavigatingRehearsal ? 'disabled' : ''}>→</button>
        <button class="danger" type="button" data-rehearsal-action="end" aria-label="Finalizar ensayo" title="Finalizar ensayo">■</button>
      </div>
    `;
  }

  announce(message) {
    const region = this.container?.querySelector('#setlistStudioAnnouncements');
    if (!region) return;
    region.textContent = '';
    requestAnimationFrame(() => { region.textContent = message; });
  }

  async loadSongById(id, { showToast = true, switchToPlayer = true } = {}) {
    try {
      const song = await db.getSong(id);
      if (!song?.data) {
        toast.show('No se pudieron leer los datos de la partitura', 'error');
        return false;
      }
      if (showToast) toast.show(`Cargando "${song.title}"...`, 'info');
      state.set('activeSong', {
        id: song.id,
        title: song.title,
        artist: song.artist,
        tuning: song.tuning || '',
        lyricsChords: song.lyricsChords || '',
      });
      const titleElement = document.getElementById('songInfoTitle');
      const artistElement = document.getElementById('songInfoArtist');
      if (titleElement) titleElement.textContent = song.title;
      if (artistElement) artistElement.textContent = `— ${song.artist}`;
      const playButton = document.getElementById('btnPlayPause');
      const stopButton = document.getElementById('btnStop');
      if (playButton) playButton.disabled = false;
      if (stopButton) stopButton.disabled = false;
      // Validación de partituras dummy cortas
      let finalData = song.data;
      if (typeof finalData === 'string' && finalData.length < 350 && finalData.includes('\\title')) {
        finalData = null;
      }
      
      if (!finalData && song.lyricsChords) {
        finalData = SmartScoreGenerator.generate(song);
      }

      if (switchToPlayer) events.emit('ui:switchTab', 'player');
      
      const loadedSong = { ...song, data: finalData || song.data };
      events.emit('ui:loadLyricsSong', loadedSong);
      if (finalData) audioEngine.loadScoreToAlphaTab(finalData);
      else if (song.data) audioEngine.loadScoreToAlphaTab(song.data);
      
      this.render();
      return true;
    } catch (error) {
      console.error('[LibraryExplorerV2] Error cargando canción por ID:', error);
      toast.show('Error al abrir la partitura seleccionada', 'error');
      return false;
    }
  }

  destroy() {
    document.body.classList.remove('setlist-rehearsal-active');
    this.rehearsalDock?.remove();
    this.rehearsalDock = null;
    super.destroy();
  }
}

export default LibraryExplorerV2;
