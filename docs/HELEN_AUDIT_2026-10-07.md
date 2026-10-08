# Auditoría HELEN · 7 de octubre de 2026

Estado y resultados posteriores: [auditoría del 8 de octubre](HELEN_AUDIT_2026-10-08.md).

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
- El service worker prepara 835 recursos esenciales y las dos grabaciones de Stay with me. Los otros audios se guardan al utilizarlos; el primer arranque ya no descarga los 205 MB de grabaciones. La prueba incluye recarga sin red, búsqueda y carga de audio y notas reales.

## Evidencia

La suite completa final está en ejecución; su resultado se registrará en esta sección al terminar. Los informes JSON y los traces de cada ejecución están en reports/helen/. No se cuentan como éxitos las ejecuciones con fallos previas a las correcciones.

Ya comprobado en rondas anteriores y selectivas:

| Comprobación | Resultado y límite |
| --- | --- |
| 26 pruebas unitarias musicales | 26 correctas: tiempos, versiones, LRC, referencias, transposición, persistencia y ausencia de síntesis implícita. |
| 43 grabaciones locales, una a una | 43 correctas: Web Audio decodifica audio no vacío, duración de notas dentro del audio, reproducción, pausa, salto y limpieza. |
| Nueva suite de karaoke online | Siete correctas: tres viewports, 195 asociaciones, errores simulados de API, limpieza y captura de voz humana grabada. La simulación de error no demuestra reproducción remota. |
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
