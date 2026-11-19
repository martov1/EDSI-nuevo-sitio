# Guía del programador

> Leer esta guía antes de modificar el planificador. Es el mapa breve de su arquitectura, flujo y reglas de mantenimiento.

## Regla de mantenimiento

Toda modificación de código debe reflejarse también en esta guía. Al terminar un cambio:

1. Actualiza el mapa, el flujo, las reglas o la lista de pasos si el cambio altera alguno de ellos.
2. Si el cambio no encaja en esas secciones, agrega una línea breve al [registro de cambios](#registro-de-cambios).
3. Conserva en cada archivo fuente una referencia a esta guía para que el próximo lector llegue aquí primero.

No dupliques el código en esta guía: documenta responsabilidades, dependencias, contratos entre módulos y comportamientos que un cambio futuro podría romper.

## Filosofía y arquitectura

- **KISS:** resolver el problema en el módulo responsable, con la menor cantidad de piezas que lo haga claro. Evitar capas, abstracciones y dependencias sin una necesidad concreta.
- **Archivos por responsabilidad:** mantener juntas las funciones que cambian por la misma razón; no crear archivos diminutos solo para separar unas pocas funciones.
- **Scripts clásicos:** no hay módulos ES ni empaquetador. Los scripts comparten variables y funciones globales; el orden en `index.html` es parte de la arquitectura.
- **Estado compartido deliberado:** `app-core.js` declara el estado general y las herramientas declaran su lógica en `drawing-tools/`. Evitar duplicar ese estado o introducir módulos aislados sin actualizar sus consumidores y el orden de carga.
- **La interfaz es contrato:** los scripts consultan elementos por sus `id` en `index.html`. Si se renombra o elimina un elemento, actualizar todos sus usos.

## Flujo general

1. `index.html` crea la interfaz y carga Fabric.js y las dependencias externas.
2. `app-core.js` crea el lienzo Fabric, declara estado e inicializa historial, carga del plano y zoom.
3. `canvas-events.js` configura modos y despacha los eventos del puntero a la herramienta activa.
4. Los módulos de `drawing-tools/` implementan las etapas y objetos de cada herramienta.
5. `tool-help.js` actualiza las instrucciones visibles cuando cambian el modo, la escala o la etapa de dibujo.
6. `dialogs.js`, `project-files.js` y `toolbar-actions.js` conectan los modales, el almacenamiento/exportación y los controles de la barra lateral.
7. Al restaurar un proyecto o deshacer, se normalizan los objetos para mantener compatibilidad y reglas visuales actuales.

## Mapa de archivos

| Archivo | Responsabilidad / punto de entrada |
| --- | --- |
| [`index.html`](./index.html) | Estructura, estilos, controles, elementos DOM, dependencias CDN y orden de carga. |
| [`js/app-core.js`](./js/app-core.js) | Estado compartido, lienzo, historial/deshacer, carga de plano, zoom/paneo y normalización de rótulos direccionales. |
| [`js/canvas-events.js`](./js/canvas-events.js) | `setMode`, manejadores de mouse y enrutamiento hacia las herramientas. |
| [`js/tool-help.js`](./js/tool-help.js) | `updateToolHelp`: texto de ayuda inferior derecha e indicadores de plano/escala. |
| [`js/drawing-tools/measurements.js`](./js/drawing-tools/measurements.js) | Medición de distancia/radio, formato, etiquetas y normalización de sus estilos. Su fábrica de etiquetas también se usa en zonificación. |
| [`js/drawing-tools/zoning.js`](./js/drawing-tools/zoning.js) | Perímetros y rótulos de zona, selección por borde y prioridad visual. |
| [`js/drawing-tools/directional-arrows.js`](./js/drawing-tools/directional-arrows.js) | Dibujo por etapas, ancho y rótulos de viento/propagación. |
| [`js/drawing-tools/attack-line.js`](./js/drawing-tools/attack-line.js) | Tramos de ataque, orientación de lanza, alcance y ancho del chorro, cancelación. |
| [`js/dialogs.js`](./js/dialogs.js) | Modales de escala, configuración/continuación de línea de ataque y avisos. |
| [`js/project-files.js`](./js/project-files.js) | Exportación a imagen/PDF, serialización JSON, proyectos recientes y restauración. |
| [`js/toolbar-actions.js`](./js/toolbar-actions.js) | Brigadistas, íconos, barra de escala, texto, borrado y teclado. |
| [`assets/garrafa.svg`](./assets/garrafa.svg), [`assets/tablero-electrico.svg`](./assets/tablero-electrico.svg), [`assets/medidor gas.svg`](./assets/medidor%20gas.svg), [`assets/tanque propano.svg`](./assets/tanque%20propano.svg), [`assets/pallet.svg`](./assets/pallet.svg) | Recursos vectoriales usados por los sellos de la barra lateral. |

## Pasos que no se deben obviar

### Al agregar o modificar una herramienta

1. **Lógica de dibujo:** implementarla en el archivo correspondiente de `js/drawing-tools/`. Añadir estado global en `app-core.js` solo si realmente debe compartirse.
2. **Eventos y modos:** revisar `canvas-events.js` para inicio, movimiento, finalización, selección, cursor, limpieza y cancelación. Mantener `setMode` coherente.
3. **Ayuda contextual:** modificar `js/tool-help.js` cada vez que cambien las instrucciones, controles, etapas o requisitos de la herramienta. Actualizarla en cada transición visible llamando a `updateToolHelp()`. No dejar fases nuevas sin explicación.
4. **Controles visuales:** agregar/ajustar botones y los `id` correspondientes en `index.html`; conectar sus acciones en el archivo responsable. Para un diálogo modal, usar `dialogs.js`.
5. **Persistencia:** si se agregan objetos o propiedades que deban sobrevivir, revisar qué propiedades serializa `app-core.js` y la carga/normalización en `project-files.js`. Mantener también coherente la restauración de `undo()` en `app-core.js`.
6. **Orden de scripts:** si se agrega un archivo o una dependencia entre funciones globales, actualizar los `<script>` de `index.html`. No usar `async`, `defer` ni `type="module"` sin migrar explícitamente el modelo de dependencias.
7. **Guía:** actualizar esta guía y mantener su referencia en cada archivo fuente modificado o agregado.

### Al editar instrucciones o controles

- El panel inferior derecho vive en `index.html`; su contenido dinámico pertenece a `tool-help.js`.
- Los `id` `tool-help-title` y `tool-help-list` son consumidos por `updateToolHelp()`.
- La ayuda depende del modo y de fases/estado de las herramientas. Si una transición llama a `updateToolHelp()`, debe hacerlo después de actualizar el estado para mostrar la fase correcta.
- Los avisos y formularios modales pertenecen a `dialogs.js`; no mezclar esa responsabilidad con el panel contextual.

### Al cambiar proyectos, deshacer o reglas visuales

- Los proyectos guardados deben seguir cargando con normalizaciones y migraciones necesarias.
- Si una regla también debe aplicarse después de deshacer, revisar el callback de `undo()` en `app-core.js`.
- Si una regla depende de varios elementos del lienzo (por ejemplo, prioridad de zonas o etiquetas separadas), verificarla tanto tras mover/editar como tras cargar y deshacer.

## Invariantes importantes

- `index.html` carga scripts clásicos en orden: `app-core.js`, `tool-help.js`, herramientas de dibujo, `canvas-events.js`, diálogos, archivos de proyecto y acciones de barra.
- La herramienta activa controla `selectable`, `evented`, selección y cursores. No habilitar el arrastre de objetos durante una operación de dibujo si la herramienta necesita capturar el puntero.
- Las mediciones y las líneas de ataque dependen de `pixelsPerMeter`; los controles deben conservar la validación de escala antes de iniciar esas operaciones.
- Las zonas tienen prioridad visual **caliente > templada > fría** y se seleccionan por el borde, no por el área interior. Considerar zoom y desplazamiento al cambiar su hit-testing.
- Las vistas temporales deben limpiarse al cancelar, cambiar de modo y completar una operación, sin borrar objetos ya confirmados.
- Mantener formato, etiquetas y normalización de una herramienta junto a su módulo, salvo que haya una dependencia compartida real (como la etiqueta de medición reutilizada por zonas).

## Validación antes de cerrar un cambio

1. Ejecuta `node --check` sobre los archivos JavaScript modificados (o sobre todos los `.js` si se cambió el orden/carga global).
2. Comprueba que la aplicación abre sin errores de ejecución y que se muestran las instrucciones correctas para los modos/fases tocados.
3. Prueba el flujo afectado de principio a fin: inicio, interacción, cancelación, finalización y, cuando corresponda, guardar/cargar y deshacer.
4. Revisa los diagnósticos del editor y conserva cualquier comportamiento no relacionado con el cambio.
5. Actualiza esta guía y comprueba que todos los archivos de programa mantengan una referencia a ella.

## Registro de cambios

- 2026-11-19: se documentaron la arquitectura KISS, el flujo global, el mapa de módulos y los pasos obligatorios de mantenimiento; se añadieron referencias a esta guía en todos los scripts, la página principal y los recursos SVG.
