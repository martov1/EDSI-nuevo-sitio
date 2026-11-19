/**
 * Misión: coordinar los modos de herramienta con la interfaz y los eventos del lienzo.
 * Aquí se enlazan los botones y se traducen los clics y movimientos del puntero
 * en trazos, mediciones, flechas, acciones de línea de ataque y desplazamiento.
 * Función principal: setMode configura el modo, cursor, selección y vistas previas;
 * los manejadores del lienzo ejecutan las acciones asociadas a cada modo.
 */

/**
 * Cambia de herramienta, cancela sus vistas previas y configura la interacción.
 * @param {string} mode Identificador del nuevo modo del planificador.
 */
function setMode(mode) {
  // Limpiar fantasma de sello si se cambia de modo sin aplicarlo
  if (currentMode === "stamp" && stampGhost) {
    canvas.remove(stampGhost);
    stampGhost = null;
  }

  if (
    (currentMode === "measure_distance" ||
      currentMode === "measure_radius") &&
    mode !== currentMode
  ) {
    clearMeasurementPreview();
  }

  if (currentMode === "zoning" && mode !== currentMode) {
    clearZoningDraft();
  }

  if (currentMode === "zoning_color" && mode !== currentMode) {
    document.getElementById("zoning-colors").classList.add("hidden");
  }

  if (isDirectionalArrowMode() && mode !== currentMode) {
    clearDirectionalArrowPreview();
  }

  if (currentMode === "scale" && mode !== "scale") {
    if (drawingLine) canvas.remove(drawingLine);
    drawingLine = null;
    isDrawing = false;
    scaleStartPlaced = false;
    scaleSecondPointStarted = false;
  }

  currentMode = mode;
  canvas.skipTargetFind = mode === "attack_line";
  updateToolHelp();

  // Actualizar UI de botones
  document
    .querySelectorAll(".tool-btn")
    .forEach((btn) => btn.classList.remove("active"));
  if (mode === "select")
    document.getElementById("btn-select").classList.add("active");
  if (mode === "measure_distance")
    document
      .getElementById("btn-measure-distance")
      .classList.add("active");
  if (mode === "measure_radius")
    document.getElementById("btn-measure-radius").classList.add("active");
  if (mode === "zoning_color" || mode === "zoning")
    document.getElementById("btn-zoning").classList.add("active");
  if (mode === "wind_arrow")
    document.getElementById("btn-wind-arrow").classList.add("active");
  if (mode === "propagation_arrow")
    document
      .getElementById("btn-propagation-arrow")
      .classList.add("active");
  if (mode === "scale")
    document.getElementById("btn-scale").classList.add("active");
  if (mode === "attack_line")
    document.getElementById("btn-attack").classList.add("active");

  // Configurar comportamiento del canvas
  if (mode === "select") {
    canvas.selection = true;
    canvas.forEachObject((obj) => (obj.selectable = true));
    canvas.defaultCursor = "default";
  } else if (mode === "stamp") {
    canvas.selection = false;
    canvas.forEachObject((obj) => (obj.selectable = false));
    canvas.defaultCursor = "none"; // Ocultar cursor nativo porque usamos el fantasma
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  } else {
    canvas.selection = false;
    canvas.forEachObject((obj) => (obj.selectable = false));
    canvas.defaultCursor = "crosshair";
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }
}

// Los botones de herramienta activan modos y comprueban requisitos como la escala.
document.getElementById("btn-select").onclick = () => setMode("select");
document.getElementById("btn-scale").onclick = () => setMode("scale");
document.getElementById("btn-measure-distance").onclick = () => {
  if (!pixelsPerMeter) {
    openAlertModal("Debe fijar la escala primero para medir distancias.");
    return;
  }
  setMode("measure_distance");
};
document.getElementById("btn-measure-radius").onclick = () => {
  if (!pixelsPerMeter) {
    openAlertModal("Debe fijar la escala primero para medir radios.");
    return;
  }
  setMode("measure_radius");
};
document.getElementById("btn-zoning").onclick = () => {
  if (currentMode === "zoning_color") {
    setMode("select");
  } else {
    setMode("zoning_color");
    document
      .getElementById("zoning-colors")
      .classList.remove("hidden");
  }
};
document.getElementById("btn-zone-hot").onclick = () => {
  selectedZoningType = zoningTypes.hot;
  setMode("zoning");
};
document.getElementById("btn-zone-temperate").onclick = () => {
  selectedZoningType = zoningTypes.temperate;
  setMode("zoning");
};
document.getElementById("btn-zone-cold").onclick = () => {
  selectedZoningType = zoningTypes.cold;
  setMode("zoning");
};
document.getElementById("btn-wind-arrow").onclick = () =>
  setMode("wind_arrow");
