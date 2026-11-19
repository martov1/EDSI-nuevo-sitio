/**
 * Herramientas para dibujar tramos de ataque, orientar la lanza y definir el chorro.
 * El estado temporal compartido se declara en app-core.js.
 */

/** Atiende los clics de cada etapa de la línea de ataque. */
function handleAttackLineMouseDown(point) {
  if (placingNozzle) {
    placeNozzleAndStartWaterCone();
    return;
  }

  if (placingConeLength) {
    placingConeLength = false;
    placingConeWidth = true;
    updateToolHelp();
    return;
  }

  if (placingConeWidth) {
    finishAttackLine();
    return;
  }

  startAttackLineSegment(point);
}

/** Bloquea la orientación de la lanza e inicia la vista previa del chorro. */
function placeNozzleAndStartWaterCone() {
  placingNozzle = false;

  if (aimingLine) {
    canvas.remove(aimingLine);
    aimingLine = null;
  }

  if (nozzleObject) {
    nozzleObject.set({ selectable: false, evented: false });
  }

  const nozzleAngleRad = (nozzleObject.angle - 90) * (Math.PI / 180);
  const nozzleHeight = nozzleObject.height * nozzleObject.scaleY;
  coneTipX = nozzleObject.left + Math.cos(nozzleAngleRad) * (nozzleHeight / 2);
  coneTipY = nozzleObject.top + Math.sin(nozzleAngleRad) * (nozzleHeight / 2);
  coneBaseAngleRad = nozzleAngleRad;

  placingConeLength = true;
  updateToolHelp();

  waterConeObject = new fabric.Triangle({
    left: coneTipX,
    top: coneTipY,
    width: pixelsPerMeter ? pixelsPerMeter : 20,
    height: pixelsPerMeter ? pixelsPerMeter * 2 : 40,
    angle: nozzleObject.angle + 180,
    originX: "center",
    originY: "top",
    stroke: "rgba(2, 132, 199, 0.8)",
    strokeWidth: 2,
    selectable: false,
    evented: false,
    objectCaching: false,
  });

  const waterConeGradient = new fabric.Gradient({
    type: "linear",
    gradientUnits: "percentage",
    coords: { x1: 0, y1: 0, x2: 0, y2: 1 },
    colorStops: [
      { offset: 0, color: "rgba(56, 189, 248, 0.85)" },
      { offset: 1, color: "rgba(56, 189, 248, 0.05)" },
    ],
  });
  waterConeObject.set("fill", waterConeGradient);

  waterJetObject = new fabric.Rect({
    left: coneTipX,
    top: coneTipY,
    width: Math.max(pixelsPerMeter * 0.2, 1),
    height: waterConeObject.height,
    angle: waterConeObject.angle,
    originX: "center",
    originY: "top",
    stroke: "rgba(2, 132, 199, 0.8)",
    strokeWidth: 2,
    selectable: false,
    evented: false,
    objectCaching: false,
    visible: false,
  });
  waterJetObject.set("fill", waterConeGradient);

  canvas.add(waterConeObject);
  canvas.add(waterJetObject);
  canvas.bringToFront(nozzleObject);

  coneLengthText = new fabric.Text("0m", {
    left: coneTipX,
    top: coneTipY,
    fontSize: 16,
    fill: "#0284c7",
    fontFamily: "Inter",
    fontWeight: "bold",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    selectable: false,
    evented: false,
  });
  canvas.add(coneLengthText);
}

/** Confirma el chorro y guarda en el historial todos sus objetos. */
function finishAttackLine() {
  placingConeWidth = false;
  if (waterConeObject) {
    waterConeObject.set({
      selectable: true,
      evented: true,
      objectCaching: false,
    });
  }
  if (waterJetObject) {
    waterJetObject.set({ selectable: true, evented: true });
  }
  if (nozzleObject) {
    nozzleObject.set({ selectable: true, evented: true });
  }
  if (coneLengthText) {
    coneLengthText.set({ selectable: true, evented: true });
    coneLengthText = null;
  }
  setMode("select");
  saveHistory();
}

