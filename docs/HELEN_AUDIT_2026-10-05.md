# Auditoría HELEN · 5 de octubre de 2026

## Alcance y aceptación

Aplicación de `helen-audit`, `helen-design` y `helen-implementa` al proyecto actual. Se conserva la identidad visual del estudio y se corrigen defectos observables en descubrimiento, teclado, ajustes, contraste, recuperación y documentación.

La aceptación exige búsqueda e historial utilizables; artistas accesibles con Enter y Espacio; foco conservado al navegar y volver; selectores de Ajustes con etiqueta; contraste AA en los tres temas; ausencia de desbordamiento a 375, 768 y 1440 px; conservación del último ensayo real; recursos offline completos y distribución estática actualizada. No hay scripts de lint o typecheck declarados en `package.json`; se comprueba la sintaxis de los módulos modificados.

## Hallazgos y correcciones

| Prioridad | Evidencia y efecto | Corrección | Archivos | Esfuerzo |
| --- | --- | --- | --- | --- |
| P1 | La partitura de demostración del arranque se trataba como una canción del usuario. Podía generar un guardado vacío y sustituir el ensayo anterior. | Marcar la carga inicial como demostración e impedir que el editor de letras la use como ensayo. Regresión de recarga que conserva canción, versión, transposición y cejilla. | `src/core/AudioEngineV2.js`, `src/ui/LyricsChordsView.js` | Acotado |
| P1 | Cuatro selectores de Ajustes carecían de nombre accesible. axe detectó `select-name` en los tres temas. | Asociar las etiquetas visibles con sus selectores mediante `for`. | `src/ui/SettingsView.js` | Pequeño |
| P2 | Cierres HTML sobrantes separaban el historial del contenedor del buscador. La captura móvil inicial mostraba un hueco grande antes del contenido siguiente. | Reparar el árbol HTML y agrupar las acciones del buscador en CSS. Botones de 44 × 44 px. | `src/ui/HomeViewV2.js`, `assets/css/components/discovery-workspace.css` | Pequeño |
| P2 | El historial escrito al pulsar Enter no se reflejaba en el desplegable hasta otro render. Escape desde el historial acababa perdiendo el foco por el atajo global. | Actualizar el historial inmediatamente y consumir Escape dentro del buscador. Cerrar al salir de su zona de foco. | `src/ui/HomeViewV2.js` | Pequeño |
| P2 | Las tarjetas de artista eran artículos con manejador de clic: no eran controles nativos de teclado. | Botones semánticos, monogramas, estilos compartidos y retorno de foco al entrar/salir del repertorio. | `src/ui/HomeViewV2.js`, `assets/css/components/discovery-workspace.css` | Acotado |
| P2 | La navegación reconstruía sus botones y perdía el control enfocado. El estado activo solo se comunicaba visualmente. La importación de partituras tenía su input completamente oculto al teclado. | Restaurar el control tras el render, añadir `aria-current` y conservar el input de archivo en el orden de foco con una etiqueta visible. | `src/ui/BottomNav.js`, `src/ui/LibraryExplorerV2.js`, `assets/css/design-system.css` | Acotado |
| P2 | Texto blanco sobre la pestaña verde de Mis Tabs: 1,7:1 en OLED. La etiqueta Avanzado daba 4,15:1; una pasada posterior detectó Principiante en Ámbar con 3,87:1. | Usar el color de texto inverso del tema y tokens de estado para las tres dificultades. Corregir también el hover de importación. | `assets/css/components/library.css`, `assets/css/design-system.css` | Pequeño |
| P2 | El README afirmaba accesibilidad total y exactitud del contenido; algunas pruebas omitían contraste y el inventario no certifica autenticidad. Los nombres de temas también hacían afirmaciones absolutas que sus colores no cumplen. | Documentación descriptiva de las funciones, comandos y límites reales. Nombres de opciones de tema y afinación sin afirmaciones adicionales. | `README.md`, `src/ui/SettingsView.js` | Pequeño |
| P3 | El observador de paginación no se desconectaba al reconstruir o destruir la vista. El servidor de pruebas emitía un gran volumen de líneas por petición. | Limpieza del observador, guardas de carga y servidor Playwright sin log por petición. | `src/ui/HomeViewV2.js`, `playwright.config.js` | Pequeño |

