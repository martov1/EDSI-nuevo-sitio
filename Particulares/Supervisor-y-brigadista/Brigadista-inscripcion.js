// =========================================================
// CONFIGURACIÓN GENERAL DEL FLUJO DE INSCRIPCIÓN
// =========================================================
// Aquí se definen los textos, enlaces y mensajes compartidos
// por toda la experiencia de inscripción y pago.
const FORM_CONFIG = {
  scriptUrl:
    "https://script.google.com/macros/s/AKfycbzCyeYd_4ihk1vBgRFfh7ieiGCq6M5ACUTggDm6O0RhuqbjHY2X57Z2qO77JbzmdY1r/exec",
  errorMessage:
    "No se pudo crear el formulario. Por favor, intentá nuevamente.",
  companyPhone: "11 7061-6594",
};

// Cada modalidad de pago tiene su propio texto de botón,
// asunto para comprobante y redirección correspondiente.
const PAYMENT_TYPES = {
  full: {
    mercadoLabel: "3 cuotas sin interés",
    whatsappLabel: "Cuotas sin tarjeta",
    receiptSubject: "“comprobante de pago - Supervisor y brigadista”",
  },
  deposit: {
    mercadoLabel: "Pagar seña con Mercado Pago",
    whatsappLabel: "Tengo una consulta",
    receiptSubject: "“comprobante de seña - Supervisor y brigadista”",
  },
};

