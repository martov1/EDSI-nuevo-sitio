/**
 * Misión: actualizar la ayuda contextual y los indicadores de preparación.
 * Las instrucciones reflejan el plano, la escala y la etapa de la herramienta activa.
 * Función principal: updateToolHelp.
 * Guía de arquitectura y cambios: ../GUIA-PROGRAMADOR.md
 */

/** Actualiza las instrucciones visibles según el plano, la escala y la herramienta. */
function updateToolHelp() {
  const hasPlan = Boolean(canvas.backgroundImage);
  document
    .getElementById("upload-image-label")
    .classList.toggle("attention-pulse", !hasPlan);
  document
    .getElementById("upload-image-check")
    .classList.toggle("hidden", !hasPlan);
  document
    .getElementById("btn-scale")
    .classList.toggle("attention-pulse", hasPlan && !pixelsPerMeter);
  document
    .getElementById("scale-check")
    .classList.toggle("hidden", !pixelsPerMeter);
  document
    .getElementById("scale-icons-container")
    .classList.toggle("hidden", !pixelsPerMeter);

  let title = "Seleccionar / Mover";
  let instructions = [
    `<span aria-hidden="true">🖱️</span> <strong>Botón central o Alt + arrastrar:</strong> desplaza la vista.`,
    `<span aria-hidden="true">🖱️</span> <strong>Girar la rueda:</strong> modifica el zoom.`,
    `<span aria-hidden="true">🖱️</span> <strong>Clic izquierdo:</strong> selecciona; arrastra un elemento para moverlo.`,
    `<kbd class="rounded border border-gray-500 px-1">Supr</kbd> borra los elementos seleccionados.`,
    `<kbd class="rounded border border-gray-500 px-1">Ctrl</kbd> + <kbd class="rounded border border-gray-500 px-1">Z</kbd> deshace la última acción.`,
  ];

  if (currentMode === "zoning_color" || currentMode === "zoning") {
    title =
      currentMode === "zoning_color"
        ? "Zonificación"
        : selectedZoningType.label;
    instructions =
      currentMode === "zoning_color"
        ? ["Elige Zona caliente, Zona templada o Zona fría."]
        : zoningPoints.length
          ? [
              "Traza el perímetro moviendo el cursor; al volver cerca del inicio, se cerrará automáticamente.",
              "Pulsa Escape para cancelar.",
            ]
          : [
              "Haz clic para iniciar el perímetro y mueve el cursor a mano alzada.",
              "Al volver cerca del inicio, el perímetro se cerrará automáticamente.",
              "Pulsa Escape para cancelar.",
            ];
  } else if (!canvas.backgroundImage) {
    title = "Comienza por cargar un plano";
    instructions = [
      "Plano nuevo: carga una imagen o PDF en «Cargar Imagen / PDF». Se usará como base para dibujar; después podrás definir la escala.",
      "Proyecto guardado: «Cargar Proyecto» abre un .json exportado con «Descargar Proyecto» y restaura el plano, la escala y sus elementos.",
      "Guardado en este navegador: «Planos Recientes» reabre proyectos guardados aquí con «Guardar en Navegador».",
    ];
  } else if (
    currentMode === "wind_arrow" ||
    currentMode === "propagation_arrow"
  ) {
    title =
      currentMode === "wind_arrow"
        ? "Indicar dirección del viento"
        : "Indicar dirección de propagación";
    if (directionalArrowPhase === "width") {
      instructions = [
        "La dirección y el largo están definidos. Mueve el cursor para ajustar el ancho de la flecha.",
        "Haz clic para colocarla. Pulsa Escape para cancelar.",
      ];
    } else if (directionalArrowPhase === "direction") {
      instructions = [
        "El punto inicial está marcado. Haz clic en el segundo punto para indicar la dirección y el largo.",
        "Pulsa Escape para cancelar.",
      ];
    } else {
      instructions = [
        "Haz clic en el punto inicial de la flecha.",
        "Luego indicarás dirección y largo, y ajustarás el ancho antes de colocarla.",
        "Pulsa Escape para cancelar.",
      ];
    }
  } else if (!pixelsPerMeter) {
    title = "Fija la escala del plano";
    if (currentMode === "scale") {
      instructions = scaleStartPlaced
        ? [
            "El primer punto está marcado. Haz clic en el segundo extremo de una distancia conocida.",
            "Luego ingresa la distancia real en metros.",
            "La escala permite calcular longitudes y tamaños reales.",
          ]
        : [
            "Haz clic en los dos extremos de una distancia conocida y luego ingresa su longitud en metros.",
            "Así el sistema convierte las medidas del plano a metros reales.",
            "Pulsa Escape para cancelar.",
          ];
    } else {
      instructions = [
        "Pulsa «Fijar Escala» y marca con dos clics los extremos de una distancia conocida.",
        "Ingresa la longitud real en metros.",
        "La escala permite calcular longitudes —como los tramos de ataque— y tamaños reales.",
      ];
    }
  } else if (currentMode === "measure_distance") {
    title = "Medir distancia";
    instructions = [
      "Haz clic en el primer punto y mueve el cursor hasta el segundo.",
      "Haz clic otra vez para fijar la distancia, que se calcula en metros según la escala.",
      "Pulsa Escape para cancelar.",
    ];
  } else if (currentMode === "measure_radius") {
    title = "Medir radio";
    instructions = [
      "Haz clic para marcar el centro del círculo.",
      "Aleja el cursor para definir el radio; la línea punteada muestra la medida.",
      "Haz clic para fijar el círculo. Pulsa Escape para cancelar.",
    ];
  } else if (currentMode === "scale") {
    title = "Fijar Escala";
    instructions = scaleStartPlaced
      ? [
          "Haz clic en el segundo punto de una distancia conocida.",
          "Luego ingresa cuántos metros representa esa distancia.",
          "Pulsa Escape para cancelar.",
        ]
      : [
          "Haz clic en el primer punto de una distancia conocida.",
          "Haz clic en el segundo punto para completar la línea.",
          "Pulsa Escape para cancelar.",
        ];
  } else if (currentMode === "attack_line") {
    title = "Línea de Ataque";
    if (placingNozzle) {
      instructions = [
        "Mueve el cursor para orientar la lanza.",
        "Haz clic para fijar su posición y orientación.",
        "Pulsa Escape para cancelar.",
      ];
    } else if (placingConeLength) {
      instructions = [
        "Mueve el cursor para definir el alcance del chorro.",
        "Haz clic para confirmar la longitud.",
        "Pulsa Escape para cancelar.",
      ];
    } else if (placingConeWidth) {
      instructions = [
        "Mueve el cursor a un lado del eje para definir el ancho.",
        "Haz clic para confirmar el cono o chorro pleno.",
        "Pulsa Escape para cancelar.",
      ];
    } else if (isDrawingHose) {
      instructions = [
        "Haz clic para iniciar y mueve el cursor para trazar el tramo.",
        "El tramo finaliza automáticamente al alcanzar la longitud definida.",
        "Pulsa Escape para cancelar.",
      ];
    } else if (segmentFinished) {
      instructions = [
        "El tramo está completo.",
        "Elige alargarlo o colocar la lanza.",
        "Pulsa Escape para salir de la herramienta.",
      ];
    } else {
      instructions = [
        "Haz clic en el plano y mueve el cursor para trazar un tramo.",
        "El tramo se limita a la longitud configurada.",
        "Pulsa Escape para salir de la herramienta.",
      ];
    }
  } else if (currentMode === "stamp") {
    title = "Colocar Elemento";
    instructions = [
      "Mueve el cursor para ubicar la vista previa.",
      "Haz clic para colocar el elemento en el plano.",
      "Pulsa Escape para cancelar.",
    ];
  }

  document.getElementById("tool-help-title").textContent = title;
  document.getElementById("tool-help-list").innerHTML = instructions
    .map((instruction) => `<li>${instruction}</li>`)
    .join("");
}
