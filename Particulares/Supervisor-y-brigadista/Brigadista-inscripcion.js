const FORM_CONFIG = {
  scriptUrl:
    "https://script.google.com/macros/s/AKfycbzCyeYd_4ihk1vBgRFfh7ieiGCq6M5ACUTggDm6O0RhuqbjHY2X57Z2qO77JbzmdY1r/exec",
  errorMessage:
    "No se pudo crear el formulario. Por favor, intentá nuevamente.",
  companyPhone: "11 7061-6594",
};

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

document.addEventListener("DOMContentLoaded", function () {
  // Formulario y elementos principales del flujo de inscripción.
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

  // Impide avanzar hasta que ambos teléfonos coincidan.
  function validatePhoneConfirmation() {
    const phonesMatch = phone.value.trim() === phoneConfirmation.value.trim();
    phoneConfirmation.setCustomValidity(
      phonesMatch ? "" : "Los teléfonos no coinciden.",
    );
  }

  // El desplazamiento automático solo acompaña la lectura en modo vertical.
  function isPortraitOrientation() {
    return window.matchMedia("(orientation: portrait)").matches;
  }

  // Desplaza un elemento después de actualizar el contenido visible.
  function scrollToElement(element, block = "center") {
    if (!isPortraitOrientation()) {
      return;
    }

    requestAnimationFrame(function () {
      element.scrollIntoView({ behavior: "smooth", block });
    });
  }

  // Lleva a la persona al destino relevante para la modalidad elegida.
  function scrollToPaymentDestination(isDeposit) {
    const target = isDeposit ? depositNote : paymentOptions;
    const position = isDeposit ? "start" : "center";
    scrollToElement(target, position);
  }

  // Reemplaza el formulario por las alternativas de pago después del envío.
  function showPaymentStep() {
    form.hidden = true;
    paymentStep.hidden = false;
    scrollToElement(totalPayment, "start");
  }

  // Actualiza enlaces, textos y avisos según la modalidad elegida.
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

  // Valida nuevamente la confirmación mientras la persona escribe.
  phone.addEventListener("input", validatePhoneConfirmation);
  phoneConfirmation.addEventListener("input", validatePhoneConfirmation);

  // Cambia entre pago completo y reserva mediante seña.
  fullPaymentButton.addEventListener("click", function () {
    selectPaymentType("full");
  });
  depositPaymentButton.addEventListener("click", function () {
    selectPaymentType("deposit");
  });

  // Envía los datos al Apps Script antes de habilitar el pago.
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

  // Despliega u oculta los datos para la transferencia bancaria.
  transferButton.addEventListener("click", function () {
    const isOpening = transferDetails.hidden;
    transferDetails.hidden = !isOpening;

    if (isOpening) {
      transferDetails.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});
