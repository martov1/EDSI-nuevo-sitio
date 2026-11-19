/**
 * Misión: abrir y controlar los diálogos de configuración y confirmación.
 * Incluye la calibración de escala, la configuración/continuación de líneas
 * de ataque y los avisos al usuario.
 * Funciones: openScaleModal, openAttackSetupModal, openAttackActionModal
 * y openAlertModal.
 */

// --- MANEJO DE MODALES ---
/**
 * Solicita la distancia real del segmento usado para fijar la escala.
 * @param {number} lengthPx Longitud dibujada en píxeles.
 * @param {fabric.Object} lineObj Línea temporal que se debe retirar al cerrar.
 */
function openScaleModal(lengthPx, lineObj) {
  document.getElementById("custom-modal").classList.remove("hidden");
  document
    .getElementById("modal-content-scale")
    .classList.remove("hidden");
  document
    .getElementById("modal-content-attack-setup")
    .classList.add("hidden");
  document
    .getElementById("modal-content-attack-action")
    .classList.add("hidden");
  document.getElementById("modal-content-alert").classList.add("hidden");

  const confirmBtn = document.getElementById("scale-confirm");
  const cancelBtn = document.getElementById("scale-cancel");
  const input = document.getElementById("scale-input");
  input.value = "";
  setTimeout(() => input.focus(), 100);

  // Cierra el diálogo y limpia sus manejadores y puntos temporales de escala.
  const close = () => {
    document.getElementById("custom-modal").classList.add("hidden");
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
    scaleStartPlaced = false;
    scaleSecondPointStarted = false;
  };

  confirmBtn.onclick = () => {
    const meters = parseFloat(input.value);
    if (meters > 0) {
      pixelsPerMeter = lengthPx / meters;
      document.getElementById("scale-info").innerHTML =
        `Escala: <span class="text-blue-400 font-bold">1m = ${pixelsPerMeter.toFixed(1)}px</span>`;
    }
    canvas.remove(lineObj);
    setMode("select");
    close();
    saveHistory(); // Guardar cambio de escala
  };

  cancelBtn.onclick = () => {
    canvas.remove(lineObj);
    setMode("select");
    close();
  };
}

/** Pide la longitud real de cada tramo y activa la herramienta de ataque. */
function openAttackSetupModal() {
  document.getElementById("custom-modal").classList.remove("hidden");
  document.getElementById("modal-content-scale").classList.add("hidden");
  document
    .getElementById("modal-content-attack-setup")
    .classList.remove("hidden");
  document
    .getElementById("modal-content-attack-action")
    .classList.add("hidden");
  document.getElementById("modal-content-alert").classList.add("hidden");

  const confirmBtn = document.getElementById("attack-setup-confirm");
  const cancelBtn = document.getElementById("attack-setup-cancel");
  const inputLargo = document.getElementById("attack-setup-largo");

  inputLargo.value = "";
  setTimeout(() => inputLargo.focus(), 100);

  // Oculta el diálogo y libera los controladores de sus botones.
  const close = () => {
    document.getElementById("custom-modal").classList.add("hidden");
    document
      .getElementById("modal-content-attack-setup")
      .classList.add("hidden");
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  confirmBtn.onclick = () => {
    const largo = parseFloat(inputLargo.value);
    if (largo > 0) {
      attackLineLengthMeters = largo;
      setMode("attack_line");
      close();
    }
  };

  cancelBtn.onclick = () => {
    close();
  };
}

/** Después de completar un tramo, ofrece colocar la lanza o alargarlo. */
function openAttackActionModal() {
  document.getElementById("custom-modal").classList.remove("hidden");
  document.getElementById("modal-content-scale").classList.add("hidden");
  document
    .getElementById("modal-content-attack-setup")
    .classList.add("hidden");
  document
    .getElementById("modal-content-attack-action")
    .classList.remove("hidden");
  document.getElementById("modal-content-alert").classList.add("hidden");

  const btnLanza = document.getElementById("attack-action-lanza");
  const btnAlargar = document.getElementById("attack-action-alargar");

  // Oculta el diálogo y libera los controladores de las dos acciones.
  const close = () => {
    document.getElementById("custom-modal").classList.add("hidden");
    document
      .getElementById("modal-content-attack-action")
      .classList.add("hidden");
    btnLanza.onclick = null;
    btnAlargar.onclick = null;
  };

  btnLanza.onclick = () => {
    placingNozzle = true;
    segmentFinished = false;
    updateToolHelp();

    // Eliminar la última unión ya que allí irá la lanza
    if (lastUnionObject) {
      canvas.remove(lastUnionObject);
      lastUnionObject = null;
    }

    // Crear Lanza (Triángulo amarillo)
    const nozzleWidth = pixelsPerMeter ? 1 * pixelsPerMeter : 18;
    const nozzleHeight = pixelsPerMeter ? 1 * pixelsPerMeter : 24;

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

    aimingLine = new fabric.Line(
      [lastUnionX, lastUnionY, lastUnionX, lastUnionY],
      {
        stroke: "#60a5fa", // blue-400
        strokeWidth: 2,
        strokeDashArray: [6, 6],
        selectable: false,
        evented: false,
      },
    );
    canvas.add(aimingLine);

    close();
  };

  btnAlargar.onclick = () => {
    segmentFinished = false;
    lastUnionObject = null; // La unión se queda, pero ya no la rastreamos para borrarla
    updateToolHelp();
    // Dejamos en modo attack_line para que el usuario trace un nuevo tramo haciendo clic
    close();
  };
}

/** Muestra un mensaje informativo o de error en el diálogo común. */
/**
 * @param {string} msg Texto que se mostrará en el diálogo.
 */
function openAlertModal(msg) {
  document.getElementById("custom-modal").classList.remove("hidden");
  document.getElementById("modal-content-scale").classList.add("hidden");
  document
    .getElementById("modal-content-attack-setup")
    .classList.add("hidden");
  document
    .getElementById("modal-content-attack-action")
    .classList.add("hidden");
  document
    .getElementById("modal-content-save-local")
    .classList.add("hidden");
  document
    .getElementById("modal-content-load-local")
    .classList.add("hidden");
  document
    .getElementById("modal-content-alert")
    .classList.remove("hidden");

  document.getElementById("alert-message").innerText = msg;

  document.getElementById("alert-confirm").onclick = () => {
    document.getElementById("custom-modal").classList.add("hidden");
    document
      .getElementById("modal-content-alert")
      .classList.add("hidden");
  };
}

