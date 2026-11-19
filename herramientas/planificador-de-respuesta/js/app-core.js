/**
 * Misión: inicializar el lienzo y mantener el estado compartido del planificador.
 * Responsabilidades: historial/deshacer, carga del plano, zoom/paneo
 * y rótulos de las flechas de dirección.
 * Funciones principales: showMessage, saveHistory, undo, resizeCanvas,
 * loadFabricBackground y utilidades de etiquetas direccionales.
 * Guía de arquitectura y cambios: ../GUIA-PROGRAMADOR.md
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

