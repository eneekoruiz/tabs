import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { db } from '../data/Database.js';

export class CommandPalette extends Component {
  constructor() {
    // Inject palette container into body
    const div = document.createElement('div');
    div.id = 'command-palette-root';
    document.body.appendChild(div);
    super(div);
    
    this.isVisible = false;
    this.searchQuery = '';
    this.results = [];
    this.selectedIndex = 0;
    
    this.initEvents();
  }

  initEvents() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.toggle();
      }
      
      if (!this.isVisible) return;
      
      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
        this.renderResults();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.renderResults();
      } else if (e.key === 'Enter' && this.results[this.selectedIndex]) {
        e.preventDefault();
        this.executeCommand(this.results[this.selectedIndex]);
      }
    });
  }

  toggle() {
    this.isVisible = !this.isVisible;
    if (this.isVisible) {
      this.searchQuery = '';
      this.results = this.getDefaultCommands();
      this.selectedIndex = 0;
      this.render();
      setTimeout(() => this.container.querySelector('#cmdInput')?.focus(), 50);
    } else {
      this.container.innerHTML = '';
    }
  }

  close() {
    this.isVisible = false;
    this.container.innerHTML = '';
  }

  getDefaultCommands() {
    return [
      { id: 'nav_explore', icon: '🔍', title: 'Ir a Explorar', type: 'Navegación' },
      { id: 'nav_library', icon: '📚', title: 'Ir a Biblioteca / Setlists', type: 'Navegación' },
      { id: 'nav_tools', icon: '🎛️', title: 'Abrir Herramientas de Estudio', type: 'Navegación' },
      { id: 'nav_settings', icon: '⚙️', title: 'Ajustes de Cuenta', type: 'Navegación' },
      { id: 'action_theme', icon: '🎨', title: 'Alternar Tema (Claro / Oscuro)', type: 'Acción' }
    ];
  }

  async handleInput(e) {
    this.searchQuery = e.target.value.toLowerCase();
    this.selectedIndex = 0;
    
    if (!this.searchQuery) {
      this.results = this.getDefaultCommands();
      this.renderResults();
      return;
    }

    const defaultCmds = this.getDefaultCommands().filter(c => 
      c.title.toLowerCase().includes(this.searchQuery) || c.type.toLowerCase().includes(this.searchQuery)
    );

    // Search songs in DB
    const songs = await db.getAllSongs();
    const songResults = songs.filter(s => 
      s.title.toLowerCase().includes(this.searchQuery) || 
      (s.artist && s.artist.toLowerCase().includes(this.searchQuery))
    ).slice(0, 5).map(s => ({
      id: 'play_song',
      song: s,
      icon: '🎵',
      title: `${s.title} - ${s.artist}`,
      type: 'Catálogo Local'
    }));

    this.results = [...defaultCmds, ...songResults];
    this.renderResults();
  }

  executeCommand(cmd) {
    this.close();
    switch(cmd.id) {
      case 'nav_explore': events.emit('ui:navigate', 'home'); break;
      case 'nav_library': events.emit('ui:navigate', 'library'); break;
      case 'nav_tools': events.emit('ui:navigate', 'tools'); break;
      case 'nav_settings': events.emit('ui:navigate', 'settings'); break;
      case 'action_theme':
        const current = localStorage.getItem('app_visual_theme');
        const next = current === 'paper' ? 'oled' : 'paper';
        localStorage.setItem('app_visual_theme', next);
        document.body.className = next === 'paper' ? 'theme-ivory' : 'theme-charcoal';
        break;
      case 'play_song':
        events.emit('ui:loadSong', cmd.song);
        events.emit('ui:navigate', 'chords');
        break;
    }
  }

  renderResults() {
    const listEl = this.container.querySelector('.cmd-results');
    if (!listEl) return;
    
    if (this.results.length === 0) {
      listEl.innerHTML = '<div class="cmd-empty">No hay resultados</div>';
      return;
    }

    listEl.innerHTML = this.results.map((cmd, idx) => `
      <div class="cmd-item ${idx === this.selectedIndex ? 'active' : ''}" data-idx="${idx}">
        <span class="cmd-icon">${cmd.icon}</span>
        <div class="cmd-info">
          <span class="cmd-title">${cmd.title}</span>
          <span class="cmd-type">${cmd.type}</span>
        </div>
        ${idx === this.selectedIndex ? '<span class="cmd-enter">↵</span>' : ''}
      </div>
    `).join('');

    listEl.querySelectorAll('.cmd-item').forEach(el => {
      el.addEventListener('mouseenter', () => {
        this.selectedIndex = parseInt(el.dataset.idx, 10);
        this.renderResults();
      });
      el.addEventListener('click', () => {
        this.executeCommand(this.results[this.selectedIndex]);
      });
    });
  }

  render() {
    this.container.innerHTML = `
      <div class="cmd-backdrop"></div>
      <div class="cmd-palette-box">
        <div class="cmd-header">
          <input type="text" id="cmdInput" class="cmd-input" placeholder="Buscar canciones, herramientas o comandos..." autocomplete="off">
          <span class="cmd-shortcut-hint">ESC para cerrar</span>
        </div>
        <div class="cmd-results">
        </div>
      </div>
    `;

    this.container.querySelector('.cmd-backdrop').addEventListener('click', () => this.close());
    this.container.querySelector('#cmdInput').addEventListener('input', (e) => this.handleInput(e));
    
    this.renderResults();
  }
}
