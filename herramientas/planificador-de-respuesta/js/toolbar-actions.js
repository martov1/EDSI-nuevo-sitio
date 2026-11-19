/**
 * Misión: construir y atender las acciones de la barra lateral.
 * Incluye brigadistas, íconos y escalas gráficas para sellar sobre el plano,
 * además de anotaciones, eliminación de objetos y atajos de teclado.
 * Funciones principales: addBrigadista, scaleIconToMeters, createScaleBarSvg
 * y startStamping; los controladores atienden texto, borrado y teclado.
 */

// --- BRIGADISTAS ---
// Construye los botones de brigadista a partir de sus datos y enlaza su selección.
const brigadistas = [
  { id: "1", name: "Pitonero", color: "#e74c3c" }, // Rojo
  { id: "2", name: "2do Pit.", color: "#3498db" }, // Azul
  { id: "3", name: "Ay. Col.", color: "#2ecc71" }, // Verde
  { id: "4", name: "Colum.", color: "#9b59b6" }, // Púrpura
  { id: "5", name: "Capitán", color: "#f1c40f", textColor: "#000" }, // DORADO
  { id: "C", name: "Cañista", color: "#e67e22" }, // Naranja
  { id: "E", name: "Eléctrico", color: "#34495e" }, // Gris oscuro
];

const brContainer = document.getElementById("brigadistas-container");
brigadistas.forEach((b) => {
  const btn = document.createElement("button");
  btn.className =
    "flex flex-col items-center justify-center p-2 rounded hover:bg-gray-700 transition border border-gray-700 hover:border-gray-500";
  btn.innerHTML = `
          <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md" style="background-color: ${b.color}; color: ${b.textColor || "#fff"};">
              ${b.id}
          </div>
      `;
  const label = document.createElement("span");
  label.className = "mt-1 text-center text-[10px] leading-tight text-gray-300";
  label.textContent = b.name;
  btn.appendChild(label);
  btn.title = b.name;
  btn.onclick = () => addBrigadista(b);
  brContainer.appendChild(btn);
});

/**
 * Crea el símbolo agrupado de un brigadista y prepara su colocación como sello.
 * @param {{id:string, color:string, textColor?:string}} b Datos visuales del brigadista.
 */
function addBrigadista(b) {
  const circle = new fabric.Circle({
    radius: 16,
    fill: b.color,
    stroke: "#ffffff",
    strokeWidth: 2,
    originX: "center",
    originY: "center",
  });

  const text = new fabric.Text(b.id, {
    fontSize: 16,
    fill: b.textColor || "#ffffff",
    originX: "center",
    originY: "center",
    fontWeight: "bold",
    fontFamily: "Inter",
  });

  const group = new fabric.Group([circle, text], {
    originX: "center",
    originY: "center",
  });

  // El diámetro base de 32px equivale a 1m cuando hay escala.
  if (pixelsPerMeter) {
    const scale = pixelsPerMeter / 32;
    group.set({ scaleX: scale, scaleY: scale });
  }

  startStamping(group);
}

// --- ÍCONOS ---
/**
 * Ajusta un ícono a sus dimensiones en metros usando la escala actual.
 * @param {fabric.Object} object Ícono cargado o creado.
 * @param {{metersLong:number, metersWide:number}} icon Dimensiones reales del ícono.
 */
function scaleIconToMeters(object, icon) {
  const pixelsPerUnit = pixelsPerMeter || 32;
  object.set({
    scaleX: (pixelsPerUnit * icon.metersLong) / object.width,
    scaleY: (pixelsPerUnit * icon.metersWide) / object.height,
  });
}

const iconos = [
  { emoji: "🔥", metersLong: 1, metersWide: 1, name: "Fuego" },
  { emoji: "💨", metersLong: 1, metersWide: 1, name: "Fuga de Gas" },
  {
    svgUrl: "assets/garrafa.svg",
    metersLong: 1,
    metersWide: 1,
    name: "Garrafa",
  },
  {
    svgUrl: "assets/tablero-electrico.svg",
    metersLong: 1,
    metersWide: 1,
    name: "Tablero eléctrico",
  },
  {
    svgUrl: "assets/medidor%20gas.svg",
    metersLong: 1,
    metersWide: 1,
    name: "Medidor de gas",
  },
  {
    svgUrl: "assets/tanque%20propano.svg",
    metersLong: 3,
    metersWide: 3,
    menuWide: true,
    name: "Tanque de GLP",
  },
  {
    svgUrl: "assets/pallet.svg",
    metersLong: 1.51,
    metersWide: 1.51,
    name: "Pallet",
  },
  { emoji: "⚙️", metersLong: 1, metersWide: 1, name: "Máquina" },
];

