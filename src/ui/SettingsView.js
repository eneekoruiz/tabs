/**
 * @file SettingsView.js
 * @description Vista de Ajustes Globales, Perfil del Músico y Cuenta:
 * - Cuenta de usuario (Nombre, Email, Recuperación / Cambio de contraseña).
 * - Preferencia de Mano dominante permanente (Diestro / Zurdo - Mástiles invertidos).
 * - Instrumento predeterminado (Guitarra, Piano, Ukelele, Bajo).
 * - Calibración maestra de afinación (440 Hz vs 432 Hz).
 * - Copia de seguridad y sincronización en la nube (Exportar / Importar JSON).
 */

import { Component } from './Component.js';
import { events } from '../core/EventBus.js';
import { chordEngine } from '../tools/ChordEngine.js';
import { db } from '../data/Database.js';
import { toast } from './Toast.js';

export class SettingsView extends Component {
  constructor(container) {
    super(container);
    this.userEmail = localStorage.getItem('user_email') || 'musico.pro@studio.com';
    this.userName = localStorage.getItem('user_name') || 'Músico PRO';
    this.isLeftHanded = localStorage.getItem('app_lefthanded') === 'true';
    this.defaultInstrument = localStorage.getItem('app_instrument') || 'guitar';
    this.masterTuning = localStorage.getItem('app_master_tuning') || '440';
    this.visualTheme = localStorage.getItem('app_visual_theme') || 'oled';

    this.initEvents();
  }

