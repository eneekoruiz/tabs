# Auditoría HELEN · 8 de octubre de 2026

## Alcance

Cambios autorizados en toda la app: pantallas con funciones esenciales visibles, opciones avanzadas en la misma vista, corrección musical y pruebas con Chromium, canciones y voces grabadas. Se aplicaron las habilidades HELEN Audit, Design, Implementa y Reprompt; Skill Installer se consultó sin instalar capacidades innecesarias.

## Resultado implementado

- Inicio, biblioteca, canción, herramientas y ajustes organizan el contenido mediante paneles inline y desplegables nativos. Cuatro herramientas esenciales aparecen primero; 15 herramientas se despliegan en la misma pantalla. Arcade y la vista espacial conservan vistas específicas.
- Play, micrófono y finalizar están juntos en canto local; mezcla, referencias y ajustes quedan en Más opciones. En karaoke online el micrófono se ve antes del vídeo, incluso en 375 × 667 px.
- Se integraron 37 canciones con licencia, 43 grabaciones (37 con voz y seis instrumentales), con TXT del mismo paquete, 205.773.931 bytes y 123 archivos verificados mediante hashes Git SHA-1 y revisión fijada.
- 195 karaokes online contrastan título, artista y canal mediante metadatos públicos. Otros resultados proporcionan enlaces a proveedores para 1.819 identidades del catálogo. El índice procede de 189 de los 414 artistas de la búsqueda; el resto quedó pendiente al alcanzar HTTP 429. YouTube también limitó las consultas de metadatos. No se hicieron consultas para sortear esas limitaciones.
- Los vídeos utilizan el reproductor oficial. La prueba externa en Chromium recibió vídeo no disponible; una segunda comprobación con la API oficial recibió código 150. La app muestra el error y un enlace alternativo. No se certifica que los 195 vídeos puedan reproducirse en este entorno.
- Karaoke online oculta el reloj local y la melodía de otra versión. Permite afinación cromática libre sin registrar una puntuación de melodía.
- Una canción sin grabación no activa música generada. La guía estimada requiere selección explícita. Se retiraron los enlaces de karaoke inventados: el ID de Bohemian Rhapsody apuntaba a Paradise de Coldplay; otros diez enlaces no estaban disponibles. También se retiró la asociación equivocada Happier / jealousy, jealousy.
- La partitura de demostración se oculta cuando la canción no aporta una partitura. Las partituras generadas están identificadas como acompañamientos aproximados de práctica. No se convierten raíces de acordes en supuestas notas vocales originales.
- Se corrigieron reloj, versiones, transposición, bajos de acordes, posiciones de guitarra/ukelele, SVG y audición. Importaciones inválidas conservan los datos anteriores.
- Se corrigieron fuga de audio y animación al cerrar herramientas, controles de scroll tapados, teclado de paneles inline, etiquetas, roles, contraste y recuperación del ensayo.
- El scroll de lectura se pausa al desplazar manualmente o enfocar un control; mantiene accesibles los botones.
- Abrir canción usa la versión seleccionada/default directamente, con el mismo flujo para usuarios y Chromium. El detalle de escritorio no se reconstruye al recibir foco durante un clic, manteniendo estable su posición durante la interacción. Las versiones alternativas permanecen en las opciones.
- El diagnóstico de eventos detectó que, a 1280 × 800 px, la barra inferior recibía el clic destinado a Blackbird. La navegación pasa a ocupar espacio en el flujo del layout: su área de interacción queda fuera del contenido desplazable. Al ocultarla en canto o atril, el espacio se libera. Una aserción geométrica comprueba la separación en todas las pruebas de responsividad.
- El transcriptor ya no sustituye acordes desconocidos por una posición genérica. Los 36 acordes detectables se verifican con un oráculo de intervalos y con notas/duraciones parseadas por AlphaTab; los símbolos incompatibles generan silencio. La partitura se identifica como aproximación.
- El grabador de ensayos bloquea nuevas tomas mientras finaliza la anterior, descarta callbacks de una toma cancelada y limita el cierre a diez segundos. El transcriptor conserva cada conjunto de fragmentos asociado a su propia captura y libera el micrófono al terminar.
- El service worker v6.7 prepara 835 recursos esenciales y las dos grabaciones de Stay with me. Los otros audios se guardan al utilizarlos; el primer arranque ya no descarga los 205 MB de grabaciones. La prueba incluye recarga sin red, búsqueda y carga de audio y notas reales.

