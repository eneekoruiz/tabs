# Entrega a Antigravity — TabsAndChords

## Encargo y condición de publicación

Recibir los cambios de esta tarea, revisar las diferencias, completar las comprobaciones y preparar su commit y subida a GitHub. El usuario pidió expresamente condicionar el commit a que pasen las auditorías de Playwright. **Esta entrega no equivale a esa aprobación: no se ha hecho commit ni push y la suite completa no está validada.**

No reiniciar el proyecto. No borrar cambios existentes ni ejecutar `git reset --hard`. El árbol de trabajo ya contenía cambios de pasadas anteriores de la misma aplicación; el paquete recoge ese conjunto pendiente, no solo la última corrección. Revisar el manifiesto antes de aplicar o publicar.

## Qué contiene el paquete

- `manifest.json`: commit base, rama, archivos, SHA-256, tamaños, exclusiones y estado de los controles ejecutados al empaquetar.
- `changes.patch`: diferencias de archivos ya versionados respecto a HEAD, incluidas diferencias binarias y archivos preparados previamente en el índice.
- `files/`: contenido final de los archivos modificados y nuevos. Los nuevos **no** están en `changes.patch`.
- `checks/`: resultados reales de comprobaciones locales y el último estado de Playwright disponible. No contiene credenciales ni trazas completas del navegador.

No incluye el repositorio completo, `.git`, dependencias, `dist`, grabaciones privadas de IndexedDB, cachés, registros del servidor ni archivos que no hayan cambiado. Hace falta el repositorio en el commit base indicado en el manifiesto.

## Cómo recibir los cambios

### Si Antigravity trabaja en esta misma carpeta

Los cambios ya están aplicados. **No reaplicar el parche ni copiar la instantánea encima.** Revisar `git status`, `git diff` y los archivos nuevos del manifiesto.

### Si trabaja en otra copia

1. Abrir una copia limpia del repositorio en el commit base de `manifest.json`. Confirmar que el repositorio y la rama de destino son los correctos; no usar una URL de GitHub supuesta.
2. Inspeccionar `changes.patch` y ejecutar `git apply --check` antes de aplicar. Si hay cambios previos o una base diferente, detenerse y resolver las diferencias conservando esos cambios.
3. Aplicar `changes.patch` y copiar **solo los archivos con `kind: "untracked"`** de `files/` a las mismas rutas relativas. No copiar todo encima de una copia modificada.
4. Comparar los SHA-256 con el manifiesto. Un ajuste de finales de línea de Git puede requerir comparar contenido normalizado; no obviar otras diferencias.
5. Mantener el paquete de entrega fuera del commit. Los archivos eliminados, si los hay, se identifican en el manifiesto y en el parche.

## Trabajo realizado

- Sistema visual común, estados, controles de ensayo, accesibilidad de diálogos y revisión móvil/tablet/escritorio.
- Reloj de karaoke asociado al audio, importación LRC, tempo de práctica, pausa/saltos, desfase y persistencia. Guía sintetizada etiquetada como estimación, no como grabación original.
- Transposición del sintetizador y de melodías vocales aportadas; corrección de acordes con bajo. Los audios importados conservan su tono original.
- Recuperación del ensayo exacto, renderizado seguro de letras y acordes y correcciones de herramientas y looper.
- Auditoría estructural por registro del catálogo, huellas de contenido, conflictos entre tablas y estados de datos no verificados.
- Eliminación de rutas que añadían acordes inventados, partituras de relleno o 120 BPM por defecto al abrir canciones. Se conserva el contenido aportado y se indican las carencias.
- Alternativas locales separadas y selección de versiones; claves de audio/LRC por versión. Asociación explícita de bases antiguas sin eliminar el registro original.

## Estado pendiente: no omitir

El último artefacto de Playwright disponible al preparar esta entrega indicaba fallo en:

`tests/catalog-audit.spec.js` — `repository alternatives remain separately selectable and retain their supplied text`

La prueba esperaba más de una opción en el selector y encontró una. **No está diagnosticado definitivamente.** Revisar tanto el índice de variantes como la espera de finalización de la búsqueda: comprobar que el panel pertenece a la canción buscada antes de leer sus opciones. No eliminar la comprobación ni inventar una versión para hacer pasar la prueba.

También falta validar la suite completa sobre el estado final, especialmente:

- Versiones alternativas al abrir, guardar, volver a buscar y reanudar.
- Audios antiguos asociados explícitamente a una versión y aislamiento entre versiones de estudio/directo.
- Navegación y reproducción con red desconectada de verdad, no solo cobertura de archivos del service worker.
- Ausencia de sustitución de contenido aportado por el usuario o de su tempo de 120 BPM cuando sea auténtico.
- Adecuación de pruebas antiguas que esperaban partituras/acordes generados automáticamente: conservar la intención funcional, no rebajar comprobaciones de exactitud.

## Comprobaciones antes de commit/push

Desde la raíz del proyecto:

```powershell
npm ci
npm run test:catalog
npm run test:karaoke
npm run audit:catalog
npm run verify:offline
npm run build:web
Remove-Item Env:PLAYWRIGHT_BASE_URL -ErrorAction SilentlyContinue
npx playwright test --workers=2
git -c core.safecrlf=false diff --check
```

La configuración local usa Edge; en CI usa Chromium y hay que instalar los navegadores de Playwright que correspondan. Sin `PLAYWRIGHT_BASE_URL`, Playwright inicia su propio servidor en el puerto configurado (4173 por defecto). Si se usa uno externo, comprobar primero que su URL responde. No ejecutar dos suites simultáneamente contra el mismo directorio de resultados.

No confundir 20 pruebas de lógica o un subconjunto E2E aprobados con toda la suite de Playwright. Guardar un informe final de la ejecución completa. Si quedan fallos, comunicarlos y no declarar la publicación lista.

## Límites de la auditoría musical

La auditoría del repositorio encontró 10.616 referencias del índice: 10.599 con texto, 520 con marcas de acordes y 113 con tempo declarado. No hay autenticidad musical certificada. Detectó 404 identidades con textos distintos entre fuentes, 19 grupos con texto compartido y 5 discrepancias de BPM. Las cifras del índice y las de las tablas fuente no se suman como canciones únicas. Consultar el informe regenerado para los valores actuales.

**No se ha creado un catálogo de cientos de miles de karaokes originales ni se ha verificado cada canción contra una grabación.** Para eso hacen falta fuentes y permisos por recurso, una identificación precisa de cada grabación y revisión musical de letras, acordes, tempo, audio, marcas temporales y melodía. No etiquetar como originales resultados de armonización automática o vídeo no comprobado. Los datos de dominio público de MusicBrainz no conceden derechos sobre letras ni grabaciones.

Fuentes consultadas para delimitar la integración:

- https://musicbrainz.org/doc/About/Data_License
- https://musicbrainz.org/doc/MusicBrainz_API
- https://lrclib.net/docs
- https://developers.google.com/youtube/terms/developer-policies

## GitHub

Revisar el remoto real y la autorización del usuario. Una vez que las comprobaciones completas sean satisfactorias, crear una rama `codex/...` si corresponde, preparar únicamente los archivos del proyecto revisados, hacer el commit y subir a la rama acordada. No incluir el ZIP, dependencias, grabaciones, secretos, cachés ni logs. No forzar el push ni sustituir cambios ajenos. Si faltan credenciales o destino, pedirlos; no inventarlos.
