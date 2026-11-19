/**
 * Herramientas para dibujar, actualizar y confirmar mediciones de distancia y radio.
 * También crea y normaliza sus etiquetas, que se reutilizan en zonificación.
 */

const measurementLabelBackground = "rgba(255, 255, 255, 0.8)";

/**
 * Convierte una longitud en píxeles a metros con formato regional.
 * @param {number} distancePx Longitud medida sobre el lienzo.
 * @returns {string} Medida formateada en metros.
 */
function formatMeasurement(distancePx) {
  const meters = distancePx / pixelsPerMeter;
  return `${meters.toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} m`;
}

/** Calcula cuánto reducir los adornos de una medición corta. */
function measurementStyleScale(length) {
  return Math.min(1, Math.max(0.05, length / 50));
}

/**
 * Crea una etiqueta centrada, no interactiva y con fondo translúcido.
 * @param {string} text Texto de la etiqueta.
 * @param {string} color Color del texto.
 * @param {number} left Coordenada horizontal.
 * @param {number} top Coordenada vertical.
 * @returns {fabric.Text} Etiqueta lista para añadir al lienzo.
 */
function createMeasurementLabel(text, color, left, top) {
  return new fabric.Text(text, {
    left,
    top,
    originX: "center",
    originY: "center",
    fontSize: 14,
    fontFamily: "Arial",
    fontWeight: "bold",
    fill: color,
    backgroundColor: measurementLabelBackground,
    padding: 5,
    selectable: false,
    evented: false,
    objectCaching: false,
  });
}

/** Aplica a etiquetas restauradas el fondo translúcido y elimina sombras antiguas. */
function normalizeMeasurementLabelStyles() {
  canvas.getObjects().forEach((object) => {
    if (object.type !== "text" || typeof object.text !== "string") return;
    const isRadiusLabel = object.text.startsWith("Radio:");
    const isDistanceLabel =
      object.fill === "#1a73e8" && /^[\d.,]+ m$/.test(object.text);
    if (isRadiusLabel || isDistanceLabel) {
      object.set({
        backgroundColor: measurementLabelBackground,
        shadow: null,
      });
    }
  });
}

/** Orienta y ubica una etiqueta de medida sin invertir su texto. */
function positionMeasurementLabel(label, text, start, end, length) {
  let angle = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;

  label.set({ text, angle });

  const availableLength = Math.max(0, length - 8);
  const labelScale =
    label.width > 0 ? Math.min(1, availableLength / label.width) : 1;
  const angleRadians = (angle * Math.PI) / 180;
  const labelOffset = (label.height * labelScale) / 2 + 6;
  label.set({
    scaleX: labelScale,
    scaleY: labelScale,
    left: (start.x + end.x) / 2 + Math.sin(angleRadians) * labelOffset,
    top: (start.y + end.y) / 2 - Math.cos(angleRadians) * labelOffset,
  });
}

/** Crea los elementos temporales de una medición de distancia. */
function startDistanceMeasurement(point) {
  measurementStart = point;
  const halo = new fabric.Line([point.x, point.y, point.x, point.y], {
    stroke: "rgba(255, 255, 255, 0.45)",
    strokeWidth: 6,
    strokeLineCap: "round",
    selectable: false,
    evented: false,
    objectCaching: false,
  });
  const line = new fabric.Line([point.x, point.y, point.x, point.y], {
    stroke: "#4285f4",
    strokeWidth: 3,
    strokeDashArray: [3, 5],
    strokeLineCap: "round",
    selectable: false,
    evented: false,
    objectCaching: false,
  });
  const startPoint = new fabric.Circle({
    left: point.x,
    top: point.y,
    radius: 5,
    originX: "center",
    originY: "center",
    fill: "rgba(255, 255, 255, 0.45)",
    stroke: "#4285f4",
    strokeWidth: 2,
    selectable: false,
    evented: false,
  });
  const endPoint = new fabric.Circle({
    left: point.x,
    top: point.y,
    radius: 5,
    originX: "center",
    originY: "center",
    fill: "rgba(255, 255, 255, 0.45)",
    stroke: "#4285f4",
    strokeWidth: 2,
    selectable: false,
    evented: false,
  });
  const label = createMeasurementLabel(
    formatMeasurement(0),
    "#1a73e8",
    point.x,
    point.y,
  );
  label.set({ scaleX: 0, scaleY: 0 });
  measurementPreview = { halo, line, startPoint, endPoint, label };
  Object.values(measurementPreview).forEach((object) => canvas.add(object));
  updateDistanceMeasurement(point);
}