## Evidencia

La suite completa recorrió 408 casos: 396 correctos y 12 fallidos, sin reintentos. La revisión serial de 17 casos terminó con 15 correctos y dos fallidos: apertura de Blackbird a 1280 px y una comprobación dependiente del tiempo transcurrido tras pulsar Reintentar. La regresión siguiente de 33 casos terminó con 31 correctos y dos fallidos: el mismo solapamiento a 1280 px y una captura válida de 0,96 segundos que no alcanzaba el mínimo de un segundo exigido por la prueba. La navegación se corrigió con el diagnóstico de eventos y las capturas ahora esperan más audio codificado antes de detenerse. La ronda de 61 casos terminó con 61 correctos, sin reintentos, fallos ni casos omitidos. Incluye las 35 combinaciones de pantalla y viewport, el recorrido de opciones progresivas, captura humana, transcripción con voz/guitarra y uso sin red.

La revisión visual añadió un cambio posterior: audio, micrófono e importación aparecen antes del gráfico grande de afinación, conservando la nota detectada arriba. Tres pruebas nuevas exigen que los controles de canto, la importación y el enlace a pistas quepan sin desplazamiento inicial en los móviles de 375 × 667, 390 × 844 y 412 × 915 px. La ronda específica de 25 casos terminó con 24 correctos y un fallo: Importar audio quedaba 2,25 px por debajo del viewport de 375 × 667. La regla de padding móvil era anulada por una declaración importante anterior. Se corrigió la cascada y se redujo el margen del enlace a proveedores, manteniendo los botones de 44 px. La comprobación geométrica conserva el límite estricto. La revisión final de ocho casos afectados terminó con 8/8 correctos, sin reintentos. Importar audio queda a 657,25 px en el viewport de 375 × 667, con desplazamiento inicial cero; las tres pruebas móviles y la navegación con teclado pasan. También pasan de nuevo la importación con audio real, contraste, karaoke online y recarga sin red.

Informes: `reports/helen/final-autonomous.json`, `reports/helen/failed-workflows-recheck.json` y `reports/helen/final-regressions.json` y `reports/helen/navigation-final.json` y `reports/helen/karaoke-first-view.json` y `reports/helen/first-view-final.json`; capturas y traces en sus carpetas de artifacts. No se presenta ninguna ejecución fallida como una suite completamente correcta.

Ya comprobado en rondas anteriores y selectivas:

| Comprobación | Resultado y límite |
| --- | --- |
| 28 pruebas unitarias musicales | 28 correctas: tiempos, versiones, LRC, referencias, transposición, persistencia, ausencia de síntesis implícita y las 36 armonías del transcriptor interpretadas por AlphaTab. |
| 43 grabaciones locales, una a una | 43 correctas: Web Audio decodifica audio no vacío, duración de notas dentro del audio, reproducción, pausa, salto y limpieza. |
| Karaoke online y ausencia de melodía inventada | Siete correctas (seis online y un caso de la suite principal): tres viewports, 195 asociaciones, errores simulados de API, limpieza y captura de voz humana grabada. La simulación de error no demuestra reproducción remota. |
| Voz humana con anotación F0 independiente | Vocadito: 92,24 % de frames vocales dentro de 50 cents y mediana 1,917 cents al nivel original; precisión de detección 99,90 %. No equivale a reconocimiento garantizado de cualquier mezcla comercial. |
| Corpus adicional | 20 notas humanas grabadas y una canción real con voz/guitarra; captura real de Chromium con archivo WAV humano y sin banderas de simulación internas de la app. |
| Recursos offline | 835/835 declarados; prueba real de recarga y uso sin red correcta. |
| Dependencias | npm audit: cero vulnerabilidades publicadas en esta ejecución. |
| Archivos de karaoke | 123/123 verificados contra la revisión c9246c799050acec96a03183df4b85493d283d51. |

