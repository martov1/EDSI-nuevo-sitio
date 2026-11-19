/**
 * Misión: inicializar el lienzo y mantener el estado compartido del planificador.
 * Responsabilidades: historial/deshacer, carga del plano, zoom y paneo,
 * ayuda contextual y rótulos de las flechas de dirección.
 * Funciones principales: showMessage, saveHistory, undo, resizeCanvas,
 * loadFabricBackground, updateToolHelp y utilidades de etiquetas direccionales.
 */

// --- ESTADO DE LA APLICACIÓN ---
let currentMode = "select"; // 'select', 'scale', 'attack_line', measurement modes, 'stamp'
let pixelsPerMeter = null;
let isDrawing = false;
let drawingLine = null;
let scaleStartPlaced = false;
let scaleSecondPointStarted = false;
let startX = 0;
let startY = 0;
let measurementStart = null;
let measurementPreview = null;
let directionalArrowStart = null;
let directionalArrowEnd = null;
let directionalArrowPhase = null;
let directionalArrowWidth = 0;
let directionalArrowPreview = null;
const zoningTypes = {
  hot: { label: "Zona caliente", color: "#dc2626", priority: 3 },
  temperate: { label: "Zona templada", color: "#f97316", priority: 2 },
  cold: { label: "Zona fría", color: "#16a34a", priority: 1 },
};
let selectedZoningType = null;
let zoningPoints = [];
let zoningPreview = null;
let zoningPathLength = 0;

// Estado compartido de la herramienta de línea de ataque; su lógica está en drawing-tools/attack-line.js.
let isDrawingHose = false;
let attackLineLengthMeters = 0;
let attackPolyline = null;
let attackPoints = [];
let accumulatedLengthPx = 0;
let segmentFinished = false;
let placingNozzle = false;
let nozzleObject = null;
let lastUnionX = 0;
let lastUnionY = 0;
let lastUnionObject = null; // Guardar la unión para borrarla si se pone lanza
let aimingLine = null; // Línea guía punteada para apuntar la lanza

// Variables para el cono de agua
let placingConeLength = false;
let placingConeWidth = false;
let waterConeObject = null;
let waterJetObject = null;
let coneTipX = 0;
let coneTipY = 0;
let coneBaseAngleRad = 0;

// Textos indicadores
let remainingLengthText = null;
let coneLengthText = null;

// Variables para paneo (arrastrar el canvas)
let isDragging = false;
let lastPosX = 0;
let lastPosY = 0;

// Variable para sello (colocar íconos/brigadistas)
let stampGhost = null;

// --- INICIALIZACIÓN DE FABRIC.JS ---
fabric.Object.prototype.set({
  borderColor: "#7c3aed",
  cornerColor: "#2563eb",
  cornerStrokeColor: "#ffffff",
  transparentCorners: false,
  cornerSize: 14,
});

const canvas = new fabric.Canvas("main-canvas", {
  selection: true,
  preserveObjectStacking: true, // Mantiene el orden de capas al seleccionar
  fireMiddleClick: true, // CRÍTICO: Permitir detectar el botón central del ratón
});

// Mensaje en pantalla para errores en lugar de alert()
/**
 * Muestra un aviso temporal sobre el lienzo.
 * @param {string} msg Texto que se mostrará al usuario.
 */
function showMessage(msg) {
  const tempText = new fabric.Text(msg, {
    left: canvas.width / 2,
    top: 50,
    fontSize: 20,
    fill: "white",
    backgroundColor: "red",
    originX: "center",
    originY: "center",
    selectable: false,
  });
  canvas.add(tempText);
  setTimeout(() => canvas.remove(tempText), 3000);
}

// --- SISTEMA DE DESHACER (CTRL+Z) ---
let undoStack = [];
let isUndoing = false;

/** Guarda escala y contenido del lienzo para poder restaurarlos con Deshacer. */
function saveHistory() {
  if (isUndoing) return;
  // Guardar con coordenadas absolutas (reset viewport temporal)
  const originalVPT = canvas.viewportTransform.slice();
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

  const state = {
    scale: pixelsPerMeter,
    canvas: canvas.toJSON([
      "objectCaching",
      "selectable",
      "evented",
      "visible",
    ]),
  };

  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 20) {
    undoStack.shift();
  }

  canvas.setViewportTransform(originalVPT);
}

/**
 * Mantiene horizontal y legible el rótulo de una flecha de viento o propagación.
 * @param {fabric.Object} object Grupo de flecha que se está rotando.
 */
