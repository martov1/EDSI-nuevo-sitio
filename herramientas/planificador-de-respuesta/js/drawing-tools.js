/**
 * Misión: implementar las formas interactivas dibujadas directamente sobre el plano.
 * Incluye zonificación con prioridad de capas, flechas de dirección y herramientas
 * de medición; también gestiona sus vistas previas y geometría auxiliar.
 * Funciones: crear/actualizar/finalizar zonas, flechas y mediciones, y mantener
 * sus rótulos, selección por borde y recortes de prioridad.
 */

/** Descarta el perímetro temporal y reinicia el estado del dibujo de zona. */
function clearZoningDraft() {
  if (zoningPreview) canvas.remove(zoningPreview);
  zoningPreview = null;
  zoningPoints = [];
  zoningPathLength = 0;
}

/**
 * Obtiene la prioridad de una zona (caliente, templada o fría).
 * @param {fabric.Object} object Objeto del lienzo que se quiere identificar.
 * @returns {number|null} Prioridad de la zona o null si el objeto no es una zona.
 */
function getZoningPriority(object) {
  if (!object || object.type !== "group" || !object._objects) return null;
  const polygon = object._objects.find((child) => child.type === "polygon");
  const colorPriority = Object.values(zoningTypes).find(
    (zone) =>
      typeof polygon?.stroke === "string" &&
      zone.color.toLowerCase() === polygon.stroke.toLowerCase(),
  )?.priority;
  const label = object._objects.find(
    (child) =>
      child.type === "text" &&
      Object.values(zoningTypes).some((zone) => zone.label === child.text),
  );
  const labelPriority = Object.values(zoningTypes).find(
    (zone) => zone.label === label?.text,
  )?.priority;
  return colorPriority ?? labelPriority ?? null;
}

/** Ordena las zonas para que las de mayor prioridad queden visualmente encima. */
function orderZoningLayers() {
  const zones = canvas
    .getObjects()
    .map((object) => ({
      object,
      priority: getZoningPriority(object),
    }))
    .filter((zone) => zone.priority !== null)
    .sort((first, second) => first.priority - second.priority);
  zones.forEach(({ object }, index) => canvas.moveTo(object, index));
}

/** Extrae el polígono de relleno del grupo de zona indicado. */
function getZoningPolygon(object) {
  if (getZoningPriority(object) === null) return null;
  return object._objects.find((child) => child.type === "polygon") ?? null;
}

/** Convierte los vértices locales de un polígono a coordenadas absolutas del lienzo. */
function getZoningPolygonWorldPoints(polygon) {
  const transform = polygon.calcTransformMatrix();
  return polygon.points.map((point) =>
    fabric.util.transformPoint(
      new fabric.Point(
        point.x - polygon.pathOffset.x,
        point.y - polygon.pathOffset.y,
      ),
      transform,
    ),
  );
}

/**
 * Permite seleccionar una zona solo cerca de su borde, contemplando zoom y escala.
 * @param {fabric.Group} zoneGroup Grupo que contiene el polígono de la zona.
 */
function installZoningEdgeSelection(zoneGroup) {
  // Fabric consulta este método para decidir si el puntero alcanzó el borde.
  zoneGroup.containsPoint = function (point) {
    const polygon = getZoningPolygon(this);
    if (!polygon || !point) return false;

    const worldPoint = canvas.restorePointerVpt(point);
    const vertices = getZoningPolygonWorldPoints(polygon);
    const transform = polygon.calcTransformMatrix();
    const strokeScale = Math.max(
      Math.hypot(transform[0], transform[1]),
      Math.hypot(transform[2], transform[3]),
    );
    const tolerance =
      (polygon.strokeWidth * strokeScale) / 2 + 8 / (canvas.getZoom() || 1);

    return vertices.some((start, index) => {
      const end = vertices[(index + 1) % vertices.length];
      const deltaX = end.x - start.x;
      const deltaY = end.y - start.y;
      const lengthSquared = deltaX * deltaX + deltaY * deltaY;
      const projection =
        lengthSquared === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                ((worldPoint.x - start.x) * deltaX +
                  (worldPoint.y - start.y) * deltaY) /
                  lengthSquared,
              ),
            );
      const closestX = start.x + projection * deltaX;
      const closestY = start.y + projection * deltaY;
      return (
        Math.hypot(worldPoint.x - closestX, worldPoint.y - closestY) <=
        tolerance
      );
    });
  };
}