/** Inicia un tramo nuevo y muestra su longitud restante junto al puntero. */
function startAttackLineSegment(point) {
  if (isDrawingHose) return;
  isDrawingHose = true;
  segmentFinished = false;
  updateToolHelp();
  accumulatedLengthPx = 0;
  attackPoints = [{ x: point.x, y: point.y }];

  const hoseWidth = pixelsPerMeter ? 0.5 * pixelsPerMeter : 4;
  attackPolyline = new fabric.Polyline(attackPoints, {
    stroke: "#ef4444",
    strokeWidth: hoseWidth,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    fill: "transparent",
    selectable: false,
    evented: false,
    objectCaching: false,
  });
  canvas.add(attackPolyline);

  const zoom = canvas.getZoom();
  remainingLengthText = new fabric.Text(
    "Quedan " + attackLineLengthMeters.toFixed(1) + "m",
    {
      left: point.x + 15 / zoom,
      top: point.y - 30 / zoom,
      fontSize: 14,
      scaleX: 1 / zoom,
      scaleY: 1 / zoom,
      fill: "#ef4444",
      fontFamily: "Inter",
      fontWeight: "bold",
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      selectable: false,
      evented: false,
    },
  );
  canvas.add(remainingLengthText);
}

/** Actualiza la etapa activa de la línea de ataque durante el movimiento. */
function updateAttackLine(point) {
  if (placingNozzle && nozzleObject) {
    updateNozzleAim(point);
    return;
  }
  if (placingConeLength && waterConeObject) {
    updateWaterConeLength(point);
    return;
  }
  if (placingConeWidth && waterConeObject) {
    updateWaterConeWidth(point);
    return;
  }
  updateAttackLineSegment(point);
}

/** Gira la lanza hacia el puntero y actualiza su línea de orientación. */
function updateNozzleAim(point) {
  const dx = point.x - nozzleObject.left;
  const dy = point.y - nozzleObject.top;
  let angle = Math.atan2(dy, dx) * (180 / Math.PI);
  angle += 90;
  nozzleObject.set("angle", angle);

  if (aimingLine) {
    const nozzleAngleRad = (nozzleObject.angle - 90) * (Math.PI / 180);
    const nozzleHeight = nozzleObject.height * nozzleObject.scaleY;
    const tipX = nozzleObject.left + Math.cos(nozzleAngleRad) * (nozzleHeight / 2);
    const tipY = nozzleObject.top + Math.sin(nozzleAngleRad) * (nozzleHeight / 2);
    aimingLine.set({ x1: tipX, y1: tipY, x2: point.x, y2: point.y });
  }

  canvas.renderAll();
}

/** Ajusta el alcance del chorro sobre el eje de la lanza. */
function updateWaterConeLength(point) {
  const dx = point.x - coneTipX;
  const dy = point.y - coneTipY;
  const dirX = Math.cos(coneBaseAngleRad);
  const dirY = Math.sin(coneBaseAngleRad);
  const length = Math.max(dx * dirX + dy * dirY, 10);

  waterConeObject.set({ height: length });
  if (waterJetObject) waterJetObject.set({ height: length });

  if (coneLengthText) {
    const lengthMeters = (length / pixelsPerMeter).toFixed(1);
    coneLengthText.set({
      text: lengthMeters + "m",
      left: coneTipX + dirX * length + 15,
      top: coneTipY + dirY * length + 15,
    });
  }

  canvas.renderAll();
}

/** Ajusta el ancho y cambia a chorro pleno cuando queda por debajo del umbral. */
function updateWaterConeWidth(point) {
  const dx = point.x - coneTipX;
  const dy = point.y - coneTipY;
  const dirX = Math.cos(coneBaseAngleRad);
  const dirY = Math.sin(coneBaseAngleRad);
  const halfWidth = Math.abs(dy * dirX - dx * dirY);
  const fullJetThreshold = pixelsPerMeter * 0.1;
  const fullJetWidth = Math.max(halfWidth * 2, pixelsPerMeter * 0.02, 1);

  waterConeObject.set({
    width: Math.max(halfWidth * 2, 1),
    visible: halfWidth > fullJetThreshold,
  });
  if (waterJetObject) {
    waterJetObject.set({
      width: fullJetWidth,
      visible: halfWidth <= fullJetThreshold,
    });
  }
  canvas.renderAll();
}

/** Extiende el tramo a mano alzada hasta su longitud máxima configurada. */
function updateAttackLineSegment(point) {
  if (!isDrawingHose || !attackPolyline || segmentFinished) return;

  const maxPx = attackLineLengthMeters * pixelsPerMeter;
  const lastPoint = attackPoints[attackPoints.length - 1];
  const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
  if (distance === 0) return;

  if (accumulatedLengthPx + distance >= maxPx) {
    finishAttackLineSegment(point, lastPoint, maxPx, distance);
    return;
  }

  attackPoints.push({ x: point.x, y: point.y });
  accumulatedLengthPx += distance;

  if (remainingLengthText) {
    const remainingMeters = (
      (maxPx - accumulatedLengthPx) /
      pixelsPerMeter
    ).toFixed(1);
    const zoom = canvas.getZoom();
    remainingLengthText.set({
      text: "Quedan " + remainingMeters + "m",
      left: point.x + 15 / zoom,
      top: point.y - 30 / zoom,
      scaleX: 1 / zoom,
      scaleY: 1 / zoom,
    });
  }

  attackPolyline.set({ points: attackPoints });
  canvas.renderAll();
}

