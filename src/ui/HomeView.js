/**
 * @file HomeView.js
 * @description Vista Explorar (Home Screen - Estilo Ultimate Guitar).
 * Pantalla limpia con un buscador central gigante "¿Qué quieres tocar?" y filtrado de canciones por género.
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { state } from '../core/State.js';
import { db } from '../data/Database.js';
import { audioEngine } from '../core/AudioEngine.js';
import { searchEngine } from '../data/SearchEngine.js';
import { toast } from './Toast.js';

export class HomeView extends Component {
  constructor(container) {
    super(container);
    this.searchQuery = '';
    this.selectedGenre = 'all';
    this.songs = [];

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
    this.songs = results;
    this.render();
  }

  render() {
    if (!this.container) return;

    const genres = ['all', 'Rock', 'Metal', 'Blues', 'Acoustic', 'Classical', 'Pop', 'Jazz'];

    this.container.innerHTML = `
      <div class="explore-view" role="region" aria-label="Pantalla de exploración">
        <!-- Hero con Buscador Gigante (Ultimate Guitar UX) -->
        <div class="explore-hero">
          <h1 class="explore-hero-title">Tabs & Chords PRO</h1>
          <div class="explore-search-box">
            <span class="explore-search-icon" aria-hidden="true">🔍</span>
            <input type="text" id="exploreSearchInput" class="explore-search-input" placeholder="¿Qué quieres tocar?" value="${this.searchQuery}" aria-label="¿Qué quieres tocar?">
          </div>
        </div>

        <!-- Secciones por Género Musical -->
        <div class="explore-genres-section">
          <h2 class="section-title">Géneros Destacados</h2>
          <div class="genre-grid-mobile" role="group" aria-label="Filtro de géneros">
            ${genres.map(g => `
              <button class="genre-card-item ${this.selectedGenre === g ? 'active' : ''}" data-genre="${g}">
                ${g === 'all' ? '🎸 Todos' : g}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Lista de Resultados / Canciones -->
        <div class="explore-songs-section">
          <h2 class="section-title">Recomendados (${this.songs.length})</h2>
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
          <span class="empty-icon" aria-hidden="true">🔎</span>
          <p>No se encontraron canciones.</p>
        </div>
      `;
    }

    return this.songs.map(song => `
      <div class="song-card home-song-card" data-id="${song.id}">
        <button class="song-card-main btn-load-explore-song" data-id="${song.id}" aria-label="Tocar ${song.title} de ${song.artist}">
          <span class="song-card-title">${song.title}</span>
          <span class="song-card-artist">${song.artist}</span>
          <span class="song-card-meta">
            <span class="genre-badge">${song.genre || 'Rock'}</span>
            <span>♩ ${song.tempo || 120} BPM</span>
          </span>
        </button>
      </div>
    `).join('');
  }

  bindEvents() {
    const input = this.container.querySelector('#exploreSearchInput');
    if (input) {
      input.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.loadExploreData();
      });
    }

    this.container.querySelectorAll('.genre-card-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedGenre = btn.dataset.genre;
        this.loadExploreData();
      });
    });

    this.container.querySelectorAll('.btn-load-explore-song').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id, 10);
        await this.playSong(id);
      });
    });
  }

  async playSong(id) {
    try {
      const song = await db.getSong(id);
      if (!song || !song.data) return;

      toast.show(`Cargando "${song.title}"...`, 'info');
      state.set('activeSong', { id: song.id, title: song.title, artist: song.artist, tuning: song.tuning || 'Standard E' });

      const titleEl = document.getElementById('songInfoTitle');
      const artistEl = document.getElementById('songInfoArtist');
      if (titleEl) titleEl.textContent = song.title;
      if (artistEl) artistEl.textContent = `— ${song.artist}`;

      events.emit('ui:switchTab', 'player');
      audioEngine.loadScoreToAlphaTab(song.data);
    } catch (e) {
      console.error('[HomeView] Error al reproducir canción:', e);
    }
  }
}

export default HomeView;
