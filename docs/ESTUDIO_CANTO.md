# Estudio de canto

Abre una canción y cambia de **Tocar** a **Cantar**. Una canción sin grabación mantiene Play desactivado y ofrece buscar karaoke real o importar audio. La guía generada se activa únicamente al elegirla en Más opciones de canto. El micrófono se habilita con su propio botón; usa auriculares para evitar que reciba el acompañamiento.

## Cantar directamente

En Inicio, elige una canción en **Canciones con audio real** y pulsa el botón de canto. Hay 37 canciones y 43 grabaciones de paquetes con licencia: seis canciones aportan instrumental además de la voz original. El selector distingue ambos casos. «Stay with me», de Shearer, aporta 373 notas y 66 frases; es la opción inicial. Play, micrófono y terminar quedan juntos, con mezcla, sincronización y referencias dentro de **Más opciones de canto**.

La primera preparación offline guarda las dos grabaciones de «Stay with me» y las referencias de los 37 paquetes. Las otras grabaciones se guardan al abrirlas; necesitan conexión la primera vez. Puedes comprobar los 123 archivos contra los hashes fijados con `node scripts/fetch-ready-karaoke.mjs --verify`.

## Karaoke online sin aportar archivos

El selector de Inicio incluye 195 pistas de proveedores online con metadatos contrastados. También puedes abrir **Karaoke online** en las canciones coincidentes. Los controles del vídeo llevan la reproducción, la letra y el tiempo; el micrófono muestra afinación libre. Se ocultan el reloj local, los objetivos vocales y el resumen de puntuación para evitar mezclar versiones independientes.

YouTube puede impedir la reproducción dentro de la app. El estado muestra el código del proveedor y un enlace a la pista; puedes elegir otra versión desde **Más pistas del proveedor**. En la comprobación de Chromium de este entorno se recibió el código 150 incluso en la referencia original de Queen. No se certifica la reproducción de los 195 vídeos.

Hay enlaces específicos de proveedores para 1.819 canciones. En las demás, **Buscar karaoke real** busca por artista y título. El índice se amplía con `npm run import:online-karaoke` y conserva una caché de resultados. Para regenerar exclusivamente a partir de la caché, sin nuevas consultas, usa `node scripts/import-online-karaoke.mjs --cached-only --metadata-cache-only`. El importador interrumpe las consultas ante HTTP 403/429 y no sortea las restricciones del proveedor.

## Encontrar una melodía

La app incluye 563 referencias comunitarias de UltraStar. Están en **Explorar → Filtros y más opciones → Melodías disponibles** y se ofrecen al abrir títulos y artistas coincidentes. Hay 130 coincidencias con el catálogo. No incluyen la grabación comercial: importa el audio de la misma versión y comprueba el desfase. La procedencia y la revisión pendiente acompañan cada referencia.

Para otra canción, puedes importar un archivo UltraStar TXT o JSON en **Más opciones de canto → Importar melodía**. La app acepta tiempos y notas explícitos y rechaza referencias corruptas o incompatibles. Los acordes no se convierten en una supuesta melodía original.

[UltraSinger](https://github.com/rakuri255/UltraSinger) es una herramienta externa para crear referencias desde audio mediante modelos de separación, transcripción y tono. Su salida necesita revisión musical y la misma grabación de entrada. Esta app importa sus archivos compatibles; no incluye ni ejecuta esos modelos. [UltraStar Deluxe ofrece paquetes de canciones con licencia Creative Commons](https://github.com/UltraStar-Deluxe/songs), como el ejemplo integrado.

## Ensayar con una grabación

1. Pulsa **Importar audio** y elige tu archivo (hasta 100 MB).
2. Abre **Más opciones de canto** y pulsa **Importar letra con tiempos · LRC** si tienes una letra sincronizada con esa grabación.
3. Ajusta **Inicio de letra** para corregir una introducción o diferencia de entrada. Un valor positivo retrasa la letra.
4. Cambia el tempo, mueve la posición o pausa. La letra sigue la posición del audio incluso a otra velocidad.

El tempo, el volumen, el desfase, la grabación y las letras se guardan en este navegador. Borrar la base conserva las letras con tiempos. Los archivos no se suben a un servidor. El marcador muestra la posición en la grabación original, no el tiempo de reloj transcurrido a la nueva velocidad.

Ejemplo de archivo LRC:

```text
[00:02.50]Primera frase
[00:06.00]Segunda frase
[00:10.00]Última frase
```

Los tiempos LRC deben corresponder a la versión de audio importada. El vídeo de YouTube es una referencia con reproducción independiente.

## Tono y recuperación del ensayo

En **Más opciones → Transponer**, cambia el tono entre −12 y +12 semitonos. La guía generada y la melodía vocal aportada cambian juntas, sin reiniciar la posición. La cejilla cambia las posiciones de los acordes que debes tocar, no la altura del acompañamiento. Los acordes con bajo, como C/E, transponen también ese bajo.

Un audio importado conserva su tono original, igual que su referencia vocal. La app avisa de esta diferencia si has transpuesto el cifrado; selecciona la guía generada para practicar en otro tono. No se aplica una transformación de tono al archivo.

**Continúa practicando → Reanudar** recupera la última letra y versión guardadas, los tiempos y notas aportados y los ajustes del ensayo. La reproducción no arranca sola. Si el navegador no puede guardar la sesión completa, verás un aviso; borrar sus datos locales elimina estos guardados.

## Qué mide la guía

Sin tiempos aportados, el avance de letra y el arreglo de acordes son estimaciones de práctica. No se presentan como una transcripción de la grabación. Cuando faltan acordes, la guía ofrece un pulso rítmico.

Sin una melodía vocal aportada, el medidor muestra afinación cromática respecto a la nota más cercana: no comprueba que estés cantando las notas originales de la canción. El resumen explica la referencia usada y muestra un estado vacío cuando no hay muestras de voz suficientes.

## Comprobaciones de mantenimiento

- `npm run test:karaoke`: relojes, tempo, transposición, bajos, pausa, saltos, letras LRC, persistencia y cuenta de entrada.
- `npx playwright test tests/studio-experience.spec.js`: audio importado, recuperación, teclado, recortes y contraste del estudio.
- `npm run test:references`: validación de notas y del formato UltraStar.
- `npm run test:ready-karaoke`: decodificación, notas, reproducción, pausa y salto de cada una de las 43 grabaciones.
- `npm run test:online-karaoke`: asociaciones, interfaz, errores del reproductor y voz humana grabada en afinación libre.
- `npm run test:real-audio`: voces grabadas, captura Chromium, grabación de ensayos, transcripción de una canción con instrumentos y transporte.
- `npm run test:transcription`: los 36 acordes detectables, sus posiciones y las notas y duraciones interpretadas por AlphaTab.
- `npm run test:exhaustive`: catálogo completo, acordes, transposiciones y partituras de práctica.
- `npm run test:screens`: pantallas, herramientas y accesibilidad a distintos tamaños.
- `npm run verify:offline`: cobertura de recursos sin conexión.
- `npm run build:web`: paquete estático actualizado.

La lógica compartida de tiempos está en `src/audio/KaraokeTimeline.js`. El transporte usa tiempos de la canción original; los cambios de velocidad no reescriben las marcas de las letras.

## Mezcla por bandas

La herramienta de mezcla separa frecuencias, transitorios y componentes estéreo. No identifica voces ni instrumentos independientes. Reducir el centro puede dejar voz audible y quitar parte de los instrumentos. Para una base limpia, usa una pista instrumental del paquete o una pista que ya tengas.