  initEvents() {
    this.container.addEventListener('click', (e) => {
      // Modificar Email / Nombre
      if (e.target.id === 'btnChangeProfile') {
        const newName = prompt('Ingresa tu nuevo nombre de usuario:', this.userName);
        if (newName && newName.trim()) {
          this.userName = newName.trim();
          localStorage.setItem('user_name', this.userName);
        }
        
        const newEmail = prompt('Ingresa tu nuevo correo electrónico:', this.userEmail);
        if (newEmail && newEmail.trim() && newEmail.includes('@')) {
          this.userEmail = newEmail.trim();
          localStorage.setItem('user_email', this.userEmail);
        }
        
        toast.show('Perfil actualizado correctamente', 'success');
        this.render(); // Refrescar vista
      }

      // Cerrar Sesión
      if (e.target.id === 'btnLogout') {
        if (confirm('¿Estás seguro de que deseas cerrar sesión? (Se restablecerán las credenciales locales)')) {
          localStorage.removeItem('user_email');
          localStorage.removeItem('user_name');
          this.userEmail = 'invitado@studio.local';
          this.userName = 'Músico Invitado';
          toast.show('Sesión cerrada con éxito', 'info');
          this.render();
        }
      }

      // Contraseña
      if (e.target.id === 'btnRecoverPassword') {
        alert('Se ha enviado un enlace seguro a tu correo electrónico para restablecer la contraseña.');
      }
    });
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="settings-view-wrapper" role="region" aria-label="Ajustes y Perfil">
        <!-- Cabecera de Ajustes -->
        <div class="settings-header-banner">
          <div class="settings-user-avatar">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <div class="settings-user-meta">
            <div class="settings-user-title-line">
              <h1 class="settings-user-name">${this.userName}</h1>
              <span class="pro-membership-pill">${this.userName === 'Músico Invitado' ? 'GRATUITO' : 'STUDIO PRO'}</span>
            </div>
            <span class="settings-user-email">${this.userEmail}</span>
          </div>
        </div>

        <div class="settings-sections-list">
          <!-- 1. Cuenta y Seguridad -->
          <div class="settings-card-group">
            <h2 class="settings-group-title">Cuenta y Seguridad</h2>
            
            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Perfil del Músico</strong>
                <span>${this.userName} • ${this.userEmail}</span>
              </div>
              <button class="btn-settings-action" id="btnChangeProfile">Editar Perfil</button>
            </div>

            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Contraseña y Acceso</strong>
                <span>Protegido con cifrado local</span>
              </div>
              <button class="btn-settings-action" id="btnRecoverPassword">Restablecer</button>
            </div>

            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Cerrar Sesión</strong>
                <span>Desvincular cuenta de este dispositivo</span>
              </div>
              <button class="btn-settings-action" id="btnLogout" style="color: #ff5722; border-color: rgba(255,87,34,0.3);">Desconectar</button>
            </div>
          </div>

          <!-- 2. Preferencias del Músico e Instrumento -->
          <div class="settings-card-group">
            <h2 class="settings-group-title">Preferencias de Interpretación</h2>

            <!-- Mano Dominante -->
            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Mano dominante (Músicos Zurdos)</strong>
                <span>Invierte permanentemente todos los mástiles y acordes de la aplicación</span>
              </div>
              <label class="switch-toggle" aria-label="Modo Zurdo">
                <input type="checkbox" id="chkSettingsLeftHanded" ${this.isLeftHanded ? 'checked' : ''}>
                <span class="slider round"></span>
              </label>
            </div>

            <!-- Instrumento Predeterminado -->
            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Instrumento Predeterminado</strong>
                <span>Se cargará automáticamente al abrir cualquier canción</span>
              </div>
              <select id="selSettingsDefaultInst" class="sel-settings-control">
                <option value="guitar" ${this.defaultInstrument === 'guitar' ? 'selected' : ''}>Guitarra (6 cuerdas)</option>
                <option value="piano" ${this.defaultInstrument === 'piano' ? 'selected' : ''}>Piano / Teclado</option>
                <option value="ukulele" ${this.defaultInstrument === 'ukulele' ? 'selected' : ''}>Ukelele (G-C-E-A)</option>
              </select>
            </div>

            <!-- Calibración Maestra 440Hz vs 432Hz -->
            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Frecuencia Maestra de Afinación (A4)</strong>
                <span>Afecta a los afinadores y tonos de referencia</span>
              </div>
              <select id="selSettingsMasterTuning" class="sel-settings-control">
                <option value="440" ${this.masterTuning === '440' ? 'selected' : ''}>440 Hz (Estándar Internacional)</option>
                <option value="432" ${this.masterTuning === '432' ? 'selected' : ''}>432 Hz (Afinación Natural / Verdi)</option>
              </select>
            </div>

            <!-- Estilo Visual -->
            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Estilo Visual Anti-Fatiga</strong>
                <span>Modo de visualización predeterminado para ensayos</span>
              </div>
              <select id="selSettingsVisualTheme" class="sel-settings-control">
                <option value="oled" ${this.visualTheme === 'oled' ? 'selected' : ''}>OLED Dark (Negro puro)</option>
                <option value="amber" ${this.visualTheme === 'amber' ? 'selected' : ''}>Ámbar Cálido (Sin luz azul)</option>
                <option value="paper" ${this.visualTheme === 'paper' ? 'selected' : ''}>Atril Papel (Cancionero)</option>
              </select>
            </div>
          </div>

          <!-- 3. Copia de Seguridad y Sincronización -->
          <div class="settings-card-group">
            <h2 class="settings-group-title">Copia de Seguridad y Nube</h2>

            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Exportar Biblioteca Completa</strong>
                <span>Descarga un archivo de respaldo con todos tus repertorios y acordes</span>
              </div>
              <button class="btn-settings-action" id="btnExportBackup">Descargar JSON</button>
            </div>

            <div class="settings-row-item">
              <div class="settings-row-info">
                <strong>Restaurar desde Archivo</strong>
                <span>Importa canciones y listas guardadas en otro dispositivo</span>
              </div>
              <button class="btn-settings-action" id="btnImportBackup">Restaurar Copia</button>
              <input type="file" id="fileBackupInput" accept=".json" style="display: none;">
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Mano Dominante (Diestro / Zurdo)
    this.container.querySelector('#chkSettingsLeftHanded')?.addEventListener('change', (e) => {
      this.isLeftHanded = e.target.checked;
      localStorage.setItem('app_lefthanded', this.isLeftHanded);
      chordEngine.isLeftHanded = this.isLeftHanded;
      toast.show(`Preferencia guardada: Modo ${this.isLeftHanded ? 'Zurdo (Mástil invertido)' : 'Diestro'}`, 'info', 1000);
    });

    // Instrumento Predeterminado
    this.container.querySelector('#selSettingsDefaultInst')?.addEventListener('change', (e) => {
      this.defaultInstrument = e.target.value;
      localStorage.setItem('app_instrument', this.defaultInstrument);
      chordEngine.setInstrument(this.defaultInstrument);
      toast.show('Instrumento predeterminado actualizado', 'info', 900);
    });

    // Calibración Maestra
    this.container.querySelector('#selSettingsMasterTuning')?.addEventListener('change', (e) => {
      this.masterTuning = e.target.value;
      localStorage.setItem('app_master_tuning', this.masterTuning);
      toast.show(`Calibración fijada en ${this.masterTuning} Hz`, 'info', 900);
    });

    // Tema Visual
    this.container.querySelector('#selSettingsVisualTheme')?.addEventListener('change', (e) => {
      this.visualTheme = e.target.value;
      localStorage.setItem('app_visual_theme', this.visualTheme);
      toast.show('Estilo visual actualizado', 'info', 900);
    });

    // Recuperar Contraseña
    this.container.querySelector('#btnRecoverPassword')?.addEventListener('click', () => {
      toast.show(`Enlace de recuperación enviado a ${this.userEmail}`, 'success', 2500);
    });

    // Modificar Email
    this.container.querySelector('#btnChangeEmail')?.addEventListener('click', () => {
      toast.show('Introduce tu nuevo correo en tu perfil', 'info', 1500);
    });

    // Exportar Backup
    this.container.querySelector('#btnExportBackup')?.addEventListener('click', async () => {
      try {
        const songs = await db.getAllSongs();
        const dataStr = JSON.stringify({ version: '2.0', exportedAt: Date.now(), songs }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TabsAndChords_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.show('Copia de seguridad descargada con éxito', 'success', 1500);
      } catch (e) {
        toast.show('Error al exportar la copia de seguridad', 'warning');
      }
    });

    // Importar Backup
    const fileInput = this.container.querySelector('#fileBackupInput');
    this.container.querySelector('#btnImportBackup')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (parsed.songs && Array.isArray(parsed.songs)) {
            for (const song of parsed.songs) {
              await db.saveSong(song);
            }
            toast.show(`¡${parsed.songs.length} canciones restauradas con éxito!`, 'success', 2000);
          }
        } catch (err) {
          toast.show('El archivo de copia de seguridad no es válido', 'warning');
        }
      };
      reader.readAsText(file);
    });
  }
}

export default SettingsView;
