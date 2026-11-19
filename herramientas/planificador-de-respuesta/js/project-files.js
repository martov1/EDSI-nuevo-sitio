/**
 * Misión: exportar el plano y guardar/restaurar proyectos.
 * Incluye exportación a imagen y PDF, serialización JSON y una lista de
 * proyectos recientes almacenada localmente en el navegador.
 * Funciones principales: getHighResExportParams, getProjectData y loadProjectData;
 * los controladores de interfaz gestionan las descargas y el guardado local.
 */

// --- SISTEMA DE ARCHIVOS Y EXPORTACIÓN ---

/**
 * Calcula los límites del contenido y la resolución apropiada para exportarlo.
 * @returns {{left:number, top:number, width:number, height:number, multiplier:number}}
 *          Región del lienzo y multiplicador de resolución.
 */
function getHighResExportParams() {
  const objects = canvas.getObjects();
  const bg = canvas.backgroundImage;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  // Incluir límites de la imagen de fondo
  if (bg) {
    const bgRect = bg.getBoundingRect(true);
    minX = Math.min(minX, bgRect.left);
    minY = Math.min(minY, bgRect.top);
    maxX = Math.max(maxX, bgRect.left + bgRect.width);
    maxY = Math.max(maxY, bgRect.top + bgRect.height);
  }

  // Incluir límites de todos los elementos dibujados
  objects.forEach((obj) => {
    if (obj.visible !== false) {
      const rect = obj.getBoundingRect(true);
      minX = Math.min(minX, rect.left);
      minY = Math.min(minY, rect.top);
      maxX = Math.max(maxX, rect.left + rect.width);
      maxY = Math.max(maxY, rect.top + rect.height);
    }
  });

  // Si el lienzo está completamente vacío, usar las dimensiones del canvas
  if (minX === Infinity) {
    minX = 0;
    minY = 0;
    maxX = canvas.width;
    maxY = canvas.height;
  }

  // Añadir un pequeño margen de seguridad (15px)
  const padding = 15;
  const left = minX - padding;
  const top = minY - padding;
  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;

  // Calcular el multiplicador para sostener 300 DPI reales sin alterar el aspect ratio:
  // Si hay un plano de fondo escalado hacia abajo para caber en pantalla, recuperamos su resolución nativa (1 / scaleX)
  let nativeMultiplier = 1;
  if (bg && bg.scaleX) {
    nativeMultiplier = 1 / bg.scaleX;
  }

  // Aseguramos un piso mínimo de 300 DPI (aprox 3500px en el lado mayor) o la resolución nativa si es aún mayor
  const currentLongEdge = Math.max(width, height);
  const min300DpiMultiplier = 3508 / currentLongEdge;

  let multiplier = Math.max(nativeMultiplier, min300DpiMultiplier, 3);
  // Tope de seguridad (8x) para evitar colapsos de memoria en el navegador
  multiplier = Math.min(multiplier, 8);

  return { left, top, width, height, multiplier };
}

// Exporta el contenido visible como PNG, normalizando temporalmente el fondo y la vista.
document.getElementById("btn-export-img").onclick = () => {
  canvas.discardActiveObject();
  const originalVPT = canvas.viewportTransform.slice();
  const originalBgOpacity = canvas.backgroundImage
    ? canvas.backgroundImage.opacity
    : 1;
  const originalBgColor = canvas.backgroundColor;

  // Preparar lienzo con blanco sólido y plano al 100% de opacidad para evitar tonos grises
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.setBackgroundColor("#ffffff", () => {});
  if (canvas.backgroundImage) canvas.backgroundImage.set("opacity", 1);
  canvas.renderAll();

  try {
    const params = getHighResExportParams();
    const dataURL = canvas.toDataURL({
      format: "png",
      left: params.left,
      top: params.top,
      width: params.width,
      height: params.height,
      multiplier: params.multiplier,
    });

    const link = document.createElement("a");
    link.download = "Planificador_EDSI_300DPI.png";
    link.href = dataURL;
    link.click();
  } catch (err) {
    console.error(err);
    openAlertModal(
      "Error al exportar. El plano base es demasiado pesado para la memoria del navegador.",
    );
  }

  // Restaurar vista y opacidad de edición
  canvas.setBackgroundColor(originalBgColor, () => {});
  if (canvas.backgroundImage)
    canvas.backgroundImage.set("opacity", originalBgOpacity);
  canvas.setViewportTransform(originalVPT);
  canvas.renderAll();
};

