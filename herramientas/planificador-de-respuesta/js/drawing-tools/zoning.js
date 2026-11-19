/**
 * Herramientas de zonificación: perímetros, etiquetas, selección por borde y prioridad visual.
 * Guía de arquitectura y cambios: ../../GUIA-PROGRAMADOR.md
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