// Construye botones para SVG y símbolos; cada botón inicia el modo de colocación.
const icContainer = document.getElementById("icons-container");
iconos.forEach((ic) => {
  const btn = document.createElement("button");
  btn.className =
    "p-1 bg-gray-700 rounded border border-gray-600 hover:bg-gray-600 transition flex flex-col items-center justify-center";
  const symbol = document.createElement("span");
  symbol.className = `flex h-8 ${ic.menuWide ? "w-16" : "w-8"} items-center justify-center text-2xl leading-none`;
  if (ic.svgUrl) {
    const image = document.createElement("img");
    image.src = ic.svgUrl;
    image.alt = "";
    image.className = `h-full w-full ${ic.menuWide ? "object-fill" : "object-contain"}`;
    symbol.appendChild(image);
  } else if (ic.svg) {
    symbol.innerHTML = ic.svg;
  } else {
    symbol.textContent = ic.emoji;
  }
  btn.appendChild(symbol);

  const label = document.createElement("span");
  label.className = "mt-1 text-center text-[10px] leading-tight text-gray-300";
  label.textContent = ic.name;
  btn.appendChild(label);
  btn.title = ic.name;
  btn.onclick = () => {
    if (ic.svgUrl) {
      fabric.loadSVGFromURL(ic.svgUrl, (objects, options) => {
        const svgObject = fabric.util.groupSVGElements(objects, options);
        svgObject.set({
          originX: "center",
          originY: "center",
        });
        scaleIconToMeters(svgObject, ic);
        startStamping(svgObject);
      });
      return;
    }

    if (ic.svg) {
      fabric.loadSVGFromString(ic.svg, (objects, options) => {
        const svgObject = fabric.util.groupSVGElements(objects, options);
        svgObject.set({ originX: "center", originY: "center" });
        scaleIconToMeters(svgObject, ic);
        startStamping(svgObject);
      });
      return;
    }

    const text = new fabric.Text(ic.emoji, {
      fontSize: 32,
      originX: "center",
      originY: "center",
    });
    scaleIconToMeters(text, ic);
    startStamping(text);
  };
  icContainer.appendChild(btn);
});

const scaleBarOptions = [
  { name: "Escala 1–2 m", marks: [0, 1, 2] },
  { name: "Escala 1–5–10 m", marks: [0, 1, 5, 10], heightScale: 2 },
  { name: "Escala 0–10–25–50 m", marks: [0, 10, 25, 50] },
  { name: "Escala 25–50–100 m", marks: [0, 25, 50, 100] },
];

/**
 * Genera el dibujo vectorial de una escala gráfica y sus marcas etiquetadas.
 * @param {{marks:number[], heightScale?:number}} option Marcas y proporciones de la escala.
 * @returns {string} SVG que Fabric puede cargar como objeto del lienzo.
 */
function createScaleBarSvg(option) {
  const basePixelsPerMeter = 32;
  const margin = 12;
  const totalMeters = option.marks[option.marks.length - 1];
  const width = margin * 2 + totalMeters * basePixelsPerMeter;
  const heightScale = option.heightScale || Math.max(1, totalMeters / 10);
  const height = 32 * heightScale;
  const barTop = 16 * heightScale;
  const barHeight = 8 * heightScale;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">`,
  ];

  for (let i = 0; i < option.marks.length - 1; i++) {
    const x = margin + option.marks[i] * basePixelsPerMeter;
    const segmentWidth =
      (option.marks[i + 1] - option.marks[i]) * basePixelsPerMeter;
    const fill = i % 2 === 0 ? "#ffffff" : "#111827";
    parts.push(
      `<rect x="${x}" y="${barTop}" width="${segmentWidth}" height="${barHeight}" fill="${fill}" stroke="#111827" stroke-width="1"/>`,
    );
  }

  option.marks.forEach((mark, index) => {
    const x = margin + mark * basePixelsPerMeter;
    const anchor =
      index === 0
        ? "start"
        : index === option.marks.length - 1
          ? "end"
          : "middle";
    const label = mark === 0 ? "0" : `${mark}m`;
    parts.push(
      `<line x1="${x}" y1="${13 * heightScale}" x2="${x}" y2="${27 * heightScale}" stroke="#111827" stroke-width="${1.5 * heightScale}"/>`,
    );
    parts.push(
      `<text x="${x}" y="${10 * heightScale}" text-anchor="${anchor}" font-family="Arial, sans-serif" font-size="${8 * heightScale}" fill="#111827">${label}</text>`,
    );
  });

  parts.push("</svg>");
  return parts.join("");
}

