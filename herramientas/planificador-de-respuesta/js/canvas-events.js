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
    (currentMode === "measure_distance" || currentMode === "measure_radius") &&
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
    document.getElementById("btn-measure-distance").classList.add("active");
  if (mode === "measure_radius")
    document.getElementById("btn-measure-radius").classList.add("active");
  if (mode === "zoning_color" || mode === "zoning")
    document.getElementById("btn-zoning").classList.add("active");
  if (mode === "wind_arrow")
    document.getElementById("btn-wind-arrow").classList.add("active");
  if (mode === "propagation_arrow")
    document.getElementById("btn-propagation-arrow").classList.add("active");
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
    document.getElementById("zoning-colors").classList.remove("hidden");
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
document.getElementById("btn-wind-arrow").onclick = () => setMode("wind_arrow");
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
// Enruta los eventos del puntero a las herramientas y gestiona el paneo general.
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

  if (currentMode === "measure_distance" || currentMode === "measure_radius") {
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
    handleAttackLineMouseDown(pointer);
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
      updateDirectionalArrowPreview(directionalArrowEnd, directionalArrowWidth);
    }
    return;
  }

  if (currentMode === "measure_distance" || currentMode === "measure_radius") {
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
    updateAttackLine(pointer);
    return;
  }

  if (drawingLine && currentMode === "scale" && scaleStartPlaced) {
    drawingLine.set({ x2: pointer.x, y2: pointer.y });
    canvas.renderAll();
    return;
  }

  if (!isDrawing) return;
});

// Finaliza el paneo o el trazo de escala cuando se suelta el botón del ratón.
canvas.on("mouse:up", function (opt) {
  if (isDragging) {
    canvas.setViewportTransform(canvas.viewportTransform);
    isDragging = false;

    if (currentMode === "select") {
      canvas.selection = true;
      canvas.defaultCursor = "default";
    } else {
      canvas.defaultCursor = "crosshair";
    }
    return;
  }

  if (currentMode === "attack_line") return;

  if (currentMode === "scale") {
    if (!isDrawing) return;
    isDrawing = false;

    if (!scaleSecondPointStarted) return;
    scaleSecondPointStarted = false;
    if (!drawingLine) return;

    const pointer = canvas.getPointer(opt.e);
    const lengthPx = Math.hypot(pointer.x - startX, pointer.y - startY);

    if (lengthPx > 5) {
      openScaleModal(lengthPx, drawingLine);
    } else {
      canvas.remove(drawingLine);
      drawingLine = null;
      scaleStartPlaced = false;
      setMode("select");
    }
    drawingLine = null;
    return;
  }

  if (!isDrawing) return;
  isDrawing = false;

  if (!drawingLine) return;

  const pointer = canvas.getPointer(opt.e);
  const lengthPx = Math.hypot(pointer.x - startX, pointer.y - startY);
  drawingLine = null;
});
