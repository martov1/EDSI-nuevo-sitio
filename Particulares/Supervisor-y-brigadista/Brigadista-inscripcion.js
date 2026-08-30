const FORM_CONFIG = {
  scriptUrl:
    "https://script.google.com/macros/s/AKfycbywWyr--LYMyWh2ycccccFnwaTVvdZiJkXbxZkELE--phCDnCeA9hEm2pOWALjLDjit/exec",
  errorMessage:
    "No se pudo crear el formulario. Por favor, intentá nuevamente.",
  companyPhone: "11 7061-6594",
};

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("enrollment-form");
  const paymentStep = document.getElementById("payment-step");
  const submitButton = document.getElementById("show-payment");
  const transferButton = document.getElementById("show-transfer");
  const transferDetails = document.getElementById("transfer-details");
  const phone = document.getElementById("telefono");
  const phoneConfirmation = document.getElementById("telefono-confirmacion");
  function validatePhoneConfirmation() {
    const phonesMatch = phone.value.trim() === phoneConfirmation.value.trim();
    phoneConfirmation.setCustomValidity(
      phonesMatch ? "" : "Los teléfonos no coinciden.",
    );
  }

  function showPaymentStep() {
    paymentStep.hidden = false;
    submitButton.hidden = true;
    paymentStep.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  phone.addEventListener("input", validatePhoneConfirmation);
  phoneConfirmation.addEventListener("input", validatePhoneConfirmation);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    validatePhoneConfirmation();

    if (!form.reportValidity()) {
      return;
    }

    submitButton.disabled = true;
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
        throw new Error(result.error || "No se pudo enviar el formulario.");
      }

      alert("¡Formulario enviado con éxito!");
      showPaymentStep();
    } catch (error) {
      console.error("Error al enviar el formulario:", error);
      alert(
        `${FORM_CONFIG.errorMessage}\n\nComunicate con nosotros al ${FORM_CONFIG.companyPhone}.`,
      );
      submitButton.disabled = false;
      submitButton.textContent = "Siguiente";
    }
  });

  transferButton.addEventListener("click", function () {
    transferDetails.hidden = !transferDetails.hidden;
  });
});