// Crea las opciones de escala gráfica que también pueden colocarse como sellos.
const scaleOptionsContainer = document.getElementById(
  "scale-options-container",
);
scaleBarOptions.forEach((option) => {
  const btn = document.createElement("button");
  btn.className =
    "flex min-w-0 flex-col items-center rounded border border-gray-600 bg-gray-700 p-2 transition hover:bg-gray-600";
  btn.title = option.name;

  const preview = document.createElement("span");
  preview.className = "flex h-8 w-full items-center";
  preview.innerHTML = createScaleBarSvg(option);
  preview.firstElementChild.style.width = "100%";
  preview.firstElementChild.style.height = "100%";
  btn.appendChild(preview);

  const label = document.createElement("span");
  label.className = "mt-1 text-center text-[10px] leading-tight text-gray-200";
  label.textContent = option.name;
  btn.appendChild(label);

  btn.onclick = () => {
    fabric.loadSVGFromString(
      createScaleBarSvg(option),
      (objects, svgOptions) => {
        const scaleBar = fabric.util.groupSVGElements(objects, svgOptions);
        const scaleFactor = pixelsPerMeter / 32;
        scaleBar.set({
          originX: "center",
          originY: "center",
          scaleX: scaleFactor,
          scaleY: scaleFactor,
          objectCaching: false,
        });
        startStamping(scaleBar);
      },
    );
  };
  scaleOptionsContainer.appendChild(btn);
});

// Función unificada para iniciar modo sello (Stamping)
/**
 * Añade un objeto como vista previa móvil y activa el modo de colocación.
 * @param {fabric.Object} fabricObj Objeto que se colocará sobre el plano.
 */
function startStamping(fabricObj) {
  setMode("stamp");
  fabricObj.set({
    opacity: 0.7, // Fantasma semi-transparente
    selectable: false,
    evented: false,
    objectCaching: false, // CRÍTICO: Evita problemas de renderizado al moverse
    visible: false, // Oculto hasta que el mouse entre al canvas
  });
  stampGhost = fabricObj;
  canvas.add(stampGhost);
  canvas.requestRenderAll();
}

// --- ANOTACIONES (Textos) ---
// Crea un cuadro de texto editable en el centro del lienzo.
document.getElementById("btn-text").onclick = () => {
  const textbox = new fabric.Textbox("Doble clic para editar", {
    left: canvas.width / 2,
    top: canvas.height / 2,
    width: 200,
    fontSize: 16,
    fontFamily: "Inter",
    fill: "#000000",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderColor: "#7c3aed",
    cornerColor: "#2563eb",
    padding: 10,
    textAlign: "center",
    originX: "center",
    originY: "center",
  });

  // Simular un borde dibujando un rectángulo debajo (Fabric Textbox bg no tiene borde nativo sólido fáci)
  canvas.add(textbox);
  canvas.setActiveObject(textbox);
  setMode("select");
  saveHistory();
};

// --- ELIMINAR OBJETOS ---
// Elimina la selección actual y recalcula máscaras si se quitó una zona.
document.getElementById("btn-delete").onclick = () => {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length) {
    const removedZone = activeObjects.some(
      (object) => getZoningPriority(object) !== null,
    );
    canvas.discardActiveObject();
    activeObjects.forEach(function (object) {
      canvas.remove(object);
    });
    if (removedZone) refreshZoningClips();
    saveHistory();
  }
};

// --- TECLAS (Suprimir, Escape, Ctrl+Z) ---
// Centraliza deshacer, cancelación de modos y eliminación desde el teclado.
window.addEventListener("keydown", function (e) {
  // Deshacer (Ctrl+Z o Cmd+Z)
  if ((e.ctrlKey || e.metaKey) && e.key === "z") {
    e.preventDefault();
    undo();
    return;
  }

  // Cancelar acción (Escape)
  if (e.key === "Escape") {
    if (currentMode === "stamp" && stampGhost) {
      canvas.remove(stampGhost);
      stampGhost = null;
      setMode("select");
    } else if (currentMode === "zoning_color" || currentMode === "zoning") {
      setMode("select");
    } else if (isDirectionalArrowMode()) {
      setMode("select");
    } else if (
      currentMode === "measure_distance" ||
      currentMode === "measure_radius"
    ) {
      setMode("select");
    } else if (currentMode === "attack_line") {
      cancelAttackLine();
    } else if (currentMode === "scale") {
      isDrawing = false;
      if (drawingLine) canvas.remove(drawingLine);
      drawingLine = null;
      scaleStartPlaced = false;
      scaleSecondPointStarted = false;

      if (
        !document
          .getElementById("modal-content-scale")
          .classList.contains("hidden")
      ) {
        document.getElementById("scale-cancel").click();
      } else {
        setMode("select");
      }
    }

    // Cerrar cualquier modal abierto
    document.getElementById("custom-modal").classList.add("hidden");
    document
      .querySelectorAll("#custom-modal > div")
      .forEach((d) => d.classList.add("hidden"));
    return;
  }

  // Eliminar (Suprimir / Backspace)
  if (e.key === "Delete" || e.key === "Backspace") {
    // Evitar borrar si estamos editando texto
    if (canvas.getActiveObject() && canvas.getActiveObject().isEditing) return;

    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length) {
      const removedZone = activeObjects.some(
        (object) => getZoningPriority(object) !== null,
      );
      canvas.discardActiveObject();
      activeObjects.forEach(function (object) {
        canvas.remove(object);
      });
      if (removedZone) refreshZoningClips();
      saveHistory();
    }
  }
});
