# Tabs & Chords PRO

Estudio musical local para explorar un catálogo, guardar canciones y repertorios, leer letras con acordes y practicar con herramientas de audio. La interfaz web usa módulos JavaScript y Web Audio; el proyecto incluye una configuración de escritorio con Tauri v2.

## Ejecutar

```bash
npm ci
npm run dev
```

Abre `http://localhost:3000`. El servidor local permite usar el micrófono y el service worker. Los permisos de cámara y micrófono los gestiona el navegador.

```bash
npm run build:web
```

Genera la distribución estática en `dist/`. Los recursos de AlphaTab, Lucide y la fuente de sonido están incluidos en el repositorio; el service worker guarda los recursos para su uso posterior sin conexión.

## Recorridos principales

- **Explorar:** búsqueda de canciones y artistas, filtros de género y contenido, historial y selección de versiones. Las tarjetas de artista funcionan con teclado y devuelven el foco al volver al directorio.
- **Mis Tabs:** favoritos, canciones guardadas, importación de partituras y repertorios de ensayo.
- **Herramientas:** cuatro tareas esenciales; las demás se despliegan en «Más herramientas». Las 15 herramientas que antes se abrían en un diálogo ahora se despliegan en la misma pantalla; Arcade y la vista espacial conservan sus vistas especializadas.
- **Canción:** letra y acordes, transposición, cejilla, desplazamiento, grabación y modos Tocar/Cantar. La sesión real se puede recuperar; la partitura de demostración del arranque no sustituye ese guardado.
- **Ajustes:** instrumento, mano y tema a primera vista; afinación, notación, perfil y restauración en «Más ajustes».

Los datos y preferencias se guardan en este navegador. Borrar sus datos elimina los guardados locales. El contenido del catálogo se presenta como **sin verificar**: disponer de letra o marcas de acordes no acredita que sean originales, completos o exactos. La app distingue una guía generada de una grabación importada y de una letra con tiempos aportados. Consulta [Estudio de canto](docs/ESTUDIO_CANTO.md) para conocer estas referencias y sus límites.

## Karaoke preparado y melodías

En Inicio, el selector **Canciones con audio real / Cantar ahora** ofrece 37 canciones con licencia y 43 grabaciones: 37 originales con voz y 6 pistas instrumentales. Incluyen letras con tiempos y notas del paquete de la misma versión. La app abre «Stay with me», de Shearer, como opción inicial; puedes elegir las demás y cambiar entre voz e instrumental cuando el paquete aporta ambos. Los archivos, licencias, revisión y hashes están en `assets/practice/`.

El mismo selector ofrece **195 karaokes online** con título, artista y canal contrastados mediante metadatos públicos. Se reproducen con el reproductor oficial de YouTube, sujeto a las restricciones del proveedor. Una prueba real en este entorno devolvió el código 150; los metadatos disponibles no garantizan la reproducción. La app muestra el error y un enlace para abrir la pista en YouTube. Hay enlaces a proveedores para otras 1.819 identidades del catálogo; las consultas de ampliación se detuvieron al recibir límites de acceso. No son 1.819 grabaciones descargadas ni karaokes íntegros verificados.

El karaoke online lleva su propia letra y reloj. El micrófono de la app muestra afinación cromática libre, sin evaluar una supuesta melodía sincronizada con ese vídeo. Para las canciones restantes, **Buscar karaoke real** abre una búsqueda por artista y título sin exigir que aportes un archivo.

El inicio offline prepara la app, el catálogo, las referencias y las dos grabaciones de «Stay with me». Las demás grabaciones locales se guardan al abrirlas por primera vez; conéctate para esa primera carga. Los vídeos online requieren internet.

«Filtros y más opciones → Melodías disponibles» busca 563 referencias comunitarias UltraStar. 130 coinciden por título y artista con entradas del catálogo local. Se cargan bajo demanda y están incluidas en la caché offline. Su procedencia, revisión y adaptación de octavas quedan registradas; no certifican una transcripción original ni que los tiempos coincidan con cualquier edición de audio. No incluyen grabaciones comerciales.

Para una canción propia, importa su audio y una referencia TXT UltraStar o JSON de la misma grabación. El LRC aporta tiempos de letra; los acordes no se convierten en objetivos vocales. Sin referencia, el modo Cantar ofrece afinación cromática.

Para regenerar los datos públicos fijados a una revisión y descargar el corpus de pruebas con verificación SHA-256:

```bash
npm run import:public-melodies
npm run fetch:audio-fixtures
npm run fetch:ready-karaoke
```

Consulta [Estudio de canto](docs/ESTUDIO_CANTO.md) para el flujo de referencias y herramientas de transcripción.

## Verificación

```bash
npm run test:karaoke
npm run test:catalog
npm run test:references
npm run test:transcription
npm run test:real-audio
npm run test:ready-karaoke
npm run test:online-karaoke
npm run test:exhaustive
npm run test:screens
npm run audit:catalog
npm run verify:offline
npm test
```

Playwright usa Chromium tanto en local como en CI. Instala su navegador con `npx playwright install chromium`. `PLAYWRIGHT_BASE_URL` permite reutilizar un servidor ya abierto.

La regresión de descubrimiento y accesibilidad comprueba 375, 768 y 1440 px, los tres temas, contraste, teclado, historial, importación accesible y recuperación del ensayo:

```bash
npx playwright test tests/discovery-accessibility.spec.js tests/studio-experience.spec.js
```

Las pruebas con grabaciones humanas usan el dispositivo de captura de Chromium. No certifican una cámara, un micrófono o un dispositivo MIDI físicos, ni un concierto real. Los resultados de una ejecución concreta se deben consultar en su informe; este README no certifica que toda la suite esté pasando.

El alcance, los resultados de las distintas rondas y las limitaciones verificadas están en la [auditoría del 8 de octubre de 2026](docs/HELEN_AUDIT_2026-10-08.md).