// Convierte el plano a PDF con sus proporciones y tamaño físico calculado.
document.getElementById("btn-export-pdf").onclick = () => {
  canvas.discardActiveObject();
  const originalVPT = canvas.viewportTransform.slice();
  const originalBgOpacity = canvas.backgroundImage
    ? canvas.backgroundImage.opacity
    : 1;
  const originalBgColor = canvas.backgroundColor;

  // Preparar lienzo con blanco sólido y plano al 100% de opacidad
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.setBackgroundColor("#ffffff", () => {});
  if (canvas.backgroundImage) canvas.backgroundImage.set("opacity", 1);
  canvas.renderAll();

  try {
    const params = getHighResExportParams();
    const dataURL = canvas.toDataURL({
      format: "png",
      left: params.left,
      top: params.top,
      width: params.width,
      height: params.height,
      multiplier: params.multiplier,
    });

    // Calcular dimensiones físicas exactas en milímetros a 300 DPI (1 pulgada = 25.4 mm)
    const finalPxWidth = params.width * params.multiplier;
    const finalPxHeight = params.height * params.multiplier;
    const pdfWidthMm = (finalPxWidth / 300) * 25.4;
    const pdfHeightMm = (finalPxHeight / 300) * 25.4;

    const { jsPDF } = window.jspdf;
    const orientation =
      pdfWidthMm > pdfHeightMm ? "landscape" : "portrait";

    // Crear el PDF con el tamaño y aspect ratio exacto del plano, sin forzar A4
    const pdf = new jsPDF({
      orientation: orientation,
      unit: "mm",
      format: [pdfWidthMm, pdfHeightMm],
    });

    // Colocar la imagen cubriendo el 100% del documento sin recortes ni márgenes extra
    pdf.addImage(
      dataURL,
      "PNG",
      0,
      0,
      pdfWidthMm,
      pdfHeightMm,
      undefined,
      "FAST",
    );
    pdf.save("Planificador_EDSI_300DPI.pdf");
  } catch (err) {
    console.error(err);
    openAlertModal(
      "Error al exportar PDF. El plano base podría exceder la memoria.",
    );
  }

  // Restaurar vista y opacidad de edición
  canvas.setBackgroundColor(originalBgColor, () => {});
  if (canvas.backgroundImage)
    canvas.backgroundImage.set("opacity", originalBgOpacity);
  canvas.setViewportTransform(originalVPT);
  canvas.renderAll();
};

// Esta asignación posterior reemplaza el controlador PDF definido más arriba.
document.getElementById("btn-export-pdf").onclick = () => {
  canvas.discardActiveObject();
  const originalVPT = canvas.viewportTransform.slice();
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.renderAll();

  try {
    const params = getHighResExportParams();
    const dataURL = canvas.toDataURL({
      format: "png",
      left: params.left,
      top: params.top,
      width: params.width,
      height: params.height,
      multiplier: params.multiplier,
    });

    // Calcular dimensiones físicas exactas en milímetros a 300 DPI (1 pulgada = 25.4 mm)
    const finalPxWidth = params.width * params.multiplier;
    const finalPxHeight = params.height * params.multiplier;
    const pdfWidthMm = (finalPxWidth / 300) * 25.4;
    const pdfHeightMm = (finalPxHeight / 300) * 25.4;

    const { jsPDF } = window.jspdf;
    const orientation =
      pdfWidthMm > pdfHeightMm ? "landscape" : "portrait";

    // Crear el PDF con el tamaño y aspect ratio exacto del plano, sin forzar A4
    const pdf = new jsPDF({
      orientation: orientation,
      unit: "mm",
      format: [pdfWidthMm, pdfHeightMm],
    });

    // Colocar la imagen cubriendo el 100% del documento sin recortes ni márgenes extra
    pdf.addImage(
      dataURL,
      "PNG",
      0,
      0,
      pdfWidthMm,
      pdfHeightMm,
      undefined,
      "FAST",
    );
    pdf.save("Planificador_EDSI_300DPI.pdf");
  } catch (err) {
    console.error(err);
    openAlertModal(
      "Error al exportar PDF. El plano base podría exceder la memoria.",
    );
  }

  // Restaurar vista
  canvas.setViewportTransform(originalVPT);
  canvas.renderAll();
};

// 3. Descargar/Cargar Proyecto (JSON)
/** Serializa escala y objetos en coordenadas del plano, independientemente del zoom. */
function getProjectData() {
  // Resetear el viewport asegura que las coordenadas de los objetos se guarden absolutas (arregla el bug de desplazamiento)
  const originalVPT = canvas.viewportTransform.slice();
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.renderAll();

  const data = {
    scale: pixelsPerMeter,
    // Exportar propiedades custom para que el comportamiento no se rompa al cargar
    canvasData: canvas.toJSON([
      "objectCaching",
      "selectable",
      "evented",
      "visible",
    ]),
  };

  canvas.setViewportTransform(originalVPT);
  canvas.renderAll();

  return data;
}

/**
 * Restaura un proyecto y normaliza objetos que requieren ajustes tras la carga.
 * @param {{scale:number|null, canvasData:Object}} data Proyecto previamente serializado.
 */
function loadProjectData(data) {
  pixelsPerMeter = data.scale;
  if (pixelsPerMeter) {
    document.getElementById("scale-info").innerHTML =
      `Escala: <span class="text-blue-400 font-bold">1m = ${pixelsPerMeter.toFixed(1)}px</span>`;
  } else {
    document.getElementById("scale-info").innerHTML =
      `Escala no definida`;
  }

  // Resetear viewport local antes de inyectar los datos del archivo
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

  canvas.loadFromJSON(data.canvasData, function () {
    // Asegurar que los objetos dinámicos mantengan objectCaching false tras cargar
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
    canvas.renderAll();
    setMode("select");
    undoStack = []; // Reiniciar historial
    saveHistory();
    openAlertModal("Proyecto cargado con éxito.");
  });
}