Las pruebas exhaustivas recorren 10.616 fichas locales, tres transposiciones por contenido disponible, relojes, letras, notas finitas y partituras aproximadas parseadas por AlphaTab. La comprobación de acordes usa un oráculo independiente, 153 símbolos, 25 transposiciones y tres instrumentos; genera y parsea 2.448 partituras para ocho compases y dos estilos. Estos controles verifican la implementación; no certifican que cada ficha sea una transcripción auténtica de la grabación comercial.

## Fuentes investigadas

- [UltraStar Deluxe: canciones con licencia](https://github.com/UltraStar-Deluxe/songs): audio y referencias de los paquetes integrados. Cada canción conserva su licencia y procedencia.
- [KaraokeDock](https://github.com/haggardj2/KaraokeDock): reproducción de formatos MP4 y CDG + MP3 e integración de proveedores online. La integración implementada aquí usa un parser propio de las páginas públicas y el reproductor oficial, sin copiar un backend externo.
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference): controles, errores, ciclo de vida y tamaño mínimo del reproductor.
- [UltraSinger](https://github.com/rakuri255/UltraSinger): pipeline externo para crear notas y textos desde grabaciones; no se ejecuta dentro de esta app.
- [Demucs](https://github.com/facebookresearch/demucs) y [Demucs ONNX para navegador](https://github.com/StemSplit/demucs-onnx): separación real mediante modelos. La herramienta actual de bandas no ejecuta estos modelos ni se presenta como separación vocal por IA.

## Límites pendientes comprobados

No hay una pista original y una melodía sincronizada certificadas para todas las canciones comerciales del catálogo. Los vídeos dependen del proveedor y no aportan a la app una referencia vocal sincronizada. Las 563 referencias comunitarias no incluyen audio comercial y exigen comprobar la misma versión. El audio local aportado mantiene su tono cuando se transpone el cifrado. Se probaron grabaciones humanas a través de Chromium; no se certificaron micrófono físico, MIDI físico, concierto ni binario de Tauri en este entorno.

## Distribución final

El paquete estático `dist/` se recompiló con el service worker v6.7. Diez archivos críticos del paquete coinciden byte a byte con la fuente; sus SHA-256 se guardan en `reports/helen/verified-source-revision.json`. La revisión del paquete abrió Blackbird y reprodujo/pausó Stay with me en 375 × 667, 768 × 1024 y 1440 × 900. Las seis comprobaciones pasaron: 373 notas, reloj real por encima de dos segundos, micrófono visible, navegación liberada en canto y ausencia de desbordamiento horizontal. Se revisaron nueve capturas de inicio, canción y canto. El registro está en `reports/helen/final-built-verification.json`; las imágenes se guardan como `reports/helen/final-built-*.png`. La visibilidad de importar se exige en la prueba sin audio; en el paquete preparado ya hay una pista seleccionada y cambiarla es una opción adicional.

## Validación de la integración con GitHub

Se integraron los 12 commits remotos hasta `c883353` conservando las mejoras de la app, las actualizaciones de dependencias y las pruebas de CI sin ocultar fallos. El código de ejecución de la app no cambió durante esta integración. El lock fija Playwright 1.64.0; la comprobación final usó Chromium 156.0.8078.4.

Las ocho pruebas de integración pasaron sin reintentos: uso offline, las dos grabaciones de Stay with me, afinación frente a anotaciones F0 independientes, captura de voz humana grabada y controles esenciales visibles en 375, 390 y 412 px. El informe local está en `reports/helen/publish-integration.json`. Las 28 pruebas musicales y los 835 recursos offline también pasaron; npm audit devolvió cero vulnerabilidades. El paquete estático se reconstruyó y diez archivos principales coinciden byte a byte con la fuente.

Los 123 archivos originales coinciden también con sus hashes de Git. Se añadieron atributos para conservar exactamente los bytes de las fuentes y se corrigió la capitalización de `license.txt` de Stay with me para que su ruta funcione en Linux. Las grabaciones, referencias, atribuciones y licencias quedan incluidas en el repositorio; los informes generados y las dependencias locales siguen excluidos.
