# Estudio de canto

Abre una canción y cambia de **Tocar** a **Cantar**. Puedes escuchar la guía de práctica sin activar el micrófono. El micrófono se habilita con su propio botón; usa auriculares para evitar que reciba el acompañamiento.

## Ensayar con una grabación

1. Pulsa **Importar audio** y elige tu archivo (hasta 100 MB).
2. Pulsa **Importar letra con tiempos · LRC** si tienes una letra sincronizada con esa grabación.
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
- `npm run verify:offline`: cobertura de recursos sin conexión.
- `npm run build:web`: paquete estático actualizado.

La lógica compartida de tiempos está en `src/audio/KaraokeTimeline.js`. El transporte usa tiempos de la canción original; los cambios de velocidad no reescriben las marcas de las letras.