El service worker pasa de la caché v5.7 a v5.8 para que los recursos modificados se vuelvan a instalar. No se añaden bibliotecas ni recursos remotos.

## Verificación

Se ejecutó Chromium sobre el servidor local con capturas y axe-core. La inspección inicial recorrió Explorar, Mis Tabs, Herramientas y Ajustes a 375, 768 y 1440 px en Papel, OLED y Ámbar. La regresión añadida combina interacciones, movimiento reducido, teclado, contraste y detección de errores de navegador; estas interacciones permitieron detectar fallos que no aparecían en el estado inicial.

| Comprobación | Resultado |
| --- | --- |
| `npm run test:karaoke` | Aprobado: 15 pruebas |
| `npm run test:catalog` | Aprobado: 5 pruebas |
| `tests/discovery-accessibility.spec.js` · Chromium | Aprobado: 4 pruebas, recuperación del ensayo y recorridos a 375, 768 y 1440 px |
| `tests/studio-experience.spec.js` · Chromium | Aprobado: 7 pruebas existentes y 1 prueba adicional a 768 px |
| Contraste e interacciones de descubrimiento | Aprobado: Explorar, Mis Tabs y Ajustes en los tres temas y anchos, sin violaciones axe ni errores de navegador observados en la regresión |
| `npm run verify:offline` | Aprobado: 178/178 recursos |
| `npm run build:web` | Aprobado: `dist/` actualizado; los diez módulos/estilos/recursos modificados coinciden con sus fuentes |
| Sintaxis JavaScript y `git diff --check` | Aprobado |
| Suite general de 135 pruebas | Fallida e incompleta: 13 fallos observados, detenida al llegar al caso 33 |
| Grupo de cinco archivos usado previamente por CI | Fallido: timeout al cerrar Stage Automation; 1 prueba fallida, 1 interrumpida y 19 sin ejecutar por el límite de fallos |
| CI alojado, binario Tauri y hardware real | Sin verificar |

El flujo `.github/workflows/quality.yml` incorpora las unitarias musicales y los dos archivos de regresión UI junto al grupo existente. El caso de estudio a 768 px se añade conservando el caso anterior a 834 px. Los logs y capturas locales están en `reports/helen/` (carpeta ignorada por Git).

Comandos del navegador (PowerShell, servidor local disponible):

```powershell
$env:CI = '1'
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3001'
npx playwright test tests/discovery-accessibility.spec.js --workers=1 --retries=0
npx playwright test tests/studio-experience.spec.js --workers=1 --retries=0
```

La ejecución del grupo anterior de CI usa `--max-failures=1` para detenerse si aparece un fallo; no se han quitado ni modificado sus aserciones.

Las 20 unitarias y 12 pruebas dirigidas de esta intervención están aprobadas. La revisión final de las correcciones no añadió más cambios dentro de este alcance. La suite general y el grupo anterior de CI siguen requiriendo diagnóstico y mantenimiento; las pruebas nuevas aprobadas no sustituyen esa validación.

## Iteraciones y límites

1. Inspección y referencia visual; reproducción de HTML incorrecto, controles sin etiqueta y contraste insuficiente.
2. Correcciones y prueba de recorridos; descubrimiento adicional de historial desactualizado, Escape global y guardado de la demostración.
3. Revisión de estados tras interactuar; corrección de la dificultad Principiante en Ámbar y comprobación final.

La ejecución solicitada de la suite general de 135 pruebas encontró 13 fallos y se detuvo tras llegar al caso 33. Incluye selectores desactualizados (por ejemplo `data-tool-action` frente a `data-preview-action`, y un selector de `span` que ahora coincide con dos elementos), expectativas de interfaz y límites de tiempo al cargar canciones. No se han diagnosticado todos esos fallos ni ejecutado el resto de la suite: **esta auditoría no certifica la regresión completa del producto**. No se han cambiado sus aserciones para obtener resultados verdes.

El inventario del catálogo continúa presentando contenido sin verificación de autenticidad y conflictos entre fuentes. Resolver esas diferencias exige fuentes musicales fiables y un trabajo de contenido separado. No se ha validado hardware de audio/MIDI real, una compilación binaria de Tauri ni el despliegue remoto.