/** Separa rótulos agrupados de zonas antiguas y vuelve a instalar su selección. */
function separateZoningLabels() {
  canvas
    .getObjects()
    .slice()
    .forEach((object) => {
      if (getZoningPriority(object) === null) return;
      const label = object._objects.find(
        (child) =>
          child.type === "text" &&
          Object.values(zoningTypes).some((zone) => zone.label === child.text),
      );

      if (label) {
        object.removeWithUpdate(label);
        label.set({ selectable: true, evented: true });
        canvas.add(label);
      }

      installZoningEdgeSelection(object);
    });
  orderZoningLayers();
}

/**
 * Recorta el relleno de cada zona donde se superpone una de mayor prioridad.
 * Actualiza las máscaras después de mover, cargar o borrar zonas.
 */
function refreshZoningClips() {
  const zones = canvas
    .getObjects()
    .map((object) => ({
      object,
      priority: getZoningPriority(object),
    }))
    .filter((zone) => zone.priority !== null);

  zones.forEach(({ object, priority }) => {
    const polygon = getZoningPolygon(object);
    if (!polygon) return;

    const higherPriorityPolygons = zones
      .filter((zone) => zone.priority > priority)
      .map(({ object: higherPriorityZone }) =>
        getZoningPolygon(higherPriorityZone),
      )
      .filter(Boolean);
    let clipPath = null;

    if (higherPriorityPolygons.length) {
      const masks = higherPriorityPolygons.map(
        (higherPriorityPolygon) =>
          new fabric.Polygon(
            getZoningPolygonWorldPoints(higherPriorityPolygon),
            {
              fill: "#000000",
              stroke: null,
              objectCaching: false,
            },
          ),
      );
      clipPath = new fabric.Group(masks, {
        originX: "center",
        originY: "center",
        objectCaching: false,
      });
      clipPath.absolutePositioned = true;
      clipPath.inverted = true;
    }

    polygon.set({ clipPath, objectCaching: true });
    polygon.dirty = true;
    object.dirty = true;
    polygon.setCoords();
    object.setCoords();
  });

  canvas.requestRenderAll();
}

// Recalcula las máscaras mientras se mueve una zona para conservar su prioridad.
canvas.on("object:moving", function (event) {
  if (getZoningPriority(event.target) !== null) {
    refreshZoningClips();
  }
});

/** Dibuja la vista previa del perímetro de zonificación en curso. */
function renderZoningPreview() {
  if (zoningPreview) canvas.remove(zoningPreview);
  if (!selectedZoningType || zoningPoints.length < 2) return;
  zoningPreview = new fabric.Polyline(zoningPoints, {
    fill: "transparent",
    stroke: selectedZoningType.color,
    strokeWidth: 3,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    selectable: false,
    evented: false,
    objectCaching: false,
  });
  canvas.add(zoningPreview);
  canvas.requestRenderAll();
}

/** Crea el degradado interior translúcido de una zona a partir de su color. */
function createZoningGradient(color) {
  const [red, green, blue] = color
    .slice(1)
    .match(/.{2}/g)
    .map((component) => parseInt(component, 16));
  return new fabric.Gradient({
    type: "linear",
    gradientUnits: "percentage",
    coords: { x1: 0, y1: 0, x2: 0, y2: 1 },
    colorStops: [
      { offset: 0, color: `rgba(${red}, ${green}, ${blue}, 0.04)` },
      { offset: 0.5, color: `rgba(${red}, ${green}, ${blue}, 0.1)` },
      { offset: 1, color: `rgba(${red}, ${green}, ${blue}, 0.06)` },
    ],
  });
}

/** Coloca el rótulo de zona sobre su borde más largo y lo mantiene legible. */
function positionZoningLabel(label, start, end) {
  let angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  const angleRadians = (angle * Math.PI) / 180;
  const offset = label.height / 2 + 5;
  label.set({
    angle,
    scaleX: 1,
    scaleY: 1,
    left: (start.x + end.x) / 2 + Math.sin(angleRadians) * offset,
    top: (start.y + end.y) / 2 - Math.cos(angleRadians) * offset,
  });
}