function keepDirectionalLabelReadable(object) {
  if (object.type !== "group" || !object._objects) return;
  const label = object._objects.find(
    (child) =>
      child.type === "text" &&
      (child.text === "viento" || child.text === "propagación"),
  );
  if (!label) return;
  const angle = ((object.angle % 360) + 360) % 360;
  label.set({ angle: angle > 90 && angle < 270 ? 180 : 0 });
  label.setCoords();
  object.dirty = true;
  object.setCoords();
}

/** Normaliza los rótulos de todas las flechas existentes en el lienzo. */
function normalizeDirectionalLabels() {
  canvas.forEachObject(keepDirectionalLabelReadable);
}

// Corrige el rótulo inmediatamente durante el giro interactivo de una flecha.
canvas.on("object:rotating", (event) => {
  if (event.target) keepDirectionalLabelReadable(event.target);
});

/** Restaura el estado anterior del lienzo sin cambiar el zoom y paneo actuales. */
function undo() {
  if (undoStack.length > 1) {
    isUndoing = true;
    undoStack.pop(); // Removemos el estado actual
    const prevStateJSON = undoStack[undoStack.length - 1]; // Obtenemos el anterior
    const prevState = JSON.parse(prevStateJSON);

    pixelsPerMeter = prevState.scale;
    if (pixelsPerMeter) {
      document.getElementById("scale-info").innerHTML =
        `Escala: <span class="text-blue-400 font-bold">1m = ${pixelsPerMeter.toFixed(1)}px</span>`;
    } else {
      document.getElementById("scale-info").innerHTML = `Escala no definida`;
    }

    // Preservar viewport actual al cargar
    const currentVPT = canvas.viewportTransform.slice();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    canvas.loadFromJSON(prevState.canvas, function () {
      canvas.getObjects().forEach((obj) => {
        if (
          obj.type === "polyline" ||
          obj.type === "triangle" ||
          obj.type === "rect"
        ) {
          obj.set("objectCaching", false);
        }
      });
      separateZoningLabels();
      normalizeMeasurementLabelStyles();
      normalizeDirectionalLabels();
      refreshZoningClips();
      canvas.setViewportTransform(currentVPT);
      canvas.renderAll();
      isUndoing = false;
      updateToolHelp();
    });
  }
}

// Guardar historial al modificar objetos (mover, escalar, rotar)
// Si cambia una zona, también se recalculan sus recortes de prioridad.
canvas.on("object:modified", function (event) {
  if (getZoningPriority(event.target) !== null) {
    refreshZoningClips();
  }
  saveHistory();
});

// Ajustar canvas al contenedor
/** Ajusta el tamaño del lienzo al espacio disponible y registra el estado inicial. */
function resizeCanvas() {
  const wrapper = document.getElementById("canvas-wrapper");
  canvas.setWidth(wrapper.clientWidth - 40);
  canvas.setHeight(wrapper.clientHeight - 40);
  canvas.renderAll();
  if (undoStack.length === 0) saveHistory(); // Estado inicial
}
window.addEventListener("resize", resizeCanvas);
window.onload = resizeCanvas;

// --- ZOOM Y PANEO ---
// La rueda acerca o aleja el lienzo alrededor de la posición del puntero.
canvas.on("mouse:wheel", function (opt) {
  var delta = opt.e.deltaY;
  var zoom = canvas.getZoom();
  zoom *= 0.999 ** delta;
  if (zoom > 20) zoom = 20; // Zoom máximo
  if (zoom < 0.05) zoom = 0.05; // Zoom mínimo
  canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
  opt.e.preventDefault();
  opt.e.stopPropagation();
});

// Los botones de vista aplican zoom centrado o restauran la escala inicial.
document.getElementById("btn-zoom-in").onclick = () => {
  let zoom = canvas.getZoom() * 1.2;
  if (zoom > 20) zoom = 20;
  canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, zoom);
};

document.getElementById("btn-zoom-out").onclick = () => {
  let zoom = canvas.getZoom() / 1.2;
  if (zoom < 0.05) zoom = 0.05;
  canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, zoom);
};

document.getElementById("btn-zoom-reset").onclick = () => {
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
};

/**
 * Carga una imagen como plano de fondo, centrada y ajustada al lienzo.
 * @param {string} dataUrl Imagen en formato URL o data URL.
 */
function loadFabricBackground(dataUrl) {
  fabric.Image.fromURL(dataUrl, function (img) {
    pixelsPerMeter = null;
    document.getElementById("scale-info").innerHTML = "Escala no definida";

    // Escalar imagen para que encaje en el canvas
    const scaleX = canvas.width / img.width;
    const scaleY = canvas.height / img.height;
    const scale = Math.min(scaleX, scaleY) * 0.95; // 95% para un pequeño margen

    img.set({
      originX: "center",
      originY: "center",
      left: canvas.width / 2,
      top: canvas.height / 2,
      scaleX: scale,
      scaleY: scale,
      opacity: 0.8, // Un poco translúcido para ver mejor los elementos
    });

    canvas.setBackgroundImage(img, () => {
      canvas.renderAll();
      updateToolHelp();
    });

    // Reiniciar historial al cargar nuevo plano
    undoStack = [];
    saveHistory();
  });
}