// =========================================================
// INICIALIZACIÓN DEL FLUJO
// =========================================================
// Este bloque se ejecuta cuando ya cargó el DOM y prepara
// todos los listeners y validaciones del formulario.
document.addEventListener("DOMContentLoaded", function () {
  // ---------------------------------------------------------
  // 1) ELEMENTOS DEL DOM
  // ---------------------------------------------------------
  // Seleccionamos todos los nodos que participan en la inscripción,
  // la validación y el cambio de estado entre formulario y pago.
  const form = document.getElementById("enrollment-form");
  const paymentStep = document.getElementById("payment-step");
  const totalPayment = document.getElementById("total-payment");
  const submitButton = document.getElementById("show-payment");
  const transferButton = document.getElementById("show-transfer");
  const transferDetails = document.getElementById("transfer-details");
  const fullPaymentButton = document.getElementById("full-payment");
  const depositPaymentButton = document.getElementById("deposit-payment");
  const depositNote = document.getElementById("deposit-note");
  const paymentOptions = document.querySelector(".payment-options");
  const mercadoPayment = document.getElementById("mercado-payment");
  const mercadoPaymentLabel = document.getElementById("mercado-payment-label");
  const gocuotasPayment = document.getElementById("gocuotas-payment");
  const whatsappPayment = document.getElementById("whatsapp-payment");
  const whatsappPaymentLabel = document.getElementById(
    "whatsapp-payment-label",
  );
  const receiptButton = document.getElementById("receipt-button");
  const receiptSubject = document.getElementById("receipt-subject");
  const phone = document.getElementById("telefono");
  const phoneConfirmation = document.getElementById("telefono-confirmacion");

  // ---------------------------------------------------------
  // 2) VALIDACIÓN DE TELÉFONO
  // ---------------------------------------------------------
  // Propósito: valida que el teléfono ingresado y su confirmación sean iguales.
  // Inputs: lee los valores de los inputs #telefono y #telefono-confirmacion.
  // Output: setea customValidity("Los teléfonos no coinciden.") si no coinciden.
  function validatePhoneConfirmation() {
    const phonesMatch = phone.value.trim() === phoneConfirmation.value.trim();
    phoneConfirmation.setCustomValidity(
      phonesMatch ? "" : "Los teléfonos no coinciden.",
    );
  }

  // ---------------------------------------------------------
  // 3) NAVEGACIÓN Y SCROLL
  // ---------------------------------------------------------
  // Propósito: detecta si la pantalla está en orientación vertical.
  // Inputs: no recibe parámetros.
  // Output: devuelve true si la orientación es portrait, false en caso contrario.
  function isPortraitOrientation() {
    return window.matchMedia("(orientation: portrait)").matches;
  }

  // Propósito: desplaza la vista suavemente hacia un bloque específico.
  // Inputs:
  //   - element: nodo del DOM a visualizar
  //   - block: posición del scroll ("start", "center", "end")
  //   - portraitOnly: si es true, solo hace scroll en modo vertical
  // Output: ejecuta scrollIntoView con comportamiento suave.
  function scrollToElement(element, block = "center", portraitOnly = true) {
    if (portraitOnly && !isPortraitOrientation()) {
      return;
    }

    requestAnimationFrame(function () {
      element.scrollIntoView({ behavior: "smooth", block });
    });
  }

  // Propósito: decide dónde debe moverse la vista según la modalidad elegida.
  // Inputs: isDeposit (booleano, true para seña y false para pago completo).
  // Output: llama a scrollToElement sobre depositNote o paymentOptions.
  function scrollToPaymentDestination(isDeposit) {
    const target = isDeposit ? depositNote : paymentOptions;
    const position = isDeposit ? "start" : "center";
    scrollToElement(target, position);
  }

  // ---------------------------------------------------------
  // 4) CAMBIO DE ETAPA: FORMULARIO → PAGO
  // ---------------------------------------------------------
  // Propósito: reemplaza la vista del formulario por la etapa de pago.
  // Inputs: no recibe parámetros, usa las referencias internas del DOM.
  // Output: oculta el form, muestra paymentStep y mueve la vista hacia el total.
  function showPaymentStep() {
    form.hidden = true;
    paymentStep.hidden = false;
    scrollToElement(totalPayment, "start", false);
  }

  // ---------------------------------------------------------
  // 5) SELECCIÓN DE MODALIDAD DE PAGO
  // ---------------------------------------------------------
  // Propósito: actualiza la interfaz según si la persona elige pago completo o con seña.
  // Inputs: type ("full" o "deposit").
  // Output: modifica href, textos, estado visual, nota de depósito y scroll.
  function selectPaymentType(type) {
    const payment = PAYMENT_TYPES[type];
    const isDeposit = type === "deposit";

    mercadoPayment.href = isDeposit
      ? mercadoPayment.dataset.depositUrl
      : mercadoPayment.dataset.fullUrl;
    mercadoPaymentLabel.textContent = payment.mercadoLabel;
    whatsappPaymentLabel.textContent = payment.whatsappLabel;
    whatsappPayment.href = isDeposit
      ? whatsappPayment.dataset.depositUrl
      : whatsappPayment.dataset.fullUrl;
    gocuotasPayment.hidden = isDeposit;
    gocuotasPayment.classList.toggle("is-hidden", isDeposit);
    receiptButton.href = isDeposit
      ? receiptButton.dataset.depositUrl
      : receiptButton.dataset.fullUrl;
    receiptSubject.textContent = payment.receiptSubject;

    fullPaymentButton.classList.toggle("is-selected", !isDeposit);
    depositPaymentButton.classList.toggle("is-selected", isDeposit);
    depositNote.hidden = !isDeposit;
    fullPaymentButton.setAttribute("aria-pressed", String(!isDeposit));
    depositPaymentButton.setAttribute("aria-pressed", String(isDeposit));
    scrollToPaymentDestination(isDeposit);
  }

  // ---------------------------------------------------------
  // 6) EVENTOS DE VALIDACIÓN Y UX
  // ---------------------------------------------------------
  // Revalidamos la confirmación mientras se escribe el teléfono.
  phone.addEventListener("input", validatePhoneConfirmation);
  phoneConfirmation.addEventListener("input", validatePhoneConfirmation);

  // Cambia la opción activa entre pago total y pago con seña.
  fullPaymentButton.addEventListener("click", function () {
    selectPaymentType("full");
  });
  depositPaymentButton.addEventListener("click", function () {
    selectPaymentType("deposit");
  });

  // ---------------------------------------------------------
  // 7) ENVÍO DEL FORMULARIO
  // ---------------------------------------------------------
  // Envía los datos al Apps Script, y solo si el servidor responde
  // correctamente, se muestra la etapa de pago.
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    validatePhoneConfirmation();

    if (!form.reportValidity()) {
      return;
    }

    submitButton.disabled = true;
    submitButton.classList.add("is-loading");
    submitButton.textContent = "Enviando...";

    const formData = Object.fromEntries(new FormData(form));

    try {
      const response = await fetch(FORM_CONFIG.scriptUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(formData),
      });
      const result = await response.json();

      if (result.result !== "success") {
        throw new Error(result.error || FORM_CONFIG.errorMessage);
      }

      showPaymentStep();
    } catch (error) {
      console.error("Error al enviar el formulario:", error);
      alert(
        `${FORM_CONFIG.errorMessage}\n\nComunicate con nosotros al ${FORM_CONFIG.companyPhone}.`,
      );
      submitButton.disabled = false;
      submitButton.classList.remove("is-loading");
      submitButton.textContent = "Siguiente";
    }
  });

  // ---------------------------------------------------------
  // 8) TRANSFERENCIA BANCARIA
  // ---------------------------------------------------------
  // Muestra u oculta los datos de transferencia para quienes
  // quieran ver la información bancaria antes de pagar.
  transferButton.addEventListener("click", function () {
    const isOpening = transferDetails.hidden;
    transferDetails.hidden = !isOpening;

    if (isOpening) {
      transferDetails.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});