/** Convierte el trazo en una zona final, agrega su rótulo y guarda el cambio. */
function finishZoning() {
  if (zoningPreview) canvas.remove(zoningPreview);
  zoningPreview = null;

  const zone = selectedZoningType;
  const points = zoningPoints;
  const polygon = new fabric.Polygon(points, {
    fill: createZoningGradient(zone.color),
    stroke: zone.color,
    strokeWidth: 3,
    strokeLineJoin: "round",
    selectable: false,
    evented: false,
    objectCaching: false,
  });
  const label = createMeasurementLabel(zone.label, zone.color, 0, 0);
  let labelStart = points[0];
  let labelEnd = points[1];
  let labelLength = 0;
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index];
    const end = points[index + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length > labelLength) {
      labelStart = start;
      labelEnd = end;
      labelLength = length;
    }
  }
  positionZoningLabel(label, labelStart, labelEnd);
  label.set({ selectable: true, evented: true });

  const zoneGroup = new fabric.Group([polygon], {
    originX: "center",
    originY: "center",
    selectable: true,
    evented: true,
    objectCaching: false,
  });
  installZoningEdgeSelection(zoneGroup);
  clearZoningDraft();
  canvas.add(zoneGroup, label);
  orderZoningLayers();
  refreshZoningClips();
  setMode("select");
  canvas.setActiveObject(zoneGroup);
  canvas.requestRenderAll();
  saveHistory();
}

/**
 * Incorpora puntos al perímetro y lo cierra al acercarse al punto de inicio.
 * @param {{x:number, y:number}} point Posición actual del puntero en el lienzo.
 */
function updateZoningDrawing(point) {
  if (!zoningPoints.length) return;
  const zoom = canvas.getZoom() || 1;
  const start = zoningPoints[0];
  const distanceToStart = Math.hypot(point.x - start.x, point.y - start.y);
  if (
    zoningPoints.length >= 8 &&
    zoningPathLength >= 36 / zoom &&
    distanceToStart <= 14 / zoom
  ) {
    zoningPoints.push(start);
    finishZoning();
    return;
  }

  const lastPoint = zoningPoints[zoningPoints.length - 1];
  const segmentLength = Math.hypot(
    point.x - lastPoint.x,
    point.y - lastPoint.y,
  );
  if (segmentLength < 2 / zoom) return;
  zoningPoints.push(point);
  zoningPathLength += segmentLength;
  renderZoningPreview();
}

/** Indica si el modo actual dibuja una flecha de viento o de propagación. */
function isDirectionalArrowMode(mode = currentMode) {
  return mode === "wind_arrow" || mode === "propagation_arrow";
}

/** Elimina la flecha provisional y reinicia su estado de dibujo. */
function clearDirectionalArrowPreview() {
  if (directionalArrowPreview) {
    canvas.remove(directionalArrowPreview);
  }
  directionalArrowPreview = null;
  directionalArrowStart = null;
  directionalArrowEnd = null;
  directionalArrowPhase = null;
  directionalArrowWidth = 0;
}

/** Devuelve el ancho mínimo de flecha para una longitud determinada. */
function minimumDirectionalArrowWidth(length) {
  return Math.max(16, length * 0.04);
}

/** Calcula el ancho inicial de flecha proporcional a su longitud. */
function defaultDirectionalArrowWidth(length) {
  return Math.max(16, Math.min(length * 0.24, 64));
}

/** Calcula el ancho de flecha a partir de la distancia del puntero a su eje. */
function directionalArrowWidthAt(point) {
  const dx = directionalArrowEnd.x - directionalArrowStart.x;
  const dy = directionalArrowEnd.y - directionalArrowStart.y;
  const length = Math.hypot(dx, dy);
  const distance =
    Math.abs(
      dx * (point.y - directionalArrowStart.y) -
        dy * (point.x - directionalArrowStart.x),
    ) / length;
  return Math.max(minimumDirectionalArrowWidth(length), distance * 2);
}