/** Cierra el tramo exactamente en su límite y abre las opciones siguientes. */
function finishAttackLineSegment(point, lastPoint, maxPx, distance) {
  const remaining = maxPx - accumulatedLengthPx;
  const ratio = remaining / distance;
  const finalX = lastPoint.x + (point.x - lastPoint.x) * ratio;
  const finalY = lastPoint.y + (point.y - lastPoint.y) * ratio;

  attackPoints.push({ x: finalX, y: finalY });
  accumulatedLengthPx = maxPx;
  segmentFinished = true;
  isDrawingHose = false;
  updateToolHelp();
  lastUnionX = finalX;
  lastUnionY = finalY;

  const unionWidth = pixelsPerMeter ? pixelsPerMeter : 14;
  const unionHeight = pixelsPerMeter ? 0.5 * pixelsPerMeter : 14;
  const segmentAngle =
    Math.atan2(finalY - lastPoint.y, finalX - lastPoint.x) * (180 / Math.PI);
  const union = new fabric.Rect({
    left: finalX,
    top: finalY,
    width: unionWidth,
    height: unionHeight,
    fill: "#facc15",
    stroke: "#ca8a04",
    strokeWidth: 2,
    originX: "center",
    originY: "center",
    angle: segmentAngle,
    selectable: false,
    evented: false,
  });
  canvas.add(union);
  lastUnionObject = union;

  if (remainingLengthText) {
    canvas.remove(remainingLengthText);
    remainingLengthText = null;
  }

  const strokeWidth = attackPolyline.strokeWidth;
  canvas.remove(attackPolyline);
  const finalPolyline = new fabric.Polyline(attackPoints, {
    stroke: "#ef4444",
    strokeWidth,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    fill: "transparent",
    selectable: true,
    evented: true,
    objectCaching: false,
  });
  canvas.add(finalPolyline);
  canvas.bringToFront(lastUnionObject);
  attackPolyline = null;
  canvas.renderAll();
  openAttackActionModal();
}

/** Activa la colocación de la lanza al final del tramo actual. */
function startNozzlePlacement() {
  placingNozzle = true;
  segmentFinished = false;
  updateToolHelp();

  if (lastUnionObject) {
    canvas.remove(lastUnionObject);
    lastUnionObject = null;
  }

  const nozzleWidth = pixelsPerMeter ? pixelsPerMeter : 18;
  const nozzleHeight = pixelsPerMeter ? pixelsPerMeter : 24;
  nozzleObject = new fabric.Triangle({
    left: lastUnionX,
    top: lastUnionY,
    width: nozzleWidth,
    height: nozzleHeight,
    fill: "#facc15",
    stroke: "#ca8a04",
    strokeWidth: 2,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    angle: 0,
  });
  canvas.add(nozzleObject);

  aimingLine = new fabric.Line([lastUnionX, lastUnionY, lastUnionX, lastUnionY], {
    stroke: "#60a5fa",
    strokeWidth: 2,
    strokeDashArray: [6, 6],
    selectable: false,
    evented: false,
  });
  canvas.add(aimingLine);
}

/** Permite iniciar otro tramo después de elegir «Alargar». */
function extendAttackLine() {
  segmentFinished = false;
  lastUnionObject = null;
  updateToolHelp();
}

/** Cancela la etapa activa de línea de ataque y elimina sus vistas temporales. */
function cancelAttackLine() {
  if (isDrawingHose) {
    isDrawingHose = false;
    if (attackPolyline) canvas.remove(attackPolyline);
    if (remainingLengthText) canvas.remove(remainingLengthText);
    attackPolyline = null;
    remainingLengthText = null;
  } else if (placingNozzle) {
    placingNozzle = false;
    if (aimingLine) canvas.remove(aimingLine);
    if (nozzleObject) canvas.remove(nozzleObject);
    aimingLine = null;
    nozzleObject = null;
  } else if (placingConeLength || placingConeWidth) {
    placingConeLength = false;
    placingConeWidth = false;
    if (waterConeObject) canvas.remove(waterConeObject);
    if (waterJetObject) canvas.remove(waterJetObject);
    if (coneLengthText) canvas.remove(coneLengthText);
    waterConeObject = null;
    waterJetObject = null;
    coneLengthText = null;
  }

  setMode("select");
}