// Descarga una copia JSON del estado actual del planificador.
document.getElementById("btn-save-file").onclick = () => {
  const data = getProjectData();
  const blob = new Blob([JSON.stringify(data)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.download = "Proyecto_EDSI.json";
  link.href = URL.createObjectURL(blob);
  link.click();
};

// Lee el JSON elegido por el usuario y lo restaura en el lienzo.
document
  .getElementById("input-load-file")
  .addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        loadProjectData(data);
      } catch (err) {
        openAlertModal("Error al leer el archivo. Formato inválido.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Resetear input
  });

// 4. Guardar/Cargar en Navegador (LocalForage)
const RECENTS_KEY = "edsi_recent_plans";

// Abre el diálogo de guardado y agrega el proyecto a la lista local de recientes.
document.getElementById("btn-save-local").onclick = () => {
  document.getElementById("custom-modal").classList.remove("hidden");
  document
    .querySelectorAll("#custom-modal > div")
    .forEach((d) => d.classList.add("hidden"));
  document
    .getElementById("modal-content-save-local")
    .classList.remove("hidden");

  const inputName = document.getElementById("save-local-name");
  inputName.value = "Plano " + new Date().toLocaleDateString();
  setTimeout(() => inputName.focus(), 100);

  document.getElementById("save-local-cancel").onclick = () => {
    document.getElementById("custom-modal").classList.add("hidden");
  };

  document.getElementById("save-local-confirm").onclick = async () => {
    const name = inputName.value || "Plano Sin Nombre";
    const data = getProjectData();

    try {
      let recents = (await localforage.getItem(RECENTS_KEY)) || [];
      recents.unshift({
        // Agregar al principio
        id: Date.now().toString(),
        name: name,
        date: new Date().toLocaleString(),
        data: data,
      });

      if (recents.length > 10) recents.pop(); // Mantener solo los últimos 10

      await localforage.setItem(RECENTS_KEY, recents);
      document.getElementById("custom-modal").classList.add("hidden");
      openAlertModal("Plano guardado en el navegador correctamente.");
    } catch (err) {
      openAlertModal(
        "Error al guardar en el navegador. (Puede que el plano sea muy grande).",
      );
    }
  };
};

// Recupera los proyectos recientes y crea una acción para cargar cada uno.
document.getElementById("btn-load-local").onclick = async () => {
  document.getElementById("custom-modal").classList.remove("hidden");
  document
    .querySelectorAll("#custom-modal > div")
    .forEach((d) => d.classList.add("hidden"));
  document
    .getElementById("modal-content-load-local")
    .classList.remove("hidden");

  const listContainer = document.getElementById("recents-list");
  listContainer.innerHTML =
    '<p class="text-gray-400 text-sm">Cargando...</p>';

  try {
    const recents = (await localforage.getItem(RECENTS_KEY)) || [];

    if (recents.length === 0) {
      listContainer.innerHTML =
        '<p class="text-gray-400 text-sm">No hay planos guardados recientemente.</p>';
    } else {
      listContainer.innerHTML = "";
      recents.forEach((item) => {
        const div = document.createElement("div");
        div.className =
          "flex justify-between items-center bg-gray-700 p-3 rounded hover:bg-gray-600 transition";
        div.innerHTML = `
                      <div class="overflow-hidden">
                          <p class="text-white font-semibold truncate text-sm">${item.name}</p>
                          <p class="text-gray-400 text-xs">${item.date}</p>
                      </div>
                      <button class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition flex-shrink-0">Cargar</button>
                  `;
        div.querySelector("button").onclick = () => {
          loadProjectData(item.data);
          document.getElementById("custom-modal").classList.add("hidden");
        };
        listContainer.appendChild(div);
      });
    }
  } catch (err) {
    listContainer.innerHTML =
      '<p class="text-red-400 text-sm">Error al leer los datos locales.</p>';
  }

  document.getElementById("load-local-cancel").onclick = () => {
    document.getElementById("custom-modal").classList.add("hidden");
  };
};

// Finaliza el paneo o el trazo de escala cuando se suelta el botón del ratón.
canvas.on("mouse:up", function (opt) {
  // Finalizar paneo
  if (isDragging) {
    canvas.setViewportTransform(canvas.viewportTransform);
    isDragging = false;

    // Restaurar el cursor y selección según el modo actual
    if (currentMode === "select") {
      canvas.selection = true;
      canvas.defaultCursor = "default";
    } else {
      canvas.defaultCursor = "crosshair";
    }
    return;
  }

  if (currentMode === "attack_line") {
    // Ya no cortamos la línea aquí si el usuario suelta el clic.
    // Continuará dibujándose con mouse:move hasta que se agoten los metros.
    return;
  }

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
  // Calcular longitud en píxeles usando hipotenusa directa con el puntero
  const lengthPx = Math.hypot(pointer.x - startX, pointer.y - startY);

  drawingLine = null;
});