/**
 * Crea la flecha y su rótulo proporcional; puede generar una vista previa.
 * @param {{x:number, y:number}} start Punto de origen.
 * @param {{x:number, y:number}} end Punto que determina dirección y longitud.
 * @param {number} width Ancho de la flecha en píxeles del lienzo.
 * @param {boolean} preview Si es true, la flecha queda semitransparente y no seleccionable.
 * @returns {fabric.Group|null} Flecha agrupada o null si su longitud es insuficiente.
 */
function createDirectionalArrow(start, end, width, preview = false) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return null;

  const centerX = (start.x + end.x) / 2;
  const centerY = (start.y + end.y) / 2;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const shaftWidth = width * 0.62;
  const shaftHalfWidth = shaftWidth / 2;
  const headHalfWidth = width / 2;
  const headLength = Math.min(length * 0.35, width * 1.25);
  const startX = -length / 2;
  const tipX = length / 2;
  const neckX = tipX - headLength;
  const points = [
    { x: startX, y: -shaftHalfWidth },
    { x: neckX, y: -shaftHalfWidth },
    { x: neckX, y: -headHalfWidth },
    { x: tipX, y: 0 },
    { x: neckX, y: headHalfWidth },
    { x: neckX, y: shaftHalfWidth },
    { x: startX, y: shaftHalfWidth },
  ];
  const isWind = currentMode === "wind_arrow";
  const arrow = new fabric.Polygon(points, {
    left: centerX,
    top: centerY,
    originX: "center",
    originY: "center",
    fill: isWind ? "#2563eb" : "#dc2626",
    stroke: isWind ? "#1e3a8a" : "#7f1d1d",
    strokeWidth: 1.5,
    strokeLineJoin: "round",
    selectable: false,
    evented: false,
    objectCaching: false,
  });
  const label = new fabric.Text(isWind ? "viento" : "propagación", {
    left: centerX - headLength / 2,
    top: centerY,
    originX: "center",
    originY: "center",
    fontSize: 16,
    fontFamily: "Arial",
    fontWeight: "bold",
    fill: "#ffffff",
    selectable: false,
    evented: false,
    objectCaching: false,
  });
  const labelScale = Math.min(
    ((length - headLength) * 0.78) / label.width,
    (shaftWidth * 0.76) / label.height,
  );
  label.set({ scaleX: labelScale, scaleY: labelScale });

  const group = new fabric.Group([arrow, label], {
    left: centerX,
    top: centerY,
    originX: "center",
    originY: "center",
    angle,
    opacity: preview ? 0.72 : 1,
    selectable: !preview,
    evented: !preview,
    objectCaching: false,
  });
  keepDirectionalLabelReadable(group);
  return group;
}

/** Sustituye la vista previa por una flecha con la geometría indicada. */
function updateDirectionalArrowPreview(end, width) {
  if (directionalArrowPreview) {
    canvas.remove(directionalArrowPreview);
  }
  directionalArrowPreview = createDirectionalArrow(
    directionalArrowStart,
    end,
    width,
    true,
  );
  if (directionalArrowPreview) canvas.add(directionalArrowPreview);
  canvas.requestRenderAll();
}

/**
 * Avanza por los clics de origen, dirección/longitud y confirmación del ancho.
 * @param {{x:number, y:number}} point Posición del clic en el lienzo.
 */
function handleDirectionalArrowClick(point) {
  if (!directionalArrowStart) {
    directionalArrowStart = point;
    directionalArrowPhase = "direction";
    updateToolHelp();
    return;
  }

  if (directionalArrowPhase === "direction") {
    const length = Math.hypot(
      point.x - directionalArrowStart.x,
      point.y - directionalArrowStart.y,
    );
    if (length < 5) return;

    directionalArrowEnd = point;
    directionalArrowWidth = defaultDirectionalArrowWidth(length);
    directionalArrowPhase = "width";
    updateDirectionalArrowPreview(directionalArrowEnd, directionalArrowWidth);
    updateToolHelp();
    return;
  }

  if (directionalArrowPhase !== "width") return;
  const arrow = createDirectionalArrow(
    directionalArrowStart,
    directionalArrowEnd,
    directionalArrowWidthAt(point),
  );
  clearDirectionalArrowPreview();
  if (!arrow) return;
  canvas.add(arrow);
  setMode("select");
  canvas.setActiveObject(arrow);
  canvas.requestRenderAll();
  saveHistory();
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
