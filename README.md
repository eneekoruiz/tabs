# Tabs & Chords · Reproductor de Tablaturas y Afinador Cromático

Reproductor interactivo de tablaturas para guitarra y bajo, visualizador de acordes y afinador cromático de alta precisión con funcionamiento 100% offline en el navegador.

- **Documentación de arquitectura:** [DeepWiki - tabs](https://deepwiki.com/eneekoruiz/tabs)

## Propósito y Valor Técnico

Aplicación de música orientada a músicos y estudiantes que necesitan una herramienta de ensayo completa (partitura interactiva, tablaturas multicanal, metrónomo y afinación) sin interrupciones, sin publicidad invasiva y con disponibilidad total sin conexión a internet.

- **Motor de Notación y Playback Interactivo:** Utiliza AlphaTab integrado con la Web Audio API para reproducir archivos Guitar Pro y MusicXML con soundfonts realistas en el navegador, permitiendo cambiar el tempo en tiempo real, aislar pistas (mute/solo) y reproducir compases en bucle para práctica.
- **Afinador Cromático en Tiempo Real:** Algoritmo de detección de tono por microfonía basado en el método MPM (McLeod Pitch Method) mediante la librería Pitchy, procesado dentro de un AudioWorklet para ofrecer precisión sub-cent y respuesta inmediata sin retraso audible.
- **Arquitectura PWA Offline:** Catálogo de canciones, muestras de audio y fuentes tipográficas musicales cacheados en el cliente para permitir ensayos en locales sin cobertura o modo avión.
- **Auditoría de Calidad y Accesibilidad:** Suite de pruebas automatizadas con Playwright y auditorías de accesibilidad WCAG con `@axe-core/playwright`.

## Stack Técnico

- **Frontend:** JavaScript vanilla (ES6+), HTML5, Tailwind CSS
- **Audio & DSP:** Web Audio API, `pitchy` (McLeod Pitch Method)
- **Motor de Tablaturas:** AlphaTab (`@coderline/alphatab`)
- **Calidad & Testing:** Playwright, `@axe-core/playwright`, Selenium WebDriver
- **Empaquetado de Escritorio (Opcional):** Tauri CLI

## Puesta en Marcha Local

### Prerrequisitos

- Node.js 18+

### Instalación y Ejecución

```bash
git clone https://github.com/eneekoruiz/tabs.git
cd tabs
npm install

# Iniciar servidor local de desarrollo (puerto 3000)
npm run dev

# Ejecutar suite de pruebas de audio y accesibilidad
npm test
```