// --- CARGAR IMAGEN O PDF DE PLANO ---
// Convierte imágenes o la primera página de un PDF en el fondo del lienzo.
document
  .getElementById("upload-image")
  .addEventListener("change", async function (e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      const fileReader = new FileReader();
      fileReader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        try {
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          const page = await pdf.getPage(1);

          // Escalar el PDF renderizado a ~300 DPI (300 / 72 = 4.166) para máxima nitidez
          const viewport = page.getViewport({ scale: 4.16 });
          const pdfCanvas = document.createElement("canvas");
          const context = pdfCanvas.getContext("2d");
          pdfCanvas.height = viewport.height;
          pdfCanvas.width = viewport.width;

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };
          await page.render(renderContext).promise;

          // Convertir a imagen y cargar
          const dataUrl = pdfCanvas.toDataURL("image/png");
          loadFabricBackground(dataUrl);
        } catch (error) {
          console.error("Error rendering PDF:", error);
          showMessage("Error al procesar el archivo PDF.");
        }
      };
      fileReader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = function (f) {
        loadFabricBackground(f.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

// --- MANEJO DE MODOS (HERRAMIENTAS) ---
/** Actualiza las instrucciones visibles según el plano, la escala y la herramienta. */
function updateToolHelp() {
  const hasPlan = Boolean(canvas.backgroundImage);
  document
    .getElementById("upload-image-label")
    .classList.toggle("attention-pulse", !hasPlan);
  document
    .getElementById("upload-image-check")
    .classList.toggle("hidden", !hasPlan);
  document
    .getElementById("btn-scale")
    .classList.toggle("attention-pulse", hasPlan && !pixelsPerMeter);
  document
    .getElementById("scale-check")
    .classList.toggle("hidden", !pixelsPerMeter);
  document
    .getElementById("scale-icons-container")
    .classList.toggle("hidden", !pixelsPerMeter);

  let title = "Seleccionar / Mover";
  let instructions = [
    `<span aria-hidden="true">🖱️</span> <strong>Botón central o Alt + arrastrar:</strong> desplaza la vista.`,
    `<span aria-hidden="true">🖱️</span> <strong>Girar la rueda:</strong> modifica el zoom.`,
    `<span aria-hidden="true">🖱️</span> <strong>Clic izquierdo:</strong> selecciona; arrastra un elemento para moverlo.`,
    `<kbd class="rounded border border-gray-500 px-1">Supr</kbd> borra los elementos seleccionados.`,
    `<kbd class="rounded border border-gray-500 px-1">Ctrl</kbd> + <kbd class="rounded border border-gray-500 px-1">Z</kbd> deshace la última acción.`,
  ];

  if (currentMode === "zoning_color" || currentMode === "zoning") {
    title =
      currentMode === "zoning_color"
        ? "Zonificación"
        : selectedZoningType.label;
    instructions =
      currentMode === "zoning_color"
        ? ["Elige Zona caliente, Zona templada o Zona fría."]
        : zoningPoints.length
          ? [
              "Traza el perímetro moviendo el cursor; al volver cerca del inicio, se cerrará automáticamente.",
              "Pulsa Escape para cancelar.",
            ]
          : [
              "Haz clic para iniciar el perímetro y mueve el cursor a mano alzada.",
              "Al volver cerca del inicio, el perímetro se cerrará automáticamente.",
              "Pulsa Escape para cancelar.",
            ];
  } else if (!canvas.backgroundImage) {
    title = "Comienza por cargar un plano";
    instructions = [
      "Plano nuevo: carga una imagen o PDF en «Cargar Imagen / PDF». Se usará como base para dibujar; después podrás definir la escala.",
      "Proyecto guardado: «Cargar Proyecto» abre un .json exportado con «Descargar Proyecto» y restaura el plano, la escala y sus elementos.",
      "Guardado en este navegador: «Planos Recientes» reabre proyectos guardados aquí con «Guardar en Navegador».",
    ];
  } else if (
    currentMode === "wind_arrow" ||
    currentMode === "propagation_arrow"
  ) {
    title =
      currentMode === "wind_arrow"
        ? "Indicar dirección del viento"
        : "Indicar dirección de propagación";
    if (directionalArrowPhase === "width") {
      instructions = [
        "La dirección y el largo están definidos. Mueve el cursor para ajustar el ancho de la flecha.",
        "Haz clic para colocarla. Pulsa Escape para cancelar.",
      ];
    } else if (directionalArrowPhase === "direction") {
      instructions = [
        "El punto inicial está marcado. Haz clic en el segundo punto para indicar la dirección y el largo.",
        "Pulsa Escape para cancelar.",
      ];
    } else {
      instructions = [
        "Haz clic en el punto inicial de la flecha.",
        "Luego indicarás dirección y largo, y ajustarás el ancho antes de colocarla.",
        "Pulsa Escape para cancelar.",
      ];
    }
  } else if (!pixelsPerMeter) {
    title = "Fija la escala del plano";
    if (currentMode === "scale") {
      instructions = scaleStartPlaced
        ? [
            "El primer punto está marcado. Haz clic en el segundo extremo de una distancia conocida.",
            "Luego ingresa la distancia real en metros.",
            "La escala permite calcular longitudes y tamaños reales.",
          ]
        : [
            "Haz clic en los dos extremos de una distancia conocida y luego ingresa su longitud en metros.",
            "Así el sistema convierte las medidas del plano a metros reales.",
            "Pulsa Escape para cancelar.",
          ];
    } else {
      instructions = [
        "Pulsa «Fijar Escala» y marca con dos clics los extremos de una distancia conocida.",
        "Ingresa la longitud real en metros.",
        "La escala permite calcular longitudes —como los tramos de ataque— y tamaños reales.",
      ];
    }
  } else if (currentMode === "measure_distance") {
    title = "Medir distancia";
    instructions = [
      "Haz clic en el primer punto y mueve el cursor hasta el segundo.",
      "Haz clic otra vez para fijar la distancia, que se calcula en metros según la escala.",
      "Pulsa Escape para cancelar.",
    ];
  } else if (currentMode === "measure_radius") {
    title = "Medir radio";
    instructions = [
      "Haz clic para marcar el centro del círculo.",
      "Aleja el cursor para definir el radio; la línea punteada muestra la medida.",
      "Haz clic para fijar el círculo. Pulsa Escape para cancelar.",
    ];
  } else if (currentMode === "scale") {
    title = "Fijar Escala";
    instructions = scaleStartPlaced
      ? [
          "Haz clic en el segundo punto de una distancia conocida.",
          "Luego ingresa cuántos metros representa esa distancia.",
          "Pulsa Escape para cancelar.",
        ]
      : [
          "Haz clic en el primer punto de una distancia conocida.",
          "Haz clic en el segundo punto para completar la línea.",
          "Pulsa Escape para cancelar.",
        ];
  } else if (currentMode === "attack_line") {
    title = "Línea de Ataque";
    if (placingNozzle) {
      instructions = [
        "Mueve el cursor para orientar la lanza.",
        "Haz clic para fijar su posición y orientación.",
        "Pulsa Escape para cancelar.",
      ];
    } else if (placingConeLength) {
      instructions = [
        "Mueve el cursor para definir el alcance del chorro.",
        "Haz clic para confirmar la longitud.",
        "Pulsa Escape para cancelar.",
      ];
    } else if (placingConeWidth) {
      instructions = [
        "Mueve el cursor a un lado del eje para definir el ancho.",
        "Haz clic para confirmar el cono o chorro pleno.",
        "Pulsa Escape para cancelar.",
      ];
    } else if (isDrawingHose) {
      instructions = [
        "Haz clic para iniciar y mueve el cursor para trazar el tramo.",
        "El tramo finaliza automáticamente al alcanzar la longitud definida.",
        "Pulsa Escape para cancelar.",
      ];
    } else if (segmentFinished) {
      instructions = [
        "El tramo está completo.",
        "Elige alargarlo o colocar la lanza.",
        "Pulsa Escape para salir de la herramienta.",
      ];
    } else {
      instructions = [
        "Haz clic en el plano y mueve el cursor para trazar un tramo.",
        "El tramo se limita a la longitud configurada.",
        "Pulsa Escape para salir de la herramienta.",
      ];
    }
  } else if (currentMode === "stamp") {
    title = "Colocar Elemento";
    instructions = [
      "Mueve el cursor para ubicar la vista previa.",
      "Haz clic para colocar el elemento en el plano.",
      "Pulsa Escape para cancelar.",
    ];
  }

  document.getElementById("tool-help-title").textContent = title;
  document.getElementById("tool-help-list").innerHTML = instructions
    .map((instruction) => `<li>${instruction}</li>`)
    .join("");
}

/** Elimina los objetos temporales de medición y reinicia sus puntos de control. */
function clearMeasurementPreview() {
  if (measurementPreview) {
    Object.values(measurementPreview).forEach((object) =>
      canvas.remove(object),
    );
  }
  measurementPreview = null;
  measurementStart = null;
}

