/**
 * @file HomeViewV2.js
 * @description Exploración local con búsqueda avanzada, grupos de versiones y
 * espacio maestro-detalle para escritorio.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { db } from '../data/Database.js';
import { audioEngine } from '../core/AudioEngineV2.js';
import { searchEngine } from '../data/SearchEngine.js';
import { onlineSongProvider } from '../data/OnlineSongProvider.js';
import { toast } from './Toast.js';

export class HomeViewV2 extends Component {
  constructor(container) {
    super(container);
    this.searchQuery = '';
    this.selectedGenre = 'all';
    this.selectedContentSource = 'all';
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
    return source === 'curated_lyrics' ? 'Letra curada' : 'Guía generada';
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
      sortBy: this.searchQuery.trim() ? 'title' : 'artist',
      groupBySong: true,
      includeCatalog: true,
      pageSize: this.visibleLimit,
    });

    this.songGroups = searchResult.results;
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
    if (status) status.textContent = this.getResultSummary();
    if (loadMore) loadMore.hidden = this.songGroups.length >= this.totalCount;
    if (clearButton) clearButton.hidden = !this.searchQuery;
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
    return `${groupText}, ${versionText}`;
  }

  render() {
    if (!this.container) return;
    const catalogStats = onlineSongProvider.getCatalogStats();
    const genres = this.getGenreOptions();
    const selectedGenre = genres.find((genre) => genre.id === this.selectedGenre);

    this.container.innerHTML = `
      <div class="explore-view" role="region" aria-label="Explorar catálogo">
        <header class="explore-hero discovery-header">
          <div class="explore-badge-chromatic">CATÁLOGO LOCAL · ${catalogStats.songs.toLocaleString('es-ES')} TÍTULOS · OFFLINE</div>
          <h1 class="explore-hero-title">Tabs & Chords PRO</h1>
          <p class="explore-hero-subtitle">Encuentra canciones, compara versiones y abre la adecuada sin perder el contexto.</p>

          <div class="explore-search-container-row discovery-search-row">
            <div class="explore-search-box" id="exploreSearchBoxWrapper">
              <svg class="search-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0-2.27 6.23l.27.28v.79l5 4.99L20.49 19l-4.99-5ZM9.5 14A4.5 4.5 0 1 1 14 9.5 4.51 4.51 0 0 1 9.5 14Z"/>
              </svg>
              <input type="search" id="exploreSearchInput" class="explore-search-input" placeholder="Busca por canción, artista, género o versión" value="${this.escapeHTML(this.searchQuery)}" aria-label="Buscar en el catálogo" aria-controls="discoveryResults" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
              <button class="btn-clear-search" id="btnClearExploreSearch" type="button" aria-label="Limpiar búsqueda" ${this.searchQuery ? '' : 'hidden'}>×</button>
              <div class="explore-recents-dropdown" id="exploreRecentsDropdown" hidden>
                ${this.renderRecentsContent()}
              </div>
            </div>
            <button class="btn-genre-filter-toggle ${this.selectedGenre !== 'all' ? 'active-filter' : ''}" id="btnToggleGenreFilter" type="button" aria-label="Filtrar por género" aria-controls="exploreGenreDropdownFilter" aria-expanded="false">
              <span class="filter-button-label">${this.escapeHTML(selectedGenre?.name || 'Todos los géneros')}</span>
              <span class="dropdown-caret" aria-hidden="true">▾</span>
            </button>
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

          <div class="discovery-filter-bar" aria-label="Filtros de catálogo">
            <label class="discovery-select-field" for="exploreSourceFilter">
              <span>Contenido</span>
              <select id="exploreSourceFilter">
                <option value="all">Todo</option>
                <option value="curated_lyrics">Letra curada</option>
                <option value="generated_chord_guide">Guía generada</option>
              </select>
            </label>
            <button class="discovery-filter-button ${this.favoritesOnly ? 'is-active' : ''}" id="btnFavoritesFilter" type="button" aria-pressed="${this.favoritesOnly}" ${this.facets.favoriteCount === 0 && !this.favoritesOnly ? 'hidden' : ''}>Favoritos</button>
            <button class="discovery-reset-button" id="btnResetExploreFilters" type="button" ${this.selectedGenre === 'all' && this.selectedContentSource === 'all' && !this.favoritesOnly ? 'hidden' : ''}>Restablecer</button>
          </div>
          <details class="explore-trending-accordion">
            <summary class="trending-summary-btn">
              <span>Sugerencias populares</span>
              <span class="summary-caret" aria-hidden="true">▾</span>
            </summary>
            <div class="explore-quick-chips" role="group" aria-label="Artistas sugeridos">
              ${['Imagine Dragons', 'Ariana Grande', 'The Beatles', 'Katy Perry', 'Queen', 'Taylor Swift', 'Metallica']
                .map((query) => `<button class="quick-chip-btn" type="button" data-query="${this.encodeData(query)}">${this.escapeHTML(query)}</button>`)
                .join('')}
            </div>
          </details>
        </header>

        <section class="explore-songs-section" aria-labelledby="discoveryResultStatus">
          <div class="discovery-workspace">
            <div class="discovery-master-pane">
              <div class="discovery-results-heading">
                <h2 id="discoveryResultStatus" class="section-title" aria-live="polite">${this.getResultSummary()}</h2>
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
    if (this.songGroups.length === 0) {
      const queryLabel = this.searchQuery.trim() ? ` para “${this.escapeHTML(this.searchQuery.trim())}”` : '';
      return `
        <div class="library-empty-state discovery-empty-state">
          <h2>Sin coincidencias${queryLabel}</h2>
          <p>Prueba otra escritura o restablece los filtros activos.</p>
          <button class="btn btn-primary" id="btnCreateMissingSong" type="button">Añadir canción</button>
        </div>
      `;
    }

    const artists = new Map();
    for (const group of this.songGroups) {
      const artistKey = searchEngine.normalize(group.artist || 'Artista desconocido');
      if (!artists.has(artistKey)) artists.set(artistKey, { artist: group.artist || 'Artista desconocido', groups: [] });
      artists.get(artistKey).groups.push(group);
    }

    return Array.from(artists.values()).map(({ artist, groups }, artistIndex) => {
      const headingId = `artist-group-${artistIndex}`;
      return `
        <section class="discovery-artist-section" aria-labelledby="${headingId}">
          <div class="discovery-artist-heading">
            <h3 id="${headingId}">${this.escapeHTML(artist)}</h3>
            <span>${groups.length} ${groups.length === 1 ? 'canción' : 'canciones'}</span>
          </div>
          <div class="artist-song-grid">
            ${groups.map((group) => this.renderSongCard(group)).join('')}
          </div>
        </section>
      `;
    }).join('');
  }

  renderSongCard(group) {
    const selectedIndex = this.getSelectedVersionIndex(group);
    const version = group.versions[selectedIndex] || group.primaryVersion;
    const isSelected = group.groupKey === this.selectedGroupKey;
    const difficultyClass = version.difficulty === 'Principiante' ? 'diff-easy'
      : (version.difficulty === 'Avanzado' || version.difficulty === 'Experto' ? 'diff-hard' : 'diff-med');
    const encodedGroup = this.encodeData(group.groupKey);
    const versionDescriptionId = `versions-${this.hashForDom(group.groupKey)}`;
    const numericTempo = Number(version.tempo);
    const hasTempo = Number.isFinite(numericTempo) && numericTempo > 0;

    return `
      <article class="song-card home-song-card discovery-song-card ${isSelected ? 'is-selected' : ''}" data-group-key="${encodedGroup}">
        <button class="song-card-main btn-select-song" type="button" data-group-key="${encodedGroup}" aria-label="Previsualizar ${this.escapeHTML(version.title)} de ${this.escapeHTML(version.artist)}" aria-controls="discoveryDetailPanel" aria-pressed="${isSelected}">
          <div class="song-card-header-line">
            <span class="song-card-title">${this.escapeHTML(group.title)}</span>
            ${version.difficulty ? `<span class="song-badge-diff ${difficultyClass}">${this.escapeHTML(version.difficulty)}</span>` : ''}
          </div>
          <span class="song-card-artist">${this.escapeHTML(group.artist)}</span>
          <div class="song-card-meta">
            ${version.genre ? `<span class="genre-badge">${this.escapeHTML(version.genre)}</span>` : ''}
            ${hasTempo ? `<span class="meta-pill">${numericTempo} BPM</span>` : ''}
            <span class="meta-pill">${this.escapeHTML(this.getSourceLabel(version.contentSource))}</span>
            ${group.versionCount > 1 ? `<span class="meta-pill version-count-badge">${group.versionCount} versiones</span>` : ''}
          </div>
        </button>
        <div class="catalog-version-row" id="${versionDescriptionId}">
          ${group.versionCount > 1 ? `
            <label>
              <span>Versión</span>
              <select class="catalog-version-select" data-group-key="${encodedGroup}">
                ${group.versions.map((item, index) => `<option value="${index}" ${index === selectedIndex ? 'selected' : ''}>${this.escapeHTML(item.versionLabel)}</option>`).join('')}
              </select>
            </label>
          ` : `<span class="single-version-label">${this.escapeHTML(version.versionLabel)}</span>`}
          <button class="btn-load-explore-song" type="button" data-group-key="${encodedGroup}" data-version-index="${selectedIndex}" data-id="${this.escapeHTML(version.id || '')}" data-title="${this.encodeData(version.title)}" data-artist="${this.encodeData(version.artist)}" aria-label="Abrir ${this.escapeHTML(version.title)} de ${this.escapeHTML(version.artist)}, ${this.escapeHTML(version.versionLabel)}">
            <span>Abrir</span>
            <span class="sr-only">${this.escapeHTML(version.title)}</span>
          </button>
        </div>
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
    const encodedGroup = this.encodeData(group.groupKey);
    const numericTempo = Number(version.tempo);
    const metadataRows = [
      version.genre ? `<div><dt>Género</dt><dd>${this.escapeHTML(version.genre)}</dd></div>` : '',
      version.difficulty ? `<div><dt>Dificultad</dt><dd>${this.escapeHTML(version.difficulty)}</dd></div>` : '',
      version.tuning ? `<div><dt>Afinación</dt><dd>${this.escapeHTML(version.tuning)}</dd></div>` : '',
      Number.isFinite(numericTempo) && numericTempo > 0 ? `<div><dt>Tempo</dt><dd>${numericTempo} BPM</dd></div>` : '',
      `<div><dt>Contenido</dt><dd>${this.escapeHTML(this.getSourceLabel(version.contentSource))}</dd></div>`,
      `<div><dt>Versiones</dt><dd>${group.versionCount}</dd></div>`,
    ].filter(Boolean).join('');

    return `
      <div class="discovery-detail-content">
        <div class="discovery-detail-eyebrow">Vista previa</div>
        <h2>${this.escapeHTML(group.title)}</h2>
        <p class="discovery-detail-artist">${this.escapeHTML(group.artist)}</p>
        <dl class="discovery-metadata-grid">${metadataRows}</dl>
        <label class="discovery-detail-version-field" for="detailVersionSelect">
          <span>Versión que se abrirá</span>
          <select id="detailVersionSelect" data-group-key="${encodedGroup}">
            ${group.versions.map((item, index) => `<option value="${index}" ${index === selectedIndex ? 'selected' : ''}>${this.escapeHTML(item.versionLabel)}</option>`).join('')}
          </select>
        </label>
        <ol class="discovery-version-list" aria-label="Versiones disponibles">
          ${group.versions.map((item, index) => {
            const summary = [this.getSourceLabel(item.contentSource), item.tuning].filter(Boolean).join(' · ');
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
    genreButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      genreDropdown.hidden = !genreDropdown.hidden;
      genreButton.setAttribute('aria-expanded', String(!genreDropdown.hidden));
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
    this.container.querySelector('#btnLoadMoreSongs')?.addEventListener('click', () => {
      this.visibleLimit += 60;
      this.loadExploreData({ showSkeleton: true });
    });
    this.container.querySelector('#btnOpenSongImporterHero')?.addEventListener('click', () => events.emit('ui:openSongImporter', this.searchQuery));
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
        const songId = Number(button.dataset.id);
        if (Number.isFinite(songId) && songId > 0) await this.playSong(songId);
        else await this.importAndPlaySong(this.decodeData(button.dataset.title), this.decodeData(button.dataset.artist));
      });
    });
  }

  bindDynamicEvents() {
    this.container.querySelector('#btnCreateMissingSong')?.addEventListener('click', () => events.emit('ui:openSongImporter', this.searchQuery));
    this.container.querySelectorAll('.catalog-version-select').forEach((select) => {
      select.addEventListener('change', () => this.selectVersion(this.decodeData(select.dataset.groupKey), Number(select.value)));
    });
    this.container.querySelector('#detailVersionSelect')?.addEventListener('change', (event) => {
      this.selectVersion(this.decodeData(event.target.dataset.groupKey), Number(event.target.value));
    });

    const selectionButtons = Array.from(this.container.querySelectorAll('.btn-select-song'));
    selectionButtons.forEach((button, buttonIndex) => {
      button.addEventListener('click', () => this.selectGroup(this.decodeData(button.dataset.groupKey), false));
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
        this.selectGroup(groupKey, false);
      });
    });
    this.container.querySelectorAll('.btn-load-explore-song, .btn-load-detail-song').forEach((button) => {
      button.addEventListener('click', () => this.openGroupVersion(this.decodeData(button.dataset.groupKey), Number(button.dataset.versionIndex)));
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
    this.container.querySelectorAll('.btn-select-song').forEach((button) => {
      button.setAttribute('aria-pressed', String(this.decodeData(button.dataset.groupKey) === groupKey));
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
    const title = String(version.title || 'Sin título').replace(/"/g, '\\"');
    const artist = String(version.artist || 'Artista desconocido').replace(/"/g, '\\"');
    const tempo = Number(version.tempo) || 120;
    return `\\title "${title}" \\artist "${artist}" \\tempo ${tempo} . :4 (3.6 2.5 0.4 0.3) :4 (0.4 2.3 3.2) :4 (0.5 2.4 2.3) :4 (3.5 2.4 0.3 1.2) |`;
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
      fullVersion = {
        ...version,
        lyricsChords,
        contentSource,
        data: version.data || this.buildFallbackAlphaTex(version),
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

  async openGroupVersion(groupKey, requestedIndex) {
    const group = this.songGroups.find((item) => item.groupKey === groupKey);
    if (!group) return;
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
    let lyricsChords = sourceVersion.lyricsChords || '';
    let contentSource = sourceVersion.contentSource || 'generated_chord_guide';
    if (!lyricsChords) {
      const songSheet = await onlineSongProvider.getSongLyrics(title, artist);
      lyricsChords = typeof songSheet === 'string' ? songSheet : (songSheet?.chordpro || songSheet?.lyrics || '');
      contentSource = typeof songSheet === 'string' ? 'curated_lyrics' : (songSheet?.source || contentSource);
    }
    const tempo = Number(sourceVersion.tempo) || 120;
    const newSong = {
      title,
      artist,
      ...(sourceVersion.genre ? { genre: sourceVersion.genre } : {}),
      ...(sourceVersion.difficulty ? { difficulty: sourceVersion.difficulty } : {}),
      ...(sourceVersion.tuning ? { tuning: sourceVersion.tuning } : {}),
      tempo,
      timeSignature: sourceVersion.timeSignature || '4/4',
      tracksCount: sourceVersion.tracksCount || 1,
      lyricsChords,
      contentSource,
      data: sourceVersion.data || this.buildFallbackAlphaTex({ title, artist, tempo }),
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
      const selectedVersion = this.cleanVersionObject({
        ...contextVersion,
        ...song,
        lyricsChords,
        data: song.data ?? contextVersion.data,
        tempo: Number(song.tempo ?? contextVersion.tempo) || 120,
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
        tempo: Number(selectedVersion.tempo) || 120,
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
