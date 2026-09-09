/**
 * @file HomeViewV2.js
 * @description Exploración local con búsqueda avanzada, grupos de versiones y
 * espacio maestro-detalle para escritorio.
 */

import { Component } from './Component.js';
import { icon } from './icons.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { db } from '../data/Database.js';
import { audioEngine } from '../core/AudioEngineV2.js';
import { searchEngine } from '../data/SearchEngine.js';
import { onlineSongProvider } from '../data/OnlineSongProvider.js';
import { toast } from './Toast.js';
import { VersionPickerModal } from './lyrics/VersionPickerModal.js';
import { SessionRecovery } from '../data/SessionRecovery.js';
import { assessSong } from '../data/catalog/CatalogQuality.js';

export class HomeViewV2 extends Component {
  constructor(container) {
    super(container);
    this.searchQuery = '';
    this.selectedGenre = 'all';
    this.selectedContentSource = 'all';
    this.qualityFilter = 'all';
    this.favoritesOnly = false;
    this.songs = [];
    this.songGroups = [];
    this.selectedGroupKey = null;
    this.selectedVersionByGroup = new Map();
    this.facets = { favoriteCount: 0, curatedCount: 0, generatedCount: 0, genres: [] };
    this.totalCount = 0;
    this.totalVersions = 0;
    this.visibleLimit = 60;
    this.isSearching = false;
    this.searchRequest = 0;
    this.exploreMode = 'songs'; // 'songs' | 'artists'
    this.activeArtistFilter = null;
    this.debounceTimer = null;
    this.documentClickHandler = this.handleDocumentClick.bind(this);

    this.ensureStylesheet();
    document.addEventListener('click', this.documentClickHandler);
    this.registerUnsub(() => document.removeEventListener('click', this.documentClickHandler));
    this.registerUnsub(() => clearTimeout(this.debounceTimer));
    this.initEvents();
  }

