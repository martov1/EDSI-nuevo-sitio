/**
 * Herramientas de flechas de viento y propagación, incluidos ancho y rótulo.
 */

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
