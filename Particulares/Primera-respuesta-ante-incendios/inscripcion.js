---
---

/*********************************************************************
 * CONFIGURACIÓN GENERAL DEL FLUJO DE INSCRIPCIÓN
 *
 * Los datos propios del curso se leen desde _config.yml.
 *********************************************************************/
const FORM_CONFIG = {
  scriptUrl: {{ site.primera_respuesta_incendios.inscripcion.script_url | jsonify }},
  errorMessage: "No se pudo crear el formulario. Por favor, intentá nuevamente.",
  companyPhone: "11 7061-6594",
};

// Cada modalidad define los textos del botón de pago y el asunto del comprobante.
const PAYMENT_TYPES = {
  full: {
    mercadoLabel: "Mercado Pago",
    whatsappLabel: "Realizar una consulta",
    receiptSubject: "comprobante de pago - Primera respuesta ante incendios",
  },
  deposit: {
    mercadoLabel: "Pagar seña con Mercado Pago",
    whatsappLabel: "Realizar una consulta",
    receiptSubject: "comprobante de seña - Primera respuesta ante incendios",
  },
};

/*********************************************************************
 * INICIALIZACIÓN DEL FLUJO
 *
 * Cuando carga el DOM, configura cupos, validaciones y acciones del formulario.
 *********************************************************************/
document.addEventListener("DOMContentLoaded", function () {
  // Consulta el estado y actualiza el resumen de cupos de la inscripción.
  const cuposInscripcionEl = document.getElementById("cupos-inscripcion");

  if (cuposInscripcionEl) {
    obtenerEstadoCupos(CUPOS_CONFIG).then(
      ({ confirmados, cuposDisponibles }) => {
        cuposInscripcionEl.innerHTML = `Quedan <strong class="availability-number">${cuposDisponibles}</strong> cupos de un total de <strong class="availability-number">${CUPOS_CONFIG.capacidadMaxima}</strong>.`;

        // Oculta el aviso hasta que se haya ocupado al menos el 20% del curso.
        cuposInscripcionEl.hidden =
          confirmados / CUPOS_CONFIG.capacidadMaxima < 0.2;
      },
    );
  }

  /*******************************************************************
   * 1) ELEMENTOS DEL DOM
   *
   * Nodos que participan en la inscripción, validación y selección de pago.
   *******************************************************************/
  const form = document.getElementById("enrollment-form");
  if (!form) return;

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
  const whatsappPayment = document.getElementById("whatsapp-payment");
  const whatsappPaymentLabel = document.getElementById(
    "whatsapp-payment-label",
  );
  const receiptButton = document.getElementById("receipt-button");
  const receiptSubject = document.getElementById("receipt-subject");
  const phone = document.getElementById("telefono");
  const phoneConfirmation = document.getElementById("telefono-confirmacion");

  /*******************************************************************
   * 2) VALIDACIÓN DE TELÉFONO
   *
   * Comprueba que el teléfono ingresado y su confirmación sean iguales.
   *******************************************************************/
  function validatePhoneConfirmation() {
    phoneConfirmation.setCustomValidity(
      phone.value.trim() === phoneConfirmation.value.trim()
        ? ""
        : "Los teléfonos no coinciden.",
    );
  }

  /*******************************************************************
   * 3) DESPLAZAMIENTO SEGÚN MODALIDAD DE PAGO
   *
   * Lleva la vista a la nota de seña o a las opciones de pago.
   *******************************************************************/
  function scrollToPaymentDestination(isDeposit) {
    scrollToElement(
      isDeposit ? depositNote : paymentOptions,
      isDeposit ? "start" : "center",
    );
  }

  /*******************************************************************
   * 4) CAMBIO DE ETAPA: FORMULARIO → PAGO
   *
   * Oculta el formulario, muestra las opciones de pago y desplaza la vista.
   *******************************************************************/
  function showPaymentStep() {
    form.hidden = true;
    paymentStep.hidden = false;
    scrollToElement(totalPayment, "start", false);
  }

  /*******************************************************************
   * 5) SELECCIÓN DE MODALIDAD DE PAGO
   *
   * Actualiza los enlaces, textos, estado visual y nota de seña.
   *******************************************************************/
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

  /*******************************************************************
   * 6) EVENTOS DE VALIDACIÓN Y UX
   *
   * Revalida el teléfono y permite cambiar entre pago completo y seña.
   *******************************************************************/
  phone.addEventListener("input", validatePhoneConfirmation);
  phoneConfirmation.addEventListener("input", validatePhoneConfirmation);

  fullPaymentButton.addEventListener("click", function () {
    selectPaymentType("full");
  });
  depositPaymentButton.addEventListener("click", function () {
    selectPaymentType("deposit");
  });

  /*******************************************************************
   * 7) ENVÍO DEL FORMULARIO
   *
   * Envía los datos al Apps Script y muestra el pago solo si confirma
   * que la inscripción se registró correctamente.
   *******************************************************************/
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    validatePhoneConfirmation();

    if (!form.reportValidity()) return;

    submitButton.disabled = true;
    submitButton.classList.add("is-loading");
    submitButton.textContent = "Enviando...";

    try {
      if (!FORM_CONFIG.scriptUrl) {
        throw new Error("Falta configurar el servicio de inscripción del curso.");
      }

      const response = await fetch(FORM_CONFIG.scriptUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
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

  /*******************************************************************
   * 8) TRANSFERENCIA BANCARIA
   *
   * Muestra u oculta los datos bancarios para realizar la transferencia.
   *******************************************************************/
  transferButton.addEventListener("click", function () {
    const isOpening = transferDetails.hidden;
    transferDetails.hidden = !isOpening;

    if (isOpening) {
      transferDetails.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});