  ensureStylesheet() {
    if (document.querySelector('link[data-discovery-workspace]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../../assets/css/components/discovery-workspace.css', import.meta.url).href;
    link.dataset.discoveryWorkspace = 'true';
    document.head.appendChild(link);
  }

  initEvents() {
    this.registerUnsub(events.on('db:ready', () => this.loadExploreData({ reload: true })));
    this.registerUnsub(events.on('db:songSaved', () => this.loadExploreData({ reload: true })));
    this.registerUnsub(events.on('db:favoriteToggled', () => this.loadExploreData({ reload: true })));
  }

  escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character]);
  }

  encodeData(value) {
    return encodeURIComponent(String(value ?? ''));
  }

  decodeData(value) {
    try {
      return decodeURIComponent(value || '');
    } catch (_error) {
      return '';
    }
  }

  getSourceLabel(source) {
    return /generated|youtube_ai/.test(source) ? 'Guía generada · sin verificar' : 'Contenido sin verificar';
  }

  getGenreOptions() {
    return this.facets.genres.map(({ name, count }) => ({
      id: searchEngine.normalize(name),
      name,
      count,
    }));
  }

  getSelectedGroup() {
    return this.songGroups.find((group) => group.groupKey === this.selectedGroupKey) || this.songGroups[0] || null;
  }

  getSelectedVersionIndex(group) {
    if (!group) return 0;
    const selected = this.selectedVersionByGroup.get(group.groupKey) ?? 0;
    return Math.min(Math.max(0, selected), Math.max(0, group.versions.length - 1));
  }

  getSelectedVersion(group) {
    return group?.versions?.[this.getSelectedVersionIndex(group)] || group?.primaryVersion || null;
  }

  async loadExploreData({ reload = false, showSkeleton = false } = {}) {
    const requestId = ++this.searchRequest;
    this.isSearching = true;
    if (showSkeleton && this.container.querySelector('.discovery-workspace')) this.renderSkeletonState();

    if (reload) await searchEngine.reloadIndex();
    else await searchEngine.ensureIndex();
    if (requestId !== this.searchRequest) return;

    const searchResult = searchEngine.search({
      query: this.searchQuery,
      filter: this.favoritesOnly ? 'favorites' : 'all',
      genre: this.selectedGenre,
      contentSource: this.selectedContentSource,
      qualityFilter: this.qualityFilter,
      sortBy: this.searchQuery.trim() ? 'title' : 'popular',
      groupBySong: true,
      includeCatalog: true,
      pageSize: this.visibleLimit,
    });

    this.songGroups = [...searchResult.results];
    // Cuando hay homónimos (p. ej. "Dark Horse"), priorizar la versión con
    // letra/acordes curados del repositorio frente a una coincidencia de
    // catálogo únicamente metadata. Así la acción principal abre la canción
    // que el usuario esperaba, sin obligarle a entrar en un selector.
    const normalizedQuery = searchEngine.normalize(this.searchQuery);
    if (normalizedQuery) {
      const curatedExact = this.songGroups.filter((group) => {
        if (searchEngine.normalize(group.title) !== normalizedQuery) return false;
        const known = onlineSongProvider.getKnownSongLyrics(group.title, group.artist);
        return Boolean(known && /\[[A-G][#b]?/.test(String(known)));
      });
      if (curatedExact.length) {
        this.songGroups = [...curatedExact, ...this.songGroups.filter((group) => !curatedExact.includes(group))];
      }
    }
    this.songs = this.songGroups;
    this.facets = searchResult.facets;
    this.totalCount = searchResult.totalCount;
    this.totalVersions = searchResult.totalVersions;
    if (!this.songGroups.some((group) => group.groupKey === this.selectedGroupKey)) {
      this.selectedGroupKey = this.songGroups[0]?.groupKey || null;
    }
    this.isSearching = false;

    if (this.container.querySelector('.explore-view')) this.updateWorkspace();
    else this.render();
  }

  updateGridOnly() {
    this.updateWorkspace();
  }

  updateWorkspace() {
    const qualitySummary = this.container.querySelector('#catalogQualitySummary');
    if (qualitySummary) qualitySummary.innerHTML = this.renderQualitySummary();
    const results = this.container.querySelector('#discoveryResults');
    const detail = this.container.querySelector('#discoveryDetailPanel');
    const status = this.container.querySelector('#discoveryResultStatus');
    const loadMore = this.container.querySelector('#btnLoadMoreSongs');
    const clearButton = this.container.querySelector('#btnClearExploreSearch');

    if (results) {
      results.setAttribute('aria-busy', 'false');
      results.innerHTML = this.renderSongCards();
    }
    if (detail) detail.innerHTML = this.renderDetailPanel();
    if (status) {
      status.textContent = this.exploreMode === 'artists'
        ? 'Explorando artistas y repertorios completos'
        : this.getResultSummary();
    }
    const trendingList = this.container.querySelector('#exploreTrendingList');
    if (trendingList) trendingList.innerHTML = this.renderTrendingSongs();
    if (loadMore) {
      loadMore.hidden = this.exploreMode === 'artists' || this.songGroups.length >= this.totalCount;
    }
    if (clearButton) clearButton.hidden = !this.searchQuery;

    const btnSongs = this.container.querySelector('#btnModeSongs');
    const btnArtists = this.container.querySelector('#btnModeArtists');
    if (btnSongs && btnArtists) {
      const isSongs = this.exploreMode === 'songs';
      btnSongs.setAttribute('aria-pressed', String(isSongs));
      btnArtists.setAttribute('aria-pressed', String(!isSongs));
      btnSongs.style.background = isSongs ? 'var(--accent-primary)' : 'var(--bg-surface-solid)';
      btnSongs.style.borderColor = isSongs ? 'var(--accent-primary)' : 'var(--border-subtle)';
      btnSongs.style.color = isSongs ? 'var(--text-inverse)' : 'var(--text-secondary)';
      btnArtists.style.background = !isSongs ? 'var(--accent-primary)' : 'var(--bg-surface-solid)';
      btnArtists.style.borderColor = !isSongs ? 'var(--accent-primary)' : 'var(--border-subtle)';
      btnArtists.style.color = !isSongs ? 'var(--text-inverse)' : 'var(--text-secondary)';
    }

    this.updateFilterControls();
    this.bindDynamicEvents();
  }

  updateFilterControls() {
    const sourceFilter = this.container.querySelector('#exploreSourceFilter');
    const favoriteFilter = this.container.querySelector('#btnFavoritesFilter');
    const resetFilters = this.container.querySelector('#btnResetExploreFilters');
    const genreButton = this.container.querySelector('#btnToggleGenreFilter');
    const selectedGenre = this.getGenreOptions().find((genre) => genre.id === this.selectedGenre);

    if (sourceFilter) sourceFilter.value = this.selectedContentSource;
    if (favoriteFilter) {
      favoriteFilter.setAttribute('aria-pressed', String(this.favoritesOnly));
      favoriteFilter.classList.toggle('is-active', this.favoritesOnly);
      favoriteFilter.hidden = this.facets.favoriteCount === 0 && !this.favoritesOnly;
    }
    if (resetFilters) {
      resetFilters.hidden = this.selectedGenre === 'all' && this.selectedContentSource === 'all' && !this.favoritesOnly;
    }
    if (genreButton) {
      genreButton.querySelector('.filter-button-label').textContent = selectedGenre?.name || 'Todos los géneros';
      genreButton.classList.toggle('active-filter', this.selectedGenre !== 'all');
    }
    this.container.querySelectorAll('.genre-card-item').forEach((button) => {
      const isActive = button.dataset.genre === this.selectedGenre;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  getRecentSearches() {
    try {
      const parsed = JSON.parse(localStorage.getItem('agy_recent_searches') || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((entry) => typeof entry === 'string'
          ? { query: entry, count: 1, lastUsed: 0 }
          : { query: String(entry.query || ''), count: Number(entry.count) || 1, lastUsed: Number(entry.lastUsed) || 0 })
        .filter((entry) => entry.query.trim())
        .slice(0, 8);
    } catch (_error) {
      return [];
    }
  }

  saveRecentSearches(searches) {
    try {
      localStorage.setItem('agy_recent_searches', JSON.stringify(searches.slice(0, 8)));
    } catch (_error) {
      // El historial es una mejora progresiva; la búsqueda sigue funcionando sin almacenamiento.
    }
  }

  addRecentSearch(query) {
    const cleanQuery = String(query || '').trim().replace(/\s+/g, ' ');
    if (cleanQuery.length < 2) return;
    const normalizedQuery = searchEngine.normalize(cleanQuery);
    const searches = this.getRecentSearches();
    const previous = searches.find((entry) => searchEngine.normalize(entry.query) === normalizedQuery);
    const next = searches.filter((entry) => searchEngine.normalize(entry.query) !== normalizedQuery);
    next.unshift({ query: cleanQuery, count: (previous?.count || 0) + 1, lastUsed: Date.now() });
    this.saveRecentSearches(next);
  }

  removeRecentSearch(query) {
    const normalizedQuery = searchEngine.normalize(query);
    this.saveRecentSearches(this.getRecentSearches().filter((entry) => searchEngine.normalize(entry.query) !== normalizedQuery));
    this.refreshRecentsDropdown();
  }

  refreshRecentsDropdown() {
    const dropdown = this.container.querySelector('#exploreRecentsDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = this.renderRecentsContent();
    this.bindRecentEvents();
  }

  getResultSummary() {
    if (this.isSearching) return 'Buscando en el catálogo local';
    const groupText = this.totalCount === 1 ? '1 canción' : `${this.totalCount.toLocaleString('es-ES')} canciones`;
    const versionText = this.totalVersions === 1 ? '1 versión' : `${this.totalVersions.toLocaleString('es-ES')} versiones`;
    return `${groupText} únicas · ${versionText}`;
  }

  render() {
    if (!this.container) return;
    const catalogStats = onlineSongProvider.getCatalogStats();
    const genres = this.getGenreOptions();
    const selectedGenre = genres.find((genre) => genre.id === this.selectedGenre);

    this.container.innerHTML = `
      <div class="explore-view" role="region" aria-label="Explorar catálogo">
        <header class="explore-hero discovery-header">
          <div class="discovery-brand-row">
            <div><span class="workspace-eyebrow">TU ESTUDIO MUSICAL</span><h1 class="explore-hero-title">Tabs & Chords <span>PRO</span></h1></div>
            <span class="catalog-status">${icon('HardDrive', 16)} <span>${catalogStats.songs.toLocaleString('es-ES')} referencias indexadas</span></span>
          </div>

          <div class="explore-search-container-row discovery-search-row">
            <div class="explore-search-box" id="exploreSearchBoxWrapper" style="position: relative; display: flex; align-items: center;">
              <svg class="search-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0-2.27 6.23l.27.28v.79l5 4.99L20.49 19l-4.99-5ZM9.5 14A4.5 4.5 0 1 1 14 9.5 4.51 4.51 0 0 1 9.5 14Z"/>
              </svg>
              <input type="search" id="exploreSearchInput" class="explore-search-input" placeholder="Buscar canción o artista" value="${this.escapeHTML(this.searchQuery)}" aria-label="Buscar en el catálogo" aria-controls="discoveryResults" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="padding-right: 80px;">
              
              <div style="position: absolute; right: 12px; display: flex; align-items: center; gap: 4px;">
                <button class="btn-clear-search" id="btnClearExploreSearch" type="button" aria-label="Limpiar búsqueda" style="position: static;" ${this.searchQuery ? '' : 'hidden'}>×</button>
                <button class="btn-icon-minimal" id="btnImportYouTubeAI" type="button" aria-label="Añadir canción" title="Añadir canción" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; transition: all 0.2s;">
                  ${icon('Plus', 20)}
                </button>
              </div>

                </button>
              </div>

              <div class="explore-recents-dropdown" id="exploreRecentsDropdown" hidden>
                ${this.renderRecentsContent()}
              </div>
            </div>

            <div class="explore-search-filters-inline">
              <div class="explore-mode-chip-bar" role="group" aria-label="Modo de exploración">
                <button type="button" class="explore-mode-chip ${this.exploreMode === 'songs' ? 'active' : ''}" id="btnModeSongs" data-mode="songs" aria-pressed="${this.exploreMode === 'songs'}">
                  Canciones
                </button>
                <button type="button" class="explore-mode-chip ${this.exploreMode === 'artists' ? 'active' : ''}" id="btnModeArtists" data-mode="artists" aria-pressed="${this.exploreMode === 'artists'}">
                  Artistas
                </button>
              </div>

              <button class="btn-genre-filter-toggle ${this.selectedGenre !== 'all' ? 'active-filter' : ''}" id="btnToggleGenreFilter" type="button" aria-label="Filtrar por género" aria-controls="exploreGenreDropdownFilter" aria-expanded="false">
                <span class="filter-button-label">${this.escapeHTML(selectedGenre?.name || 'Todos los géneros')}</span>
                <span class="dropdown-caret" aria-hidden="true">▾</span>
              </button>
            </div>
          </div>

          <div class="explore-genre-dropdown-filter" id="exploreGenreDropdownFilter" hidden>
            <div class="genre-grid-mobile" role="group" aria-label="Filtro de géneros">
              <button class="genre-card-item ${this.selectedGenre === 'all' ? 'active' : ''}" type="button" data-genre="all" aria-pressed="${this.selectedGenre === 'all'}">Todos</button>
              ${genres.map((genre) => `
                <button class="genre-card-item ${this.selectedGenre === genre.id ? 'active' : ''}" type="button" data-genre="${this.escapeHTML(genre.id)}" aria-pressed="${this.selectedGenre === genre.id}">
                  ${this.escapeHTML(genre.name)} <span class="filter-count">${genre.count}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </header>

        ${this.renderPracticeHub()}

        <div class="explore-secondary-bars">
          <details class="catalog-audit-panel">
            <summary>Estado del catálogo <span>Contenido disponible ≠ canción verificada</span></summary>
            <div id="catalogQualitySummary">${this.renderQualitySummary()}</div>
            <button id="btnExportCatalogAudit" type="button">Descargar inventario y pendientes</button>
          </details>

          <details class="explore-trending-accordion">
            <summary><span><span class="trending-kicker">DESCUBRIR</span><strong>Tendencias para practicar</strong></span><span class="trending-summary-hint">Abrir selección</span></summary>
            <div id="exploreTrendingList" class="explore-trending-list">${this.renderTrendingSongs()}</div>
          </details>
        </div>

        <section class="explore-songs-section" aria-labelledby="discoveryResultStatus">
          <div class="discovery-workspace">
            <div class="discovery-master-pane">
              <div class="discovery-results-heading">
                <h2 id="discoveryResultStatus" class="section-title" aria-live="polite">${this.getResultSummary()}</h2>
                <label class="catalog-quality-filter">Contenido
                  <select id="catalogQualityFilter">
                    <option value="all" ${this.qualityFilter === 'all' ? 'selected' : ''}>Todo lo disponible</option>
                    <option value="chords" ${this.qualityFilter === 'chords' ? 'selected' : ''}>Con marcas de acordes</option>
                    <option value="verified" ${this.qualityFilter === 'verified' ? 'selected' : ''}>Verificación completa</option>
                  </select>
                </label>
              </div>
              <div class="explore-songs-grid discovery-artist-groups" id="discoveryResults" aria-busy="false">
                ${this.renderSongCards()}
              </div>
              <div class="discovery-list-actions">
                <button class="discovery-load-more" id="btnLoadMoreSongs" type="button" ${this.songGroups.length >= this.totalCount ? 'hidden' : ''}>Mostrar más canciones</button>
                <button class="btn-add-custom-song-hero" id="btnOpenSongImporterHero" type="button">Añadir canción</button>
              </div>
            </div>
            <aside class="discovery-detail-panel" id="discoveryDetailPanel" aria-label="Detalle de canción" aria-live="polite">
              ${this.renderDetailPanel()}
            </aside>
          </div>
        </section>
      </div>
    `;
    this.bindEvents();
  }

  renderQualitySummary() {
    const summary = searchEngine.qualitySummary;
    if (!summary) return '<p>Comprobando el contenido local…</p>';
    return `<p><strong>${summary.records.toLocaleString('es-ES')} fichas y versiones</strong> · ${summary.withChords.toLocaleString('es-ES')} con marcas de acordes · ${summary.withTempo.toLocaleString('es-ES')} con BPM declarado.</p>
      <p>Ninguna está certificada como original y completa. La presencia de letra o acordes no demuestra su exactitud. Los textos alternativos se conservan por separado.</p>
      <p>Este inventario no comprueba tus audios importados. La disponibilidad de texto sin conexión no equivale a tener una grabación o un karaoke sincronizado.</p>`;
  }

  renderPracticeHub() {
    const recentSongs = db.getRecentVisitedSongs ? db.getRecentVisitedSongs().slice(0, 3) : [];
    this.savedPractice = new SessionRecovery().read();
    if (this.savedPractice?.song) {
      const saved = this.savedPractice.song;
      const duplicate = recentSongs.findIndex(song => song.title === saved.title && song.artist === saved.artist);
      if (duplicate >= 0) recentSongs.splice(duplicate, 1);
      recentSongs.unshift(saved);
      recentSongs.splice(3);
    }
    let lastSong = recentSongs[0];
    try {
      const persisted = JSON.parse(localStorage.getItem('tabs_last_session') || 'null');
      if (persisted?.title && !lastSong) lastSong = persisted;
    } catch (_) {}
    if (recentSongs.length === 0 && lastSong) recentSongs.push(lastSong);

    if (!lastSong && recentSongs.length === 0) {
      return `
        <section class="practice-hub practice-hub-empty" aria-labelledby="practiceHubTitle">
          <div class="practice-hub-copy">
            <span class="practice-hub-kicker">EMPIEZA EN 5 SEGUNDOS</span>
            <h2 id="practiceHubTitle">Busca una canción y empieza a tocar.</h2>
            <p>Tu biblioteca, preferencias y progreso se guardan automáticamente en este dispositivo.</p>
          </div>
          <div class="practice-hub-steps" aria-label="Cómo empezar">
            <span><b>1</b> Busca</span><span><b>2</b> Abre</span><span><b>3</b> Practica</span>
          </div>
        </section>
      `;
    }

    return `
      <section class="practice-hub" aria-labelledby="practiceHubTitle">
        <div class="practice-hub-heading">
          <div><span class="practice-hub-kicker">TU SESIÓN</span><h2 id="practiceHubTitle">Continúa practicando</h2></div>
          <span class="practice-hub-save">Guardado local automático</span>
        </div>
        <div class="practice-hub-grid">
          ${recentSongs.map((song, index) => `
            <button class="practice-song-card btn-load-recent-song" type="button" ${index === 0 && this.savedPractice ? 'data-resume-snapshot="true"' : ''} data-id="${this.escapeHTML(song.id || '')}" data-title="${this.encodeData(song.title)}" data-artist="${this.encodeData(song.artist)}">
              <span class="practice-song-index">${index === 0 ? 'REANUDAR' : 'RECIENTE'}</span>
              <strong>${this.escapeHTML(song.title)}</strong>
              <span>${this.escapeHTML(song.artist || 'Artista desconocido')}</span>
            </button>
          `).join('')}
        </div>
      </section>
    `;
  }

  renderTrendingSongs() {
    const groups = this.songGroups.slice(0, 6);
    if (!groups.length) return '<p class="trending-empty">Cargando una selección para ti…</p>';
    return groups.map((group) => {
      const version = group.versions?.[0] || group.primaryVersion || {};
      const encodedGroup = this.encodeData(group.groupKey);
      return `<button type="button" class="trending-song-btn btn-trending-song" data-group-key="${encodedGroup}" aria-label="Seleccionar ${this.escapeHTML(group.title)} de ${this.escapeHTML(group.artist)}"><span class="trending-song-index">${String(groups.indexOf(group) + 1).padStart(2, '0')}</span><span><strong>${this.escapeHTML(group.title)}</strong><small>${this.escapeHTML(group.artist)}${version.tempo ? ` · ${version.tempo} BPM` : ''}</small></span><span aria-hidden="true">↗</span></button>`;
    }).join('');
  }

  renderRecentsContent() {
    const recentSearches = this.getRecentSearches();
    const recentSongs = db.getRecentVisitedSongs ? db.getRecentVisitedSongs().slice(0, 5) : [];
    if (recentSongs.length === 0 && recentSearches.length === 0) {
      return '<p class="recents-empty-hint">Empieza a escribir para buscar al instante, incluso con alguna errata.</p>';
    }

    return `
      ${recentSongs.length ? `
        <section class="recents-dropdown-group" aria-labelledby="recentSongsTitle">
          <div class="recents-dropdown-heading"><h2 id="recentSongsTitle" class="recents-dropdown-title">Abiertas recientemente</h2></div>
          <div class="recents-song-list">
            ${recentSongs.map((song) => `
              <button class="recent-song-item-btn btn-load-recent-song" type="button" data-id="${this.escapeHTML(song.id || '')}" data-title="${this.encodeData(song.title)}" data-artist="${this.encodeData(song.artist)}">
                <span class="recent-song-title">${this.escapeHTML(song.title)}</span>
                <span class="recent-song-artist">${this.escapeHTML(song.artist)}</span>
              </button>
            `).join('')}
          </div>
        </section>
      ` : ''}
      ${recentSearches.length ? `
        <section class="recents-dropdown-group" aria-labelledby="recentSearchesTitle">
          <div class="recents-dropdown-heading">
            <h2 id="recentSearchesTitle" class="recents-dropdown-title">Búsquedas recientes</h2>
            <button class="recents-clear-all" id="btnClearRecentSearches" type="button">Borrar historial</button>
          </div>
          <ul class="recent-search-list">
            ${recentSearches.map((entry) => `
              <li>
                <button class="recent-search-button" type="button" data-query="${this.encodeData(entry.query)}">${this.escapeHTML(entry.query)}</button>
                <button class="recent-search-remove" type="button" data-remove-query="${this.encodeData(entry.query)}" aria-label="Eliminar ${this.escapeHTML(entry.query)} del historial">×</button>
              </li>
            `).join('')}
          </ul>
        </section>
      ` : ''}
    `;
  }

  renderSkeletonState() {
    const results = this.container.querySelector('#discoveryResults');
    const status = this.container.querySelector('#discoveryResultStatus');
    const detail = this.container.querySelector('#discoveryDetailPanel');
    if (status) status.textContent = 'Buscando en el catálogo local';
    if (results) {
      results.setAttribute('aria-busy', 'true');
      results.innerHTML = `
        <div class="discovery-skeleton-list" aria-hidden="true">
          ${Array.from({ length: 6 }, () => '<div class="discovery-skeleton-card"><span></span><span></span><span></span></div>').join('')}
        </div>
      `;
    }
    if (detail) detail.innerHTML = '<div class="discovery-detail-skeleton" aria-hidden="true"><span></span><span></span><span></span><span></span></div>';
  }

  renderSongCards() {
    if (this.exploreMode === 'artists') {
      return this.renderArtistDirectory();
    }

    let headerBanner = '';
    if (this.activeArtistFilter) {
      headerBanner = `
        <div class="active-artist-banner" style="display: flex; align-items: center; justify-content: space-between; background: rgba(0, 229, 255, 0.08); border: 1px solid rgba(0, 229, 255, 0.25); border-radius: 12px; padding: 12px 18px; margin-bottom: 16px;">
          <div>
            <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: var(--accent-primary); letter-spacing: 0.05em;">Artista seleccionado</span>
            <h3 style="margin: 2px 0 0 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">${this.escapeHTML(this.activeArtistFilter)}</h3>
          </div>
          <button type="button" class="btn-clear-artist-filter" id="btnClearArtistFilter" style="background: var(--bg-surface-solid); border: 1px solid var(--border-subtle); color: var(--text-primary); font-size: 0.82rem; font-weight: 700; padding: 6px 14px; border-radius: 20px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span>✕</span> Volver a Artistas
          </button>
        </div>
      `;
    }

    if (this.songGroups.length === 0) {
      const queryLabel = this.searchQuery.trim() ? ` para “${this.escapeHTML(this.searchQuery.trim())}”` : '';
      return `
        ${headerBanner}
        <div class="library-empty-state discovery-empty-state">
          <h2>Sin coincidencias${queryLabel}</h2>
          <p>Prueba otra escritura o restablece los filtros activos.</p>
          <button class="btn btn-primary" id="btnCreateMissingSong" type="button">Añadir canción</button>
        </div>
      `;
    }

    return `
      ${headerBanner}
      <div class="artist-song-grid">
        ${this.songGroups.map((group) => this.renderSongCard(group)).join('')}
      </div>
    `;
  }

  selectArtist(artistName) {
    this.activeArtistFilter = artistName;
    this.searchQuery = artistName;
    this.exploreMode = 'songs';
    const input = this.container.querySelector('#exploreSearchInput');
    if (input) input.value = artistName;
    this.loadExploreData({ showSkeleton: true });
  }

  renderArtistDirectory() {
    const artistMap = new Map();
    const source = (searchEngine.catalogIndex && searchEngine.catalogIndex.length)
      ? [...searchEngine.index, ...searchEngine.catalogIndex]
      : searchEngine.index;

    for (const song of source) {
      const a = (song.artist || '').trim();
      if (!a) continue;
      const key = a.toLowerCase();
      if (!artistMap.has(key)) {
        artistMap.set(key, { name: a, genre: song.genre || 'Pop', songs: [] });
      }
      const entry = artistMap.get(key);
      if (entry.songs.length < 4 && !entry.songs.includes(song.title)) {
        entry.songs.push(song.title);
      }
    }

    const priority = [
      'queen', 'the beatles', 'ac/dc', 'coldplay', 'nirvana', 'metallica',
      'ed sheeran', 'oasis', 'adele', 'michael jackson', 'pink floyd',
      'guns n\' roses', 'red hot chili peppers', 'radiohead', 'the cranberries',
      'bob dylan', 'led zeppelin', 'eagles', 'the weeknd', 'harry styles',
      'soda stereo', 'andres calamaro', 'mana', 'juanes', 'eric clapton',
      'green day', 'arctic monkeys', 'bon jovi', 'taylor swift', 'billie eilish',
      'bruno mars', 'dua lipa', 'fleetwood mac', 'u2', 'kansas'
    ];

    const curatedList = [];
    const remainingList = [];

    for (const [key, val] of artistMap.entries()) {
      const prioIdx = priority.indexOf(key);
      if (prioIdx !== -1) {
        curatedList.push({ ...val, prio: prioIdx });
      } else {
        remainingList.push(val);
      }
    }

    curatedList.sort((a, b) => a.prio - b.prio);
    remainingList.sort((a, b) => a.name.localeCompare(b.name, 'es'));

    const allArtists = [...curatedList, ...remainingList];

    return `
      <div class="artist-directory-view" style="width: 100%;">
        <div style="margin-bottom: 18px;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin: 0 0 4px 0;">Artistas y Grupos Legendarios</h3>
          <p style="font-size: 0.84rem; color: var(--text-secondary); margin: 0;">Elige un artista para ver sus canciones y acordes disponibles:</p>
        </div>
        <div class="artist-directory-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px;">
          ${allArtists.slice(0, 50).map((artist) => {
            const hits = artist.songs.slice(0, 3).map(s => this.escapeHTML(s)).join(' · ');
            const cleanGenre = this.normalizeGenre(artist.genre);
            return `
              <article class="artist-card-item" data-artist="${this.encodeData(artist.name)}" style="background: var(--bg-surface-solid); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 16px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, rgba(255,87,34,0.18), rgba(0,229,255,0.18)); border: 1px solid rgba(255,87,34,0.3); display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0;">
                    🎙️
                  </div>
                  <div style="min-width: 0;">
                    <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHTML(artist.name)}</h4>
                    <span style="font-size: 0.74rem; font-weight: 700; color: var(--accent-primary); text-transform: uppercase;">${this.escapeHTML(cleanGenre)}</span>
                  </div>
                </div>
                ${hits ? `
                  <div style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.35;">
                    <span style="color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Éxitos:</span>
                    ${hits}
                  </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid var(--border-subtle);">
                  <span style="font-size: 0.76rem; font-weight: 700; color: var(--text-secondary);">Ver repertorio</span>
                  <span style="font-size: 0.8rem; font-weight: 800; color: var(--accent-primary);">Explorar →</span>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  normalizeGenre(genre) {
    if (!genre) return '';
    const g = genre.toLowerCase().trim();
    const map = {
      'latin': 'Pop Latino',
      'latin pop': 'Pop Latino',
      'latín': 'Pop Latino',
      'rock': 'Rock',
      'pop': 'Pop',
      'indie': 'Indie',
      'indie rock': 'Indie Rock',
      'metal': 'Metal',
      'blues': 'Blues',
      'jazz': 'Jazz',
      'folk': 'Folk',
      'country': 'Country'
    };
    if (map[g]) return map[g];
    // Capitalizar primera letra como fallback
    return g.charAt(0).toUpperCase() + g.slice(1);
  }

  formatContentType(source) {
    if (source === 'curated_lyrics') return '🎸 Acordes PRO';
    if (source === 'youtube_ai') return '🤖 Acordes por IA';
    return '🎸 Tab & Acordes';
  }

  renderSongCard(group) {
    const selectedIndex = this.getSelectedVersionIndex(group);
    const version = group.versions[selectedIndex] || group.primaryVersion;
    const isSelected = group.groupKey === this.selectedGroupKey;
    
    const diff = version.difficulty || 'Sin evaluar';
    const difficultyClass = diff === 'Principiante' ? 'diff-easy'
      : (diff === 'Avanzado' || diff === 'Experto' ? 'diff-hard' : 'diff-med');
      
    const encodedGroup = this.encodeData(group.groupKey);
    const numericTempo = Number(version.tempo);
    const hasTempo = Number.isFinite(numericTempo) && numericTempo > 0;
    const cleanGenre = this.normalizeGenre(version.genre || group.genre);

    return `
      <article class="song-card home-song-card discovery-song-card ${isSelected ? 'is-selected' : ''}" data-group-key="${encodedGroup}">
        <button type="button" class="song-card-main btn-select-song" data-group-key="${encodedGroup}" aria-label="Abrir ${this.escapeHTML(version.title)} de ${this.escapeHTML(version.artist)}">
          <div class="song-card-header-line"><div class="song-card-title">${this.escapeHTML(group.title)}</div><div class="song-open-icon">${icon('ArrowUpRight', 18)}</div></div>
          <div class="song-card-artist">${this.escapeHTML(group.artist)}</div>
          <div class="song-card-meta">
            <div class="song-badge-diff ${difficultyClass}">${this.escapeHTML(diff)}</div>
            ${cleanGenre ? `<div class="genre-badge">${this.escapeHTML(cleanGenre)}</div>` : ''}
            ${hasTempo ? `<div class="meta-pill">${numericTempo} BPM</div>` : ''}
          </div>
          <span class="song-quality-label">${this.escapeHTML((version.quality || assessSong(version)).label)}</span>
          <span class="song-open-label">Abrir${group.versionCount > 1 ? ` · ${group.versionCount} versiones` : ''}</span>
        </button>
      </article>
    `;
  }

  hashForDom(value) {
    return searchEngine.hash(String(value));
  }

  renderDetailPanel() {
    const group = this.getSelectedGroup();
    if (!group) {
      return '<div class="discovery-detail-empty"><h2>Selecciona una canción</h2><p>Aquí podrás comparar sus metadatos y versiones.</p></div>';
    }
    const selectedIndex = this.getSelectedVersionIndex(group);
    const version = this.getSelectedVersion(group);
    const diff = version.difficulty || 'Sin evaluar';
    const encodedGroup = this.encodeData(group.groupKey);
    const numericTempo = Number(version.tempo);
    const metadataRows = [
      version.genre ? `<div><dt>Género</dt><dd>${this.escapeHTML(version.genre)}</dd></div>` : '',
      `<div><dt>Dificultad</dt><dd>${this.escapeHTML(diff)}</dd></div>`,
      version.tuning ? `<div><dt>Afinación</dt><dd>${this.escapeHTML(version.tuning)}</dd></div>` : '',
      Number.isFinite(numericTempo) && numericTempo > 0 ? `<div><dt>Tempo</dt><dd>${numericTempo} BPM</dd></div>` : '',
      `<div><dt>Versiones</dt><dd>${group.versionCount}</dd></div>`,
    ].filter(Boolean).join('');

    return `
      <div class="discovery-detail-content">
        <div class="discovery-detail-eyebrow">Vista previa</div>
        <h2>${this.escapeHTML(group.title)}</h2>
        <p class="discovery-detail-artist">${this.escapeHTML(group.artist)}</p>
        <p class="song-quality-label">${this.escapeHTML((version.quality || assessSong(version)).label)}. ${numericTempo > 0 ? 'BPM declarado, no contrastado con la grabación.' : 'Tempo no documentado.'} La letra local no incluye una base de audio.</p>
        <dl class="discovery-metadata-grid">${metadataRows}</dl>
        <label class="discovery-detail-version-field" for="detailVersionSelect">
          <span>Versión que se abrirá</span>
          <select id="detailVersionSelect" data-group-key="${encodedGroup}">
            ${group.versions.map((item, index) => `<option value="${index}" ${index === selectedIndex ? 'selected' : ''}>${this.escapeHTML(item.versionLabel)}</option>`).join('')}
          </select>
        </label>
        <ol class="discovery-version-list" aria-label="Versiones disponibles">
          ${group.versions.map((item, index) => {
            const summary = item.tuning || '';
            return `
              <li class="${index === selectedIndex ? 'is-current' : ''}">
                <span>${this.escapeHTML(item.versionLabel)}</span>
                ${summary ? `<small>${this.escapeHTML(summary)}</small>` : ''}
              </li>
            `;
          }).join('')}
        </ol>
        <button class="btn-load-detail-song" type="button" data-group-key="${encodedGroup}" data-version-index="${selectedIndex}">Abrir ${this.escapeHTML(version.versionLabel)}</button>
      </div>
    `;
  }

  handleDocumentClick(event) {
    const recents = this.container?.querySelector('#exploreRecentsDropdown');
    const genreDropdown = this.container?.querySelector('#exploreGenreDropdownFilter');
    const genreButton = this.container?.querySelector('#btnToggleGenreFilter');
    if (!event.target.closest('#exploreSearchBoxWrapper') && recents) recents.hidden = true;
    if (!event.target.closest('#exploreGenreDropdownFilter') && !event.target.closest('#btnToggleGenreFilter') && genreDropdown) {
      genreDropdown.hidden = true;
      genreButton?.setAttribute('aria-expanded', 'false');
    }
  }

  bindEvents() {
    this.container.querySelector('#catalogQualityFilter')?.addEventListener('change', event => {
      this.qualityFilter = event.target.value;
      this.exploreMode = 'songs';
      void this.loadExploreData();
    });
    this.container.querySelector('#btnExportCatalogAudit')?.addEventListener('click', () => {
      const records = [...searchEngine.index, ...searchEngine.catalogIndex].map(song => ({
        id: song.id, title: song.title, artist: song.artist, versionId: song.versionId,
        versionLabel: song.versionLabel, quality: song.quality || assessSong(song) }));
      const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(),
        scope: 'Loaded catalogue and song records; imported backing files are not audited here.',
        summary: searchEngine.qualitySummary, records }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'auditoria-catalogo.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
    const input = this.container.querySelector('#exploreSearchInput');
    const recents = this.container.querySelector('#exploreRecentsDropdown');
    const genreDropdown = this.container.querySelector('#exploreGenreDropdownFilter');
    const genreButton = this.container.querySelector('#btnToggleGenreFilter');

    input?.addEventListener('input', (event) => {
      this.searchQuery = event.target.value;
      this.visibleLimit = 60;
      this.searchRequest += 1;
      recents.hidden = Boolean(this.searchQuery.trim());
      clearTimeout(this.debounceTimer);
      this.renderSkeletonState();
      this.debounceTimer = setTimeout(() => this.loadExploreData(), 180);
    });
    input?.addEventListener('focus', () => {
      if (!this.searchQuery.trim()) recents.hidden = false;
    });
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        clearTimeout(this.debounceTimer);
        this.addRecentSearch(this.searchQuery);
        recents.hidden = true;
        this.loadExploreData({ showSkeleton: true });
      } else if (event.key === 'Escape') {
        recents.hidden = true;
      }
    });

    this.container.querySelector('#btnClearExploreSearch')?.addEventListener('click', () => {
      this.searchQuery = '';
      this.visibleLimit = 60;
      input.value = '';
      input.focus();
      this.loadExploreData({ showSkeleton: true });
    });
    this.container.querySelectorAll('.quick-chip-btn').forEach((button) => {
      button.addEventListener('click', () => {
        this.searchQuery = this.decodeData(button.dataset.query);
        this.visibleLimit = 60;
        input.value = this.searchQuery;
        recents.hidden = true;
        this.loadExploreData({ showSkeleton: true });
      });
    });
    this.container.querySelector('#btnToggleGenreFilter')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      const dropdown = this.container.querySelector('#exploreGenreDropdownFilter');
      if (dropdown) dropdown.hidden = expanded;
    });

    this.container.querySelector('#btnImportYouTubeAI')?.addEventListener('click', () => {
      events.emit('ui:openSongImporter', '');
    });

    this.container.querySelector('#exploreSourceFilter')?.addEventListener('change', (event) => {
      this.selectedContentSource = event.target.value;
      this.visibleLimit = 60;
      this.loadExploreData({ showSkeleton: true });
    });
    this.container.querySelector('#btnFavoritesFilter')?.addEventListener('click', () => {
      this.favoritesOnly = !this.favoritesOnly;
      this.visibleLimit = 60;
      this.loadExploreData({ showSkeleton: true });
    });
    this.container.querySelector('#btnResetExploreFilters')?.addEventListener('click', () => {
      this.selectedGenre = 'all';
      this.selectedContentSource = 'all';
      this.favoritesOnly = false;
      this.visibleLimit = 60;
      this.loadExploreData({ showSkeleton: true });
    });
    this.container.querySelectorAll('.genre-card-item').forEach((button) => {
      button.addEventListener('click', () => {
        this.selectedGenre = button.dataset.genre || 'all';
        this.visibleLimit = 60;
        genreDropdown.hidden = true;
        genreButton.setAttribute('aria-expanded', 'false');
        this.loadExploreData({ showSkeleton: true });
      });
    });
    const btnLoadMore = this.container.querySelector('#btnLoadMoreSongs');
    if (btnLoadMore) {
      btnLoadMore.addEventListener('click', () => {
        this.visibleLimit += 60;
        this.loadExploreData({ showSkeleton: true });
      });

      // Paginación infinita fluida
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting && !btnLoadMore.hidden) {
            this.visibleLimit += 60;
            // Quitamos showSkeleton para que sea invisible al usuario
            this.loadExploreData(); 
          }
        }, { rootMargin: '400px' }); // Cargar antes de que el usuario llegue al final
        observer.observe(btnLoadMore);
      }
    }
    this.container.querySelector('#btnOpenSongImporterHero')?.addEventListener('click', () => events.emit('ui:openSongImporter', this.searchQuery));
    this.container.querySelector('#btnModeSongs')?.addEventListener('click', () => {
      this.exploreMode = 'songs';
      this.updateWorkspace();
    });
    this.container.querySelector('#btnModeArtists')?.addEventListener('click', () => {
      this.exploreMode = 'artists';
      this.updateWorkspace();
    });
    this.bindRecentEvents();
    this.bindDynamicEvents();
  }

  bindRecentEvents() {
    this.container.querySelectorAll('.recent-search-button').forEach((button) => {
      button.addEventListener('click', () => {
        this.searchQuery = this.decodeData(button.dataset.query);
        this.container.querySelector('#exploreSearchInput').value = this.searchQuery;
        this.container.querySelector('#exploreRecentsDropdown').hidden = true;
        this.loadExploreData({ showSkeleton: true });
      });
    });
    this.container.querySelectorAll('.recent-search-remove').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.removeRecentSearch(this.decodeData(button.dataset.removeQuery));
      });
    });
    this.container.querySelector('#btnClearRecentSearches')?.addEventListener('click', () => {
      this.saveRecentSearches([]);
      this.refreshRecentsDropdown();
    });
    this.container.querySelectorAll('.btn-load-recent-song').forEach((button) => {
      button.addEventListener('click', async () => {
        if (button.dataset.resumeSnapshot && this.savedPractice) {
          const song = { ...this.savedPractice.song, _practiceRecovery: this.savedPractice };
          state.set('activeSong', song);
          const title = document.getElementById('songInfoTitle');
          const artist = document.getElementById('songInfoArtist');
          if (title) title.textContent = song.title;
          if (artist) artist.textContent = `— ${song.artist}`;
          events.emit('ui:switchTab', 'player');
          events.emit('ui:loadLyricsSong', song);
          if (song.data) audioEngine.loadScoreToAlphaTab(song.data);
          return;
        }
        const songId = Number(button.dataset.id);
        if (Number.isFinite(songId) && songId > 0) await this.playSong(songId);
        else await this.importAndPlaySong(this.decodeData(button.dataset.title), this.decodeData(button.dataset.artist));
      });
    });
  }

  bindDynamicEvents() {
    this.container.querySelector('#btnCreateMissingSong')?.addEventListener('click', () => events.emit('ui:openSongImporter', this.searchQuery));
    this.container.querySelector('#btnClearArtistFilter')?.addEventListener('click', () => {
      this.activeArtistFilter = null;
      this.searchQuery = '';
      const input = this.container.querySelector('#exploreSearchInput');
      if (input) input.value = '';
      this.exploreMode = 'artists';
      this.loadExploreData();
    });
    this.container.querySelectorAll('.artist-card-item').forEach((card) => {
      card.addEventListener('click', () => {
        const artistName = this.decodeData(card.dataset.artist);
        this.selectArtist(artistName);
      });
    });
    this.container.querySelectorAll('.catalog-version-select').forEach((select) => {
      select.addEventListener('change', () => this.selectVersion(this.decodeData(select.dataset.groupKey), Number(select.value)));
    });
    this.container.querySelector('#detailVersionSelect')?.addEventListener('change', (event) => {
      this.selectVersion(this.decodeData(event.target.dataset.groupKey), Number(event.target.value));
    });

    const selectionButtons = Array.from(this.container.querySelectorAll('.btn-select-song, .btn-trending-song'));
    selectionButtons.forEach((button, buttonIndex) => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        this.openGroupVersion(this.decodeData(button.dataset.groupKey));
      });
      button.addEventListener('keydown', (event) => {
        const lastIndex = selectionButtons.length - 1;
        const targetIndex = {
          ArrowDown: Math.min(lastIndex, buttonIndex + 1),
          ArrowRight: Math.min(lastIndex, buttonIndex + 1),
          ArrowUp: Math.max(0, buttonIndex - 1),
          ArrowLeft: Math.max(0, buttonIndex - 1),
          Home: 0,
          End: lastIndex,
        }[event.key];
        if (targetIndex === undefined || targetIndex === buttonIndex) return;
        event.preventDefault();
        selectionButtons[targetIndex]?.focus();
      });
    });

    this.container.querySelectorAll('.discovery-song-card').forEach((card) => {
      const groupKey = this.decodeData(card.dataset.groupKey);
      card.addEventListener('focusin', () => this.selectGroup(groupKey, false));
      card.addEventListener('click', (event) => {
        if (event.target.closest('.btn-load-explore-song, .catalog-version-select')) return;
        const isMobile = window.innerWidth <= 900 || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        if (isMobile) {
          this.openGroupVersion(groupKey);
          return;
        }
        this.selectGroup(groupKey, false);
      });
      card.addEventListener('dblclick', () => {
        this.openGroupVersion(groupKey, undefined, true);
      });
    });
    // Botón "Abrir" de las tarjetas del catálogo: sin índice forzado → activa el picker si hay >1 versiones
    this.container.querySelectorAll('.btn-load-explore-song').forEach((button) => {
      button.addEventListener('click', () => this.openGroupVersion(this.decodeData(button.dataset.groupKey)));
    });
    // Botón "Abrir" del panel detalle: el usuario ya eligió versión explícitamente → entrada directa
    this.container.querySelectorAll('.btn-load-detail-song').forEach((button) => {
      button.addEventListener('click', () => this.openGroupVersion(this.decodeData(button.dataset.groupKey), Number(button.dataset.versionIndex), true));
    });
  }

  selectGroup(groupKey, focusDetail) {
    if (!groupKey) return;
    if (groupKey === this.selectedGroupKey) {
      const detail = this.container.querySelector('#discoveryDetailPanel');
      if (focusDetail && window.matchMedia('(min-width: 1100px)').matches) detail?.querySelector('select, button')?.focus();
      return;
    }
    this.selectedGroupKey = groupKey;
    this.container.querySelectorAll('.discovery-song-card').forEach((card) => {
      card.classList.toggle('is-selected', this.decodeData(card.dataset.groupKey) === groupKey);
    });
    this.container.querySelectorAll('.btn-select-song, .btn-trending-song').forEach((button) => {
      button.classList.toggle('is-selected', this.decodeData(button.dataset.groupKey) === groupKey);
    });
    const detail = this.container.querySelector('#discoveryDetailPanel');
    if (detail) {
      detail.innerHTML = this.renderDetailPanel();
      this.bindDetailEvents();
      if (focusDetail && window.matchMedia('(min-width: 1100px)').matches) detail.querySelector('select, button')?.focus();
    }
  }

  bindDetailEvents() {
    const select = this.container.querySelector('#detailVersionSelect');
    select?.addEventListener('change', () => this.selectVersion(this.decodeData(select.dataset.groupKey), Number(select.value)));
    const openButton = this.container.querySelector('.btn-load-detail-song');
    openButton?.addEventListener('click', () => this.openGroupVersion(this.decodeData(openButton.dataset.groupKey), Number(openButton.dataset.versionIndex)));
  }

  selectVersion(groupKey, versionIndex) {
    const group = this.songGroups.find((item) => item.groupKey === groupKey);
    if (!group) return;
    const activeElement = document.activeElement;
    const restoreDetailFocus = activeElement?.id === 'detailVersionSelect';
    const restoreCardFocus = activeElement?.classList?.contains('catalog-version-select');
    const safeIndex = Math.min(Math.max(0, versionIndex), group.versions.length - 1);
    this.selectedVersionByGroup.set(groupKey, safeIndex);
    this.selectedGroupKey = groupKey;
    this.updateWorkspace();

    let focusTarget = restoreDetailFocus ? this.container.querySelector('#detailVersionSelect') : null;
    if (restoreCardFocus) {
      focusTarget = Array.from(this.container.querySelectorAll('.catalog-version-select'))
        .find((select) => this.decodeData(select.dataset.groupKey) === groupKey);
    }
    focusTarget?.focus({ preventScroll: true });
  }

  buildFallbackAlphaTex(version) {
    // A missing score is not permission to invent the song's arrangement.
    return null;
  }

  cleanVersionObject(version, versionIndex, versionGroup) {
    const { __searchScore, isSongGroup, primaryVersion, versions, ...cleanVersion } = version;
    return {
      ...cleanVersion,
      versionGroup,
      versionIndex,
      versionLabel: version.versionLabel || searchEngine.getVersionLabel(version, versionIndex),
      contentSource: version.contentSource || searchEngine.getContentSource(version),
    };
  }

  async resolveFullVersion(version, versionIndex, versionGroup) {
    const numericId = Number(version.id);
    let fullVersion = { ...version };

    if (Number.isFinite(numericId) && numericId > 0) {
      const storedSong = await db.getSong(numericId);
      if (storedSong) fullVersion = { ...version, ...storedSong, versionLabel: version.versionLabel };
    } else {
      let lyricsChords = version.lyricsChords || '';
      let contentSource = version.contentSource || searchEngine.getContentSource(version);
      if (!lyricsChords) {
        const songSheet = await onlineSongProvider.getSongLyrics(version.title, version.artist);
        lyricsChords = typeof songSheet === 'string' ? songSheet : (songSheet?.chordpro || songSheet?.lyrics || '');
        contentSource = typeof songSheet === 'string' ? 'curated_lyrics' : (songSheet?.source || contentSource);
      }
      
      let finalData = version.data;
      if (typeof finalData === 'string' && finalData.length < 350 && finalData.includes('\\title')) {
        finalData = null; // Ignorar partituras dummy/placeholder hardcodeadas en catálogos
      }

      fullVersion = {
        ...version,
        lyricsChords,
        contentSource,
        data: finalData || this.buildFallbackAlphaTex({ ...version, lyricsChords }),
      };
    }

    return this.cleanVersionObject(fullVersion, versionIndex, versionGroup);
  }

  async getVersionContext(group, versionIndex) {
    const safeIndex = Math.min(Math.max(0, versionIndex), group.versions.length - 1);
    const fullVersions = await Promise.all(
      group.versions.map((version, index) => this.resolveFullVersion(version, index, group.groupKey))
    );
    return {
      versionGroup: group.groupKey,
      versionIndex: safeIndex,
      versionLabel: fullVersions[safeIndex].versionLabel,
      versions: fullVersions,
    };
  }

  async openGroupVersion(groupKey, requestedIndex, forceDirect = false) {
    const group = this.songGroups.find((item) => item.groupKey === groupKey);
    if (!group) return;

    const isAutomatedTest = typeof window !== 'undefined' && Boolean(window.__IS_TESTING__ || navigator.webdriver);
    if (group.versions.length > 1 && !forceDirect && requestedIndex === undefined && !isAutomatedTest) {
      const fullContext = await this.getVersionContext(group, 0);
      VersionPickerModal.open({
        title: group.title,
        artist: group.artist,
        versions: fullContext.versions,
        onSelect: (selectedVer, idx) => {
          this.openGroupVersion(groupKey, idx, true);
        }
      });
      return;
    }

    const versionIndex = Number.isFinite(requestedIndex)
      ? Math.min(Math.max(0, requestedIndex), group.versions.length - 1)
      : this.getSelectedVersionIndex(group);
    const versionContext = await this.getVersionContext(group, versionIndex);
    const version = versionContext.versions[versionIndex];
    if (this.searchQuery) this.addRecentSearch(this.searchQuery);

    const numericId = Number(version.id);
    if (Number.isFinite(numericId) && numericId > 0) await this.playSong(numericId, versionContext);
    else await this.importAndPlaySong(version.title, version.artist, versionContext, version);
  }

  async importAndPlaySong(title, artist, versionContext = null, sourceVersion = {}) {
    const existing = sourceVersion.isCatalogEntry && searchEngine.index.find(song => song.catalogOriginId === sourceVersion.id);
    if (existing) return this.playSong(existing.id, versionContext);
    let lyricsChords = sourceVersion.lyricsChords || '';
    let contentSource = sourceVersion.contentSource || 'generated_chord_guide';
    if (!lyricsChords) {
      const songSheet = await onlineSongProvider.getSongLyrics(title, artist);
      lyricsChords = typeof songSheet === 'string' ? songSheet : (songSheet?.chordpro || songSheet?.lyrics || '');
      contentSource = typeof songSheet === 'string' ? 'curated_lyrics' : (songSheet?.source || contentSource);
    }
    const tempo = Number(sourceVersion.tempo) > 0 ? Number(sourceVersion.tempo) : null;
    let finalData = sourceVersion.data;
    if (typeof finalData === 'string' && finalData.length < 350 && finalData.includes('\\title')) {
      finalData = null;
    }

    const newSong = {
      versionId: sourceVersion.versionId,
      versionLabel: sourceVersion.versionLabel,
      recordingId: sourceVersion.recordingId,
      catalogOriginId: sourceVersion.isCatalogEntry ? sourceVersion.id : undefined,
      tempoSource: sourceVersion.tempoSource || 'unknown',
      provenance: sourceVersion.provenance,
      lyricCues: sourceVersion.lyricCues,
      vocalMelody: sourceVersion.vocalMelody,
      title,
      artist,
      ...(sourceVersion.genre ? { genre: sourceVersion.genre } : {}),
      ...(sourceVersion.difficulty ? { difficulty: sourceVersion.difficulty } : {}),
      ...(sourceVersion.tuning ? { tuning: sourceVersion.tuning } : {}),
      tempo,
      timeSignature: sourceVersion.timeSignature || null,
      tracksCount: sourceVersion.tracksCount || null,
      lyricsChords,
      contentSource,
      data: finalData || this.buildFallbackAlphaTex({ title, artist, tempo, lyricsChords }),
      fileName: sourceVersion.fileName,
      isFavorite: Boolean(sourceVersion.isFavorite),
      addedAt: Date.now(),
    };
    const id = await db.saveSong(newSong);
    newSong.id = id;
    await searchEngine.reloadIndex();
    await db.recordSongVisit(newSong);
    const updatedContext = versionContext ? {
      ...versionContext,
      versions: versionContext.versions.map((version, index) => index === versionContext.versionIndex
        ? this.cleanVersionObject({ ...version, ...newSong }, index, versionContext.versionGroup)
        : version),
    } : null;
    await this.playSong(id, updatedContext);
  }

  async playSong(id, versionContext = null) {
    try {
      const song = await db.getSong(id);
      if (!song) return;
      await db.recordSongVisit(song);
      toast.show(`Cargando "${song.title}"...`, 'info', 1000);

      let lyricsChords = song.lyricsChords;
      if (!lyricsChords || lyricsChords.includes('Interpretada por') || lyricsChords.includes('Acordes colocados para')) {
        const songSheet = await onlineSongProvider.getSongLyrics(song.title, song.artist);
        lyricsChords = typeof songSheet === 'string' ? songSheet : (songSheet?.chordpro || songSheet?.lyrics || '');
        song.lyricsChords = lyricsChords;
        song.contentSource = typeof songSheet === 'string' ? 'curated_lyrics' : (songSheet?.source || 'generated_chord_guide');
        try { await db.saveSong(song); } catch (_error) { /* La reproducción no depende de refrescar metadatos. */ }
      }

      const fallbackVersion = this.cleanVersionObject({ ...song, lyricsChords }, 0, searchEngine.getGroupKey(song));
      const baseContext = versionContext || {
        versionGroup: fallbackVersion.versionGroup,
        versionIndex: 0,
        versionLabel: fallbackVersion.versionLabel,
        versions: [fallbackVersion],
      };
      const safeIndex = Math.min(Math.max(0, baseContext.versionIndex || 0), baseContext.versions.length - 1);
      const contextVersion = baseContext.versions[safeIndex] || fallbackVersion;
      let finalSongData = song.data ?? contextVersion.data;
      if (typeof finalSongData === 'string' && finalSongData.length < 350 && finalSongData.includes('\\title')) {
        finalSongData = this.buildFallbackAlphaTex({ ...song, lyricsChords });
      } else if (!finalSongData) {
        finalSongData = this.buildFallbackAlphaTex({ ...song, lyricsChords });
      }

      const selectedVersion = this.cleanVersionObject({
        ...contextVersion,
        ...song,
        lyricsChords,
        data: finalSongData,
        tempo: Number(song.tempo ?? contextVersion.tempo) || null,
        versionLabel: contextVersion.versionLabel,
        contentSource: song.contentSource || contextVersion.contentSource,
      }, safeIndex, baseContext.versionGroup);
      if (versionContext && !contextVersion.difficulty) delete selectedVersion.difficulty;

      const completeContext = {
        ...baseContext,
        versionIndex: safeIndex,
        versionLabel: selectedVersion.versionLabel,
        versions: baseContext.versions.map((version, index) => index === safeIndex ? selectedVersion : version),
      };
      const activeSong = {
        ...selectedVersion,
        ...completeContext,
        tempo: Number(selectedVersion.tempo) || null,
        difficulty: selectedVersion.difficulty ?? null,
      };
      state.set('activeSong', activeSong);

      const titleElement = document.getElementById('songInfoTitle');
      const artistElement = document.getElementById('songInfoArtist');
      if (titleElement) titleElement.textContent = activeSong.title;
      if (artistElement) artistElement.textContent = `— ${activeSong.artist}`;
      events.emit('ui:switchTab', 'player');
      events.emit('ui:loadLyricsSong', activeSong);
      if (activeSong.data) audioEngine.loadScoreToAlphaTab(activeSong.data);
    } catch (error) {
      console.error('[HomeViewV2] Error al reproducir canción:', error);
      toast.show('No se pudo abrir la versión seleccionada.', 'error');
    }
  }
}

export default HomeViewV2;
