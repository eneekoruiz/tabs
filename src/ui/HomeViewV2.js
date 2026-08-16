/**
 * @file HomeViewV2.js
 * @description Vista Explorar Unificada con Buscador Masivo (+15.000 canciones):
 * - Catálogo unificado sin divisiones confusas entre local y online.
 * - Soporte para discografías completas (Katy Perry, Bruno Mars, Dua Lipa, The Beatles, Queen, etc.).
 * - Estética Studio PRO con iconos vectoriales y acabado cromático.
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
    this.songs = [];
    this.isSearching = false;

    this.initEvents();
  }

  initEvents() {
    this.registerUnsub(
      events.on('db:ready', async () => {
        await this.loadExploreData();
      })
    );

    this.registerUnsub(
      events.on('db:songSaved', async () => {
        await this.loadExploreData();
      })
    );
  }

  async loadExploreData() {
    await searchEngine.reloadIndex();
    const { results } = searchEngine.search({
      query: this.searchQuery,
      genre: this.selectedGenre,
    });

    let combined = [...results];

    // Si hay búsqueda activa, buscar también en el catálogo masivo online y combinar sin duplicados
    if (this.searchQuery.trim().length >= 1) {
      const onlineMatches = await onlineSongProvider.searchOnline(this.searchQuery);
      for (const item of onlineMatches) {
        if (!combined.some(c => c.title.toLowerCase() === item.title.toLowerCase() && c.artist.toLowerCase() === item.artist.toLowerCase())) {
          combined.push(item);
        }
      }
    }

    this.songs = combined;
    this.render();
  }

  render() {
    if (!this.container) return;

    const genres = [
      { id: 'all', label: 'Todos los Estilos' },
      { id: 'Rock', label: 'Rock Clásico & Moderno' },
      { id: 'Pop', label: 'Pop Internacional' },
      { id: 'Acoustic', label: 'Acústico & Folk' },
      { id: 'Metal', label: 'Heavy Metal' },
      { id: 'Blues', label: 'Blues & Jazz' },
    ];

    this.container.innerHTML = `
      <div class="explore-view" role="region" aria-label="Pantalla de exploración">
        <!-- Hero con Buscador Gigante Unificado -->
        <div class="explore-hero">
          <div class="explore-badge-chromatic">STUDIO PRO CATALOG</div>
          <h1 class="explore-hero-title">Tabs & Chords PRO</h1>
          <p class="explore-hero-subtitle">Acceso instantáneo a más de 15.000 canciones con letra oficial, acordes interactivos y tablaturas</p>
          
          <div class="explore-search-box">
            <svg class="search-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input type="text" id="exploreSearchInput" class="explore-search-input" placeholder="Busca por canción o artista (Katy Perry, Beatles, Bruno Mars, Queen...)" value="${this.searchQuery}" aria-label="¿Qué quieres tocar?">
            ${this.searchQuery ? `<button class="btn-clear-search" id="btnClearExploreSearch" aria-label="Limpiar búsqueda">✕</button>` : ''}
          </div>

          <!-- Botón de Importación Rápida -->
          <button class="btn-add-custom-song-hero" id="btnOpenSongImporterHero" aria-label="Añadir nueva canción">
            <span>+ ¿Quieres otra canción? Añádela o pega su letra aquí</span>
          </button>
        </div>

        <!-- Secciones por Género Musical -->
        <div class="explore-genres-section">
          <h2 class="section-title">Explorar por Género</h2>
          <div class="genre-grid-mobile" role="group" aria-label="Filtro de géneros">
            ${genres.map(g => `
              <button class="genre-card-item ${this.selectedGenre === g.id ? 'active' : ''}" data-genre="${g.id}">
                ${g.label}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Lista Unificada de Canciones -->
        <div class="explore-songs-section">
          <div class="section-header-row">
            <h2 class="section-title">Repertorio Disponible (${this.songs.length} temas encontrados)</h2>
          </div>
          <div class="explore-songs-grid">
            ${this.renderSongCards()}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderSongCards() {
    if (this.songs.length === 0) {
      return `
        <div class="library-empty-state">
          <p>No se encontraron canciones para "${this.searchQuery}".</p>
          <button class="btn btn-primary" id="btnCreateMissingSong" style="margin-top: 12px;">
            Añadir "${this.searchQuery}" con letra y acordes
          </button>
        </div>
      `;
    }

    return this.songs.map(song => {
      const difficultyClass = song.difficulty === 'Principiante' ? 'diff-easy' : (song.difficulty === 'Avanzado' || song.difficulty === 'Experto' ? 'diff-hard' : 'diff-med');
      const isOnlineOnly = song.isOnline;

      return `
        <div class="song-card home-song-card ${isOnlineOnly ? 'song-card-online' : ''}" data-id="${song.id || ''}">
          <button class="song-card-main btn-load-explore-song" data-id="${song.id || ''}" data-title="${encodeURIComponent(song.title)}" data-artist="${encodeURIComponent(song.artist)}" aria-label="Tocar ${song.title} de ${song.artist}">
            <div class="song-card-header-line">
              <span class="song-card-title">${song.title}</span>
              <span class="song-badge-diff ${difficultyClass}">${song.difficulty || 'Intermedio'}</span>
            </div>
            <span class="song-card-artist">${song.artist}</span>
            <div class="song-card-meta">
              <span class="genre-badge">${song.genre || 'Pop'}</span>
              <span class="meta-pill">♩ ${song.tempo || 120} BPM</span>
              <span class="meta-pill">${song.tuning || 'Standard E'}</span>
            </div>
          </button>
        </div>
      `;
    }).join('');
  }

  bindEvents() {
    const input = this.container.querySelector('#exploreSearchInput');
    if (input) {
      let debounceTimer = null;
      input.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.loadExploreData();
        }, 200);
      });
    }

    this.container.querySelector('#btnClearExploreSearch')?.addEventListener('click', () => {
      this.searchQuery = '';
      this.loadExploreData();
    });

    this.container.querySelector('#btnOpenSongImporterHero')?.addEventListener('click', () => {
      events.emit('ui:openSongImporter', this.searchQuery);
    });

    this.container.querySelector('#btnCreateMissingSong')?.addEventListener('click', () => {
      events.emit('ui:openSongImporter', this.searchQuery);
    });

    this.container.querySelectorAll('.genre-card-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedGenre = btn.dataset.genre;
        this.loadExploreData();
      });
    });

    this.container.querySelectorAll('.btn-load-explore-song').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id ? parseInt(btn.dataset.id, 10) : null;
        const title = decodeURIComponent(btn.dataset.title);
        const artist = decodeURIComponent(btn.dataset.artist);

        if (id && !isNaN(id)) {
          await this.playSong(id);
        } else {
          await this.importAndPlaySong(title, artist);
        }
      });
    });
  }

  async importAndPlaySong(title, artist) {
    toast.show(`Cargando "${title}"...`, 'info');

    const lyricsChords = await onlineSongProvider.fetchLyricsAndChords(title, artist);
    const alphaTexData = `\\title "${title}" \\artist "${artist}" \\tempo 120 . :4 (3.6 2.5 0.4 0.3) :4 (0.4 2.3 3.2) :4 (0.5 2.4 2.3) :4 (3.5 2.4 0.3 1.2) |`;

    const newSong = {
      title,
      artist,
      genre: 'Pop',
      difficulty: 'Intermedio',
      tuning: 'Standard E',
      tempo: 120,
      timeSignature: '4/4',
      tracksCount: 3,
      lyricsChords,
      data: alphaTexData,
      isFavorite: false,
      addedAt: Date.now(),
    };

    const id = await db.saveSong(newSong);
    newSong.id = id;
    await searchEngine.reloadIndex();

    await this.playSong(id);
  }

  async playSong(id) {
    try {
      const song = await db.getSong(id);
      if (!song) return;

      toast.show(`Cargando "${song.title}"...`, 'info');

      let lyricsChords = song.lyricsChords;
      if (!lyricsChords || lyricsChords.includes('Interpretada por') || lyricsChords.includes('Acordes colocados para')) {
        lyricsChords = await onlineSongProvider.fetchLyricsAndChords(song.title, song.artist);
        song.lyricsChords = lyricsChords;
        try {
          await db.saveSong(song);
        } catch (e) {}
      }

      state.set('activeSong', { 
        id: song.id, 
        title: song.title, 
        artist: song.artist, 
        tuning: song.tuning || 'Standard E',
        lyricsChords: lyricsChords,
      });

      const titleEl = document.getElementById('songInfoTitle');
      const artistEl = document.getElementById('songInfoArtist');
      if (titleEl) titleEl.textContent = song.title;
      if (artistEl) artistEl.textContent = `— ${song.artist}`;

      events.emit('ui:switchTab', 'player');
      events.emit('ui:loadLyricsSong', { ...song, lyricsChords });
      if (song.data) {
        audioEngine.loadScoreToAlphaTab(song.data);
      }
    } catch (e) {
      console.error('[HomeViewV2] Error al reproducir canción:', e);
    }
  }
}

export default HomeViewV2;
