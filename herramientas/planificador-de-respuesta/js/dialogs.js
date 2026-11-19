/**
 * Misión: abrir y controlar los diálogos de configuración y confirmación.
 * Incluye la calibración de escala, la configuración/continuación de líneas
 * de ataque y los avisos al usuario.
 * Funciones: openScaleModal, openAttackSetupModal, openAttackActionModal
 * y openAlertModal.
 * Guía de arquitectura y cambios: ../GUIA-PROGRAMADOR.md
 */

// --- MANEJO DE MODALES ---
/**
 * Solicita la distancia real del segmento usado para fijar la escala.
 * @param {number} lengthPx Longitud dibujada en píxeles.
 * @param {fabric.Object} lineObj Línea temporal que se debe retirar al cerrar.
 */
function openScaleModal(lengthPx, lineObj) {
  document.getElementById("custom-modal").classList.remove("hidden");
  document.getElementById("modal-content-scale").classList.remove("hidden");
  document.getElementById("modal-content-attack-setup").classList.add("hidden");
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
  document.getElementById("modal-content-attack-setup").classList.add("hidden");
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
    startNozzlePlacement();
    close();
  };

  btnAlargar.onclick = () => {
    extendAttackLine();
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
  document.getElementById("modal-content-attack-setup").classList.add("hidden");
  document
    .getElementById("modal-content-attack-action")
    .classList.add("hidden");
  document.getElementById("modal-content-save-local").classList.add("hidden");
  document.getElementById("modal-content-load-local").classList.add("hidden");
  document.getElementById("modal-content-alert").classList.remove("hidden");

  document.getElementById("alert-message").innerText = msg;

  document.getElementById("alert-confirm").onclick = () => {
    document.getElementById("custom-modal").classList.add("hidden");
    document.getElementById("modal-content-alert").classList.add("hidden");
  };
}