document.getElementById("btn-propagation-arrow").onclick = () =>
  setMode("propagation_arrow");
document.getElementById("btn-attack").onclick = () => {
  if (!pixelsPerMeter) {
    openAlertModal(
      "Debe fijar la escala primero para trazar líneas de ataque.",
    );
    return;
  }
  openAttackSetupModal();
};
updateToolHelp();

// --- DIBUJO EN CANVAS ---
// Centraliza el inicio de paneo, dibujo, medición, flechas y colocación de objetos.
canvas.on("mouse:down", function (opt) {
  var evt = opt.e;
  // El botón central o Alt + arrastrar desplazan la vista en cualquier herramienta.
  if (evt.button === 1 || evt.altKey === true) {
    isDragging = true;
    canvas.selection = false;
    lastPosX = evt.clientX;
    lastPosY = evt.clientY;
    canvas.defaultCursor = "grabbing";
    evt.preventDefault();
    return;
  }

  const pointer = canvas.getPointer(opt.e);

  if (currentMode === "zoning_color") return;
  if (currentMode === "zoning") {
    if (evt.button === 0 && zoningPoints.length === 0) {
      zoningPoints = [pointer];
      zoningPathLength = 0;
      updateToolHelp();
    }
    return;
  }

  if (isDirectionalArrowMode()) {
    if (evt.button === 0) handleDirectionalArrowClick(pointer);
    return;
  }

  if (
    currentMode === "measure_distance" ||
    currentMode === "measure_radius"
  ) {
    if (evt.button !== 0) return;

    if (currentMode === "measure_distance") {
      if (!measurementStart) {
        startDistanceMeasurement(pointer);
      } else {
        updateDistanceMeasurement(pointer);
        finishMeasurement();
      }
    } else if (!measurementStart) {
      startRadiusMeasurement(pointer);
    } else {
      updateRadiusMeasurement(pointer);
      finishMeasurement();
    }
    canvas.requestRenderAll();
    return;
  }

  if (currentMode === "scale" && scaleStartPlaced) {
    isDrawing = true;
    scaleSecondPointStarted = true;
    drawingLine.set({ x2: pointer.x, y2: pointer.y });
    canvas.renderAll();
    return;
  }

  if (currentMode === "stamp") {
    if (stampGhost) {
      stampGhost.clone((cloned) => {
        cloned.set({
          left: stampGhost.left,
          top: stampGhost.top,
          opacity: 1, // Restaurar opacidad al colocarlo
          selectable: true,
          evented: true,
          objectCaching: true, // Restaurar caché normal para el objeto final
        });
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        setMode("select"); // Volver al modo selección normal
        saveHistory(); // Guardar acción
      });
    }
    return;
  }

  if (currentMode === "select") return;

  if (currentMode === "attack_line") {
    if (placingNozzle) {
      // 2do Clic: Fijar la posición/rotación de la lanza y pasar a modo cono de agua (longitud)
      placingNozzle = false;

      if (aimingLine) {
        canvas.remove(aimingLine);
        aimingLine = null;
      }

      // Bloquear lanza momentaneamente
      if (nozzleObject) {
        nozzleObject.set({ selectable: false, evented: false });
      }

      // Calcular el punto exacto de la punta de la lanza
      const nozzleAngleRad = (nozzleObject.angle - 90) * (Math.PI / 180);
      const nozzleHeight = nozzleObject.height * nozzleObject.scaleY;
      coneTipX =
        nozzleObject.left + Math.cos(nozzleAngleRad) * (nozzleHeight / 2);
      coneTipY =
        nozzleObject.top + Math.sin(nozzleAngleRad) * (nozzleHeight / 2);
      coneBaseAngleRad = nozzleAngleRad; // Dirección en la que dispara el agua

      placingConeLength = true;
      updateToolHelp();

      waterConeObject = new fabric.Triangle({
        left: coneTipX,
        top: coneTipY,
        width: pixelsPerMeter ? pixelsPerMeter : 20, // Ancho inicial
        height: pixelsPerMeter ? pixelsPerMeter * 2 : 40, // Largo inicial
        angle: nozzleObject.angle + 180, // Girado 180 para que la base ancha expanda hacia adelante
        originX: "center",
        originY: "top", // Para que la punta quede clavada en la lanza
        stroke: "rgba(2, 132, 199, 0.8)", // Bordes más opacos (celeste oscuro)
        strokeWidth: 2,
        selectable: false,
        evented: false,
        objectCaching: false, // Desactivar caché temporalmente para redibujo fluido
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
      // Asegurar que la lanza quede por encima del agua
      canvas.bringToFront(nozzleObject);

      coneLengthText = new fabric.Text("0m", {
        left: coneTipX,
        top: coneTipY,
        fontSize: 16,
        fill: "#0284c7", // sky-600
        fontFamily: "Inter",
        fontWeight: "bold",
        backgroundColor: "rgba(255, 255, 255, 0.7)",
        selectable: false,
        evented: false,
      });
      canvas.add(coneLengthText);

      return;
    }

    if (placingConeLength) {
      // 3er Clic: Fijar longitud, pasar a amplitud (ancho)
      placingConeLength = false;
      placingConeWidth = true;
      updateToolHelp();
      return;
    }

    if (placingConeWidth) {
      // 4to Clic: Fijar amplitud, terminar todo
      placingConeWidth = false;
      if (waterConeObject) {
        waterConeObject.set({
          selectable: true,
          evented: true,
          objectCaching: false, // CRÍTICO: Mantener en false para que no desaparezca al hacer zoom out
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
        coneLengthText = null; // Desvincularlo para futuros tramos
      }
      setMode("select");
      saveHistory(); // Guardar acción de manguera finalizada
      return;
    }

    // Iniciar un nuevo tramo de línea a mano alzada
    if (isDrawingHose) return; // Si ya está dibujando, ignoramos clics adicionales
    isDrawingHose = true;
    segmentFinished = false;
    updateToolHelp();
    accumulatedLengthPx = 0;
    attackPoints = [{ x: pointer.x, y: pointer.y }];

    const hoseWidth = pixelsPerMeter ? 0.5 * pixelsPerMeter : 4;

    attackPolyline = new fabric.Polyline(attackPoints, {
      stroke: "#ef4444", // Rojo
      strokeWidth: hoseWidth,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      fill: "transparent",
      selectable: false,
      evented: false,
      objectCaching: false,
    });
    canvas.add(attackPolyline);

    let zoom = canvas.getZoom();
    remainingLengthText = new fabric.Text(
      "Quedan " + attackLineLengthMeters.toFixed(1) + "m",
      {
        left: pointer.x + 15 / zoom,
        top: pointer.y - 30 / zoom,
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

    return;
  }

  isDrawing = true;
  startX = pointer.x;
  startY = pointer.y;

  const strokeColor = currentMode === "scale" ? "#3b82f6" : "#ef4444"; // Azul o Rojo
  const strokeDashArray = currentMode === "scale" ? [5, 5] : null; // Punteada para escala

  drawingLine = new fabric.Line([startX, startY, startX, startY], {
    strokeWidth: 4,
    fill: strokeColor,
    stroke: strokeColor,
    strokeDashArray: strokeDashArray,
    selectable: false,
    evented: false,
  });
  canvas.add(drawingLine);

  if (currentMode === "scale") {
    scaleStartPlaced = true;
    updateToolHelp();
  }
});

// Actualiza vistas previas y trazos mientras el puntero se mueve por el plano.
canvas.on("mouse:move", function (opt) {
  var evt = opt.e;
  // Lógica de paneo
  if (isDragging) {
    var vpt = canvas.viewportTransform;
    vpt[4] += evt.clientX - lastPosX;
    vpt[5] += evt.clientY - lastPosY;
    canvas.requestRenderAll();
    lastPosX = evt.clientX;
    lastPosY = evt.clientY;
    return;
  }

  const pointer = canvas.getPointer(opt.e);

  if (currentMode === "zoning") {
    updateZoningDrawing(pointer);
    return;
  }
  if (currentMode === "zoning_color") return;

  if (isDirectionalArrowMode()) {
    if (directionalArrowPhase === "direction") {
      const length = directionalArrowStart
        ? Math.hypot(
            pointer.x - directionalArrowStart.x,
            pointer.y - directionalArrowStart.y,
          )
        : 0;
      if (length > 1) {
        updateDirectionalArrowPreview(
          pointer,
          Math.max(16, Math.min(length * 0.18, 48)),
        );
      }
    } else if (directionalArrowPhase === "width") {
      directionalArrowWidth = directionalArrowWidthAt(pointer);
      updateDirectionalArrowPreview(
        directionalArrowEnd,
        directionalArrowWidth,
      );
    }
    return;
  }

  if (
    currentMode === "measure_distance" ||
    currentMode === "measure_radius"
  ) {
    if (currentMode === "measure_distance") {
      updateDistanceMeasurement(pointer);
    } else {
      updateRadiusMeasurement(pointer);
    }
    canvas.requestRenderAll();
    return;
  }

  // Mover el fantasma del sello con el ratón
  if (currentMode === "stamp" && stampGhost) {
    if (!stampGhost.visible) {
      stampGhost.set({ visible: true });
    }
    stampGhost.set({ left: pointer.x, top: pointer.y });
    stampGhost.setCoords(); // CRÍTICO: Actualizar la caja de renderizado
    canvas.renderAll();
    return;
  }

  if (currentMode === "attack_line") {
    if (placingNozzle && nozzleObject) {
      // Rotar la lanza para que apunte hacia el cursor
      const dx = pointer.x - nozzleObject.left;
      const dy = pointer.y - nozzleObject.top;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      angle += 90; // Ajustar rotación base del triángulo
      nozzleObject.set("angle", angle);

      // Dibujar la línea punteada de guía desde la punta de la lanza
      if (aimingLine) {
        const nozzleAngleRad =
          (nozzleObject.angle - 90) * (Math.PI / 180);
        const nozzleHeight = nozzleObject.height * nozzleObject.scaleY;
        const tipX =
          nozzleObject.left +
          Math.cos(nozzleAngleRad) * (nozzleHeight / 2);
        const tipY =
          nozzleObject.top +
          Math.sin(nozzleAngleRad) * (nozzleHeight / 2);
        aimingLine.set({
          x1: tipX,
          y1: tipY,
          x2: pointer.x,
          y2: pointer.y,
        });
      }

      canvas.renderAll();
      return;
    }

    if (placingConeLength && waterConeObject) {
      const dx = pointer.x - coneTipX;
      const dy = pointer.y - coneTipY;
      const dirX = Math.cos(coneBaseAngleRad);
      const dirY = Math.sin(coneBaseAngleRad);

      // Producto punto para proyectar la distancia en la dirección de la lanza
      let length = dx * dirX + dy * dirY;
      if (length < 10) length = 10; // Evitar tamaños negativos/invisibles

      waterConeObject.set({ height: length });
      if (waterJetObject) waterJetObject.set({ height: length });

      if (coneLengthText) {
        let lengthMeters = (length / pixelsPerMeter).toFixed(1);
        coneLengthText.set({
          text: lengthMeters + "m",
          left: coneTipX + dirX * length + 15,
          top: coneTipY + dirY * length + 15,
        });
      }

      canvas.renderAll();
      return;
    }

    if (placingConeWidth && waterConeObject) {
      const dx = pointer.x - coneTipX;
      const dy = pointer.y - coneTipY;
      const dirX = Math.cos(coneBaseAngleRad);
      const dirY = Math.sin(coneBaseAngleRad);

      // Distancia de un punto a una línea (la recta central del chorro)
      const halfWidth = Math.abs(dy * dirX - dx * dirY);
      const fullJetThreshold = pixelsPerMeter * 0.1;
      const fullJetWidth = Math.max(
        halfWidth * 2,
        pixelsPerMeter * 0.02,
        1,
      );

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
      return;
    }
  }

  // --- Lógica continua para la línea de ataque ---
  if (
    currentMode === "attack_line" &&
    isDrawingHose &&
    attackPolyline &&
    !segmentFinished
  ) {
    const maxPx = attackLineLengthMeters * pixelsPerMeter;
    const lastPoint = attackPoints[attackPoints.length - 1];
    const dist = Math.hypot(
      pointer.x - lastPoint.x,
      pointer.y - lastPoint.y,
    );

    if (dist === 0) return;

    if (accumulatedLengthPx + dist >= maxPx) {
      // Ha alcanzado exactamente el límite del tramo, interpolar punto final
      const remaining = maxPx - accumulatedLengthPx;
      const ratio = remaining / dist;
      const finalX = lastPoint.x + (pointer.x - lastPoint.x) * ratio;
      const finalY = lastPoint.y + (pointer.y - lastPoint.y) * ratio;

      attackPoints.push({ x: finalX, y: finalY });
      accumulatedLengthPx = maxPx;
      segmentFinished = true; // Frenar dibujo
      isDrawingHose = false; // Finalizar modo de dibujo continuo
      updateToolHelp();
      lastUnionX = finalX;
      lastUnionY = finalY;

      const unionWidth = pixelsPerMeter ? 1 * pixelsPerMeter : 14;
      const unionHeight = pixelsPerMeter ? 0.5 * pixelsPerMeter : 14;
      const segmentAngle =
        Math.atan2(finalY - lastPoint.y, finalX - lastPoint.x) *
        (180 / Math.PI);

      // Dibujar la Unión (rectángulo amarillo)
      const union = new fabric.Rect({
        left: finalX,
        top: finalY,
        width: unionWidth,
        height: unionHeight,
        fill: "#facc15", // yellow-400
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

      // Limpiar el texto indicador ya que se acabó el tramo
      if (remainingLengthText) {
        canvas.remove(remainingLengthText);
        remainingLengthText = null;
      }

      // Recrear la polyline final para que Fabric calcule correctamente su bounding box y origen.
      // Esto evita que se desplace al guardar y cargar el proyecto.
      canvas.remove(attackPolyline);
      const finalPolyline = new fabric.Polyline(attackPoints, {
        stroke: "#ef4444",
        strokeWidth: attackPolyline.strokeWidth,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        fill: "transparent",
        selectable: true,
        evented: true,
        objectCaching: false, // CRÍTICO: Evita que la línea desaparezca al hacer zoom out
      });
      canvas.add(finalPolyline);

      // Asegurarse de que la unión quede por encima de la manguera
      if (lastUnionObject) {
        canvas.bringToFront(lastUnionObject);
      }

      attackPolyline = null;

      canvas.renderAll();

      // Disparar ventana de acción automáticamente
      openAttackActionModal();
      return;
    } else {
      attackPoints.push({ x: pointer.x, y: pointer.y });
      accumulatedLengthPx += dist;

      if (remainingLengthText) {
        const maxPx = attackLineLengthMeters * pixelsPerMeter;
        let remMeters = (
          (maxPx - accumulatedLengthPx) /
          pixelsPerMeter
        ).toFixed(1);
        let zoom = canvas.getZoom();
        remainingLengthText.set({
          text: "Quedan " + remMeters + "m",
          left: pointer.x + 15 / zoom,
          top: pointer.y - 30 / zoom,
          scaleX: 1 / zoom,
          scaleY: 1 / zoom,
        });
      }
    }

    attackPolyline.set({ points: attackPoints });
    canvas.renderAll();
    return;
  }

  if (drawingLine && currentMode === "scale" && scaleStartPlaced) {
    drawingLine.set({ x2: pointer.x, y2: pointer.y });
    canvas.renderAll();
    return;
  }

  if (!isDrawing) return;
});