/** Actualiza la línea, sus extremos y su etiqueta durante la medición. */
function updateDistanceMeasurement(point) {
  if (!measurementStart || !measurementPreview) return;
  const { halo, line, startPoint, endPoint, label } = measurementPreview;
  endPoint.set({ left: point.x, top: point.y });
  const dx = point.x - measurementStart.x;
  const dy = point.y - measurementStart.y;
  const distance = Math.hypot(dx, dy);
  const detailScale = measurementStyleScale(distance);
  const haloWidth = 6 * detailScale;
  const lineWidth = 3 * detailScale;
  halo.set({ strokeWidth: haloWidth });
  line.set({
    strokeWidth: lineWidth,
    strokeDashArray: [3 * detailScale, 5 * detailScale],
  });
  const markerRadius = 5 * detailScale;
  const markerStrokeWidth = 2 * detailScale;
  [startPoint, endPoint].forEach((marker) =>
    marker.set({
      radius: markerRadius,
      strokeWidth: markerStrokeWidth,
    }),
  );
  const directionX = distance ? dx / distance : 0;
  const directionY = distance ? dy / distance : 0;
  const markerEdge = markerRadius + markerStrokeWidth / 2;
  // Separa los segmentos de los círculos de extremo para que no se superpongan.
  const setTrimmedEndpoints = (segment, strokeWidth) => {
    const trim = markerEdge + strokeWidth / 2;
    const offset = Math.min(trim, distance / 2);
    const x1 = measurementStart.x + directionX * offset;
    const y1 = measurementStart.y + directionY * offset;
    const x2 = point.x - directionX * offset;
    const y2 = point.y - directionY * offset;
    segment.set({
      x1,
      y1,
      x2,
      y2,
      left: Math.min(x1, x2) - strokeWidth / 2,
      top: Math.min(y1, y2) - strokeWidth / 2,
      visible: distance > trim * 2,
    });
    segment.setCoords();
  };
  setTrimmedEndpoints(halo, haloWidth);
  setTrimmedEndpoints(line, lineWidth);
  positionMeasurementLabel(
    label,
    formatMeasurement(distance),
    measurementStart,
    point,
    distance,
  );
}

/** Crea los elementos temporales de una medición de radio. */
function startRadiusMeasurement(point) {
  measurementStart = point;
  const circle = new fabric.Circle({
    left: point.x,
    top: point.y,
    radius: 0,
    originX: "center",
    originY: "center",
    fill: "rgba(255, 255, 255, 0)",
    stroke: "#facc15",
    strokeWidth: 3,
    selectable: false,
    evented: false,
    objectCaching: false,
  });
  const radiusLine = new fabric.Line([point.x, point.y, point.x, point.y], {
    stroke: "#eab308",
    strokeWidth: 2,
    strokeDashArray: [4, 4],
    selectable: false,
    evented: false,
    objectCaching: false,
  });
  const centerPoint = new fabric.Circle({
    left: point.x,
    top: point.y,
    radius: 3,
    originX: "center",
    originY: "center",
    fill: "#facc15",
    stroke: "#ffffff",
    strokeWidth: 1,
    selectable: false,
    evented: false,
  });
  const label = createMeasurementLabel(
    `Radio: ${formatMeasurement(0)}`,
    "#a16207",
    point.x,
    point.y,
  );
  label.set({ scaleX: 0, scaleY: 0 });
  measurementPreview = { circle, radiusLine, centerPoint, label };
  Object.values(measurementPreview).forEach((object) => canvas.add(object));
  updateRadiusMeasurement(point);
}

/** Ajusta el círculo, la línea radial y la etiqueta al movimiento del puntero. */
function updateRadiusMeasurement(point) {
  if (!measurementStart || !measurementPreview) return;
  const radius = Math.hypot(
    point.x - measurementStart.x,
    point.y - measurementStart.y,
  );
  const { circle, radiusLine, centerPoint, label } = measurementPreview;
  const detailScale = measurementStyleScale(radius);
  circle.set({ radius, strokeWidth: 3 * detailScale });
  radiusLine.set({
    x2: point.x,
    y2: point.y,
    strokeWidth: 2 * detailScale,
    strokeDashArray: [4 * detailScale, 4 * detailScale],
  });
  centerPoint.set({
    radius: 3 * detailScale,
    strokeWidth: detailScale,
  });
  positionMeasurementLabel(
    label,
    `Radio: ${formatMeasurement(radius)}`,
    measurementStart,
    point,
    radius,
  );
}

/** Confirma una medición, vuelve seleccionables sus objetos y guarda el historial. */
function finishMeasurement() {
  Object.values(measurementPreview).forEach((object) =>
    object.set({ selectable: true, evented: true }),
  );
  measurementPreview = null;
  measurementStart = null;
  canvas.requestRenderAll();
  saveHistory();
  setMode("select");
}
