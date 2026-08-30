# 🎸 Tabs & Chords PRO - Visor, Reproductor & DAW de Tablaturas Offline

> **Plataforma Mobile-First (Estilo Ultimate Guitar) & DAW de Tablaturas Offline: Navegación Inferior, Buscador Hero "¿Qué quieres tocar?", Afinador de Oído, Acordes con IA, Reproductor Limpio (90% Lienzo), Backing Tracks (MP3/WAV Sync), Visualizadores Multi-Instrumento, Modo Directo (Gig Mode) y Exportación (PDF, MIDI, MusicXML).**

---

## 📱 Rediseño Mobile-First & UX Calco de Ultimate Guitar

### 🧭 1. Navegación Inferior Fija (Bottom Nav Bar)
- **🔍 Explorar (Home View)**:
  - Buscador Hero central gigante: `¿Qué quieres tocar?` para encontrar al instante cualquier artista, canción o género.
  - Filtros táctiles por género musical (Rock, Metal, Blues, Acústico, Clásica, Pop, Jazz).
- **📚 Mis Tabs (Library & Setlists)**:
  - Catálogo local para acceso 100% offline y gestión de repertorios (Setlists) de concierto.
- **🛠️ Herramientas (Tools Panel)**:
  - 🎙️ **Afinador Cromático Visual**: Detección de pitch mediante micrófono en tiempo real.
  - 🎸 **Afinador de Oído (Ear Tuner)**: Síntesis de tono puro para cada cuerda abierta de guitarra (`6ª E`, `5ª A`, `4ª D`, `3ª G`, `2ª B`, `1ª E`).
  - 🤖 **Acordes con IA**: Ingesta de enlaces de YouTube preparada para extracción inteligente de cifrados.
- **🎸 Reproductor (Player View)**:
  - Vista limpia activada al seleccionar una partitura.

### 🎼 2. Reproductor Limpio (Player View)
- **Lienzo en el 90% de Pantalla**: Enfoque total en la partitura sin distracciones ni botones aplastados.
- **Divulgación Progresiva**: El Mástil Interactivo, Mezclador Multicanal y Speed Trainer están **ocultos por defecto** para evitar sobrecarga visual en dispositivos móviles. Se activan desde el menú flotante de `⚙️ Ajustes`.

---

## 🎧 Estudio PRO & Funciones DAW
- **Sincronización de Audio Real (Backing Track Engine)**: Carga de archivos MP3/WAV con ajuste fino de offset milimétrico (+/- 3000ms).
- **Visualizadores Multi-Instrumento**: Teclado de Piano (49 teclas C2-C6) y Batería (Drum Kit) interactiva.
- **Modo Directo (Gig Mode)**: Teleprompter de escenario con reloj en vivo, nivel de batería y compatibilidad con pedales Bluetooth (AirTurn/PageFlip).
- **Exportación Grado Publicación**: PDF vectorial maquetado para imprenta A4, archivos estándar MIDI (.mid) y MusicXML (.xml).

---

## 🧪 Suite de Pruebas Automatizadas TDD (Playwright + axe-core en Viewport Móvil)

```bash
# Ejecutar suite de pruebas E2E en viewport móvil (iPhone 13 / 390x844)
npm test
```

### Resultados de la Auditoría:
- ✅ **1. Navegación Inferior Mobile-First (Bottom Nav Bar Visible)**
- ✅ **2. Auditoría de Accesibilidad Total en Viewport Móvil (0 violaciones axe-core)**
- ✅ **3. Vista Explorar: Hero Search "¿Qué quieres tocar?" y Carga de Partituras**
- ✅ **4. Vista Mis Tablaturas (Library & Setlists)**
- ✅ **5. Vista Herramientas: Afinador Cromático, Afinador de Oído & Acordes con IA**
- ✅ **6. Reproductor Limpio (Clean Player View - 90% Lienzo)**
